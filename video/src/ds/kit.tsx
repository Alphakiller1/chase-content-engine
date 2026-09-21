/**
 * The package's building blocks, drawn from the site's own roles.
 *
 * Every piece names semantic tokens only (see theme.css). Where the site has a
 * component with the same job - the header lockup, the page-title metal, the status
 * pill, the card surface - these reproduce ITS roles at video scale rather than
 * inventing a video look, so a viewer who clicks through lands on something that
 * looks like what they just watched.
 */
import React from "react";
import { Img, staticFile } from "remotion";
import { League, teamAccent, teamLogoPath } from "../teams";

/* ── brand ────────────────────────────────────────────────────────────────── */

/**
 * The site header's lockup: the brand icon (exported from the live site by
 * sync-style) and the typeset wordmark - CHASE in primary ink, ANALYTICS in secondary,
 * display face, italic, uppercase. Typeset, never a logo file: the horizontal logo
 * PNGs carry black lettering or no alpha channel and die over footage.
 */
export const BrandLockup: React.FC<{ size?: number; muted?: boolean }> = ({
  size = 40,
  muted,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.32 }}>
    <Img
      src={staticFile("brand/chase-icon.png")}
      style={{ width: size * 1.05, height: size * 1.05, objectFit: "contain" }}
    />
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        textTransform: "uppercase",
        letterSpacing: 0,
        whiteSpace: "nowrap",
        opacity: muted ? 0.82 : 1,
      }}
    >
      <span style={{ color: "var(--text-primary)" }}>Chase</span>{" "}
      <span style={{ color: "var(--text-secondary)" }}>Analytics</span>
    </span>
  </div>
);

/* ── type ─────────────────────────────────────────────────────────────────── */

/** The site's eyebrow: accent ink, bold, uppercase, lightly tracked. */
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 26, style }) => (
  <div
    style={{
      fontFamily: "var(--font-body)",
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "var(--vid-caps-track)",
        textTransform: "uppercase",
        color: "var(--text-accent)",
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * The site's page title: condensed display, 800, Title Case, tight tracking, metal.
 * Case is left as typed - the site dropped uppercase titles in the 2026-09 pass.
 */
export const Title: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
  plain?: boolean;
}> = ({ children, size = 88, style, plain }) => (
  <div
    className={plain ? undefined : "chrome"}
    style={{
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1.0,
      letterSpacing: "-0.02em",
      color: plain ? "var(--text-primary)" : undefined,
      textShadow: "0 2px 0 rgba(0,0,0,.75)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Section heading the way the site sets one inside a card. */
export const SectionHead: React.FC<{
  children: React.ReactNode;
  size?: number;
  note?: string;
}> = ({ children, size = 40, note }) => (
  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 24,
    }}
  >
    <div
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: size,
        color: "var(--text-primary)",
        letterSpacing: "0.005em",
      }}
    >
      {children}
    </div>
    {note ? (
      <div style={{ fontSize: size * 0.48, color: "var(--text-secondary)" }}>{note}</div>
    ) : null}
  </div>
);

/** Plain deck copy. */
export const Deck: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 34, style }) => (
  <div
    style={{
      fontFamily: "var(--font-body)",
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1.35,
      color: "var(--text-primary)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Small uppercase label (stat labels, column heads). */
export const Caps: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 22, color = "var(--text-primary)", style }) => (
  <div
    style={{
      fontFamily: "var(--font-body)",
      fontWeight: 800,
      fontSize: size,
      letterSpacing: "var(--vid-caps-track)",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * The take: the ONE slot styled as opinion (italic on the brand rule), so a viewer
 * can always tell the author's argument from a measured number. Same rule as stills.
 */
export const Take: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 40,
}) => (
  <div style={{ display: "flex", gap: size * 0.55, alignItems: "stretch" }}>
    <div
      style={{
        width: Math.max(4, size * 0.12),
        borderRadius: 3,
        background: "var(--edge-brand)",
        flexShrink: 0,
      }}
    />
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontStyle: "italic",
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.36,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </div>
  </div>
);

/* ── surfaces ─────────────────────────────────────────────────────────────── */

/** The site's card: card ink, hairline border, inset top highlight, 12px radius. */
export const Panel: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number | string;
  glass?: boolean;
}> = ({ children, style, pad = 32, glass }) => (
  <div
    style={{
      background: glass ? "var(--vid-glass)" : "var(--surface-card)",
      border: "1.5px solid var(--border-card)",
      boxShadow: "var(--elevation-card)",
      borderRadius: "var(--radius-md)",
      padding: pad,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Hairline brand edge (the gradient rule the site uses to frame a panel). */
export const EdgeRule: React.FC<{ width: number | string; height?: number }> = ({
  width,
  height = 4,
}) => (
  <div
    style={{ width, height, borderRadius: height / 2, background: "var(--edge-brand)" }}
  />
);

/* ── status ───────────────────────────────────────────────────────────────── */

export type Designation =
  | "active"
  | "questionable"
  | "doubtful"
  | "out"
  | "injured reserve"
  | string;

/** The site's status pill vocabulary, at video size. */
export const StatusPill: React.FC<{ status: Designation; size?: number; label?: string }> = ({
  status,
  size = 20,
  label,
}) => {
  const s = status.toLowerCase();
  const tone =
    s === "active" || s === "probable"
      ? "var(--mark-positive)"
      : s === "questionable"
        ? "var(--mark-caution)"
        : s === "doubtful"
          ? "var(--mark-caution)"
          : "var(--mark-negative)";
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-body)",
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "var(--vid-caps-track)",
        textTransform: "uppercase",
        color: tone,
        border: `2.5px solid color-mix(in srgb, ${tone} 85%, #fff 10%)`,
        background: `color-mix(in srgb, ${tone} 24%, var(--surface-card))`,
        borderRadius: 8,
        padding: `${size * 0.22}px ${size * 0.55}px`,
        whiteSpace: "nowrap",
      }}
    >
      {label ?? status}
    </span>
  );
};

