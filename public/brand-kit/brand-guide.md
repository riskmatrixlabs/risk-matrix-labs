# Risk Matrix Labs — Brand Guide

## Brand Identity
**Product:** Risk Matrix Dashboard  
**Tagline:** Operate With Discipline.  
**Secondary Tagline:** Discipline Today. Freedom Tomorrow.

---

## Colors

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#0A0A0A` | Primary dark background |
| Card | `#0d0d0d` | Card surfaces |
| Card Alt | `#111111` | Secondary card surfaces |
| Neon Green | `#BDFF00` | Primary brand accent, CTAs, highlights |
| Accent Green | `#39FF14` | Secondary accent (sparingly) |
| Red | `#FF3B3B` | Loss, alerts, danger states |
| Yellow | `#F5A623` | Warning, open bets, tilt states |
| White | `#FFFFFF` | Pure white (use sparingly) |
| Text | `#e8e8e8` | Primary body text (dark mode) |
| Muted | `rgba(255,255,255,0.32)` | Subtext, labels |
| Border | `#1e1e1e` | Card borders |
| Border Alt | `#2a2a2a` | Elevated borders |

### Neon Green Usage Rules
- Use `#BDFF00` on dark backgrounds only
- On light backgrounds use dark olive `#3A5C00` for text
- Keep as accent — never fill large surfaces with neon
- Glow: `0 0 18px rgba(189,255,0,0.28)`
- Border: `rgba(189,255,0,0.28)–0.5`

---

## Typography

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|---------|
| Headlines | Rajdhani | 700 | 32–72px | -0.01em to 0.04em |
| Sub-headlines | Rajdhani | 600 | 18–28px | 0.1–0.22em |
| Labels / Badges | Rajdhani | 700 | 8–12px | 0.18–0.32em UPPERCASE |
| Body | Inter | 400–500 | 13–16px | 0 |
| Small / Caption | Inter | 400 | 11–12px | 0.04em |

### Rules
- All labels and badges: UPPERCASE + high letter-spacing
- Headlines: Rajdhani 700 always
- Never use Inter for headlines
- Never use Rajdhani for long-form body copy

---

## Logo Files (public/brand-kit/)

| File | Usage |
|------|-------|
| `logo-horizontal.svg` | Default — navbar, headers, email |
| `icon-mark.svg` | Favicon, app icon, small placements |
| `logo-white.svg` | On dark backgrounds without neon |
| `logo-black.svg` | On white/light backgrounds |
| `logo-dashboard.png` | Dashboard header (existing) |
| `logo-labs.png` | Landing page / marketing (existing) |

---

## Spacing & Grid

- Base unit: `4px`
- Card padding: `14–28px`
- Section padding: `80–140px` vertical, `40px` horizontal
- Max content width: `1200px`
- Mobile breakpoints: `640px` (mobile), `900px` (tablet)
- Gap (cards): `6–20px`

---

## Component Patterns

### Cards
```
background: rgba(255,255,255,0.02)
border: 1px solid rgba(255,255,255,0.07)
border-top: 2px solid rgba(189,255,0,0.3)
border-radius: 4px
```

### Primary CTA Button
```
background: #BDFF00
color: #0A0A0A
font-family: Rajdhani 700
letter-spacing: 0.18em
text-transform: uppercase
border-radius: 3px
```

### Pill Badge
```
border: 1px solid rgba(189,255,0,0.32)
background: rgba(189,255,0,0.06)
color: #BDFF00
font: Rajdhani 700 10px 0.22em UPPERCASE
```

### Hex Grid Pattern (SVG)
```
polygon points: "28,2 52,14 52,34 28,46 4,34 4,14"
stroke: #BDFF00 at 0.04–0.06 opacity
pattern size: 56x48
```

---

## Social Dimensions

| Platform | Size | Asset |
|----------|------|-------|
| Instagram Post | 1080×1080 | dashboard-v2.png |
| Instagram Story | 1080×1920 | dashboard-v2.png |
| YouTube Thumbnail | 1280×720 | dashboard-v2.png |
| Twitter/X Header | 1500×500 | logo-horizontal.svg |
| Discord Banner | 960×540 | dashboard-v2.png |
| Email Header | 600×200 | logo-dashboard.png |

---

## Voice & Tone

- **Direct.** No fluff.
- **Disciplined.** Military/operator feel.
- **Not a gambling app.** A risk management platform.
- Words to use: Operate, Discipline, System, Track, Execute, Control
- Words to avoid: Bet, Gamble, Win, Pick, Tip, Lock

---

## Do's and Don'ts

✅ Dark backgrounds with neon green accents  
✅ Sharp geometric layouts  
✅ Rajdhani uppercase for all labels  
✅ Subtle hex grid patterns  
✅ Glow effects on key accents  

❌ Neon green as text on light backgrounds  
❌ Stock photos  
❌ Purple gradients or generic SaaS aesthetics  
❌ Rounded corners (max 4px)  
❌ Bright backgrounds  
