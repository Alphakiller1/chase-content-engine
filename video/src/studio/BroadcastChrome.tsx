import React from "react";
import { TeamLogo } from "../ds/kit";
import { League, teamAccent } from "../teams";

type BroadcastBackdropProps = {
  league: League;
  away: string;
  home: string;
};

/** Flat desk ground — the live MLB matchup cards, not a broadcast wash. */
export const BroadcastBackdrop: React.FC<BroadcastBackdropProps> = () => (
  <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--surface-page)", pointerEvents: "none" }} />
);

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
  showLogos?: boolean;
  showTeams?: boolean;
  spine?: string;
};

/** Site card header: title left, meta right, optional club marks on the columns. */
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
  showLogos = true,
  showTeams = true,
  spine,
}) => {
  const mark = (team: string, name: string | undefined, reverse = false) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: reverse ? "flex-end" : "flex-start",
        flexDirection: reverse ? "row-reverse" : "row",
        gap: 10,
        minWidth: 0,
      }}
    >
      {showLogos ? <TeamLogo team={team} league={league} size={wide ? 28 : 32} /> : null}
      <div style={{ minWidth: 0, textAlign: reverse ? "right" : "left" }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 750,
            fontSize: wide ? 16 : 17,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name || team}
        </div>
        <div style={{ fontWeight: 800, fontSize: wide ? 12 : 13, letterSpacing: "0.08em", color: teamAccent(team, league) }}>{team}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: wide ? 28 : 16 }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow ? (
            <div
              style={{
                fontWeight: 800,
                fontSize: wide ? 12 : 13,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--text-accent)",
                marginBottom: 8,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: wide ? 36 : 32,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </div>
        </div>
        {meta ? (
          <div
            style={{
              flexShrink: 0,
              maxWidth: wide ? "34%" : "40%",
              textAlign: "right",
              fontWeight: 650,
              fontSize: wide ? 13 : 14,
              lineHeight: 1.35,
              color: "var(--text-muted)",
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>
      {showTeams ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: wide ? "minmax(0,1fr) auto minmax(0,1fr)" : "1fr auto 1fr",
            alignItems: "center",
            gap: 16,
            marginTop: wide ? 18 : 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border-card)",
          }}
        >
          {mark(away, awayName)}
          <div
            style={{
              fontWeight: 800,
              fontSize: wide ? 11 : 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "0 12px",
            }}
          >
            {spine || ""}
          </div>
          {mark(home, homeName, true)}
        </div>
      ) : (
        <div style={{ marginTop: 12, borderBottom: "1px solid var(--border-card)" }} />
      )}
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
      background: "var(--surface-card)",
      border: "1px solid var(--border-card)",
      borderRadius: 10,
      boxShadow: "var(--elevation-card)",
      ...(accent ? { borderTop: `2px solid ${accent}` } : {}),
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
}> = ({ children, wide }) => (
  <div
    style={{
      marginTop: 4,
      fontWeight: 650,
      fontSize: wide ? 13 : 14,
      lineHeight: 1.4,
      color: "var(--text-muted)",
    }}
  >
    {children}
  </div>
);

export const DataLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{children}</span>
);
