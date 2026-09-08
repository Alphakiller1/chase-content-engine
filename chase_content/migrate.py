from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Any

from chase_content.util import (
    find_file,
    first_present_number,
    game_key,
    integer,
    number,
    parse_iso_date,
    read_csv,
    read_json,
    utc_now,
)

ALLOWED_OPINION_TAGS = {"MY BET", "LEAN", "WATCH", "PASS", "NO OPINION"}


def _top_offenses(rows: list[dict], limit: int = 5) -> list[dict]:
    ranked = []
    for row in rows:
        team = str(row.get("Tm") or row.get("team") or "").strip().upper()
        osi = number(row.get("OSI") if "OSI" in row else row.get("osi"))
        if not team or osi is None:
            continue
        ranked.append(
            {
                "team": team,
                "osi": round(osi, 1),
                "abq": number(row.get("ABQ") if "ABQ" in row else row.get("abq")),
                "rcv": number(row.get("RCV") if "RCV" in row else row.get("rcv")),
                "obr": number(row.get("OBR") if "OBR" in row else row.get("obr")),
                "wrc_plus": first_present_number(row, "wRC+", "wrc_plus"),
            }
        )
    return sorted(ranked, key=lambda row: row["osi"], reverse=True)[:limit]


def _trajectory(rows: list[dict], limit: int = 5) -> tuple[list[dict], list[dict]]:
    scored = []
    for row in rows:
        team = str(row.get("team") or row.get("Tm") or "").strip().upper()
        ytd = number(row.get("osi_ytd"))
        recent = number(row.get("osi_l7"))
        if not team or ytd is None or recent is None:
            continue
        scored.append(
            {
                "team": team,
                "osi_ytd": round(ytd, 1),
                "osi_l7": round(recent, 1),
                "delta": round(recent - ytd, 1),
            }
        )
    scored.sort(key=lambda row: row["delta"], reverse=True)
    return scored[:limit], list(reversed(scored[-limit:]))


def load_pipeline(pipeline_data: Path) -> dict:
    matchups = read_csv(find_file(pipeline_data, "today_matchups.csv"))
    rhp = read_csv(find_file(pipeline_data, "metrics_vs_RHP.csv", "vs_RHP.csv"))
    lhp = read_csv(find_file(pipeline_data, "metrics_vs_LHP.csv", "vs_LHP.csv"))
    profiles = read_csv(find_file(pipeline_data, "team_profiles.csv", "Team_Profiles.csv"))
    risers, fallers = _trajectory(profiles)

    games = []
    for row in matchups:
        away = str(row.get("Away") or "").strip().upper()
        home = str(row.get("Home") or "").strip().upper()
        if not away or not home:
            continue
        slate_date = parse_iso_date(row.get("Slate_Date"))
        games.append(
            {
                "key": game_key(away, home),
                "game_pk": integer(row.get("MLB_Game_PK") or row.get("Game_PK")),
                "slate_date": slate_date,
                "time": str(row.get("Time") or "TBD"),
                "away": away,
                "home": home,
                "away_pitcher": {
                    "name": str(row.get("Away_SP") or "TBD"),
                    "hand": str(row.get("Away_Hand") or ""),
                },
                "home_pitcher": {
                    "name": str(row.get("Home_SP") or "TBD"),
                    "hand": str(row.get("Home_Hand") or ""),
                },
                "lineup_status": str(row.get("Lineup_Status") or "projected").lower(),
            }
        )

    dates = {game["slate_date"] for game in games if game["slate_date"]}
    return {
        "slate_date": next(iter(dates)) if len(dates) == 1 else None,
        "games": games,
        "offense": {
            "vs_rhp": _top_offenses(rhp),
            "vs_lhp": _top_offenses(lhp),
            "risers": risers,
            "fallers": fallers,
        },
    }


def _projection(value: dict | None, key: str) -> float | None:
    raw = (value or {}).get(key)
    if isinstance(raw, dict):
        raw = raw.get("proj") if "proj" in raw else raw.get("mean")
    parsed = number(raw)
    return round(parsed, 1) if parsed is not None else None


