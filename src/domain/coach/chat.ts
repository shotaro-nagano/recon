/* ============================================================
   端末内コーチ・チャット(LLM不使用・外部送信なし)
   選手の質問を意図分類し、既存エンジン(タイプ・カルテ・相性・傾向)から
   データに基づいて回答する。鉄則: 数値は[pt]併記 / 観察中は「可能性」/
   フォーム・体調・深いメンタルは人間へ。
   ============================================================ */
import { CODENAMES, COURSE_LABELS, MEASURED_MIN_MATCHES, VARIANT_READING } from '@/domain/constants';
import { courseLossStats, serveStats } from '@/domain/insights';
import { matchup, SYMBOL_LABEL } from '@/domain/compatibility';
import { OUT_OF_SCOPE_NOTICE, voice } from '@/domain/persona';
import { fmtDiff, fmtRate } from '@/domain/stats';
import { buildWeeklyMenu, recentApprovedWithinDays } from '@/domain/coach/weekly';
import type {
  DiagnosisAnswers, Match, OpponentKarte, SelfKarte, Settings, TypeResult,
} from '@/domain/types';

export interface ChatContext {
  result: TypeResult;
  approved: Match[];
  karte: SelfKarte;
  opponents: OpponentKarte[];
  diagnosis: DiagnosisAnswers | null;
  settings: Settings;
  today: string;
}

export interface ChatReply {
  /** コーチの吹き出し(複数可) */
  texts: string[];
  /** 次の質問候補(タップ用) */
  chips: string[];
}

export const DEFAULT_CHIPS = ['私のタイプは？', '弱点は？', '次の練習は？', '使い方は？'];

/* ---- 各トピックの回答ビルダー ---- */

function describeType(ctx: ChatContext): string[] {
  const r = ctx.result;
  if (r.stage === 'none' || !r.codename) {
    return ['まだコードネームは解析できていない。診断(7問・約2分)を受けると、仮タイプが点灯するぞ。'];
  }
  const def = CODENAMES[r.codename];
  const vSym = r.variant === 'omega' ? 'Ω' : 'α';
  const reading = `${def.reading}・${r.variant ? VARIANT_READING[r.variant] : ''}`;
  const head = `今のコードネームは ${r.codename}-${vSym}(${reading})。${def.style}。勝ち筋は「${def.winPattern}」。`;
  const stage = r.stage === 'measured'
    ? `承認済み${r.matchCount}試合・${r.totalPt}ptからの実測だ。`
    : `今は診断による仮タイプ。承認済みが${MEASURED_MIN_MATCHES}試合たまると実測に進化する(あと${Math.max(0, MEASURED_MIN_MATCHES - r.matchCount)}試合)。`;
  return [head, stage];
}

function describeWeakness(ctx: ChatContext): string[] {
  const out: string[] = [];
  const confirmed = ctx.karte.tendencies.filter((t) => t.status === 'confirmed');
  const observed = ctx.karte.tendencies.filter((t) => t.status === 'observed');
  if (confirmed.length > 0) {
    out.push('確定している弱点はこれだ:');
    for (const t of confirmed.slice(0, 3)) {
      out.push(`・${t.text}${t.value != null ? ` ${fmtRate(t.value, t.pt, t.ci)}` : ` [${t.pt}pt]`}`);
    }
  } else {
    const loss = courseLossStats(ctx.approved).filter((s) => s.count >= 4 && s.lossRate >= 0.5).slice(0, 2);
    if (loss.length > 0) {
      out.push('まだ確定ではないが、データ上は次が気になる(可能性):');
      for (const l of loss) out.push(`・${l.label}(${l.course})への失点率 ${fmtRate(l.lossRate, l.count, l.ci)}`);
    }
  }
  if (observed.length > 0) {
    out.push('観察中(まだ断定しない):');
    for (const t of observed.slice(0, 2)) out.push(`・${t.text}の可能性 [${t.pt}pt]`);
  }
  if (out.length === 0) {
    out.push('今のところ承認データから大きな弱点は出ていない。試合を取り込んで承認すると精度が上がるぞ。');
  }
  return out;
}

function describeStrength(ctx: ChatContext): string[] {
  const out: string[] = [];
  const serves = serveStats(ctx.approved).filter((s) => s.count >= 5).sort((a, b) => b.winRate - a.winRate);
  if (serves.length > 0) {
    const s = serves[0];
    out.push(`武器は${s.serveType}サーブ。得点率 ${fmtRate(s.winRate, s.count, s.ci)} だ。`);
  }
  const c = ctx.result.clutch;
  if (c && c.diff >= 0.03) {
    out.push(`終盤も強い。9点以遠の得点率は全体比 ${fmtDiff(c.diff, c.pt, c.ci)}。`);
  }
  if (out.length === 0) out.push('まだ承認データが少なくて、強みを数値で出せない。試合を承認すると見えてくるぞ。');
  return out;
}

