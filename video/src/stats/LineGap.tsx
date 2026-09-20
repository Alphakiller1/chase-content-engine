import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, Panel, TeamLogo, Title, formatLike } from "../ds/kit";
import { EASE_DRAW, exitAt, pop, progress, rise } from "../ds/motion";
import { Platform, useSafe } from "../ds/safe";
import { League } from "../teams";
import "../fonts";

export type GapMarker = {
  label: string;
  value: number;
  /** "market" draws in primary ink, "model" in the accent. */
  kind: "market" | "model" | "other";
  sub?: string;
};

export type LineGapProps = {
  platform: Platform;
  league: League;
  away: string;
  home: string;
  eyebrow?: string;
  title?: string;
  /** What the axis measures, e.g. "Game total" or "BUF margin". */
  measure: string;
  markers: GapMarker[];
  /** Axis range; defaults to the markers padded by 25%. */
  min?: number;
  max?: number;
  /** Units for the gap bracket, e.g. "pts". */
  unit?: string;
  /**
   * The honest caveat. nfl-model self-reports RESEARCH_ONLY and withholds per-game
   * edges, so a gap it shows is a disagreement, not an edge - and the graphic has to
   * say so on screen, not only in the caption.
   */
  caveat?: string;
  ground?: boolean;
};

/**
 * One number line, two (or more) readings of the same thing, the distance between
 * them bracketed. The illustration for "the market says 53.5, the model says 48.8".
 */
