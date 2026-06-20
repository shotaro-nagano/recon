/* ============================================================
   コーチ用ラインアイコン(絵文字を排した SVG 線画)
   stroke=currentColor で色は CSS(ネオン等)から流し込む。
   ============================================================ */
import type { DrillCategoryKey } from '@/domain/coach/drills';

function Svg({ size = 22, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ---- タブ ---- */
export const IconPractice = ({ size }: { size?: number }) => (
  <Svg size={size}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M8.5 11h7M8.5 14.5h4.5" /></Svg>
);
export const IconTactics = ({ size }: { size?: number }) => (
  <Svg size={size}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Svg>
);
export const IconWeakness = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M12 3 22 20H2Z" /><path d="M12 10v4.5M12 17.5h.01" /></Svg>
);

/* ---- フォーカス選択 ---- */
export const IconStrong = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M6 14l6-6 6 6M6 19l6-6 6 6" /></Svg>
);
export const IconWeak = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M12 3l7 3v5c0 4-3 6.8-7 9-4-2.2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></Svg>
);

/* ---- ヘルプ/ナビ補助 ---- */
export const IconHelp = ({ size }: { size?: number }) => (
  <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7M12 17h.01" /></Svg>
);

/* ---- 練習カテゴリ(7種) ---- */
const CAT_ICONS: Record<DrillCategoryKey, () => React.ReactNode> = {
  multiball: () => (<><circle cx="7" cy="7.5" r="1.6" /><circle cx="12" cy="7.5" r="1.6" /><circle cx="17" cy="7.5" r="1.6" /><circle cx="7" cy="13" r="1.6" /><circle cx="12" cy="13" r="1.6" /><circle cx="9.5" cy="18" r="1.6" /></>),
  footwork: () => (<><path d="M12 3v18M3 12h18" /><path d="M8 7 4 12l4 5M16 7l4 5-4 5" /></>),
  task: () => (<><path d="M4 9h11l-3-3M20 15H9l3 3" /></>),
  serve: () => (<><circle cx="8.5" cy="8.5" r="4" /><path d="M11.5 11.5 18 18" /><path d="M14.5 4q5.5 2 5.5 7.5" /></>),
  receive: () => (<><path d="M4 7h16M12 7v9M8 12.5l4 4 4-4" /></>),
  overtable: () => (<><path d="M3 9h18M5 9l1.6 8M19 9l-1.6 8M12 9v8" /></>),
  system: () => (<><circle cx="5" cy="12" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><circle cx="19" cy="12" r="2" /><path d="M7 12h3M13.6 7.2 17.2 10.8M13.6 16.8 17.2 13.2" /></>),
};

export const CatIcon = ({ k, size }: { k: DrillCategoryKey; size?: number }) => (
  <Svg size={size}>{CAT_ICONS[k]()}</Svg>
);
