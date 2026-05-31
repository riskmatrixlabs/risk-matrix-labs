import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, 'og-image-template.html');
const outputPath = path.join(__dirname, 'public', 'og-image.png');

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
});

const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(`file://${templatePath}`, { waitUntil: 'networkidle' });

// Wait for Google Fonts to load
await page.waitForTimeout(2000);

await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();

console.log(`OG image saved to ${outputPath}`);
