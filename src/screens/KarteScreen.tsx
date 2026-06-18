/* ============================================================
   KarteScreen — 自分カルテ(選手カルテの全セクション閲覧+最小限の編集)
   編集はすべて updateKarte(reason, mutate) 経由 = スナップショット付き
   ============================================================ */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayStr, uid, useAppStore } from '@/store/useAppStore';
import { computeTypeResult, selfGap } from '@/domain/typeEngine';
import { courseLossStats, serveStats } from '@/domain/insights';
import { fmtDiff, fmtRate } from '@/domain/stats';
import { COURSE_LABELS, MEASURED_MIN_MATCHES } from '@/domain/constants';
import type { CollapseLoop, TendencyEntry } from '@/domain/types';
import {
  Card, Collapsible, EmptyState, Screen, SectionLabel, Sparkline, TypeBadge,
} from '@/components/ui';
import { CourtHeatmap, RadarChart, StatBars } from '@/components/charts';
import { typeColor } from '@/domain/accent';

/* ---- 小さな表示部品 ---- */

function tendencyValue(t: TendencyEntry): string {
  return t.value != null ? fmtRate(t.value, t.pt, t.ci) : `[${t.pt}pt]`;
}

const flowBox: React.CSSProperties = {
  border: '1px solid var(--divider)',
  borderRadius: 'var(--radius)',
  padding: '4px 10px',
  fontSize: 13,
};

/** 崩壊ループ1件: trigger→middle→result の流れを矢印で */
function LoopCard({ loop, index }: { loop: CollapseLoop; index: number }) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <span className="mono" style={{ color: 'var(--accent)', fontSize: 13 }}>R{index + 1}</span>
        <span className="small muted mono">
          {loop.matches > 0
            ? `発生 ${loop.occurrences}回/${loop.matches}試合 ・ 平均失点 ${loop.avgLost.toFixed(1)}点`
            : '手動記録(発生頻度は未集計)'}
        </span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <span className="pop-in" style={{ ...flowBox, animationDelay: '0s' }}>{loop.trigger}</span>
        {loop.middle && (
          <>
            <span aria-hidden="true" className="arrow-flow" style={{ color: 'var(--warn)', fontWeight: 700 }}>→</span>
            <span className="pop-in" style={{ ...flowBox, animationDelay: '0.12s' }}>{loop.middle}</span>
          </>
        )}
        <span aria-hidden="true" className="arrow-flow" style={{ color: 'var(--neg)', fontWeight: 700 }}>→</span>
        <span className="pop-in" style={{ ...flowBox, borderColor: 'var(--neg)', color: 'var(--neg)', fontWeight: 700, animationDelay: '0.24s' }}>{loop.result}</span>
      </div>
      {loop.escapeAction && (
        <p className="small pop-in" style={{ marginTop: 6, animationDelay: '0.36s' }}>
          <span style={{ color: 'var(--pos)', fontWeight: 700 }}>↩ 戻る場所: </span>{loop.escapeAction}
        </p>
      )}
    </div>
  );
}

/** 崩壊ループの手動追加フォーム */
function LoopForm({ onClose }: { onClose: () => void }) {
  const updateKarte = useAppStore((s) => s.updateKarte);
  const [trigger, setTrigger] = useState('');
  const [middle, setMiddle] = useState('');
  const [result, setResult] = useState('');
  const [escape, setEscape] = useState('');
  const canSave = trigger.trim() !== '' && result.trim() !== '';

  const save = () => {
    updateKarte('崩壊ループを手動追加', (k) => {
      k.loops.push({
        id: uid(),
        trigger: trigger.trim(),
        middle: middle.trim(),
        result: result.trim(),
        occurrences: 0,
        matches: 0,
        avgLost: 0,
        escapeAction: escape.trim(),
      });
    });
    onClose();
  };

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <label>きっかけ(trigger)*
        <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="例: 得意サーブを連続で効かれる" />
      </label>
      <label>途中経過(middle)
        <input value={middle} onChange={(e) => setMiddle(e.target.value)} placeholder="例: 焦ってサーブが単調になる" />
      </label>
      <label>結末(result)*
        <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="例: 連続失点でセットを落とす" />
      </label>
      <label>脱出成功時の行動
        <input value={escape} onChange={(e) => setEscape(e.target.value)} placeholder="例: ロングサーブから王道の3球目に戻す" />
      </label>
      {!canSave && (
        <p className="small muted">きっかけと結末が未入力です。両方を入力すると保存できます。</p>
      )}
      <div className="row">
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>ループを追加</button>
        <button className="btn btn-ghost" onClick={onClose}>やめる</button>
      </div>
    </div>
  );
}

