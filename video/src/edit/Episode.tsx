import { createTikTokStyleCaptions } from "@remotion/captions";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandLockup, Caps, TeamLogo } from "../ds/kit";
import { EASE, progress } from "../ds/motion";
import { Insets, Platform, SafeOverride } from "../ds/safe";
import { Box, FrameGeom, LayoutMode, StageSize, Stroke, bugShift, frameGeom, lerpCam } from "./frames";
import { Ticker } from "../studio/Ticker";
import { CornerBug } from "../graphics/CornerBug";
import { LowerThird } from "../graphics/LowerThird";
import { League, teamAccent } from "../teams";
import { StatDuel } from "../stats/StatDuel";
import { LineGap } from "../stats/LineGap";
import { RankCountdown } from "../stats/RankCountdown";
import { NflCutaway } from "../graphics/NflCutaway";
import { ModelSnapshot } from "../graphics/ModelSnapshot";
import { MatchupCutaway } from "../graphics/MatchupCutaway";
import { BoardMotion } from "../graphics/BoardMotion";
import { Sting } from "../graphics/Sting";
import { Annotate } from "../tools/Annotate";
import { EpisodeOpen } from "../longform/EpisodeOpen";
import { EndScreen } from "../longform/EndScreen";
import { MatchupHero } from "./MatchupHero";
import { Formation } from "../studio/Formation";
import { PlayerCard } from "../studio/PlayerCard";
import { MetricBoard } from "../studio/MetricBoard";
import { LineMove } from "../studio/LineMove";
import { PropBoard } from "../studio/PropBoard";
import { LastGame } from "../studio/LastGame";
import { TeamCompare } from "../studio/TeamCompare";
import { QbMatchup } from "../studio/QbMatchup";
import { SchemeDiagram } from "../studio/SchemeDiagram";
import { MixTable } from "../studio/MixTable";
import { InjuryBoard } from "../studio/InjuryBoard";
import { ClashBoard } from "../studio/ClashBoard";
import { CoverHeat } from "../studio/CoverHeat";
import { QbStressTest } from "../studio/QbStressTest";
import "../fonts";

/**
 * THE AUTO-EDIT. One recording of the host talking becomes a finished video:
 *
 *   - the CONTENT owns the frame: a stage, centred, showing whichever data graphic
 *     the talk is about (cued by what was said - see scripts/edit.mjs);
 *   - the host is a small camera bubble, never the main picture;
 *   - dead air is cut (jump cuts) and every word is captioned;
 *   - wide adds the episode open and the YouTube end screen, vertical closes on
 *     the sting.
 *
 * Every number here is a layout constant in FRAME pixels; the stage scales the
 * graphics, which lay themselves out at the stage's virtual size.
 */

export type EditFormat = "vertical" | "wide";

/** A graphic on the stage, over [from, to) seconds of the BODY (after cuts). */
export type EditSegment = {
  id: string;
  label: string;
  composition: string;
  props: Record<string, unknown>;
  from: number;
  to: number;
  /** What was said that brought it up (for the plan printout). */
  cue?: string;
};

/** A kept span of the source recording, in source seconds, in playback order. */
export type EditCut = { from: number; to: number };

/** A caption word, in BODY seconds (after cuts). */
export type EditWord = { text: string; start: number; end: number };

/** Layout switches, in BODY seconds. The first one should be at 0. */
export type EditLayout = { from: number; mode: LayoutMode };

/** A small graphic laid over whatever is on the stage, for a span of BODY seconds. */
export type EditOverlay = { name: string; from: number; to: number; props: Record<string, unknown> };

/** Graphic size changes, in BODY seconds. */
export type EditSize = { from: number; size: StageSize };

/** A telestration stroke, shown from `from` until `until` (BODY seconds). */
export type EditStroke = Stroke & { from: number; until: number | null };

export type Bookend = { composition: string; props: Record<string, unknown>; seconds: number };

