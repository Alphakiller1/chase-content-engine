from __future__ import annotations

import datetime as dt
import math
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw

from chase_content.render import (
    BORDER,
    FONTS,
    GOLD,
    GREEN,
    MUTED,
    PANEL,
    PURPLE,
    RED,
    TEXT,
    _canvas,
    _header,
    _metallic_text,
)
from chase_content.site import find_game, validate_site_bundle
from chase_content.util import number, truncate


SITE_REPORTS = ("all", "mlb-live-slate", "nfl-weekly", "nfl-matchup")
_HEADSHOTS: dict[str, Image.Image | None] = {}


def _date_time(raw: object, *, date: bool = False) -> str:
    try:
        stamp = dt.datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        local = stamp.astimezone(ZoneInfo("America/New_York"))
    except (TypeError, ValueError):
        return "Time unavailable"
    clock = local.strftime("%I:%M %p ET").lstrip("0")
    if date:
        return f"{local.strftime('%a, %b %d').replace(' 0', ' ')} · {clock}"
    return clock


def _rank_tone(rank: object, total: object) -> str:
    try:
        percentile = 1 - ((int(rank) - 1) / max(1, int(total) - 1))
    except (TypeError, ValueError):
        return MUTED
    if percentile >= 2 / 3:
        return GREEN
    if percentile >= 1 / 3:
        return GOLD
    return RED


def _segments(draw: ImageDraw.ImageDraw, x: int, y: int, width: int, rank: object, total: object) -> None:
    count, gap = 10, 4
    cell = (width - gap * (count - 1)) / count
    try:
        score = 1 - ((int(rank) - 1) / max(1, int(total) - 1))
        active = max(1, min(count, round(score * count)))
    except (TypeError, ValueError):
        active = 0
    tone = _rank_tone(rank, total)
    for index in range(count):
        x1 = int(x + index * (cell + gap))
        draw.rectangle((x1, y, int(x1 + cell), y + 10), fill=tone if index < active else BORDER)


