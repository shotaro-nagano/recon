/* ============================================================
   スモークテスト(これ1本でOK): デモ投入→全ルート巡回→
   console error 0 を確認→各画面スクショ→PASS/FAIL を表示。
   使い方:  node scripts/smoke.mjs            (既定 http://localhost:5173)
            node scripts/smoke.mjs 4173        (ポート指定)
            node scripts/smoke.mjs http://localhost:4173
   ============================================================ */
import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const arg = process.argv[2] ?? '5173';
const BASE = arg.startsWith('http') ? arg : `http://localhost:${arg}`;
const OUT = 'C:/Users/shotaro.nagano/nagano-project/AiCoach/.shot/smoke';
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['/', 'home'],
  ['/coach', 'coach'],
  ['/matches', 'matches'],
  ['/matches/demo-m1', 'matchdetail'],
  ['/karte', 'karte'],
  ['/opponents', 'opponents'],
  ['/opponents/opp-mishima', 'opponent-detail'],
  ['/settings', 'settings'],
  ['/diagnosis', 'diagnosis'],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
let route = '(boot)';
const errors = []; // {route, msg}
page.on('console', (m) => { if (m.type() === 'error') errors.push({ route, msg: m.text() }); });
page.on('pageerror', (e) => errors.push({ route, msg: 'PAGEERROR: ' + e.message }));
page.on('dialog', (d) => d.accept());
await page.setViewport({ width: 412, height: 900, deviceScaleFactor: 1, isMobile: true });

const waitReady = async () => {
  for (let i = 0; i < 50; i++) { // 最大 ~10s
    const ok = await page.evaluate(() => {
      const root = document.getElementById('root');
      const len = root?.innerHTML?.length ?? 0;
      const splash = (document.body.innerText || '').includes('起動中');
      return len > 700 && !splash;
    });
    if (ok) return true;
    await sleep(200);
  }
  return false;
};

// ---- デモ投入(その前に Welcome 画面でビルド表示を取得) ----
let build = '(不明)';
route = '/(demo)';
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await waitReady();
build = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span,p')].find((e) => e.textContent?.includes('JST'));
  return el?.textContent?.trim() ?? '(不明)';
});
for (const el of await page.$$('button,a')) {
  const t = (await page.evaluate((e) => e.textContent, el))?.trim();
  if (t === 'デモで試す') { await el.click(); break; }
}
await sleep(2500); // IndexedDB への永続化を待つ

// ---- 全ルート巡回 ----
let visited = 0;
for (const [path, name] of ROUTES) {
  route = path;
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  const ready = await waitReady();
  if (!ready) errors.push({ route, msg: 'NOT_READY(スプラッシュのまま/描画されず)' });
  await page.screenshot({ path: `${OUT}/${String(visited).padStart(2, '0')}-${name}.png`, fullPage: true });
  visited += 1;
}

await browser.close();

// ---- 結果 ----
console.log(`\n=== SMOKE ${BASE} ===`);
console.log(`巡回ルート: ${visited}/${ROUTES.length}`);
console.log(`ビルド表示: ${build}`);
if (errors.length === 0) {
  console.log('console error: 0');
  console.log('RESULT: PASS ✅');
  process.exit(0);
} else {
  console.log(`console error: ${errors.length}`);
  for (const e of errors) console.log(`  [${e.route}] ${e.msg}`);
  console.log('RESULT: FAIL ❌');
  process.exit(1);
}
