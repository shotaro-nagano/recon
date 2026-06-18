/* ============================================================
   MatchDetailScreen — 試合詳細 (/matches/:id)
   セット別スコア・サーブ別成績・コース別失点・ラリー表(折りたたみ)。
   未承認なら承認/不採用もここから行える。
   ============================================================ */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import type { Course, Match, MatchKind, RallyRow } from '@/domain/types';
import { COURSE_LABELS, MATCH_KINDS } from '@/domain/constants';
import { courseLossStats, serveStats } from '@/domain/insights';
import { Card, Collapsible, EmptyState, MatchKindBadge, Screen, SectionLabel, Segmented } from '@/components/ui';
import { CourtHeatmap, ScoreFlow, StatBars } from '@/components/charts';

/* セットごとの最終スコアとラリー数(ラリー行は開始時点スコアなので勝者の1点を足す) */
function setScores(m: Match): { set: number; my: number; opp: number; rallies: number }[] {
  const bySet = new Map<number, RallyRow[]>();
  for (const r of m.rallies) {
    const arr = bySet.get(r.set) ?? [];
    arr.push(r);
    bySet.set(r.set, arr);
  }
  return [...bySet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([set, rows]) => {
      const last = rows[rows.length - 1];
      return {
        set,
        my: last.myScore + (last.winner === 'me' ? 1 : 0),
        opp: last.oppScore + (last.winner === 'opp' ? 1 : 0),
        rallies: rows.length,
      };
    });
}

const COURSE_LEGEND = ([1, 2, 3, 4, 5, 6] as Course[])
  .map((c) => `${c}=${COURSE_LABELS[c]}`)
  .join(' ');

/* ---- 種別・大会名・メモの編集フォーム ---- */
function MetaEditForm({ match, onClose }: { match: Match; onClose: () => void }) {
  const updateMatchMeta = useAppStore((s) => s.updateMatchMeta);
  const [kind, setKind] = useState<MatchKind>(match.kind ?? 'その他');
  const [tournament, setTournament] = useState(match.tournament ?? '');
  const [note, setNote] = useState(match.note ?? '');

  const save = () => {
    updateMatchMeta(match.id, { kind, tournament, note });
    onClose();
  };

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 6 }}>種別</label>
        <Segmented
          options={MATCH_KINDS.map((k) => ({ value: k.value, label: k.short }))}
          value={kind}
          onChange={setKind}
        />
      </div>
      <label>大会名(任意)
        <input value={tournament} onChange={(e) => setTournament(e.target.value)} placeholder="例: 県リーグ" />
      </label>
      <label>メモ(任意)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 新サーブを試した試合" />
      </label>
      <div className="row">
        <button className="btn btn-primary" onClick={save}>保存する</button>
        <button className="btn btn-ghost" onClick={onClose}>やめる</button>
      </div>
    </div>
  );
}

