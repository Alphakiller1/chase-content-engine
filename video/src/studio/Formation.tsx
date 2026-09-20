import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caps, Eyebrow, StatusPill, TeamLogo, Title } from "../ds/kit";
import { EASE, EASE_DRAW, exitAt, pop, progress, rise } from "../ds/motion";
import { useSafe } from "../ds/safe";
import { League, teamAccent, teamColors } from "../teams";
import { Fit, bob } from "./live";
import "../fonts";

export type FormationPlayer = {
  name: string;
  position: string;
  group?: string;
  headshot: string | null;
  status: string;
  detail?: string;
};

export type FormationProps = {
  league: League;
  team: string;
  opponent: string;
  teamName: string;
  unit: "offense" | "defense";
  package: string;
  eyebrow: string;
  title: string;
  players: FormationPlayer[];
  /** Injured players who are NOT starting: listed by name, never pictured. */
  backups: { name: string; position: string; status: string; detail?: string }[];
  /** A starter to spotlight (dims the rest, opens a detail card), and when. */
  focus: string | null;
  focusAt: number;
  /** Several spotlights in turn (seconds into the graphic); name null clears. Wins over focus/focusAt. */
  focuses?: { at: number; name: string | null }[];
  source?: string;
  /** Draw illustrative routes (offense) or rush/drop arrows (defense). Default on. */
  routes?: boolean;
  /** Shotgun vs under center: shifts the QB and RB off the ball. */
  alignment?: "shotgun" | "under-center" | "mixed";
};

/**
 * Where each position stands, in field units: x from -0.5 (left sideline) to 0.5,
 * y in rows away from the line of scrimmage (offense below it, defense above).
 * Every club on the site publishes one of three packages, so these are fixed; an
 * unknown code falls back to its group's row.
 */
const OFFENSE_3WR: Record<string, [number, number][]> = {
  WR: [[-0.44, 0.75], [0.44, 0.75], [-0.3, 1.55]],
  LT: [[-0.2, 0.75]],
  LG: [[-0.1, 0.75]],
  C: [[0, 0.75]],
  RG: [[0.1, 0.75]],
  RT: [[0.2, 0.75]],
  TE: [[0.3, 1.1]],
  QB: [[0, 1.95]],
  RB: [[0.13, 2.25]],
  FB: [[0, 2.6]],
};
const OFFENSE_12: Record<string, [number, number][]> = {
  WR: [[-0.44, 0.75], [0.44, 0.9]],
  LT: [[-0.2, 0.75]],
  LG: [[-0.1, 0.75]],
  C: [[0, 0.75]],
  RG: [[0.1, 0.75]],
  RT: [[0.2, 0.75]],
  TE: [[0.32, 0.95], [-0.32, 0.95]],
  QB: [[0, 1.95]],
  RB: [[0.12, 2.2]],
  FB: [[-0.1, 2.15]],
};
const OFFENSE_21: Record<string, [number, number][]> = {
  WR: [[-0.44, 0.8], [0.44, 0.8]],
  LT: [[-0.2, 0.75]],
  LG: [[-0.1, 0.75]],
  C: [[0, 0.75]],
  RG: [[0.1, 0.75]],
  RT: [[0.2, 0.75]],
  TE: [[0.32, 1.05]],
  QB: [[0, 1.85]],
  RB: [[0.14, 2.35]],
  FB: [[-0.12, 2.05]],
};
const DEFENSE_43: Record<string, [number, number][]> = {
  LDE: [[-0.29, 0.75]],
  LDT: [[-0.1, 0.75]],
  RDT: [[0.1, 0.75]],
  RDE: [[0.29, 0.75]],
  NT: [[0, 0.75]],
  WLB: [[-0.24, 1.9]],
  MLB: [[0, 1.9]],
  SLB: [[0.24, 1.9]],
  LCB: [[-0.44, 1.2]],
  RCB: [[0.44, 1.2]],
  SS: [[0.19, 2.95]],
  FS: [[-0.14, 3.2]],
};
const DEFENSE_34: Record<string, [number, number][]> = {
  ...DEFENSE_43,
  LDE: [[-0.2, 0.75]],
  RDE: [[0.2, 0.75]],
  WLB: [[-0.36, 0.95]],
  SLB: [[0.36, 0.95]],
  LILB: [[-0.1, 1.9]],
  RILB: [[0.1, 1.9]],
};
/**
 * Illustrative movement per position, as waypoints in field units from the player
 * (dx across, dy in rows; negative dy = upfield on screen). A picture of how the
 * unit moves, not a play call.
 */
