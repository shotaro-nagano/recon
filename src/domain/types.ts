/* ============================================================
   CODENAME COACH — ドメイン型定義 (CLAUDE.md / types/types.md 準拠)
   ============================================================ */

/** 4軸の極 */
export type AxisPole = 'A' | 'S' | 'C' | 'N' | 'V' | 'R' | 'F' | 'L';
export type AxisKey = 'AS' | 'CN' | 'VR' | 'FL';

export type CodenameKey =
  | 'BLADE' | 'PHANTOM' | 'BULLET' | 'JOKER'
  | 'FORTRESS' | 'SNIPER' | 'ANCHOR' | 'ORACLE';

/** α=先行型(F) / Ω=後半に牙を剥く型(L) */
export type Variant = 'alpha' | 'omega';

export type Skin = 'A' | 'B' | 'C';

/* ---------------- 試合データ (承認済みCSVが唯一の計算ソース) ---------------- */

export type ServeType =
  | 'ロング' | 'ショート下' | 'ショートナックル' | '巻き込み' | 'YG' | '横回転';

/** コース6分割: 1=バック前 2=ミドル前 3=フォア前 4=バック奥 5=ミドル奥 6=フォア奥 */
export type Course = 1 | 2 | 3 | 4 | 5 | 6;

export interface RallyRow {
  set: number;
  /** ラリー開始時点のスコア */
  myScore: number;
  oppScore: number;
  server: 'me' | 'opp';
  serveType: ServeType | string;
  serveCourse: Course;
  /** 総打球数 */
  rallyLength: number;
  /** 自分サーブ時、3球目を強打したか */
  thirdBallAttack: boolean;
  winner: 'me' | 'opp';
}

export type MatchSource = '得点チェックリスト' | '撮影判定' | '手入力' | 'デモ';

/** 試合の種別(フォルダ表示・記録用。タイプ計算には影響しない) */
export type MatchKind = '公式戦' | '練習試合' | '合宿・遠征' | 'その他';

export interface Match {
  id: string;
  date: string; // YYYY-MM-DD
  opponentId: string;
  opponentName: string;
  /** 大会名(任意。例: 県リーグ) */
  tournament?: string;
  /** 種別(任意。未設定は「その他」扱い) */
  kind?: MatchKind;
  /** 一言メモ(任意。例: 新サーブを試した試合) */
  note?: string;
  mySets: number;
  oppSets: number;
  source: MatchSource;
  /** 人間承認済みのみカルテ・タイプ計算に使用する(絶対ルール) */
  approved: boolean;
  approvedAt?: string;
  rallies: RallyRow[];
}

/** 撮影失敗・未承認の欠損試合 → その期間の傾向は「暫定」扱い */
export interface MissingMatch {
  id: string;
  date: string;
  opponentName: string;
  reason: '撮影失敗' | '未承認' | 'その他';
}

/* ---------------- 軸スコア・タイプ判定 ---------------- */

export interface AxisResult {
  axis: AxisKey;
  /** 0–100 正規化。50±5は境界帯 */
  score: number;
  /** 95%信頼区間の半幅(スコア単位) */
  ci: number;
  pole: AxisPole;
  boundary: boolean;
  /** この軸の判定に使ったサンプル数 */
  pt: number;
}

export interface ClutchStat {
  /** 9点以遠の得点率 − 全体得点率 */
  diff: number;
  pt: number;
  /** 95%CI 半幅(割合) */
  ci: number;
}

export type TypeStage = 'none' | 'provisional' | 'measured';

export interface TypeResult {
  stage: TypeStage;
  codename?: CodenameKey;
  variant?: Variant;
  /** 境界帯の場合の複合相手(例: BLADE/PHANTOM複合) */
  boundaryWith?: CodenameKey;
  axes: AxisResult[];
  clutch?: ClutchStat;
  /** β校正期間中(運用開始1ヶ月) */
  beta: boolean;
  totalPt: number;
  matchCount: number;
}

/* ---------------- 診断 (オンボーディング7問) ---------------- */

