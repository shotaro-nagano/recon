/* ============================================================
   CoachScreen — コーチハブ
   コーチの人格が見える入口。挨拶・データ残高・直近セッション要約・
   3モードへの入口・本人申告(誤った弱点認定の防止)
   ============================================================ */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayStr, uid, useAppStore } from '@/store/useAppStore';
import { computeTypeResult } from '@/domain/typeEngine';
import { OUT_OF_SCOPE_NOTICE, voice } from '@/domain/persona';
import { MEASURED_MIN_MATCHES } from '@/domain/constants';
import { Card, Screen, SectionLabel } from '@/components/ui';

const MODES = [
  {
    to: '/coach/pre',
    title: '試合前 — 戦術カード',
    desc: '相手に合わせた作戦をスクロールなしの1画面で出す',
  },
  {
    to: '/coach/post',
    title: '試合後 — 振り返り',
    desc: '良かったデータから「次の練習で1つだけやること」まで',
  },
  {
    to: '/coach/weekly',
    title: '週次 — 週間レビュー',
    desc: '練習メニューの提案と軸スコアの推移を確認する',
  },
] as const;

export default function CoachScreen() {
  const settings = useAppStore((s) => s.settings);
  const diagnosis = useAppStore((s) => s.diagnosis);
  const matches = useAppStore((s) => s.matches);
  const sessions = useAppStore((s) => s.sessions);
  const updateKarte = useAppStore((s) => s.updateKarte);

  const simple = settings.simpleMode;
  const [memoText, setMemoText] = useState('');
  const [memoFeedback, setMemoFeedback] = useState<string | null>(null);

  const result = useMemo(
    () => computeTypeResult(matches.filter((m) => m.approved), diagnosis, settings, todayStr()),
    [matches, diagnosis, settings],
  );

  const say = voice(settings.persona);
  const recentSessions = sessions.slice(-2).reverse();

  // データ残高の添え書き(状況に応じて)
  const growExtra =
    result.stage === 'measured'
      ? '実測タイプで運用中。'
      : result.stage === 'provisional'
        ? `実測タイプまであと${Math.max(0, MEASURED_MIN_MATCHES - result.matchCount)}試合。`
        : 'まずは診断から始めよう。';

  const submitMemo = () => {
    const text = memoText.trim();
    if (!text) return;
    // 本人入力 = 本人承認済みとして memos へ直接追加(スナップショット付き)
    updateKarte('コーチングメモ追加(本人申告)', (k) => {
      k.memos.push({ id: uid(), date: todayStr(), text });
    });
    setMemoText('');
    setMemoFeedback('カルテのコーチングメモに記録しました — 誤った弱点認定を防ぎます');
  };

  return (
    <Screen title="コーチ">
      {/* 挨拶 */}
      <Card accent>
        <p>
          {say('greet', {
            codename: result.codename,
            name: settings.playerName || undefined,
          })}
        </p>
      </Card>

      {/* データ残高 */}
      <Card>
        <SectionLabel>データ残高</SectionLabel>
        <div className="row" style={{ alignItems: 'baseline', gap: 4 }}>
          <span className="mono" style={{ fontSize: 30 }}>{result.totalPt}</span>
          <span className="mono muted">pt</span>
          <span className="small muted" style={{ marginLeft: 12 }}>
            承認済み <span className="mono">{result.matchCount}</span>試合
          </span>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {say('dataGrow', { pt: result.totalPt, extra: growExtra })}
        </p>
      </Card>

      {/* 直近セッション要約 — 先週話したことを忘れない */}
      <Card>
        <SectionLabel>前回までのセッション</SectionLabel>
        {recentSessions.length === 0 ? (
          <p className="small muted">
            まだセッションの記録がない。下のモードを使うと、ここに要約が残り次回に引き継がれる。
          </p>
        ) : (
          <div className="stack">
            {recentSessions.map((s, i) => (
              <div key={s.id} className="stack" style={{ gap: 4 }}>
                {i > 0 && <hr className="divider" />}
                <div className="row small muted">
                  <span className="mono">{s.date}</span>
                  <span>{s.mode}</span>
                </div>
                <p className="small">{s.summary}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 3モードへの入口 */}
      <SectionLabel>コーチングモード</SectionLabel>
      {MODES.map((m) => (
        <Link key={m.to} to={m.to} style={{ display: 'block', color: 'inherit' }}>
          <Card>
            <div className="spread">
              <div>
                <h2 className="display" style={{ fontSize: 16, color: 'var(--accent)' }}>
                  {m.title}
                </h2>
                <p className="small muted" style={{ marginTop: 4 }}>{m.desc}</p>
              </div>
              <span className="muted" aria-hidden="true">→</span>
            </div>
          </Card>
        </Link>
      ))}

      {/* 伝えておくこと(本人申告・上級) */}
      {!simple && (
      <Card>
        <SectionLabel>伝えておくこと(任意)</SectionLabel>
        <div className="stack">
          <p className="small muted">
            体調・怪我明け・試作サーブなどを先に申告しておくと、その期間のデータを弱点として誤認しない。
          </p>
          <textarea
            rows={3}
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="例: 今週は新しい巻き込みサーブを試している"
            aria-label="コーチに伝えておくこと"
          />
          <div className="row">
            <button className="btn btn-primary" onClick={submitMemo} disabled={!memoText.trim()}>
              コーチングメモに記録
            </button>
          </div>
          {memoFeedback && (
            <p className="small" style={{ color: 'var(--accent)' }}>{memoFeedback}</p>
          )}
        </div>
      </Card>
      )}

      {/* データ取り込みの誘い(1画面で1度だけ・控えめに) */}
      <p className="small muted">
        試合データ(CSV・撮影判定)を取り込むほど判定の精度が上がる。
        <Link to="/matches">試合画面から取り込む</Link>
      </p>

      <hr className="divider" />
      <p className="small muted">{OUT_OF_SCOPE_NOTICE}</p>
    </Screen>
  );
}
