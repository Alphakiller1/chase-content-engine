"""Current-season unit form from nflverse play-by-play (not the 2025 prior).

For a Week N game this is weeks 1..N-1. After Week 1 that is the opener only.
"""
from __future__ import annotations

import time
from pathlib import Path

import pandas as pd

from outputs.content_engine import PIPELINE, _fetch

CACHE = PIPELINE / "video" / "props" / ".cache"
PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
ALIASES = {"LA": "LAR", "LAR": "LA", "WAS": "WSH", "WSH": "WAS"}

FORM_SPECS = (
    ("off_epa", "Offensive EPA Per Play", "high", "epa"),
    ("off_rush_epa", "Rush EPA Per Play", "high", "epa"),
    ("off_rush_success", "Rush Success Rate", "high", "rate"),
    ("off_rush_ypc", "Rush Yards Per Carry", "high", "ypc"),
    ("off_first_down", "Offensive First-Down Rate", "high", "rate"),
    ("off_explosive", "Offensive Explosive-Play Rate", "high", "rate"),
    ("off_sack", "Sack Rate Taken", "low", "rate"),
    ("off_turnover", "Giveaway Rate", "low", "rate"),
    ("def_epa", "EPA Allowed Per Play", "low", "epa"),
    ("def_rush_epa", "Rush EPA Allowed", "low", "epa"),
    ("def_rush_success", "Rush Success Allowed", "low", "rate"),
    ("def_rush_ypc", "Rush Yards Allowed Per Carry", "low", "ypc"),
    ("def_first_down", "First-Down Rate Allowed", "low", "rate"),
    ("def_explosive", "Explosive Rate Allowed", "low", "rate"),
    ("def_sack", "Sack Rate Generated", "high", "rate"),
    ("def_turnover", "Takeaway Rate", "high", "rate"),
)


def _codes(team: str) -> set[str]:
    t = (team or "").upper()
    return {t, ALIASES.get(t, t)}


def _pbp_path(season: int) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    return CACHE / f"play_by_play_{season}.parquet"


def load_pbp(season: int, max_age_s: int = 6 * 3600) -> pd.DataFrame:
    path = _pbp_path(season)
    if not path.exists() or time.time() - path.stat().st_mtime > max_age_s:
        path.write_bytes(_fetch(PBP_URL.format(season=season), timeout=60))
    return pd.read_parquet(path)


def _rate(frame: pd.DataFrame, mask: pd.Series, col: str) -> float:
    sub = frame.loc[mask, col].dropna()
    return float(sub.mean()) if len(sub) else float("nan")


def week_rates(season: int, through_week: int) -> dict[str, dict]:
    """32-team rates and ranks for regular-season weeks 1..through_week."""
    df = load_pbp(season)
    df = df[(df["season_type"] == "REG") & (df["week"] <= through_week) & df["posteam"].notna()]
    scrim = df[df["play_type"].isin(["pass", "run"]) & df["epa"].notna()].copy()
    if scrim.empty:
        return {}
    scrim["explosive"] = (
        ((scrim["play_type"] == "pass") | (scrim["pass"] == 1)) & (scrim["yards_gained"] >= 20)
    ) | (
        (scrim["play_type"] == "run") & (scrim["yards_gained"] >= 10)
    )
    drop = df[(df["qb_dropback"] == 1) | (df["play_type"] == "pass")].copy()

    offense = scrim.groupby("posteam").agg(
        off_epa=("epa", "mean"),
        off_first_down=("first_down", "mean"),
        off_explosive=("explosive", "mean"),
        off_turnover=("interception", "mean"),
        plays=("epa", "size"),
    )
    to = scrim.assign(to=((scrim["interception"] == 1) | (scrim["fumble_lost"] == 1)).astype(float))
    offense["off_turnover"] = to.groupby("posteam")["to"].mean()
    rush = scrim[scrim["play_type"] == "run"]
    offense["off_rush_epa"] = rush.groupby("posteam")["epa"].mean()
    offense["off_rush_success"] = rush.groupby("posteam")["success"].mean()
    offense["off_rush_ypc"] = rush.groupby("posteam")["yards_gained"].mean()
    offense["off_sack"] = drop.groupby("posteam")["sack"].mean()

    defense = scrim.groupby("defteam").agg(
        def_epa=("epa", "mean"),
        def_first_down=("first_down", "mean"),
        def_explosive=("explosive", "mean"),
        plays_def=("epa", "size"),
    )
    defense["def_turnover"] = to.groupby("defteam")["to"].mean()
    defense["def_rush_epa"] = rush.groupby("defteam")["epa"].mean()
    defense["def_rush_success"] = rush.groupby("defteam")["success"].mean()
    defense["def_rush_ypc"] = rush.groupby("defteam")["yards_gained"].mean()
    defense["def_sack"] = drop.groupby("defteam")["sack"].mean()

    table = offense.join(defense, how="outer")
    out: dict[str, dict] = {}
    ranks: dict[str, pd.Series] = {}
    for key, _label, better, _kind in FORM_SPECS:
        if key not in table.columns:
            continue
        series = table[key]
        ranks[key] = series.rank(ascending=(better == "low"), method="min")
    for team, row in table.iterrows():
        rates = {}
        for key, label, better, _kind in FORM_SPECS:
            val = row.get(key)
            if pd.isna(val):
                continue
            place = ranks[key].get(team)
            rates[key] = {
                "label": label,
                "value": float(val),
                "better": better,
                "rank": int(place) if pd.notna(place) else None,
                "of": 32,
            }
        code = str(team).upper()
        payload = {
            "rates": rates,
            "plays": float(row.get("plays") or 0),
            "pool": 32,
            "season": season,
            "through_week": through_week,
        }
        out[code] = payload
        alt = ALIASES.get(code)
        if alt:
            out[alt] = payload
    return out


def lookup(pool: dict[str, dict], team: str) -> dict | None:
    for code in _codes(team):
        if code in pool:
            return pool[code]
    return None


def overlay_week_form(g: dict, season: int, through_week: int) -> dict:
    """Replace slate prior-form with current-season PBP through `through_week`."""
    if through_week < 1:
        return g
    pool = week_rates(season, through_week)
    if not pool:
        print(f"[week-form] no PBP for {season} through week {through_week}")
        return g
    for side in ("away", "home"):
        hit = lookup(pool, g.get(side, ""))
        if hit:
            g[f"{side}_form"] = hit
    g["form_window"] = {"season": season, "through_week": through_week}
    return g
