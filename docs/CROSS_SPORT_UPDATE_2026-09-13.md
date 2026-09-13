# Chase Analytics Current-Site Content Update

This release moves the content engine from an MLB-only projection workflow to a
cross-sport engine that can follow the current public Chase Analytics product directly.
The original MLB model reports remain supported.

## Authority and safety

Current-site mode reads three public contracts:

| Sport | Contract | Authority |
| --- | --- | --- |
| MLB | `/data/public/mlb/slate.json` | Matchups, starters, records, lineups, venue and weather |
| NFL | `/data/public/nfl/slate.json` | Matchups, starting units, availability, scheme, player and travel evidence |
| NFL | `/data/public/nfl/team_context.json` | Season, week, team-form rates and league pools |

The engine preserves these values. It does not fetch odds, call model promotion logic,
recalculate rankings, or scrape facts from page text. Missing values remain missing.

Validation fails closed for an unknown schema, empty slate, duplicate game ID, missing team
identity, invalid kickoff, sport mismatch, missing/invalid source timestamps, future source
timestamps, or a caller-selected freshness limit.

## Report families

### MLB Live Slate

- Includes every published game.
- Orders games by `kickoff_utc`.
- Shows the probable pitchers, handedness, published ERA, lineup status, and conditions.
- Uses `—` or an explicit unavailable label when the source omits a value.
- Does not require or invent a model projection.

### NFL Weekly

- Groups cards by the published NFL week.
- Orders each week chronologically.
- Includes every game regardless of model coverage.
- Shows teams, records, time, quarterback, availability summary, venue, and game state.
- Uses four cards per 1080×1350 page.

### NFL Matchup

The selected matchup produces four 1080×1350 graphics:

1. **Starting units and availability** — offense and defense are grouped by their published
   packages and positions. Injury-report designations are attached by player name. Any starter
   without an injury designation is explicitly `ACTIVE`.
2. **Scheme confrontation** — the opponent defense's Man, Zone, Cover 0/1/2/3/4/6 frequencies
   sit beside the offense's EPA response. Blitz, pressure, and stacked-box frequency are paired
   with the relevant opponent EPA response.
3. **Skill players by scheme** — independent QB, RB, and WR panels include published headshots,
   volume, efficiency, EPA, source season, and position-pool rank. QB/RB use player-scheme data;
   WR uses player-coverage data.
4. **Team Form** — both teams share mirrored rows and one league-rank scale for ten observed
   offense/defense rates.

All quantitative meters are ten-cell segmented blocks. Rank bands use red, yellow, and green.
Purple is reserved for Chase identity and selection labels, not performance. The graphics do not
use the removed model-trust panels or generic continuous meters.

## Commands

```bash
# Snapshot a local website checkout.
chase-content sync-site \
  --site-root ../mlbma-pipeline \
  --out build/site-content-bundle.json

# Snapshot production and require data no older than 72 hours.
chase-content sync-site \
  --site-base https://chase-analytics.com \
  --max-age-hours 72 \
  --out build/site-content-bundle.json

# Render both public slates.
chase-content site-build \
  --bundle build/site-content-bundle.json \
  --report all \
  --out dist/current-site

# Render a full NFL matchup set by abbreviation key or public game ID.
chase-content site-build \
  --bundle build/site-content-bundle.json \
  --report nfl-matchup \
  --game ATL@PIT \
  --out dist/current-site

# One-step production sync, validation, and weekly render.
chase-content site-daily \
  --site-base https://chase-analytics.com \
  --max-age-hours 72 \
  --report nfl-weekly \
  --out dist/current-site
```

`all` intentionally renders the MLB and NFL slate families. A matchup report requires an
explicit `--game`; the engine does not choose a featured game or create an editorial opinion.

## Compatibility

The existing `migrate`, `validate`, `build`, and `daily` commands and the Morning Slate,
Offensive Report, and Public vs Sharp renderers are unchanged. This lets current-site content
roll out without breaking established MLB model workflows.
