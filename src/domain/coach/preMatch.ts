/* ============================================================
   試合前モード — 戦術カード生成ロジック(純関数)
   画面(TacticalCardScreen)は表示に徹し、内容はすべてここで組み立てる。
   鉄則: 相性は[対戦サンプル数]併記(0なら理論値)・推測で相手を分析しない。
   ============================================================ */
import { CODENAMES, COURSE_LABELS } from '@/domain/constants';
import { SYMBOL_LABEL } from '@/domain/compatibility';
import { fmtDiff, fmtRate } from '@/domain/stats';
import type { ServeStat } from '@/domain/insights';
import type {
  CodenameKey, Course, MatchupResult, MatchupSymbol, OpponentKarte,
  SelfKarte, TypeResult, Variant,
} from '@/domain/types';

/* ---- 公開型 ---- */

/** karte=相手カルテあり / firstTime=初見 / minimal=相手データ最小 */
export type TacticalMode = 'karte' | 'firstTime' | 'minimal';

export type TacticalKind = '攻め筋' | '警戒' | '勝負どころ' | '基礎プラン' | '戻る場所';

export interface TacticalItem {
  no: number; // 1-5
  kind: TacticalKind;
  /** 冒頭の数語で意味が取れる短い見出し(例: 「バック前を突け」) */
  title: string;
  body: string;
  /** .mono 表示用の数値文字列(fmtRate/fmtDiff 等) */
  stat?: string;
  /** コース番号バッジ用 */
  courses: Course[];
}

export interface TacticalOpponentType {
  codename: CodenameKey;
  variant?: Variant;
  /** 判定根拠のサンプル数 */
  judgedPt: number;
}

export interface TacticalMatchupView {
  symbol: MatchupSymbol;
  label: string;
  /** 0 なら理論値と明示する */
  sampleSize: number;
  /** 理論値明示・α/Ω注記(matchup().notes をそのまま) */
  notes: string[];
}

export interface TacticalCard {
  opponentLabel: string;
  opponentType: TacticalOpponentType | null;
  matchupView: TacticalMatchupView | null;
  mode: TacticalMode;
  /** 分岐の前提を1行で伝える注記(karteモードは不要) */
  modeNote?: string;
  /** 必ず5項目(①〜⑤) */
  items: TacticalItem[];
  /** appendSession 用の1行要約 */
  summary: string;
}

/* ---- 内部ヘルパー ---- */

