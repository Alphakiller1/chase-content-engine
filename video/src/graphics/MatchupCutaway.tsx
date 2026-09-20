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
import { teamAccent, teamLogoPath } from "../teams";
import "../fonts";
import { BrandLockup } from "../ds/kit";
import "../theme.css";


export type Matchup = {
  away: string;
  home: string;
  awaySP: string;
  awayHand: string;
  awayPitchScore: number;
  homeSP: string;
  homeHand: string;
  homePitchScore: number;
  awayOSI: number;
  homeOSI: number;
  lineupEdge: string;
  /** The perspective slot - italic with a violet rule, same rule as the
      still cards: readers must be able to tell an argument from measured output. */
  take?: string;
};

/** Standard reveal easing. Fast out of the gate, long settle. */
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** One animated metric bar. `delay` staggers it against its siblings. */
const StatBar: React.FC<{
  label: string;
  awayValue: number;
  homeValue: number;
  delay: number;
  /** Team accents, so the bars carry identity instead of generic brand colour. */
  awayInk: string;
  homeInk: string;
  /** Scale ceiling - PitchScore and OSI are both 0-100 pool-relative. */
  max?: number;
}> = ({ label, awayValue, homeValue, delay, awayInk, homeInk, max = 100 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const awayLeads = awayValue >= homeValue;
  /* Team colour says WHO, opacity says WHO'S WINNING. Colouring both bars by
     team alone would throw away the leader signal the green/grey pair carried. */
  const awayDim = awayLeads ? 1 : 0.42;
  const homeDim = awayLeads ? 0.42 : 1;

  return (
    <Interactive.Div
      name={"Stat: " + label}
      style={{
        marginBottom: 44,
        opacity: interpolate(frame, [delay, delay + 0.4 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        }),
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          fontSize: "var(--vid-label)",
          letterSpacing: "var(--vid-caps-track)",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 16,
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--vid-stat)",
            fontWeight: 700,
            width: 150,
            color: awayInk,
            opacity: awayDim,
          }}
        >
          {awayValue.toFixed(1)}
        </div>

        {/* Two bars growing outward from the centre line. */}
        <div style={{ flex: 1, display: "flex", gap: 8, height: 26 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "flex-end",
              background: "var(--surface-raised)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: awayInk,
                opacity: awayDim,
                borderRadius: 6,
                width:
                  interpolate(
                    frame,
                    [delay + 0.2 * fps, delay + 1.1 * fps],
                    [0, (awayValue / max) * 100],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: EASE,
                    },
                  ) + "%",
              }}
            />
          </div>
          <div
            style={{
              flex: 1,
              background: "var(--surface-raised)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: homeInk,
                opacity: homeDim,
                borderRadius: 6,
                width:
                  interpolate(
                    frame,
                    [delay + 0.2 * fps, delay + 1.1 * fps],
                    [0, (homeValue / max) * 100],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: EASE,
                    },
                  ) + "%",
              }}
            />
          </div>
        </div>

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--vid-stat)",
            fontWeight: 700,
            width: 150,
            textAlign: "right",
            color: homeInk,
            opacity: homeDim,
          }}
        >
          {homeValue.toFixed(1)}
        </div>
      </div>
    </Interactive.Div>
  );
};

