/* ============================================================
   ② 戦術アドバイス(試合前)
   A. 相手分析 — 相手を選ぶとカルテから5項目の戦術カードを生成(preMatch.ts)
   B. 汎用戦術 — 50枚の戦術カード。カテゴリ絞り込み + 「戦術のみ/理由つき」切替
   読みやすさ最優先のため A は .tactical-root(アニメ無効・本文16px)。
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { computeTypeResult } from '@/domain/typeEngine';
import { serveStats } from '@/domain/insights';
import { matchup } from '@/domain/compatibility';
import { buildTacticalCard } from '@/domain/coach/preMatch';
import type { TacticalMode } from '@/domain/coach/preMatch';
import {
  recommendedTactics, tacticsByCategory, TACTIC_CATEGORIES,
} from '@/domain/coach/tactics';
import type { TacticCategory } from '@/domain/coach/tactics';
import { Card, CourseBadge, SectionLabel, TypeBadge } from '@/components/ui';

type Selection =
  | { kind: 'opponent'; id: string }
  | { kind: 'firstTime' }
  | { kind: 'minimal' };

const CIRCLED = ['①', '②', '③', '④', '⑤'];
type CatFilter = 'おすすめ' | TacticCategory;

/* ---- A. 相手分析(戦術カード) ---- */
function OpponentTactics() {
  const matches = useAppStore((s) => s.matches);
  const opponents = useAppStore((s) => s.opponents);
  const diagnosis = useAppStore((s) => s.diagnosis);
  const settings = useAppStore((s) => s.settings);
  const karte = useAppStore((s) => s.karte);
  const appendSession = useAppStore((s) => s.appendSession);

  const [selection, setSelection] = useState<Selection | null>(null);
  const logged = useRef(false);

  const approved = useMemo(() => matches.filter((m) => m.approved), [matches]);
  const typeResult = useMemo(
    () => computeTypeResult(approved, diagnosis, settings, todayStr()),
    [approved, diagnosis, settings],
  );
  const serves = useMemo(() => serveStats(approved), [approved]);

  const card = useMemo(() => {
    if (!selection) return null;
    const opponent =
      selection.kind === 'opponent' ? opponents.find((o) => o.id === selection.id) ?? null : null;
    const mu =
      opponent?.provisionalCodename && typeResult.codename && typeResult.variant
        ? matchup(
            { codename: typeResult.codename, variant: typeResult.variant },
            { codename: opponent.provisionalCodename, variant: opponent.provisionalVariant },
            { matches, opponents },
          )
        : null;
    const mode: TacticalMode | undefined =
      selection.kind === 'firstTime' ? 'firstTime'
        : selection.kind === 'minimal' ? 'minimal' : undefined;
    return buildTacticalCard(typeResult, karte, serves, opponent, mu, mode);
  }, [selection, opponents, typeResult, karte, serves, matches]);

  useEffect(() => {
    if (!card || logged.current) return;
    logged.current = true;
    appendSession({ date: todayStr(), mode: '試合前', summary: card.summary });
  }, [card, appendSession]);

  // 入口: 相手選択
  if (!card) {
    return (
      <Card>
        <SectionLabel>相手に合わせた作戦</SectionLabel>
        <p className="small muted" style={{ marginBottom: 10 }}>相手を選ぶと、5項目の戦術カードを出します。</p>
        <div className="stack" style={{ gap: 8 }}>
          {opponents.map((o) => (
            <button
              key={o.id}
              className="btn"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={() => setSelection({ kind: 'opponent', id: o.id })}
            >
              <span>{o.name}{o.affiliation ? `(${o.affiliation})` : ''}</span>
              {o.provisionalCodename && (
                <span className="mono" style={{ fontSize: 13 }}>
                  {o.provisionalCodename}
                  {o.provisionalVariant === 'omega' ? '-Ω' : o.provisionalVariant === 'alpha' ? '-α' : ''}
                </span>
              )}
            </button>
          ))}
          {opponents.length === 0 && (
            <p className="small muted">登録済みの相手はまだない。試合を取り込むと相手カルテが育つ。</p>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setSelection({ kind: 'firstTime' })}>初見の相手</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => setSelection({ kind: 'minimal' })}>データ最小</button>
          </div>
        </div>
        {typeResult.stage === 'none' && (
          <p className="small muted" style={{ marginTop: 10 }}>
            自分のコードネームが未解析。<Link to="/diagnosis">診断</Link>を受けると相性まで出せる。
          </p>
        )}
      </Card>
    );
  }

  // カード本体(読みやすさ最優先・アニメ無効)
  return (
    <div className="tactical-root">
      <Card>
        <div className="spread">
          <h2 className="display" style={{ fontSize: 18, margin: 0 }}>
            作戦 <span style={{ color: 'var(--accent)' }}>vs {card.opponentLabel}</span>
          </h2>
          <button
            className="btn"
            style={{ minHeight: 32, padding: '2px 10px', fontSize: 13, fontWeight: 400, flexShrink: 0 }}
            onClick={() => setSelection(null)}
          >
            選び直す
          </button>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 14 }}>相手タイプ:</span>
          {card.opponentType ? (
            <>
              <TypeBadge codename={card.opponentType.codename} variant={card.opponentType.variant} />
              <span className="mono" style={{ fontSize: 13 }}>[根拠 {card.opponentType.judgedPt}pt・暫定]</span>
            </>
          ) : (
            <span style={{ fontSize: 14 }}>初見(タイプ不明)</span>
          )}
        </div>

        {card.matchupView && (
          <div className="row" style={{ gap: 6, marginTop: 6, fontSize: 14 }}>
            <span>相性</span>
            <span className="mono" style={{ fontSize: 16 }}>{card.matchupView.symbol}</span>
            <span>{card.matchupView.label}</span>
            <span className="mono">
              {card.matchupView.sampleSize > 0 ? `[対戦${card.matchupView.sampleSize}試合]` : '[理論値]'}
            </span>
          </div>
        )}
        {card.modeNote && <p style={{ fontSize: 13, marginTop: 6 }}>{card.modeNote}</p>}

        <hr className="divider-strong" style={{ margin: '10px 0' }} />

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {card.items.map((it, i) => (
            <li key={it.no}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{CIRCLED[i]}</span>
                <strong style={{ fontSize: 16 }}>{it.title}</strong>
                <span style={{ fontSize: 11, border: '1px solid var(--divider)', borderRadius: 4, padding: '0 6px' }}>{it.kind}</span>
                {it.courses.map((c) => <CourseBadge key={c} course={c} />)}
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.45, margin: '2px 0 0 26px' }}>
                {it.body}
                {it.stat && <> <span className="mono">{it.stat}</span></>}
              </p>
            </li>
          ))}
        </ol>
        <hr className="divider" style={{ margin: '10px 0 6px' }} />
        <p style={{ fontSize: 13 }}>作戦は以上。迷ったら一番自信のあるパターン(⑤)に戻れ。会場で電波がなくても開ける。</p>
      </Card>
    </div>
  );
}

