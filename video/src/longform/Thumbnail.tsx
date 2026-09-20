import { AbsoluteFill, useVideoConfig } from "remotion";
import { BrandLockup, TeamLogo } from "../ds/kit";
import { League, teamColors } from "../teams";
import "../fonts";

export type ThumbnailProps = {
  league: League;
  away: string;
  home: string;
  /** Two short lines read at thumbnail size - three or four words each at most. */
  line1: string;
  line2?: string;
  /** Corner badge, e.g. "TNF" or "Week 2". */
  badge?: string;
};

/**
 * YouTube thumbnail (1280x720) or vertical cover (1080x1920), rendered as a STILL:
 *   npx remotion still Thumbnail out/thumb.png --props=...
 *
 * Built for the size it is judged at - a phone feed tile - so the rules differ from a
 * video frame: the two clubs' colour fields for instant recognition, both logos at
 * full weight, and at most two very short lines of heavy type with a hard shadow.
 * The brand sits small in a corner: the site's lockup, legible but never the hook.
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({ league, away, home, line1, line2, badge }) => {
  const { width, height } = useVideoConfig();
  const wide = width > height;
  const unit = Math.min(width, height);
  const a = teamColors(away, league).primary;
  const h = teamColors(home, league).primary;
  const logo = wide ? unit * 0.46 : unit * 0.5;
  const fields = wide
    ? ["polygon(0 0, 58% 0, 42% 100%, 0 100%)", "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)", "polygon(57.4% 0, 58.6% 0, 42.6% 100%, 41.4% 100%)"]
    : ["polygon(0 0, 100% 0, 100% 34%, 0 46%)", "polygon(0 46%, 100% 34%, 100% 100%, 0 100%)", "polygon(0 45.4%, 100% 33.4%, 100% 34.6%, 0 46.6%)"];

  return (
    <AbsoluteFill style={{ background: "var(--surface-page)", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(120deg, ${a} 0%, color-mix(in srgb, ${a} 45%, var(--surface-page)) 100%)`,
          clipPath: fields[0],
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(300deg, ${h} 0%, color-mix(in srgb, ${h} 45%, var(--surface-page)) 100%)`,
          clipPath: fields[1],
        }}
      />
      <AbsoluteFill style={{ background: "var(--edge-brand)", clipPath: fields[2] }} />

      <div
        style={{
          position: "absolute",
          top: wide ? height * 0.06 : height * 0.08,
          left: width * 0.04,
          right: width * 0.04,
          display: "flex",
          flexDirection: wide ? "row" : "column",
          alignItems: wide ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: wide ? 0 : height * 0.04,
          filter: "drop-shadow(0 14px 22px var(--shadow-deep))",
        }}
      >
        <TeamLogo team={away} league={league} size={logo} />
        <TeamLogo team={home} league={league} size={logo} />
      </div>

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, transparent 45%, color-mix(in srgb, var(--surface-page) 88%, transparent) 70%, var(--surface-page) 100%)",
        }}
      />

      <div style={{ position: "absolute", left: width * 0.04, right: width * 0.04, bottom: height * 0.07 }}>
        {[line1, line2].filter(Boolean).map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: unit * (wide ? 0.16 : 0.15),
              lineHeight: 0.94,
              letterSpacing: "-0.02em",
              color: i === 0 ? "var(--text-primary)" : "var(--text-accent)",
              textShadow: `0 ${unit * 0.006}px 0 #000, 0 ${unit * 0.014}px ${unit * 0.03}px var(--shadow-deep)`,
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {badge ? (
        <div
          style={{
            position: "absolute",
            top: unit * 0.04,
            left: "50%",
            translate: "-50% 0px",
            padding: `${unit * 0.012}px ${unit * 0.03}px`,
            borderRadius: unit * 0.014,
            background: "var(--surface-page)",
            border: `${Math.max(3, unit * 0.004)}px solid var(--accent)`,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: unit * 0.062,
            lineHeight: 1,
            color: "var(--text-primary)",
          }}
        >
          {badge}
        </div>
      ) : null}

      <div style={{ position: "absolute", right: width * 0.03, bottom: height * 0.03 }}>
        <BrandLockup size={unit * 0.034} />
      </div>
    </AbsoluteFill>
  );
};
