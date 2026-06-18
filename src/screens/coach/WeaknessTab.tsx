/* ============================================================
   ③ 弱点分析(自分宛)
   実試合で失point しやすいパターンを「状況→経過→失点」のシーケンスで表示。
   代表4パターンを大きく、残りはタグで絞って一覧。各パターンに効く練習へ誘導。
   ※将来、動画解析の実データが入れば発生頻度で並べ替える(現状はカタログ)。
   ============================================================ */
import { useState } from 'react';
import {
  featuredWeaknesses, weaknessesByTag, WEAKNESS_PATTERNS, WEAKNESS_TAGS,
} from '@/domain/coach/weaknesses';
import type { WeaknessPattern, WeaknessTag } from '@/domain/coach/weaknesses';
import { DRILL_CATEGORY_MAP } from '@/domain/coach/drills';
import { Card, SectionLabel } from '@/components/ui';
import { FlowSteps } from '@/components/charts';

const TAG_COLOR: Record<WeaknessTag, string> = {
  レシーブ: 'var(--accent)',
  台上: '#0ea5e9',
  サーブ: '#8b5cf6',
  ラリー: 'var(--warn)',
  フットワーク: '#10b981',
  イレギュラー: 'var(--line-dim)',
};

function TagPill({ tag }: { tag: WeaknessTag }) {
  const c = TAG_COLOR[tag];
  return (
    <span
      className="small"
      style={{
        flexShrink: 0, padding: '1px 9px', borderRadius: 'var(--radius-pill)',
        fontWeight: 700, color: c, border: `1px solid ${c}`,
      }}
    >
      {tag}
    </span>
  );
}

function PatternCard({ w, featured = false }: { w: WeaknessPattern; featured?: boolean }) {
  const drill = DRILL_CATEGORY_MAP[w.relatedDrill];
  return (
    <Card accent={featured}>
      <div className="spread" style={{ gap: 8, alignItems: 'flex-start' }}>
        <strong style={{ fontSize: 15 }}>{w.title}</strong>
        <TagPill tag={w.tag} />
      </div>

      {/* 状況 → 経過 のシーケンス */}
      <div style={{ marginTop: 10 }}>
        <FlowSteps steps={w.steps.map((s) => ({ title: s }))} color="var(--warn)" />
      </div>

      {/* 失点局面 */}
      <div
        className="row"
        style={{
          gap: 8, marginTop: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
          background: 'var(--neg-soft)', border: '1px solid var(--neg)',
        }}
      >
        <span style={{ color: 'var(--neg)', fontWeight: 700, flexShrink: 0 }}>✗ 失点</span>
        <span className="small" style={{ color: 'var(--neg)' }}>{w.missPoint}</span>
      </div>

      {/* 効く練習 */}
      <p className="small muted" style={{ marginTop: 8 }}>
        効く練習: <b style={{ color: 'var(--court-line)' }}>{drill.label}</b> — {drill.aim}
      </p>
    </Card>
  );
}

export default function WeaknessTab() {
  const [tag, setTag] = useState<WeaknessTag | 'all'>('all');
  const featured = featuredWeaknesses();
  const rest = WEAKNESS_PATTERNS.filter((w) => !w.featured);
  const shownRest = tag === 'all' ? rest : weaknessesByTag(tag).filter((w) => !w.featured);

  return (
    <div className="stack">
      <Card>
        <SectionLabel>よくある失点パターン</SectionLabel>
        <p className="small muted">
          試合で崩れやすい形を、起こる順に並べています。まずは代表の4つから。
          動画を取り込むと、あなたの<b>実際の発生回数</b>で並べ替わります。
        </p>
      </Card>

      {/* 代表4パターン */}
      {featured.map((w) => <PatternCard key={w.id} w={w} featured />)}

      {/* 残り(タグで絞り込み) */}
      <Card>
        <SectionLabel>ほかの失点パターン</SectionLabel>
        <div className="chip-scroll" style={{ margin: '2px 0 4px' }}>
          {(['all', ...WEAKNESS_TAGS] as const).map((t) => {
            const active = t === tag;
            return (
              <button
                key={t}
                className="btn"
                onClick={() => setTag(t)}
                style={{
                  minHeight: 30, padding: '2px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0,
                  borderColor: active ? 'var(--accent)' : undefined,
                  background: active ? 'var(--accent-faint)' : undefined,
                  color: active ? 'var(--accent)' : undefined,
                }}
              >
                {t === 'all' ? 'すべて' : t}
              </button>
            );
          })}
        </div>
      </Card>

      {shownRest.map((w) => <PatternCard key={w.id} w={w} />)}
    </div>
  );
}
