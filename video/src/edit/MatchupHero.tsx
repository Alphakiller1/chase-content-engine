import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, EdgeRule, Eyebrow, Panel, TeamLogo, Title } from "../ds/kit";
import { exitAt, pop, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import "../fonts";

export type MatchupHeroProps = {
  league: League;
  away: string;
  home: string;
  awayName?: string;
  homeName?: string;
  eyebrow?: string;
  kickoff?: string;
  network?: string;
  /** Current market, as printed ("BUF -4.5", "53.5", "BUF -218"). Empty hides a chip. */
  spread?: string;
  total?: string;
  moneyline?: string;
  lineLabel?: string;
};

/**
 * The auto-edit's resting graphic: tonight's matchup and the current market. It is
 * on screen whenever the talk has not cued a data graphic yet, so it is deliberately
 * calm - logos, names, three numbers - and sizes itself to whatever stage holds it.
 */
export const MatchupHero: React.FC<MatchupHeroProps> = ({
  league,
  away,
  home,
  awayName,
  homeName,
  eyebrow = "",
  kickoff = "",
  network = "",
  spread = "",
  total = "",
  moneyline = "",
  lineLabel = "DraftKings · current",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const logo = wide ? 210 : 230;
  const headline = (() => {
    const k = (kickoff || "").toLowerCase();
    if (k.includes("sun")) return "Sunday's Matchup";
    if (k.includes("mon")) return "Monday's Matchup";
    if (k.includes("thu")) return "Thursday's Matchup";
    if (k.includes("sat")) return "Saturday's Matchup";
    if (k.includes("fri")) return "Friday's Matchup";
    return "Today's Matchup";
  })();
  const chips = [
    { label: "Spread", value: spread },
    { label: "Total", value: total },
    { label: "Moneyline", value: moneyline },
  ].filter((c) => c.value);
  const exit = exitAt(frame, fps, durationInFrames, 0.5);

  const side = (abbr: string, name: string | undefined, at: number) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, flex: 1, minWidth: 0 }}>
      <div style={{ transform: `scale(${pop(frame, fps, at)})` }}>
        <TeamLogo team={abbr} league={league} size={logo} />
      </div>
      <div style={{ textAlign: "center", ...rise(frame, fps, at + 0.15) }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: wide ? 44 : 48,
            lineHeight: 1.05,
            color: "var(--text-primary)",
          }}
        >
          {name ?? abbr}
        </div>
        <div style={{ height: 6, width: 72, margin: "14px auto 0", borderRadius: 3, background: teamAccent(abbr, league) }} />
      </div>
    </div>
  );

  return (
    <AbsoluteFill
      name="Matchup Hero"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 72 : 60),
        paddingBottom: safe.bottom + 40,
        paddingLeft: wide ? 120 : 64,
        paddingRight: wide ? 120 : Math.max(64, safe.right),
        opacity: exit,
        alignItems: "center",
        justifyContent: "center",
        gap: wide ? 44 : 60,
      }}
    >
      <div style={{ textAlign: "center", ...rise(frame, fps, 0) }}>
        {eyebrow ? <Eyebrow size={wide ? 28 : 32}>{eyebrow}</Eyebrow> : null}
        <div style={{ marginTop: 10 }}>
          <Title size={wide ? 80 : 92}>{headline}</Title>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 24 }}>
        {side(away, awayName, 0.15)}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: wide ? 56 : 64,
            color: "var(--text-muted)",
            ...rise(frame, fps, 0.3),
          }}
        >
          at
        </div>
        {side(home, homeName, 0.25)}
      </div>

      {kickoff || network ? (
        <Caps size={wide ? 26 : 30} style={{ textAlign: "center", ...rise(frame, fps, 0.45) }}>
          {[kickoff, network].filter(Boolean).join(" · ")}
        </Caps>
      ) : null}

      {chips.length ? (
        <div style={{ width: "100%", maxWidth: wide ? 1200 : undefined, ...rise(frame, fps, 0.55) }}>
          <EdgeRule width="100%" height={3} />
          <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
            {chips.map((c, i) => (
              <Panel key={c.label} pad={wide ? "20px 24px" : "24px 20px"} style={{ flex: 1, textAlign: "center", ...rise(frame, fps, stagger(i, 0.6)) }}>
                <Caps size={wide ? 24 : 28}>{c.label}</Caps>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: wide ? 62 : 64,
                    color: "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.value}
                </div>
              </Panel>
            ))}
          </div>
          <Caps size={wide ? 20 : 24} style={{ marginTop: 16, textAlign: "center" }}>
            {lineLabel}
          </Caps>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
