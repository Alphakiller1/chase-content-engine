import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League } from "../teams";
import { Fit, Count } from "./live";
import { ordinal, toneFromMix, toneFromRank, type StatCat } from "./statColor";
import { BroadcastBackdrop, BroadcastHeader, InsightFooter } from "./BroadcastChrome";
import "../fonts";

type Side = { value: number; display: string; rank: number | null; of: number };

export type MetricBoardProps = {
  league: League;
  away: string;
  home: string;
  awayName: string;
  homeName: string;
  eyebrow: string;
  title: string;
  rows: { label: string; better: "high" | "low" | null; away: Side; home: Side }[];
  mixes: { label: string; segments: { label: string; away: number; home: number }[] }[];
  rankKind: "quality" | "frequency" | "none";
  note: string;
  poolLabel?: string;
};

export { ordinal, rankTone } from "./statColor";

const catOf = (kind: MetricBoardProps["rankKind"], better: "high" | "low" | null): StatCat => {
  if (kind === "none") return "identity";
  if (kind === "frequency" || better === null) return "rate";
  return "quality";
};

/**
 * Club vs club the way the live MLB form card draws: values outside, thin
 * percentile bars to the spine, rank under the number, metric name in the middle.
 */
export const MetricBoard: React.FC<MetricBoardProps> = ({
  league,
  away,
  home,
  awayName,
  homeName,
  eyebrow,
  title,
  rows,
  mixes,
  rankKind,
  note,
  poolLabel = "Percentile of the league pool",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const padX = wide ? 56 : 40;
  const valueW = wide ? 118 : 108;
  const labelW = wide ? 168 : 132;
  const cols = `${valueW}px minmax(0,1fr) ${labelW}px minmax(0,1fr) ${valueW}px`;
  const chrome = wide ? 168 : 210;
  const mixH = mixes.length * (wide ? 92 : 120);
  const avail = height - safe.top - safe.bottom - chrome - mixH;
  const rowH = Math.min(wide ? 72 : 78, Math.max(wide ? 52 : 58, avail / Math.max(rows.length, 1)));
  const valueSize = Math.min(wide ? 28 : 30, rowH * 0.42);
  const barH = Math.max(7, Math.round(rowH * 0.14));

  const pctLen = (s: Side) => (s.rank && s.of ? Math.max(0.08, (s.of - s.rank + 1) / s.of) : 0);

  const valueBlock = (s: Side, align: "left" | "right", at: number, cat: StatCat, invert: boolean) => {
    const tone = toneFromRank(s.rank, s.of, cat, invert);
    return (
      <div style={{ width: valueW, textAlign: align, flexShrink: 0 }}>
        <div
          className="num"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: valueSize,
            lineHeight: 1,
            color: tone,
          }}
        >
          <Count text={s.display} at={at} />
        </div>
        <div style={{ marginTop: 3, fontWeight: 800, fontSize: wide ? 12 : 13, color: tone, opacity: s.rank ? 0.95 : 0 }}>
          {s.rank ? ordinal(s.rank) : "—"}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill
      name="Metric Board"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 28 : 36),
        paddingBottom: safe.bottom + 16,
        paddingLeft: padX,
        paddingRight: padX + (wide ? 0 : Math.max(0, safe.right - padX)),
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
            meta={poolLabel}
            spine="Percentile of the league pool"
            wide={wide}
          />
        </div>

        <div style={{ marginTop: 4 }}>
          {rows.map((r, i) => {
            const at = stagger(i, 0.18, 0.05);
            const grow = progress(frame, fps, at, 0.65, EASE_DRAW);
            const cat = catOf(rankKind, r.better);
            const invert = r.better === "low";
            const bar = (s: Side, left: boolean) => {
              const tone = toneFromRank(s.rank, s.of, cat === "identity" ? "quality" : cat, invert);
              const known = Boolean(s.rank && s.of);
              return (
                <div style={{ display: "flex", justifyContent: left ? "flex-end" : "flex-start", alignItems: "center", minWidth: 0 }}>
                  <div
                    style={{
                      width: `${pctLen(s) * 100 * grow}%`,
                      height: barH,
                      borderRadius: 2,
                      background: known ? tone : "var(--vid-track)",
                    }}
                  />
                </div>
              );
            };
            return (
              <div
                key={r.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  alignItems: "center",
                  columnGap: 10,
                  height: rowH,
                  borderTop: i ? "1px solid var(--border-card)" : undefined,
                  ...rise(frame, fps, at, 6),
                }}
              >
                {valueBlock(r.away, "left", at, cat, invert)}
                {bar(r.away, true)}
                <div
                  style={{
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: wide ? 12 : 13,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    lineHeight: 1.2,
                  }}
                >
                  {r.label}
                </div>
                {bar(r.home, false)}
                {valueBlock(r.home, "right", at, cat, invert)}
              </div>
            );
          })}
        </div>

        {mixes.map((m, mi) => (
          <div key={m.label} style={{ marginTop: wide ? 16 : 18, ...rise(frame, fps, 0.7 + mi * 0.1) }}>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              {m.label}
            </div>
            {(["away", "home"] as const).map((key, si) => {
              const team = key === "away" ? away : home;
              const total = m.segments.reduce((acc, g) => acc + g[key], 0) || 1;
              const grow = progress(frame, fps, 0.8 + mi * 0.1 + si * 0.06, 0.7, EASE_DRAW);
              return (
                <div key={team} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr)", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: "var(--text-muted)" }}>{team}</div>
                  <div style={{ display: "flex", height: wide ? 22 : 24, borderRadius: 3, overflow: "hidden", background: "var(--surface-card)" }}>
                    {m.segments.map((g, gi) => {
                      const share = g[key] / total;
                      return (
                        <div
                          key={g.label}
                          style={{
                            width: `${share * 100 * grow}%`,
                            background: toneFromMix(gi),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 12,
                            color: "#111",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {share > 0.12 ? `${g.label} ${Math.round(share * 100)}%` : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {note ? (
          <div style={{ marginTop: wide ? 12 : 14, opacity: progress(frame, fps, 0.95, 0.35) }}>
            <InsightFooter wide={wide}>{note}</InsightFooter>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
