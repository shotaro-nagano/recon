/* ============================================================
   週次モード — 練習メニュー生成ロジック (WeeklyScreen 専用)
   鉄則: 提案は3つまで・優先順位つき / 確定タグは断定・観察中は「可能性」 /
   数値には必ず[pt]併記
   ============================================================ */
import { computeClutch } from '@/domain/axisEngine';
import { COURSE_LABELS } from '@/domain/constants';
import { courseLossStats, serveStats } from '@/domain/insights';
import { fmtDiff, fmtRate } from '@/domain/stats';
import type { Course, Match, SelfKarte, Settings } from '@/domain/types';

export type MenuGranularity = Settings['menuGranularity'];

export type MenuBasisKind = '確定タグ' | '観察中' | '直近の課題' | '崩壊ループ' | '強み維持';

export interface WeeklyMenuItem {
  /** 1〜3 の優先順位 */
  priority: number;
  /** メニューのテーマ */
  title: string;
  /** がっちり=本数・セット数まで / ふわっと=狙いのみ */
  prescription: string;
  /** 根拠の文(確定タグは断定・観察中/直近は「可能性」) */
  basis: string;
  /** 数値表記(.mono 表示用・[pt]付き) */
  stat: string;
  basisKind: MenuBasisKind;
}

/** 直近 days 日以内の承認済み試合を抽出(週次の入力) */
export function recentApprovedWithinDays(approved: Match[], today: string, days = 7): Match[] {
  const d = new Date(today); // YYYY-MM-DD は UTC として解釈される
  d.setUTCDate(d.getUTCDate() - days);
  const cutoff = d.toISOString().slice(0, 10);
  return approved.filter((m) => m.date >= cutoff);
}

/* ---- コース別ドリル定義(粒度2種) ---- */
const COURSE_DRILL: Record<Course, { theme: string; tight: string; soft: string }> = {
  1: {
    theme: 'バック前の台上処理',
    tight: 'バック前ストップ→フォア展開 3球×10セット',
    soft: 'バック前の短い球を先に触り、低く収める意識づけ',
  },
  2: {
    theme: 'ミドル前の判断',
    tight: 'ミドル前フリック/ストップの判断 5球×8セット',
    soft: 'ミドル前で迷わない。回るか伸ばすかを早く決める',
  },
  3: {
    theme: 'フォア前の台上処理',
    tight: 'フォア前ストップ→バック展開 3球×10セット',
    soft: 'フォア前を浮かさず低く止める感覚づくり',
  },
  4: {
    theme: 'バック奥への対応',
    tight: 'バック奥ロング対応のバックドライブ 5球×10セット',
    soft: 'バック奥への速い球に振り遅れない構えの確認',
  },
  5: {
    theme: 'ミドル奥のさばき',
    tight: 'ミドル奥を回り込み/バック処理に振り分け 5球×8セット',
    soft: '体の正面に来る球の足さばきを整理する',
  },
  6: {
    theme: 'フォア奥への対応',
    tight: 'フォア奥への飛びつき→戻り 5球×10セット',
    soft: 'フォア奥に振られた後の戻りを速くする',
  },
};

/** 傾向キー "receive-loss:cN" → コース番号 */
function courseOf(key?: string): Course | null {
  if (!key) return null;
  const m = /^receive-loss:c([1-6])$/.exec(key);
  return m ? (Number(m[1]) as Course) : null;
}

interface Candidate {
  rank: number; // 小さいほど優先(0=確定タグ)
  dedupeKey: string;
  title: string;
  tight: string;
  soft: string;
  basis: string;
  stat: string;
  basisKind: MenuBasisKind;
}

/**
 * 直近7日の承認済み試合とカルテから、優先順位つき3項目までの練習メニューを生成する。
 * 優先順: 確定タグ > 直近試合の課題 > 崩壊ループ対策 > 観察中 > 強み維持。
 */
