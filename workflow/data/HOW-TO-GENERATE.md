# RML — How To Generate Content (Hormozi System)

The model: **Business Context + Data + Platform Prompt → Output**

Every generation uses all 3 layers. Never prompt blind.

---

## THE 3 LAYERS

| Layer | File | Purpose |
|---|---|---|
| Business Context | `CLAUDE.md` + `RML-BRAIN.md` | Brand alignment — who we are, what we sell |
| Data | `workflow/data/past-posts.md` + `top-performers.md` + `brand-voice.md` | No AI slop — real voice from real content |
| Platform Prompt | `workflow/data/platform-prompts/[platform]-prompt.md` | Platform-specific rules and structure |

---

## HOW TO GENERATE NEW POSTS

### Option A — Tell Claude directly (in this session)

> "Generate 5 X posts about unit sizing. Use the Hormozi system — pull from brand-voice.md and past-posts.md."

Claude already has full context in this session. Just give the topic and platform.

### Option B — Use the platform prompt files (in ChatGPT or fresh session)

1. Open `workflow/data/platform-prompts/[platform]-prompt.md`
2. Copy the full prompt
3. Paste into ChatGPT / Claude
4. Replace `[TOPIC]` and `[NUMBER]` at the bottom
5. Send — it generates on-brand content immediately

---

## GENERATION COMMANDS (quick reference)

```
Generate 5 X posts about [topic]
Generate 3 Instagram captions about [topic]
Generate 2 TikTok scripts about [topic] (talking head)
Generate a Twitter thread about [topic]
Generate a carousel script about [topic] for Instagram
```

Always add: "Use brand-voice.md and past-posts.md for voice reference."

---

## FEEDBACK LOOP (how to improve over time)

When a post performs well:
1. Open `workflow/data/top-performers.md`
2. Paste the post with stats + what worked
3. Next generation: "Write more like the posts in top-performers.md"

This is the data layer getting smarter over time.

---

## FULL PIPELINE

```
1. Generate  → Claude writes posts (using all 3 layers)
2. Review    → You read drafts, adjust if needed
3. Queue     → Claude drops approved posts into Notion Post Queue (Status: Draft)
4. Approve   → You flip Status → Approved in Notion
5. Publish   → Tell Claude: "push approved posts to Buffer"
6. Track     → Note what performs → paste into top-performers.md
```

---

## FOLDER STRUCTURE

```
workflow/
├── data/
│   ├── HOW-TO-GENERATE.md         ← you are here
│   ├── past-posts.md              ← all published posts (seed data)
│   ├── top-performers.md          ← posts with real engagement (fill as you go)
│   ├── brand-voice.md             ← distilled voice rules + examples
│   └── platform-prompts/
│       ├── x-prompt.md            ← full X/Twitter generation prompt
│       ├── instagram-prompt.md    ← full Instagram generation prompt
│       └── tiktok-prompt.md       ← full TikTok script prompt
├── prompts/
│   ├── posts.md                   ← 10 ready-to-post text posts
│   ├── captions.md                ← caption formula + brand words
│   └── images.md                  ← DALL-E prompts + image inventory
├── RML-BRAIN.md                   ← ChatGPT project brain file
└── WORKFLOW.md                    ← full pipeline documentation
```
