/* ============================================================
   MatchDetailScreen — 試合詳細 (/matches/:id)
   セット別スコア・サーブ別成績・コース別失点・ラリー表(折りたたみ)。
   未承認なら承認/不採用もここから行える。
   ============================================================ */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import type { Course, Match, RallyRow } from '@/domain/types';
import { COURSE_LABELS } from '@/domain/constants';
import { courseLossStats, serveStats } from '@/domain/insights';
import { fmtRate } from '@/domain/stats';
import { Card, CourseBadge, EmptyState, Screen, SectionLabel } from '@/components/ui';

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

export default function MatchDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const match = useAppStore((s) => s.matches.find((m) => m.id === id));
  const approveMatch = useAppStore((s) => s.approveMatch);
  const rejectMatch = useAppStore((s) => s.rejectMatch);
  const [openRallies, setOpenRallies] = useState(false);

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
          <div>
            <div className="small muted">
              <span className="mono">{match.date}</span>
              {match.tournament ? ` ・ ${match.tournament}` : ''} ・ {match.source}
            </div>
            <h2 style={{ fontSize: 18, marginTop: 2 }}>vs {match.opponentName}</h2>
          </div>
          <span className="mono" style={{ fontSize: 28 }}>{match.mySets}-{match.oppSets}</span>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {match.approved ? (
            <>
              承認済み
              {match.approvedAt && <>(<span className="mono">{match.approvedAt}</span>)</>}
              {' '}— タイプ計算・カルテに反映中
            </>
          ) : (
            '未承認 — 承認するまで計算には使われない'
          )}
        </p>
      </Card>

      {/* ---- 未承認なら承認フロー ---- */}
      {!match.approved && (
        <Card accent>
          <SectionLabel>この試合を計算に使うか確認</SectionLabel>
          <p className="small" style={{ marginBottom: 12 }}>
            下のセット別スコア・サーブ別成績・ラリー表を確認してから承認しよう。
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

      {/* ---- セット別スコア ---- */}
      <Card>
        <SectionLabel>セット別スコア</SectionLabel>
        {sets.length === 0 ? (
          <p className="small muted">ラリー記録がない</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>セット</th><th>スコア</th><th>結果</th><th>ラリー</th></tr>
            </thead>
            <tbody>
              {sets.map((s) => (
                <tr key={s.set}>
                  <td className="mono">{s.set}</td>
                  <td className="mono">{s.my}-{s.opp}</td>
                  <td>
                    {s.my > s.opp
                      ? <span style={{ color: 'var(--accent)' }}>取</span>
                      : <span className="muted">失</span>}
                  </td>
                  <td className="mono">{s.rallies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted" style={{ marginTop: 6 }}>
          ラリー記録から算出(最終結果 <span className="mono">{match.mySets}-{match.oppSets}</span>)
        </p>
      </Card>

      {/* ---- サーブ別成績(この試合) ---- */}
      <Card>
        <SectionLabel>サーブ別成績(この試合)</SectionLabel>
        {serves.length === 0 ? (
          <p className="small muted">自分のサーブの記録がない</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>サーブ</th><th>主コース</th><th>本数</th><th>得点率</th></tr>
            </thead>
            <tbody>
              {serves.map((s) => (
                <tr key={s.serveType}>
                  <td>{s.serveType}</td>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <CourseBadge course={s.mainCourse} />
                      {COURSE_LABELS[s.mainCourse]}
                    </span>
                  </td>
                  <td className="mono">{s.count}</td>
                  <td className="mono">{fmtRate(s.winRate, s.count, s.ci)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ---- コース別失点(レシーブ) ---- */}
      <Card>
        <SectionLabel>コース別失点(レシーブ・この試合)</SectionLabel>
        {losses.length === 0 ? (
          <p className="small muted">相手サーブの記録がない</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>コース</th><th>本数</th><th>失点率</th></tr>
            </thead>
            <tbody>
              {losses.map((c) => (
                <tr key={c.course}>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <CourseBadge course={c.course} />
                      {c.label}
                    </span>
                  </td>
                  <td className="mono">{c.count}</td>
                  <td className="mono">{fmtRate(c.lossRate, c.count, c.ci)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

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
