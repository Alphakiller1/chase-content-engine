#!/usr/bin/env node
/**
 * Static recording booth for GitHub Pages (or any static host).
 *
 *   node scripts/export-booth.mjs --out booth/site --base /chase-content-engine/
 *
 * Packs must already exist under props/pack/. The hosted page reads
 * data/packs.json and data/packs/<id>/catalog.json — no Python server.
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack } from "./lib/catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const outDir = path.resolve(root, opt("out", "booth/site"));
const base = String(opt("base", "/")).replace(/\/?$/, "/");
const baseNoSlash = base === "/" ? "" : base.replace(/\/$/, "");

const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
};

if (!fs.existsSync(path.join(root, "src", "site", "index.css"))) {
  console.error("The site style export is missing. Run: npm run sync-style");
  process.exit(1);
}

const packRoot = path.join(root, "props", "pack");
const packIds = fs.existsSync(packRoot)
  ? fs.readdirSync(packRoot).filter((d) => fs.existsSync(path.join(packRoot, d, "pack.json"))).sort().reverse()
  : [];
if (!packIds.length) {
  console.error("No game packs. Build them first: python -m outputs.video_pack --league nfl --all");
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
const dist = path.join(outDir, "dist");
fs.mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [path.join(root, "booth", "app.tsx")],
  bundle: true,
  outdir: dist,
  format: "esm",
  jsx: "automatic",
  target: "chrome120",
  sourcemap: true,
  logLevel: "warning",
  ignoreAnnotations: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.BOOTH_STATIC": '"1"',
    "process.env.BOOTH_BASE": JSON.stringify(baseNoSlash),
  },
  loader: { ".woff2": "file", ".woff": "file", ".ttf": "file", ".png": "file", ".svg": "file" },
});

const html = (title, bodyExtra = "") => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="${base}" />
    <script>window.remotion_staticBase=${JSON.stringify(baseNoSlash)};</script>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%226%22 fill=%22%23dc2626%22/></svg>" />
    <link rel="stylesheet" href="dist/app.css" />
  </head>
  <body>
    ${bodyExtra}
  </body>
</html>
`;

fs.writeFileSync(
  path.join(outDir, "index.html"),
  html("Recording Booth", `<div id="root"></div>\n    <script type="module" src="dist/app.js"></script>`),
);
const micSrc = fs.readFileSync(path.join(root, "booth", "mic.html"), "utf8");
fs.writeFileSync(
  path.join(outDir, "mic.html"),
  micSrc.replace("<head>", `<head>\n    <base href="${base}" />`).replace(
    'src="/dist/',
    'src="dist/',
  ),
);

copyDir(path.join(root, "public"), outDir);
const brandDir = path.join(outDir, "brand");
fs.mkdirSync(brandDir, { recursive: true });
const icon = path.join(root, "public", "chase-icon-outline.png");
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(brandDir, "chase-icon.png"));

const packs = [];
for (const id of packIds) {
  const packDir = path.join(packRoot, id);
  const pack = loadPack(packDir);
  const { game, open } = pack;
  const catalog = {
    game: { ...game, kickoff: open.kickoff ?? game.kickoff },
    title: open.awayName && open.homeName ? `${open.awayName} at ${open.homeName}` : `${game.away} at ${game.home}`,
    line: pack.line,
    pack: id,
    formats: { vertical: pack.catalog("vertical"), wide: pack.catalog("wide") },
    groups: pack.groups("vertical").map((g) => ({
      group: g.group, label: g.label, section: g.section, keys: g.variants.map((v) => v.key),
    })),
    platform: "reels",
  };
  const dest = path.join(outDir, "data", "packs", id);
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, "catalog.json"), JSON.stringify(catalog));
  packs.push({
    id,
    away: game.away,
    home: game.home,
    line: game.line ?? pack.line ?? "",
    kickoff: open.kickoff ?? game.kickoff ?? "",
    active: id === packIds[0],
  });
}
fs.writeFileSync(
  path.join(outDir, "data", "packs.json"),
  JSON.stringify({ packs, current: packIds[0], hosted: true, built: new Date().toISOString() }),
);
fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
console.log(`Exported booth -> ${path.relative(root, outDir)}  (${packs.length} pack(s), base ${base})`);
