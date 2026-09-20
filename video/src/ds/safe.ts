import { createContext, useContext } from "react";

/**
 * Where each platform paints its own UI over your video, in frame pixels.
 *
 * RESEARCHED 2026-09-02, and the honest summary is that published numbers do not
 * agree and none of them is authoritative:
 *   - Instagram/Reels: guides cite 108-110 top, 320-400 bottom, 120-180 right.
 *     A widely-repeated "14% top / 35% bottom / 6% sides" rule (269/672/65 here)
 *     traces to marketing blogs with NO official Meta citation, and describes
 *     Ads Manager rejection thresholds, not the organic player. Kept as the
 *     separate `reels-ads` preset rather than imposed on organic posts.
 *   - TikTok: 324, 400 and 484 bottom all appear in 2026 guides; right rail
 *     120-180. TikTok itself says the zone changes with caption length.
 *   - Shorts: 120-380 top and 300-400 bottom depending on source. The bottom
 *     grows to ~400 when a viewer expands the description, so design for the
 *     expanded state.
 *   - YouTube long-form draws nothing over the frame while playing, but its player
 *     controls cover the bottom ~12% on hover, and end-screen elements claim fixed
 *     regions in the last 5-20 s (see EndScreen).
 *
 * The values are the conservative end of the converged range - a STARTING POINT.
 * Render `SafeZoneCalibration`, post it once to each platform, and read the real
 * numbers off the ruler. Platform UI shifts with app releases and device notch.
 */
export type Platform = "reels" | "reels-ads" | "tiktok" | "shorts" | "youtube";

export const SAFE: Record<Platform, { top: number; right: number; bottom: number }> = {
  reels: { top: 150, right: 150, bottom: 440 },
  "reels-ads": { top: 269, right: 65, bottom: 672 },
  tiktok: { top: 150, right: 180, bottom: 420 },
  shorts: { top: 140, right: 130, bottom: 400 },
  youtube: { top: 0, right: 0, bottom: 0 },
};

/** Title-safe inset for 16:9 long-form (EBU/SMPTE 90% title-safe, rounded). */
export const WIDE_TITLE_SAFE = { x: 96, y: 54 };

export type Insets = { top: number; right: number; bottom: number };

/**
 * Set by the auto-edit (src/edit/Episode.tsx) when a graphic is drawn inside its
 * content stage: the stage has already cleared the platform UI, so the graphic's
 * own insets are the stage's, not the platform's.
 */
export const SafeOverride = createContext<Insets | null>(null);

/** The insets a graphic should respect: the stage's when inside one, else the platform's. */
export const useSafe = (platform: Platform): Insets => useContext(SafeOverride) ?? SAFE[platform];
