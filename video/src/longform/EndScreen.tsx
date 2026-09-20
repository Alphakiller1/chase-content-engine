import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLockup, Caps, Deck, Eyebrow, Title } from "../ds/kit";
import { EASE_DRAW, pop, progress, rise } from "../ds/motion";
import "../fonts";

export type EndScreenProps = {
  title?: string;
  subtitle?: string;
  cta?: string;
  /** Outline and label the element plates while editing; turn off for export. */
  guides?: boolean;
};

/**
 * YouTube end screen, 16:9, meant for the last 5-20 s of a long-form video.
 *
 * YouTube draws its own end-screen elements (video cards, the subscribe button) ON
 * TOP of whatever is here, so this composition leaves plates exactly where they go:
 * two 16:9 video slots on the right and a round subscribe slot on the left. Line the
 * elements up with the plates in YouTube Studio's end-screen editor.
 */
export const EndScreen: React.FC<EndScreenProps> = ({
  title = "Keep Watching",
  subtitle = "The full slate, every matchup, at chase-analytics.com",
  cta = "chase-analytics.com",
  guides = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const s = width / 1920;
  const plate = { w: 720 * s, h: 405 * s };
  const plates = [
    { x: 1080 * s, y: 130 * s, label: "Video element" },
    { x: 1080 * s, y: 130 * s + plate.h + 60 * s, label: "Video element" },
  ];
  const sub = { x: 300 * s, y: 700 * s, d: 240 * s };

  return (
    <AbsoluteFill name="End Screen" style={{ background: "var(--surface-page)" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 55%)",
          opacity: progress(frame, fps, 0, 1.2),
        }}
      />

      <Interactive.Div name="Copy" style={{ position: "absolute", left: 140 * s, top: 170 * s, width: 820 * s }}>
        <div style={rise(frame, fps, 0.1)}>
          <BrandLockup size={40 * s} />
        </div>
        <div style={{ marginTop: 50 * s, ...rise(frame, fps, 0.25) }}>
          <Eyebrow size={30 * s}>Up next</Eyebrow>
        </div>
        <div style={{ marginTop: 12 * s, ...rise(frame, fps, 0.35, 30) }}>
          <Title size={120 * s}>{title}</Title>
        </div>
        <div style={{ marginTop: 22 * s, ...rise(frame, fps, 0.5, 20) }}>
          <Deck size={36 * s}>{subtitle}</Deck>
        </div>
      </Interactive.Div>

      {plates.map((p, i) => {
        const draw = progress(frame, fps, 0.4 + i * 0.15, 0.8, EASE_DRAW);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: plate.w,
              height: plate.h,
              borderRadius: 14 * s,
              background: "var(--surface-card)",
              border: guides ? "3px dashed var(--mark-caution)" : "1px solid var(--border-card)",
              boxShadow: "var(--elevation-card)",
              clipPath: `inset(0 ${(1 - draw) * 100}% 0 0 round ${14 * s}px)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {guides ? <Caps size={26 * s} color="var(--mark-caution)">{p.label}</Caps> : null}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: sub.x,
          top: sub.y,
          width: sub.d,
          height: sub.d,
          borderRadius: "50%",
          background: "var(--surface-card)",
          border: guides ? "3px dashed var(--mark-caution)" : "2px solid var(--border-accent)",
          scale: String(pop(frame, fps, 0.7)),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {guides ? <Caps size={22 * s} color="var(--mark-caution)">Subscribe</Caps> : null}
      </div>

      <div style={{ position: "absolute", left: 140 * s, bottom: 70 * s, ...rise(frame, fps, 0.9, 10) }}>
        <Caps size={26 * s} color="var(--text-accent)">{cta}</Caps>
      </div>
    </AbsoluteFill>
  );
};
