# Risk Matrix Labs — Content Workflow

*Last updated: Session 36 — 2026-06-10*

---

## How The Pipeline Works (Current — Semi-Auto)

```
Claude writes caption + picks image
  → Notion MCP → Post Queue (Status: Draft)
  → YOU review in Notion → change Status to "Approved"
  → Tell Claude: "push approved posts to Buffer"
  → Claude reads Approved rows → schedules in Buffer
  → Buffer auto-posts on schedule
```

**You only touch one step: flip Status to Approved in Notion.**

---

## Your Notion Post Queue

**URL:** https://app.notion.com/p/f0a42a8582b94884937d80ff0b90bb97
**Location:** Risk Matrix Labs HQ → Content Calendar → Post Queue

### Columns
| Column | What It Is |
|--------|-----------|
| Post Name | Title/identifier |
| Status | Draft → Approved → Scheduled → Posted |
| Platform | TikTok / Instagram / X (multi-select) |
| Caption | Full post copy, ready to post |
| Image File | Filename or hosted URL |
| Campaign Slot | RML-01 through RML-15 |
| Scheduled Time | Date/time for Buffer |
| Buffer Post ID | Auto-filled by Claude after push |

### Status Meanings
- **Draft** — Claude created it, needs your review
- **Approved** — You approved it, ready for Buffer
- **Scheduled** — Claude pushed it to Buffer successfully
- **Posted** — Live on platform

---

## Buffer Channels Connected

| Platform | Channel ID |
|----------|-----------|
| Instagram | 6a1e6212c687a22dd44f24c5 |
| TikTok | 6a1e629dc687a22dd44f261b |
| X/Twitter | 6a1e63d0c687a22dd44f2d3b |

**Image note:** Buffer API requires hosted image URLs. Upload campaign images to Canva, Google Drive, or Imgur and paste the URL into the Image File column before approving.

**Campaign images:** `~/Desktop/rml-reel/public/campaign/` (24 files)

---

## Content Formats

### 1. Image Post (primary)
- Image from `~/Desktop/rml-reel/public/campaign/`
- Caption from Notion Post Queue
- Platforms: TikTok + Instagram
- Upload image to get hosted URL → paste in Notion → Approve → push to Buffer

### 2. Text Post (X / Twitter)
- Caption only, no image needed
- Approve in Notion → push to Buffer directly
- No image upload step required

### 3. Video Reel
- `~/Desktop/rml-reel/public/rml-reel2.mp4` — rendered, ready
- VO: `~/Desktop/rml-reel/public/vo-reel2.mp3` (ElevenLabs Liam)
- Post manually to TikTok/Instagram (video API requires direct upload)
- Render new reel: `cd ~/Desktop/rml-reel && node scripts/render-reel.cjs`

---

## ElevenLabs (VO generation)

- **API key:** 4b9d3da4dfd6e794183ab1ae6d4d8fdb84398563f8110a53196413cb92f2345e
- **Voice:** Liam (TX3LPaxmHKxFdv7VOQHJ)
- **Model:** eleven_turbo_v2
- **Credits remaining:** ~2,177
- **Usage:** Claude calls API to generate MP3 → saves to `workflow/assets/`

---

## Posting Cadence

| Platform | Frequency | Best Times (ET) |
|----------|-----------|-----------------|
| TikTok | 3-4x/week | 7pm–9pm |
| Instagram | 3x/week | 11am or 7pm |
| X/Twitter | Daily | 9am or 12pm |

---

## Folder Structure

```
workflow/
├── WORKFLOW.md      ← this file
├── RML-BRAIN.md     ← ChatGPT project brain file
├── prompts/
│   ├── posts.md     ← 10 ready-to-post text posts
│   ├── captions.md  ← caption formulas + templates
│   └── images.md    ← DALL-E image generation prompts
├── scripts/         ← video scripts Claude generates
├── assets/          ← generated MP3s, exported images
├── remotion/        ← Remotion video templates (legacy)
└── n8n/             ← future: automation JSON workflows
```

---

## How To Use Claude For Content

**Generate new posts:**
> "Generate 3 new posts for the Notion queue about [topic]"

**Push approved posts to Buffer:**
> "Push approved posts to Buffer"

**Write a new reel script:**
> "Write a 30s reel script about [topic], save to workflow/scripts/"

**Generate a new voiceover:**
> "Generate VO for this script using ElevenLabs Liam voice"
