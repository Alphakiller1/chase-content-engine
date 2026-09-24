import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TeamLogo } from "../ds/kit";
import { exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Fit } from "./live";
import { toneFromGap, toneFromRank, type StatCat } from "./statColor";
import "../fonts";

export type PlayerCardProps = {
  league: League;
  team: string;
  teamName: string;
  name: string;
  position: string;
  role: string;
  headshot: string | null;
  status: string;
  detail: string;
  stats: { label: string; value: string }[];
  statsLabel: string;
  props?: { label: string; line: number; open: number | null; model: number }[];
  eyebrow: string;
};

/**
 * Player board in the live MLB probable-starter layout: circle headshot, name,
 * four headline numbers, then a splits / props table.
 */
export const PlayerCard: React.FC<PlayerCardProps> = ({
  league,
  team,
  teamName,
  name,
  position,
  role,
  headshot,
  status,
  detail,
  stats,
  statsLabel,
  props = [],
  eyebrow,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const ink = teamAccent(team, league);
  const face = wide ? 92 : 108;
  const flagged = status && status.toLowerCase() !== "active";
  const headlines = (stats.length ? stats : props.map((p) => ({ label: p.label, value: String(p.line) }))).slice(0, 4);

  return (
    <AbsoluteFill
      name="Player Card"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 28 : 36),
        paddingBottom: safe.bottom + 18,
        paddingLeft: wide ? 56 : 40,
        paddingRight: wide ? 56 : Math.max(40, safe.right),
        opacity: exit,
      }}
    >
      <Fit>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", ...rise(frame, fps, 0) }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 36 : 32, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            {eyebrow || "Probable Starters"}
          </div>
          <div style={{ fontWeight: 650, fontSize: 13, color: "var(--text-muted)" }}>{teamName}</div>
        </div>
        <div style={{ height: 1, background: "var(--border-card)", marginTop: 12 }} />

        <div style={{ display: "flex", gap: wide ? 22 : 18, alignItems: "center", marginTop: wide ? 22 : 20, ...rise(frame, fps, 0.08) }}>
          {headshot ? (
            <Img src={staticFile(headshot)} style={{ width: face, height: face, borderRadius: "50%", objectFit: "cover", background: "var(--surface-card)" }} />
          ) : (
            <div style={{ width: face, height: face, borderRadius: "50%", background: "var(--surface-card)", display: "grid", placeItems: "center" }}>
              <TeamLogo team={team} league={league} size={face * 0.55} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: ink }}>
              {teamName} · {role || position}
              {flagged ? ` · ${status}` : ""}
            </div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 40 : 36, letterSpacing: "-0.03em", lineHeight: 1.05, color: "var(--text-primary)" }}>
              {name}
            </div>
            {detail ? <div style={{ marginTop: 8, fontSize: 14, fontWeight: 650, color: "var(--text-muted)" }}>{detail}</div> : null}
          </div>
        </div>

        {headlines.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(4, headlines.length)}, minmax(0,1fr))`,
              gap: 8,
              marginTop: wide ? 22 : 20,
              ...rise(frame, fps, 0.16),
            }}
          >
            {headlines.map((s, i) => {
              const cat: StatCat = /epa|woba|osi|grade|score/i.test(s.label) ? "quality" : /%|rate/i.test(s.label) ? "rate" : "count";
              return (
                <div key={s.label} style={{ padding: "10px 4px 4px 0" }}>
                  <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{s.label}</div>
                  <div className="num" style={{ marginTop: 6, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 36 : 34, color: toneFromRank(null, 32, cat), lineHeight: 1 }}>
                    {s.value}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {props.length ? (
          <div style={{ marginTop: wide ? 18 : 16, ...rise(frame, fps, 0.24) }}>
            <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Splits</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.4fr) 120px 120px 120px",
                columnGap: 12,
                paddingBottom: 8,
                borderBottom: "1px solid var(--border-card)",
              }}
            >
              {["Market", "Line", "Open", "Model"].map((h) => (
                <div key={h} style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: h === "Market" ? "left" : "right" }}>
                  {h}
                </div>
              ))}
            </div>
            {(wide ? props : props.slice(0, 5)).map((pr, i) => {
              const gap = pr.line ? (pr.model - pr.line) / pr.line : 0;
              return (
                <div
                  key={pr.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1.4fr) 120px 120px 120px",
                    columnGap: 12,
                    alignItems: "center",
                    minHeight: 46,
                    borderBottom: "1px solid var(--border-card)",
                    ...rise(frame, fps, stagger(i, 0.3, 0.05)),
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{pr.label}</div>
                  <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "var(--text-primary)" }}>
                    {pr.line}
                  </div>
                  <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--text-muted)" }}>
                    {pr.open ?? "—"}
                  </div>
                  <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: toneFromGap(gap) }}>
                    {pr.model >= 10 ? pr.model.toFixed(1) : pr.model.toFixed(2)}
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>{statsLabel || "Model is research only and does not price props"}</div>
          </div>
        ) : stats.length > 4 ? (
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {stats.slice(4).map((s, i) => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-card)", ...rise(frame, fps, stagger(i, 0.3, 0.05)) }}>
                <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>{s.label}</span>
                <span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "var(--text-primary)" }}>{s.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
