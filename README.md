# Chase Content Engine

Creates consistent, reviewable social content from the Chase Analytics ecosystem.

The repository has three upstream responsibilities:

- **MLBMA Pipeline** — current slate, team offense, handedness splits, and trends.
- **MLB Model** — game probabilities, projected runs, and pitcher projections.
- **Sharp Money Tracker / MLB Model Markets** — public-versus-sharp probabilities.

The content engine owns migration, validation, personal-opinion overlays, pagination,
and branded PNG generation. It also owns the **recording booth**: live Remotion
graphics, desktop camera, optional phone mic, one take.

The operating cadence is versioned in
[`content_plan/daily_schedule.json`](content_plan/daily_schedule.json), and each graphic's
data contract lives in
[`content_plan/report_contracts.json`](content_plan/report_contracts.json).

## Reports

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

## Recording booth

The studio and Remotion graphics follow the shared [Broadcast Design System](docs/BROADCAST_DESIGN_SYSTEM.md).

Permanent video path for this repo. After `npm install` in `video/`:

```powershell
chase-content booth --sport nfl --games IND@KC --show "Week 3 Sunday Night Football"
.\content.bat booth --sport nfl --games IND@KC
.\booth.bat
```

From an existing Windows checkout, update and launch the current booth in one step:

```powershell
.\update-booth.bat
```

`booth.bat` now installs the video dependencies automatically on its first launch.

Graphics come from the live chase-analytics.com slate plus the hosted nfl-model board
(research only: a gap is a disagreement, not an edge). Takes land in `video/footage/`.
Phone mic: HTTPS on port 8791 (`/mic`); desktop camera stays on the booth page.

### Hosted booth (any computer)

The studio is also on GitHub Pages. Push to `main` (or run the **deploy-booth**
workflow) and open:

**https://alphakiller1.github.io/chase-content-engine/**

Use that URL on another machine: camera and mic stay on that computer, graphics
update from the repo, and a take downloads as a `.webm`. Phone-as-mic and
“Make my video” still need a local `booth.bat` checkout.

Packs rebuild from the live NFL slate on each deploy (about every six hours, and
on every push to `main`).

