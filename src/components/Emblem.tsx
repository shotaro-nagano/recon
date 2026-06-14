/* ============================================================
   エンブレム (ライトテーマ版・装飾控えめ)
   未診断=スレートのシルエット → 診断完了=仮タイプ色(淡め) →
   実測=タイプ色。六角フレームはタイプ色、内部は白。
   α/Ω は TypeBadge 側のチップで示す(エンブレムはシンプルに)。
   ============================================================ */
import { MOTIFS } from './emblems';
import { typeColor, blendOver, rgba } from '@/domain/accent';
import type { CodenameKey, TypeStage, Variant } from '@/domain/types';

interface Props {
  codename?: CodenameKey;
  variant?: Variant;
  stage: TypeStage;
  size?: number;
  reveal?: boolean;
}

const HEX_POINTS = '60,7 106,33.5 106,86.5 60,113 14,86.5 14,33.5';
const SLATE = '#5A6B82';

export default function Emblem({ codename, variant: _variant, stage, size = 96, reveal = false }: Props) {
  const known = stage !== 'none' && codename;
  const base = known ? typeColor(codename) : SLATE;
  // 仮タイプは白に寄せて淡く、実測はそのまま
  const motifColor = stage === 'provisional' ? blendOver(base, '#FFFFFF', 0.45) : base;
  const frameColor = known ? base : SLATE;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={known ? `${codename} エンブレム` : '未確定エンブレム'}
      className={`accent-fade${reveal ? ' emblem-reveal' : ''}`}
      style={{ display: 'block' }}
    >
      <polygon points={HEX_POINTS} fill="#FFFFFF" stroke={frameColor} strokeWidth={3.5} />
      <polygon
        points={HEX_POINTS}
        fill="none"
        stroke={rgba(base, known ? 0.22 : 0.16)}
        strokeWidth={8}
        transform="translate(60 60) scale(0.86) translate(-60 -60)"
      />
      {known ? (
        <g color={motifColor}>{MOTIFS[codename!]}</g>
      ) : (
        <g fill="none" stroke={SLATE} strokeWidth={5} strokeLinecap="round">
          <path d="M48 48 Q48 34 60 34 Q72 34 72 46 Q72 56 60 58 L60 68" />
          <circle cx={60} cy={82} r={3.5} fill={SLATE} stroke="none" />
        </g>
      )}
    </svg>
  );
}
