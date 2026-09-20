#!/usr/bin/env node
/**
 * THE AUTO-EDIT: one recording of you talking -> a finished video.
 *
 *   node scripts/edit.mjs [recording] [options]
 *
 * With no recording, the newest video in video/footage/ is used. What it does, in
 * order (each step is cached in public/edit/<name>/, so a re-run only redoes what
 * changed):
 *
 *   1. PREP     re-encodes the recording to a clean 30 fps proxy and levels the
 *               voice to streaming loudness (-14 LUFS). Phone HEVC/.mov is fine.
 *   2. LISTEN   transcribes every word locally (whisper.cpp - nothing is uploaded).
 *   3. CUT      removes dead air (pauses over ~0.45 s) and any take you flubbed:
 *               say "redo" (or "scratch that") after a bad line, pause, and say
 *               it again - the bad line and the "redo" are cut.
 *   4. PLAN     follows your cue sheet (footage/<name>.cues.txt - the recording
 *               booth writes one; you can edit it) or, without one, puts the
 *               graphic you are talking about on screen: say "spread",
 *               "total", "quarterback", "injuries", "power ratings", "offense" /
 *               "defense", "model"... and that graphic comes up as you say it.
 *               The plan is printed and saved (plan.txt), and written as a cue
 *               sheet so you can change the timing and run again.
 *   5. RENDER   out/edit/<name>-vertical.mp4 and/or <name>-wide.mp4.
 *
 * Options
 *   --pack <dir>        game pack (default: newest props/pack/*)
 *   --format <f>        vertical | wide | both   (default both)
 *   --platform <p>      reels | tiktok | shorts  (vertical safe areas, default reels)
 *   --name <name>       output name (default: recording file name)
 *   --focus <x,y>       where your face is in the frame, 0-1 (default 0.5,0.38)
 *   --cam-size <px>     camera bubble size (default 250 vertical / 210 wide)
 *   --mirror            flip the camera horizontally
 *   --no-camera         audio only - no bubble at all
 *   --music <file>      background music bed, kept quiet under the voice
 *   --no-captions       skip on-screen captions
 *   --model <m>         whisper model (default small.en; base.en is faster)
 *   --keep-pauses       do not cut dead air
 *   --cues <file>       cue sheet to follow (default footage/<name>.cues.txt if it exists)
 *   --layout <l>        starting layout: bubble (default) | split | full | host
 *   --auto-cues         ignore the cue sheet and pick graphics from what you said again
 *   --no-refresh        use the pack as it is (by default live lines are re-read first)
 *   --plan-only         stop after the plan (no render)
 *   --no-open           do not open the output folder when done
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL, transcribeWords } from "./lib/whisper.mjs";
import { loadPack, newestPack } from "./lib/catalog.mjs";
import { formatCueSheet, formatTime, parseCueSheet } from "./lib/cues.mjs";
import { LAYOUT_MODES_JS, OVERLAYS_JS } from "./lib/layouts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30;

/* ── args ─────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flags = new Set();
const opts = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) positional.push(a);
  else if (["mirror", "no-camera", "no-captions", "keep-pauses", "plan-only", "no-open", "auto-cues", "no-refresh"].includes(a.slice(2))) flags.add(a.slice(2));
  else opts[a.slice(2)] = argv[++i];
}
const die = (msg) => {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
};

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i;
let source = positional[0];
if (!source) {
  const dir = path.join(root, "footage");
  const vids = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => VIDEO_EXT.test(f)).map((f) => path.join(dir, f))
    : [];
  if (!vids.length) die(`No recording given and nothing in ${dir}. Put your video there, or pass its path.`);
  source = vids.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}
source = path.resolve(source);
if (!fs.existsSync(source)) die(`Recording not found: ${source}`);

const packDir = opts.pack ? path.resolve(root, opts.pack) : newestPack(root);
if (!packDir) die("No game pack. Build one first: python -m outputs.video_pack --league nfl --game AWAY@HOME");
const formats = (opts.format ?? "both") === "both" ? ["vertical", "wide"] : [opts.format];
for (const f of formats) if (!["vertical", "wide"].includes(f)) die(`--format must be vertical, wide or both (got ${f})`);
const platform = opts.platform ?? "reels";
const name = (opts.name ?? path.parse(source).name).replace(/[^\w.-]+/g, "-");
const model = opts.model ?? DEFAULT_MODEL;
const [focusX, focusY] = (opts.focus ?? "0.5,0.38").split(",").map(Number);

const work = path.join(root, "public", "edit", name);
fs.mkdirSync(work, { recursive: true });
const rel = (p) => path.relative(root, p).replaceAll("\\", "/");
const step = (n, label) => console.log(`\n[${n}/5] ${label}`);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* ── ffmpeg (Remotion ships its own) ──────────────────────────────────────── */
const binDir = (() => {
  const plat = process.platform === "win32" ? `win32-${process.arch}-msvc` : `${process.platform}-${process.arch}`;
  const guess = [`compositor-${plat}`, `compositor-${plat}-gnu`];
  for (const g of guess) {
    const d = path.join(root, "node_modules", "@remotion", g);
    if (fs.existsSync(d)) return d;
  }
  return null;
})();
const exe = (tool) => {
  const p = binDir && path.join(binDir, process.platform === "win32" ? `${tool}.exe` : tool);
  return p && fs.existsSync(p) ? p : tool;
};
const run = (tool, args) => {
  const r = spawnSync(exe(tool), args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: binDir ?? root });
  if (r.status !== 0) die(`${tool} failed:\n${(r.stderr || "").split("\n").slice(-12).join("\n")}`);
  return r;
};
const fresh = (out, input) => fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(input).mtimeMs;

