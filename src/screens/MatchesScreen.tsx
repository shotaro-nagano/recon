/* ============================================================
   MatchesScreen — 試合データ管理(記録・年月フォルダ・承認フロー)
   承認済みデータのみが計算ソースになる(絶対ルール)。
   試合は「年 → 月」のフォルダに畳んで表示し、種別(公式戦/練習試合 等)で
   見分けられるようにする。結果だけのかんたん手入力にも対応。
   ============================================================ */
import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { todayStr, uid, useAppStore } from '@/store/useAppStore';
import type { Match, MatchKind } from '@/domain/types';
import { serveStats } from '@/domain/insights';
import { MATCH_KINDS } from '@/domain/constants';
import { Card, EmptyState, MatchKindBadge, Screen, SectionLabel, Segmented } from '@/components/ui';
import { FlowSteps, StatBars } from '@/components/charts';

/* セットごとの最終スコア(ラリー行はラリー開始時点のスコアなので勝者の1点を足す) */
function setScores(m: Match): { set: number; my: number; opp: number }[] {
  const lastOfSet = new Map<number, Match['rallies'][number]>();
  for (const r of m.rallies) lastOfSet.set(r.set, r);
  return [...lastOfSet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([set, last]) => ({
      set,
      my: last.myScore + (last.winner === 'me' ? 1 : 0),
      opp: last.oppScore + (last.winner === 'opp' ? 1 : 0),
    }));
}

const byDateDesc = (a: Match, b: Match) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
const dayLabel = (date: string) => `${Number(date.slice(8, 10))}日`;

/* ---- 1試合の行(承認済みフォルダ内) ---- */
function MatchRow({ m, divider }: { m: Match; divider: boolean }) {
  const win = m.mySets > m.oppSets;
  const draw = m.mySets === m.oppSets;
  return (
    <>
      {divider && <hr className="divider" />}
      <Link to={`/matches/${m.id}`} style={{ color: 'var(--court-line)', display: 'block' }}>
        <div className="spread" style={{ padding: '10px 0', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="mono muted" style={{ fontSize: 13 }}>{dayLabel(m.date)}</span>
              <span>vs {m.opponentName}</span>
            </div>
            <div className="row small muted" style={{ gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
              <MatchKindBadge kind={m.kind} />
              {m.tournament && <span>{m.tournament}</span>}
              {m.rallies.length === 0 && <span>結果のみ</span>}
            </div>
          </div>
          <span
            className="mono"
            style={{ fontSize: 18, fontWeight: 700, flexShrink: 0, color: draw ? 'var(--line-dim)' : win ? 'var(--pos)' : 'var(--neg)' }}
          >
            {m.mySets}-{m.oppSets}
          </span>
        </div>
      </Link>
    </>
  );
}

/* ---- 月フォルダ(開閉可能) ---- */
function MonthFolder({ monthLabel, matches, defaultOpen }: {
  monthLabel: string; matches: Match[]; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const wins = matches.filter((m) => m.mySets > m.oppSets).length;
  const losses = matches.filter((m) => m.mySets < m.oppSets).length;
  const draws = matches.filter((m) => m.mySets === m.oppSets).length;
  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="spread"
        style={{
          width: '100%', background: 'transparent', border: 'none', padding: 0,
          color: 'var(--court-line)', gap: 10, minHeight: 32,
        }}
      >
        <span className="row" style={{ gap: 8 }}>
          <span aria-hidden="true" className="mono" style={{ color: 'var(--accent)' }}>{open ? '▾' : '▸'}</span>
          <span style={{ fontWeight: 700 }}>{monthLabel}</span>
          <span className="small muted mono">{matches.length}試合</span>
        </span>
        <span className="small mono">
          <span style={{ color: 'var(--pos)', fontWeight: 700 }}>{wins}勝</span>
          <span style={{ color: 'var(--neg)', fontWeight: 700 }}>{losses}敗</span>
          {draws > 0 && <span className="muted">{draws}分</span>}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 4 }}>
          {matches.map((m, i) => <MatchRow key={m.id} m={m} divider={i > 0} />)}
        </div>
      )}
    </Card>
  );
}

