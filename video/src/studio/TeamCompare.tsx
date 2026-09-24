import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { TeamLogo } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Count, Fit } from "./live";
import { ordinal, parseStat, toneFromPair, toneFromRank } from "./statColor";
import { BroadcastBackdrop, BroadcastHeader, InsightFooter } from "./BroadcastChrome";
import "../fonts";

export type TeamSide = {
  abbr: string;
  name: string;
  record: string;
  rating: string;
  rank: number | null;
  rest: string;
  travel: string;
  offEpa: string;
  defEpa: string;
  score: string;
  rankOf?: number;
  offEpaRank?: number | null;
  defEpaRank?: number | null;
};

export type TeamCompareProps = {
  league: League;
  away: string;
  home: string;
  awayName: string;
  homeName: string;
  eyebrow: string;
  title: string;
  note: string;
  kickoff: string;
  network: string;
  spread: string;
  total: string;
  modelLine: string;
  awaySide: TeamSide;
  homeSide: TeamSide;
};

const recordMarks = (record: string) => {
  const m = String(record).match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return [];
  return [...Array(Number(m[1])).fill("W"), ...Array(Number(m[2])).fill("L")].slice(0, 10);
};

/**
 * Two clubs as the live MLB last-ten card: identity, record marks, power and EPA.
 */
export const TeamCompare: React.FC<TeamCompareProps> = ({
  league,
  eyebrow,
  title,
  note,
  kickoff,
  network,
  spread,
  total,
  modelLine,
  awaySide,
  homeSide,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const padX = wide ? 56 : 40;
  const of = awaySide.rankOf || homeSide.rankOf || 32;
  const scorePair = toneFromPair(parseStat(awaySide.score), parseStat(homeSide.score), "high");

  const club = (s: TeamSide, i: number) => {
    const ink = teamAccent(s.abbr, league);
    const at = stagger(i, 0.1, 0.12);
    const grow = progress(frame, fps, at + 0.15, 0.7, EASE_DRAW);
    const power = toneFromRank(s.rank, of, "quality");
    const marks = recordMarks(s.record);
    const stats = [
      { k: "Power", v: s.rating, r: s.rank, c: power },
      { k: "Off. EPA", v: s.offEpa, r: s.offEpaRank ?? null, c: toneFromRank(s.offEpaRank ?? null, of, "quality") },
      { k: "Def. EPA", v: s.defEpa, r: s.defEpaRank ?? null, c: toneFromRank(s.defEpaRank ?? null, of, "quality") },
      { k: "Proj", v: s.score, r: null, c: i === 0 ? scorePair.a : scorePair.b },
    ];
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: wide ? "220px minmax(120px,0.7fr) minmax(0,1.6fr) auto" : "1fr",
          gap: wide ? 22 : 14,
          alignItems: "center",
          padding: wide ? "22px 0" : "18px 0",
          borderTop: i ? "1px solid var(--border-card)" : undefined,
          ...rise(frame, fps, at, 10),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <TeamLogo team={s.abbr} league={league} size={wide ? 36 : 40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-body)", fontWeight: 750, fontSize: wide ? 18 : 20, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.name}
            </div>
            <div style={{ marginTop: 3, fontWeight: 800, fontSize: 13, color: ink }}>
              {s.abbr} · {s.record || "—"}
              {s.rank ? ` · ${ordinal(s.rank)}` : ""}
            </div>
          </div>
        </div>
        <div>
          <div style={{ height: 8, borderRadius: 2, background: "var(--vid-track)", overflow: "hidden" }}>
            <div style={{ width: `${grow * (s.rank && of ? ((of - s.rank + 1) / of) * 100 : 50)}%`, height: "100%", background: power, borderRadius: 2 }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{s.rest || s.travel || " "}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))`, gap: 10 }}>
          {stats.map((t) => (
            <div key={t.k} style={{ textAlign: wide ? "right" : "left" }}>
              <div style={{ fontWeight: 800, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{t.k}</div>
              <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 22 : 24, color: t.c, lineHeight: 1.15 }}>
                <Count text={t.v} at={at + 0.2} />
                {t.r ? <span style={{ marginLeft: 6, fontSize: 13 }}>{ordinal(t.r)}</span> : null}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, justifyContent: wide ? "flex-end" : "flex-start", flexWrap: "wrap" }}>
          {marks.length
            ? marks.map((m, k) => (
                <div
                  key={`${m}-${k}`}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 3,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: 11,
                    color: m === "W" ? "var(--mark-positive)" : "var(--mark-negative)",
                    background: m === "W" ? "color-mix(in srgb, var(--mark-positive) 16%, transparent)" : "color-mix(in srgb, var(--mark-negative) 16%, transparent)",
                    border: `1px solid ${m === "W" ? "color-mix(in srgb, var(--mark-positive) 45%, transparent)" : "color-mix(in srgb, var(--mark-negative) 45%, transparent)"}`,
                  }}
                >
                  {m}
                </div>
              ))
            : null}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill
      name="Team Compare"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 28 : 36),
        paddingBottom: safe.bottom + 18,
        paddingLeft: padX,
        paddingRight: padX,
        opacity: exit,
      }}
    >
      <BroadcastBackdrop league={league} away={awaySide.abbr} home={homeSide.abbr} />
      <Fit>
        <div style={rise(frame, fps, 0)}>
          <BroadcastHeader
            league={league}
            away={awaySide.abbr}
            home={homeSide.abbr}
            awayName={awaySide.name}
            homeName={homeSide.name}
            eyebrow={eyebrow}
            title={title}
            meta={[kickoff, network, "What each club has actually been doing"].filter(Boolean).join(" · ")}
            wide={wide}
            showTeams={false}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          {club(awaySide, 0)}
          {club(homeSide, 1)}
        </div>
        <div
          style={{
            marginTop: wide ? 18 : 16,
            display: "grid",
            gridTemplateColumns: wide ? "repeat(3, minmax(0,1fr))" : "1fr",
            gap: 10,
            ...rise(frame, fps, 0.45),
          }}
        >
          {[
            { k: "Spread", v: spread },
            { k: "Total", v: total },
            { k: "Model", v: modelLine },
          ]
            .filter((x) => x.v)
            .map((x) => (
              <div key={x.k} style={{ padding: "12px 14px", background: "var(--surface-card)", border: "1px solid var(--border-card)", borderRadius: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{x.k}</div>
                <div style={{ marginTop: 4, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 22 : 24, color: "var(--text-primary)" }}>{x.v}</div>
              </div>
            ))}
        </div>
        {note ? (
          <div style={{ marginTop: 12 }}>
            <InsightFooter wide={wide}>{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
