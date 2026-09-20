import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, TeamLogo, Title } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League } from "../teams";
import { Fit, Count } from "./live";
import { ordinal, toneFromMix, toneFromRank, type StatCat } from "./statColor";
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
 * Club vs club the way the live matchup page draws form: values on the outside,
 * a league-percentile bar toward the spine, rank under the number, colour from
 * the metric's category (quality vs rate) against the 32-team pool.
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
  const padX = wide ? 64 : 44;
  const labelW = wide ? 200 : 176;
  const valueW = wide ? 148 : 140;
  const cols = `${valueW}px minmax(0,1fr) ${labelW}px minmax(0,1fr) ${valueW}px`;
  const avail = height - safe.top - safe.bottom - (wide ? 250 : 360) - mixes.length * (wide ? 110 : 140);
  const rowH = Math.min(wide ? 84 : 108, Math.max(wide ? 64 : 80, avail / Math.max(rows.length, 1)));
  const valueSize = Math.min(wide ? 50 : 56, rowH * 0.52);
  const rankH = wide ? 26 : 28;

  const pctLen = (s: Side) => {
    if (!s.rank || !s.of) return 0.42;
    return Math.max(0.1, (s.of - s.rank + 1) / s.of);
  };

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
        <div style={{ height: rankH, fontWeight: 800, fontSize: wide ? 20 : 22, color: tone, marginTop: 2, opacity: s.rank ? 1 : 0 }}>
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
        paddingTop: safe.top + (wide ? 40 : 48),
        paddingBottom: safe.bottom + 20,
        paddingLeft: padX,
        paddingRight: padX + (wide ? 0 : Math.max(0, safe.right - padX)),
        opacity: exit,
      }}
    >
      <Fit>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
            alignItems: "center",
            columnGap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, ...rise(frame, fps, 0) }}>
            <TeamLogo team={away} league={league} size={wide ? 52 : 58} />
            <div style={{ minWidth: 0 }}>
              <Caps size={wide ? 20 : 22}>{away}</Caps>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: wide ? 36 : 38,
                  color: "var(--text-primary)",
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {awayName}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", padding: "0 12px" }}>
            <div style={rise(frame, fps, 0)}>
              <Eyebrow size={wide ? 22 : 24}>{eyebrow}</Eyebrow>
            </div>
            <div style={{ marginTop: 4, ...rise(frame, fps, 0.06) }}>
              <Title size={wide ? 54 : 58}>{title}</Title>
            </div>
            <Caps size={wide ? 16 : 18} color="var(--text-primary)" style={{ marginTop: 8, letterSpacing: "0.08em" }}>
              {poolLabel}
            </Caps>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: "row-reverse", minWidth: 0, ...rise(frame, fps, 0) }}>
            <TeamLogo team={home} league={league} size={wide ? 52 : 58} />
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <Caps size={wide ? 20 : 22}>{home}</Caps>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: wide ? 36 : 38,
                  color: "var(--text-primary)",
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {homeName}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: wide ? 16 : 20 }}>
          {rows.map((r, i) => {
            const at = stagger(i, 0.28, 0.07);
            const grow = progress(frame, fps, at, 0.7, EASE_DRAW);
            const cat = catOf(rankKind, r.better);
            const invert = r.better === "low";
            const bar = (s: Side, left: boolean) => {
              const tone = toneFromRank(s.rank, s.of, cat === "identity" ? "quality" : cat, invert);
              return (
                <div style={{ display: "flex", justifyContent: left ? "flex-end" : "flex-start", alignItems: "center", minWidth: 0 }}>
                  <div
                    style={{
                      width: `${pctLen(s) * 100 * grow}%`,
                      height: Math.max(10, rowH * 0.24),
                      borderRadius: 2,
                      background: tone,
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
                  ...rise(frame, fps, at, 8),
                }}
              >
                {valueBlock(r.away, "left", at, cat, invert)}
                {bar(r.away, true)}
                <Caps size={wide ? 17 : 19} color="var(--text-primary)" style={{ textAlign: "center", lineHeight: 1.2 }}>
                  {r.label}
                </Caps>
                {bar(r.home, false)}
                {valueBlock(r.home, "right", at, cat, invert)}
              </div>
            );
          })}
        </div>

        {mixes.map((m, mi) => (
          <div key={m.label} style={{ marginTop: wide ? 18 : 22, ...rise(frame, fps, 0.85 + mi * 0.12) }}>
            <Caps size={wide ? 16 : 18} color="var(--text-primary)" style={{ marginBottom: 8, letterSpacing: "0.12em" }}>
              {m.label}
            </Caps>
            {(["away", "home"] as const).map((key, si) => {
              const team = key === "away" ? away : home;
              const total = m.segments.reduce((acc, g) => acc + g[key], 0) || 1;
              const grow = progress(frame, fps, 0.95 + mi * 0.12 + si * 0.08, 0.8, EASE_DRAW);
              return (
                <div key={team} style={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr)", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <Caps size={wide ? 14 : 16}>{team}</Caps>
                  <div style={{ display: "flex", height: wide ? 32 : 36, borderRadius: 3, overflow: "hidden", background: "var(--surface-card)" }}>
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
                            fontSize: wide ? 16 : 18,
                            color: "#111",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {share > 0.09 ? `${g.label} ${Math.round(share * 100)}%` : ""}
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
          <div style={{ marginTop: wide ? 14 : 18, opacity: progress(frame, fps, 1.1, 0.4) }}>
            <Deck size={wide ? 20 : 24} style={{ color: "var(--text-primary)", opacity: 0.8 }}>{note}</Deck>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
