/* ============================================================
   WelcomeScreen — 初回起動(オンボーディング)
   アプリの第一印象。プレイヤー名を最初に入力してから診断へ進む。
   名前は任意(あとで設定でも変更可)。デモ起動の入口も置く。
   ============================================================ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { APP_NAME, APP_PITCH, APP_TAGLINE } from '@/brand';
import Emblem from '@/components/Emblem';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const setSettings = useAppStore((s) => s.setSettings);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const [name, setName] = useState('');

  const start = () => {
    setSettings({ playerName: name.trim(), onboarded: true });
    navigate('/diagnosis');
  };
  const later = () => {
    setSettings({ playerName: name.trim(), onboarded: true });
    navigate('/');
  };
  const demo = () => {
    loadDemo();
    navigate('/');
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      <div className="fade-in" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {/* ブランドマーク */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Emblem stage="none" size={92} />
        </div>
        <h1
          className="display"
          style={{
            fontSize: 56,
            letterSpacing: '0.08em',
            margin: 0,
            background: 'linear-gradient(180deg, var(--court-line), color-mix(in srgb, var(--court-line) 55%, var(--line-dim)))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {APP_NAME}
        </h1>
        <p className="display" style={{ fontSize: 13, color: 'var(--line-dim)', letterSpacing: '0.22em', marginTop: 2 }}>
          {APP_TAGLINE}
        </p>
        <p className="small muted" style={{ marginTop: 14, lineHeight: 1.7 }}>{APP_PITCH}</p>

        {/* 名前入力 */}
        <section className="card accent-fade" style={{ marginTop: 24, textAlign: 'left' }}>
          <label htmlFor="welcome-name">コーチに呼ばれたい名前(任意)</label>
          <input
            id="welcome-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 悠真"
            autoComplete="off"
            style={{ marginTop: 8 }}
            onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
          />
          <p className="small muted" style={{ marginTop: 8 }}>
            あとで設定からいつでも変更できます。データはこの端末内にのみ保存されます。
          </p>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={start}>
            はじめる(診断へ・約2分)
          </button>
          <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={later}>診断はあとで</button>
            <span className="muted">·</span>
            <button className="btn btn-ghost" onClick={demo}>デモで試す</button>
          </div>
        </section>
      </div>
    </div>
  );
}
