/* ============================================================
   CoachScreen — コーチ(3タブ・ダーク/タクティカル)
   画面下の3タブで切替: ①練習メニュー ②戦術アドバイス ③弱点分析
   「今のおすすめ」をネオンで強調し、ヘルプで時系列(普段の練習↔試合前)を
   説明。/coach のとき .app-main--dark でダーク・タクティカル表示になる。
   ============================================================ */
import { useMemo, useState } from 'react';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { OUT_OF_SCOPE_NOTICE } from '@/domain/constants';
import { Card, Collapsible, Screen, SectionLabel } from '@/components/ui';
import { FlowSteps } from '@/components/charts';
import PracticeMenuTab from '@/screens/coach/PracticeMenuTab';
import TacticsTab from '@/screens/coach/TacticsTab';
import WeaknessTab from '@/screens/coach/WeaknessTab';
import { IconPractice, IconTactics, IconWeakness, IconHelp } from '@/screens/coach/icons';

type TabKey = 'practice' | 'tactics' | 'weakness';

const TABS: { key: TabKey; label: string; Icon: (p: { size?: number }) => JSX.Element; when: string }[] = [
  { key: 'practice', label: '練習メニュー', Icon: IconPractice, when: '普段の練習' },
  { key: 'tactics', label: '戦術アドバイス', Icon: IconTactics, when: '試合前' },
  { key: 'weakness', label: '弱点分析', Icon: IconWeakness, when: '試合後・自己分析' },
];

export default function CoachScreen() {
  const matches = useAppStore((s) => s.matches);
  const today = todayStr();

  const hasMatchToday = useMemo(() => matches.some((m) => m.date === today), [matches, today]);
  const recommended: TabKey = hasMatchToday ? 'tactics' : 'practice';
  const recoReason = hasMatchToday
    ? '今日は試合の記録があります。相手に合わせた作戦を確認しましょう。'
    : '試合の予定がなければ、まずは今日の練習メニューから。';

  const [tab, setTab] = useState<TabKey>(recommended);
  const RecoIcon = TABS.find((t) => t.key === recommended)!.Icon;
  const recoLabel = TABS.find((t) => t.key === recommended)!.label;

  return (
    <Screen title="コーチ" right={<span className="coach-hud-tag">RECON · TACTICAL</span>}>
      {/* 今のおすすめ(ネオン・ヒーロー) */}
      <section className="card coach-hero accent-fade">
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <span className="coach-hero-icon"><RecoIcon size={24} /></span>
          <div style={{ minWidth: 0 }}>
            <span className="coach-eyebrow">▸ 今のおすすめ / RECOMMENDED</span>
            <p className="display" style={{ fontSize: 19, color: 'var(--accent)', marginTop: 2 }}>{recoLabel}</p>
            <p className="small muted" style={{ marginTop: 3 }}>{recoReason}</p>
          </div>
        </div>
      </section>

      {/* 使い方(時系列の使い分け) */}
      <Collapsible
        title="使い方"
        openLabel="使い方を見る(いつ・どれを使う?)"
        closeLabel="とじる"
      >
        <Card>
          <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: 'var(--accent)', display: 'grid', placeItems: 'center' }}><IconHelp size={18} /></span>
            <SectionLabel>時系列での使い分け</SectionLabel>
          </div>
          <FlowSteps
            steps={[
              { title: '普段の練習 → 練習メニュー', sub: '強み/弱点を選ぶだけで今日のメニュー' },
              { title: '試合前 → 戦術アドバイス', sub: '相手の作戦カード＋勝つための戦術' },
              { title: '試合後・自己分析 → 弱点分析', sub: '崩れやすい形を確認して次の練習へ' },
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

      {/* 画面下の3タブ */}
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
              <span className="coach-tab-ico" aria-hidden="true"><t.Icon size={21} /></span>
              <span className="coach-tab-label">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </Screen>
  );
}
