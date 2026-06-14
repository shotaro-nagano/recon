/* ============================================================
   試合後モード — 単一試合の分析(純関数)
   domain/insights は直近5試合の集計なので、ここでは
   Match.rallies から「その試合だけ」の数値を直接計算する。
   ============================================================ */
import { COURSE_LABELS } from '@/domain/constants';
import { fmtDiff, fmtRate, wilsonHalfWidth } from '@/domain/stats';
import type { Course, Match, OpponentKarte, RallyRow } from '@/domain/types';

/** 9点以遠 = クラッチ */
const isClutchRally = (r: RallyRow) => Math.max(r.myScore, r.oppScore) >= 9;

/* ---------------- 基本集計 ---------------- */

export interface MatchPointRate {
  rate: number;
  pt: number;
}

/** 総得点率(全ラリーのうち自分が取った割合) */
export function pointRateOfMatch(m: Match): MatchPointRate {
  const pt = m.rallies.length;
  if (pt === 0) return { rate: 0, pt: 0 };
  const wins = m.rallies.filter((r) => r.winner === 'me').length;
  return { rate: wins / pt, pt };
}

/* ---- サーブ別成績(この試合のみ) ---- */
export interface SingleServeStat {
  serveType: string;
  count: number;
  winRate: number;
  ci: number;
}

export function serveStatsOfMatch(m: Match): SingleServeStat[] {
  const groups = new Map<string, { wins: number; total: number }>();
  for (const r of m.rallies) {
    if (r.server !== 'me') continue;
    const g = groups.get(r.serveType) ?? { wins: 0, total: 0 };
    g.total += 1;
    if (r.winner === 'me') g.wins += 1;
    groups.set(r.serveType, g);
  }
  return [...groups.entries()]
    .map(([serveType, g]) => ({
      serveType,
      count: g.total,
      winRate: g.wins / g.total,
      ci: wilsonHalfWidth(g.wins / g.total, g.total),
    }))
    .sort((a, b) => b.count - a.count);
}

/* ---- コース別失点(この試合のみ・相手サーブのコース別) ---- */
export interface SingleCourseLoss {
  course: Course;
  label: string;
  count: number;
  lossRate: number;
  ci: number;
}

export function courseLossOfMatch(m: Match): SingleCourseLoss[] {
  const groups = new Map<Course, { losses: number; total: number }>();
  for (const r of m.rallies) {
    if (r.server !== 'opp') continue;
    const g = groups.get(r.serveCourse) ?? { losses: 0, total: 0 };
    g.total += 1;
    if (r.winner === 'opp') g.losses += 1;
    groups.set(r.serveCourse, g);
  }
  return [...groups.entries()]
    .map(([course, g]) => ({
      course,
      label: COURSE_LABELS[course],
      count: g.total,
      lossRate: g.losses / g.total,
      ci: wilsonHalfWidth(g.losses / g.total, g.total),
    }))
    .sort((a, b) => b.lossRate - a.lossRate);
}

/* ---- クラッチ(この試合のみ・9点以遠) ---- */
export interface SingleClutch {
  winRate: number;
  /** 9点以遠の得点率 − この試合の総得点率 */
  diff: number;
  pt: number;
  ci: number;
}

export function clutchOfMatch(m: Match): SingleClutch | null {
  const clutch = m.rallies.filter(isClutchRally);
  if (clutch.length < 4) return null; // サンプル不足は正直に出さない
  const winRate = clutch.filter((r) => r.winner === 'me').length / clutch.length;
  const { rate } = pointRateOfMatch(m);
  return {
    winRate,
    diff: winRate - rate,
    pt: clutch.length,
    ci: wilsonHalfWidth(winRate, clutch.length),
  };
}

/* ---------------- 惨敗判定 ---------------- */

/** 惨敗ライン: セットを1つも取れず(0-3以上)、総得点率45%未満 */
export const BLOWOUT_POINT_RATE = 0.45;

export function isBlowout(m: Match): boolean {
  const { rate, pt } = pointRateOfMatch(m);
  return m.mySets === 0 && m.oppSets >= 3 && pt > 0 && rate < BLOWOUT_POINT_RATE;
}

/* ---------------- ほころびの抽出(1試合分=観察中レベル → 「可能性」表現) ---------------- */

