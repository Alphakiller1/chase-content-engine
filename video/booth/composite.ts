/**
 * Hosted broadcast take — one pipeline. Do not add live tab capture or
 * per-frame snapshots (those stall Remotion).
 *
 *   LIVE     camera + mic only
 *   STILLS   captured when a board is sitting on screen
 *   SAVE     after Stop, burn those stills onto the camera file
 */
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

const SKIP = new Set(["VIDEO", "AUDIO", "CANVAS", "IMG", "SVG"]);

const drawBitmapsAtLayout = (ctx: CanvasRenderingContext2D, root: HTMLElement, frameW: number, frameH: number) => {
  const origin = root.getBoundingClientRect();
  if (!origin.width || !origin.height) return;
  for (const el of root.querySelectorAll("canvas, img")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const dw = (r.width / origin.width) * frameW;
    const dh = (r.height / origin.height) * frameH;
    if (dw > frameW * 0.55 && dh > frameH * 0.55) continue;
    try {
      ctx.drawImage(el as CanvasImageSource, ((r.left - origin.left) / origin.width) * frameW, ((r.top - origin.top) / origin.height) * frameH, dw, dh);
    } catch {
      /* tainted */
    }
  }
};

export type BoardStill = {
  t: number;
  canvas: HTMLCanvasElement;
  geom: FrameGeom;
  mirror: boolean;
};

/** Still of the board. Call while idle or on a graphic change — never every frame. */
export const snapshotProgram = async (el: HTMLElement, w: number, h: number): Promise<HTMLCanvasElement> => {
  const shot = await toCanvas(el, {
    pixelRatio: 1,
    cacheBust: false,
    skipFonts: true,
    skipAutoScale: true,
    style: { transform: "none" },
    filter: (node) => !SKIP.has(node.tagName),
  });
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return shot;
  ctx.drawImage(shot, 0, 0, w, h);
  drawBitmapsAtLayout(ctx, el, w, h);
  return out;
};

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

const stillAt = (stills: BoardStill[], t: number) => {
  let hit = stills[0] ?? null;
  for (const s of stills) if (s.t <= t + 0.05) hit = s;
  return hit;
};

/** After the take: lay boards onto the camera file. The booth is not running this. */
export const burnBroadcast = (
  opts: {
    camera: Blob;
    stills: BoardStill[];
    w: number;
    h: number;
    fallbackGeom: FrameGeom;
    mirror: boolean;
    mimeType: string;
  },
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(opts.camera);
    const v = document.createElement("video");
    v.src = url;
    v.playsInline = true;
    v.muted = false;
    v.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px";
    document.body.appendChild(v);

    const canvas = document.createElement("canvas");
    canvas.width = opts.w;
    canvas.height = opts.h;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) {
      URL.revokeObjectURL(url);
      v.remove();
      reject(new Error("Could not paint the broadcast take"));
      return;
    }

    const finish = (blob: Blob) => {
      cancelAnimationFrame(raf);
      URL.revokeObjectURL(url);
      v.remove();
      resolve(blob);
    };

    let raf = 0;
    const paint = () => {
      const s = stillAt(opts.stills, v.currentTime);
      paintBooth(ctx, {
        w: opts.w,
        h: opts.h,
        geom: s?.geom ?? opts.fallbackGeom,
        video: v,
        graphicSnap: s?.canvas ?? null,
        mirror: s?.mirror ?? opts.mirror,
      });
      if (!v.ended) raf = requestAnimationFrame(paint);
    };

    v.onerror = () => {
      URL.revokeObjectURL(url);
      v.remove();
      reject(new Error("Could not read the camera take"));
    };
    v.onloadeddata = async () => {
      try {
        await v.play();
      } catch (e) {
        URL.revokeObjectURL(url);
        v.remove();
        reject(e);
        return;
      }
      const dest = canvas.captureStream(30);
      const captured = typeof v.captureStream === "function" ? v.captureStream() : null;
      const mixed = withAudio(dest, captured);
      const types = [opts.mimeType, "video/webm;codecs=vp8,opus", "video/webm"];
      const mimeType = types.find((t) => t && MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 160_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        mixed.getTracks().forEach((t) => t.stop());
        finish(new Blob(chunks, { type: mimeType || "video/webm" }));
      };
      rec.onerror = () => reject(new Error("Burn-in recorder failed"));
      rec.start(250);
      paint();
      v.onended = () => {
        cancelAnimationFrame(raf);
        paint();
        window.setTimeout(() => rec.stop(), 250);
      };
    };
  });