def load_model(model_repo: Path, pipeline_data: Path, games: list[dict]) -> dict[str, dict]:
    """Use MLB Model's public APIs without duplicating its projection logic."""
    repo_path = str(model_repo.resolve())
    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)
    importlib.invalidate_caches()

    from mlbmodel.baseball import DataRepository, model_probabilities
    from mlbmodel.props import build_pitcher_board

    repository = DataRepository(pipeline_data)
    anchors = repository.anchors()
    pitcher_rows = build_pitcher_board(repository)
    pitcher_index = {
        (
            str(row.get("team") or "").upper(),
            str(row.get("pitcher") or row.get("name") or "").strip().casefold(),
        ): row
        for row in pitcher_rows
    }

    results: dict[str, dict] = {}
    for base in games:
        gd = repository.load_game(base["away"], base["home"])
        probs = model_probabilities(gd, anchors)

        def pitcher(side: str) -> dict:
            team = getattr(gd, side)
            name = getattr(gd, f"{side}_sp")
            row = pitcher_index.get((team, name.strip().casefold()), {})
            props = row.get("projections") or row.get("props") or {}
            outs = _projection(props, "Outs")
            return {
                "name": name,
                "hand": getattr(gd, f"{side}_hand"),
                "projected_ip": round(outs / 3, 1) if outs is not None else None,
                "projected_er": _projection(props, "ER"),
                "projected_k": _projection(props, "K"),
                "confidence": row.get("confidence"),
            }

        favorite_probability = max(probs.p_away_win, probs.p_home_win)
        results[base["key"]] = {
            "game_pk": gd.mlb_game_pk or gd.game_pk,
            "projection": {
                "away_runs": probs.exp_away_runs,
                "home_runs": probs.exp_home_runs,
                "away_win_probability": probs.p_away_win,
                "home_win_probability": probs.p_home_win,
                "favorite": gd.away if probs.p_away_win > probs.p_home_win else gd.home,
                "favorite_probability": favorite_probability,
                "confidence": probs.confidence,
                "coverage_pct": probs.data_coverage_pct,
            },
            "away_pitcher": pitcher("away"),
            "home_pitcher": pitcher("home"),
        }
    return results


def _market_category(value: Any) -> str | None:
    market = str(value or "").strip().lower()
    if any(token in market for token in ("pitcher", "strikeout", "outs", "earned_run")):
        return "pitching"
    if market in {"ml", "h2h", "moneyline"} or "moneyline" in market:
        return "ml"
    if "total" in market:
        return "totals"
    return None


def load_sharp(path: Path | None, slate_date: str | None) -> dict[str, list[dict]]:
    result = {"pitching": [], "ml": [], "totals": []}
    if path is None:
        return result
    payload = read_json(path)
    rows = payload.get("signals") or payload.get("sharp_signals_recent") or []
    for row in rows:
        category = _market_category(row.get("category") or row.get("market_type"))
        if category is None:
            continue
        timestamp = str(row.get("snapshot_time") or row.get("generated_at") or "")
        observed_date = parse_iso_date(timestamp)
        if slate_date and observed_date and observed_date != slate_date:
            continue
        sharp = first_present_number(row, "sharp_probability", "sharp_novig_prob")
        public = first_present_number(row, "public_probability", "soft_novig_prob")
        if sharp is None or public is None:
            continue
        result[category].append(
            {
                "game_pk": integer(row.get("game_pk")),
                "game": str(row.get("game") or ""),
                "market": str(row.get("market") or row.get("market_type") or ""),
                "selection": str(row.get("selection") or ""),
                "line": row.get("line"),
                "sharp_probability": round(sharp, 4),
                "public_probability": round(public, 4),
                "divergence": round(sharp - public, 4),
                "snapshot_time": timestamp,
            }
        )
    for category in result:
        result[category].sort(key=lambda row: abs(row["divergence"]), reverse=True)
    return result


