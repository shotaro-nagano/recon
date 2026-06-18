/* ============================================================
   傾向の自動検出 — カルテの「育つ」部分を支えるエンジン
   - サーブ別成績 / コース別失点傾向(レシーブ)
   - 確定タグ候補: 10pt以上 かつ 3試合連続で観測
   - 解消候補: 確定タグが直近2試合で観測されない
   ============================================================ */
import { CONFIRM_MIN_PT, CONFIRM_STREAK, COURSE_LABELS, MAIN_WINDOW_MATCHES, RESOLVE_ABSENT_MATCHES, UNKNOWN_SERVE } from './constants';
import type { AxisResult, Course, Match, SelfKarte, TendencyEntry } from './types';
import { computeAxes } from './axisEngine';
import { wilsonHalfWidth } from './stats';

// ラリー記録のある試合のみを分析対象にする(結果だけ手入力した試合は窓を消費しない)
const sortDesc = (ms: Match[]) =>
  ms.filter((m) => m.rallies.length > 0).sort((a, b) => (a.date < b.date ? 1 : -1));

/* ---- サーブ別成績(直近5試合) ---- */
export interface ServeStat {
  serveType: string;
  mainCourse: Course;
  count: number;
  winRate: number;
  ci: number;
}

export function serveStats(approved: Match[]): ServeStat[] {
  const recent = sortDesc(approved).slice(0, MAIN_WINDOW_MATCHES);
  const groups = new Map<string, { wins: number; total: number; courses: Map<Course, number> }>();
  for (const m of recent) {
    for (const r of m.rallies) {
      if (r.server !== 'me' || r.serveType === UNKNOWN_SERVE) continue;
      const g = groups.get(r.serveType) ?? { wins: 0, total: 0, courses: new Map() };
      g.total += 1;
      if (r.winner === 'me') g.wins += 1;
      g.courses.set(r.serveCourse, (g.courses.get(r.serveCourse) ?? 0) + 1);
      groups.set(r.serveType, g);
    }
  }
  return [...groups.entries()]
    .map(([serveType, g]) => {
      const mainCourse = [...g.courses.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const winRate = g.wins / g.total;
      return { serveType, mainCourse, count: g.total, winRate, ci: wilsonHalfWidth(winRate, g.total) };
    })
    .sort((a, b) => b.count - a.count);
}

/* ---- コース別失点傾向(相手サーブのコース別・直近5試合) ---- */
export interface CourseLossStat {
  course: Course;
  label: string;
  count: number;
  lossRate: number;
  ci: number;
}

export function courseLossStats(approved: Match[]): CourseLossStat[] {
  const recent = sortDesc(approved).slice(0, MAIN_WINDOW_MATCHES);
  const groups = new Map<Course, { losses: number; total: number }>();
  for (const m of recent) {
    for (const r of m.rallies) {
      if (r.server !== 'opp') continue;
      const g = groups.get(r.serveCourse) ?? { losses: 0, total: 0 };
      g.total += 1;
      if (r.winner === 'opp') g.losses += 1;
      groups.set(r.serveCourse, g);
    }
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

/* ---- 確定タグ候補の検出 ---- */
export interface TendencyCandidate {
  key: string;
  text: string;
  pt: number;
  value: number;
  ci: number;
  /** 3試合連続で観測されたか → true なら確定タグ提案(要確認)、false なら観察中(自動反映) */
  confirmable: boolean;
}

/**
 * レシーブのコース別弱点を検出する。
 * 失点率60%以上かつ十分なサンプルがある場合に候補化。
 * 確定条件: 合計10pt以上 かつ 直近3試合それぞれで失点率50%超。
 */
export function detectReceiveWeaknesses(approved: Match[]): TendencyCandidate[] {
  const recent = sortDesc(approved).slice(0, MAIN_WINDOW_MATCHES);
  if (recent.length === 0) return [];
  const out: TendencyCandidate[] = [];
  for (const stat of courseLossStats(approved)) {
    if (stat.lossRate < 0.6 || stat.count < 6) continue;
    // 3試合連続の観測チェック
    const last3 = recent.slice(0, CONFIRM_STREAK);
    const perMatch = last3.map((m) => {
      const rows = m.rallies.filter((r) => r.server === 'opp' && r.serveCourse === stat.course);
      if (rows.length < 3) return null; // 母数が極小の試合は「連続観測」に数えない
      return rows.filter((r) => r.winner === 'opp').length / rows.length;
    });
    const streak =
      last3.length >= CONFIRM_STREAK && perMatch.every((p) => p != null && p > 0.5);
    out.push({
      key: `receive-loss:c${stat.course}`,
      text: `${stat.label}(${stat.course})へのサーブに対する失点率${Math.round(stat.lossRate * 100)}%`,
      pt: stat.count,
      value: stat.lossRate,
      ci: stat.ci,
      confirmable: streak && stat.count >= CONFIRM_MIN_PT,
    });
  }
  return out;
}

/* ---- 解消候補の検出 ---- */
export function detectResolved(karte: SelfKarte, approved: Match[]): TendencyEntry[] {
  const recent = sortDesc(approved).slice(0, RESOLVE_ABSENT_MATCHES);
  if (recent.length < RESOLVE_ABSENT_MATCHES) return [];
  const out: TendencyEntry[] = [];
  for (const t of karte.tendencies) {
    if (t.status !== 'confirmed' || !t.key?.startsWith('receive-loss:c')) continue;
    const course = Number(t.key.split(':c')[1]) as Course;
    // 直近2試合で観測されない(=該当コースの失点率が50%以下)なら解消候補
    const absent = recent.every((m) => {
      const rows = m.rallies.filter((r) => r.server === 'opp' && r.serveCourse === course);
      if (rows.length < 3) return false; // 試行が少なすぎる場合は判断保留
      return rows.filter((r) => r.winner === 'opp').length / rows.length <= 0.5;
    });
    if (absent) out.push(t);
  }
  return out;
}

/* ---- 軸スコアの推移(週次レポートのスパークライン用) ---- */
export interface AxisTrendPoint {
  endDate: string;
  axes: AxisResult[];
}

/** 試合を1つずつ増やしながら軸スコアを再計算し推移を返す */
export function axisTrend(approved: Match[]): AxisTrendPoint[] {
  const asc = approved
    .filter((m) => m.rallies.length > 0)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
  const points: AxisTrendPoint[] = [];
  for (let i = 1; i <= asc.length; i++) {
    const subset = asc.slice(0, i);
    points.push({ endDate: asc[i - 1].date, axes: computeAxes(subset) });
  }
  return points;
}

/* ---- その試合の「良かったデータ」抽出(試合後モード・鉄則: 課題の前に必ず1つ) ---- */
export interface GoodData {
  text: string;
  pt: number;
}

export function bestDataOfMatch(m: Match): GoodData {
  const candidates: { score: number; text: string; pt: number }[] = [];
  // サーブ種別ごとの得点率
  const groups = new Map<string, { wins: number; total: number }>();
  for (const r of m.rallies) {
    if (r.server !== 'me' || r.serveType === UNKNOWN_SERVE) continue;
    const g = groups.get(r.serveType) ?? { wins: 0, total: 0 };
    g.total += 1;
    if (r.winner === 'me') g.wins += 1;
    groups.set(r.serveType, g);
  }
  for (const [type, g] of groups) {
    if (g.total >= 5) {
      candidates.push({
        score: g.wins / g.total,
        text: `${type}サーブの得点率${Math.round((g.wins / g.total) * 100)}%`,
        pt: g.total,
      });
    }
  }
  // クラッチ(9点以遠)
  const clutch = m.rallies.filter((r) => Math.max(r.myScore, r.oppScore) >= 9);
  if (clutch.length >= 4) {
    const wr = clutch.filter((r) => r.winner === 'me').length / clutch.length;
    candidates.push({ score: wr, text: `終盤(9点以遠)の得点率${Math.round(wr * 100)}%`, pt: clutch.length });
  }
  // 3球目強打
  const third = m.rallies.filter((r) => r.server === 'me' && r.rallyLength >= 3);
  if (third.length >= 5) {
    const rate = third.filter((r) => r.thirdBallAttack && r.winner === 'me').length / third.length;
    candidates.push({ score: rate + 0.1, text: `3球目攻撃からの得点率${Math.round(rate * 100)}%`, pt: third.length });
  }
  if (candidates.length === 0) {
    return { text: `${m.rallies.length}本のラリーを最後まで戦い抜いた`, pt: m.rallies.length };
  }
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return { text: best.text, pt: best.pt };
}
