import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, TeamLogo } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Count, Fit, Sheen } from "./live";
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

/**
 * One-screen club card: identity, rest/travel, power rating, unit EPA and the
 * projected score, so the booth can open on more than a matchup bug.
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
  const padX = wide ? 90 : 52;

  const of = awaySide.rankOf || homeSide.rankOf || 32;
  const scorePair = toneFromPair(parseStat(awaySide.score), parseStat(homeSide.score), "high");

  const club = (s: TeamSide, i: number) => {
    const ink = teamAccent(s.abbr, league);
    const at = stagger(i, 0.12, 0.18);
    const grow = progress(frame, fps, at + 0.2, 0.8, EASE_DRAW);
    const power = toneFromRank(s.rank, of, "quality");
    const tiles = [
      { k: "Record", v: s.record || "—", rank: null as number | null, c: toneFromRank(null, of, "identity") },
      { k: "Rest", v: s.rest || "—", rank: null, c: toneFromRank(null, of, "count") },
      { k: "Off. EPA", v: s.offEpa, rank: s.offEpaRank ?? null, c: toneFromRank(s.offEpaRank ?? null, of, "quality") },
      { k: "Def. EPA", v: s.defEpa, rank: s.defEpaRank ?? null, c: toneFromRank(s.defEpaRank ?? null, of, "quality", true) },
    ];
    return (
      <div
        style={{
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-card)",
          border: "1px solid var(--border-card)",
          borderRadius: 22,
          padding: wide ? "28px 30px" : "24px 26px",
          position: "relative",
          overflow: "hidden",
          ...rise(frame, fps, at, 22),
        }}
      >
        <Sheen period={5.5} delay={1.2 + i * 0.4} opacity={0.1} />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <TeamLogo team={s.abbr} league={league} size={wide ? 92 : 88} />
          <div style={{ minWidth: 0 }}>
            <Caps size={wide ? 20 : 22} color={ink}>
              {s.abbr}
              {s.rank ? ` · #${s.rank}` : ""}
            </Caps>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: wide ? 44 : 40,
                lineHeight: 1.05,
                color: "var(--text-primary)",
              }}
            >
              {s.name.split(" ").slice(-1)[0]}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <Caps size={wide ? 18 : 20}>Power</Caps>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: wide ? 52 : 48,
                color: power,
              }}
            >
              <Count text={s.rating} at={at + 0.25} />
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 18,
            height: 4,
            borderRadius: 99,
            background: `color-mix(in srgb, ${ink} 70%, transparent)`,
            width: `${grow * 100}%`,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: wide ? 14 : 12,
            marginTop: 20,
            flex: 1,
          }}
        >
          {tiles.map((t) => (
            <div key={t.k} style={{ minHeight: wide ? 72 : 68 }}>
              <Caps size={wide ? 16 : 18}>{t.k}</Caps>
              <div
                className="num"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: wide ? 32 : 30,
                  color: t.c,
                  lineHeight: 1.1,
                }}
              >
                {t.v}
                {t.rank ? (
                  <span style={{ marginLeft: 8, fontSize: wide ? 22 : 20, fontWeight: 800 }}>{ordinal(t.rank)}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <Caps size={wide ? 17 : 19} style={{ marginTop: 16, textTransform: "none", letterSpacing: 0 }}>
          {s.travel || "No travel listed"}
        </Caps>
        <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 10 }}>
          <Caps size={wide ? 18 : 20}>Proj. score</Caps>
          <div
            className="num"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: wide ? 56 : 52,
              lineHeight: 1,
              color: i === 0 ? scorePair.a : scorePair.b,
            }}
          >
            <Count text={s.score} at={at + 0.4} />
          </div>
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
        paddingTop: safe.top + (wide ? 48 : 52),
        paddingBottom: safe.bottom + 28,
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
            meta={[kickoff, network].filter(Boolean).join(" · ")}
            wide={wide}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
            gap: wide ? 28 : 20,
            marginTop: wide ? 28 : 26,
            alignItems: "stretch",
          }}
        >
          {club(awaySide, 0)}
          {club(homeSide, 1)}
        </div>
        <div
          style={{
            marginTop: wide ? 22 : 20,
            display: "flex",
            gap: 18,
            justifyContent: "center",
            flexWrap: "wrap",
            ...rise(frame, fps, 0.55),
          }}
        >
          {[
            { k: "Spread", v: spread },
            { k: "Total", v: total },
            { k: "Model", v: modelLine },
          ]
            .filter((x) => x.v)
            .map((x) => (
              <div
                key={x.k}
                style={{
                  border: "1px solid var(--border-card)",
                  borderRadius: 999,
                  padding: "10px 22px",
                  background: "var(--surface-card)",
                }}
              >
                <Caps size={wide ? 17 : 20} style={{ display: "inline", marginRight: 10 }}>
                  {x.k}
                </Caps>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 28 : 30, color: "var(--text-accent)" }}>
                  {x.v}
                </span>
              </div>
            ))}
        </div>
        {note ? (
          <div style={{ marginTop: 16, opacity: progress(frame, fps, 1.1, 0.4) }}>
            <InsightFooter wide={wide}>{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
