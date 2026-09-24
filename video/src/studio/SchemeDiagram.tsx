import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, TeamLogo } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Count, Fit } from "./live";
import { toneFromRank } from "./statColor";
import { BroadcastBackdrop, BroadcastHeader, InsightFooter } from "./BroadcastChrome";
import "../fonts";

export type PersonnelShare = { code: string; label: string; rate: number };
export type SchemeLook = {
  team: string;
  teamName: string;
  shell: string;
  shellRate: string;
  shotgun: string;
  motion: string;
  blitz: string;
  personnel: PersonnelShare[];
  dots: { x: number; y: number; role: string }[];
};

export type SchemeDiagramProps = {
  league: League;
  away: string;
  home: string;
  awayName: string;
  homeName: string;
  eyebrow: string;
  title: string;
  note: string;
  view: "coverage" | "personnel";
  awayLook: SchemeLook;
  homeLook: SchemeLook;
};

/**
 * Illustrated scheme: a mini field of coverage shells or personnel packages,
 * plus the rates that decide what is drawn, so "Cover 3" is a picture not a row.
 */
export const SchemeDiagram: React.FC<SchemeDiagramProps> = ({
  league,
  eyebrow,
  title,
  note,
  view,
  awayLook,
  homeLook,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const draw = progress(frame, fps, 0.35, 1.0, EASE_DRAW);
  const titleBlock = wide ? 140 : 150;
  const clubHead = wide ? 78 : 86;
  const tiles = wide ? 100 : 108;
  const noteH = note ? (wide ? 56 : 100) : 0;
  const stackGap = wide ? 36 : 20;
  const room = height - safe.top - safe.bottom - titleBlock - noteH - (wide ? 48 : 36);
  const fh = wide
    ? Math.max(260, Math.min(360, room - clubHead - tiles - 24))
    : Math.max(200, Math.min(280, (room - stackGap) / 2 - clubHead - tiles));
  const dot = wide ? 16 : 18;
  const roleSize = wide ? 13 : 14;

  const field = (look: SchemeLook, at: number) => {
    const ink = teamAccent(look.team, league);
    const inP = progress(frame, fps, at, 0.6);
    return (
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", ...rise(frame, fps, at, 18) }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12, minHeight: clubHead }}>
          <TeamLogo team={look.team} league={league} size={28} />
          <div style={{ minWidth: 0 }}>
            <Caps size={wide ? 18 : 20} color={ink}>
              {look.team}
            </Caps>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: wide ? 22 : 20,
                color: "var(--text-primary)",
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {look.teamName.split(" ").slice(-1)[0]}
            </div>
            <div className="num" style={{ marginTop: 6, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 30 : 28, color: toneFromRank(null, 32, "rate") }}>
              {view === "coverage" ? look.shell : look.personnel[0]?.code ?? "11"}
              <span style={{ color: "var(--text-primary)", fontSize: wide ? 26 : 24, marginLeft: 8, fontWeight: 800 }}>
                <Count text={view === "coverage" ? look.shellRate : `${Math.round((look.personnel[0]?.rate ?? 0) * 100)}%`} at={at + 0.2} />
              </span>
            </div>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: fh,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--border-card)",
            background: "var(--surface-card)",
            opacity: inP,
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 62" preserveAspectRatio="none">
            {Array.from({ length: 6 }, (_, k) => (
              <line key={k} x1={0} x2={100} y1={8 + k * 10} y2={8 + k * 10} stroke="var(--border-card)" strokeWidth={0.4} />
            ))}
            <line x1={8} x2={92} y1={52} y2={52} stroke={ink} strokeWidth={1.1} strokeLinecap="round" opacity={draw} />
          </svg>
          {look.dots.map((d, i) => {
            const delay = at + 0.15 + i * 0.04;
            const p = progress(frame, fps, delay, 0.35);
            return (
              <div
                key={`${d.role}-${i}`}
                style={{
                  position: "absolute",
                  left: `${d.x}%`,
                  top: `${(d.y / 62) * 100}%`,
                  transform: "translate(-50%, -42%)",
                  textAlign: "center",
                  opacity: p,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: "50%",
                    background: ink,
                    margin: "0 auto",
                    boxShadow: "0 2px 10px rgba(0,0,0,.55)",
                    border: "2px solid rgba(255,255,255,.35)",
                  }}
                />
                <div
                  style={{
                    marginTop: 3,
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: roleSize,
                    lineHeight: 1,
                    color: "#fff",
                    letterSpacing: "0.04em",
                    textShadow: "0 1px 2px #000, 0 0 8px rgba(0,0,0,.85)",
                  }}
                >
                  {d.role}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginTop: 12 }}>
          {(view === "coverage"
            ? [
                { k: "Shotgun faced", v: look.shotgun },
                { k: "Motion faced", v: look.motion },
                { k: "Blitz", v: look.blitz },
              ]
            : look.personnel.slice(0, 3).map((p) => ({ k: p.label, v: `${Math.round(p.rate * 100)}%` }))
          ).map((t) => (
            <div
              key={t.k}
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-card)",
                borderRadius: 12,
                padding: wide ? "12px 14px" : "14px 14px",
                minHeight: wide ? 88 : 92,
              }}
            >
              <Caps size={wide ? 16 : 18} color="var(--text-primary)" style={{ opacity: 0.78 }}>
                {t.k}
              </Caps>
              <div
                className="num"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: wide ? 30 : 32,
                  color: toneFromRank(null, 32, "rate"),
                  lineHeight: 1.15,
                  marginTop: 4,
                }}
              >
                {t.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill
      name="Scheme Diagram"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 28 : 36),
        paddingBottom: safe.bottom + 18,
        paddingLeft: wide ? 56 : 40,
        paddingRight: wide ? 56 : 40,
        opacity: exit,
      }}
    >
      <BroadcastBackdrop league={league} away={awayLook.team} home={homeLook.team} />
      <Fit min={0.88}>
        <div style={rise(frame, fps, 0)}>
          <BroadcastHeader
            league={league}
            away={awayLook.team}
            home={homeLook.team}
            awayName={awayLook.teamName}
            homeName={homeLook.teamName}
            eyebrow={eyebrow}
            title={title}
            meta={`${view === "coverage" ? "Coverage structure" : "Personnel usage"} · illustrative alignment`}
            wide={wide}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: wide ? 36 : 28, marginTop: 22, alignItems: "stretch" }}>
          {field(awayLook, 0.12)}
          {field(homeLook, 0.2)}
        </div>
        {note ? (
          <div style={{ marginTop: 16, opacity: progress(frame, fps, 1.1, 0.4) }}>
            <InsightFooter wide={wide} label="Illustration">{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
