import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { League, onTeamInk, teamColors, teamLogoPath } from "../teams";
import "../fonts";
import "../theme.css";


export type MatchupBarProps = {
  league: League;
  away: string;
  home: string;
  /** Small line under each abbreviation - a record, a seed, a rotation slot. */
  awayNote?: string;
  homeNote?: string;
  /** Centre stack: label above, the number below (total, spread, series game). */
  centerLabel?: string;
  centerValue?: string;
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Team-colored header bar, transparent outside the bar itself. Sits at the top
 * of a vertical frame while you talk, the way a broadcast keeps the matchup on
 * screen. Works for both leagues - `league` selects the color and logo set,
 * which is required because sixteen abbreviations collide across MLB and NFL.
 */
export const MatchupBar: React.FC<MatchupBarProps> = ({
  league,
  away,
  home,
  awayNote,
  homeNote,
  centerLabel,
  centerValue,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  const awayCol = teamColors(away, league);
  const homeCol = teamColors(home, league);
  const awayInk = onTeamInk(away, league);
  const homeInk = onTeamInk(home, league);

  const outStart = durationInFrames - 0.7 * fps;
  const exit = interpolate(frame, [outStart, durationInFrames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  /** Each half slides in from its own edge, meeting at the diagonal. */
  const half = (side: "away" | "home") =>
    interpolate(frame, [0, 0.85 * fps], [side === "away" ? -width : width, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    }) + "px 0px";

  const BAR_H = 240;

  return (
    <AbsoluteFill name="Matchup Bar" style={{ opacity: exit }}>
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          width: "100%",
          height: BAR_H,
        }}
      >
        {/* Away colour field. The gradient fades to near-black at 180% rather
            than 130% so the team colour stays saturated across the whole wedge
            instead of going muddy - two navy teams were reading identically. */}
        <Interactive.Div
          name="Away Field"
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(100deg, ${awayCol.primary} 0%, var(--surface-page) 180%)`,
            clipPath: "polygon(0 0, 39% 0, 29% 100%, 0 100%)",
            translate: half("away"),
          }}
        />
        {/* Home colour field, mirrored. */}
        <Interactive.Div
          name="Home Field"
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(260deg, ${homeCol.primary} 0%, var(--surface-page) 180%)`,
            clipPath: "polygon(61% 0, 100% 0, 100% 100%, 51% 100%)",
            translate: half("home"),
          }}
        />
        {/* Neutral centre wedge. The two colour fields used to meet on a single
            diagonal that ran straight through the centre number; a wedge gives
            that number its own ground, the way the broadcast reference does. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--ca-grad-panel)",
            clipPath: "polygon(39% 0, 61% 0, 51% 100%, 29% 100%)",
          }}
        />
        {/* Violet hairlines on both wedge edges - the only Chase brand in a bar
            otherwise owned by the two teams. Two elements, not one eight-point
            polygon: clip-path takes a single closed shape and would tie the two
            stripes into a bowtie. */}
        {[
          "polygon(38.4% 0, 39.6% 0, 29.6% 100%, 28.4% 100%)",
          "polygon(60.4% 0, 61.6% 0, 51.6% 100%, 50.4% 100%)",
        ].map((clip) => (
          <div
            key={clip}
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--edge-brand)",
              clipPath: clip,
              opacity: interpolate(frame, [0.7 * fps, 1.1 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE,
              }),
            }}
          />
        ))}

        <Interactive.Div
          name="Bar Content"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 44px",
            opacity: interpolate(frame, [0.5 * fps, 1.1 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            }),
          }}
        >
          {/* Away side */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <CanvasImage
              src={staticFile(teamLogoPath(away, league))}
              style={{ width: 116, height: 116 }}
            />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 76,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: awayInk,
                  textShadow: "0 2px 10px var(--shadow-deep)",
                }}
              >
                {away}
              </div>
              {awayNote ? (
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    fontSize: 26,
                    letterSpacing: "var(--vid-caps-track)",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.72)",
                    marginTop: 4,
                  }}
                >
                  {awayNote}
                </div>
              ) : null}
            </div>
          </div>

          {/* Centre stack */}
          {centerValue ? (
            <div style={{ textAlign: "center", marginTop: -4 }}>
              {centerLabel ? (
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    fontSize: 24,
                    letterSpacing: "var(--vid-caps-track)",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {centerLabel}
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 82,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: "#fff",
                  textShadow: "0 2px 14px var(--shadow-deep)",
                }}
              >
                {centerValue}
              </div>
            </div>
          ) : null}

          {/* Home side */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 76,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: homeInk,
                  textShadow: "0 2px 10px var(--shadow-deep)",
                }}
              >
                {home}
              </div>
              {homeNote ? (
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    fontSize: 26,
                    letterSpacing: "var(--vid-caps-track)",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.72)",
                    marginTop: 4,
                  }}
                >
                  {homeNote}
                </div>
              ) : null}
            </div>
            <CanvasImage
              src={staticFile(teamLogoPath(home, league))}
              style={{ width: 116, height: 116 }}
            />
          </div>
        </Interactive.Div>
      </div>
    </AbsoluteFill>
  );
};
