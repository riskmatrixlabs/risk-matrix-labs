# Options Beast Context Gate Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify reusable intelligence, reporting, context, and risk-management pieces from Sports Beast or other local projects before adding any new Options Beast capability.

**Architecture:** Do not build a new scanner or second AutoTrader. First map the existing Options Beast decision flow, then compare it against reusable local project modules for market context, exposure control, reporting, and operator explanations. Any future implementation should add a permission/context layer around the existing model, risk engine, and broker routing.

**Tech Stack:** Node.js, static dashboard HTML/CSS/JS, PM2 production app, Alpaca paper broker, local file-backed stores, existing Options Beast test suite.

## Global Constraints

- Planning and audit first; no code changes during the reuse audit.
- Options Beast only for final integration.
- Sports Beast and other projects are read-only sources unless explicitly approved later.
- Do not change Alpaca, order routing, AutoTrader execution, risk limits, parser, Signals, billing, Caddy, or PM2 during audit.
- Do not add paid AI APIs.
- Do not create a second scanner, second order ticket, or second AutoTrader.
- Preserve existing paper-only execution and startup no-trade guard.
- Reuse existing code only when the source is understood, tested, and compatible.

---

### Task 1: Current Options Beast Decision Flow Map

**Files:**
- Read: `/Users/michaeltejeda/Desktop/rml-options/server.js`
- Read: `/Users/michaeltejeda/Desktop/rml-options/autoTrader.js`
- Read: `/Users/michaeltejeda/Desktop/rml-options/optionsModel.js`
- Read: `/Users/michaeltejeda/Desktop/rml-options/sizing.js`
- Read: `/Users/michaeltejeda/Desktop/rml-options/portfolioTruth.js`
- Read: `/Users/michaeltejeda/Desktop/rml-options/reconcileAll.js`
- Read: `/Users/michaeltejeda/Desktop/rml-options/public/index.html`
- Create: audit notes only, no runtime changes.

**Interfaces:**
- Consumes: existing Options Beast code.
- Produces: one-page map of scanner -> ranking -> entry gates -> sizing -> AutoTrader -> Alpaca -> lifecycle -> Intelligence.

- [ ] **Step 1: Confirm repo identity**

Run:

```bash
cd /Users/michaeltejeda/Desktop/rml-options
pwd
git status --short
git log -5 --oneline
```

Expected: repo is `/Users/michaeltejeda/Desktop/rml-options`; do not edit files.

- [ ] **Step 2: Trace entry flow**

Run:

```bash
cd /Users/michaeltejeda/Desktop/rml-options
rg "runAutoTrader|decideOpens|sizing|placeOrder|orderRouter|risk|model read|CALL|PUT" autoTrader.js optionsModel.js sizing.js server.js
```

Expected: identify the exact functions that turn a model read into an Alpaca paper order.

- [ ] **Step 3: Trace exit flow**

Run:

```bash
cd /Users/michaeltejeda/Desktop/rml-options
rg "decideCloses|target|stop|near|expiry|close|exit|sell" autoTrader.js server.js optionsStore.js equityExit.js
```

Expected: identify current exit logic and whether overnight/close-of-day decisions already exist.

- [ ] **Step 4: Trace Intelligence and reporting**

Run:

```bash
cd /Users/michaeltejeda/Desktop/rml-options
rg "intelligence|journal|telegram|notify|report|EOD|weekly|routine" .
```

Expected: identify what reporting already exists and what data it consumes.

- [ ] **Step 5: Produce architecture map**

Write a concise map in plain text:

```text
Options Beast Decision Flow

1. Candidate generation:
2. Contract selection:
3. Entry permission:
4. Position sizing:
5. Broker submission:
6. Fill sync:
7. Position lifecycle:
8. Exit management:
9. Intelligence/journal/reporting:

Known gaps:
- Market regime gate:
- Sector/concentration gate:
- Earnings/event risk:
- Overnight hold review:
- Premarket report:
- EOD operator brief:
```

Expected: no edits to production code.

---

### Task 2: Read-Only Sports Beast Reuse Audit

**Files:**
- Read: local Sports Beast project once located.
- Read: package files, server/API files, reporting/routine files, dashboard files.
- Create: reuse inventory only, no runtime changes.

**Interfaces:**
- Consumes: Sports Beast patterns and modules.
- Produces: list of reusable patterns with exact source paths and compatibility notes.

