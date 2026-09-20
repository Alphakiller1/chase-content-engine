import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, TeamLogo, Title } from "../ds/kit";
import { exitAt } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League } from "../teams";
import { Count } from "./live";
import { ordinal, toneFromEpa, toneFromRank } from "./statColor";
import "../fonts";

type Stat = { value: number | null; display: string; rank: number | null; of: number; vsAvg?: string };
type Shell = {
  label: string;
  rate: string;
  rateValue: number | null;
  rateRank: number | null;
  off: Stat;
  opp: Stat;
};

export type CoverHeatProps = {
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
  shells: Shell[];
};

const rankLine = (rank: number | null, of = 32, invert?: boolean, suffix = "NFL") => {
  if (!rank) return { text: "—", color: "var(--text-muted)" };
  return { text: `${ordinal(rank)} ${suffix}`, color: toneFromRank(rank, of, "quality", invert) };
};

export const CoverHeat: React.FC<CoverHeatProps> = ({
  league,
  offense,
  defense,
  eyebrow,
  title,
  note,
  shells,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const cols = wide ? "1.2fr 1.35fr 1.2fr 1.2fr" : "1.15fr 1.2fr 1.1fr 1.1fr";
  const maxMix = Math.max(...shells.map((s) => s.rateValue || 0), 0.01);

  return (
    <AbsoluteFill style={{ background: "var(--surface-page)", color: "var(--text-primary)", opacity: exit }}>
      <div
        style={{
          padding: `${safe.top}px ${wide ? 44 : 28}px ${safe.bottom}px`,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <Eyebrow size={wide ? 20 : 22}>{eyebrow}</Eyebrow>
            <Title size={wide ? 44 : 48} style={{ marginTop: 6 }}>{title}</Title>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <TeamLogo league={league} team={offense} size={46} />
            <Caps size={14} color="var(--text-muted)">throws vs</Caps>
            <TeamLogo league={league} team={defense} size={46} />
          </div>
        </div>
        <Deck size={wide ? 20 : 21} style={{ marginTop: 8, maxWidth: 1080 }}>
          Mix is how often {defense} plays the look (1st = most often). Then {offense} EPA/play in that look vs what {defense} allows — rank is 1st best.
        </Deck>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 10,
            marginTop: 16,
            color: "var(--text-muted)",
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          <span>Look</span>
          <span>{defense} mix</span>
          <span style={{ textAlign: "right" }}>{offense} EPA vs it</span>
          <span style={{ textAlign: "right" }}>{defense} EPA allowed</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, marginTop: 4 }}>
          {shells.map((s, i) => {
            const mix = rankLine(s.rateRank, 32, false, "most");
            const off = rankLine(s.off.rank, s.off.of);
            const def = rankLine(s.opp.rank, s.opp.of, true);
            const bar = Math.max(0.08, (s.rateValue || 0) / maxMix);
            return (
              <div
                key={s.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  gap: 10,
                  alignItems: "center",
                  flex: 1,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: wide ? 28 : 26, lineHeight: 1.1 }}>{s.label}</div>
                <div>
                  <div className="num" style={{ fontSize: wide ? 32 : 30, fontWeight: 800, lineHeight: 1 }}>
                    <Count text={s.rate} at={0.1 + i * 0.04} />
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--border-subtle)",
                      marginTop: 6,
                      maxWidth: 180,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: `${bar * 100}%`, height: "100%", background: toneFromRank(s.rateRank, 32, "rate") }} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: toneFromRank(s.rateRank, 32, "rate"), marginTop: 4 }}>
                    {mix.text}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontSize: wide ? 30 : 28, fontWeight: 800, color: toneFromEpa(s.off.value ?? 0) }}>
                    <Count text={s.off.display} at={0.14 + i * 0.04} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: off.color, marginTop: 2 }}>{off.text}</div>
                  {s.off.vsAvg ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>{s.off.vsAvg}</div>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontSize: wide ? 30 : 28, fontWeight: 800, color: toneFromEpa(s.opp.value ?? 0, true) }}>
                    <Count text={s.opp.display} at={0.18 + i * 0.04} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: def.color, marginTop: 2 }}>{def.text}</div>
                  {s.opp.vsAvg ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>{s.opp.vsAvg}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {note ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginTop: 8 }}>{note}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