export type EpisodeProps = {
  format: EditFormat;
  platform: Platform;
  league: League;
  away: string;
  home: string;
  host: string;
  show: string;
  /** Short market line for the header chip, e.g. "BUF -4.5 · O/U 53.5". */
  line: string;
  camera: {
    src: string;
    /** 0-1 point of the source frame to keep centred in the bubble (your face). */
    focusX: number;
    focusY: number;
    /** Bubble diameter in frame px. */
    size: number;
    mirror: boolean;
    volume: number;
  } | null;
  music: { src: string; volume: number } | null;
  cuts: EditCut[];
  words: EditWord[];
  segments: EditSegment[];
  intro: Bookend | null;
  outro: Bookend | null;
  captions: boolean;
  layouts: EditLayout[];
  strokes: EditStroke[];
  overlays: EditOverlay[];
  sizes: EditSize[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GRAPHICS: Record<string, React.FC<any>> = {
  MatchupHero,
  Formation,
  FormationWide: Formation,
  PlayerCard,
  PlayerCardWide: PlayerCard,
  MetricBoard,
  MetricBoardWide: MetricBoard,
  LineMove,
  LineMoveWide: LineMove,
  PropBoard,
  PropBoardWide: PropBoard,
  LastGame,
  LastGameWide: LastGame,
  TeamCompare,
  TeamCompareWide: TeamCompare,
  QbMatchup,
  QbMatchupWide: QbMatchup,
  SchemeDiagram,
  SchemeDiagramWide: SchemeDiagram,
  MixTable,
  MixTableWide: MixTable,
  InjuryBoard,
  InjuryBoardWide: InjuryBoard,
  ClashBoard,
  ClashBoardWide: ClashBoard,
  CoverHeat,
  CoverHeatWide: CoverHeat,
  QbStressTest,
  QbStressTestWide: QbStressTest,
  Ticker,
  CornerBug,
  LowerThird,
  StatDuel,
  StatDuelWide: StatDuel,
  LineGap,
  LineGapWide: LineGap,
  RankCountdown,
  RankCountdownWide: RankCountdown,
  NflCutaway,
  ModelSnapshot,
  MatchupCutaway,
  Annotate,
  BoardMotion,
  BoardMotionWide: BoardMotion,
  Sting,
  EpisodeOpen,
  EpisodeOpenVertical: EpisodeOpen,
  EndScreen,
};

export const bodySeconds = (cuts: EditCut[]) => cuts.reduce((s, c) => s + (c.to - c.from), 0);

export const episodeDuration = (p: EpisodeProps, fps: number) =>
  Math.max(
    1,
    Math.round(((p.intro?.seconds ?? 0) + bodySeconds(p.cuts) + (p.outro?.seconds ?? 0)) * fps),
  );

/** Which layout is live at body time t, the one before it, and how far the switch has got. */
export const layoutAt = (layouts: EditLayout[], t: number) => {
  const list = layouts.length ? layouts : [{ from: 0, mode: "bubble" as LayoutMode }];
  let k = 0;
  for (let i = 0; i < list.length; i++) if (list[i].from <= t) k = i;
  const cur = list[k];
  const prev = k > 0 ? list[k - 1].mode : cur.mode;
  return { mode: cur.mode, prev, since: t - cur.from };
};

/**
 * Graphics built for a whole 9:16 frame (they predate the stage and set their own
 * margins). Inside a shorter stage they are letterboxed to fit rather than cropped.
 */
const FULL_FRAME = new Set(["ModelSnapshot", "NflCutaway", "MatchupCutaway"]);

export const Stage: React.FC<{
  box: FrameGeom["stage"];
  insets: Insets;
  segments: EditSegment[];
  offset: number;
  opacity?: number;
}> = ({ box, insets, segments, offset, opacity = 1 }) => {
  const { fps } = useVideoConfig();
  const vw = Math.round(box.w / box.scale);
  const vh = Math.round(box.h / box.scale);
  return (
    <div
      data-stage=""
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: vw,
        height: vh,
        transform: `scale(${box.scale})`,
        transformOrigin: "0 0",
        overflow: "hidden",
        opacity: box.visible ? opacity : 0,
      }}
    >
      <SafeOverride.Provider value={insets}>
        {segments.map((s) => {
          const Comp = GRAPHICS[s.composition];
          const from = Math.round((offset + s.from) * fps);
          const dur = Math.round((s.to - s.from) * fps);
          if (!Comp || dur <= 0) return null;
          const full = FULL_FRAME.has(s.composition);
          const fw = full ? 1080 : vw;
          const fh = full ? 1920 : vh;
          // Fit inside what the viewer actually sees: the stage minus the platform's reserves.
          const availW = vw - insets.right;
          const availH = vh - insets.bottom - insets.top;
          const k = full ? Math.min(availW / fw, availH / fh) : 1;
          return (
            <Sequence key={s.id + s.from} name={s.label} from={from} durationInFrames={dur} width={fw} height={fh} premountFor={fps}>
              {full ? (
                <div
                  style={{
                    position: "absolute",
                    left: (availW - fw * k) / 2,
                    top: insets.top + (availH - fh * k) / 2,
                    width: fw,
                    height: fh,
                    transform: `scale(${k})`,
                    transformOrigin: "0 0",
                  }}
                >
                  <Comp {...s.props} />
                </div>
              ) : (
                <Comp {...s.props} />
              )}
            </Sequence>
          );
        })}
      </SafeOverride.Provider>
    </div>
  );
};

