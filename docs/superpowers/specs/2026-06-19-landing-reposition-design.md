# Landing Page Repositioning — Design Spec

**Date:** 2026-06-19
**Decision:** A (reposition to edge platform) — see memory `rml-repositioning`
**Scope:** Rewrite `src/components/LandingPage.jsx` (+ `LandingPage.css`) only. App itself untouched. Public marketing page — **nothing publishes without owner approval**.

---

## 1. The problem

The app grew into an edge/analysis platform (Game Center, Matrix Bot, Spotlight, PHLT, KBO, EV Brain) but the landing page still sells v1: *"The Bankroll Simulator — Simulate. Execute. Operate With Discipline."* Cold visitors never learn the analysis engine exists. Conversion leak.

## 2. Positioning (locked)

**RML is the edge platform that grades itself in public.**

- Market research (3 independent agents) found the whole category jammed into one lane: *edge / +EV / profit-is-math / all-in-one*. Leading with "edge" = sounding like everyone (OddsJam, Outlier, Unabated, Sharp Money, DarkHorse).
- The unowned white space: **honesty + free + discipline + a self-grading public track record.** Nobody shows a live, auto-graded scoreboard of their own calls (wins AND losses). RML already does this (Spotlight/KBO self-grading, honest pre-game labeling, free live odds) — the copy just never said it.
- **Sell accountability, not confidence.** The honesty constraints (models calibrating, no hype words, never fake LIVE) become the selling point. The bigger promise is safe *because* the public record backs it.

**Voice:** Headline leads with the anti-tout/honesty hook; the "operators not gamblers / Operate With Discipline" identity stays as the spine + tagline (keep existing brand DNA).

**Brand rules that constrain copy** (from `feedback-rml-brand-no-gambling-words`): never use lock / pick / play / tips / luck / easy / gamble / tracker. Never claim guaranteed wins or income figures. Never fake "LIVE." Users are "operators." PHLT tiers = Prime/Strong/Caution/Fade.

## 3. Hero

- **Headline:** "No locks. No hype. Just the numbers — and a record we grade in public."
- **Subhead:** "Free live odds, EV-graded bets, and an honest track record. Built for operators who run a system — not gamblers chasing locks."
- **Primary CTA:** "Start free — no card" → `/pricing` (or trial flow). Honest price note: "3 days free · $29/mo or $149/yr after · cancel anytime."
- **Secondary CTA (quiet):** "See how it works" → scrolls to How-It-Works.
- **Tagline lockup:** "Operate with discipline." kept near hero.
- **Trust strip** (directly under CTA): three credible items — "every lean graded in public" · "free live odds" · "we never fake 'LIVE'." (Add live model-record stat once we wire it — see §5.)
- **Hero visual:** real product screenshot/short loop of Game Center showing live odds + line-movement arrows + a Spotlight lean. NOT abstract art. Reuse/refresh existing `ScreenshotCarousel`. Mobile-first framing.
- **Hero proof stats** (replace the v1 "6 Core Modules / 100pt Discipline Score / PHLT Ladder"): pick 3 that reflect now — e.g. "Free live odds" · "Self-graded models" · "$0 to start." (Final numbers TBD with owner; no fabricated metrics.)

## 4. Three outcome pillars (replaces the feature buffet)

Group the 8 features into 3 outcome pillars. Each pillar: outcome headline → 1-line feature that delivers it → proof visual. Never a feature without its payoff.

1. **See the edge** — free live odds, line movement since open, win probability, by-sportsbook chart. *"Open any game free. Watch the line move. See where the value is."*
2. **Grade the bet** — EV Brain + Spotlight O/U + PHLT props + discipline grading → Play/Small/Lean/Pass. *"Every bet scored before you place it — so you only act when the math agrees."*
3. **Stay disciplined** — bankroll/unit sizing, slip, Ladder/RR engines, Discipline Score, bet hand-off. *"Size every bet, run your system, and hand off to your book in a tap."* (← Bankroll Simulator lives here as a feature, not the headline.)

## 5. The honest track record (the differentiator section)

The single biggest trust asset. Surface the **real, self-graded** record — including losses.
- Show Spotlight O/U HIT/MISS and KBO PROJ→ACTUAL→ERR, all-time / yesterday / today.
- Copy: "Every lean, graded in public. Wins and misses. Most apps won't show you that."
- Honesty callout: "We never fake 'LIVE.' Pre-game odds are labeled pre-game." + "Models are continuously back-tested — and we show the results, good and bad."
- **Data source decision (TBD with owner):** (a) static/honest snapshot hardcoded for launch, or (b) live fetch from `lean-record`/`kbo-record` endpoints (CORS: landing is same origin as app, so feasible). Recommend (b) if endpoints are public-readable; fall back to (a).

## 6. Remaining sections (skeleton)

Per landing best-practice sequence:
- **Problem / why this exists** — name the pain in the bettor's words (touts, guesswork, paying for fake "LIVE").
- **How it works (3 steps)** — Scan → Grade → Decide.
- **vs. the alternatives** — comparison row vs touts / spreadsheets / paid-odds tools. Make unique attributes obvious (free live odds, public record, discipline, honest labeling).
- **Pricing** — transparent: "$0 to open a game, pay only on refresh/scan," then $29/mo or $149/yr, 3-day trial. (Keep existing `/pricing`.)
- **FAQ / objections** — "Is this gambling advice?" (no — and why that's honest), "Do you guarantee wins?" (no), data sources, cancellation.
- **Final CTA band** — restate promise + same primary CTA.
- **Footer** — keep existing (legal, responsible-betting disclaimer, data attributions, Discord, Affiliates).
- **CTA discipline:** ONE primary CTA repeated ~3-4× (hero, after pillars, after track record, final band). No competing actions.

## 7. Non-goals (YAGNI)

- No app/code changes. No pricing change. No new backend (unless §5 picks live-fetch, which reuses existing endpoints).
- No A/B test infra in v1 (can add headline A/B later; out of scope here).
- Keep the existing visual system (neon #BDFF00 / #0A0A0A, Rajdhani/Inter, motion) — refresh content & structure, don't redesign the brand.

## 8. Open decisions for owner

1. Hero proof stats — which 3 real numbers (no fabrication).
2. Track record section — live fetch (b) vs honest static snapshot (a).
3. Confirm "Start free" CTA target (trial flow vs `/pricing`).
4. Keep `/pricing`, `/partners`, `/privacy` routes as-is? (assumed yes.)

## 9. Success criteria

A cold visitor in 5 seconds understands: it's an honest, free-to-start edge platform that grades itself in public and is built for disciplined operators — and the Bankroll Simulator is clearly one part of a bigger product, not the whole thing.
