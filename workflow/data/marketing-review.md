# RML Marketing Review System

The weekly review is the brain of the content operation. Every Monday it synthesizes what happened, extracts the pattern, and tells the generation system exactly what to make next.

---

## 1. TRIGGER COMMAND

To run the weekly review, say:

> "generate marketing review for week of [date]"

Example: "generate marketing review for week of June 16, 2026"

---

## 2. WHAT CLAUDE DOES

When triggered, Claude executes the following steps in order:

1. **Pull Buffer analytics** (via Buffer MCP)
   - List all posts published in the prior 7 days
   - Capture: impressions, reach, engagement rate, clicks per post
   - Identify top 3 and bottom 3 by engagement

2. **Check PostHog for conversion data**
   - Query `trial_started` events with `$referrer` containing social platform URLs
   - Attribute trial starts to posts where possible (UTM params or referrer match)
   - Record total trial starts by platform for the week

3. **Read any screenshot uploads from the week**
   - If the user has dropped in screenshots of analytics dashboards (Instagram Insights, X Analytics, TikTok Studio), parse the visible numbers and incorporate them
   - Screenshots supplement Buffer data for platforms with limited API access

4. **Fill out the TEMPLATE.md**
   - Located at: `workflow/data/reviews/TEMPLATE.md`
   - Fill every section with real data, patterns observed, and the next directive

5. **Save the completed review**
   - File naming: `workflow/data/reviews/YYYY-MM-DD-week-NN.md`
   - Example: `2026-06-16-week-01.md`

6. **Update learning-loop.md**
   - Append the week's top patterns to the pattern log
   - Note any prompt version changes or hook format shifts
   - Located at: `workflow/data/learning-loop.md`

7. **Output the Next Batch Directive**
   - Surface the exact directive from the review as a ready-to-copy command
   - This command is what gets run during the Monday generation session immediately after the review

---

## 3. REVIEW CADENCE

**Every Monday at 9am ET** — before the Monday generation run.

The review informs what gets generated that day. Running generation before the review wastes the data signal.

### The Full Loop

```
Review → Learning Loop → Generation → Brand Gate → Notion → Approve → Buffer → Live → Review
```

- **Monday 9am:** Run the review. Read what worked last week.
- **Monday 10am:** Run generation using the Next Batch Directive from the review.
- **Monday–Friday:** Posts go live from Buffer queue (2x/day cadence).
- **Next Monday:** Repeat.

The system gets smarter each cycle because each generation run is informed by the previous week's real performance data.

---

## 4. THE COMPOUND EFFECT TRACKER

This table lives in `learning-loop.md` and is updated each week. It shows how the system improves over time as the data layer deepens.

| Week | Posts Live | Data Points | Prompt Version | Avg Engagement |
|---|---|---|---|---|
| 0 (baseline) | 0 | 0 | v1.0 | — |
| 1 | 8 | 8 | v1.0 | TBD |
| 2 | 14 | 14 | v1.0 | TBD |
| 3 | 20 | 20 | v1.0 | TBD |
| 4 | ~30 | 30+ | v1.1 | TBD |
| 8 | ~60 | 60+ | v1.1 | TBD |
| 12 | ~90 | 90+ | v2.0 | TBD |

**The goal:** By week 12, the DATA layer is so rich — patterns confirmed, hooks ranked, pillars scored, image types benchmarked — that generated outputs need zero editing before going to Notion for approval.

### Prompt version triggers:
- **v1.1** — Trigger after 4 weeks when first engagement patterns are confirmed. Update pillar weights and hook format preferences in the generation prompts.
- **v2.0** — Trigger at week 12 when 90+ data points exist. Full rewrite of generation prompts using only proven formats. Retire underperforming pillars or reposition them.

---

## 5. FILES REFERENCE

| File | Purpose |
|---|---|
| `workflow/data/reviews/TEMPLATE.md` | Blank template Claude fills out each Monday |
| `workflow/data/reviews/YYYY-MM-DD-week-NN.md` | Completed weekly reviews (archive) |
| `workflow/data/marketing-review.md` | This file — how the review system works |
| `workflow/data/learning-loop.md` | Running pattern log, updated each review cycle |
