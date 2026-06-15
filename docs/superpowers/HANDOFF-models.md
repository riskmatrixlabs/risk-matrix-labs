# HANDOFF — CH2 models (PHLT props + O/U totals) & this session's work

Branch `feat/game-browser-lab` · prod SW **rml-v217** · working tree clean.
Read the memory files first: `rml-phlt-model`, `rml-ou-model`, `rml-ch2-vision`, `project-rml`.

## What shipped this session (v178 → v217, all live + committed)
**Slip / Bet Matrix:** moved to a bottom-left neon ticket FAB (opens upward, 📷 Pic + 📊 Analyze + ➦ Share in header); centered confirm + log modals; **Parlay/Straights toggle**, per-leg on/off switches, edge badges, "PLACE ON <book>" CTA + every parlay book row tappable, deep links threaded per-book (`byBookLink`), "not in your region" collapsed to top-2 + dropdown. Crisp chat removed.
**CH2 LOOK:** chart junk-spike fixed (consensus-prob outlier reject), date strip wired, Line-Movement ⚙ settings gear, props open by default + ↻ REFRESH, all prop cards open, stat tab defaults to first prop, **−EV no longer shown green** (green=+EV only, red=−EV), Player Props moved below Compare Books.
**Books:** Novig/ProphetX/Fliff/Rebet surfaced (added `us_ex` region; Onyx is sign-up-only — not in feed); nationwide-placeable in `geoBooks`.
**CREDITS (important):** opening a game now costs **0** — `scan-props` + `game-lines` serve **cacheOnly** on auto-load; paid fetch only on explicit ↻ REFRESH (which also adds `us_ex`/Novig). This fixed a real bleed.
**Player card:** real ESPN stats — season line (AVG/OPS + H/HR/RBI/R/SB) + LAST-5 form (`api/player-stats.js`, free, cached 15min; captures ESPN athlete id in `player-search`).
**Game card:** `api/game-info.js` (free ESPN, date-aware, hardened with fetch timeouts + try/catch) → logos, W-L records, status/score, MLB probable pitchers + ERA, and the **Over/Under lean flag** (ballpark factor + starter ERA). `GameCard` in `MatrixBot.jsx`.
**Flows verified:** CH1 search→CH2 (player carries over) and CH1 bot-pick→CH2 (game card + props) both work. Readability: `--muted` brightened 0.32→0.56 (dark) / 0.4→0.6 (light).

## NEXT — two models to build (both ALL FREE, confirmed)

### A) PHLT v2.2 — hitter HIT prop model → Player Props panel  (see `rml-phlt-model`)
Owner's own system. Score each "to get a hit" prop 0–100 → A/B/C/Avoid badge + auto-fades.
- Matrix: Pitcher Profile 30 · Hitter Form 30 · Matchup 15 · Park/Weather 10 · Hot Streak 15.
- Fades: Cold Zone (0 hits last 4 OR BB%>15%); Red Flag Pitcher (K%>27, Whiff%>30, xBA<.220 — any 2 = fade).
- Data: form/streak/BB% from `player-stats` gamelog (HAVE); park (HAVE); **xBA/whiff%/K% from Baseball Savant CSV — FREE, VERIFIED**: `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=2026&filterType=bip&min=q&csv=true` (cols: last_name,first_name,player_id,est_ba…). Savant uses MLBAM ids → **match by name**; cache daily.
- Build order: `api/savant.js` (fetch+cache+name-match — the de-risked-but-unbuilt piece FIRST) → `src/lib/phlt.js` (scoring) → wire badges/sort into `PropsPanel`.

### B) O/U totals model → game card flag  (see `rml-ou-model`)
Reframe: the posted total prices most of it; find what the line under-weights and **anchor lean to the live total** (pull totals from `game-lines`). Highest-value adds (market is slow on these): **bullpen quality+fatigue (owner #1), weather (wind dir+temp, open-meteo + park coords), umpire (tight zone=over), late lineups.** Upgrade raw ERA → FIP/K%/recent-form.

## Gotchas (don't relearn)
- Bump `public/sw.js` CACHE every deploy. Test ONLY on app.riskmatrixlabs.com. Deploy: `npm run build && npx vercel deploy --prod --force`.
- ESPN/Savant fetches: server-side only (browser CORS blocks). Cache them (they barely move) so they're free.
- Don't auto-fetch paid Odds-API on game open — cacheOnly pattern (see scan-props/game-lines `cacheOnly`/`ex` params).
- Local shell has no outbound internet for arbitrary curl, but `vercel deploy` + WebFetch + the live app's own fetches work.
