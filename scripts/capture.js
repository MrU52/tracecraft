import puppeteer from 'puppeteer-core';
import path from 'path';

async function capture() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  // Set viewport to 1100px width with 2.5x density (fills GitHub README width cleanly without downsizing blur)
  await page.setViewport({ width: 1100, height: 860, deviceScaleFactor: 2.5 });
  console.log('Navigating to http://localhost:4173 ...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });

  // Simulate user actions to populate rich telemetry
  console.log('Simulating requests to populate telemetry...');
  
  // Find "Burst 10 Reqs (Test Limiter)" button and click it
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const burstBtn = buttons.find(b => b.textContent?.includes('Burst 10'));
    if (burstBtn) burstBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // Click "Send 1 Request" a couple of times
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const sendBtn = buttons.find(b => b.textContent?.includes('Send 1 Request'));
    if (sendBtn) {
      sendBtn.click();
    }
  });
  await new Promise(r => setTimeout(r, 800));

  // Expand the first execution log item to show the attempt trace
  await page.evaluate(() => {
    const firstLog = document.querySelector('.space-y-2\\.5 > div');
    if (firstLog) {
      const header = firstLog.querySelector('div');
      if (header) header.click();
    }
  });
  await new Promise(r => setTimeout(r, 400));

  // 1. Capture Dashboard overview
  const dashboardPath = path.resolve('docs/assets/dashboard.png');
  await page.screenshot({ path: dashboardPath });
  console.log(`Saved ultra-crisp dashboard screenshot: ${dashboardPath}`);

  // 2. Open Interview Talking Points Modal & screenshot
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const guideBtn = buttons.find(b => b.textContent?.includes('Interview Talking Points'));
    if (guideBtn) guideBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const modalPath = path.resolve('docs/assets/interview-guide.png');
  await page.screenshot({ path: modalPath });
  console.log(`Saved interview guide screenshot: ${modalPath}`);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