const OFFENSE_ROUTES: Record<string, [number, number][][]> = {
  WR: [
    [[0, -1.2], [0, -2.6]], // go
    [[0, -0.9], [-0.14, -1.9]], // slant
    [[0, -1.1], [-0.13, -1.1]], // out
  ],
  TE: [[[0, -0.8], [0.08, -1.7]]],
  RB: [[[0.16, -0.25], [0.3, -0.9]]],
  QB: [[[0, 0.45]]],
};
const DEFENSE_ROUTES: Record<string, [number, number][][]> = {
  LDE: [[[0.03, 0.9]]],
  RDE: [[[-0.03, 0.9]]],
  LDT: [[[0, 0.9]]],
  RDT: [[[0, 0.9]]],
  NT: [[[0, 0.9]]],
  WLB: [[[-0.05, -0.7]]],
  MLB: [[[0, -0.8]]],
  SLB: [[[0.05, -0.7]]],
  LILB: [[[-0.04, -0.8]]],
  RILB: [[[0.04, -0.8]]],
  LCB: [[[0, -0.9]]],
  RCB: [[[0, -0.9]]],
  SS: [[[0.08, -0.6]]],
  FS: [[[-0.08, -0.6]]],
};

const GROUP_ROW: Record<string, number> = {
  "Offensive Line": 0.75, Receivers: 1.3, Backfield: 2.1,
  Front: 0.75, Linebackers: 1.9, Secondary: 2.9,
};

const offenseMap = (pkg: string) => {
  const u = pkg.toUpperCase();
  if (u.includes("2TE") || u.includes("12") || u.includes("1WR")) return OFFENSE_12;
  if (u.includes("21") || u.includes("FB") || u.includes("2RB")) return OFFENSE_21;
  return OFFENSE_3WR;
};

const place = (p: FormationPlayer[], unit: string, pkg: string, alignment = "mixed") => {
  const map = unit === "offense" ? offenseMap(pkg) : pkg.includes("3-4") ? DEFENSE_34 : DEFENSE_43;
  const used: Record<string, number> = {};
  const loose: number[] = [];
  const out = p.map((pl, i) => {
    const spots = map[pl.position.toUpperCase()];
    const n = used[pl.position] ?? 0;
    used[pl.position] = n + 1;
    if (spots && spots[n]) {
      let y = spots[n][1];
      if (unit === "offense" && alignment === "shotgun" && (pl.position === "QB" || pl.position === "RB")) y += 0.45;
      if (unit === "offense" && alignment === "under-center" && pl.position === "QB") y = 1.35;
      return { x: spots[n][0], y };
    }
    loose.push(i);
    return null;
  });
  // Unknown codes: spread across their group's row.
  loose.forEach((i, k) => {
    out[i] = { x: -0.4 + (0.8 * (k + 0.5)) / loose.length, y: GROUP_ROW[p[i].group ?? ""] ?? 1.5 };
  });
  return out as { x: number; y: number }[];
};

const lastName = (n: string) => {
  const parts = n.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : n;
};
const flagged = (s: string) => !!s && s.toLowerCase() !== "active";
const statusTone = (s: string) => {
  const v = s.toLowerCase();
  return v === "questionable" ? "var(--mark-caution)" : v === "doubtful" ? "var(--mark-caution)" : "var(--mark-negative)";
};