function describePractice(ctx: ChatContext): string[] {
  const recent7 = recentApprovedWithinDays(ctx.approved, ctx.today);
  const menu = buildWeeklyMenu(recent7, ctx.karte, ctx.settings.menuGranularity);
  if (menu.length === 0) {
    return ['まだメニューを組む材料が足りない。試合を承認すると、課題から練習を提案できる。'];
  }
  const out = ['次にやるならこの順番だ(最優先から):'];
  for (const m of menu) out.push(`${m.priority}. ${m.title} — ${m.prescription}(根拠: ${m.stat})`);
  return out;
}

function describeServe(ctx: ChatContext): string[] {
  const serves = serveStats(ctx.approved);
  if (serves.length === 0) return ['まだサーブのデータが無い。試合を承認すると球種別の得点率が出るぞ。'];
  const out = ['サーブ別の得点率(直近5試合):'];
  for (const s of serves.slice(0, 4)) {
    out.push(`・${s.serveType}(主に${COURSE_LABELS[s.mainCourse]}) ${fmtRate(s.winRate, s.count, s.ci)}`);
  }
  return out;
}

function describeCollapse(ctx: ChatContext): string[] {
  const loop = ctx.karte.loops[0];
  if (!loop) return ['記録された崩壊パターンはまだない。崩れた試合があれば、試合後モードやカルテで記録できるぞ。'];
  return [
    `崩れる時のパターンはこれだ:「${loop.trigger}」→ ${loop.middle} → ${loop.result}(発生${loop.occurrences}回/${loop.matches}試合)。`,
    `戻る場所はこれ: ${loop.escapeAction}。兆候が出たら迷わずここへ。`,
  ];
}

function describePrecision(ctx: ChatContext): string[] {
  const r = ctx.result;
  const out = [`いまのデータ残高は ${r.totalPt}pt(承認済み${r.matchCount}試合)。`];
  if (r.clutch) out.push(`主要指標のクラッチは ${fmtDiff(r.clutch.diff, r.clutch.pt, r.clutch.ci)}。データが増えるほど±が縮む。`);
  if (r.stage !== 'measured') out.push(`実測タイプ確定まであと ${Math.max(0, MEASURED_MIN_MATCHES - r.matchCount)} 試合だ。`);
  return out;
}

function describeHelp(): string[] {
  return [
    '使い方をざっくり: ホーム=今の自分、コーチ=試合前/後・週末の相談、試合=データ取り込み、カルテ=育つ記録。',
    'まずは「コーチ → 試合前」で戦術カードを試すのがおすすめだ。設定の「使い方ガイド」でツアーも見られるぞ。',
  ];
}

/** 相手名を含む質問なら相性と狙いどころを返す(なければ null) */
function describeOpponent(ctx: ChatContext, text: string): string[] | null {
  const opp = ctx.opponents.find(
    (o) => text.includes(o.name) || (o.name.replace(/\s/g, '').length >= 2 && text.includes(o.name.replace(/\s/g, '').slice(0, 2))),
  );
  if (!opp) return null;
  const out = [`${opp.name}${opp.affiliation ? `(${opp.affiliation})` : ''}の対策だな。`];
  if (opp.provisionalCodename && ctx.result.codename && ctx.result.variant) {
    const mu = matchup(
      { codename: ctx.result.codename, variant: ctx.result.variant },
      { codename: opp.provisionalCodename, variant: opp.provisionalVariant },
      { matches: ctx.approved, opponents: ctx.opponents },
    );
    out.push(
      `相性は ${mu.symbol}(${SYMBOL_LABEL[mu.symbol]})${mu.sampleSize > 0 ? `[対戦${mu.sampleSize}試合]` : '[理論値]'}。相手は${opp.provisionalCodename}(暫定[${opp.judgedPt}pt])。`,
    );
    for (const n of mu.notes.slice(0, 2)) out.push(`※ ${n}`);
  } else {
    out.push('相手のタイプはまだ未判定だ。対戦データが増えると相性が出せる。');
  }
  const holes = opp.receiveHoles.filter((x) => !x.includes('データ不足'));
  if (holes.length > 0) out.push(`狙いどころ: ${holes.slice(0, 2).join(' / ')}`);
  const serves = opp.serveTendency.filter((x) => !x.includes('データ不足'));
  if (serves.length > 0) out.push(`警戒: ${serves.slice(0, 2).join(' / ')}`);
  out.push('試合前は「コーチ → 試合前」で戦術カードを開くと1画面にまとまるぞ。');
  return out;
}

