/**
 * Hosted takes must be the booth pixels, not a second renderer.
 * Chrome Region Capture crops this tab to the program frame.
 */
export const captureProgram = async (el: HTMLElement): Promise<MediaStream> => {
  const w = window as unknown as {
    CaptureController?: new () => { setFocusBehavior?: (b: string) => void };
    CropTarget?: { fromElement: (node: Element) => Promise<unknown> };
  };
  const controller = w.CaptureController ? new w.CaptureController() : undefined;
  try {
    controller?.setFocusBehavior?.("no-focus-change");
  } catch {
    /* older Chrome */
  }
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30, displaySurface: "browser" },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
    ...(controller ? { controller } : {}),
  } as DisplayMediaStreamOptions);
  const track = display.getVideoTracks()[0] as MediaStreamTrack & { cropTo?: (t: unknown) => Promise<void> };
  if (w.CropTarget && track?.cropTo) {
    const target = await w.CropTarget.fromElement(el);
    await track.cropTo(target);
  }
  return display;
};

export const cropProgram = async (stream: MediaStream, el: HTMLElement) => {
  const CropTarget = (window as unknown as { CropTarget?: { fromElement: (node: Element) => Promise<unknown> } }).CropTarget;
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { cropTo?: (t: unknown) => Promise<void> };
  if (!CropTarget || !track?.cropTo) return;
  await track.cropTo(await CropTarget.fromElement(el));
};

export const withAudio = (video: MediaStream, voice: MediaStream | null) => {
  const out = new MediaStream(video.getVideoTracks());
  for (const t of voice?.getAudioTracks() ?? []) {
    if (t.readyState === "live") out.addTrack(t.clone());
  }
  return out;
};
