/* ============================================================
   タイプ診断 — オンボーディング7問ウィザード(約2分)
   1問ずつ・進捗表示・戻る可。完了で仮タイプの発表演出。
   再受験はいつでも可(実測タイプには影響しない)
   ============================================================ */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { Card, Screen, SectionLabel, TypeBadge } from '@/components/ui';
import Emblem from '@/components/Emblem';
import { CODENAMES, GRIP_OPTIONS, MEASURED_MIN_MATCHES, STYLE_OPTIONS, VARIANT_READING } from '@/domain/constants';
import { computeTypeResult, provisionalType, selfGap } from '@/domain/typeEngine';
import { typeColor } from '@/domain/accent';
import { fmtDiff } from '@/domain/stats';
import type { DiagnosisAnswers } from '@/domain/types';

type Phase = 'intro' | 'quiz' | 'result';
type AB = 'a' | 'b';

interface Draft {
  style?: string;
  grip?: string;
  selfRating?: number;
  q4?: AB;
  q5?: AB;
  q6?: AB;
  q7?: AB;
}

/* 質問定義(軸コードはUIに出さない — 回答誘導を避ける) */
type QDef =
  | { kind: 'choice'; key: 'style' | 'grip'; prompt: ReactNode; options: string[] }
  | { kind: 'rating'; prompt: ReactNode }
  | { kind: 'ab'; key: 'q4' | 'q5' | 'q6' | 'q7'; prompt: ReactNode; a: string; b: string };

const QUESTIONS: QDef[] = [
  { kind: 'choice', key: 'style', prompt: 'あなたの戦型は?', options: STYLE_OPTIONS },
  { kind: 'choice', key: 'grip', prompt: '利き手とグリップは?', options: GRIP_OPTIONS },
  { kind: 'rating', prompt: '終盤の競り合い、自分はどれくらい強いと思う?' },
  {
    kind: 'ab', key: 'q4',
    prompt: <>相手のレシーブが浅く浮いた。スコアは <span className="mono">9-9</span>。あなたは?</>,
    a: '迷わず強打する',
    b: '深く送って次で仕留める',
  },
  {
    kind: 'ab', key: 'q5',
    prompt: <>得意サーブが <span className="mono">2</span> 本連続で効かれた。あなたは?</>,
    a: '別のサーブに切り替える',
    b: '同じサーブの精度を上げて押し切る',
  },
  {
    kind: 'ab', key: 'q6',
    prompt: '自分の勝ちパターンに近いのは?',
    a: '序盤に飛ばして逃げ切る',
    b: '様子を見て終盤に仕掛ける',
  },
  {
    kind: 'ab', key: 'q7',
    prompt: <><span className="mono">10-10</span> で自分のサーブ。あなたは?</>,
    a: '一番得意なサーブで勝負する',
    b: '相手が嫌がりそうなサーブを探す',
  },
];

const TOTAL = QUESTIONS.length;

/* 大きなタップしやすいカード型の選択肢ボタン */
function OptionButton({ children, selected, onSelect }: {
  children: ReactNode; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      className="btn"
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        textAlign: 'left',
        minHeight: 56,
        padding: '14px 16px',
        borderColor: selected ? 'var(--accent)' : undefined,
        background: selected ? 'var(--accent-faint)' : undefined,
      }}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

