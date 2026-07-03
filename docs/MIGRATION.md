# Migration Project

## Goal

Give content production one stable command surface while MLBMA Pipeline, MLB Model, and
Sharp Money continue evolving independently.

## Authority map

| Domain | Authority | Content use |
|---|---|---|
| Slate identity and status | MLBMA Pipeline | Teams, start time, starters, hands |
| Offense versus RHP/LHP | MLBMA Pipeline | Offensive Report |
| Team trajectory | MLBMA Pipeline | Risers and fallers |
| Expected runs and win probability | MLB Model | Morning Slate ranking |
| Pitcher IP/ER/K projections | MLB Model | Morning Slate pitcher rows |
| Sharp/public prices | MLB Model Markets | Public vs Sharp |
| Legacy sharp export | Sharp Money Tracker | Transitional fallback only |
| Bet/opinion label | Human editor | Editorial overlay |

## Boundary

The content engine reads published files and model APIs. It must not import MLBMA's compute
functions, duplicate the expected-runs model, or calculate sharp consensus itself.

## Canonical bundle

Every migration creates one JSON bundle:

```text
meta
  slate_date
  generated_at
  run_id
  sources
games[]
offense
  vs_rhp[]
  vs_lhp[]
  risers[]
  fallers[]
markets
  pitching[]
  ml[]
  totals[]
```

Downstream renderers read only this contract.

## Required upstream improvements

### MLBMA Pipeline

Add these fields to every daily export:

- `Slate_Date`
- `MLB_Game_PK`
- `Run_ID`
- `Generated_At`

Publish the full daily dataset atomically. Do not update `Last_Updated` when only one
component succeeded.

### MLB Model

Add a first-class JSON exporter containing:

- Game identity
- Projected away/home runs
- Away/home win probability
- Model confidence and coverage
- Pitcher projected IP, ER, and strikeouts
- Promotion status
- Market rows with timestamps

Until that exporter exists, this repository's model adapter calls the public
`DataRepository`, `model_probabilities`, and `build_pitcher_board` APIs.

The current MLB Model live-sync command uses the POSIX-only `%-I` `strftime` directive
in `build_today_matchups.py`. On Windows this raises `ValueError: Invalid format string`.
Replace it with a cross-platform 12-hour formatter before making model sync part of the
content scheduler. This does not affect content generation when `--pipeline-data` already
points at a completed MLBMA run.

### Sharp Money Tracker

The legacy `docs/data.json` adapter remains available during cutover. New content should
prefer MLB Model's paired, de-vigged market output. Legacy observations without current
timestamps are discarded.

The migration command reads `odds_latest.json` and `prop_odds_latest.json` through MLB
Model's public market classes. It does not reimplement de-vigging or book classification.
The legacy export fills only a category for which MLB Model has no current cached rows.

## Cutover phases

1. **Shadow:** Generate graphics without publishing. Compare against each source UI.
2. **Manual:** Editor adds opinions, approves PNGs, and uploads manually.
3. **Scheduled:** Approved assets can be queued by platform integrations.
4. **Automated:** Only after run IDs, slate integrity, and publishing audit history are enforced.

## Definition of done

- One command produces all daily graphics.
- A stale or mixed slate cannot render.
- Model and personal opinions are visually distinct.
- Every graphic carries an update time.
- Every published asset is reproducible from its saved bundle.
