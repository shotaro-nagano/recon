/* ============================================================
   タイプ色アクセント (ライトテーマ版)
   未診断: 無彩のスレートグレー → 診断済: 仮タイプ色 → 実測: タイプ色
   タイプ色は constants.ts 側で白背景でも読める濃さに調整済み。
   ここでは「テキスト/塗り兼用の accent」と「淡いtint」を供給する。
   ============================================================ */
import { CODENAMES } from './constants';
import type { CodenameKey, TypeStage } from './types';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** fg を bg の上に alpha で重ねた合成色 */
export function blendOver(fg: string, bg: string, alpha: number): string {
  const [fr, fgn, fb] = hexToRgb(fg);
  const [br, bgn, bb] = hexToRgb(bg);
  return rgbToHex(fr * alpha + br * (1 - alpha), fgn * alpha + bgn * (1 - alpha), fb * alpha + bb * (1 - alpha));
}
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 未診断時の無彩アクセント(白背景で読めるスレート) */
const SLATE = '#5A6B82';

export interface AccentVars {
  '--accent': string;
  '--accent-soft': string;
  '--accent-faint': string;
}

export function accentVars(stage: TypeStage, codename?: CodenameKey): AccentVars {
  if (stage === 'none' || !codename) {
    return { '--accent': SLATE, '--accent-soft': rgba(SLATE, 0.28), '--accent-faint': rgba(SLATE, 0.09) };
  }
  const color = CODENAMES[codename].color;
  // 仮タイプは少しだけ淡く(白に寄せる)。実測はそのまま。どちらもテキスト可読を保つ
  const accent = stage === 'provisional' ? blendOver(color, '#FFFFFF', 0.86) : color;
  return {
    '--accent': accent,
    '--accent-soft': rgba(color, 0.26),
    '--accent-faint': rgba(color, 0.09),
  };
}

export function typeColor(codename?: CodenameKey): string {
  return codename ? CODENAMES[codename].color : SLATE;
}
