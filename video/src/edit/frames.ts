/**
 * Frame layouts for the auto-edit and the recording booth, one source for both.
 *
 *   bubble  the default: content owns the frame, the host is a small round camera
 *   split   host and content side by side (wide) or stacked (vertical)
 *   full    content only; the camera is gone but the voice carries on
 *   host    the camera fills the frame (cold opens, sign-offs)
 *
 * Every box is in FRAME pixels. The stage renders graphics at (w / scale, h / scale)
 * and scales them down, so a graphic lays itself out for the stage it is given.
 */
import { Insets, Platform, SAFE } from "../ds/safe";

export type LayoutMode = "bubble" | "split" | "full" | "host";
export const LAYOUT_MODES: LayoutMode[] = ["bubble", "split", "full", "host"];
export type Box = { x: number; y: number; w: number; h: number };

export type FrameGeom = {
  width: number;
  height: number;
  stage: Box & { scale: number; visible: boolean };
  insets: Insets;
  /** Camera window; r is the corner radius (w / 2 = a circle). w = 0 hides it. */
  cam: Box & { r: number; ring: boolean };
  captions: Box & { align: "left" | "center"; size: number; lines: number; plate: boolean };
  /** Matchup + line strip (vertical bubble, host). */
  header: Box | null;
  lockup: { x: number; y: number; size: number } | null;
};

/** Graphic size on the stage: full frame, or pulled in so the picture breathes. */
export const STAGE_SIZES = { full: 1, compact: 0.88, small: 0.76 } as const;
export type StageSize = keyof typeof STAGE_SIZES;

export function frameGeom(
  format: "vertical" | "wide",
  platform: Platform,
  mode: LayoutMode,
  camSize: number,
  size: StageSize = "full",
): FrameGeom {
  const g = frameGeomBase(format, platform, mode, camSize);
  const k = STAGE_SIZES[size] ?? 1;
  if (k >= 1) return g;
  // Shrink the stage about its own centre; everything else stays where it is.
  const st = g.stage;
  return {
    ...g,
    stage: { ...st, x: st.x + (st.w * (1 - k)) / 2, y: st.y + (st.h * (1 - k)) / 2, w: st.w * k, h: st.h * k },
    insets: { top: g.insets.top / k, right: g.insets.right / k, bottom: g.insets.bottom / k },
  };
}