export interface DiagnosisAnswers {
  /** Q1 戦型 */
  style: string;
  /** Q2 利き手とグリップ */
  grip: string;
  /** Q3 競り合いの自己評価 1–5 (実測ギャップ演出用に保存) */
  selfRating: number;
  /** Q4 [A/S] a=A / b=S */
  q4: 'a' | 'b';
  /** Q5 [V/R] a=V / b=R */
  q5: 'a' | 'b';
  /** Q6 [F/L] a=F / b=L */
  q6: 'a' | 'b';
  /** Q7 [C/N] a=C / b=N */
  q7: 'a' | 'b';
  answeredAt: string;
}

/* ---------------- カルテ(自分) ---------------- */

export type TendencyStatus = 'observed' | 'confirmed' | 'resolved';

export interface TendencyEntry {
  id: string;
  /** 機械可読キー(自動検出との突合用) 例: "receive-loss:c1" */
  key?: string;
  text: string;
  pt: number;
  /** 割合系の値 (例: 0.62 = 62%) */
  value?: number;
  ci?: number;
  status: TendencyStatus;
  firstSeen: string;
  lastSeen: string;
  resolvedAt?: string;
  resolvedBy?: string; // 解消に効いた練習
}

export interface CollapseLoop {
  id: string;
  trigger: string;
  middle: string;
  result: string;
  /** 発生回数 / 対象試合数 */
  occurrences: number;
  matches: number;
  avgLost: number;
  escapeAction: string;
}

export interface CoachingMemo {
  id: string;
  date: string;
  text: string;
  /** 判定への影響 (例: 当該試合のほころび判定から除外) */
  effect?: string;
}

export interface PracticeLogEntry {
  id: string;
  date: string;
  drill: string;
  /** 成功率 0–1 */
  successRate: number;
  note?: string;
}

export interface PracticeAssignment {
  id: string;
  date: string;
  menu: string;
  status: '検証待ち' | '検証済み';
  outcome?: string;
}

export interface TypeHistoryEntry {
  date: string; // YYYY-MM
  codename: CodenameKey;
  variant: Variant;
  stage: TypeStage;
}

export interface SelfKarte {
  tendencies: TendencyEntry[];
  loops: CollapseLoop[];
  memos: CoachingMemo[];
  practiceLog: PracticeLogEntry[];
  assignments: PracticeAssignment[];
  missingMatches: MissingMatch[];
  typeHistory: TypeHistoryEntry[];
}

/* ---------------- 相手カルテ ---------------- */

export interface OpponentKarte {
  id: string;
  name: string;
  affiliation?: string;
  /** 暫定CODENAME判定 */
  provisionalCodename?: CodenameKey;
  provisionalVariant?: Variant;
  judgedPt: number;
  serveTendency: string[];
  receiveHoles: string[];
  clutchHabits: string[];
  notes: { date: string; tournament?: string; text: string }[];
}

/* ---------------- 二層承認 ---------------- */

export type ApprovalKind =
  | '新規確定タグ' | '崩壊ループ変更' | 'タイプ変更' | 'コーチングメモ' | '解消移動';

export interface Approval {
  id: string;
  kind: ApprovalKind;
  createdAt: string;
  summary: string;
  /** 承認時にカルテへ適用するペイロード */
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected';
}

/* ---------------- セッションログ・スナップショット ---------------- */

export interface SessionLog {
  id: string;
  date: string;
  mode: '試合前' | '試合後' | '週次' | '会話';
  summary: string;
}

export interface KarteSnapshot {
  id: string;
  takenAt: string;
  reason: string;
  karte: SelfKarte;
}

/* ---------------- 設定 ---------------- */

export interface Settings {
  playerName: string;
  /** 初回オンボーディング(名前入力)を通過したか */
  onboarded: boolean;
  /** 使い方チュートリアルを表示済みか */
  tourSeen: boolean;
  /** かんたんモード: 上級機能を隠して要点だけ表示(初心者向け既定ON) */
  simpleMode: boolean;
  skin: Skin;
  /** β校正: 運用開始日から1ヶ月はβ表示 */
  operationStartDate: string | null;
}

/* ---------------- 相性 ---------------- */

export type MatchupSymbol = '◎' | '○' | '●' | '▲' | '×';

export interface MatchupResult {
  symbol: MatchupSymbol;
  /** -2〜+2 の内部スコア */
  score: number;
  /** α/Ω補正・BULLET-α補正の注記 */
  notes: string[];
  /** 実対戦サンプル数 (0なら理論値と明示する) */
  sampleSize: number;
}