export default function DiagnosisScreen() {
  const navigate = useNavigate();
  const diagnosis = useAppStore((s) => s.diagnosis);
  const matches = useAppStore((s) => s.matches);
  const settings = useAppStore((s) => s.settings);
  const completeDiagnosis = useAppStore((s) => s.completeDiagnosis);

  const [phase, setPhase] = useState<Phase>('intro');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [done, setDone] = useState<DiagnosisAnswers | null>(null);

  const approved = useMemo(() => matches.filter((m) => m.approved), [matches]);
  const retake = diagnosis != null || done != null;

  /* 回答 → 次の質問へ。最終問なら確定 */
  const answer = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (step < TOTAL - 1) {
      setStep(step + 1);
    } else {
      // ウィザードを順に通過した時点で全項目が埋まっている
      const answers: DiagnosisAnswers = {
        style: next.style!,
        grip: next.grip!,
        selfRating: next.selfRating!,
        q4: next.q4!,
        q5: next.q5!,
        q6: next.q6!,
        q7: next.q7!,
        answeredAt: todayStr(),
      };
      completeDiagnosis(answers);
      setDone(answers);
      setPhase('result');
    }
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
    else setPhase('intro');
  };

  /* ---------------- 入口 ---------------- */
  if (phase === 'intro') {
    return (
      <Screen title="タイプ診断">
        <Card>
          <SectionLabel>{retake ? '再受験' : 'オンボーディング'}</SectionLabel>
          <p>
            全 <span className="mono">{TOTAL}</span> 問(約 <span className="mono">2</span> 分)で、
            あなたの仮コードネームを解析します。
          </p>
          <p className="small muted" style={{ marginTop: 8 }}>
            承認済み <span className="mono" style={{ color: 'var(--accent)' }}>{MEASURED_MIN_MATCHES}</span> 試合で実測タイプに進化します。
          </p>
          {retake && (
            <p className="small muted" style={{ marginTop: 8 }}>
              再受験はいつでも可能です。診断は実測タイプには影響せず、自己認識の変化として記録されます。
            </p>
          )}
          <div className="row" style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => { setDraft({}); setStep(0); setPhase('quiz'); }}
            >
              {retake ? 'もう一度診断する' : '診断を始める'}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              ホームに戻る
            </button>
          </div>
        </Card>
      </Screen>
    );
  }

  /* ---------------- 発表演出 ---------------- */
  if (phase === 'result' && done) {
    const prov = provisionalType(done);
    const def = CODENAMES[prov.codename];
    const result = computeTypeResult(approved, done, settings, todayStr());
    const measured = result.stage === 'measured';
    const gap = measured ? selfGap(done, result) : null;

    return (
      <Screen title="タイプ診断">
        <Card>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
            <SectionLabel>解析完了 — 仮コードネーム</SectionLabel>
            <Emblem codename={prov.codename} variant={prov.variant} stage="provisional" size={140} reveal />
            <div>
              <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
                <span className="display" style={{ fontSize: 40, color: typeColor(prov.codename) }}>
                  {prov.codename}
                </span>
                <span
                  className={`hex-badge mono ${prov.variant === 'omega' ? 'badge-omega' : 'badge-alpha'}`}
                  style={{ fontSize: 15, padding: '4px 14px' }}
                >
                  {prov.variant === 'omega' ? 'Ω' : 'α'}
                </span>
              </div>
              <p className="display" style={{ fontSize: 15, color: 'var(--line-dim)', letterSpacing: '0.12em', marginTop: 6 }}>
                {def.reading}・{VARIANT_READING[prov.variant]}
              </p>
              <p style={{ marginTop: 8 }}>{def.style}</p>
              <p className="small muted">{def.winPattern}</p>
            </div>
            {!measured && (
              <p className="small muted">
                承認済み <span className="mono" style={{ color: 'var(--accent)' }}>{MEASURED_MIN_MATCHES}</span> 試合で実測タイプに進化。
              </p>
            )}
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              ホームに戻る
            </button>
          </div>
        </Card>

        {measured && result.codename && (
          <Card accent>
            <SectionLabel>再受験メモ</SectionLabel>
            <p className="small">
              この診断は実測タイプには影響しません。自己認識の変化として記録しました。
            </p>
            <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <span className="small muted">現在の実測タイプ:</span>
              <TypeBadge
                codename={result.codename}
                variant={result.variant}
                beta={result.beta}
                boundaryWith={result.boundaryWith}
              />
            </div>
            {gap && (
              <>
                <hr className="divider" style={{ margin: '12px 0' }} />
                <SectionLabel>自己評価と実測のギャップ</SectionLabel>
                <p className="small">
                  競り合いの自己評価 <span className="mono">{gap.selfRating}/5</span>
                  {result.clutch && gap.measuredDiff != null && (
                    <>
                      {' '}/ 実測クラッチ{' '}
                      <span className="mono">
                        {fmtDiff(gap.measuredDiff, result.clutch.pt, result.clutch.ci)}
                      </span>
                    </>
                  )}
                </p>
                <p className="small muted" style={{ marginTop: 4 }}>{gap.text}</p>
              </>
            )}
          </Card>
        )}
      </Screen>
    );
  }

  /* ---------------- ウィザード本体 ---------------- */
  const q = QUESTIONS[step];
  const progress = ((step + 1) / TOTAL) * 100;

  return (
    <Screen title="タイプ診断">
      <Card>
        <div className="spread">
          <button className="btn btn-ghost" style={{ minHeight: 38, padding: '6px 10px' }} onClick={back}>
            戻る
          </button>
          <span className="small muted">
            質問 <span className="mono">{step + 1}/{TOTAL}</span>
          </span>
        </div>
        <div className="meter-track" style={{ margin: '10px 0 16px' }}>
          <div className="meter-band" style={{ left: 0, right: `${100 - progress}%` }} />
        </div>

        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{q.prompt}</p>

        {q.kind === 'choice' && (
          <div className="stack">
            {q.options.map((opt) => (
              <OptionButton
                key={opt}
                selected={draft[q.key] === opt}
                onSelect={() => answer({ [q.key]: opt })}
              >
                {opt}
              </OptionButton>
            ))}
          </div>
        )}

        {q.kind === 'rating' && (
          <div className="stack">
            <div className="row" style={{ gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className="btn mono"
                  style={{
                    flex: 1,
                    minHeight: 56,
                    fontSize: 18,
                    borderColor: draft.selfRating === n ? 'var(--accent)' : undefined,
                    background: draft.selfRating === n ? 'var(--accent-faint)' : undefined,
                  }}
                  onClick={() => answer({ selfRating: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="spread small muted">
              <span>苦手</span>
              <span>得意</span>
            </div>
          </div>
        )}

        {q.kind === 'ab' && (
          <div className="stack">
            <OptionButton selected={draft[q.key] === 'a'} onSelect={() => answer({ [q.key]: 'a' })}>
              {q.a}
            </OptionButton>
            <OptionButton selected={draft[q.key] === 'b'} onSelect={() => answer({ [q.key]: 'b' })}>
              {q.b}
            </OptionButton>
          </div>
        )}
      </Card>
    </Screen>
  );
}
