# Chase Analytics video package

Remotion project for the graphics cut into filmed content: short-form (Reels, TikTok,
Shorts) and long-form (YouTube). It covers show furniture, data graphics, illustration
tools and stills.

**The live chase-analytics.com is the design contract**, the same as for the still
posts (`docs/CONTENT_ENGINE_SPEC.md` §1). `src/site/` is exported from production. It
holds the site's brand faces (Archivo as *Chase Sans* / *Chase Display*) and its token
and semantic sheets. Compositions name only semantic tokens (`--surface-*`, `--text-*`,
`--accent*`, `--border-*`, `--font-*`), so a site restyle reaches every video without
an edit here.

```powershell
cd video
npm install
npm run sync-style        # export the site's style into src/site (runs before `npm run dev`)
npm run dev               # Remotion Studio: every composition, Thursday Night Football defaults
```

Double-click **`studio.bat`** (repo root) for the same Studio from the desktop. It
opens on `Formation` (the new studio graphics: formations, player cards, metric
boards, line move, props, last game, **team compare**, **QB matchup**, **scheme
diagrams**). Lions vs Bills numbers there are sample defaults — change the game
in the props panel, or load a packed Sunday game.

Double-click **`sunday-slate.bat`** to rebuild Bengals @ Texans, Jaguars @ Broncos,
Commanders @ Cowboys and Steelers @ Patriots, then open the recording booth with
a game dropdown.

If a render fails with *Brand face(s) did not load* or cannot resolve `./site/index.css`,
run `npm run sync-style`. Any `python -m outputs.content_engine ...` run also refreshes
the export.

## Edit my video (the auto-edit)

Record yourself talking about the game, in one take, on a phone or webcam. Then either:

- drag the file onto **`edit-video.bat`** (repo root), or
- drop it in `video/footage/` and double-click `edit-video.bat` (it takes the newest file).

You get `video/out/edit/<name>-vertical.mp4` (Reels, TikTok, Shorts) and
`<name>-wide.mp4` (YouTube). The folder opens when the render finishes. The editor:

| Step | What it does |
|---|---|
| Prep | Re-encodes to a clean 30 fps proxy (phone HEVC is fine) and levels the voice to -14 LUFS. |
| Listen | Transcribes every word on this machine (whisper.cpp in `video/.whisper`; nothing is uploaded). |
| Cut | Removes pauses over ~0.45 s. Words are aligned to the real speech chunks, so the cuts never clip a word. |
| Redo | Flub a line, say **"redo"** (or "scratch that"), pause, and say it again. The bad sentence and the "redo" are cut. |
| Plan | Follows your cue sheet if there is one (see below). Otherwise it puts the graphic you are talking about in the centre of the frame (see the cue words below) and saves that choice as the cue sheet. The plan prints and is saved to `props/edit/<name>/plan.txt`. |
| Render | Vertical: host strip on top (small camera bubble, live captions, matchup and line), content stage below, sting close. Wide: episode open, content stage in the middle, captions under it, camera in the corner, end screen. |

**Cue words.** A graphic comes up as you say one of these:

| Graphic | Cue words |
|---|---|
| Injury report | injury, injuries, questionable, doubtful. The team and the offense/defense side are read from the same sentence. |
| QB duel | quarterback, QB, either QB's surname |
| Spread vs model | spread, favored, favorite, underdog, cover, line |
| Total vs model | total, over under, the over, the under |
| Power ratings | power ratings, rankings, ranked |
| Unit form | offense, defense, EPA |
| Model read (vertical only) | model, projection, win probability |
| Matchup (the opener) | matchup, tonight |

A graphic stays up at least 5 s, and an injury illustration stays until its walk-through
finishes.

**Options** go after the file, for example `edit-video.bat take.mp4 --format vertical`:

- `--format vertical|wide|both`
- `--platform reels|tiktok|shorts`
- `--focus 0.5,0.35`: where your face sits in the frame
- `--cam-size 220`
- `--mirror`
- `--no-camera`: voice only
- `--music bed.mp3`
- `--no-captions`
- `--model base.en`: faster, less accurate
- `--keep-pauses`
- `--plan-only`
- `--pack props/pack/<game>`: the default is the newest pack

Build the game pack first (`python -m outputs.video_pack ...`, below). The graphics and
lines come from it.

## Record with the graphics live (the recording booth)

The booth is a **content-engine command**, not a side script:

```powershell
.\content.bat booth --sport nfl --games IND@KC --show "Week 3 Sunday Night Football"
.\content.bat booth --sport nfl
```

