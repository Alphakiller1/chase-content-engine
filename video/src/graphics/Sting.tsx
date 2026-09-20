import { AbsoluteFill, Img, Interactive, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_DRAW, exitAt, pop, progress, rise } from "../ds/motion";
import "../fonts";

export type StingProps = {
  /** Optional line under the mark - a tagline on the intro, a CTA on the outro. */
  tagline?: string;
  /** Paint the site's page ground instead of leaving the frame transparent. */
  ground?: boolean;
};

/**
 * Branded open/close, ~2.5 s. Transparent by default so it sits over the first or
 * last seconds of footage rather than forcing a hard cut to a card.
 *
 * The lockup is the site header's: brand icon + typeset CHASE / ANALYTICS in the
 * display face. The site dropped its violet ambient glow in the 2026-09 black
 * pass, so the motion carries the energy instead: the brand edge draws across,
 * the icon pops, the wordmark wipes on behind it, the tagline settles.
 */
export const Sting: React.FC<StingProps> = ({ tagline, ground }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const unit = Math.min(width, height);
  // The lockup is ~8.6 word-heights wide (icon + CHASE ANALYTICS in the condensed
  // italic); size it to 76% of the frame width so it never runs off a vertical frame.
  const wordSize = Math.min(unit * 0.1, (width * 0.76) / 8.6);
  const iconSize = wordSize * 1.4;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const wipe = progress(frame, fps, 0.3, 0.7, EASE_DRAW);
  const iconPop = pop(frame, fps, 0.12);

  return (
    <AbsoluteFill
      name="Sting"
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: ground ? "var(--surface-page)" : "transparent",
        opacity: exit,
        translate: `0px ${(1 - exit) * -24}px`,
      }}
    >
      <Interactive.Div
        name="Edge"
        style={{
          position: "absolute",
          top: height / 2 + iconSize * 0.72,
          left: width / 2,
          height: 4,
          borderRadius: 2,
          background: "var(--edge-brand)",
          width: width * 0.5 * progress(frame, fps, 0, 0.8, EASE_DRAW),
          translate: "-50% 0px",
        }}
      />

      <Interactive.Div
        name="Lockup"
        style={{ display: "flex", alignItems: "center", gap: unit * 0.035 }}
      >
        <Img
          src={staticFile("brand/chase-icon.png")}
          style={{
            width: iconSize,
            height: iconSize,
            objectFit: "contain",
            scale: String(0.6 + 0.4 * iconPop),
            opacity: Math.min(1, iconPop * 1.4),
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: wordSize,
            lineHeight: 1,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            clipPath: `inset(-10% ${(1 - wipe) * 100}% -10% 0%)`,
            translate: `${(1 - wipe) * -30}px 0px`,
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>Chase</span>{" "}
          <span style={{ color: "var(--text-secondary)" }}>Analytics</span>
        </div>
      </Interactive.Div>

      {tagline ? (
        <Interactive.Div
          name="Tagline"
          style={{
            position: "absolute",
            top: height / 2 + iconSize * 0.72 + 40,
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: unit * 0.036,
            letterSpacing: "var(--vid-caps-track)",
            textTransform: "uppercase",
            color: "var(--text-accent)",
            ...rise(frame, fps, 0.85, 18),
          }}
        >
          {tagline}
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
