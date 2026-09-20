/**
 * Cue sheets: everything that happens on screen, as a plain text file you can edit.
 *
 *   0:00.0   matchup                  a graphic (any key from the catalog)
 *   0:05.2   layout   split           bubble | split | full | host
 *   0:06.0   size     compact         full | compact | small (graphic size)
 *   0:07.0   overlay  ticker on       bug | name | ticker, on or off
 *   0:07.9   focus    Josh Allen       spotlight a player on the formation showing
 *   0:10.0   focus    -                clear the spotlight
 *   0:11.3   draw     4                telestration stroke 4 (kept in <name>.draw.json)
 *   0:14.0   clear                    wipe the drawings
 *   0:20.0   mark     great answer     a note for yourself; not shown
 *
 * Times are in the ORIGINAL recording (what a video player shows for the raw file),
 * so a sheet stays right however the pauses are cut. Lines starting with # are
 * notes. The booth writes one for every take; the auto-edit writes one from what you
 * said when there is none.
 */
import { LAYOUT_MODES_JS, OVERLAYS_JS, STAGE_SIZES_JS } from "./layouts.mjs";

export const COMMANDS = ["layout", "size", "overlay", "focus", "draw", "clear", "mark"];

export const parseTime = (s) => {
  const parts = s.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

export const formatTime = (t) => {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, "0")}`;
};

/** Cue: { t, key } for a graphic, or { t, cmd, arg } for a command. */
export function parseCueSheet(text, validKeys, strokeIds = null) {
  const cues = [];
  const errors = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) return;
    const m = line.match(/^(\d+(?::\d+(?:\.\d+)?)+|\d+(?:\.\d+)?)\s+([\w-]+)\s*(.*)$/);
    if (!m) return errors.push(`line ${i + 1}: expected "m:ss  graphic", got "${raw.trim()}"`);
    const t = parseTime(m[1]);
    const word = m[2].toLowerCase();
    const arg = m[3].trim();
    if (t === null) return errors.push(`line ${i + 1}: bad time "${m[1]}"`);
    if (COMMANDS.includes(word)) {
      if (word === "layout" && !LAYOUT_MODES_JS.includes(arg.toLowerCase())) {
        return errors.push(`line ${i + 1}: layout must be one of ${LAYOUT_MODES_JS.join(", ")}`);
      }
      if (word === "size" && !STAGE_SIZES_JS.includes(arg.toLowerCase())) {
        return errors.push(`line ${i + 1}: size must be one of ${STAGE_SIZES_JS.join(", ")}`);
      }
      if (word === "overlay") {
        const [what, state = "on"] = arg.toLowerCase().split(/\s+/);
        if (!Object.keys(OVERLAYS_JS).includes(what) || !["on", "off"].includes(state)) {
          return errors.push(`line ${i + 1}: overlay takes ${Object.keys(OVERLAYS_JS).join(" | ")} and on | off`);
        }
      }
      if (word === "focus" && !arg) return errors.push(`line ${i + 1}: focus needs a player name (or - to clear)`);
      if (word === "draw" && (!/^\d+$/.test(arg) || (strokeIds && !strokeIds.has(Number(arg))))) {
        return errors.push(`line ${i + 1}: draw needs a stroke number from the .draw.json file`);
      }
      cues.push({ t, cmd: word, arg: ["layout", "size", "overlay"].includes(word) ? arg.toLowerCase() : arg });
      return;
    }
    if (!validKeys.includes(word)) return errors.push(`line ${i + 1}: unknown graphic "${word}"`);
    cues.push({ t, key: word });
  });
  cues.sort((a, b) => a.t - b.t);
  return { cues, errors };
}

export function formatCueSheet(cues, catalog, header) {
  const width = Math.max(...catalog.map((c) => c.key.length), 8);
  const body = cues.map((c) =>
    c.cmd ? `${formatTime(c.t).padEnd(9)}${c.cmd.padEnd(9)}${c.arg ?? ""}`.trimEnd() : `${formatTime(c.t).padEnd(9)}${c.key}`,
  );
  return [
    ...header.map((h) => `# ${h}`),
    "#",
    "# Edit freely - change a time, change a graphic, add or delete a line -",
    "# then run edit-video.bat on the same recording again.",
    "# Times are in the ORIGINAL recording.",
    "",
    ...body,
    "",
    "# Commands:",
    "#   layout  bubble | split | full | host",
    "#   size    full | compact | small     (how big the graphic is)",
    `#   overlay ${Object.keys(OVERLAYS_JS).join(" | ")} on|off`,
    "#   focus   <player name>  (on a formation; focus - clears)",
    "#   draw    <stroke number> / clear",
    "#   mark    <note>         (not shown)",
    "#",
    "# Graphics you can use:",
    ...catalog.map((c) => `#   ${c.key.padEnd(width + 2)}${c.groupLabel ? `${c.groupLabel} · ` : ""}${c.label}`),
    "",
  ].join("\n");
}
