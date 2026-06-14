/* ============================================================
   4軸計算エンジン (types/types.md 準拠)
   - 承認済み試合のみを入力とする(呼び出し側で保証)
   - 直近5試合が主データ。指数減衰は試合数ベース(半減期=3試合)
   - 全スコアは0–100に正規化。50±5は境界帯
   ============================================================ */
import {
  BOUNDARY_HI, BOUNDARY_LO, DECAY_HALF_LIFE_MATCHES, MAIN_WINDOW_MATCHES,
} from './constants';
import type { AxisKey, AxisPole, AxisResult, ClutchStat, Match, RallyRow } from './types';
import { clamp, effectiveN, entropyBits, jackknifeCI, norm01, wilsonHalfWidth } from './stats';

/* ---- 正規化の基準レンジ(運用定数: β校正期間に調整する) ---- */
const REF = {
  thirdBallRate: { lo: 0.10, hi: 0.60 },  // 3球目強打率
  avgRally: { lo: 3.0, hi: 8.0 },          // 平均ラリー長(短いほどA)
  clutchScale: 250,                        // ±20% → ±50pts
  entropyNorm: { lo: 0.25, hi: 0.85 },     // 正規化エントロピー
  earlyLateScale: 250,                     // ±20% → ±50pts
};

/** サーブの多様性カテゴリ: 球種 × 前後(コース1-3=前/4-6=奥) = 最大12カテゴリ */
const ENTROPY_MAX_BITS = Math.log2(12);

interface WeightedRally extends RallyRow {
  w: number;
}

/** 直近順(新→旧)に並べ、試合数ベースの減衰重みを付与してラリーを平坦化 */
function flattenRecent(matches: Match[], window = MAIN_WINDOW_MATCHES): WeightedRally[] {
  const sorted = [...matches].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = sorted.slice(0, window);
  const out: WeightedRally[] = [];
  recent.forEach((m, i) => {
    const w = Math.pow(0.5, i / DECAY_HALF_LIFE_MATCHES);
    for (const r of m.rallies) out.push({ ...r, w });
  });
  return out;
}

/* ---- 生指標の抽出 ---- */

interface RawMetrics {
  thirdBallRate: number | null;
  thirdBallN: number;
  avgRally: number | null;
  rallyN: number;
  overallWinRate: number | null;
  clutchWinRate: number | null;
  clutchN: number;
  overallN: number;
  entropyNorm: number | null;
  serveN: number;
  earlyWinRate: number | null;
  earlyN: number;
  lateWinRate: number | null;
  lateN: number;
}

function isClutch(r: RallyRow): boolean {
  // 9点以遠 = どちらかが9点以上の局面
  return Math.max(r.myScore, r.oppScore) >= 9;
}
function isEarly(r: RallyRow): boolean {
  // セット序盤 = 両者5点以下
  return r.myScore <= 5 && r.oppScore <= 5;
}
function isLate(r: RallyRow): boolean {
  // セット終盤 = どちらかが8点以上
  return Math.max(r.myScore, r.oppScore) >= 8;
}

function extract(rallies: WeightedRally[]): RawMetrics {
  const wmean = (rows: WeightedRally[], f: (r: WeightedRally) => number): number | null => {
    const sw = rows.reduce((a, r) => a + r.w, 0);
    if (sw <= 0) return null;
    return rows.reduce((a, r) => a + f(r) * r.w, 0) / sw;
  };
  const nEff = (rows: WeightedRally[]) => effectiveN(rows.map((r) => r.w));

  const myServeLong = rallies.filter((r) => r.server === 'me' && r.rallyLength >= 3);
  const clutchRallies = rallies.filter(isClutch);
  const earlyRallies = rallies.filter(isEarly);
  const lateRallies = rallies.filter(isLate);
  const myServes = rallies.filter((r) => r.server === 'me');

  // サーブ多様性: 球種×前後のカテゴリ分布
  const catCounts = new Map<string, number>();
  for (const r of myServes) {
    const depth = r.serveCourse <= 3 ? '前' : '奥';
    const key = `${r.serveType}|${depth}`;
    catCounts.set(key, (catCounts.get(key) ?? 0) + r.w);
  }
  const h = entropyBits([...catCounts.values()]);

  return {
    thirdBallRate: wmean(myServeLong, (r) => (r.thirdBallAttack ? 1 : 0)),
    thirdBallN: nEff(myServeLong),
    avgRally: wmean(rallies, (r) => r.rallyLength),
    rallyN: nEff(rallies),
    overallWinRate: wmean(rallies, (r) => (r.winner === 'me' ? 1 : 0)),
    overallN: nEff(rallies),
    clutchWinRate: wmean(clutchRallies, (r) => (r.winner === 'me' ? 1 : 0)),
    clutchN: nEff(clutchRallies),
    entropyNorm: myServes.length > 0 ? h / ENTROPY_MAX_BITS : null,
    serveN: nEff(myServes),
    earlyWinRate: wmean(earlyRallies, (r) => (r.winner === 'me' ? 1 : 0)),
    earlyN: nEff(earlyRallies),
    lateWinRate: wmean(lateRallies, (r) => (r.winner === 'me' ? 1 : 0)),
    lateN: nEff(lateRallies),
  };
}

