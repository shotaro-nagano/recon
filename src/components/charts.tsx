/* ============================================================
   データ可視化部品(SVG・依存なし)
   テキストではなく「見て直感的に分かる」表示のための共通チャート。
   色は CSS変数のみ(--accent=タイプ色 / --pos / --neg / --grid)。
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AxisResult, AxisKey, Course, RallyRow } from '@/domain/types';
import { AXIS_INFO, COURSE_LABELS } from '@/domain/constants';

/** マウント直後に true へ。出現アニメ(バー伸長・リング走査)の起動に使う */
function useMounted(delay = 40): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 0→value をカウントアップ表示(数字が「貯まっていく」演出) */
export function AnimatedNumber({ value, durationMs = 800, decimals = 0, suffix = '' }: {
  value: number; durationMs?: number; decimals?: number; suffix?: string;
}) {
  const [disp, setDisp] = useState(reduceMotion() ? value : 0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (reduceMotion()) { setDisp(value); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisp(value * (1 - Math.pow(1 - t, 3))); // easeOutCubic
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, durationMs]);
  return <>{disp.toFixed(decimals)}{suffix}</>;
}

/* ---- 4軸レーダー(プレイヤーの個性プロフィール) ----
   中心=控えめ / 外=その傾向が強い。各頂点に「傾いている極＋スコア」を出す。 */
const RADAR_ORDER: AxisKey[] = ['AS', 'CN', 'VR', 'FL'];
// 上・右・下・左
const RADAR_ANGLE: Record<number, number> = { 0: -90, 1: 0, 2: 90, 3: 180 };

