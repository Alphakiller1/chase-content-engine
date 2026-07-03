# Chase Analytics — Content Design Contract

**Version:** 1.0.0
**Status:** Canonical. This file governs every daily Chase Analytics social graphic (Instagram +
X). A graphic that violates a MUST rule here is not publishable.
**Applies to:** `chase_content/render.py` and any future renderer or image-generation agent.

This is an enforceable contract, not design advice. Every rule is measurable. Where a rule
constrains a pixel value, that value is the contract — not a suggestion. Subjective language
("clean", "pop", "modern") is deliberately absent.

## Source-of-truth order

When references conflict, resolve in this order:

1. The owner non-negotiables (§2) — highest authority.
2. Deployed ChaseAnalytics.com visual language.
3. mlbma-pipeline design-system tokens + approved assets (`dashboard/mlbma_design_system.css`,
   `dashboard/assets/`, `dashboard/mlbma_assets.js`).
4. This contract's component/report rules (§4–§8).
5. Existing `render.py` behavior — **lowest**. The renderer changes to meet the contract; the
   contract is never weakened to match the renderer. Current conflicts are catalogued in §14.

---

## 1. Canonical tokens

Colors are the exact Chase tokens. Do not introduce any color not listed here (`render.py`'s
`BLUE #60A5FA` is **not** a Chase token and must be removed — §14).

### 1.1 Surfaces & text
| Token | Hex | Use |
|---|---|---|
| Canvas | `#08090F` | Full graphic background |
| Recessed surface | `#0E1018` | Inset wells |
| Primary surface | `#12141D` | Card body |
| Elevated surface | `#181B26` | Card header band / raised row |
| Raised surface | `#20232F` | Chips, medallion, inner pill |
| Border | `#262A38` | Default hairline |
| Strong border | `#363B4D` | Card outline, section divider |
| Primary text | `#F5F6FA` | Values, team abbr |
| Secondary text | `#A4A8B6` | Labels |
| Metadata | `#6E7383` | Timestamps, footnotes |
| Disabled text | `#4C5161` | Unavailable / N/A |

### 1.2 Brand & status
| Token | Hex | Meaning |
|---|---|---|
| Chase purple | `#9A6BFF` | Brand identity, **selection/comparison** — never "good bet" |
| Purple dark | `#5B2BE0` | Gradient end, depth |
| Purple light | `#C4B0FF` | Sharp identity, accents on dark |
| Positive | `#3CCB7F` | Strong (status only) |
| Above average | `#86D76F` | Above-average |
| Warning | `#E8C24A` | League-average band / caution |
| Risk / error | `#F2545B` | Weak / stale / error |

### 1.3 League-anchored metric color scale (7-step)
Digits are colored by the MLBMA `metricColor` league anchor (`dashboard/mlbma_design_system.css`
`--metric-*`), **not** re-scaled to the teams in one graphic.

| Step | Hex |
|---|---|
| very-weak | `#F2545B` |
| weak | `#F0935B` |
| below | `#E8C24A` |
| neutral (≈ league avg) | `#A1A1AA` |
| above | `#86D76F` |
| strong | `#4ADE80` |
| elite | `#22C55E` |

### 1.4 Type
- **Body font:** DM Sans.
- **Display + all numerics:** Roboto Condensed (tabular). Numbers never use a proportional font.
- The renderer MUST bundle DM Sans + Roboto Condensed and MUST NOT fall back to Arial/DejaVu for
  shipped graphics (§14 conflict C11).

### 1.5 Metallic-silver heading fill (MANDATORY for report titles + major section headings)
```
linear-gradient(180deg, #FFFFFF 0%, #E9EAF0 38%, #9DA0AE 56%, #D7D9E2 72%, #FFFFFF 100%)
```
Applied as a **text fill** (vertical). Report titles and major section headings MUST use this
fill. They MUST NOT be flat white, flat gray, or purple. Purple is an accent, never a heading
color.

---

## 2. Owner non-negotiables (hard prohibitions)

Every item below is a MUST-NOT. A graphic that trips any one is unpublishable.

1. No oversized hero-style report headings (title ≤ 48 px — §3).
2. No large explanatory copy block above the daily data.
3. No eyebrow, series label, or subtitle on daily data graphics (§3.4).
4. No oversized team abbreviations (≤ 28 px, subordinate to logo + run values — §5).
5. No matchup card taller than 220 px (standard) / the compact-mode bound (§5).
6. **Never show projected runs and win probability together.** Morning Slate shows **projected
   runs only** — win probability MUST NOT appear on Morning Slate at all (§5).
