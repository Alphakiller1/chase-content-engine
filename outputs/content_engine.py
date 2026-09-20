"""Chase Content Engine — recording booth and live-slate helpers.

The still-post composer lives elsewhere. This module is the shared runtime the
broadcasting studio needs: fetch live slate/board JSON, fail closed, and start
the recording booth.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

PIPELINE = Path(__file__).resolve().parents[1]
VIDEO = PIPELINE / "video"
SITE_URL = "https://chase-analytics.com"
NFL_BOARD_URL = "https://alphakiller1.github.io/nfl-model/"
VIDEO_SITE_DIR = VIDEO / "src" / "site"


def fail(msg: str) -> None:
    print(f"[content-engine] FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def _fetch(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "chase-content-engine"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _et_date(stamp: str) -> str:
    try:
        when = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except ValueError:
        return ""
    return when.astimezone(ZoneInfo("America/New_York")).date().isoformat()


def _booth_pack_from_stdout(text: str) -> str | None:
    for line in reversed(text.splitlines()):
        if "[video-pack]" in line and "->" in line:
            rel = Path(line.split("->", 1)[1].strip())
            return str(Path("props") / "pack" / rel.name)
    return None


def run_booth(a: argparse.Namespace) -> None:
    """Build a game pack if a matchup was named, then start the recording booth."""
    booth_js = VIDEO / "scripts" / "booth.mjs"
    if not booth_js.is_file():
        fail("recording booth is missing (video/scripts/booth.mjs)")
    node = shutil.which("node")
    if not node:
        fail("node is not on PATH; the recording booth needs Node to serve the studio")
    if not (VIDEO_SITE_DIR / "index.css").is_file():
        fail("video/src/site/index.css is missing; pull the repo and keep that folder")

    pack = (getattr(a, "pack", None) or "").strip() or None
    games_arg = (getattr(a, "games", None) or "").strip()
    sport = getattr(a, "sport", None) or "nfl"
    if games_arg and not pack:
        game = games_arg.split(",")[0].strip()
        cmd = [sys.executable, "-m", "outputs.video_pack",
               "--league", sport, "--game", game]
        if getattr(a, "date", None):
            cmd += ["--date", a.date]
        if getattr(a, "show", None):
            cmd += ["--show", a.show]
        if getattr(a, "tag", None):
            cmd += ["--tag", a.tag]
        plat = getattr(a, "video_platform", "reels") or "reels"
        if plat not in ("reels", "reels-ads", "tiktok", "shorts"):
            plat = "reels"
        cmd += ["--platform", plat]
        print("[content-engine] building game pack for the booth ...")
        r = subprocess.run(cmd, cwd=PIPELINE, capture_output=True, text=True)
        sys.stdout.write(r.stdout or "")
        sys.stderr.write(r.stderr or "")
        if r.returncode:
            sys.exit(r.returncode)
        pack = _booth_pack_from_stdout(r.stdout or "")
        if not pack:
            fail("game pack built but its folder could not be read from video_pack output")

    argv = [node, str(booth_js)]
    if pack:
        argv += ["--pack", pack]
    plat = getattr(a, "video_platform", "reels") or "reels"
    if plat not in ("reels", "tiktok", "shorts"):
        plat = "reels"
    argv += ["--platform", plat]
    if getattr(a, "no_open", False):
        argv.append("--no-open")
    print("[content-engine] recording booth — keep this window open while you record")
    raise SystemExit(subprocess.call(argv, cwd=VIDEO))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("command", choices=["booth", "sync-style"])
    ap.add_argument("--games", help="AWAY@HOME")
    ap.add_argument("--sport", choices=["mlb", "nfl"], default="nfl")
    ap.add_argument("--date")
    ap.add_argument("--pack", help="props/pack/<id> relative to video/")
    ap.add_argument("--show")
    ap.add_argument("--tag")
    ap.add_argument("--no-open", action="store_true", dest="no_open")
    ap.add_argument("--video-platform", default="reels", dest="video_platform",
                    choices=["reels", "reels-ads", "tiktok", "shorts", "youtube"])
    a = ap.parse_args()
    if a.command == "sync-style":
        if not (VIDEO_SITE_DIR / "index.css").is_file():
            fail("video/src/site/index.css is missing")
        print(f"[content-engine] video package style already at {VIDEO_SITE_DIR}")
        return
    run_booth(a)


if __name__ == "__main__":
    main()
