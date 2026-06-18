/* ============================================================
   CoachScreen — コーチ(3タブ)
   画面下の3タブで切替: ①練習メニュー ②戦術アドバイス ③弱点分析
   「今のおすすめ」を視覚的に強調し、ヘルプで時系列(普段の練習↔試合前)の
   使い分けを説明する。スマホ主・PC/タブレット対応。
   ============================================================ */
import { useMemo, useState } from 'react';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { OUT_OF_SCOPE_NOTICE } from '@/domain/constants';
import { Card, Collapsible, Screen, SectionLabel } from '@/components/ui';
import { FlowSteps } from '@/components/charts';
import PracticeMenuTab from '@/screens/coach/PracticeMenuTab';
import TacticsTab from '@/screens/coach/TacticsTab';
import WeaknessTab from '@/screens/coach/WeaknessTab';

type TabKey = 'practice' | 'tactics' | 'weakness';

const TABS: { key: TabKey; label: string; icon: string; when: string }[] = [
  { key: 'practice', label: '練習メニュー', icon: '📋', when: '普段の練習' },
  { key: 'tactics', label: '戦術アドバイス', icon: '🎯', when: '試合前' },
  { key: 'weakness', label: '弱点分析', icon: '🔍', when: '試合後・自己分析' },
];

export default function CoachScreen() {
  const matches = useAppStore((s) => s.matches);
  const today = todayStr();

  // 今のおすすめ: 今日が試合日なら戦術、ふだんは練習メニュー
  const hasMatchToday = useMemo(() => matches.some((m) => m.date === today), [matches, today]);
  const recommended: TabKey = hasMatchToday ? 'tactics' : 'practice';
  const recoReason = hasMatchToday
    ? '今日は試合の記録があります。相手に合わせた作戦を確認しましょう。'
    : '試合の予定がなければ、まずは今日の練習メニューから。';

  const [tab, setTab] = useState<TabKey>(recommended);

  return (
    <Screen title="コーチ">
      {/* 今のおすすめ(視覚的に強調) */}
      <Card accent>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 26 }}>{TABS.find((t) => t.key === recommended)?.icon}</span>
          <div style={{ minWidth: 0 }}>
            <SectionLabel>今のおすすめ</SectionLabel>
            <p style={{ fontWeight: 700, color: 'var(--accent)' }}>
              {TABS.find((t) => t.key === recommended)?.label}
            </p>
            <p className="small muted" style={{ marginTop: 2 }}>{recoReason}</p>
          </div>
        </div>
      </Card>

      {/* 使い方(時系列の使い分け) */}
      <Collapsible title="使い方" openLabel="使い方を見る(いつ・どれを使う?)" closeLabel="とじる">
        <Card>
          <SectionLabel>時系列での使い分け</SectionLabel>
          <FlowSteps
            steps={[
              { title: '📋 普段の練習', sub: '練習メニュー — 強み/弱点を選ぶだけで今日のメニュー' },
              { title: '🎯 試合前', sub: '戦術アドバイス — 相手の作戦カード＋勝つための戦術' },
              { title: '🔍 試合後・自己分析', sub: '弱点分析 — 崩れやすい形を確認して次の練習へ' },
            ]}
          />
          <p className="small muted" style={{ marginTop: 10 }}>{OUT_OF_SCOPE_NOTICE}</p>
        </Card>
      </Collapsible>

      {/* タブ内容 */}
      <div key={tab} className="fade-in">
        {tab === 'practice' && <PracticeMenuTab />}
        {tab === 'tactics' && <TacticsTab />}
        {tab === 'weakness' && <WeaknessTab />}
      </div>

      {/* 画面下の3タブ(グローバルナビの上にフロート) */}
      <nav className="coach-tabs" aria-label="コーチのモード切替">
        {TABS.map((t) => {
          const active = t.key === tab;
          const isReco = t.key === recommended;
          return (
            <button
              key={t.key}
              className={`coach-tab${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => setTab(t.key)}
            >
              {isReco && <span className="coach-tab-reco">おすすめ</span>}
              <span className="coach-tab-icon" aria-hidden="true">{t.icon}</span>
              <span className="coach-tab-label">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </Screen>
  );
}
