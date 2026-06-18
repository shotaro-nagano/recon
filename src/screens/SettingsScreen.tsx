/* ============================================================
   SettingsScreen — 設定
   スキン・β情報・練習フォーカスの記録(裏DB)・データ管理
   (スナップショット復元 / デモ / 全削除は confirm 必須)
   ============================================================ */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { todayStr, useAppStore } from '@/store/useAppStore';
import { isBeta } from '@/domain/typeEngine';
import { SKIN_INFO } from '@/domain/constants';
import { FOCUS_LABEL } from '@/domain/coach/drills';
import type { Skin } from '@/domain/types';
import { APP_BUILD, APP_NAME, APP_VERSION } from '@/brand';
import { Card, Collapsible, Screen, SectionLabel, Segmented } from '@/components/ui';

const SKIN_KEYS = Object.keys(SKIN_INFO) as Skin[];
const SNAPSHOT_SHOW = 10;

/** ISO日時 → "YYYY-MM-DD HH:mm" */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings);
  const snapshots = useAppStore((s) => s.snapshots);
  const practiceFocusLog = useAppStore((s) => s.practiceFocusLog);
  const setSettings = useAppStore((s) => s.setSettings);
  const rollbackTo = useAppStore((s) => s.rollbackTo);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const resetAll = useAppStore((s) => s.resetAll);

  const simple = settings.simpleMode;
  const today = todayStr();

  const beta = isBeta(settings, today);

  // β校正の残り日数(運用開始から1ヶ月)
  const betaRemainDays = useMemo(() => {
    if (!settings.operationStartDate) return null;
    const end = new Date(settings.operationStartDate);
    end.setMonth(end.getMonth() + 1);
    return Math.max(0, Math.ceil((end.getTime() - new Date(today).getTime()) / 86400000));
  }, [settings.operationStartDate, today]);

  const handleRollback = (id: string, reason: string, takenAt: string) => {
    const ok = window.confirm(
      `カルテを「${reason}」(${fmtDateTime(takenAt)})の時点に戻します。\n現在の状態もスナップショットとして残るため、後から戻せます。実行しますか?`,
    );
    if (ok) rollbackTo(id);
  };

  const handleLoadDemo = () => {
    const ok = window.confirm(
      '現在の試合・カルテ・設定はすべてデモデータに置き換わります。実行しますか?',
    );
    if (ok) loadDemo();
  };

  // 全削除は二重確認
  const handleResetAll = () => {
    if (!window.confirm('すべてのデータ(試合・カルテ・相手カルテ・設定)を削除します。実行しますか?')) return;
    if (!window.confirm('最終確認: この操作は取り消せません。本当にすべて削除しますか?')) return;
    resetAll();
  };

  return (
    <Screen title="設定">
      {/* 表示モード(かんたん / フル) */}
      <Card accent>
        <SectionLabel>表示モード</SectionLabel>
        <p className="small muted" style={{ marginBottom: 10 }}>
          {simple
            ? 'かんたんモード: よく使う機能だけ表示中。フル機能で詳しい記録・編集が全て使えます。'
            : 'フル機能モード: すべて表示中。'}
        </p>
        <Segmented<'simple' | 'full'>
          options={[
            { value: 'simple', label: 'かんたん' },
            { value: 'full', label: 'フル機能' },
          ]}
          value={simple ? 'simple' : 'full'}
          onChange={(v) => setSettings({ simpleMode: v === 'simple' })}
        />
        <hr className="divider" style={{ margin: '14px 0' }} />
        <div className="spread" style={{ gap: 12 }}>
          <p className="small muted">アプリの使い方をもう一度見る</p>
          <button
            className="btn"
            style={{ flexShrink: 0 }}
            onClick={() => { setSettings({ tourSeen: false }); navigate('/'); }}
          >
            使い方ガイド
          </button>
        </div>
      </Card>

      {/* プレイヤー名 */}
      <Card>
        <SectionLabel>プレイヤー名</SectionLabel>
        <input
          value={settings.playerName}
          onChange={(e) => setSettings({ playerName: e.target.value })}
          placeholder="名前を入力"
          aria-label="プレイヤー名"
        />
        <p className="small muted" style={{ marginTop: 8 }}>コーチの呼びかけに使われます。</p>
      </Card>

      {/* コーチのスキン(見た目のみ) */}
      <Collapsible
        title="コーチのスキン"
        openLabel="コーチの見た目を変える"
        closeLabel="とじる"
        summary={<span>スキン: {SKIN_INFO[settings.skin].label}</span>}
      >
      <Card>
        <SectionLabel>コーチのスキン</SectionLabel>
        <p className="small muted" style={{ marginBottom: 8 }}>
          見た目のみの変更です。タイプ判定・データには一切影響しません。
        </p>
        <div className="stack">
          {SKIN_KEYS.map((k) => (
            <button
              key={k}
              className="card"
              onClick={() => setSettings({ skin: k })}
              style={{
                textAlign: 'left',
                width: '100%',
                color: 'var(--court-line)',
                borderColor: settings.skin === k ? 'var(--accent)' : undefined,
              }}
              aria-pressed={settings.skin === k}
            >
              <div className="spread">
                <strong className="display" style={{ fontSize: 14 }}>{SKIN_INFO[k].label}</strong>
                {settings.skin === k && (
                  <span className="small" style={{ color: 'var(--accent)' }}>使用中</span>
                )}
              </div>
              <p className="small muted" style={{ marginTop: 4 }}>{SKIN_INFO[k].desc}</p>
            </button>
          ))}
        </div>
      </Card>
      </Collapsible>

      {/* 練習フォーカスの記録(裏DB・上級) */}
      {!simple && (
      <Collapsible
        title="練習フォーカスの記録"
        openLabel="練習フォーカスの記録を見る(裏DB)"
        closeLabel="とじる"
        summary={
          <span>
            記録 <span className="mono">{practiceFocusLog.length}</span>件
            {practiceFocusLog[0] && <> ・ 直近: {FOCUS_LABEL[practiceFocusLog[0].focus]}</>}
          </span>
        }
      >
      <Card>
        <SectionLabel>練習フォーカスの記録</SectionLabel>
        <p className="small muted" style={{ marginBottom: 8 }}>
          コーチの「練習メニュー」で<b>強み/弱点</b>を選んだ履歴です。本人の練習傾向を後から振り返れます。
        </p>
        {practiceFocusLog.length === 0 ? (
          <p className="small muted">まだ記録がありません。コーチ → 練習メニューで選ぶと残ります。</p>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            {practiceFocusLog.slice(0, 20).map((e) => (
              <div key={e.id} className="spread small">
                <span className="mono muted">{e.date}</span>
                <span style={{ color: e.focus === 'strong' ? 'var(--pos)' : 'var(--warn)', fontWeight: 700 }}>
                  {e.focus === 'strong' ? '🔥' : '🛡️'} {FOCUS_LABEL[e.focus]}
                </span>
              </div>
            ))}
            {practiceFocusLog.length > 20 && (
              <p className="small muted">他 <span className="mono">{practiceFocusLog.length - 20}</span> 件は省略</p>
            )}
          </div>
        )}
      </Card>
      </Collapsible>
      )}

      {/* β校正・データ管理 */}
      <Collapsible
        title="β校正とデータ管理"
        openLabel="β校正・スナップショット・データ管理を見る"
        closeLabel="とじる"
        summary={beta && betaRemainDays != null ? <span>β校正中(残り <span className="mono">{betaRemainDays}</span>日)</span> : undefined}
      >
      {/* β情報 */}
      <Card>
        <SectionLabel>β校正期間</SectionLabel>
        {settings.operationStartDate ? (
          <div className="stack" style={{ gap: 4 }}>
            <div className="spread small">
              <span className="muted">運用開始日</span>
              <span className="mono">{settings.operationStartDate}</span>
            </div>
            {beta ? (
              <div className="spread small">
                <span className="muted">β表示の残り</span>
                <span className="mono">{betaRemainDays}日</span>
              </div>
            ) : (
              <p className="small muted">β校正期間(運用開始から1ヶ月)は終了しています。</p>
            )}
            <p className="small muted">
              β期間中はタイプ判定に β を付けて表示し、実感とのズレを週次で確認します。
            </p>
          </div>
        ) : (
          <p className="small muted">
            未開始 — 診断を受けると運用開始日が設定され、1ヶ月のβ校正期間が始まります。
          </p>
        )}
      </Card>

      {/* カルテのスナップショット(上級機能) */}
      {!simple && (
      <Card>
        <SectionLabel>カルテのスナップショット</SectionLabel>
        <p className="small muted" style={{ marginBottom: 8 }}>
          カルテ更新のたびに自動保存されます(最大 <span className="mono">30</span> 件)。任意の時点に戻せます。
        </p>
        {snapshots.length === 0 ? (
          <p className="small muted">スナップショットはまだありません。</p>
        ) : (
          <div className="stack">
            {snapshots.slice(0, SNAPSHOT_SHOW).map((s) => (
              <div key={s.id} className="spread" style={{ gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="small">{s.reason}</p>
                  <p className="small muted mono">{fmtDateTime(s.takenAt)}</p>
                </div>
                <button
                  className="btn"
                  style={{ flexShrink: 0 }}
                  onClick={() => handleRollback(s.id, s.reason, s.takenAt)}
                >
                  この時点に戻す
                </button>
              </div>
            ))}
            {snapshots.length > SNAPSHOT_SHOW && (
              <p className="small muted">
                他 <span className="mono">{snapshots.length - SNAPSHOT_SHOW}</span> 件は古い順に省略
              </p>
            )}
          </div>
        )}
      </Card>
      )}

      <Card>
        <SectionLabel>データ管理</SectionLabel>
        <div className="stack">
          <div className="spread" style={{ gap: 12 }}>
            <p className="small muted">デモデータで全機能を試す(現在のデータは置き換わります)</p>
            <button className="btn" style={{ flexShrink: 0 }} onClick={handleLoadDemo}>
              デモデータを読み込む
            </button>
          </div>
          <hr className="divider" />
          <div className="spread" style={{ gap: 12 }}>
            <p className="small muted">端末内の全データを消去(二重確認あり・取り消し不可)</p>
            <button className="btn" style={{ flexShrink: 0, borderColor: 'var(--neg)', color: 'var(--neg)' }} onClick={handleResetAll}>
              すべてのデータを削除
            </button>
          </div>
        </div>
      </Card>

      </Collapsible>

      {/* プライバシー・アプリ情報 */}
      <Collapsible
        title="プライバシーとアプリ情報"
        openLabel="プライバシー方針・アプリ情報を見る"
        closeLabel="とじる"
      >
      {/* プライバシー方針 */}
      <Card>
        <SectionLabel>プライバシー方針</SectionLabel>
        <p className="small muted">
          試合データとカルテはこの端末の中(ブラウザのIndexedDB)にのみ保存され、本人だけが閲覧できます。
          外部サーバーへの送信はありません。共有・エクスポート機能もありません。
        </p>
      </Card>

      {/* アプリ情報 */}
      <Card>
        <SectionLabel>アプリ情報</SectionLabel>
        <div className="spread small">
          <span className="muted">{APP_NAME} — 卓球選手専用AIコーチ</span>
          <span className="mono">{APP_VERSION}</span>
        </div>
        <div className="spread small" style={{ marginTop: 2 }}>
          <span className="muted">ビルド</span>
          <span className="mono" style={{ color: 'var(--pos)' }}>{APP_BUILD}</span>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          PWA対応 — 「ホーム画面に追加」でアプリとして使えます。戦術カードはオフラインでも開けます。
        </p>
      </Card>
      </Collapsible>
    </Screen>
  );
}
