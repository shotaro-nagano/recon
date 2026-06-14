/* ============================================================
   MatchesScreen — 試合データ管理(一覧・承認フロー・CSVインポート)
   承認済みデータのみが計算ソースになる(絶対ルール)。
   そのため未承認試合の確認→承認をこの画面の最上部に置く。
   ============================================================ */
import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { uid, useAppStore } from '@/store/useAppStore';
import type { Match } from '@/domain/types';
import { CSV_TEMPLATE, parseMatchCsv } from '@/domain/csv';
import { serveStats } from '@/domain/insights';
import { fmtRate } from '@/domain/stats';
import { Card, EmptyState, Screen, SectionLabel } from '@/components/ui';

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
          <div className="small muted">
            未承認 ・ {m.source}
            {m.tournament ? ` ・ ${m.tournament}` : ''}
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
            <div className="muted" style={{ marginBottom: 4 }}>
              サーブ内訳(自分のサーブ <span className="mono">{myServeTotal}</span>本)
            </div>
            {myServes.length === 0 ? (
              <div className="muted">自分のサーブの記録がない</div>
            ) : (
              myServes.map((s) => (
                <div key={s.serveType} className="spread">
                  <span>
                    {s.serveType} <span className="mono muted">×{s.count}</span>
                  </span>
                  <span className="mono">{fmtRate(s.winRate, s.count, s.ci)}</span>
                </div>
              ))
            )}
          </div>
          <p className="small muted">
            承認するとタイプ計算とカルテに反映される。不採用にすると計算には使わず、未取込リスト(欠損の記録)に移る。
          </p>
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

  /* ---- CSVインポート ---- */
  const [csvText, setCsvText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [partialMatch, setPartialMatch] = useState<Match | null>(null); // エラー行ありの解析結果
  const [importedMsg, setImportedMsg] = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);

  const commit = (m: Match) => {
    // 相手名が既存の相手カルテと一致すれば紐付ける(なければ試合後モードで作成を促す)
    const opp = opponents.find((o) => o.name === m.opponentName);
    addMatch(opp ? { ...m, opponentId: opp.id } : m);
    setCsvText('');
    setImportErrors([]);
    setPartialMatch(null);
    setImportedMsg(
      `${m.date} vs ${m.opponentName}(ラリー${m.rallies.length}本)を未承認として追加した。上の「承認待ちの試合」から内容を確認して承認しよう。`,
    );
  };

  const handleImport = () => {
    setImportedMsg(null);
    const { match, errors } = parseMatchCsv(csvText, uid());
    if (!match) {
      setImportErrors(errors);
      setPartialMatch(null);
      return;
    }
    if (errors.length > 0) {
      setImportErrors(errors);
      setPartialMatch(match);
      return;
    }
    commit(match);
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
      setImportErrors([]);
      setPartialMatch(null);
      setImportedMsg(null);
    };
    reader.readAsText(f);
    e.target.value = ''; // 同じファイルを選び直せるように
  };

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

      {/* ---- 承認済み一覧(日付降順) ---- */}
      <SectionLabel>承認済みの試合</SectionLabel>
      {approved.length === 0 ? (
        <Card>
          <EmptyState
            title={matches.length === 0 ? '試合データはまだない' : '承認済みの試合はまだない'}
            hint={
              matches.length === 0
                ? '下の取込欄にCSVを貼り付けるかファイルを選ぶと、ここに試合が並びはじめる'
                : '上の承認待ちカードから内容を確認して承認しよう'
            }
          />
        </Card>
      ) : (
        <Card>
          {approved.map((m, i) => (
            <div key={m.id}>
              {i > 0 && <hr className="divider" />}
              <Link to={`/matches/${m.id}`} style={{ color: 'var(--court-line)', display: 'block' }}>
                <div className="spread" style={{ padding: '10px 0' }}>
                  <div>
                    <div>
                      <span className="mono">{m.date}</span> vs {m.opponentName}
                    </div>
                    <div className="small muted">
                      {m.tournament ? `${m.tournament} ・ ` : ''}
                      {m.source} ・ 承認済み
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 18 }}>{m.mySets}-{m.oppSets}</span>
                </div>
              </Link>
            </div>
          ))}
        </Card>
      )}

      {/* ---- CSVインポート ---- */}
      <SectionLabel>CSVを取り込む</SectionLabel>
      <Card>
        <div className="stack">
          <p className="small muted">
            得点チェックリスト・撮影判定アプリが出力した1試合1ファイルのCSVを貼り付けるか、ファイルを選ぶ。
            取り込んだ試合は未承認として追加され、あなたが承認するまで計算には使われない。
          </p>
          <textarea
            rows={6}
            className="mono"
            style={{ fontSize: 13 }}
            placeholder={'# date: 2026-06-13\n# opponent: 山田太郎\nset,my_score,... をここに貼り付け'}
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setImportedMsg(null); }}
            aria-label="CSV貼り付け欄"
          />
          <label className="small">
            ファイルから読み込む(選ぶと上の欄に内容が入る)
            <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ marginTop: 4 }} />
          </label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={csvText.trim().length === 0}
            >
              取り込む
            </button>
            <button className="btn btn-ghost" onClick={() => setShowTemplate((v) => !v)}>
              {showTemplate ? 'テンプレートを閉じる' : 'テンプレートを見る'}
            </button>
          </div>

          {showTemplate && (
            <div>
              <p className="small muted">先頭の「#」行がメタ情報、その下が1ラリー1行(9列)。</p>
              <pre
                className="mono small"
                style={{
                  margin: '6px 0 0',
                  padding: 12,
                  background: 'var(--night-court)',
                  border: '1px solid var(--divider)',
                  borderRadius: 'var(--radius)',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                }}
              >
                {CSV_TEMPLATE}
              </pre>
            </div>
          )}

          {importErrors.length > 0 && (
            <div style={{ border: '1px solid var(--divider-strong)', borderRadius: 'var(--radius)', padding: 12 }}>
              <p className="small" style={{ fontWeight: 700 }}>取り込めなかった行がある</p>
              <ul className="small muted" style={{ margin: '4px 0 8px', paddingLeft: 18 }}>
                {importErrors.map((er, i) => (
                  <li key={i} className="mono">{er}</li>
                ))}
              </ul>
              <p className="small muted">
                テンプレートと同じ列順(9列・serve_courseは1-6)になっているか確認し、修正してからもう一度「取り込む」を押そう。
              </p>
              {partialMatch && (
                <div className="stack" style={{ marginTop: 8 }}>
                  <p className="small">
                    エラー行を除いた<span className="mono">{partialMatch.rallies.length}</span>本のラリーで取り込むこともできる。
                  </p>
                  <div className="row">
                    <button className="btn" onClick={() => commit(partialMatch)}>エラー行を除いて取り込む</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {importedMsg && (
            <p className="small" style={{ color: 'var(--accent)' }}>{importedMsg}</p>
          )}
        </div>
      </Card>

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
