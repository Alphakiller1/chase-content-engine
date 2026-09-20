"""Live DraftKings lines for a game: sides, total, moneylines (opening and current)
and player props, from ESPN's public odds feed (no key, no credits).

    from outputs.live_lines import game_odds, player_props

The site's NFL slate uses ESPN event ids, so `g["id"]` from the slate is the event.
Every value carries the feed's own `lastUpdated` time; nothing is cached across
calls except athlete names (they never change mid-season).
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from outputs.content_engine import PIPELINE, _fetch

CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
DRAFTKINGS = "100"
ATHLETE_CACHE = PIPELINE / "video" / "props" / ".cache" / "espn_athletes.json"

# ESPN prop type id -> (short label, nfl-model metric key(s), group)
PROP_TYPES = {
    "8": ("Pass yards", ("passing_yards",), "passing"),
    "9": ("Completions", ("completions",), "passing"),
    "10": ("Pass TDs", ("passing_tds",), "passing"),
    "15": ("Interceptions", ("interceptions",), "passing"),
    "16": ("Pass attempts", ("pass_attempts",), "passing"),
    "12": ("Rush yards", ("rushing_yards",), "rushing"),
    "11": ("Carries", ("carries", "rush_attempts"), "rushing"),
    "13": ("Rec yards", ("receiving_yards",), "receiving"),
    "14": ("Receptions", ("receptions",), "receiving"),
    "20": ("Rush + rec yards", ("rushing_yards+receiving_yards",), "rushing"),
}


def _json(url: str) -> dict:
    return json.loads(_fetch(url, timeout=20))


def _num(s) -> float | None:
    try:
        return float(str(s).replace("+", ""))
    except (TypeError, ValueError):
        return None


def game_odds(event_id: str) -> dict | None:
    """{provider, updated, open: {...}, current: {...}} or None when no book is posted.

    Each side: spread_home (home team's number, e.g. -5.5), total, over, under,
    ml_home, ml_away (American odds).
    """
    try:
        d = _json(f"{CORE}/events/{event_id}/competitions/{event_id}/odds/{DRAFTKINGS}?lang=en&region=us")
    except Exception as exc:
        print(f"[live-lines] odds unavailable: {exc}")
        return None
    home, away = d.get("homeTeamOdds") or {}, d.get("awayTeamOdds") or {}

    def side(when: str) -> dict:
        h, a, t = home.get(when) or {}, away.get(when) or {}, d.get(when) or {}
        return {
            "spread_home": _num((h.get("pointSpread") or {}).get("american")),
            "total": _num((t.get("total") or {}).get("american")),
            "over": _num((t.get("over") or {}).get("american")),
            "under": _num((t.get("under") or {}).get("american")),
            "ml_home": _num((h.get("moneyLine") or {}).get("american")),
            "ml_away": _num((a.get("moneyLine") or {}).get("american")),
        }

    cur = side("current")
    # The top-level fields are the freshest numbers; prefer them when present.
    if d.get("spread") is not None:
        cur["spread_home"] = float(d["spread"])
    if d.get("overUnder") is not None:
        cur["total"] = float(d["overUnder"])
    if home.get("moneyLine") is not None:
        cur["ml_home"] = float(home["moneyLine"])
    if away.get("moneyLine") is not None:
        cur["ml_away"] = float(away["moneyLine"])
    if cur["spread_home"] is None and cur["total"] is None:
        return None
    return {
        "provider": (d.get("provider") or {}).get("name", "DraftKings"),
        # The feed carries no timestamp of its own: this is when we read it.
        "updated": d.get("lastUpdated") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "open": side("open"),
        "current": cur,
    }


def _athletes() -> dict:
    try:
        return json.loads(ATHLETE_CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _athlete(ref: str, cache: dict) -> dict:
    aid = re.search(r"athletes/(\d+)", ref).group(1)
    if aid not in cache:
        a = _json(ref.replace("http://", "https://"))
        cache[aid] = {
            "name": a.get("fullName") or a.get("displayName") or aid,
            "position": (a.get("position") or {}).get("abbreviation", ""),
            "team_id": re.search(r"teams/(\d+)", (a.get("team") or {}).get("$ref", "") or "teams/0").group(1),
            "headshot": (a.get("headshot") or {}).get("href"),
        }
    return {"id": aid, **cache[aid]}


def player_props(event_id: str) -> list[dict]:
    """Main-line player props: [{name, position, team_id, headshot, type, label, group,
    metric, line, open, updated}]. Milestones, scorer and period markets are skipped."""
    items, page = [], 1
    try:
        while True:
            d = _json(f"{CORE}/events/{event_id}/competitions/{event_id}/odds/{DRAFTKINGS}/propBets"
                      f"?lang=en&region=us&limit=1000&page={page}")
            items += d.get("items", [])
            if page >= d.get("pageCount", 1):
                break
            page += 1
    except Exception as exc:
        print(f"[live-lines] props unavailable: {exc}")
        return []
    cache = _athletes()
    out = []
    seen = set()  # the feed lists each market twice (over and under side)
    for it in items:
        tid = str((it.get("type") or {}).get("id"))
        if tid not in PROP_TYPES or "athlete" not in it:
            continue
        cur = ((it.get("current") or {}).get("target") or {}).get("value")
        if cur is None:
            continue
        opn = ((it.get("open") or {}).get("target") or {}).get("value")
        label, metrics, group = PROP_TYPES[tid]
        ath = _athlete(it["athlete"]["$ref"], cache)
        if (ath["id"], tid) in seen:
            continue
        seen.add((ath["id"], tid))
        out.append({**{k: ath[k] for k in ("id", "name", "position", "team_id", "headshot")},
                    "type": tid, "label": label, "group": group, "metric": metrics,
                    "line": float(cur), "open": float(opn) if opn is not None else None,
                    "updated": it.get("lastUpdated", "")})
    ATHLETE_CACHE.parent.mkdir(parents=True, exist_ok=True)
    ATHLETE_CACHE.write_text(json.dumps(cache), encoding="utf-8")
    return out


def team_id_map(event_id: str) -> dict[str, str]:
    """ESPN team id -> abbreviation for the two clubs in the event."""
    d = _json(f"{CORE}/events/{event_id}/competitions/{event_id}?lang=en&region=us")
    out = {}
    for c in d.get("competitors", []):
        t = _json(c["team"]["$ref"].replace("http://", "https://"))
        out[str(t.get("id"))] = t.get("abbreviation", "")
    return out


if __name__ == "__main__":
    import sys

    ev = sys.argv[1] if len(sys.argv) > 1 else "401872932"
    print(json.dumps(game_odds(ev), indent=1))
    props = player_props(ev)
    print(len(props), "props;", sorted({p["label"] for p in props}))
    print(team_id_map(ev))
