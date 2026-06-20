/* ============================================================
   アプリシェル — ルーティング・ナビ・タイプ色浸透
   モバイル: 下タブ / PC(>=900px): 左レール
   ============================================================ */
import { useMemo } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { computeTypeResult } from '@/domain/typeEngine';
import { accentVars } from '@/domain/accent';
import { APP_NAME, APP_TAGLINE } from '@/brand';

import TourOverlay from '@/components/TourOverlay';
import WelcomeScreen from '@/screens/WelcomeScreen';
import HomeScreen from '@/screens/HomeScreen';
import DiagnosisScreen from '@/screens/DiagnosisScreen';
import CoachScreen from '@/screens/CoachScreen';
import MatchesScreen from '@/screens/MatchesScreen';
import MatchDetailScreen from '@/screens/MatchDetailScreen';
import KarteScreen from '@/screens/KarteScreen';
import OpponentsScreen from '@/screens/OpponentsScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const NAV = [
  {
    to: '/', label: 'ホーム', end: true,
    icon: <path d="M4 11 L12 4 L20 11 M6 10 V20 H18 V10" />,
  },
  {
    to: '/coach', label: 'コーチ',
    icon: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20 Q5 14.5 12 14.5 Q19 14.5 19 20" /><path d="M16.5 4.5 L19.5 2.5 M19.5 2.5 L21 5" /></>,
  },
  {
    to: '/matches', label: '試合',
    icon: <><circle cx="10.5" cy="9.5" r="6" /><path d="M15 14 L20 19" /></>,
  },
  {
    to: '/karte', label: 'カルテ',
    icon: <><path d="M6 3 H15 L19 7 V21 H6 Z" /><path d="M9 12 H16 M9 16 H16" /></>,
  },
  {
    to: '/settings', label: '設定',
    icon: <><circle cx="12" cy="12" r="3.5" /><path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.8 7.8 M16.2 16.2 L18.4 18.4 M18.4 5.6 L16.2 7.8 M7.8 16.2 L5.6 18.4" /></>,
  },
];

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const matches = useAppStore((s) => s.matches);
  const diagnosis = useAppStore((s) => s.diagnosis);
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const location = useLocation();

  const typeResult = useMemo(
    () => computeTypeResult(matches.filter((m) => m.approved), diagnosis, settings, todayStr()),
    [matches, diagnosis, settings],
  );
  const vars = useMemo(
    () => accentVars(typeResult.stage, typeResult.codename),
    [typeResult.stage, typeResult.codename],
  );

  if (!hydrated) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <p className="display" style={{ letterSpacing: '0.2em', fontSize: 32, color: 'var(--accent)' }}>{APP_NAME}</p>
        <div className="bubble typing" aria-label="起動中" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
          <span /><span /><span />
        </div>
        <p className="small muted">起動中…</p>
      </div>
    );
  }

  // 初回起動: 名前入力(オンボーディング)を先に通す
  if (!settings.onboarded) {
    return (
      <div className="accent-fade" style={vars as React.CSSProperties}>
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className="app-shell accent-fade" style={vars as React.CSSProperties}>
      <nav className="app-nav" aria-label="メインナビゲーション">
        <div className="nav-brand">
          <span className="display" style={{ fontSize: 22, color: 'var(--accent)', letterSpacing: '0.1em' }}>
            {APP_NAME}
          </span>
          <br />
          <span className="display" style={{ fontSize: 10, color: 'var(--line-dim)', letterSpacing: '0.18em' }}>
            {APP_TAGLINE}
          </span>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end as boolean | undefined}
            className={({ isActive }) => (isActive ? 'active accent-fade' : 'accent-fade')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {n.icon}
            </svg>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className={`app-main${location.pathname.startsWith('/coach') ? ' app-main--dark' : ''}`}>
        <div key={location.pathname} className="page-enter">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/diagnosis" element={<DiagnosisScreen />} />
          <Route path="/coach" element={<CoachScreen />} />
          <Route path="/matches" element={<MatchesScreen />} />
          <Route path="/matches/:id" element={<MatchDetailScreen />} />
          <Route path="/karte" element={<KarteScreen />} />
          <Route path="/opponents" element={<OpponentsScreen />} />
          <Route path="/opponents/:id" element={<OpponentsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
        </div>
      </main>

      {/* 使い方ガイド: ホーム初到達時に一度だけ自動表示 */}
      {location.pathname === '/' && !settings.tourSeen && (
        <TourOverlay onClose={() => setSettings({ tourSeen: true })} />
      )}
    </div>
  );
}
