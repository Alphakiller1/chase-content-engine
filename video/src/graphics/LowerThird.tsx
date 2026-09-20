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
import { League, teamAccent, teamLogoPath } from "../teams";
import "../fonts";
import "../theme.css";


export type LowerThirdProps = {
  title: string;
  subtitle?: string;
  /** Optional single number pinned to the right - a score, an edge, a rank. */
  stat?: string;
  statLabel?: string;
  /** Optional team badge. Both must be set together: `league` cannot be
      inferred from an abbreviation, sixteen of them are shared. */
  team?: string;
  league?: League;
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Transparent overlay for talking-head footage. Anchored in the lower third,
 * inset from the left edge. Renders with an alpha channel - the AbsoluteFill
 * deliberately has no background, and theme.css keeps the page transparent.
 */
export const LowerThird: React.FC<LowerThirdProps> = ({
  title,
  subtitle,
  stat,
  statLabel,
  team,
  league,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();
  /* The spine takes the team colour when a team is named, otherwise it stays
     Chase violet - a name tag for you is not a team graphic. */
  const badged = Boolean(team && league);
  const ink = badged ? teamAccent(team as string, league as League) : null;

  /** Out-animation is anchored to the end, so retiming the composition
      in Studio keeps the exit intact instead of clipping it. */
  const outStart = durationInFrames - 0.9 * fps;

  const enter = interpolate(frame, [0, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const exit = interpolate(frame, [outStart, durationInFrames - 2], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill name="Lower Third">
      <Interactive.Div
        name="Card"
        style={{
          position: "absolute",
          left: 72,
          /* Sits above the platform's own UI furniture, which eats roughly the
             bottom 18% of a Reel or Short. */
          bottom: height * 0.2,
          display: "flex",
          alignItems: "stretch",
          opacity: enter * exit,
          translate:
            interpolate(frame, [0, 0.9 * fps], [-70, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            }) + "px 0px",
        }}
      >
        {/* Violet spine - grows to full height before the card text arrives. */}
        <div
          style={{
            width: 10,
            borderRadius: 5,
            background: ink ?? "var(--edge-brand)",
            scale: "1 " + interpolate(frame, [0, 0.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            }),
          }}
        />

        <div
          style={{
            background: "var(--vid-glass)",
            border: "1px solid var(--border-default)",
            borderLeft: "none",
            borderRadius: "0 16px 16px 0",
            padding: "28px 40px 28px 32px",
            display: "flex",
            alignItems: "center",
            gap: 48,
            backdropFilter: "blur(12px)",
          }}
        >
          {badged ? (
            <CanvasImage
              src={staticFile(teamLogoPath(team as string, league as League))}
              style={{ width: 78, height: 78, marginRight: 6 }}
            />
          ) : null}
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 66,
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.1,
                letterSpacing: 1,
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 34,
                  color: "var(--text-secondary)",
                  marginTop: 8,
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>

          {stat ? (
            <div
              style={{
                borderLeft: "1px solid var(--border-strong)",
                paddingLeft: 40,
                textAlign: "right",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 72,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {stat}
              </div>
              {statLabel ? (
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    fontSize: 24,
                    letterSpacing: "var(--vid-caps-track)",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginTop: 8,
                  }}
                >
                  {statLabel}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
