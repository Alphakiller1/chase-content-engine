import React from "react";
import { AbsoluteFill, Img, Interactive, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Eyebrow, TONE, Title } from "../ds/kit";
import type { Tone } from "../ds/kit";
import { EASE, EASE_DRAW, exitAt, progress, rise } from "../ds/motion";
import { Platform, useSafe } from "../ds/safe";
import "../fonts";

/** [x, y, width, height] in the capture's NATIVE (CSS) pixels. */
export type Rect = [number, number, number, number];

/** A named region inside a capture, recorded by content_engine at capture time. */
export type Anchor = { text: string; kind?: string; x: number; y: number; w: number; h: number };

export type AnnotateCapture = {
  src: string;
  width: number;
  height: number;
  anchors?: Anchor[];
};

export type { Tone };

export type AnnotateStep = {
  /** Start, in seconds. */
  at: number;
  /** Length of the move or draw-on, in seconds. */
  dur?: number;
  /** Seconds at which a mark goes away again (default: stays). */
  until?: number;
  type: "focus" | "reset" | "highlight" | "circle" | "underline" | "arrow" | "label" | "spotlight";
  /** Anchor text to match (case-insensitive, contains) or an explicit rect. */
  target?: string | Rect;
  /** Label / arrow caption. */
  text?: string;
  /** Seconds at which the caption goes away while the mark itself stays. */
  textUntil?: number;
  tone?: Tone;
  /** focus: the most the camera may zoom relative to the fitted board (default 2.6). */
  zoom?: number;
};

export type AnnotateProps = {
  platform: Platform;
  capture: AnnotateCapture;
  steps: AnnotateStep[];
  eyebrow?: string;
  title?: string;
  ground?: boolean;
};


const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Resolve a step target to a rect. Text targets match the capture's anchors (table
 * rows, section heads, player cards...) and FAIL the render when nothing matches -
 * an annotation drawn around the wrong row is a wrong graphic.
 */
export const resolveTarget = (
  capture: AnnotateCapture,
  target: string | Rect | undefined,
  mode: "tight" | "block" = "tight",
): Rect => {
  if (!target) return [0, 0, capture.width, capture.height];
  if (Array.isArray(target)) return target;
  const want = norm(target);
  const hits = (capture.anchors ?? []).filter((a) => norm(a.text).includes(want));
  if (!hits.length) {
    const sample = (capture.anchors ?? []).slice(0, 25).map((a) => `"${a.text}"`).join(", ");
    throw new Error(`Annotate: no anchor matches "${target}". Anchors include: ${sample || "(none recorded)"}`);
  }
  let h: Anchor;
  if (mode === "block") {
    // Camera moves frame the BLOCK a heading introduces: the largest anchor whose
    // text starts with the query (a report, a table), not the heading's own span.
    const blocks = hits.filter((a) => norm(a.text).startsWith(want));
    const pool = blocks.length ? blocks : hits;
    h = pool.reduce((m, a) => (a.w * a.h > m.w * m.h ? a : m), pool[0]);
  } else {
    // Marks take the tightest match: an exact row over the section containing it.
    hits.sort((a, b) => (norm(a.text) === want ? -1 : 0) - (norm(b.text) === want ? -1 : 0) || a.w * a.h - b.w * b.h);
    h = hits[0];
  }
  return [h.x, h.y, h.w, h.h];
};

