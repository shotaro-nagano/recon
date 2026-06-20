/* 可読性チェック用: ビューポート単位の拡大スクショ(fullPageにしない) */
import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const arg = process.argv[2] ?? '4173';
const BASE = arg.startsWith('http') ? arg : `http://localhost:${arg}`;
const OUT = 'C:/Users/shotaro.nagano/nagano-project/AiCoach/.shot/zoom';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
await page.setViewport({ width: 400, height: 860, deviceScaleFactor: 2, isMobile: true });

const waitReady = async () => {
  for (let i = 0; i < 60; i++) {
    const r = await page.evaluate(() => (document.getElementById('root')?.innerHTML?.length ?? 0) > 700 && !(document.body.innerText || '').includes('起動中'));
    if (r) return; await sleep(200);
  }
};
const click = (t, s = 'button') => page.evaluate((tt, ss) => {
  const el = [...document.querySelectorAll(ss)].find((e) => (e.textContent || '').includes(tt));
  if (el) el.click();
}, t, s);

await page.goto(BASE + '/', { waitUntil: 'networkidle0' }); await waitReady();
await click('デモで試す'); await sleep(2200);

await page.goto(BASE + '/coach', { waitUntil: 'networkidle0' }); await waitReady(); await sleep(500);
await page.screenshot({ path: `${OUT}/practice-top.png` }); // 上から1画面

// 戦術タブ → 数枚開く
await click('戦術アドバイス', '.coach-tab'); await sleep(500);
await page.evaluate(() => { const c = [...document.querySelectorAll('.tactic-card')]; [0, 1, 2].forEach(i => c[i]?.click()); window.scrollTo(0, document.querySelector('.tactic-deck')?.offsetTop - 60 || 600); });
await sleep(500);
await page.screenshot({ path: `${OUT}/tactics-deck.png` });

// 弱点タブ
await click('弱点分析', '.coach-tab'); await sleep(500);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await page.screenshot({ path: `${OUT}/weakness-top.png` });

await browser.close();
console.log('done');