function shorten(t: string, max: number): string {
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** テキスト中のコース名(バック前 等)を Course 番号に変換 */
function coursesIn(texts: string[], limit = 2): Course[] {
  const out: Course[] = [];
  for (const [k, label] of Object.entries(COURSE_LABELS) as [string, string][]) {
    const c = Number(k) as Course;
    if (texts.some((t) => t.includes(label))) out.push(c);
  }
  return out.slice(0, limit);
}

/** 信頼できる得意サーブ(本数5以上を優先し勝率順) */
function bestServe(serves: ServeStat[]): ServeStat | null {
  if (serves.length === 0) return null;
  const solid = serves.filter((s) => s.count >= 5);
  const pool = solid.length > 0 ? solid : serves;
  return [...pool].sort((a, b) => b.winRate - a.winRate)[0];
}

/** 「データ不足」等のプレースホルダ行を除外 */
function realEntries(list: string[]): string[] {
  return list.filter((t) => t.trim().length > 0 && !t.includes('データ不足'));
}

function detectMode(opponent: OpponentKarte | null): TacticalMode {
  if (!opponent) return 'firstTime';
  const hasData =
    opponent.provisionalCodename != null ||
    realEntries(opponent.receiveHoles).length > 0 ||
    realEntries(opponent.serveTendency).length > 0 ||
    realEntries(opponent.clutchHabits).length > 0;
  return hasData ? 'karte' : 'minimal';
}

/* ---- ①〜⑤ の項目ビルダー ---- */

/** ① 攻め筋: 相手の失点パターン上位 → なければ自分の得意形 */
function itemAttack(mode: TacticalMode, opponent: OpponentKarte | null, serves: ServeStat[]): TacticalItem {
  if (mode === 'karte' && opponent) {
    const holes = realEntries(opponent.receiveHoles);
    if (holes.length > 0) {
      const lead = coursesIn([holes[0]], 1);
      const courses = coursesIn(holes, 2);
      return {
        no: 1, kind: '攻め筋',
        title: lead.length > 0 ? `${COURSE_LABELS[lead[0]]}を突け` : '相手の穴を突け',
        body: `相手の失点パターン: ${holes.slice(0, 2).join(' / ')}。ここへ先に送って主導権を握る。`,
        courses,
      };
    }
  }
  const s = bestServe(serves);
  const generic: Record<TacticalMode, string> = {
    karte: '相手の失点データは未登録。実績のある自分の形で先に仕掛ける。',
    firstTime: '初見につき推測はしない。得点率の実績がある自分の形から立ち上げる。',
    minimal: '相手データは最小。確度の高い自分の形を優先し、⑤を基準に戦う。',
  };
  return {
    no: 1, kind: '攻め筋',
    title: s ? `${s.serveType}起点で先手を取れ` : '得意の形から先手を取れ',
    body: generic[mode],
    stat: s ? fmtRate(s.winRate, s.count, s.ci) : undefined,
    courses: s ? [s.mainCourse] : [],
  };
}

/** ② 警戒: 相手の得点パターン / 初見は自分の勝ちパターン軸 / データ最小は崩壊ループ非突入 */
function itemCaution(
  mode: TacticalMode, self: TypeResult, karte: SelfKarte, opponent: OpponentKarte | null,
): TacticalItem {
  if (mode === 'karte' && opponent) {
    const threats = realEntries([...opponent.serveTendency, ...opponent.clutchHabits]);
    if (threats.length > 0) {
      const lead = coursesIn([threats[0]], 1);
      return {
        no: 2, kind: '警戒',
        title: lead.length > 0 ? `${COURSE_LABELS[lead[0]]}への配球を警戒` : '相手の得点源を警戒',
        body: `相手の得点パターン: ${threats.slice(0, 2).join(' / ')}。来る前提で位置取りを準備する。`,
        courses: coursesIn(threats, 2),
      };
    }
  }
  if (mode === 'minimal') {
    const loop = karte.loops[0];
    if (loop) {
      return {
        no: 2, kind: '警戒',
        title: `「${shorten(loop.trigger, 14)}」が危険信号`,
        body: `${loop.middle} へ進む前に流れを切る。兆候が出たら迷わず⑤へ戻る。`,
        stat: `[発生${loop.occurrences}回/${loop.matches}試合]`,
        courses: coursesIn([loop.trigger], 2),
      };
    }
  }
  // 初見(または材料なし): 自分の勝ちパターンを軸に置く
  const win = self.codename ? CODENAMES[self.codename].winPattern : null;
  return {
    no: 2, kind: '警戒',
    title: '自分の形を見失うな',
    body: win
      ? `勝ち筋は「${win}」。相手に合わせ過ぎてこの軸から離れることが一番の失点源。`
      : '相手に合わせ過ぎないこと。自分の得意展開を最後まで維持する。',
    courses: [],
  };
}

/** ③ 勝負どころ(9点以降)の方針 */
function itemClutch(self: TypeResult, opponent: OpponentKarte | null): TacticalItem {
  const habit = opponent ? realEntries(opponent.clutchHabits)[0] : undefined;
  const tail = habit ? ` 相手の癖: ${shorten(habit, 30)}。` : '';
  const c = self.clutch;
  if (c && c.pt >= 8) {
    const stat = fmtDiff(c.diff, c.pt, c.ci);
    if (c.diff >= 0.03) {
      return {
        no: 3, kind: '勝負どころ',
        title: '9点からは強気で取りにいけ',
        body: `終盤の得点率は全体より高い実測。仕掛けを緩めず普段どおり締める。${tail}`,
        stat, courses: [],
      };
    }
    if (c.diff <= -0.03) {
      return {
        no: 3, kind: '勝負どころ',
        title: '9点からは先に仕掛けて短く',
        body: `終盤勝負を長引かせない。⑤の形で点の取り方を単純化する。${tail}`,
        stat, courses: [],
      };
    }
    return {
      no: 3, kind: '勝負どころ',
      title: '9点からも組み立てを変えるな',
      body: `終盤の傾向は中立。決めた形を続けるのが最も期待値が高い。${tail}`,
      stat, courses: [],
    };
  }
  // 実測不足 → 診断ベースは断定しない(可能性表現)
  if (self.variant === 'omega') {
    return {
      no: 3, kind: '勝負どころ',
      title: '終盤は自分の土俵の可能性',
      body: `後半型(Ω)の診断。実測はまだ少ないが、9点からも組み立てを変えない方針でいい。${tail}`,
      courses: [],
    };
  }
  if (self.variant === 'alpha') {
    return {
      no: 3, kind: '勝負どころ',
      title: '9点前にリードを作れ',
      body: `先行型(α)の診断。終盤までに形を作り、9点からは⑤の形で逃げ切る。${tail}`,
      courses: [],
    };
  }
  return {
    no: 3, kind: '勝負どころ',
    title: '9点からは1本ずつ区切れ',
    body: `終盤データはまだない。サーブ2本をひと区切りに考え、1本ずつ取りにいく。${tail}`,
    courses: [],
  };
}

/** ④ 基礎プラン: 初見・データ最小は最初の6本の情報収集手順 */
function itemPlan(mode: TacticalMode, serves: ServeStat[]): TacticalItem {
  if (mode === 'karte') {
    const s = bestServe(serves);
    return {
      no: 4, kind: '基礎プラン',
      title: 'いつもの立ち上がりでいい',
      body: s
        ? `${s.serveType}起点の3球目を軸に試合を作り、効きが落ちたら①へ切り替える。`
        : 'データ上の得意形が固まるまで、練習どおりの立ち上がりで様子を見る。',
      stat: s ? fmtRate(s.winRate, s.count, s.ci) : undefined,
      courses: s ? [s.mainCourse] : [],
    };
  }
  const names = serves.slice(0, 3).map((s) => s.serveType);
  const list = (names.length >= 2 ? names : ['ロング', 'ショート下', '横回転']).slice(0, 3).join('/');
  return {
    no: 4, kind: '基礎プラン',
    title: '最初の6本は情報収集',
    body: `サーブは${list}を散らして相手の待ちと戻り位置を観察。レシーブはバック前とフォア奥へ返し、反応が薄い側を①に昇格させる。`,
    courses: [1, 6],
  };
}

/** ⑤ 戻る場所: 崩壊ループの脱出行動 → なければ得意サーブ */
function itemAnchor(karte: SelfKarte, serves: ServeStat[]): TacticalItem {
  const loop = karte.loops.find((l) => l.escapeAction.trim().length > 0);
  if (loop) {
    const firstClause = loop.escapeAction.split(/[、。]/)[0];
    return {
      no: 5, kind: '戻る場所',
      title: shorten(firstClause, 16),
      body: `${loop.escapeAction}。「${shorten(loop.trigger, 14)}」が出た直後が使いどころ。`,
      stat: `[発生${loop.occurrences}回/${loop.matches}試合]`,
      courses: coursesIn([loop.escapeAction, loop.trigger], 2),
    };
  }
  const s = bestServe(serves);
  if (s) {
    return {
      no: 5, kind: '戻る場所',
      title: `${s.serveType}サーブへ戻れ`,
      body: `崩れかけたら一番手堅いこの形へ。主コースは${COURSE_LABELS[s.mainCourse]}。`,
      stat: fmtRate(s.winRate, s.count, s.ci),
      courses: [s.mainCourse],
    };
  }
  return {
    no: 5, kind: '戻る場所',
    title: '基本サーブを1つ決めておけ',
    body: 'まだデータがない。練習で一番数を打ってきたサーブと展開を、試合前に1つだけ決めておく。',
    courses: [],
  };
}

/* ---- 本体 ---- */

/**
 * 戦術カードを組み立てる純関数。
 * @param self          自分の現在タイプ(computeTypeResult の結果)
 * @param karte         自分カルテ(崩壊ループ・脱出行動)
 * @param serves        serveStats(approved) の結果
 * @param opponent      相手カルテ(初見なら null)
 * @param matchupResult matchup() の結果(相手タイプ不明なら null)
 * @param forcedMode    入口の明示選択(「初見」「データ最小」)。省略時は自動判定
 */
export function buildTacticalCard(
  self: TypeResult,
  karte: SelfKarte,
  serves: ServeStat[],
  opponent: OpponentKarte | null,
  matchupResult: MatchupResult | null,
  forcedMode?: TacticalMode,
): TacticalCard {
  const mode = forcedMode ?? detectMode(opponent);
  const opponentLabel = opponent?.name ?? (mode === 'minimal' ? 'データ最小の相手' : '初見の相手');

  const opponentType: TacticalOpponentType | null = opponent?.provisionalCodename
    ? {
        codename: opponent.provisionalCodename,
        variant: opponent.provisionalVariant,
        judgedPt: opponent.judgedPt,
      }
    : null;

  const matchupView: TacticalMatchupView | null = matchupResult && opponentType
    ? {
        symbol: matchupResult.symbol,
        label: SYMBOL_LABEL[matchupResult.symbol],
        sampleSize: matchupResult.sampleSize,
        notes: matchupResult.notes,
      }
    : null;

  const items: TacticalItem[] = [
    itemAttack(mode, opponent, serves),
    itemCaution(mode, self, karte, opponent),
    itemClutch(self, opponent),
    itemPlan(mode, serves),
    itemAnchor(karte, serves),
  ];

  const modeNote =
    mode === 'firstTime'
      ? '初見の相手 — 推測では分析しない。④で集めた情報から組み立てる。'
      : mode === 'minimal'
        ? '相手データ最小 — ⑤の戻る場所と崩壊回避を基準に戦う。'
        : undefined;

  const muText = matchupView
    ? `相性${matchupView.symbol}(${matchupView.label}・${matchupView.sampleSize > 0 ? `対戦${matchupView.sampleSize}試合` : '理論値'})`
    : '相性は未算出';
  const summary = `戦術カード vs ${opponentLabel} — ${muText}。①${items[0].title} / ⑤${items[4].title}`;

  return { opponentLabel, opponentType, matchupView, mode, modeNote, items, summary };
}