export default function MatchDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const match = useAppStore((s) => s.matches.find((m) => m.id === id));
  const approveMatch = useAppStore((s) => s.approveMatch);
  const rejectMatch = useAppStore((s) => s.rejectMatch);
  const [openRallies, setOpenRallies] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);

  // serveStats / courseLossStats は Match[] を受けるので単試合配列で流用できる
  const sets = useMemo(() => (match ? setScores(match) : []), [match]);
  const serves = useMemo(() => (match ? serveStats([match]) : []), [match]);
  const losses = useMemo(() => (match ? courseLossStats([match]) : []), [match]);

  if (!match) {
    return (
      <Screen title="試合詳細">
        <EmptyState
          title="この試合は見つからない"
          hint="削除されたか、不採用で未取込リストに移った可能性がある"
          action={<Link className="btn" to="/matches">試合一覧に戻る</Link>}
        />
      </Screen>
    );
  }

  return (
    <Screen title="試合詳細" right={<Link className="btn btn-ghost" to="/matches">一覧へ戻る</Link>}>
      {/* ---- ヘッダー ---- */}
      <Card>
        <div className="spread">
          <div style={{ minWidth: 0 }}>
            <div className="row small muted" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="mono">{match.date}</span>
              <MatchKindBadge kind={match.kind} />
              {match.tournament && <span>{match.tournament}</span>}
              <span>{match.source}</span>
            </div>
            <h2 style={{ fontSize: 18, marginTop: 4 }}>vs {match.opponentName}</h2>
          </div>
          <span
            className="mono"
            style={{ fontSize: 28, fontWeight: 700, flexShrink: 0, color: match.mySets === match.oppSets ? 'var(--court-line)' : match.mySets > match.oppSets ? 'var(--pos)' : 'var(--neg)' }}
          >
            {match.mySets}-{match.oppSets}
          </span>
        </div>
        {match.note && (
          <p className="small" style={{ marginTop: 8 }}>
            <span className="muted">メモ: </span>{match.note}
          </p>
        )}
        <p className="small muted" style={{ marginTop: 6 }}>
          {match.approved ? (
            <>
              承認済み
              {match.approvedAt && <>(<span className="mono">{match.approvedAt}</span>)</>}
              {match.rallies.length === 0 ? ' — 結果のみの記録(タイプ計算には不使用)' : ' — タイプ計算・カルテに反映中'}
            </>
          ) : (
            '未承認 — 承認するまで計算には使われない'
          )}
        </p>
        <div style={{ marginTop: 10 }}>
          {editingMeta ? (
            <MetaEditForm match={match} onClose={() => setEditingMeta(false)} />
          ) : (
            <button className="btn btn-ghost" style={{ paddingLeft: 0 }} onClick={() => setEditingMeta(true)}>
              種別・大会名・メモを編集
            </button>
          )}
        </div>
      </Card>

      {/* ---- 試合の流れ(得点リードの推移・シーケンス図) ---- */}
      {match.rallies.length >= 2 && (
        <Card>
          <SectionLabel>試合の流れ</SectionLabel>
          <ScoreFlow rallies={match.rallies} />
        </Card>
      )}

      {/* ---- 未承認なら承認フロー ---- */}
      {!match.approved && (
        <Card accent>
          <SectionLabel>この試合を計算に使うか確認</SectionLabel>
          <p className="small" style={{ marginBottom: 12 }}>
            下の「成績を見る」を開いて内容を確認してから承認しよう。
            不採用にすると計算には使わず、未取込リスト(欠損の記録)に移る。
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => approveMatch(match.id)}>
              承認する
            </button>
            <button
              className="btn"
              onClick={() => { rejectMatch(match.id); navigate('/matches'); }}
            >
              不採用にする
            </button>
          </div>
        </Card>
      )}

      {/* ---- 成績(セット/サーブ/コース)を折りたたむ ---- */}
      <Collapsible title="この試合の成績" openLabel="成績を見る(セット・サーブ・コース)" closeLabel="とじる">

      {/* ---- セット別スコア ---- */}
      <Card>
        <SectionLabel>セット別スコア</SectionLabel>
        {sets.length === 0 ? (
          <p className="small muted">ラリー記録がない</p>
        ) : (
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {sets.map((s) => {
              const won = s.my > s.opp;
              return (
                <div
                  key={s.set}
                  style={{
                    flex: '0 0 auto', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                    background: won ? 'var(--pos-soft)' : 'var(--neg-soft)',
                    border: `1px solid ${won ? 'var(--pos)' : 'var(--neg)'}`,
                  }}
                >
                  <div className="small muted" style={{ textAlign: 'center' }}>第{s.set}・{s.rallies}本</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 17, textAlign: 'center', color: won ? 'var(--pos)' : 'var(--neg)' }}>
                    {s.my}-{s.opp}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---- サーブ別成績(この試合) ---- */}
      <Card>
        <SectionLabel>サーブ別 得点率</SectionLabel>
        <StatBars
          items={serves.map((s) => ({ label: s.serveType, value: s.winRate, count: s.count, sub: `→${COURSE_LABELS[s.mainCourse]}` }))}
          emptyLabel="自分のサーブの記録がない"
        />
      </Card>

      {/* ---- コース別失点(レシーブ) ---- */}
      <Card>
        <SectionLabel>失点コース(レシーブ)</SectionLabel>
        {losses.length === 0 ? (
          <p className="small muted">相手サーブの記録がない</p>
        ) : (
          <CourtHeatmap cells={losses.map((c) => ({ course: c.course, rate: c.lossRate, count: c.count }))} kind="loss" />
        )}
      </Card>

      </Collapsible>

      {/* ---- ラリー表(折りたたみ) ---- */}
      <Card>
        <div className="spread">
          <SectionLabel>
            ラリー表 — <span className="mono">{match.rallies.length}</span>本
          </SectionLabel>
          <button className="btn btn-ghost" onClick={() => setOpenRallies((v) => !v)}>
            {openRallies ? 'ラリー表を閉じる' : 'ラリー表を開く'}
          </button>
        </div>
        {openRallies && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>S</th><th>スコア</th><th>サーブ</th><th>種類</th>
                  <th>コース</th><th>打数</th><th>3球目</th><th>得点</th>
                </tr>
              </thead>
              <tbody>
                {match.rallies.map((r, i) => (
                  <tr key={i}>
                    <td className="mono">{r.set}</td>
                    <td className="mono">{r.myScore}-{r.oppScore}</td>
                    <td>{r.server === 'me' ? '自分' : '相手'}</td>
                    <td>{r.serveType}</td>
                    <td className="mono">{r.serveCourse}</td>
                    <td className="mono">{r.rallyLength}</td>
                    <td>{r.server === 'me' ? (r.thirdBallAttack ? '強打' : '—') : ''}</td>
                    <td>
                      {r.winner === 'me'
                        ? <span style={{ color: 'var(--accent)' }}>自分</span>
                        : <span className="muted">相手</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: 6 }}>
              スコアはラリー開始時点。コース: {COURSE_LEGEND}
            </p>
          </div>
        )}
      </Card>
    </Screen>
  );
}
