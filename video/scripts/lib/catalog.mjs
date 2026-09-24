/**
 * The graphics a talk can call up, from one game pack, in GROUPS with VARIANTS
 * (filters). Each variant has a short key you can type in a cue sheet or press in
 * the booth:
 *
 *   GAME     matchup · market (spread, total, model) · lines (line-move)
 *   BETTING  props (props-all, props-<team>)
 *   TEAMS    last (last-<team>-passing|rushing|defense) · form · scheme · ranks
 *   PLAYERS  qb · injuries · players (player-<name>)
 *
 * Shared by scripts/edit.mjs (the auto-edit) and scripts/booth.mjs (the recording
 * booth), so the booth shows exactly what the edit will render.
 */
import fs from "node:fs";
import path from "node:path";

export function newestPack(root) {
  const base = path.join(root, "props", "pack");
  const dirs = fs.existsSync(base)
    ? fs.readdirSync(base).map((d) => path.join(base, d)).filter((d) => fs.existsSync(path.join(d, "pack.json")))
    : [];
  return dirs.sort().at(-1) ?? null;
}

const lower = (s) => String(s ?? "").toLowerCase();
/** Panel sections, in order: each group belongs to one. */
export const SECTION = {
  matchup: "Game", market: "Game", lines: "Game",
  props: "Betting",
  last: "Teams", form: "Teams", scheme: "Teams", ranks: "Teams",
  qb: "Players", injuries: "Players", players: "Players",
};
/** Compositions with a registered 16:9 twin named <id>Wide. */
const HAS_WIDE = new Set(["StatDuel", "LineGap", "RankCountdown", "Formation", "PlayerCard", "MetricBoard", "BoardMotion", "LineMove", "PropBoard", "LastGame", "TeamCompare", "QbMatchup", "QbStressTest", "SchemeDiagram", "MixTable", "InjuryBoard", "ClashBoard", "CoverHeat"]);