Double-click **`booth.bat`** for the same studio without rebuilding a pack. A browser
page opens with the finished frame live: tonight's graphic on the stage and your webcam
in its window. You run the show from the keyboard while you talk, and everything you do
is recorded and replayed in the edit.

| Key | What it does |
|---|---|
| **R** | Record, after a 3-2-1 countdown; press again to stop |
| **1 – 0** | Graphic groups: Matchup, Market vs model, QB duel, Team form, Scheme, Formations, Injury boards, Players, Power ratings, Model read |
| **← →** | Filters inside the group, e.g. offense or defense, coverage, pressure, personnel or pass vs looks, each team's formations, each player (with a team filter) |
| **Space / ↓, Shift+Space / ↑** | Next or previous group |
| **/** | Search every graphic and player |
| **A S D F** | Layout: **bubble** (content-first, small round camera), **split** (camera beside or above the content), **graphic only**, **camera only**. The camera window animates between them. |
| **Click a face** | On a formation, spotlights that player: the others dim and a detail card opens. **Esc** clears it. |
| **Drag on the picture** | Draw (**P** turns drawing off). **T** changes the colour, **X** toggles the arrow tip, **C** clears. Drawings also clear when the graphic changes. |
| **M** | Mark a moment. Marks appear in the plan, not in the video. |
| **U / Ctrl+Z** | Undo the last action |
| **?** | Shortcut help |

- **The side panel:** shows the rundown with filter chips, talking points for what is on
  screen (the numbers it shows), and a live log of the take.
- **Setup section:** camera and microphone pickers, a level meter, a mirror toggle, a
  vertical or wide preview (one recording makes both), and instant or animated graphic
  entrances in the preview.
- **After you stop:** **Make my video** runs the edit in its own window. Takes are saved
  to `video/footage/take-<date>-<time>.webm`, with `.cues.txt` (everything you did) and
  `.draw.json` (your drawings).
- **Drawings and formats:** a drawing is placed over the preview you drew it on, so it
  appears only in that format's video.

### Platforms, small graphics and size

- **Vertical is for one app at a time.** Pick Reels, TikTok or Shorts in the booth's
  Setup: each covers a different part of the frame (440 / 420 / 400 px at the bottom),
  and the graphics re-fit themselves. Wide is YouTube.
- **Small graphics over the top** (booth keys **B**, **N**, **K**; cue `overlay <bug|name|ticker> on|off`):
  the matchup bug, a name strap, and a scrolling line ticker. They sit over whatever
  graphic is up and never hide it.
- **Graphic size** (**[** and **]**, cue `size full|compact|small`): pulls the graphic in
  so the picture breathes.
- **Legibility floor:** nothing is drawn below ~20 px at 1080 wide, and every graphic
  auto-fits rather than shrinking type past 82%. `audit2.py` (scratch) walks every
  graphic on all four platforms and reports overflow and the smallest text it finds.

### Last game, and how the panel is organised

- **LastGame** (`last-<team>-passing|rushing|defense`): each club's previous game from
  ESPN's box score - result, six team numbers and the leading players with their
  headshots (`outputs/last_game.py`).
- **Panel sections:** Game (matchup, market, line movement) · Betting (player props) ·
  Teams (last game, form, scheme, power ratings) · Players (QB duel, formations,
  injury boards, player cards). Number keys follow that order.
- **Nothing overflows:** every data graphic measures itself and scales down to fit its
  stage (`Fit` in `src/studio/live.tsx`); full-frame legacy graphics (model read,
  cutaways) are letterboxed into the visible area by `Stage`. `scripts/.../audit`
  walks every graphic in both formats and reports any element outside its stage.
- **Headshots** are stored as 320 px squares; the board's originals run to 5 MB each.

### Live lines, line movement and player props

- **Live lines.** Lines come from DraftKings through ESPN's public odds feed
  (`outputs/live_lines.py`; no key, no credits). They replace the model board's
  snapshot everywhere: the template, the market-vs-model gaps, the cutaway and the
  split frames.
- **Refresh schedule.**
  - The booth re-reads them at start, every 3 minutes (`--refresh-min`) and on its
    **refresh** link. Graphics on screen update in place, and a moved line flashes.
  - `edit-video.bat` refreshes before every render (`--no-refresh` to skip).
  - To refresh by hand, run `python -m outputs.video_pack --refresh video/props/pack/<game>`
    (about a second). It reuses the injury-board captures.
- **LineMove** (`line-move`): opening vs current spread, total and moneylines. Markers
  slide from the open to now, with the model's number as a dashed reference and the
  moneyline-implied win chance then vs now.
- **PropBoard** (`props-all`, `props-<team>`, `props-passing`, `props-rushing`,
  `props-receiving`): the live DraftKings line (with its opening number) next to the
  nfl-model projection, a gap bar, and the research-only note. Player cards list the
  same props.
- **Booth keys.** The booth now has 12 groups: keys 1–0, then **-** and **=**.
- **Drawing and spotlights.** Drag on the picture to draw; click a face to spotlight
  it. **P** turns drawing off.

### The studio graphics

These are built by the game pack from the site's own matchup data.

- **Formation** (`formation-<team>-<unit>`): the ESPN depth-chart starters on a field
  with their headshots. Players jog out from the ball, and each carries an injury badge
  (Q, D or O). Injured backups are listed by name only. Spotlights come from the booth
  or from `focus` lines.
- **PlayerCard** (`player-<name>`): a big portrait on a club-colour field with role and
  availability. Starting QBs add the model's next-game centres.
- **MetricBoard** (`form-offense`, `form-defense`, `scheme-coverage`,
  `scheme-pressure`, `scheme-personnel`, `scheme-passing`): the two clubs mirrored row
  by row, with league-rank badges (quality ranks tier-coloured) and stacked
  coverage-shell and personnel bars.

Headshots download once into `public/players/`.

## Change what happens and when (cue sheets)

Every recording has a cue sheet at `video/footage/<name>.cues.txt`. The booth writes it;
otherwise the auto-edit writes it from what you said. Edit it in Notepad, then run
`edit-video.bat` on the same recording again.

```
0:00.0   matchup
0:05.2   layout   split
0:09.8   spread
0:29.7   formation-buf-offense
0:31.0   focus    Josh Allen
0:33.0   draw     1
0:37.0   clear
0:40.5   scheme-coverage
0:44.0   layout   full
0:52.0   mark     nice answer
1:02.0   layout   host
```

- **Times:** each time is in the **original recording**. A time inside a cut pause lands
  on the next kept moment.
- **Graphic names:** the sheet lists every graphic name and command at the bottom, and
  a typo gets a clear error.
- **Options:** `--cues <file>` uses a different sheet; `--auto-cues` ignores the sheet
  and picks graphics from speech again; `--layout split` sets the starting layout.

## One game, every graphic: the game pack

```powershell
# from the repo root
python -m outputs.video_pack --league nfl --game DET@BUF --show "Thursday Night Football" --tag TNF `
  --title "Can Detroit Keep Pace in Buffalo?" --captures
```

This writes `video/props/pack/<date>-DET-BUF/`, with props for 47 graphics, `pack.json` and
`render.bat`.

**Sources.** All data is live:

- **Site slate** (chase-analytics.com): teams, records, quarterbacks or starters, venue,
  network, availability.
- **Hosted nfl-model board**: DraftKings lines, the model margin, total and win
  probability, power ratings, unit form and QB projections.

The board labels itself **research only** and withholds per-game edges. Every
model-derived graphic says so on screen.

**`--captures`.** Also shoots each club's offense and defense injury formations through
the still engine. Each capture becomes an **Annotate** graphic whose steps come from the
capture itself:

- a push-in on the injury report;
- a highlight on each injured backup;
- a ring on each starter carrying a designation.

**Rendering the pack:**

```powershell
cd video
node scripts/snap.mjs --pack props/pack/2026-09-17-DET-BUF --out out/pack/2026-09-17-DET-BUF/snapshots   # review stills
props\pack\2026-09-17-DET-BUF\render.bat                                                               # every video
```

MLB packs (`--league mlb`) cover identity, starters, open, sting, end screen and
thumbnails. The site's MLB slate publishes no market.

## Catalog

Studio groups these in folders. Overlays render as **ProRes 4444 with alpha**, ready for
DaVinci Resolve. Full-frame pieces render as **H.264**. `--codec` on the CLI overrides
either.

| Folder | Composition | What it is |
|---|---|---|
| Show-Package | `Template-reels` / `-tiktok` / `-shorts` / `-reels-ads` / `-youtube` | The frame: team bands, a transparent camera window, market strip, brand. Platform safe areas come from `src/ds/safe.ts`. |
| | `MatchupBarNFL` / `MatchupBarMLB` | Team-coloured header bar. |
| | `LowerThird` / `LowerThirdWide` | Name strap with an optional club badge and stat. |
| | `CornerBug` / `CornerBugWide` | Persistent matchup bug. |
| | `Sting` / `StingWide` | Brand open/close: the site's lockup, edge draw, wordmark wipe. |
| Cutaways | `NflCutaway`, `MatchupCutaway`, `ModelSnapshot` | Full-frame matchup reads. The model's read carries the research-only strip. |
| | `BoardMotion` / `BoardMotionWide` | Any still-engine capture in motion (`content_engine --video`). |
| Data | `StatDuel` / `Wide` | Head-to-head bars. Colour marks the club, opacity marks the leader. |
| | `LineGap` / `Wide` | Market vs model on one number line, gap bracketed, caveat on screen. |
| | `RankCountdown` / `Wide` | A ranked list revealed bottom-up. Tonight's clubs are highlighted. |
| Long-form | `EpisodeOpen` / `Vertical` | Title sequence: club fields meet, logos land, episode title. |
| | `ChapterCard` / `Vertical` | Segment transition that wipes on and off (alpha). |
| | `AgendaRail` | Rundown rail: done / now / next, with a progress fill. |
| | `SplitFrame` | Desk layout: a transparent camera window beside a data panel (stats, bullets or a capture). |
| | `EndScreen` | YouTube end screen with plates where the end-screen elements go (`guides: true` outlines them). |
| Tools | `Annotate` | Illustration over a site capture: camera push-ins, highlight, circle, underline, arrow, label, spotlight. |
| | `Telestrator` / `Wide` | Draw on your own footage: routes, arrows, rings, X's (alpha). |
| | `Callout` / `Wide` | A pulsing point with a leader line to a counting stat bubble (alpha). |
| Snapshots | `Thumbnail` (1280×720), `ThumbnailVertical` | Stills built for feed-tile size. |
| Edit | `Episode` | The auto-edit: content stage, camera window in four layouts, captions, telestration (props from `scripts/edit.mjs`). |
| Studio | `Formation` / `Wide`, `PlayerCard` / `Wide`, `MetricBoard` / `Wide` | Data-driven graphics from the site's matchup data (see the booth section). |
| Utilities | `SafeZoneCalibration` | A ruler to post once per platform, to read the real UI reserves. |

## Illustrating a capture (Annotate)

Any still-engine post can become an illustrated clip. Marks target a row, heading or
player **by the text the capture shows**. Before anything renders, the engine checks each
target against the capture's recorded anchors.

```powershell
python -m outputs.content_engine deep --sport nfl --games DET@BUF --artifacts nfl_offense_home --video `
  --mark "focus:Also On The Injury Report" `
  --mark "highlight:Tyrell Shavers=Out, not a starter!negative" `
  --mark "reset@6" --mark "circle:Josh Allen=QB1"
cd video
npx remotion render Annotate out/buf-offense.mp4 --props=props/nfl/deep_DETBUF_nfl_offense_home.annotate.json
```

The mark syntax is `type:target[=caption][@seconds][!tone]`:

- **type:** `focus`, `reset`, `highlight`, `circle`, `underline`, `arrow`, `label` or
  `spotlight`;
- **tone:** `accent`, `positive`, `negative`, `caution` or `primary`;
- **timing:** marks without `@` are spaced automatically;
- **durations:** the composition's length follows the steps.

## Stills and snapshots

```powershell
node scripts/snap.mjs --all                      # hero frame of every composition -> out/snapshots
node scripts/snap.mjs --only StatDuel,LineGap    # a subset
node scripts/snap.mjs --only EpisodeOpen --strip 8   # a filmstrip, to review the motion
npx remotion still Thumbnail out/thumb.png --props=props/pack/<game>/thumbnail.json
```

The hero frame is the settled state just before a composition's exit. An overlay still
keeps its alpha, so a near-static graphic can go on the timeline as a held PNG instead of
minutes of ProRes.

## Rules worth knowing

- **Design:** semantic tokens only; the site's lockup (icon plus typeset wordmark), never
  a logo PNG; Title Case titles; no ambient glows.
- **Market vs model:** templates carry the market; model output lives in clearly labelled
  graphics. Never caption a current line as the open (`lineSource`).
- **Leagues:** the league is always explicit, because MLB and NFL share sixteen
  abbreviations.
- **Default props:** Remotion merges `defaultProps` under supplied props. The pack
  therefore writes every optional field explicitly, so a Studio default can never leak
  into a render.
- **Safe areas:** they live only in `src/ds/safe.ts`. Recalibrate with
  `SafeZoneCalibration`.
