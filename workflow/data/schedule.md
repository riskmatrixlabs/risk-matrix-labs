# Risk Matrix Labs — Weekly Posting Schedule

**Version:** 1.0
**Updated:** 2026-06-10
**Cadence:** 2–3 posts/day | X (daily) + Instagram (5–6/wk) + TikTok (3–4/wk)
**Audience peak:** 9am ET (morning research) · 7pm ET (live games)

---

## Weekly Grid

| Day | Slot | Time (ET) | Platform | Pillar | Format |
|-----------|------|-----------|-----------|------------|----------------------|
| Monday | AM | 9:00am | X | System | Short post |
| Monday | MID | 12:00pm | Instagram | Education | Caption + graphic |
| Monday | PM | 7:00pm | TikTok | Product | Talking head / screen |
| Tuesday | AM | 9:00am | X | Education | Thread opener |
| Tuesday | PM | 7:00pm | Instagram | Mindset | Caption + graphic |
| Wednesday | AM | 9:00am | X | Mindset | Short post |
| Wednesday | MID | 12:00pm | Instagram | Product | Caption + graphic |
| Wednesday | PM | 7:00pm | TikTok | System | Talking head |
| Thursday | AM | 9:00am | X | Product | Short post or thread |
| Thursday | PM | 7:00pm | Instagram | Education | Caption + graphic |
| Friday | AM | 9:00am | X | System | Short post |
| Friday | MID | 12:00pm | Instagram | Affiliate | Caption + graphic |
| Friday | PM | 7:00pm | TikTok | Mindset | Talking head |
| Saturday | AM | 9:00am | X | Education | Short post |
| Saturday | PM | 7:00pm | Instagram | System | Caption + graphic |
| Sunday | AM | 9:00am | X | Mindset | Short post |
| Sunday | MID | 12:00pm | TikTok | Product | Screen record |
| Sunday | PM | 7:00pm | X | Affiliate | Short post |

---

## Platform Weekly Totals

| Platform | Posts/Week |
|----------|------------|
| X | 7 (daily 9am + Sunday 7pm bonus) |
| Instagram | 6 (Mon/Tue/Wed/Thu/Fri/Sat) |
| TikTok | 4 (Mon/Wed/Fri/Sun) |

---

## Content Pillar Rotation Rules

**4 pillars:** System · Education · Mindset · Product · (Affiliate = 5th, 1x/week)

**Rules:**
1. Never post the same pillar back-to-back within the same platform's feed.
2. Affiliate pillar runs once per week max — rotate between Friday IG and Sunday X.
3. If a post underperforms (< avg engagement for platform), hold that pillar one extra day before reusing.
4. Thread format is reserved for Education and System pillars on X — max 1 thread per week.

**Weekly pillar map (to avoid same-day repeats):**
- Mon: System → Education → Product
- Tue: Education → Mindset
- Wed: Mindset → Product → System
- Thu: Product → Education
- Fri: System → Affiliate → Mindset
- Sat: Education → System
- Sun: Mindset → Product → Affiliate

---

## Image / Asset Rotation Rules

1. **No image repeats within a 7-day window** — track used assets in the table below.
2. Each batch file (batch-01, batch-02, etc.) contains the canonical image URL per post.
3. Before scheduling a new post, cross-check the image URL against the last 7 days in the log.
4. Campaign images live at: `app.riskmatrixlabs.com/campaign/` — use the exact hosted URL.
5. If an image was used on Platform A, it MAY be reused on Platform B after 4 days (cross-platform reuse rule).

**Asset usage log (rolling 7 days):**

| Date | Asset Filename | Platform Used |
|------|---------------|---------------|
| — | — | — |

*Update this table each time a post with an image goes live.*

---

## Scheduling Rules

- **Minimum gap on same platform:** 6 hours between posts on the same channel.
- **X:** 9am and 7pm slots. Never schedule 3 X posts in one day unless a major sports event (playoffs, Super Bowl, etc.).
- **Instagram:** 12pm is the primary slot. 7pm if a second IG post is needed — only on high-engagement weeks.
- **TikTok:** 7pm only. Never schedule TikTok before noon — algorithm favors evening posting for sports content.
- **Queue mode:** Always use `addToQueue` in Buffer unless manually overriding for a time-sensitive post.

---

## Feedback Loop — Top Performers

When a post hits any of these thresholds, log it in `top-performers.md`:

| Platform | Threshold |
|----------|-----------|
| X | 50+ likes OR 20+ reposts OR 5+ replies |
| Instagram | 100+ likes OR 20+ saves OR 10+ comments |
| TikTok | 500+ views OR 50+ likes OR 10+ comments |

**How to log:**
1. Copy the full post text + image URL into `top-performers.md`.
2. Note: platform, date posted, pillar, format, and final engagement numbers.
3. Tag it with the pillar: `[System]` `[Education]` `[Mindset]` `[Product]` `[Affiliate]`
4. Review top-performers.md at the start of each batch generation session — use winning formats as templates for next batch.

**File location:** `/Users/michaeltejeda/Desktop/risk-matrix-labs/workflow/data/top-performers.md`

---

## Batch Workflow

1. Generate batch (8–10 posts) using Hormozi content system prompt.
2. Review in `batch-XX.md` — approve posts to push.
3. Schedule via Buffer MCP using this schedule as the time map.
4. After all posts go live, update asset usage log above.
5. After 7 days, pull engagement data and log top performers.
6. Use top performers to brief next batch generation.

---

## Quick Reference — Channel IDs (Buffer)

| Platform | Channel ID |
|----------|------------|
| Instagram | 6a1e6212c687a22dd44f24c5 |
| TikTok | 6a1e629dc687a22dd44f261b |
| X/Twitter | 6a1e63d0c687a22dd44f2d3b |
| Org ID | 6a1a3c65084c61eaab66f270 |
