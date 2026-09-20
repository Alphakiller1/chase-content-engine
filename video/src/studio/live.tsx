/**
 * Small moving parts shared by the studio graphics: count-up numbers, the live dot,
 * a light sweep, idle drift. Everything is a pure function of the frame, so a
 * graphic keeps moving for as long as it is on screen.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_DRAW, progress } from "../ds/motion";

/** Parse "+0.111", "31.2%", "-250", "54.5" into a value plus how to print it back. */
const shape = (text: string) => {
  const m = text.match(/^([^\d+-]*)([+-]?)(\d+(?:\.(\d+))?)(.*)$/);
  if (!m) return null;
  return { pre: m[1], sign: m[2], value: Number(m[3]), decimals: m[4]?.length ?? 0, post: m[5] };
};

/** A number that counts up to its printed value, keeping the printed format. */
export const Count: React.FC<{ text: string; at: number; dur?: number; style?: React.CSSProperties }> = ({
  text,
  at,
  dur = 0.9,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = shape(text);
  if (!s) return <span style={style}>{text}</span>;
  const v = s.value * progress(frame, fps, at, dur, EASE_DRAW);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {s.pre}
      {s.sign}
      {v.toFixed(s.decimals)}
      {s.post}
    </span>
  );
};

/** Pulsing "live" dot. */
export const LiveDot: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "var(--mark-negative)" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) % 1.6;
  const ring = t / 1.6;
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
      <span
        style={{
          position: "absolute",
          inset: -size * ring,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          opacity: 1 - ring,
        }}
      />
    </span>
  );
};

/** A diagonal light sweep that crosses its parent every `period` seconds (parent needs overflow hidden). */
export const Sheen: React.FC<{ period?: number; delay?: number; opacity?: number }> = ({ period = 4, delay = 1.5, opacity = 0.18 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - delay;
  if (t < 0) return null;
  const phase = (t % period) / period; // 0..1
  const x = -40 + phase * 180; // percent
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `linear-gradient(105deg, transparent ${x - 12}%, rgba(255,255,255,${opacity}) ${x}%, transparent ${x + 12}%)`,
      }}
    />
  );
};

/** Gentle idle bob for an element, px. */
export const bob = (frame: number, fps: number, seed: number, amp = 3) =>
  Math.sin((frame / fps) * 1.6 + seed * 1.7) * amp;

/** "2026-09-17T16:49:48Z" -> "12:49 PM ET". */
export const etTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET"
  );
};

/**
 * Keeps a graphic inside its space: measures the content and, when it is taller
 * than the room it was given (a vertical stage under the host strip), scales it
 * down around its centre. Never scales up. Layout effects run before paint, so a
 * rendered frame is always the fitted one.
 */
export const Fit: React.FC<{ children: React.ReactNode; innerStyle?: React.CSSProperties; min?: number }> = ({
  children,
  innerStyle,
  min = 0.94,
}) => {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [k, setK] = React.useState(1);
  React.useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const kh = o.clientHeight / Math.max(1, i.scrollHeight);
    const kw = o.clientWidth / Math.max(1, i.scrollWidth);
    const next = Math.max(min, Math.min(1, kh, kw));
    if (Math.abs(next - k) > 0.004) setK(next);
  });
  return (
    <div
      ref={outer}
      style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}
    >
      <div
        ref={inner}
        style={{
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          transform: k < 1 ? `scale(${k})` : undefined,
          transformOrigin: "50% 0%",
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};