7. No generic rigid three-column / spreadsheet matchup layout.
8. No repeated "CHASE'S CARD" / "PERSONAL VIEW" ownership label on matchups (§6).
9. No AI-generated, traced, face-swapped, or unverified pitcher portraits (§7).
10. No visible red→green gradient key, legend, or seven-color strip in daily content (§4.3).
11. No flat white/purple headings — metallic silver is mandatory (§1.5).
12. No flat, dimensionless cards — the layered Chase card treatment is required (§4.1).
13. Never typeset, trace, redraw, recolor, crop, or approximate the Chase logo (§4.2).
14. Green MUST NOT automatically mean "bet". Purple MUST NOT mean "good bet".
15. Divergence/disagreement MUST NOT be presented as guaranteed profit; use "observation", never
    "play", "lock", or "smart money bet" (§8).

---

## 3. Canvas, grid, header anatomy

### 3.1 Canvas
- Standard feed canvas: **1080 × 1350** (4:5 portrait).
- Safe margin: **60 px** left/right, **45 px** top, **56 px** bottom. No critical content or logo
  inside the margin.
- Background: canvas `#08090F` with the Chase radial violet glow permitted at ≤ 14% opacity in the
  top-right and bottom-left corners (matches `mlbma_design_system.css` body background). The glow
  MUST NOT reduce text contrast below §12.

### 3.2 Spacing scale
Use only these steps (px): **6, 10, 14, 20, 26, 34, 44**. Gaps between cards: 14. Card inner
padding: 22 (matchup) / 26 (rank/market panels).

### 3.3 Type scale (px)
| Role | Size | Font | Fill |
|---|---|---|---|
| Report title | 40–48 | Roboto Condensed 800 | metallic silver (§1.5) |
| Major section heading | 26–30 | Roboto Condensed 800 | metallic silver (§1.5) |
| Metric value (primary) | 26–34 | Roboto Condensed 800 | league metricColor (§4.3) |
| Team abbreviation | 22–28 | Roboto Condensed 700 | primary text |
| Body / row value | 20–22 | Roboto Condensed 700 | per role |
| Label | 16–18 | DM Sans 600 | secondary text |
| Metadata / footnote | 13–15 | DM Sans 500 | metadata |

### 3.4 Daily header anatomy (utility header, 150–190 px total)
The daily report header is a compact utility bar, NOT a hero.

- **Total header height: 150–190 px** (from canvas top to the divider line). Content begins
  immediately below.
- **Row 1 (shared when practical):** approved Chase **horizontal logo** on the left
  (`chase-logo-horizontal-light.png`, rendered **190–230 px wide**, aspect ratio preserved,
  transparent background) + the **report title** (40–48 px, metallic silver) on the same baseline
  row.
- **Row 2 (one compact metadata line):** slate date · update time (ET) · state · page `n / N` —
  all in metadata color, single line, ≤ 15 px.
- A 2 px strong-border divider closes the header.
- **Prohibited in the header:** eyebrow, "CHASE ANALYTICS" typeset wordmark, subtitle, descriptive
  paragraph, series identity. Explanatory context lives in the post caption, never on the canvas.
- Eyebrow/subtitle are allowed **only** on carousel covers, educational, or campaign graphics
  where daily analytical data is not the primary payload (out of scope for daily reports).

### 3.5 Footer
One line at the bottom safe area: `Updated <ET timestamp> · Model projections are not
guarantees.` (metadata color) on the left; `chase-analytics.com` (purple light) on the right.

---

## 4. Shared component contracts

### 4.1 Card (dimensional — required)
Cards MUST carry the layered Chase treatment (derived from the live matchup cards):
- Body: primary surface `#12141D` (or the vertical panel-glass gradient `#1A1D2D → #0D101B →
  #06070D` for feature cards).
- Border: 1.5–2 px, violet hairline `rgba(154,107,255,0.41)`.
- Top edge: a 2 px violet gradient glint (`#7C4DFF → #C4B0FF → #7C4DFF`) OR a subtle inner top
  highlight `inset 0 1px 0 rgba(255,255,255,0.08)`.
- Radius: 18–22 px.
- A single controlled drop shadow for depth. Flat, borderless, shadowless cards are prohibited.

### 4.2 Logo asset contract
- **Chase logo:** use the approved file only. Dark canvas → `chase-logo-horizontal-light.png`
  (purple bell curve + metallic wordmark on transparent). Never typeset "Chase Analytics" as text,
  never trace/recolor/crop/distort. Stacked/icon variants only for non-daily formats.