/* ── 1. prep ──────────────────────────────────────────────────────────────── */
step(1, `Prep  ${path.basename(source)}`);
const camera = path.join(work, "camera.mp4");
const wav = path.join(work, "audio.wav");
if (!fresh(camera, source)) {
  console.log("  re-encoding to a 30 fps proxy, levelling the voice to -14 LUFS ...");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-vf", "scale=w=1280:h=1280:force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", camera,
  ]);
}
if (!fresh(wav, camera)) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", camera, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
}
const duration = Number(
  run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", camera]).stdout.trim(),
);
const probe = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", camera]).stdout.trim();
console.log(`  ${clock(duration)} long, video ${probe || "none"}`);

/* ── 2. listen ────────────────────────────────────────────────────────────── */
step(2, `Listen  (whisper ${model}, on this machine)`);
const wordsFile = path.join(work, `words.${model}.json`);
let words;
if (fresh(wordsFile, wav)) {
  words = JSON.parse(fs.readFileSync(wordsFile, "utf8"));
  console.log(`  ${words.length} words (cached)`);
} else {
  console.log("  transcribing ... (about a third of the recording's length on a laptop)");
  words = await transcribeWords(wav, model);
  fs.writeFileSync(wordsFile, JSON.stringify(words, null, 1));
  console.log(`  ${words.length} words`);
}
// Whisper marks non-speech as [BLANK_AUDIO], (upbeat music) and the like - sometimes
// split over several tokens - so drop everything inside brackets.
{
  let depth = 0;
  words = words
    .map((w) => ({ text: w.text, start: w.startMs / 1000, end: Math.max(w.endMs, w.startMs + 80) / 1000 }))
    .filter((w) => {
      const opens = /^\s*[[(]/.test(w.text);
      if (opens) depth++;
      const inside = depth > 0;
      if (/[\])]\s*$/.test(w.text) && depth > 0) depth--;
      return !inside && w.text.trim();
    });
}
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9' ]/g, "").trim();

/* ── 3. cut ───────────────────────────────────────────────────────────────── */
step(3, "Cut  dead air and redone takes");
const PAD_IN = 0.12;
const PAD_OUT = 0.2;
let speech;
if (flags.has("keep-pauses")) {
  speech = [{ from: 0, to: duration }];
} else {
  const sd = run("ffmpeg", ["-hide_banner", "-nostats", "-i", wav, "-af", "silencedetect=noise=-35dB:d=0.45", "-f", "null", "-"]).stderr;
  const silences = [];
  let open = null;
  for (const line of sd.split("\n")) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) open = Math.max(0, Number(s[1]));
    if (e && open !== null) {
      silences.push([open, Number(e[1])]);
      open = null;
    }
  }
  if (open !== null) silences.push([open, duration]);
  speech = [];
  let t = 0;
  for (const [a, b] of silences) {
    if (a > t) speech.push({ from: t, to: a });
    t = b;
  }
  if (t < duration) speech.push({ from: t, to: duration });
  // Keep a chunk only if something was said in it (drops coughs, clicks, bumps).
  speech = speech.filter((c) => words.some((w) => w.start >= c.from - 0.3 && w.start < c.to) || c.to - c.from > 1.2);
}
const deadAir = duration - speech.reduce((s, c) => s + c.to - c.from, 0);

