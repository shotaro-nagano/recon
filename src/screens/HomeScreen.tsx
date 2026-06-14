/* ============================================================
   ホーム — 選手の「現在地」
   エンブレム+コードネーム / 精度メーター / 要確認 / 未承認試合 /
   軸スコア / 次のアクション(最大3つ・優先順位つき)
   ============================================================ */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { computeTypeResult } from '@/domain/typeEngine';
import { AXIS_INFO, MEASURED_MIN_MATCHES } from '@/domain/constants';
import {
  ApprovalCard, AxisBar, Card, EmptyState, Screen, SectionLabel, TypeBadge, codenameDesc,
} from '@/components/ui';
import Emblem from '@/components/Emblem';
import PrecisionMeter from '@/components/PrecisionMeter';

export default function HomeScreen() {
  const diagnosis = useAppStore((s) => s.diagnosis);
  const settings = useAppStore((s) => s.settings);
  const matches = useAppStore((s) => s.matches);
  const approvals = useAppStore((s) => s.approvals);
  const karte = useAppStore((s) => s.karte);
  const resolveApproval = useAppStore((s) => s.resolveApproval);
  const loadDemo = useAppStore((s) => s.loadDemo);

  const today = todayStr();
  // selectApproved / selectPendingMatches / selectPendingApprovals と同義
  // (selector内で新配列を返すと毎回再描画になるため useMemo で派生)
  const approved = useMemo(() => matches.filter((m) => m.approved), [matches]);
  const pendingMatches = useMemo(() => matches.filter((m) => !m.approved), [matches]);
  const pendingApprovals = useMemo(() => approvals.filter((a) => a.status === 'pending'), [approvals]);

  const result = useMemo(
    () => computeTypeResult(approved, diagnosis, settings, today),
    [approved, diagnosis, settings, today],
  );

  const remaining = Math.max(0, MEASURED_MIN_MATCHES - result.matchCount);
  const isEmpty = !diagnosis && matches.length === 0;

  // 今週(直近7日)の試合数
  const weekCount = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    const weekStart = d.toISOString().slice(0, 10);
    return matches.filter((m) => m.date >= weekStart && m.date <= today).length;
  }, [matches, today]);

  const pendingAssignment = karte.assignments.find((a) => a.status === '検証待ち');

  // 次のアクション(最大3つ・優先順位順)
  const actions: { key: string; text: ReactNode; to: string; cta: string }[] = [];
  if (result.stage === 'none') {
    actions.push({
      key: 'diagnosis',
      text: <>コードネーム診断がまだです(約2分・7問)</>,
      to: '/diagnosis',
      cta: '診断を受ける',
    });
  }
  if (pendingAssignment) {
    actions.push({
      key: 'assignment',
      text: <>検証待ちの練習課題: {pendingAssignment.menu}</>,
      to: '/karte',
      cta: 'カルテで確認',
    });
  }
  if (weekCount > 0) {
    actions.push({
      key: 'week',
      text: <>今週の試合 <span className="mono">{weekCount}</span>件 — 振り返りで気づきをカルテに残そう</>,
      to: '/coach/post',
      cta: '振り返りをする',
    });
  } else {
    actions.push({
      key: 'week',
      text: <>今週の試合記録は <span className="mono">0</span>件 — 試合データを取り込もう</>,
      to: '/matches',
      cta: '試合を取り込む',
    });
  }
  actions.push({
    key: 'coach',
    text: <>コーチと話す(試合前 / 試合後 / 週次)</>,
    to: '/coach',
    cta: 'コーチを開く',
  });
  const topActions = actions.slice(0, 3);

  return (
    <Screen title="ホーム" right={<span className="mono small muted">{today}</span>}>
      {/* ---- エンブレム+コードネーム(アプリの顔) ---- */}
      <Card>
        <div
          className="stack"
          style={{ alignItems: 'center', textAlign: 'center', gap: 16, padding: '32px 12px' }}
        >
          <Emblem
            codename={result.codename}
            variant={result.variant}
            stage={result.stage}
            size={120}
          />

          {result.stage === 'none' && (
            <>
              <p className="display" style={{ fontSize: 20 }}>CODENAME 未解析</p>
              <p className="small muted" style={{ maxWidth: 340 }}>
                診断を受けてコードネームを解析しよう。約2分・7問で仮タイプが点灯します。
              </p>
              <Link to="/diagnosis" className="btn btn-primary">診断を受ける</Link>
            </>
          )}

          {result.stage === 'provisional' && result.codename && (
            <>
              <span className="small muted">仮タイプ — 診断による暫定判定</span>
              <TypeBadge codename={result.codename} variant={result.variant} beta={result.beta} />
              <p className="small muted" style={{ maxWidth: 340 }}>{codenameDesc(result.codename)}</p>
              <p className="small">
                実測まであと<span className="mono" style={{ color: 'var(--accent)' }}>{remaining}</span>試合
                (承認済み <span className="mono">{result.matchCount}</span>/<span className="mono">{MEASURED_MIN_MATCHES}</span>)
              </p>
            </>
          )}

          {result.stage === 'measured' && result.codename && (
            <>
              <span className="small muted">
                実測タイプ — 承認済み<span className="mono">{result.matchCount}</span>試合
                ・<span className="mono">{result.totalPt}</span>ptから判定
              </span>
              <TypeBadge
                codename={result.codename}
                variant={result.variant}
                beta={result.beta}
                boundaryWith={result.boundaryWith}
              />
              <p className="small muted" style={{ maxWidth: 340 }}>{codenameDesc(result.codename)}</p>
              {result.boundaryWith && (
                <p className="small muted" style={{ maxWidth: 340 }}>
                  境界帯のため {result.boundaryWith} の特徴も併せ持つ複合判定です
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      {/* ---- 精度メーター ---- */}
      <Card>
        <PrecisionMeter result={result} />
      </Card>

      {/* ---- 要確認(二層承認) ---- */}
      {pendingApprovals.map((a) => (
        <ApprovalCard key={a.id} approval={a} onResolve={resolveApproval} />
      ))}

      {/* ---- 未承認の試合 ---- */}
      {pendingMatches.length > 0 && (
        <Card accent>
          <div className="spread">
            <p>
              承認待ちの試合が<span className="mono">{pendingMatches.length}</span>件あります
            </p>
            <Link to="/matches" className="btn" style={{ flexShrink: 0 }}>内容を確認する</Link>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            承認した試合だけがタイプ判定とカルテの計算に使われます
          </p>
        </Card>
      )}

      {/* ---- 軸スコア(データがある時のみ) ---- */}
      {result.stage !== 'none' && result.axes.length > 0 && (
        <Card>
          <SectionLabel>軸スコア</SectionLabel>
          <div className="stack" style={{ gap: 16 }}>
            {result.axes.map((a) => {
              const info = AXIS_INFO[a.axis];
              return (
                <AxisBar
                  key={a.axis}
                  label={info.label}
                  loLabel={info.loLabel}
                  hiLabel={info.hiLabel}
                  score={a.score}
                  ci={a.ci}
                  pt={a.pt}
                  boundary={a.boundary}
                />
              );
            })}
          </div>
          {result.stage === 'provisional' && (
            <p className="small muted" style={{ marginTop: 12 }}>
              承認済み試合からの暫定値です。データが増えると±が縮みます
            </p>
          )}
        </Card>
      )}

      {/* ---- 診断済みだが試合データ0件 → 誘い ---- */}
      {result.stage !== 'none' && result.axes.length === 0 && (
        <Card>
          <EmptyState
            title="軸スコアはまだ計測できません"
            hint="試合データを取り込んで承認すると、4軸のスコアが見えてきます"
            action={<Link to="/matches" className="btn btn-primary">試合を取り込む</Link>}
          />
        </Card>
      )}

      {/* ---- 次のアクション ---- */}
      <Card>
        <SectionLabel>次のアクション</SectionLabel>
        <div className="stack">
          {topActions.map((a, i) => (
            <div key={a.key}>
              {i > 0 && <hr className="divider" style={{ marginBottom: 12 }} />}
              <div className="spread">
                <p className="small">
                  <span className="mono muted">{i + 1}.</span> {a.text}
                </p>
                <Link to={a.to} className="btn btn-ghost" style={{ flexShrink: 0 }}>{a.cta}</Link>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ---- データ完全空: デモの誘い(控えめに) ---- */}
      {isEmpty && (
        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-ghost" onClick={loadDemo}>デモデータで試す</button>
          <p className="small muted" style={{ marginTop: 4 }}>
            架空の選手データで画面を一通り確認できます
          </p>
        </div>
      )}
    </Screen>
  );
}