def load_model_markets(
    model_repo: Path,
    cache_dir: Path,
    slate_date: str | None,
) -> dict[str, list[dict]]:
    """Read MLB Model's paired, de-vigged game and pitcher-prop cache outputs."""
    repo_path = str(model_repo.resolve())
    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)
    importlib.invalidate_caches()

    from mlbmodel.market.props import load_prop_board
    from mlbmodel.market.quotes import load_board

    result = {"pitching": [], "ml": [], "totals": []}
    board = load_board(fetch=False, cache_path=cache_dir / "odds_latest.json")
    for (game, market, selection, line), quote in board.quotes.items():
        category = _market_category(market)
        if category not in {"ml", "totals"}:
            continue
        observed_date = parse_iso_date(quote.fetched_at)
        if slate_date and observed_date and observed_date != slate_date:
            continue
        if quote.sharp_probability is None or quote.soft_probability is None:
            continue
        result[category].append(
            {
                "game_pk": None,
                "game": game,
                "market": market,
                "selection": selection,
                "line": line,
                "sharp_probability": quote.sharp_probability,
                "public_probability": quote.soft_probability,
                "divergence": round(
                    quote.sharp_probability - quote.soft_probability, 4
                ),
                "snapshot_time": quote.fetched_at,
                "best_odds": quote.best_odds,
                "best_book": quote.best_book,
                "source": "mlb-model",
            }
        )

    prop_board = load_prop_board(
        fetch=False,
        cache_path=cache_dir / "prop_odds_latest.json",
    )
    for quote in prop_board.quotes:
        observed_date = parse_iso_date(quote.fetched_at)
        if slate_date and observed_date and observed_date != slate_date:
            continue
        if quote.sharp_probability is None or quote.soft_probability is None:
            continue
        result["pitching"].append(
            {
                "game_pk": None,
                "game": quote.game,
                "market": quote.prop,
                "selection": f"{quote.player} {quote.side} {quote.line:g}",
                "line": quote.line,
                "sharp_probability": quote.sharp_probability,
                "public_probability": quote.soft_probability,
                "divergence": round(
                    quote.sharp_probability - quote.soft_probability, 4
                ),
                "snapshot_time": quote.fetched_at,
                "best_odds": quote.best_odds,
                "best_book": quote.best_book,
                "source": "mlb-model",
            }
        )

    for category in result:
        result[category].sort(key=lambda row: abs(row["divergence"]), reverse=True)
    return result


def _merge_market_sources(primary: dict, fallback: dict) -> dict:
    return {
        category: (primary.get(category) or fallback.get(category) or [])
        for category in ("pitching", "ml", "totals")
    }


def load_opinions(path: Path | None) -> dict:
    if path is None:
        return {}
    payload = read_json(path)
    cleaned = {}
    for key, value in payload.items():
        tag = str((value or {}).get("tag") or "NO OPINION").strip().upper()
        if tag not in ALLOWED_OPINION_TAGS:
            raise ValueError(f"{key}: unsupported opinion tag {tag!r}")
        cleaned[str(key).upper()] = {
            "tag": tag,
            "text": str((value or {}).get("text") or "").strip(),
            "source": "personal",
        }
    return cleaned


def migrate(
    *,
    pipeline_data: Path,
    model_repo: Path | None = None,
    sharp_json: Path | None = None,
    opinions: Path | None = None,
) -> dict:
    pipeline = load_pipeline(pipeline_data)
    games = pipeline["games"]
    model = load_model(model_repo, pipeline_data, games) if model_repo else {}
    opinion_map = load_opinions(opinions)

    for game in games:
        projection = model.get(game["key"], {})
        if projection:
            game.update(projection)
        game["opinion"] = opinion_map.get(
            game["key"],
            {"tag": "NO OPINION", "text": "", "source": "personal"},
        )

    generated_at = utc_now()
    slate_date = pipeline["slate_date"]
    legacy_markets = load_sharp(sharp_json, slate_date)
    model_markets = (
        load_model_markets(model_repo, pipeline_data, slate_date)
        if model_repo
        else {"pitching": [], "ml": [], "totals": []}
    )
    return {
        "meta": {
            "slate_date": slate_date,
            "generated_at": generated_at,
            "run_id": f"{slate_date or 'unknown'}::{generated_at}",
            "sources": {
                "pipeline_data": str(pipeline_data.resolve()),
                "model_repo": str(model_repo.resolve()) if model_repo else None,
                "sharp_json": str(sharp_json.resolve()) if sharp_json else None,
                "opinions": str(opinions.resolve()) if opinions else None,
            },
        },
        "games": games,
        "offense": pipeline["offense"],
        "markets": _merge_market_sources(model_markets, legacy_markets),
    }