export interface MatchIssue {
  kind: 'course' | 'clutch' | 'serve';
  /** 前置きテキスト */
  lead: string;
  /** fmtRate/fmtDiff 済みの数値文字列(画面側で .mono を付ける) */
  stat: string;
  /** 「〜の可能性がある」で締める後置きテキスト */
  tail: string;
  /** 要点1行(「明日見る」用) */
  short: string;
  course?: Course;
  serveType?: string;
}

/**
 * この試合のほころび候補を優先順位つきで返す(最大3件)。
 * 優先度: コース別失点 > クラッチ > サーブ別。
 * 1試合のみのデータなので、すべて「可能性」レベルの表現とする。
 */
export function issuesOfMatch(m: Match): MatchIssue[] {
  const out: MatchIssue[] = [];

  // 1) 最も失点率の高いレシーブコース
  const worstCourse = courseLossOfMatch(m).find((c) => c.count >= 4 && c.lossRate >= 0.55);
  if (worstCourse) {
    out.push({
      kind: 'course',
      lead: `相手サーブが${worstCourse.label}(${worstCourse.course})に来た時の失点率`,
      stat: fmtRate(worstCourse.lossRate, worstCourse.count, worstCourse.ci),
      tail: '。レシーブの穴になっている可能性がある。',
      short: `${worstCourse.label}へのサーブで失点率${Math.round(worstCourse.lossRate * 100)}%[${worstCourse.count}pt]が最大の失点源。`,
      course: worstCourse.course,
    });
  }

  // 2) クラッチの落ち込み
  const clutch = clutchOfMatch(m);
  if (clutch && clutch.diff <= -0.1) {
    out.push({
      kind: 'clutch',
      lead: '終盤(9点以遠)の得点率は全体比',
      stat: fmtDiff(clutch.diff, clutch.pt),
      tail: '。競り合いで選択が硬くなっている可能性がある。',
      short: `終盤の得点率が全体比${Math.round(clutch.diff * 100)}%[${clutch.pt}pt]。`,
    });
  }

  // 3) 効かなかったサーブ
  const badServe = [...serveStatsOfMatch(m)]
    .sort((a, b) => a.winRate - b.winRate)
    .find((s) => s.count >= 4 && s.winRate <= 0.45);
  if (badServe) {
    out.push({
      kind: 'serve',
      lead: `${badServe.serveType}サーブの得点率`,
      stat: fmtRate(badServe.winRate, badServe.count, badServe.ci),
      tail: '。この相手には読まれていた可能性がある。',
      short: `${badServe.serveType}サーブの得点率${Math.round(badServe.winRate * 100)}%[${badServe.count}pt]。`,
      serveType: badServe.serveType,
    });
  }

  return out.slice(0, 3);
}

/** 「明日見る」選択時に表示する要点1行 */
export function headlineOfMatch(m: Match): string {
  const top = issuesOfMatch(m)[0];
  if (top) return `要点: ${top.short}`;
  const { rate, pt } = pointRateOfMatch(m);
  return `要点: 大きなほころびは検出されず。総得点率${Math.round(rate * 100)}%[${pt}pt]。`;
}

/* ---------------- 次の練習で1つだけやること ---------------- */

export interface PracticeSuggestion {
  menu: string;
  reasonLead: string;
  /** fmtRate/fmtDiff 済み数値(画面で .mono) */
  reasonStat: string;
  reasonTail: string;
}

