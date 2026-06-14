/* ============================================================
   試合後モード — /coach/post/:matchId?
   流れ: 良かったデータ → (惨敗なら今すぐ/明日の選択) → 分析
   → 練習提案1つ → カルテ更新案 → 初見相手カルテ → 申告メモ
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  selectPendingApprovals, todayStr, uid, useAppStore,
} from '@/store/useAppStore';
import { bestDataOfMatch } from '@/domain/insights';
import { voice } from '@/domain/persona';
import { fmtDiff, fmtRate } from '@/domain/stats';
import {
  buildOpponentDraft, clutchOfMatch, courseLossOfMatch, headlineOfMatch,
  isBlowout, issuesOfMatch, pointRateOfMatch, practiceSuggestionOfMatch,
  serveStatsOfMatch,
} from '@/domain/coach/postMatch';
import {
  ApprovalCard, Card, CourseBadge, EmptyState, Screen, SectionLabel,
} from '@/components/ui';

export default function PostMatchScreen() {
  const { matchId } = useParams<{ matchId: string }>();
  const matches = useAppStore((s) => s.matches);
  const opponents = useAppStore((s) => s.opponents);
  const settings = useAppStore((s) => s.settings);
  const pendingApprovals = useAppStore(selectPendingApprovals);
  const resolveApproval = useAppStore((s) => s.resolveApproval);
  const updateKarte = useAppStore((s) => s.updateKarte);
  const upsertOpponent = useAppStore((s) => s.upsertOpponent);
  const appendSession = useAppStore((s) => s.appendSession);

  const v = voice(settings.persona);
  const approvedDesc = useMemo(
    () => matches.filter((m) => m.approved).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [matches],
  );
  const match = matchId ? matches.find((m) => m.id === matchId) : undefined;

  /* 惨敗時の選択(試合IDごとに保持) */
  const [blowoutChoice, setBlowoutChoice] = useState<Record<string, 'now' | 'tomorrow'>>({});
  /* 練習リスト追加の二重防止 */
  const [addedAssignment, setAddedAssignment] = useState<Record<string, boolean>>({});
  /* 申告メモ */
  const [memoText, setMemoText] = useState('');
  const [memoSaved, setMemoSaved] = useState(false);

  /* セッションログは試合ごとに1回のみ(ref ガード) */
  const loggedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!match || !match.approved || loggedIds.current.has(match.id)) return;
    loggedIds.current.add(match.id);
    const { rate, pt } = pointRateOfMatch(match);
    appendSession({
      date: todayStr(),
      mode: '試合後',
      summary: `試合後レビュー: vs ${match.opponentName} ${match.mySets}-${match.oppSets}(得点率${Math.round(rate * 100)}%[${pt}pt])`,
    });
  }, [match, appendSession]);

  const analysis = useMemo(() => {
    if (!match || !match.approved) return null;
    return {
      good: bestDataOfMatch(match),
      pointRate: pointRateOfMatch(match),
      blowout: isBlowout(match),
      headline: headlineOfMatch(match),
      issues: issuesOfMatch(match),
      courseLoss: courseLossOfMatch(match),
      serves: serveStatsOfMatch(match),
      clutch: clutchOfMatch(match),
      suggestion: practiceSuggestionOfMatch(match),
    };
  }, [match]);

  /* ---- matchId 未指定: 承認済み試合の選択リスト ---- */
  if (!matchId) {
    return (
      <Screen title="試合後レビュー">
        {approvedDesc.length === 0 ? (
          <EmptyState
            title="承認済みの試合がまだない"
            hint="試合データを取り込み、内容を確認して承認すると振り返りができる。"
            action={<Link className="btn btn-primary" to="/matches">試合データを取り込む</Link>}
          />
        ) : (
          <>
            <SectionLabel>振り返る試合を選ぶ</SectionLabel>
            {approvedDesc.map((m) => (
              <Card key={m.id}>
                <div className="spread">
                  <div>
                    <p className="small muted mono">{m.date}{m.tournament ? ` ・ ${m.tournament}` : ''}</p>
                    <p>
                      vs {m.opponentName}{' '}
                      <span className="mono">{m.mySets}-{m.oppSets}</span>
                    </p>
                  </div>
                  <Link className="btn" to={`/coach/post/${m.id}`}>振り返る</Link>
                </div>
              </Card>
            ))}
          </>
        )}
      </Screen>
    );
  }

  /* ---- 該当試合なし / 未承認 ---- */
  if (!match) {
    return (
      <Screen title="試合後レビュー">
        <EmptyState
          title="指定された試合が見つからない"
          hint="削除されたか、URLが古い可能性がある。一覧から選び直そう。"
          action={<Link className="btn" to="/coach/post">試合を選び直す</Link>}
        />
      </Screen>
    );
  }
  if (!match.approved) {
    return (
      <Screen title="試合後レビュー">
        <Card accent>
          <p>この試合はまだ承認されていない。承認済みデータだけがカルテ・分析に使われる。</p>
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn btn-primary" to="/matches">内容を確認して承認する</Link>
          </div>
        </Card>
      </Screen>
    );
  }

  if (!analysis) return null; // ここには来ない(型ガード)

  const choice = blowoutChoice[match.id];
  const gateOpen = analysis.blowout && choice === undefined; // 選択待ち
  const deferred = analysis.blowout && choice === 'tomorrow'; // 明日見る

  const isFirstMeeting = !opponents.some(
    (o) => o.id === match.opponentId || o.name === match.opponentName,
  );
  const linkedOpponent = opponents.find(
    (o) => o.id === match.opponentId || o.name === match.opponentName,
  );

  const addAssignment = () => {
    if (addedAssignment[match.id]) return;
    updateKarte('試合後レビューの練習課題追加', (k) => {
      k.assignments.push({
        id: uid(),
        date: todayStr(),
        menu: analysis.suggestion.menu,
        status: '検証待ち',
      });
    });
    setAddedAssignment((p) => ({ ...p, [match.id]: true }));
  };

  const createOpponent = () => {
    const id = match.opponentId || uid();
    upsertOpponent(buildOpponentDraft(match, id));
  };

  const saveMemo = () => {
    const text = memoText.trim();
    if (!text) return;
    // 本人入力 = 本人承認済みとして直接カルテへ追加
    updateKarte('コーチングメモ追加', (k) => {
      k.memos.push({ id: uid(), date: todayStr(), text });
    });
    setMemoText('');
    setMemoSaved(true);
  };

  return (
    <Screen
      title="試合後レビュー"
      right={<Link className="btn btn-ghost" to="/coach/post">別の試合</Link>}
    >
      {/* 結果サマリ */}
      <Card>
        <div className="spread">
          <div>
            <p className="small muted mono">{match.date}{match.tournament ? ` ・ ${match.tournament}` : ''}</p>
            <p>vs {match.opponentName}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="display mono" style={{ fontSize: 24 }}>{match.mySets}-{match.oppSets}</p>
            <p className="small muted">
              総得点率 <span className="mono">{fmtRate(analysis.pointRate.rate, analysis.pointRate.pt)}</span>
            </p>
          </div>
        </div>
      </Card>

      {/* 1. 良かったデータを必ず最初に */}
      <Card accent>
        <SectionLabel>今日の収穫</SectionLabel>
        <p className="small muted">{v('postGood')}</p>
        <p style={{ marginTop: 4 }}>
          <strong>{analysis.good.text}</strong>{' '}
          <span className="mono muted small">[{analysis.good.pt}pt]</span>
        </p>
      </Card>

      {/* 2. 惨敗チェック: 分析より先に提示 */}
      {gateOpen && (
        <Card accent>
          <SectionLabel>今日、数字を見るか</SectionLabel>
          <p>
            セット<span className="mono">0-{match.oppSets}</span>・得点率
            <span className="mono">{fmtRate(analysis.pointRate.rate, analysis.pointRate.pt)}</span>
            の厳しい試合だった。分析の価値は明日になっても落ちない。どちらでもいい。
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={() => setBlowoutChoice((p) => ({ ...p, [match.id]: 'now' }))}
            >
              今すぐ見る
            </button>
            <button
              className="btn"
              onClick={() => setBlowoutChoice((p) => ({ ...p, [match.id]: 'tomorrow' }))}
            >
              明日見る
            </button>
          </div>
        </Card>
      )}

      {/* 「明日見る」: 要点1行のみ */}
      {deferred && (
        <Card>
          <p>{analysis.headline}</p>
          <p className="small muted" style={{ marginTop: 8 }}>
            詳細な分析は畳んである。明日この画面を開けば続きから見られる。
          </p>
          <button
            className="btn btn-ghost"
            style={{ marginTop: 8 }}
            onClick={() => setBlowoutChoice((p) => ({ ...p, [match.id]: 'now' }))}
          >
            やっぱり今見る
          </button>
        </Card>
      )}

      {/* 3〜6. 本編(選択待ち・明日見るの間は畳む) */}
      {!gateOpen && !deferred && (
        <>
          {/* 3. ほころびの分析 */}
          <Card>
            <SectionLabel>ほころびの分析(この試合のみ)</SectionLabel>
            <p className="small muted">{v('postIssue')}</p>
            {analysis.issues.length === 0 ? (
              <p style={{ marginTop: 8 }}>この試合から大きなほころびは検出されなかった。</p>
            ) : (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {analysis.issues.map((it, i) => (
                  <li key={it.kind} style={{ marginBottom: 4 }}>
                    <span className="mono muted small">優先{i + 1}</span>{' '}
                    {it.lead}<span className="mono">{it.stat}</span>{it.tail}
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted" style={{ marginTop: 8 }}>
              ※1試合分の観測のため断定はしない。継続して観測されれば確定タグを提案する。
            </p>

            <hr className="divider" style={{ margin: '12px 0' }} />
            <SectionLabel>コース別失点(相手サーブ)</SectionLabel>
            {analysis.courseLoss.length === 0 ? (
              <p className="small muted">相手サーブのデータがない。</p>
            ) : (
              <table className="data">
                <thead>
                  <tr><th>コース</th><th>本数</th><th>失点率</th></tr>
                </thead>
                <tbody>
                  {analysis.courseLoss.map((c) => (
                    <tr key={c.course}>
                      <td><span className="row"><CourseBadge course={c.course} />{c.label}</span></td>
                      <td className="mono">{c.count}</td>
                      <td className="mono">{fmtRate(c.lossRate, c.count, c.ci)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <hr className="divider" style={{ margin: '12px 0' }} />
            <SectionLabel>サーブ別成績(自分)</SectionLabel>
            {analysis.serves.length === 0 ? (
              <p className="small muted">自分サーブのデータがない。</p>
            ) : (
              <table className="data">
                <thead>
                  <tr><th>球種</th><th>本数</th><th>得点率</th></tr>
                </thead>
                <tbody>
                  {analysis.serves.map((s) => (
                    <tr key={s.serveType}>
                      <td>{s.serveType}</td>
                      <td className="mono">{s.count}</td>
                      <td className="mono">{fmtRate(s.winRate, s.count, s.ci)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <hr className="divider" style={{ margin: '12px 0' }} />
            <SectionLabel>クラッチ(9点以遠)</SectionLabel>
            {analysis.clutch ? (
              <p>
                得点率 <span className="mono">{fmtRate(analysis.clutch.winRate, analysis.clutch.pt, analysis.clutch.ci)}</span>
                {' '}(全体比 <span className="mono">{fmtDiff(analysis.clutch.diff, analysis.clutch.pt)}</span>)
              </p>
            ) : (
              <p className="small muted">9点以遠の場面が4本未満のため算出しない。</p>
            )}
          </Card>

          {/* 4. 次の練習で1つだけやること(提案は1つ) */}
          <Card accent>
            <SectionLabel>次の練習で1つだけやること</SectionLabel>
            <p><strong>{analysis.suggestion.menu}</strong></p>
            <p className="small muted" style={{ marginTop: 4 }}>
              根拠: {analysis.suggestion.reasonLead}
              <span className="mono">{analysis.suggestion.reasonStat}</span>
              {analysis.suggestion.reasonTail}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              disabled={!!addedAssignment[match.id]}
              onClick={addAssignment}
            >
              {addedAssignment[match.id] ? '追加済み' : '練習リストに追加'}
            </button>
          </Card>

          {/* 5. カルテ更新案(承認パイプラインが積んだ要確認) */}
          {pendingApprovals.length > 0 && (
            <>
              <SectionLabel>カルテ更新案 — あなたの承認が必要</SectionLabel>
              {pendingApprovals.map((a) => (
                <ApprovalCard key={a.id} approval={a} onResolve={resolveApproval} />
              ))}
            </>
          )}

          {/* 6. 初見相手のカルテ作成 */}
          {isFirstMeeting ? (
            <Card>
              <SectionLabel>相手カルテ</SectionLabel>
              <p className="small">
                {match.opponentName} のカルテはまだない。この試合の集計から
                3項目(サーブ傾向 / レシーブの穴 / 勝負どころの癖)の雛形を作る。数値はすべて暫定。
              </p>
              <button className="btn" style={{ marginTop: 8 }} onClick={createOpponent}>
                相手カルテを作成
              </button>
            </Card>
          ) : (
            linkedOpponent && (
              <p className="small muted">
                <Link to={`/opponents/${linkedOpponent.id}`}>{linkedOpponent.name} の相手カルテを見る</Link>
              </p>
            )
          )}
        </>
      )}

      {/* 体調・試作の申告(任意・常に表示) */}
      <Card>
        <SectionLabel>この試合で伝えておくこと(任意)</SectionLabel>
        <p className="small muted">
          体調・試作サーブなどの背景があれば残しておく。判定の文脈として使う。
        </p>
        <div className="stack" style={{ marginTop: 8 }}>
          <textarea
            rows={2}
            value={memoText}
            placeholder="例: 風邪気味で足が動かなかった / 新しいYGサーブを試した"
            onChange={(e) => { setMemoText(e.target.value); setMemoSaved(false); }}
          />
          <div className="row">
            <button className="btn" disabled={!memoText.trim()} onClick={saveMemo}>
              コーチングメモとして提案
            </button>
            {memoSaved && <span className="small muted">カルテのコーチングメモに追加した。</span>}
          </div>
        </div>
      </Card>

      <p className="small muted">{v('encourage')}</p>
    </Screen>
  );
}