- **Team logos:** REQUIRED wherever a team is identified. Source + abbreviation mapping MUST match
  `dashboard/mlbma_assets.js`: `https://a.espncdn.com/i/teamlogos/mlb/500/<espnAbbr>.png` via the
  `ESPN_ABBR_MAP` (e.g. `ATH→oak`, `KCR→kc`, `SDP→sd`, `SFG→sf`, `TBR→tb`, `WSN→wsh`, `CWS→chw`).
  Preserve transparent background + aspect ratio.
- Always pair a team logo with its text abbreviation (accessibility).
- **Fail closed:** if a required logo (Chase or team) cannot be resolved, the export FAILS. Never
  publish a fabricated, traced, or substituted mark. Never ask an image model to invent an MLB
  logo.

### 4.3 Number-color contract
- Registered metric digits are colored by the league-anchored `metricColor` scale (§1.3), with
  correct inversion for lower-is-better metrics (ERA, projected ER, HR/9, divergence-against).
- **Color the digits; keep labels neutral** (secondary text).
- Unavailable value → disabled gray `#4C5161`, never a colored zero.
- **No visible gradient key / legend / seven-color strip** in daily content.
- Color is never the sole status carrier — pair with a sign, arrow, or word.
- An unregistered metric MUST NOT be invented a grade; render it neutral.

### 4.4 Personal-opinion rail (shared)
- Approved tags only: `MY BET`, `LEAN`, `WATCH`, `PASS`, `NO OPINION`.
- Render the tag chip + an optional one-line note. Nothing else. No "CHASE'S CARD" / "PERSONAL
  VIEW" prefix.
- Tag chip colors: `MY BET` positive, `LEAN` purple, `WATCH` warning, `PASS`/`NO OPINION` metadata.
  These color the **tag chip identity**, not a bet recommendation.
- Opinion is visually separated from model projections (own rail/region).
- An opinion is NEVER auto-derived from probability, projection, or divergence — it is an editorial
  input only.
- `MY BET` MUST include the market and the recorded price (e.g. `MY BET · BOS ML -120 · 0.5u`).
  Longer reasoning goes to the caption.

---

## 5. Morning Slate — compact matchup card

Ranked from **largest model run separation** to closest game. Uses a **compact adaptation** of the
ChaseAnalytics.com hero-matchup card — not the full hero card at hero scale.

### 5.1 Density
- **Standard: 4 cards per page.** **Compact mode: 5 cards per page** (only when the slate needs it).
- Standard card height: **190–220 px**. Compact mode may go below 190 px but all critical text
  MUST stay readable at phone-preview size.
- Max **3 pages**. Ranking + pagination are global across pages.

### 5.2 Ranking
- Sort key: **model run separation** = `abs(home_runs − away_runs)`, descending. This is the sole
  ranking signal. Win probability MUST NOT drive Morning Slate ranking or appear on the card.

### 5.3 Required card content
Rank · away logo + abbr · home logo + abbr · start time · separation label · **away projected
runs** · **home projected runs** · away starter (name + proj IP/ER/K) · home starter (name + proj
IP/ER/K) · lineup state · model confidence · personal-opinion tag (+ optional note).

### 5.4 Required visual structure
- **Equal-width, mirrored away/home sides** — favorite and underdog stay structurally symmetric.
- Team logos **36–44 px**; abbreviations **22–28 px**, visually **subordinate** to the logo and the
  projected-run values.
- Small centered **@ medallion** on raised surface between the two sides.
- **One** clearly labeled `RUN PROJECTION` comparison (away runs — home runs). This is the only
  game-model projection on the card.
- Two compact pitcher text lines (one per side).
- One compact opinion/status rail (opinion tag + lineup state).
- Dimensional card per §4.1.

### 5.5 Morning Slate prohibitions
- MUST NOT show win probability (no %, no win-prob bar, no probability-derived split).
- MUST NOT repeat the game projection in a second display or bar.
- MUST NOT use pitcher portraits by default.
- MUST NOT use rigid spreadsheet columns.
- MUST NOT let abbreviations dominate the card.
- MUST NOT print the word "projected" beside every field — label the group once (`RUN
  PROJECTION`) and let the numbers stand.
- Separation label is derived from **run separation**, not probability:
  `≥ 1.5 R → LOPSIDED (risk red)`, `≥ 1.0 R → CLEAR EDGE (warning)`, `≥ 0.5 R → LEAN (purple
  light)`, `< 0.5 R → TOSS-UP (metadata)`.

---

## 6. Personal opinion

See §4.4. Additional: exactly one opinion per game; if none reviewed, render `NO OPINION`
(metadata) — never blank, never inferred.

---

## 7. Pitcher-image identity contract

