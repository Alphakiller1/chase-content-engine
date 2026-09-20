import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, Eyebrow, TeamLogo, Title } from "../ds/kit";
import { EASE, EASE_DRAW, exitAt, pop, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Fit, Count, LiveDot, Sheen, etTime } from "./live";
import "../fonts";

export type LineMoveRow = {
  label: string;
  open: string;
  current: string;
  openValue: number;
  currentValue: number;
  move: string;
  team: string | null;
  unit: string;
  juice: string;
};

export type LineMoveProps = {
  league: League;
  away: string;
  home: string;
  awayName: string;
  homeName: string;
  eyebrow: string;
  title: string;
  rows: LineMoveRow[];
  /** No-vig home win probability at the open and now. */
  winOpen: number | null;
  winCurrent: number | null;
  model: string;
  modelMargin?: number;
  modelTotal?: number;
  updated: string;
};

/**
 * Opening line vs current line. Spread and total get a track where the marker
 * slides from where the market opened to where it is now, with the model's number
 * as a dashed reference; the moneylines and the implied win chance show the same
 * move as numbers.
 */
export const LineMove: React.FC<LineMoveProps> = ({
  league,
  away,
  home,
  eyebrow,
  title,
  rows,
  winOpen,
  winCurrent,
  model,
  modelMargin,
  modelTotal,
  updated,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const homeInk = teamAccent(home, league);
  const awayInk = teamAccent(away, league);
  const tracks = rows.filter((r) => r.label === "Spread" || r.label === "Total");
  const mls = rows.filter((r) => r.label.endsWith("moneyline"));
  const S = 1;

  const track = (r: LineMoveRow, i: number) => {
    const ref = r.label === "Spread" ? modelMargin : modelTotal;
    const vals = [r.openValue, r.currentValue, ...(ref !== undefined ? [ref] : [])];
    const lo = Math.floor(Math.min(...vals) - 1.5);
    const hi = Math.ceil(Math.max(...vals) + 1.5);
    const at = stagger(i, 0.5, 0.35);
    const slide = progress(frame, fps, at + 0.5, 1.2, EASE);
    const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
    const now = interpolate(slide, [0, 1], [r.openValue, r.currentValue]);
    const ink = r.team === home ? homeInk : r.team === away ? awayInk : "var(--accent)";
    const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * 4);
    return (
      <div
        key={r.label}
        style={{
          position: "relative",
          overflow: "hidden",
          background: "var(--surface-card)",
          border: "1px solid var(--border-card)",
          borderRadius: 18,
          flexShrink: 0,
          padding: wide ? "22px 30px 26px" : "20px 28px 22px",
          ...rise(frame, fps, at),
        }}
      >
        <Sheen period={5} delay={2 + i} opacity={0.07} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20 }}>
          <Caps size={24 * S}>{r.label}</Caps>
          <div
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              background: `color-mix(in srgb, ${ink} 20%, transparent)`,
              border: `2px solid ${ink}`,
              color: "var(--text-primary)",
              fontWeight: 800,
              fontSize: 22 * S,
              transform: `scale(${pop(frame, fps, at + 1.5)})`,
              whiteSpace: "nowrap",
            }}
          >
            {r.move}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 10 }}>
          <div style={{ textAlign: "center" }}>
            <Caps size={21 * S}>Opened</Caps>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: (wide ? 52 : 46) * S, color: "var(--text-secondary)", lineHeight: 1.05 }}>
              {r.open}
            </div>
          </div>
          <svg width={70 * S} height={30 * S} viewBox="0 0 70 30" style={{ flexShrink: 0 }}>
            <path
              d="M2 15 H60 M48 4 L64 15 L48 26"
              fill="none"
              stroke={ink}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - progress(frame, fps, at + 0.4, 0.6, EASE_DRAW)}
            />
          </svg>
          <div style={{ textAlign: "center" }}>
            <Caps size={21 * S} color={ink}>
              Now
            </Caps>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: (wide ? 68 : 62) * S, color: "var(--text-primary)", lineHeight: 1.05 }}>
              {r.current}
            </div>
          </div>
          {r.juice ? (
            <Caps size={21 * S} style={{ marginLeft: "auto", textAlign: "right" }}>
              {r.juice}
            </Caps>
          ) : null}
        </div>
        {/* the track */}
        <div style={{ position: "relative", height: 70 * S, marginTop: 14 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 30 * S, height: 6, borderRadius: 3, background: "var(--border-card)" }} />
          {/* travelled distance */}
          <div
            style={{
              position: "absolute",
              top: 30 * S,
              height: 6,
              borderRadius: 3,
              background: ink,
              left: `${Math.min(pos(r.openValue), pos(now))}%`,
              width: `${Math.abs(pos(now) - pos(r.openValue))}%`,
            }}
          />
          {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
            .filter((v) => (hi - lo > 12 ? v % 2 === 0 : true))
            .map((v) => (
              <div key={v} style={{ position: "absolute", left: `${pos(v)}%`, top: 44 * S, transform: "translateX(-50%)", fontSize: 21 * S, fontWeight: 700, color: "var(--text-muted)" }}>
                {v}
              </div>
            ))}
          {ref !== undefined ? (
            <div style={{ position: "absolute", left: `${pos(ref)}%`, top: 12 * S, transform: "translateX(-50%)", textAlign: "center", opacity: progress(frame, fps, at + 1.8, 0.5) }}>
              <div style={{ width: 0, height: 42 * S, borderLeft: "3px dashed var(--text-accent)", margin: "0 auto" }} />
              <div style={{ fontSize: 20 * S, fontWeight: 800, color: "var(--text-accent)", marginTop: -58 * S, whiteSpace: "nowrap" }}>MODEL {ref}</div>
            </div>
          ) : null}
          <div style={{ position: "absolute", left: `${pos(r.openValue)}%`, top: 24 * S, width: 18 * S, height: 18 * S, marginLeft: -9 * S, borderRadius: "50%", border: "3px solid var(--text-secondary)", background: "var(--surface-page)" }} />
          <div
            style={{
              position: "absolute",
              left: `${pos(now)}%`,
              top: 19 * S,
              width: 28 * S,
              height: 28 * S,
              marginLeft: -14 * S,
              borderRadius: "50%",
              background: ink,
              boxShadow: `0 0 0 ${6 + pulse * 6}px color-mix(in srgb, ${ink} ${Math.round(30 - pulse * 20)}%, transparent)`,
            }}
          />
        </div>
      </div>
    );
  };

  const win = winOpen !== null && winCurrent !== null ? (
    <div style={{ flexShrink: 0, ...rise(frame, fps, 1.3) }}>
      <Caps size={20 * S} style={{ marginBottom: 12 }}>
        {home} win chance implied by the moneyline
      </Caps>
      {[
        { label: "Opened", v: winOpen, at: 1.5, strong: false },
        { label: "Now", v: winCurrent, at: 1.7, strong: true },
      ].map((b) => (
        <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
          <Caps size={20 * S} style={{ width: 90 * S }}>
            {b.label}
          </Caps>
          <div style={{ flex: 1, height: 30 * S, borderRadius: 8, background: "var(--surface-card)", overflow: "hidden", position: "relative" }}>
            <div
              style={{
                height: "100%",
                width: `${b.v * 100 * progress(frame, fps, b.at, 1.0, EASE_DRAW)}%`,
                background: b.strong ? homeInk : `color-mix(in srgb, ${homeInk} 45%, var(--surface-card))`,
              }}
            />
          </div>
          <div style={{ width: 110 * S, textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40 * S, color: b.strong ? "var(--text-primary)" : "var(--text-secondary)" }}>
            <Count text={`${(b.v * 100).toFixed(1)}%`} at={b.at} />
          </div>
        </div>
      ))}
    </div>
  ) : null;

  const moneylines = mls.length ? (
    <div style={{ display: "flex", gap: 16, flexShrink: 0, ...rise(frame, fps, 1.1) }}>
      {mls.map((r) => {
        const ink = r.team === home ? homeInk : awayInk;
        return (
          <div key={r.label} style={{ flex: 1, background: "var(--surface-card)", border: "1px solid var(--border-card)", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            {r.team ? <TeamLogo team={r.team} league={league} size={54 * S} /> : null}
            <div>
              <Caps size={20 * S} color={ink}>
                {r.label}
              </Caps>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40 * S, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>{r.open}</span>
                <span style={{ color: ink }}> → </span>
                {r.current}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <AbsoluteFill
      name="Line Move"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 44 : 40),
        paddingBottom: safe.bottom + 30,
        paddingLeft: wide ? 100 : 48,
        paddingRight: wide ? 100 : Math.max(48, safe.right),
        opacity: exit,
        justifyContent: "center",
      }}
    >
      <Fit innerStyle={{ gap: wide ? 22 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <TeamLogo team={away} league={league} size={wide ? 70 : 84} />
          <TeamLogo team={home} league={league} size={wide ? 70 : 84} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, ...rise(frame, fps, 0) }}>
            <LiveDot size={wide ? 13 : 16} />
            <Eyebrow size={wide ? 24 : 28}>{eyebrow}</Eyebrow>
          </div>
          <div style={{ marginTop: 6, ...rise(frame, fps, 0.1) }}>
            <Title size={wide ? 68 : 72}>{title}</Title>
          </div>
        </div>
      </div>

      {wide ? (
        <div style={{ display: "flex", gap: 26 }}>
          <div style={{ flex: 1.25, display: "flex", flexDirection: "column", gap: 18 }}>{tracks.map(track)}</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, justifyContent: "center" }}>
            {moneylines}
            {win}
          </div>
        </div>
      ) : (
        <>
          {tracks.map(track)}
          {moneylines}
          {win}
        </>
      )}

      <div style={{ opacity: progress(frame, fps, 2.2, 0.6) }}>
        <Deck size={wide ? 21 : 26}>
          {model}
          {updated ? ` · Lines as of ${etTime(updated)}` : ""}
        </Deck>
      </div>
      </Fit>
    </AbsoluteFill>
  );
};
