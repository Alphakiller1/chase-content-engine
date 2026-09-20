import { AbsoluteFill, useVideoConfig } from "remotion";
import "../fonts";
import "../theme.css";

/**
 * A measuring stick you post once per platform.
 *
 * Published safe-zone numbers disagree with each other and change with app
 * releases, caption length and device notch, so the only way to get exact
 * values for YOUR account on YOUR phone is to measure. Post this to Reels,
 * TikTok and Shorts, screenshot each, and read off the last visible label at
 * each edge - that number is the real reserve.
 *
 * Design notes: rulers count INWARD from each edge (bottom labels say how far
 * up from the bottom you are, right labels how far in from the right), because
 * that is the number the SAFE table wants. High-contrast bands alternate every
 * 100px so a label stays readable behind translucent platform chrome.
 */
export const SafeZoneCalibration: React.FC = () => {
  const { width, height } = useVideoConfig();

  const STEP = 100;
  const rows = Math.floor(height / STEP);
  const cols = Math.floor(width / STEP);

  const label = (text: string, extra: React.CSSProperties = {}) => (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 30,
        fontWeight: 700,
        color: "#FFFFFF",
        background: "rgba(0,0,0,0.72)",
        padding: "2px 10px",
        borderRadius: 4,
        ...extra,
      }}
    >
      {text}
    </span>
  );

  return (
    <AbsoluteFill
      name="Safe Zone Calibration"
      style={{ backgroundColor: "var(--surface-card)" }}
    >
      {/* Horizontal bands, alternating so edges stay readable under chrome. */}
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <div
          key={"h" + i}
          style={{
            position: "absolute",
            top: i * STEP,
            left: 0,
            width: "100%",
            height: STEP,
            background: i % 2 ? "var(--surface-raised)" : "var(--surface-card)",
            borderTop: "1px solid rgba(154,107,255,0.45)",
          }}
        />
      ))}

      {/* Distance UP from the bottom edge - the number the bottom reserve wants. */}
      {Array.from({ length: rows }).map((_, i) => {
        const fromBottom = (i + 1) * STEP;
        if (fromBottom > 900) return null;
        return (
          <div
            key={"b" + i}
            style={{
              position: "absolute",
              bottom: fromBottom,
              left: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {label(fromBottom + " ↑ bottom", {
              background: "rgba(242,84,91,0.92)",
            })}
          </div>
        );
      })}

      {/* Distance DOWN from the top edge. */}
      {Array.from({ length: 5 }).map((_, i) => {
        const fromTop = (i + 1) * STEP;
        return (
          <div
            key={"t" + i}
            style={{ position: "absolute", top: fromTop, left: 24 }}
          >
            {label(fromTop + " ↓ top", { background: "rgba(60,203,127,0.92)" })}
          </div>
        );
      })}

      {/* Vertical rules, labelled by distance IN from the right edge. */}
      {Array.from({ length: cols }).map((_, i) => {
        const fromRight = (i + 1) * STEP;
        if (fromRight > 400) return null;
        return (
          <div key={"r" + i}>
            <div
              style={{
                position: "absolute",
                top: 0,
                right: fromRight,
                width: 2,
                height: "100%",
                background: "rgba(232,194,74,0.8)",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: fromRight + 6,
                top: height * 0.22,
                transform: "rotate(-90deg)",
                transformOrigin: "right top",
              }}
            >
              {label(fromRight + " → right", {
                background: "rgba(232,194,74,0.92)",
                color: "#0A0B10",
              })}
            </div>
          </div>
        );
      })}

      {/* Centre instructions, well inside every plausible safe area. */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "0 120px",
        }}
      >
        <div
          className="chrome"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 76,
            fontWeight: 800,
            textTransform: "uppercase",
            lineHeight: 1.05,
          }}
        >
          Safe Zone
          <br />
          Calibration
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 34,
            color: "var(--text-secondary)",
            marginTop: 26,
            lineHeight: 1.4,
          }}
        >
          Post to Reels, TikTok and Shorts.
          <br />
          Screenshot each. Read the last label
          <br />
          still visible at every edge.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
