from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from chase_content.util import number, truncate

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


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
             "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else
             "/System/Library/Fonts/Supplemental/Arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default(size=size)


FONTS = {
    "eyebrow": _font(22, True),
    "title": _font(54, True),
    "subtitle": _font(24),
    "rank": _font(32, True),
    "team": _font(32, True),
    "score": _font(34, True),
    "body": _font(21),
    "body_bold": _font(21, True),
    "small": _font(17),
    "small_bold": _font(17, True),
    "tiny": _font(14),
    "panel_title": _font(28, True),
    "metric": _font(26, True),
}


def _canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    return image, ImageDraw.Draw(image)


def _header(
    draw: ImageDraw.ImageDraw,
    *,
    title: str,
    subtitle: str,
    date: str,
    page: str | None = None,
) -> None:
    draw.text((60, 45), "CHASE ANALYTICS", font=FONTS["eyebrow"], fill=PURPLE)
    draw.text((60, 82), title, font=FONTS["title"], fill=TEXT)
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


def _separation(probability: float | None) -> tuple[str, str]:
    pct = (probability or 0.5) * 100
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
    favorite_p = max(away_p or 0.5, home_p or 0.5)
    label, tone = _separation(favorite_p)
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
    split = bar_x1 + int(bar_width * (away_p or 0.5))
    draw.rounded_rectangle((bar_x1, bar_y, split, bar_y + 13), radius=7, fill=BLUE)
    draw.rounded_rectangle((split, bar_y, bar_x2, bar_y + 13), radius=7, fill=PURPLE)
    draw.text(
        (bar_x1, bar_y + 18),
        f"{(away_p or 0.5) * 100:.0f}% {away}",
        font=FONTS["tiny"],
        fill=MUTED,
    )
    draw.text(
        (bar_x2, bar_y + 18),
        f"{home} {(home_p or 0.5) * 100:.0f}%",
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
    games.sort(
        key=lambda game: max(
            number((game.get("projection") or {}).get("away_win_probability")) or 0.5,
            number((game.get("projection") or {}).get("home_win_probability")) or 0.5,
        ),
        reverse=True,
    )
    count = len(games)
    pages = min(3, max(1, math.ceil(count / 5)))
    per_page = math.ceil(count / pages)
    paths = []
    out_dir.mkdir(parents=True, exist_ok=True)
    for page_index in range(pages):
        page_games = games[page_index * per_page : (page_index + 1) * per_page]
        image, draw = _canvas()
        _header(
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
    draw.text((x1 + 26, y1 + 24), title, font=FONTS["panel_title"], fill=TEXT)
    draw.line((x1 + 26, y1 + 67, x2 - 26, y1 + 67), fill=BORDER, width=2)
    for index, row in enumerate(rows[:5], start=1):
        y = y1 + 88 + (index - 1) * 76
        team = str(row.get("team") or "—")
        value = number(row.get(metric))
        tone = RED if inverse and (value or 0) < 0 else GREEN if (value or 0) > 0 else MUTED
        draw.text((x1 + 26, y), str(index), font=FONTS["body_bold"], fill=PURPLE)
        draw.text((x1 + 64, y), team, font=FONTS["metric"], fill=TEXT)
        if value is not None:
            label = f"{value:+.1f}" if metric == "delta" else f"{value:.1f}"
            draw.text((x2 - 26, y + 2), label, font=FONTS["metric"], fill=tone if metric == "delta" else PURPLE_LIGHT, anchor="ra")
        if metric == "delta":
            draw.text(
                (x1 + 64, y + 34),
                f"YTD {number(row.get('osi_ytd')) or 0:.1f} → L7 {number(row.get('osi_l7')) or 0:.1f}",
                font=FONTS["tiny"],
                fill=MUTED,
            )
        else:
            draw.text((x1 + 64, y + 36), "Offensive Strength Index", font=FONTS["tiny"], fill=MUTED)


def render_offensive_report(bundle: dict, out_dir: Path) -> list[Path]:
    image, draw = _canvas()
    _header(
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
    _draw_rank_panel(draw, boxes[0], "TOP VS RIGHTIES", offense.get("vs_rhp") or [], "osi")
    _draw_rank_panel(draw, boxes[1], "TOP VS LEFTIES", offense.get("vs_lhp") or [], "osi")
    _draw_rank_panel(draw, boxes[2], "RISERS", offense.get("risers") or [], "delta")
    _draw_rank_panel(draw, boxes[3], "FALLERS", offense.get("fallers") or [], "delta", inverse=True)
    _footer(draw, _updated_label(bundle))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "offensive-report.png"
    image.save(path, quality=95)
    return [path]


def _market_title(category: str) -> str:
    return {"pitching": "PITCHING", "ml": "MONEYLINE", "totals": "TOTALS"}[category]


def _draw_market_panel(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    category: str,
    rows: list[dict],
) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=24, fill=PANEL, outline=BORDER, width=2)
    draw.text((x1 + 26, y1 + 20), _market_title(category), font=FONTS["panel_title"], fill=TEXT)
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
        public = (number(row.get("public_probability")) or 0) * 100
        sharp = (number(row.get("sharp_probability")) or 0) * 100
        divergence = (number(row.get("divergence")) or 0) * 100
        draw.text((x1 + 26, y), label or "Market observation", font=FONTS["body_bold"], fill=TEXT)
        draw.text(
            (x2 - 26, y),
            f"{public:.1f}%  →  {sharp:.1f}%   ({divergence:+.1f})",
            font=FONTS["body_bold"],
            fill=GREEN if divergence > 0 else RED,
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
        _draw_market_panel(draw, box, category, markets.get(category) or [])
    _footer(draw, _updated_label(bundle))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "public-vs-sharp.png"
    image.save(path, quality=95)
    return [path]


def render_reports(bundle: dict, out_dir: Path, report: str = "all") -> list[Path]:
    paths: list[Path] = []
    if report in {"all", "morning-slate"}:
        paths.extend(render_morning_slate(bundle, out_dir))
    if report in {"all", "offensive-report"}:
        paths.extend(render_offensive_report(bundle, out_dir))
    if report in {"all", "public-vs-sharp"}:
        paths.extend(render_public_vs_sharp(bundle, out_dir))
    return paths
