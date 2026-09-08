from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from chase_content.util import number, truncate
from chase_content.validate import validate_bundle

WIDTH = 1080
HEIGHT = 1350

BG = "#08090F"
PANEL = "#11131B"
PANEL_ALT = "#171A24"
BORDER = "#292D3A"
TEXT = "#F4F4F7"
MUTED = "#9CA3AF"
PURPLE = "#9A6BFF"
PURPLE_LIGHT = "#C4B0FF"
GREEN = "#4ADE80"
RED = "#F87171"
GOLD = "#FBBF24"
BLUE = "#60A5FA"


_FONTS_DIR = Path(__file__).resolve().parent / "fonts"

# Chase metallic-silver heading fill (contract §1.5).
_METAL_STOPS = (
    (0.00, (255, 255, 255)),
    (0.38, (233, 234, 240)),
    (0.56, (157, 160, 174)),
    (0.72, (215, 217, 226)),
    (1.00, (255, 255, 255)),
)


def _font(size: int, *, display: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Load bundled DM Sans (UI) or Roboto Condensed (display/numerics). No Google Fonts."""
    if display:
        name = "RobotoCondensed-ExtraBold.ttf" if bold and size >= 40 else (
            "RobotoCondensed-Bold.ttf" if bold else "RobotoCondensed-Regular.ttf"
        )
    else:
        name = "DMSans-Bold.ttf" if bold else "DMSans-Regular.ttf"
    path = _FONTS_DIR / name
    if not path.is_file():
        raise FileNotFoundError(f"bundled font missing: {path}")
    return ImageFont.truetype(str(path), size=size)


FONTS = {
    "eyebrow": _font(22, display=False, bold=True),
    "title": _font(46, display=True, bold=True),
    "subtitle": _font(24, display=False, bold=False),
    "rank": _font(32, display=True, bold=True),
    "team": _font(32, display=True, bold=True),
    "score": _font(34, display=True, bold=True),
    "body": _font(21, display=False, bold=False),
    "body_bold": _font(21, display=True, bold=True),
    "small": _font(17, display=False, bold=False),
    "small_bold": _font(17, display=True, bold=True),
    "tiny": _font(14, display=False, bold=False),
    "panel_title": _font(28, display=True, bold=True),
    "metric": _font(26, display=True, bold=True),
}


def _lerp_metal(t: float) -> tuple[int, int, int]:
    t = min(1.0, max(0.0, t))
    for (t0, c0), (t1, c1) in zip(_METAL_STOPS, _METAL_STOPS[1:]):
        if t <= t1:
            span = t1 - t0 or 1.0
            u = (t - t0) / span
            return (
                int(c0[0] + (c1[0] - c0[0]) * u),
                int(c0[1] + (c1[1] - c0[1]) * u),
                int(c0[2] + (c1[2] - c0[2]) * u),
            )
    return _METAL_STOPS[-1][1]


def _metallic_text(
    image: Image.Image,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    *,
    anchor: str = "lt",
) -> None:
    """Paint display headings with the contract metallic-silver vertical gradient."""
    scratch = ImageDraw.Draw(image)
    bbox = scratch.textbbox(xy, text, font=font, anchor=anchor)
    x0, y0, x1, y1 = bbox
    width, height = max(1, x1 - x0), max(1, y1 - y0)
    grad = Image.new("RGB", (width, height))
    pixels = grad.load()
    denom = max(height - 1, 1)
    for row in range(height):
        color = _lerp_metal(row / denom)
        for col in range(width):
            pixels[col, row] = color
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).text(
        (xy[0] - x0, xy[1] - y0),
        text,
        font=font,
        fill=255,
        anchor=anchor,
    )
    image.paste(grad, (x0, y0), mask)


def _fmt_optional(value: float | None, pattern: str) -> str:
    return pattern.format(value) if value is not None else "—"


def format_osi_window(row: dict) -> str:
    """YTD/L7 trail. Missing values stay em-dash, never 0.0."""
    ytd = number(row.get("osi_ytd"))
    l7 = number(row.get("osi_l7"))
    return f"YTD {_fmt_optional(ytd, '{:.1f}')} → L7 {_fmt_optional(l7, '{:.1f}')}"


def market_divergence(row: dict) -> float | None:
    """Signed public→sharp gap from the probabilities. Never trust a supplied override."""
    public_n = number(row.get("public_probability"))
    sharp_n = number(row.get("sharp_probability"))
    if public_n is None or sharp_n is None:
        return None
    return sharp_n - public_n


def format_market_move(row: dict) -> str:
    """Public→sharp line. Missing probs are pending, not 0.0 / maximal divergence."""
    public_n = number(row.get("public_probability"))
    sharp_n = number(row.get("sharp_probability"))
    gap = market_divergence(row)
    if public_n is None or sharp_n is None or gap is None:
        return "observation pending"
    return f"{public_n * 100:.1f}%  →  {sharp_n * 100:.1f}%   ({gap * 100:+.1f})"


def _canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    return image, ImageDraw.Draw(image)


def _header(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    *,
    title: str,
    subtitle: str,
    date: str,
    page: str | None = None,
) -> None:
    draw.text((60, 45), "CHASE ANALYTICS", font=FONTS["eyebrow"], fill=PURPLE)
    _metallic_text(image, (60, 82), title, FONTS["title"])
    draw.text((60, 150), subtitle, font=FONTS["subtitle"], fill=MUTED)
    draw.text((60, 192), date, font=FONTS["small_bold"], fill=TEXT)
    if page:
        draw.text((1020, 52), page, font=FONTS["small_bold"], fill=MUTED, anchor="ra")
    draw.line((60, 232, 1020, 232), fill=BORDER, width=2)


def _footer(draw: ImageDraw.ImageDraw, generated_at: str) -> None:
    draw.line((60, 1294, 1020, 1294), fill=BORDER, width=2)
    draw.text(
        (60, 1315),
        f"Updated {generated_at} · Model projections are not guarantees.",
        font=FONTS["tiny"],
        fill=MUTED,
    )
    draw.text((1020, 1315), "chase-analytics.com", font=FONTS["tiny"], fill=PURPLE_LIGHT, anchor="ra")


def _date_label(bundle: dict) -> str:
    return str((bundle.get("meta") or {}).get("slate_date") or "Date unavailable")


def _updated_label(bundle: dict) -> str:
    raw = str((bundle.get("meta") or {}).get("generated_at") or "")
    return raw.replace("T", " ")[:19] + (" UTC" if raw else "")


def _favorite_win_probability(away_p: float | None, home_p: float | None) -> float | None:
    """Largest observed side. Missing sides stay missing — never 0.5."""
    observed = [p for p in (away_p, home_p) if p is not None]
    return max(observed) if observed else None


def _fmt_win_pct(probability: float | None) -> str:
    return f"{probability * 100:.0f}%" if probability is not None else "—"


def _model_separation_sort_key(game: dict) -> float:
    """Rank by observed favorite probability. Games with no probs sort last, not as 0.5."""
    projection = game.get("projection") or {}
    favorite = _favorite_win_probability(
        number(projection.get("away_win_probability")),
        number(projection.get("home_win_probability")),
    )
    return favorite if favorite is not None else float("-inf")


def _separation(probability: float | None) -> tuple[str, str]:
    if probability is None:
        return "PENDING", MUTED
    pct = probability * 100
    if pct >= 65:
        return "LOPSIDED", RED
    if pct >= 60:
        return "CLEAR EDGE", GOLD
    if pct >= 55:
        return "LEAN", BLUE
    return "TOSS-UP", MUTED


def _opinion_color(tag: str) -> str:
    return {
        "MY BET": GREEN,
        "LEAN": PURPLE,
        "WATCH": BLUE,
        "PASS": MUTED,
        "NO OPINION": MUTED,
    }.get(tag, MUTED)


def _pitcher_text(pitcher: dict) -> str:
    name = truncate(pitcher.get("name") or "TBD", 20)
    ip = number(pitcher.get("projected_ip"))
    er = number(pitcher.get("projected_er"))
    strikeouts = number(pitcher.get("projected_k"))
    if ip is None and er is None and strikeouts is None:
        return f"{name} · projection pending"
    pieces = []
    if ip is not None:
        pieces.append(f"{ip:.1f} IP")
    if er is not None:
        pieces.append(f"{er:.1f} ER")
    if strikeouts is not None:
        pieces.append(f"{strikeouts:.1f} K")
    return f"{name} · {' · '.join(pieces)}"


def _draw_game_card(
    draw: ImageDraw.ImageDraw,
    game: dict,
    rank: int,
    box: tuple[int, int, int, int],
    *,
    compact: bool,
) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=22, fill=PANEL, outline=BORDER, width=2)
    projection = game.get("projection") or {}
    away_p = number(projection.get("away_win_probability"))
    home_p = number(projection.get("home_win_probability"))
    label, tone = _separation(_favorite_win_probability(away_p, home_p))
    away, home = game.get("away", "AWY"), game.get("home", "HME")

    draw.text((x1 + 22, y1 + 17), f"#{rank}", font=FONTS["rank"], fill=PURPLE)
    draw.text((x1 + 92, y1 + 18), f"{away} @ {home}", font=FONTS["team"], fill=TEXT)
    draw.text((x2 - 22, y1 + 22), str(game.get("time") or "TBD"), font=FONTS["small"], fill=MUTED, anchor="ra")

    away_runs = number(projection.get("away_runs"))
    home_runs = number(projection.get("home_runs"))
    score = (
        f"{away} {away_runs:.1f}  —  {home_runs:.1f} {home}"
        if away_runs is not None and home_runs is not None
        else "Game projection pending"
    )
    draw.text((x1 + 22, y1 + 60), score, font=FONTS["score"], fill=TEXT)
    draw.text((x2 - 22, y1 + 67), label, font=FONTS["small_bold"], fill=tone, anchor="ra")

    bar_x1, bar_x2, bar_y = x1 + 22, x2 - 22, y1 + 109
    bar_width = bar_x2 - bar_x1
    draw.rounded_rectangle((bar_x1, bar_y, bar_x2, bar_y + 13), radius=7, fill="#282C38")
    if away_p is not None and home_p is not None:
        split = bar_x1 + int(bar_width * away_p)
        draw.rounded_rectangle((bar_x1, bar_y, split, bar_y + 13), radius=7, fill=BLUE)
        draw.rounded_rectangle((split, bar_y, bar_x2, bar_y + 13), radius=7, fill=PURPLE)
    draw.text(
        (bar_x1, bar_y + 18),
        f"{_fmt_win_pct(away_p)} {away}",
        font=FONTS["tiny"],
        fill=MUTED,
    )
    draw.text(
        (bar_x2, bar_y + 18),
        f"{home} {_fmt_win_pct(home_p)}",
        font=FONTS["tiny"],
        fill=MUTED,
        anchor="ra",
    )

    opinion = game.get("opinion") or {}
    tag = str(opinion.get("tag") or "NO OPINION").upper()
    opinion_text = truncate(opinion.get("text"), 43)
    if compact:
        pitcher_y = bar_y + 35
        midpoint = (x1 + x2) // 2
        draw.text(
            (x1 + 22, pitcher_y),
            truncate(_pitcher_text(game.get("away_pitcher") or {}), 39),
            font=FONTS["tiny"],
            fill=TEXT,
        )
        draw.text(
            (midpoint + 5, pitcher_y),
            truncate(_pitcher_text(game.get("home_pitcher") or {}), 39),
            font=FONTS["tiny"],
            fill=TEXT,
        )
        opinion_y = y2 - 29
    else:
        pitcher_y = bar_y + 47
        draw.text(
            (x1 + 22, pitcher_y),
            _pitcher_text(game.get("away_pitcher") or {}),
            font=FONTS["small"],
            fill=TEXT,
        )
        draw.text(
            (x1 + 22, pitcher_y + 27),
            _pitcher_text(game.get("home_pitcher") or {}),
            font=FONTS["small"],
            fill=TEXT,
        )
        opinion_y = y2 - 38
    draw.rounded_rectangle(
        (x1 + 22, opinion_y - 5, x1 + 145, opinion_y + 25),
        radius=15,
        fill=_opinion_color(tag),
    )
    draw.text((x1 + 83, opinion_y + 9), tag, font=FONTS["tiny"], fill=BG, anchor="mm")
    if opinion_text:
        draw.text((x1 + 160, opinion_y + 1), opinion_text, font=FONTS["small"], fill=TEXT)
    status = str(game.get("lineup_status") or "projected").title()
    draw.text((x2 - 22, opinion_y + 3), status, font=FONTS["tiny"], fill=MUTED, anchor="ra")


def render_morning_slate(bundle: dict, out_dir: Path) -> list[Path]:
    games = list(bundle.get("games") or [])
    games.sort(key=_model_separation_sort_key, reverse=True)
    count = len(games)
    pages = min(3, max(1, math.ceil(count / 5)))
    per_page = math.ceil(count / pages)
    paths = []
    out_dir.mkdir(parents=True, exist_ok=True)
    for page_index in range(pages):
        page_games = games[page_index * per_page : (page_index + 1) * per_page]
        image, draw = _canvas()
        _header(
            image,
            draw,
            title="MORNING SLATE",
            subtitle="Ranked from largest model separation to closest matchup",
            date=_date_label(bundle),
            page=f"{page_index + 1} / {pages}" if pages > 1 else None,
        )
        content_top, content_bottom = 260, 1270
        gap = 14
        card_height = int((content_bottom - content_top - gap * max(0, len(page_games) - 1)) / max(1, len(page_games)))
        card_height = min(card_height, 270)
        y = content_top
        for offset, game in enumerate(page_games):
            rank = page_index * per_page + offset + 1
            _draw_game_card(
                draw,
                game,
                rank,
                (60, y, 1020, y + card_height),
                compact=card_height < 230,
            )
            y += card_height + gap
        _footer(draw, _updated_label(bundle))
        path = out_dir / f"morning-slate-{page_index + 1:02d}.png"
        image.save(path, quality=95)
        paths.append(path)
    return paths


def _draw_rank_panel(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    title: str,
    rows: list[dict],
    metric: str,
    *,
    inverse: bool = False,
) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=24, fill=PANEL, outline=BORDER, width=2)
    _metallic_text(image, (x1 + 26, y1 + 24), title, FONTS["panel_title"])
    draw.line((x1 + 26, y1 + 67, x2 - 26, y1 + 67), fill=BORDER, width=2)
    for index, row in enumerate(rows[:5], start=1):
        y = y1 + 88 + (index - 1) * 76
        team = str(row.get("team") or "—")
        value = number(row.get(metric))
        if value is None:
            tone = MUTED
        elif inverse and value < 0:
            tone = RED
        elif value > 0:
            tone = GREEN
        else:
            tone = MUTED
        draw.text((x1 + 26, y), str(index), font=FONTS["body_bold"], fill=PURPLE)
        draw.text((x1 + 64, y), team, font=FONTS["metric"], fill=TEXT)
        if value is not None:
            label = f"{value:+.1f}" if metric == "delta" else f"{value:.1f}"
            draw.text(
                (x2 - 26, y + 2),
                label,
                font=FONTS["metric"],
                fill=tone if metric == "delta" else PURPLE_LIGHT,
                anchor="ra",
            )
        else:
            draw.text((x2 - 26, y + 2), "—", font=FONTS["metric"], fill=MUTED, anchor="ra")
        if metric == "delta":
            trail = format_osi_window(row)
            draw.text((x1 + 64, y + 34), trail, font=FONTS["tiny"], fill=MUTED)
        else:
            draw.text((x1 + 64, y + 36), "Offensive Strength Index", font=FONTS["tiny"], fill=MUTED)


def render_offensive_report(bundle: dict, out_dir: Path) -> list[Path]:
    image, draw = _canvas()
    _header(
        image,
        draw,
        title="OFFENSIVE REPORT",
        subtitle="Handedness leaders and short-window movement",
        date=_date_label(bundle),
    )
    offense = bundle.get("offense") or {}
    boxes = [
        (60, 270, 530, 730),
        (550, 270, 1020, 730),
        (60, 750, 530, 1265),
        (550, 750, 1020, 1265),
    ]
    _draw_rank_panel(image, draw, boxes[0], "TOP VS RIGHTIES", offense.get("vs_rhp") or [], "osi")
    _draw_rank_panel(image, draw, boxes[1], "TOP VS LEFTIES", offense.get("vs_lhp") or [], "osi")
    _draw_rank_panel(image, draw, boxes[2], "RISERS", offense.get("risers") or [], "delta")
    _draw_rank_panel(image, draw, boxes[3], "FALLERS", offense.get("fallers") or [], "delta", inverse=True)
    _footer(draw, _updated_label(bundle))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "offensive-report.png"
    image.save(path, quality=95)
    return [path]


def _market_title(category: str) -> str:
    return {"pitching": "PITCHING", "ml": "MONEYLINE", "totals": "TOTALS"}[category]


def _draw_market_panel(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    category: str,
    rows: list[dict],
) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=24, fill=PANEL, outline=BORDER, width=2)
    _metallic_text(image, (x1 + 26, y1 + 20), _market_title(category), FONTS["panel_title"])
    draw.text((x2 - 26, y1 + 27), "PUBLIC  →  SHARP", font=FONTS["small_bold"], fill=PURPLE_LIGHT, anchor="ra")
    draw.line((x1 + 26, y1 + 63, x2 - 26, y1 + 63), fill=BORDER, width=2)
    if not rows:
        draw.text(
            (x1 + 26, y1 + 95),
            "No current paired market observations.",
            font=FONTS["body"],
            fill=MUTED,
        )
        return
    for index, row in enumerate(rows[:4]):
        y = y1 + 83 + index * 92
        primary = str(row.get("selection") or row.get("market") or "")
        label = truncate(
            " · ".join(part for part in (str(row.get("game") or ""), primary) if part),
            52,
        )
        move = format_market_move(row)
        draw.text((x1 + 26, y), label or "Market observation", font=FONTS["body_bold"], fill=TEXT)
        gap = market_divergence(row)
        if gap is None:
            tone = MUTED
        else:
            tone = GREEN if gap > 0 else RED
        draw.text(
            (x2 - 26, y),
            move,
            font=FONTS["body_bold"],
            fill=tone,
            anchor="ra",
        )
        draw.text(
            (x1 + 26, y + 34),
            truncate(row.get("snapshot_time"), 36),
            font=FONTS["tiny"],
            fill=MUTED,
        )


def render_public_vs_sharp(bundle: dict, out_dir: Path) -> list[Path]:
    image, draw = _canvas()
    _header(
        image,
        draw,
        title="PUBLIC VS SHARP",
        subtitle="Largest paired, de-vigged market disagreements",
        date=_date_label(bundle),
    )
    markets = bundle.get("markets") or {}
    boxes = [
        (60, 270, 1020, 565),
        (60, 585, 1020, 880),
        (60, 900, 1020, 1265),
    ]
    for box, category in zip(boxes, ("pitching", "ml", "totals")):
        _draw_market_panel(image, draw, box, category, markets.get(category) or [])
    _footer(draw, _updated_label(bundle))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "public-vs-sharp.png"
    image.save(path, quality=95)
    return [path]


def render_reports(bundle: dict, out_dir: Path, report: str = "all") -> list[Path]:
    problems = validate_bundle(bundle, require_projections=True)
    if problems:
        raise ValueError("bundle failed validation:\n" + "\n".join(problems))
    paths: list[Path] = []
    if report in {"all", "morning-slate"}:
        paths.extend(render_morning_slate(bundle, out_dir))
    if report in {"all", "offensive-report"}:
        paths.extend(render_offensive_report(bundle, out_dir))
    if report in {"all", "public-vs-sharp"}:
        paths.extend(render_public_vs_sharp(bundle, out_dir))
    return paths
