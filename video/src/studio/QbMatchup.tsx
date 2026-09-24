import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, TeamLogo } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Count, Fit } from "./live";
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
  const inkA = teamAccent(awayQb.team, league);
  const inkH = teamAccent(homeQb.team, league);

  const portrait = (q: QbFace, ink: string, at: number) => {
    const size = wide ? 88 : 96;
    const inP = progress(frame, fps, at, 0.55);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, opacity: inP }}>
        {q.headshot ? (
          <Img src={staticFile(q.headshot)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", background: "var(--surface-card)", flexShrink: 0 }} />
        ) : (
          <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--surface-card)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <TeamLogo team={q.team} league={league} size={size * 0.5} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: ink }}>
            {q.teamName} · {q.position || "QB"}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 28 : 26, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.1 }}>
            {q.name}
          </div>
          {q.detail ? <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>{q.detail}</div> : null}
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
        paddingTop: safe.top + (wide ? 28 : 36),
        paddingBottom: safe.bottom + 18,
        paddingLeft: wide ? 56 : 40,
        paddingRight: wide ? 56 : 40,
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
            justifyItems: "stretch",
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
                      fontSize: wide ? 26 : 24,
                      color: pair.a,
                    }}
                  >
                    <Count text={r.awayDisplay} at={at} />
                  </div>
                  <div>
                    <Caps size={wide ? 18 : 20} color="var(--text-primary)" style={{ textAlign: "center", marginBottom: 6 }}>
                      {r.label}
                    </Caps>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, height: 8 }}>
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
                      fontSize: wide ? 26 : 24,
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