Portraits are **optional and OFF by default** for compact Morning Slate cards. If a future format
intentionally includes a portrait:
- Resolve from the official MLB image service using the verified **MLBAM player ID**, not name
  matching.
- Confirm the image depicts the named player and matches player/team/slate context.
- Never generate, approximate, face-swap, or substitute.
- If a verified official image is unavailable, **omit** the portrait (do not fail the whole export
  for an optional portrait, but never fabricate one).
- Require human identity review before publication.

---

## 8. Offensive Report & Public vs Sharp

### 8.1 Offensive Report
Sections (all required): **Top Offenses vs RHP**, **Top Offenses vs LHP**, **Risers**, **Fallers**.
- Official team logo beside every abbreviation (§4.2).
- Directly color-code OSI, recent-window OSI, and signed deltas by league metricColor (§4.3) — OSI
  is NOT a flat purple value.
- Major section headings in metallic silver.
- Compact, aligned team rows; the compared recent window is explicit (e.g. `YTD → L7`).
- Small-sample warnings are compact and visible.
- Card depth per §4.1 without becoming an ornate poster.

### 8.2 Public vs Sharp
Sections (all required): **Pitching**, **Moneyline**, **Totals**. Sorted by absolute divergence,
same-day timestamps required.
- Required fields: game/player · market + line · **public de-vigged probability** · **sharp
  de-vigged probability** · **signed divergence** · **observation timestamp** · book coverage /
  confidence when available.
- Official team logos beside team-based markets (§4.2).
- Major section headings in metallic silver.
- **Public = neutral identity** (secondary/metadata). **Sharp = restrained purple identity**
  (`#C4B0FF`). These two probabilities must be visually distinct.
- Registered probability/divergence digits color-coded per §4.3; **divergence magnitude is not a
  green "bet"** — a larger gap is a larger observation, not a stronger play.
- Comparison bars are secondary (thin, behind the numbers), never the primary element.
- No visible metric legend.
- Language: "observation" only. Never "play", "lock", "smart money bet", or any phrasing implying
  the disagreement guarantees profit.

---

## 9. Data-integrity contract (publish gate)

A graphic is publishable ONLY if all hold; otherwise it **fails closed** (no export):
- Slate date is current in **US/Eastern**.
- All matchups share one `run_id`.
- Starters and pitcher projections match the same run.
- Team and player identities resolve (logos included).
- Market observations are same-day and timestamped.
- Lineup state is labeled on every card.
- Probabilities are valid `[0,1]` where used.
- No game is duplicated.
- Personal opinions were reviewed after the latest refresh.
Model projection, market observation, public-vs-sharp comparison, and personal editorial opinion
remain four visually distinct layers — never merged.

---

## 10. Density modes

| Mode | Trigger | Effect |
|---|---|---|
| Standard | ≤ 4 Morning-Slate games/page | 190–220 px cards, full pitcher lines |
| Compact | 5 games/page needed | shorter cards, condensed pitcher line, all text still legible |
| Overflow | > (pages × per-page) | additional page, up to 3 pages max; beyond that, top-N by separation |

---

## 11. Asset & identity rules

Summarized from §4.2 / §7: approved Chase logo file only; ESPN team-logo source + `mlbma_assets.js`
abbreviation map; verified MLBAM IDs for any portrait; **fail closed** on an unresolved required
mark; logo + text abbreviation always paired.

---

## 12. Accessibility

- Body/label text ≥ **4.5:1** contrast on its surface; large display text ≥ **3:1**.
- Color never the sole status carrier — always paired with sign/arrow/word (§4.3).
- Minimum on-canvas text size **13 px**; primary values ≥ 26 px.
- Team identity always carries a text abbreviation alongside the logo.

---

## 13. Export naming & versioning

- File names: `morning-slate-NN.png`, `offensive-report.png`, `public-vs-sharp.png` (NN = zero-
  padded page).
- Every graphic embeds its `run_id` + generated-at in the sidecar manifest; a published asset is
  reproducible from its saved bundle.
- This contract is versioned (semver, top of file). A change to any MUST rule bumps
  major/minor and updates the decision log (§15).

---

## 14. Renderer conflicts (`render.py` today vs this contract)

These are current violations the renderer MUST change to satisfy. The contract is **not** weakened
to match the renderer.