export const MatchupCutaway: React.FC<Matchup> = ({
  away,
  home,
  awaySP,
  awayHand,
  awayPitchScore,
  homeSP,
  homeHand,
  homePitchScore,
  awayOSI,
  homeOSI,
  lineupEdge,
  take,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const awayInk = teamAccent(away, "mlb");
  const homeInk = teamAccent(home, "mlb");

  const pitchers = [
    { team: away, sp: awaySP, hand: awayHand, dir: "-60px 0px", ink: awayInk },
    { team: home, sp: homeSP, hand: homeHand, dir: "60px 0px", ink: homeInk },
  ];

  /** The payoff shot. Lands last, and is the only number stated as a margin. */
  const spEdge = homePitchScore - awayPitchScore;
  const spLeader = spEdge >= 0 ? home : away;
  const spLeaderInk = spEdge >= 0 ? homeInk : awayInk;
  const spMargin = Math.abs(spEdge).toFixed(1);

  return (
    <AbsoluteFill
      name="Matchup Reveal"
      style={{
        backgroundColor: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        padding: "120px 72px",
        flexDirection: "column",
      }}
    >
      {/* Violet key light behind the card, drifting slowly so the frame
          never reads as a static PNG. */}
      <AbsoluteFill
        name="Backdrop Glow"
        style={{
          background:
            "transparent",
          scale: interpolate(frame, [0, 10 * fps], [1, 1.18], {
            extrapolateRight: "clamp",
            easing: Easing.linear,
            output: "perceptual-scale",
          }),
        }}
      />

      <Interactive.Div
        name="Eyebrow"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--vid-label)",
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "var(--text-accent)",
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
            extrapolateRight: "clamp",
            easing: EASE,
          }),
          translate: interpolate(
            frame,
            [0, 0.8 * fps],
            ["0px 24px", "0px 0px"],
            { extrapolateRight: "clamp", easing: EASE },
          ),
        }}
      >
        Starting Pitcher Edge
      </Interactive.Div>

      <Interactive.Div
        name="Headline"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--vid-headline)",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.05,
          marginTop: 18,
          opacity: interpolate(frame, [0.3 * fps, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          }),
          translate: interpolate(
            frame,
            [0.3 * fps, 1.2 * fps],
            ["0px 40px", "0px 0px"],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
          ),
        }}
      >
        <span style={{ color: awayInk }}>{away}</span>{" "}
        <span style={{ color: "var(--text-muted)" }}>@</span>{" "}
        <span style={{ color: homeInk }}>{home}</span>
      </Interactive.Div>

      {/* Pitcher row - the two names slide in from their own sides. */}
      <div style={{ display: "flex", gap: 32, marginTop: 56, marginBottom: 64 }}>
        {pitchers.map((p, i) => (
          <Interactive.Div
            key={p.team}
            name={"Pitcher: " + p.team}
            style={{
              flex: 1,
              background: "var(--surface-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "32px 28px",
              opacity: interpolate(
                frame,
                [1.2 * fps + i * 4, 1.9 * fps + i * 4],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE,
                },
              ),
              translate: interpolate(
                frame,
                [1.2 * fps + i * 4, 2 * fps + i * 4],
                [p.dir, "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE,
                },
              ),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <CanvasImage
                src={staticFile(teamLogoPath(p.team, "mlb"))}
                style={{ width: 52, height: 52 }}
              />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--vid-label)",
                  color: p.ink,
                  letterSpacing: 3,
                  fontWeight: 700,
                }}
              >
                {p.team}
              </span>
            </div>
            <div
              style={{
                fontSize: "var(--vid-body)",
                color: "var(--text-primary)",
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {p.sp}
            </div>
            <div style={{ fontSize: 30, color: "var(--text-muted)", marginTop: 8 }}>
              {p.hand}HP
            </div>
          </Interactive.Div>
        ))}
      </div>

      <StatBar
        label="Pitching Score"
        awayValue={awayPitchScore}
        homeValue={homePitchScore}
        awayInk={awayInk}
        homeInk={homeInk}
        delay={2.5 * fps}
      />
      <StatBar
        label="Offense Strength (OSI)"
        awayValue={awayOSI}
        homeValue={homeOSI}
        awayInk={awayInk}
        homeInk={homeInk}
        delay={3.4 * fps}
      />

      {/* The take: italic, violet rule, visually marked as opinion. */}
      <Interactive.Div
        name="Take"
        style={{
          marginTop: 40,
          paddingLeft: 32,
          borderLeft: "6px solid var(--accent)",
          fontSize: "var(--vid-take)",
          fontStyle: "italic",
          color: "var(--text-primary)",
          lineHeight: 1.35,
          opacity: interpolate(frame, [5.2 * fps, 6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          }),
          translate: interpolate(
            frame,
            [5.2 * fps, 6.1 * fps],
            ["0px 30px", "0px 0px"],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
          ),
        }}
      >
        {take ?? "Lineup edge: " + lineupEdge}
      </Interactive.Div>

      {/* Verdict - the climax of the clip, and what fills the lower third.
          Scales in slightly overshooting so it lands with weight. */}
      <Interactive.Div
        name="Verdict"
        style={{
          marginTop: 56,
          padding: "44px 48px",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-page)",
          border: "1px solid var(--border-accent)",
          boxShadow: "0 0 60px var(--accent-glow)",
          opacity: interpolate(frame, [6.6 * fps, 7.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          }),
          scale: interpolate(frame, [6.6 * fps, 7.6 * fps], [0.88, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
          }),
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: "var(--vid-label)",
            letterSpacing: "var(--vid-caps-track)",
            textTransform: "uppercase",
            color: "var(--text-accent)",
            marginBottom: 12,
          }}
        >
          Pitching Edge
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 116,
              fontWeight: 700,
              color: spLeaderInk,
              lineHeight: 1,
            }}
          >
            {spLeader}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 76,
              fontWeight: 700,
              color: "var(--mark-positive)",
            }}
          >
            +{spMargin}
          </div>
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Watermark"
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          /* A mark, not a call to action. This plays inside your own video, so
             the URL sign-off that belongs on a standalone post would read as an
             ad break here. */
          opacity: interpolate(frame, [1 * fps, 1.8 * fps], [0, 0.55], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          }),
        }}
      >
        <BrandLockup size={34} muted />
      </Interactive.Div>
    </AbsoluteFill>
  );
};
