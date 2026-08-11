<!-- ⛔ DO NOT ARCHIVE · DO NOT MOVE · DO NOT DELETE · DO NOT EDIT THE CONFIRMED WEIGHTS ⛔ -->
> # ⛔ THIS FILE IS THE EDGE — PERMANENT, NOT A SNAPSHOT
> The owner wrote these formulas himself and has been forced to re-supply them to multiple sessions
> after they were lost, archived, or ignored. **Never archive this file. Never ask him to re-supply a
> formula. Never "improve" a CONFIRMED weight.** See `CLAUDE.md` Rule 0.
> Backups: `~/Desktop/beast-node/MODELS.md` · `~/Desktop/RML/MODELS/RML_MODELS_SOURCE_OF_TRUTH.md`

# RML MODEL FRAMEWORK — the recovered edge (source of truth)

> Recovered 2026-07-16. **This is the EDGE** — the scoring/projection formulas RML uses to
> generate the picks the Beast consumes (via `scan_cache`). Preserved here verbatim, in the
> now-git-tracked repo, because it was previously unbacked.
>
> **PROVENANCE (owner-confirmed):**
> - ✅ CONFIRMED ORIGINAL: PHLT core, WNBA, NBA, NHL SOG, EV, CLV, Ladder, Round Robin
> - ⚠️ RECONSTRUCTION (matches the system's shape, NOT the exact recovered original): Tennis, NFL
>
> Do not silently "improve" the confirmed weights — they are the recovered originals. Reconstructed
> engines (Tennis/NFL) are explicitly open to calibration.

---

## Core PHLT framework (CONFIRMED)
```
PHLT Score = Opportunity/Role + Matchup Edge + Recent Form + Line Value + Discipline/Risk Adjustment
```
100-point version (each input normalized 0–1):
```
PHLT = (Role × 25) + (Matchup × 20) + (Recent Form × 20) + (Line Value × 20) + (Risk/Discipline × 15)
```
```python
def phlt_score(role, matchup, recent_form, line_value, discipline):
    return round(role*25 + matchup*20 + recent_form*20 + line_value*20 + discipline*15, 2)
```

## 1. WNBA Engine (CONFIRMED) — minutes/role first
```
WNBA Score = Minutes×25% + Usage/Role×20% + Matchup×20% + Recent Form×15% + Game Script×10% + Line Value×10%
```
```python
def wnba_prop_score(minutes, usage, matchup, recent_form, game_script, line_value):
    return round(minutes*25 + usage*20 + matchup*20 + recent_form*15 + game_script*10 + line_value*10, 2)
```
Projection: `Per-Minute × Projected Minutes × Usage × Matchup × Pace`
```python
def wnba_projection(stat_per_minute, projected_minutes, usage_multiplier=1.0, matchup_multiplier=1.0, pace_multiplier=1.0):
    return round(stat_per_minute*projected_minutes*usage_multiplier*matchup_multiplier*pace_multiplier, 2)
```
Filters: `Minutes Stability = Projected/Recent Max` · `Usage Change = Current Expected − Season` · `Edge = Projected − Line`
Core order: Minutes → Usage → Matchup → Recent Form → Blowout Risk → Line Value

## 2. NBA Engine (CONFIRMED) — WNBA core + stronger pace/injury/blowout
```
NBA Score = Minutes×20% + Usage×20% + Matchup×20% + Pace×10% + Recent Form×10% + Injury/Role×10% + Line Value×10%
```
```python
def nba_prop_score(minutes, usage, matchup, pace, recent_form, injury_role, line_value):
    return round(minutes*20 + usage*20 + matchup*20 + pace*10 + recent_form*10 + injury_role*10 + line_value*10, 2)
```
Projection: `Per-Minute × Expected Minutes × Usage × Pace × Opponent`
Blowout: `Adjusted Minutes = Base × (1 − Blowout Prob × Blowout Penalty)`
```python
def adjusted_minutes(base_minutes, blowout_probability, blowout_penalty=0.18):
    return round(base_minutes*(1 - blowout_probability*blowout_penalty), 2)
```

## 3. NHL / Hockey Engine (CONFIRMED) — shots on goal
```
NHL SOG Score = Shot Volume×25% + TOI×20% + PP Role×15% + Opp SOG Allowed×15% + Recent Attempts×15% + Line Value×10%
```
```python
def nhl_sog_score(shot_volume, time_on_ice, power_play_role, opponent_sog_allowed, recent_attempts, line_value):
    return round(shot_volume*25 + time_on_ice*20 + power_play_role*15 + opponent_sog_allowed*15 + recent_attempts*15 + line_value*10, 2)
```
SOG projection: `Shots/Min × Projected TOI × Opp Shot Allowance × PP Adj × Game Script Adj`
```python
def nhl_sog_projection(shots_per_minute, projected_toi, opponent_multiplier=1.0, power_play_multiplier=1.0, game_script_multiplier=1.0):
    return round(shots_per_minute*projected_toi*opponent_multiplier*power_play_multiplier*game_script_multiplier, 2)
```
Team totals: `Expected Goals = Team xGF × Opp Def Adj × Goalie Adj × Special Teams Adj × Rest Adj`

## 4. Tennis Engine (⚠️ RECONSTRUCTION — not the exact recovered original)
```
Tennis Score = Surface Form×20% + Serve Edge×20% + Return Edge×20% + Recent Form×15% + Fitness×10% + H2H×5% + Line Value×10%
```
```python
def tennis_match_score(surface_form, serve_edge, return_edge, recent_form, fitness, h2h, line_value):
    return round(surface_form*20 + serve_edge*20 + return_edge*20 + recent_form*15 + fitness*10 + h2h*5 + line_value*10, 2)
```
Hold/Break: `Expected Hold = Player Hold% adj by Opp Return Win% & Surface` · `Expected Break = Player Return Win% adj by Opp Hold% & Surface`
Match: `Match Edge = Model Win Prob − Market Implied Prob`

## 5. NFL Engine (⚠️ RECONSTRUCTION — exact original weights not preserved)
```
NFL Side Score = QB Edge×20% + OL×10% + Def Matchup×15% + Explosive×10% + Turnover Regression×10% + Injury×10% + Rest/Travel×5% + Weather×5% + Line Value×15%
```
```python
def nfl_side_score(qb_edge, offensive_line, defensive_matchup, explosive_play, turnover_regression, injury_edge, rest_travel, weather, line_value):
    return round(qb_edge*20 + offensive_line*10 + defensive_matchup*15 + explosive_play*10 + turnover_regression*10 + injury_edge*10 + rest_travel*5 + weather*5 + line_value*15, 2)
```
Total: `Projected Total = Home Expected Points + Away Expected Points` · `Expected Points = EPA/play × Expected Plays × Opp Adj × RZ Adj × Weather Adj`

## Shared EV Engine (CONFIRMED)
```
EV = (Model Prob × Profit) − ((1 − Model Prob) × Stake)
```
```python
def expected_value(model_probability, decimal_odds, stake=1.0):
    profit_if_win = stake*(decimal_odds - 1)
    ev = model_probability*profit_if_win - (1 - model_probability)*stake
    return round(ev, 4)
```
`EV% = EV / Stake × 100`
```python
def american_to_implied_probability(odds):
    return abs(odds)/(abs(odds)+100) if odds < 0 else 100/(odds+100)
```

## CLV Engine (CONFIRMED)
```
CLV = Closing Line − Entry Line
CLV% = Closing Implied Prob − Entry Implied Prob
```
```python
def clv_percent(entry_probability, closing_probability):
    return round((closing_probability - entry_probability)*100, 2)
```

## Ladder Engine (CONFIRMED)
```
Ladder Score = PHLT×35% + EV×25% + Line Safety×15% + Bankroll Fit×15% + Discipline×10%
```
```python
def ladder_score(phlt, ev, line_safety, bankroll_fit, discipline):
    return round(phlt*0.35 + ev*0.25 + line_safety*0.15 + bankroll_fit*0.15 + discipline*0.10, 2)
```

## Round Robin Engine (CONFIRMED)
```
RR Score = Avg Leg Quality + Independence Bonus − Correlation Penalty − Exposure Penalty
```
```python
from statistics import mean
def round_robin_score(leg_scores, independence_score, correlation_penalty, exposure_penalty):
    base = mean(leg_scores)
    return round(base*0.70 + independence_score*0.20 - correlation_penalty*0.05 - exposure_penalty*0.05, 2)
```

## Play thresholds (uniform scale)
```
85–100 = Elite   ·  75–84 = Strong  ·  68–74 = Lean  ·  60–67 = Watch  ·  <60 = Pass
```
⚠️ **NAMING NOTE:** RML's user-facing brand uses PHLT tiers **Prime / Strong / Caution / Fade** (no
gambling words — see brand rules). These engineering thresholds (Elite/Strong/Lean/Watch/Pass) are the
INTERNAL scoring scale. Reconcile the mapping before any of this reaches user-facing copy.

---
## Where this fits the architecture (open decision — NOT yet acted on)
These are **RML MODEL** formulas. Today the **Beast does NOT recompute props** — it consumes RML's
finished picks via Supabase `scan_cache` (`evEdge.js` → `picks.js`). So the natural home for these is
the **RML sports app** (`~/Desktop/risk-matrix-labs`) or a shared lib, feeding `scan_cache`, NOT
beast-node. Preserved here for durability; decide placement deliberately. **Validation mode still holds
— this is preservation, not a build task.**
</content>
