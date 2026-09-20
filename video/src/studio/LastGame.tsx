import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Eyebrow, Panel, TeamLogo, Title } from "../ds/kit";
import { exitAt, pop, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent, teamColors } from "../teams";
import { Count, Fit, Sheen, bob } from "./live";
import { toneFromRank, type StatCat } from "./statColor";
import "../fonts";

export type LastGameProps = {
  league: League;
  team: string;
  teamName: string;
  opponent: string;
  home: boolean;
  result: string;
  score: string;
  week: string;
  eyebrow: string;
  view: string;
  title: string;
  tiles: { label: string; value: string }[];
  people: { name: string; position: string; headshot: string | null; line: string; stats: { label: string; value: string }[] }[];
  extra?: string[];
};

/**
 * A club's previous game, one angle at a time (passing, rushing, defense): the
 * result, six team numbers, and the players who drove them, with their faces.
 */
export const LastGame: React.FC<LastGameProps> = ({
  league,
  team,
  opponent,
  home,
  result,
  score,
  week,
  eyebrow,
  view,
  title,
  tiles,
  people,
  extra = [],
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const ink = teamAccent(team, league);
  const { primary } = teamColors(team, league);
  const resultInk = result === "W" ? "var(--mark-positive)" : result === "L" ? "var(--mark-negative)" : "var(--text-secondary)";
  const face = wide ? 96 : 120;

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexShrink: 0 }}>
      <div style={{ transform: `scale(${pop(frame, fps, 0)})` }}>
        <TeamLogo team={team} league={league} size={wide ? 96 : 112} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rise(frame, fps, 0.05)}>
          <Eyebrow size={wide ? 24 : 26}>
            {eyebrow} · {view}
          </Eyebrow>
        </div>
        <div style={{ marginTop: 4, ...rise(frame, fps, 0.12) }}>
          <Title size={wide ? 66 : 74}>{title}</Title>
        </div>
      </div>
      <div
        style={{
          textAlign: "center",
          padding: wide ? "10px 18px" : "12px 18px",
          borderRadius: 14,
          border: `2px solid ${resultInk}`,
          background: `color-mix(in srgb, ${resultInk} 12%, transparent)`,
          transform: `scale(${pop(frame, fps, 0.3)})`,
          flexShrink: 0,
        }}
      >
        <Caps size={wide ? 22 : 26}>{week}</Caps>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 40 : 44, color: resultInk }}>{result}</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 36 : 40, color: "var(--text-primary)" }}>{score}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          <Caps size={wide ? 22 : 26}>{home ? "vs" : "at"}</Caps>
          <TeamLogo team={opponent} league={league} size={wide ? 30 : 34} />
          <Caps size={wide ? 22 : 26} color="var(--text-primary)">
            {opponent}
          </Caps>
        </div>
      </div>
    </div>
  );

  const grid = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: wide ? "repeat(3, 1fr)" : "repeat(3, 1fr)",
        gap: wide ? 14 : 14,
        flexShrink: 0,
      }}
    >
      {tiles.map((t, i) => {
        const cat: StatCat = /epa|rating/i.test(t.label) ? "quality" : /%|rate|comp/i.test(t.label) ? "rate" : "count";
        return (
        <Panel key={t.label} pad={wide ? "16px 20px" : "18px 18px"} style={{ position: "relative", overflow: "hidden", minHeight: wide ? 108 : 116, ...rise(frame, fps, stagger(i, 0.35, 0.06)) }}>
          <Sheen period={6} delay={1.5 + i * 0.25} opacity={0.08} />
          <Caps size={wide ? 16 : 18}>{t.label}</Caps>
          <div
            className="num"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: wide ? 44 : 48,
              lineHeight: 1.05,
              color: toneFromRank(null, 32, cat),
              whiteSpace: "nowrap",
            }}
          >
            <Count text={t.value} at={stagger(i, 0.45, 0.06)} />
          </div>
        </Panel>
        );
      })}
    </div>
  );

  const cards = (
    <div style={{ display: "flex", flexDirection: "column", gap: wide ? 10 : 12, flexShrink: 0 }}>
      <Caps size={wide ? 19 : 23} style={{ ...rise(frame, fps, 0.7) }}>
        Leading the way
      </Caps>
      {(wide ? people : people.slice(0, 2)).map((p, i) => (
        <div
          key={p.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: wide ? "8px 14px" : "10px 16px",
            borderRadius: 14,
            background: "var(--surface-card)",
            border: "1px solid var(--border-card)",
            ...rise(frame, fps, stagger(i, 0.8, 0.12), 18),
          }}
        >
          <div
            style={{
              width: face,
              height: face,
              borderRadius: "50%",
              padding: 3,
              background: ink,
              flexShrink: 0,
              transform: `scale(${pop(frame, fps, stagger(i, 0.85, 0.12))}) translateY(${bob(frame, fps, i + 3, 2)}px)`,
            }}
          >
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: `linear-gradient(160deg, ${primary}, var(--surface-page))` }}>
              {p.headshot ? <Img src={staticFile(p.headshot)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 34 : 40, lineHeight: 1.05, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.name}
            </div>
            <Caps size={wide ? 19 : 25} style={{ marginTop: 4 }}>
              <span style={{ color: ink }}>{p.position}</span> · <span style={{ color: "var(--text-primary)" }}>{p.line}</span>
            </Caps>
          </div>
          <div style={{ display: "flex", gap: wide ? 18 : 16 }}>
            {p.stats.map((s) => (
              <div key={s.label} style={{ textAlign: "right", minWidth: wide ? 64 : 70 }}>
                <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 30 : 34, color: toneFromRank(null, 32, "count"), lineHeight: 1 }}>{s.value || "–"}</div>
                <Caps size={wide ? 16 : 18}>{s.label}</Caps>
              </div>
            ))}
          </div>
        </div>
      ))}
      {extra.length ? (
        <Caps size={wide ? 18 : 22} color="var(--mark-positive)">
          Interceptions: {extra.map((x) => x.replace(/ INT$/, "")).join(", ")}
        </Caps>
      ) : null}
    </div>
  );

  return (
    <AbsoluteFill
      name="Last Game"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 40 : 36),
        paddingBottom: safe.bottom + 26,
        paddingLeft: wide ? 90 : 44,
        paddingRight: wide ? 90 : Math.max(44, safe.right),
        opacity: exit,
      }}
    >
      <Fit innerStyle={{ gap: wide ? 20 : 24 }}>
        {header}
        {wide ? (
          <div style={{ display: "flex", gap: 26, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>{grid}</div>
            <div style={{ flex: 1.15 }}>{cards}</div>
          </div>
        ) : (
          <>
            {grid}
            {cards}
          </>
        )}
      </Fit>
    </AbsoluteFill>
  );
};
