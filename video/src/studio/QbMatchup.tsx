import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, StatusPill, TeamLogo } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent, teamColors } from "../teams";
import { Count, Fit, Sheen } from "./live";
import { toneFromPair } from "./statColor";
import { BroadcastBackdrop, BroadcastHeader, InsightFooter } from "./BroadcastChrome";
import "../fonts";

export type QbFace = {
  name: string;
  team: string;
  teamName: string;
  headshot: string | null;
  status: string;
  detail: string;
  position?: string;
};

export type QbRow = {
  label: string;
  away: number;
  home: number;
  awayDisplay: string;
  homeDisplay: string;
  better: "high" | "low";
};

export type QbStart = {
  week: number;
  awayOpp: string;
  homeOpp: string;
  awayHome: boolean;
  homeHome: boolean;
  awayLine: string;
  homeLine: string;
  awayVal: number;
  homeVal: number;
};

export type QbMatchupProps = {
  league: League;
  away: string;
  home: string;
  eyebrow: string;
  title: string;
  note: string;
  awayQb: QbFace;
  homeQb: QbFace;
  rows: QbRow[];
  starts?: QbStart[];
};

const last = (n: string) => {
  const parts = n.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : n;
};
const first = (n: string) => n.split(" ")[0];

/**
 * Two skill starters face to face: this season's starts, a season aggregate,
 * and (for QBs) the model's next-game note. Same board for QB, WR and RB.
 */
