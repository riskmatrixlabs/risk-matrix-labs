# Risk Matrix Labs — Claude Rulebook

## PROJECT
- **App:** https://app.riskmatrixlabs.com
- **Landing:** https://riskmatrixlabs.com
- **Stack:** React 18 + Vite + Supabase + Stripe + Vercel
- **GitHub:** github.com/riskmatrixlabs/risk-matrix-labs (private)
- **Version:** v2.6
- **Owner email:** michaeltejeda08@gmail.com (bypasses paywall)

## RULES — ALWAYS FOLLOW
- Fix one bug at a time
- Explain what you find before fixing
- Use brand colors always (#BDFF00 / #0A0A0A / #FF3B3B)
- Mobile first always
- Clean scalable production-ready code
- Do not rush
- Do not overwhelm
- Step by step always
- Operate With Discipline
- **ALWAYS ASK BEFORE ACTING** — when there is ANY ambiguity (wrong files, multiple options, unclear intent), stop and clarify. Never assume and execute. Show what you found, ask which to use, then proceed.
- **NEVER POST OR PUBLISH ANYTHING** without explicit user approval first.

## BRAND
- **Primary:** #BDFF00 neon green
- **Background:** #0A0A0A
- **Danger:** #FF3B3B red
- **Fonts:** Rajdhani (headlines) + Inter (body)
- **Tagline:** "Operate With Discipline."
- **Positioning:** "Bankroll Simulator" (product) by Risk Matrix Labs (company)
- Users are "operators" not "gamblers" or "bettors"
- Avoid: gamble/gambling, luck, easy, tips, picks, tracker

## PLUGINS / MCPs INSTALLED
- Superpowers (skills system)
- Vercel MCP
- Supabase MCP
- GitHub MCP
- Canva MCP
- Notion MCP → workspace: Risk Matrix Labs HQ
- Buffer MCP → org: My Organization (riskmatrixlabs@gmail.com)
  - Instagram channel ID: 6a1e6212c687a22dd44f24c5
  - TikTok channel ID:    6a1e629dc687a22dd44f261b
  - X/Twitter channel ID: 6a1e63d0c687a22dd44f2d3b

## CONTENT AUTOMATION (as of Session 36 — Jun 10 2026)
Pipeline: Claude writes → Notion Post Queue (Draft) → YOU approve → Claude pushes to Buffer

**Notion Post Queue:**
- URL: https://app.notion.com/p/f0a42a8582b94884937d80ff0b90bb97
- Parent: Content Calendar → Risk Matrix Labs HQ
- Status flow: Draft → Approved → Scheduled → Posted

**How to trigger a Buffer push:**
1. Open Post Queue in Notion
2. Set Status = Approved on posts you want scheduled
3. Tell Claude: "push approved posts to Buffer"
4. Claude reads Approved rows → creates Buffer posts → updates Status to Scheduled

**Image limitation:** Buffer API needs hosted image URLs, not local file paths.
To attach images: upload to Canva/Google Drive/Imgur → paste URL into "Image File" column before approving.

**Campaign images location:** ~/Desktop/rml-reel/public/campaign/ (24 files)

## ARTIFACT TO ALWAYS UPDATE
After every session where we add new tools, prompts, install commands, or workflow updates:
- Update `/Users/michaeltejeda/Desktop/rml-master.html` with new information
- Never let it go stale — this is the single source of truth

## DEPLOY
```
npm run build && npx vercel deploy --prod --force
```

## TEST
```
npm test                          # 40 unit tests
npx vite build && npx vite preview --port 4173   # prod preview for Playwright
```
Never use the Vite dev server for Playwright testing — always prod build.

## KEY IDs
| Service | ID |
|---|---|
| GTM | GTM-T5VS52G8 |
| GA4 | G-8N1DZQECLP |
| TikTok Pixel | D8EJ2KRC77UA4F3II3R0 |
| Meta Pixel | 974544022029123 |
| Rewardful | fdbb6c |
| Crisp | 470f77af-d0cb-4f5c-a540-44cbf5d7465c |
| Beehiiv Form | d6ea407b-4704-4045-be5f-b241d4b3c26b |
| Supabase | ocsrwhjypawbeoeyhfnc.supabase.co |
| Stripe Monthly | price_1Tf56QJEv6JkAZy9zxplxbSI |
| Stripe Annual | price_1Tf58cJEv6JkAZy9kzUbPCDV |

## PAYWALL BYPASS WHITELIST
- michaeltejeda08@gmail.com (owner)
- josiahteem@yahoo.com
- tremizy@gmail.com
- j.willey2489@gmail.com
- lauriesjeanpaul@gmail.com

## WORKFLOW FOLDER
```
workflow/
├── scripts/     ← Claude writes video scripts here
├── prompts/     ← image + video prompts saved
├── remotion/    ← branded video templates
├── assets/      ← generated images + clips
└── n8n/         ← automation workflows
```

## BANKROLL MODEL
- `masterBankroll` → primary display, unit/risk calcs (unit = masterBankroll × 2%)
- `bankroll` → starting bankroll — ALWAYS starts $0, never persisted to localStorage
- `ladderStarting` → ladder session stake, auto-inits to 15% of masterBankroll
- Ladder uses session key UUID — never delete bets, just scope by key

## SUPABASE TABLES
- `bets` — all bet data including ladder_session field
- `user_settings` — settings including ladder_session_key
- `subscriptions` — Stripe subscription status
- `push_subscriptions` — web push tokens

## API FILES
| File | Purpose |
|---|---|
| `api/webhook.js` | Stripe webhook handler — sends win-back email on subscription.deleted |
| `api/create-checkout.js` | Creates Stripe checkout session |
| `api/billing-portal.js` | Opens Stripe billing portal |
| `api/lib/emails.js` | All 8 email functions: sendWelcome, sendTrialEnding, sendPaymentFailed, sendSubscriptionActivated, sendDayOne, sendTrialExpired, sendWinBack, sendReengagement |
| `api/cron-day-one.js` | Runs 3pm daily — finds users created 23-25h ago, sends sendDayOne |
| `api/cron-trial-expired.js` | Runs 4pm daily — finds trialing subscribers past trial_end, sends sendTrialExpired |
| `api/cron-reengagement.js` | Runs 1pm daily — finds active subscribers with no bets in 14+ days, sends sendReengagement |
| `api/cron-trial-ending.js` | Existing — trial ending warning |

## GA4 EVENTS (dataLayer push → GTM)
| Event | Where | Trigger |
|---|---|---|
| `trial_started` | AppRoot.jsx | checkout=success URL param |
| `subscribed` | AppRoot.jsx | subStatus resolves active |
| `churned` | AppRoot.jsx | subStatus resolves canceled |
| `bet_logged` | App.jsx | First non-ladder bet only |

## PRICING (DO NOT CHANGE WITHOUT SESSION)
- $29/mo or $149/yr (annual default on paywall)
- 3-day free trial — no charge until day 4

## SESSION 50 ADDITIONS (Jun 14 2026 · SW rml-v144 · commit b7c55a3)
**New API files:**
| File | Purpose |
|---|---|
| `api/player-search.js` | typed name → today's game via FREE ESPN rosters (0 Odds-API credits), cached `PLAYERS:<sport>:<date>` |
| `api/parse-betslip.js` | **OCR**: bet-slip photo → legs via Claude vision. **NEEDS `ANTHROPIC_API_KEY`** |
| `api/backfill-book-odds.js` | one-time per-book history seed, guarded `?confirm=SEED&sport=&hours=&stepMin=&regions=&markets=` |
| `api/cron-capture-book-odds.js` | per-book ML snapshots */30 (regions us,us2,eu — eu only for Pinnacle); registered in vercel.json |
- `api/game-lines.js` + `api/scan-props.js` now per-game CACHED (90s / 2min) via scanStore; game-lines persists per-book ML/spread/total snapshots to `odds_history` on view.

**Keys / env:**
- ⚠️ **PENDING: `ANTHROPIC_API_KEY`** — owner is creating it; add to Vercel env, then Upload Pic OCR works. (Model in code: `claude-haiku-4-5-20251001`.)
- `ODDS_API_KEY` = paid plan (~11.7k credits left as of session end).

**Supabase changes:**
- `bets` table: added `legs jsonb` (parlay legs `[{pick,odds,book,sport,event}]`, null = straight) + `ladder_session text`.
- `odds_history` table: `book` column = per-book snapshots (powers By-Sportsbook chart + Bet Matrix line-shop).

**Resume point:** Bet Matrix (slip + parlay + per-book line-shop "link page" for game lines AND props) is fully wired. Only OCR is dark — drop in ANTHROPIC_API_KEY to finish. Full backlog: `docs/superpowers/specs/2026-06-13-rml-backlog.md`.
