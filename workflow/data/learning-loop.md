# RML Learning Loop — Self-Improving Content Engine

## 1. OVERVIEW

The learning loop runs **every Monday before content generation**. It is the engine that makes the AI smarter over time by feeding real performance data back into the data layer.

Each week it:
1. Pulls performance data from 3 sources
2. Identifies patterns in what worked vs. what didn't
3. Updates `top-performers.md` with winning posts and patterns
4. Updates platform prompts with extracted insights
5. Flags what to prioritize in the next batch

The output: prompts that get sharper every week. By week 12, the system knows exactly what makes RML content perform — no guessing, no editing.

---

## 2. DATA SOURCE 1 — Buffer Analytics (via MCP)

**Trigger command:** "pull Buffer analytics for the last 7 days"

Claude uses the Buffer MCP to retrieve per-post stats across all platforms.

**Metrics to pull per post:**
- Impressions
- Clicks
- Likes
- Shares
- Comments

**Calculate engagement rate:**
```
engagement rate = (likes + comments + shares) / impressions
```

**Top performer threshold:**
- Engagement rate > 3%, OR
- Clicks > 50

**Buffer Channel IDs:**
| Platform | Channel ID |
|----------|-----------|
| Instagram | 6a1e6212c687a22dd44f24c5 |
| TikTok | 6a1e629dc687a22dd44f261b |
| X/Twitter | 6a1e63d0c687a22dd44f2d3b |

**What to extract:**
- Top 3 posts by engagement rate
- Top 3 posts by clicks
- Worst 3 posts (lowest engagement — learn what not to repeat)
- Average engagement rate per platform this week

---

## 3. DATA SOURCE 2 — PostHog/GA4 (Revenue Impact)

**Trigger command:** "check PostHog for trial_started events from social traffic this week"

**GA4 Property:** G-8N1DZQECLP

**What to look for:**
- `trial_started` events where referrer = `twitter.com`, `instagram.com`, or `tiktok.com`
- Count total trial starts per platform
- Identify which day and time drove the most trial starts
- Cross-reference with top Buffer posts — which posts drove actual signups?

**Output format:**
```
Platform       Trial Starts    Best Day/Time
X/Twitter      —               —
Instagram      —               —
TikTok         —               —
```

**This is the signal that matters most.** Engagement is vanity. Trial starts are the business metric. A post with 2% engagement that drove 5 trial starts beats a post with 8% engagement that drove 0.

---

## 4. DATA SOURCE 3 — Screenshot Upload

When the user uploads a screenshot of TikTok, Instagram, or X analytics:

1. Claude reads the numbers directly from the image
2. Extracts: views, likes, comments, shares, profile visits, follows
3. Maps the numbers to the corresponding post in the batch log (`auto-generate.md`)
4. Calculates engagement rate from extracted data
5. Flags if the post qualifies as a top performer

**How to match screenshot to post:**
- User names the post when uploading ("this is post 3 from the June 10 batch")
- Or Claude matches by date posted + platform

---

## 5. PATTERN EXTRACTION

After collecting data from all 3 sources, Claude identifies:

**Content Patterns:**
- Which PILLAR performed best this week
  - Education / System / Product / Social Proof / Mindset / Affiliate
- Which HOOK FORMAT got the most engagement
  - List ("5 reasons...") / Contrast ("Most people X. Smart founders Y.") / Reframe ("It's not about X, it's about Y.") / Question ("What if your biggest risk isn't...?")
- Which CTA format drove the most clicks
  - "Link in bio" / "DM me X" / "Comment X" / direct link

**Platform Patterns:**
- Which platform drove the most trial starts (revenue signal)
- Which platform had the highest raw engagement
- Best posting time by platform (based on when top posts went out)

**Visual Patterns:**
- Which image type performed best
  - Branded graphic / App screenshot / Hand or lifestyle / Text-only / Infographic

**Format to output after extraction:**
```
WEEK OF [DATE] — PATTERN SUMMARY

Top Pillar: [X] — avg engagement [Y]%
Top Hook Format: [X] — drove [Y] clicks
Best Platform for Trials: [X] — [Y] trial starts
Best Image Type: [X]
Best Posting Window: [Platform] at [time]

Avoid this week: [pillar or hook format that underperformed]
```

---

## 6. HOW TO UPDATE THE DATA LAYER

After extracting patterns, Claude executes 4 updates:

**Step 1 — Update `top-performers.md`**
Add each top-performing post with:
- Platform + date posted
- Full post text
- Stats (impressions, engagement rate, clicks, trial starts if known)
- "What worked" note in 1 sentence (the insight, not just the numbers)

**Step 2 — Update Platform Prompts**
At the top of each platform prompt (`twitter-prompt.md`, `instagram-prompt.md`, `tiktok-prompt.md`), add or replace a section called:

```
## THIS WEEK'S WINNING PATTERNS
[extracted insights specific to that platform]
```

This section gets overwritten each week with the latest data. It sits above the core instructions so Claude reads it first before generating new posts.

**Step 3 — Update `auto-generate.md` Batch Log**
For each post in last week's batch, update the status column:
- `Posted` → `Posted — [engagement score]`
- Flag top performers with a star
- Flag underperformers with a note

**Step 4 — Note Next Batch Priority**
At the bottom of `auto-generate.md`, add a line:
```
NEXT BATCH PRIORITY: [pillar] content using [hook format] — [platform] is the focus this week
```

---

## 7. WEEKLY LEARNING LOOP COMMAND

**Trigger:** "run learning loop for week of [date]"

**Full sequence Claude executes:**

1. Pull Buffer analytics (last 7 days) via MCP
2. Check PostHog for `trial_started` events from social referrers
3. Prompt: "Do you have any screenshots to upload from TikTok/Instagram/X?" — wait for uploads or skip
4. Extract patterns (pillar, hook, platform, image type, timing)
5. Update `top-performers.md` with qualifying posts
6. Update platform prompts with "THIS WEEK'S WINNING PATTERNS" section
7. Update `auto-generate.md` batch log with engagement scores
8. Generate weekly marketing review — save to `workflow/data/reviews/YYYY-MM-DD.md`
9. Output summary:

```
Learning loop complete.

Top performer: [post title/platform]
Engagement rate: [X]%
Trial starts this week: [X]
Best pillar: [X]
Best hook format: [X]
Next batch should prioritize: [pillar] content on [platform]

Data layer updated. Prompts are sharper. Ready for next batch.
```

---

## 8. PATTERN LOG

Running table of weekly insights. Updated every Monday.

| Week | Top Pillar | Top Hook Format | Best Platform | Top Post | Trial Starts |
|------|-----------|-----------------|---------------|----------|--------------|
| 2026-06-10 | — | — | — | — | — |

---

## 9. COMPOUND EFFECT — THE HORMOZI FLYWHEEL

This is why the system gets better without more effort.

**Week 1:** 10 seed posts. Prompts are based on assumptions.

**Week 4:** 10 seed posts + 3 batches + real performance data. Prompts now know which hooks work on this audience.

**Week 12:** The prompts know exactly what makes RML content perform. The "THIS WEEK'S WINNING PATTERNS" section in each prompt is backed by 12 weeks of data. Posts require no editing. Output quality compounds.

**The formula:**
```
Richer Business Context
+ Smarter Data Layer (top-performers + pattern log)
+ Updated Platform Prompts
= Outputs That Don't Need Editing
```

Each week you run the learning loop, you are training the system on your actual audience's behavior — not generic best practices. By month 3, this system knows more about what converts RML's audience than any marketing agency would in year 1.

The goal is not more content. It is content that converts — and a system that gets better at conversion automatically.
