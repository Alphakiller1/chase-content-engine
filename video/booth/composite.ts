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

const mapRect = (el: Element, origin: DOMRect, frameW: number, frameH: number) => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || !origin.width || !origin.height) return null;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return null;
  return {
    x: ((r.left - origin.left) / origin.width) * frameW,
    y: ((r.top - origin.top) / origin.height) * frameH,
    w: (r.width / origin.width) * frameW,
    h: (r.height / origin.height) * frameH,
  };
};

/** Draw every nested canvas/image at its on-screen box. Never stretch one logo over the frame. */
export const drawGraphicLayers = (
  ctx: CanvasRenderingContext2D,
  root: HTMLElement,
  frameW: number,
  frameH: number,
) => {
  const origin = root.getBoundingClientRect();
  const anyCtx = ctx as CanvasRenderingContext2D & {
    drawElementImage?: (el: Element, dx: number, dy: number, dw: number, dh: number) => void;
  };
  if (typeof anyCtx.drawElementImage === "function") {
    try {
      anyCtx.drawElementImage(root, 0, 0, frameW, frameH);
      return;
    } catch {
      /* fall through to mapped layers */
    }
  }
  for (const el of root.querySelectorAll("canvas, img, svg")) {
    const box = mapRect(el, origin, frameW, frameH);
    if (!box) continue;
    try {
      ctx.drawImage(el as CanvasImageSource, box.x, box.y, box.w, box.h);
    } catch {
      /* tainted or zero-size source */
    }
  }
};

export const rasterizeGraphic = (el: HTMLElement, w: number, h: number): Promise<HTMLCanvasElement> =>
  toCanvas(el, {
    width: w,
    height: h,
    canvasWidth: w,
    canvasHeight: h,
    pixelRatio: 1,
    cacheBust: false,
    skipFonts: true,
    filter: (node) => {
      const tag = node.tagName;
      return tag !== "VIDEO" && tag !== "AUDIO";
    },
  });

/** Paint the booth picture (camera under graphics) onto a recording canvas. */
export const paintBooth = (
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    h: number;
    geom: FrameGeom;
    video: HTMLVideoElement | null;
    graphicRoot: HTMLElement | null;
    graphicSnap: HTMLCanvasElement | null;
    mirror: boolean;
  },
) => {
  const { w, h, geom, video, graphicRoot, graphicSnap, mirror } = opts;
  ctx.fillStyle = pageFill();
  ctx.fillRect(0, 0, w, h);
  const cam = geom.cam;
  if (video && cam.w > 0) {
    ctx.save();
    roundClip(ctx, cam.x, cam.y, cam.w, cam.h, cam.r);
    drawCover(ctx, video, cam.x, cam.y, cam.w, cam.h, mirror);
    ctx.restore();
  }
  if (graphicSnap && graphicSnap.width) {
    ctx.drawImage(graphicSnap, 0, 0, w, h);
  } else if (graphicRoot) {
    drawGraphicLayers(ctx, graphicRoot, w, h);
  }
};

export const withAudio = (video: MediaStream, voice: MediaStream | null) => {
  const out = new MediaStream(video.getVideoTracks());
  for (const t of voice?.getAudioTracks() ?? []) {
    if (t.readyState === "live") out.addTrack(t.clone());
  }
  return out;
};