/** メモの手動追加フォーム */
function MemoForm({ onClose }: { onClose: () => void }) {
  const updateKarte = useAppStore((s) => s.updateKarte);
  const [text, setText] = useState('');
  const save = () => {
    const t = text.trim();
    if (!t) return;
    updateKarte('コーチングメモを手動追加', (k) => {
      k.memos.push({ id: uid(), date: todayStr(), text: t });
    });
    onClose();
  };
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例: 今週は新しい巻き込みサーブを試している"
      />
      <div className="row">
        <button className="btn btn-primary" disabled={text.trim() === ''} onClick={save}>メモを追加</button>
        <button className="btn btn-ghost" onClick={onClose}>やめる</button>
      </div>
    </div>
  );
}

/** 検証待ち課題の1行(「検証済みにする」→結果入力) */
function AssignmentRow({ id, date, menu }: { id: string; date: string; menu: string }) {
  const updateKarte = useAppStore((s) => s.updateKarte);
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState('');

  const verify = () => {
    const o = outcome.trim();
    updateKarte('練習課題を検証済みに変更', (k) => {
      const a = k.assignments.find((x) => x.id === id);
      if (a) {
        a.status = '検証済み';
        if (o) a.outcome = o;
      }
    });
    setEditing(false);
  };

  return (
    <div>
      <div className="spread">
        <div>
          <p>{menu}</p>
          <p className="small muted mono">{date}</p>
        </div>
        {!editing && (
          <button className="btn" onClick={() => setEditing(true)}>検証済みにする</button>
        )}
      </div>
      {editing && (
        <div className="stack" style={{ marginTop: 8 }}>
          <label>結果(試合・練習でどう変わったか)
            <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="例: バック前の失点率が下がった" />
          </label>
          <div className="row">
            <button className="btn btn-primary" onClick={verify}>結果を記録</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>やめる</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- 本体 ---- */

export default function KarteScreen() {
  const matches = useAppStore((s) => s.matches);
  const diagnosis = useAppStore((s) => s.diagnosis);
  const settings = useAppStore((s) => s.settings);
  const karte = useAppStore((s) => s.karte);
  const updateKarte = useAppStore((s) => s.updateKarte);
  const simple = settings.simpleMode;

  const approved = useMemo(() => matches.filter((m) => m.approved), [matches]);
  const result = useMemo(
    () => computeTypeResult(approved, diagnosis, settings, todayStr()),
    [approved, diagnosis, settings],
  );
  const gap = useMemo(() => selfGap(diagnosis, result), [diagnosis, result]);
  const serves = useMemo(() => serveStats(approved), [approved]);
  const losses = useMemo(() => courseLossStats(approved), [approved]);

  const confirmed = karte.tendencies.filter((t) => t.status === 'confirmed');
  const observed = karte.tendencies.filter((t) => t.status === 'observed');
  const resolved = karte.tendencies.filter((t) => t.status === 'resolved');
  const waiting = karte.assignments.filter((a) => a.status === '検証待ち');
  const verified = karte.assignments.filter((a) => a.status === '検証済み');

  const [showLoopForm, setShowLoopForm] = useState(false);
  const [showMemoForm, setShowMemoForm] = useState(false);

  const removeObserved = (t: TendencyEntry) => {
    if (!window.confirm(`観察中の項目「${t.text}」を削除しますか?\n自動検出が誤っていた場合の修正に使ってください(スナップショットから復元できます)。`)) return;
    updateKarte(`観察中エントリを削除: ${t.text}`, (k) => {
      k.tendencies = k.tendencies.filter((x) => x.id !== t.id);
    });
  };

  const hasTypeDetails =
    result.axes.length > 0 || !!result.clutch || !!gap || karte.typeHistory.length > 0;

  return (
    <Screen
      title="自分カルテ"
      right={<Link className="btn btn-ghost" to="/opponents">相手カルテへ</Link>}
    >
      {/* 診断がまだなら、最初に診断への誘いだけ見せる */}
      {!diagnosis && (
        <Card>
          <EmptyState
            title="診断がまだです"
            hint="2分の診断で仮タイプが決まり、カルテが動き出します"
            action={<Link className="btn btn-primary" to="/diagnosis">診断を受ける</Link>}
          />
        </Card>
      )}

      {/* CODENAME(要点 = タイプ。内訳は畳む) */}
      <Card accent>
        <SectionLabel>CODENAME</SectionLabel>
        {result.stage === 'none' || !result.codename ? (
          <p className="muted small">タイプ未解析。診断と試合データの承認で解析が始まります。</p>
        ) : (
          <div className="stack">
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <TypeBadge
                codename={result.codename}
                variant={result.variant}
                beta={result.beta}
                boundaryWith={result.boundaryWith}
              />
              <span className="small muted">
                {result.stage === 'measured' ? '実測' : '仮(診断より)'}
                <span className="mono"> [{result.totalPt}pt / {result.matchCount}試合]</span>
              </span>
            </div>
            {result.stage === 'provisional' && (
              <p className="small muted">
                実測タイプ確定まであと
                <span className="mono">{Math.max(0, MEASURED_MIN_MATCHES - result.matchCount)}</span>
                試合(承認済み)。
              </p>
            )}
            {hasTypeDetails && (
              <Collapsible title="タイプの内訳" openLabel="軸スコア・クラッチ・履歴を見る" closeLabel="とじる">
                {result.axes.length > 0 && <RadarChart axes={result.axes} />}
                {result.clutch && (
                  <div className="spread small">
                    <span className="muted">クラッチ(9点〜)</span>
                    <span className="mono" style={{ color: result.clutch.diff >= 0 ? 'var(--pos)' : 'var(--neg)', fontWeight: 700 }}>
                      {fmtDiff(result.clutch.diff, result.clutch.pt, result.clutch.ci)}
                    </span>
                  </div>
                )}
                {gap && (
                  <p className="small">
                    <span className="muted">自己申告ギャップ: </span>{gap.text}
                    <span className="mono muted">(自己評価 {gap.selfRating}/5)</span>
                  </p>
                )}
                {karte.typeHistory.length > 0 && (
                  <div>
                    <p className="small muted" style={{ marginBottom: 6 }}>タイプ遷移</p>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                      {karte.typeHistory.map((h, i) => (
                        <span key={`${h.date}-${i}`} className="row" style={{ gap: 6 }}>
                          {i > 0 && <span aria-hidden="true" className="arrow-flow" style={{ color: 'var(--accent)', fontWeight: 700 }}>→</span>}
                          <span
                            className="pop-in"
                            style={{
                              animationDelay: `${i * 0.12}s`,
                              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25,
                              border: `1px solid ${h.stage === 'measured' ? 'var(--pos)' : 'var(--warn)'}`,
                              borderRadius: 'var(--radius-sm)', padding: '3px 9px',
                            }}
                          >
                            <span className="mono small" style={{ fontWeight: 700, color: typeColor(h.codename) }}>
                              {h.codename}-{h.variant === 'alpha' ? 'α' : 'Ω'}
                            </span>
                            <span className="mono" style={{ fontSize: 10, color: h.stage === 'measured' ? 'var(--pos)' : 'var(--warn)' }}>
                              {h.date}・{h.stage === 'measured' ? '実測' : '仮'}
                            </span>
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Collapsible>
            )}
          </div>
        )}
      </Card>

      {/* 弱点と傾向(確定タグ・観察中・解消済み) */}
      <Collapsible
        title="弱点と傾向"
        openLabel="弱点と傾向を見る"
        closeLabel="とじる"
        summary={
          <span>
            確定 <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{confirmed.length}</span>
            ・観察中 <span className="mono" style={{ color: 'var(--warn)', fontWeight: 700 }}>{observed.length}</span>
            ・解消 <span className="mono" style={{ color: 'var(--pos)', fontWeight: 700 }}>{resolved.length}</span>
          </span>
        }
      >
        {/* 確定タグ(断定可) */}
        <Card accent>
          <SectionLabel>確定タグ</SectionLabel>
          {confirmed.length === 0 ? (
            <p className="muted small">確定タグはまだありません。10pt以上+3試合連続で観測されると、承認を経てここに確定します。</p>
          ) : (
            <div className="stack">
              {confirmed.map((t) => (
                <div key={t.id} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10 }}>
                  <p>{t.text}</p>
                  <p className="small muted mono">{tendencyValue(t)} ・ {t.firstSeen} 〜 {t.lastSeen}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 観察中(「可能性」表現・削除可) */}
        <Card>
          <SectionLabel>観察中</SectionLabel>
          {observed.length === 0 ? (
            <p className="muted small">観察中の項目はありません。</p>
          ) : (
            <div className="stack">
              {observed.map((t) => (
                <div key={t.id} className="spread">
                  <div>
                    <p className="muted">{t.text} の可能性</p>
                    <p className="small muted mono">{tendencyValue(t)} ・ 初観測 {t.firstSeen}</p>
                  </div>
                  {!simple && <button className="btn btn-ghost" onClick={() => removeObserved(t)}>削除</button>}
                </div>
              ))}
            </div>
          )}
          <p className="small muted" style={{ marginTop: 8 }}>昇格はホームの「要確認」で承認します。</p>
        </Card>

        {/* 解消済み */}
        <Card>
          <SectionLabel>解消済み</SectionLabel>
          {resolved.length === 0 ? (
            <p className="muted small">解消済みの項目はまだありません。確定タグが直近2試合で観測されなくなると候補になります。</p>
          ) : (
            <div className="stack">
              {resolved.map((t) => (
                <div key={t.id}>
                  <p className="row" style={{ flexWrap: 'wrap' }}>
                    <span
                      className="small"
                      style={{ background: 'var(--accent-faint)', color: 'var(--accent)', borderRadius: 4, padding: '0 6px' }}
                    >
                      解消
                    </span>
                    <span>{t.text}</span>
                  </p>
                  <p className="small muted mono">
                    {tendencyValue(t)}{t.resolvedAt ? ` ・ 解消 ${t.resolvedAt}` : ''}
                  </p>
                  {t.resolvedBy && (
                    <p className="small"><span className="muted">効いた練習: </span>{t.resolvedBy}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </Collapsible>

      {/* 練習と崩壊ループ */}
      <Collapsible
        title="練習と崩壊ループ"
        openLabel="練習の課題・崩壊ループを見る"
        closeLabel="とじる"
        summary={
          <span>
            検証待ちの課題 <span className="mono">{waiting.length}</span>件
            ・崩壊ループ <span className="mono">{karte.loops.length}</span>件
          </span>
        }
      >
        {/* 直近の課題と練習履歴 */}
        <Card>
          <SectionLabel>直近の課題と練習履歴</SectionLabel>
          {waiting.length === 0 && verified.length === 0 ? (
            <p className="muted small">課題はまだありません。試合後モードで「次の練習で1つだけやること」を追加できます。</p>
          ) : (
            <div className="stack">
              {waiting.length > 0 && (
                <div className="stack">
                  <p className="small muted">検証待ち</p>
                  {waiting.map((a) => (
                    <AssignmentRow key={a.id} id={a.id} date={a.date} menu={a.menu} />
                  ))}
                </div>
              )}
              {verified.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <p className="small muted">検証済み</p>
                  {verified.map((a) => (
                    <div key={a.id}>
                      <p>{a.menu}</p>
                      <p className="small muted">
                        <span className="mono">{a.date}</span>
                        {a.outcome ? ` ・ 結果: ${a.outcome}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 崩壊ループ */}
        <Card>
          <SectionLabel>崩壊ループ</SectionLabel>
          {karte.loops.length === 0 ? (
            <p className="muted small">記録された崩壊ループはありません。気づいたパターンがあれば手動で追加できます。</p>
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              {karte.loops.map((l, i) => <LoopCard key={l.id} loop={l} index={i} />)}
            </div>
          )}
          {!simple && (
            <div style={{ marginTop: 12 }}>
              {showLoopForm ? (
                <LoopForm onClose={() => setShowLoopForm(false)} />
              ) : (
                <button className="btn" onClick={() => setShowLoopForm(true)}>崩壊ループを追加</button>
              )}
            </div>
          )}
        </Card>
      </Collapsible>

      {/* ここから下はくわしい記録(基本情報・成績・ログ・メモ) */}
      <Collapsible title="カルテの記録" defaultOpen={false} openLabel="基本情報・成績・ログをくわしく見る" closeLabel="とじる">
      {/* 基本(診断より) — 診断済みのときだけ */}
      {diagnosis && (
      <Card>
        <SectionLabel>基本(診断より)</SectionLabel>
        <div className="stack" style={{ gap: 4 }}>
          <div className="spread"><span className="muted small">戦型</span><span>{diagnosis.style}</span></div>
          <div className="spread"><span className="muted small">利き手・グリップ</span><span>{diagnosis.grip}</span></div>
          <div className="spread">
            <span className="muted small">競り合いの自己評価</span>
            <span className="mono">{diagnosis.selfRating}/5</span>
          </div>
          <div className="spread">
            <span className="muted small">診断日</span>
            <span className="mono small">{diagnosis.answeredAt.slice(0, 10)}</span>
          </div>
        </div>
      </Card>
      )}

      {/* サーブ別成績(上級) */}
      {!simple && (
      <Card>
        <SectionLabel>サーブ別の得点率(直近5試合)</SectionLabel>
        <StatBars
          items={serves.map((s) => ({ label: s.serveType, value: s.winRate, count: s.count, sub: `→${COURSE_LABELS[s.mainCourse]}` }))}
          emptyLabel="承認済み試合のデータがまだありません。試合を取り込んで承認すると集計されます。"
        />
      </Card>
      )}

      {/* コース別失点傾向(上級) */}
      {!simple && (
      <Card>
        <SectionLabel>コース別の失点(レシーブ・直近5試合)</SectionLabel>
        {losses.length === 0 ? (
          <p className="muted small">レシーブのデータがまだありません。</p>
        ) : (
          <CourtHeatmap cells={losses.map((l) => ({ course: l.course, rate: l.lossRate, count: l.count }))} kind="loss" />
        )}
      </Card>
      )}

      {/* 練習ログ(上級) */}
      {!simple && (
      <Card>
        <SectionLabel>練習ログ — 成功率の推移</SectionLabel>
        {karte.practiceLog.length === 0 ? (
          <p className="muted small">練習ログはまだありません。</p>
        ) : (
          <>
            {(() => {
              const asc = [...karte.practiceLog].sort((a, b) => (a.date < b.date ? -1 : 1));
              const latest = asc[asc.length - 1];
              return (
                <div className="row" style={{ gap: 12, marginBottom: 10, alignItems: 'center' }}>
                  <Sparkline values={asc.map((p) => p.successRate * 100)} color="var(--pos)" width={180} height={40} />
                  <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--pos)' }}>
                    {Math.round(latest.successRate * 100)}%
                  </span>
                </div>
              );
            })()}
          <table className="data">
            <thead>
              <tr><th>日付</th><th>ドリル</th><th>成功率</th></tr>
            </thead>
            <tbody>
              {[...karte.practiceLog]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.date}</td>
                    <td>{p.drill}{p.note ? <span className="muted small"> — {p.note}</span> : null}</td>
                    <td className="mono">{Math.round(p.successRate * 100)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </>
        )}
      </Card>
      )}

      {/* コーチングメモ */}
      <Card>
        <SectionLabel>コーチングメモ</SectionLabel>
        {karte.memos.length === 0 ? (
          <p className="muted small">メモはまだありません。体調や試作サーブなど、判定に伝えたいことを残せます。</p>
        ) : (
          <div className="stack">
            {[...karte.memos]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((m) => (
                <div key={m.id}>
                  <p className="small muted mono">{m.date}</p>
                  <p>{m.text}</p>
                  {m.effect && <p className="small muted">判定への影響: {m.effect}</p>}
                </div>
              ))}
          </div>
        )}
        {!simple && (
          <div style={{ marginTop: 12 }}>
            {showMemoForm ? (
              <MemoForm onClose={() => setShowMemoForm(false)} />
            ) : (
              <button className="btn" onClick={() => setShowMemoForm(true)}>メモを追加</button>
            )}
          </div>
        )}
      </Card>

      {/* 未取込試合リスト(上級) */}
      {!simple && (
      <Card>
        <SectionLabel>未取込試合</SectionLabel>
        {karte.missingMatches.length === 0 ? (
          <p className="muted small">未取込の試合はありません。</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {karte.missingMatches.map((mm) => (
              <div key={mm.id} className="spread small">
                <span><span className="mono muted">{mm.date}</span> vs {mm.opponentName}</span>
                <span className="muted">{mm.reason}</span>
              </div>
            ))}
            <p className="small muted">※この期間を含む傾向は「暫定」として扱われます。</p>
          </div>
        )}
      </Card>
      )}
      </Collapsible>

      {simple && (
        <p className="small muted" style={{ textAlign: 'center' }}>
          詳しい記録(サーブ別成績・コース別失点・練習ログなど)は、
          <Link to="/settings">設定でフル機能に切り替え</Link>ると見られます。
        </p>
      )}

      <p className="small muted" style={{ textAlign: 'center' }}>🔒 本人のみ表示・共有なし</p>
    </Screen>
  );
}
