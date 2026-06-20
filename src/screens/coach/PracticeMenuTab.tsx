/* ============================================================
   ① 練習メニュー(ダーク/タクティカル)
   既定で弱点メニューを表示(入力不要)。強み/弱点の選択で切替＋裏DB記録。
   選択に応じて優先順位付きの練習メニュー(7カテゴリ×ドリル)を提示。
   ============================================================ */
import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { buildPracticeMenu, FOCUS_LABEL } from '@/domain/coach/drills';
import type { DrillCategoryKey, PracticeFocus } from '@/domain/coach/drills';
import { Card, Collapsible, SectionLabel } from '@/components/ui';
import { CatIcon, IconStrong, IconWeak } from '@/screens/coach/icons';

const FOCUS_OPTS: { key: PracticeFocus; Icon: (p: { size?: number }) => JSX.Element; sub: string }[] = [
  { key: 'strong', Icon: IconStrong, sub: '武器をさらに鋭く' },
  { key: 'weak', Icon: IconWeak, sub: '崩れる所をなくす' },
];

const CAT_CODE: Record<DrillCategoryKey, string> = {
  multiball: 'MULTI', footwork: 'FOOT', task: 'TASK', serve: 'SERVE',
  receive: 'RECV', overtable: 'TABLE', system: 'SYS',
};

function PriorityPill({ n }: { n: number }) {
  const color = n === 1 ? 'var(--accent)' : n <= 3 ? 'var(--pos)' : 'var(--line-dim)';
  return (
    <span
      className="small mono"
      style={{
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
        padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 700,
        letterSpacing: '0.04em', color, border: `1px solid ${color}`,
        boxShadow: n === 1 ? '0 0 12px rgba(53,230,197,0.25)' : undefined,
      }}
    >
      {n === 1 ? 'P1 · 最優先' : `P${n}`}
    </span>
  );
}

export default function PracticeMenuTab() {
  const recordPracticeFocus = useAppStore((s) => s.recordPracticeFocus);
  const [focus, setFocus] = useState<PracticeFocus>('weak');
  const [recorded, setRecorded] = useState(false);

  const menu = useMemo(() => buildPracticeMenu(focus), [focus]);

  const choose = (f: PracticeFocus) => {
    setFocus(f);
    recordPracticeFocus(f); // 裏DBに記録(設定 > 練習フォーカスの記録 で確認可)
    setRecorded(true);
  };

  return (
    <div className="stack">
      {/* フォーカス選択(操作はこれだけ・タップで記録) */}
      <Card accent>
        <SectionLabel>今日はどっちを鍛える?</SectionLabel>
        <div className="row" style={{ gap: 10 }}>
          {FOCUS_OPTS.map((o) => {
            const active = focus === o.key;
            return (
              <button
                key={o.key}
                className="card focus-card"
                onClick={() => choose(o.key)}
                aria-pressed={active}
                style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '16px 10px' }}
              >
                <span className="focus-ico" style={{ display: 'grid', placeItems: 'center', opacity: active ? 1 : 0.7 }}>
                  <o.Icon size={28} />
                </span>
                <strong style={{ display: 'block', marginTop: 8, color: active ? 'var(--accent)' : 'var(--court-line)' }}>
                  {FOCUS_LABEL[o.key]}
                </strong>
                <span className="small muted">{o.sub}</span>
              </button>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          {recorded
            ? <span style={{ color: 'var(--pos)', fontWeight: 700 }}>✓ 「{FOCUS_LABEL[focus]}」で記録しました</span>
            : 'タップすると選択が記録され、メニューが切り替わります(入力はこれだけ)。'}
        </p>
      </Card>

      {/* 優先度付きメニュー */}
      {menu.map((sec) => (
        <Card key={sec.category.key} accent={sec.priority === 1}>
          <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
            <span className="cat-badge"><CatIcon k={sec.category.key} size={19} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="spread" style={{ gap: 8, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="cat-code">{CAT_CODE[sec.category.key]}</span>
                  <h2 className="display" style={{ fontSize: 16, color: 'var(--accent)' }}>{sec.category.label}</h2>
                </div>
                <PriorityPill n={sec.priority} />
              </div>
              <p className="small muted" style={{ marginTop: 4 }}>{sec.reason}</p>
            </div>
          </div>

          {/* まず取り組む(上位3) */}
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {sec.recommended.map((d, i) => (
              <div key={d.name} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>{d.name}</strong>
                  <p className="small muted" style={{ marginTop: 1 }}>{d.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 残りのドリル */}
          {sec.category.drills.length > sec.recommended.length && (
            <div style={{ marginTop: 10 }}>
              <Collapsible
                title={`${sec.category.label}のメニュー`}
                openLabel={`このカテゴリのドリルをすべて見る(${sec.category.drills.length}種)`}
                closeLabel="とじる"
              >
                <div className="stack" style={{ gap: 8 }}>
                  {sec.category.drills.slice(sec.recommended.length).map((d) => (
                    <div key={d.name}>
                      <strong style={{ fontSize: 14 }}>{d.name}</strong>
                      <p className="small muted" style={{ marginTop: 1 }}>{d.detail}</p>
                    </div>
                  ))}
                </div>
              </Collapsible>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
