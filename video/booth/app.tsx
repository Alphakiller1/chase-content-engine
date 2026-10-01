/**
 * The recording booth (served by scripts/booth.mjs at http://localhost:8790).
 *
 * You see the finished frame live - the graphic in the stage, your camera in its
 * window - and run the show from the keyboard while you talk: graphics and their
 * filters, layouts, player spotlights, telestration, marks. Recording saves the raw
 * camera take to video/footage/ plus a cue sheet (and drawings) of everything you
 * did, which the auto-edit replays exactly.
 */
import { Player, PlayerRef } from "@remotion/player";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BoothFrame, BoothFrameProps } from "../src/edit/BoothFrame";
import { Box, LAYOUT_MODES, LayoutMode, SITE_VIEWS, SiteView, StageSize, Stroke, frameGeom, siteSplit } from "../src/edit/frames";
import { teamAccent } from "../src/teams";
import "../src/theme.css";
import "./booth.css";
import { STATIC, downloadBlob, url } from "./host";
import { boothRoom, micUrl, peerIdFor, qrUrl } from "./phoneLink";
import { captureProgram, withAudio } from "./composite";

/* ── types ────────────────────────────────────────────────────────────────── */

type Entry = {
  key: string;
  label: string;
  group: string;
  groupLabel: string;
  composition: string;
  props: Record<string, unknown>;
  note: string;
};
type Group = { group: string; label: string; section?: string; keys: string[] };
type Catalog = {
  game: { league: "nfl" | "mlb"; away: string; home: string; kickoff?: string };
  title: string;
  line: string;
  pack: string;
  platform: "reels" | "tiktok" | "shorts";
  formats: { vertical: Entry[]; wide: Entry[] };
  groups: Group[];
};
type PackOpt = { id: string; away: string; home: string; line: string; kickoff: string; active: boolean };
type Live = { version: number; updated: string | null; line: string; busy: boolean; error: string; everyMin: number };
type Cue = { t: number; key?: string; cmd?: string; arg?: string };
type Phase = "idle" | "countdown" | "recording" | "saving" | "saved" | "error";
type Tone = Stroke["tone"];
type Focus = { at: number; name: string | null };
type LiveStroke = Stroke & { live?: boolean };

/* ── constants ────────────────────────────────────────────────────────────── */

const GROUP_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const LAYOUT_KEYS: Record<string, LayoutMode> = { a: "bubble", s: "split", d: "full", f: "host" };
const LAYOUT_LABEL: Record<LayoutMode, string> = { bubble: "Bubble", split: "Split", full: "Graphic only", host: "Camera only" };
const DEFAULT_LAYOUT: LayoutMode = STATIC ? "full" : "bubble";
const TONES: Tone[] = ["accent", "caution", "negative", "positive", "primary"];
const TONE_CSS: Record<Tone, string> = {
  accent: "var(--accent)",
  caution: "var(--mark-caution)",
  negative: "var(--mark-negative)",
  positive: "var(--mark-positive)",
  primary: "#ffffff",
};
const CAM = { vertical: 250, wide: 210 };
const PLATFORMS = [
  { key: "reels", label: "Reels" },
  { key: "tiktok", label: "TikTok" },
  { key: "shorts", label: "Shorts" },
] as const;
type Plat = (typeof PLATFORMS)[number]["key"];
const SIZES: StageSize[] = ["full", "compact", "small"];
const SIZE_LABEL: Record<StageSize, string> = { full: "Full", compact: "Compact", small: "Small" };
/** Small graphics that sit over the stage: booth key -> composition. */
const OVERLAYS = { bug: "CornerBug", name: "LowerThird", ticker: "Ticker" } as const;
type OverlayKey = keyof typeof OVERLAYS;
const OVERLAY_LABEL: Record<OverlayKey, string> = { bug: "Matchup bug", name: "Name strap", ticker: "Line ticker" };
const OVERLAY_KEYS: Record<string, OverlayKey> = { b: "bug", n: "name", k: "ticker" };
/* chase-analytics.com in the booth: tabs that go on the stage (recorded) or sit in the
   off-air reference panel (only you see it). */
const SITE_ORIGIN = "https://chase-analytics.com";
const SITE_LINKS: [string, string][] = [
  ["Home", "/"],
  ["NFL", "/nfl/"],
  ["MLB", "/mlb/"],
  ["CFB", "/cfb/"],
  ["Models", "/model-center/"],
];
const MAX_SITE_TABS = 8;
const SITE_KEYS: Record<string, SiteView> = { g: "off", w: "full", e: "compare", q: "pair" };
const SITE_LABEL: Record<SiteView, string> = { off: "Graphic", full: "Site", compare: "Graphic + site", pair: "Two pages" };
/** The width the site lays itself out at (narrower = bigger type on the stage). */
const SITE_WIDTH: Record<"vertical" | "wide", Record<Exclude<SiteView, "off">, number>> = {
  wide: { full: 1280, compare: 960, pair: 960 },
  vertical: { full: 430, compare: 430, pair: 430 },
};
type SiteTab = { id: number; path: string; rev: number };
/** A page path on chase-analytics.com from whatever was typed, or null for another site. */
const sitePath = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return "/";
  // A bare section name ("nfl") is that section's page.
  if (/^[\w-]+$/.test(raw)) return `/${raw.toLowerCase()}/`;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(raw) ? `https://${raw}` : `${SITE_ORIGIN}/${raw.replace(/^\/+/, "")}`);
    if (!/(^|\.)chase-analytics\.com$/i.test(u.hostname)) return null;
    return `${u.pathname}${u.search}${u.hash}` || "/";
  } catch {
    return null;
  }
};
const siteUrl = (path: string) => `${SITE_ORIGIN}${path}`;
const loadSiteTabs = (): { tabs: SiteTab[]; air: number; ref: number } => {
  try {
    const saved = JSON.parse(readPref("booth.siteTabs", "{}")) as { tabs?: unknown; air?: unknown; ref?: unknown };
    const paths = (Array.isArray(saved.tabs) ? saved.tabs : []).map((x) => sitePath(String(x))).filter((x): x is string => !!x);
    const tabs = paths.slice(0, MAX_SITE_TABS).map((path, i) => ({ id: i + 1, path, rev: 0 }));
    const pick = (i: unknown) => tabs[Number.isInteger(i) ? (i as number) : 0]?.id ?? tabs[0]?.id ?? 0;
    return { tabs, air: pick(saved.air), ref: pick(saved.ref) };
  } catch {
    return { tabs: [], air: 0, ref: 0 };
  }
};
const sameBoxes = (a: Box[], b: Box[]) =>
  a.length === b.length && a.every((x, i) => ["x", "y", "w", "h"].every((k) => Math.abs(x[k as keyof Box] - b[i][k as keyof Box]) < 0.5));

/** Mirrors src/ds/safe.ts: the band each app paints over the bottom of a vertical video. */
const SAFE_BOTTOM = { reels: 440, tiktok: 420, shorts: 400 } as const;
const FPS = 30;
/** Every graphic's entrance has settled by this frame (Annotate excepted: its steps ARE the content). */
const SETTLED = Math.round(3.5 * FPS);

/* ── helpers ──────────────────────────────────────────────────────────────── */

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const cueTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `take-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const readPref = (k: string, fallback: string) => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const writePref = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private window: the choice just is not remembered */
  }
};
const settleFrame = (e: Entry | null) =>
  !e ? 0 : e.composition === "Annotate" ? 0 : e.composition.startsWith("RankCountdown") ? 7 * FPS : SETTLED;
const teamOf = (e: Entry | undefined) => String((e?.props as { team?: string } | undefined)?.team ?? "");

/** Measure an element; used to scale the 1920×1080 program into the stage. */
function useBox() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, box] as const;
}

const strokePath = (s: Stroke, W: number, H: number) =>
  s.points.map((p, i) => `${i ? "L" : "M"}${(p[0] * W).toFixed(1)},${(p[1] * H).toFixed(1)}`).join(" ");

const arrowHead = (s: Stroke, W: number, H: number) => {
  if (!s.arrow || s.points.length < 2) return "";
  const a = s.points[s.points.length - 1];
  const b = s.points[Math.max(0, s.points.length - 6)];
  const ang = Math.atan2((a[1] - b[1]) * H, (a[0] - b[0]) * W);
  const L = 34;
  const x = a[0] * W;
  const y = a[1] * H;
  return `M${x + L * Math.cos(ang + 2.6)},${y + L * Math.sin(ang + 2.6)} L${x},${y} L${x + L * Math.cos(ang - 2.6)},${y + L * Math.sin(ang - 2.6)}`;
};

const cueLabel = (c: Cue, byKey: Map<string, Entry>) =>
  c.key
    ? byKey.get(c.key)?.label ?? c.key
    : c.cmd === "layout"
      ? `Layout · ${LAYOUT_LABEL[c.arg as LayoutMode]}`
      : c.cmd === "focus"
        ? c.arg === "-"
          ? "Spotlight off"
          : `Spotlight · ${c.arg}`
        : c.cmd === "overlay"
          ? `${OVERLAY_LABEL[String(c.arg).split(" ")[0] as OverlayKey] ?? c.arg} ${String(c.arg).split(" ")[1] ?? "on"}`
          : c.cmd === "size"
            ? `Graphic size · ${SIZE_LABEL[c.arg as StageSize] ?? c.arg}`
            : c.cmd === "draw"
              ? `Drawing #${c.arg}`
              : c.cmd === "clear"
                ? "Clear drawings"
                : c.cmd === "site"
                  ? siteCueLabel(String(c.arg))
                  : `★ ${c.arg}`;
const siteCueLabel = (arg: string) => {
  const [view, ...rest] = arg.split(/\s+/);
  const pages = rest.join(" ").split(SITE_ORIGIN).join("");
  return view === "off" ? "Site off · graphic" : `${SITE_LABEL[view as SiteView] ?? view} · ${pages}`;
};

/* ── app ──────────────────────────────────────────────────────────────────── */

