"""Asset resolution for Chase social graphics — logos, headshots, metric colors."""
from __future__ import annotations

import re
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".cache" / "assets"
PIPELINE_ASSETS = Path(r"C:\Users\chase\mlbma_pipeline\dashboard\assets")

# Mirror dashboard/mlbma_assets.js ESPN_ABBR_MAP
ESPN_ABBR_MAP = {
    "ARI": "ari", "ATL": "atl", "BAL": "bal", "BOS": "bos", "CHC": "chc",
    "CHW": "chw", "CWS": "chw", "CIN": "cin", "CLE": "cle", "COL": "col",
    "DET": "det", "HOU": "hou", "KC": "kc", "KCR": "kc", "LAA": "laa",
    "LAD": "lad", "MIA": "mia", "MIL": "mil", "MIN": "min", "NYM": "nym",
    "NYY": "nyy", "ATH": "oak", "OAK": "oak", "PHI": "phi", "PIT": "pit",
    "SD": "sd", "SDP": "sd", "SF": "sf", "SFG": "sf", "SEA": "sea",
    "STL": "stl", "TB": "tb", "TBR": "tb", "TEX": "tex", "TOR": "tor",
    "WSH": "wsh", "WAS": "wsh", "WSN": "wsh", "AZ": "ari", "CHA": "chw",
    "KCA": "kc", "TBA": "tb",
}

# League-anchored 7-step scale (CONTENT_DESIGN_CONTRACT §1.3)
METRIC_STEPS = (
    (None, -1.5, "#F2545B"),
    (-1.5, -0.75, "#F0935B"),
    (-0.75, -0.25, "#E8C24A"),
    (-0.25, 0.25, "#A1A1AA"),
    (0.25, 0.75, "#86D76F"),
    (0.75, 1.5, "#4ADE80"),
    (1.5, None, "#22C55E"),
)

GENERIC_HEADSHOT = (
    "https://img.mlbstatic.com/mlb-photos/image/upload/"
    "d_people:generic:headshot:67:current.png/"
    "c_fill,g_auto:face,w_426,h_426,q_auto:best/v1/people/0/headshot/67/current"
)


def espn_abbr(team: str) -> str:
    upper = str(team or "").strip().upper()
    return ESPN_ABBR_MAP.get(upper, upper.lower() or "mlb")


def team_logo_url(team: str, size: int = 500) -> str:
    return f"https://a.espncdn.com/i/teamlogos/mlb/{size}/{espn_abbr(team)}.png"


def headshot_url(mlb_id: int | str | None, width: int = 426) -> str:
    if not mlb_id:
        return GENERIC_HEADSHOT
    w = int(width)
    return (
        "https://img.mlbstatic.com/mlb-photos/image/upload/"
        "d_people:generic:headshot:67:current.png/"
        f"c_fill,g_auto:face,w_{w},h_{w},q_auto:best/v1/people/{mlb_id}/headshot/67/current"
    )


def chase_logo_path() -> Path:
    candidates = [
        PIPELINE_ASSETS / "chase-logo-horizontal-light.png",
        PIPELINE_ASSETS / "chase-logo-horizontal.png",
        ROOT / "assets" / "chase-logo-horizontal-light.png",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        "Chase logo not found. Expected chase-logo-horizontal-light.png in "
        "mlbma_pipeline/dashboard/assets/"
    )


def _download(url: str, dest: Path, *, timeout: float = 20.0) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 200:
        return dest
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ChaseContentEngine/1.0 (+chase-analytics.com)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    if len(data) < 200:
        raise RuntimeError(f"Asset too small ({len(data)} bytes): {url}")
    dest.write_bytes(data)
    return dest


def team_logo_file(team: str, *, required: bool = True) -> Path | None:
    abbr = espn_abbr(team)
    dest = CACHE_DIR / "logos" / f"{abbr}.png"
    try:
        return _download(team_logo_url(team), dest)
    except (urllib.error.URLError, TimeoutError, RuntimeError, OSError) as exc:
        if required:
            raise RuntimeError(f"Failed to resolve team logo for {team}: {exc}") from exc
        return None


def headshot_file(mlb_id: int | str | None, *, required: bool = False) -> Path | None:
    if not mlb_id:
        return None
    dest = CACHE_DIR / "headshots" / f"{mlb_id}.png"
    try:
        return _download(headshot_url(mlb_id), dest)
    except (urllib.error.URLError, TimeoutError, RuntimeError, OSError):
        if required:
            raise
        return None


def path_uri(path: Path) -> str:
    return path.resolve().as_uri()


def data_uri(path: Path) -> str:
    """Embed local assets as data URIs — required for Playwright set_content."""
    raw = Path(path).read_bytes()
    suffix = Path(path).suffix.lower()
    mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
    }.get(suffix, "image/png")
    # Detect real format from magic bytes (CDN may ignore extension).
    if raw[:3] == b"\xff\xd8\xff":
        mime = "image/jpeg"
    elif raw[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    elif raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        mime = "image/webp"
    import base64

    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


def metric_color(
    value: float | None,
    *,
    mean: float = 50.0,
    std: float = 15.0,
    invert: bool = False,
    unavailable: str = "#4C5161",
) -> str:
    if value is None:
        return unavailable
    z = (float(value) - mean) / max(std, 1e-6)
    if invert:
        z = -z
    for lo, hi, color in METRIC_STEPS:
        if lo is not None and z < lo:
            continue
        if hi is not None and z >= hi:
            continue
        return color
    return METRIC_STEPS[-1][2]


def osi_color(value: float | None) -> str:
    return metric_color(value, mean=50.0, std=12.0)


def pitch_score_color(value: float | None) -> str:
    return metric_color(value, mean=50.0, std=12.0)


def runs_color(value: float | None) -> str:
    return metric_color(value, mean=4.4, std=0.9)


def er_color(value: float | None) -> str:
    return metric_color(value, mean=2.4, std=0.7, invert=True)


def delta_color(value: float | None) -> str:
    return metric_color(value, mean=0.0, std=6.0)


def norm_name(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()
