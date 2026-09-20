#!/usr/bin/env node
/**
 * THE RECORDING BOOTH: record yourself with the finished layout live on screen,
 * bringing graphics up with the keyboard.
 *
 *   node scripts/booth.mjs [--pack props/pack/<game>] [--platform reels|tiktok|shorts] [--port 8790]
 *                          [--refresh-min 3] [--no-open]
 *
 * Live lines: every --refresh-min minutes (and at start, and on the page's Refresh
 * button) the pack's data is re-read (python -m outputs.video_pack --refresh), so the
 * graphics on screen carry the current DraftKings numbers.
 *
 * Builds booth/app.tsx, serves it on http://localhost:8790 and opens it. A take is
 * saved to video/footage/take-<date>-<time>.webm with a cue sheet
 * (<name>.cues.txt) of when each graphic came up; "Make my video" runs the
 * auto-edit on it (scripts/edit.mjs), which follows that sheet.
 */
import { build } from "esbuild";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack, newestPack } from "./lib/catalog.mjs";
import { formatCueSheet } from "./lib/cues.mjs";
import { attachWs } from "./lib/ws-text.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const port = Number(opt("port", 8790));
const packArg = opt("pack", null) ? path.resolve(root, opt("pack")) : newestPack(root);
let packDir = packArg;
if (!packDir) {
  console.error("No game pack. Build one first: python -m outputs.video_pack --league nfl --game AWAY@HOME");
  process.exit(1);
}
const footage = path.join(root, "footage");
fs.mkdirSync(footage, { recursive: true });

const listPacks = () => {
  const base = path.join(root, "props", "pack");
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((d) => fs.existsSync(path.join(base, d, "pack.json")))
    .sort()
    .reverse()
    .map((d) => {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(base, d, "pack.json"), "utf8"));
        return {
          id: d,
          away: m.game?.away,
          home: m.game?.home,
          line: m.game?.line ?? "",
          kickoff: m.game?.kickoff ?? "",
          active: path.basename(packDir) === d,
        };
      } catch {
        return { id: d, away: "", home: "", line: "", kickoff: "", active: false };
      }
    });
};

const resolvePack = (id) => {
  const base = path.join(root, "props", "pack");
  const dest = path.resolve(base, path.basename(id));
  return dest.startsWith(base + path.sep) && fs.existsSync(path.join(dest, "pack.json")) ? dest : null;
};

if (!fs.existsSync(path.join(root, "src", "site", "index.css"))) {
  console.error("The site style export is missing. Run: npm run sync-style");
  process.exit(1);
}

console.log("Building the booth ...");
const dist = path.join(root, "booth", "dist");
await build({
  entryPoints: [path.join(root, "booth", "app.tsx")],
  bundle: true,
  outdir: dist,
  format: "esm",
  jsx: "automatic",
  target: "chrome120",
  sourcemap: true,
  logLevel: "warning",
  // package.json marks only *.css as side-effectful (for Remotion's bundler); the
  // components' bare `import "../fonts"` must still be kept here.
  ignoreAnnotations: true,
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "file", ".woff": "file", ".ttf": "file", ".png": "file", ".svg": "file" },
});

