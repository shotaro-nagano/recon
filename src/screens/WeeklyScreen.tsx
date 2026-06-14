/* ============================================================
   週次モード画面 — 練習メニュー / 解消報告 / 軸スコア推移 /
   自己認識ギャップ / β確認 / シーズンオフ切替
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { selectApproved, todayStr, useAppStore } from '@/store/useAppStore';
import { AXIS_INFO } from '@/domain/constants';
import { axisTrend } from '@/domain/insights';
import { voice } from '@/domain/persona';
import { fmtDiff } from '@/domain/stats';
import { computeTypeResult, isBeta, selfGap } from '@/domain/typeEngine';
import {
  buildWeeklyMenu, recentApprovedWithinDays, type MenuGranularity, type WeeklyMenuItem,
} from '@/domain/coach/weekly';
import {
  Card, EmptyState, Screen, SectionLabel, Segmented, Sparkline, TypeBadge,
} from '@/components/ui';
import type { AxisKey, PracticeLogEntry, TypeHistoryEntry } from '@/domain/types';

const GRAN_OPTIONS: { value: MenuGranularity; label: string }[] = [
  { value: 'がっちり', label: 'がっちり(本数まで)' },
  { value: 'ふわっと', label: 'ふわっと(テーマのみ)' },
];

/* ---- 練習メニュー1項目 ---- */
function MenuItemRow({ item }: { item: WeeklyMenuItem }) {
  return (
    <div>
      {item.priority > 1 && <hr className="divider" style={{ margin: '10px 0' }} />}
      <div className="row">
        <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{item.priority}.</span>
        <strong>{item.title}</strong>
      </div>
      <p className="small" style={{ marginTop: 2 }}>{item.prescription}</p>
      <p className="small muted" style={{ marginTop: 2 }}>
        根拠({item.basisKind}): {item.basis} <span className="mono">{item.stat}</span>
      </p>
    </div>
  );
}

