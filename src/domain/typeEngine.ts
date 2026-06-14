/* ============================================================
   タイプ判定エンジン
   - 診断7問 → 仮タイプ
   - 承認済み試合(5試合以上) → 実測タイプ
   - タイプ変更は「軸の反転が2試合連続」のヒステリシス
   - β校正期間(運用開始1ヶ月)はβ付き表示
   ============================================================ */
import { codenameFromPoles, MEASURED_MIN_MATCHES } from './constants';
import type {
  AxisKey, AxisResult, CodenameKey, DiagnosisAnswers, Match, Settings,
  TypeResult, Variant,
} from './types';
import { axisPolesOfMatch, computeAxes, computeClutch, totalPt } from './axisEngine';

/** 診断の回答 → 仮タイプ (Q4=A/S, Q5=V/R, Q6=F/L, Q7=C/N) */
export function provisionalType(d: DiagnosisAnswers): { codename: CodenameKey; variant: Variant } {
  const as = d.q4 === 'a' ? 'A' : 'S';
  const vr = d.q5 === 'a' ? 'V' : 'R';
  const fl = d.q6 === 'a' ? 'F' : 'L';
  const cn = d.q7 === 'a' ? 'C' : 'N';
  return {
    codename: codenameFromPoles(as, cn, vr),
    variant: fl === 'F' ? 'alpha' : 'omega',
  };
}

/** β校正期間か(運用開始から1ヶ月) */
export function isBeta(settings: Settings, today: string): boolean {
  if (!settings.operationStartDate) return false;
  const start = new Date(settings.operationStartDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return new Date(today) < end;
}

/** 境界帯の軸があれば、その軸を反転させた複合相手コードネームを返す */
function boundaryPartner(axes: AxisResult[]): CodenameKey | undefined {
  const find = (k: AxisKey) => axes.find((a) => a.axis === k)!;
  const as = find('AS'); const cn = find('CN'); const vr = find('VR');
  const flip = (p: string, hi: string, lo: string) => (p === hi ? lo : hi);
  // F/L以外で境界帯の軸が1つだけのとき複合表示(複数なら最も50に近い軸)
  const boundaries = [as, cn, vr].filter((a) => a.boundary);
  if (boundaries.length === 0) return undefined;
  const closest = boundaries.sort((a, b) => Math.abs(a.score - 50) - Math.abs(b.score - 50))[0];
  const poles = {
    AS: as.pole as 'A' | 'S',
    CN: cn.pole as 'C' | 'N',
    VR: vr.pole as 'V' | 'R',
  };
  if (closest.axis === 'AS') poles.AS = flip(poles.AS, 'A', 'S') as 'A' | 'S';
  if (closest.axis === 'CN') poles.CN = flip(poles.CN, 'C', 'N') as 'C' | 'N';
  if (closest.axis === 'VR') poles.VR = flip(poles.VR, 'V', 'R') as 'V' | 'R';
  return codenameFromPoles(poles.AS, poles.CN, poles.VR);
}

/**
 * 現在のタイプ判定結果を計算する。
 * - 診断未実施かつデータなし → stage 'none'
 * - 診断済み・承認試合 < 5 → stage 'provisional' (仮タイプ)
 * - 承認試合 >= 5 → stage 'measured' (実測タイプ)
 */
export function computeTypeResult(
  approvedMatches: Match[],
  diagnosis: DiagnosisAnswers | null,
  settings: Settings,
  today: string,
): TypeResult {
  const beta = isBeta(settings, today);
  const matchCount = approvedMatches.length;
  const pt = totalPt(approvedMatches);
  const axes = matchCount > 0 ? computeAxes(approvedMatches) : [];

  if (matchCount >= MEASURED_MIN_MATCHES) {
    const find = (k: AxisKey) => axes.find((a) => a.axis === k)!;
    const codename = codenameFromPoles(
      find('AS').pole as 'A' | 'S',
      find('CN').pole as 'C' | 'N',
      find('VR').pole as 'V' | 'R',
    );
    const variant: Variant = find('FL').pole === 'F' ? 'alpha' : 'omega';
    return {
      stage: 'measured',
      codename,
      variant,
      boundaryWith: boundaryPartner(axes),
      axes,
      clutch: computeClutch(approvedMatches) ?? undefined,
      beta,
      totalPt: pt,
      matchCount,
    };
  }

  if (diagnosis) {
    const p = provisionalType(diagnosis);
    return {
      stage: 'provisional',
      codename: p.codename,
      variant: p.variant,
      axes,
      clutch: computeClutch(approvedMatches) ?? undefined,
      beta,
      totalPt: pt,
      matchCount,
    };
  }

  return { stage: 'none', axes, beta, totalPt: pt, matchCount };
}

/**
 * タイプ変更のヒステリシス判定。
 * 現タイプと実測タイプが異なるとき、反転した軸が「直近2試合で個別に」
 * 反転側を示していた場合のみ変更を提案する(要確認承認)。
 */
export function shouldProposeTypeChange(
  current: { codename: CodenameKey; variant: Variant } | null,
  result: TypeResult,
  approvedMatches: Match[],
): { propose: boolean; reason: string } {
  if (result.stage !== 'measured' || !result.codename || !result.variant) {
    return { propose: false, reason: '実測タイプ未確定' };
  }
  if (!current) return { propose: true, reason: '初回の実測確定' };
  if (current.codename === result.codename && current.variant === result.variant) {
    return { propose: false, reason: '変更なし' };
  }
  const recent2 = [...approvedMatches]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 2);
  if (recent2.length < 2) return { propose: false, reason: '連続観測が不足(2試合未満)' };

  // どの軸が反転したかを特定し、その軸が直近2試合とも新しい極を示しているか確認
  const axisOf: Record<string, AxisKey> = { A: 'AS', S: 'AS', C: 'CN', N: 'CN', V: 'VR', R: 'VR', F: 'FL', L: 'FL' };
  const newPoles = result.axes.map((a) => a.pole);
  const flippedAxes = new Set<AxisKey>();
  if (current.codename !== result.codename) {
    for (const p of newPoles) {
      const k = axisOf[p];
      if (k === 'FL') continue;
      const axis = result.axes.find((a) => a.axis === k)!;
      // 現コードネームの極と異なる軸を反転とみなす
      const currentPoles = currentPolesOf(current.codename);
      if (!currentPoles.includes(axis.pole)) flippedAxes.add(k);
    }
  }
  if (current.variant !== result.variant) flippedAxes.add('FL');

  for (const k of flippedAxes) {
    const target = result.axes.find((a) => a.axis === k)!.pole;
    const ok = recent2.every((m) => axisPolesOfMatch(m)[k] === target);
    if (!ok) {
      return { propose: false, reason: `軸${k}の反転が2試合連続で観測されていない` };
    }
  }
  return { propose: true, reason: '軸の反転を2試合連続で観測' };
}

