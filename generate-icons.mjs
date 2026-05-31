import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath  = path.join(__dirname, 'public/brand/logo-dashboard.png');
const outDir    = path.join(__dirname, 'public');

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
});

for (const size of [192, 512]) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`
    <html><body style="margin:0;padding:0;background:#0A0A0A;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      <img src="file://${logoPath}" style="width:${size * 0.82}px;height:${size * 0.82}px;object-fit:contain;" />
    </body></html>
  `);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `icon-${size}.png`), clip: { x:0, y:0, width: size, height: size } });
  await page.close();
  console.log(`Generated icon-${size}.png`);
}

await browser.close();