export const LineGap: React.FC<LineGapProps> = ({
  platform,
  league,
  away,
  home,
  eyebrow,
  title,
  measure,
  markers,
  min,
  max,
  unit = "pts",
  caveat,
  ground = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const wide = width > height;
  const safe = useSafe(platform);
  const pad = wide ? 140 : 72;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);

  const values = markers.map((m) => m.value);
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const span = Math.max(hi0 - lo0, 1);
  const lo = min ?? Math.floor(lo0 - span * 0.6);
  const hi = max ?? Math.ceil(hi0 + span * 0.6);
  const axisW = width - pad * 2;
  const x = (v: number) => ((v - lo) / (hi - lo)) * axisW;
  const ticks: number[] = [];
  const step = Math.max(1, Math.round((hi - lo) / 8));
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);

  const draw = progress(frame, fps, 0.4, 0.9, EASE_DRAW);
  const market = markers.find((m) => m.kind === "market");
  const model = markers.find((m) => m.kind === "model");
  const gap = market && model ? Math.abs(market.value - model.value) : null;
  const bracket = progress(frame, fps, 1.9, 0.7, EASE_DRAW);
  const axisY = wide ? 250 : 380;

  return (
    <AbsoluteFill
      name="Line Gap"
      style={{
        background: ground ? "var(--surface-page)" : "transparent",
        paddingTop: safe.top + (wide ? 72 : 90),
        paddingBottom: safe.bottom + 48,
        paddingLeft: pad,
        paddingRight: pad,
        opacity: exit,
      }}
    >
      <Interactive.Div name="Header" style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", gap: 10, ...rise(frame, fps, 0) }}>
          <TeamLogo team={away} league={league} size={wide ? 84 : 96} />
          <TeamLogo team={home} league={league} size={wide ? 84 : 96} />
        </div>
        <div>
          {eyebrow ? (
            <div style={rise(frame, fps, 0.05)}>
              <Eyebrow size={wide ? 24 : 28}>{eyebrow}</Eyebrow>
            </div>
          ) : null}
          {title ? (
            <div style={{ marginTop: 6, ...rise(frame, fps, 0.12) }}>
              <Title size={wide ? 70 : 78}>{title}</Title>
            </div>
          ) : null}
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Axis"
        style={{ position: "relative", height: axisY * 2, marginTop: "auto", marginBottom: "auto" }}
      >
        <Caps size={wide ? 22 : 26} style={{ position: "absolute", top: 0, left: 0, ...rise(frame, fps, 0.3, 10) }}>
          {measure}
        </Caps>
        {/* rule */}
        <div
          style={{
            position: "absolute",
            top: axisY,
            left: 0,
            height: 3,
            width: axisW * draw,
            background: "var(--border-strong)",
          }}
        />
        {ticks.map((t) => (
          <div
            key={t}
            className="num"
            style={{
              position: "absolute",
              top: axisY + 14,
              left: x(t),
              translate: "-50% 0px",
              fontSize: wide ? 24 : 28,
              color: "var(--text-muted)",
              opacity: progress(frame, fps, 0.4 + (x(t) / axisW) * 0.9, 0.3),
            }}
          >
            <div
              style={{
                width: 2,
                height: 12,
                background: "var(--border-strong)",
                margin: "-14px auto 4px",
              }}
            />
            {t}
          </div>
        ))}

        {/* gap bracket */}
        {gap !== null && market && model ? (
          <div
            style={{
              position: "absolute",
              top: axisY - (wide ? 170 : 230),
              left: Math.min(x(market.value), x(model.value)),
              width: Math.abs(x(market.value) - x(model.value)) * bracket,
              height: 26,
              borderTop: "3px solid var(--accent)",
              borderLeft: "3px solid var(--accent)",
              borderRight: bracket > 0.98 ? "3px solid var(--accent)" : "none",
              opacity: bracket > 0 ? 1 : 0,
            }}
          >
            <div
              className="num"
              style={{
                position: "absolute",
                bottom: 34,
                left: "50%",
                translate: "-50% 0px",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: wide ? 48 : 56,
                color: "var(--text-accent)",
                opacity: progress(frame, fps, 2.3, 0.4),
              }}
            >
              {formatLike(gap, "0.0")} {unit} apart
            </div>
          </div>
        ) : null}

        {/* markers */}
        {markers.map((m, i) => {
          const p = pop(frame, fps, 1.0 + i * 0.3);
          const ink =
            m.kind === "model"
              ? "var(--accent)"
              : m.kind === "market"
                ? "var(--text-primary)"
                : "var(--text-secondary)";
          const above = i % 2 === 0;
          return (
            <div
              key={m.label}
              style={{
                position: "absolute",
                left: x(m.value),
                top: axisY,
                translate: "-50% -50%",
              }}
            >
              <div
                style={{
                  width: wide ? 26 : 30,
                  height: wide ? 26 : 30,
                  borderRadius: "50%",
                  background: ink,
                  border: "4px solid var(--surface-page)",
                  boxShadow: `0 0 0 2px ${ink}`,
                  scale: String(p),
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  translate: "-50% 0px",
                  [above ? "bottom" : "top"]: wide ? 44 : 52,
                  ...(above ? {} : { top: wide ? 64 : 84 }),
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  opacity: Math.min(1, p),
                }}
              >
                <div
                  className="num"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: wide ? 68 : 80,
                    lineHeight: 1,
                    color: ink,
                  }}
                >
                  {formatLike(m.value, String(m.value))}
                </div>
                <Caps size={wide ? 24 : 28} style={{ marginTop: 6 }}>
                  {m.label}
                </Caps>
                {m.sub ? (
                  <div style={{ fontSize: wide ? 18 : 22, color: "var(--text-muted)", marginTop: 4 }}>
                    {m.sub}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </Interactive.Div>

      {caveat ? (
        <Interactive.Div
          name="Caveat"
          style={{ ...rise(frame, fps, 2.6, 12) }}
        >
          <Panel
            pad={wide ? "18px 28px" : "22px 30px"}
            style={{
              borderColor: "color-mix(in srgb, var(--mark-caution) 40%, transparent)",
              background: "color-mix(in srgb, var(--mark-caution) 8%, var(--surface-card))",
            }}
          >
            <Deck size={wide ? 24 : 28} style={{ color: "var(--text-primary)" }}>
              {caveat}
            </Deck>
          </Panel>
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