export function RadarChart({ axes, color = 'var(--accent)', size = 230 }: {
  axes: AxisResult[]; color?: string; size?: number;
}) {
  const c = size / 2;
  const R = size / 2 - 46; // ラベル余白
  const byKey = new Map(axes.map((a) => [a.axis, a]));
  const pt = (i: number, t: number) => {
    const rad = (RADAR_ANGLE[i] * Math.PI) / 180;
    return [c + Math.cos(rad) * R * t, c + Math.sin(rad) * R * t] as const;
  };
  // 各軸の「決定度」= 50からの隔たり(0–1)
  const vals = RADAR_ORDER.map((k) => {
    const a = byKey.get(k);
    const score = a ? a.score : 50;
    return Math.min(1, Math.abs(score - 50) / 50);
  });
  const dataPts = vals.map((t, i) => pt(i, Math.max(0.04, t)));
  const poly = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const rings = [0.34, 0.67, 1];
  const mounted = useMounted();
  // ポリゴンの外周長(線を一周描くアニメ用)
  let perim = 0;
  for (let i = 0; i < dataPts.length; i++) {
    const a = dataPts[i]; const b = dataPts[(i + 1) % dataPts.length];
    perim += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
      {/* グリッド(同心ダイヤ) */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={RADAR_ORDER.map((_, i) => { const [x, y] = pt(i, r); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ')}
          fill="none" stroke="var(--grid)" strokeWidth={1}
        />
      ))}
      {/* 軸線 */}
      {RADAR_ORDER.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--grid)" strokeWidth={1} />; })}
      {/* データ多角形 — 塗りはフェード、線は一周描かれる、頂点は順に点灯 */}
      <polygon points={poly} fill={color} stroke="none" style={{ opacity: mounted ? 0.22 : 0, transition: 'opacity 0.6s ease 0.55s' }} />
      <polygon
        points={poly} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={perim} strokeDashoffset={mounted ? 0 : perim}
        style={{ transition: 'stroke-dashoffset 0.95s ease' }}
      />
      {dataPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.5} fill={color} style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.3s ease ${0.5 + i * 0.12}s` }} />
      ))}
      {/* ラベル(極＋スコア) */}
      {RADAR_ORDER.map((k, i) => {
        const a = byKey.get(k);
        const info = AXIS_INFO[k];
        // 表示値は「その極への傾きの強さ」(0–100)。プロットの遠さと一致させる(低い=弱い、ではない)。
        const strength = Math.round(vals[i] * 100);
        const poleLabel = !a ? info.label : a.pole === info.hi ? info.hiLabel : info.loLabel;
        const [lx, ly] = pt(i, 1.34);
        const anchor = i === 1 ? 'start' : i === 3 ? 'end' : 'middle';
        return (
          <g key={k}>
            <text x={lx} y={ly - 4} textAnchor={anchor} fontSize={12} fontWeight={700} fill="var(--court-line)" style={{ fontFamily: 'var(--font-body)' }}>{poleLabel}</text>
            <text x={lx} y={ly + 12} textAnchor={anchor} fontSize={12} fill={color} style={{ fontFamily: 'var(--font-mono)' }}>{strength}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---- 進捗リング(精度・得点率など1値を大きく) ---- */
export function Ring({ value, center, sub, color = 'var(--accent)', size = 96, track = 'var(--grid)' }: {
  value: number; center: ReactNode; sub?: string; color?: string; size?: number; track?: string;
}) {
  const sw = Math.max(7, size * 0.1);
  const r = (size - sw) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const mounted = useMounted();
  const v = mounted ? Math.max(0, Math.min(1, value)) : 0; // 0から走査して埋まる
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={sw} />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - v)}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
        <span className="mono" style={{ fontSize: size * 0.27, fontWeight: 700, color: 'var(--court-line)' }}>{center}</span>
        {sub && <span className="mono" style={{ fontSize: 10, color: 'var(--line-dim)' }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ---- 横バー(サーブ別得点率・項目比較など) ---- */
export interface BarItem { label: string; value: number; count: number; sub?: string; }
export function StatBars({ items, color = 'var(--accent)', emptyLabel = 'データなし' }: {
  items: BarItem[]; color?: string; emptyLabel?: string;
}) {
  const mounted = useMounted();
  if (items.length === 0) return <p className="small muted">{emptyLabel}</p>;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {items.map((it, i) => {
        const pct = Math.round(Math.max(0, Math.min(1, it.value)) * 100);
        return (
          <div key={it.label}>
            <div className="spread" style={{ marginBottom: 3 }}>
              <span className="small" style={{ fontWeight: 700 }}>
                {it.label}{it.sub && <span className="muted" style={{ fontWeight: 400 }}> {it.sub}</span>}
              </span>
              <span className="mono small">
                {pct}% <span className="muted" style={{ fontSize: 11 }}>[{it.count}]</span>
              </span>
            </div>
            <div style={{ height: 9, borderRadius: 'var(--radius-pill)', background: 'var(--grid)', overflow: 'hidden' }}>
              <div style={{
                width: mounted ? `${pct}%` : '0%', height: '100%', background: color, borderRadius: 'var(--radius-pill)',
                transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)', transitionDelay: `${i * 0.06}s`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- 6分割コート・ヒートマップ(コース別の失点率/得点率) ----
   1=バック前 2=ミドル前 3=フォア前 / 4=バック奥 5=ミドル奥 6=フォア奥 */
export interface CourtCell { course: Course; rate: number; count: number; }
export function CourtHeatmap({ cells, kind = 'loss' }: {
  cells: CourtCell[]; kind?: 'loss' | 'win';
}) {
  const map = new Map(cells.map((c) => [c.course, c]));
  const baseRGB = kind === 'loss' ? '211,74,82' : '31,157,98'; // --neg / --pos
  const order: Course[] = [1, 2, 3, 4, 5, 6];
  const colLabels = ['バック', 'ミドル', 'フォア'];
  return (
    <div>
      <div className="row" style={{ gap: 6, marginBottom: 4 }}>
        <span className="small muted" style={{ width: 26 }} />
        {colLabels.map((l) => <span key={l} className="small muted" style={{ flex: 1, textAlign: 'center' }}>{l}</span>)}
      </div>
      {[0, 1].map((row) => (
        <div key={row} className="row" style={{ gap: 6, marginBottom: 6 }}>
          <span className="small muted" style={{ width: 26, textAlign: 'right' }}>{row === 0 ? '前' : '奥'}</span>
          {order.slice(row * 3, row * 3 + 3).map((course, ci) => {
            const cell = map.get(course);
            const has = cell && cell.count > 0;
            const rate = has ? cell!.rate : 0;
            const op = has ? 0.12 + rate * 0.78 : 0;
            return (
              <div
                key={course}
                className="pop-in"
                style={{
                  flex: 1, aspectRatio: '1.5 / 1', minHeight: 48,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--divider-strong)',
                  background: has ? `rgba(${baseRGB},${op.toFixed(2)})` : 'var(--deep-court)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1.15,
                  animationDelay: `${(row * 3 + ci) * 0.05}s`,
                }}
              >
                {has ? (
                  <>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 16, color: op > 0.5 ? '#fff' : 'var(--court-line)' }}>
                      {Math.round(rate * 100)}%
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: op > 0.5 ? 'rgba(255,255,255,0.85)' : 'var(--line-dim)' }}>
                      [{cell!.count}]
                    </span>
                  </>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>—</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <p className="small muted" style={{ marginTop: 2 }}>
        {kind === 'loss' ? '濃いほど失点が多いコース' : '濃いほど得点率が高いコース'}・各セル[本数]
      </p>
    </div>
  );
}

/* ---- 得点リードの推移(シーケンス図) ----
   ラリーごとの累積リード(自分得点−相手得点)を折れ線で。上=リード(緑)/下=ビハインド(赤)。
   セットの切れ目に縦線。線は左から描かれるアニメーション付き。 */
export function ScoreFlow({ rallies, height = 92 }: { rallies: RallyRow[]; height?: number }) {
  const mounted = useMounted();
  if (rallies.length < 2) return null;
  const W = 320; const H = height; const padX = 8; const padY = 12;
  let lead = 0;
  const seq = rallies.map((r) => { lead += r.winner === 'me' ? 1 : -1; return { lead, set: r.set }; });
  const leads = seq.map((s) => s.lead);
  const maxAbs = Math.max(2, ...leads.map((l) => Math.abs(l)));
  const n = seq.length;
  const xOf = (i: number) => padX + (i * (W - padX * 2)) / (n - 1);
  const yOf = (l: number) => H / 2 - (l / maxAbs) * (H / 2 - padY);
  const points = seq.map((s, i) => [xOf(i), yOf(s.lead)] as const);
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const setTicks: number[] = [];
  for (let i = 1; i < seq.length; i++) if (seq[i].set !== seq[i - 1].set) setTicks.push(i);
  const finalLead = leads[leads.length - 1];
  const color = finalLead >= 0 ? 'var(--pos)' : 'var(--neg)';
  return (
    <div>
      <div className="spread" style={{ marginBottom: 4 }}>
        <span className="small muted">得点リードの推移(上=リード / 下=ビハインド)</span>
        <span className="mono small" style={{ color, fontWeight: 700 }}>{finalLead >= 0 ? `+${finalLead}` : finalLead}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true">
        <line x1={padX} y1={H / 2} x2={W - padX} y2={H / 2} stroke="var(--divider-strong)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        {setTicks.map((i) => (
          <line key={i} x1={xOf(i)} y1={padY} x2={xOf(i)} y2={H - padY} stroke="var(--grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path
          d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={len} strokeDashoffset={mounted ? 0 : len}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <circle cx={points[n - 1][0]} cy={points[n - 1][1]} r={3.5} fill={color} style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease 0.9s' }} />
      </svg>
    </div>
  );
}

/* ---- シーケンス図(番号つきステップ＋縦線。順番にポップイン) ---- */
export interface FlowStep { title: string; sub?: string; }
export function FlowSteps({ steps, color = 'var(--accent)' }: { steps: FlowStep[]; color?: string }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      {steps.map((s, i) => (
        <div
          key={i}
          className="pop-in"
          style={{ animationDelay: `${i * 0.13}s`, display: 'flex', gap: 12, alignItems: 'stretch' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              className="mono"
              style={{
                width: 28, height: 28, borderRadius: '50%', background: color, color: 'var(--accent-contrast)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            {i < steps.length - 1 && (
              <span style={{ flex: 1, width: 2, background: 'var(--divider-strong)', minHeight: 14, marginTop: 2 }} />
            )}
          </div>
          <div style={{ paddingBottom: i < steps.length - 1 ? 14 : 0, paddingTop: 2 }}>
            <p style={{ fontWeight: 700 }}>{s.title}</p>
            {s.sub && <p className="small muted" style={{ marginTop: 1 }}>{s.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- 紙吹雪(祝い演出。relative な親の上に重ねる) ---- */
export function Confetti({ count = 30 }: { count?: number }) {
  if (reduceMotion()) return null;
  const colors = ['var(--accent)', 'var(--pos)', 'var(--warn)', 'var(--omega-gold)', 'var(--neg)'];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${1.2 + Math.random() * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

/** コース番号→ラベル(凡例などで使用) */
export const courtLabel = (c: Course) => COURSE_LABELS[c];
