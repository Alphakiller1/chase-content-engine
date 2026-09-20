import React from "react";
import { TeamLogo } from "../ds/kit";
import { League, teamAccent } from "../teams";

type BroadcastBackdropProps = {
  league: League;
  away: string;
  home: string;
};

/** Shared show ground: restrained team light, a broadcast grid, and a top rail. */
export const BroadcastBackdrop: React.FC<BroadcastBackdropProps> = ({ league, away, home }) => {
  const awayInk = teamAccent(away, league);
  const homeInk = teamAccent(home, league);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            `radial-gradient(70% 54% at -8% 6%, color-mix(in srgb, ${awayInk} 15%, transparent), transparent 68%)`,
            `radial-gradient(70% 54% at 108% 6%, color-mix(in srgb, ${homeInk} 15%, transparent), transparent 68%)`,
            "linear-gradient(180deg, var(--surface-inset), var(--surface-page) 46%)",
          ].join(","),
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(var(--border-card) 1px, transparent 1px), linear-gradient(90deg, var(--border-card) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "linear-gradient(to bottom, black, transparent 58%)",
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "var(--edge-brand)" }} />
    </div>
  );
};

type BroadcastHeaderProps = {
  league: League;
  away: string;
  home: string;
  awayName?: string;
  homeName?: string;
  eyebrow: string;
  title: string;
  meta?: string;
  wide: boolean;
};

/** One hierarchy for every analysis board: teams frame the editorial question. */
export const BroadcastHeader: React.FC<BroadcastHeaderProps> = ({
  league,
  away,
  home,
  awayName,
  homeName,
  eyebrow,
  title,
  meta,
  wide,
}) => {
  const side = (team: string, name: string | undefined, reverse = false) => (
    <div style={{ display: "flex", alignItems: "center", flexDirection: reverse ? "row-reverse" : "row", gap: wide ? 12 : 10, minWidth: 0 }}>
      <TeamLogo team={team} league={league} size={wide ? 58 : 62} />
      <div style={{ minWidth: 0, textAlign: reverse ? "right" : "left" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: wide ? 25 : 28, lineHeight: 1, color: teamAccent(team, league) }}>{team}</div>
        {name && wide ? (
          <div style={{ marginTop: 5, fontSize: wide ? 14 : 16, fontWeight: 800, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(190px,1fr) minmax(420px,2.2fr) minmax(190px,1fr)" : "150px minmax(0,1fr) 150px", gap: wide ? 24 : 14, alignItems: "center" }}>
      {side(away, awayName)}
      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: wide ? 17 : 19, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--text-accent)" }}>{eyebrow}</div>
        <div style={{ marginTop: 5, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: wide ? 54 : 58, letterSpacing: "-0.025em", lineHeight: 0.98, color: "var(--text-primary)" }}>{title}</div>
        {meta ? <div style={{ marginTop: 9, fontWeight: 750, fontSize: wide ? 16 : 18, color: "var(--text-secondary)" }}>{meta}</div> : null}
      </div>
      {side(home, homeName, true)}
    </div>
  );
};

export const BroadcastPanel: React.FC<{
  children: React.ReactNode;
  accent?: string;
  style?: React.CSSProperties;
}> = ({ children, accent, style }) => (
  <div
    style={{
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(180deg, var(--surface-elevated), var(--surface-card))",
      border: "1px solid var(--border-hover)",
      borderRadius: "var(--vid-radius-panel)",
      boxShadow: "var(--vid-shadow-panel)",
      ...(accent ? { borderTop: `3px solid ${accent}` } : {}),
      ...style,
    }}
  >
    {children}
  </div>
);

export const InsightFooter: React.FC<{
  children: React.ReactNode;
  wide: boolean;
  label?: string;
}> = ({ children, wide, label = "Broadcast read" }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "auto minmax(0,1fr)",
      gap: wide ? 18 : 16,
      alignItems: "start",
      padding: wide ? "14px 18px" : "16px 18px",
      borderRadius: 12,
      border: "1px solid var(--border-card)",
      background: "color-mix(in srgb, var(--surface-elevated) 92%, transparent)",
    }}
  >
    <div style={{ padding: "5px 9px", borderRadius: 5, background: "var(--accent)", color: "var(--text-on-accent)", fontWeight: 900, fontSize: wide ? 13 : 15, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</div>
    <div style={{ color: "var(--text-primary)", fontSize: wide ? 19 : 22, fontWeight: 650, lineHeight: 1.32 }}>{children}</div>
  </div>
);

export const DataLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontWeight: 850, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)" }}>{children}</span>
);
