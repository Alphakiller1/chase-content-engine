import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { exitAt, progress, rise } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Count, Fit } from "./live";
import { ordinal, toneFromEpa, toneFromRank } from "./statColor";
import { BroadcastBackdrop, BroadcastHeader, InsightFooter } from "./BroadcastChrome";
import "../fonts";

type Stat = { value: number | null; display: string; rank: number | null; of: number; vsAvg?: string; label?: string };
type Lane = {
  id: string;
  title: string;
  hero: Stat;
  heroLabel: string;
  yards: { display: string; label: string } | null;
  offEpa: Stat;
  defEpa: Stat;
  context: Stat;
  contextOpp: Stat;
  contextLabel: string;
};

export type ClashBoardProps = {
  league: League;
  away: string;
  home: string;
  offense: string;
  defense: string;
  offenseName: string;
  defenseName: string;
  eyebrow: string;
  title: string;
  note: string;
  lanes: Lane[];
};

const Num: React.FC<{ text: string; rank: number | null; of: number; tone: string; at: number; align?: "left" | "right" }> = ({
  text,
  rank,
  tone,
  at,
  align = "right",
}) => (
  <div style={{ textAlign: align }}>
    <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, lineHeight: 1, color: tone }}>
      <Count text={text} at={at} />
    </div>
    <div style={{ marginTop: 3, fontWeight: 800, fontSize: 12, color: tone }}>{rank ? ordinal(rank) : "—"}</div>
  </div>
);

/**
 * When one club has the ball: success rate and yards up top, then a two-column
 * table of what the offense produces against what the defense allows.
 */
export const ClashBoard: React.FC<ClashBoardProps> = ({
  league,
  offense,
  defense,
  offenseName,
  defenseName,
  eyebrow,
  title,
  note,
  lanes,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const offInk = teamAccent(offense, league);
  const defInk = teamAccent(defense, league);

  return (
    <AbsoluteFill style={{ background: "var(--surface-page)", fontFamily: "var(--font-body)", opacity: exit, padding: `${safe.top + (wide ? 28 : 36)}px ${wide ? 56 : 40}px ${safe.bottom + 16}px` }}>
      <BroadcastBackdrop league={league} away={offense} home={defense} />
      <Fit>
        <div style={rise(frame, fps, 0)}>
          <BroadcastHeader
            league={league}
            away={offense}
            home={defense}
            awayName={offenseName}
            homeName={defenseName}
            eyebrow={eyebrow}
            title={title}
            meta="Success rate is the share of plays on schedule. Rank is 1st best in the 32-team pool."
            spine={`${offense} has the ball`}
            wide={wide}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: wide ? `repeat(${Math.max(lanes.length, 1)}, minmax(0,1fr))` : "1fr", gap: wide ? 28 : 18, marginTop: 8 }}>
          {lanes.map((lane, li) => {
            const heroTone = toneFromRank(lane.hero.rank, lane.hero.of);
            const pct = lane.hero.rank && lane.hero.of ? (lane.hero.of - lane.hero.rank + 1) / lane.hero.of : 0.2;
            const grow = progress(frame, fps, 0.2 + li * 0.08, 0.6);
            const rows = [
              { label: "EPA / play", a: lane.offEpa, b: lane.defEpa, epa: true, invertB: true },
              { label: lane.contextLabel, a: lane.context, b: lane.contextOpp, epa: false, invertB: true },
            ];
            return (
              <div key={lane.id} style={{ minWidth: 0, ...rise(frame, fps, 0.12 + li * 0.08) }}>
                <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-accent)" }}>{lane.title}</div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
                  <div>
                    <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 48 : 44, lineHeight: 0.95, color: heroTone }}>
                      <Count text={lane.hero.display} at={0.15 + li * 0.05} />
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 800, fontSize: 14, color: heroTone }}>{lane.hero.rank ? ordinal(lane.hero.rank) : "—"}</div>
                  </div>
                  {lane.yards ? (
                    <div style={{ textAlign: "right" }}>
                      <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: "var(--text-primary)" }}>{lane.yards.display}</div>
                      <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>{lane.yards.label}</div>
                    </div>
                  ) : null}
                </div>
                <div style={{ marginTop: 10, height: 8, borderRadius: 2, background: "var(--vid-track)", overflow: "hidden" }}>
                  <div style={{ width: `${pct * 100 * grow}%`, height: "100%", background: heroTone }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) 110px 110px", columnGap: 10, marginTop: 16, paddingBottom: 8, borderBottom: "1px solid var(--border-card)" }}>
                  <div />
                  <div style={{ textAlign: "right", fontWeight: 800, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: offInk }}>{offense}</div>
                  <div style={{ textAlign: "right", fontWeight: 800, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: defInk }}>{defense}</div>
                </div>
                {rows.map((r) => (
                  <div key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) 110px 110px", columnGap: 10, alignItems: "center", minHeight: 58, borderBottom: "1px solid var(--border-card)" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{r.label}</div>
                    <Num text={r.a.display} rank={r.a.rank} of={r.a.of} at={0.3} tone={r.epa ? toneFromEpa(r.a.value ?? 0) : toneFromRank(r.a.rank, r.a.of)} />
                    <Num text={r.b.display} rank={r.b.rank} of={r.b.of} at={0.34} tone={r.b.rank ? toneFromRank(r.b.rank, r.b.of) : toneFromEpa(r.b.value ?? 0, true)} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {note ? (
          <div style={{ marginTop: 14 }}>
            <InsightFooter wide={wide}>{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
