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
import { LAYOUT_MODES, LayoutMode, StageSize, Stroke, frameGeom } from "../src/edit/frames";
import { teamAccent } from "../src/teams";
import "../src/theme.css";
import "./booth.css";

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

/** Scale that fits a w x h frame in an element; attaches whenever the element mounts. */
function useFit(w: number, h: number) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.max(0.1, Math.min((r.width - 24) / w, (r.height - 24) / h)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, w, h]);
  return [setEl, scale] as const;
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
                : `★ ${c.arg}`;

/* ── app ──────────────────────────────────────────────────────────────────── */

const App: React.FC = () => {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [packs, setPacks] = useState<PackOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [format, setFormat] = useState<"vertical" | "wide">(() => (readPref("booth.format", "vertical") === "wide" ? "wide" : "vertical"));
  const [mode, setMode] = useState<LayoutMode>("bubble");
  const [currentKey, setCurrentKey] = useState("matchup");
  const [variantOf, setVariantOf] = useState<Record<string, string>>({});
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [focusMap, setFocusMap] = useState<Record<string, Focus[]>>({});
  const [nonce, setNonce] = useState(0);
  const [instant, setInstant] = useState(() => readPref("booth.instant3", "1") === "1");

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState(() => readPref("booth.cam", ""));
  const [micId, setMicId] = useState(() => readPref("booth.mic", ""));
  const [mirror, setMirror] = useState(() => readPref("booth.mirror", "1") === "1");
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [phoneTrack, setPhoneTrack] = useState<MediaStreamTrack | null>(null);
  const [phoneState, setPhoneState] = useState<"off" | "wait" | "live">("off");
  const [phoneUrls, setPhoneUrls] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
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

  const videoRef = useRef<HTMLVideoElement>(null);
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
    fetch("/api/packs")
      .then((r) => (r.ok ? r.json() : { packs: [] }))
      .then((d: { packs?: PackOpt[] }) => setPacks(d.packs ?? []))
      .catch(() => setPacks([]));
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(new Error(t)))))
      .then((c: Catalog) => {
        setCat(c);
        // Warm the browser cache so a board or a face appears the moment it is called.
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
            if (src) new Image().src = "/" + src;
          }
        }
      })
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, []);

  /* live lines: follow the server's refreshes and reload the graphics when they land */
  useEffect(() => {
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
        setDevices(await navigator.mediaDevices.enumerateDevices());
      })
      .catch((e) => setCamError(`Camera/microphone blocked or missing: ${e.message}. Allow access in the address bar, then reload.`));
    return () => {
      alive = false;
      local?.getTracks().forEach((t) => t.stop());
      setCamStream(null);
    };
  }, [camId, micId]);

  useEffect(() => {
    if (!camStream) {
      setStream(null);
      return;
    }
    const mixed = new MediaStream();
    for (const t of camStream.getVideoTracks()) mixed.addTrack(t);
    if (micId === "phone") {
      if (phoneTrack) mixed.addTrack(phoneTrack);
    } else {
      for (const t of camStream.getAudioTracks()) mixed.addTrack(t);
    }
    setStream(mixed);
  }, [camStream, phoneTrack, micId]);

  useEffect(() => {
    fetch("/api/lan")
      .then((r) => (r.ok ? r.json() : { urls: [] }))
      .then((d: { urls?: string[] }) => setPhoneUrls(d.urls ?? []))
      .catch(() => setPhoneUrls([]));
  }, []);

  useEffect(() => {
    if (micId !== "phone") {
      setPhoneTrack(null);
      setPhoneState("off");
      return;
    }
    setPhoneState("wait");
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.ontrack = (e) => {
      const t = e.track ?? e.streams[0]?.getAudioTracks()[0];
      if (!t) return;
      setPhoneTrack(t);
      setPhoneState("live");
      say("Phone mic is live — desktop camera unchanged");
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
    };
    const pendingIce: RTCIceCandidateInit[] = [];
    ws.onopen = () => ws.send(JSON.stringify({ role: "booth" }));
    ws.onmessage = async (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === "offer" && msg.sdp) {
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", sdp: pc.localDescription }));
        for (const c of pendingIce) {
          try {
            await pc.addIceCandidate(c);
          } catch {
            /* stale */
          }
        }
        pendingIce.length = 0;
      } else if (msg.type === "ice" && msg.candidate) {
        if (!pc.remoteDescription) pendingIce.push(msg.candidate);
        else {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch {
            /* stale */
          }
        }
      }
    };
    return () => {
      pc.close();
      ws.close();
      setPhoneTrack(null);
      setPhoneState("off");
    };
  }, [micId, say]);

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
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
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
    const id = setInterval(() => setElapsed(now()), 250);
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
      setMode((prev?.arg as LayoutMode) ?? "bubble");
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
    }
    say(`Undone · ${cueLabel(last, byKey)}`);
  }, [byKey, currentKey, say]);

  /* recording */
  const beginRecording = useCallback(() => {
    if (!stream) return;
    const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 192_000 });
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
      setCues([...cuesRef.current]);
      setElapsed(0);
      setPhase("recording");
      setStrokes([]);
      setNonce((n) => n + 1);
    };
    rec.onstop = async () => {
      setPhase("saving");
      const name = stamp();
      try {
        const blob = new Blob(chunks.current, { type: "video/webm" });
        let r = await fetch(`/api/save?name=${name}&ext=webm`, { method: "POST", body: blob });
        if (!r.ok) throw new Error(await r.text());
        r = await fetch(`/api/cues?name=${name}`, {
          method: "POST",
          body: JSON.stringify({ cues: cuesRef.current, strokes: strokeStore.current }),
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
  }, [currentKey, mode, overlaysOn, size, stream]);

  const toggleRecord = useCallback(() => {
    if (phase === "recording") {
      recRef.current?.stop();
      return;
    }
    if (phase === "countdown") {
      setPhase("idle");
      say("Countdown cancelled");
      return;
    }
    if (phase === "saving" || !stream) return;
    if (micId === "phone" && !phoneTrack) return say("Phone mic is not connected yet");
    setCount(3);
    setPhase("countdown");
  }, [micId, phase, phoneTrack, say, stream]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      beginRecording();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [beginRecording, count, phase]);

  const makeVideo = useCallback(async () => {
    const r = await fetch(`/api/edit?name=${saved}&ext=webm&platform=${platform}`, { method: "POST" });
    setMessage(r.ok ? "Editing started in a new window - your videos open when it finishes." : `Could not start: ${await r.text()}`);
  }, [platform, saved]);

  /* drawing */
  const W = format === "wide" ? 1920 : 1080;
  const H = format === "wide" ? 1080 : 1920;
  const [stageEl, scale] = useFit(W, H);
  const drawActive = pen;
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
  }, [changeMode, changeSize, clearDrawings, groupIdx, help, mark, overlaysOn, palette.open, say, setFocus, showGroup, size, stepVariant, toggleOverlay, toggleRecord, undo]);

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
  const G = frameGeom(format, format === "wide" ? "youtube" : platform, mode, cam);
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
  };
  const cams = devices.filter((d) => d.kind === "videoinput");
  const mics = devices.filter((d) => d.kind === "audioinput");
  const nextGroup = groups[(groupIdx + 1) % groups.length];
  const teams = [cat.game.away, cat.game.home];
  const ringPad = G.cam.ring ? 5 : 0;

  return (
    <div className="booth">
      <main ref={stageEl} className="stage">
        {!focused ? (
          <div className="focus-banner" onClick={() => window.focus()}>
            Click here so the booth can hear your keys
          </div>
        ) : null}
        <div className="frame" style={{ width: W * scale, height: H * scale }}>
          <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
            {/* 1. page ground  2. live camera  3. the frame (transparent)  4. ink */}
            <div style={{ position: "absolute", inset: 0, background: "var(--surface-page)" }} />
            <div
              className="cam-box"
              style={{
                left: G.cam.x,
                top: G.cam.y,
                width: G.cam.w,
                height: G.cam.h,
                borderRadius: G.cam.r,
                padding: ringPad,
                background: G.cam.ring ? `conic-gradient(from 200deg, ${ring}, var(--accent) 45%, ${ring})` : "transparent",
                opacity: G.cam.w > 0 ? 1 : 0,
              }}
            >
              {/* eslint-disable-next-line @remotion/warn-native-media-tag -- this is a live MediaStream preview, not timeline media. */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ borderRadius: Math.max(0, G.cam.r - ringPad), transform: mirror ? "scaleX(-1)" : undefined }}
              />
            </div>
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
          {recording ? <div className="rec-badge">● REC {clock(elapsed)}</div> : null}
          {flash.text ? <div className="flash">{flash.text}</div> : null}
          {phase === "countdown" ? <div className="countdown">{count || ""}</div> : null}
        </div>
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
              {live?.busy
                ? "refreshing..."
                : live?.error
                  ? "refresh failed - showing last lines"
                  : live?.updated
                    ? `live · ${new Date(live.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · every ${live.everyMin} min`
                    : "live"}
            </span>
            <button
              className="link"
              onClick={() => {
                fetch("/api/refresh", { method: "POST" });
                say("Refreshing lines...");
              }}
            >
              refresh
            </button>
          </div>
        </header>

        <section>
          {phase === "saving" ? (
            <button className="big" disabled>
              Saving...
            </button>
          ) : recording ? (
            <button className="big stop" onClick={toggleRecord}>
              ■ Stop · {clock(elapsed)} <kbd>R</kbd>
            </button>
          ) : phase === "countdown" ? (
            <button className="big rec" onClick={toggleRecord}>
              Starting in {count}... (R cancels)
            </button>
          ) : (
            <button className="big rec" onClick={toggleRecord} disabled={!stream || (micId === "phone" && !phoneTrack)}>
              ● Record <kbd>R</kbd>
            </button>
          )}
          {phase === "saved" ? (
            <div className="saved">
              <div>
                Saved <b>{saved}</b> in video\footage
              </div>
              <button className="big go" onClick={makeVideo}>
                Make my video
              </button>
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

        <section className="note now">
          <div className="eyebrow">
            Now showing · {currentVertical?.groupLabel}
            {currentVertical && currentVertical.groupLabel !== currentVertical.label ? ` · ${currentVertical.label}` : ""}
          </div>
          <p>{currentVertical?.note || "—"}</p>
          {currentVertical?.composition === "Formation" ? <div className="hint">Click a face to spotlight that player · Esc clears</div> : null}
          <div className="hint">
            Take shape: 1 matchup → 2 market (say research only) → 8 skill duels → 0 injuries (impact first) → 6 scheme. Other Sunday games in the dropdown.
          </div>
          {nextGroup ? <div className="hint">Next (Space): {nextGroup.label}</div> : null}
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
            <div className="hint" style={{ marginTop: 8 }}>
              {phoneState === "live" ? (
                <b style={{ color: "var(--mark-positive)" }}>Phone mic live.</b>
              ) : (
                <b style={{ color: "var(--text-accent)" }}>Waiting for the phone.</b>
              )}{" "}
              Same Wi‑Fi. On the phone open{" "}
              {phoneUrls[0] ? (
                <button
                  className="link"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(phoneUrls[0])}
                >
                  {phoneUrls[0]}
                </button>
              ) : (
                "the Phone mic URL from the booth terminal"
              )}
              , tap past the certificate warning, then Allow microphone. Leave that page open.
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
                  ["Click a face", "Spotlight that player (formations) · Esc clears"],
                  ["Drag on the picture", "Draw · T colour · X arrow tip · C clear · P turns drawing on/off"],
                  ["B N K", "Small graphics over the top: matchup bug · name strap · line ticker"],
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
