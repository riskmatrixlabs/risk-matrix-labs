const { chromium } = require('playwright')
const path = require('path')

;(async () => {
  const tpl = 'file://' + path.join(__dirname, 'og-template.html')
  const out = path.join(__dirname, '../public/og-image.png')
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })
  await page.goto(tpl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } })
  await browser.close()
  console.log('✓ og-image.png rendered →', out)
})()