/* ---- 生指標 → 0-100 軸スコア ---- */

function scoreAS(m: RawMetrics): number | null {
  if (m.thirdBallRate == null && m.avgRally == null) return null;
  const a1 = m.thirdBallRate != null ? norm01(m.thirdBallRate, REF.thirdBallRate.lo, REF.thirdBallRate.hi) : 0.5;
  const a2 = m.avgRally != null ? 1 - norm01(m.avgRally, REF.avgRally.lo, REF.avgRally.hi) : 0.5;
  return clamp(100 * (0.6 * a1 + 0.4 * a2), 0, 100);
}
function scoreCN(m: RawMetrics): number | null {
  if (m.clutchWinRate == null || m.overallWinRate == null) return null;
  const diff = m.clutchWinRate - m.overallWinRate;
  return clamp(50 + diff * REF.clutchScale, 0, 100);
}
function scoreVR(m: RawMetrics): number | null {
  if (m.entropyNorm == null) return null;
  return clamp(100 * norm01(m.entropyNorm, REF.entropyNorm.lo, REF.entropyNorm.hi), 0, 100);
}
function scoreFL(m: RawMetrics): number | null {
  if (m.earlyWinRate == null || m.lateWinRate == null) return null;
  const diff = m.earlyWinRate - m.lateWinRate;
  return clamp(50 + diff * REF.earlyLateScale, 0, 100);
}

const SCORERS: Record<AxisKey, (m: RawMetrics) => number | null> = {
  AS: scoreAS, CN: scoreCN, VR: scoreVR, FL: scoreFL,
};
const PT_OF: Record<AxisKey, (m: RawMetrics) => number> = {
  AS: (m) => m.thirdBallN + m.rallyN * 0.25,
  CN: (m) => m.clutchN,
  VR: (m) => m.serveN,
  FL: (m) => Math.min(m.earlyN, m.lateN) * 2,
};

function poleOf(axis: AxisKey, score: number): AxisPole {
  const hi: Record<AxisKey, AxisPole> = { AS: 'A', CN: 'C', VR: 'V', FL: 'F' };
  const lo: Record<AxisKey, AxisPole> = { AS: 'S', CN: 'N', VR: 'R', FL: 'L' };
  return score >= 50 ? hi[axis] : lo[axis];
}

/**
 * 軸スコア一式を計算する。
 * CIはジャックナイフ法(試合単位で1つ抜き)で推定 — データが増えるほど±が縮む。
 */
export function computeAxes(approvedMatches: Match[]): AxisResult[] {
  const all = flattenRecent(approvedMatches);
  const metrics = extract(all);
  const window = [...approvedMatches]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAIN_WINDOW_MATCHES);

  return (Object.keys(SCORERS) as AxisKey[]).map((axis) => {
    const score = SCORERS[axis](metrics) ?? 50;
    // ジャックナイフ: i番目の試合を除いた再計算
    const loo: number[] = [];
    if (window.length >= 2) {
      for (let i = 0; i < window.length; i++) {
        const subset = window.filter((_, j) => j !== i);
        const s = SCORERS[axis](extract(flattenRecent(subset)));
        if (s != null) loo.push(s);
      }
    }
    const ci = jackknifeCI(loo);
    const pt = Math.round(PT_OF[axis](metrics));
    return {
      axis,
      score: Math.round(score * 10) / 10,
      ci: Math.round(ci * 10) / 10,
      pole: poleOf(axis, score),
      boundary: score >= BOUNDARY_LO && score <= BOUNDARY_HI,
      pt,
    };
  });
}

/** 単一試合の軸極(タイプ変更ヒステリシス: 軸の反転が2試合連続か の判定に使う) */
export function axisPolesOfMatch(match: Match): Partial<Record<AxisKey, AxisPole>> {
  const rallies: WeightedRally[] = match.rallies.map((r) => ({ ...r, w: 1 }));
  const m = extract(rallies);
  const out: Partial<Record<AxisKey, AxisPole>> = {};
  (Object.keys(SCORERS) as AxisKey[]).forEach((axis) => {
    const s = SCORERS[axis](m);
    if (s != null) out[axis] = poleOf(axis, s);
  });
  return out;
}

/** クラッチ指標(9点以遠の得点率 − 全体得点率)を Wilson 95%CI 付きで返す */
export function computeClutch(approvedMatches: Match[]): ClutchStat | null {
  const all = flattenRecent(approvedMatches);
  const m = extract(all);
  if (m.clutchWinRate == null || m.overallWinRate == null || m.clutchN < 1) return null;
  return {
    diff: m.clutchWinRate - m.overallWinRate,
    pt: Math.round(m.clutchN),
    ci: wilsonHalfWidth(m.clutchWinRate, m.clutchN),
  };
}

/** カルテ残高: 承認済みラリー総数(pt) */
export function totalPt(approvedMatches: Match[]): number {
  return approvedMatches.reduce((a, m) => a + m.rallies.length, 0);
}

export { extract as _extractForTest, flattenRecent as _flattenForTest };