| ID | Location | Conflict | Required change |
|---|---|---|---|
| C1 | `_header` | Typeset "CHASE ANALYTICS" eyebrow + no logo | Use `chase-logo-horizontal-light.png` (190–230 px); remove eyebrow |
| C2 | `_header` | Title `FONTS["title"]` = 54 px, fill flat `TEXT` | 40–48 px, metallic-silver fill |
| C3 | `_header` | `subtitle` line present | Remove subtitle from daily headers |
| C4 | `_header` | Header spans ~top 232 px | Compact header 150–190 px |
| C5 | `_draw_game_card` | Draws win-prob bar + `away_p/home_p` % **and** projected runs | Remove all win-probability rendering from Morning Slate |
| C6 | `render_morning_slate` | Sorts by `*_win_probability` | Sort by `abs(home_runs − away_runs)` |
| C7 | `_separation` | Derived from probability | Derive from run separation (§5.5) |
| C8 | `_draw_game_card` | Team abbr `FONTS["team"]` = 32 px; **no team logos** | Abbr 22–28 px + required ESPN team logos 36–44 px |
| C9 | `_draw_market_panel` | Divergence colored `GREEN if >0 else RED` | Neutral/metricColor magnitude; public neutral, sharp purple; no green=bet |
| C10 | `_draw_rank_panel` | OSI drawn flat `PURPLE_LIGHT` | League metricColor per §4.3 |
| C11 | `_font` | Arial/DejaVu fallback | Bundle + use DM Sans + Roboto Condensed |
| C12 | module consts | `BLUE #60A5FA` non-token; greens/reds differ from tokens | Remove BLUE; align to §1 tokens + §1.3 scale |
| C13 | `_draw_market_panel` | No team logos on team markets | Add ESPN team logos (§4.2) |
| C14 | `render_*` | No fail-closed data-integrity gate before save | Enforce §9 before any `image.save` |

`report_contracts.json` is updated in this change to remove the Morning-Slate win-probability
requirement and the `favorite_probability_desc` sort (see §15).

---

## 15. Decision log (owner feedback → contract rule)

| Owner feedback | Encoded as |
|---|---|
| Oversized hero headings | §3.3 title ≤ 48 px; §3.4 header ≤ 190 px |
| Large copy blocks above data | §3.4 no paragraph; caption-only context |
| Repeated eyebrows/subtitles | §3.4 prohibited on daily graphics |
| Oversized team abbreviations | §3.3/§5.4 abbr 22–28 px, subordinate |
| Cards too tall | §5.1 190–220 px |
| Runs + win prob shown together | §2.6 / §5.5 Morning Slate = runs only, **no win prob** |
| Generic 3-column layout | §5.4 mirrored symmetric card; §2.7 |
| Repeated "CHASE'S CARD" | §4.4 / §2.8 prohibited |
| AI/incorrect pitcher portraits | §7 verified MLBAM ID, off by default, fail-omit |
| Visible red→green key | §4.3 / §2.10 no legend |
| Flat white/purple headings | §1.5 metallic silver mandatory |
| Flat generic cards | §4.1 dimensional card required |
| — (asset integrity) | §4.2 real logo, ESPN team logos, fail-closed |
| Green ≠ "bet" | §2.14 / §4.3 / §8.2 |

---

## 16. Objective review checklist (pre-publish)

- [ ] Header ≤ 190 px; title 40–48 px in metallic silver; no eyebrow/subtitle.
- [ ] Real `chase-logo-horizontal-light.png` present, 190–230 px, undistorted.
- [ ] Every team shows an ESPN team logo + text abbreviation.
- [ ] Morning Slate shows **projected runs only** — zero win-probability elements.
- [ ] Morning Slate ranked by run separation; cards 190–220 px (or defined compact).
- [ ] Team abbreviations ≤ 28 px and subordinate to logo/run values.
- [ ] Metric digits colored by league metricColor with correct inversion; labels neutral; no
      legend; no non-token colors (no `#60A5FA`).
- [ ] Public neutral, Sharp purple; divergence not green=bet; "observation" language only.
- [ ] Opinion rail: approved tag only, no "CHASE'S CARD"; `MY BET` carries market + price.
- [ ] No pitcher portrait unless verified via MLBAM ID + human review.
- [ ] Fonts are DM Sans + Roboto Condensed.
- [ ] Data-integrity gate (§9) passed; four layers visually distinct.

## 17. Definition of done

The system is done when: every daily graphic passes §16; the renderer resolves all §14 conflicts;
`report_contracts.json` no longer requires win probability for Morning Slate; and a randomly
sampled graphic is unmistakably a ChaseAnalytics.com product — real logo, exact tokens, metallic
headings, dimensional cards, league-anchored number colors — while displaying a full slate's worth
of data legibly on a phone.

**Done is NOT reached if the output still permits:** the oversized header, oversized team
abbreviations, redundant win probability, a repeated "CHASE'S CARD" label, unverified pitcher
portraits, or a visible color-gradient legend.
