import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_DRAW, exitAt, progress, rise } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League } from "../teams";
import { Count, Fit } from "./live";
import { ordinal, rankFill, toneFromEpa, toneFromRank } from "./statColor";
import { BroadcastBackdrop, BroadcastHeader, InsightFooter } from "./BroadcastChrome";
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

const Cell: React.FC<{ text: string; rank: number | null; tone: string; at: number }> = ({ text, rank, tone, at }) => (
  <div style={{ textAlign: "right" }}>
    <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, lineHeight: 1, color: tone }}>
      <Count text={text} at={at} />
    </div>
    <div style={{ marginTop: 3, fontWeight: 800, fontSize: 12, color: tone }}>{rank ? ordinal(rank) : "—"}</div>
  </div>
);

/** Coverage shells as the pitch-mix table: usage bar, rate + rank, EPA both ways. */
export const CoverHeat: React.FC<CoverHeatProps> = ({
  league,
  offense,
  defense,
  offenseName,
  defenseName,
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
  const cols = "minmax(140px,1.1fr) minmax(180px,1.3fr) 130px 150px";

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
            meta={`${defense} shell mix, then ${offense} EPA in that look against what ${defense} allows.`}
            spine="Coverage"
            wide={wide}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 14, marginTop: 8, padding: "10px 0", borderBottom: "1px solid var(--border-card)" }}>
          {["Look", "Usage", `${offense} EPA`, `${defense} allows`].map((h, i) => (
            <div key={h} style={{ textAlign: i < 2 ? "left" : "right", fontWeight: 800, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {h}
            </div>
          ))}
        </div>
        {shells.map((s, i) => {
          const at = 0.16 + i * 0.05;
          const grow = progress(frame, fps, at, 0.55, EASE_DRAW);
          const mixTone = toneFromRank(s.rateRank, 32, "rate");
          const bar = rankFill(s.rateRank, 32);
          return (
            <div key={s.label} style={{ display: "grid", gridTemplateColumns: cols, columnGap: 14, alignItems: "center", minHeight: wide ? 64 : 58, borderBottom: "1px solid var(--border-card)", ...rise(frame, fps, at, 6) }}>
              <div style={{ fontWeight: 750, fontSize: 18, color: "var(--text-primary)" }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 2, background: "var(--vid-track)", overflow: "hidden" }}>
                  <div style={{ width: `${bar * 100 * grow}%`, height: "100%", background: mixTone }} />
                </div>
                <div style={{ width: 72, textAlign: "right" }}>
                  <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: mixTone, lineHeight: 1 }}>
                    <Count text={s.rate} at={at} />
                  </div>
                  <div style={{ marginTop: 3, fontWeight: 800, fontSize: 12, color: mixTone }}>{s.rateRank ? ordinal(s.rateRank) : "—"}</div>
                </div>
              </div>
              <Cell text={s.off.display} rank={s.off.rank} tone={s.off.rank ? toneFromRank(s.off.rank, s.off.of) : toneFromEpa(s.off.value ?? 0)} at={at} />
              <Cell text={s.opp.display} rank={s.opp.rank} tone={s.opp.rank ? toneFromRank(s.opp.rank, s.opp.of) : toneFromEpa(s.opp.value ?? 0, true)} at={at} />
            </div>
          );
        })}
        {note ? (
          <div style={{ marginTop: 12 }}>
            <InsightFooter wide={wide}>{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