/* ---- メインルーター ---- */

export function coachReply(input: string, ctx: ChatContext): ChatReply {
  const text = input.trim();
  const low = text.toLowerCase();
  const v = voice(ctx.settings.persona);
  const has = (...kw: string[]) => kw.some((k) => text.includes(k) || low.includes(k.toLowerCase()));

  // 1) 扱わない領域(フォーム・体調・深いメンタル) → 人間へ
  if (has('体調', '怪我', 'けが', '痛い', '痛む', '疲れ', 'フォーム', '打ち方', 'メンタル', '緊張', '不安', 'やる気', 'モチベ', '眠れ')) {
    return { texts: [v('deferHuman'), OUT_OF_SCOPE_NOTICE], chips: DEFAULT_CHIPS };
  }

  // 2) 相手名を含む → 相性・対策
  const opp = describeOpponent(ctx, text);
  if (opp) return { texts: opp, chips: ['弱点は？', '次の練習は？', '私のタイプは？'] };

  if (has('タイプ', 'コードネーム', '何型', '私は何', '型は', 'codename')) {
    return { texts: describeType(ctx), chips: ['弱点は？', '強みは？', '次の練習は？'] };
  }
  if (has('弱点', '課題', '苦手', '悪い', '負け', 'やられ')) {
    return { texts: describeWeakness(ctx), chips: ['次の練習は？', '崩れるパターンは？', '強みは？'] };
  }
  if (has('強み', '得意', '武器', '良い', 'いいところ')) {
    return { texts: describeStrength(ctx), chips: ['弱点は？', '次の練習は？'] };
  }
  if (has('練習', 'メニュー', 'ドリル', '何をすれば', '何すれば', 'やること', 'トレーニング')) {
    return { texts: describePractice(ctx), chips: ['弱点は？', '私のタイプは？'] };
  }
  if (has('崩れ', '崩壊', '連続失点', '連敗', '立て直', 'ループ')) {
    return { texts: describeCollapse(ctx), chips: ['次の練習は？', '弱点は？'] };
  }
  if (has('サーブ')) {
    return { texts: describeServe(ctx), chips: ['弱点は？', '次の練習は？'] };
  }
  if (has('相性', '対策', '相手', 'vs', '対戦')) {
    if (ctx.opponents.length > 0) {
      return {
        texts: ['誰の対策だ?相手の名前を送ってくれれば、相性と狙いどころを出すぞ。', `登録済み: ${ctx.opponents.map((o) => o.name).join(' / ')}`],
        chips: ctx.opponents.slice(0, 3).map((o) => `${o.name}の対策は？`),
      };
    }
    return {
      texts: ['まだ相手カルテが無い。試合後モードで相手カルテを作るか、相手タブから登録すると対策を出せるぞ。'],
      chips: DEFAULT_CHIPS,
    };
  }
  if (has('試合前', '戦術', '作戦', 'カード')) {
    return {
      texts: ['試合前は「コーチ → 試合前」で戦術カードを開くと、攻め筋・警戒・勝負どころ・戻る場所が1画面で出るぞ。', '相手を選べば相性も込みで出す。'],
      chips: ['弱点は？', '次の練習は？'],
    };
  }
  if (has('精度', 'あと何試合', 'データ', '残高', '信頼', 'pt')) {
    return { texts: describePrecision(ctx), chips: ['私のタイプは？', '次の練習は？'] };
  }
  if (has('使い方', 'ヘルプ', 'help', 'わからない', '分からない', 'どうすれば', '何ができる', '何が')) {
    return { texts: describeHelp(), chips: DEFAULT_CHIPS };
  }
  if (has('こんにちは', 'おはよう', 'こんばんは', 'やあ', 'はじめまして', 'hi', 'hello', 'よろしく', 'ありがとう', 'どうも')) {
    return {
      texts: [v('greet', { name: ctx.settings.playerName || undefined, codename: ctx.result.codename }), 'カルテのことなら何でも聞いてくれ。下のボタンからでもいいぞ。'],
      chips: DEFAULT_CHIPS,
    };
  }

  // フォールバック
  return {
    texts: [
      'うまく聞き取れなかった。カルテの中のことなら、こんな質問に答えられるぞ:',
      '「私のタイプは？」「弱点は？」「次の練習は？」「(相手の名前)の対策は？」',
    ],
    chips: DEFAULT_CHIPS,
  };
}

