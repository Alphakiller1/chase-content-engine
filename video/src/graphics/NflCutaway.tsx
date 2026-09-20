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
import { onTeamInk, teamAccent, teamColors, teamLogoPath } from "../teams";
import "../fonts";
import "../theme.css";


export type NflMatchup = {
  away: string;
  home: string;
  awayRating: number;
  homeRating: number;
  /** Positive = home favoured by this many points. */
  modelMargin: number;
  marketMargin: number;
  /** Home win probability, 0-1. */
  winProbability: number;
  projectedTotal: number;
  marketTotal: number;
  projectedAwayScore?: number;
  projectedHomeScore?: number;
  kickoff?: string;
  action?: string;
  /**
   * True when nfl-model withheld a per-game edge. The board does this because
   * the model does not beat the closing line, so the graphic must present the
   * model's read as research and never as a play.
   */
  edgeWithheld?: boolean;
  authority?: string;
  take?: string;
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Renders "SEA by 6.5" from a signed home-margin. */
const favourite = (margin: number, away: string, home: string) => ({
  team: margin >= 0 ? home : away,
  points: Math.abs(margin).toFixed(1),
});

export const NflCutaway: React.FC<NflMatchup> = ({
  away,
  home,
  awayRating,
  homeRating,
  modelMargin,
  marketMargin,
  winProbability,
  projectedTotal,
  marketTotal,
  projectedAwayScore,
  projectedHomeScore,
  kickoff,
  action,
  edgeWithheld,
  take,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Body text sits on the dark ground; the header abbreviations sit on the
  // team's own colour field. Different backgrounds, different contrast rule.
  const awayInk = teamAccent(away, "nfl");
  const homeInk = teamAccent(home, "nfl");
  const awayOnField = onTeamInk(away, "nfl");
  const homeOnField = onTeamInk(home, "nfl");
  const awayCol = teamColors(away, "nfl");
  const homeCol = teamColors(home, "nfl");

  const model = favourite(modelMargin, away, home);
  const market = favourite(marketMargin, away, home);
  const homeWinPct = Math.round(winProbability * 100);

  const rise = (start: number) => ({
    opacity: interpolate(frame, [start, start + 0.6 * fps], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    }),
    translate:
      interpolate(frame, [start, start + 0.8 * fps], [34, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE,
      }) + "px 0px",
  });

  return (
    <AbsoluteFill
      name="NFL Cutaway"
      style={{
        backgroundColor: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        flexDirection: "column",
        padding: "0 0 90px",
      }}
    >
      {/* Team-coloured header, same language as MatchupBar. */}
      <div style={{ position: "relative", height: 300, marginBottom: 64 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(100deg, ${awayCol.primary} 0%, var(--surface-page) 180%)`,
            clipPath: "polygon(0 0, 39% 0, 29% 100%, 0 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(260deg, ${homeCol.primary} 0%, var(--surface-page) 180%)`,
            clipPath: "polygon(61% 0, 100% 0, 100% 100%, 51% 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--ca-grad-panel)",
            clipPath: "polygon(39% 0, 61% 0, 51% 100%, 29% 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 52px",
            opacity: interpolate(frame, [0, 0.7 * fps], [0, 1], {
              extrapolateRight: "clamp",
              easing: EASE,
            }),
          }}
        >
          <div style={{ textAlign: "center" }}>
            <CanvasImage
              src={staticFile(teamLogoPath(away, "nfl"))}
              style={{ width: 132, height: 132 }}
            />
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 62,
                fontWeight: 700,
                color: awayOnField,
                lineHeight: 1,
              }}
            >
              {away}
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: "var(--vid-caps-track)",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              At
            </div>
            {kickoff ? (
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 30,
                  color: "var(--text-secondary)",
                  marginTop: 10,
                  maxWidth: 240,
                  lineHeight: 1.2,
                }}
              >
                {kickoff}
              </div>
            ) : null}
          </div>

          <div style={{ textAlign: "center" }}>
            <CanvasImage
              src={staticFile(teamLogoPath(home, "nfl"))}
              style={{ width: 132, height: 132 }}
            />
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 62,
                fontWeight: 700,
                color: homeOnField,
                lineHeight: 1,
              }}
            >
              {home}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "0 72px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          /* Group the blocks and centre them. `take` is optional; without it a
             fixed-margin stack pooled dead space above the authority strip, and
             space-evenly then flung the blocks too far apart. */
          justifyContent: "center",
          gap: 60,
        }}
      >
        {/* Power ratings - bipolar, so a 0-100 bar would misrepresent them. */}
        <Interactive.Div name="Ratings" style={{ ...rise(0.9 * fps) }}>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: "var(--vid-caps-track)",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 18,
            }}
          >
            Power Rating
          </div>
          <div style={{ display: "flex", gap: 28 }}>
            {[
              { team: away, rating: awayRating, ink: awayInk },
              { team: home, rating: homeRating, ink: homeInk },
            ].map((t) => (
              <div
                key={t.team}
                style={{
                  flex: 1,
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "26px 30px",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 42,
                    fontWeight: 700,
                    color: t.ink,
                  }}
                >
                  {t.team}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 68,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {t.rating > 0 ? "+" : ""}
                  {t.rating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </Interactive.Div>

        {/* The comparison that matters: the model's number against the market's. */}
        <Interactive.Div name="Margins" style={{ ...rise(1.6 * fps) }}>
          <div style={{ display: "flex", gap: 28 }}>
            {[
              { label: "Model", fav: model, tone: "var(--text-accent)" },
              { label: "Market", fav: market, tone: "var(--text-secondary)" },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  flex: 1,
                  background: "var(--surface-panel)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "28px 32px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    fontSize: 28,
                    letterSpacing: "var(--vid-caps-track)",
                    textTransform: "uppercase",
                    color: m.tone,
                    marginBottom: 10,
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 72,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1,
                  }}
                >
                  {m.fav.team} −{m.fav.points}
                </div>
              </div>
            ))}
          </div>
        </Interactive.Div>

        {/* Projected scoreline - the model's actual output, and the block that
            gives this frame enough substance to fill a 1080x1920 canvas. */}
        {projectedAwayScore != null && projectedHomeScore != null ? (
          <Interactive.Div name="Projected Score" style={{ ...rise(1.9 * fps) }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 30,
                letterSpacing: "var(--vid-caps-track)",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 18,
              }}
            >
              Projected Score
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 40,
                background: "var(--surface-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "30px 36px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 46,
                  fontWeight: 700,
                  color: awayInk,
                }}
              >
                {away}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 92,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {projectedAwayScore.toFixed(1)}
                <span style={{ color: "var(--text-disabled)", margin: "0 20px" }}>-</span>
                {projectedHomeScore.toFixed(1)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 46,
                  fontWeight: 700,
                  color: homeInk,
                }}
              >
                {home}
              </span>
            </div>
          </Interactive.Div>
        ) : null}

        {/* Win probability + total, the supporting numbers. */}
        <Interactive.Div name="Secondary" style={{ ...rise(2.2 * fps) }}>
          <div style={{ display: "flex", gap: 28 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  fontSize: 26,
                  letterSpacing: "var(--vid-caps-track)",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 14,
                }}
              >
                {home} Win Probability
              </div>
              <div
                style={{
                  height: 22,
                  borderRadius: 6,
                  background: "var(--surface-raised)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 6,
                    background: homeInk,
                    width:
                      interpolate(
                        frame,
                        [2.4 * fps, 3.3 * fps],
                        [0, homeWinPct],
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
                  fontFamily: "var(--font-display)",
                  fontSize: 56,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginTop: 12,
                }}
              >
                {homeWinPct}%
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  fontSize: 26,
                  letterSpacing: "var(--vid-caps-track)",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 14,
                }}
              >
                Total · Model vs Market
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 56,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginTop: 26,
                }}
              >
                {projectedTotal.toFixed(1)}
                <span style={{ color: "var(--text-muted)", fontSize: 40 }}>
                  {"  /  "}
                  {marketTotal.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </Interactive.Div>

        {take ? (
          <Interactive.Div
            name="Take"
            style={{
              ...rise(2.8 * fps),
              paddingLeft: 30,
              borderLeft: "6px solid var(--accent)",
              fontSize: 42,
              fontStyle: "italic",
              color: "var(--text-primary)",
              lineHeight: 1.35,
            }}
          >
            {take}
          </Interactive.Div>
        ) : null}
      </div>

      {/*
        Authority strip. nfl-model withholds per-game edges because it does not
        beat the closing line, so a graphic that showed only "model says -6.5"
        next to "market says -3.5" would read as a 3-point edge it explicitly
        refuses to claim. This states the status instead of implying a play.
      */}
      {edgeWithheld ? (
        <Interactive.Div
          name="Authority"
          style={{
            ...rise(3.2 * fps),
            margin: "0 72px",
            padding: "22px 30px",
            borderRadius: 12,
            background: "color-mix(in srgb, var(--mark-caution) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--mark-caution) 38%, transparent)",
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "var(--vid-caps-track)",
              textTransform: "uppercase",
              color: "var(--mark-caution)",
            }}
          >
            {action ?? "Monitor"}
          </span>
          <span style={{ fontSize: 28, color: "var(--text-secondary)", lineHeight: 1.3 }}>
            Research only — model does not beat the closing line
          </span>
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
