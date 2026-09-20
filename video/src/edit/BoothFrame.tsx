import { AbsoluteFill } from "remotion";
import { BrandLockup } from "../ds/kit";
import { Platform } from "../ds/safe";
import { League } from "../teams";
import { CornerBug } from "../graphics/CornerBug";
import { LowerThird } from "../graphics/LowerThird";
import { Ticker } from "../studio/Ticker";
import { Header, Stage } from "./Episode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OVERLAYS: Record<string, React.FC<any>> = { CornerBug, LowerThird, Ticker };
import { LayoutMode, StageSize, bugShift, frameGeom } from "./frames";
import "../fonts";

export type BoothFrameProps = {
  format: "vertical" | "wide";
  platform: Platform;
  mode: LayoutMode;
  league: League;
  away: string;
  home: string;
  line: string;
  camSize: number;
  /** Text for the caption slot when nothing is being said ("" hides it). */
  captionHint?: string;
  size?: StageSize;
  /** Small graphics laid over the stage right now. */
  overlays?: { name: string; props: Record<string, unknown> }[];
  /** The graphic on the stage right now. */
  graphic: { key: string; label: string; composition: string; props: Record<string, unknown> } | null;
};

/**
 * The recording booth's live picture: the frame the auto-edit renders (stage, header,
 * lockup, caption slot) for the chosen layout. The camera window and its animation
 * are the booth's own DOM underneath, the drawing layer its DOM on top, so what you
 * see while recording is what you get. Rendered in a <Player>, never as a composition.
 */
export const BoothFrame: React.FC<BoothFrameProps> = ({
  format,
  platform,
  mode,
  league,
  away,
  home,
  line,
  camSize,
  graphic,
  captionHint = "Your words appear here",
  size = "full",
  overlays = [],
}) => {
  const G = frameGeom(format, platform, mode, camSize, size);
  return (
    // Transparent: the booth paints the page ground and the live camera UNDER this
    // player, so the header and captions sit over the camera exactly as in the render.
    <AbsoluteFill style={{ background: "transparent", fontFamily: "var(--font-body)" }}>
      {graphic ? (
        <Stage
          box={G.stage}
          insets={G.insets}
          offset={0}
          segments={[{ id: graphic.key, label: graphic.label, composition: graphic.composition, props: graphic.props, from: 0, to: 3600 }]}
        />
      ) : null}
      {overlays.map((o) => {
        const Comp = OVERLAYS[o.name];
        if (!Comp) return null;
        // The bug is drawn top-left; in vertical that is the host strip, so it moves down.
        const shift = o.name === "CornerBug" ? bugShift(format, platform, mode) : 0;
        return (
          <div key={o.name} style={{ position: "absolute", inset: 0, transform: shift ? `translateY(${shift}px)` : undefined }}>
            <Comp {...o.props} />
          </div>
        );
      })}
      {G.lockup ? (
        <div style={{ position: "absolute", left: G.lockup.x, top: G.lockup.y - G.lockup.size }}>
          <BrandLockup size={G.lockup.size} muted={mode !== "host"} />
        </div>
      ) : null}
      {G.header ? <Header p={{ away, home, league, line }} box={G.header} plate={mode === "host"} /> : null}
      {captionHint ? (
      <div
        style={{
          position: "absolute",
          left: G.captions.x,
          top: G.captions.y,
          width: G.captions.w,
          height: G.captions.h,
          display: "flex",
          alignItems: "center",
          justifyContent: G.captions.align === "center" ? "center" : "flex-start",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: G.captions.size,
          color: "var(--text-muted)",
          opacity: 0.4,
          zIndex: 2,
        }}
      >
        {captionHint}
      </div>
      ) : null}
    </AbsoluteFill>
  );
};
