import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLockup, Caps, TeamLogo } from "../ds/kit";
import { progress } from "../ds/motion";
import { Platform, useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { LiveDot } from "./live";
import "../fonts";

export type TickerProps = {
  league: League;
  away: string;
  home: string;
  platform: Platform;
  /** The strip's contents, repeated across the strip. */
  items: string[];
  /** Where it sits: just above the platform's bottom reserve, or under the top strip. */
  position?: "bottom" | "top";
  live?: boolean;
};

/**
 * A slim scrolling strip - the market, the kickoff, the site - that can sit over any
 * graphic without hiding it. Alpha overlay; the edit puts it on and takes it off.
 */
export const Ticker: React.FC<TickerProps> = ({ league, away, home, platform, items, position = "bottom", live = true }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const safe = useSafe(platform);
  const wide = width > height * 1.2;
  const h = wide ? 74 : 88;
  const ink = teamAccent(home, league);
  const enter = progress(frame, fps, 0, 0.5);
  const text = items.filter(Boolean).join("     ·     ");
  // One loop every 18 s, drawn twice so it never shows a gap.
  const shift = ((frame / fps) % 18) / 18;

  return (
    <AbsoluteFill name="Ticker" style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          [position === "bottom" ? "bottom" : "top"]: position === "bottom" ? safe.bottom + (wide ? 24 : 16) : safe.top,
          height: h,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: `0 ${wide ? 40 : 28}px`,
          background: "color-mix(in srgb, var(--surface-page) 88%, transparent)",
          borderTop: `2px solid ${ink}`,
          borderBottom: "1px solid var(--border-card)",
          opacity: enter,
          translate: `0px ${(1 - enter) * (position === "bottom" ? 30 : -30)}px`,
          overflow: "hidden",
        }}
      >
        <TeamLogo team={away} league={league} size={h * 0.62} />
        <TeamLogo team={home} league={league} size={h * 0.62} />
        {live ? <LiveDot size={wide ? 11 : 13} /> : null}
        <div style={{ position: "relative", flex: 1, height: "100%", overflow: "hidden" }}>
          {/* Two identical copies side by side, slid by half the pair's width: seamless,
              whatever the text measures. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              height: "100%",
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              transform: `translateX(${-shift * 50}%)`,
            }}
          >
            {[0, 1].map((k) => (
              <Caps key={k} size={wide ? 26 : 30} color="var(--text-primary)" style={{ paddingRight: wide ? 60 : 80 }}>
                {text}
              </Caps>
            ))}
          </div>
        </div>
        <div style={{ opacity: 0.9 }}>
          <BrandLockup size={h * 0.3} muted />
        </div>
      </div>
    </AbsoluteFill>
  );
};