/* ---- B. 汎用戦術カード(カードデッキ・タップで理由が開く) ---- */
const TACTIC_CAT_COLOR: Record<TacticCategory, string> = {
  '序盤・流れ': '#38BDF8',
  'サーブ': '#A78BFA',
  'レシーブ': '#35E6C5',
  '配球・戦術': '#34D399',
  '競り合い・終盤': '#FB7185',
  '守備・粘り': '#FBBF24',
  'メンタル・所作': '#F472B6',
  'フォーム・身体': '#818CF8',
  'ベンチワーク': '#94A3B8',
};

function GeneralTactics() {
  const [cat, setCat] = useState<CatFilter>('おすすめ');
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const cards = cat === 'おすすめ' ? recommendedTactics() : tacticsByCategory(cat);
  const chips: CatFilter[] = ['おすすめ', ...TACTIC_CATEGORIES];
  const allOpen = cards.length > 0 && cards.every((c) => open.has(c.id));

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(cards.map((c) => c.id)));

  return (
    <Card>
      <div className="spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <SectionLabel>勝つための戦術</SectionLabel>
        <button
          className="btn btn-ghost"
          style={{ minHeight: 32, padding: '2px 12px', fontSize: 12, fontWeight: 700 }}
          onClick={toggleAll}
        >
          {allOpen ? 'すべてとじる' : 'すべての理由を見る'}
        </button>
      </div>

      {/* カテゴリチップ(横スクロール) */}
      <div className="chip-scroll" style={{ margin: '4px 0 12px' }}>
        {chips.map((c) => {
          const active = c === cat;
          return (
            <button
              key={c}
              className="btn"
              onClick={() => setCat(c)}
              style={{
                minHeight: 30, padding: '2px 12px', fontSize: 12, fontWeight: 700, flexShrink: 0,
                borderColor: active ? 'var(--accent)' : undefined,
                background: active ? 'var(--accent-faint)' : undefined,
                color: active ? 'var(--accent)' : undefined,
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* カードデッキ */}
      <div className="tactic-deck">
        {cards.map((t) => {
          const color = TACTIC_CAT_COLOR[t.cat];
          const isOpen = open.has(t.id);
          const no = t.id.replace(/\D/g, '').padStart(2, '0');
          return (
            <button
              key={t.id}
              type="button"
              className={`tactic-card${isOpen ? ' open' : ''}`}
              style={{ ['--cat' as string]: color } as React.CSSProperties}
              aria-expanded={isOpen}
              onClick={() => toggle(t.id)}
            >
              <span className="tactic-card-no">{no}</span>
              <span className="tactic-card-cat">
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {t.cat}
              </span>
              <span className="tactic-card-title">{t.title}</span>
              {isOpen && <span className="tactic-card-reason fade-in">{t.reason}</span>}
              <span className="tactic-card-hint">{isOpen ? '▴ とじる' : '▾ 理由を見る'}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export default function TacticsTab() {
  return (
    <div className="stack">
      <OpponentTactics />
      <GeneralTactics />
    </div>
  );
}
