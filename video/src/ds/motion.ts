/**
 * Motion vocabulary for the package. Remotion renders frame by frame, so CSS
 * transitions/animations never play: every movement is a pure function of the
 * frame. These helpers keep that consistent across compositions, so the whole
 * package moves with one feel instead of fifteen hand-tuned curves.
 */
import { Easing, interpolate, spring } from "remotion";

/** House ease: fast start, long settle. */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
/** For exits: accelerate away. */
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
/** For draw-ons (strokes, bars): even, then settle. */
export const EASE_DRAW = Easing.bezier(0.65, 0, 0.35, 1);

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** interpolate() with clamping and the house ease by default. */
export const ramp = (
  frame: number,
  input: [number, number],
  output: [number, number] = [0, 1],
  easing = EASE,
) => interpolate(frame, input, output, { ...CLAMP, easing });

/** 0 -> 1 over `dur` seconds starting at `at` seconds. */
export const progress = (
  frame: number,
  fps: number,
  at: number,
  dur = 0.6,
  easing = EASE,
) => ramp(frame, [at * fps, (at + dur) * fps], [0, 1], easing);

/** Opacity + upward settle, the default entrance for a text block. */
export const rise = (frame: number, fps: number, at: number, shift = 28) => {
  const p = progress(frame, fps, at, 0.75);
  return {
    opacity: progress(frame, fps, at, 0.5),
    translate: `0px ${(1 - p) * shift}px`,
  };
};

/** Horizontal slide-in from `from` px. */
export const slide = (frame: number, fps: number, at: number, from = -60) => {
  const p = progress(frame, fps, at, 0.8);
  return {
    opacity: progress(frame, fps, at, 0.45),
    translate: `${(1 - p) * from}px 0px`,
  };
};

/**
 * Exit multiplier anchored to the END of the composition, so retiming a render in
 * Studio keeps the exit intact instead of clipping it. 1 until `lead` seconds before
 * the end, then down to 0.
 */
export const exitAt = (
  frame: number,
  fps: number,
  durationInFrames: number,
  lead = 0.6,
) =>
  interpolate(
    frame,
    [durationInFrames - lead * fps, durationInFrames - 1],
    [1, 0],
    { ...CLAMP, easing: EASE_IN },
  );

/** Delay for the i-th item of a staggered group, in seconds. */
export const stagger = (i: number, start: number, step = 0.08) => start + i * step;

/** A settled spring, 0 -> 1, for pops (badges, markers). */
export const pop = (frame: number, fps: number, at: number) =>
  spring({
    frame: frame - at * fps,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });

/** Count-up value for an animated number. */
export const countTo = (
  frame: number,
  fps: number,
  at: number,
  target: number,
  dur = 1.1,
) => target * progress(frame, fps, at, dur, EASE_DRAW);
