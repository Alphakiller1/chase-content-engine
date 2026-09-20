"""Each club's previous game, from ESPN's public box score: passing, rushing and
defense, with the leading players (and their headshots).

    from outputs.last_game import last_game_items
"""
from __future__ import annotations

import json

from outputs.content_engine import _fetch
from outputs.video_studio import headshot

SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"


def _json(url: str) -> dict:
    return json.loads(_fetch(url, timeout=20).decode("utf-8"))


def _stat(team: dict, name: str, default: str = "") -> str:
    for s in team.get("statistics", []):
        if s.get("name") == name:
            return s.get("displayValue", default)
    return default


def _players(box: dict, team_id: str, category: str) -> tuple[list[str], list[dict]]:
    for t in box.get("players", []):
        if str(t["team"]["id"]) != team_id:
            continue
        for cat in t.get("statistics", []):
            if cat.get("name") == category:
                return cat.get("labels", []), cat.get("athletes", [])
    return [], []


def _row(labels: list[str], stats: list[str]) -> dict:
    return dict(zip(labels, stats))


def _num(s: str) -> float:
    try:
        return float(str(s).split("/")[0].split("-")[0])
    except ValueError:
        return 0.0


def previous_event(team_id: str, before_event: str, season: int) -> str | None:
    sched = _json(f"{SITE}/teams/{team_id}/schedule?season={season}")
    done = [e for e in sched.get("events", [])
            if e["competitions"][0]["status"]["type"].get("completed") and str(e["id"]) != str(before_event)]
    if not done:
        # First game of the season: fall back to the end of last season.
        sched = _json(f"{SITE}/teams/{team_id}/schedule?season={season - 1}")
        done = [e for e in sched.get("events", []) if e["competitions"][0]["status"]["type"].get("completed")]
    return str(done[-1]["id"]) if done else None


def _person(a: dict, line: str, stats: list[dict], position: str = "") -> dict:
    ath = a["athlete"]
    return {
        "name": ath.get("displayName", ""),
        "position": position or (ath.get("position") or {}).get("abbreviation", ""),
        "headshot": headshot((ath.get("headshot") or {}).get("href")),
        "line": line,
        "stats": stats,
    }


def last_game_items(a, g: dict) -> list[tuple[str, str, dict]]:
    event = str(g.get("id") or "")
    if not event:
        return []
    season = int(str(g.get("kickoff_utc", "2026"))[:4])
    comp = _json(f"{SITE}/summary?event={event}")["header"]["competitions"][0]
    ids = {c["team"]["abbreviation"]: str(c["team"]["id"]) for c in comp["competitors"]}
    items = []
    for side in ("away", "home"):
        team = g[side].upper()
        tid = ids.get(team)
        if not tid:
            continue
        prev = previous_event(tid, event, season)
        if not prev:
            continue
        summ = _json(f"{SITE}/summary?event={prev}")
        box = summ["boxscore"]
        hcomp = summ["header"]["competitions"][0]
        me = next(c for c in hcomp["competitors"] if str(c["team"]["id"]) == tid)
        opp = next(c for c in hcomp["competitors"] if str(c["team"]["id"]) != tid)
        mine = next(t for t in box["teams"] if str(t["team"]["id"]) == tid)
        theirs = next(t for t in box["teams"] if str(t["team"]["id"]) != tid)
        my_pts, opp_pts = int(me.get("score", 0) or 0), int(opp.get("score", 0) or 0)
        result = "W" if my_pts > opp_pts else "L" if my_pts < opp_pts else "T"
        week = (summ["header"].get("week") or "")
        base = {
            "league": "nfl", "team": team, "teamName": g.get(f"{side}_name", team),
            "opponent": opp["team"]["abbreviation"], "home": me.get("homeAway") == "home",
            "result": result, "score": f"{my_pts}–{opp_pts}",
            "week": f"Week {week}" if week else "Last game",
            "eyebrow": f"{a.tag} · {team} last game",
        }

        # passing
        labels, rows = _players(box, tid, "passing")
        qb = rows[0] if rows else None
        rl, recs = _players(box, tid, "receiving")
        recs = sorted(recs, key=lambda x: -_num(_row(rl, x["stats"]).get("YDS", 0)))[:1]
        people = []
        if qb:
            r = _row(labels, qb["stats"])
            people.append(_person(qb, f"{r.get('C/ATT')} · {r.get('YDS')} yds", [
                {"label": "TD", "value": r.get("TD", "0")}, {"label": "INT", "value": r.get("INT", "0")},
                {"label": "Rating", "value": r.get("RTG", "")}], "QB"))
        for x in recs:
            r = _row(rl, x["stats"])
            people.append(_person(x, f"{r.get('REC')} rec · {r.get('YDS')} yds", [
                {"label": "TD", "value": r.get("TD", "0")}, {"label": "Targets", "value": r.get("TGTS", "")},
                {"label": "Long", "value": r.get("LONG", "")}]))
        rush_labels, rush_rows = _players(box, tid, "rushing")
        rush_rows = sorted(rush_rows, key=lambda x: -_num(_row(rush_labels, x["stats"]).get("YDS", 0)))
        if rush_rows:
            x = rush_rows[0]
            r = _row(rush_labels, x["stats"])
            people.append(_person(x, f"{r.get('CAR')} car · {r.get('YDS')} yds", [
                {"label": "Avg", "value": r.get("AVG", "")}, {"label": "TD", "value": r.get("TD", "0")},
                {"label": "Long", "value": r.get("LONG", "")}]))
        def_labels, def_rows = _players(box, tid, "defensive")

        def weight(x):
            r = _row(def_labels, x["stats"])
            return -(_num(r.get("TOT", 0)) + 4 * _num(r.get("SACKS", 0)) + 2 * _num(r.get("TFL", 0)) + _num(r.get("QB HTS", 0)))
        if def_rows:
            x = sorted(def_rows, key=weight)[0]
            r = _row(def_labels, x["stats"])
            people.append(_person(x, f"{r.get('TOT')} tackles", [
                {"label": "Sacks", "value": r.get("SACKS", "0")}, {"label": "TFL", "value": r.get("TFL", "0")},
                {"label": "QB hits", "value": r.get("QB HTS", "0")}]))
        _il, ints = _players(box, tid, "interceptions")
        items.append((f"last-{team.lower()}", "LastGame", {
            **base, "view": "Recap", "title": "Last Time Out",
            "tiles": [
                {"label": "Comp / Att", "value": _stat(mine, "completionAttempts")},
                {"label": "Net pass yds", "value": _stat(mine, "netPassingYards")},
                {"label": "Rush yards", "value": _stat(mine, "rushingYards")},
                {"label": "Total yards", "value": _stat(mine, "totalYards")},
                {"label": "Points allowed", "value": str(opp_pts)},
                {"label": "Takeaways", "value": _stat(theirs, "turnovers")},
            ],
            "people": people[:3],
            "extra": [f"{x['athlete']['displayName']} INT" for x in ints][:3]}))
    return items
