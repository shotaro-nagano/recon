/* ============================================================
   TourOverlay — 使い方ガイド(全画面・アニメーション付き)
   名前入力+診断のあと、ホーム初到達時に一度だけ自動表示する。
   各画面の役割を1分で説明し、最後に最初の一歩へ送り出す。
   ============================================================ */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/brand';

interface Step {
  /** タブ名(該当画面のステップで下部に表示) */
  tab?: string;
  title: string;
  body: ReactNode;
  icon: ReactNode;
}

const ic = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const STEPS: Step[] = [
  {
    title: `${APP_NAME}へようこそ`,
    body: <>試合データと会話から、<b>あなた専用のコーチ</b>が育っていきます。<br />まずは使い方を1分で見ていきましょう。</>,
    icon: ic(<><polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" /><circle cx="12" cy="12" r="3.2" /></>),
  },
  {
    tab: 'ホーム',
    title: 'ホーム = 今の自分',
    body: <>あなたの<b>コードネーム(プレースタイル)</b>と分析の精度、<br /><b>次にやること</b>が一目で分かります。迷ったらここに戻る。</>,
    icon: ic(<><path d="M4 11 L12 4 L20 11" /><path d="M6 10 V20 H18 V10" /></>),
  },
  {
    tab: 'コーチ',
    title: 'コーチ = 3つの相談',
    body: <><b>試合前</b>は戦術カード、<b>試合後</b>は振り返り、<b>週末</b>は練習メニュー。<br />困ったらまずコーチを開けば大丈夫。</>,
    icon: ic(<><circle cx="12" cy="8" r="3.4" /><path d="M5 20 Q5 14.5 12 14.5 Q19 14.5 19 20" /></>),
  },
  {
    tab: '試合',
    title: '試合 = データを入れる',
    body: <>試合のCSVを取り込み、<b>あなたが承認した試合だけ</b>が分析に使われます。<br />承認制だから、いい加減なデータで判定がブレません。</>,
    icon: ic(<><circle cx="10.5" cy="9.5" r="6" /><path d="M15 14 L20 19" /></>),
  },
  {
    tab: 'カルテ',
    title: 'カルテ = 育つ記録',
    body: <>強み・弱点・<b>崩れる時のパターン</b>・練習の成果がたまっていく場所。<br />試合を重ねるほど、あなただけのカルテになります。</>,
    icon: ic(<><path d="M6 3 H15 L19 7 V21 H6 Z" /><path d="M9 12 H16 M9 16 H16" /></>),
  },
  {
    title: '迷わないための「かんたんモード」',
    body: <>最初は<b>よく使う機能だけ</b>を表示しています。<br />慣れてきたら<b>設定 → かんたんモードをオフ</b>にすると、詳しい記録や上級機能がすべて使えます。</>,
    icon: ic(<><circle cx="12" cy="12" r="3.4" /><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.8 7.8 M16.2 16.2 L18.4 18.4 M18.4 5.6 L16.2 7.8 M7.8 16.2 L5.6 18.4" /></>),
  },
  {
    title: 'データは全部、この端末の中だけ',
    body: <>共有も外部送信もありません。安心して書き込めます。<br />さっそく<b>「コーチ」</b>から、試合前の戦術カードを見てみましょう。</>,
    icon: ic(<><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10 V7 a4 4 0 0 1 8 0 V10" /></>),
  },
];

export default function TourOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="使い方ガイド"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--night-court)',
        display: 'flex', flexDirection: 'column',
        padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}
    >
      {/* 上部: 進捗ドット + スキップ */}
      <div className="spread">
        <div className="row" style={{ gap: 6 }} aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 22 : 7, height: 7, borderRadius: 999,
                background: i === step ? 'var(--accent)' : 'var(--divider-strong)',
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }}
            />
          ))}
        </div>
        <button className="btn btn-ghost" style={{ minHeight: 36, padding: '4px 10px' }} onClick={onClose}>
          スキップ
        </button>
      </div>

      {/* 本体(ステップ切替でアニメーション) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div key={step} className="tour-in" style={{ maxWidth: 380 }}>
          <div
            className="tour-pop"
            style={{
              width: 96, height: 96, margin: '0 auto 26px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 24, color: 'var(--accent)',
              background: 'var(--accent-faint)',
              border: '1px solid var(--accent-soft)',
            }}
          >
            <span style={{ width: 46, height: 46, display: 'block' }}>{s.icon}</span>
          </div>
          {s.tab && (
            <span className="hex-badge mono" style={{ background: 'var(--accent-faint)', color: 'var(--accent)', fontSize: 11, marginBottom: 10 }}>
              {s.tab} タブ
            </span>
          )}
          <h2 className="display" style={{ fontSize: 26, margin: '6px 0 12px' }}>{s.title}</h2>
          <p style={{ color: 'var(--court-line)', lineHeight: 1.8 }}>{s.body}</p>
        </div>
      </div>

      {/* 下部: 戻る / 次へ・はじめる */}
      <div className="row" style={{ gap: 10 }}>
        {step > 0 && (
          <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => setStep(step - 1)}>戻る</button>
        )}
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => (last ? onClose() : setStep(step + 1))}
        >
          {last ? 'はじめる' : `次へ（${step + 1}/${STEPS.length}）`}
        </button>
      </div>
    </div>
  );
}
