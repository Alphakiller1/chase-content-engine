import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, StatusPill, TeamLogo } from "../ds/kit";
import { exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { BroadcastBackdrop, BroadcastHeader, BroadcastPanel, InsightFooter } from "./BroadcastChrome";
import { Count, Fit, Sheen } from "./live";
import type { QbFace } from "./QbMatchup";
import { ordinal, toneFromRank } from "./statColor";
import "../fonts";

export type StressStat = {
  value: number | null;
  display: string;
  rank: number | null;
  of: number;
};

export type StressRate = {
  display: string;
  rank: number | null;
};

export type StressRow = {
  label: string;
  offense: StressStat;
  defenseRate: StressRate;
  defense: StressStat;
};

export type StressSide = {
  quarterback: QbFace;
  defense: string;
  defenseName: string;
  projection: string;
  rows: StressRow[];
};

export type QbStressTestProps = {
  league: League;
  away: string;
  home: string;
  awayName: string;
  homeName: string;
  eyebrow: string;
  title: string;
  note: string;
  awaySide: StressSide;
  homeSide: StressSide;
};

const edgeFor = (row: StressRow) => {
  if (!row.offense.rank || !row.defense.rank) return { label: "No edge", tone: "var(--text-muted)" };
  const gap = row.defense.rank - row.offense.rank;
  if (gap >= 7) return { label: "QB edge", tone: "var(--mark-positive)" };
  if (gap <= -7) return { label: "DEF edge", tone: "var(--mark-negative)" };
  return { label: "Toss-up", tone: "var(--mark-caution)" };
};

const rankLabel = (rank: number | null, suffix = "NFL") => (rank ? `${ordinal(rank)} ${suffix}` : "No rank");

/**
 * The matchup board the reference examples imply: one quarterback, the four
 * stress looks that change his day, and the opposing defense on the same row.
 * It keeps frequency separate from performance so a common look is not mistaken
 * for a good one.
 */
export const QbStressTest: React.FC<QbStressTestProps> = ({
  league,
  away,
  home,
  awayName,
  homeName,
  eyebrow,
  title,
  note,
  awaySide,
  homeSide,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);

  const board = (side: StressSide, index: number) => {
    const qb = side.quarterback;
    const accent = teamAccent(qb.team, league);
    const defenseAccent = teamAccent(side.defense, league);
    const at = 0.12 + index * 0.1;
    const portraitSize = wide ? 94 : 104;

    return (
      <BroadcastPanel
        key={qb.team}
        accent={accent}
        style={{
          minWidth: 0,
          height: "100%",
          padding: wide ? "20px 22px 18px" : "22px 24px 20px",
          ...rise(frame, fps, at, 24),
        }}
      >
        <Sheen period={5.5} delay={1.1 + index * 0.35} opacity={0.08} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${portraitSize}px minmax(0,1fr) auto`,
            gap: wide ? 16 : 18,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: portraitSize,
              height: portraitSize,
              overflow: "hidden",
              position: "relative",
              borderRadius: "50%",
              background: "var(--surface-card)",
              boxShadow: "none",
            }}
          >
            {qb.headshot ? (
              <Img
                src={staticFile(qb.headshot)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900 }}>
                QB
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <Caps size={wide ? 14 : 16} color={accent}>{qb.team} passing offense</Caps>
            <div style={{ marginTop: 3, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: wide ? 32 : 38, lineHeight: 1, color: "var(--text-primary)" }}>
              {qb.name}
            </div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <StatusPill status={qb.status || "Active"} size={wide ? 13 : 15} />
              {side.projection ? <Caps size={wide ? 13 : 15}>{side.projection}</Caps> : null}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "right" }}>
            <div>
              <Caps size={wide ? 12 : 14}>tested by</Caps>
              <div style={{ marginTop: 4, fontWeight: 900, fontSize: wide ? 18 : 21, color: defenseAccent }}>{side.defense} defense</div>
            </div>
            <TeamLogo team={side.defense} league={league} size={wide ? 54 : 62} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: wide ? "1.1fr .88fr .9fr .92fr" : "1.12fr .84fr .9fr .94fr",
            gap: 10,
            marginTop: wide ? 16 : 18,
            padding: "9px 11px",
            borderRadius: 8,
            background: "var(--surface-inset)",
          }}
        >
          <Caps size={wide ? 12 : 14}>Stress look</Caps>
          <Caps size={wide ? 12 : 14} style={{ textAlign: "right" }}>Pass EPA</Caps>
          <Caps size={wide ? 12 : 14} style={{ textAlign: "right" }}>{side.defense} use</Caps>
          <Caps size={wide ? 12 : 14} style={{ textAlign: "right" }}>EPA allowed</Caps>
        </div>

        <div style={{ marginTop: 2 }}>
          {side.rows.map((row, rowIndex) => {
            const edge = edgeFor(row);
            const offTone = toneFromRank(row.offense.rank, row.offense.of);
            const defTone = toneFromRank(row.defense.rank, row.defense.of);
            const freqWidth = Math.max(8, Math.min(100, Number.parseFloat(row.defenseRate.display) || 0));
            return (
              <div
                key={row.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: wide ? "1.1fr .88fr .9fr .92fr" : "1.12fr .84fr .9fr .94fr",
                  gap: 10,
                  alignItems: "center",
                  minHeight: wide ? 66 : 72,
                  padding: "8px 11px",
                  borderTop: rowIndex ? "1px solid var(--border-card)" : undefined,
                  borderLeft: `3px solid ${edge.tone}`,
                  opacity: progress(frame, fps, stagger(rowIndex, at + 0.18, 0.06), 0.32),
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: wide ? 18 : 21, lineHeight: 1.05 }}>{row.label}</div>
                  <div style={{ marginTop: 5, fontWeight: 900, fontSize: wide ? 11 : 13, letterSpacing: "0.08em", textTransform: "uppercase", color: edge.tone }}>{edge.label}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: wide ? 27 : 31, lineHeight: 1, color: offTone }}>
                    <Count text={row.offense.display} at={at + 0.16 + rowIndex * 0.05} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: wide ? 11 : 13, fontWeight: 850, color: toneFromRank(row.offense.rank, row.offense.of) }}>
                    {rankLabel(row.offense.rank)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: wide ? 25 : 29, lineHeight: 1 }}>
                    <Count text={row.defenseRate.display} at={at + 0.18 + rowIndex * 0.05} />
                  </div>
                  <div style={{ height: 4, marginTop: 6, marginLeft: "auto", maxWidth: 92, borderRadius: 4, overflow: "hidden", background: "var(--border-card)" }}>
                    <div style={{ width: `${freqWidth}%`, height: "100%", marginLeft: "auto", background: defenseAccent }} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: wide ? 11 : 13, fontWeight: 850, color: "var(--text-secondary)" }}>
                    {rankLabel(row.defenseRate.rank, "most")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: wide ? 27 : 31, lineHeight: 1, color: defTone }}>
                    <Count text={row.defense.display} at={at + 0.2 + rowIndex * 0.05} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: wide ? 11 : 13, fontWeight: 850, color: toneFromRank(row.defense.rank, row.defense.of) }}>
                    {rankLabel(row.defense.rank)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </BroadcastPanel>
    );
  };

  return (
    <AbsoluteFill
      name="QB Stress Test"
      style={{
        background: "var(--surface-page)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 36 : 44),
        paddingBottom: safe.bottom + 22,
        paddingLeft: wide ? 82 : 48,
        paddingRight: wide ? 82 : 48,
        opacity: exit,
      }}
    >
      <BroadcastBackdrop league={league} away={away} home={home} />
      <Fit>
        <div style={rise(frame, fps, 0)}>
          <BroadcastHeader
            league={league}
            away={away}
            home={home}
            awayName={awayName}
            homeName={homeName}
            eyebrow={eyebrow}
            title={title}
            meta="Passing offense vs the coverage and pressure it will actually see"
            wide={wide}
            showLogos={false}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
            gridTemplateRows: wide ? "minmax(0,1fr)" : "repeat(2, minmax(0,1fr))",
            gap: wide ? 22 : 18,
            marginTop: wide ? 24 : 26,
            minHeight: 0,
            flex: 1,
          }}
        >
          {board(awaySide, 0)}
          {board(homeSide, 1)}
        </div>
        {note ? (
          <div style={{ marginTop: wide ? 18 : 20, opacity: progress(frame, fps, 1, 0.35) }}>
            <InsightFooter wide={wide} label="Matchup key">{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
