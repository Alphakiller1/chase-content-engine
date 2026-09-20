import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, TeamLogo, Title, formatLike } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { Platform, useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { toneFromPair } from "../studio/statColor";
import "../fonts";

export type DuelRow = {
  label: string;
  away: number;
  home: number;
  /** How to write the number, as an example: "235.7", "+0.11", "57.1%", ".318". */
  format?: string;
  /** Which way is better. Decides the leader; "none" shows no leader. */
  better?: "higher" | "lower" | "none";
};

export type StatDuelProps = {
  platform: Platform;
  league: League;
  away: string;
  home: string;
  eyebrow?: string;
  title?: string;
  /** Names over each side, e.g. the two quarterbacks. Defaults to the clubs. */
  awayLabel?: string;
  homeLabel?: string;
  rows: DuelRow[];
  /** Small print under the rows - the source, and "research only" when it is. */
  note?: string;
  /** Paint the page ground (full-frame cutaway) instead of a transparent overlay. */
  ground?: boolean;
};

/**
 * Head-to-head bars: two sides, N measures, bars growing out from a centre spine.
 *
 * Team colour says WHO; opacity says WHO'S AHEAD (leader full, trailer 0.42) - the
 * rule the MLB stat bars settled on, because colouring both bars by team alone
 * throws the leader signal away. Each row is scaled to its own larger value, so
 * measures with different units can share one graphic honestly: a bar compares the
 * two sides of ITS row, never one row with another.
 */
export const StatDuel: React.FC<StatDuelProps> = ({
  platform,
  league,
  away,
  home,
  eyebrow,
  title,
  awayLabel,
  homeLabel,
  rows,
  note,
  ground = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const wide = width > height;
  const safe = useSafe(platform);
  const pad = wide ? 120 : 64;
  const awayInk = teamAccent(away, league);
  const homeInk = teamAccent(home, league);
  const exit = exitAt(frame, fps, durationInFrames, 0.5);

  const rowH = Math.min(wide ? 96 : 150, (height - safe.top - safe.bottom - (wide ? 420 : 640)) / Math.max(rows.length, 1));
  const valueSize = Math.min(wide ? 54 : 64, rowH * 0.46);
  // Each side gets what is left after the centre label; its bar gets what is left
  // after the value. Measured from the real content box, so nothing overflows.
  const contentW = width - pad * 2 - (wide ? 0 : Math.max(0, safe.right - pad));
  const labelW = wide ? 280 : 250;
  const valueW = valueSize * 2.05;
  const sideW = (contentW - labelW) / 2;
  const barMax = Math.max(40, sideW - valueW - 18);

  return (
    <AbsoluteFill
      name="Stat Duel"
      style={{
        background: ground ? "var(--surface-page)" : "transparent",
        paddingTop: safe.top + (wide ? 64 : 70),
        paddingBottom: safe.bottom + (wide ? 70 : 40),
        paddingLeft: pad,
        paddingRight: pad + (wide ? 0 : Math.max(0, safe.right - pad)),
        opacity: exit,
        fontFamily: "var(--font-body)",
      }}
    >
      <Interactive.Div name="Header" style={{ textAlign: "center" }}>
        {eyebrow ? (
          <div style={rise(frame, fps, 0)}>
            <Eyebrow size={wide ? 26 : 30}>{eyebrow}</Eyebrow>
          </div>
        ) : null}
        {title ? (
          <div style={{ marginTop: 10, ...rise(frame, fps, 0.1) }}>
            <Title size={wide ? 76 : 92}>{title}</Title>
          </div>
        ) : null}
      </Interactive.Div>

      {/* Sides */}
      <Interactive.Div
        name="Sides"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: wide ? 22 : 56,
          marginBottom: wide ? 10 : 34,
          ...rise(frame, fps, 0.25),
        }}
      >
        {[
          { team: away, label: awayLabel, ink: awayInk, reverse: false },
          { team: home, label: homeLabel, ink: homeInk, reverse: true },
        ].map((s) => (
          <div
            key={s.team}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexDirection: s.reverse ? "row-reverse" : "row",
              textAlign: s.reverse ? "right" : "left",
            }}
          >
            <TeamLogo team={s.team} league={league} size={wide ? 96 : 116} />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: wide ? 50 : 56,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {s.label ?? s.team}
              </div>
              <Caps size={wide ? 20 : 24} color={s.ink} style={{ marginTop: 8 }}>
                {s.team}
              </Caps>
            </div>
          </div>
        ))}
      </Interactive.Div>

      {/* Rows */}
      <Interactive.Div name="Rows" style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        {rows.map((r, i) => {
          const at = stagger(i, 0.55, 0.14);
          const grow = progress(frame, fps, at + 0.1, 0.9, EASE_DRAW);
          const top = Math.max(Math.abs(r.away), Math.abs(r.home), 1e-9);
          const better = r.better ?? "higher";
          const pair = toneFromPair(r.away, r.home, better);
          const awayLeads = pair.aLeads;
          const tie = r.away === r.home;
          const fmt = r.format ?? String(r.away);
          const side = (value: number, leads: boolean | null, ink: string, left: boolean, numTone: string) => (
            <div
              style={{
                width: sideW,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 18,
                flexDirection: left ? "row-reverse" : "row",
              }}
            >
              <div
                style={{
                  height: Math.max(14, rowH * 0.2),
                  width: barMax * (Math.abs(value) / top) * grow,
                  borderRadius: 4,
                  background: ink,
                  opacity: leads === null || tie ? 0.75 : leads ? 1 : 0.42,
                }}
              />
              <div
                className="num"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: valueSize,
                  lineHeight: 1,
                  color: numTone,
                  width: valueW,
                  flexShrink: 0,
                  textAlign: left ? "right" : "left",
                }}
              >
                {formatLike(value * Math.min(1, grow * 1.15), fmt)}
              </div>
            </div>
          );
          return (
            <div
              key={r.label}
              style={{
                height: rowH,
                display: "flex",
                alignItems: "center",
                borderTop: i === 0 ? "none" : "1px solid var(--border-default)",
                opacity: progress(frame, fps, at, 0.4),
              }}
            >
              {side(r.away, awayLeads, awayInk, true, pair.a)}
              <div style={{ width: labelW, textAlign: "center", flexShrink: 0 }}>
                <Caps size={wide ? 20 : 22} style={{ lineHeight: 1.25 }}>
                  {r.label}
                </Caps>
              </div>
              {side(r.home, awayLeads === null ? null : !awayLeads, homeInk, false, pair.b)}
            </div>
          );
        })}
      </Interactive.Div>

      {note ? (
        <div style={{ textAlign: "center", marginTop: 24, ...rise(frame, fps, 1.4, 10) }}>
          <Deck size={wide ? 22 : 26}>{note}</Deck>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
