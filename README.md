# Chase Content Engine

Creates consistent, reviewable social content from the Chase Analytics ecosystem.

The repository has two operating modes:

- **Current-site mode** — consumes the exact public MLB and NFL JSON contracts used by
  chase-analytics.com, validates freshness and identity, and renders the current matchup
  experience without recalculating site metrics.
- **Legacy MLB model mode** — combines pipeline, projection, and paired-market sources for
  the original Morning Slate, Offensive Report, and Public vs Sharp graphics.

The legacy mode has three upstream responsibilities:

- **MLBMA Pipeline** — current slate, team offense, handedness splits, and trends.
- **MLB Model** — game probabilities, projected runs, and pitcher projections.
- **Sharp Money Tracker / MLB Model Markets** — public-versus-sharp probabilities.

The content engine owns migration, validation, personal-opinion overlays, pagination,
and branded PNG generation. It does not scrape baseball data or calculate betting
signals independently.

The operating cadence is versioned in
[`content_plan/daily_schedule.json`](content_plan/daily_schedule.json), and each graphic's
data contract lives in
[`content_plan/report_contracts.json`](content_plan/report_contracts.json).

## Current-site reports

1. **MLB Live Slate** — every published matchup in chronological order with starters,
   lineup state, records, and conditions.
2. **NFL Weekly** — cards grouped by NFL week and ordered by kickoff, never filtered by
   the number of games carrying model output.
3. **NFL Matchup** — a four-image analysis set: position-based starting offense/defense
   with availability, coverage/pressure confrontation, separate QB/RB/WR evidence, and
   mirrored team-form ranks.

NFL graphics follow the live product rules: segmented block meters, red/yellow/green rank
bands, purple only for brand/selection, `Active` when no injury designation is attached,
and an em-dash rather than a fabricated zero for missing evidence.

## Current-site commands

```bash
# Read a local checkout of chase-analytics.com.
chase-content sync-site --site-root ../mlbma-pipeline --out build/site.json

# Or read the deployed public contracts directly.
chase-content sync-site --site-base https://chase-analytics.com --out build/site.json

# Validate independently; optionally enforce a freshness ceiling.
chase-content validate-site --bundle build/site.json --max-age-hours 36

# Render both public slates, or a four-part NFL matchup analysis.
chase-content site-build --bundle build/site.json --report all --out dist/site
chase-content site-build --bundle build/site.json --report nfl-matchup \
  --game ATL@PIT --out dist/site

# One-step live sync + validation + render. This performs no odds fetch.
chase-content site-daily --site-base https://chase-analytics.com \
  --report nfl-weekly --out dist/site
```

The engine reads only `/data/public/...` endpoints in current-site mode. It does not scrape
the rendered page, call a model, fetch odds, or rewrite league ranks.

## Legacy MLB reports

1. **Morning Slate** — games ranked from most lopsided to most even, with game and
   pitcher projections plus a clearly separated personal-opinion tag.
2. **Offensive Report** — top offenses versus righties and lefties, risers, and fallers.
3. **Public vs Sharp** — pitching, moneyline, and totals disagreements.

## Install

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"
```

On macOS/Linux, use `.venv/bin/python`.

## Daily command

```bash
chase-content daily \
  --pipeline-data ../mlbma-pipeline/data \
  --model-repo ../mlb-model \
  --sharp-json ../sharp-money-tracker/docs/data.json \
  --opinions opinions/2026-07-03.json \
  --out dist/2026-07-03
```

This writes the canonical bundle and all three report families. When
`odds_latest.json` and `prop_odds_latest.json` exist in `--pipeline-data`, the command
uses MLB Model's paired market caches. The legacy Sharp Money JSON fills only categories
that do not have a current MLB Model market export.

## Separate commands

```bash
# Convert upstream data into one stable content contract.
chase-content migrate \
  --pipeline-data ../mlbma-pipeline/data \
  --model-repo ../mlb-model \
  --sharp-json ../sharp-money-tracker/docs/data.json \
  --opinions opinions/2026-07-03.json \
  --out build/2026-07-03.json

# Validate before generating or uploading anything.
chase-content validate --bundle build/2026-07-03.json --require-today

# Generate everything or one report family.
chase-content build --bundle build/2026-07-03.json --report all --out dist/2026-07-03
chase-content build --bundle build/2026-07-03.json --report morning-slate --out dist/2026-07-03
chase-content build --bundle build/2026-07-03.json --report offensive-report --out dist/2026-07-03
chase-content build --bundle build/2026-07-03.json --report public-vs-sharp --out dist/2026-07-03
```

## Opinion file

Personal opinions are an editorial overlay. They never inherit automatically from a
model projection.

```json
{
  "NYY@BOS": {
    "tag": "MY BET",
    "text": "BOS ML -120 · 0.5u"
  },
  "STL@CHC": {
    "tag": "WATCH",
    "text": "Waiting for the confirmed CHC lineup"
  }
}
```

Allowed tags are `MY BET`, `LEAN`, `WATCH`, `PASS`, and `NO OPINION`.

## Publishing rule

The command fails closed when the slate is empty, contains duplicate games, has invalid
probabilities, or carries stale market observations. A human still approves every graphic
before upload.

See [docs/MIGRATION.md](docs/MIGRATION.md) for the upstream contract and cutover plan.
