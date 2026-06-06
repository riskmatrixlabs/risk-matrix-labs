const { chromium } = require('playwright')
const path = require('path')

const BASE = 'http://localhost:4174/?demo=true'
const OUT  = path.join(__dirname, '../public/brand/screenshots')

// Tab IDs as they appear in the app (click via tab data-tab or button text)
// Nav order: Analytics(overview) → Ladder → Bet Log → Overview(analytics) → RR Engine → Session → Partners
const TABS = [
  { id: 'overview',  label: 'Analytics' },
  { id: 'ladder',    label: 'Ladder' },
  { id: 'bet log',   label: 'Bet Log' },
  { id: 'analytics', label: 'Overview' },
  { id: 'rr engine', label: 'RR Engine' },
  { id: 'session',   label: 'Session' },
  { id: 'partners',  label: 'Partners' },
]

async function shoot(page, name) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`  ✓ ${name}`)
}

async function clickTab(page, label) {
  // Try clicking a button containing the label text
  const btn = page.locator(`button`).filter({ hasText: new RegExp(`^${label}$`, 'i') }).first()
  if (await btn.count()) {
    await btn.click()
    await page.waitForTimeout(400)
    return true
  }
  return false
}

;(async () => {
  const browser = await chromium.launch({ headless: true })

  // ── DESKTOP 960px ──────────────────────────────────────────────────────────
  console.log('\n📸 Desktop 960×844')
  const desktopCtx = await browser.newContext({ viewport: { width: 960, height: 844 } })
  const dPage = await desktopCtx.newPage()
  await dPage.goto(BASE, { waitUntil: 'networkidle' })
  await dPage.waitForTimeout(1500)
  // Dismiss tilt warning if present
  const tiltX = dPage.locator('button').filter({ hasText: /×|✕|close/i }).first()
  if (await tiltX.count()) await tiltX.click()

  for (const tab of TABS) {
    const clicked = await clickTab(dPage, tab.label)
    if (!clicked) console.warn(`  ⚠ could not find tab button: ${tab.label}`)
    await shoot(dPage, `desktop-${tab.id}`)
  }
  await desktopCtx.close()

  // ── MOBILE 430px ───────────────────────────────────────────────────────────
  console.log('\n📸 Mobile 430×932 (iPhone 15 Pro Max)')
  const mobileCtx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })
  const mPage = await mobileCtx.newPage()
  await mPage.goto(BASE, { waitUntil: 'networkidle' })
  await mPage.waitForTimeout(1500)

  // Mobile tab labels differ slightly — try label, fall back to partial
  const MOBILE_TABS = [
    { id: 'overview',  labels: ['Analytics'] },
    { id: 'ladder',    labels: ['Ladder'] },
    { id: 'bet log',   labels: ['Bets', 'Bet Log'] },
    { id: 'analytics', labels: ['Overview'] },
    { id: 'rr engine', labels: ['RR', 'RR Engine'] },
    { id: 'session',   labels: ['Session'] },
    { id: 'partners',  labels: ['Earn', 'Partners'] },
  ]

  for (const tab of MOBILE_TABS) {
    let clicked = false
    for (const lbl of tab.labels) {
      const btn = mPage.locator('button').filter({ hasText: new RegExp(`^${lbl}$`, 'i') }).first()
      if (await btn.count()) {
        await btn.click()
        await mPage.waitForTimeout(400)
        clicked = true
        break
      }
    }
    if (!clicked) console.warn(`  ⚠ could not find mobile tab: ${tab.labels[0]}`)
    await shoot(mPage, `mobile-${tab.id}`)
  }
  await mobileCtx.close()

  await browser.close()
  console.log('\n✅ All screenshots saved to public/brand/screenshots/')
})()
