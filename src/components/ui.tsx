/* ============================================================
   共通UI部品 — 全画面で使う最小限のプリミティブ
   ボタン文言は動詞をそのまま / エラーは原因と次の行動 / 空状態は誘い
   ============================================================ */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CODENAMES, matchKindOf, VARIANT_READING } from '@/domain/constants';
import type { Approval, CodenameKey, Course, MatchKind, Variant } from '@/domain/types';
import { typeColor } from '@/domain/accent';

/* ---- 画面ラッパー ---- */
export function Screen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="fade-in">
      <div className="spread">
        <h1 className="display screen-title">{title}</h1>
        {right}
      </div>
      <div className="stack">{children}</div>
    </div>
  );
}

export function Card({ children, accent = false, style }: { children: ReactNode; accent?: boolean; style?: React.CSSProperties }) {
  return (
    <section
      className="card accent-fade"
      style={accent ? { borderColor: 'var(--accent)', boxShadow: 'inset 3px 0 0 var(--accent), var(--shadow-card)', ...style } : style}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}

/* ---- 折りたたみ(「もっと見る」: 要点だけ見せて詳細は畳む)
   原則 defaultOpen=false(基本は閉じる)。閉じている間も summary で要点を見せられる。 ---- */
export function Collapsible({
  title, defaultOpen = false, openLabel, closeLabel, summary, children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  /** 閉じている時のボタン文言(既定: 「{title}を見る」) */
  openLabel?: string;
  /** 開いている時のボタン文言(既定: 「{title}を閉じる」) */
  closeLabel?: string;
  /** 閉じている時にボタン下へ出す要点プレビュー(任意) */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = open
    ? (closeLabel ?? (typeof title === 'string' ? `${title}を閉じる` : '閉じる'))
    : (openLabel ?? (typeof title === 'string' ? `${title}を見る` : 'もっと見る'));
  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4 }}
      >
        <span style={{ textAlign: 'left' }}>{label}</span>
        <span aria-hidden="true" className="mono" style={{ fontSize: 12, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {!open && summary != null && (
        <div className="small muted" style={{ marginTop: 6, paddingLeft: 4 }}>{summary}</div>
      )}
      {open && <div className="stack fade-in" style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

/* ---- 試合の種別バッジ(公式戦/練習試合/合宿・遠征/その他) ---- */
export function MatchKindBadge({ kind }: { kind?: MatchKind }) {
  const k = matchKindOf(kind);
  const official = k === '公式戦';
  return (
    <span
      className="small"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 9px',
        borderRadius: 'var(--radius-pill)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        background: official ? 'var(--accent-faint)' : 'transparent',
        color: official ? 'var(--accent)' : 'var(--line-dim)',
        border: official ? '1px solid var(--accent-soft)' : '1px solid var(--divider-strong)',
      }}
    >
      {k}
    </span>
  );
}

/* ---- 空状態は誘いにする ---- */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state stack" style={{ alignItems: 'center' }}>
      <p style={{ color: 'var(--court-line)' }}>{title}</p>
      {hint && <p className="small">{hint}</p>}
      {action}
    </div>
  );
}

/* ---- タイプ表示バッジ: "PHANTOM [Ω] ファントム・オメガ β" ---- */
export function TypeBadge({ codename, variant, beta = false, boundaryWith, showReading = true }: {
  codename: CodenameKey; variant?: Variant; beta?: boolean; boundaryWith?: CodenameKey; showReading?: boolean;
}) {
  const vSym = variant === 'omega' ? 'Ω' : variant === 'alpha' ? 'α' : '';
  const reading = CODENAMES[codename].reading + (variant ? `・${VARIANT_READING[variant]}` : '');
  return (
    <span className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
      <span className="row" style={{ gap: 5 }}>
        <span className="display" style={{ color: typeColor(codename), fontSize: 18, letterSpacing: '0.02em' }}>
          {codename}
        </span>
        {vSym && (
          <span className={`hex-badge mono ${variant === 'omega' ? 'badge-omega' : 'badge-alpha'}`} style={{ fontSize: 11 }}>
            {vSym}
          </span>
        )}
      </span>
      {showReading && <span className="small muted">{reading}</span>}
      {boundaryWith && <span className="small muted">/{boundaryWith}複合</span>}
      {beta && (
        <span className="hex-badge mono" style={{ fontSize: 11, background: 'var(--accent-faint)', color: 'var(--accent)' }}>β</span>
      )}
    </span>
  );
}