def _save(image: Image.Image, out_dir: Path, name: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / name
    image.save(path, quality=95)
    return path


def _site_updated(bundle: dict, sport: str) -> str:
    return str(((bundle.get("sports") or {}).get(sport) or {}).get("generated_at_utc") or "")


def _site_footer(draw: ImageDraw.ImageDraw, bundle: dict, sport: str) -> None:
    draw.line((60, 1294, 1020, 1294), fill=BORDER, width=2)
    updated = _site_updated(bundle, sport).replace("T", " ") or "unknown"
    draw.text((60, 1315), f"Published evidence · Updated {updated}", font=FONTS["tiny"], fill=MUTED)
    draw.text((1020, 1315), "chase-analytics.com", font=FONTS["tiny"], fill=PURPLE, anchor="ra")


def render_mlb_live_slate(bundle: dict, out_dir: Path) -> list[Path]:
    games = list(bundle["sports"]["mlb"]["games"])
    pages = max(1, math.ceil(len(games) / 5))
    paths: list[Path] = []
    for page in range(pages):
        image, draw = _canvas()
        _header(image, draw, title="MLB MATCHUPS", subtitle="Today’s starters, lineups and game context", date=_date_time(games[0].get("kickoff_utc"), date=True).split(" · ")[0], page=f"{page + 1} / {pages}")
        y = 260
        for game in games[page * 5 : page * 5 + 5]:
            box = (60, y, 1020, y + 184)
            draw.rounded_rectangle(box, radius=18, fill=PANEL, outline=BORDER, width=2)
            draw.text((82, y + 18), f"{game.get('away', '—')}  @  {game.get('home', '—')}", font=FONTS["team"], fill=TEXT)
            draw.text((998, y + 23), _date_time(game.get("kickoff_utc")), font=FONTS["small_bold"], fill=GOLD, anchor="ra")
            draw.text((82, y + 62), truncate(game.get("away_starter") or "Starter unavailable", 24), font=FONTS["body_bold"], fill=TEXT)
            draw.text((548, y + 62), truncate(game.get("home_starter") or "Starter unavailable", 24), font=FONTS["body_bold"], fill=TEXT)
            away_era = game.get("away_era")
            home_era = game.get("home_era")
            draw.text((82, y + 94), f"{game.get('away_hand') or '—'}HP · ERA {away_era if away_era not in (None, '') else '—'}", font=FONTS["small"], fill=MUTED)
            draw.text((548, y + 94), f"{game.get('home_hand') or '—'}HP · ERA {home_era if home_era not in (None, '') else '—'}", font=FONTS["small"], fill=MUTED)
            status = f"Lineups: {game.get('away_lineup_state') or 'unknown'} / {game.get('home_lineup_state') or 'unknown'}"
            draw.text((82, y + 135), status, font=FONTS["small_bold"], fill=GREEN if "Confirmed" in status else GOLD)
            draw.text((998, y + 137), truncate(game.get("conditions") or "Conditions unavailable", 42), font=FONTS["tiny"], fill=MUTED, anchor="ra")
            y += 198
        _site_footer(draw, bundle, "mlb")
        paths.append(_save(image, out_dir, f"mlb-live-slate-{page + 1:02d}.png"))
    return paths


def _qb(game: dict, side: str) -> str:
    lineup = (game.get(f"{side}_lineups") or {}).get("offense") or {}
    for player in lineup.get("players") or []:
        if player.get("position") == "QB":
            return str(player.get("name") or "QB unavailable")
    return "QB unavailable"


def render_nfl_weekly(bundle: dict, out_dir: Path) -> list[Path]:
    nfl = bundle["sports"]["nfl"]
    games = list(nfl["games"])
    paths: list[Path] = []
    weeks: dict[int | None, list[dict]] = {}
    for game in games:
        weeks.setdefault(game.get("week"), []).append(game)
    for week, week_games in weeks.items():
        pages = max(1, math.ceil(len(week_games) / 4))
        for page in range(pages):
            image, draw = _canvas()
            _header(image, draw, title=f"NFL WEEK {week or '—'}", subtitle="Matchups in chronological order", date=str(nfl.get("season") or "Season unavailable"), page=f"{page + 1} / {pages}")
            y = 265
            for game in week_games[page * 4 : page * 4 + 4]:
                draw.rounded_rectangle((60, y, 1020, y + 225), radius=18, fill=PANEL, outline=BORDER, width=2)
                draw.text((82, y + 18), f"{game.get('away', '—')}  @  {game.get('home', '—')}", font=FONTS["team"], fill=TEXT)
                draw.text((998, y + 23), _date_time(game.get("kickoff_utc"), date=True), font=FONTS["small_bold"], fill=GOLD, anchor="ra")
                draw.text((82, y + 67), f"{game.get('away_name') or game.get('away')}  {game.get('away_record') or '—'}", font=FONTS["body_bold"], fill=TEXT)
                draw.text((548, y + 67), f"{game.get('home_name') or game.get('home')}  {game.get('home_record') or '—'}", font=FONTS["body_bold"], fill=TEXT)
                draw.text((82, y + 101), f"QB · {_qb(game, 'away')}", font=FONTS["small"], fill=MUTED)
                draw.text((548, y + 101), f"QB · {_qb(game, 'home')}", font=FONTS["small"], fill=MUTED)
                draw.text((82, y + 145), str(game.get("away_availability") or "Availability pending"), font=FONTS["small_bold"], fill=GOLD)
                draw.text((548, y + 145), str(game.get("home_availability") or "Availability pending"), font=FONTS["small_bold"], fill=GOLD)
                draw.text((82, y + 184), truncate(game.get("venue") or "Venue unavailable", 38), font=FONTS["tiny"], fill=MUTED)
                draw.text((998, y + 184), str(game.get("game_state") or "unknown").upper(), font=FONTS["tiny"], fill=GREEN if game.get("game_state") == "final" else PURPLE, anchor="ra")
                y += 241
            _site_footer(draw, bundle, "nfl")
            paths.append(_save(image, out_dir, f"nfl-week-{week or 'unknown'}-{page + 1:02d}.png"))
    return paths


def _status_index(game: dict, side: str) -> dict[str, str]:
    return {str(row.get("name") or "").casefold(): str(row.get("status") or "Active") for row in game.get(f"{side}_availability_list") or []}


def _lineup_column(draw: ImageDraw.ImageDraw, game: dict, side: str, x: int, y: int) -> None:
    label = game.get(f"{side}_name") or game.get(side) or side
    draw.rounded_rectangle((x, y, x + 460, y + 930), radius=20, fill=PANEL, outline=BORDER, width=2)
    _metallic_text(draw._image, (x + 22, y + 18), truncate(label, 24), FONTS["panel_title"])
    status = _status_index(game, side)
    cursor = y + 72
    for unit in ("offense", "defense"):
        data = ((game.get(f"{side}_lineups") or {}).get(unit) or {})
        draw.text((x + 22, cursor), f"{unit.upper()} · {data.get('package') or 'PACKAGE UNAVAILABLE'}", font=FONTS["small_bold"], fill=PURPLE)
        cursor += 31
        for player in (data.get("players") or [])[:11]:
            designation = status.get(str(player.get("name") or "").casefold(), "Active")
            tone = GREEN if designation.casefold() == "active" else (RED if "out" in designation.casefold() or "reserve" in designation.casefold() else GOLD)
            draw.text((x + 22, cursor), str(player.get("position") or "—"), font=FONTS["tiny"], fill=MUTED)
            draw.text((x + 67, cursor), truncate(player.get("name") or "Unknown player", 22), font=FONTS["small_bold"], fill=TEXT)
            draw.text((x + 438, cursor), designation.upper(), font=FONTS["tiny"], fill=tone, anchor="ra")
            cursor += 31
        cursor += 15


def _overview_page(bundle: dict, game: dict, out_dir: Path) -> Path:
    image, draw = _canvas()
    _header(image, draw, title=f"{game.get('away')} @ {game.get('home')}", subtitle="Starting units and official availability", date=_date_time(game.get("kickoff_utc"), date=True))
    _lineup_column(draw, game, "away", 60, 260)
    _lineup_column(draw, game, "home", 560, 260)
    _site_footer(draw, bundle, "nfl")
    return _save(image, out_dir, f"nfl-{game.get('away')}-{game.get('home')}-01-lineups.png")


_COVERAGE = (("man_rate", "Man", "pass_epa_man"), ("zone_rate", "Zone", "pass_epa_zone"), ("cover_0_rate", "Cover 0", "pass_epa_cover_0"), ("cover_1_rate", "Cover 1", "pass_epa_cover_1"), ("cover_2_rate", "Cover 2", "pass_epa_cover_2"), ("cover_3_rate", "Cover 3", "pass_epa_cover_3"), ("cover_4_rate", "Cover 4", "pass_epa_cover_4"), ("cover_6_rate", "Cover 6", "pass_epa_cover_6"))


def _scheme_half(draw: ImageDraw.ImageDraw, game: dict, off_side: str, x: int, y: int) -> None:
    def_side = "home" if off_side == "away" else "away"
    offense = ((game.get(f"{off_side}_scheme") or {}).get("offense") or {})
    defense_root = game.get(f"{def_side}_scheme") or {}
    defense = defense_root.get("defense") or {}
    ranks = (((defense_root.get("league_frequency_ranks") or {}).get("defense") or {}).get("coverage") or {})
    draw.rounded_rectangle((x, y, x + 460, y + 905), radius=20, fill=PANEL, outline=BORDER, width=2)
    title = f"{game.get(off_side)} OFFENSE vs {game.get(def_side)} DEFENSE"
    _metallic_text(draw._image, (x + 20, y + 18), title, FONTS["panel_title"])
    draw.text((x + 20, y + 59), "DEFENSIVE FREQUENCY · OFFENSIVE EPA/PLAY", font=FONTS["tiny"], fill=MUTED)
    cursor = y + 94
    for rate_key, label, epa_key in _COVERAGE:
        rate = number((defense.get("coverage") or {}).get(rate_key))
        epa = number((offense.get("response") or {}).get(epa_key))
        rank = ranks.get(rate_key) or {}
        draw.text((x + 20, cursor), label, font=FONTS["small_bold"], fill=TEXT)
        _segments(draw, x + 112, cursor + 7, 205, rank.get("place"), rank.get("of"))
        rate_text = f"{rate * 100:.1f}%" if rate is not None else "—"
        epa_text = f"{epa:+.3f}" if epa is not None else "—"
        draw.text((x + 334, cursor), rate_text, font=FONTS["tiny"], fill=_rank_tone(rank.get("place"), rank.get("of")))
        draw.text((x + 438, cursor), epa_text, font=FONTS["small_bold"], fill=GREEN if epa is not None and epa > 0 else (RED if epa is not None and epa < 0 else MUTED), anchor="ra")
        cursor += 53
    cursor += 10
    draw.text((x + 20, cursor), "PRESSURE CONFRONTATIONS", font=FONTS["small_bold"], fill=PURPLE)
    cursor += 38
    pressure_ranks = (((defense_root.get("league_frequency_ranks") or {}).get("defense") or {}).get("pressure") or {})
    pressure = defense.get("pressure") or {}
    response = offense.get("response") or {}
    for key, label, response_key in (("blitz_rate", "Blitz", "pass_epa_blitz"), ("pressure_rate", "Pressure", "pass_epa_pressure"), ("stacked_box_rate", "Stacked Box", "rush_epa_stacked_box")):
        rate = number(pressure.get(key))
        epa = number(response.get(response_key))
        rank = pressure_ranks.get(key) or {}
        draw.text((x + 20, cursor), label, font=FONTS["small_bold"], fill=TEXT)
        _segments(draw, x + 135, cursor + 7, 180, rank.get("place"), rank.get("of"))
        draw.text((x + 333, cursor), f"{rate * 100:.1f}%" if rate is not None else "—", font=FONTS["tiny"], fill=_rank_tone(rank.get("place"), rank.get("of")))
        draw.text((x + 438, cursor), f"{epa:+.3f}" if epa is not None else "—", font=FONTS["small_bold"], fill=GREEN if epa is not None and epa > 0 else (RED if epa is not None and epa < 0 else MUTED), anchor="ra")
        cursor += 55


def _scheme_page(bundle: dict, game: dict, out_dir: Path) -> Path:
    image, draw = _canvas()
    _header(image, draw, title="SCHEME CONFRONTATION", subtitle="Defensive tendency beside the offense’s observed response", date=f"{game.get('away')} @ {game.get('home')}")
    _scheme_half(draw, game, "away", 60, 260)
    _scheme_half(draw, game, "home", 560, 260)
    _site_footer(draw, bundle, "nfl")
    return _save(image, out_dir, f"nfl-{game.get('away')}-{game.get('home')}-02-scheme.png")


def _overall_split(profile: dict) -> dict:
    return next((row for row in profile.get("splits") or [] if str(row.get("coverage") or row.get("look") or "").lower() == "all"), {})


def _position_profile(game: dict, side: str, position: str) -> dict | None:
    sources = game.get(f"{side}_player_scheme") or []
    if position == "WR":
        sources = game.get(f"{side}_player_coverage") or []
    return next((row for row in sources if row.get("position") == position), None)


def _headshot_url(game: dict, side: str, name: object) -> str | None:
    target = str(name or "").casefold()
    lineups = game.get(f"{side}_lineups") or {}
    for unit in ("offense", "defense"):
        for player in (lineups.get(unit) or {}).get("players") or []:
            if str(player.get("name") or "").casefold() == target:
                return player.get("headshot_url")
    return None


def _paste_headshot(image: Image.Image, url: str | None, x: int, y: int) -> bool:
    if not url:
        return False
    if url not in _HEADSHOTS:
        try:
            request = Request(url, headers={"User-Agent": "chase-content-engine/0.2"})
            with urlopen(request, timeout=10) as response:  # noqa: S310 - published image URL
                source = Image.open(BytesIO(response.read())).convert("RGBA")
            source.thumbnail((64, 64), Image.Resampling.LANCZOS)
            _HEADSHOTS[url] = source.copy()
        except Exception:
            _HEADSHOTS[url] = None
    headshot = _HEADSHOTS[url]
    if headshot is None:
        return False
    image.paste(headshot, (x, y), headshot)
    return True


def _player_card(image: Image.Image, draw: ImageDraw.ImageDraw, game: dict, side: str, position: str, x: int, y: int) -> None:
    profile = _position_profile(game, side, position)
    draw.rounded_rectangle((x, y, x + 460, y + 225), radius=18, fill=PANEL, outline=BORDER, width=2)
    draw.text((x + 20, y + 17), f"{game.get(side)} · {position}", font=FONTS["small_bold"], fill=PURPLE)
    if not profile:
        draw.text((x + 20, y + 70), "Published split unavailable", font=FONTS["body"], fill=MUTED)
        return
    name = profile.get("player_name") or "Unknown"
    has_shot = _paste_headshot(image, _headshot_url(game, side, name), x + 18, y + 43)
    draw.text((x + (92 if has_shot else 20), y + 49), truncate(name, 22), font=FONTS["panel_title"], fill=TEXT)
    season = profile.get("source_season")
    draw.text((x + 438, y + 19), f"{season or '—'} EVIDENCE", font=FONTS["tiny"], fill=MUTED, anchor="ra")
    overall = _overall_split(profile)
    if position == "QB":
        metrics = (("Dropbacks", overall.get("dropbacks"), None), ("Y/A", overall.get("yards_per_attempt"), "yards_per_attempt"), ("EPA/DB", overall.get("epa_per_dropback"), "epa_per_dropback"))
    elif position == "RB":
        metrics = (("Carries", overall.get("carries"), None), ("YPC", overall.get("yards_per_carry"), "yards_per_carry"), ("EPA/ATT", overall.get("epa_per_carry"), "epa_per_carry"))
    else:
        metrics = (("Targets", overall.get("targets"), None), ("Y/T", overall.get("yards_per_target"), "yards_per_target"), ("EPA/T", overall.get("epa_per_target"), "epa_per_target"))
    ranks = overall.get("league_ranks") or {}
    for idx, (label, value, rank_key) in enumerate(metrics):
        mx = x + 20 + idx * 145
        draw.text((mx, y + 105), label, font=FONTS["tiny"], fill=MUTED)
        rank = ranks.get(rank_key) or {}
        tone = _rank_tone(rank.get("place"), rank.get("of")) if rank_key else TEXT
        shown = "—" if value is None else (f"{value:+.3f}" if "EPA" in label else (f"{value:.2f}" if isinstance(value, float) else str(value)))
        draw.text((mx, y + 132), shown, font=FONTS["metric"], fill=tone)
        if rank:
            draw.text((mx, y + 170), f"{rank.get('place')} of {rank.get('of')}", font=FONTS["tiny"], fill=tone)


def _players_page(bundle: dict, game: dict, out_dir: Path) -> Path:
    image, draw = _canvas()
    _header(image, draw, title="SKILL PLAYERS BY SCHEME", subtitle="QB, RB and WR production with position-pool ranks", date=f"{game.get('away')} @ {game.get('home')}")
    y = 260
    for position in ("QB", "RB", "WR"):
        _player_card(image, draw, game, "away", position, 60, y)
        _player_card(image, draw, game, "home", position, 560, y)
        y += 245
    draw.text((60, 1015), "Green / yellow / red reflect relative position-pool rank. Missing evidence stays —.", font=FONTS["small"], fill=MUTED)
    _site_footer(draw, bundle, "nfl")
    return _save(image, out_dir, f"nfl-{game.get('away')}-{game.get('home')}-03-players.png")


def _form_page(bundle: dict, game: dict, out_dir: Path) -> Path:
    image, draw = _canvas()
    _header(image, draw, title="TEAM FORM", subtitle="Mirrored league ranks on one comparison scale", date=f"{game.get('away')} @ {game.get('home')}")
    away = ((game.get("away_form") or {}).get("rates") or {})
    home = ((game.get("home_form") or {}).get("rates") or {})
    draw.rounded_rectangle((60, 260, 1020, 1155), radius=20, fill=PANEL, outline=BORDER, width=2)
    draw.text((82, 282), str(game.get("away_name") or game.get("away")), font=FONTS["body_bold"], fill=TEXT)
    draw.text((998, 282), str(game.get("home_name") or game.get("home")), font=FONTS["body_bold"], fill=TEXT, anchor="ra")
    y = 338
    for key in ("off_epa", "off_first_down", "off_explosive", "off_sack", "off_turnover", "def_epa", "def_first_down", "def_explosive", "def_sack", "def_turnover"):
        a, h = away.get(key) or {}, home.get(key) or {}
        label = a.get("label") or h.get("label") or key.replace("_", " ").title()
        at = _rank_tone(a.get("rank"), a.get("of"))
        ht = _rank_tone(h.get("rank"), h.get("of"))
        draw.text((82, y), f"{a.get('rank', '—')} / {a.get('of', '—')}", font=FONTS["small_bold"], fill=at)
        _segments(draw, 165, y + 7, 235, a.get("rank"), a.get("of"))
        draw.text((540, y), truncate(label, 28).upper(), font=FONTS["tiny"], fill=MUTED, anchor="ma")
        _segments(draw, 680, y + 7, 235, h.get("rank"), h.get("of"))
        draw.text((998, y), f"{h.get('rank', '—')} / {h.get('of', '—')}", font=FONTS["small_bold"], fill=ht, anchor="ra")
        y += 76
    draw.text((82, 1122), "All meters use red, yellow, and green rank bands; direction honors each metric’s better=high/low definition.", font=FONTS["tiny"], fill=MUTED)
    _site_footer(draw, bundle, "nfl")
    return _save(image, out_dir, f"nfl-{game.get('away')}-{game.get('home')}-04-form.png")


def render_nfl_matchup(bundle: dict, out_dir: Path, game_spec: str) -> list[Path]:
    game = find_game(bundle, "nfl", game_spec)
    return [
        _overview_page(bundle, game, out_dir),
        _scheme_page(bundle, game, out_dir),
        _players_page(bundle, game, out_dir),
        _form_page(bundle, game, out_dir),
    ]


def render_site_reports(bundle: dict, out_dir: Path, report: str, game_spec: str | None = None) -> list[Path]:
    problems = validate_site_bundle(bundle)
    if problems:
        raise ValueError("site bundle failed validation:\n" + "\n".join(problems))
    if report not in SITE_REPORTS:
        raise ValueError(f"unknown site report {report!r}")
    paths: list[Path] = []
    if report in {"all", "mlb-live-slate"}:
        paths.extend(render_mlb_live_slate(bundle, out_dir))
    if report in {"all", "nfl-weekly"}:
        paths.extend(render_nfl_weekly(bundle, out_dir))
    if report == "nfl-matchup":
        if not game_spec:
            raise ValueError("nfl-matchup requires --game AWAY@HOME or a game id")
        paths.extend(render_nfl_matchup(bundle, out_dir, game_spec))
    return paths
