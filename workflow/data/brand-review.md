# Brand Review Gate — Risk Matrix Labs
**Every post runs through this gate before it can go to Buffer.**
If a post fails, Claude auto-rewrites the failing parts, shows a diff, and re-scores.

---

## 1. THE GATE CHECKLIST

### Hard Fails — Auto-Rewrite Required

- [ ] Contains banned words: `gamble`, `gambling`, `luck`, `easy`, `tips`, `picks`, `tracker`, `learn to bet`, `win more`, `crush`, `kill`, `destroy`, `insane` (used as hype)
- [ ] No hook in line 1 — first line must stop the scroll (question, bold claim, or pattern interrupt)
- [ ] No CTA or link at the end
- [ ] Missing hashtags (Instagram and TikTok posts only)
- [ ] Sounds like generic AI — vague language, no specificity, no operator voice

**Any single hard fail = auto-rewrite before the post can proceed.**

### Soft Flags — Warn but Don't Block

- [ ] Same pillar as previous post on the same platform (check past-posts.md)
- [ ] Same image asset used within the last 7 days (check asset-map.md)
- [ ] Post over 280 characters on X (native post, not thread)
- [ ] Caption over 150 words on Instagram

**Soft flags are logged in the review report. User can override.**

---

## 2. BRAND VOICE SCORE (0–100)

Score every post on these four dimensions before submitting to Buffer.

### Scoring Rubric

| Dimension | Points | What to Check |
|-----------|--------|---------------|
| **Hook Strength** | 0–25 | Does line 1 stop the scroll? Is it specific, not vague? Does it create tension or curiosity? |
| **Operator Voice** | 0–25 | Does it sound like RML — disciplined, no hype, operators not gamblers? Or generic AI content? |
| **Structure** | 0–25 | Correct format for the platform? Line breaks, arrows, spacing, logical flow? |
| **CTA Strength** | 0–25 | Clear action, correct link, feels earned (not tacked on)? |

### Score Thresholds

| Score | Status | Action |
|-------|--------|--------|
| **85–100** | Green | Push to Buffer |
| **70–84** | Yellow | Flag with note — user can approve or send back |
| **Below 70** | Red | Auto-rewrite required — do not proceed to Notion |

---

## 3. AUTO-REWRITE INSTRUCTIONS

When a post fails (hard fail or score below 70), Claude must:

1. **List exactly what failed and why** — quote the specific line or word
2. **Rewrite only the failing parts** — do not rewrite the whole post unless necessary
3. **Show a diff:**
   ```
   BEFORE: [original failing line]
   AFTER:  [rewritten line]
   ```
4. **Re-score the rewritten version** — apply the full rubric
5. **If the rewritten version scores 70+**, submit to Notion Draft queue
6. **If it still scores below 70**, flag for user review with both versions shown

---

## 4. HOW TO RUN THE GATE

**Trigger command:**
```
run brand review on [post or batch file]
```

**Example:**
```
run brand review on workflow/data/batch-02.md
```

**What Claude does:**
1. Reads the post(s)
2. Runs the hard-fail checklist on each post
3. Scores each post on the 0–100 rubric
4. Auto-fixes any hard fails or posts below 70
5. Shows diff for every rewrite
6. Reports final scores and pass/fail status for the full batch

**Output format:**
```
POST 1 — X [Platform]
Pillar: System
Hard fails: None
Soft flags: None
Score: 88/100 (Hook: 22 | Voice: 23 | Structure: 21 | CTA: 22)
Status: GREEN — ready for Notion

POST 2 — Instagram [Platform]
Pillar: Education
Hard fails: Line 4 contains banned word "tracker"
Score before rewrite: 61/100
BEFORE: "Use this as your daily tracker..."
AFTER:  "Use this as your daily system..."
Score after rewrite: 83/100
Status: YELLOW — rewritten, flag for user review
```

---

## 5. EXAMPLES — PASS vs FAIL

---

### EXAMPLE A — PASS (Score: 91/100)

**Platform:** X (Twitter)
**Pillar:** System

```
Most operators blow up not because their picks are bad — because their unit size is wrong.

Here's the discipline framework:

→ Unit = 2% of total bankroll. Every time.
→ Never chase a loss with a bigger bet.
→ If you're down 10 units, the session ends. Period.

The edge isn't in the picks. It's in the process.

Run your numbers at riskmatrixlabs.com
```

**Gate Checklist:**
- No banned words: PASS
- Hook in line 1: PASS — creates tension, specific
- CTA + link at end: PASS
- Hashtags: N/A (X post)
- Operator voice: PASS

**Score Breakdown:**
- Hook Strength: 24/25 — specific, creates immediate tension
- Operator Voice: 23/25 — disciplined tone, "operators" framing, no hype
- Structure: 22/25 — clean arrow format, good spacing
- CTA Strength: 22/25 — clear action, earned after the framework

**Final Score: 91/100 — GREEN**

---

### EXAMPLE B — FAIL → REWRITE

**Platform:** Instagram
**Pillar:** Education

**Original Post:**
```
Want to stop gambling away your bankroll? 🎲

Here's a quick tracker to keep you on track:

✅ Log every bet
✅ Check your ROI weekly
✅ Use this gambling tracker template

Build discipline. Operate smarter.

#sportsbetting #gambling #picks #bettingtips
```

**Gate Checklist:**
- Banned words: FAIL — "gambling" (line 1), "gambling tracker" (line 6), "gambling" (hashtag), "picks" (hashtag), "bettingtips" (hashtag)
- Hook in line 1: FAIL — opens with a question using banned framing
- CTA + link: FAIL — no link
- Hashtags: Present (but contain banned terms)
- Operator voice: FAIL — sounds like generic sports betting content

**Score before rewrite: 38/100**

**Auto-Rewrite:**

```
BEFORE (line 1): "Want to stop gambling away your bankroll? 🎲"
AFTER  (line 1): "Most operators lose money in winning months. Here's why."

BEFORE (line 6): "Use this gambling tracker template"
AFTER  (line 6): "Use this system to audit your process weekly"

BEFORE (hashtags): "#sportsbetting #gambling #picks #bettingtips"
AFTER  (hashtags): "#sportsbetting #bankrollmanagement #operatormindset #riskmatrixlabs"

BEFORE: No link
AFTER  (added end): "Track your edge at riskmatrixlabs.com"
```

**Rewritten Post:**
```
Most operators lose money in winning months. Here's why.

Your ROI isn't the problem — your process is.

✅ Log every bet with context
✅ Audit your ROI weekly, not daily
✅ Use this system to audit your process weekly

Build the discipline first. The results follow.

Track your edge at riskmatrixlabs.com

#sportsbetting #bankrollmanagement #operatormindset #riskmatrixlabs
```

**Score after rewrite: 82/100**
- Hook Strength: 22/25 — specific, creates curiosity
- Operator Voice: 20/25 — improved, still slightly generic in middle
- Structure: 21/25 — clean, good use of checkmarks
- CTA Strength: 19/25 — link present, CTA functional but not sharp

**Status: YELLOW — rewritten, flagged for user review before pushing to Buffer.**

---

*Last updated: 2026-06-10 — Session 36*