/* ============================================================
   端末内蔵AI用のシステムプロンプト
   選手データを要約して注入し、コーチ人格と鉄則を守らせる。
   ============================================================ */
export function buildCoachSystemPrompt(ctx: ChatContext): string {
  const r = ctx.result;
  const lines: string[] = [];
  lines.push('あなたは卓球選手専用のAIコーチ。選手本人と1対1で、日本語で簡潔に、親しみやすく話す。');
  const tone = ctx.settings.persona === 'passion' ? '熱血で前向きな口調。'
    : ctx.settings.persona === 'analyst' ? 'フラットで数値重視の冷静な口調。'
      : '冷静なオペレーター風の口調。';
  lines.push(`口調: ${tone}`);
  lines.push(
    '鉄則: ①1回の助言で提案は3つまで、優先順位をつける ②確定していない傾向は「可能性」と表現し断定しない ' +
    '③数値には必ず[pt(サンプル数)]を併記 ④相性は対戦サンプル数を併記し0なら理論値と明示 ' +
    '⑤フォームの細部・体調や怪我・深いメンタルはAIの担当外として監督やコーチへ相談を促す ' +
    '⑥提供された情報の範囲で答え、データにない推測で相手や本人を分析しない。',
  );

  if (r.stage !== 'none' && r.codename) {
    const def = CODENAMES[r.codename];
    const vSym = r.variant === 'omega' ? 'Ω' : 'α';
    lines.push(`■選手の現在タイプ: ${r.codename}-${vSym}(${def.reading})。${def.style}。勝ち筋「${def.winPattern}」。${r.stage === 'measured' ? `実測(${r.matchCount}試合・${r.totalPt}pt)` : '診断ベースの仮タイプ'}。`);
    for (const a of r.axes) lines.push(`軸${a.axis}: ${a.score.toFixed(0)}(${a.pole}) ±${a.ci.toFixed(0)} [${a.pt}pt]`);
    if (r.clutch) lines.push(`クラッチ(9点以遠−全体): ${fmtDiff(r.clutch.diff, r.clutch.pt, r.clutch.ci)}`);
  } else {
    lines.push('■選手はまだ診断/実測データが少ない。まず診断や試合取り込みを促す。');
  }

  const confirmed = ctx.karte.tendencies.filter((t) => t.status === 'confirmed');
  if (confirmed.length > 0) {
    lines.push('■確定した弱点: ' + confirmed.map((t) => `${t.text}${t.value != null ? ` ${fmtRate(t.value, t.pt, t.ci)}` : ` [${t.pt}pt]`}`).join(' / '));
  }
  const observed = ctx.karte.tendencies.filter((t) => t.status === 'observed');
  if (observed.length > 0) {
    lines.push('■観察中(可能性・断定しない): ' + observed.map((t) => `${t.text} [${t.pt}pt]`).join(' / '));
  }
  const serves = serveStats(ctx.approved).slice(0, 4);
  if (serves.length > 0) {
    lines.push('■サーブ別得点率: ' + serves.map((s) => `${s.serveType}(${COURSE_LABELS[s.mainCourse]}) ${fmtRate(s.winRate, s.count, s.ci)}`).join(' / '));
  }
  const loop = ctx.karte.loops[0];
  if (loop) {
    lines.push(`■崩壊ループ: 「${loop.trigger}」→${loop.result}(発生${loop.occurrences}/${loop.matches}試合)。戻る場所: ${loop.escapeAction}`);
  }
  if (ctx.opponents.length > 0) {
    lines.push('■登録相手: ' + ctx.opponents.map((o) => `${o.name}(${o.provisionalCodename ?? '未判定'})`).join(' / '));
  }
  lines.push('知らないことは知らないと言い、必要なら画面(コーチ→試合前/試合後/週次、試合タブ、カルテ)へ誘導する。');
  return lines.join('\n');
}

/** 初回の挨拶(チャットが空のとき) */
export function greetingReply(ctx: ChatContext): ChatReply {
  const v = voice(ctx.settings.persona);
  const last = ctx.diagnosis || ctx.approved.length > 0;
  const intro = last
    ? 'カルテ・タイプ・相性・練習メニューのことなら何でも聞いてくれ。'
    : 'まずは診断や試合データの取り込みから始めよう。使い方も聞いてくれていいぞ。';
  return {
    texts: [v('greet', { name: ctx.settings.playerName || undefined, codename: ctx.result.codename }), intro],
    chips: DEFAULT_CHIPS,
  };
}
