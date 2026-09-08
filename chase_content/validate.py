from __future__ import annotations

from typing import Any

from chase_content.migrate import ALLOWED_OPINION_TAGS
from chase_content.util import number, parse_iso_date, unit_probability

_DIVERGENCE_TOLERANCE = 1e-3


def _require_probability(value: object, prefix: str, label: str, problems: list[str]) -> float | None:
    parsed = unit_probability(value)
    if parsed is None:
        problems.append(f"{prefix}: {label} must be a finite probability in 0..1")
    return parsed


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
        away_runs = number(projection.get("away_runs"))
        home_runs = number(projection.get("home_runs"))
        if require_projections:
            if away_probability is None or home_probability is None:
                problems.append(f"{prefix}: model win probabilities are missing")
            if away_runs is None or home_runs is None:
                problems.append(f"{prefix}: projected runs are missing")
        parsed_away = None
        parsed_home = None
        if away_probability is not None:
            parsed_away = _require_probability(
                away_probability, prefix, "away win probability", problems
            )
        if home_probability is not None:
            parsed_home = _require_probability(
                home_probability, prefix, "home win probability", problems
            )
        if parsed_away is not None and parsed_home is not None:
            total = parsed_away + parsed_home
            if not 0.999 <= total <= 1.001:
                problems.append(f"{prefix}: win probabilities sum to {total:.4f}, not 1")

        opinion = game.get("opinion") or {}
        tag = str(opinion.get("tag") or "NO OPINION").upper()
        if tag not in ALLOWED_OPINION_TAGS:
            problems.append(f"{prefix}: unsupported opinion tag {tag!r}")

    for category in ("pitching", "ml", "totals"):
        rows = ((bundle.get("markets") or {}).get(category) or [])
        for index, row in enumerate(rows):
            prefix = f"markets.{category}[{index}]"
            observed = parse_iso_date(row.get("snapshot_time"))
            if observed is None:
                problems.append(f"{prefix}: observation timestamp is missing or invalid")
            elif slate_date and observed != slate_date:
                problems.append(
                    f"{prefix}: stale observation {observed} for slate {slate_date}"
                )
            public = _require_probability(
                row.get("public_probability"), prefix, "public probability", problems
            )
            sharp = _require_probability(
                row.get("sharp_probability"), prefix, "sharp probability", problems
            )
            if public is not None and sharp is not None:
                derived = sharp - public
                raw_div = row.get("divergence")
                if raw_div is not None and raw_div != "":
                    supplied = number(raw_div)
                    if supplied is None:
                        problems.append(f"{prefix}: divergence is not a finite number")
                    elif abs(supplied - derived) > _DIVERGENCE_TOLERANCE:
                        problems.append(
                            f"{prefix}: divergence {supplied} does not match "
                            f"sharp-public {derived:.4f}"
                        )

    if expected_slate_date and slate_date != expected_slate_date:
        problems.append(
            f"bundle slate {slate_date or 'missing'} does not match expected {expected_slate_date}"
        )
    return problems
