/* ============================================================
   要件適合チェック(データ整合 + UI実機アサーション)
   使い方: node scripts/verify-coach.mjs 4173
   全アサーション pass で exit 0 / 1つでも失敗で exit 1。
   ============================================================ */
import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const arg = process.argv[2] ?? '4173';
const BASE = arg.startsWith('http') ? arg : `http://localhost:${arg}`;
const ROOT = 'C:/Users/shotaro.nagano/nagano-project/AiCoach';

const checks = [];
const ok = (name, cond, extra = '') => checks.push({ name, ok: !!cond, extra });

/* ---------- A. データ整合 ---------- */
const drills = readFileSync(`${ROOT}/src/domain/coach/drills.ts`, 'utf8');
const tactics = readFileSync(`${ROOT}/src/domain/coach/tactics.ts`, 'utf8');
const weak = readFileSync(`${ROOT}/src/domain/coach/weaknesses.ts`, 'utf8');

const countOf = (s, re) => (s.match(re) || []).length;

// 練習: 7カテゴリ × 10 = 70ドリル
const CAT_LABELS = ['多球練習', 'フットワーク練習', '課題練習', 'サーブ練習', 'レシーブ練習', '台上技術練習', 'システム・戦術練習'];
ok('drills: カテゴリ数=7', countOf(drills, /key: '/g) === 7, `${countOf(drills, /key: '/g)}`);
ok('drills: ドリル総数=70', countOf(drills, /\{ name: '/g) === 70, `${countOf(drills, /\{ name: '/g)}`);
CAT_LABELS.forEach((l) => ok(`drills: カテゴリ「${l}」`, drills.includes(`label: '${l}'`)));

const DRILL_NAMES = [
  'フォアドライブ定点', 'バックドライブ定点', '2点回り込み', 'オールフォア(3点)', 'フォア・バック切り替え',
  'ツッツキ→ドライブ', 'ブロック→カウンター', 'ミドル処理', 'ロビング粘り', '決定打(スマッシュ)',
  '左右2点(フォア)', '回り込み→飛びつき', '三角(ミドル⇔フォア⇔バック)', 'バック規則・フォアフリー',
  '前後フットワーク', 'シャドープレー', 'マーカー往復', 'ランダム2〜3点', 'フォア大振り飛びつき',
  'フォアクロス連打', 'バッククロス連打', 'ブロック対ドライブ', 'フォア半面オール', 'ストレート規則',
  '1本フォア1本バック', 'ミドル攻め', '三球目固定', '条件付きゲーム',
  '下回転ショート(フォア前)', '下回転ロング(バック深)', '横下回転(YG/巻き込み)', 'ナックル短い',
  '上回転ロング(フェイク)', '3点打ち分け', 'しゃがみ込み/変化系', '長短ミックス', 'サーブ→3球目イメージ', 'ターゲット当て',
  'ストップ(短く)', '払い(深く)', 'フリック', 'チキータ', '回り込みレシーブ', 'ロングをドライブ',
  '回転の見極め', 'レシーブ→4球目', 'コース変化', 'ランダム実戦',
  'ストップ精度', 'ダブルストップ', 'フォアフリック', 'チキータ連続', '逆チキータ/バックフリック',
  'ツッツキ長短', '流し(横回転ツッツキ)', '台上一発(フォア)', '3択処理', '台上→展開',
  'サーブ→3球目FD', 'サーブ→3球目BD', 'ロングサーブ→カウンター', 'チキータ→4球目',
  'ストップ→ブロック→反撃', '両ハンド連続', 'ミドル戦術', '緩急パターン', '前後揺さぶり', '競り合い(9-9想定)',
];
const missingDrills = DRILL_NAMES.filter((n) => !drills.includes(`'${n}'`));
ok('drills: 全ドリル名が存在', missingDrills.length === 0, missingDrills.join(' / '));

// 優先度ロジック(strong/weak で並びが変わる)
ok('drills: strong優先=multiball先頭', /strong:[\s\S]*?order: \['multiball'/.test(drills));
ok('drills: weak優先=receive先頭', /weak:[\s\S]*?order: \['receive'/.test(drills));

// 戦術: 50カード(戦術+理由)
ok('tactics: カード数=50', countOf(tactics, /\{ id: 't\d/g) === 50, `${countOf(tactics, /\{ id: 't\d/g)}`);
ok('tactics: 理由が全カードに付く=50', countOf(tactics, /reason: '/g) === 50, `${countOf(tactics, /reason: '/g)}`);
['出だしから強気に', '9-9のサーブは一番自信のあるサーブで', 'レシーブは低く返すのが最優先', 'ミドルを突け',
  '競り合いは得意パターンで勝負しろ', '最後の1点まで気を抜くな', 'ゲームを落としても切り替えろ',
  '相手の戦型に合わせて立ち位置を変えろ'].forEach((t) => ok(`tactics: 「${t}」`, tactics.includes(t)));

// 弱点: 22パターン・featured4
ok('weak: パターン数=22', countOf(weak, /\{\s*id: 'w\d/g) === 22, `${countOf(weak, /id: 'w\d/g)}`);
ok('weak: 代表(featured)=4', countOf(weak, /featured: true/g) === 4, `${countOf(weak, /featured: true/g)}`);
['カウンターミス', 'ダブルストップ', 'フォア・バック判断遅れ', '甘く長く返して', 'ネットイン後の不規則',
  'エッジボール', 'チキータレシーブに対してコースを絞り切れず', '前後（短く落とす）'].forEach((t) =>
  ok(`weak: 「${t}」`, weak.includes(t)));

/* ---------- 削除済み機能の確認 ---------- */
import { existsSync } from 'node:fs';
['src/screens/ChatScreen.tsx', 'src/screens/PostMatchScreen.tsx', 'src/screens/WeeklyScreen.tsx',
  'src/domain/persona.ts', 'src/domain/coach/chat.ts', 'src/domain/coach/weekly.ts',
  'src/domain/coach/postMatch.ts', 'src/domain/coach/deviceAI.ts'].forEach((f) =>
  ok(`削除済: ${f}`, !existsSync(`${ROOT}/${f}`)));

/* ---------- B. UI 実機アサーション ---------- */
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const waitReady = async () => {
  for (let i = 0; i < 60; i++) {
    const r = await page.evaluate(() => {
      const root = document.getElementById('root');
      return (root?.innerHTML?.length ?? 0) > 700 && !(document.body.innerText || '').includes('起動中');
    });
    if (r) return true; await sleep(200);
  }
  return false;
};
const bodyText = () => page.evaluate(() => document.body.innerText);
const evalClick = (txt, sel = 'button') => page.evaluate((t, s) => {
  const el = [...document.querySelectorAll(s)].find((e) => (e.textContent || '').includes(t));
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
  return false;
}, txt, sel);
const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

// boot + demo
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await waitReady();
await evalClick('デモで試す');
await sleep(2500);

const VIEWPORTS = [
  ['mobile', 390, 844, true],
  ['tablet', 768, 1024, false],
  ['pc', 1366, 900, false],
];

for (const [vp, w, h, mobile] of VIEWPORTS) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile });
  await page.goto(BASE + '/coach', { waitUntil: 'networkidle0' });
  await waitReady(); await sleep(400);

  // 3タブ
  const tabLabels = await page.evaluate(() => [...document.querySelectorAll('.coach-tab')].map((e) => e.textContent));
  ok(`[${vp}] 画面下に3タブ`, await count('.coach-tab') === 3, `${await count('.coach-tab')}`);
  ['練習メニュー', '戦術アドバイス', '弱点分析'].forEach((l) =>
    ok(`[${vp}] タブ「${l}」`, tabLabels.some((t) => (t || '').includes(l))));
  // 今のおすすめ(視覚強調) + バッジ
  ok(`[${vp}] 「今のおすすめ」表示`, (await bodyText()).includes('今のおすすめ'));
  ok(`[${vp}] おすすめバッジ1つ`, await count('.coach-tab-reco') === 1, `${await count('.coach-tab-reco')}`);
  // ヘルプ(時系列)
  await evalClick('使い方を見る');
  await sleep(300);
  const helpText = await bodyText();
  ok(`[${vp}] ヘルプ: 普段の練習`, helpText.includes('普段の練習'));
  ok(`[${vp}] ヘルプ: 試合前`, helpText.includes('試合前'));
  ok(`[${vp}] ヘルプ: 試合後/自己分析`, helpText.includes('試合後') || helpText.includes('自己分析'));

  // 横スクロール(はみ出し)なし
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(`[${vp}] 横はみ出しなし`, overflow <= 2, `overflow=${overflow}`);

  // ① 練習メニュー(既定表示・7カテゴリ・優先度・記録)
  await evalClick('練習メニュー', '.coach-tab');
  await sleep(400);
  let t = await bodyText();
  ok(`[${vp}] 練習: 強み/弱点 選択あり`, t.includes('強みを伸ばす') && t.includes('弱点を埋める'));
  ok(`[${vp}] 練習: 7カテゴリ全表示`, CAT_LABELS.every((l) => t.includes(l)));
  ok(`[${vp}] 練習: 優先度バッジ(最優先)`, t.includes('最優先'));
  // フォーカスボタン(button.card[aria-pressed])を直接クリック
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button.card[aria-pressed]')]
      .find((e) => (e.textContent || '').includes('強みを伸ばす'));
    btn?.click();
  });
  await sleep(300);
  t = await bodyText();
  ok(`[${vp}] 練習: 選択を記録`, t.includes('記録しました'));

  // ② 戦術アドバイス(カード・理由は既定で閉じ→タップで開く)
  await evalClick('戦術アドバイス', '.coach-tab');
  await sleep(400);
  ok(`[${vp}] 戦術: カード3枚以上`, await count('.tactic-card') >= 3, `${await count('.tactic-card')}`);
  ok(`[${vp}] 戦術: 理由は既定で閉`, await count('.tactic-card-reason') === 0, `${await count('.tactic-card-reason')}`);
  await page.evaluate(() => document.querySelector('.tactic-card')?.click());
  await sleep(300);
  ok(`[${vp}] 戦術: タップで理由が開く`, await count('.tactic-card-reason') >= 1, `${await count('.tactic-card-reason')}`);
  t = await bodyText();
  ok(`[${vp}] 戦術: 相手分析あり`, t.includes('相手に合わせた作戦') || t.includes('相手分析') || t.includes('相手を選ぶ'));
  ok(`[${vp}] 戦術: 全理由トグル`, t.includes('すべての理由を見る') || t.includes('すべてとじる'));

  // ③ 弱点分析(失点パターン・シーケンス)
  await evalClick('弱点分析', '.coach-tab');
  await sleep(400);
  t = await bodyText();
  ok(`[${vp}] 弱点: 失点パターン見出し`, t.includes('よくある失点パターン'));
  ok(`[${vp}] 弱点: ✗失点 表示`, t.includes('✗ 失点'));
  ok(`[${vp}] 弱点: 効く練習導線`, t.includes('効く練習'));
}

// 裏DB(設定で記録を確認) — PC で1回
await page.goto(BASE + '/settings', { waitUntil: 'networkidle0' });
await waitReady(); await sleep(300);
await evalClick('練習フォーカスの記録を見る');
await sleep(300);
const setText = await bodyText();
ok('裏DB: 練習フォーカスの記録が見える', setText.includes('練習フォーカスの記録'));
ok('裏DB: 記録が1件以上', /記録\s*[1-9]/.test(setText) || setText.includes('強みを伸ばす') || setText.includes('弱点を埋める'));

// チャットタブが消えている
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await waitReady();
const navText = await page.evaluate(() => document.querySelector('.app-nav')?.innerText ?? '');
ok('ナビ: チャット削除', !navText.includes('チャット'));

ok('console error 0', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

/* ---------- 結果 ---------- */
const failed = checks.filter((c) => !c.ok);
console.log(`\n=== VERIFY ${BASE} ===`);
console.log(`チェック数: ${checks.length} / 合格: ${checks.length - failed.length} / 失敗: ${failed.length}`);
if (failed.length) {
  console.log('--- 失敗項目 ---');
  for (const f of failed) console.log(`  ✗ ${f.name}${f.extra ? `  (${f.extra})` : ''}`);
  console.log('RESULT: FAIL ❌');
  process.exit(1);
} else {
  console.log('RESULT: PASS ✅');
  process.exit(0);
}