// Align words to speech chunks. Silence detection knows exactly WHEN speech
// happens; whisper knows WHAT was said and in what order, but its timestamps
// wander by up to a second around pauses. So the words are split across the
// chunks by dynamic programming: each chunk should take about as many letters as
// its length allows at this speaker's pace, pauses fall on punctuation, and
// whisper's times are a hint, not the truth.
{
  const N = words.length;
  const M = speech.length;
  const len = words.map((w) => w.text.trim().length + 1);
  const speechDur = speech.reduce((s, c) => s + c.to - c.from, 0);
  const rate = speechDur / Math.max(1, len.reduce((a, b) => a + b, 0)); // seconds per letter
  const prefix = [0];
  for (const l of len) prefix.push(prefix.at(-1) + l);
  const hint = (i, c) => {
    const t = words[i].start;
    return Math.min(2, t < c.from ? c.from - t : t > c.to ? t - c.to : 0);
  };
  const hintPrefix = speech.map((c) => {
    const acc = [0];
    for (let i = 0; i < N; i++) acc.push(acc.at(-1) + hint(i, c));
    return acc;
  });
  const MAXW = 80;
  const INF = 1e18;
  // best[j][i]: cost of putting words [0, i) into chunks [0, j)
  const best = Array.from({ length: M + 1 }, () => new Float64Array(N + 1).fill(INF));
  const from = Array.from({ length: M + 1 }, () => new Int32Array(N + 1));
  best[0][0] = 0;
  for (let j = 1; j <= M; j++) {
    const c = speech[j - 1];
    const dur = c.to - c.from;
    for (let i = 0; i <= N; i++) {
      for (let k = Math.max(0, i - MAXW); k <= i; k++) {
        const prev = best[j - 1][k];
        if (prev >= INF) continue;
        let cost;
        if (k === i) {
          cost = 3; // a chunk with no words: noise, a breath, a laugh
        } else {
          const expected = (prefix[i] - prefix[k]) * rate;
          const fit = Math.log(Math.max(expected, 0.05) / Math.max(dur, 0.05));
          const endsPhrase = /[.,!?;:]["')]?\s*$/.test(words[i - 1].text) || j === M;
          cost = 2 * fit * fit + 0.5 * (hintPrefix[j - 1][i] - hintPrefix[j - 1][k]) + (endsPhrase ? 0 : 1.5);
        }
        if (prev + cost < best[j][i]) {
          best[j][i] = prev + cost;
          from[j][i] = k;
        }
      }
    }
  }
  let i = N;
  for (let j = M; j >= 1; j--) {
    const k = from[j][i];
    for (let x = k; x < i; x++) words[x].chunk = speech[j - 1];
    i = k;
  }
}
// Retime inside each chunk: keep whisper's starts when they all fit, else spread
// the words over the chunk by length (close enough for word-by-word captions).
for (const c of speech) {
  const ws = words.filter((w) => w.chunk === c);
  if (!ws.length) continue;
  const fits = ws.every((w) => w.start >= c.from - 0.15 && w.start < c.to);
  if (fits) {
    ws.forEach((w, i) => {
      w.start = Math.max(c.from, w.start);
      w.end = Math.min(w.end, i + 1 < ws.length ? ws[i + 1].start : c.to, c.to);
      if (w.end <= w.start) w.end = w.start + 0.08;
    });
  } else {
    const weight = ws.map((w) => w.text.trim().length + 2);
    const total = weight.reduce((a, b) => a + b, 0);
    let t = c.from;
    ws.forEach((w, i) => {
      const d = ((c.to - c.from) * weight[i]) / total;
      w.start = t;
      w.end = t + d;
      t += d;
    });
  }
}

// Redo: drop the chunk holding the trigger. When the trigger was said on its own
// after a pause, also drop what came before it, back to the start of that sentence.
const TRIGGERS = [["redo"], ["re", "do"], ["scratch", "that"], ["cut", "that"], ["start", "over"]];
const redone = [];
const drop = new Set();
const endsSentence = (k) => {
  const ws = words.filter((w) => w.chunk === speech[k]);
  return !ws.length || /[.!?]\s*$/.test(ws.at(-1).text);
};
for (let i = 0; i < words.length; i++) {
  const hit = TRIGGERS.find((tr) => tr.every((w, k) => norm(words[i + k]?.text ?? "") === w));
  if (!hit) continue;
  const k = speech.indexOf(words[i].chunk);
  const gone = [k];
  const standalone = words.find((w) => w.chunk === speech[k]) === words[i];
  let j = k;
  if (standalone && k > 0) gone.push(--j);
  while (j > 0 && gone.length < 5 && !endsSentence(j - 1)) gone.push(--j);
  gone.forEach((x) => drop.add(x));
  const said = words
    .filter((w) => gone.includes(speech.indexOf(w.chunk)))
    .map((w) => w.text)
    .join("")
    .trim();
  redone.push({ at: words[i].start, said });
  i += hit.length - 1;
}
const keptWords = words.filter((w) => !drop.has(speech.indexOf(w.chunk)));
if (process.env.EDIT_DEBUG) for (const [k, c] of speech.entries()) console.log(k, drop.has(k) ? "DROP" : "    ", c.from.toFixed(2), c.to.toFixed(2), words.filter((w) => w.chunk === c).map((w) => w.text).join(""));
speech = speech.filter((_, j) => !drop.has(j));

// Pad, clamp and merge into the kept cuts.
const cuts = [];
for (const c of speech) {
  const from = Math.max(0, c.from - PAD_IN);
  const to = Math.min(duration, c.to + PAD_OUT);
  const last = cuts.at(-1);
  if (last && from <= last.to) last.to = Math.max(last.to, to);
  else cuts.push({ from, to });
}
for (const c of cuts) {
  // Frame-align so audio and picture cut on the same frame.
  c.from = Math.round(c.from * FPS) / FPS;
  c.to = Math.round(c.to * FPS) / FPS;
}
if (!cuts.length) die("No speech found in the recording. Is the microphone on?");
const body = cuts.reduce((s, c) => s + c.to - c.from, 0);

/** Source seconds -> body seconds (null when the moment was cut). */
const toBody = (t) => {
  let acc = 0;
  for (const c of cuts) {
    if (t < c.from) return null;
    if (t <= c.to) return acc + (t - c.from);
    acc += c.to - c.from;
  }
  return null;
};
const bodyWords = keptWords
  .map((w) => {
    const start = toBody(w.start);
    const end = toBody(Math.min(w.end, w.chunk.to));
    if (start === null) return null;
    return { text: w.text, start: +start.toFixed(3), end: +Math.max(start + 0.05, end ?? start + 0.2).toFixed(3) };
  })
  .filter(Boolean);
console.log(`  ${clock(duration)} -> ${clock(body)}   (${cuts.length} takes, ${deadAir.toFixed(1)} s of dead air removed)`);
for (const r of redone) console.log(`  redo at ${clock(r.at)} - cut: "${r.said.slice(0, 90)}"`);

/* ── 4. plan ──────────────────────────────────────────────────────────────── */
step(4, `Plan  graphics from ${rel(packDir)}`);
if (!flags.has("no-refresh")) {
  // Current DraftKings lines and data for every graphic in this render.
  const r = spawnSync(process.platform === "win32" ? "python" : "python3", ["-m", "outputs.video_pack", "--refresh", packDir], {
    cwd: path.resolve(root, ".."),
    encoding: "utf8",
  });
  console.log(r.status === 0 ? "  live lines refreshed" : `  (could not refresh live lines - using the pack as it is) ${(r.stderr || "").trim().split("\n").at(-1) ?? ""}`);
}
const pack = loadPack(packDir);
const g = pack.game;
const league = g.league;
const { item, open, template } = pack;
const nameTokens = (full, abbr) =>
  [abbr, ...(full ?? "").split(/\s+/)].map(norm).filter((t) => t.length > 2);
const awayTokens = nameTokens(open.awayName, g.away);
const homeTokens = nameTokens(open.homeName, g.home);
for (const [i, qb] of pack.qbNames.entries()) (i ? homeTokens : awayTokens).push(...qb.split(/\s+/).map(norm));

// Player cards are called by full name (a surname alone is too often someone else).
const playerName = (entry) => norm(entry.props.name ?? "");
const playerKeys = pack
  .catalog("vertical")
  .filter((c) => c.group === "players" && c.props.position !== "QB")
  .map(playerName)
  .filter(Boolean);

/** Keyword cues, highest priority first: which catalog graphic a sentence calls up. */
const RULES = [
  { keys: ["injury", "injuries", "injured", "questionable", "doubtful", "out for", "hurt", "banged up", "inactive"],
    key: (sent) => {
      const home = sent.some((w) => homeTokens.includes(w));
      const away = sent.some((w) => awayTokens.includes(w));
      const team = (home || !away ? g.home : g.away).toLowerCase();
      const unit = sent.some((w) => /^defen[sc]/.test(w)) ? "defense" : "offense";
      return [`injuries-${team}`];
    } },
  { key: "qb", keys: ["quarterback", "quarterbacks", "qb", "qbs", ...pack.qbNames.map((n) => norm(n.split(" ").at(-1)))] },
  { key: "wr", keys: ["wide receiver", "wide receivers", "wr1", "number one receiver"] },
  { key: "rb", keys: ["running back", "running backs", "rb1", "workhorse"] },
  { key: "spread", keys: ["spread", "favored", "favorite", "favourite", "underdog", "dog", "cover", "laying", "line"] },
  { key: "total", keys: ["total", "over under", "the over", "the under", "shootout", "points total"] },
  { key: "ranks", keys: ["power rating", "power ratings", "rankings", "ranked", "ranking", "rank"] },
  { key: "scheme-cover", keys: ["coverage", "man coverage", "zone", "cover 2", "cover 3", "cover 1", "two high", "single high"] },
  { key: "scheme-pressure", keys: ["blitz", "blitzes", "blitzing", "pressure", "pass rush", "stacked box"] },
  { key: "scheme-pack", keys: ["personnel", "eleven personnel", "12 personnel", "shotgun", "play action", "motion", "under center"] },
  { key: "clash-away", keys: ["pass versus run", "pass vs run", "when they have the ball", "against the run", "against the pass", "vs the run", "vs the pass"] },
  { key: "clash-home", keys: ["when the home team has the ball"] },
  { key: "cover-away", keys: ["against coverage", "versus coverage", "vs coverage", "shells", "cover zero"] },
  { keys: ["last game", "last week", "last time out"], key: (sent) => {
      const home = sent.some((w) => homeTokens.includes(w));
      const away = sent.some((w) => awayTokens.includes(w));
      const team = (home || !away ? g.home : g.away).toLowerCase();
      return [`last-${team}`];
    } },
  { keys: ["formation", "lineup", "starters", "offensive line", "o line", "secondary", "front seven", "depth chart"],
    key: (sent) => {
      const home = sent.some((w) => homeTokens.includes(w));
      const away = sent.some((w) => awayTokens.includes(w));
      const team = (home || !away ? g.home : g.away).toLowerCase();
      const unit = sent.some((w) => /^defen[sc]|secondary|front/.test(w)) ? "defense" : "offense";
      return [`formation-${team}-${unit}`];
    } },
  { keys: playerKeys, key: (sent) => {
      const joined = ` ${sent.join(" ")} `;
      return pack.catalog("vertical").filter((c) => c.group === "players" && joined.includes(` ${playerName(c)} `)).map((c) => c.key);
    } },
  { key: "form-offense", keys: ["offense", "offenses", "offensive", "epa"] },
  { key: "form-defense", keys: ["defense", "defenses", "defensive"] },
  { key: "model", keys: ["model", "projection", "projects", "win probability"] },
  { key: "matchup", keys: ["matchup", "tonight", "kickoff"] },
];

// Sentences: split on end punctuation or on a cut (a new take).
const sentences = [];
let cur = [];
for (const w of bodyWords) {
  const prev = cur.at(-1);
  if (prev && w.start - prev.end > 0.35) {
    sentences.push(cur);
    cur = [];
  }
  cur.push(w);
  if (/[.!?]\s*$/.test(w.text)) {
    sentences.push(cur);
    cur = [];
  }
}
if (cur.length) sentences.push(cur);

const MIN_HOLD = 5;
const holdFor = (seg) => {
  if (seg.composition !== "Annotate") return MIN_HOLD;
  const steps = seg.props.steps ?? [];
  const end = Math.max(0, ...steps.map((st) => Math.max(st.at + (st.dur ?? 0.6), st.until ?? 0)));
  return Math.max(MIN_HOLD, end + 0.8);
};
const segOf = (entry, from, cue) => ({
  id: entry.key,
  label: entry.groupLabel && entry.groupLabel !== entry.label ? `${entry.groupLabel} · ${entry.label}` : entry.label,
  composition: entry.composition,
  props: entry.props,
  from,
  cue,
});
const closeSegs = (segs) => segs.map((s, i) => ({ ...s, to: i + 1 < segs.length ? segs[i + 1].from : body }));

/** Plan from what was said. */
const planFromSpeech = (fmt) => {
  const cat = pack.catalog(fmt);
  const find = (k) => cat.find((c) => c.key === k);
  const segs = [segOf(cat[0], 0, "(start)")];
  for (const sent of sentences) {
    const toks = sent.map((w) => norm(w.text));
    const joined = ` ${toks.join(" ")} `;
    for (const rule of RULES) {
      const k = rule.keys.find((key) => joined.includes(` ${key} `));
      if (!k) continue;
      const wanted = typeof rule.key === "function" ? rule.key(toks) : [rule.key];
      const entry = wanted.map(find).find(Boolean);
      if (!entry) continue;
      const first = k.split(" ")[0];
      const word = sent.find((w) => norm(w.text) === first) ?? sent[0];
      const at = Math.max(0, word.start - 0.25);
      const last = segs.at(-1);
      if (last.id === entry.key) break;
      // A graphic stays up until its own animation has played (an Annotate walks
      // through its steps); a cue that comes sooner waits for it.
      const start = Math.max(at, last.from + holdFor(last));
      if (start > body - 2 || (sentences.at(-1) !== sent && start > sent.at(-1).end + 4)) break;
      segs.push(segOf(entry, start, `heard "${k}"`));
      break;
    }
  }
  return closeSegs(segs);
};

/** Source seconds -> body seconds; a moment that was cut lands on the next kept frame. */
const toBodySnap = (t) => {
  let acc = 0;
  for (const c of cuts) {
    if (t < c.from) return acc;
    if (t <= c.to) return acc + (t - c.from);
    acc += c.to - c.from;
  }
  return acc;
};
const fromBody = (b) => {
  let acc = 0;
  for (const c of cuts) {
    const len = c.to - c.from;
    if (b <= acc + len) return c.from + (b - acc);
    acc += len;
  }
  return cuts.at(-1).to;
};

/** Plan from a cue sheet (the booth's key presses, or a sheet you edited). */
const wideFmt = (f) => f === "wide";
const planFromSheet = (fmt, cues) => {
  const cat = pack.catalog(fmt);
  const segs = [];
  for (const c of cues.filter((x) => x.key)) {
    const entry = cat.find((x) => x.key === c.key);
    if (!entry) {
      console.log(`  (${fmt}: "${c.key}" has no ${fmt} version - the previous graphic stays up)`);
      continue;
    }
    const from = +toBodySnap(c.t).toFixed(3);
    if (from >= body - 0.2) continue;
    // Two presses inside one cut pause land on the same frame: the later one wins.
    if (segs.length && segs.at(-1).from === from) segs.pop();
    if (segs.length && segs.at(-1).id === entry.key) continue;
    segs.push({ ...segOf(entry, from, `cue ${formatTime(c.t)}`), src: c.t });
  }
  if (!segs.length || segs[0].from > 0) segs.unshift({ ...segOf(cat[0], 0, "(start)"), src: 0 });
  const closed = closeSegs(segs);

  // Spotlights belong to the formation on screen at that moment.
  for (const c of cues.filter((x) => x.cmd === "focus")) {
    const tb = toBodySnap(c.t);
    const seg = closed.findLast((x) => x.from <= tb);
    if (!seg || !seg.composition.startsWith("Formation")) {
      console.log(`  (focus "${c.arg}" at ${formatTime(c.t)} is not over a formation - skipped)`);
      continue;
    }
    const name = c.arg === "-" ? null : c.arg;
    if (name && !seg.props.players.some((pl) => pl.name === name)) {
      console.log(`  (focus "${name}" is not a starter on ${seg.label} - skipped)`);
      continue;
    }
    seg.props = { ...seg.props, focuses: [...(seg.props.focuses ?? []), { at: +(tb - seg.from).toFixed(3), name }] };
  }

  // Small graphics over the stage: each on/off pair becomes one span.
  const overlayProps = (what) => {
    if (what === "bug") return item("bug")?.props ?? null;
    if (what === "name") {
      return { title: "Chase Analytics", subtitle: open.show ?? "", team: g.home, league, stat: "", statLabel: "" };
    }
    return {
      league, away: g.away, home: g.home, platform: wideFmt(fmt) ? "youtube" : platform,
      items: [`${g.away} at ${g.home}`, template.spread ?? "", template.total ? `O/U ${template.total}` : "",
              open.kickoff ?? "", "chase-analytics.com"].filter(Boolean),
    };
  };
  const overlays = [];
  const open_at = {};
  for (const c of cues.filter((x) => x.cmd === "overlay")) {
    const [what, state = "on"] = String(c.arg).split(/\s+/);
    const tb = +toBodySnap(c.t).toFixed(3);
    if (state === "on") {
      open_at[what] = tb;
    } else if (open_at[what] !== undefined) {
      const props = overlayProps(what);
      if (props) overlays.push({ name: OVERLAYS_JS[what], from: open_at[what], to: tb, props });
      delete open_at[what];
    }
  }
  for (const [what, from] of Object.entries(open_at)) {
    const props = overlayProps(what);
    if (props) overlays.push({ name: OVERLAYS_JS[what], from, to: body, props });
  }

  const sizes = [{ from: 0, size: "full" }];
  for (const c of cues.filter((x) => x.cmd === "size")) {
    const from = +toBodySnap(c.t).toFixed(3);
    if (sizes.at(-1).from === from) sizes.pop();
    if (sizes.at(-1)?.size !== c.arg) sizes.push({ from, size: c.arg });
  }

  const layouts = [{ from: 0, mode: defaultLayout }];
  for (const c of cues.filter((x) => x.cmd === "layout")) {
    const from = +toBodySnap(c.t).toFixed(3);
    if (layouts.at(-1).from === from) layouts.pop();
    if (layouts.at(-1)?.mode !== c.arg) layouts.push({ from, mode: c.arg });
  }
  if (!layouts.length || layouts[0].from > 0) layouts.unshift({ from: 0, mode: defaultLayout });

  // A stroke stays until "clear" or the next graphic, whichever comes first.
  const ends = cues.filter((x) => x.cmd === "clear" || x.key).map((x) => x.t);
  const strokes = [];
  for (const c of cues.filter((x) => x.cmd === "draw")) {
    const st = strokeData.get(Number(c.arg));
    if (!st || (st.format && st.format !== fmt)) continue;
    const end = ends.find((e) => e > c.t);
    strokes.push({ ...st, from: +toBodySnap(c.t).toFixed(3), until: end === undefined ? null : +toBodySnap(end).toFixed(3) });
  }
  const marks = cues.filter((x) => x.cmd === "mark").map((x) => ({ at: toBodySnap(x.t), note: x.arg }));
  return { segments: closed, layouts, strokes, marks, overlays, sizes };
};

const defaultLayout = opts.layout ?? "bubble";
if (!LAYOUT_MODES_JS.includes(defaultLayout)) die(`--layout must be one of ${LAYOUT_MODES_JS.join(", ")}`);
const sheetPath = opts.cues ? path.resolve(opts.cues) : path.join(root, "footage", `${name}.cues.txt`);
const drawPath = sheetPath.replace(/\.cues\.txt$/, "") + ".draw.json";
const strokeData = new Map(
  (fs.existsSync(drawPath) ? JSON.parse(fs.readFileSync(drawPath, "utf8")) : []).map((st) => [st.id, st]),
);
let sheetCues = null;
if (fs.existsSync(sheetPath) && !flags.has("auto-cues")) {
  const keys = [...new Set([...pack.catalog("vertical"), ...pack.catalog("wide")].map((c) => c.key))];
  const { cues, errors } = parseCueSheet(fs.readFileSync(sheetPath, "utf8"), keys, new Set(strokeData.keys()));
  if (errors.length) {
    die(`Cue sheet ${sheetPath} has problems:\n    ${errors.join("\n    ")}\n  Graphics you can use: ${keys.join(", ")}`);
  }
  sheetCues = cues;
  console.log(`  following your cue sheet: ${rel(sheetPath)} (${cues.length} cues)`);
} else {
  console.log("  choosing graphics from what you said (no cue sheet)");
}
const plan = (fmt) =>
  sheetCues
    ? planFromSheet(fmt, sheetCues)
    : { segments: planFromSpeech(fmt), layouts: [{ from: 0, mode: defaultLayout }], strokes: [], marks: [],
        overlays: [], sizes: [{ from: 0, size: "full" }] };
if (!sheetCues) {
  // Save the choice as a cue sheet, so the timing can be changed by editing it.
  const auto = planFromSpeech("vertical").map((s) => ({ t: +fromBody(s.from).toFixed(2), key: s.id }));
  fs.mkdirSync(path.dirname(sheetPath), { recursive: true });
  fs.writeFileSync(
    sheetPath,
    formatCueSheet(auto, pack.catalog("vertical"), [
      `Cue sheet for ${path.basename(source)} - ${g.away} at ${g.home}`,
      "Picked automatically from what you said.",
    ]),
  );
  console.log(`  wrote ${rel(sheetPath)} - edit it to change when graphics appear`);
}

const outDir = path.join(root, "out", "edit");
const propsDir = path.join(root, "props", "edit", name);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(propsDir, { recursive: true });

const jobs = [];
const planText = [`${name}  ·  ${g.away} at ${g.home}  ·  ${clock(duration)} recorded -> ${clock(body)} after cuts`, ""];
for (const fmt of formats) {
  const wide = fmt === "wide";
  const { segments, layouts, strokes, marks, overlays, sizes } = plan(fmt);
  const camSize = Number(opts["cam-size"] ?? (wide ? 210 : 250));
  const intro = wide && item("open") ? { composition: "EpisodeOpen", props: item("open").props, seconds: 6 } : null;
  const outro = wide
    ? { composition: "EndScreen", props: { guides: false }, seconds: 10 }
    : { composition: "Sting", props: { ...(item("sting")?.props ?? {}), ground: true }, seconds: 2.5 };
  const music = opts.music
    ? (() => {
        const dest = path.join(work, `music${path.extname(opts.music)}`);
        fs.copyFileSync(path.resolve(opts.music), dest);
        return { src: rel(dest).replace(/^public\//, ""), volume: 0.08 };
      })()
    : null;
  const props = {
    format: fmt,
    platform: wide ? "youtube" : platform,
    league, away: g.away, home: g.home,
    host: "Chase Analytics",
    show: open.show ?? "",
    line: [template.spread, template.total && `O/U ${template.total}`].filter(Boolean).join(" · "),
    // No camera (or an audio file): the track still carries the voice, drawn at size 0.
    camera: {
      src: rel(camera).replace(/^public\//, ""),
      focusX,
      focusY,
      size: flags.has("no-camera") || !probe ? 0 : camSize,
      mirror: flags.has("mirror"),
      volume: 1,
    },
    music,
    cuts,
    words: bodyWords,
    segments: segments.map(({ id, label, composition, props: p, from, to, cue }) => ({
      id, label, composition, props: p, from: +from.toFixed(3), to: +to.toFixed(3), cue,
    })),
    intro,
    outro,
    captions: !flags.has("no-captions"),
    layouts,
    strokes,
    overlays,
    sizes,
  };
  const propsFile = path.join(propsDir, `${fmt}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 1));
  const lead = intro ? intro.seconds : 0;
  planText.push(`${fmt.toUpperCase()}  (${clock(lead + body + outro.seconds)} total)`);
  if (intro) planText.push(`  0:00  Episode open`);
  const events = [
    ...props.segments.map((s) => ({ at: s.from, text: `${s.label.padEnd(34)} ${s.cue ?? ""}` })),
    ...layouts.slice(1).map((l) => ({ at: l.from, text: `  layout -> ${l.mode}` })),
    ...props.segments.flatMap((s) => (s.props.focuses ?? []).map((f) => ({ at: s.from + f.at, text: `  spotlight ${f.name ?? "off"}` }))),
    ...strokes.map((st) => ({ at: st.from, text: `  drawing #${st.id}` })),
    ...marks.map((m) => ({ at: m.at, text: `  mark: ${m.note}` })),
    ...overlays.map((o) => ({ at: o.from, text: `  overlay ${o.name} (to ${clock(lead + o.to)})` })),
    ...sizes.slice(1).map((z) => ({ at: z.from, text: `  graphic size -> ${z.size}` })),
  ].sort((x, y) => x.at - y.at);
  for (const e of events) planText.push(`  ${clock(lead + e.at).padStart(5)}  ${e.text}`);
  planText.push(`  ${clock(lead + body).padStart(5)}  ${wide ? "End screen" : "Sting"}`, "");
  jobs.push({ fmt, props, propsFile, out: path.join(outDir, `${name}-${fmt}.mp4`) });
}
if (redone.length) planText.push("Redone takes removed:", ...redone.map((r) => `  ${clock(r.at)}  "${r.said}"`), "");
fs.writeFileSync(path.join(propsDir, "plan.txt"), planText.join("\n"));
console.log("\n" + planText.map((l) => "  " + l).join("\n"));

if (flags.has("plan-only")) {
  console.log(`Plan saved: ${rel(path.join(propsDir, "plan.txt"))}`);
  process.exit(0);
}

/* ── 5. render ────────────────────────────────────────────────────────────── */
step(5, "Render");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts") });
for (const job of jobs) {
  const composition = await selectComposition({ serveUrl, id: "Episode", inputProps: job.props });
  let shown = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    audioBitrate: "192k",
    outputLocation: job.out,
    inputProps: job.props,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 20) * 5;
      if (pct !== shown) {
        shown = pct;
        process.stdout.write(`\r  ${job.fmt.padEnd(8)} ${String(pct).padStart(3)}%`);
      }
    },
  });
  console.log(`\r  ${job.fmt.padEnd(8)} done -> ${rel(job.out)}`);
}
console.log(`\nFinished. Videos are in ${outDir}`);
if (!flags.has("no-open") && process.platform === "win32") spawnSync("explorer", [outDir]);
