import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, Title } from "../ds/kit";
import { EASE_DRAW, exitAt, pop, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent, teamColors } from "../teams";
import { Fit, Count, LiveDot, bob } from "./live";
import { toneFromGap, toneFromRank } from "./statColor";
import "../fonts";

export type PropRow = {
  name: string;
  team: string;
  position: string;
  headshot: string | null;
  market: string;
  line: number;
  open: number | null;
  model: number;
  diff: number;
  pct: number;
  key?: string;
  group?: string;
  score?: number;
};

export type PropBoardProps = {
  league: League;
  away: string;
  home: string;
  eyebrow: string;
  title: string;
  rows: PropRow[];
  note: string;
};

const fmt = (v: number) => (Math.abs(v) >= 20 ? v.toFixed(1) : v.toFixed(v % 1 === 0 ? 1 : 2).replace(/0$/, ""));

/**
 * Player prop review: the live DraftKings line next to the model's projection,
 * one player per row, with a gap bar centred on the line (model above or below).
 */
export const PropBoard: React.FC<PropBoardProps> = ({ league, eyebrow, title, rows, note }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const padX = wide ? 100 : 44;
  const avail = height - safe.top - safe.bottom - (wide ? 300 : 330);
  // Vertical rows carry their gap bar underneath; show only as many as fit.
  const face = wide ? Math.min(92, (avail / Math.max(rows.length, 1)) * 0.7) : 100;
  const unit = wide ? Math.min(118, avail / Math.max(rows.length, 1)) : face + 70;
  const shown = rows.slice(0, Math.max(1, Math.floor(avail / unit)));
  const rowH = unit;
  const maxPct = Math.max(0.15, ...shown.map((r) => Math.abs(r.pct)));
  const cols = wide ? "minmax(0,1.4fr) 150px 140px 360px" : "minmax(0,1.4fr) 150px 140px";

  return (
    <AbsoluteFill
      name="Prop Board"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 44 : 40),
        paddingBottom: safe.bottom + 26,
        paddingLeft: padX,
        paddingRight: wide ? padX : Math.max(padX, safe.right),
        opacity: exit,
        justifyContent: "center",
      }}
    >
      <Fit>
      <div style={{ ...rise(frame, fps, 0), display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <LiveDot size={wide ? 13 : 16} />
        <Eyebrow size={wide ? 24 : 28}>{eyebrow}</Eyebrow>
      </div>
      <div style={{ marginTop: 6, flexShrink: 0, ...rise(frame, fps, 0.1) }}>
        <Title size={wide ? 72 : 84}>{title}</Title>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          columnGap: 12,
          alignItems: "end",
          marginTop: wide ? 18 : 26,
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-card)",
          ...rise(frame, fps, 0.2),
        }}
      >
        <div />
        <Caps size={wide ? 16 : 20} style={{ textAlign: "right" }}>
          DK line
        </Caps>
        <Caps size={wide ? 16 : 20} style={{ textAlign: "right" }} color="var(--text-accent)">
          Model
        </Caps>
        {wide ? (
          <Caps size={16} style={{ textAlign: "center" }}>
            Model vs line
          </Caps>
        ) : null}
      </div>

      {shown.map((r, i) => {
        const at = stagger(i, 0.35, 0.12);
        const ink = teamAccent(r.team, league);
        const { primary } = teamColors(r.team, league);
        const above = r.diff >= 0;
        const tone = toneFromGap(r.pct);
        const grow = progress(frame, fps, at + 0.3, 0.9, EASE_DRAW);
        const barHalf = wide ? 140 : 240;
        const len = (Math.abs(r.pct) / maxPct) * barHalf * grow;
        const moved = r.open !== null && r.open !== r.line;
        const bar = (
          <div style={{ position: "relative", width: barHalf * 2, height: 40, flexShrink: 0, overflow: "visible" }}>
            <div style={{ position: "absolute", left: barHalf - 1, top: 4, bottom: 4, width: 2, background: "var(--text-muted)" }} />
            <div
              style={{
                position: "absolute",
                top: 12,
                height: 16,
                borderRadius: 9,
                background: tone,
                left: above ? barHalf : barHalf - len,
                width: len,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: above ? barHalf + len + 8 : Math.max(0, barHalf - len - 8),
                transform: above ? "none" : "translateX(-100%)",
                whiteSpace: "nowrap",
                fontWeight: 800,
                fontSize: wide ? 22 : 26,
                color: tone,
                opacity: progress(frame, fps, at + 0.9, 0.4),
              }}
            >
              {above ? "+" : "−"}
              {Math.abs(r.pct * 100).toFixed(0)}%
            </div>
          </div>
        );
        return (
          <div key={r.name + r.market} style={{ borderBottom: "1px solid var(--border-card)", padding: wide ? "8px 0" : "12px 0", ...rise(frame, fps, at, 16) }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                columnGap: 12,
                alignItems: "center",
                minHeight: wide ? rowH - 16 : face + 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              <div
                style={{
                  width: face,
                  height: face,
                  borderRadius: "50%",
                  padding: 3,
                  background: ink,
                  flexShrink: 0,
                  transform: `scale(${pop(frame, fps, at)}) translateY(${bob(frame, fps, i, 2)}px)`,
                }}
              >
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: `linear-gradient(160deg, ${primary}, var(--surface-page))` }}>
                  {r.headshot ? <Img src={staticFile(r.headshot)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, marginLeft: 18 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 32 : 38, color: "var(--text-primary)", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                </div>
                <Caps size={wide ? 16 : 20} style={{ marginTop: 4 }}>
                  <span style={{ color: ink }}>{r.team}</span> · {r.position} · <span style={{ color: "var(--text-primary)" }}>{r.market}</span>
                </Caps>
              </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 40 : 46, color: toneFromRank(null, 32, "market"), lineHeight: 1 }}>
                  {fmt(r.line)}
                </div>
                {moved ? (
                  <div style={{ fontSize: wide ? 16 : 20, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>
                    opened {fmt(r.open as number)} {r.line > (r.open as number) ? "▲" : "▼"}
                  </div>
                ) : (
                  <div style={{ height: wide ? 20 : 24 }} />
                )}
              </div>
              <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 40 : 46, color: tone, lineHeight: 1 }}>
                <Count text={fmt(r.model)} at={at + 0.2} />
              </div>
              {wide ? <div style={{ display: "flex", justifyContent: "center" }}>{bar}</div> : null}
            </div>
            {!wide ? <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>{bar}</div> : null}
          </div>
        );
      })}

      <div style={{ marginTop: 16, opacity: progress(frame, fps, 1.4, 0.5) }}>
        <Deck size={wide ? 20 : 26}>{note}</Deck>
      </div>
      </Fit>
    </AbsoluteFill>
  );
};