function frameGeomBase(format: "vertical" | "wide", platform: Platform, mode: LayoutMode, camSize: number): FrameGeom {
  if (format === "wide") {
    const W = 1920;
    const H = 1080;
    const cs = camSize;
    const bubbleCam = { x: W - 28 - cs, y: H - 22 - cs, w: cs, h: cs, r: cs / 2, ring: true };
    const hidden = { x: bubbleCam.x + cs / 2, y: bubbleCam.y + cs / 2, w: 0, h: 0, r: 0, ring: false };
    const none: Insets = { top: 0, right: 0, bottom: 0 };
    if (mode === "split") {
      return {
        width: W, height: H,
        stage: { x: 670, y: 40, w: 1210, h: 860, scale: 0.68, visible: true },
        insets: none,
        cam: { x: 40, y: 40, w: 600, h: 860, r: 24, ring: false },
        captions: { x: 40, y: 918, w: 1840, h: 130, align: "center", size: 46, lines: 2, plate: false },
        header: null,
        lockup: null,
      };
    }
    if (mode === "full") {
      return {
        width: W, height: H,
        stage: { x: 96, y: 12, w: 1728, h: 972, scale: 0.9, visible: true },
        insets: none,
        cam: hidden,
        captions: { x: 200, y: 988, w: 1520, h: 84, align: "center", size: 42, lines: 1, plate: false },
        header: null,
        lockup: { x: 40, y: 1046, size: 22 },
      };
    }
    if (mode === "host") {
      return {
        width: W, height: H,
        stage: { x: 192, y: 28, w: 1536, h: 864, scale: 0.8, visible: false },
        insets: none,
        cam: { x: 0, y: 0, w: W, h: H, r: 0, ring: false },
        captions: { x: 260, y: 900, w: 1400, h: 140, align: "center", size: 50, lines: 2, plate: true },
        header: null,
        lockup: { x: 48, y: 72, size: 30 },
      };
    }
    return {
      width: W, height: H,
      stage: { x: 192, y: 28, w: 1536, h: 864, scale: 0.8, visible: true },
      insets: none,
      cam: bubbleCam,
      captions: { x: 232, y: 902, w: 1456, h: 158, align: "center", size: 46, lines: 2, plate: false },
      header: null,
      lockup: { x: 40, y: 1046, size: 24 },
    };
  }

  const W = 1080;
  const H = 1920;
  // The apps' right-hand buttons sit low in the frame, inside the bottom band we
  // already keep clear, so content keeps equal side margins (and stays centred).
  const safe = { ...SAFE[platform], right: 64 };
  const cs = Math.max(camSize, 200);
  const bubbleCam = { x: 48, y: safe.top + 10, w: camSize, h: camSize, r: camSize / 2, ring: true };
  const textX = 48 + cs + 36;
  if (mode === "split") {
    const camH = 620;
    const top = safe.top + camH + 30;
    const scale = 0.92;
    return {
      width: W, height: H,
      stage: { x: 0, y: top, w: W, h: H - top, scale, visible: true },
      insets: { top: 0, right: safe.right / scale, bottom: safe.bottom / scale },
      cam: { x: 40, y: safe.top, w: W - 80, h: camH, r: 28, ring: false },
      captions: { x: 70, y: safe.top + camH - 170, w: W - 140, h: 150, align: "center", size: 50, lines: 2, plate: true },
      header: null,
      lockup: null,
    };
  }
  if (mode === "full") {
    const scale = 1;
    return {
      width: W, height: H,
      stage: { x: 0, y: safe.top, w: W, h: H - safe.top, scale, visible: true },
      // Leave a band above the platform's bottom reserve for the captions.
      insets: { top: 0, right: safe.right / scale, bottom: (safe.bottom + 170) / scale },
      cam: { x: bubbleCam.x + camSize / 2, y: bubbleCam.y + camSize / 2, w: 0, h: 0, r: 0, ring: false },
      captions: { x: 60, y: H - safe.bottom - 165, w: W - 60 - safe.right, h: 150, align: "center", size: 50, lines: 2, plate: true },
      header: null,
      lockup: null,
    };
  }
  if (mode === "host") {
    return {
      width: W, height: H,
      stage: { x: 0, y: safe.top + cs + 36, w: W, h: H - (safe.top + cs + 36), scale: 1, visible: false },
      insets: { top: 0, right: safe.right, bottom: safe.bottom },
      cam: { x: 0, y: 0, w: W, h: H, r: 0, ring: false },
      captions: { x: 60, y: H - safe.bottom - 200, w: W - 60 - safe.right, h: 180, align: "center", size: 58, lines: 2, plate: true },
      header: { x: 60, y: safe.top, w: W - 120, h: 70 },
      lockup: null,
    };
  }
  const top = safe.top + cs + 36;
  return {
    width: W, height: H,
    // Full size: graphics are designed at 1080 wide, so nothing is shrunk.
    stage: { x: 0, y: top, w: W, h: H - top, scale: 1, visible: true },
    insets: { top: 0, right: safe.right, bottom: safe.bottom },
    cam: bubbleCam,
    captions: { x: textX, y: safe.top + 66, w: W - textX - 48, h: cs - 54, align: "left", size: 52, lines: 3, plate: false },
    header: { x: textX, y: safe.top + 4, w: W - textX - 48, h: 60 },
    lockup: camSize ? null : { x: 48, y: safe.top + 50, size: 28 },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera window between two layouts, t in 0..1. */
export function lerpCam(a: FrameGeom["cam"], b: FrameGeom["cam"], t: number): FrameGeom["cam"] {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    r: lerp(a.r, b.r, t),
    ring: t < 0.5 ? a.ring : b.ring,
  };
}

/** A drawn stroke, in frame fractions; dt = seconds after the stroke began. */
export type Stroke = {
  id: number;
  tone: "accent" | "positive" | "negative" | "caution" | "primary";
  arrow: boolean;
  points: [number, number, number][];
  /** The format it was drawn over; the edit shows it only there. */
  format?: "vertical" | "wide";
};

/**
 * The corner bug is drawn at the top-left of a full frame, where a vertical edit keeps
 * the host strip. This is how far down to push it so it sits clear, low in the picture.
 */
export const bugShift = (format: "vertical" | "wide", platform: Platform, mode: LayoutMode): number => {
  if (format === "wide" || mode === "host") return 0;
  const g = frameGeom(format, platform, mode, 0);
  return Math.max(0, g.height - g.insets.bottom - 150 - 96);
};
