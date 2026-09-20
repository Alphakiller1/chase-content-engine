"""This season's prior starts for skill players, from Sleeper weekly stats.

    from outputs.season_starts import duel_card, starter_lines

Used by the QB / WR / RB comparison boards: one row per start they have
taken, plus a season aggregate. Weeks that are not posted yet (TNF-only
feeds, upcoming Sunday) are skipped.
"""
from __future__ import annotations

import json
import re
import time

from outputs.content_engine import PIPELINE, _fetch

CACHE = PIPELINE / "video" / "props" / ".cache"
IDS_PATH = CACHE / "sleeper_ids.json"
ALIAS = {"WSH": "WAS", "WAS": "WSH"}


def _key(name: str) -> str:
    n = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "", name.lower())
    return re.sub(r"[^a-z]", "", n)


def _clubs(code: str) -> set[str]:
    c = str(code).upper()
    return {c, ALIAS.get(c, c)}


def _json(url: str, timeout: int = 30) -> dict:
    return json.loads(_fetch(url.replace("http://", "https://"), timeout=timeout))


def _sleeper_ids() -> dict[str, list[tuple[str, str]]]:
    if IDS_PATH.exists() and time.time() - IDS_PATH.stat().st_mtime < 7 * 86400:
        try:
            raw = json.loads(IDS_PATH.read_text(encoding="utf-8"))
            return {k: [tuple(x) for x in v] for k, v in raw.items()}
        except (OSError, ValueError):
            pass
    try:
        blob = _json("https://api.sleeper.app/v1/players/nfl", timeout=60)
    except Exception as exc:
        print(f"[season-starts] sleeper roster unavailable ({exc})")
        if IDS_PATH.exists():
            raw = json.loads(IDS_PATH.read_text(encoding="utf-8"))
            return {k: [tuple(x) for x in v] for k, v in raw.items()}
        return {}
    index: dict[str, list[tuple[str, str]]] = {}
    for pid, p in blob.items():
        if not isinstance(p, dict):
            continue
        k = _key(p.get("full_name") or "")
        if not k:
            continue
        index.setdefault(k, []).append((str(p.get("team") or "").upper(), str(pid)))
    CACHE.mkdir(parents=True, exist_ok=True)
    IDS_PATH.write_text(json.dumps(index), encoding="utf-8")
    return index


def sleeper_id(name: str, team: str | None = None) -> str | None:
    hits = _sleeper_ids().get(_key(name)) or []
    if not hits:
        return None
    if team:
        clubs = _clubs(team)
        for t, pid in hits:
            if t in clubs:
                return pid
    return hits[0][1]


def nfl_state() -> dict:
    path = CACHE / "sleeper_state.json"
    try:
        st = _json("https://api.sleeper.app/v1/state/nfl", timeout=15)
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(st), encoding="utf-8")
        return st
    except Exception as exc:
        print(f"[season-starts] nfl state unavailable ({exc})")
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {"season": "2026", "week": 2}


def _week_stats(season: int, week: int) -> dict:
    path = CACHE / f"sleeper_stats_{season}_w{week}.json"
    if path.exists() and time.time() - path.stat().st_mtime < 3 * 3600:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    try:
        data = _json(f"https://api.sleeper.app/v1/stats/nfl/regular/{season}/{week}", timeout=30)
    except Exception as exc:
        print(f"[season-starts] week {week} stats unavailable ({exc})")
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")
    return data