- [ ] **Step 1: Locate Sports Beast**

Run:

```bash
find /Users/michaeltejeda/Desktop -maxdepth 3 -type d \( -iname "*sports*" -o -iname "*beast*" \) -print
```

Expected: identify likely Sports Beast project root(s).

- [ ] **Step 2: Inventory likely reusable modules**

Run from each likely project root:

```bash
rg "regime|context|news|perplexity|telegram|notify|report|journal|risk|exposure|confidence|schedule|overnight|premarket|eod|summary" .
```

Expected: find code that may already solve operator reports, context checks, or intelligent filtering.

- [ ] **Step 3: Check dependency boundaries**

Run:

```bash
cat package.json
rg "import .*supabase|from .*supabase|stripe|vercel|telegram|openai|perplexity|anthropic|fetch" .
```

Expected: classify reusable pieces as direct-copy, adapt-with-wrapper, or unsuitable.

- [ ] **Step 4: Build reuse matrix**

Use this format:

```text
Reusable Piece:
Source path:
What it does:
Dependencies:
Can reuse directly? yes/no
Required adapter:
Risk:
Test coverage found:
Recommendation:
```

Expected: no files copied.

---

### Task 3: Candidate Context Gate Design

**Files:**
- No code files yet.
- Create: final design proposal after audit.

**Interfaces:**
- Consumes: Task 1 architecture map and Task 2 reuse matrix.
- Produces: minimal future implementation spec.

- [ ] **Step 1: Define the gate contract**

Propose this interface only if the audit confirms it is missing:

```js
evaluateTradeContext({
  candidate,
  account,
  openPositions,
  pendingOrders,
  marketState,
  eventCalendar,
  now
})
```

Expected return:

```js
{
  decision: 'ALLOW' | 'REDUCE_SIZE' | 'BLOCK' | 'REVIEW_ONLY',
  sizeMultiplier: 1,
  reasons: [],
  operatorNote: ''
}
```

- [ ] **Step 2: Define allowed first checks**

Only include checks that can run reliably without paid APIs:

```text
- Account exposure
- Same-symbol concentration
- Directional crowding
- Known event date if already available locally
- Market-hours/session state
- Recent loss/cooldown state
- Missing data blocks instead of guessing
```

- [ ] **Step 3: Define reporting outputs**

Propose reports:

```text
Premarket:
- account state
- open positions
- pending orders
- symbols Beast is watching
- risk flags

Intraday:
- trades allowed
- trades blocked
- reason for each block

EOD:
- realized P&L
- unrealized P&L
- broker/local sync
- open overnight risk
- tomorrow watchlist
```

---

### Task 4: Go / No-Go Build Decision

**Files:**
- No code files.
- Create: implementation prompt only after approval.

**Interfaces:**
- Consumes: audit findings and reuse matrix.
- Produces: exact implementation prompt with files, tests, deployment steps, rollback.

- [ ] **Step 1: Present findings**

Report:

```text
Already exists:
Missing:
Reusable from Sports Beast:
Do not reuse:
Recommended first build:
Risks:
Tests required:
```

- [ ] **Step 2: Ask for build approval**

Do not proceed until the operator approves:

```text
Build only the context gate/reporting layer described above?
No UI redesign, no second AutoTrader, no broker changes.
```

Expected: explicit approval before implementation.

---

## Self-Review

- Spec coverage: This plan saves the architecture direction, audits existing Options Beast, audits Sports Beast read-only, and prevents new code until reusable pieces are identified.
- Placeholder scan: No `TBD`, no vague “add tests later,” no undefined future implementation steps.
- Type consistency: Future context gate interface is defined once and only as a proposal pending audit.

---

## Initial Read-Only Reuse Findings

### Sports Beast Candidate Source

Primary source found:

```text
/Users/michaeltejeda/Desktop/beast-node
```

Likely reusable pieces:

```text
health.js
- Pure readiness evaluator.
- Strong fit for Options Beast command-center health.
- Reuse pattern: injectable probes, readiness vs liveness, fail-closed blocker list.
- Do not copy Polymarket-specific probe names directly.

report.js / reportEngine.js
- Pure operator reporting layer plus grounded narrative rendering.
- Strong fit for Options Beast morning / intraday / end-of-day reports.
- Reuse pattern: aggregate durable rows, explain what happened, state missing data honestly.
- Needs adaptation away from Supabase tables into Options Beast file-backed stores / existing APIs.

entryGate.js
- Strong conceptual fit.
- It prevents entry/exit disagreement by asking whether the exit brain would immediately reject a new entry.
- Reuse idea: Options entries should be checked against the same exit/hold economics before opening.
- Do not copy directly until Options exit model is mapped.

exitBrain.js
- Pure HOLD / SCALE_OUT / EXIT / PROTECT policy engine.
- Strong candidate for future position-management improvement.
- Not a first copy because Options currently uses +50%, -50%, and near-expiry rules; replacing that without performance review would be too invasive.

risk.js
- Mature risk-officer pattern with caps, kill switch, fail-closed defaults, and live-gate doctrine.
- Options Beast already has `portfolioRisk.js`, `allocation.js`, `sizing.js`, and broker guards, so use as comparison only.

strategy.js
- Pure strategy classifier pattern.
- Useful conceptually for labeling setups, but Options Beast already has model/read/strategy language.

scanner.js / movement.js / crowdFlow.js / clvEngine.js
- Sports/Polymarket-specific.
- Useful only as conceptual examples of movement quality, flow, and post-trade edge review.
- Do not copy directly into options trading.
```

### Existing Options Beast Pieces Already Present

Key source:

```text
/Users/michaeltejeda/Desktop/rml-options
```

Relevant existing pieces:

```text
researchPipeline.js
- Already has six gates:
  1. validated
  2. fresh
  3. confidence
  4. portfolio manager
  5. risk engine
  6. paper + auto-execution switch
- It explicitly returns intent and imports no broker/router/store.
- This may already be the correct seam for future context gating.

research/regimeClassifier.js
- Regime classification already exists in the repo.
- Need to determine whether it is only used by equities/research or also protects options AutoTrader entries.

equityScan.js
- Uses `classifyAt` from `research/regimeClassifier.js`.
- Suggests equities already stamp regime, but may still trade as UNVERIFIED paper.

operatorBrief.js
- Existing read-only brief builder.
- Currently focused on Signals review / learning / memory.
- Candidate place to expand operator reports without inventing a second report layer.

routines/*
- Existing premarket, midday, hourly-entry, weekly-review routines and stale-data gates exist.
- Need trace before adding any new schedule.

portfolioRisk.js / allocation.js / sizing.js
- Existing risk gates and sizing controls already cover much of what Sports Beast risk.js does.
- Do not replace.
```

### First Recommendation

Do not build a new engine.

Next action should be:

```text
Read-only architecture audit:
Options AutoTrader entry flow
→ existing researchPipeline seam
→ existing regime usage
→ existing routines
→ existing operatorBrief/reporting
```

Then choose one of these narrow outcomes:

```text
1. If regime/context already exists but is not surfaced:
   improve reporting only.

2. If regime exists but is not wired into options entry permission:
   add one context gate before existing risk/sizing/order routing.

3. If reporting exists but is thin:
   adapt Sports Beast report.js/reportEngine.js patterns into operatorBrief.js.

4. If exit logic is too simple:
   plan a separate position-management phase later; do not combine it with entry gating.
```

---

## Implementation Update — 2026-07-23

The owner approved building the explain/report layer first and explicitly keeping the Context Gate
for later.

Completed locally in `/Users/michaeltejeda/Desktop/rml-options`:

```text
f1a626a intelligence: add operator brief delivery
bc7b4e2 intelligence: add operator command center
```

Built:

- Expanded `operatorBrief.js`.
- Added `operatorVoice.js`.
- Added `voiceTts.js` and `voiceTelegram.js` using Sports Beast's Daniel/Telegram pattern.
- Added `operatorReports.js`.
- Added `telegramCommands.js`.
- Added `POST /api/intelligence/brief/send`.
- Added fail-closed `POST /api/telegram/options`.
- Added `routines/operator-brief.js`.
- Added Intelligence dashboard `Control` tab.
- Added focused tests plus UI regression coverage.

Verified locally:

```bash
npm run check
npm test
```

Not completed:

- Production deploy.
- Production Telegram webhook setup.
- Production `operator-brief` timer setup.
- Context Gate.
- `researchPipeline.js` / `regimeClassifier.js` trading-path audit.
- Any trade-block/reduce behavior.

Current architecture status:

```text
Explain/report layer: built locally.
Live intelligence loop: not activated.
Context gate: intentionally not built.
Trading behavior: unchanged.
```
