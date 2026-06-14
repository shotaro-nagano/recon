/* ============================================================
   統計ユーティリティ — 全数値に[サンプル数]と95%信頼区間を併記するための基盤
   ============================================================ */

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** x を [lo, hi] → [0, 1] へ正規化(クランプ付き) */
export function norm01(x: number, lo: number, hi: number): number {
  if (hi === lo) return 0.5;
  return clamp((x - lo) / (hi - lo), 0, 1);
}

/**
 * Wilson スコア区間 (95%)。
 * 比率 p、実効サンプル数 n に対する信頼区間の半幅を返す。
 * クラッチ等の狭い定義でサンプルが貯まりにくい指標も正直に±を示す。
 */
export function wilsonHalfWidth(p: number, n: number, z = 1.96): number {
  if (n <= 0) return 0.5;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  // 中心の移動も含めた保守的な半幅
  return Math.max(margin, Math.abs(center - p) + margin * 0.5);
}

export interface WeightedSample {
  value: number; // 0/1 の比率系 or 実数
  weight: number;
}

/** 重み付き平均 */
export function weightedMean(samples: WeightedSample[]): number | null {
  const sw = samples.reduce((a, s) => a + s.weight, 0);
  if (sw <= 0) return null;
  return samples.reduce((a, s) => a + s.value * s.weight, 0) / sw;
}

/** 実効サンプル数 n_eff = (Σw)² / Σw² — 減衰重み付きでも正直なCIを出すため */
export function effectiveN(weights: number[]): number {
  const sw = weights.reduce((a, w) => a + w, 0);
  const sw2 = weights.reduce((a, w) => a + w * w, 0);
  if (sw2 <= 0) return 0;
  return (sw * sw) / sw2;
}

/** シャノンエントロピー(bit)。counts は各カテゴリの重み付き出現数 */
export function entropyBits(counts: number[]): number {
  const total = counts.reduce((a, c) => a + c, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * ジャックナイフ法による軸スコアのCI半幅。
 * 試合単位で1つ抜いて再計算した値のばらつきから推定する。
 * 試合数が1のときは fallback を返す(まだ何も確定的に言えない)。
 */
export function jackknifeCI(leaveOneOutScores: number[], fallback = 30): number {
  const m = leaveOneOutScores.length;
  if (m < 2) return fallback;
  const mean = leaveOneOutScores.reduce((a, b) => a + b, 0) / m;
  const variance =
    ((m - 1) / m) *
    leaveOneOutScores.reduce((a, b) => a + (b - mean) * (b - mean), 0);
  return Math.min(fallback, 1.96 * Math.sqrt(variance));
}

/** 表示用: "62%[31pt, ±17%]" 形式 */
export function fmtRate(p: number, pt: number, ciHalf?: number): string {
  const pct = Math.round(p * 100);
  if (ciHalf == null) return `${pct}%[${Math.round(pt)}pt]`;
  return `${pct}%[${Math.round(pt)}pt, ±${Math.round(ciHalf * 100)}%]`;
}

/** 表示用: "+7%[28pt, ±15%]" 形式(差分系) */
export function fmtDiff(d: number, pt: number, ciHalf?: number): string {
  const pct = Math.round(d * 100);
  const sign = pct >= 0 ? '+' : '';
  if (ciHalf == null) return `${sign}${pct}%[${Math.round(pt)}pt]`;
  return `${sign}${pct}%[${Math.round(pt)}pt, ±${Math.round(ciHalf * 100)}%]`;
}