/* ── live data ── */
const repo = path.resolve(root, "..");
const refreshMin = Number(opt("refresh-min", 3));
const live = { version: 0, updated: null, line: "", busy: false, error: "" };
const readLine = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(packDir, "pack.json"), "utf8")).game?.line ?? "";
  } catch {
    return "";
  }
};
live.line = readLine();
function refreshPack(reason) {
  if (live.busy) return;
  live.busy = true;
  const py = spawn(process.platform === "win32" ? "python" : "python3", ["-m", "outputs.video_pack", "--refresh", packDir], {
    cwd: repo,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let err = "";
  py.stderr.on("data", (d) => (err += d));
  py.on("error", (e) => {
    live.busy = false;
    live.error = String(e);
  });
  py.on("close", (code) => {
    live.busy = false;
    if (code === 0) {
      const before = live.line;
      live.line = readLine();
      live.version += 1;
      live.updated = new Date().toISOString();
      live.error = "";
      console.log(`  live data refreshed (${reason})${before && before !== live.line ? `: ${before} -> ${live.line}` : ""}`);
    } else {
      live.error = err.split("\n").filter(Boolean).slice(-3).join(" ");
      console.log(`  live refresh failed: ${live.error}`);
    }
  });
}
refreshPack("start");
setInterval(() => refreshPack("timer"), Math.max(1, refreshMin) * 60_000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

const sendFile = (res, file) => {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    // Graphics and photos change under the page (live refresh, re-downloads): always revalidate.
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(file).pipe(res);
};
/** Resolve a URL path inside a directory, refusing anything that climbs out. */
const inside = (dir, urlPath) => {
  const file = path.resolve(dir, "." + decodeURIComponent(urlPath));
  return file.startsWith(dir + path.sep) ? file : null;
};
const safeName = (n) => (/^[\w.-]{1,80}$/.test(n ?? "") ? n : null);
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const parts = [];
    req.on("data", (c) => parts.push(c));
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });

const lanIps = () => {
  const ips = [];
  for (const rows of Object.values(os.networkInterfaces())) {
    for (const a of rows ?? []) {
      const v4 = a.family === "IPv4" || a.family === 4;
      if (v4 && !a.internal) ips.push(a.address);
    }
  }
  return ips;
};
const phonePort = port + 1;
const ensureBoothPfx = () => {
  if (process.platform !== "win32") return null;
  const dir = path.join(root, ".cache");
  const pfx = path.join(dir, "booth.pfx");
  const meta = path.join(dir, "booth-cert.json");
  const names = ["localhost", os.hostname(), ...lanIps()].filter(Boolean);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const prev = JSON.parse(fs.readFileSync(meta, "utf8"));
    if (fs.existsSync(pfx) && names.every((n) => prev.names?.includes(n))) return pfx;
  } catch {
    /* rebuild */
  }
  const dns = names.map((n) => `'${String(n).replace(/'/g, "")}'`).join(",");
  const ps1 = path.join(dir, "booth-cert.ps1");
  fs.writeFileSync(
    ps1,
    `$ErrorActionPreference = 'Stop'
$names = @(${dns})
$cert = New-SelfSignedCertificate -DnsName $names -NotAfter (Get-Date).AddYears(3) -KeyExportPolicy Exportable -KeySpec KeyExchange -CertStoreLocation 'Cert:\\CurrentUser\\My' -FriendlyName 'Chase recording booth'
$pwd = ConvertTo-SecureString 'booth' -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath '${pfx.replace(/'/g, "''")}' -Password $pwd | Out-Null
Remove-Item -LiteralPath ('Cert:\\CurrentUser\\My\\' + $cert.Thumbprint)
`,
  );
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1], { windowsHide: true, encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(pfx)) {
    console.log(`  phone mic cert skipped: ${(r.stderr || r.stdout || "powershell failed").trim().slice(-240)}`);
    return null;
  }
  fs.writeFileSync(meta, JSON.stringify({ names }));
  return pfx;
};
const rooms = { booth: null, phone: null };
const onUpgrade = (req, socket, head) => {
  if (new URL(req.url, "http://booth").pathname !== "/ws") {
    socket.destroy();
    return;
  }
  attachWs(req, socket, head, (msg, send) => {
    if (msg.role === "booth" || msg.role === "phone") {
      rooms[msg.role]?.close();
      rooms[msg.role] = { send, close: () => socket.end() };
      if (msg.role === "phone") send(rooms.booth ? { type: "booth-ready" } : { type: "need-booth" });
      if (msg.role === "booth" && rooms.phone) rooms.phone.send({ type: "booth-ready" });
      return;
    }
    const fromPhone = rooms.phone && rooms.phone.send === send;
    const other = fromPhone ? rooms.booth : rooms.phone;
    if (other) other.send(msg);
    else if (fromPhone) send({ type: "need-booth" });
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const p = url.pathname;
  try {
    if (p === "/") return sendFile(res, path.join(root, "booth", "index.html"));
    if (p === "/mic") return sendFile(res, path.join(root, "booth", "mic.html"));
    if (p === "/api/lan") {
      const ips = lanIps();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(
        JSON.stringify({
          phone: ips[0] ? `https://${ips[0]}:${phonePort}/mic` : "",
          urls: ips.map((ip) => `https://${ip}:${phonePort}/mic`),
          port: phonePort,
        }),
      );
    }
    if (p.startsWith("/dist/")) {
      const f = inside(dist, p.slice("/dist".length));
      return f ? sendFile(res, f) : res.writeHead(403).end();
    }
    if (p === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({ ...live, everyMin: refreshMin }));
    }
    if (req.method === "POST" && p === "/api/refresh") {
      refreshPack("button");
      return res.writeHead(202).end("refreshing");
    }
    if (p === "/api/packs") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({ packs: listPacks(), current: path.basename(packDir) }));
    }
    if (req.method === "POST" && p === "/api/pack") {
      const body = JSON.parse(await readBody(req));
      const next = resolvePack(String(body.id ?? body.pack ?? ""));
      if (!next) return res.writeHead(404).end("unknown pack");
      packDir = next;
      live.version += 1;
      live.line = readLine();
      live.updated = new Date().toISOString();
      console.log(`  switched pack -> ${path.basename(packDir)}`);
      refreshPack("switch");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ pack: path.basename(packDir) }));
    }
    if (p === "/api/catalog") {
      const pack = loadPack(packDir); // re-read, so a rebuilt pack shows on reload
      const { game, open } = pack;
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          game: { ...game, kickoff: open.kickoff ?? game.kickoff },
          title: open.awayName && open.homeName ? `${open.awayName} at ${open.homeName}` : `${game.away} at ${game.home}`,
          line: pack.line,
          pack: path.basename(packDir),
          formats: { vertical: pack.catalog("vertical"), wide: pack.catalog("wide") },
          groups: pack.groups("vertical").map((g) => ({ group: g.group, label: g.label, section: g.section, keys: g.variants.map((v) => v.key) })),
          platform: opt("platform", "reels"),
        }),
      );
    }
    if (req.method === "POST" && p === "/api/save") {
      const name = safeName(url.searchParams.get("name"));
      const ext = url.searchParams.get("ext");
      if (!name || !["webm", "mp4"].includes(ext)) return res.writeHead(400).end("bad name");
      const file = path.join(footage, `${name}.${ext}`);
      const out = fs.createWriteStream(file);
      req.pipe(out);
      out.on("finish", () => {
        console.log(`  saved ${path.relative(root, file)} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
        res.writeHead(200).end("ok");
      });
      out.on("error", (e) => res.writeHead(500).end(String(e)));
      return;
    }
    if (req.method === "POST" && p === "/api/cues") {
      const name = safeName(url.searchParams.get("name"));
      if (!name) return res.writeHead(400).end("bad name");
      // { cues: [{t, key} | {t, cmd, arg}], strokes: [{id, tone, arrow, points}] }
      const body = JSON.parse(await readBody(req));
      const cues = Array.isArray(body) ? body : body.cues;
      const strokes = Array.isArray(body) ? [] : body.strokes ?? [];
      const pack = loadPack(packDir);
      const tidy = (c) =>
        c.cmd
          ? { t: Math.round(c.t * 10) / 10, cmd: String(c.cmd), arg: String(c.arg ?? "").replace(/[\r\n#]/g, " ") }
          : { t: Math.round(c.t * 10) / 10, key: String(c.key) };
      if (strokes.length) {
        fs.writeFileSync(path.join(footage, `${name}.draw.json`), JSON.stringify(strokes));
      }
      const text = formatCueSheet(
        cues.map(tidy),
        pack.catalog("vertical"),
        [`Cue sheet for ${name}.webm - ${pack.game.away} at ${pack.game.home}`, "Recorded in the booth: these are your key presses."],
      );
      fs.writeFileSync(path.join(footage, `${name}.cues.txt`), text);
      return res.writeHead(200).end("ok");
    }
    if (req.method === "POST" && p === "/api/edit") {
      const name = safeName(url.searchParams.get("name"));
      const ext = url.searchParams.get("ext");
      const file = name && path.join(footage, `${name}.${ext}`);
      if (!file || !fs.existsSync(file)) return res.writeHead(404).end("recording not found");
      const plat = url.searchParams.get("platform");
      const packArg = ["--pack", path.relative(root, packDir), ...(["tiktok", "shorts"].includes(plat) ? ["--platform", plat] : [])];
      if (process.platform === "win32") {
        // A console window of its own, so the progress is visible and the booth stays free.
        spawn("cmd.exe", ["/c", "start", `"Editing ${name}"`, "cmd", "/k", "node", "scripts/edit.mjs", `footage/${name}.${ext}`, ...packArg], {
          cwd: root,
          detached: true,
          stdio: "ignore",
          windowsVerbatimArguments: true,
        }).unref();
      } else {
        spawn("node", ["scripts/edit.mjs", file, ...packArg], { cwd: root, stdio: "inherit" });
      }
      return res.writeHead(200).end("started");
    }
    // Everything else is the Remotion public folder (logos, captures, brand icon).
    const f = inside(path.join(root, "public"), p);
    return f ? sendFile(res, f) : res.writeHead(403).end();
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(String(e));
  }
});

const openBrowser = (url) => {
  if (!args.includes("--no-open") && process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  }
};
server.on("upgrade", onUpgrade);
server.on("error", (e) => {
  if (e.code !== "EADDRINUSE") throw e;
  // Most likely the booth is already running in another window: just show it.
  console.log(`The booth is already running at http://localhost:${port} - opening it.`);
  openBrowser(`http://localhost:${port}`);
  process.exit(0);
});
server.listen(port, "127.0.0.1", () => {
  const url = `http://localhost:${port}`;
  console.log(`\nRecording booth: ${url}   (game pack ${path.basename(packDir)})`);
  console.log("Keep this window open while you record. Close it when you are done.");
  openBrowser(url);
});

const pfx = ensureBoothPfx();
if (pfx) {
  const handler = server.listeners("request")[0];
  const secure = https.createServer({ pfx: fs.readFileSync(pfx), passphrase: "booth" }, handler);
  secure.on("upgrade", onUpgrade);
  secure.on("error", (e) => {
    if (e.code === "EADDRINUSE") console.log(`  phone mic port ${phonePort} is already in use.`);
    else console.log(`  phone mic https: ${e.message}`);
  });
  secure.listen(phonePort, "0.0.0.0", () => {
    const urls = lanIps().map((ip) => `https://${ip}:${phonePort}/mic`);
    console.log(urls.length ? `Phone as mic (desktop camera stays here): ${urls.join("  ")}\n` : `\n`);
  });
} else {
  console.log("");
}
