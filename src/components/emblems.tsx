/* ============================================================
   8コードネームのエンブレムモチーフ (types/types.md SVGエンブレム方針)
   剣 / 仮面 / 弾丸 / トランプ / 盾 / 照準 / 錨 / 目
   - viewBox 0 0 120 120 / 中心(60,60) / stroke は currentColor
   - 背景タイルや装飾は持たない(Emblem.tsx が六角形フレームを重ねる)
   ============================================================ */
import type { ReactElement } from 'react';
import type { CodenameKey } from '@/domain/types';

const sw = 5;

export const MOTIFS: Record<CodenameKey, ReactElement> = {
  /* 剣 — 王道正面の斬り込み */
  BLADE: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 24 L67 36 L67 70 L53 70 L53 36 Z" fill="currentColor" stroke="none" opacity={0.9} />
      <path d="M42 76 L78 76" />
      <path d="M60 76 L60 92" />
      <circle cx={60} cy={97} r={4} fill="currentColor" stroke="none" />
    </g>
  ),
  /* 仮面 — 変幻自在 */
  PHANTOM: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M34 52 Q60 40 86 52 Q88 70 72 71 Q65 71 60 76 Q55 71 48 71 Q32 70 34 52 Z"
        fill="currentColor" stroke="none" opacity={0.9}
      />
      <ellipse cx={48} cy={57} rx={6.5} ry={4.5} fill="var(--deep-court)" stroke="none" />
      <ellipse cx={72} cy={57} rx={6.5} ry={4.5} fill="var(--deep-court)" stroke="none" />
      <path d="M44 86 Q60 94 76 86" />
    </g>
  ),
  /* 弾丸 — 一直線の超速攻 */
  BULLET: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M60 22 Q73 36 73 52 L73 72 L47 72 L47 52 Q47 36 60 22 Z"
        fill="currentColor" stroke="none" opacity={0.9}
      />
      <path d="M45 80 L75 80" />
      <path d="M38 90 L54 90" />
      <path d="M66 90 L82 90" />
    </g>
  ),
  /* トランプ — 読めない変化 */
  JOKER: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x={44} y={32} width={32} height={50} rx={5} transform="rotate(-8 60 57)" />
      <path d="M62 44 L69 56 L62 68 L55 56 Z" fill="currentColor" stroke="none" />
      <path d="M48 88 L60 96 L72 88" />
    </g>
  ),
  /* 盾 — 何でも返す要塞 */
  FORTRESS: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 24 L84 34 L84 58 Q84 80 60 94 Q36 80 36 58 L36 34 Z" />
      <path d="M36 52 L84 52" />
      <path d="M60 52 L60 94" />
    </g>
  ),
  /* 照準 — 一撃必中 */
  SNIPER: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={60} cy={60} r={25} />
      <path d="M60 24 L60 38" />
      <path d="M60 82 L60 96" />
      <path d="M24 60 L38 60" />
      <path d="M82 60 L96 60" />
      <circle cx={60} cy={60} r={5} fill="currentColor" stroke="none" />
    </g>
  ),
  /* 錨 — 絶対に切れない粘り */
  ANCHOR: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={60} cy={31} r={7} />
      <path d="M60 38 L60 86" />
      <path d="M46 50 L74 50" />
      <path d="M34 66 Q38 86 60 88 Q82 86 86 66" />
      <path d="M34 66 L28 74" />
      <path d="M34 66 L43 69" />
      <path d="M86 66 L92 74" />
      <path d="M86 66 L77 69" />
    </g>
  ),
  /* 目 — 全部読んで先回り */
  ORACLE: (
    <g fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 60 Q60 36 90 60 Q60 84 30 60 Z" />
      <circle cx={60} cy={60} r={11} />
      <circle cx={60} cy={60} r={4} fill="currentColor" stroke="none" />
    </g>
  ),
};