type Cam = { cx: number; cy: number; z: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * ANNOTATE - the illustration tool. A site capture on stage, a camera that pushes in
 * on the thing being discussed, and marks drawn over it in time: boxes, rings,
 * underlines, arrows, labels, a spotlight that dims everything else.
 *
 * Marks live in the capture's own coordinate space, so they stay locked to the row
 * while the camera moves; stroke widths and label type are counter-scaled so they
 * read the same at any zoom.
 */
export const Annotate: React.FC<AnnotateProps> = ({ platform, capture, steps, eyebrow, title, ground = true }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe(platform);
  if (!capture.src) {
    return (
      <AbsoluteFill style={{ background: "var(--surface-page)", justifyContent: "center", alignItems: "center", padding: 80 }}>
        <Title size={64}>Render with --props</Title>
        <Caps size={26} style={{ marginTop: 20, textAlign: "center", textTransform: "none" }}>
          python -m outputs.content_engine deep --games AWAY@HOME --artifacts ... --video --mark "focus:..."
        </Caps>
      </AbsoluteFill>
    );
  }
  const wide = width > height;
  const pad = wide ? 64 : 24;
  const headH = (eyebrow ? (wide ? 40 : 48) : 0) + (title ? (wide ? 96 : 120) : 0) + (eyebrow || title ? 24 : 0);
  const stageTop = safe.top + (wide ? 48 : 60) + headH;
  const stageW = width - pad * 2;
  const stageH = height - stageTop - safe.bottom - (wide ? 48 : 60);
  const base = Math.min(stageW / capture.width, stageH / capture.height);
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const sorted = [...steps].sort((a, b) => a.at - b.at);

  // Camera: fold focus/reset steps in time order.
  const home: Cam = { cx: capture.width / 2, cy: capture.height / 2, z: 1 };
  let cam = home;
  for (const s of sorted) {
    if (s.type !== "focus" && s.type !== "reset") continue;
    if (frame < s.at * fps) break;
    let to = home;
    if (s.type === "focus") {
      const [x, y, w, h] = resolveTarget(capture, s.target, "block");
      // Generous air above and below, little at the sides: a wide block can only
      // zoom as far as its own width allows, so side margin would cancel the move.
      const fit = Math.min(stageW / (w * 1.06), stageH / (h * 1.35)) / base;
      const z = Math.max(1, Math.min(s.zoom ?? 2.6, fit));
      // Keep the view inside the board: clamp the centre so no empty space shows.
      const halfW = stageW / (2 * base * z);
      const halfH = stageH / (2 * base * z);
      const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
      to = {
        cx: clamp(x + w / 2, halfW, capture.width - halfW),
        cy: clamp(y + h / 2, halfH, capture.height - halfH),
        z,
      };
    }
    const t = progress(frame, fps, s.at, s.dur ?? 1.0, EASE);
    cam = { cx: lerp(cam.cx, to.cx, t), cy: lerp(cam.cy, to.cy, t), z: lerp(cam.z, to.z, t) };
  }
  const k = base * cam.z; // native px -> screen px
  const tx = stageW / 2 - cam.cx * k;
  const ty = stageH / 2 - cam.cy * k;
  const toScreen = (x: number, y: number) => [x * k + tx, y * k + ty];

  const marks = sorted.filter((s) => s.type !== "focus" && s.type !== "reset");
  const visible = (s: AnnotateStep) => {
    const on = progress(frame, fps, s.at, s.dur ?? 0.6, EASE_DRAW);
    const off = s.until !== undefined ? progress(frame, fps, s.until, 0.35) : 0;
    return { on, alpha: Math.min(1, on * 3) * (1 - off) };
  };
  const stroke = 6 / k;

  return (
    <AbsoluteFill name="Annotate" style={{ background: ground ? "var(--surface-page)" : "transparent", opacity: exit }}>
      {eyebrow || title ? (
        <Interactive.Div
          name="Header"
          style={{ position: "absolute", top: safe.top + (wide ? 40 : 60), left: wide ? 72 : 64, right: wide ? 72 : 64 }}
        >
          {eyebrow ? <div style={rise(frame, fps, 0)}><Eyebrow size={wide ? 26 : 30}>{eyebrow}</Eyebrow></div> : null}
          {title ? (
            <div style={{ marginTop: 8, ...rise(frame, fps, 0.1) }}>
              <Title size={wide ? 72 : 84}>{title}</Title>
            </div>
          ) : null}
        </Interactive.Div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: pad,
          top: stageTop,
          width: stageW,
          height: stageH,
          overflow: "hidden",
          borderRadius: "var(--radius-md)",
          opacity: progress(frame, fps, 0.15, 0.5),
        }}
      >
        {/* the board + vector marks, in native coordinates */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: capture.width,
            height: capture.height,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          }}
        >
          <Img src={staticFile(capture.src)} style={{ width: capture.width, height: capture.height, display: "block" }} />
          <svg
            width={capture.width}
            height={capture.height}
            viewBox={`0 0 ${capture.width} ${capture.height}`}
            style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
          >
            {marks.map((s, i) => {
              const { on, alpha } = visible(s);
              if (alpha <= 0) return null;
              const [x, y, w, h] = resolveTarget(capture, s.target);
              const color = TONE[s.tone ?? "accent"];
              const common = {
                fill: "none",
                strokeWidth: stroke,
                strokeLinecap: "round" as const,
                strokeLinejoin: "round" as const,
                pathLength: 1,
                strokeDasharray: 1,
                strokeDashoffset: 1 - on,
                style: { stroke: color, opacity: alpha },
              };
              const p = 8 / k;
              if (s.type === "spotlight") {
                const W = capture.width;
                const H = capture.height;
                const r = 10 / k;
                return (
                  <path
                    key={i}
                    fillRule="evenodd"
                    d={`M0 0H${W}V${H}H0Z M${x - p + r} ${y - p}H${x + w + p - r}Q${x + w + p} ${y - p} ${x + w + p} ${y - p + r}V${y + h + p - r}Q${x + w + p} ${y + h + p} ${x + w + p - r} ${y + h + p}H${x - p + r}Q${x - p} ${y + h + p} ${x - p} ${y + h + p - r}V${y - p + r}Q${x - p} ${y - p} ${x - p + r} ${y - p}Z`}
                    style={{ fill: "var(--surface-page)", opacity: 0.72 * alpha * Math.min(1, on * 1.5) }}
                  />
                );
              }
              if (s.type === "highlight") {
                return <rect key={i} x={x - p} y={y - p} width={w + p * 2} height={h + p * 2} rx={10 / k} {...common} />;
              }
              if (s.type === "circle") {
                return <ellipse key={i} cx={x + w / 2} cy={y + h / 2} rx={(w / 2) * 1.12 + p} ry={(h / 2) * 1.35 + p} {...common} />;
              }
              if (s.type === "underline") {
                return <path key={i} d={`M${x} ${y + h + p} L${x + w} ${y + h + p}`} {...common} strokeWidth={stroke * 1.4} />;
              }
              if (s.type === "arrow") {
                // From the side with more room, curving into the target's edge.
                const fromLeft = x + w / 2 > capture.width / 2;
                const ex = fromLeft ? x - p : x + w + p;
                const ey = y + h / 2;
                const sx = fromLeft ? ex - 200 / k : ex + 200 / k;
                const sy = ey - 140 / k;
                const cxp = (sx + ex) / 2;
                const cyp = sy + 20 / k;
                const ang = Math.atan2(ey - cyp, ex - cxp);
                const head = 22 / k;
                const headOn = Math.max(0, (on - 0.85) / 0.15);
                return (
                  <g key={i}>
                    <path d={`M${sx} ${sy} Q${cxp} ${cyp} ${ex} ${ey}`} {...common} />
                    <path
                      d={`M${ex - head * Math.cos(ang - 0.5)} ${ey - head * Math.sin(ang - 0.5)} L${ex} ${ey} L${ex - head * Math.cos(ang + 0.5)} ${ey - head * Math.sin(ang + 0.5)}`}
                      fill="none"
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ stroke: color, opacity: alpha * headOn }}
                    />
                  </g>
                );
              }
              return null;
            })}
          </svg>
        </div>

        {/* screen-space labels: constant size whatever the zoom */}
        {marks.map((s, i) => {
          if (!(s.text && (s.type === "label" || s.type === "arrow" || s.type === "highlight" || s.type === "circle"))) return null;
          const textOff = s.textUntil !== undefined ? progress(frame, fps, s.textUntil, 0.3) : 0;
          const alpha = visible(s).alpha * (1 - textOff);
          if (alpha <= 0) return null;
          const [x, y, w, h] = resolveTarget(capture, s.target);
          const color = TONE[s.tone ?? "accent"];
          // Labels sit on the target's left edge, flipping to its right edge when the
          // target starts in the right third - so a label never runs off the stage.
          const [leftX, topY] = toScreen(x, y);
          const [rightX] = toScreen(x + w, y);
          const flip = leftX > stageW * 0.62;
          let lx = flip ? Math.min(rightX, stageW - 12) : Math.max(leftX, 12);
          let ly = topY;
          let anchorX = flip ? "-100%" : "0%";
          const anchorY = "-100%";
          if (s.type === "arrow") {
            const fromLeft = x + w / 2 > capture.width / 2;
            const ex = fromLeft ? x : x + w;
            [lx, ly] = toScreen(ex, y + h / 2);
            lx += fromLeft ? -200 : 200;
            ly -= 150;
            anchorX = fromLeft ? "-100%" : "0%";
          } else {
            ly -= 14;
          }
          lx = Math.max(12, Math.min(stageW - 12, lx));
          ly = Math.max(60, Math.min(stageH - 12, ly));
          return (
            <div
              key={`l${i}`}
              style={{
                position: "absolute",
                left: lx,
                top: ly,
                translate: `${anchorX} ${anchorY}`,
                opacity: alpha,
                background: "var(--surface-page)",
                border: `2px solid ${color}`,
                borderRadius: 10,
                padding: wide ? "10px 18px" : "12px 20px",
                maxWidth: stageW * 0.7,
                boxShadow: "0 10px 30px var(--shadow-deep)",
              }}
            >
              <Caps size={wide ? 24 : 30} color="var(--text-primary)" style={{ letterSpacing: "0.02em", textTransform: "none" }}>
                {s.text}
              </Caps>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Duration that fits the steps plus a hold, for calculateMetadata. */
export const annotateDuration = (steps: AnnotateStep[], fps: number, hold = 1.5) => {
  const end = steps.reduce((m, s) => Math.max(m, s.until ?? s.at + (s.dur ?? 1)), 1);
  return Math.ceil((end + hold) * fps);
};