/* ── teams ────────────────────────────────────────────────────────────────── */

/** Local team logo. League is required: sixteen abbreviations are shared. */
export const TeamLogo: React.FC<{ team: string; league: League; size: number }> = ({
  team,
  league,
  size,
}) => (
  <Img src={staticFile(teamLogoPath(team, league))} style={{ width: size, height: size, objectFit: "contain" }} />
);

/** Logo + abbreviation in the club's legible accent. */
export const TeamMark: React.FC<{
  team: string;
  league: League;
  size?: number;
  reverse?: boolean;
}> = ({ team, league, size = 64, reverse }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: size * 0.22,
      flexDirection: reverse ? "row-reverse" : "row",
    }}
  >
    <TeamLogo team={team} league={league} size={size} />
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: size * 0.82,
        color: teamAccent(team, league),
        lineHeight: 1,
      }}
    >
      {team}
    </span>
  </div>
);

/* ── tones ──────────────────────────────────────────────────────────────── */

/** Mark colours for drawn annotations, from the site's semantic marks. */
export type Tone = "accent" | "positive" | "negative" | "caution" | "primary";
export const TONE: Record<Tone, string> = {
  accent: "var(--accent)",
  positive: "var(--mark-positive)",
  negative: "var(--mark-negative)",
  caution: "var(--mark-caution)",
  primary: "var(--text-primary)",
};

/* ── numbers ──────────────────────────────────────────────────────────────── */

/** Formats a count-up value the way the source number is written. */
export const formatLike = (value: number, like: string | number): string => {
  const text = String(like);
  const decimals = (text.split(".")[1] || "").replace(/[^0-9]/g, "").length;
  const sign = text.trim().startsWith("+") && value > 0 ? "+" : "";
  const pct = text.trim().endsWith("%") ? "%" : "";
  const lead = /^\.\d/.test(text.trim()) ? "lead-dot" : "";
  let out = value.toFixed(decimals);
  if (lead && out.startsWith("0.")) out = out.slice(1);
  return sign + out + pct;
};

/** Parses "+6.5", "44.5", ".318", "57.1%" into a number, or null. */
export const parseNumber = (text: string | number): number | null => {
  const m = String(text).replace(/,/g, "").match(/[-+]?\d*\.?\d+/);
  return m ? Number(m[0]) : null;
};
