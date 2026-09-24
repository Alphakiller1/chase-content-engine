import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Fit, Count } from "./live";
import { toneFromGap } from "./statColor";
import { BroadcastBackdrop, BroadcastHeader, InsightFooter } from "./BroadcastChrome";
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

/** DraftKings line next to the model, one row per prop, in the splits-table grammar. */
export const PropBoard: React.FC<PropBoardProps> = ({ league, away, home, eyebrow, title, rows, note }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const chrome = wide ? 150 : 190;
  const rowH = wide ? 58 : 64;
  const avail = height - safe.top - safe.bottom - chrome;
  const shown = rows.slice(0, Math.max(4, Math.floor(avail / rowH)));
  const cols = "minmax(0,1.6fr) minmax(120px,0.8fr) 100px 90px 110px 88px";

  return (
    <AbsoluteFill
      name="Prop Board"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 28 : 36),
        paddingBottom: safe.bottom + 16,
        paddingLeft: wide ? 56 : 40,
        paddingRight: wide ? 56 : Math.max(40, safe.right),
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
            eyebrow={eyebrow}
            title={title}
            meta="DraftKings live line against the model projection. Green means the model is above the number."
            showTeams={false}
            wide={wide}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 12, marginTop: 6, padding: "8px 0", borderBottom: "1px solid var(--border-card)" }}>
          {["Player", "Market", "Line", "Open", "Model", "Gap"].map((h, i) => (
            <div key={h} style={{ textAlign: i < 2 ? "left" : "right", fontWeight: 800, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {h}
            </div>
          ))}
        </div>
        {shown.map((r, i) => {
          const at = stagger(i, 0.16, 0.04);
          const ink = teamAccent(r.team, league);
          const tone = toneFromGap(r.pct);
          const moved = r.open !== null && r.open !== r.line;
          return (
            <div key={r.name + r.market} style={{ display: "grid", gridTemplateColumns: cols, columnGap: 12, alignItems: "center", minHeight: rowH, borderBottom: "1px solid var(--border-card)", ...rise(frame, fps, at, 6) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {r.headshot ? (
                  <Img src={staticFile(r.headshot)} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "var(--surface-card)", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-card)", flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 750, fontSize: 16, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                  <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", color: ink }}>{r.team} · {r.position}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-secondary)" }}>{r.market}</div>
              <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "var(--text-primary)" }}>{fmt(r.line)}</div>
              <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: moved ? "var(--text-muted)" : "var(--text-disabled)" }}>{r.open === null ? "—" : fmt(r.open)}</div>
              <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: tone }}>
                <Count text={fmt(r.model)} at={at} />
              </div>
              <div className="num" style={{ textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: tone, opacity: progress(frame, fps, at + 0.2, 0.3) }}>
                {r.diff >= 0 ? "+" : "−"}{Math.abs(r.pct * 100).toFixed(0)}%
              </div>
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