/* ---- コース番号バッジ(1-6・タイプ色) ---- */
export function CourseBadge({ course }: { course: Course }) {
  return <span className="course-badge mono">{course}</span>;
}

/* ---- セグメント切替 ---- */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="row" style={{ gap: 0, border: '1px solid var(--divider)', borderRadius: 'var(--radius)', overflow: 'hidden', width: 'fit-content' }}>
      {options.map((o) => (
        <button
          key={o.value}
          className="btn"
          style={{
            border: 'none', borderRadius: 0, minHeight: 38, fontSize: 13,
            background: o.value === value ? 'var(--accent)' : 'transparent',
            color: o.value === value ? 'var(--accent-contrast)' : 'var(--line-dim)',
          }}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- スパークライン(週次の軸スコア推移など) ---- */
export function Sparkline({ values, color = 'var(--accent)', width = 160, height = 36, min = 0, max = 100 }: {
  values: number[]; color?: string; width?: number; height?: number; min?: number; max?: number;
}) {
  if (values.length === 0) return null;
  const pad = 4;
  const xs = values.map((_, i) =>
    values.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (values.length - 1),
  );
  const ys = values.map((v) => {
    const t = (v - min) / (max - min || 1);
    return height - pad - t * (height - pad * 2);
  });
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill={color} />
    </svg>
  );
}

/* ---- 承認カード(二層承認の「要確認」UI) ---- */
export function ApprovalCard({ approval, onResolve }: {
  approval: Approval;
  onResolve: (id: string, accept: boolean) => void;
}) {
  return (
    <Card accent>
      <SectionLabel>要確認 — {approval.kind}</SectionLabel>
      <p style={{ marginBottom: 12 }}>{approval.summary}</p>
      <div className="row">
        <button className="btn btn-primary" onClick={() => onResolve(approval.id, true)}>
          カルテに反映
        </button>
        <button className="btn" onClick={() => onResolve(approval.id, false)}>
          見送る
        </button>
      </div>
    </Card>
  );
}

/* ---- 軸スコアバー ---- */
export function AxisBar({ label, loLabel, hiLabel, score, ci, pt, boundary }: {
  label: string; loLabel: string; hiLabel: string;
  score: number; ci: number; pt: number; boundary: boolean;
}) {
  return (
    <div>
      <div className="spread small">
        <span className="muted">{label}</span>
        <span className="mono muted">
          {score.toFixed(0)} ±{ci.toFixed(0)} [{pt}pt]{boundary ? ' 境界帯' : ''}
        </span>
      </div>
      <div className="meter-track" style={{ marginTop: 4 }}>
        {/* CI帯 */}
        <div
          className="meter-band"
          style={{
            left: `${Math.max(0, score - ci)}%`,
            right: `${Math.max(0, 100 - (score + ci))}%`,
            opacity: 0.35,
          }}
        />
        {/* スコア点 */}
        <div
          className="meter-band"
          style={{ left: `calc(${score}% - 2px)`, right: `calc(${100 - score}% - 2px)` }}
        />
      </div>
      <div className="spread small muted" style={{ marginTop: 2 }}>
        <span>{loLabel}</span>
        <span>{hiLabel}</span>
      </div>
    </div>
  );
}

/** コードネームの説明行 */
export function codenameDesc(c: CodenameKey): string {
  return `${CODENAMES[c].style} — ${CODENAMES[c].winPattern}`;
}
