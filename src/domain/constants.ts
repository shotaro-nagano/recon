/* ============================================================
   CODENAME COACH — 16タイプ定数 (types/types.md / DESIGN.md 準拠)
   ============================================================ */
import type { AxisKey, AxisPole, CodenameKey, Course, Persona, ServeType, Skin } from './types';

export interface CodenameDef {
  key: CodenameKey;
  /** カタカナ読み */
  reading: string;
  /** 3軸の極 (F/L以外) */
  poles: [AxisPole, AxisPole, AxisPole];
  style: string;
  winPattern: string;
  color: string;
  /** SVGエンブレムのモチーフ */
  motif: string;
}

export const CODENAMES: Record<CodenameKey, CodenameDef> = {
  BLADE: {
    key: 'BLADE', reading: 'ブレイド', poles: ['A', 'C', 'R'],
    style: '王道正面の斬り込み',
    winPattern: '質で押し勝つ。崩されても終盤の勝負強さで巻き返す',
    color: '#3E7FB8', motif: '剣',
  },
  PHANTOM: {
    key: 'PHANTOM', reading: 'ファントム', poles: ['A', 'C', 'V'],
    style: '変幻自在の攻撃',
    winPattern: '単調な相手の読みを外し続ける',
    color: '#7B4FC4', motif: '仮面',
  },
  BULLET: {
    key: 'BULLET', reading: 'バレット', poles: ['A', 'N', 'R'],
    style: '一直線の超速攻',
    winPattern: '序盤の奇襲でリードを奪い逃げ切る(α運用が生命線)',
    color: '#D55F1C', motif: '弾丸',
  },
  JOKER: {
    key: 'JOKER', reading: 'ジョーカー', poles: ['A', 'N', 'V'],
    style: '読めない変化トリック',
    winPattern: '相手のリズムを破壊し、ハマれば一気',
    color: '#C23379', motif: 'トランプ',
  },
  FORTRESS: {
    key: 'FORTRESS', reading: 'フォートレス', poles: ['S', 'C', 'R'],
    style: '何でも返す要塞',
    winPattern: '単調な攻撃を吸収し、終盤のミス差で勝つ',
    color: '#2F8B57', motif: '盾',
  },
  SNIPER: {
    key: 'SNIPER', reading: 'スナイパー', poles: ['S', 'C', 'V'],
    style: '守りから一撃必中',
    winPattern: '相手の攻撃をカウンターの餌にする',
    color: '#CB3640', motif: '照準',
  },
  ANCHOR: {
    key: 'ANCHOR', reading: 'アンカー', poles: ['S', 'N', 'R'],
    style: '絶対に切れない粘り',
    winPattern: 'ラリーを長期化させ相手の根気を折る',
    color: '#2E8197', motif: '錨',
  },
  ORACLE: {
    key: 'ORACLE', reading: 'オラクル', poles: ['S', 'N', 'V'],
    style: '全部読んで先回り',
    winPattern: '逆発想の読みで相手の選択肢を消す',
    color: '#2C9BB0', motif: '目',
  },
};

/** α/Ω のカタカナ読み */
export const VARIANT_READING: Record<'alpha' | 'omega', string> = {
  alpha: 'アルファ',
  omega: 'オメガ',
};

export const CODENAME_KEYS = Object.keys(CODENAMES) as CodenameKey[];

/** A/S, C/N, V/R の3極組み合わせ → コードネーム */
export function codenameFromPoles(as: 'A' | 'S', cn: 'C' | 'N', vr: 'V' | 'R'): CodenameKey {
  const map: Record<string, CodenameKey> = {
    ACR: 'BLADE', ACV: 'PHANTOM', ANR: 'BULLET', ANV: 'JOKER',
    SCR: 'FORTRESS', SCV: 'SNIPER', SNR: 'ANCHOR', SNV: 'ORACLE',
  };
  return map[`${as}${cn}${vr}`];
}

export const AXIS_INFO: Record<AxisKey, { label: string; hi: AxisPole; lo: AxisPole; hiLabel: string; loLabel: string }> = {
  AS: { label: '攻め/堅実', hi: 'A', lo: 'S', hiLabel: '攻め', loLabel: '堅実' },
  CN: { label: '勝負強さ/序盤型', hi: 'C', lo: 'N', hiLabel: '勝負強い', loLabel: '序盤型' },
  VR: { label: '変化/王道', hi: 'V', lo: 'R', hiLabel: '変化', loLabel: '王道' },
  FL: { label: '先行/後半', hi: 'F', lo: 'L', hiLabel: '先行', loLabel: '後半' },
};

/** 境界帯: 50±5 */
export const BOUNDARY_LO = 45;
export const BOUNDARY_HI = 55;
/** 指数減衰の半減期(試合数ベース。経過日数ではない=シーズンオフで崩壊しない) */
export const DECAY_HALF_LIFE_MATCHES = 3;
/** 主データ窓: 直近5試合 */
export const MAIN_WINDOW_MATCHES = 5;
/** 実測タイプに必要な最低承認試合数(バックフィル目安5〜8試合) */
export const MEASURED_MIN_MATCHES = 5;
/** 確定タグの条件: 10pt以上かつ3試合連続 */
export const CONFIRM_MIN_PT = 10;
export const CONFIRM_STREAK = 3;
/** 確定タグが直近2試合で観測されなければ解消済みへ */
export const RESOLVE_ABSENT_MATCHES = 2;

export const COURSE_LABELS: Record<Course, string> = {
  1: 'バック前', 2: 'ミドル前', 3: 'フォア前',
  4: 'バック奥', 5: 'ミドル奥', 6: 'フォア奥',
};

export const SERVE_TYPES: ServeType[] = [
  'ロング', 'ショート下', 'ショートナックル', '巻き込み', 'YG', '横回転',
];

export const PERSONA_INFO: Record<Persona, { label: string; desc: string }> = {
  operator: { label: 'オペレーター', desc: '冷静なオペレーター風。「PHANTOM、状況を共有する」' },
  passion: { label: '熱血', desc: '熱血コーチ風。「いくぞ! ここからが本番だ!」' },
  analyst: { label: 'アナリスト', desc: 'フラットな分析官風。事実と数値を淡々と' },
};

export const SKIN_INFO: Record<Skin, { label: string; desc: string }> = {
  A: { label: 'SKIN A', desc: 'シャープな短髪・がっちり体格' },
  B: { label: 'SKIN B', desc: 'ロングヘア・すらりとした体格' },
  C: { label: 'SKIN C', desc: 'ミディアムヘア・中間的な体格' },
};

/** 戦型(Q1)の選択肢 */
export const STYLE_OPTIONS = [
  'シェーク裏裏', 'シェーク裏表', 'シェーク表', 'ペン', 'カット主戦', 'その他',
];

export const GRIP_OPTIONS = [
  '右シェーク', '左シェーク', '右ペン', '左ペン',
];
