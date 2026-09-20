import { AbsoluteFill, Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLockup, Caps, Eyebrow, TeamLogo, Title } from "../ds/kit";
import { EASE, EASE_DRAW, exitAt, pop, progress, ramp, rise } from "../ds/motion";
import { League, teamColors } from "../teams";
import "../fonts";

export type EpisodeOpenProps = {
  league: League;
  away: string;
  home: string;
  /** Show / slot name, e.g. "Thursday Night Football". */
  show: string;
  /** The episode's own title - your angle on the game. */
  title: string;
  awayName?: string;
  homeName?: string;
  kickoff?: string;
  network?: string;
  venue?: string;
};

/**
 * Title sequence for a long-form episode (16:9) or a vertical cold open (9:16).
 *
 * The two clubs' colour fields drive in from the sides and meet on a diagonal
 * seam, the logos land, the matchup reads, then the episode title settles over the
 * site's black ground. Opaque by design: this is the first thing on screen.
 */
export const EpisodeOpen: React.FC<EpisodeOpenProps> = ({
  league,
  away,
  home,
  show,
  title,
  awayName,
  homeName,
  kickoff,
  network,
  venue,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const wide = width > height;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const a = teamColors(away, league);
  const h = teamColors(home, league);

  const drive = progress(frame, fps, 0, 0.9);
  // After the logos land the fields recede, handing the frame to the title.
  const recede = ramp(frame, [1.9 * fps, 2.8 * fps], [1, 0.34], EASE);
  const logo = (at: number) => pop(frame, fps, at);
  const logoSize = wide ? height * 0.34 : width * 0.36;
  // Vertical frames keep both logos in a row across the upper half, clear of the
  // title block (a stacked column put the home logo behind the headline).
  const seam = progress(frame, fps, 0.55, 0.6, EASE_DRAW);

  return (
    <AbsoluteFill name="Episode Open" style={{ background: "var(--surface-page)", opacity: exit }}>
      {/* colour fields */}
      <AbsoluteFill
        style={{
          opacity: recede,
          background: `linear-gradient(115deg, ${a.primary} 0%, color-mix(in srgb, ${a.primary} 30%, var(--surface-page)) 100%)`,
          clipPath: "polygon(0 0, 56% 0, 44% 100%, 0 100%)",
          translate: `${(drive - 1) * width * 0.6}px 0px`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: recede,
          background: `linear-gradient(295deg, ${h.primary} 0%, color-mix(in srgb, ${h.primary} 30%, var(--surface-page)) 100%)`,
          clipPath: "polygon(56% 0, 100% 0, 100% 100%, 44% 100%)",
          translate: `${(1 - drive) * width * 0.6}px 0px`,
        }}
      />
      {/* seam */}
      <AbsoluteFill
        style={{
          background: "var(--edge-brand)",
          clipPath: "polygon(55.6% 0, 56.4% 0, 44.4% 100%, 43.6% 100%)",
          opacity: seam * recede,
        }}
      />
      {/* ground wash so type always sits on black */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--surface-page) 70%, transparent) 60%, var(--surface-page) 100%)",
          opacity: ramp(frame, [1.9 * fps, 2.8 * fps], [0, 1]),
        }}
      />

      {/* logos */}
      <Interactive.Div
        name="Logos"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: wide ? "center" : "flex-start",
          justifyContent: "space-between",
          padding: wide ? `0 ${width * 0.12}px` : `${height * 0.24}px ${width * 0.06}px 0`,
          translate: `0px ${ramp(frame, [1.9 * fps, 2.8 * fps], [0, wide ? -height * 0.2 : -height * 0.06])}px`,
          scale: String(ramp(frame, [1.9 * fps, 2.8 * fps], [1, wide ? 0.62 : 0.7])),
        }}
      >
        {[away, home].map((t, i) => (
          <div key={t} style={{ scale: String(logo(0.35 + i * 0.18)), filter: "drop-shadow(0 18px 40px var(--shadow-deep))" }}>
            <TeamLogo team={t} league={league} size={logoSize} />
          </div>
        ))}
      </Interactive.Div>

      {/* type */}
      <Interactive.Div
        name="Title Block"
        style={{
          position: "absolute",
          left: wide ? 140 : 72,
          right: wide ? 140 : 72,
          bottom: wide ? 110 : height * 0.2,
          textAlign: wide ? "left" : "center",
        }}
      >
        <div style={rise(frame, fps, 2.2)}>
          <Eyebrow size={wide ? 30 : 34}>{show}</Eyebrow>
        </div>
        <div style={{ marginTop: 10, ...rise(frame, fps, 2.35) }}>
          <Caps size={wide ? 30 : 34} color="var(--text-primary)">
            {(awayName ?? away) + "  at  " + (homeName ?? home)}
          </Caps>
        </div>
        <div style={{ marginTop: 18, ...rise(frame, fps, 2.55, 36) }}>
          <Title size={wide ? 118 : 104}>{title}</Title>
        </div>
        <div
          style={{
            marginTop: 26,
            display: "flex",
            gap: 26,
            justifyContent: wide ? "flex-start" : "center",
            flexWrap: "wrap",
            ...rise(frame, fps, 2.9, 14),
          }}
        >
          {[kickoff, network, venue].filter(Boolean).map((t) => (
            <Caps key={t} size={wide ? 22 : 26}>
              {t}
            </Caps>
          ))}
        </div>
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          top: wide ? 54 : 150,
          left: wide ? 140 : 0,
          right: wide ? undefined : 0,
          display: "flex",
          justifyContent: "center",
          ...rise(frame, fps, 2.4, 10),
        }}
      >
        <BrandLockup size={wide ? 30 : 38} />
      </div>
    </AbsoluteFill>
  );
};
