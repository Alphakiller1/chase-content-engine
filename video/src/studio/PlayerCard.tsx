import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, EdgeRule, Eyebrow, Panel, StatusPill, TeamLogo } from "../ds/kit";
import { EASE, exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent, teamColors } from "../teams";
import { Fit, Sheen } from "./live";
import { toneFromGap, toneFromRank, type StatCat } from "./statColor";
import "../fonts";

export type PlayerCardProps = {
  league: League;
  team: string;
  teamName: string;
  name: string;
  position: string;
  role: string;
  headshot: string | null;
  status: string;
  detail: string;
  stats: { label: string; value: string }[];
  statsLabel: string;
  /** Live DraftKings props for this player next to the model's number. */
  props?: { label: string; line: number; open: number | null; model: number }[];
  eyebrow: string;
};

/**
 * One player, big: the headshot on a club-colour field with the logo behind, name,
 * role, availability and (for a starting QB) the model's next-game centres.
 */
export const PlayerCard: React.FC<PlayerCardProps> = ({
  league,
  team,
  teamName,
  name,
  position,
  role,
  headshot,
  status,
  detail,
  stats,
  statsLabel,
  props = [],
  eyebrow,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const ink = teamAccent(team, league);
  const { primary, secondary } = teamColors(team, league);
  const busy = stats.length > 0 || props.length > 0;
  // Vertical: the portrait gives way to the numbers when there are any.
  const hero = wide
    ? Math.min(height * 0.62, 560)
    : Math.min(width * (busy ? 0.42 : 0.72), height * (busy ? 0.3 : 0.5), busy ? 440 : 740);
  // Slow push-in on the face for as long as the card is up.
  const drift = 1 + Math.min(1, frame / fps / 12) * 0.06;
  const wipe = progress(frame, fps, 0, 0.9, EASE);
  const faceIn = progress(frame, fps, 0.25, 0.8, EASE);
  const [first, ...rest] = name.split(" ");
  const flagged = status && status.toLowerCase() !== "active";

  const portrait = (
    <div style={{ position: "relative", width: hero, height: hero, flexShrink: 0 }}>
      {/* club field, wiped on diagonally */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          overflow: "hidden",
          background: `linear-gradient(150deg, ${primary} 0%, ${secondary} 100%)`,
          clipPath: `polygon(0 0, ${wipe * 140}% 0, ${wipe * 100}% 100%, 0 100%)`,
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
        }}
      >
        <div style={{ position: "absolute", right: -hero * 0.18, bottom: -hero * 0.18, opacity: 0.22 }}>
          <TeamLogo team={team} league={league} size={hero * 0.9} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,.55) 100%)",
          }}
        />
        <Sheen period={5} delay={1.6} opacity={0.14} />
      </div>
      {headshot ? (
        <Img
          src={staticFile(headshot)}
          style={{
            position: "absolute",
            left: hero * 0.08,
            bottom: 0,
            width: hero * 0.84,
            height: hero * 0.84,
            objectFit: "cover",
            borderRadius: "50%",
            opacity: faceIn,
            translate: `0px ${(1 - faceIn) * 40}px`,
            scale: String(drift),
            transformOrigin: "50% 100%",
            filter: "drop-shadow(0 20px 30px rgba(0,0,0,.5))",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: hero * 0.3,
            color: "rgba(255,255,255,.85)",
            opacity: faceIn,
          }}
        >
          {position}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 22,
          top: 20,
          padding: "6px 14px",
          borderRadius: 8,
          background: "rgba(0,0,0,.55)",
          color: "#fff",
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: "0.06em",
          opacity: faceIn,
        }}
      >
        {position}
      </div>
    </div>
  );

  const info = (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: wide ? 22 : 26 }}>
      <div style={rise(frame, fps, 0.35)}>
        <Eyebrow size={wide ? 24 : 28}>{eyebrow}</Eyebrow>
      </div>
      <div style={rise(frame, fps, 0.45)}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: wide ? 50 : 56,
            lineHeight: 1,
            color: "var(--text-primary)",
          }}
        >
          {first}
        </div>
        <div
          className="chrome"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: wide ? 104 : 112,
            lineHeight: 0.95,
            letterSpacing: "-0.015em",
          }}
        >
          {rest.join(" ") || first}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", ...rise(frame, fps, 0.55) }}>
        <Caps size={wide ? 24 : 28} color={ink}>
          {role || position} · {teamName}
        </Caps>
      </div>
      <div style={{ ...rise(frame, fps, 0.65) }}>
        <EdgeRule width={interpolate(progress(frame, fps, 0.6, 0.8), [0, 1], [0, wide ? 520 : 600])} height={3} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, ...rise(frame, fps, 0.75) }}>
        <StatusPill status={status || "Active"} size={wide ? 22 : 24} />
        {flagged && detail ? (
          <Caps size={wide ? 22 : 24} style={{ textTransform: "none", letterSpacing: 0 }}>
            {detail}
          </Caps>
        ) : null}
      </div>
      {props.length ? (
        <div style={{ ...rise(frame, fps, 0.85) }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 140px 120px",
              columnGap: 12,
              paddingBottom: 6,
              borderBottom: "1px solid var(--border-card)",
            }}
          >
            <Caps size={wide ? 16 : 20}>Prop · DraftKings live</Caps>
            <Caps size={wide ? 16 : 20} style={{ textAlign: "right" }}>
              Line
            </Caps>
            <Caps size={wide ? 16 : 20} color="var(--text-accent)" style={{ textAlign: "right" }}>
              Model
            </Caps>
          </div>
          {(wide ? props : props.slice(0, 3)).map((pr, i) => {
            const gap = pr.line ? (pr.model - pr.line) / pr.line : 0;
            return (
              <div
                key={pr.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 140px 120px",
                  columnGap: 12,
                  alignItems: "center",
                  minHeight: wide ? 52 : 58,
                  borderBottom: "1px solid var(--border-card)",
                  ...rise(frame, fps, stagger(i, 0.95, 0.08)),
                }}
              >
                <div style={{ fontWeight: 700, fontSize: wide ? 22 : 26, color: "var(--text-primary)" }}>{pr.label}</div>
                <div style={{ textAlign: "right" }}>
                  <span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 34 : 40, color: toneFromRank(null, 32, "market") }}>
                    {pr.line}
                  </span>
                  {pr.open !== null && pr.open !== pr.line ? (
                    <div style={{ fontSize: wide ? 16 : 20, color: "var(--text-muted)", fontWeight: 700 }}>opened {pr.open}</div>
                  ) : null}
                </div>
                <div
                  className="num"
                  style={{
                    textAlign: "right",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: wide ? 34 : 40,
                    color: toneFromGap(gap),
                  }}
                >
                  {pr.model >= 10 ? pr.model.toFixed(1) : pr.model.toFixed(2)}
                </div>
              </div>
            );
          })}
          <Caps size={wide ? 16 : 20} style={{ marginTop: 10 }}>
            Model is research only and does not price props
          </Caps>
        </div>
      ) : null}
      {stats.length && !props.length ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {stats.map((s, i) => {
              const cat: StatCat = /epa|woba|osi|grade/i.test(s.label) ? "quality" : /%|rate/i.test(s.label) ? "rate" : "count";
              return (
              <Panel key={s.label} pad={wide ? "16px 20px" : "18px 22px"} style={rise(frame, fps, stagger(i, 0.85, 0.08))}>
                <Caps size={wide ? 16 : 20}>{s.label}</Caps>
                <div
                  className="num"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: wide ? 44 : 48,
                    color: toneFromRank(null, 32, cat),
                  }}
                >
                  {s.value}
                </div>
              </Panel>
              );
            })}
          </div>
          {statsLabel ? (
            <Caps size={wide ? 18 : 22} style={{ marginTop: 12, opacity: progress(frame, fps, 1.3, 0.5) }}>
              {statsLabel}
            </Caps>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <AbsoluteFill
      name="Player Card"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 70 : 60),
        paddingBottom: safe.bottom + 40,
        paddingLeft: wide ? 110 : 60,
        paddingRight: wide ? 110 : Math.max(60, safe.right),
        opacity: exit,
      }}
    >
      <Fit innerStyle={{ flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "stretch", gap: wide ? 70 : 28 }}>
      {wide ? portrait : <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>{portrait}</div>}
      {info}
      </Fit>
    </AbsoluteFill>
  );
};
