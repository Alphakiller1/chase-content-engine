import type { FrameGeom } from "../src/edit/frames";

const pageFill = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--surface-page").trim();
  return v || "#0b0b0e";
};

const roundClip = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  ctx.clip();
};

const drawCover = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
  mirror: boolean,
) => {
  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  const s = Math.max(w / vw, h / vh);
  const dw = vw * s;
  const dh = vh * s;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  if (mirror) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, dx - x, dy - y, dw, dh);
  } else {
    ctx.drawImage(video, dx, dy, dw, dh);
  }
  ctx.restore();
};

/** The Remotion program canvas, never a nested team-logo CanvasImage. */
export const playerCanvas = (
  root: HTMLElement | null | undefined,
  w?: number,
  h?: number,
): HTMLCanvasElement | null => {
  if (!root) return null;
  const canvases = [...root.querySelectorAll("canvas")];
  if (!canvases.length) return null;
  const depth = (el: HTMLElement) => {
    let d = 0;
    for (let n = el.parentElement; n && n !== root; n = n.parentElement) d += 1;
    return d;
  };
  const score = (c: HTMLCanvasElement) => {
    const exact = w && h && c.width === w && c.height === h ? 0 : 1;
    const aspect =
      w && h && c.height
        ? Math.abs(c.width / c.height - w / h)
        : 99;
    return exact * 1_000_000 + aspect * 10_000 + depth(c) * 100 - Math.min(c.width * c.height, 9_000_000) / 1_000_000;
  };
  return [...canvases].sort((a, b) => score(a) - score(b))[0] ?? null;
};

/** Paint the booth picture (camera under graphics) onto a recording canvas. */
export const paintBooth = (
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    h: number;
    geom: FrameGeom;
    video: HTMLVideoElement | null;
    graphic: HTMLCanvasElement | null;
    mirror: boolean;
  },
) => {
  const { w, h, geom, video, graphic, mirror } = opts;
  ctx.fillStyle = pageFill();
  ctx.fillRect(0, 0, w, h);
  const cam = geom.cam;
  if (video && cam.w > 0) {
    ctx.save();
    roundClip(ctx, cam.x, cam.y, cam.w, cam.h, cam.r);
    drawCover(ctx, video, cam.x, cam.y, cam.w, cam.h, mirror);
    ctx.restore();
  }
  if (graphic && graphic.width) ctx.drawImage(graphic, 0, 0, w, h);
};

export const withAudio = (video: MediaStream, voice: MediaStream | null) => {
  const out = new MediaStream(video.getVideoTracks());
  for (const t of voice?.getAudioTracks() ?? []) {
    if (t.readyState === "live") out.addTrack(t.clone());
  }
  return out;
};