def _week_opponents(season: int, week: int) -> dict[str, dict]:
    """team -> {opp, home} from ESPN core short names (CIN @ HOU)."""
    path = CACHE / f"espn_week_{season}_{week}.json"
    if path.exists() and time.time() - path.stat().st_mtime < 12 * 3600:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    out: dict[str, dict] = {}
    try:
        board = _json(
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/"
            f"seasons/{season}/types/2/weeks/{week}/events?limit=20",
            timeout=20,
        )
        for it in board.get("items") or []:
            ev = _json(it["$ref"], timeout=15)
            short = str(ev.get("shortName") or "")
            if " @ " in short:
                away, home = [x.strip().upper() for x in short.split(" @ ", 1)]
            elif " vs " in short.lower():
                a, b = re.split(r"\s+vs\.?\s+", short, maxsplit=1, flags=re.I)
                away, home = a.strip().upper(), b.strip().upper()
            else:
                continue
            out[away] = {"opp": home, "home": False}
            out[home] = {"opp": away, "home": True}
            for extra in ALIAS:
                if extra in out:
                    continue
                alt = ALIAS.get(extra)
                if alt in out:
                    out[extra] = out[alt]
    except Exception as exc:
        print(f"[season-starts] week {week} opponents unavailable ({exc})")
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out), encoding="utf-8")
    return out


def _n(st: dict, *keys) -> float:
    for k in keys:
        v = st.get(k)
        if v is not None:
            return float(v)
    return 0.0


def _line(st: dict, pos: str) -> tuple[str, float]:
    if pos == "QB":
        cmp, att = int(_n(st, "pass_cmp")), int(_n(st, "pass_att"))
        yds, td, i = int(_n(st, "pass_yd")), int(_n(st, "pass_td")), int(_n(st, "pass_int"))
        bits = [f"{cmp}/{att}", f"{yds} yds", f"{td} TD"]
        if i:
            bits.append(f"{i} INT")
        return " · ".join(bits), yds
    if pos == "RB":
        att, yds = int(_n(st, "rush_att")), int(_n(st, "rush_yd"))
        rec, ryd = int(_n(st, "rec")), int(_n(st, "rec_yd"))
        td = int(_n(st, "rush_td") + _n(st, "rec_td"))
        bits = [f"{att} car", f"{yds} yds"]
        if rec:
            bits.append(f"{rec} rec · {int(ryd)} yds")
        if td:
            bits.append(f"{td} TD")
        return " · ".join(bits), yds
    rec, yds, td = int(_n(st, "rec")), int(_n(st, "rec_yd")), int(_n(st, "rec_td"))
    bits = [f"{rec} rec", f"{yds} yds"]
    if td:
        bits.append(f"{td} TD")
    return " · ".join(bits), yds


def _played(st: dict | None) -> bool:
    if not st:
        return False
    return bool(st.get("gs") or st.get("gp") or st.get("pass_att") or st.get("rush_att") or st.get("rec"))


def player_log(name: str, team: str, pos: str, season: int, through: int) -> list[dict]:
    pid = sleeper_id(name, team)
    if not pid:
        return []
    out = []
    for week in range(1, through + 1):
        st = _week_stats(season, week).get(pid) or {}
        if not _played(st):
            continue
        opp = _week_opponents(season, week).get(team.upper()) or {}
        for k in _clubs(team):
            if k in (_week_opponents(season, week) or {}):
                opp = _week_opponents(season, week)[k]
                break
        line, val = _line(st, pos)
        out.append({
            "week": week,
            "opp": opp.get("opp", ""),
            "home": bool(opp.get("home")),
            "line": line,
            "value": val,
            "stats": st,
        })
    return out