/** The host's window on the recording: a ring-edged circle, or a rounded panel. */
const CameraWindow: React.FC<{
  camera: NonNullable<EpisodeProps["camera"]>;
  cuts: EditCut[];
  box: FrameGeom["cam"];
  ring: string;
}> = ({ camera, cuts, box, ring }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(progress(frame, fps, 0, 0.5, EASE), [0, 1], [0.6, 1]);
  const pad = box.ring ? 5 : 0;
  const fade = (len: number) => (f: number) =>
    camera.volume * interpolate(f, [0, 2, Math.max(2, len - 2), Math.max(3, len)], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const visible = camera.size > 0 && box.w > 1 && box.h > 1;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: Math.max(box.w, 1),
        height: Math.max(box.h, 1),
        borderRadius: box.r,
        padding: pad,
        boxSizing: "border-box",
        background: box.ring ? `conic-gradient(from 200deg, ${ring}, var(--accent) 45%, ${ring})` : "var(--border-card)",
        boxShadow: box.r ? "0 18px 50px rgba(0,0,0,.55)" : undefined,
        transform: `scale(${enter})`,
        // Hidden (size 0 or a layout without a camera): the track still plays.
        opacity: visible ? progress(frame, fps, 0, 0.3) : 0,
      }}
    >
      {/* position: relative makes this the clip box for the absolutely-placed video. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: Math.max(0, box.r - pad),
          overflow: "hidden",
          background: "var(--surface-card)",
        }}
      >
        <Series>
          {cuts.map((c, i) => {
            const a = Math.round(c.from * fps);
            const b = Math.round(c.to * fps);
            if (b <= a) return null;
            return (
              <Series.Sequence key={i} durationInFrames={b - a} name={`take ${i + 1}`}>
                <OffthreadVideo
                  src={staticFile(camera.src)}
                  trimBefore={a}
                  trimAfter={b}
                  volume={fade(b - a)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: `${camera.focusX * 100}% ${camera.focusY * 100}%`,
                    transform: camera.mirror ? "scaleX(-1)" : undefined,
                  }}
                />
              </Series.Sequence>
            );
          })}
        </Series>
      </div>
    </div>
  );
};

/** Word-by-word captions: the page being said, the current word in accent ink. */
const Captions: React.FC<{ words: EditWord[]; box: FrameGeom["captions"] }> = ({ words, box }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * 1000;
  const pages = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: words.map((w) => ({
          text: (w.text.startsWith(" ") ? "" : " ") + w.text,
          startMs: w.start * 1000,
          endMs: w.end * 1000,
          timestampMs: null,
          confidence: null,
        })),
        combineTokensWithinMilliseconds: box.lines > 1 ? 1500 : 900,
        breakOnSilenceAfterMilliseconds: 600,
      }).pages,
    [words, box.lines],
  );
  const page = pages.find((pg) => t >= pg.startMs && t < pg.startMs + Math.max(pg.durationMs, 400) + 250);
  if (!page) return null;
  const into = t - page.startMs;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        display: "flex",
        alignItems: "center",
        justifyContent: box.align === "center" ? "center" : "flex-start",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: box.size,
          lineHeight: 1.12,
          textAlign: box.align,
          color: "var(--text-primary)",
          textShadow: "0 3px 14px rgba(0,0,0,.6)",
          opacity: interpolate(into, [0, 120], [0, 1], { extrapolateRight: "clamp" }),
          translate: `0px ${interpolate(into, [0, 160], [10, 0], { extrapolateRight: "clamp" })}px`,
          display: "-webkit-box",
          WebkitLineClamp: box.lines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          ...(box.plate
            ? { background: "rgba(5,5,6,.78)", padding: "10px 22px", borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,.4)" }
            : {}),
        }}
      >
        {page.tokens.map((tok, i) => {
          const on = t >= tok.fromMs && t < tok.toMs;
          const said = t >= tok.fromMs;
          return (
            <span
              key={i}
              style={{
                color: on ? "var(--text-accent)" : said ? "var(--text-primary)" : "var(--text-secondary)",
                whiteSpace: "pre",
              }}
            >
              {tok.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const Header: React.FC<{ p: Pick<EpisodeProps, "away" | "home" | "league" | "line">; box: Box; plate?: boolean }> = ({
  p,
  box,
  plate,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: progress(frame, fps, 0.1, 0.4),
        ...(plate ? { background: "rgba(5,5,6,.72)", padding: "10px 18px", borderRadius: 14 } : {}),
      }}
    >
      <TeamLogo team={p.away} league={p.league} size={44} />
      <Caps size={24} color="var(--text-primary)">
        {p.away} at {p.home}
      </Caps>
      <TeamLogo team={p.home} league={p.league} size={44} />
      {p.line ? (
        <Caps size={22} style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
          {p.line}
        </Caps>
      ) : null}
    </div>
  );
};

const TONE_INK: Record<Stroke["tone"], string> = {
  accent: "var(--accent)",
  positive: "var(--mark-positive)",
  negative: "var(--mark-negative)",
  caution: "var(--mark-caution)",
  primary: "#ffffff",
};

/** Telestration: each stroke redraws at the speed it was drawn, then fades at `until`. */
export const DrawLayer: React.FC<{ strokes: EditStroke[]; t: number; width: number; height: number }> = ({
  strokes,
  t,
  width,
  height,
}) => (
  <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    <defs>
      <filter id="ink-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#000" floodOpacity="0.7" />
      </filter>
    </defs>
    {strokes.map((s) => {
      const el = t - s.from;
      if (el < 0 || s.points.length < 2) return null;
      const off = s.until !== null ? Math.min(1, Math.max(0, (t - s.until) / 0.3)) : 0;
      if (off >= 1) return null;
      const pts = s.points.filter((p) => p[2] <= el);
      if (pts.length < 2) return null;
      const d = pts.map((p, i) => `${i ? "L" : "M"}${(p[0] * width).toFixed(1)},${(p[1] * height).toFixed(1)}`).join(" ");
      const ink = TONE_INK[s.tone] ?? TONE_INK.accent;
      const done = pts.length === s.points.length;
      let head = null;
      if (s.arrow && done) {
        const a = s.points[s.points.length - 1];
        // Direction from a point a little way back, so a wobble at the end does not skew it.
        const b = s.points[Math.max(0, s.points.length - 6)];
        const ang = Math.atan2((a[1] - b[1]) * height, (a[0] - b[0]) * width);
        const L = 34;
        const x = a[0] * width;
        const y = a[1] * height;
        head = (
          <path
            d={`M${x + L * Math.cos(ang + 2.6)},${y + L * Math.sin(ang + 2.6)} L${x},${y} L${x + L * Math.cos(ang - 2.6)},${y + L * Math.sin(ang - 2.6)}`}
            fill="none"
            stroke={ink}
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      }
      return (
        <g key={s.id + "-" + s.from} opacity={1 - off} filter="url(#ink-glow)">
          <path d={d} fill="none" stroke={ink} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
          {head}
        </g>
      );
    })}
  </svg>
);

const Body: React.FC<{ p: EpisodeProps; offset: number }> = ({ p, offset }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const bodyLen = bodySeconds(p.cuts);
  const t = frame / fps - offset;
  const camSize = p.camera?.size ?? 0; // 0 = audio-only
  const { mode, prev, since } = layoutAt(p.layouts ?? [], Math.max(0, t));
  const sizes = p.sizes ?? [];
  let size: StageSize = "full";
  for (const x of sizes) if (x.from <= t) size = x.size;
  const G = frameGeom(p.format, p.platform, mode, camSize, size);
  const P = frameGeom(p.format, p.platform, prev, camSize, size);
  const swap = prev === mode ? 1 : progress(since * fps, fps, 0, 0.45, EASE);
  const cam = lerpCam(P.cam, G.cam, swap);
  // The stage cuts to its new shape and fades up, so no graphic is seen mid-reflow.
  const stageFade = prev === mode ? 1 : Math.min(1, since / 0.3);
  const ring = teamAccent(p.home, p.league);
  const inBody = t >= 0 && t < bodyLen;
  return (
    <>
      <Stage box={G.stage} insets={G.insets} segments={p.segments} offset={offset} opacity={stageFade} />
      {(p.overlays ?? []).map((o, i) => {
        const Comp = GRAPHICS[o.name];
        const from = Math.round((offset + o.from) * fps);
        const dur = Math.round((o.to - o.from) * fps);
        if (!Comp || dur <= 0) return null;
        // The bug is drawn top-left; in vertical that is the host strip, so it moves down.
        const shift = o.name === "CornerBug" ? bugShift(p.format, p.platform, mode) : 0;
        return (
          <Sequence key={`${o.name}-${i}`} name={o.name} from={from} durationInFrames={dur}>
            <div style={{ position: "absolute", inset: 0, transform: shift ? `translateY(${shift}px)` : undefined }}>
              <Comp {...o.props} />
            </div>
          </Sequence>
        );
      })}
      {inBody ? <DrawLayer strokes={p.strokes ?? []} t={t} width={width} height={height} /> : null}
      <Sequence from={Math.round(offset * fps)} durationInFrames={Math.max(1, Math.round(bodyLen * fps))} name="Host">
        {p.camera ? <CameraWindow camera={p.camera} cuts={p.cuts} box={cam} ring={ring} /> : null}
        {G.lockup ? (
          <div style={{ position: "absolute", left: G.lockup.x, top: G.lockup.y - G.lockup.size, opacity: stageFade }}>
            <BrandLockup size={G.lockup.size} muted={mode !== "host"} />
          </div>
        ) : null}
        {G.header ? <Header p={p} box={G.header} plate={mode === "host"} /> : null}
        {p.captions ? <Captions words={p.words} box={G.captions} /> : null}
      </Sequence>
    </>
  );
};

const FullFrame: React.FC<{ b: Bookend }> = ({ b }) => {
  const Comp = GRAPHICS[b.composition];
  return Comp ? <Comp {...b.props} /> : null;
};

export const Episode: React.FC<EpisodeProps> = (p) => {
  const { fps } = useVideoConfig();
  const intro = p.intro?.seconds ?? 0;
  const body = bodySeconds(p.cuts);
  return (
    <AbsoluteFill style={{ background: "var(--surface-page)", fontFamily: "var(--font-body)" }}>
      {p.intro ? (
        <Sequence durationInFrames={Math.round(intro * fps)} name="Open">
          <FullFrame b={p.intro} />
        </Sequence>
      ) : null}
      <Body p={p} offset={intro} />
      {p.outro ? (
        <Sequence from={Math.round((intro + body) * fps)} durationInFrames={Math.round(p.outro.seconds * fps)} name="Close">
          <FullFrame b={p.outro} />
        </Sequence>
      ) : null}
      {p.music ? <Audio src={staticFile(p.music.src)} volume={() => p.music?.volume ?? 1} loop /> : null}
    </AbsoluteFill>
  );
};
