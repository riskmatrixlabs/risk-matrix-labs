# Auto-Generate System — Risk Matrix Labs
**Mon / Wed / Fri at 8am — 6 posts per run**

---

## Trigger Command (copy-paste this each run)

```
Generate batch [N] — 6 posts (2 X, 2 Instagram, 2 TikTok). Use brand-voice.md, past-posts.md, top-performers.md, and asset-map.md. Vary pillars — no pillar used more than once per batch. Save to workflow/data/batch-[N].md.
```

**Manual trigger:** Tell Claude: `generate batch 02`

---

## What Claude Reads Each Run (in order)

1. `CLAUDE.md` — business context, brand rules
2. `workflow/data/brand-voice.md` — tone, voice, banned words
3. `workflow/data/past-posts.md` — what's already been posted
4. `workflow/data/top-performers.md` — what's working
5. `workflow/data/asset-map.md` — available images with hosted URLs

---

## Pillar Rotation Tracker

**Available pillars:** System, Education, Mindset, Product, Social Proof, Affiliate

| Batch | Pillars Used |
|-------|-------------|
| 01 | System, Education, Mindset, Product, Education, Affiliate, System, Product |
| 02 | — |
| 03 | — |

**Next batch should prioritize:** Social Proof, Mindset, Affiliate

**Rule:** No pillar used more than once per batch. Check this table before generating.

---

## Asset Rotation Rules

- Do not reuse the same image within **14 days**
- Always pull image URLs from `asset-map.md` — never invent or guess URLs
- After each batch, note which assets were used and the date in the table below

| Asset File | Last Used | Next Available |
|-----------|-----------|----------------|
| (fill in from asset-map.md) | — | — |

---

## Quality Checklist — Run Before Approving Any Batch

- [ ] No banned words: **gamble, luck, easy, tips, picks**
- [ ] Every post has a hook in line 1
- [ ] Every post ends with a CTA + link
- [ ] Image URL is a real hosted URL pulled from `asset-map.md`
- [ ] No two consecutive posts on the same platform share the same pillar
- [ ] Batch file saved as `workflow/data/batch-[NN].md` (zero-padded)
- [ ] All 6 posts present (2 X, 2 Instagram, 2 TikTok)
- [ ] Brand review gate passed (score 70+)

---

## Batch Log

| Batch | Date | Posts | Platforms | Status |
|-------|------|-------|-----------|--------|
| 01 | 2026-06-10 | 8 | X, Instagram, TikTok | Scheduled |
| 02 | — | 6 | X, Instagram, TikTok | — |
| 03 | — | 6 | X, Instagram, TikTok | — |

**Status options:** Draft → Approved → Pushed to Buffer → Scheduled → Posted

---

## Approval → Buffer Workflow

1. Claude generates batch → saves to `workflow/data/batch-[N].md`
2. Run brand review gate — Claude checks every post in the batch, auto-fixes any failures, re-scores. Only posts scoring 70+ proceed to Notion Draft.
3. Claude drops passing posts into Notion Post Queue as **Draft**
4. User reviews in Notion, marks approved posts
5. Tell Claude: `push approved posts from batch [N] to Buffer`
6. Claude reads approved posts, calls Buffer API, schedules them
7. Update batch log status to **Scheduled**

---

## File Naming Convention

```
workflow/data/batch-01.md   ← first batch (already exists)
workflow/data/batch-02.md   ← next run
workflow/data/batch-03.md   ← following run
```

Each batch file should follow the same format as `batch-01.md`.

---

## Schedule Reference

| Day | Time | Action |
|-----|------|--------|
| Monday | 8am | Generate batch, drop to Notion |
| Wednesday | 8am | Generate batch, drop to Notion |
| Friday | 8am | Generate batch, drop to Notion |

User reviews and approves any time after generation. Claude pushes to Buffer on demand.
