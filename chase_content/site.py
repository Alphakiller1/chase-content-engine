from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen


PUBLIC_PATHS = {
    "mlb_slate": "data/public/mlb/slate.json",
    "nfl_slate": "data/public/nfl/slate.json",
    "nfl_team_context": "data/public/nfl/team_context.json",
}


def _read_source(path: str, *, site_root: Path | None, site_base: str | None) -> dict:
    if site_root is not None:
        return json.loads((site_root / path).read_text(encoding="utf-8"))
    if not site_base:
        raise ValueError("site_root or site_base is required")
    url = urljoin(site_base.rstrip("/") + "/", path)
    request = Request(url, headers={"User-Agent": "chase-content-engine/0.2"})
    with urlopen(request, timeout=30) as response:  # noqa: S310 - explicit user-configured source
        return json.loads(response.read().decode("utf-8"))


def _iso(value: Any) -> dt.datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def _game_week(game: dict) -> int | None:
    raw = game.get("week")
    if raw is None:
        raw = (game.get("scheme_source") or {}).get("week")
    try:
        week = int(raw)
    except (TypeError, ValueError):
        return None
    return week if week > 0 else None


def _sorted_games(payload: dict, sport: str) -> list[dict]:
    games = []
    for original in payload.get("games") or []:
        game = dict(original)
        game["sport"] = sport
        if sport == "nfl":
            game["week"] = _game_week(game)
        games.append(game)
    return sorted(games, key=lambda game: (_iso(game.get("kickoff_utc")) or dt.datetime.max.replace(tzinfo=dt.timezone.utc), str(game.get("id") or "")))


def load_site_bundle(*, site_root: Path | None = None, site_base: str | None = None) -> dict:
    """Load the same public contracts consumed by chase-analytics.com.

    The adapter preserves published nested evidence instead of recalculating metrics.
    That keeps the content engine downstream of the website's data contract and avoids
    creating a second source of truth for rankings, lineups, or scheme splits.
    """
    if bool(site_root) == bool(site_base):
        raise ValueError("provide exactly one of site_root or site_base")
    mlb = _read_source(PUBLIC_PATHS["mlb_slate"], site_root=site_root, site_base=site_base)
    nfl = _read_source(PUBLIC_PATHS["nfl_slate"], site_root=site_root, site_base=site_base)
    nfl_context = _read_source(
        PUBLIC_PATHS["nfl_team_context"], site_root=site_root, site_base=site_base
    )
    source = str(site_root.resolve()) if site_root else site_base.rstrip("/")
    return {
        "schema": "chase-content-site/2",
        "meta": {
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": source,
            "contracts": dict(PUBLIC_PATHS),
        },
        "sports": {
            "mlb": {
                "schema": mlb.get("schema"),
                "generated_at_utc": mlb.get("generated_at_utc"),
                "data_through_utc": mlb.get("data_through_utc"),
                "games": _sorted_games(mlb, "mlb"),
            },
            "nfl": {
                "schema": nfl.get("schema"),
                "generated_at_utc": nfl.get("generated_at_utc"),
                "data_through_utc": nfl.get("data_through_utc"),
                "season": nfl_context.get("season"),
                "current_week": nfl_context.get("week"),
                "games": _sorted_games(nfl, "nfl"),
                "team_context": nfl_context,
            },
        },
    }


def validate_site_bundle(
    bundle: dict,
    *,
    max_age_hours: float | None = None,
    now: dt.datetime | None = None,
) -> list[str]:
    problems: list[str] = []
    if bundle.get("schema") != "chase-content-site/2":
        problems.append("schema must be chase-content-site/2")
    now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc)
    sports = bundle.get("sports") or {}
    for sport in ("mlb", "nfl"):
        section = sports.get(sport) or {}
        if section.get("schema") != "chase-public-slate/1":
            problems.append(f"{sport}: source schema must be chase-public-slate/1")
        generated = _iso(section.get("generated_at_utc"))
        through = _iso(section.get("data_through_utc"))
        if generated is None:
            problems.append(f"{sport}: generated timestamp is missing or invalid")
        elif generated > now + dt.timedelta(minutes=5):
            problems.append(f"{sport}: generated timestamp is in the future")
        if through is None:
            problems.append(f"{sport}: data-through timestamp is missing or invalid")
        elif through > now + dt.timedelta(minutes=5):
            problems.append(f"{sport}: data-through timestamp is in the future")
        if max_age_hours is not None and through is not None:
            age = (now - through).total_seconds() / 3600
            if age > max_age_hours:
                problems.append(f"{sport}: data is {age:.1f}h old (limit {max_age_hours:g}h)")
        games = section.get("games") or []
        if not games:
            problems.append(f"{sport}: slate contains no games")
        seen: set[str] = set()
        for index, game in enumerate(games):
            prefix = f"{sport}.games[{index}]"
            game_id = str(game.get("id") or "").strip()
            if not game_id:
                problems.append(f"{prefix}: id is missing")
            elif game_id in seen:
                problems.append(f"{prefix}: duplicate id {game_id}")
            seen.add(game_id)
            if not game.get("away") or not game.get("home"):
                problems.append(f"{prefix}: away/home identity is missing")
            if _iso(game.get("kickoff_utc")) is None:
                problems.append(f"{prefix}: kickoff_utc is missing or invalid")
            if game.get("sport") != sport:
                problems.append(f"{prefix}: sport identity does not match {sport}")
    return problems


def find_game(bundle: dict, sport: str, game_spec: str) -> dict:
    target = game_spec.strip().upper()
    for game in ((bundle.get("sports") or {}).get(sport, {}).get("games") or []):
        key = f"{game.get('away', '')}@{game.get('home', '')}".upper()
        if target in {str(game.get("id") or "").upper(), key}:
            return game
    raise ValueError(f"{sport} game {game_spec!r} is not in the public slate")