export function loadPack(packDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packDir, "pack.json"), "utf8"));
  const cache = new Map();
  const item = (n) => {
    if (cache.has(n)) return cache.get(n);
    const it = manifest.items.find((i) => i.name === n);
    const out = it ? { ...it, props: JSON.parse(fs.readFileSync(path.join(packDir, it.props), "utf8")) } : null;
    cache.set(n, out);
    return out;
  };
  const names = manifest.items.map((i) => i.name);
  const game = manifest.game;
  const template = item("template")?.props ?? {};
  const open = item("open")?.props ?? item("open-vertical")?.props ?? {};
  const qbCard = item("qb-matchup")?.props;
  const line = [template.spread, template.total && `O/U ${template.total}`].filter(Boolean).join(" · ");
  const side = (team) => (lower(team) === lower(game.away) ? "away" : "home");

  const catalog = (fmt) => {
    const wide = fmt === "wide";
    const out = [];
    /** Add a variant from a pack item (vertical props; the wide twin is chosen here). */
    const add = (group, groupLabel, key, label, name, note = "", tweak = null) => {
      const it = item(name);
      if (!it) return;
      let composition = it.composition;
      let props = it.props;
      if (wide) {
        const wideItem = item(`${name}-wide`);
        if (wideItem) {
          composition = wideItem.composition;
          props = wideItem.props;
        } else if (composition === "Annotate") {
          props = { ...props, platform: "youtube" };
        } else if (HAS_WIDE.has(composition)) {
          composition = `${composition}Wide`;
          props = "platform" in props ? { ...props, platform: "youtube" } : props;
        } else {
          return; // vertical only (the model snapshot)
        }
      }
      if (tweak) props = tweak(props);
      out.push({ key, label, group, groupLabel, composition, props, note });
    };

    out.push({
      key: "matchup",
      label: "Matchup",
      group: "matchup",
      groupLabel: "Matchup",
      composition: "MatchupHero",
      props: {
        league: game.league, away: game.away, home: game.home,
        awayName: open.awayName, homeName: open.homeName,
        eyebrow: template.eyebrow ?? "", kickoff: open.kickoff ?? game.kickoff ?? "", network: open.network ?? "",
        spread: template.spread ?? "", total: template.total ?? "", moneyline: template.moneyline ?? "",
      },
      note: [game.week, open.kickoff, open.network, line].filter(Boolean).join("  ·  ") + "  ·  Open here, then hit 2 for the market.",
    });
    const sayGap = (n) => {
      const p = item(n)?.props;
      if (!p?.markers) return "Research only — a gap is a disagreement, not an edge.";
      return `On air: ${p.markers.map((m) => `${m.label} ${m.value}`).join(" vs ")}. Say research only — not a bet.`;
    };
    add("market", "Market vs model", "spread", "Spread", "gap-margin", sayGap("gap-margin"));
    add("market", "Market vs model", "total", "Total", "gap-total", sayGap("gap-total"));
    add("market", "Market vs model", "model", "Model read", "model-snapshot", "Research only - say so on air");
    const lm = item("line-move")?.props;
    add("lines", "Line movement", "line-move", "Open vs now", "line-move",
      lm ? lm.rows.map((r) => `${r.label}: ${r.open} → ${r.current}`).join("  ·  ") : "");

    // ── BETTING ──
    const propNote = (n) =>
      (item(n)?.props.rows ?? []).slice(0, 3).map((r) => `${r.name} ${r.market} ${r.line} vs model ${r.model}`).join("  ·  ");
    for (const [k, label] of [["all", "Biggest gaps"], [lower(game.away), game.away], [lower(game.home), game.home]]) {
      add("props", "Player props", `props-${k}`, label, `props-${k}`, propNote(`props-${k}`));
    }

    // ── TEAMS ──
    for (const team of [game.away, game.home]) {
      const n = `last-${lower(team)}`;
      const lg = item(n)?.props;
      if (!lg) continue;
      add("last", "Last game", n, `${team} recap`, n,
        `${lg.result} ${lg.score} ${lg.home ? "vs" : "at"} ${lg.opponent} · ` +
          lg.tiles.slice(0, 3).map((t) => `${t.label} ${t.value}`).join(" · "));
    }
    const boardNote = (n) => {
      const p = item(n)?.props;
      if (!p) return "";
      return p.rows.slice(0, 3).map((r) => `${r.label}: ${r.away.display} vs ${r.home.display}`).join("  ·  ");
    };
    add("form", "Team form", "clubs", "The two clubs", "clubs",
      item("clubs") ? `${item("clubs").props.awaySide?.record ?? ""} vs ${item("clubs").props.homeSide?.record ?? ""}` : "");
    add("form", "Team form", "form-offense", "Offense", "stats-offense", boardNote("stats-offense"));
    add("form", "Team form", "form-defense", "Defense", "stats-defense", boardNote("stats-defense"));
    add("form", "Team form", "form-rush-offense", "Rush offense", "stats-rush-offense", boardNote("stats-rush-offense"));
    add("form", "Team form", "form-rush-defense", "Rush defense", "stats-rush-defense", boardNote("stats-rush-defense"));
    add("scheme", "Scheme", "scheme-cover", "Coverage", "scheme-cover",
      item("scheme-cover") ? `${item("scheme-cover").props.awayLook?.shell} vs ${item("scheme-cover").props.homeLook?.shell}` : "");
    add("scheme", "Scheme", "scheme-pack", "Personnel", "scheme-pack",
      item("scheme-pack") ? "11 / 12 / 21 packages illustrated" : "");
    add("scheme", "Scheme", "clash-away", `${game.away} with the ball`, "clash-away",
      item("clash-away")
        ? "Success rate % and NFL rank, plus pass success rate. Then EPA vs what the defense allows."
        : "");
    add("scheme", "Scheme", "clash-home", `${game.home} with the ball`, "clash-home",
      item("clash-home")
        ? "Success rate % and NFL rank, plus pass success rate. Then EPA vs what the defense allows."
        : "");
    add("scheme", "Scheme", "cover-away", `${game.away} vs ${game.home} shells`, "cover-away",
      item("cover-away")?.props.note || "");
    add("scheme", "Scheme", "cover-home", `${game.home} vs ${game.away} shells`, "cover-home",
      item("cover-home")?.props.note || "");
    add("scheme", "Scheme", "scheme-pressure", "Pressure", "stats-pressure", boardNote("stats-pressure"));
    add("scheme", "Scheme", "scheme-targets", "Targets", "stats-targets", boardNote("stats-targets"));
    add("ranks", "Power ratings", "ranks", "1–16", "ranks",
      (item("ranks")?.props.items ?? []).filter((x) => x.spotlight).map((x) => `#${x.rank} ${x.label}`).join("  ·  ") || "Top half of the board");
    add("ranks", "Power ratings", "ranks-17-32", "17–32", "ranks-17-32",
      (item("ranks-17-32")?.props.items ?? []).filter((x) => x.spotlight).map((x) => `#${x.rank} ${x.label}`).join("  ·  ") || "Bottom half of the board");
    add("ranks", "Power ratings", "ranks-duel", "These two", "ranks-duel",
      (item("ranks-duel")?.props.items ?? []).map((x) => `#${x.rank} ${x.value}`).join("  ·  "));

    // ── PLAYERS ──
    add("qb", "Skill duels", "qb", "QBs", "qb-matchup",
      item("qb-matchup")?.props.note || (qbCard ? `${qbCard.awayQb?.name ?? ""} vs ${qbCard.homeQb?.name ?? ""}` : ""));
    add("qb", "Skill duels", "qb-stress", "QB stress test", "qb-stress",
      item("qb-stress")?.props.note || "Quarterbacks against the coverage and pressure they will see");
    add("qb", "Skill duels", "wr", "WR1s", "wr-matchup",
      "Receiver stress: man, zone, blitz and pressure, with what the other defense allows");
    add("qb", "Skill duels", "rb", "RBs", "rb-matchup",
      "Run stress: inside, left, right and outside, with what the other defense allows");
    for (const s of ["away", "home"]) {
      const it = item(`injuries-${s}`);
      if (it) {
        const team = it.props.team || game[s];
        const rows = it.props.rows ?? [];
        const n = rows.length;
        const lede = rows
          .filter((r) => (r.impact ?? (r.starter ? 3 : 0)) >= 3)
          .slice(0, 3)
          .map((r) => `${r.name} · ${r.impactLabel ?? "Starter"} · ${r.status}${r.detail ? ` (${r.detail})` : ""}`)
          .join("  ·  ");
        add("injuries", "Injury report", `injuries-${lower(team)}`, `${team} report`, `injuries-${s}`,
          lede || (n ? `${n} on the report` : "Clean report"));
      }
    }
    // Players: QBs first, then by team.
    const players = names.filter((n) => n.startsWith("player-")).map((n) => item(n));
    players.sort((x, y) =>
      (x.props.position === "QB" ? 0 : 1) - (y.props.position === "QB" ? 0 : 1) ||
      side(x.props.team).localeCompare(side(y.props.team)));
    for (const pl of players) {
      const p = pl.props;
      const status = p.status && lower(p.status) !== "active" ? ` · ${p.status}${p.detail ? ` (${p.detail})` : ""}` : "";
      const props = (p.props ?? []).map((x) => `${x.label} ${x.line} (model ${x.model})`).join(", ");
      add("players", "Players", pl.name, `${p.name} · ${p.team} ${p.position}`, pl.name,
        `${p.role || p.position} · ${p.teamName}${status}${props ? " · " + props : ""}`);
    }
    return out;
  };

  /** Groups in rundown order: [{ group, label, variants: [entry] }]. */
  const groups = (fmt) => {
    const list = [];
    for (const e of catalog(fmt)) {
      let g = list.find((x) => x.group === e.group);
      if (!g) list.push((g = { group: e.group, label: e.groupLabel, section: SECTION[e.group] ?? "More", variants: [] }));
      g.variants.push(e);
    }
    return list;
  };

  const qbNames = [qbCard?.awayQb?.name, qbCard?.homeQb?.name].filter(Boolean);
  return { dir: packDir, game, item, names, open, template, line, catalog, groups, qbNames };
}
