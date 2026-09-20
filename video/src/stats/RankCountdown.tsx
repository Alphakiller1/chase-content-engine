import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, TeamLogo, Title } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise } from "../ds/motion";
import { Platform, useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import "../fonts";

export type RankItem = {
  rank: number;
  label: string;
  sub?: string;
  value: string;
  /** Optional 0-1 fill for a bar behind the value. */
  share?: number;
  team?: string;
  league?: League;
  /** Pull this row forward (the teams in tonight's game, say). */
  spotlight?: boolean;
};

export type RankCountdownProps = {
  platform: Platform;
  eyebrow?: string;
  title?: string;
  valueLabel?: string;
  items: RankItem[];
  note?: string;
  /** Seconds between reveals. */
  pace?: number;
  ground?: boolean;
};

/**
 * A ranked list revealed from the bottom up - the countdown format. Rows arrive in
 * reverse rank order and the list is laid out in rank order from the start, so the
 * finished frame is a readable table and a still of it is a usable graphic.
 */
export const RankCountdown: React.FC<RankCountdownProps> = ({
  platform,
  eyebrow,
  title,
  valueLabel,
  items,
  note,
  pace = 0.45,
  ground = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const wide = width > height;
  const safe = useSafe(platform);
  const pad = wide ? 120 : 64;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const sorted = [...items].sort((a, b) => a.rank - b.rank);
  const headH = wide ? 190 : 300;
  const rowH = Math.min(
    wide ? 84 : 120,
    (height - safe.top - safe.bottom - headH - (wide ? 150 : 220)) / Math.max(sorted.length, 1),
  );

  return (
    <AbsoluteFill
      name="Rank Countdown"
      style={{
        background: ground ? "var(--surface-page)" : "transparent",
        paddingTop: safe.top + (wide ? 60 : 80),
        paddingBottom: safe.bottom + 40,
        paddingLeft: pad,
        paddingRight: pad + (wide ? 0 : Math.max(0, safe.right - pad)),
        opacity: exit,
      }}
    >
      <Interactive.Div name="Header" style={{ minHeight: headH - 40 }}>
        {eyebrow ? (
          <div style={rise(frame, fps, 0)}>
            <Eyebrow size={wide ? 26 : 30}>{eyebrow}</Eyebrow>
          </div>
        ) : null}
        {title ? (
          <div style={{ marginTop: 10, ...rise(frame, fps, 0.1) }}>
            <Title size={wide ? 80 : 96}>{title}</Title>
          </div>
        ) : null}
      </Interactive.Div>

      {valueLabel ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, ...rise(frame, fps, 0.3, 10) }}>
          <Caps size={wide ? 20 : 24}>{valueLabel}</Caps>
        </div>
      ) : null}

      <Interactive.Div name="Rows" style={{ display: "flex", flexDirection: "column" }}>
        {sorted.map((it, i) => {
          const order = sorted.length - 1 - i; // bottom row first
          const at = 0.5 + order * pace;
          const p = progress(frame, fps, at, 0.7);
          const fill = progress(frame, fps, at + 0.15, 0.8, EASE_DRAW);
          const ink = it.team && it.league ? teamAccent(it.team, it.league) : "var(--accent)";
          return (
            <div
              key={`${it.rank}-${it.label}`}
              style={{
                height: rowH,
                display: "flex",
                alignItems: "center",
                gap: wide ? 24 : 22,
                position: "relative",
                borderTop: "1px solid var(--border-default)",
                opacity: p * (it.spotlight || !sorted.some((s) => s.spotlight) ? 1 : 0.62),
                translate: `${(1 - p) * 60}px 0px`,
                background: it.spotlight
                  ? "color-mix(in srgb, var(--accent) 9%, transparent)"
                  : "transparent",
              }}
            >
              {typeof it.share === "number" ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "18%",
                    bottom: "18%",
                    width: `${Math.max(0, Math.min(1, it.share)) * 100 * fill}%`,
                    background: `color-mix(in srgb, ${ink} 16%, transparent)`,
                    borderRadius: 4,
                  }}
                />
              ) : null}
              <div
                className="num"
                style={{
                  position: "relative",
                  width: wide ? 70 : 80,
                  textAlign: "right",
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: rowH * 0.52,
                  color: it.spotlight ? "var(--text-accent)" : "var(--text-muted)",
                }}
              >
                {it.rank}
              </div>
              {it.team && it.league ? (
                <div style={{ position: "relative" }}>
                  <TeamLogo team={it.team} league={it.league} size={rowH * 0.62} />
                </div>
              ) : null}
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: rowH * 0.42,
                    color: "var(--text-primary)",
                    lineHeight: 1.05,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {it.label}
                </div>
                {it.sub ? (
                  <div style={{ fontSize: Math.max(wide ? 20 : 26, rowH * 0.22), fontWeight: 600, color: "var(--text-secondary)" }}>
                    {it.sub}
                  </div>
                ) : null}
              </div>
              <div
                className="num"
                style={{
                  position: "relative",
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: rowH * 0.46,
                  color: ink,
                }}
              >
                {it.value}
              </div>
            </div>
          );
        })}
      </Interactive.Div>

      {note ? (
        <div style={{ marginTop: "auto", ...rise(frame, fps, 0.5 + sorted.length * pace, 10) }}>
          <Deck size={wide ? 22 : 26}>{note}</Deck>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
