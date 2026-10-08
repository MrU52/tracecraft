import puppeteer from 'puppeteer-core';
import path from 'path';

// Usage: npm run build && npx vite preview, then node scripts/capture.js
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(t));
    btn?.click();
  }, text);
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 900, deviceScaleFactor: 2 });
await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });

await clickByText(page, 'flaky');
await clickByText(page, 'burst x10');
await sleep(1500);
await clickByText(page, 'send one');
await sleep(800);

// open the first log row so the attempt trace is visible
await page.evaluate(() => document.querySelector('ul li button')?.click());
await sleep(300);

const out = path.resolve('docs/assets/dashboard.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