def _agg_rows(pos: str, a_log: list[dict], h_log: list[dict]) -> list[dict]:
    def tot(log, *keys):
        return sum(_n(x["stats"], *keys) for x in log)

    ga, gh = max(len(a_log), 1), max(len(h_log), 1)
    if pos == "QB":
        specs = [
            ("Pass yds", tot(a_log, "pass_yd"), tot(h_log, "pass_yd"), False),
            ("Pass TD", tot(a_log, "pass_td"), tot(h_log, "pass_td"), False),
            ("INT", tot(a_log, "pass_int"), tot(h_log, "pass_int"), True),
            ("Yds / start", tot(a_log, "pass_yd") / ga, tot(h_log, "pass_yd") / gh, False),
        ]
    elif pos == "RB":
        specs = [
            ("Rush yds", tot(a_log, "rush_yd"), tot(h_log, "rush_yd"), False),
            ("Rec yds", tot(a_log, "rec_yd"), tot(h_log, "rec_yd"), False),
            ("TD", tot(a_log, "rush_td") + tot(a_log, "rec_td"),
             tot(h_log, "rush_td") + tot(h_log, "rec_td"), False),
            ("Yds / start", tot(a_log, "rush_yd") / ga, tot(h_log, "rush_yd") / gh, False),
        ]
    else:
        specs = [
            ("Receptions", tot(a_log, "rec"), tot(h_log, "rec"), False),
            ("Rec yds", tot(a_log, "rec_yd"), tot(h_log, "rec_yd"), False),
            ("TD", tot(a_log, "rec_td"), tot(h_log, "rec_td"), False),
            ("Yds / start", tot(a_log, "rec_yd") / ga, tot(h_log, "rec_yd") / gh, False),
        ]
    rows = []
    for label, av, hv, low in specs:
        whole = label != "Yds / start"
        ad = f"{av:.0f}" if whole else f"{av:.0f}"
        hd = f"{hv:.0f}" if whole else f"{hv:.0f}"
        if label == "Yds / start":
            ad, hd = f"{av:.1f}", f"{hv:.1f}"
        rows.append({
            "label": label, "away": round(av, 1), "home": round(hv, 1),
            "awayDisplay": ad, "homeDisplay": hd, "better": "low" if low else "high",
        })
    return rows


def duel_card(away_name: str, away_team: str, home_name: str, home_team: str, pos: str) -> dict:
    """starts + season aggregate rows for a two-player comparison."""
    st = nfl_state()
    season = int(st.get("season") or 2026)
    through = int(st.get("week") or 1)
    a_log = player_log(away_name, away_team, pos, season, through)
    h_log = player_log(home_name, home_team, pos, season, through)
    weeks = sorted({x["week"] for x in a_log} | {x["week"] for x in h_log})
    by_a = {x["week"]: x for x in a_log}
    by_h = {x["week"]: x for x in h_log}
    starts = []
    for w in weeks:
        a, h = by_a.get(w), by_h.get(w)
        starts.append({
            "week": w,
            "awayOpp": (a or {}).get("opp") or "",
            "homeOpp": (h or {}).get("opp") or "",
            "awayHome": bool((a or {}).get("home")),
            "homeHome": bool((h or {}).get("home")),
            "awayLine": (a or {}).get("line") or "—",
            "homeLine": (h or {}).get("line") or "—",
            "awayVal": float((a or {}).get("value") or 0),
            "homeVal": float((h or {}).get("value") or 0),
        })
    gp = max(len(a_log), len(h_log), 0)
    return {
        "starts": starts,
        "rows": _agg_rows(pos, a_log, h_log) if a_log or h_log else [],
        "games": gp,
        "season": season,
    }


def starter_lines(name: str, team: str, pos: str) -> list[dict]:
    """Two compact facts for a player card: last start + season yards."""
    card = duel_card(name, team, name, team, pos)
    log = player_log(name, team, pos, card["season"], int(nfl_state().get("week") or 1))
    if not log:
        return []
    last = log[-1]
    vs = f"{'vs' if last['home'] else '@'} {last['opp']}" if last.get("opp") else f"W{last['week']}"
    ykey = "pass_yd" if pos == "QB" else "rush_yd" if pos == "RB" else "rec_yd"
    total = sum(_n(x["stats"], ykey) for x in log)
    return [
        {"label": f"W{last['week']} {vs}", "value": last["line"].split(" · ")[1] if " · " in last["line"] else last["line"]},
        {"label": f"{len(log)}-start yds", "value": f"{total:.0f}"},
    ]
