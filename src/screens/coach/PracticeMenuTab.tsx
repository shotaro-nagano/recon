/* ============================================================
   ① 練習メニュー
   ユーザーは「強み(strong)/弱点(weak)」を選ぶだけ。選択は裏DBに記録し、
   選択に応じて優先順位付きの練習メニュー(7カテゴリ×ドリル)を提示する。
   ============================================================ */
import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { buildPracticeMenu, FOCUS_LABEL } from '@/domain/coach/drills';
import type { PracticeFocus } from '@/domain/coach/drills';
import { Card, Collapsible, SectionLabel } from '@/components/ui';

const FOCUS_OPTS: { key: PracticeFocus; emoji: string; sub: string }[] = [
  { key: 'strong', emoji: '🔥', sub: '武器をさらに鋭く' },
  { key: 'weak', emoji: '🛡️', sub: '崩れる所をなくす' },
];

function PriorityPill({ n }: { n: number }) {
  const color = n === 1 ? 'var(--accent)' : n <= 3 ? 'var(--pos)' : 'var(--line-dim)';
  return (
    <span
      className="small"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: '1px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 700,
        color, border: `1px solid ${color}`,
      }}
    >
      {n === 1 ? '最優先' : `優先 ${n}`}
    </span>
  );
}

export default function PracticeMenuTab() {
  const recordPracticeFocus = useAppStore((s) => s.recordPracticeFocus);
  // 既定で弱点メニューを表示(「メニューを出すだけ」= 入力不要)。選択で切替＋裏DB記録。
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
                className="card"
                onClick={() => choose(o.key)}
                aria-pressed={active}
                style={{
                  flex: 1, textAlign: 'center', cursor: 'pointer', color: 'var(--court-line)',
                  borderColor: active ? 'var(--accent)' : undefined,
                  background: active ? 'var(--accent-faint)' : undefined,
                }}
              >
                <div style={{ fontSize: 30, lineHeight: 1.1 }}>{o.emoji}</div>
                <strong style={{ display: 'block', marginTop: 6 }}>{FOCUS_LABEL[o.key]}</strong>
                <span className="small muted">{o.sub}</span>
              </button>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {recorded
            ? <span style={{ color: 'var(--pos)', fontWeight: 700 }}>✓ 「{FOCUS_LABEL[focus]}」で記録しました</span>
            : 'タップすると選択が記録され、メニューが切り替わります(入力はこれだけ)。'}
        </p>
      </Card>

      {/* 優先度付きメニュー */}
      {menu.map((sec) => (
        <Card key={sec.category.key} accent={sec.priority === 1}>
          <div className="spread" style={{ gap: 10, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="display" style={{ fontSize: 16, color: 'var(--accent)' }}>{sec.category.label}</h2>
              <p className="small muted" style={{ marginTop: 2 }}>{sec.reason}</p>
            </div>
            <PriorityPill n={sec.priority} />
          </div>

          {/* まず取り組む(上位3) */}
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {sec.recommended.map((d, i) => (
              <div key={d.name} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
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
