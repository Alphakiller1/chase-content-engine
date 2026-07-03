from __future__ import annotations

from typing import Any

from chase_content.migrate import ALLOWED_OPINION_TAGS
from chase_content.util import parse_iso_date


def validate_bundle(
    bundle: dict[str, Any],
    *,
    require_projections: bool = True,
    expected_slate_date: str | None = None,
) -> list[str]:
    problems: list[str] = []
    meta = bundle.get("meta") or {}
    slate_date = parse_iso_date(meta.get("slate_date"))
    if slate_date is None:
        problems.append("meta.slate_date is missing or invalid")

    games = bundle.get("games")
    if not isinstance(games, list) or not games:
        problems.append("games must contain at least one matchup")
        return problems

    keys: set[str] = set()
    for index, game in enumerate(games):
        key = str(game.get("key") or "")
        prefix = key or f"games[{index}]"
        if not key:
            problems.append(f"{prefix}: game key is missing")
        elif key in keys:
            problems.append(f"{prefix}: duplicate game")
        keys.add(key)
        game_date = parse_iso_date(game.get("slate_date"))
        if slate_date and game_date and game_date != slate_date:
            problems.append(f"{prefix}: slate date {game_date} does not match {slate_date}")

        projection = game.get("projection") or {}
        away_probability = projection.get("away_win_probability")
        home_probability = projection.get("home_win_probability")
        if require_projections and (away_probability is None or home_probability is None):
            problems.append(f"{prefix}: model win probabilities are missing")
        if away_probability is not None and home_probability is not None:
            try:
                total = float(away_probability) + float(home_probability)
                if not 0.999 <= total <= 1.001:
                    problems.append(f"{prefix}: win probabilities sum to {total:.4f}, not 1")
            except (TypeError, ValueError):
                problems.append(f"{prefix}: win probabilities are not numeric")

        opinion = game.get("opinion") or {}
        tag = str(opinion.get("tag") or "NO OPINION").upper()
        if tag not in ALLOWED_OPINION_TAGS:
            problems.append(f"{prefix}: unsupported opinion tag {tag!r}")

    for category in ("pitching", "ml", "totals"):
        rows = ((bundle.get("markets") or {}).get(category) or [])
        for row in rows:
            observed = parse_iso_date(row.get("snapshot_time"))
            if slate_date and observed and observed != slate_date:
                problems.append(
                    f"markets.{category}: stale observation {observed} for slate {slate_date}"
                )
            try:
                public = float(row["public_probability"])
                sharp = float(row["sharp_probability"])
                if not (0 <= public <= 1 and 0 <= sharp <= 1):
                    problems.append(f"markets.{category}: probabilities must be within 0..1")
            except (KeyError, TypeError, ValueError):
                problems.append(f"markets.{category}: invalid public/sharp probability")

    if expected_slate_date and slate_date != expected_slate_date:
        problems.append(
            f"bundle slate {slate_date or 'missing'} does not match expected {expected_slate_date}"
        )
    return problems