/* ---- 試合フォルダ全体(年 → 月) ---- */
function MatchFolders({ matches }: { matches: Match[] }) {
  const sorted = useMemo(() => [...matches].sort(byDateDesc), [matches]);

  // 年 → 月 → 試合[] (sorted が降順なので挿入順も降順)
  const byYear = useMemo(() => {
    const map = new Map<string, Map<string, Match[]>>();
    for (const m of sorted) {
      const y = m.date.slice(0, 4);
      const mo = m.date.slice(0, 7);
      if (!map.has(y)) map.set(y, new Map());
      const months = map.get(y)!;
      if (!months.has(mo)) months.set(mo, []);
      months.get(mo)!.push(m);
    }
    return map;
  }, [sorted]);

  return (
    <div className="stack">
      {[...byYear.entries()].map(([year, months], yearIndex) => (
        <div key={year} className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="display" style={{ fontSize: 15, color: 'var(--line-dim)', letterSpacing: '0.06em' }}>
              {year}年
            </span>
            <hr className="divider" style={{ flex: 1 }} />
          </div>
          {[...months.entries()].map(([monthKey, list], monthIndex) => (
            <MonthFolder
              key={monthKey}
              monthLabel={`${Number(monthKey.slice(5, 7))}月`}
              matches={list}
              defaultOpen={yearIndex === 0 && monthIndex === 0}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---- 未承認試合カード(承認フローの入口) ---- */
function PendingMatchCard({ m, expanded, onToggle, onApprove, onReject }: {
  m: Match;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const sets = useMemo(() => setScores(m), [m]);
  const myServes = useMemo(() => serveStats([m]), [m]);
  const myServeTotal = myServes.reduce((a, s) => a + s.count, 0);

  return (
    <Card accent>
      <div className="spread">
        <div>
          <div className="row small muted" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '1px 9px', borderRadius: 'var(--radius-pill)', fontWeight: 700, border: '1px solid var(--warn)', color: 'var(--warn)' }}>未承認</span>
            <MatchKindBadge kind={m.kind} />
            <span>{m.source}</span>
            {m.tournament && <span>{m.tournament}</span>}
          </div>
          <div>
            <span className="mono">{m.date}</span> vs {m.opponentName}
          </div>
        </div>
        <span className="mono" style={{ fontSize: 20 }}>{m.mySets}-{m.oppSets}</span>
      </div>

      {!expanded ? (
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onToggle}>内容を確認して承認</button>
          <Link className="btn btn-ghost" to={`/matches/${m.id}`}>詳細を見る</Link>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <hr className="divider" />
          <div className="small">
            <span className="muted">セットスコア </span>
            <span className="mono">{sets.map((s) => `${s.my}-${s.opp}`).join(' / ') || '記録なし'}</span>
            <span className="muted"> ・ ラリー </span>
            <span className="mono">{m.rallies.length}</span>本
          </div>
          <div className="small">
            <div className="muted" style={{ marginBottom: 6 }}>
              サーブ別の得点率(自分のサーブ <span className="mono">{myServeTotal}</span>本)
            </div>
            <StatBars
              items={myServes.map((s) => ({ label: s.serveType, value: s.winRate, count: s.count }))}
              emptyLabel="自分のサーブの記録がない"
            />
          </div>
          <p className="small muted">承認=計算に反映 / 不採用=未取込へ</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onApprove}>承認する</button>
            <button className="btn" onClick={onReject}>不採用にする</button>
            <Link className="btn btn-ghost" to={`/matches/${m.id}`}>詳細を見る</Link>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---- 結果のかんたん手入力フォーム ---- */
function ManualForm({ onDone }: { onDone: (msg: string) => void }) {
  const addMatch = useAppStore((s) => s.addMatch);
  const opponents = useAppStore((s) => s.opponents);

  const [date, setDate] = useState(todayStr());
  const [opponentName, setOpponentName] = useState('');
  const [mySets, setMySets] = useState('3');
  const [oppSets, setOppSets] = useState('0');
  const [kind, setKind] = useState<MatchKind>('練習試合');
  const [tournament, setTournament] = useState('');
  const [note, setNote] = useState('');

  const mySetsNum = Math.min(7, Math.max(0, Number(mySets) || 0));
  const oppSetsNum = Math.min(7, Math.max(0, Number(oppSets) || 0));
  const hasName = opponentName.trim() !== '';
  const canSave = hasName && date !== '' && mySetsNum !== oppSetsNum;

  const save = () => {
    const name = opponentName.trim();
    const opp = opponents.find((o) => o.name === name);
    addMatch({
      id: uid(),
      date,
      opponentId: opp?.id ?? '',
      opponentName: name,
      tournament: tournament.trim() || undefined,
      kind,
      note: note.trim() || undefined,
      mySets: mySetsNum,
      oppSets: oppSetsNum,
      source: '手入力',
      approved: true, // 本人入力 = 本人承認済み。ラリーが無いのでタイプ計算には数えない
      approvedAt: todayStr(),
      rallies: [],
    });
    onDone(`${date} vs ${name} ${mySetsNum}-${oppSetsNum} を記録しました(${kind})。`);
  };

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <p className="small muted">
        結果だけをサッと残せます。ラリーの詳細データは含まないので、タイプ判定の試合数には数えません(記録として残ります)。
      </p>
      <label>日付
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>相手の名前*
        <input value={opponentName} onChange={(e) => setOpponentName(e.target.value)} placeholder="例: 山田太郎" />
      </label>
      <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
        <label style={{ flex: 1 }}>自分のセット
          <input type="number" inputMode="numeric" min={0} max={7} value={mySets} onChange={(e) => setMySets(e.target.value)} />
        </label>
        <span className="mono" style={{ paddingBottom: 12, color: 'var(--line-dim)' }}>-</span>
        <label style={{ flex: 1 }}>相手のセット
          <input type="number" inputMode="numeric" min={0} max={7} value={oppSets} onChange={(e) => setOppSets(e.target.value)} />
        </label>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 6 }}>種別</label>
        <Segmented
          options={MATCH_KINDS.map((k) => ({ value: k.value, label: k.short }))}
          value={kind}
          onChange={setKind}
        />
      </div>
      <label>大会名(任意)
        <input value={tournament} onChange={(e) => setTournament(e.target.value)} placeholder="例: 県リーグ・市民大会" />
      </label>
      <label>メモ(任意)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 新しい巻き込みサーブを試した" />
      </label>
      {!canSave && (
        <p className="small muted">
          {!hasName || !date
            ? '相手の名前と日付を入れると記録できます。'
            : '勝敗が決まるスコアを入力してください(同点は登録できません)。'}
        </p>
      )}
      <div className="row">
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>この結果を記録する</button>
      </div>
    </div>
  );
}

export default function MatchesScreen() {
  const matches = useAppStore((s) => s.matches);
  const opponents = useAppStore((s) => s.opponents);
  const missing = useAppStore((s) => s.karte.missingMatches);
  const simple = useAppStore((s) => s.settings.simpleMode);
  const addMatch = useAppStore((s) => s.addMatch);
  const approveMatch = useAppStore((s) => s.approveMatch);
  const rejectMatch = useAppStore((s) => s.rejectMatch);

  const pending = useMemo(() => matches.filter((m) => !m.approved).sort(byDateDesc), [matches]);
  const approved = useMemo(() => matches.filter((m) => m.approved).sort(byDateDesc), [matches]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordMode, setRecordMode] = useState<'none' | 'manual' | 'video'>('none');

  /* ---- 動画から取り込み(AI解析) ---- */
  const [videoName, setVideoName] = useState<string | null>(null);
  const [importedMsg, setImportedMsg] = useState<string | null>(null);

  const handleVideo = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoName(f.name);
    setImportedMsg(null);
    e.target.value = ''; // 同じ動画を選び直せるように
  };

  const [manualMsg, setManualMsg] = useState<string | null>(null);

  return (
    <Screen
      title="試合データ"
      right={<span className="small muted"><span className="mono">{matches.length}</span>件</span>}
    >
      {/* ---- 承認待ち(最上部・accent) ---- */}
      {pending.length > 0 && (
        <>
          <SectionLabel>承認待ちの試合 — <span className="mono">{pending.length}</span>件</SectionLabel>
          {pending.map((m) => (
            <PendingMatchCard
              key={m.id}
              m={m}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(m.id)}
              onApprove={() => { approveMatch(m.id); setExpandedId(null); }}
              onReject={() => { rejectMatch(m.id); setExpandedId(null); }}
            />
          ))}
        </>
      )}

      {/* ---- 試合を記録する(動画から取り込む / かんたん手入力) ---- */}
      <SectionLabel>試合を記録する</SectionLabel>
      <Card>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            className={`btn ${recordMode === 'video' ? 'btn-primary' : ''}`}
            onClick={() => { setRecordMode((v) => (v === 'video' ? 'none' : 'video')); setImportedMsg(null); }}
          >
            🎥 動画から取り込む
          </button>
          <button
            className={`btn ${recordMode === 'manual' ? 'btn-primary' : ''}`}
            onClick={() => { setRecordMode((v) => (v === 'manual' ? 'none' : 'manual')); setManualMsg(null); }}
          >
            結果をかんたん入力
          </button>
        </div>

        {recordMode === 'none' && (
          <p className="small muted" style={{ marginTop: 10 }}>
            試合の動画をAIが解析して取り込みます。練習試合などスコアだけなら「結果をかんたん入力」。
          </p>
        )}

        {recordMode === 'manual' && (
          <>
            <ManualForm onDone={(msg) => { setManualMsg(msg); setRecordMode('none'); }} />
          </>
        )}

        {recordMode === 'video' && (
          <div className="stack" style={{ marginTop: 12 }}>
            <p className="small muted">
              試合の動画を選ぶと、AIがラリーごとに<b>サーブ権・コース(1-6)・球種・勝者</b>を判定し、得点を再構成します。
              出来上がった試合は<b>未承認</b>として追加され、あなたが確認して承認するまで計算には使われません。
            </p>
            <label className="small" style={{ fontWeight: 700 }}>
              試合の動画を選ぶ(固定カメラ推奨)
              <input type="file" accept="video/*" onChange={handleVideo} style={{ marginTop: 4 }} />
            </label>
            {videoName && (
              <>
                <p className="small"><span className="muted">選択中: </span><span className="mono">{videoName}</span></p>
                <Card style={{ background: 'var(--night-court)' }}>
                  <SectionLabel>AIがやること</SectionLabel>
                  <FlowSteps
                    steps={[
                      { title: '動画をラリーに分割', sub: '打球音・静止で区切る' },
                      { title: '各ラリーをAIが判定', sub: 'サーブ権・コース・球種・勝者' },
                      { title: '得点・セットを再構成', sub: 'サーブ権ルールで整合チェック' },
                      { title: '結果をプレビュー → 承認', sub: '人は確認・修正だけ' },
                    ]}
                  />
                </Card>
                <button className="btn btn-primary" disabled title="解析エンジン接続後に有効化">
                  🤖 AIで解析する(準備中)
                </button>
                <p className="small muted">
                  ※AI解析エンジンの接続待ちです。下の確認に回答いただくと有効化します。
                </p>
              </>
            )}
            {importedMsg && (
              <p className="small" style={{ color: 'var(--pos)', fontWeight: 700 }}>{importedMsg}</p>
            )}
          </div>
        )}

        {manualMsg && recordMode === 'none' && (
          <p className="small" style={{ color: 'var(--pos)', marginTop: 10, fontWeight: 700 }}>{manualMsg}</p>
        )}
        {importedMsg && recordMode === 'none' && (
          <p className="small" style={{ color: 'var(--pos)', marginTop: 10, fontWeight: 700 }}>{importedMsg}</p>
        )}
      </Card>

      {/* ---- 試合の記録(年 → 月フォルダ) ---- */}
      <SectionLabel>試合の記録</SectionLabel>
      {approved.length === 0 ? (
        <Card>
          <EmptyState
            title={matches.length === 0 ? '試合データはまだない' : '記録された試合はまだない'}
            hint={
              matches.length === 0
                ? '上の「試合を記録する」から、動画を取り込むか結果をかんたん入力して最初の試合を追加しよう'
                : '上の承認待ちカードから内容を確認して承認すると、ここに月ごとに並ぶ'
            }
          />
        </Card>
      ) : (
        <MatchFolders matches={approved} />
      )}

      {/* ---- 未取込リスト(欠損の記録・上級) ---- */}
      {!simple && missing.length > 0 && (
        <>
          <SectionLabel>未取込の試合(欠損の記録)</SectionLabel>
          <Card>
            <p className="small muted" style={{ marginBottom: 8 }}>
              この期間を含む傾向は「暫定」として扱われる。
            </p>
            <table className="data">
              <thead>
                <tr><th>日付</th><th>相手</th><th>理由</th></tr>
              </thead>
              <tbody>
                {missing.map((x) => (
                  <tr key={x.id}>
                    <td className="mono">{x.date}</td>
                    <td>{x.opponentName}</td>
                    <td>{x.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </Screen>
  );
}
