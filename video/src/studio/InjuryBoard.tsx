import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Deck, StatusPill, TeamLogo } from "../ds/kit";
import { exitAt, progress, rise, stagger } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent } from "../teams";
import { Fit } from "./live";
import { METRIC_STEPS } from "./statColor";
import "../fonts";

export type InjuryRow = {
  name: string;
  position: string;
  status: string;
  detail: string;
  headshot: string | null;
  starter: boolean;
  impact?: number;
  impactLabel?: string;
};

export type InjuryBoardProps = {
  league: League;
  team: string;
  teamName: string;
  eyebrow: string;
  title: string;
  note: string;
  rows: InjuryRow[];
};

const ORDER = ["out", "injured reserve", "doubtful", "questionable", "probable"];
const SHORT: Record<string, string> = {
  "injured reserve": "IR",
  questionable: "Q",
  doubtful: "D",
  out: "Out",
  probable: "P",
};

const rankOf = (s: string) => {
  const i = ORDER.indexOf(s.toLowerCase());
  return i < 0 ? ORDER.length : i;
};

const labelOf = (s: string) => SHORT[s.toLowerCase()] ?? s;

const impactOf = (r: InjuryRow) => r.impact ?? (r.starter ? 3 : 1);
const impactLabelOf = (r: InjuryRow) => r.impactLabel ?? (r.starter ? "Starter" : "Depth");

/** High impact on the report is a problem for the club: franchise red, depth muted. */
const impactTone = (n: number) => {
  const i = Math.max(1, Math.min(5, n));
  return METRIC_STEPS[5 - i];
};

const ImpactMark: React.FC<{ n: number; wide: boolean }> = ({ n, wide }) => {
  const tone = impactTone(n);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            width: wide ? 11 : 12,
            height: wide ? 18 : 20,
            borderRadius: 2,
            background: i <= n ? tone : "var(--border-card)",
          }}
        />
      ))}
    </div>
  );
};

/**
 * The club's injury report: face, name, impact rating, short designation.
 * Built from the site's availability list so the booth has an injury card
 * without a still capture.
 */
export const InjuryBoard: React.FC<InjuryBoardProps> = ({
  league,
  team,
  teamName,
  eyebrow,
  title,
  note,
  rows,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const ink = teamAccent(team, league);
  const listed = [...rows].sort(
    (a, b) => impactOf(b) - impactOf(a) || rankOf(a.status) - rankOf(b.status) || a.position.localeCompare(b.position),
  );
  const face = 40;
  const rowH = wide ? 56 : 60;
  const avail = height - safe.top - safe.bottom - (wide ? 150 : 180);
  const shown = listed.slice(0, Math.max(1, Math.floor(avail / rowH)));
  const cols = "44px minmax(180px,1.4fr) 150px 88px minmax(80px,1fr)";

  const counts = ORDER.map((k) => ({
    k,
    n: listed.filter((r) => r.status.toLowerCase() === k).length,
  })).filter((x) => x.n);

  const impactCounts = (["Franchise", "Core", "Starter", "Rotation", "Depth"] as const)
    .map((k) => ({ k, n: listed.filter((r) => impactLabelOf(r) === k).length }))
    .filter((x) => x.n);

  return (
    <AbsoluteFill
      name="Injury Board"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: safe.top + (wide ? 28 : 36),
        paddingBottom: safe.bottom + 16,
        paddingLeft: wide ? 56 : 40,
        paddingRight: wide ? 56 : 40,
        opacity: exit,
      }}
    >
      <Fit min={0.94}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, ...rise(frame, fps, 0) }}>
          <TeamLogo team={team} league={league} size={28} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-accent)" }}>{eyebrow}</div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 36 : 32, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{title}</div>
            <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13, color: ink }}>{teamName} · {listed.length} on the report</div>
          </div>
        </div>

        {counts.length ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, ...rise(frame, fps, 0.08) }}>
            {counts.map((c) => (
              <div
                key={c.k}
                style={{
                  border: "1px solid var(--border-card)",
                  background: "var(--surface-card)",
                  borderRadius: 999,
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <StatusPill status={c.k} label={labelOf(c.k)} size={wide ? 16 : 18} />
                <span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 26 : 28, color: "var(--text-primary)" }}>
                  {c.n}
                </span>
              </div>
            ))}
            {impactCounts.map((c) => (
              <div
                key={c.k}
                style={{
                  border: "1px solid var(--border-card)",
                  background: "var(--surface-card)",
                  borderRadius: 999,
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Caps size={wide ? 13 : 14} color={impactTone(c.k === "Franchise" ? 5 : c.k === "Core" ? 4 : c.k === "Starter" ? 3 : c.k === "Rotation" ? 2 : 1)}>
                  {c.k}
                </Caps>
                <span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 26 : 28, color: "var(--text-primary)" }}>
                  {c.n}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            columnGap: 14,
            marginTop: 20,
            paddingBottom: 8,
            borderBottom: "1px solid var(--border-card)",
            ...rise(frame, fps, 0.12),
          }}
        >
          {["", "Player", "Impact", "Status", "Detail"].map((h) => (
            <Caps key={h || "face"} size={wide ? 16 : 18} color="var(--text-primary)">
              {h}
            </Caps>
          ))}
        </div>

        {shown.length ? (
          shown.map((r, i) => {
            const n = impactOf(r);
            const tag = impactLabelOf(r);
            const tone = impactTone(n);
            return (
              <div
                key={r.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  columnGap: 14,
                  alignItems: "center",
                  minHeight: rowH,
                  borderBottom: "1px solid var(--border-card)",
                  ...rise(frame, fps, stagger(i, 0.18, 0.05), 8),
                }}
              >
                <div
                  style={{
                    width: face,
                    height: face,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "var(--surface-card)",
                    border: `2px solid ${ink}`,
                    flexShrink: 0,
                  }}
                >
                  {r.headshot ? <Img src={staticFile(r.headshot)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Caps size={wide ? 16 : 18} color={ink}>
                    {r.position}
                    {r.starter ? " · starter" : ""}
                  </Caps>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 750,
                      fontSize: 17,
                      color: "var(--text-primary)",
                      lineHeight: 1.1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 2,
                    }}
                  >
                    {r.name}
                  </div>
                </div>
                <div>
                  <ImpactMark n={n} wide={wide} />
                  <Caps size={wide ? 15 : 16} color={tone} style={{ marginTop: 6 }}>
                    {tag}
                  </Caps>
                </div>
                <StatusPill status={r.status} label={labelOf(r.status)} size={wide ? 20 : 22} />
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", opacity: r.detail ? 1 : 0.55 }}>
                  {r.detail || "—"}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ marginTop: 28, ...rise(frame, fps, 0.2) }}>
            <Deck size={wide ? 28 : 32} style={{ color: "var(--text-primary)" }}>
              No players on the injury report.
            </Deck>
          </div>
        )}

        {note ? (
          <div style={{ marginTop: 16, opacity: progress(frame, fps, 1.0, 0.4) }}>
            <Deck size={wide ? 22 : 24} style={{ color: "var(--text-primary)" }}>
              {note}
            </Deck>
          </div>
        ) : null}
      </Fit>
    </AbsoluteFill>
  );
};
