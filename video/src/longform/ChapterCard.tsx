import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { Deck, Eyebrow, TeamLogo, Title } from "../ds/kit";
import { EASE_DRAW, EASE_IN, exitAt, progress, ramp, rise } from "../ds/motion";
import { League, teamAccent } from "../teams";
import "../fonts";

export type ChapterCardProps = {
  /** 1-based chapter number. */
  number: number;
  title: string;
  subtitle?: string;
  /** Optional club to key the chapter to (tints the numeral, shows the logo). */
  team?: string;
  league?: League;
  /** Transparent: lay it over footage as a wipe instead of cutting to black. */
  transparent?: boolean;
};

/**
 * Segment transition for long-form (and vertical chapters). A black panel wipes
 * across, the chapter numeral and title arrive, and the panel wipes off the other
 * side at the end - so it can sit on a cut point with footage either side.
 */
export const ChapterCard: React.FC<ChapterCardProps> = ({
  number,
  title,
  subtitle,
  team,
  league,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const wide = width > height;
  const inWipe = progress(frame, fps, 0, 0.45, EASE_DRAW);
  const outWipe = ramp(frame, [durationInFrames - 0.45 * fps, durationInFrames - 1], [0, 1], EASE_IN);
  const exit = exitAt(frame, fps, durationInFrames, 0.35);
  const ink = team && league ? teamAccent(team, league) : "var(--accent)";
  const numeral = String(number).padStart(2, "0");

  return (
    <AbsoluteFill name="Chapter Card">
      <AbsoluteFill
        style={{
          background: transparent ? "var(--vid-glass-strong)" : "var(--surface-page)",
          clipPath: `inset(0 ${(1 - inWipe) * 100}% 0 ${outWipe * 100}%)`,
        }}
      />
      {/* brand edge rides the wipe */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: 8,
          background: "var(--edge-brand)",
          left: `${(outWipe > 0 ? outWipe : inWipe) * 100}%`,
          translate: "-50% 0px",
          opacity: inWipe < 1 || outWipe > 0 ? 1 : 0,
        }}
      />

      <Interactive.Div
        name="Content"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: wide ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: wide ? 70 : 30,
          padding: wide ? "0 160px" : "0 72px",
          opacity: exit,
        }}
      >
        <div
          className="num"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: wide ? 300 : 280,
            lineHeight: 0.85,
            color: ink,
            letterSpacing: "-0.04em",
            clipPath: `inset(${(1 - progress(frame, fps, 0.3, 0.6, EASE_DRAW)) * 100}% 0 0 0)`,
          }}
        >
          {numeral}
        </div>
        <div style={{ textAlign: wide ? "left" : "center", maxWidth: wide ? width * 0.55 : undefined }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: wide ? "flex-start" : "center", ...rise(frame, fps, 0.45) }}>
            {team && league ? <TeamLogo team={team} league={league} size={wide ? 64 : 72} /> : null}
            <Eyebrow size={wide ? 28 : 32}>Chapter {number}</Eyebrow>
          </div>
          <div style={{ marginTop: 12, ...rise(frame, fps, 0.55, 34) }}>
            <Title size={wide ? 104 : 96}>{title}</Title>
          </div>
          {subtitle ? (
            <div style={{ marginTop: 18, ...rise(frame, fps, 0.75, 20) }}>
              <Deck size={wide ? 34 : 36}>{subtitle}</Deck>
            </div>
          ) : null}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
