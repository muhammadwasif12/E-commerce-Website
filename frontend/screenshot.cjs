const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const filePath = `file:///${path.resolve(__dirname, 'test-report.html').replace(/\\/g, '/')}`;
  console.log(`Navigating to ${filePath}`);
  await page.goto(filePath, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.resolve(__dirname, '../4b_frontend_tests.png') });
  await browser.close();
  console.log('Screenshot saved to ../4b_frontend_tests.png');
})();
