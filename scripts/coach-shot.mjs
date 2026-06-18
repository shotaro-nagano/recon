/* コーチ3タブのビジュアル確認: モバイル+PCで各タブを撮る */
import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:4173';
const OUT = 'C:/Users/shotaro.nagano/nagano-project/AiCoach/.shot/coach';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());

const waitReady = async () => {
  for (let i = 0; i < 50; i++) {
    const ok = await page.evaluate(() => {
      const root = document.getElementById('root');
      return (root?.innerHTML?.length ?? 0) > 700 && !(document.body.innerText || '').includes('起動中');
    });
    if (ok) return; await sleep(200);
  }
};
const clickText = async (txt, tag = 'button') => {
  for (const el of await page.$$(tag)) {
    const t = (await page.evaluate((e) => e.textContent, el))?.trim();
    if (t && t.includes(txt)) { await el.click(); return true; }
  }
  return false;
};

// boot + demo
await page.setViewport({ width: 412, height: 920, deviceScaleFactor: 2, isMobile: true });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await waitReady();
await clickText('デモで試す');
await sleep(2500);

const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log('shot', n); };

// --- mobile ---
await page.goto(BASE + '/coach', { waitUntil: 'networkidle0' }); await waitReady(); await sleep(400);
await shot('00-m-practice');
await clickText('強みを伸ばす'); await sleep(500); await shot('01-m-practice-strong');
await clickText('戦術アドバイス'); await sleep(500); await shot('02-m-tactics');
await clickText('初見の相手'); await sleep(500); await shot('03-m-tactics-card');
// 戦術カードデッキ: 何枚か開く(オーバーレイ回避のため evaluate でクリック)
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.tactic-card')];
  [0, 2, 4].forEach((i) => cards[i]?.click());
  cards[0]?.scrollIntoView({ block: 'center' });
});
await sleep(500);
await shot('03b-m-tactic-deck-open');
await clickText('弱点分析'); await sleep(500); await shot('04-m-weakness');

// --- PC ---
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false });
await page.goto(BASE + '/coach', { waitUntil: 'networkidle0' }); await waitReady(); await sleep(400);
await clickText('弱点を埋める'); await sleep(500);
await shot('05-pc-practice');
await clickText('弱点分析'); await sleep(500); await shot('06-pc-weakness');

await browser.close();
console.log('done');