/** 最優先のほころび1つだけを練習メニューに変換する(鉄則: 提案は1つ) */
export function practiceSuggestionOfMatch(m: Match): PracticeSuggestion {
  const top = issuesOfMatch(m)[0];
  if (top) {
    if (top.kind === 'course' && top.course != null) {
      const label = COURSE_LABELS[top.course];
      return {
        menu: `${label}(${top.course})へのサーブを想定したレシーブ集中練習(同コース20本×3セット)`,
        reasonLead: top.lead,
        reasonStat: top.stat,
        reasonTail: '。1試合のみの観測なので、次戦までに反応を作っておく。',
      };
    }
    if (top.kind === 'clutch') {
      return {
        menu: '9-9想定のサーブからの組み立て練習(得意サーブ起点・10本勝負×3回)',
        reasonLead: top.lead,
        reasonStat: top.stat,
        reasonTail: '。終盤に迷わず出せる形を1つ固める。',
      };
    }
    return {
      menu: `${top.serveType ?? ''}サーブのコースを散らす再構築練習(前後2コース×10本)`,
      reasonLead: top.lead,
      reasonStat: top.stat,
      reasonTail: '。同じ球種でもコースが散れば読まれにくくなる。',
    };
  }
  // ほころびなし → 得点源をさらに磨く
  const best = [...serveStatsOfMatch(m)].sort((a, b) => b.winRate - a.winRate)[0];
  if (best) {
    return {
      menu: `${best.serveType}サーブ起点の3球目攻撃パターンを増やす練習(20本×2セット)`,
      reasonLead: `この試合の得点源は${best.serveType}サーブ(得点率`,
      reasonStat: fmtRate(best.winRate, best.count, best.ci),
      reasonTail: ')。武器を太くする。',
    };
  }
  return {
    menu: '基礎の多球練習(フットワーク中心・10分×3本)',
    reasonLead: 'この試合のサーブデータは',
    reasonStat: `${m.rallies.length}pt`,
    reasonTail: 'で個別の傾向を出すには不足。土台づくりに充てる。',
  };
}

/* ---------------- 初見相手のカルテ雛形(3項目・暫定[pt]付き) ---------------- */

export function buildOpponentDraft(m: Match, id: string): OpponentKarte {
  // サーブ傾向: 相手サーブの球種分布と、相手のサーブ時得点率
  const serveGroups = new Map<string, { wins: number; total: number }>();
  // 勝負どころの癖: クラッチで相手が選んだサーブ
  const clutchServe = new Map<string, number>();
  let clutchTotal = 0;
  let clutchOppWins = 0;
  // レシーブの穴: 自分サーブのコース別に、自分の得点率が高い所
  const holeGroups = new Map<Course, { wins: number; total: number }>();

  for (const r of m.rallies) {
    if (r.server === 'opp') {
      const g = serveGroups.get(r.serveType) ?? { wins: 0, total: 0 };
      g.total += 1;
      if (r.winner === 'opp') g.wins += 1;
      serveGroups.set(r.serveType, g);
      if (isClutchRally(r)) {
        clutchServe.set(r.serveType, (clutchServe.get(r.serveType) ?? 0) + 1);
      }
    } else {
      const g = holeGroups.get(r.serveCourse) ?? { wins: 0, total: 0 };
      g.total += 1;
      if (r.winner === 'me') g.wins += 1;
      holeGroups.set(r.serveCourse, g);
    }
    if (isClutchRally(r)) {
      clutchTotal += 1;
      if (r.winner === 'opp') clutchOppWins += 1;
    }
  }

  const serveTendency = [...serveGroups.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 2)
    .map(([type, g]) => `${type}サーブ中心、サーブ時得点率${fmtRate(g.wins / g.total, g.total)}(暫定)`);

  const receiveHoles = [...holeGroups.entries()]
    .filter(([, g]) => g.total >= 3 && g.wins / g.total >= 0.6)
    .sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total)
    .slice(0, 2)
    .map(
      ([course, g]) =>
        `${COURSE_LABELS[course]}(${course})へのこちらのサーブに対し失点率${fmtRate(g.wins / g.total, g.total)}(暫定)`,
    );

  const clutchHabits: string[] = [];
  if (clutchTotal >= 4) {
    clutchHabits.push(`終盤(9点以遠)の相手得点率${fmtRate(clutchOppWins / clutchTotal, clutchTotal)}(暫定)`);
  }
  const favClutchServe = [...clutchServe.entries()].sort((a, b) => b[1] - a[1])[0];
  if (favClutchServe && favClutchServe[1] >= 2) {
    clutchHabits.push(`終盤は${favClutchServe[0]}サーブに頼る可能性(${favClutchServe[1]}本観測・暫定)`);
  }

  const fallback = ['データ不足 — 次の対戦で観察する'];
  return {
    id,
    name: m.opponentName,
    judgedPt: m.rallies.length,
    serveTendency: serveTendency.length > 0 ? serveTendency : fallback,
    receiveHoles: receiveHoles.length > 0 ? receiveHoles : fallback,
    clutchHabits: clutchHabits.length > 0 ? clutchHabits : fallback,
    notes: [
      {
        date: m.date,
        tournament: m.tournament,
        text: `初対戦 ${m.mySets}-${m.oppSets}(この試合の集計から雛形を自動作成)`,
      },
    ],
  };
}
