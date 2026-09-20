import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLockup } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise } from "../ds/motion";
import "../fonts";

export type AgendaRailProps = {
  chapters: string[];
  /** 0-based index of the chapter on screen. */
  current: number;
  /** Top of frame (default) or bottom. */
  position?: "top" | "bottom";
  /** Fill the current segment across the composition's duration (a progress read). */
  fill?: boolean;
  /** Short label left of the rail, e.g. "TNF · DET at BUF". */
  label?: string;
};

/**
 * Long-form rundown rail: every chapter as a segment, done / now / next at a glance.
 * A transparent overlay for 16:9 - render it per chapter (current = i) and lay it
 * over that chapter's footage, or render one long hold and freeze it.
 */
export const AgendaRail: React.FC<AgendaRailProps> = ({
  chapters,
  current,
  position = "top",
  fill = true,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const enter = rise(frame, fps, 0, position === "top" ? -20 : 20);
  const now = fill ? frame / Math.max(1, durationInFrames - 1) : 1;
  const railW = width - 120 * 2 - (label ? 420 : 0) - 250;

  return (
    <AbsoluteFill name="Agenda Rail">
      <Interactive.Div
        name="Rail"
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          [position]: 40,
          height: 86,
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "0 28px",
          borderRadius: "var(--radius-md)",
          background: "var(--vid-glass-strong)",
          border: "1px solid var(--border-card)",
          ...enter,
          opacity: (enter.opacity as number) * exit,
        }}
      >
        <BrandLockup size={24} />
        {label ? (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "var(--vid-caps-track)",
              textTransform: "uppercase",
              color: "var(--text-accent)",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flex: 1, width: railW }}>
          {chapters.map((c, i) => {
            const done = i < current;
            const isNow = i === current;
            const grow = progress(frame, fps, 0.2 + i * 0.05, 0.5, EASE_DRAW);
            return (
              <div key={c} style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--border-strong)",
                    overflow: "hidden",
                    scale: `${grow} 1`,
                    transformOrigin: "left",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(done ? 1 : isNow ? now : 0) * 100}%`,
                      background: isNow ? "var(--edge-brand)" : "var(--text-muted)",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: "var(--font-body)",
                    fontWeight: isNow ? 700 : 500,
                    fontSize: 22,
                    color: isNow
                      ? "var(--text-primary)"
                      : done
                        ? "var(--text-muted)"
                        : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {String(i + 1).padStart(2, "0")} {c}
                </div>
              </div>
            );
          })}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