const App: React.FC = () => {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [packs, setPacks] = useState<PackOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [format, setFormat] = useState<"vertical" | "wide">(() => (readPref("booth.format", "vertical") === "wide" ? "wide" : "vertical"));
  const [mode, setMode] = useState<LayoutMode>(DEFAULT_LAYOUT);
  const [currentKey, setCurrentKey] = useState("matchup");
  const [variantOf, setVariantOf] = useState<Record<string, string>>({});
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [focusMap, setFocusMap] = useState<Record<string, Focus[]>>({});
  const [nonce, setNonce] = useState(0);
  const [instant, setInstant] = useState(() => readPref("booth.instant3", "1") === "1");

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRequested, setMediaRequested] = useState(!STATIC);
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [camError, setCamError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState(() => readPref("booth.cam", ""));
  const [micId, setMicId] = useState(() => readPref("booth.mic", ""));
  const [mirror, setMirror] = useState(() => readPref("booth.mirror", "1") === "1");
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [phoneTrack, setPhoneTrack] = useState<MediaStreamTrack | null>(null);
  const [phoneState, setPhoneState] = useState<"off" | "wait" | "live">("off");
  const room = useMemo(() => boothRoom(), []);
  const phoneHref = micUrl(room);

  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [saved, setSaved] = useState("");
  const [message, setMessage] = useState("");

  const [pen, setPen] = useState(() => readPref("booth.pen", "1") === "1");
  const [tone, setTone] = useState<Tone>("caution");
  const [arrow, setArrow] = useState(true);
  const [strokes, setStrokes] = useState<LiveStroke[]>([]);

  const [palette, setPalette] = useState<{ open: boolean; q: string; sel: number }>({ open: false, q: "", sel: 0 });
  const [help, setHelp] = useState(false);
  const [focused, setFocused] = useState(() => document.hasFocus());
  const [flash, setFlash] = useState({ text: "", at: 0 });
  const [live, setLive] = useState<Live | null>(null);
  const [liveCaps, setLiveCaps] = useState(() => readPref("booth.captions", "1") === "1");
  const [heard, setHeard] = useState({ text: "", at: 0 });
  const [capsNote, setCapsNote] = useState("");
  const seenVersion = useRef(0);
  const [platformPref, setPlatformPref] = useState<Plat | "">(() => readPref("booth.platform", "") as Plat | "");
  const [size, setSize] = useState<StageSize>("full");
  const [overlaysOn, setOverlaysOn] = useState<OverlayKey[]>([]);
  const [showZones, setShowZones] = useState(() => readPref("booth.zones", "1") === "1");

  /* site tabs */
  const savedSite = useMemo(loadSiteTabs, []);
  const [siteTabs, setSiteTabs] = useState<SiteTab[]>(savedSite.tabs);
  const [airId, setAirId] = useState(savedSite.air); // the page on the stage (in Two pages: the right / bottom one)
  const [pairId, setPairId] = useState(0); // Two pages: the left / top one
  const [siteView, setSiteView] = useState<SiteView>("off");
  const [refOpen, setRefOpen] = useState(() => readPref("booth.ref", "0") === "1");
  const [refId, setRefId] = useState(savedSite.ref);
  const [siteAddr, setSiteAddr] = useState("");
  const [siteWidths, setSiteWidths] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(readPref("booth.siteWidths", "{}"));
    } catch {
      return {};
    }
  });
  // Tabs get an iframe the first time they are shown (on the stage or in the reference), then keep it.
  const [airMounted, setAirMounted] = useState<number[]>([]);
  const [refMounted, setRefMounted] = useState<number[]>([]);
  const nextTabId = useRef(Math.max(0, ...savedSite.tabs.map((t) => t.id)) + 1);
  const siteLayerRef = useRef<HTMLDivElement>(null);
  /* The take's site track (local booth): the on-air pages, recorded on their own. */
  const siteRec = useRef<{
    stream: MediaStream;
    rec: MediaRecorder | null;
    chunks: Blob[];
    mime: string;
    start: number;
    boxes: { t: number; view: SiteView; boxes: Box[] }[];
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const phoneAudioRef = useRef<HTMLAudioElement>(null);
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const programCapture = useRef<MediaStream | null>(null);
  const [programLive, setProgramLive] = useState(false);
  const lastTake = useRef<Blob | null>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const t0 = useRef(0);
  const cuesRef = useRef<Cue[]>([]);
  const strokeStore = useRef<Stroke[]>([]);
  const drawing = useRef<{ stroke: LiveStroke; start: number; recAt: number | null } | null>(null);
  const nextStrokeId = useRef(1);

  const recording = phase === "recording";
  const entries = useMemo(() => (cat ? cat.formats[format] : []), [cat, format]);
  const allEntries = useMemo(() => (cat ? cat.formats.vertical : []), [cat]);
  const byKey = useMemo(() => new Map(allEntries.map((e) => [e.key, e])), [allEntries]);
  const groups = useMemo(() => cat?.groups ?? [], [cat]);
  const current = entries.find((e) => e.key === currentKey) ?? null;
  const currentVertical = byKey.get(currentKey) ?? null;
  const groupIdx = Math.max(0, groups.findIndex((g) => g.keys.includes(currentKey)));
  const group = groups[groupIdx];
  const startFrame = instant ? settleFrame(current) : 0;
  const platform = (platformPref || cat?.platform || "reels") as Plat;

  const say = useCallback((text: string) => setFlash({ text, at: performance.now() }), []);
  const now = () => (performance.now() - t0.current) / 1000;
  const pushCue = useCallback((c: Omit<Cue, "t">) => {
    if (recRef.current?.state !== "recording") return;
    const cue: Cue = { t: now(), ...c };
    const last = cuesRef.current[cuesRef.current.length - 1];
    // The same kind of switch twice within a quarter second: the second is what you meant.
    if (last && cue.t - last.t < 0.25 && !!last.key === !!cue.key && last.cmd === cue.cmd && cue.cmd !== "draw") {
      cuesRef.current.pop();
    }
    cuesRef.current.push(cue);
    setCues([...cuesRef.current]);
  }, []);

  /* catalog */
  useEffect(() => {
    const packsUrl = STATIC ? url("/data/packs.json") : "/api/packs";
    fetch(packsUrl, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { packs: [] }))
      .then(async (d: { packs?: PackOpt[]; current?: string }) => {
        const list = d.packs ?? [];
        setPacks(list);
        const current = d.current || list.find((p) => p.active)?.id || list[0]?.id;
        const catUrl = STATIC && current ? url(`/data/packs/${current}/catalog.json`) : "/api/catalog";
        const r = await fetch(catUrl, { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const c: Catalog = await r.json();
        setCat(c);
        for (const e of [...c.formats.vertical, ...c.formats.wide]) {
          const p = e.props as {
            capture?: { src?: string }; headshot?: string;
            players?: { headshot?: string }[]; rows?: { headshot?: string }[];
            awayQb?: { headshot?: string }; homeQb?: { headshot?: string };
          };
          const srcs = [
            p.capture?.src, p.headshot, p.awayQb?.headshot, p.homeQb?.headshot,
            ...(p.players ?? []).map((x) => x.headshot),
            ...(p.rows ?? []).map((x) => x.headshot),
          ];
          for (const src of srcs) {
            if (src) new Image().src = (src.startsWith("http") ? src : url("/" + src.replace(/^\//, "")));
          }
        }
      })
      .catch((e) => setLoadError(String((e as Error).message ?? e)));
  }, []);

  /* live lines: follow the server's refreshes and reload the graphics when they land */
  useEffect(() => {
    if (STATIC) return;
    let alive = true;
    const poll = async () => {
      try {
        const st: Live = await (await fetch("/api/status", { cache: "no-store" })).json();
        if (!alive) return;
        setLive(st);
        if (st.version > seenVersion.current) {
          const first = seenVersion.current === 0;
          seenVersion.current = st.version;
          const c: Catalog = await (await fetch("/api/catalog", { cache: "no-store" })).json();
          if (!alive) return;
          setCat((old) => {
            if (!first && old && old.line !== c.line) setFlash({ text: `Line moved · ${old.line} → ${c.line}`, at: performance.now() });
            else if (!first) setFlash({ text: "Live lines refreshed", at: performance.now() });
            return c;
          });
        }
      } catch {
        /* the server is restarting; try again next tick */
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /* live captions: the browser's own speech recognition (Chrome / Edge), preview only -
     the finished video is captioned from the recording itself */
  useEffect(() => {
    if (!liveCaps || !stream) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setCapsNote("Live captions need Chrome or Edge. Your video is still captioned when it is made.");
      return;
    }
    let stopped = false;
    let finals = "";
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals = `${finals} ${r[0].transcript}`.trim();
        else interim += r[0].transcript;
      }
      finals = finals.split(/\s+/).slice(-40).join(" ");
      setHeard({ text: `${finals} ${interim}`.trim(), at: performance.now() });
      setCapsNote("");
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stopped = true;
        setCapsNote("The browser blocked speech recognition. Your video is still captioned when it is made.");
      } else if (e.error === "network") {
        setCapsNote("Live captions need an internet connection (the browser's speech service).");
      }
    };
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start();
        } catch {
          /* already restarting */
        }
      }
    };
    try {
      rec.start();
    } catch {
      /* started twice */
    }
    // Clear the slot after a pause, the way the finished captions page.
    const id = setInterval(() => {
      setHeard((h) => {
        if (h.text && performance.now() - h.at > 2500) {
          finals = "";
          return { text: "", at: 0 };
        }
        return h;
      });
    }, 500);
    return () => {
      stopped = true;
      clearInterval(id);
      try {
        rec.stop();
      } catch {
        /* not running */
      }
    };
  }, [liveCaps, stream]);

  /* desktop camera always; desktop mic unless the phone is the mic */
  useEffect(() => {
    if (!mediaRequested) return;
    let alive = true;
    let local: MediaStream | null = null;
    const desktopMic = micId !== "phone";
    navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: desktopMic
          ? { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : false,
      })
      .then(async (s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        local = s;
        setCamStream(s);
        setCamError("");
        if (STATIC) setMode((currentMode) => (currentMode === "full" ? "bubble" : currentMode));
        setDevices(await navigator.mediaDevices.enumerateDevices());
      })
      .catch((e) => setCamError(`Camera or microphone is not available: ${e.message}. Check the browser permission icon, then try again.`));
    return () => {
      alive = false;
      local?.getTracks().forEach((t) => t.stop());
      setCamStream(null);
    };
  }, [camId, mediaAttempt, mediaRequested, micId]);

  useEffect(() => {
    if (!phoneTrack) return;
    phoneTrack.enabled = true;
    const ctx = new AudioContext();
    void ctx.resume();
    const src = ctx.createMediaStreamSource(new MediaStream([phoneTrack]));
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(ctx.destination);
    const el = phoneAudioRef.current;
    if (el) {
      el.srcObject = new MediaStream([phoneTrack]);
      el.muted = true;
      void el.play();
    }
    return () => {
      void ctx.close();
      if (el) el.srcObject = null;
    };
  }, [phoneTrack]);

  useEffect(() => {
    if (!camStream) {
      setStream(null);
      return;
    }
    const mixed = new MediaStream();
    const extra: MediaStreamTrack[] = [];
    for (const t of camStream.getVideoTracks()) mixed.addTrack(t);
    if (micId === "phone") {
      if (phoneTrack && phoneTrack.readyState === "live") {
        const clone = phoneTrack.clone();
        clone.enabled = true;
        extra.push(clone);
        mixed.addTrack(clone);
      }
    } else {
      for (const t of camStream.getAudioTracks()) mixed.addTrack(t);
    }
    setStream(mixed);
    return () => extra.forEach((t) => t.stop());
  }, [camStream, phoneTrack, micId]);

  useEffect(() => {
    if (micId !== "phone") {
      setPhoneTrack(null);
      setPhoneState("off");
      return;
    }
    setPhoneState("wait");
    let peer: import("peerjs").default | null = null;
    let callRef: import("peerjs").MediaConnection | null = null;
    let cancelled = false;
    import("peerjs").then(({ default: Peer }) => {
      if (cancelled) return;
      const createdPeer = new Peer(peerIdFor(room), {
        config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      });
      peer = createdPeer;
      createdPeer.on("open", () => say("Phone link ready — scan or open it on your phone"));
      createdPeer.on("error", (err) => {
        if (err.type === "unavailable-id") say("Audio room busy — reload the booth and try again");
        else say("Phone link error: " + err.type);
      });
      createdPeer.on("call", (call) => {
        call.answer();
        callRef = call;
        call.on("stream", (remote) => {
          const t = remote.getAudioTracks()[0];
          if (!t) return;
          setPhoneTrack(t);
          setPhoneState("live");
          say("Phone mic is live — desktop camera unchanged");
        });
        call.on("close", () => {
          setPhoneTrack(null);
          setPhoneState("wait");
        });
      });
    });
    return () => {
      cancelled = true;
      callRef?.close();
      peer?.destroy();
      setPhoneTrack(null);
      setPhoneState("off");
    };
  }, [micId, room, say]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, format, cat]);

  /* A graphic with no version in this format (the model read is vertical only):
     fall back to the first one in the same group, so the stage is never empty. */
  useEffect(() => {
    if (!cat || entries.some((e) => e.key === currentKey)) return;
    const g = groups.find((x) => x.keys.includes(currentKey));
    const alt = g?.keys.find((k) => entries.some((e) => e.key === k)) ?? entries[0]?.key;
    if (alt) {
      setCurrentKey(alt);
      setNonce((n) => n + 1);
    }
  }, [cat, currentKey, entries, groups]);

  /* mic level */
  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) return;
    const clones = stream.getAudioTracks().map((t) => t.clone());
    const ctx = new AudioContext();
    void ctx.resume();
    const src = ctx.createMediaStreamSource(new MediaStream(clones));
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let raf = 0;
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
      const level = Math.max(0, Math.min(1, (db + 60) / 60));
      if (meterRef.current) {
        meterRef.current.style.transform = `scaleX(${level})`;
        meterRef.current.style.background =
          level > 0.9 ? "var(--mark-negative)" : level > 0.45 ? "var(--mark-positive)" : "var(--text-muted)";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      clones.forEach((t) => t.stop());
      ctx.close();
    };
  }, [stream]);

  /* focus tracking, flash, timer */
  useEffect(() => {
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    window.addEventListener("focus", on);
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("focus", on);
      window.removeEventListener("blur", off);
    };
  }, []);
  useEffect(() => {
    if (!flash.at) return;
    const id = setTimeout(() => setFlash({ text: "", at: 0 }), 1500);
    return () => clearTimeout(id);
  }, [flash.at]);
  useEffect(() => {
    if (!recording) return;
    const tick = () => {
      const t = clock(now());
      document.querySelectorAll("[data-rec-clock]").forEach((n) => {
        n.textContent = t;
      });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [recording]);

  /* a new graphic: jump to its settled frame (or its first, to watch the entrance) */
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !nonce) return;
    player.seekTo(startFrame);
    player.play();
    // startFrame follows currentKey, which changes together with nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  /* ── actions ── */

  const clearDrawings = useCallback(
    (record: boolean) => {
      setStrokes([]);
      if (record) pushCue({ cmd: "clear" });
    },
    [pushCue],
  );

  const show = useCallback(
    (key: string) => {
      const e = byKey.get(key);
      if (!e) return;
      setCurrentKey(key);
      setVariantOf((v) => ({ ...v, [e.group]: key }));
      setFocusMap((m) => ({ ...m, [key]: [] }));
      setStrokes([]); // the edit clears drawings on every graphic change too
      setNonce((n) => n + 1);
      say(e.groupLabel !== e.label ? `${e.groupLabel} · ${e.label}` : e.label);
      pushCue({ key });
    },
    [byKey, pushCue, say],
  );

  const variantsOf = useCallback(
    (g: Group) => {
      if (g.group !== "players" || teamFilter === "all") return g.keys;
      const keys = g.keys.filter((k) => teamOf(byKey.get(k)) === teamFilter);
      return keys.length ? keys : g.keys;
    },
    [byKey, teamFilter],
  );

  const showGroup = useCallback(
    (i: number) => {
      if (!groups.length) return;
      const g = groups[(i + groups.length) % groups.length];
      const keys = variantsOf(g);
      const remembered = variantOf[g.group];
      show(remembered && keys.includes(remembered) ? remembered : keys[0]);
    },
    [groups, show, variantOf, variantsOf],
  );

  const stepVariant = useCallback(
    (dir: number) => {
      if (!group) return;
      const keys = variantsOf(group);
      const i = keys.indexOf(currentKey);
      show(keys[(i + dir + keys.length) % keys.length]);
    },
    [currentKey, group, show, variantsOf],
  );

  const changeSize = useCallback(
    (z: StageSize) => {
      if (z === size) return;
      setSize(z);
      say(`Graphic size · ${SIZE_LABEL[z]}`);
      pushCue({ cmd: "size", arg: z });
    },
    [pushCue, say, size],
  );

  const toggleOverlay = useCallback(
    (what: OverlayKey) => {
      setOverlaysOn((list) => {
        const on = list.includes(what);
        say(`${OVERLAY_LABEL[what]} ${on ? "off" : "on"}`);
        pushCue({ cmd: "overlay", arg: `${what} ${on ? "off" : "on"}` });
        return on ? list.filter((x) => x !== what) : [...list, what];
      });
    },
    [pushCue, say],
  );

  const changeMode = useCallback(
    (m: LayoutMode) => {
      if (m === mode) return;
      setMode(m);
      say(`Layout · ${LAYOUT_LABEL[m]}`);
      pushCue({ cmd: "layout", arg: m });
    },
    [mode, pushCue, say],
  );

  const setFocus = useCallback(
    (name: string | null) => {
      if (!currentVertical || currentVertical.composition !== "Formation") return;
      const at = (playerRef.current?.getCurrentFrame() ?? 0) / FPS;
      setFocusMap((m) => ({ ...m, [currentKey]: [...(m[currentKey] ?? []), { at, name }] }));
      say(name ? `Spotlight · ${name}` : "Spotlight off");
      pushCue({ cmd: "focus", arg: name ?? "-" });
    },
    [currentKey, currentVertical, pushCue, say],
  );

  const mark = useCallback(() => {
    if (recRef.current?.state !== "recording") return say("Marks are for recording");
    const n = cuesRef.current.filter((c) => c.cmd === "mark").length + 1;
    pushCue({ cmd: "mark", arg: `mark ${n}` });
    say(`Marked #${n}`);
  }, [pushCue, say]);

  /* ── site tabs ── */

  const tabById = useCallback((id: number) => siteTabs.find((t) => t.id === id) ?? null, [siteTabs]);
  const prevAir = useRef(0);
  const siteArg = (view: SiteView, air: SiteTab | null, pair: SiteTab | null) =>
    view === "off" || !air
      ? "off"
      : view === "pair"
        ? `pair ${siteUrl(pair?.path ?? air.path)} | ${siteUrl(air.path)}`
        : `${view} ${siteUrl(air.path)}`;
  /** A new tab (not yet on the stage); null when there are already as many as fit. */
  const makeTab = useCallback(
    (path: string): SiteTab | null => {
      if (siteTabs.length >= MAX_SITE_TABS) {
        say(`${MAX_SITE_TABS} site tabs at most - close one first`);
        return null;
      }
      const tab = { id: nextTabId.current++, path, rev: 0 };
      setSiteTabs((ts) => [...ts, tab]);
      return tab;
    },
    [say, siteTabs.length],
  );

  /** Tab-capture of the site layer only: the on-air pages, without the camera, ink or graphics over them. */
  const startSiteCapture = useCallback(async (): Promise<boolean> => {
    if (STATIC) return true; // the hosted booth records the whole program frame already
    if (siteRec.current) return true;
    const layer = siteLayerRef.current;
    const w = window as unknown as {
      RestrictionTarget?: { fromElement: (el: Element) => Promise<unknown> };
      CropTarget?: { fromElement: (el: Element) => Promise<unknown> };
    };
    if (!layer) return false;
    if (!w.RestrictionTarget && !w.CropTarget) {
      say("Recording site pages needs Chrome or Edge");
      return false;
    }
    // Sized so the frame's long side comes out near 1920 (the size the edit renders at).
    const r = layer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const k = Math.min(2 * dpr, Math.max(dpr, 1920 / Math.max(1, r.width, r.height)));
    let stream: MediaStream;
    try {
      say("Share this tab - it records the site pages for the video");
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: Math.round(window.innerWidth * k) },
          height: { ideal: Math.round(window.innerHeight * k) },
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "exclude",
      } as DisplayMediaStreamOptions);
    } catch {
      say("Tab share cancelled - share this tab so the site pages are in the video");
      return false;
    }
    const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
      restrictTo?: (t: unknown) => Promise<void>;
      cropTo?: (t: unknown) => Promise<void>;
    };
    try {
      track.contentHint = "motion"; // smooth scrolls; the edit keeps the text sharp at 1080p
      if (w.RestrictionTarget && track.restrictTo) await track.restrictTo(await w.RestrictionTarget.fromElement(layer));
      else if (w.CropTarget && track.cropTo) await track.cropTo(await w.CropTarget.fromElement(layer));
      else throw new Error("no region capture");
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      say("Pick THIS tab (the booth) when sharing, so the site pages can be recorded");
      return false;
    }
    track.addEventListener("ended", () => {
      if (siteRec.current?.stream === stream && recRef.current?.state === "recording") {
        say("Tab sharing stopped - site pages from here on are not in the video");
      }
    });
    siteRec.current = { stream, rec: null, chunks: [], mime: "", start: 0, boxes: [] };
    return true;
  }, [say]);

  // Where the on-air pages sit, logged through the take so the edit can find them on the track.
  const logSiteBoxes = useRef<() => void>(() => {});
  const startSiteRecorder = useCallback(() => {
    const sr = siteRec.current;
    if (!sr || sr.rec || recRef.current?.state !== "recording") return;
    const mime = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(sr.stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    sr.rec = rec;
    sr.mime = mime;
    sr.start = Math.max(0, (performance.now() - t0.current) / 1000);
    rec.ondataavailable = (e) => {
      if (e.data.size) sr.chunks.push(e.data);
    };
    rec.onstart = () => {
      sr.start = Math.max(0, (performance.now() - t0.current) / 1000);
    };
    rec.start(1000);
    logSiteBoxes.current();
  }, []);
  /** Stop the site track; its file and where the pages sat, or null when there is none. */
  const finishSiteTrack = useCallback(async () => {
    const sr = siteRec.current;
    siteRec.current = null;
    if (!sr) return null;
    const rec = sr.rec;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((res) => {
        rec.addEventListener("stop", () => res(), { once: true });
        rec.stop();
      });
    }
    sr.stream.getTracks().forEach((t) => t.stop());
    if (!rec || !sr.chunks.length) return null;
    return { blob: new Blob(sr.chunks, { type: sr.mime || "video/webm" }), start: +sr.start.toFixed(3), boxes: sr.boxes };
  }, []);

  /** Put a view on the stage. During a take the first page on air starts the site track. */
  const applySite = useCallback(
    async (view: SiteView, air: SiteTab | null, pair: SiteTab | null) => {
      if (view !== "off" && !air) return;
      if (view !== "off" && recRef.current?.state === "recording" && !STATIC && !siteRec.current) {
        if (!(await startSiteCapture())) return;
        startSiteRecorder();
      }
      const before = siteArg(siteView, tabById(airId), tabById(pairId));
      const next = siteArg(view, air, pair);
      setSiteView(view);
      if (air) setAirId(air.id);
      setPairId(view === "pair" && pair ? pair.id : 0);
      if (next !== before) {
        say(view === "off" ? "Graphic only" : `${SITE_LABEL[view]} · ${view === "pair" ? `${pair?.path} | ${air?.path}` : air?.path}`);
        pushCue({ cmd: "site", arg: next });
      }
    },
    [airId, pairId, pushCue, say, siteView, startSiteCapture, startSiteRecorder, tabById],
  );
  /** G W E Q and the view buttons: the same view again goes back to the graphic. */
  const chooseSite = useCallback(
    (want: SiteView) => {
      const view = want === siteView && want !== "off" ? "off" : want;
      if (view === "off") return void applySite("off", tabById(airId), null);
      const air = tabById(airId) ?? siteTabs[0] ?? makeTab("/");
      if (!air) return;
      let pair: SiteTab | null = null;
      if (view === "pair") {
        const prev = tabById(prevAir.current);
        pair =
          (tabById(pairId)?.id !== air.id ? tabById(pairId) : null) ??
          (prev && prev.id !== air.id ? prev : null) ??
          siteTabs.find((t) => t.id !== air.id) ??
          makeTab(air.path);
        if (!pair) return;
      }
      void applySite(view, air, pair);
    },
    [airId, applySite, makeTab, pairId, siteTabs, siteView, tabById],
  );
  /** A tab onto the stage (or, with the graphic up, the tab the address bar works on). */
  const setAirTab = useCallback(
    (t: SiteTab) => {
      if (t.id === airId) return;
      prevAir.current = airId;
      // Two pages: picking the other one on stage swaps the sides.
      const pair = siteView === "pair" ? (t.id === pairId ? tabById(airId) : tabById(pairId)) : null;
      void applySite(siteView, t, pair);
    },
    [airId, applySite, pairId, siteView, tabById],
  );
  const stepAirTab = useCallback(
    (dir: number) => {
      if (siteTabs.length < 2) return;
      const i = Math.max(0, siteTabs.findIndex((t) => t.id === airId));
      setAirTab(siteTabs[(i + dir + siteTabs.length) % siteTabs.length]);
    },
    [airId, setAirTab, siteTabs],
  );
  const newSiteTab = useCallback(() => {
    const t = makeTab(tabById(airId)?.path ?? "/");
    if (!t) return;
    prevAir.current = airId;
    void applySite(siteView === "pair" ? "pair" : siteView, t, siteView === "pair" ? tabById(airId) : null);
    say(`Site tab ${siteTabs.length + 1} · type a page or pick one below`);
  }, [airId, applySite, makeTab, say, siteTabs.length, siteView, tabById]);
  const closeSiteTab = useCallback(
    (id: number) => {
      const i = siteTabs.findIndex((t) => t.id === id);
      if (i < 0) return;
      const rest = siteTabs.filter((t) => t.id !== id);
      setSiteTabs(rest);
      setAirMounted((m) => m.filter((x) => x !== id));
      setRefMounted((m) => m.filter((x) => x !== id));
      if (prevAir.current === id) prevAir.current = 0;
      if (refId === id) setRefId(rest[Math.min(i, rest.length - 1)]?.id ?? 0);
      const air = id === airId ? rest[Math.min(i, rest.length - 1)] ?? null : tabById(airId);
      let view = siteView;
      let pair = siteView === "pair" ? tabById(pairId) : null;
      if (view === "pair" && (!pair || pair.id === id)) pair = rest.find((t) => t.id !== air?.id) ?? null;
      if (view === "pair" && !pair) view = "full";
      if (!air) view = "off";
      if (air && id === airId) setAirId(air.id);
      if (!air) setAirId(0);
      if (view !== siteView || id === airId || id === pairId) void applySite(view, air, pair);
    },
    [airId, applySite, pairId, refId, siteTabs, siteView, tabById],
  );
  /** Send a tab to a page; it reloads wherever it shows. */
  const goSite = useCallback(
    (input: string, which: "air" | "ref" = "air") => {
      const path = sitePath(input);
      const tab = tabById(which === "air" ? airId : refId);
      if (!path) {
        if (which === "air") setSiteAddr(tab?.path ?? "");
        return say("Only chase-analytics.com pages open here");
      }
      if (!tab) {
        const t = makeTab(path);
        if (!t) return;
        if (which === "ref") setRefId(t.id);
        else setAirId(t.id);
        return;
      }
      const moved = { ...tab, path, rev: tab.rev + 1 };
      setSiteTabs((ts) => ts.map((t) => (t.id === tab.id ? moved : t)));
      // On the stage during a take: the cue sheet follows the page.
      const onAir = siteView !== "off" && (tab.id === airId || (siteView === "pair" && tab.id === pairId));
      if (onAir) {
        const air = tab.id === airId ? moved : tabById(airId);
        const pair = siteView === "pair" ? (tab.id === pairId ? moved : tabById(pairId)) : null;
        pushCue({ cmd: "site", arg: siteArg(siteView, air, pair) });
      }
      say(`${which === "ref" ? "Off air" : "Site"} · ${path}`);
    },
    [airId, makeTab, pairId, pushCue, refId, say, siteView, tabById],
  );
  const toggleRef = useCallback(
    (open?: boolean) => {
      const next = open ?? !refOpen;
      setRefOpen(next);
      writePref("booth.ref", next ? "1" : "0");
      if (next && !siteTabs.length) {
        const t = makeTab("/");
        if (t) setRefId(t.id);
      }
      say(next ? "Off-air reference open - only you see it" : "Off-air reference closed");
    },
    [makeTab, refOpen, say, siteTabs.length],
  );

  // Keep the chosen tabs valid, give tabs their iframes when first shown, remember the tabs.
  useEffect(() => {
    if (siteTabs.length && !tabById(airId)) setAirId(siteTabs[0].id);
    if (siteTabs.length && !tabById(refId)) setRefId(siteTabs[0].id);
  }, [airId, refId, siteTabs, tabById]);
  useEffect(() => {
    const ids = siteView === "off" ? [] : siteView === "pair" ? [airId, pairId] : [airId];
    setAirMounted((m) => (ids.every((i) => !i || m.includes(i)) ? m : [...m, ...ids.filter((i) => i && !m.includes(i))]));
  }, [airId, pairId, siteView]);
  useEffect(() => {
    if (refOpen && refId) setRefMounted((m) => (m.includes(refId) ? m : [...m, refId]));
  }, [refOpen, refId]);
  useEffect(() => {
    const idx = (id: number) => Math.max(0, siteTabs.findIndex((t) => t.id === id));
    writePref("booth.siteTabs", JSON.stringify({ tabs: siteTabs.map((t) => t.path), air: idx(airId), ref: idx(refId) }));
  }, [airId, refId, siteTabs]);
  useEffect(() => {
    const t = tabById(airId);
    if (t) setSiteAddr(t.path);
  }, [airId, tabById]);

  const requestMedia = useCallback(() => {
    setCamError("");
    setMediaRequested(true);
    setMediaAttempt((attempt) => attempt + 1);
    say("Requesting camera and microphone");
  }, [say]);

  const undo = useCallback(() => {
    if (recRef.current?.state !== "recording") {
      setStrokes((s) => s.slice(0, -1));
      return;
    }
    if (cuesRef.current.length <= 1) return say("Nothing to undo"); // never the opening graphic
    const last = cuesRef.current.pop()!;
    setCues([...cuesRef.current]);
    if (last.key) {
      const prev = [...cuesRef.current].reverse().find((c) => c.key);
      if (prev?.key) {
        setCurrentKey(prev.key);
        setNonce((n) => n + 1);
      }
    } else if (last.cmd === "layout") {
      const prev = [...cuesRef.current].reverse().find((c) => c.cmd === "layout");
      setMode((prev?.arg as LayoutMode) ?? DEFAULT_LAYOUT);
    } else if (last.cmd === "size") {
      const prev = [...cuesRef.current].reverse().find((c) => c.cmd === "size");
      setSize(((prev?.arg as StageSize) ?? "full") as StageSize);
    } else if (last.cmd === "overlay") {
      const [what, state] = String(last.arg).split(" ");
      setOverlaysOn((list) => (state === "on" ? list.filter((x) => x !== what) : [...list, what as OverlayKey]));
    } else if (last.cmd === "draw") {
      strokeStore.current = strokeStore.current.filter((s) => String(s.id) !== last.arg);
      setStrokes((s) => s.filter((x) => String(x.id) !== last.arg));
    } else if (last.cmd === "focus") {
      setFocusMap((m) => ({ ...m, [currentKey]: (m[currentKey] ?? []).slice(0, -1) }));
    } else if (last.cmd === "site") {
      // Back to the view before it (the pages stay where they are now).
      const prev = [...cuesRef.current].reverse().find((c) => c.cmd === "site");
      const view = (String(prev?.arg ?? "off").split(/\s+/)[0] as SiteView) || "off";
      setSiteView(SITE_VIEWS.includes(view) ? view : "off");
    }
    say(`Undone · ${cueLabel(last, byKey)}`);
  }, [byKey, currentKey, say]);

  /*
   * Hosted broadcast records this tab cropped to the program frame.
   */
  const beginRecording = useCallback(() => {
    if (!stream) return;
    const types = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const picture =
      STATIC && programCapture.current
        ? programCapture.current
        : new MediaStream(stream.getVideoTracks().map((t) => t.clone()));
    const recStream = withAudio(picture, stream);
    const rec = new MediaRecorder(recStream, { mimeType, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 160_000 });
    chunks.current = [];
    strokeStore.current = [];
    nextStrokeId.current = 1;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstart = () => {
      t0.current = performance.now();
      cuesRef.current = [{ t: 0, key: currentKey }];
      if (mode !== "bubble") cuesRef.current.push({ t: 0, cmd: "layout", arg: mode });
      if (size !== "full") cuesRef.current.push({ t: 0, cmd: "size", arg: size });
      for (const o of overlaysOn) cuesRef.current.push({ t: 0, cmd: "overlay", arg: `${o} on` });
      if (siteView !== "off") cuesRef.current.push({ t: 0, cmd: "site", arg: siteArgNow.current() });
      setCues([...cuesRef.current]);
      setPhase("recording");
      setStrokes([]);
      startSiteRecorder();
    };
    rec.onstop = async () => {
      playerRef.current?.play();
      const site = await finishSiteTrack();
      const dims = frameDims.current;
      recStream.getTracks().forEach((t) => t.stop());
      programCapture.current?.getTracks().forEach((t) => t.stop());
      programCapture.current = null;
      setProgramLive(false);
      setPhase("saving");
      const name = stamp();
      try {
        const blob = new Blob(chunks.current, { type: mimeType || "video/webm" });
        lastTake.current = blob;
        if (STATIC) {
          downloadBlob(`${name}-broadcast.webm`, blob, blob.type);
          setSaved(name);
          setPhase("saved");
          setMessage("Broadcast take downloaded — the program frame plus your mic.");
          return;
        }
        let r = await fetch(`/api/save?name=${name}&ext=webm`, { method: "POST", body: blob });
        if (!r.ok) throw new Error(await r.text());
        if (site) {
          r = await fetch(`/api/save?name=${name}.site&ext=webm`, { method: "POST", body: site.blob });
          if (!r.ok) throw new Error(`site track: ${await r.text()}`);
        }
        r = await fetch(`/api/cues?name=${name}`, {
          method: "POST",
          body: JSON.stringify({
            cues: cuesRef.current,
            strokes: strokeStore.current,
            ...(site ? { site: { start: site.start, width: dims.W, height: dims.H, format: dims.format, boxes: site.boxes } } : {}),
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        setSaved(name);
        setPhase("saved");
        setMessage("");
      } catch (e) {
        setPhase("error");
        setMessage(`Saving failed: ${(e as Error).message}`);
      }
    };
    recRef.current = rec;
    rec.start(1000);
  }, [currentKey, finishSiteTrack, mode, overlaysOn, siteView, size, startSiteRecorder, stream]);

  const toggleRecord = useCallback(async () => {
    if (phase === "recording") {
      recRef.current?.stop();
      return;
    }
    if (phase === "countdown") {
      programCapture.current?.getTracks().forEach((t) => t.stop());
      programCapture.current = null;
      setProgramLive(false);
      void finishSiteTrack();
      setPhase("idle");
      say("Countdown cancelled");
      return;
    }
    if (phase === "saving" || !stream) return;
    if (micId === "phone" && (!phoneTrack || !stream.getAudioTracks().length)) {
      return say("Phone mic is not in the recorder yet — wait until it says Phone mic live");
    }
    if (STATIC) {
      const frame = frameRef.current;
      if (!frame) return say("Program frame is not ready");
      try {
        say("Share this tab — that is the booth picture");
        const captured = await captureProgram(frame);
        programCapture.current = captured;
        setProgramLive(true);
        captured.getVideoTracks()[0]?.addEventListener("ended", () => recRef.current?.stop());
      } catch {
        programCapture.current?.getTracks().forEach((t) => t.stop());
        programCapture.current = null;
        setProgramLive(false);
        say("Tab share cancelled — the take cannot match the boards without it");
        return;
      }
      beginRecording();
      return;
    }
    // Site pages are recorded as their own track: share this tab now, before the 3-2-1.
    if (siteTabs.length && !(await startSiteCapture())) return;
    setCount(3);
    setPhase("countdown");
  }, [beginRecording, finishSiteTrack, micId, phase, phoneTrack, say, siteTabs.length, startSiteCapture, stream]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      beginRecording();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [beginRecording, count, phase]);

  /* Crop once, when the share starts. Re-cropping on each graphic froze the first board in the file. */
  useEffect(() => {
    if (!recording) return;
    const player = playerRef.current;
    if (!player) return;
    const wait = instant ? 350 : 1700;
    const id = window.setTimeout(() => {
      if (recRef.current?.state === "recording") player.pause();
    }, wait);
    return () => window.clearTimeout(id);
  }, [recording, nonce, instant]);

  const makeVideo = useCallback(async () => {
    const r = await fetch(`/api/edit?name=${saved}&ext=webm&platform=${platform}`, { method: "POST" });
    setMessage(r.ok ? "Editing started in a new window - your videos open when it finishes." : `Could not start: ${await r.text()}`);
  }, [platform, saved]);

  /* drawing */
  const W = format === "wide" ? 1920 : 1080;
  const H = format === "wide" ? 1080 : 1920;
  const [setFrameEl, frameBox] = useBox();
  const scale = frameBox.w > 8 ? frameBox.w / W : 0.3;
  const bindFrame = (node: HTMLDivElement | null) => {
    frameRef.current = node;
    setFrameEl(node);
  };
  const drawActive = pen;

  /* where the on-air site pages sit (frame px), and the site-track bookkeeping that follows them */
  const siteGeom = cat ? frameGeom(format, format === "wide" ? "youtube" : platform, mode, CAM[format], size) : null;
  const siteBoxes = siteGeom ? siteSplit(siteGeom, siteView, format).sites : [];
  const siteBoxKey = JSON.stringify(siteBoxes);
  const frameDims = useRef({ W, H, format });
  frameDims.current = { W, H, format };
  const siteArgNow = useRef<() => string>(() => "off");
  siteArgNow.current = () => siteArg(siteView, tabById(airId), tabById(pairId));
  logSiteBoxes.current = () => {
    const sr = siteRec.current;
    if (!sr?.rec || recRef.current?.state !== "recording" || siteView === "off" || !siteBoxes.length) return;
    const last = sr.boxes[sr.boxes.length - 1];
    if (last && last.view === siteView && sameBoxes(last.boxes, siteBoxes)) return;
    const round = (b: Box) => ({ x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.w.toFixed(1), h: +b.h.toFixed(1) });
    sr.boxes.push({ t: +now().toFixed(3), view: siteView, boxes: siteBoxes.map(round) });
  };
  useEffect(() => logSiteBoxes.current(), [siteBoxKey, siteView, phase]);
  const siteWidthFor = (v: SiteView) => {
    const view = v === "off" ? "full" : v;
    return siteWidths[`${format}.${view}`] ?? SITE_WIDTH[format][view];
  };
  const press = useRef<{ x: number; y: number; id: number } | null>(null);
  const toFrame = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as const;
  };
  const beginStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    const [x, y] = toFrame(e);
    const stroke: LiveStroke = { id: nextStrokeId.current++, tone, arrow, points: [[+x.toFixed(4), +y.toFixed(4), 0]], live: true };
    drawing.current = { stroke, start: performance.now(), recAt: recRef.current?.state === "recording" ? now() : null };
    setStrokes((st) => [...st, stroke]);
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pr = press.current;
    if (pr && !drawing.current && drawActive && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 5) beginStroke(e);
    const d = drawing.current;
    if (!d) return;
    const [x, y] = toFrame(e);
    const last = d.stroke.points[d.stroke.points.length - 1];
    if (Math.hypot((x - last[0]) * W, (y - last[1]) * H) < 6) return;
    d.stroke.points.push([+x.toFixed(4), +y.toFixed(4), +((performance.now() - d.start) / 1000).toFixed(3)]);
    setStrokes((st) => [...st]);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const pr = press.current;
    press.current = null;
    const d = drawing.current;
    drawing.current = null;
    if (!d) {
      // A click, not a drag: spotlight the face under the pointer (the ink layer is on top).
      if (!pr) return;
      const hit = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => el.closest?.("[data-player]"))
        .find(Boolean);
      if (hit) setFocus(hit.getAttribute("data-player"));
      return;
    }
    d.stroke.live = false;
    if (d.stroke.points.length < 2) {
      setStrokes((st) => st.filter((x) => x !== d.stroke));
      return;
    }
    setStrokes((st) => [...st]);
    if (d.recAt !== null && recRef.current?.state === "recording") {
      const { id, tone: tn, arrow: ar, points } = d.stroke;
      // A drawing is placed on the picture it was drawn over, so it belongs to that format.
      strokeStore.current.push({ id, tone: tn, arrow: ar, points, format });
      // The cue is when the stroke BEGAN; the points carry its own timing.
      cuesRef.current.push({ t: d.recAt, cmd: "draw", arg: String(id) });
      cuesRef.current.sort((x, y) => x.t - y.t);
      setCues([...cuesRef.current]);
    }
  };

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.type !== "keydown") return;
      if (palette.open) {
        if (e.key === "Escape") setPalette({ open: false, q: "", sel: 0 });
        return; // the palette's own input handles the rest
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      // A focused dropdown or button would take the key for itself: drop its focus.
      const active = document.activeElement;
      if (active instanceof HTMLSelectElement || active instanceof HTMLButtonElement) active.blur();
      const stop = () => e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        stop();
        undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "r") {
        if (!e.repeat) toggleRecord();
        return;
      }
      if (k === "/") {
        stop();
        setPalette({ open: true, q: "", sel: 0 });
      } else if (k === "?" || k === "h") {
        setHelp((h) => !h);
      } else if (k === "escape") {
        if (help) setHelp(false);
        else setFocus(null);
      } else if (GROUP_KEYS.includes(k)) {
        showGroup(GROUP_KEYS.indexOf(k));
      } else if (LAYOUT_KEYS[k]) {
        changeMode(LAYOUT_KEYS[k]);
      } else if (k === "arrowright") {
        stop();
        stepVariant(1);
      } else if (k === "arrowleft") {
        stop();
        stepVariant(-1);
      } else if (k === "arrowdown" || (k === " " && !e.shiftKey)) {
        stop();
        showGroup(groupIdx + 1);
      } else if (k === "arrowup" || (k === " " && e.shiftKey)) {
        stop();
        showGroup(groupIdx - 1);
      } else if (SITE_KEYS[k]) {
        chooseSite(SITE_KEYS[k]);
      } else if (k === "," || k === ".") {
        stepAirTab(k === "." ? 1 : -1);
      } else if (k === "o") {
        toggleRef();
      } else if (OVERLAY_KEYS[k]) {
        toggleOverlay(OVERLAY_KEYS[k]);
      } else if (k === "[" || k === "]") {
        const i = SIZES.indexOf(size);
        changeSize(SIZES[Math.min(SIZES.length - 1, Math.max(0, i + (k === "]" ? -1 : 1)))]);
      } else if (k === "p") {
        setPen((v) => {
          writePref("booth.pen", v ? "0" : "1");
          say(v ? "Drawing off - drags do nothing" : "Drawing on - drag on the picture");
          return !v;
        });
      } else if (k === "c") {
        clearDrawings(true);
        say("Drawings cleared");
      } else if (k === "x") {
        setArrow((v) => !v);
      } else if (k === "t") {
        setTone((t) => TONES[(TONES.indexOf(t) + 1) % TONES.length]);
      } else if (k === "m") {
        mark();
      } else if (k === "u") {
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [changeMode, changeSize, chooseSite, clearDrawings, groupIdx, help, mark, overlaysOn, palette.open, say, setFocus, showGroup, size, stepAirTab, stepVariant, toggleOverlay, toggleRecord, toggleRef, undo]);

  const results = useMemo(() => {
    const q = palette.q.trim().toLowerCase();
    return allEntries
      .filter((e) => !q || `${e.label} ${e.groupLabel} ${e.key} ${e.note}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [allEntries, palette.q]);

  /* ── render ── */

  if (loadError) return <div className="fatal">Could not load the game pack: {loadError}</div>;
  if (!cat) return <div className="fatal">Loading...</div>;

  const cam = CAM[format];
  const G = frameGeom(format, format === "wide" ? "youtube" : platform, mode, cam, size);
  const ring = teamAccent(cat.game.home, cat.game.league);
  const overlayProps = (what: OverlayKey): Record<string, unknown> => {
    if (what === "bug") {
      return { league: cat.game.league, away: cat.game.away, home: cat.game.home, statLabel: "DraftKings", statValue: cat.line.split(" · ")[0] ?? "" };
    }
    if (what === "name") {
      return { title: "Chase Analytics", subtitle: cat.title, team: cat.game.home, league: cat.game.league, stat: "", statLabel: "" };
    }
    return {
      league: cat.game.league, away: cat.game.away, home: cat.game.home,
      platform: format === "wide" ? "youtube" : platform,
      items: [`${cat.game.away} at ${cat.game.home}`, ...cat.line.split(" · "), cat.game.kickoff ?? "", "chase-analytics.com"].filter(Boolean),
    };
  };
  const graphic = current
    ? {
        key: current.key,
        label: current.label,
        composition: current.composition,
        props: current.composition.startsWith("Formation")
          ? { ...current.props, focuses: focusMap[current.key] ?? [] }
          : current.props,
      }
    : null;
  const frameProps: BoothFrameProps = {
    format,
    platform: format === "wide" ? "youtube" : platform,
    mode,
    league: cat.game.league,
    away: cat.game.away,
    home: cat.game.home,
    line: cat.line,
    camSize: cam,
    graphic,
    captionHint: "",
    size,
    overlays: overlaysOn.map((o) => ({ name: OVERLAYS[o], props: overlayProps(o) })),
    site: siteView,
  };
  const airTab = tabById(airId);
  const refTab = tabById(refId);
  // A page that is not on the stage keeps its iframe (and its place) out of sight at the full-page spot.
  const siteRest: Box = (siteGeom && siteSplit(siteGeom, "full", format).sites[0]) || { x: 0, y: 0, w: W, h: H };
  const siteSlot = (id: number) => (siteView === "pair" ? (id === pairId ? 0 : id === airId ? 1 : -1) : siteView !== "off" && id === airId ? 0 : -1);
  const cams = devices.filter((d) => d.kind === "videoinput");
  const mics = devices.filter((d) => d.kind === "audioinput");
  const nextGroup = groups[(groupIdx + 1) % groups.length];
  const storySteps = ["matchup", "market", "form", "qb", "injuries", "scheme"]
    .map((key) => ({ key, index: groups.findIndex((g) => g.group === key) }))
    .filter((step) => step.index >= 0)
    .map((step) => ({ ...step, group: groups[step.index] }));
  const teams = [cat.game.away, cat.game.home];
  const ringPad = G.cam.ring ? 5 : 0;
  const pip = format === "wide" && mode === "bubble" && G.cam.w > 0;
  const pipPx = Math.round(Math.max(120, Math.min(240, (frameBox.w || 960) * 0.15)));
  const camRing = G.cam.ring ? `conic-gradient(from 200deg, ${ring}, var(--accent) 45%, ${ring})` : "transparent";
  const camStyle = pip
    ? {
        top: 18,
        right: 18,
        left: "auto",
        width: pipPx,
        height: pipPx,
        borderRadius: pipPx / 2,
        padding: 5,
        background: camRing,
        opacity: 1,
      }
    : {
        left: G.cam.x * scale,
        top: G.cam.y * scale,
        width: G.cam.w * scale,
        height: G.cam.h * scale,
        borderRadius: G.cam.r * scale,
        padding: ringPad * scale,
        background: camRing,
        opacity: G.cam.w > 0 ? 1 : 0,
      };
  const camVideoRadius = pip ? Math.max(0, pipPx / 2 - 5) : Math.max(0, (G.cam.r - ringPad) * scale);

  return (
    <div className="booth">
      <main className={refOpen ? "stage with-ref" : "stage"} style={{ ["--program-ar" as string]: String(W / H) }}>
        <div className="program-rail" aria-hidden="true">
          <span className={recording ? "program-tag live" : "program-tag"}>{recording ? "● ON AIR" : "PROGRAM"}</span>
          <b>{format === "vertical" ? "VERTICAL 9:16" : "WIDE 16:9"}</b>
          <span>{LAYOUT_LABEL[mode]}</span>
          {siteView !== "off" ? <span className="program-site">{SITE_LABEL[siteView]}</span> : null}
          <span className="program-now">
            {siteView === "full" || siteView === "pair"
              ? `chase-analytics.com${siteView === "pair" ? ` ${tabById(pairId)?.path} | ${airTab?.path}` : airTab?.path}`
              : `${currentVertical?.groupLabel} · ${currentVertical?.label}`}
          </span>
        </div>
        {!focused ? (
          <div
            className="focus-banner"
            onClick={() => {
              // A click into a site page leaves the keys with that page: take them back.
              if (document.activeElement instanceof HTMLIFrameElement) document.activeElement.blur();
              window.focus();
              setFocused(true);
            }}
          >
            {document.activeElement instanceof HTMLIFrameElement
              ? "Your keys are going to the site page - click here to give them back to the booth"
              : "Click here so the booth can hear your keys"}
          </div>
        ) : null}
        <div className="program-fit">
        <div ref={bindFrame} className="frame">
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
            {/* 1. page ground  2. live camera  3. the frame (transparent)  4. ink */}
            <div style={{ position: "absolute", inset: 0, background: "var(--surface-page)" }} />
            {/* chase-analytics.com on the stage: under the graphics' frame (header, overlays) and
                recorded on its own as the site track. */}
            {siteTabs.length ? (
              <div ref={siteLayerRef} className="site-layer" style={{ width: W, height: H }}>
                <i className="site-tick" />
                {siteTabs
                  .filter((t) => airMounted.includes(t.id))
                  .map((t) => {
                    const slot = siteSlot(t.id);
                    const box = slot >= 0 ? siteBoxes[slot] : undefined;
                    const b = box ?? siteRest;
                    const pw = siteWidthFor(siteView);
                    const k = b.w / pw;
                    return (
                      <div
                        key={t.id}
                        className="site-card"
                        style={{ left: b.x, top: b.y, width: b.w, height: b.h, visibility: box ? "visible" : "hidden" }}
                      >
                        {/* The live site, not timeline media: the booth records it as its own track. */}
                        {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
                        <iframe
                          key={t.rev}
                          src={siteUrl(t.path)}
                          title={`chase-analytics.com ${t.path}`}
                          style={{ width: pw, height: b.h / k, transform: `scale(${k})` }}
                        />
                      </div>
                    );
                  })}
              </div>
            ) : null}
            <div
              ref={playerBoxRef}
              className="player-box"
              style={{ position: "absolute", inset: 0, width: W, height: H, zIndex: 1, pointerEvents: siteView !== "off" ? "none" : undefined }}
            >
            <Player
              key={format}
              ref={playerRef}
              component={BoothFrame}
              inputProps={frameProps}
              durationInFrames={FPS * 60 * 60}
              fps={FPS}
              compositionWidth={W}
              compositionHeight={H}
              style={{ position: "absolute", inset: 0, width: W, height: H }}
              autoPlay
              initiallyMuted
              initialFrame={startFrame}
              acknowledgeRemotionLicense
            />
            </div>
            <svg
              ref={svgRef}
              width={W}
              height={H}
              className={drawActive ? "ink drawing" : "ink clicks"}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {strokes.map((s) => (
                <g key={s.id} style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,.7))" }}>
                  <path d={strokePath(s, W, H)} fill="none" stroke={TONE_CSS[s.tone]} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
                  {!s.live ? (
                    <path d={arrowHead(s, W, H)} fill="none" stroke={TONE_CSS[s.tone]} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                </g>
              ))}
            </svg>
          </div>
          <div className={pip ? "cam-box cam-pip" : "cam-box"} style={camStyle}>
            {/* eslint-disable-next-line @remotion/warn-native-media-tag -- this is a live MediaStream preview, not timeline media. */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ borderRadius: camVideoRadius, transform: mirror ? "scaleX(-1)" : undefined }}
            />
            {/* Keep WebRTC phone audio playing so MediaRecorder gets samples. This is a live MediaStream, not timeline media. */}
            {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
            <audio ref={phoneAudioRef} autoPlay playsInline style={{ display: "none" }} />
          </div>
          {format === "vertical" && showZones ? (
            <div className="zone" style={{ height: SAFE_BOTTOM[platform] * scale, width: W * scale }}>
              <span>Covered by {platform === "tiktok" ? "TikTok" : platform === "shorts" ? "YouTube" : "Instagram"}&apos;s buttons and caption</span>
            </div>
          ) : null}
          {heard.text ? (
            <div
              className="live-caps"
              style={{
                left: G.captions.x * scale,
                top: G.captions.y * scale,
                width: G.captions.w * scale,
                height: G.captions.h * scale,
                justifyContent: G.captions.align === "center" ? "center" : "flex-start",
              }}
            >
              <div
                style={{
                  fontSize: G.captions.size * scale,
                  textAlign: G.captions.align,
                  WebkitLineClamp: G.captions.lines,
                  ...(G.captions.plate ? { background: "rgba(5,5,6,.78)", padding: `${10 * scale}px ${22 * scale}px`, borderRadius: 14 * scale } : {}),
                }}
              >
                {(() => {
                  const words = heard.text.split(/\s+/).slice(format === "wide" ? -12 : -10);
                  return words.map((wd, i) => (
                    <span key={i} style={{ color: i === words.length - 1 ? "var(--text-accent)" : undefined }}>
                      {wd}{" "}
                    </span>
                  ));
                })()}
              </div>
            </div>
          ) : null}
          {recording ? <div className="rec-badge">● REC <span data-rec-clock>0:00</span></div> : null}
          {flash.text ? <div className="flash">{flash.text}</div> : null}
          {phase === "countdown" ? <div className="countdown">{count || ""}</div> : null}
        </div>
        </div>
        {refOpen ? (
          <aside className="ref-dock" aria-label="Off-air reference">
            <div className="ref-head">
              <span className="ref-tag">Off air · only you</span>
              <select value={refId} onChange={(e) => setRefId(Number(e.target.value))} aria-label="Reference tab">
                {siteTabs.map((t, i) => (
                  <option key={t.id} value={t.id}>
                    {i + 1} · {t.path}
                  </option>
                ))}
              </select>
              <button
                title="Put this page on the stage"
                onClick={() => {
                  if (!refTab) return;
                  if (siteView === "off") void applySite("full", refTab, null);
                  else setAirTab(refTab);
                }}
              >
                On air
              </button>
              <button className="ref-x" title="Close (O)" onClick={() => toggleRef(false)}>
                ×
              </button>
            </div>
            <form
              className="site-addr"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("ref") as HTMLInputElement;
                goSite(input.value, "ref");
                input.blur();
              }}
            >
              <input key={`${refTab?.id}-${refTab?.rev}`} name="ref" defaultValue={refTab?.path ?? "/"} spellCheck={false} aria-label="Reference page" />
              <button type="submit">Go</button>
            </form>
            <div className="ref-body">
              {siteTabs
                .filter((t) => refMounted.includes(t.id))
                .map((t) => (
                  // The live site in the booth's own panel, never rendered into a video.
                  // eslint-disable-next-line @remotion/warn-native-media-tag
                  <iframe
                    key={`${t.id}-${t.rev}`}
                    src={siteUrl(t.path)}
                    title={`Off-air chase-analytics.com ${t.path}`}
                    style={{ visibility: t.id === refId ? "visible" : "hidden" }}
                  />
                ))}
            </div>
            <div className="hint">Never recorded. Pages here and on the stage are the same tabs, so you can line them up.</div>
          </aside>
        ) : null}
      </main>

      <aside className="panel">
        <header>
          <div className="eyebrow">Recording Booth · {cat.pack}</div>
          {packs.length > 1 ? (
            <select
              className="pack-pick"
              value={cat.pack}
              disabled={recording}
              aria-label="Select game pack"
              onChange={async (e) => {
                const id = e.target.value;
                if (STATIC) {
                  const c: Catalog = await (await fetch(url(`/data/packs/${id}/catalog.json`), { cache: "no-store" })).json();
                  setCat(c);
                  setCurrentKey("matchup");
                  setPacks((ps) => ps.map((p) => ({ ...p, active: p.id === id })));
                  say(`Loaded ${c.title}`);
                  return;
                }
                await fetch("/api/pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
                const c: Catalog = await (await fetch("/api/catalog", { cache: "no-store" })).json();
                setCat(c);
                setCurrentKey("matchup");
                setPacks((ps) => ps.map((p) => ({ ...p, active: p.id === id })));
                say(`Loaded ${c.title}`);
              }}
            >
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.away} at {p.home}
                  {p.line ? ` · ${p.line}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <h1>{cat.title}</h1>
          )}
          {packs.length > 1 ? <h1>{cat.title}</h1> : null}
          <div className="muted">{cat.game.kickoff}</div>
          <div className="live-strip">
            <span className={live?.busy ? "live-dot busy" : live?.error ? "live-dot err" : "live-dot"} />
            <b>{cat.line || "No line posted"}</b>
            <span className="muted">
              {STATIC
                ? "hosted · graphics refresh when main is pushed"
                : live?.busy
                ? "refreshing..."
                : live?.error
                  ? "refresh failed - showing last lines"
                  : live?.updated
                    ? `live · ${new Date(live.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · every ${live.everyMin} min`
                    : "live"}
            </span>
            {STATIC ? null : (
            <button
              className="link"
              onClick={() => {
                fetch("/api/refresh", { method: "POST" });
                say("Refreshing lines...");
              }}
            >
              refresh
            </button>
            )}
          </div>
        </header>

        <section>
          <div className={`media-status ${stream ? "ready" : mediaRequested && !camError ? "connecting" : ""}`}>
            <span className="media-status-dot" />
            <div>
              <b>{stream ? "Camera and microphone ready" : mediaRequested && !camError ? "Connecting camera and microphone…" : "Studio preview ready"}</b>
              <span>
                {stream
                  ? STATIC
                    ? "Record asks to share this tab. Pick this tab. The file is the program frame plus your mic."
                    : "Record downloads the camera take and live graphic cues."
                  : "Explore every graphic now. Enable your devices when you are ready to record."}
              </span>
            </div>
          </div>
          {!stream && phase !== "saving" ? (
            <button className="big camera-start" onClick={requestMedia} disabled={mediaRequested && !camError}>
              {mediaRequested && !camError ? "Connecting…" : camError ? "Try camera & microphone again" : "Enable camera & microphone"}
            </button>
          ) : phase === "saving" ? (
            <button className="big" disabled>
              Saving...
            </button>
          ) : recording ? (
            <button className="big stop" onClick={toggleRecord}>
              ■ Stop · <span data-rec-clock>0:00</span> <kbd>R</kbd>
            </button>
          ) : phase === "countdown" ? (
            <button className="big rec" onClick={toggleRecord}>
              Starting in {count}... (R cancels)
            </button>
          ) : (
            <button className="big rec" onClick={toggleRecord} disabled={micId === "phone" && !phoneTrack}>
              ● Record <kbd>R</kbd>
            </button>
          )}
          {phase === "saved" ? (
            <div className="saved">
              <div>
                {STATIC ? (
                  <>Downloaded <b>{saved}-broadcast.webm</b> — graphics, camera, and mic</>
                ) : (
                  <>Saved <b>{saved}</b> in video\footage</>
                )}
              </div>
              {STATIC ? (
                <button
                  className="big go"
                  onClick={() => {
                    if (lastTake.current) downloadBlob(`${saved}-broadcast.webm`, lastTake.current, lastTake.current.type);
                  }}
                >
                  Download broadcast take
                </button>
              ) : (
                <button className="big go" onClick={makeVideo}>
                  Make my video
                </button>
              )}
            </div>
          ) : null}
          {message ? <div className={phase === "error" ? "error" : "hint"}>{message}</div> : null}
        </section>

        <section>
          <div className="eyebrow">Layout</div>
          <div className="layouts">
            {LAYOUT_MODES.map((m, i) => (
              <button key={m} className={m === mode ? "on" : ""} onClick={() => changeMode(m)}>
                <LayoutIcon mode={m} wide={format === "wide"} platform={platform} />
                <span>{LAYOUT_LABEL[m]}</span>
                <kbd>{"ASDF"[i]}</kbd>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="eyebrow">Graphic size · [ smaller · ] bigger</div>
          <div className="seg">
            {SIZES.map((z) => (
              <button key={z} className={z === size ? "on" : ""} onClick={() => changeSize(z)}>
                {SIZE_LABEL[z]}
              </button>
            ))}
          </div>
          <div className="eyebrow" style={{ marginTop: 14 }}>
            Small graphics over the top
          </div>
          <div className="seg">
            {(Object.keys(OVERLAYS) as OverlayKey[]).map((o, i) => (
              <button key={o} className={overlaysOn.includes(o) ? "on" : ""} onClick={() => toggleOverlay(o)}>
                {OVERLAY_LABEL[o]} <kbd>{"BNK"[i]}</kbd>
              </button>
            ))}
          </div>
        </section>

        <section className="site">
          <div className="eyebrow">chase-analytics.com on the stage · G W E Q</div>
          <div className="seg site-views">
            {SITE_VIEWS.map((v) => (
              <button key={v} className={v === siteView ? "on" : ""} onClick={() => chooseSite(v)}>
                {SITE_LABEL[v]} <kbd>{Object.keys(SITE_KEYS).find((k) => SITE_KEYS[k] === v)?.toUpperCase()}</kbd>
              </button>
            ))}
          </div>
          <div className="site-tabs">
            {siteTabs.map((t, i) => {
              const slot = siteSlot(t.id);
              return (
                <div key={t.id} className={`site-tab${t.id === airId ? " on" : ""}${slot >= 0 ? " live" : ""}`}>
                  <button className="site-tab-go" title={siteUrl(t.path)} onClick={() => setAirTab(t)}>
                    <b>{i + 1}</b>
                    <span>{t.path}</span>
                  </button>
                  <button className="site-tab-x" title="Close tab" aria-label={`Close site tab ${i + 1}`} onClick={() => closeSiteTab(t.id)}>
                    ×
                  </button>
                </div>
              );
            })}
            <button className="site-tab-add" title="New tab on this page" disabled={siteTabs.length >= MAX_SITE_TABS} onClick={newSiteTab}>
              +
            </button>
          </div>
          <form
            className="site-addr"
            onSubmit={(e) => {
              e.preventDefault();
              goSite(siteAddr);
              (e.currentTarget.elements.namedItem("addr") as HTMLInputElement).blur();
            }}
          >
            <input name="addr" value={siteAddr} onChange={(e) => setSiteAddr(e.target.value)} placeholder="/nfl/  or a chase-analytics.com link" spellCheck={false} aria-label="Site page" />
            <button type="submit">Go</button>
          </form>
          <div className="site-links">
            {SITE_LINKS.map(([label, path]) => (
              <button key={path} onClick={() => goSite(path)}>
                {label}
              </button>
            ))}
            {siteView === "pair" ? (
              <button title="Swap the two pages" onClick={() => void applySite("pair", tabById(pairId), airTab)}>
                ⇄ Swap
              </button>
            ) : null}
          </div>
          <label className="site-width">
            Page width · {siteWidthFor(siteView)}px
            <input
              type="range"
              min={360}
              max={1920}
              step={10}
              value={siteWidthFor(siteView)}
              onChange={(e) => {
                const key = `${format}.${siteView === "off" ? "full" : siteView}`;
                const next = { ...siteWidths, [key]: Number(e.target.value) };
                setSiteWidths(next);
                writePref("booth.siteWidths", JSON.stringify(next));
              }}
            />
          </label>
          <button className={refOpen ? "ref-toggle on" : "ref-toggle"} onClick={() => toggleRef()}>
            {refOpen ? "Hide" : "Show"} off-air reference (only you) <kbd>O</kbd>
          </button>
          <div className="hint">
            Site pages on the stage are in the video{STATIC ? "" : " (the first time, Record asks to share this tab: pick it)"}. The
            reference panel never is. P turns drawing off so you can click and scroll a page; , . flip tabs.
          </div>
        </section>

        <section className="note now">
          <div className="eyebrow">
            Now showing · {currentVertical?.groupLabel}
            {currentVertical && currentVertical.groupLabel !== currentVertical.label ? ` · ${currentVertical.label}` : ""}
          </div>
          <p>{currentVertical?.note || "—"}</p>
          {currentVertical?.composition === "Formation" ? <div className="hint">Click a face to spotlight that player · Esc clears</div> : null}
          <div className="hint">
            Story shape: matchup → market context (say research only) → skill duels → injuries (impact first) → scheme. This booth is locked to Giants at Rams.
          </div>
          {nextGroup ? <div className="hint">Next (Space): {nextGroup.label}</div> : null}
          <div className="story-spine" aria-label="Suggested story order">
            {storySteps.map((step, index) => (
              <button key={step.key} className={step.index === groupIdx ? "on" : ""} onClick={() => showGroup(step.index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step.group.label}
              </button>
            ))}
          </div>
        </section>

        <section className="graphics">
          <div className="eyebrow">Graphics · number = group · ← → = filter · / = search</div>
          <ol>
            {groups.map((g, i) => {
              const on = i === groupIdx;
              const newSection = g.section && g.section !== groups[i - 1]?.section;
              const keys = variantsOf(g);
              const vertOnly = !entries.some((e) => e.group === g.group);
              return (
                <li key={g.group} className={on ? "on" : ""}>
                  {newSection ? <div className="sec">{g.section}</div> : null}
                  <div className="row" onClick={() => showGroup(i)}>
                    <kbd>{GROUP_KEYS[i] ?? ""}</kbd>
                    <span>{g.label}</span>
                    {vertOnly ? <em>vertical only</em> : g.keys.length > 1 ? <em>{g.keys.length}</em> : null}
                  </div>
                  {on && g.keys.length > 1 ? (
                    <>
                      {g.group === "players" ? (
                        <div className="chips filters">
                          {["all", ...teams].map((t) => (
                            <button key={t} className={teamFilter === t ? "on" : ""} onClick={() => setTeamFilter(t)}>
                              {t === "all" ? "Both teams" : t}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="chips">
                        {keys.map((k) => {
                          const e = byKey.get(k);
                          if (!e) return null;
                          return (
                            <button key={k} className={k === currentKey ? "on" : ""} onClick={() => show(k)} title={e.note}>
                              {g.group === "players" ? String((e.props as { name?: string }).name ?? e.label) : e.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>


        <details className="fold">
          <summary>Drawing · {pen ? "on (drag on the picture)" : "off"}</summary>
          <div className="ink-tools">
            <button
              className={pen ? "on" : ""}
              onClick={() =>
                setPen((v) => {
                  writePref("booth.pen", v ? "0" : "1");
                  return !v;
                })
              }
            >
              ✎ {pen ? "Drawing on" : "Drawing off"} <kbd>P</kbd>
            </button>
            {TONES.map((t) => (
              <button key={t} className={`swatch ${t === tone ? "on" : ""}`} style={{ background: TONE_CSS[t] }} onClick={() => setTone(t)} title={t} />
            ))}
            <button className={arrow ? "on" : ""} onClick={() => setArrow((v) => !v)}>
              ➜ <kbd>X</kbd>
            </button>
            <button onClick={() => clearDrawings(true)}>
              Clear <kbd>C</kbd>
            </button>
          </div>
          <div className="hint">T cycles colour · click a face to spotlight · drawings clear when the graphic changes</div>
        </details>

        {cues.length ? (
          <details className="fold cues" open>
            <summary>This take · {cues.length} actions</summary>
            <div className="eyebrow">
              <button className="link" onClick={undo}>
                undo last (U)
              </button>{" "}
              ·{" "}
              <button className="link" onClick={mark}>
                mark (M)
              </button>
            </div>
            {[...cues].reverse().map((c, i) => (
              <div key={i}>
                <code>{cueTime(c.t)}</code> {cueLabel(c, byKey)}
              </div>
            ))}
          </details>
        ) : null}

        <details className="setup">
          <summary>Setup · camera, microphone, preview</summary>
          <div className="seg">
            {(["vertical", "wide"] as const).map((f) => (
              <button
                key={f}
                className={f === format ? "on" : ""}
                disabled={recording}
                onClick={() => {
                  setFormat(f);
                  writePref("booth.format", f);
                }}
              >
                {f === "vertical" ? "Vertical preview" : "Wide preview"}
              </button>
            ))}
          </div>
          <div className="hint">One recording makes both versions.</div>
          <div className="eyebrow" style={{ marginTop: 12 }}>
            Vertical is for
          </div>
          <div className="seg">
            {PLATFORMS.map((pl) => (
              <button
                key={pl.key}
                className={platform === pl.key ? "on" : ""}
                disabled={recording}
                onClick={() => {
                  setPlatformPref(pl.key);
                  writePref("booth.platform", pl.key);
                }}
              >
                {pl.label}
              </button>
            ))}
          </div>
          <div className="hint">Each app covers a different part of the frame; the wide version is for YouTube.</div>
          <div className="seg" style={{ marginTop: 10 }}>
            {[true, false].map((v) => (
              <button
                key={String(v)}
                className={instant === v ? "on" : ""}
                onClick={() => {
                  setInstant(v);
                  writePref("booth.instant3", v ? "1" : "0");
                }}
              >
                {v ? "Graphics appear instantly" : "Play their animation"}
              </button>
            ))}
          </div>
          <label>
            Camera
            <select
              value={camId}
              disabled={recording}
              onChange={(e) => {
                setCamId(e.target.value);
                writePref("booth.cam", e.target.value);
                e.target.blur();
              }}
            >
              <option value="">Default</option>
              {cams.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Microphone
            <select
              value={micId}
              disabled={recording}
              onChange={(e) => {
                setMicId(e.target.value);
                writePref("booth.mic", e.target.value);
                e.target.blur();
              }}
            >
              <option value="">Default (this computer)</option>
              <option value="phone">Phone (desktop camera stays here)</option>
              {mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone"}
                </option>
              ))}
            </select>
          </label>
          {micId === "phone" ? (
            <div className="hint" style={{ marginTop: 12 }}>
              {phoneState === "live" ? (
                <b style={{ color: "var(--mark-positive)" }}>Phone mic live.</b>
              ) : (
                <b style={{ color: "var(--text-accent)" }}>Waiting for the phone.</b>
              )}
              <div style={{ marginTop: 10 }}>
                On your phone open this HTTPS link (or scan). Code <code>{room}</code>
              </div>
              <button
                className="link"
                type="button"
                style={{ display: "block", marginTop: 8, wordBreak: "break-all" }}
                onClick={() => {
                  navigator.clipboard.writeText(phoneHref);
                  say("Audio link copied");
                }}
              >
                {phoneHref}
              </button>
              {/* This QR code belongs to the live control panel, not the rendered Remotion composition. */}
              {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
              <img
                alt="QR code for the phone mic link"
                src={qrUrl(phoneHref)}
                width={160}
                height={160}
                style={{ display: "block", marginTop: 12, borderRadius: 8, background: "#fff" }}
              />
              <div style={{ marginTop: 8 }}>Tap Allow microphone and leave that page open. Desktop camera stays here.</div>
            </div>
          ) : null}
          <label className="check">
            <input
              type="checkbox"
              checked={mirror}
              onChange={(e) => {
                setMirror(e.target.checked);
                writePref("booth.mirror", e.target.checked ? "1" : "0");
              }}
            />
            Mirror my preview (the recording itself is not flipped)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showZones}
              onChange={(e) => {
                setShowZones(e.target.checked);
                writePref("booth.zones", e.target.checked ? "1" : "0");
              }}
            />
            Shade the strip the apps cover (vertical)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={liveCaps}
              onChange={(e) => {
                setLiveCaps(e.target.checked);
                writePref("booth.captions", e.target.checked ? "1" : "0");
              }}
            />
            Live captions while I talk (preview; the video is captioned from the recording)
          </label>
        </details>
        <div className="meter" title="Talk normally: the bar should reach the green zone">
          <div ref={meterRef} />
        </div>
        {camError ? <div className="error">{camError}</div> : null}
        {capsNote ? <div className="hint">{capsNote}</div> : null}
        <button className="link help-link" onClick={() => setHelp(true)}>
          Keyboard shortcuts (?)
        </button>
      </aside>

      {palette.open ? (
        <div className="overlay" onClick={() => setPalette({ open: false, q: "", sel: 0 })}>
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              placeholder="Search graphics, players, filters..."
              value={palette.q}
              onChange={(e) => setPalette({ open: true, q: e.target.value, sel: 0 })}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setPalette((p) => ({ ...p, sel: Math.min(results.length - 1, p.sel + 1) }));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setPalette((p) => ({ ...p, sel: Math.max(0, p.sel - 1) }));
                } else if (e.key === "Enter" && results[palette.sel]) {
                  show(results[palette.sel].key);
                  setPalette({ open: false, q: "", sel: 0 });
                } else if (e.key === "Escape") {
                  setPalette({ open: false, q: "", sel: 0 });
                }
              }}
            />
            <ul>
              {results.map((e, i) => (
                <li
                  key={e.key}
                  className={i === palette.sel ? "on" : ""}
                  onMouseEnter={() => setPalette((p) => ({ ...p, sel: i }))}
                  onClick={() => {
                    show(e.key);
                    setPalette({ open: false, q: "", sel: 0 });
                  }}
                >
                  <b>{e.label}</b> <span>{e.groupLabel}</span>
                  <div>{e.note}</div>
                </li>
              ))}
              {!results.length ? <li className="empty">Nothing matches</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      {help ? (
        <div className="overlay" onClick={() => setHelp(false)}>
          <div className="help" onClick={(e) => e.stopPropagation()}>
            <h2>Keyboard</h2>
            <table>
              <tbody>
                {[
                  ["R", "Record (3-2-1) / stop"],
                  ["1 – 0, - =", "Graphic groups"],
                  ["← →", "Filters inside the group (offense/defense, teams, players...)"],
                  ["Space / ↓", "Next group · Shift+Space / ↑ previous"],
                  ["/", "Search every graphic and player"],
                  ["A S D F", "Layout: bubble · split · graphic only · camera only"],
                  ["Esc", "Clear a player spotlight"],
                  ["Drag on the picture", "Draw · T colour · X arrow tip · C clear · P turns drawing on/off"],
                  ["B N K", "Small graphics over the top: matchup bug · name strap · line ticker"],
                  ["G W E Q", "Stage: graphic · site page · graphic + site · two site pages"],
                  [", .", "Previous / next site tab on the stage"],
                  ["O", "Off-air reference: chase-analytics.com only you see"],
                  ["[ ]", "Graphic size: smaller · bigger"],
                  ["M", "Mark a moment (listed in the plan, not shown)"],
                  ["U or Ctrl+Z", "Undo the last action"],
                  ["?", "This help"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td>
                      <kbd>{k}</kbd>
                    </td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">Say “redo” after a flubbed line, pause, and say it again - it gets cut. Pauses are cut automatically.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** Little pictograms of the four layouts, drawn from the real geometry. */
const LayoutIcon: React.FC<{ mode: LayoutMode; wide: boolean; platform: "reels" | "tiktok" | "shorts" }> = ({ mode, wide, platform }) => {
  const w = wide ? 34 : 20;
  const h = wide ? 20 : 34;
  const G = frameGeom(wide ? "wide" : "vertical", wide ? "youtube" : platform, mode, wide ? 210 : 250);
  const sx = w / G.width;
  const sy = h / G.height;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="layout-icon">
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={2} fill="none" stroke="currentColor" opacity={0.5} />
      {G.stage.visible ? (
        <rect x={G.stage.x * sx + 1} y={G.stage.y * sy + 1} width={Math.max(0, G.stage.w * sx - 2)} height={Math.max(0, G.stage.h * sy - 2)} rx={1} fill="currentColor" opacity={0.35} />
      ) : null}
      {G.cam.w > 0 ? (
        <rect
          x={G.cam.x * sx}
          y={G.cam.y * sy}
          width={G.cam.w * sx}
          height={G.cam.h * sy}
          rx={Math.min(G.cam.r * sx, (G.cam.w * sx) / 2)}
          fill="currentColor"
        />
      ) : null}
    </svg>
  );
};

/**
 * A crash used to blank the page, which looks like "nothing happened". Show what
 * broke and keep the recording instructions on screen.
 */
class Guard extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal">
        <h2>The booth hit a problem</h2>
        <p>{this.state.error.message}</p>
        <p className="hint">
          Reload the page (F5). If it keeps happening, tell Claude what you pressed and paste this message.
        </p>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <Guard>
    <App />
  </Guard>,
);
