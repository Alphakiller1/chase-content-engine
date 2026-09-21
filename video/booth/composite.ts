import { toCanvas } from "html-to-image";
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

/** Clone canvases at on-screen size so logos are not dumped at PNG resolution. */
const withDisplaySizedBitmaps = async (root: HTMLElement, run: () => Promise<HTMLCanvasElement>) => {
  const inserted: HTMLImageElement[] = [];
  const hidden: HTMLCanvasElement[] = [];
  for (const canvas of root.querySelectorAll("canvas")) {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw < 2 || ch < 2) continue;
    let src = "";
    try {
      src = canvas.toDataURL("image/png");
    } catch {
      continue;
    }
    const img = document.createElement("img");
    img.src = src;
    img.width = cw;
    img.height = ch;
    img.style.cssText = canvas.style.cssText;
    img.style.width = `${cw}px`;
    img.style.height = `${ch}px`;
    img.style.objectFit = "contain";
    canvas.style.visibility = "hidden";
    canvas.after(img);
    hidden.push(canvas);
    inserted.push(img);
  }
  try {
    return await run();
  } finally {
    for (const img of inserted) img.remove();
    for (const canvas of hidden) canvas.style.visibility = "";
  }
};

/** One still of the board. Call on graphic change, never every frame. */
export const snapshotProgram = (el: HTMLElement, w: number, h: number): Promise<HTMLCanvasElement> =>
  withDisplaySizedBitmaps(el, () =>
    toCanvas(el, {
      pixelRatio: 1,
      cacheBust: false,
      skipFonts: true,
      skipAutoScale: true,
      style: { transform: "none" },
      filter: (node) => node.tagName !== "VIDEO" && node.tagName !== "AUDIO",
    }).then((shot) => {
      if (shot.width === w && shot.height === h) return shot;
      const fitted = document.createElement("canvas");
      fitted.width = w;
      fitted.height = h;
      fitted.getContext("2d")?.drawImage(shot, 0, 0, w, h);
      return fitted;
    }),
  );

export const paintBooth = (
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    h: number;
    geom: FrameGeom;
    video: HTMLVideoElement | null;
    graphicSnap: HTMLCanvasElement | null;
    mirror: boolean;
  },
) => {
  const { w, h, geom, video, graphicSnap, mirror } = opts;
  ctx.fillStyle = pageFill();
  ctx.fillRect(0, 0, w, h);
  const cam = geom.cam;
  if (video && cam.w > 0) {
    ctx.save();
    roundClip(ctx, cam.x, cam.y, cam.w, cam.h, cam.r);
    drawCover(ctx, video, cam.x, cam.y, cam.w, cam.h, mirror);
    ctx.restore();
  }
  if (graphicSnap && graphicSnap.width) ctx.drawImage(graphicSnap, 0, 0, w, h);
};

export const withAudio = (video: MediaStream, voice: MediaStream | null) => {
  const out = new MediaStream(video.getVideoTracks());
  for (const t of voice?.getAudioTracks() ?? []) {
    if (t.readyState === "live") out.addTrack(t.clone());
  }
  return out;
};
