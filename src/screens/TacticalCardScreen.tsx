/* ============================================================
   試合前モード — 戦術カード(最重要画面)
   スマホで試合直前に見る: スクロールなし1画面・5項目・アニメ完全禁止。
   .tactical-root が全アニメを無効化し本文16px/白文字を保証する。
   生成ロジックは domain/coach/preMatch.ts に分離(画面は表示に徹する)。
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { computeTypeResult } from '@/domain/typeEngine';
import { serveStats } from '@/domain/insights';
import { matchup } from '@/domain/compatibility';
import { voice } from '@/domain/persona';
import { buildTacticalCard } from '@/domain/coach/preMatch';
import type { TacticalMode } from '@/domain/coach/preMatch';
import { CourseBadge, TypeBadge } from '@/components/ui';

type Selection =
  | { kind: 'opponent'; id: string }
  | { kind: 'firstTime' }
  | { kind: 'minimal' };

const CIRCLED = ['①', '②', '③', '④', '⑤'];

export default function TacticalCardScreen() {
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
      selection.kind === 'opponent'
        ? opponents.find((o) => o.id === selection.id) ?? null
        : null;
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
        : selection.kind === 'minimal' ? 'minimal'
          : undefined;
    return buildTacticalCard(typeResult, karte, serves, opponent, mu, mode);
  }, [selection, opponents, typeResult, karte, serves, matches]);

  // 表示は1回だけセッションログに残す(ref guard)
  useEffect(() => {
    if (!card || logged.current) return;
    logged.current = true;
    appendSession({ date: todayStr(), mode: '試合前', summary: card.summary });
  }, [card, appendSession]);

  /* ---- 入口: 相手選択 ---- */
  if (!card) {
    return (
      <div className="tactical-root">
        <h1 className="display" style={{ fontSize: 22, margin: '4px 0 12px' }}>戦術カード</h1>
        <p style={{ marginBottom: 12 }}>相手を選ぶとカードを表示する。表示は1画面・5項目に絞ってある。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            <p style={{ fontSize: 14 }}>登録済みの相手カルテはまだない。試合後モードで作成できる。</p>
          )}
          <hr className="divider" style={{ margin: '4px 0' }} />
          <button className="btn" style={{ width: '100%' }} onClick={() => setSelection({ kind: 'firstTime' })}>
            初見の相手(データなし)
          </button>
          <button className="btn" style={{ width: '100%' }} onClick={() => setSelection({ kind: 'minimal' })}>
            データ最小の相手
          </button>
        </div>
        {typeResult.stage === 'none' && (
          <p style={{ fontSize: 14, marginTop: 12 }}>
            自分のコードネームが未解析。<Link to="/diagnosis">診断を受ける</Link>と相性まで出せる。
          </p>
        )}
        <p style={{ fontSize: 12, marginTop: 16 }}>オフライン保存済み — 会場で電波がなくても開けます</p>
      </div>
    );
  }

  /* ---- カード本体(スクロールなし1画面) ---- */
  return (
    <div className="tactical-root" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="spread">
        <h1 className="display" style={{ fontSize: 20, margin: 0 }}>
          戦術カード <span style={{ color: 'var(--accent)' }}>vs {card.opponentLabel}</span>
        </h1>
        <button
          className="btn"
          style={{ minHeight: 32, padding: '2px 10px', fontSize: 13, fontWeight: 400 }}
          onClick={() => setSelection(null)}
        >
          選び直す
        </button>
      </div>

      {/* 相手タイプ + 判定根拠pt */}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 14 }}>相手タイプ:</span>
        {card.opponentType ? (
          <>
            <TypeBadge codename={card.opponentType.codename} variant={card.opponentType.variant} />
            <span className="mono" style={{ fontSize: 14 }}>[判定根拠 {card.opponentType.judgedPt}pt]</span>
            <span style={{ fontSize: 13 }}>※暫定</span>
          </>
        ) : (
          <span style={{ fontSize: 14 }}>初見(タイプ不明)</span>
        )}
      </div>

      {/* 相性 + 理論値/α・Ω注記(matchup().notes) */}
      {card.matchupView && (
        <div style={{ fontSize: 14 }}>
          <div className="row" style={{ gap: 6 }}>
            <span>相性</span>
            <span className="mono" style={{ fontSize: 16 }}>{card.matchupView.symbol}</span>
            <span>{card.matchupView.label}</span>
            <span className="mono">
              {card.matchupView.sampleSize > 0 ? `[対戦${card.matchupView.sampleSize}試合]` : '[理論値]'}
            </span>
          </div>
          {card.matchupView.notes.map((n) => (
            <div key={n} style={{ fontSize: 13 }}>※ {n}</div>
          ))}
        </div>
      )}
      {card.modeNote && <p style={{ fontSize: 13 }}>{card.modeNote}</p>}

      <hr className="divider-strong" />

      {/* ①〜⑤(冒頭の数語で意味が取れる見出し+本文16px) */}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {card.items.map((it, i) => (
          <li key={it.no}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{CIRCLED[i]}</span>
              <strong style={{ fontSize: 16 }}>{it.title}</strong>
              <span style={{ fontSize: 11, border: '1px solid var(--divider)', borderRadius: 4, padding: '0 6px' }}>
                {it.kind}
              </span>
              {it.courses.map((c) => <CourseBadge key={c} course={c} />)}
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.45, margin: '2px 0 0 26px' }}>
              {it.body}
              {it.stat && <> <span className="mono">{it.stat}</span></>}
            </p>
          </li>
        ))}
      </ol>

      <hr className="divider" />
      <p style={{ fontSize: 14 }}>{voice(settings.persona)('preMatch')}</p>
      <p style={{ fontSize: 12 }}>オフライン保存済み — 会場で電波がなくても開けます</p>
    </div>
  );
}
