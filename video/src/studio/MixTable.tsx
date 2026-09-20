import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, TeamLogo } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League } from "../teams";
import { Count, Fit } from "./live";
import { ordinal, parseStat, toneFromEpa, toneFromRank, type StatCat } from "./statColor";
import "../fonts";

export type MixRow = {
  label: string;
  usage: number;
  usageDisplay: string;
  count: string;
  stat: string;
  statRank: number | null;
  opp: string;
  oppRank: number | null;
  extra: string;
  extraRank: number | null;
  of: number;
};

export type MixTableProps = {
  league: League;
  team: string;
  teamName: string;
  opponent: string;
  opponentName: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  columns: { usage: string; count: string; stat: string; opp: string; extra: string };
  rows: MixRow[];
  note: string;
  /** EPA allowed / contact-style columns where lower is better. */
  statInvert?: boolean;
};

const COLS = "minmax(168px,0.9fr) minmax(220px,1.15fr) minmax(72px,0.55fr) minmax(90px,0.7fr) minmax(96px,0.75fr) minmax(88px,0.65fr)";

const Pips: React.FC<{ usage: number; color: string; at: number }> = ({ usage, color, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = progress(frame, fps, at, 0.55, EASE_DRAW);
  const filled = Math.round(Math.max(0, Math.min(1, usage)) * 10 * grow);
  return (
    <div style={{ display: "flex", gap: 3, width: 96, flexShrink: 0 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 12,
            borderRadius: 1,
            background: i < filled ? color : "var(--border-card)",
          }}
        />
      ))}
    </div>
  );
};

const Cell: React.FC<{
  text: string;
  rank: number | null;
  of: number;
  cat: StatCat;
  invert?: boolean;
  at: number;
  size: number;
  rankH: number;
}> = ({ text, rank, of, cat, invert, at, size, rankH }) => {
  const n = parseStat(text);
  const epa = Number.isFinite(n) && /^[+-]\d/.test(String(text).trim());
  const tone = epa ? toneFromEpa(n, Boolean(invert && cat === "quality")) : toneFromRank(rank, of, cat, invert);
  return (
    <div style={{ textAlign: "right" }}>
          <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: size, color: tone, lineHeight: 1 }}>
            <Count text={text || (rank ? "—" : "")} at={at} />
          </div>
      <div style={{ height: rankH, fontWeight: 800, fontSize: Math.round(size * 0.58), color: tone, marginTop: 3, opacity: rank ? 1 : 0 }}>
        {rank ? ordinal(rank) : "—"}
      </div>
    </div>
  );
};

/**
 * Pitch-mix board for football: usage pips, snap counts, a quality number,
 * the opponent's answering rate, and success — each column coloured by category.
 */
export const MixTable: React.FC<MixTableProps> = ({
  league,
  team,
  teamName,
  opponentName,
  eyebrow,
  title,
  subtitle,
  columns,
  rows,
  note,
  statInvert = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const padX = wide ? 72 : 44;
  const num = wide ? 32 : 34;
  const rankH = wide ? 20 : 22;

  const heads = [
    { k: "name", t: "", align: "left" as const },
    { k: "usage", t: columns.usage, align: "left" as const },
    { k: "count", t: columns.count, align: "right" as const },
    { k: "stat", t: columns.stat, align: "right" as const },
    { k: "opp", t: columns.opp || opponentName, align: "right" as const },
    { k: "extra", t: columns.extra, align: "right" as const },
  ];

  return (
    <AbsoluteFill
      name="Mix Table"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 44 : 48),
        paddingBottom: safe.bottom + 20,
        paddingLeft: padX,
        paddingRight: padX,
        opacity: exit,
      }}
    >
      <Fit>
        <div style={{ display: "flex", alignItems: "center", gap: 16, ...rise(frame, fps, 0) }}>
          <TeamLogo team={team} league={league} size={wide ? 64 : 72} />
          <div style={{ minWidth: 0 }}>
            <div className="chrome" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 48 : 52, lineHeight: 0.95 }}>
              {title}
            </div>
            <Caps size={wide ? 18 : 20} color="var(--text-accent)" style={{ marginTop: 8 }}>
              {eyebrow} · {teamName} · {subtitle}
            </Caps>
          </div>
        </div>

        <div
          style={{
            marginTop: wide ? 20 : 24,
            display: "grid",
            gridTemplateColumns: COLS,
            columnGap: 12,
            padding: "0 0 10px",
            borderBottom: "1px solid var(--border-card)",
            ...rise(frame, fps, 0.1),
          }}
        >
          {heads.map((h) => (
            <Caps key={h.k} size={wide ? 15 : 16} color="var(--text-primary)" style={{ textAlign: h.align, letterSpacing: "0.12em", opacity: 0.8 }}>
              {h.t}
            </Caps>
          ))}
        </div>

        {rows.map((r, i) => {
          const at = stagger(i, 0.2, 0.07);
          const rateTone = toneFromRank(r.statRank, r.of, "rate");
          return (
            <div
              key={r.label}
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                columnGap: 12,
                alignItems: "center",
                minHeight: wide ? 64 : 72,
                padding: wide ? "8px 0" : "10px 0",
                borderBottom: "1px solid var(--border-card)",
                ...rise(frame, fps, at, 8),
              }}
            >
              <div style={{ fontWeight: 800, fontSize: wide ? 24 : 26, color: "var(--text-primary)", lineHeight: 1.15 }}>{r.label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10 }}>
                <Pips usage={r.usage} color={rateTone} at={at} />
                <div style={{ minWidth: 78, textAlign: "right" }}>
                  <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: num, color: rateTone }}>
                    <Count text={r.usageDisplay} at={at} />
                  </div>
                  <div style={{ height: rankH, fontWeight: 800, fontSize: Math.round(num * 0.5), color: rateTone, marginTop: 2, opacity: r.statRank ? 1 : 0 }}>
                    {r.statRank ? ordinal(r.statRank) : ""}
                  </div>
                </div>
              </div>
              <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: num - 2, color: toneFromRank(null, 32, "count") }}>
                {r.count || "—"}
              </div>
              <Cell text={r.stat} rank={null} of={r.of} cat="quality" invert={statInvert} at={at} size={num} rankH={rankH} />
              <Cell text={r.opp} rank={r.oppRank} of={r.of} cat="rate" at={at} size={num} rankH={rankH} />
              <Cell text={r.extra} rank={r.extraRank} of={r.of} cat="quality" at={at} size={num} rankH={rankH} />
            </div>
          );
        })}

        {note ? (
          <div style={{ marginTop: 14, opacity: progress(frame, fps, 1.05, 0.4) }}>
            <Deck size={wide ? 20 : 24} style={{ color: "var(--text-primary)", opacity: 0.8 }}>
              {note}
            </Deck>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
