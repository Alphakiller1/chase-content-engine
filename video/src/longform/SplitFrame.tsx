import { AbsoluteFill, Img, Interactive, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLockup, Caps, Deck, Eyebrow, Panel, TeamLogo, Title } from "../ds/kit";
import { EASE_DRAW, exitAt, progress, rise, slide, stagger } from "../ds/motion";
import { League, teamAccent } from "../teams";
import "../fonts";

export type SplitStat = { label: string; value: string; team?: string; note?: string };

export type SplitFrameProps = {
  league: League;
  away: string;
  home: string;
  /** Which side the camera window takes. */
  camera?: "left" | "right";
  /** Share of the width the camera window takes (0.4 - 0.7). */
  cameraShare?: number;
  eyebrow?: string;
  title?: string;
  /** A site capture (from content_engine --video), shown fitted in the panel. */
  capture?: { src: string; width: number; height: number };
  stats?: SplitStat[];
  bullets?: string[];
  kickoff?: string;
  footer?: string;
};

/**
 * Long-form "desk" layout, 16:9: a transparent camera window beside a data panel.
 * The talking head keeps half the frame while the evidence sits next to it - the
 * layout long-form analysis leans on, where a full cutaway would lose the host.
 */
export const SplitFrame: React.FC<SplitFrameProps> = ({
  league,
  away,
  home,
  camera = "left",
  cameraShare = 0.52,
  eyebrow,
  title,
  capture,
  stats,
  bullets,
  kickoff,
  footer,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const share = Math.max(0.4, Math.min(0.7, cameraShare));
  const gutter = 40;
  const topH = 110;
  const camW = Math.round(width * share);
  const panelW = width - camW - gutter * 3;
  const panelLeft = camera === "left" ? camW + gutter * 2 : gutter;
  const camLeft = camera === "left" ? gutter : panelLeft + panelW + gutter;
  const bodyTop = topH + gutter;
  const bodyH = height - bodyTop - gutter;
  const reveal = progress(frame, fps, 0.2, 0.8, EASE_DRAW);

  // Panel content box (inside Panel padding).
  const innerW = panelW - 64;
  const headH = (eyebrow ? 44 : 0) + (title ? 130 : 0);
  const capBoxH = bodyH - 64 - headH - (stats?.length ? 0 : 0);
  const capZoom = capture
    ? Math.min(innerW / capture.width, capBoxH / capture.height, 2)
    : 1;

  return (
    <AbsoluteFill name="Split Frame" style={{ opacity: exit }}>
      {/* top strip */}
      <Interactive.Div
        name="Top Strip"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: topH,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${gutter + 8}px`,
          background: "var(--vid-glass-strong)",
          borderBottom: "1px solid var(--border-card)",
          ...rise(frame, fps, 0, -16),
        }}
      >
        <BrandLockup size={30} />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <TeamLogo team={away} league={league} size={56} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 44, color: teamAccent(away, league) }}>
            {away}
          </span>
          <Caps size={20}>at</Caps>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 44, color: teamAccent(home, league) }}>
            {home}
          </span>
          <TeamLogo team={home} league={league} size={56} />
        </div>
        <Caps size={20}>{kickoff ?? ""}</Caps>
      </Interactive.Div>

      {/* camera window: transparent, framed by a hairline and the brand edge */}
      <div
        style={{
          position: "absolute",
          top: bodyTop,
          left: camLeft,
          width: camW,
          height: bodyH,
          borderRadius: "var(--radius-md)",
          boxShadow: "0 0 0 3px var(--border-strong)",
          clipPath: `inset(0 0 ${(1 - reveal) * 100}% 0)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: 5,
            width: `${reveal * 100}%`,
            background: "var(--edge-brand)",
            borderRadius: 3,
          }}
        />
      </div>

      {/* data panel */}
      <Interactive.Div
        name="Panel"
        style={{
          position: "absolute",
          top: bodyTop,
          left: panelLeft,
          width: panelW,
          height: bodyH,
          ...slide(frame, fps, 0.3, camera === "left" ? 80 : -80),
        }}
      >
        <Panel pad={32} style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "var(--vid-glass)" }}>
          {eyebrow ? <Eyebrow size={24}>{eyebrow}</Eyebrow> : null}
          {title ? (
            <div style={{ marginTop: 8 }}>
              <Title size={64}>{title}</Title>
            </div>
          ) : null}

          {capture ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20, opacity: progress(frame, fps, 0.7, 0.6) }}>
              <Img
                src={staticFile(capture.src)}
                style={{
                  width: capture.width * capZoom,
                  height: capture.height * capZoom,
                  borderRadius: 10,
                }}
              />
            </div>
          ) : null}

          {stats?.length ? (
            <div style={{ marginTop: 26, display: "flex", flexDirection: "column" }}>
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 20,
                    padding: "18px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-default)",
                    ...rise(frame, fps, stagger(i, 0.7, 0.12), 16),
                  }}
                >
                  <div>
                    <Caps size={22}>{s.label}</Caps>
                    {s.note ? <div style={{ fontSize: 20, color: "var(--text-muted)", marginTop: 4 }}>{s.note}</div> : null}
                  </div>
                  <div
                    className="num"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: 58,
                      lineHeight: 1,
                      color: s.team ? teamAccent(s.team, league) : "var(--text-primary)",
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {bullets?.length ? (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {bullets.map((b, i) => (
                <div key={b} style={{ display: "flex", gap: 16, ...rise(frame, fps, stagger(i, 0.9, 0.15), 14) }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: "var(--accent)", marginTop: 14, flexShrink: 0 }} />
                  <Deck size={30} style={{ color: "var(--text-primary)" }}>{b}</Deck>
                </div>
              ))}
            </div>
          ) : null}

          {footer ? (
            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <Deck size={20}>{footer}</Deck>
            </div>
          ) : null}
        </Panel>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
