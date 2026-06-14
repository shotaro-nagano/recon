/* ============================================================
   タイプ相性エンジン (types/types.md「表の根拠ルール」から生成)
   この表は仮説の初期値 — 実対戦データが貯まり次第自動補正し、
   助言時は必ず[対戦サンプル数]を併記(0なら「理論値」と明示)。
   ============================================================ */
import { CODENAMES } from './constants';
import type { CodenameKey, Match, MatchupResult, MatchupSymbol, OpponentKarte, Variant } from './types';

function polesOf(c: CodenameKey): Set<string> {
  return new Set(CODENAMES[c].poles);
}

/** 生成ロジック: 相性表の根拠ルールを内部スコア(-2〜+2)で適用 */
export function baseScore(self: CodenameKey, opp: CodenameKey): number {
  const s = polesOf(self);
  const o = polesOf(opp);
  let score = 0;
  // 変化(V)は王道(R)の読みを外す
  if (s.has('V') && o.has('R')) score += 1;
  if (s.has('R') && o.has('V')) score -= 1;
  // 勝負強さ(C)は序盤型(N)に終盤で勝る
  if (s.has('C') && o.has('N')) score += 1;
  if (s.has('N') && o.has('C')) score -= 1;
  // 単調攻撃(A・R)は安定(S)に吸収される
  if (s.has('A') && s.has('R') && o.has('S')) score -= 1;
  // カウンター型(S・V)は攻撃型(A)を餌にする
  if (s.has('S') && s.has('V') && o.has('A')) score += 1;
  if (o.has('S') && o.has('V') && s.has('A')) score -= 1;
  // カウンター型は安定(S・R)相手だと餌がない
  if (s.has('S') && s.has('V') && o.has('S') && o.has('R')) score -= 1;
  return Math.max(-2, Math.min(2, score));
}

export function symbolOf(score: number): MatchupSymbol {
  if (score >= 2) return '◎';
  if (score === 1) return '○';
  if (score === 0) return '●';
  if (score === -1) return '▲';
  return '×';
}

export const SYMBOL_LABEL: Record<MatchupSymbol, string> = {
  '◎': '有利', '○': 'やや有利', '●': '五分', '▲': 'やや不利', '×': '不利',
};

/**
 * 相性を計算する。
 * - α/Ω修正: α vs Ω では試合運び次第で片側1段階補正(注記として提示)
 * - BULLET-α は全対面で序盤+1段階の補正
 * - 実対戦データ(同タイプ相手の勝敗)が3試合以上あればデータで1段階自動補正
 */
export function matchup(
  self: { codename: CodenameKey; variant: Variant },
  opp: { codename: CodenameKey; variant?: Variant },
  history?: { matches: Match[]; opponents: OpponentKarte[] },
): MatchupResult {
  let score = baseScore(self.codename, opp.codename);
  const notes: string[] = [];

  // BULLET-α: 序盤の奇襲補正
  if (self.codename === 'BULLET' && self.variant === 'alpha') {
    score = Math.min(2, score + 1);
    notes.push('BULLET-αの序盤補正(+1段階)を適用');
  }
  // α/Ω修正
  if (opp.variant && self.variant !== opp.variant) {
    if (self.variant === 'alpha') {
      notes.push('相手はΩ型 — 中盤までにセットを取り切れば有利、終盤勝負に持ち込まれると五分以下');
    } else {
      notes.push('相手はα型 — 序盤の失点で焦らない。終盤勝負に持ち込めば五分以上');
    }
  }

  // 実対戦データによる自動補正
  let sampleSize = 0;
  if (history) {
    const sameTypeOppIds = history.opponents
      .filter((o) => o.provisionalCodename === opp.codename)
      .map((o) => o.id);
    const vs = history.matches.filter((m) => m.approved && sameTypeOppIds.includes(m.opponentId));
    sampleSize = vs.length;
    if (sampleSize >= 3) {
      const wins = vs.filter((m) => m.mySets > m.oppSets).length;
      const wr = wins / sampleSize;
      if (wr >= 0.7 && score < 2) {
        score += 1;
        notes.push(`実対戦${sampleSize}試合で勝率${Math.round(wr * 100)}% — データで1段階上方補正`);
      } else if (wr <= 0.3 && score > -2) {
        score -= 1;
        notes.push(`実対戦${sampleSize}試合で勝率${Math.round(wr * 100)}% — データで1段階下方補正`);
      }
    }
  }
  if (sampleSize === 0) notes.push('理論値・実対戦データなし');

  return { symbol: symbolOf(score), score, notes, sampleSize };
}

/** 8×8 の理論相性表(行=自分) */
export function fullTable(): Record<CodenameKey, Record<CodenameKey, MatchupSymbol>> {
  const keys = Object.keys(CODENAMES) as CodenameKey[];
  const table = {} as Record<CodenameKey, Record<CodenameKey, MatchupSymbol>>;
  for (const self of keys) {
    table[self] = {} as Record<CodenameKey, MatchupSymbol>;
    for (const opp of keys) {
      table[self][opp] = symbolOf(baseScore(self, opp));
    }
  }
  return table;
}
