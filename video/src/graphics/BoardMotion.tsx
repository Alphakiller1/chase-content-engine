import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { League } from "../teams";
import { Platform, useSafe } from "../ds/safe";
import "../fonts";
import { BrandLockup, Take } from "../ds/kit";
import "../theme.css";

/** One captured board, as written by content_engine's --video directive. */
export type BoardCapture = {
  /** Path under video/public, e.g. "captures/2026-09-08/compose_nfl_edges-1.png". */
  src: string;
  /** NATIVE (CSS) size of the artifact. The file itself is CAPTURE_DPR times this. */
  width: number;
  height: number;
  caption?: string;
};

export type BoardMotionProps = {
  platform: Platform;
  league: League;
  captures: BoardCapture[];
  eyebrow?: string;
  title?: string;
  sub?: string;
  /** Your angle. Rendered as opinion - italic on a violet rule - exactly as the
   *  still engine renders it, because the reader has to be able to tell an
   *  argument from a measurement. */
  take?: string;
  notes?: string[];
  footer?: string;
  /** Leave the ground transparent for an overlay cut instead of a full-frame one. */
  transparent?: boolean;
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const PAD = 72;

/** Headline size steps down as the claim gets longer, so a long title costs the
 *  board a line of height rather than half the frame. */
const titleSize = (text: string, wide: boolean) => {
  const base = wide ? 76 : 96;
  if (text.length > 58) return base * 0.66;
  if (text.length > 40) return base * 0.8;
  return base;
};

/**
 * How many lines a string will wrap to in a box `boxW` wide at `size`.
 *
 * An estimate, and it has to be: nothing here can measure rendered text without
 * reading it back after layout, and a solver that reads its own text metrics gives
 * a different answer before and after the webfonts swap in - which is exactly what
 * put two slides of an NFL carousel 3% apart. `advance` is the mean glyph width as
 * a fraction of font size, condensed uppercase running much tighter than body text.
 * Rounded UP and used only to reserve space, so being a line generous costs the
 * board a little room while being a line short would cut a headline in half.
 */
const lineCount = (text: string, size: number, boxW: number, advance: number) =>
  Math.max(1, Math.ceil(text.length / Math.max(1, boxW / (advance * size))));

/**
 * BOARD MOTION - the motion version of a still post, built from the SAME capture.
 *
 * The still engine's founding rule is that an artifact is a screenshot of the real
 * dashboard, so a post can never drift from the site (docs/CONTENT_ENGINE_SPEC.md
 * section 1). Rebuilding these tables in React would hand the video engine its own
 * copy of the site's design to fall out of date - the drift that killed
 * chase-content-engine. So this composition consumes the capture instead, which also
 * means every artifact the still engine can reach is animatable for free, including
 * ad-hoc --capture ones that were never written into any registry.
 *
 * The layout obeys the still engine's other law: ONE zoom for every artifact in the
 * post, applied in native units and centred, so type size is identical across boards
 * rather than each being stretched to the column.
 */
export const BoardMotion: React.FC<BoardMotionProps> = ({
  platform,
  captures,
  eyebrow,
  title,
  sub,
  take,
  notes,
  footer,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const wide = platform === "youtube";
  const safe = useSafe(platform);

  /* Bands are sized by what is actually in them and by nothing else - never by
     measuring the rendered text. Two slides of one carousel must agree on the
     board's scale, and a solver that reads its own text metrics disagrees with
     itself before and after the webfonts swap in: that is what made two slides of
     an NFL carousel come out 3% apart and jump on the swipe. Known heights for
     known content is the version that cannot do that. */
  const textW = width - PAD * 2;
  const tSize = title ? titleSize(title, wide) : 0;
  const headerH =
    (eyebrow ? 44 : 0) +
    (title ? lineCount(title, tSize, textW, 0.5) * tSize * 1.02 + 18 : 0) +
    (sub ? lineCount(sub, 32, textW, 0.52) * 43 + 18 : 0);
  const takeH = take ? (wide ? 130 : 180) : 0;
  const footerH = footer ? 86 : 0;

  /* Boards run nearly edge to edge while the text keeps the wider margin. On a
     1080-wide frame the difference is a whole readable step: these boards are
     captured at ~982px native, so a 72px text margin would scale them DOWN to
     0.95 while a 24px one lets them render slightly above native size. */
  const boardPad = 24;
  const boxW = width - boardPad * 2;
  const boxH =
    height - safe.top - safe.bottom - headerH - takeH - footerH - PAD;

  /* ONE zoom for every capture: fit the widest to the box, and the whole stack
     (plus the gaps between) to the height. Never upscale past the source's own
     pixels - the capture is CAPTURE_DPR times its native size, so 2x is safe. */
  const gap = 28;
  const widest = Math.max(...captures.map((c) => c.width), 1);
  const stackH =
    captures.reduce((sum, c) => sum + c.height, 0) + gap * (captures.length - 1);
  const zoom = Math.min(boxW / widest, boxH / Math.max(stackH, 1), 2);

  const rise = (startSeconds: number, shift = 34) => ({
    opacity: interpolate(
      frame,
      [startSeconds * fps, startSeconds * fps + 0.55 * fps],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
    ),
    translate:
      "0px " +
      interpolate(
        frame,
        [startSeconds * fps, startSeconds * fps + 0.8 * fps],
        [shift, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
      ) +
      "px",
  });

  return (
    <AbsoluteFill
      name="Board Motion"
      style={{
        backgroundColor: transparent ? "transparent" : "var(--surface-page)",
        fontFamily: "var(--font-body)",
        flexDirection: "column",
        paddingTop: safe.top,
        paddingBottom: safe.bottom,
      }}
    >
      {/* ── header ─────────────────────────────────────────────────────── */}
      <Interactive.Div
        name="Header"
        style={{
          minHeight: headerH,
          paddingLeft: PAD,
          paddingRight: PAD,
        }}
      >
        {eyebrow ? (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-accent)",
              marginBottom: 14,
              ...rise(0, 18),
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        {title ? (
          <div
            className="chrome"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: titleSize(title, wide),
              fontWeight: 700,
              lineHeight: 0.98,
              ...rise(0.15),
            }}
          >
            {title}
          </div>
        ) : null}
        {sub ? (
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.35,
              color: "var(--text-secondary)",
              marginTop: 18,
              ...rise(0.35, 22),
            }}
          >
            {sub}
          </div>
        ) : null}
      </Interactive.Div>

      {/* ── the captured boards, at one shared zoom ─────────────────────── */}
      <Interactive.Div
        name="Boards"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap,
          paddingLeft: boardPad,
          paddingRight: boardPad,
        }}
      >
        {captures.map((c, i) => (
          <Interactive.Div
            key={c.src}
            name={"Board " + (i + 1)}
            style={{
              /* The wipe is a scale from just under 1, not a slide: these are
                 dense tables, and translating one under a fixed header reads as
                 a glitch rather than a reveal. */
              opacity: interpolate(
                frame,
                [(0.55 + i * 0.25) * fps, (1.15 + i * 0.25) * fps],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: EASE,
                },
              ),
              scale: String(
                interpolate(
                  frame,
                  [(0.55 + i * 0.25) * fps, (1.35 + i * 0.25) * fps],
                  [0.965, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: EASE,
                  },
                ),
              ),
            }}
          >
            <CanvasImage
              src={staticFile(c.src)}
              style={{
                width: c.width * zoom,
                height: c.height * zoom,
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: 14,
                display: "block",
              }}
            />
          </Interactive.Div>
        ))}
      </Interactive.Div>

      {/* ── the take: the one slot styled as opinion ────────────────────── */}
      {take ? (
        <Interactive.Div
          name="Take"
          style={{
            height: takeH,
            display: "flex",
            alignItems: "center",
            gap: 24,
            paddingLeft: PAD,
            paddingRight: PAD,
            ...rise(1.4),
          }}
        >
          <Take size={36}>{take}</Take>
        </Interactive.Div>
      ) : null}

      {/* ── footer: the sport-correct site line the still post carries ──── */}
      {footer ? (
        <Interactive.Div
          name="Footer"
          style={{
            height: footerH,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid var(--border-strong)",
            marginLeft: PAD,
            marginRight: PAD,
            ...rise(1.7, 14),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <BrandLockup size={30} />
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 24,
                fontWeight: 600,
                color: "var(--text-accent)",
              }}
            >
              {footer}
            </div>
          </div>
          {notes && notes.length ? (
            <div style={{ fontSize: 22, color: "var(--text-muted)" }}>
              {notes[0]}
            </div>
          ) : null}
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
