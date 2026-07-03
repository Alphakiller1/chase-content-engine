# Chase Analytics — Image-Mockup Prompt (contract-bound)

**Version:** 1.0.0 · Governed by [`CONTENT_DESIGN_CONTRACT.md`](CONTENT_DESIGN_CONTRACT.md).

Use this when asking an image model to produce a **concept mockup** of a Chase Analytics daily
graphic. A mockup that violates any MUST-NOT below is rejected. The image model produces a
*visual reference only* — real graphics are rendered by `render.py` from live data with real logo
and team-logo assets. **Never let an image model draw the Chase logo or any MLB team logo** — those
are composited from approved files afterward; in a concept, leave clearly marked placeholder boxes
for them.

---

## Shared prompt preamble (paste before any report-specific block)

> Design a single **1080 × 1350** portrait social graphic for **Chase Analytics**, a premium MLB
> analytics terminal. Dark, dimensional, data-dense but readable on a phone. It must read like a
> compact analytics terminal — **not** a landing-page hero, sportsbook ad, broadcast lower-third,
> picks account, spreadsheet screenshot, or SaaS dashboard.
>
> **Exact palette (use only these):** canvas `#08090F`; surfaces `#12141D` / `#181B26` / `#20232F`;
> borders `#262A38` / `#363B4D`; text `#F5F6FA` (primary) / `#A4A8B6` (label) / `#6E7383` (meta);
> Chase purple `#9A6BFF` with `#5B2BE0` / `#C4B0FF`; status green `#3CCB7F`/`#86D76F`, warning
> `#E8C24A`, red `#F2545B`. No other colors — **no blue**, no teal-as-accent, no neon.
> **Fonts:** DM Sans (body/labels), Roboto Condensed (all headings + numbers, tabular).
> **Headings:** report title and major section headings use a vertical **metallic-silver** text
> fill (`#FFFFFF → #E9EAF0 → #9DA0AE → #D7D9E2 → #FFFFFF`), never flat white or purple. Purple is
> an accent only.
>
> **Header (compact utility bar, 150–190 px tall):** left = a placeholder box labeled
> `[CHASE HORIZONTAL LOGO ~210px]`; right/same row = the report title (40–48 px, metallic silver).
> One thin metadata line below (date · update time ET · state · page). **No eyebrow, no subtitle,
> no descriptive paragraph.** Content starts immediately under a hairline divider.
>
> **Cards are dimensional:** primary surface, 1.5 px violet hairline border, a 2 px violet top-edge
> glint, subtle inner top highlight, one controlled shadow, 18–22 px radius. No flat, borderless,
> shadowless cards.
>
> **Numbers are colored by value** (red weak → amber average → green strong; invert where lower is
> better), digits colored and labels neutral gray. **No visible color-gradient key/legend.** Color
> is never the only status signal. Green does not mean "bet"; purple means Chase/selection, not a
> recommendation. Every team shows a `[TEAM LOGO]` placeholder box + its text abbreviation
> (abbreviations 22–28 px, subordinate to the logo). Footer: `Updated <time> · Model projections
> are not guarantees.` left, `chase-analytics.com` right.

---

## Morning Slate block

> Show **4 matchup cards** stacked (190–220 px each), ranked from largest model **run separation**
> to closest. Each card mirrors an away/home layout of equal width:
> - left/right: `[TEAM LOGO 40px]` + abbreviation (24 px) on each side, a small centered `@`
>   medallion on a raised chip between them;
> - one clearly labeled **RUN PROJECTION** row: `away X.X — Y.Y home` (Roboto Condensed, colored by
>   value);
> - a separation tag top-right (LOPSIDED / CLEAR EDGE / LEAN / TOSS-UP);
> - two compact pitcher lines: `Name · 5.8 IP · 2.7 ER · 7.1 K` (one per side);
> - a bottom rail: an opinion chip (`MY BET` green / `LEAN` purple / `WATCH` amber / `PASS` gray)
>   with a one-line note, and the lineup state at right.
>
> **Do NOT show win probability, a win-probability bar, any percentage, pitcher portraits, a
> "CHASE'S CARD" label, or repeat the word "projected" beside every number.** Run projection is the
> only game-model number on the card.

## Offensive Report block

> Four panels (2×2): **TOP VS RIGHTIES**, **TOP VS LEFTIES**, **RISERS**, **FALLERS**. Each panel:
> metallic-silver section heading, 5 compact team rows = rank · `[TEAM LOGO]` + abbr · OSI value
> (colored by league value) · a small `YTD → L7` window note; risers/fallers show a signed delta
> colored by value. No legend. Compact small-sample warning where applicable.

## Public vs Sharp block

> Three stacked panels: **PITCHING**, **MONEYLINE**, **TOTALS**, ranked by absolute divergence.
> Each row: game/player + market/line on the left; on the right a **public** probability in neutral
> gray and a **sharp** probability in restrained purple `#C4B0FF`, then a signed divergence colored
> by magnitude (not green=good) and an observation timestamp beneath. Thin secondary comparison bar
> allowed behind the numbers. Team markets show `[TEAM LOGO]` placeholders. Language is
> "observation" — never "play", "lock", or "smart money". No legend.

---

## Reject the mockup if it shows

- An oversized hero heading, eyebrow, or subtitle on a daily graphic.
- Team abbreviations larger than ~28 px or dominating the card.
- Win probability anywhere on Morning Slate (numbers, bars, or split).
- A drawn/traced Chase logo or a drawn MLB team logo (must be placeholders).
- A visible red→green gradient key / seven-color strip.
- Flat white or purple headings (must be metallic silver).
- Flat, borderless cards with no depth.
- Any non-token color (blue, teal accent, neon).
- A "CHASE'S CARD" / "PERSONAL VIEW" label.
- Pitcher face portraits presented as real players.
- Green used to signal "bet" or divergence framed as guaranteed profit.