function currentPolesOf(codename: CodenameKey): string[] {
  const map: Record<CodenameKey, string[]> = {
    BLADE: ['A', 'C', 'R'], PHANTOM: ['A', 'C', 'V'], BULLET: ['A', 'N', 'R'],
    JOKER: ['A', 'N', 'V'], FORTRESS: ['S', 'C', 'R'], SNIPER: ['S', 'C', 'V'],
    ANCHOR: ['S', 'N', 'R'], ORACLE: ['S', 'N', 'V'],
  };
  return map[codename];
}

/** 自己申告(Q3: 1-5)と実測クラッチのギャップ(演出・週次推移用) */
export function selfGap(diagnosis: DiagnosisAnswers | null, result: TypeResult): {
  selfRating: number; expectedDiff: number; measuredDiff: number | null; text: string;
} | null {
  if (!diagnosis) return null;
  // 自己評価1-5 → 期待クラッチ差: 1→-10%, 3→0%, 5→+10%
  const expectedDiff = (diagnosis.selfRating - 3) * 0.05;
  const measuredDiff = result.clutch?.diff ?? null;
  let text = '実測データ待ち';
  if (measuredDiff != null) {
    const gap = measuredDiff - expectedDiff;
    if (gap > 0.05) text = '自己評価より実測の方が勝負強い — ビビってるのは気持ちだけ';
    else if (gap < -0.05) text = '自己評価より実測は控えめ — 終盤の選択を整理しよう';
    else text = '自己認識と実測はほぼ一致';
  }
  return { selfRating: diagnosis.selfRating, expectedDiff, measuredDiff, text };
}
