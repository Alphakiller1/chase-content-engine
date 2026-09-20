#!/usr/bin/env node
/**
 * Graphic snapshots: render still PNGs of compositions, bundling ONCE.
 *
 *   node scripts/snap.mjs --all                      every composition, default props
 *   node scripts/snap.mjs --only StatDuel,LineGap    a subset
 *   node scripts/snap.mjs --pack props/pack/<game>   every entry in a game pack
 *   options: --out <dir> (default out/snapshots)   --frame <n|hero|last>
 *            --strip <N>  N evenly spaced frames per composition (review the motion)
 *
 * The "hero" frame (default) is the settled state just before a composition's exit
 * animation - the frame a thumbnail, a carousel slide or a review sheet wants.
 * Overlays keep their alpha channel (PNG), so a still of a lower third drops straight
 * onto a timeline as a held image instead of seconds of ProRes.
 *
 * `npx remotion still <Id> out.png` does the same for one composition but re-bundles
 * every call; this script is the batch path (~1 s per still after the bundle).
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const outDir = path.resolve(root, opt("out", "out/snapshots"));
const frameOpt = opt("frame", "hero");
fs.mkdirSync(outDir, { recursive: true });

/** Jobs: [{ id, props, name }] */
let jobs = [];
const packDir = opt("pack", null);
if (packDir) {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(root, packDir, "pack.json"), "utf8"));
  jobs = manifest.items.map((it) => ({
    id: it.composition,
    name: it.name,
    props: JSON.parse(fs.readFileSync(path.resolve(root, packDir, it.props), "utf8")),
  }));
}

console.log("Bundling...");
const serveUrl = await bundle({
  entryPoint: path.resolve(root, "src/index.ts"),
  // The Tailwind + rspack settings live in remotion.config.ts, which the Node APIs
  // do not read; this project's compositions do not rely on Tailwind classes.
});
const comps = await getCompositions(serveUrl);
const byId = new Map(comps.map((c) => [c.id, c]));

if (!packDir) {
  const only = opt("only", null);
  const ids = only ? only.split(",") : has("all") ? comps.map((c) => c.id) : [];
  if (!ids.length) {
    console.error("Nothing to do: pass --all, --only A,B or --pack <dir>.");
    process.exit(2);
  }
  jobs = ids.map((id) => ({ id, name: id, props: null }));
}

const heroFrame = (comp) => {
  if (frameOpt === "last") return comp.durationInFrames - 1;
  if (frameOpt !== "hero") return Math.min(comp.durationInFrames - 1, Number(frameOpt));
  const lead = Math.round(0.8 * comp.fps);
  return Math.max(0, comp.durationInFrames - 1 - lead);
};

const written = [];
for (const job of jobs) {
  const base = byId.get(job.id);
  if (!base) {
    console.error(`No composition "${job.id}"`);
    process.exitCode = 1;
    continue;
  }
  // Re-resolve with the job's props so calculateMetadata (durations, sizes) applies.
  const comp = job.props
    ? (await getCompositions(serveUrl, { inputProps: job.props })).find((c) => c.id === job.id)
    : base;
  // --strip N: N evenly spaced frames (a filmstrip to review motion), else one hero frame.
  const strip = Number(opt("strip", "0"));
  const frames = strip > 1
    ? Array.from({ length: strip }, (_, i) => Math.round((i * (comp.durationInFrames - 1)) / (strip - 1)))
    : [heroFrame(comp)];
  for (const [i, frame] of frames.entries()) {
    const file = path.join(outDir, strip > 1 ? `${job.name}-${String(i).padStart(2, "0")}.png` : `${job.name}.png`);
    await renderStill({
      composition: comp,
      serveUrl,
      output: file,
      frame,
      inputProps: job.props ?? comp.defaultProps,
      imageFormat: "png",
    });
    written.push(file);
    console.log(`  ${job.name}  (${comp.id}, frame ${frame}/${comp.durationInFrames - 1}) -> ${path.relative(root, file)}`);
  }
}
fs.writeFileSync(path.join(outDir, "snapshots.json"), JSON.stringify(written, null, 2));
console.log(`${written.length} snapshot(s) -> ${path.relative(root, outDir)}`);
