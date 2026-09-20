import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, TeamLogo, Title } from "../ds/kit";
import { exitAt, progress } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League } from "../teams";
import { Count } from "./live";
import { ordinal, toneFromEpa, toneFromRank } from "./statColor";
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

const rankText = (rank: number | null, of = 32) => (rank ? `${ordinal(rank)} of ${of}` : "—");

const Cell: React.FC<{
  stat: Stat;
  invert?: boolean;
  epa?: boolean;
  align?: "left" | "right";
}> = ({ stat, invert, epa, align = "left" }) => {
  const tone = epa
    ? toneFromEpa(stat.value ?? 0, Boolean(invert))
    : toneFromRank(stat.rank, stat.of, "quality", invert);
  return (
    <div style={{ textAlign: align }}>
      <div className="num" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: tone }}>
        {stat.display}
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, color: tone, marginTop: 6 }}>{rankText(stat.rank, stat.of)}</div>
    </div>
  );
};

export const ClashBoard: React.FC<ClashBoardProps> = ({
  league,
  offense,
  defense,
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
  const enter = progress(frame, fps, 0.05, 0.4);

  return (
    <AbsoluteFill style={{ background: "var(--surface-page)", color: "var(--text-primary)", opacity: exit }}>
      <div
        style={{
          padding: `${safe.top}px ${wide ? 48 : 36}px ${safe.bottom}px`,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Eyebrow size={wide ? 22 : 24}>{eyebrow}</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 8 }}>
          <Title size={wide ? 52 : 56}>{title}</Title>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <TeamLogo league={league} team={offense} size={52} />
            <Caps size={16} color="var(--text-muted)">on</Caps>
            <TeamLogo league={league} team={defense} size={52} />
          </div>
        </div>
        <Deck size={wide ? 22 : 24} style={{ marginTop: 10, maxWidth: 980 }}>
          Success rate is the percent of plays that stay on schedule, with NFL rank. Pass success rate is the same split on throws.
        </Deck>

        <div
          style={{
            display: "flex",
            flexDirection: wide ? "row" : "column",
            gap: wide ? 28 : 22,
            marginTop: 22,
            flex: 1,
            minHeight: 0,
            opacity: enter,
          }}
        >
          {lanes.map((lane) => {
            const heroTone = toneFromRank(lane.hero.rank, lane.hero.of);
            return (
              <div
                key={lane.id}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 20,
                  padding: wide ? "28px 28px 24px" : "24px 24px 22px",
                }}
              >
                <Caps size={18} style={{ color: "var(--text-accent)" }}>{lane.title}</Caps>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 12 }}>
                  <div className="num" style={{ fontSize: wide ? 84 : 88, fontWeight: 800, lineHeight: 0.9, color: heroTone }}>
                    <Count text={lane.hero.display} at={0.12} />
                  </div>
                  <div style={{ textAlign: "right", paddingBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 28, color: heroTone }}>{rankText(lane.hero.rank, lane.hero.of)}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-muted)", marginTop: 4 }}>
                      NFL RANK
                    </div>
                  </div>
                </div>
                {lane.yards ? (
                  <div
                    style={{
                      marginTop: 18,
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 12,
                      alignSelf: "flex-start",
                      background: "var(--surface-2, #14161c)",
                      borderRadius: 12,
                      padding: "12px 16px",
                    }}
                  >
                    <span className="num" style={{ fontSize: 36, fontWeight: 800 }}>{lane.yards.display}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>{lane.yards.label}</span>
                  </div>
                ) : (
                  <div style={{ height: 18 }} />
                )}

                <div
                  style={{
                    marginTop: 32,
                    display: "grid",
                    gridTemplateColumns: "1.05fr 1fr 1fr",
                    gap: 12,
                    paddingTop: 8,
                  }}
                >
                  <div />
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {offense} produces
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "right" }}>
                    {defense} allows
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-secondary)", alignSelf: "center" }}>EPA / play</div>
                  <Cell stat={lane.offEpa} epa />
                  <Cell stat={lane.defEpa} epa invert align="right" />

                  <div style={{ height: 12, gridColumn: "1 / -1", borderTop: "1px solid var(--border-subtle)" }} />

                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-secondary)", alignSelf: "center" }}>{lane.contextLabel}</div>
                  <Cell stat={lane.context} />
                  <Cell stat={lane.contextOpp} invert align="right" />
                </div>
              </div>
            );
          })}
        </div>
        {note ? (
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)", marginTop: 14 }}>{note}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
