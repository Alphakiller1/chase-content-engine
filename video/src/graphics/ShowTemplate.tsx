import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { League, onTeamInk, teamAccent, teamColors, teamLogoPath } from "../teams";
import "../fonts";
import "../theme.css";

export type StatCell = {
  label: string;
  value: string;
  /** Optional team abbreviation - tints the value with that team's accent. */
  team?: string;
};

// Safe areas live in ONE place (ds/safe.ts); re-exported for older imports.
import { Platform, SAFE, useSafe } from "../ds/safe";
import { BrandLockup } from "../ds/kit";
export { SAFE };
export type { Platform };

export type ShowTemplateProps = {
  platform: Platform;
  league: League;
  away: string;
  home: string;
  /** Chrome headline across the top band. */
  title?: string;
  eyebrow?: string;
  /**
   * The market numbers a viewer can actually go and bet. The template carries
   * THESE, not the model's - model output belongs in ModelSnapshot, which
   * labels itself as a model read.
   */
  spread?: string;
  total?: string;
  moneyline?: string;
  /**
   * Whether `spread`/`total` are the OPENING numbers or the current market.
   * Never default this to "open": no opening-line data exists in the pipeline
   * yet (nfl-model publishes current market only; the MLB slate carries no
   * market at all; sharp-money-tracker's odds history is a single stale day),
   * and a graphic captioned OPEN carrying a current number is a wrong number
   * in public. The label follows this flag, so it becomes correct by itself
   * once real opening lines are captured.
   */
  lineSource?: "open" | "current";
  /** Escape hatch: hand-built cells, used when spread/total are absent. */
  stats?: StatCell[];
  footer?: string;
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * THE TEMPLATE. A full-frame furniture overlay with a transparent window in the
 * middle for your camera - top band, footage window, bottom band. This is the
 * thing you lay over your talking-head footage for the whole video, not a
 * graphic that replaces the frame.
 *
 * Everything outside the two bands renders fully transparent, so in Resolve you
 * put this on the track ABOVE your footage and you appear in the window.
 *
 * It is deliberately near-static after a ~1.2s entrance: freeze the last frame
 * in Resolve and stretch it to the length of your video rather than rendering a
 * multi-minute ProRes file.
 */
export const ShowTemplate: React.FC<ShowTemplateProps> = ({
  platform,
  league,
  away,
  home,
  title,
  eyebrow,
  spread,
  total,
  moneyline,
  lineSource = "current",
  stats,
  footer,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const awayCol = teamColors(away, league);
  const homeCol = teamColors(home, league);
  const awayOnField = onTeamInk(away, league);
  const homeOnField = onTeamInk(home, league);

  /* Band geometry, scaled to the frame and lifted clear of platform UI. The
     16:9 cut gets shallower bands: 1080px of height cannot spare 330 up top. */
  const wide = platform === "youtube";
  const safe = useSafe(platform);
  const TOP_H = wide ? 190 : 330;
  const BOTTOM_H = wide ? 210 : 396;

  /* The bottom band FLOATS above the platform's caption zone rather than
     sitting on the frame edge; the gap underneath is left transparent because
     the app fills it with its own UI. */
  const bottomOffset = safe.bottom;
  const windowTop = TOP_H + safe.top;
  const windowBottom = height - bottomOffset - BOTTOM_H;

  /* Market cells take priority; `stats` is the manual fallback. */
  const prefix = lineSource === "open" ? "Open " : "";
  const marketCells: StatCell[] = [];
  if (spread) marketCells.push({ label: prefix + "Spread", value: spread });
  if (total) marketCells.push({ label: prefix + "Total", value: total });
  if (moneyline) marketCells.push({ label: "Moneyline", value: moneyline });
  const cells = marketCells.length ? marketCells : (stats ?? []);

  const bandIn = (delay: number, from: number) =>
    interpolate(frame, [delay, delay + 0.9 * fps], [from, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    }) + "px";

  const fade = (delay: number) =>
    interpolate(frame, [delay, delay + 0.6 * fps], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    });

  return (
    <AbsoluteFill name="Show Template">
      {/* ── TOP BAND ─────────────────────────────────────────────────────── */}
      <Interactive.Div
        name="Top Band"
        style={{
          position: "absolute",
          top: safe.top,
          left: 0,
          width: "100%",
          height: TOP_H,
          translate: "0px " + bandIn(0, -(TOP_H + safe.top)),
        }}
      >
        {/* Team colour wedges, meeting at a neutral centre. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(100deg, ${awayCol.primary} 0%, var(--surface-page) 185%)`,
            clipPath: "polygon(0 0, 34% 0, 40% 100%, 0 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(260deg, ${homeCol.primary} 0%, var(--surface-page) 185%)`,
            clipPath: "polygon(66% 0, 100% 0, 100% 100%, 60% 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            /* Lifted off pure black: as #070810 this read as a hole punched
               in the bar rather than a centre panel. */
            background: "var(--ca-grad-panel)",
            clipPath: "polygon(34% 0, 66% 0, 60% 100%, 40% 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 46px 30px",
            opacity: fade(0.4 * fps),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <CanvasImage
              src={staticFile(teamLogoPath(away, league))}
              style={{ width: wide ? 96 : 118, height: wide ? 96 : 118 }}
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: wide ? 64 : 82,
                fontWeight: 700,
                color: awayOnField,
                textShadow: "0 2px 12px var(--shadow-deep)",
              }}
            >
              {away}
            </span>
          </div>

          {/* Chrome wording - the site's own --metal-silver treatment. */}
          <div style={{ textAlign: "center", flex: 1, minWidth: 0, padding: "0 16px" }}>
            {eyebrow ? (
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: "var(--vid-caps-track)",
                  textTransform: "uppercase",
                  color: "var(--text-accent)",
                  marginBottom: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <div
                className="chrome"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: wide ? 44 : 54,
                  fontWeight: 800,
                  letterSpacing: -0.5,
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: wide ? 64 : 82,
                fontWeight: 700,
                color: homeOnField,
                textShadow: "0 2px 12px var(--shadow-deep)",
              }}
            >
              {home}
            </span>
            <CanvasImage
              src={staticFile(teamLogoPath(home, league))}
              style={{ width: wide ? 96 : 118, height: wide ? 96 : 118 }}
            />
          </div>
        </div>

        {/* Violet edge along the bottom of the band, framing the window. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: 5,
            background: "var(--edge-brand)",
            opacity: fade(0.7 * fps),
          }}
        />
      </Interactive.Div>

      {/*
        ── FOOTAGE WINDOW ──────────────────────────────────────────────────
        Intentionally empty. Everything between the bands stays transparent so
        your camera shows through from the track below. The only thing drawn
        here is a hairline down each side, so the window reads as part of the
        design instead of as a gap.
      */}
      {[0, 1].map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            top: windowTop,
            /* Both rails sit flush to the frame edge. The icon-rail reserve
               applies to CONTENT (the stat cells), not to this hairline -
               insetting only the right one left the window visibly lopsided
               and neither rail lined up with the full-width bands. */
            [side === 0 ? "left" : "right"]: 0,
            width: 7,
            height: windowBottom - windowTop,
            background:
              "linear-gradient(180deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 55%, transparent) 45%, color-mix(in srgb, var(--accent) 6%, transparent) 100%)",
            opacity: fade(0.9 * fps),
          }}
        />
      ))}

      {/* ── BOTTOM BAND ──────────────────────────────────────────────────── */}
      <Interactive.Div
        name="Bottom Band"
        style={{
          position: "absolute",
          bottom: bottomOffset,
          left: 0,
          width: "100%",
          height: BOTTOM_H,
          translate: "0px " + bandIn(0.2 * fps, BOTTOM_H + bottomOffset),
          background: "var(--ca-grad-panel)",
          borderTop: "5px solid transparent",
          borderImage: "var(--edge-brand) 1",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Stat cells */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            /* Reserve on BOTH sides, not just the right. Padding only the right
               kept the cells clear of the icon rail but left the group sitting
               off-centre in the frame - invisible while they were boxed chips,
               obvious once the boxes came off. */
            padding: `18px ${Math.max(40, safe.right)}px 6px ${Math.max(40, safe.right)}px`,
            gap: 24,
            opacity: fade(0.8 * fps),
          }}
        >
          {cells.slice(0, 3).map((s, i) => (
            <Interactive.Div
              key={s.label}
              name={"Stat: " + s.label}
              style={{
                flex: 1,
                /* No card, no border, no radius. Three boxed chips read as UI
                   furniture; the numbers should read as a broadcast strip. A
                   hairline divider does the separating instead. */
                textAlign: "center",
                borderLeft: i === 0 ? "none" : "1px solid var(--border-default)",
                padding: "4px 12px",
                opacity: interpolate(
                  frame,
                  [0.9 * fps + i * 3, 1.5 * fps + i * 3],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: EASE,
                  },
                ),
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: "var(--vid-caps-track)",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                {s.label}
              </div>
              <div
                /* Chrome silver, same --metal-silver treatment as the title.
                   A team tint would need a solid colour, so it wins over chrome
                   when one is set. */
                className={s.team ? undefined : "chrome"}
                style={{
                  fontFamily: "var(--font-display)",
                  /* Sized to fit "SEA -3.5" on ONE line inside a third of the
                     reserved width - at 64 it wrapped to two lines and read
                     like a mistake. nowrap makes any future overflow obvious
                     instead of silently restacking. */
                  fontSize: wide ? 44 : 52,
                  fontWeight: 800,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  letterSpacing: -0.5,
                  ...(s.team ? { color: teamAccent(s.team, league) } : {}),
                }}
              >
                {s.value}
              </div>
            </Interactive.Div>
          ))}
        </div>

        {/* Brand strip: the site header's lockup, and the footer line if one is set. */}
        <div
          style={{
            height: wide ? 68 : 96,
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingRight: safe.right,
            gap: 28,
            opacity: fade(1.1 * fps),
          }}
        >
          <BrandLockup size={wide ? 30 : 36} />
          {footer ? (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: wide ? 22 : 26,
                color: "var(--text-secondary)",
              }}
            >
              {footer}
            </span>
          ) : null}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