export function buildWeeklyMenu(
  recentApproved: Match[],
  karte: SelfKarte,
  granularity: MenuGranularity,
): WeeklyMenuItem[] {
  const cands: Candidate[] = [];

  // 1. 確定タグ(断定してよい弱点)
  const confirmed = [...karte.tendencies]
    .filter((t) => t.status === 'confirmed')
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  for (const t of confirmed) {
    const course = courseOf(t.key);
    const drill = course ? COURSE_DRILL[course] : null;
    cands.push({
      rank: 0,
      dedupeKey: t.key ?? t.text,
      title: drill ? drill.theme : t.text,
      tight: drill ? drill.tight : '課題場面の再現ラリー 10本×5セット',
      soft: drill ? drill.soft : '課題の場面を意図的に作って反復する',
      basis: course
        ? `${COURSE_LABELS[course]}へのレシーブで失点しやすい。確定済みの弱点`
        : `${t.text} — 確定済みの弱点`,
      stat: t.value != null ? fmtRate(t.value, t.pt, t.ci) : `[${t.pt}pt]`,
      basisKind: '確定タグ',
    });
  }

  // 2. 直近7日の試合から検出した課題(未確定 → 「可能性」表現)
  if (recentApproved.length > 0) {
    const loss = courseLossStats(recentApproved).find((s) => s.count >= 4 && s.lossRate >= 0.5);
    if (loss) {
      cands.push({
        rank: 1,
        dedupeKey: `receive-loss:c${loss.course}`,
        title: COURSE_DRILL[loss.course].theme,
        tight: COURSE_DRILL[loss.course].tight,
        soft: COURSE_DRILL[loss.course].soft,
        basis: `直近7日の試合で${loss.label}への失点が集中している可能性`,
        stat: fmtRate(loss.lossRate, loss.count, loss.ci),
        basisKind: '直近の課題',
      });
    }
    const clutch = computeClutch(recentApproved);
    if (clutch && clutch.pt >= 6 && clutch.diff <= -0.05) {
      cands.push({
        rank: 1,
        dedupeKey: 'clutch',
        title: '終盤(9点以遠)の組み立て',
        tight: '9-9想定: 出すサーブを決めてから3本勝負 ×10ゲーム',
        soft: '9点以降の1本目に何を出すかを先に決めてから打つ',
        basis: '直近7日の試合で終盤の得点率が全体より低い可能性',
        stat: fmtDiff(clutch.diff, clutch.pt, clutch.ci),
        basisKind: '直近の課題',
      });
    }
    const weakServe = serveStats(recentApproved)
      .filter((s) => s.count >= 6 && s.winRate < 0.45)
      .sort((a, b) => a.winRate - b.winRate)[0];
    if (weakServe) {
      cands.push({
        rank: 1,
        dedupeKey: `serve:${weakServe.serveType}`,
        title: `${weakServe.serveType}サーブからの展開の立て直し`,
        tight: `${weakServe.serveType}サーブ→3球目攻撃 5本×10セット`,
        soft: `${weakServe.serveType}サーブの後の3球目を決め打ちせず組み立て直す`,
        basis: `直近7日の試合で${weakServe.serveType}サーブの得点率が低い可能性`,
        stat: fmtRate(weakServe.winRate, weakServe.count, weakServe.ci),
        basisKind: '直近の課題',
      });
    }
  }

  // 3. 崩壊ループ対策(承認済みのループ → 脱出行動の再現練習)
  const loop = karte.loops[0];
  if (loop) {
    cands.push({
      rank: 2,
      dedupeKey: `loop:${loop.id}`,
      title: '崩れた時に戻る行動の再現',
      tight: `「${loop.escapeAction}」の再現 5本×6セット(連続失点後の場面を想定)`,
      soft: `連続失点したら「${loop.escapeAction}」に戻る、と決めておく`,
      basis: `崩壊ループ「${loop.trigger}→${loop.result}」が確認されている`,
      stat: `発生${loop.occurrences}回[${loop.matches}試合]`,
      basisKind: '崩壊ループ',
    });
  }

  // 4. 観察中(断定しない)
  const observed = [...karte.tendencies]
    .filter((t) => t.status === 'observed')
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  for (const t of observed) {
    const course = courseOf(t.key);
    const drill = course ? COURSE_DRILL[course] : null;
    cands.push({
      rank: 3,
      dedupeKey: t.key ?? t.text,
      title: drill ? drill.theme : t.text,
      tight: drill ? drill.tight : '課題場面の再現ラリー 10本×5セット',
      soft: drill ? drill.soft : '課題の場面を意図的に作って様子を見る',
      basis: course
        ? `${COURSE_LABELS[course]}へのレシーブで失点しやすい可能性(観察中 — まだ断定しない)`
        : `「${t.text}」の可能性(観察中 — まだ断定しない)`,
      stat: t.value != null ? fmtRate(t.value, t.pt, t.ci) : `[${t.pt}pt]`,
      basisKind: '観察中',
    });
  }

  // 5. 課題ゼロなら強みの精度維持(空メニューにしない)
  if (cands.length === 0 && recentApproved.length > 0) {
    const best = serveStats(recentApproved)
      .filter((s) => s.count >= 5)
      .sort((a, b) => b.winRate - a.winRate)[0];
    if (best) {
      cands.push({
        rank: 4,
        dedupeKey: `serve-keep:${best.serveType}`,
        title: `強みの${best.serveType}サーブ展開を磨く`,
        tight: `${best.serveType}サーブ→得意展開 5本×8セット`,
        soft: `得意の${best.serveType}サーブ展開の精度を保つ`,
        basis: '明確な課題は未検出。最多得点源の精度維持を優先',
        stat: fmtRate(best.winRate, best.count, best.ci),
        basisKind: '強み維持',
      });
    }
  }

  // 重複(同一コース等)を除き、優先順に3項目まで
  const seen = new Set<string>();
  return cands
    .sort((a, b) => a.rank - b.rank) // sortは安定 → 同rank内は挿入順を維持
    .filter((c) => {
      if (seen.has(c.dedupeKey)) return false;
      seen.add(c.dedupeKey);
      return true;
    })
    .slice(0, 3)
    .map((c, i) => ({
      priority: i + 1,
      title: c.title,
      prescription: granularity === 'がっちり' ? c.tight : c.soft,
      basis: c.basis,
      stat: c.stat,
      basisKind: c.basisKind,
    }));
}
