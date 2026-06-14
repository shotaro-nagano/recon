/* 開発サーバーの主要画面をスクショ(デザイン確認用・コミット対象外) */
import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = 'C:/Users/shotaro.nagano/nagano-project/AiCoach/.shot';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
page.on('dialog', async (d) => { await d.accept(); });
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true });

const go = async (p) => { await page.goto(BASE + p, { waitUntil: 'networkidle0' }); await sleep(800); };
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); console.log('shot', n); };
async function click(substr) {
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await page.evaluate((el) => el.textContent, b);
    if (t && t.includes(substr)) { await b.click(); return true; }
  }
  return false;
}

// 初回 → Welcome → デモ投入
await go('/');
await click('デモで試す');
await sleep(1300);

// チャットで会話
await go('/chat');
await sleep(500);
await click('私のタイプは？'); await sleep(500);
await click('弱点は？'); await sleep(500);
await click('次の練習は？'); await sleep(600);
await shot('chat');

// 相手名で対策を聞く(テキスト入力)
await page.type('textarea', '三島の対策は？');
await page.keyboard.press('Enter');
await sleep(700);
await shot('chat-opponent');

await browser.close();
console.log('done');
