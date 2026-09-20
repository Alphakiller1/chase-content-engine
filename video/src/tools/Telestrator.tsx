import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, TONE } from "../ds/kit";
import { EASE_DRAW, exitAt, pop, progress } from "../ds/motion";
import type { Tone } from "../ds/kit";
import "../fonts";


export type TeleStroke = {
  /** Points as [x, y] fractions of the frame (0-1), in drawing order. */
  points: [number, number][];
  at: number;
  dur?: number;
  until?: number;
  tone?: Tone;
  /** Stroke width in frame pixels. */
  width?: number;
  arrow?: boolean;
  /** Smooth the polyline into a curve (Catmull-Rom). */
  smooth?: boolean;
  dashed?: boolean;
};

export type TeleMark = {
  type: "ring" | "x" | "dot";
  x: number;
  y: number;
  /** Radius as a fraction of the frame's short edge. */
  r?: number;
  at: number;
  until?: number;
  tone?: Tone;
  label?: string;
};

export type TelestratorProps = {
  strokes?: TeleStroke[];
  marks?: TeleMark[];
};

const toPath = (pts: [number, number][], smooth: boolean) => {
  if (pts.length < 2) return "";
  if (!smooth || pts.length < 3) return "M" + pts.map((p) => p.join(" ")).join(" L");
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
};

/**
 * TELESTRATOR - draw on your own footage. A transparent overlay: routes, arrows,
 * rings and X's that draw on in time, the way a broadcast analyst marks up a replay.
 * Coordinates are fractions of the frame, so one set of props serves 9:16 and 16:9
 * when the footage is framed the same way.
 */
export const Telestrator: React.FC<TelestratorProps> = ({ strokes = [], marks = [] }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const unit = Math.min(width, height);
  const exit = exitAt(frame, fps, durationInFrames, 0.4);
  const px = (p: [number, number]): [number, number] => [p[0] * width, p[1] * height];
  const fadeOut = (until?: number) => (until === undefined ? 1 : 1 - progress(frame, fps, until, 0.3));

  return (
    <AbsoluteFill name="Telestrator" style={{ opacity: exit }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {strokes.map((s, i) => {
          const on = progress(frame, fps, s.at, s.dur ?? 0.8, EASE_DRAW);
          if (on <= 0) return null;
          const pts = s.points.map(px);
          const color = TONE[s.tone ?? "caution"];
          const w = s.width ?? unit * 0.009;
          const [ex, ey] = pts[pts.length - 1];
          const [bx, by] = pts[pts.length - 2] ?? pts[0];
          const ang = Math.atan2(ey - by, ex - bx);
          const head = w * 4;
          const headOn = s.arrow ? Math.max(0, (on - 0.9) / 0.1) : 0;
          const alpha = fadeOut(s.until);
          return (
            <g key={i} style={{ opacity: alpha, filter: "drop-shadow(0 2px 6px var(--shadow-deep))" }}>
              <path
                d={toPath(pts, s.smooth ?? true)}
                fill="none"
                strokeWidth={w}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={s.dashed ? undefined : 1}
                strokeDashoffset={s.dashed ? undefined : 1 - on}
                style={{
                  stroke: color,
                  ...(s.dashed ? { strokeDasharray: `${w * 2} ${w * 1.6}`, opacity: on } : {}),
                }}
              />
              {s.arrow ? (
                <path
                  d={`M${ex - head * Math.cos(ang - 0.45)} ${ey - head * Math.sin(ang - 0.45)} L${ex} ${ey} L${ex - head * Math.cos(ang + 0.45)} ${ey - head * Math.sin(ang + 0.45)}`}
                  fill="none"
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: color, opacity: headOn }}
                />
              ) : null}
            </g>
          );
        })}
        {marks.map((m, i) => {
          const p = pop(frame, fps, m.at);
          if (p <= 0.001) return null;
          const [x, y] = px([m.x, m.y]);
          const r = (m.r ?? 0.04) * unit;
          const color = TONE[m.tone ?? "caution"];
          const w = unit * 0.008;
          const alpha = fadeOut(m.until);
          if (m.type === "ring") {
            return (
              <circle
                key={`m${i}`}
                cx={x}
                cy={y}
                r={r}
                fill="none"
                strokeWidth={w}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - progress(frame, fps, m.at, 0.5, EASE_DRAW)}
                style={{ stroke: color, opacity: alpha }}
                transform={`rotate(-90 ${x} ${y})`}
              />
            );
          }
          if (m.type === "x") {
            const s = r * 0.7 * Math.min(1, p);
            return (
              <path
                key={`m${i}`}
                d={`M${x - s} ${y - s} L${x + s} ${y + s} M${x + s} ${y - s} L${x - s} ${y + s}`}
                strokeWidth={w * 1.3}
                strokeLinecap="round"
                style={{ stroke: color, opacity: alpha }}
              />
            );
          }
          return <circle key={`m${i}`} cx={x} cy={y} r={r * 0.35 * p} style={{ fill: color, opacity: alpha }} />;
        })}
      </svg>
      {marks
        .filter((m) => m.label)
        .map((m, i) => {
          const [x, y] = px([m.x, m.y]);
          const r = (m.r ?? 0.04) * unit;
          const alpha = progress(frame, fps, m.at + 0.2, 0.3) * fadeOut(m.until);
          return (
            <div
              key={`t${i}`}
              style={{
                position: "absolute",
                left: x,
                top: y + r + 12,
                translate: "-50% 0px",
                opacity: alpha,
                background: "var(--surface-page)",
                border: `2px solid ${TONE[m.tone ?? "caution"]}`,
                borderRadius: 8,
                padding: "6px 14px",
              }}
            >
              <Caps size={unit * 0.022} color="var(--text-primary)">{m.label}</Caps>
            </div>
          );
        })}
    </AbsoluteFill>
  );
};
