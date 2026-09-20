# Chase Analytics Broadcast Design System

This document is the production contract for the recording booth and every Remotion graphic. It turns the package into one recognizable show instead of a collection of unrelated cards.

## Editorial rule

Every graphic must answer one question that the host can say in a sentence.

1. **Identify** — what matchup, player, unit, or situation is this?
2. **Compare** — what is the most important difference?
3. **Explain** — why does the difference matter?
4. **Qualify** — is the visual sourced data, a model result, or an illustration?

If a frame cannot be understood in two seconds with the sound off, reduce the content before reducing the type.

## Frame anatomy

Every full-frame analysis graphic uses five ordered layers:

| Layer | Purpose | Required behavior |
|---|---|---|
| Show rail | Chase identity | Thin brand edge; never competes with the story |
| Matchup header | Teams and editorial question | Teams frame the title; one dominant headline |
| Evidence field | Stats, formation, chart, or player comparison | Maximum one primary visual grammar per frame |
| Broadcast read | Host-ready takeaway | One sentence; fact and opinion remain distinguishable |
| Provenance | Data/model/illustration state | Always visible when the visual is not literal game film |

The shared implementations live in `video/src/studio/BroadcastChrome.tsx`.

## Layout grids

### Vertical — 1080 × 1920

- Keep critical content inside the platform safe area supplied by `useSafe()`.
- Use 48–56 px horizontal page padding.
- Reserve the top region for matchup identity and the bottom region for platform controls/captions.
- Use two columns only for identities or direct player comparisons; use one column for explanatory charts.
- Minimum body copy: 22 px. Minimum analytical label: 18 px. Primary stat: 44–72 px.
- Do not place more than five comparison rows on one vertical board without pagination.

### Wide — 1920 × 1080

- Use 64–90 px page padding.
- Header grid: team identity / editorial title / team identity.
- Evidence can use two equal columns or one mirrored comparison spine.
- Minimum body copy: 18 px. Minimum analytical label: 16 px. Primary stat: 38–64 px.
- Use the complete width. Avoid centering a phone-sized card in a wide empty canvas.

## Visual language

### Color

- Violet identifies the Chase product and interaction state.
- Team colors identify ownership; they do not encode good or bad performance.
- Green-to-red is reserved for evaluated performance with a documented direction.
- Grey means unavailable, neutral, or not evaluated. Missing values never receive an invented bar.
- Use no more than one team accent per panel edge and one semantic value color per number.

### Surfaces

- Page: near-black broadcast ground.
- Panel: one lifted surface with a quiet border and top light.
- Well: recessed area inside a panel, used for fields and tracks.
- Avoid cards inside cards. Separation should come from spacing, alignment, and a single hairline.

### Type

- Display face: titles, player surnames, scores, and major numbers.
- Body face: labels, context, notes, and controls.
- Use tabular figures for every changing number.
- Sentence case for editorial headlines; uppercase only for compact labels.
- Never shrink a title to solve an overloaded frame. Rewrite it.

### Motion

- Identity appears first, evidence draws second, takeaway arrives last.
- Team sides enter symmetrically unless the story intentionally favors one side.
- Use deterministic frame-based motion only.
- No decorative motion may make a number harder to read.
- A graphic must still make sense at its settled frame and in a still export.

## Component grammar

### Team comparison

- Header establishes matchup and broadcast context.
- One club panel per side.
- Use league-relative color only for ranked values.
- Market/model pills are context, not the headline.
- Finish with the single host takeaway.

### Player or quarterback comparison

- Portraits and names establish identity before statistics.
- Recent-game lines are evidence, not a color contest.
- Aggregate rows use metric-specific direction and meaningful thresholds.
- Rename future generic implementation to `PlayerMatchup`; `QbMatchup` is currently used for QB, WR, and RB.

### Metric board

- Values sit outside; percentile tracks point toward the comparison spine.
- The center contains short labels only.
- Rank and bar length must use the same league pool.
- Unknown rank: show an empty neutral track and an em dash—never a default percentage.

### Formation and scheme

- A diagram must be labeled **Film-derived**, **Charted tendency**, **Projected**, or **Illustration**.
- Player alignment, route, shell, and personnel data must carry an `asOf` date and source in the pack manifest.
- Use the field to teach one concept per frame. Split offense, defense, pressure, and coverage when necessary.
- Team color identifies personnel; annotation color explains the concept.

### Injury and availability

- Lead with expected game impact, then status.
- Do not give every designation equal weight.
- Group players by unit or role and keep the active replacement visible when known.

## Studio control hierarchy

The live booth follows the order in which a producer works:

1. Active game and live-data health.
2. Record/stop and take status.
3. Layout and graphic size.
4. Current graphic and next graphic.
5. Graphic library and search.
6. Drawing and overlays.
7. Camera, microphone, and platform setup.

The active game, format, and platform are locked during recording. High-frequency signals such as the microphone meter must update outside top-level React state.

## Design process for a new graphic

1. Write the host question and the one-sentence answer.
2. Mark every input as fact, model, opinion, or illustration.
3. Choose one component grammar from this document.
4. Design the settled vertical frame first, then the wide frame.
5. Use semantic tokens; do not introduce raw brand colors in a component.
6. Add entry, evidence, and takeaway motion in that order.
7. Render at frame 0, an active animation frame, and the settled frame.
8. Test long team/player names, missing data, tied values, and five-row maximum content.
9. Preview at phone size and at 50% desktop scale.
10. Verify safe zones, contrast, asset integrity, and source labeling before adding the graphic to a pack.

## Definition of done

A graphic is production-ready only when:

- vertical and wide renders complete without warnings;
- no text truncates, collides, or falls outside safe areas;
- missing data has an intentional neutral state;
- colors communicate the documented semantic role;
- the source/provenance category is correct;
- the host can explain the frame without reading it word for word;
- a visual snapshot test covers both aspect ratios;
- the live booth remains responsive while the graphic is active.
