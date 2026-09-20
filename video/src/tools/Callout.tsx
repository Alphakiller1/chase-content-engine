import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, TONE, TeamLogo, formatLike, parseNumber } from "../ds/kit";
import { EASE_DRAW, countTo, exitAt, pop, progress } from "../ds/motion";
import { League, teamAccent } from "../teams";
import type { Tone } from "../ds/kit";
import "../fonts";


export type CalloutProps = {
  /** The point being called out, as fractions of the frame. */
  x: number;
  y: number;
  label: string;
  /** Counts up when it parses as a number ("243.4", "+4.5", "57.1%"). */
  value?: string | null;
  sub?: string;
  tone?: Tone;
  team?: string;
  league?: League;
  /** Where the bubble sits relative to the point; auto picks the roomier side. */
  side?: "auto" | "left" | "right";
  at?: number;
};

/**
 * CALLOUT - a pulsing point on your footage with a leader line to a stat bubble.
 * For "this guy" moments: a player on a frozen frame, a number on a graphic, a
 * spot on the field.
 */
export const Callout: React.FC<CalloutProps> = ({
  x,
  y,
  label,
  value,
  sub,
  tone = "accent",
  team,
  league,
  side = "auto",
  at = 0.2,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const unit = Math.min(width, height);
  const exit = exitAt(frame, fps, durationInFrames, 0.4);
  const px = x * width;
  const py = y * height;
  const right = side === "auto" ? x < 0.5 : side === "right";
  const color = team && league ? teamAccent(team, league) : TONE[tone];
  const lead = unit * 0.16;
  const ex = px + (right ? lead : -lead);
  const ey = py - lead * 0.6;
  const draw = progress(frame, fps, at + 0.15, 0.45, EASE_DRAW);
  const bubble = pop(frame, fps, at + 0.45);
  const target = value != null ? parseNumber(value) : null;
  const shown =
    value == null
      ? ""
      : target === null
        ? value
        : formatLike(countTo(frame, fps, at + 0.5, target, 0.9), value);
  // Two expanding rings, staggered, loop every 1.6 s.
  const cycle = 1.6 * fps;
  const ring = (offset: number) => {
    const t = ((frame - at * fps + offset) % cycle + cycle) % cycle / cycle;
    return { r: unit * (0.014 + t * 0.05), o: interpolate(t, [0, 1], [0.8, 0]) };
  };

  return (
    <AbsoluteFill name="Callout" style={{ opacity: exit }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {frame >= at * fps
          ? [0, cycle / 2].map((o) => {
              const r = ring(o);
              return <circle key={o} cx={px} cy={py} r={r.r} fill="none" strokeWidth={unit * 0.004} style={{ stroke: color, opacity: r.o }} />;
            })
          : null}
        <circle cx={px} cy={py} r={unit * 0.013 * pop(frame, fps, at)} style={{ fill: color }} />
        <path
          d={`M${px} ${py} L${ex} ${ey} L${ex + (right ? 1 : -1) * unit * 0.05} ${ey}`}
          fill="none"
          strokeWidth={unit * 0.004}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
          style={{ stroke: color }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: ex + (right ? 1 : -1) * unit * 0.05,
          top: ey,
          translate: `${right ? "0%" : "-100%"} -50%`,
          scale: String(0.85 + 0.15 * bubble),
          opacity: Math.min(1, bubble * 1.5),
          transformOrigin: right ? "left center" : "right center",
          display: "flex",
          alignItems: "center",
          gap: unit * 0.018,
          padding: `${unit * 0.016}px ${unit * 0.024}px`,
          borderRadius: "var(--radius-md)",
          background: "var(--vid-glass-strong)",
          border: `2px solid ${color}`,
          boxShadow: "0 12px 34px var(--shadow-deep)",
        }}
      >
        {team && league ? <TeamLogo team={team} league={league} size={unit * 0.06} /> : null}
        <div>
          <Caps size={unit * 0.02}>{label}</Caps>
          {value != null ? (
            <div
              className="num"
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: unit * 0.062, lineHeight: 1, color: "var(--text-primary)" }}
            >
              {shown}
            </div>
          ) : null}
          {sub ? <div style={{ fontSize: unit * 0.018, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
