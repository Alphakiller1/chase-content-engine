/**
 * Hosted broadcast records the program frame on screen (this tab, cropped to
 * the booth picture). That is the only way the file matches the boards.
 * Microphone is mixed in separately. Do not snapshot or rebuild graphics.
 */
export const captureProgram = async (el: HTMLElement): Promise<MediaStream> => {
  const w = window as unknown as {
    CaptureController?: new () => { setFocusBehavior?: (b: string) => void };
    CropTarget?: { fromElement: (node: Element) => Promise<unknown> };
    RestrictionTarget?: { fromElement: (node: Element) => Promise<unknown> };
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
  const track = display.getVideoTracks()[0] as MediaStreamTrack & {
    cropTo?: (t: unknown) => Promise<void>;
    restrictTo?: (t: unknown) => Promise<void>;
  };
  try {
    if (w.RestrictionTarget && track.restrictTo) {
      await track.restrictTo(await w.RestrictionTarget.fromElement(el));
    } else if (w.CropTarget && track.cropTo) {
      await track.cropTo(await w.CropTarget.fromElement(el));
    }
  } catch {
    /* full tab is still the booth picture, including chrome */
  }
  return display;
};

export const withAudio = (video: MediaStream, voice: MediaStream | null) => {
  const out = new MediaStream(video.getVideoTracks());
  for (const t of voice?.getAudioTracks() ?? []) {
    if (t.readyState === "live") out.addTrack(t.clone());
  }
  return out;
};