/* ---- 練習ログ(シーズンオフ・試合なし週のフォールバック) ---- */
function PracticeLogCard({ log }: { log: PracticeLogEntry[] }) {
  const asc = useMemo(() => [...log].sort((a, b) => (a.date > b.date ? 1 : -1)), [log]);
  if (asc.length === 0) {
    return (
      <Card>
        <SectionLabel>練習ログ</SectionLabel>
        <EmptyState
          title="練習ログがまだない"
          hint="ドリルの成功率を記録すると、ここに推移が表示される"
        />
      </Card>
    );
  }
  const values = asc.map((e) => e.successRate * 100);
  const latest = asc[asc.length - 1];
  const recent = [...asc].reverse().slice(0, 5);
  return (
    <Card>
      <SectionLabel>練習ログ — 成功率の推移</SectionLabel>
      <div className="row" style={{ gap: 12 }}>
        <Sparkline values={values} />
        <span className="mono small">
          {Math.round(latest.successRate * 100)}%[{asc.length}回]
        </span>
      </div>
      <div className="stack" style={{ gap: 4, marginTop: 8 }}>
        {recent.map((e) => (
          <div key={e.id} className="spread small">
            <span className="muted">
              <span className="mono">{e.date}</span> {e.drill}
            </span>
            <span className="mono">{Math.round(e.successRate * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>※練習ログはタイプ計算には不使用。</p>
    </Card>
  );
}

export default function WeeklyScreen() {
  const settings = useAppStore((s) => s.settings);
  const diagnosis = useAppStore((s) => s.diagnosis);
  const karte = useAppStore((s) => s.karte);
  const approved = useAppStore(selectApproved);
  const setSettings = useAppStore((s) => s.setSettings);
  const appendSession = useAppStore((s) => s.appendSession);

  const [betaAnswer, setBetaAnswer] = useState<'ok' | 'ng' | null>(null);

  const today = todayStr();
  const recent7 = useMemo(() => recentApprovedWithinDays(approved, today), [approved, today]);
  const granularity = settings.menuGranularity;
  const menu = useMemo(
    () => buildWeeklyMenu(recent7, karte, granularity),
    [recent7, karte, granularity],
  );
  const typeResult = useMemo(
    () => computeTypeResult(approved, diagnosis, settings, today),
    [approved, diagnosis, settings, today],
  );
  const trend = useMemo(() => axisTrend(approved).slice(-10), [approved]);
  const gap = useMemo(() => selfGap(diagnosis, typeResult), [diagnosis, typeResult]);
  const beta = isBeta(settings, today);
  const resolved = karte.tendencies.filter((t) => t.status === 'resolved');
  const pendingAssignments = karte.assignments.filter((a) => a.status === '検証待ち');

  // タイプ遷移(直近2エントリが異なれば祝う)
  const transition = useMemo((): { from: TypeHistoryEntry; to: TypeHistoryEntry } | null => {
    const th = karte.typeHistory;
    if (th.length < 2) return null;
    const from = th[th.length - 2];
    const to = th[th.length - 1];
    return from.codename !== to.codename || from.variant !== to.variant ? { from, to } : null;
  }, [karte.typeHistory]);

  // セッションログは表示につき1回だけ
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    appendSession({
      date: today,
      mode: '週次',
      summary: settings.offseason
        ? `週次レポート(シーズンオフ): 練習ログ${karte.practiceLog.length}件を確認`
        : `週次レポート: 直近7日の試合${recent7.length}件 / メニュー${menu.length}項目(${granularity})`,
    });
  }, [appendSession, today, settings.offseason, karte.practiceLog.length, recent7.length, menu.length, granularity]);

  const nothing =
    approved.length === 0 && karte.practiceLog.length === 0 &&
    menu.length === 0 && resolved.length === 0;

  return (
    <Screen title="週次レポート">
      <p className="small muted">{voice(settings.persona)('weekly')}</p>

      {nothing ? (
        <EmptyState
          title="まだ週次で振り返るデータがない"
          hint="試合データを承認すると、練習メニューと軸スコアの推移がここに表示される"
          action={<Link className="btn btn-primary" to="/matches">試合データを取り込む</Link>}
        />
      ) : settings.offseason ? (
        <>
          {/* ---- シーズンオフ: 練習ログ中心 ---- */}
          <Card accent>
            <SectionLabel>シーズンオフモード</SectionLabel>
            <p className="small">
              試合がない期間のため、練習ログ中心で振り返る。タイプ・軸スコアはシーズン再開後の承認試合で更新される。
            </p>
          </Card>
          <PracticeLogCard log={karte.practiceLog} />
          <Card>
            <SectionLabel>シーズン再開時に検証すべき項目</SectionLabel>
            {pendingAssignments.length === 0 ? (
              <p className="small muted">検証待ちの項目はない。試合後モードで課題を追加すると、ここに並ぶ。</p>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {pendingAssignments.map((a) => (
                  <div key={a.id} className="spread small">
                    <span>{a.menu}</span>
                    <span className="mono muted">{a.date}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          {/* ---- 通常週: 練習メニュー ---- */}
          {recent7.length === 0 && (
            <Card>
              <p className="small muted">
                直近7日に承認済みの試合がない。今週は練習ログとカルテの課題を中心に振り返る。
              </p>
            </Card>
          )}
          <Card>
            <SectionLabel>今週の練習メニュー(優先順・3つまで)</SectionLabel>
            <div className="spread" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="small muted">粒度</span>
              <Segmented
                options={GRAN_OPTIONS}
                value={granularity}
                onChange={(v) => setSettings({ menuGranularity: v })}
              />
            </div>
            {menu.length === 0 ? (
              <EmptyState
                title="メニューを組む材料がまだ足りない"
                hint="試合を取り込んで承認すると、課題からメニューを生成できる"
                action={<Link className="btn" to="/matches">試合データを取り込む</Link>}
              />
            ) : (
              menu.map((item) => <MenuItemRow key={item.priority} item={item} />)
            )}
          </Card>
          {recent7.length === 0 && <PracticeLogCard log={karte.practiceLog} />}
        </>
      )}

      {/* ---- 解消報告(成果の見える化) ---- */}
      {resolved.length > 0 && (
        <Card>
          <SectionLabel>解消報告 — 消えた弱点</SectionLabel>
          <div className="stack" style={{ gap: 8 }}>
            {resolved.map((t) => (
              <div key={t.id} className="small">
                <div>
                  {t.text} <span className="mono muted">[{t.pt}pt]</span>
                </div>
                <div className="muted">
                  解消日 <span className="mono">{t.resolvedAt ?? '—'}</span>
                  {t.resolvedBy && <> / 効いた練習: {t.resolvedBy}</>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---- 軸スコア推移 ---- */}
      {trend.length > 0 && typeResult.axes.length > 0 && (
        <Card>
          <SectionLabel>軸スコア推移(承認試合ごと)</SectionLabel>
          <div className="stack">
            {(Object.keys(AXIS_INFO) as AxisKey[]).map((k) => {
              const info = AXIS_INFO[k];
              const series = trend.map((p) => p.axes.find((a) => a.axis === k)?.score ?? 50);
              const latest = typeResult.axes.find((a) => a.axis === k);
              return (
                <div key={k} className="spread" style={{ flexWrap: 'wrap' }}>
                  <div>
                    <div className="small">{info.label}</div>
                    <div className="small muted">{info.loLabel} ←→ {info.hiLabel}</div>
                  </div>
                  <div className="row">
                    <Sparkline values={series} />
                    <span className="mono small muted">
                      {latest ? `${latest.score.toFixed(0)} [${latest.pt}pt]` : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {trend.length === 1 && (
            <p className="small muted" style={{ marginTop: 8 }}>承認試合が増えると推移が線になる。</p>
          )}
          {transition && (
            <>
              <hr className="divider-strong" style={{ margin: '12px 0' }} />
              <SectionLabel>タイプ遷移</SectionLabel>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <span className="muted small">
                  {transition.from.codename}-{transition.from.variant === 'omega' ? 'Ω' : 'α'}
                </span>
                <span className="muted">→</span>
                <TypeBadge codename={transition.to.codename} variant={transition.to.variant} />
              </div>
              <p className="small" style={{ marginTop: 4 }}>
                プレースタイルの変化が実データに表れた。成長の証 — カルテは新しい型で育っていく。
              </p>
            </>
          )}
        </Card>
      )}

      {/* ---- 自己認識ギャップ ---- */}
      {gap && (
        <Card>
          <SectionLabel>自己認識ギャップ(競り合い)</SectionLabel>
          <div className="small stack" style={{ gap: 4 }}>
            <div className="spread">
              <span className="muted">自己評価(診断Q3)</span>
              <span className="mono">{gap.selfRating}/5</span>
            </div>
            <div className="spread">
              <span className="muted">実測クラッチ差</span>
              <span className="mono">
                {typeResult.clutch
                  ? fmtDiff(typeResult.clutch.diff, typeResult.clutch.pt, typeResult.clutch.ci)
                  : '実測データ待ち'}
              </span>
            </div>
          </div>
          <p className="small" style={{ marginTop: 8 }}>{gap.text}</p>
        </Card>
      )}

      {/* ---- β校正期間の実感確認 ---- */}
      {beta && (
        <Card accent>
          <SectionLabel>β校正中 — 実感の確認</SectionLabel>
          {betaAnswer === null ? (
            <>
              <p className="small" style={{ marginBottom: 12 }}>
                いまのタイプ判定は、自分の実感と合っている?(回答は校正に使う)
              </p>
              <div className="row">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setBetaAnswer('ok');
                    appendSession({ date: today, mode: '週次', summary: 'β確認: タイプ判定は実感と合っている' });
                  }}
                >
                  合っている
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setBetaAnswer('ng');
                    appendSession({ date: today, mode: '週次', summary: 'β確認: タイプ判定が実感とズレている(校正に利用)' });
                  }}
                >
                  ズレている
                </button>
              </div>
            </>
          ) : (
            <p className="small muted">
              {betaAnswer === 'ok'
                ? '回答を記録した。引き続きこの判定で運用する。'
                : '回答を記録した。承認試合が増えるほど判定は実態に寄っていく。'}
            </p>
          )}
        </Card>
      )}
    </Screen>
  );
}