export const QbMatchup: React.FC<QbMatchupProps> = ({
  league,
  eyebrow,
  title,
  note,
  awayQb,
  homeQb,
  rows,
  starts = [],
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const padX = wide ? 90 : 52;
  const inkA = teamAccent(awayQb.team, league);
  const inkH = teamAccent(homeQb.team, league);

  const portrait = (q: QbFace, ink: string, at: number) => {
    const { primary, secondary } = teamColors(q.team, league);
    const size = starts.length ? (wide ? 180 : 132) : wide ? 280 : 220;
    const inP = progress(frame, fps, at, 0.7);
    return (
      <div style={{ width: size, textAlign: "center", opacity: inP, translate: `0px ${(1 - inP) * 24}px` }}>
        <div
          style={{
            position: "relative",
            width: size,
            height: size,
            borderRadius: 28,
            overflow: "hidden",
            background: `linear-gradient(150deg, ${primary}, ${secondary})`,
            boxShadow: "0 24px 50px rgba(0,0,0,.45)",
          }}
        >
          <Sheen period={5} delay={1.4} opacity={0.12} />
          <div style={{ position: "absolute", right: -size * 0.2, bottom: -size * 0.22, opacity: 0.22 }}>
            <TeamLogo team={q.team} league={league} size={size * 0.85} />
          </div>
          {q.headshot ? (
            <Img
              src={staticFile(q.headshot)}
              style={{
                position: "absolute",
                left: size * 0.08,
                bottom: 0,
                width: size * 0.84,
                height: size * 0.84,
                objectFit: "cover",
                filter: "drop-shadow(0 16px 24px rgba(0,0,0,.45))",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: size * 0.22,
              }}
            >
              {q.position || "QB"}
            </div>
          )}
        </div>
        <Caps size={wide ? 20 : 22} color={ink} style={{ marginTop: 14 }}>
          {q.team} · {q.teamName.split(" ").slice(-1)[0]}
        </Caps>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
          fontSize: Math.round(size * 0.18),
            color: "var(--text-primary)",
            marginTop: 4,
          }}
        >
          {first(q.name)}
        </div>
        <div
          className="chrome"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: Math.round(size * 0.28),
            lineHeight: 0.95,
          }}
        >
          {last(q.name)}
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          <StatusPill status={q.status || "Active"} size={wide ? 18 : 20} />
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill
      name="QB Matchup"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 44 : 48),
        paddingBottom: safe.bottom + 24,
        paddingLeft: padX,
        paddingRight: padX,
        opacity: exit,
      }}
    >
      <BroadcastBackdrop league={league} away={awayQb.team} home={homeQb.team} />
      <Fit>
        <div style={rise(frame, fps, 0)}>
          <BroadcastHeader
            league={league}
            away={awayQb.team}
            home={homeQb.team}
            awayName={awayQb.teamName}
            homeName={homeQb.teamName}
            eyebrow={eyebrow}
            title={title}
            meta={`${awayQb.position || "QB"} comparison · season and recent starts`}
            wide={wide}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: wide ? 28 : 16,
            marginTop: wide ? 18 : 16,
            justifyItems: "center",
          }}
        >
          {portrait(awayQb, inkA, 0.15)}
          {portrait(homeQb, inkH, 0.22)}
        </div>

        {starts.length ? (
          <div style={{ marginTop: wide ? 16 : 14 }}>
            {starts.map((s, i) => {
              const at = stagger(i, 0.28, 0.07);
              const pair = toneFromPair(s.awayVal, s.homeVal, "high");
              const tag = (home: boolean, opp: string) => (opp ? `${home ? "vs" : "@"} ${opp}` : "");
              return (
                <div
                  key={s.week}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
                    columnGap: 10,
                    alignItems: "center",
                    padding: wide ? "8px 0" : "9px 0",
                    borderTop: "1px solid var(--border-card)",
                    ...rise(frame, fps, at, 8),
                  }}
                >
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: wide ? 24 : 22, color: pair.a, lineHeight: 1.2 }}>{s.awayLine}</div>
                    <Caps size={wide ? 15 : 16} color="var(--text-primary)">{tag(s.awayHome, s.awayOpp)}</Caps>
                  </div>
                  <Caps size={wide ? 18 : 20} color="var(--text-accent)">W{s.week}</Caps>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: wide ? 24 : 22, color: pair.b, lineHeight: 1.2 }}>{s.homeLine}</div>
                    <Caps size={wide ? 15 : 16} color="var(--text-primary)">{tag(s.homeHome, s.homeOpp)}</Caps>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={{ width: "100%", minWidth: 0, marginTop: starts.length ? 8 : 18 }}>
            {rows.map((r, i) => {
              const at = stagger(i, starts.length ? 0.45 : 0.35, 0.08);
              const grow = progress(frame, fps, at, 0.75, EASE_DRAW);
              const top = Math.max(Math.abs(r.away), Math.abs(r.home), 1e-9);
              const pair = toneFromPair(r.away, r.home, r.better);
              return (
                <div
                  key={r.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(92px,1fr) minmax(120px,1.5fr) minmax(92px,1fr)",
                    columnGap: 12,
                    alignItems: "center",
                    minHeight: wide ? 50 : 52,
                    borderTop: "1px solid var(--border-card)",
                    ...rise(frame, fps, at, 12),
                  }}
                >
                  <div
                    className="num"
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: wide ? 38 : 36,
                      color: pair.a,
                    }}
                  >
                    <Count text={r.awayDisplay} at={at} />
                  </div>
                  <div>
                    <Caps size={wide ? 18 : 20} color="var(--text-primary)" style={{ textAlign: "center", marginBottom: 6 }}>
                      {r.label}
                    </Caps>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, height: wide ? 14 : 16 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div
                          style={{
                            width: `${(Math.abs(r.away) / top) * 100 * grow}%`,
                            background: pair.a,
                            borderRadius: 99,
                          }}
                        />
                      </div>
                      <div>
                        <div
                          style={{
                            width: `${(Math.abs(r.home) / top) * 100 * grow}%`,
                            height: "100%",
                            background: pair.b,
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className="num"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: wide ? 38 : 36,
                      color: pair.b,
                    }}
                  >
                    <Count text={r.homeDisplay} at={at} />
                  </div>
                </div>
              );
            })}
        </div>
        {note ? (
          <div style={{ marginTop: 18, opacity: progress(frame, fps, 1.15, 0.4) }}>
            <InsightFooter wide={wide}>{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