export const Formation: React.FC<FormationProps> = ({
  league,
  team,
  unit,
  teamName,
  package: pkg,
  eyebrow,
  title,
  players,
  backups,
  focus: focusOne,
  focusAt: focusOneAt,
  focuses,
  source,
  routes = true,
  alignment = "mixed",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const safe = useSafe("youtube");
  const wide = width > height * 1.2;
  const exit = exitAt(frame, fps, durationInFrames, 0.5);
  const ink = teamAccent(team, league);
  const { primary } = teamColors(team, league);
  const offense = unit === "offense";

  // Layout: wide = field left, side column right; vertical = stacked.
  const padX = wide ? 90 : 56;
  const padTop = safe.top + (wide ? 56 : 50);
  const headH = wide ? 150 : 190;
  const sideW = wide ? 470 : 0;
  const listH = wide ? 0 : backups.length ? 80 + Math.min(backups.length, 4) * 62 : 0;
  const fieldW = width - padX * 2 - (wide ? sideW + 40 : Math.max(0, safe.right - padX));
  const avail = height - padTop - headH - safe.bottom - (wide ? 70 : 60) - listH;
  // Vertical: a field about as tall as it is wide reads best; the rest goes to the list.
  const fieldH = wide ? avail : Math.min(avail, fieldW * 1.2);
  const spots = place(players, unit, pkg, alignment);
  // Rows are spread to fill the field: the deepest player sits just inside the far edge.
  // The front row sits on the ball; the remaining depth spreads over what is left.
  const deepest = Math.max(1, ...spots.map((s) => s.y));
  const chip0 = Math.min(fieldW * (wide ? 0.082 : 0.092), 124);
  // Defense faces the ball, so its front row's name labels sit between it and the line.
  const front = chip0 * (offense ? 0.85 : 1.45);
  const tail = chip0 * (offense ? 1.15 : 0.65);
  const rowPx = Math.min(chip0 * 3.2, (fieldH - 80 - front - tail) / Math.max(0.5, deepest - 0.75));
  const chip = Math.min(chip0, rowPx * 0.62);
  const depthOf = (y: number) => front + (y - 0.75) * rowPx;
  // Centre the whole formation (ball to deepest player) in the field.
  const used = front + (deepest - 0.75) * rowPx + tail;
  const margin = Math.max(0, (fieldH - 80 - used) / 2);
  const losY = offense ? 40 + margin : fieldH - 40 - margin;
  // The spotlight at this moment: the latest one that has started. Clearing it fades
  // the previous player back into the group.
  const list = focuses?.length ? focuses : focusOne ? [{ at: focusOneAt, name: focusOne }] : [];
  const tNow = frame / fps;
  let k = -1;
  list.forEach((f, i) => {
    if (f.at <= tNow) k = i;
  });
  const curF = k >= 0 ? list[k] : null;
  const focus = curF ? (curF.name ?? (k > 0 ? list[k - 1].name : null)) : null;
  const focusIdx = focus ? players.findIndex((p) => p.name === focus) : -1;
  const focusOn =
    focusIdx < 0 || !curF ? 0 : curF.name ? progress(frame, fps, curF.at, 0.4) : 1 - progress(frame, fps, curF.at, 0.3);
  const drawLos = progress(frame, fps, 0.2, 0.8, EASE_DRAW);
  const routesIn = progress(frame, fps, 1.9, 0.9, EASE_DRAW);
  const march = (frame / fps) * 0.25;

  // Entrance order: the line, then the second level, then the rest - by row depth.
  const order = spots.map((s, i) => ({ i, y: s.y })).sort((a, b) => a.y - b.y || a.i - b.i);
  const delayOf = new Map(order.map((o, k) => [o.i, 0.45 + k * 0.07]));

  const focusPlayer = focusIdx >= 0 ? players[focusIdx] : null;

  const detailCard = focusPlayer ? (
    <div
      style={{
        opacity: focusOn,
        translate: `0px ${(1 - focusOn) * 16}px`,
        background: "var(--surface-card)",
        border: `2px solid ${flagged(focusPlayer.status) ? statusTone(focusPlayer.status) : ink}`,
        borderRadius: 14,
        padding: wide ? "22px 24px" : "18px 22px",
        display: "flex",
        gap: 20,
        alignItems: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,.55)",
      }}
    >
      {focusPlayer.headshot ? (
        <Img
          src={staticFile(focusPlayer.headshot)}
          style={{ width: wide ? 110 : 96, height: wide ? 110 : 96, borderRadius: "50%", objectFit: "cover", background: primary }}
        />
      ) : null}
      <div style={{ minWidth: 0 }}>
        <Caps size={wide ? 20 : 24} color={ink}>
          {focusPlayer.position} · {team}
        </Caps>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: wide ? 44 : 42, lineHeight: 1.05, color: "var(--text-primary)" }}>
          {focusPlayer.name}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <StatusPill status={focusPlayer.status || "Active"} size={wide ? 18 : 18} />
          {focusPlayer.detail ? <Caps size={wide ? 19 : 22}>{focusPlayer.detail}</Caps> : null}
        </div>
      </div>
    </div>
  ) : null;

  const backupList = backups.length ? (
    <div style={{ ...rise(frame, fps, 1.4) }}>
      <Caps size={wide ? 20 : 22} style={{ marginBottom: 12 }}>
        Also on the injury report
      </Caps>
      {backups.slice(0, wide ? 6 : 4).map((b) => (
        <div
          key={b.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 0",
            borderTop: "1px solid var(--border-card)",
            fontSize: wide ? 24 : 26,
          }}
        >
          <Caps size={wide ? 19 : 23} style={{ width: 44 }}>
            {b.position}
          </Caps>
          <div style={{ flex: 1, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {b.name}
          </div>
          <StatusPill status={b.status} size={wide ? 18 : 21} />
        </div>
      ))}
    </div>
  ) : null;

  return (
    <AbsoluteFill
      name="Formation"
      style={{
        background: "var(--surface-page)",
        fontFamily: "var(--font-body)",
        paddingTop: padTop,
        paddingLeft: padX,
        paddingRight: padX,
        paddingBottom: safe.bottom + 24,
        opacity: exit,
        justifyContent: wide ? "flex-start" : "center",
      }}
    >
      <Fit>
      {/* header */}
      <div style={{ height: headH, flexShrink: 0, display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center", columnGap: 26 }}>
        <div style={{ transform: `scale(${pop(frame, fps, 0)})` }}>
          <TeamLogo team={team} league={league} size={wide ? 110 : 120} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={rise(frame, fps, 0.05)}>
            <Eyebrow size={wide ? 24 : 26}>{eyebrow}</Eyebrow>
          </div>
          <div style={{ marginTop: 6, ...rise(frame, fps, 0.12) }}>
            <Title size={wide ? 70 : 76}>{title}</Title>
          </div>
        </div>
        <div
          style={{
            ...rise(frame, fps, 0.25),
            border: `2px solid ${ink}`,
            color: ink,
            borderRadius: 999,
            padding: "8px 18px",
            fontWeight: 700,
            fontSize: wide ? 22 : 24,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          {pkg}{alignment === "shotgun" ? " · Shotgun" : alignment === "under-center" ? " · Under center" : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: 40, flexShrink: 0 }}>
        {/* the field */}
        <div
          style={{
            position: "relative",
            width: fieldW,
            height: fieldH,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid var(--border-card)",
            background: `radial-gradient(120% 80% at 50% ${offense ? "0%" : "100%"}, color-mix(in srgb, ${primary} 26%, var(--surface-card)) 0%, var(--surface-card) 70%)`,
            opacity: progress(frame, fps, 0.05, 0.5),
          }}
        >
          {/* yard lines + hashes */}
          <svg width={fieldW} height={fieldH} style={{ position: "absolute", inset: 0 }}>
            {Array.from({ length: 9 }, (_, k) => {
              const y = offense ? losY + k * fieldH * 0.12 : losY - k * fieldH * 0.12;
              return (
                <g key={k} opacity={0.5}>
                  <line x1={0} x2={fieldW} y1={y} y2={y} stroke="var(--border-card)" strokeWidth={k % 2 ? 1 : 2} />
                  {[0.36, 0.64].map((hx) => (
                    <line key={hx} x1={fieldW * hx - 8} x2={fieldW * hx + 8} y1={y + fieldH * 0.06} y2={y + fieldH * 0.06} stroke="var(--border-card)" strokeWidth={2} />
                  ))}
                </g>
              );
            })}
            {/* line of scrimmage */}
            <line
              x1={fieldW / 2 - (fieldW / 2) * drawLos}
              x2={fieldW / 2 + (fieldW / 2) * drawLos}
              y1={losY}
              y2={losY}
              stroke={ink}
              strokeWidth={4}
              strokeLinecap="round"
            />
            <ellipse cx={fieldW / 2} cy={losY} rx={13} ry={8} fill="#8a5a2b" opacity={drawLos} />
          </svg>
          <div
            style={{
              position: "absolute",
              right: 18,
              top: offense ? losY - 30 : losY + 10,
              opacity: drawLos,
            }}
          >
            <Caps size={wide ? 22 : 28} color={ink}>
              Line of scrimmage
            </Caps>
          </div>

          {/* movement: routes or rush/drop arrows, drawn after the unit is set */}
          {routes ? (
            <svg width={fieldW} height={fieldH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <defs>
                <marker id={`head-${unit}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill={ink} />
                </marker>
              </defs>
              {(() => {
                const table = offense ? OFFENSE_ROUTES : DEFENSE_ROUTES;
                const used: Record<string, number> = {};
                return players.map((p, i) => {
                  const pos = p.position.toUpperCase();
                  const options = table[pos];
                  if (!options) return null;
                  const n = used[pos] ?? 0;
                  used[pos] = n + 1;
                  const way = options[n % options.length];
                  const s0 = spots[i];
                  const x0 = fieldW / 2 + s0.x * fieldW;
                  const y0 = offense ? losY + depthOf(s0.y) : losY - depthOf(s0.y);
                  const pts = [[x0, y0], ...way.map(([dx, dy]) => [x0 + dx * fieldW, y0 + dy * rowPx])];
                  const d = pts.map((q, k) => `${k ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
                  const dim = focusIdx >= 0 && i !== focusIdx ? 1 - 0.7 * focusOn : 1;
                  const drawn = routesIn >= 1;
                  return (
                    <g key={`route-${i}`} opacity={0.85 * dim}>
                      <path
                        d={d}
                        fill="none"
                        stroke={ink}
                        strokeWidth={wide ? 5 : 6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength={1}
                        strokeDasharray={drawn ? "0.06 0.035" : "1 1"}
                        strokeDashoffset={drawn ? -march : 1 - routesIn}
                        markerEnd={routesIn > 0.9 ? `url(#head-${unit})` : undefined}
                      />
                    </g>
                  );
                });
              })()}
            </svg>
          ) : null}

          {/* players */}
          {players.map((p, i) => {
            const s = spots[i];
            const cx = fieldW / 2 + s.x * fieldW;
            const cy = offense ? losY + depthOf(s.y) : losY - depthOf(s.y);
            const at = delayOf.get(i) ?? 0.5;
            const inP = progress(frame, fps, at, 0.7, EASE);
            // Players jog in from the ball.
            const x = interpolate(inP, [0, 1], [fieldW / 2, cx]);
            // Once set, each player shifts his weight a little (idle life).
            const y = interpolate(inP, [0, 1], [losY, cy]) + (inP >= 1 ? bob(frame, fps, i, 2) : 0);
            const isFocus = i === focusIdx;
            const dim = focusIdx >= 0 && !isFocus ? 1 - 0.65 * focusOn : 1;
            const scale = isFocus ? 1 + 0.28 * focusOn : 1;
            const hurt = flagged(p.status);
            const ring = hurt ? statusTone(p.status) : ink;
            const d = chip;
            return (
              <div
                key={p.name + i}
                data-player={p.name}
                style={{
                  position: "absolute",
                  left: x - d / 2,
                  top: y - d / 2,
                  width: d,
                  opacity: Math.min(1, inP * 2) * dim,
                  transform: `scale(${scale})`,
                  transformOrigin: `${d / 2}px ${d / 2}px`,
                  zIndex: isFocus ? 3 : 1,
                  cursor: "pointer",
                }}
              >
                {isFocus ? (
                  <div
                    style={{
                      position: "absolute",
                      left: -d * 0.22,
                      top: -d * 0.22,
                      width: d * 1.44,
                      height: d * 1.44,
                      borderRadius: "50%",
                      border: `3px solid ${ring}`,
                      opacity: focusOn * (0.5 + 0.5 * Math.sin((frame / fps) * 5)),
                    }}
                  />
                ) : null}
                <div
                  style={{
                    width: d,
                    height: d,
                    borderRadius: "50%",
                    padding: 3,
                    background: ring,
                    boxShadow: "0 8px 22px rgba(0,0,0,.5)",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: `linear-gradient(160deg, ${primary}, var(--surface-page))`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {p.headshot ? (
                      <Img src={staticFile(p.headshot)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ color: "#fff", fontWeight: 800, fontSize: d * 0.3 }}>{p.position}</span>
                    )}
                  </div>
                </div>
                {hurt ? (
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      top: -4,
                      width: d * 0.3,
                      height: d * 0.3,
                      borderRadius: "50%",
                      background: ring,
                      color: "#111",
                      fontWeight: 900,
                      fontSize: Math.max(24, d * 0.24),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid var(--surface-page)",
                    }}
                  >
                    {p.status.toLowerCase() === "questionable" ? "Q" : p.status.toLowerCase() === "doubtful" ? "D" : "O"}
                  </div>
                ) : null}
                <div style={{ position: "absolute", top: d + 4, left: -d * 0.4, width: d * 1.8, textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: Math.max(wide ? 20 : 26, d * 0.26),
                      lineHeight: 1.05,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textShadow: "0 2px 6px rgba(0,0,0,.8)",
                    }}
                  >
                    {lastName(p.name)}
                  </div>
                  <div style={{ fontSize: Math.max(wide ? 20 : 24, d * 0.2), fontWeight: 800, letterSpacing: "0.06em", color: hurt ? ring : "#fff", textShadow: "0 1px 4px rgba(0,0,0,.85)" }}>
                    {p.position}
                  </div>
                </div>
              </div>
            );
          })}

          {/* focus card, vertical: floats over the field away from the line */}
          {!wide && detailCard ? (
            <div style={{ position: "absolute", left: 20, right: 20, [offense ? "bottom" : "top"]: 16 }}>{detailCard}</div>
          ) : null}
        </div>

        {wide ? (
          <div style={{ width: sideW, display: "flex", flexDirection: "column", gap: 26 }}>
            <div style={rise(frame, fps, 0.3)}>
              <Caps size={20}>{teamName}</Caps>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, color: "var(--text-primary)", marginTop: 6 }}>
                {players.filter((p) => flagged(p.status)).length
                  ? `${players.filter((p) => flagged(p.status)).length} starter${players.filter((p) => flagged(p.status)).length > 1 ? "s" : ""} on the report`
                  : "Every starter active"}
              </div>
            </div>
            {detailCard}
            {backupList}
          </div>
        ) : null}
      </div>

      {!wide ? <div style={{ marginTop: 22 }}>{backupList}</div> : null}
      </Fit>
      {source ? (
        <div style={{ position: "absolute", left: padX, bottom: safe.bottom + 18, opacity: 0.7 * progress(frame, fps, 1.2, 0.5) }}>
          <Caps size={wide ? 18 : 22}>{source}</Caps>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
