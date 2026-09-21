"""Data-driven studio graphics for a game pack: formations, player cards, stat boards.

Called from outputs.video_pack.build_nfl. Everything comes from the site's own NFL
slate record (chase-analytics.com /data/public/nfl/slate.json), so the video shows
what the matchup page shows:

    <side>_lineups     ESPN depth-chart starters by unit, with package + headshots
    <side>_availability_list   the injury report
    <side>_players     depth-ranked skill players with headshots
    <side>_form        opponent-adjusted unit rates with league ranks
    <side>_scheme      coverage / pressure / personnel tendencies + frequency ranks

Headshots are downloaded into video/public/players/ (gitignored) so renders and the
recording booth never wait on, or break with, a remote image host.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import time
from pathlib import Path

from outputs.content_engine import PIPELINE, _fetch
from outputs.week_form import FORM_SPECS

PLAYERS_DIR = PIPELINE / "video" / "public" / "players"
FACE_INDEX = PIPELINE / "video" / "props" / ".cache" / "sleeper_faces.json"

OFFENSE_POS = {"QB", "RB", "FB", "WR", "TE", "OT", "OL", "G", "C", "T", "LT", "LG", "RG", "RT"}

NFL_TEAM_ALIAS = {"WSH": "WAS", "WAS": "WSH"}


def club_keys(code: str) -> set[str]:
    c = str(code).upper()
    return {c, NFL_TEAM_ALIAS.get(c, c)}


def club_get(d: dict, code: str, default=None):
    c = str(code).upper()
    if c in d:
        return d[c]
    alt = NFL_TEAM_ALIAS.get(c)
    return d.get(alt, default) if alt else default

SHELL_LABEL = {
    "cover_0_rate": "Cover 0",
    "cover_1_rate": "Cover 1",
    "cover_2_rate": "Cover 2",
    "cover_3_rate": "Cover 3",
    "cover_4_rate": "Cover 4",
    "cover_6_rate": "Cover 6",
}

# Mini-field dots (x 8-92, y 14-48). LOS is y=52 in the graphic.
COVER_DOTS = {
    "Cover 0": [
        (18, 46, "DE"), (38, 46, "DT"), (62, 46, "DT"), (82, 46, "DE"),
        (28, 36, "LB"), (50, 34, "LB"), (72, 36, "LB"),
        (10, 30, "CB"), (90, 30, "CB"), (34, 28, "S"), (66, 28, "S"),
    ],
    "Cover 1": [
        (18, 46, "DE"), (38, 46, "DT"), (62, 46, "DT"), (82, 46, "DE"),
        (28, 36, "LB"), (50, 34, "MLB"), (72, 36, "LB"),
        (10, 28, "CB"), (90, 28, "CB"), (50, 16, "FS"), (62, 30, "SS"),
    ],
    "Cover 2": [
        (18, 46, "DE"), (38, 46, "DT"), (62, 46, "DT"), (82, 46, "DE"),
        (32, 34, "LB"), (68, 34, "LB"),
        (12, 26, "CB"), (88, 26, "CB"),
        (28, 14, "S"), (72, 14, "S"), (50, 32, "LB"),
    ],
    "Cover 3": [
        (18, 46, "DE"), (38, 46, "DT"), (62, 46, "DT"), (82, 46, "DE"),
        (32, 34, "LB"), (68, 34, "LB"),
        (12, 18, "CB"), (88, 18, "CB"), (50, 14, "FS"),
        (22, 32, "NB"), (78, 32, "SS"),
    ],
    "Cover 4": [
        (20, 46, "DE"), (40, 46, "DT"), (60, 46, "DT"), (80, 46, "DE"),
        (35, 34, "LB"), (65, 34, "LB"),
        (14, 16, "CB"), (38, 14, "S"), (62, 14, "S"), (86, 16, "CB"),
        (50, 32, "LB"),
    ],
    "Cover 6": [
        (18, 46, "DE"), (38, 46, "DT"), (62, 46, "DT"), (82, 46, "DE"),
        (32, 34, "LB"), (68, 34, "LB"),
        (12, 16, "CB"), (32, 18, "S"), (78, 14, "S"), (88, 22, "CB"),
        (50, 32, "LB"),
    ],
}

PERSONNEL_DOTS = {
    "11": [
        (22, 46, "LT"), (36, 46, "LG"), (50, 46, "C"), (64, 46, "RG"), (78, 46, "RT"),
        (50, 36, "QB"), (62, 32, "RB"), (88, 42, "TE"),
        (10, 40, "WR"), (90, 22, "WR"), (18, 22, "WR"),
    ],
    "12": [
        (22, 46, "LT"), (36, 46, "LG"), (50, 46, "C"), (64, 46, "RG"), (78, 46, "RT"),
        (50, 36, "QB"), (62, 30, "RB"), (88, 42, "TE"), (12, 42, "TE"),
        (10, 22, "WR"), (90, 22, "WR"),
    ],
    "21": [
        (22, 46, "LT"), (36, 46, "LG"), (50, 46, "C"), (64, 46, "RG"), (78, 46, "RT"),
        (50, 34, "QB"), (62, 28, "RB"), (38, 30, "FB"), (88, 42, "TE"),
        (10, 22, "WR"), (90, 22, "WR"),
    ],
}


def _alignment(g: dict, side: str, unit: str) -> str:
    if unit != "offense":
        return "mixed"
    rate = ((g.get(f"{side}_scheme") or {}).get("offense") or {}).get("personnel") or {}
    shotgun = float(rate.get("formation_shotgun_rate") or 0)
    if shotgun >= 0.58:
        return "shotgun"
    if shotgun <= 0.42:
        return "under-center"
    return "mixed"


def _dots(pairs: list[tuple]) -> list[dict]:
    return [{"x": x, "y": y, "role": role} for x, y, role in pairs]


def _dominant_shell(cov: dict) -> tuple[str, float]:
    best, val = "Cover 3", 0.0
    for key, label in SHELL_LABEL.items():
        v = float(cov.get(key) or 0)
        if v > val:
            best, val = label, v
    return best, val


def _qb_face(g: dict, team: str, q: dict | None) -> dict:
    name = (q or {}).get("player_name") or g.get("away_starter" if g["away"].upper() == team else "home_starter", "QB")
    side = "away" if g["away"].upper() == team else "home"
    face = None
    status, detail = "Active", ""
    for p in g.get(f"{side}_players") or []:
        if p.get("position") == "QB" and (p.get("depth_rank") == 1 or _key(p.get("name", "")) == _key(name)):
            face = headshot(p.get("headshot_url"))
            name = p["name"]
            break
    if not face:
        for p in ((g.get(f"{side}_lineups") or {}).get("offense") or {}).get("players", []):
            if p.get("position") == "QB":
                face = headshot(p.get("headshot_url"))
                name = p["name"]
                break
    st = _status_map(g, side).get(_key(name))
    if st:
        status, detail = st.get("status") or status, st.get("detail") or ""
    return {
        "name": name, "team": team, "teamName": g.get(f"{side}_name", team),
        "headshot": face, "status": status, "detail": detail, "position": "QB",
    }


def team_compare_item(a, g: dict, ta: dict, th: dict, bg: dict, spread: str, total: str,
                      model_margin: float, model_total: float, kickoff: str = "") -> tuple[str, str, dict]:
    away, home = g["away"].upper(), g["home"].upper()

    def side(code: str, t: dict, form: dict, score: float) -> dict:
        rates = (g.get(f"{'away' if code == away else 'home'}_form") or {}).get("rates") or {}
        off = rates.get("off_epa") or {}
        de = rates.get("def_epa") or {}
        rest = g.get("away_rest_days" if code == away else "home_rest_days")
        travel = g.get("away_travel" if code == away else "home_travel") or ""
        return {
            "abbr": code,
            "name": g.get("away_name" if code == away else "home_name", code),
            "record": g.get("away_record" if code == away else "home_record", ""),
            "rating": f"{float(t.get('rating', 0)):.2f}",
            "rank": t.get("rank"),
            "rankOf": 32,
            "rest": f"{rest} days" if rest is not None else "",
            "travel": travel,
            "offEpa": _epa(float(off.get("value", 0))) if off else "—",
            "offEpaRank": off.get("rank"),
            "defEpa": _epa(float(de.get("value", 0))) if de else "—",
            "defEpaRank": de.get("rank"),
            "score": f"{score:.1f}",
        }

    lead = home if model_margin >= 0 else away
    return ("clubs", "TeamCompare", {
        "league": "nfl", "away": away, "home": home,
        "awayName": g.get("away_name", away), "homeName": g.get("home_name", home),
        "eyebrow": f"{a.tag} · Clubs",
        "title": "The Two Clubs",
        "kickoff": kickoff,
        "network": g.get("broadcast", ""),
        "spread": spread, "total": total,
        "modelLine": f"{lead} by {abs(model_margin):.1f} · {model_total:.1f}",
        "awaySide": side(away, ta, {}, float(bg.get("projected_away_score", 0))),
        "homeSide": side(home, th, {}, float(bg.get("projected_home_score", 0))),
        "note": "Power rating and EPA are opponent-adjusted (nfl-model, research only). Rest and travel from the site slate.",
    })


def qb_matchup_item(a, g: dict, qa: dict | None, qh: dict | None) -> tuple[str, str, dict] | None:
    if not qa or not qh:
        return None
    from outputs.season_starts import duel_card
    away, home = g["away"].upper(), g["home"].upper()
    ma, mh = qa["metrics"], qh["metrics"]
    card = duel_card(qa["player_name"], away, qh["player_name"], home, "QB")
    rows = card["rows"] or [
        {"label": "Pass yards", "away": round(ma["passing_yards"], 1), "home": round(mh["passing_yards"], 1),
         "awayDisplay": f"{ma['passing_yards']:.1f}", "homeDisplay": f"{mh['passing_yards']:.1f}", "better": "high"},
        {"label": "Pass TDs", "away": round(ma["passing_tds"], 2), "home": round(mh["passing_tds"], 2),
         "awayDisplay": f"{ma['passing_tds']:.2f}", "homeDisplay": f"{mh['passing_tds']:.2f}", "better": "high"},
    ]
    gp = card["games"]
    note = (
        f"{gp or 0} start{'s' if gp != 1 else ''} this season, then the aggregate. "
        f"This game's model: {qa['player_name'].split(' ')[-1]} {ma['passing_yards']:.0f} pass yds · "
        f"{qh['player_name'].split(' ')[-1]} {mh['passing_yards']:.0f}."
    )
    return ("qb-matchup", "QbMatchup", {
        "league": "nfl", "away": away, "home": home,
        "eyebrow": f"{a.tag} · Quarterbacks",
        "title": f"{qa['player_name'].split(' ')[-1]} vs {qh['player_name'].split(' ')[-1]}",
        "awayQb": _qb_face(g, away, qa),
        "homeQb": _qb_face(g, home, qh),
        "rows": rows,
        "starts": card["starts"],
        "note": note,
    })


def _skill_face(g: dict, team: str, p: dict) -> dict:
    side = "away" if g["away"].upper() == team else "home"
    name = p.get("name") or ""
    st = _status_map(g, side).get(_key(name)) or {}
    return {
        "name": name, "team": team, "teamName": g.get(f"{side}_name", team),
        "headshot": headshot(p.get("headshot_url") or face_url(name, team)),
        "status": st.get("status") or "Active", "detail": st.get("detail") or "",
        "position": p.get("position") or "",
    }


def skill_duel_items(a, g: dict) -> list[tuple[str, str, dict]]:
    """WR1 vs WR1 and RB1 vs RB1: same board as the QB duel, with this season's starts."""
    from outputs.season_starts import duel_card
    away, home = g["away"].upper(), g["home"].upper()
    items = []
    for pos, key, label in (("WR", "wr-matchup", "Wideouts"), ("RB", "rb-matchup", "Running backs")):
        pa = next((p for p in (g.get("away_players") or [])
                   if p.get("position") == pos and p.get("depth_rank") == 1), None)
        ph = next((p for p in (g.get("home_players") or [])
                   if p.get("position") == pos and p.get("depth_rank") == 1), None)
        if not pa or not ph:
            continue
        card = duel_card(pa["name"], away, ph["name"], home, pos)
        if not card["starts"] and not card["rows"]:
            continue
        gp = card["games"]
        items.append((key, "QbMatchup", {
            "league": "nfl", "away": away, "home": home,
            "eyebrow": f"{a.tag} · {label}",
            "title": f"{pa['name'].split(' ')[-1]} vs {ph['name'].split(' ')[-1]}",
            "awayQb": _skill_face(g, away, pa),
            "homeQb": _skill_face(g, home, ph),
            "rows": card["rows"],
            "starts": card["starts"],
            "note": f"{gp or 0} start{'s' if gp != 1 else ''} this season and the aggregate.",
        }))
    return items


def scheme_diagram_items(a, g: dict) -> list[tuple[str, str, dict]]:
    away, home = g["away"].upper(), g["home"].upper()
    sa, sh = g.get("away_scheme") or {}, g.get("home_scheme") or {}
    if not sa or not sh:
        return []

    def look(side: str, scheme: dict, view: str) -> dict:
        team = g[side].upper()
        defense = (scheme.get("defense") or {})
        offense = (scheme.get("offense") or {})
        cov = defense.get("coverage") or {}
        pers = offense.get("personnel") or {}
        press = defense.get("pressure") or {}
        shell, rate = _dominant_shell(cov)
        packs = [
            {"code": "11", "label": "11 · 3 WR", "rate": float(pers.get("personnel_11_rate") or 0)},
            {"code": "12", "label": "12 · 2 TE", "rate": float(pers.get("personnel_12_rate") or 0)},
            {"code": "21", "label": "21 · FB", "rate": float(pers.get("personnel_21_rate") or 0)},
        ]
        packs.sort(key=lambda p: -p["rate"])
        top = packs[0]["code"] if packs else "11"
        dots = COVER_DOTS.get(shell, COVER_DOTS["Cover 3"]) if view == "coverage" else PERSONNEL_DOTS.get(top, PERSONNEL_DOTS["11"])
        return {
            "team": team, "teamName": g.get(f"{side}_name", team),
            "shell": shell, "shellRate": f"{rate * 100:.0f}%",
            "shotgun": _pct(float(pers.get("formation_shotgun_rate") or 0)),
            "motion": _pct(float(pers.get("motion_rate") or 0)),
            "blitz": _pct(float(press.get("blitz_rate") or 0)),
            "personnel": packs,
            "dots": _dots(dots),
        }

    base = {"league": "nfl", "away": away, "home": home,
            "awayName": g.get("away_name", away), "homeName": g.get("home_name", home),
            "note": f"Illustrated from charted tendencies. {charting_note(g)}"}
    return [
        ("scheme-cover", "SchemeDiagram", {
            **base, "view": "coverage", "eyebrow": f"{a.tag} · Scheme",
            "title": "How They Cover",
            "awayLook": look("away", sa, "coverage"), "homeLook": look("home", sh, "coverage")}),
        ("scheme-pack", "SchemeDiagram", {
            **base, "view": "personnel", "eyebrow": f"{a.tag} · Scheme",
            "title": "How They Line Up",
            "awayLook": look("away", sa, "personnel"), "homeLook": look("home", sh, "personnel")}),
    ]


def _scheme_unit(scheme: dict, unit: str, bucket: str) -> dict:
    return ((scheme or {}).get(unit) or {}).get(bucket) or {}


def _ord(n: int | None) -> str:
    if not n:
        return ""
    v = n % 100
    suf = "th" if 10 <= v <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


def _z_rank(value, dist: dict | None, invert: bool = False) -> int | None:
    """Approximate 1-32 rank from league mean/std. invert=True when low is better (defense EPA allowed)."""
    if value is None or not isinstance(dist, dict):
        return None
    try:
        mean, std = float(dist["mean"]), float(dist["std"])
    except (KeyError, TypeError, ValueError):
        return None
    if std <= 0:
        return None
    z = (float(value) - mean) / std
    p = 0.5 * (1 + math.erf(z / math.sqrt(2.0)))
    if invert:
        p = 1 - p
    return max(1, min(32, int(round(1 + (1 - p) * 31))))


def _cell(v) -> dict:
    if v is None:
        return {"value": None, "display": "—", "rank": None, "of": 32, "vsAvg": ""}
    n = float(v)
    return {"value": n, "display": _epa(n), "rank": None, "of": 32, "vsAvg": ""}


def _epa_stat(value, dist: dict | None, invert: bool = False) -> dict:
    cell = _cell(value)
    cell["rank"] = _z_rank(value, dist, invert)
    if value is not None and isinstance(dist, dict) and dist.get("mean") is not None:
        gap = float(value) - float(dist["mean"])
        cell["vsAvg"] = f"{gap:+.2f} vs NFL"
    return cell


def _rate_stat(value, dist: dict | None, invert: bool = False) -> dict:
    if value is None:
        return {"value": None, "display": "—", "rank": None, "of": 32, "vsAvg": ""}
    n = float(value)
    return {
        "value": n,
        "display": _pct(n),
        "rank": _z_rank(n, dist, invert),
        "of": 32,
        "vsAvg": "",
    }


def _form_stat(g: dict, side: str, key: str) -> dict:
    r = ((g.get(f"{side}_form") or {}).get("rates") or {}).get(key) or {}
    if not r or r.get("value") is None:
        return {"value": None, "display": "—", "rank": None, "of": 32, "label": ""}
    fmt = _epa if "epa" in key else (lambda v: f"{v:.1f}") if "ypc" in key else _pct
    return {
        "value": float(r["value"]),
        "display": fmt(float(r["value"])),
        "rank": r.get("rank"),
        "of": r.get("of") or 32,
        "label": r.get("label") or key,
    }


def _freq_rank(scheme: dict, unit: str, cat: str, key: str) -> int | None:
    place = ((((scheme.get("league_frequency_ranks") or {}).get(unit) or {}).get(cat) or {}).get(key) or {}).get("place")
    return int(place) if place else None


def clash_items(a, g: dict, qa: dict | None = None, qh: dict | None = None) -> list[tuple[str, str, dict]]:
    """One graphic per possession so pass/run can be read at broadcast size."""
    sa, sh = g.get("away_scheme") or {}, g.get("home_scheme") or {}
    if not sa or not sh:
        return []
    away, home = g["away"].upper(), g["home"].upper()
    q_by_side = {"away": qa, "home": qh}

    def possession(off_side: str, def_side: str) -> dict:
        off_s = g.get(f"{off_side}_scheme") or {}
        def_s = g.get(f"{def_side}_scheme") or {}
        off_r = _scheme_unit(off_s, "offense", "response")
        def_r = _scheme_unit(def_s, "defense", "response")
        off_lg = (off_s.get("league_response") or {}).get("offense") or {}
        def_lg = (def_s.get("league_response") or {}).get("defense") or {}
        off_team = g[off_side].upper()
        def_team = g[def_side].upper()
        qb = q_by_side.get(off_side) or {}
        yds = None
        try:
            yds = float((qb.get("metrics") or {}).get("passing_yards"))
        except (TypeError, ValueError):
            yds = None
        qb_name = (qb.get("player_name") or "").split(" ")[-1]
        return {
            "title": f"When {off_team} has the ball",
            "offense": off_team,
            "defense": def_team,
            "offenseName": g.get(f"{off_side}_name", off_team),
            "defenseName": g.get(f"{def_side}_name", def_team),
            "lanes": [
                {
                    "id": "pass",
                    "title": "Pass success rate",
                    "hero": _rate_stat(off_r.get("pass_success_rate"), off_lg.get("pass_success_rate")),
                    "heroLabel": "Pass success rate",
                    "yards": (
                        {"display": f"{yds:.0f}", "label": f"{qb_name} proj. yds"} if yds else None
                    ),
                    "offEpa": _epa_stat(off_r.get("pass_epa"), off_lg.get("pass_epa")),
                    "defEpa": _epa_stat(def_r.get("pass_epa"), def_lg.get("pass_epa"), invert=True),
                    "context": _form_stat(g, off_side, "off_first_down"),
                    "contextOpp": _form_stat(g, def_side, "def_first_down"),
                    "contextLabel": "1st-down rate",
                },
                {
                    "id": "run",
                    "title": "Success rate",
                    "hero": _rate_stat(off_r.get("rush_success_rate"), off_lg.get("rush_success_rate")),
                    "heroLabel": "Success rate",
                    "yards": None,
                    "offEpa": _epa_stat(off_r.get("rush_epa"), off_lg.get("rush_epa")),
                    "defEpa": _epa_stat(def_r.get("rush_epa"), def_lg.get("rush_epa"), invert=True),
                    "context": _form_stat(g, off_side, "off_explosive"),
                    "contextOpp": _form_stat(g, def_side, "def_explosive"),
                    "contextLabel": "explosive plays",
                },
            ],
        }

    items = []
    for off_side, def_side in (("away", "home"), ("home", "away")):
        p = possession(off_side, def_side)
        items.append((f"clash-{off_side}", "ClashBoard", {
            "league": "nfl",
            "away": away,
            "home": home,
            "offense": p["offense"],
            "defense": p["defense"],
            "offenseName": p["offenseName"],
            "defenseName": p["defenseName"],
            "eyebrow": f"{a.tag} · Pass vs run",
            "title": p["title"],
            "note": charting_note(g),
            "lanes": p["lanes"],
        }))
    return items


COVER_SHELLS = (
    ("cover_0", "Cover 0"),
    ("cover_1", "Cover 1"),
    ("cover_2", "Cover 2"),
    ("cover_3", "Cover 3"),
    ("cover_4", "Cover 4"),
    ("cover_6", "Cover 6"),
    ("cover_2_man", "2-Man"),
    ("man", "Man"),
    ("zone", "Zone"),
    ("blitz", "Vs blitz"),
    ("pressure", "Vs pressure"),
)


def cover_heat_items(a, g: dict) -> list[tuple[str, str, dict]]:
    """How often this defense plays each look, plus ranked pass quality in that look."""
    items = []
    for off_side, def_side in (("away", "home"), ("home", "away")):
        off_s = g.get(f"{off_side}_scheme") or {}
        def_s = g.get(f"{def_side}_scheme") or {}
        off_r = _scheme_unit(off_s, "offense", "response")
        def_r = _scheme_unit(def_s, "defense", "response")
        def_c = _scheme_unit(def_s, "defense", "coverage")
        def_p = _scheme_unit(def_s, "defense", "pressure")
        off_lg = (off_s.get("league_response") or {}).get("offense") or {}
        def_lg = (def_s.get("league_response") or {}).get("defense") or {}
        shells = []
        for key, label in COVER_SHELLS:
            if key in ("blitz", "pressure"):
                epa_key = f"pass_epa_{key}"
                rate = def_p.get("blitz_rate" if key == "blitz" else "pressure_rate")
                rate_key = "blitz_rate" if key == "blitz" else "pressure_rate"
                rate_cat = "pressure"
            elif key in ("man", "zone"):
                epa_key = f"pass_epa_{key}"
                rate = def_c.get(f"{key}_rate")
                rate_key = f"{key}_rate"
                rate_cat = "coverage"
            else:
                epa_key = f"pass_epa_{key}"
                rate = def_c.get(f"{key}_rate")
                rate_key = f"{key}_rate"
                rate_cat = "coverage"
            off_v = off_r.get(epa_key)
            def_v = def_r.get(epa_key)
            if off_v is None and def_v is None and rate is None:
                continue
            shells.append({
                "label": label,
                "rate": _pct(float(rate)) if rate is not None else "—",
                "rateValue": float(rate) if rate is not None else None,
                "rateRank": _freq_rank(def_s, "defense", rate_cat, rate_key),
                "off": _epa_stat(off_v, off_lg.get(epa_key)),
                "opp": _epa_stat(def_v, def_lg.get(epa_key), invert=True),
            })
        shells.sort(key=lambda s: -(s["rateValue"] or 0))
        shells = [s for s in shells if (s["rateValue"] or 0) >= 0.04 or s["label"] in ("Vs blitz", "Man", "Zone")][:7]
        if len(shells) < 4:
            continue
        off_team = g[off_side].upper()
        def_team = g[def_side].upper()
        items.append((f"cover-{off_side}", "CoverHeat", {
            "league": "nfl",
            "away": g["away"].upper(),
            "home": g["home"].upper(),
            "offense": off_team,
            "defense": def_team,
            "offenseName": g.get(f"{off_side}_name", off_team),
            "defenseName": g.get(f"{def_side}_name", def_team),
            "eyebrow": f"{a.tag} · vs coverage",
            "title": f"{off_team} vs {def_team} shells",
            "note": f"Team rates, not one QB. {charting_note(g)}",
            "shells": shells,
        }))
    return items


def _num(d: dict, *keys):
    for k in keys:
        v = d.get(k)
        if v is not None:
            return float(v)
    return None


def mix_items(a, g: dict) -> list[tuple[str, str, dict]]:
    """Pitch-mix-style tendency tables: usage pips, EPA, opponent answer, success.

    Each row must carry the split for THAT look. A season-total (pass EPA, pass
    success, opponent pass rate) is never copied onto every row.
    """
    items = []
    for side, opp in (("away", "home"), ("home", "away")):
        team = g[side].upper()
        other = g[opp].upper()
        scheme = g.get(f"{side}_scheme") or {}
        opp_scheme = g.get(f"{opp}_scheme") or {}
        off = scheme.get("offense") or {}
        pers, resp = off.get("personnel") or {}, off.get("response") or {}
        ranks = ((scheme.get("league_frequency_ranks") or {}).get("offense") or {}).get("personnel") or {}
        snaps = scheme.get("offense_plays") or scheme.get("charting_samples")
        rows = []
        # Keep rows that actually have an EPA split so the board is full. Shotgun /
        # motion / RPO are already on the scheme picture; they do not get a second
        # empty table. {other} Pass% is their pass rate, not their copy of this look.
        opp_pass = _num((opp_scheme.get("offense") or {}).get("personnel") or {}, "neutral_pass_rate")
        opp_pass_place = ((((opp_scheme.get("league_frequency_ranks") or {}).get("offense") or {}).get("personnel") or {}).get("neutral_pass_rate") or {}).get("place")
        specs = [
            ("neutral_pass_rate", "Neutral pass", "pass_epa", "pass_success_rate", True),
            ("play_action_rate", "Play action", "pass_epa_play_action", None, False),
            ("formation_under_center_rate", "Under center", "rush_epa", "rush_success_rate", False),
        ]
        for key, label, epa_key, extra_key, show_pass in specs:
            usage = float(pers.get(key) or 0)
            if usage <= 0:
                continue
            epa = _num(resp, epa_key) if epa_key else None
            extra = _num(resp, extra_key) if extra_key else None
            if epa is None:
                continue
            place = (ranks.get(key) or {}).get("place")
            rows.append({
                "label": label,
                "usage": usage,
                "usageDisplay": _pct(usage),
                "count": f"{int(round(usage * snaps)):,}" if snaps else "",
                "stat": _epa(epa),
                "statRank": place,
                "opp": _pct(opp_pass) if show_pass and opp_pass is not None else "",
                "oppRank": opp_pass_place if show_pass else None,
                "extra": _pct(extra) if extra is not None else "",
                "extraRank": None,
                "of": 32,
            })
        if not rows:
            continue
        items.append((f"mix-{side}", "MixTable", {
            "league": "nfl", "team": team, "teamName": g.get(f"{side}_name", team),
            "opponent": other, "opponentName": g.get(f"{opp}_name", other),
            "eyebrow": f"{a.tag} · Tendencies",
            "title": g.get(f"{side}_name", team).split(" ")[-1],
            "subtitle": "Season to date",
            "columns": {
                "usage": "Usage", "count": "Snaps", "stat": "EPA",
                "opp": f"{other} Pass%", "extra": "Success",
            },
            "rows": rows[:7],
            "statInvert": False,
            "note": f"Numbers for looks that have their own EPA. {other} Pass% is their season pass rate (Neutral pass row). Shotgun, motion and personnel packages live on the scheme slides. {charting_note(g)}",
        }))
    return items


def _key(name: str) -> str:
    """Name key that survives punctuation and suffixes: 'D.J. Reed Jr.' -> 'djreed'."""
    n = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "", name.lower())
    return re.sub(r"[^a-z]", "", n)


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _face_index() -> dict[str, list[tuple[str, str]]]:
    """Map a name key to (team, espn/sleeper photo URL). Cached from Sleeper."""
    if FACE_INDEX.exists() and time.time() - FACE_INDEX.stat().st_mtime < 7 * 86400:
        try:
            raw = json.loads(FACE_INDEX.read_text(encoding="utf-8"))
            return {k: [tuple(x) for x in v] for k, v in raw.items()}
        except (OSError, ValueError):
            pass
    try:
        blob = json.loads(_fetch("https://api.sleeper.app/v1/players/nfl", timeout=60))
    except Exception as exc:
        print(f"[video-pack] sleeper roster unavailable ({exc})")
        if FACE_INDEX.exists():
            raw = json.loads(FACE_INDEX.read_text(encoding="utf-8"))
            return {k: [tuple(x) for x in v] for k, v in raw.items()}
        return {}
    index: dict[str, list[tuple[str, str]]] = {}
    for p in blob.values():
        if not isinstance(p, dict):
            continue
        k = _key(p.get("full_name") or "")
        if not k:
            continue
        eid, pid = p.get("espn_id"), p.get("player_id")
        if eid:
            url = f"https://a.espncdn.com/i/headshots/nfl/players/full/{eid}.png"
        elif pid:
            url = f"https://sleepercdn.com/content/nfl/players/thumb/{pid}.jpg"
        else:
            continue
        team = str(p.get("team") or "").upper()
        index.setdefault(k, []).append((team, url))
    FACE_INDEX.parent.mkdir(parents=True, exist_ok=True)
    FACE_INDEX.write_text(json.dumps(index), encoding="utf-8")
    return index


def face_url(name: str, team: str | None = None) -> str | None:
    """Best photo URL for a roster name, preferring the listed club."""
    hits = _face_index().get(_key(name)) or []
    if not hits:
        return None
    if team:
        clubs = club_keys(team)
        for t, url in hits:
            if t in clubs:
                return url
    return hits[0][1]


def headshot(url: str | None) -> str | None:
    """Download once; return the staticFile() path, or None when there is no image."""
    if not url:
        return None
    PLAYERS_DIR.mkdir(parents=True, exist_ok=True)
    name = hashlib.sha1(url.encode()).hexdigest()[:16] + ".png"
    dest = PLAYERS_DIR / name
    if dest.exists():
        _shrink(dest)
    else:
        try:
            data = _fetch(url, timeout=20)
        except Exception as exc:  # a missing face is not worth failing the pack
            print(f"[video-pack] headshot unavailable ({exc}): {url}")
            return None
        dest.write_bytes(data)
    _shrink(dest)
    return f"players/{name}"


def _shrink(path: Path, size: int = 320) -> None:
    """Headshots arrive anywhere from 160 px to full-resolution (5 MB) - the booth and the
    renders load dozens at once, so every one is stored as a small square PNG."""
    try:
        from PIL import Image
    except ImportError:
        return
    try:
        with Image.open(path) as im:
            if im.width <= size and path.stat().st_size < 400_000:
                return
            im = im.convert("RGBA")
            side = min(im.width, im.height)
            left = (im.width - side) // 2
            im = im.crop((left, 0, left + side, side)).resize((size, size), Image.LANCZOS)
            im.save(path, "PNG", optimize=True)
    except Exception as exc:
        print(f"[video-pack] could not shrink {path.name}: {exc}")


def _status_map(g: dict, side: str) -> dict[str, dict]:
    return {_key(x["name"]): x for x in g.get(f"{side}_availability_list") or []}


def formation_items(a, g: dict) -> list[tuple[str, str, dict]]:
    items = []
    for side in ("away", "home"):
        team = g[side].upper()
        opp = g["home" if side == "away" else "away"].upper()
        lineups = g.get(f"{side}_lineups") or {}
        status = _status_map(g, side)
        for unit in ("offense", "defense"):
            u = lineups.get(unit) or {}
            if not u.get("players"):
                continue
            starters = []
            seen = set()
            for p in u["players"]:
                st = status.get(_key(p["name"]))
                seen.add(_key(p["name"]))
                starters.append({
                    "name": p["name"], "position": p["position"], "group": p.get("group", ""),
                    "headshot": headshot(p.get("headshot_url")),
                    "status": st["status"] if st else "", "detail": (st or {}).get("detail", ""),
                })
            backups = [
                {"name": x["name"], "position": x["position"], "status": x["status"], "detail": x.get("detail", "")}
                for k, x in status.items()
                if k not in seen and ((x["position"].upper() in OFFENSE_POS) == (unit == "offense"))
            ]
            items.append((f"formation-{side}-{unit}", "Formation", {
                "league": "nfl", "team": team, "opponent": opp, "unit": unit,
                "teamName": g.get(f"{side}_name", team),
                "package": u.get("package", ""),
                "eyebrow": f"{a.tag} · {team} {unit}",
                "title": f"{g.get(f'{side}_name', team).split(' ')[-1]} {unit.title()}",
                "players": starters, "backups": backups,
                "focus": None, "focusAt": 0,
                "source": f"{lineups.get('source', 'Depth chart')} · {str(lineups.get('observed_at_utc', ''))[:10]}",
                "alignment": _alignment(g, side, unit),
            }))
    return items


def _injury_impact(pos: str, starter: bool, depth_rank: int | None) -> tuple[int, str]:
    """1–5: how much this designation actually moves the club."""
    p = (pos or "").upper()
    skill = p in {"QB", "RB", "FB", "WR", "TE"}
    ol = p in {"OT", "OL", "G", "C", "T", "LT", "RT", "LG", "RG"}
    if starter and p == "QB":
        return 5, "Franchise"
    if starter and (skill or ol):
        return 4, "Core"
    if starter:
        return 3, "Starter"
    # Injured names often drop off the listed 11; depth chart 1 still counts.
    if depth_rank == 1:
        if p == "QB":
            return 5, "Franchise"
        if skill or ol:
            return 4, "Core"
        return 3, "Starter"
    if depth_rank == 2 or skill or p in {"DE", "EDGE", "OLB", "DT", "CB"}:
        return 2, "Rotation"
    return 1, "Depth"


def injury_items(a, g: dict) -> list[tuple[str, str, dict]]:
    """One injury-report board per club, from the site's availability list."""
    items = []
    for side in ("away", "home"):
        team = g[side].upper()
        report = g.get(f"{side}_availability_list") or []
        faces = {}
        starters = set()
        depth: dict[str, int] = {}
        for p in g.get(f"{side}_players") or []:
            faces[_key(p.get("name", ""))] = p.get("headshot_url")
            if p.get("depth_rank") is not None:
                depth[_key(p.get("name", ""))] = int(p["depth_rank"])
        for unit in ("offense", "defense"):
            for p in ((g.get(f"{side}_lineups") or {}).get(unit) or {}).get("players", []):
                faces.setdefault(_key(p.get("name", "")), p.get("headshot_url"))
                starters.add(_key(p.get("name", "")))
        rows = []
        for x in report:
            name = x.get("name") or ""
            if not name:
                continue
            k = _key(name)
            pos = x.get("position") or ""
            listed = k in starters
            impact, impact_label = _injury_impact(pos, listed, depth.get(k))
            rows.append({
                "name": name,
                "position": pos,
                "status": x.get("status") or "",
                "detail": x.get("detail") or "",
                "headshot": headshot(faces.get(k) or face_url(name, team)),
                "starter": listed,
                "impact": impact,
                "impactLabel": impact_label,
            })
        rows.sort(key=lambda r: (-r["impact"], r["status"]))
        items.append((f"injuries-{side}", "InjuryBoard", {
            "league": "nfl", "team": team, "teamName": g.get(f"{side}_name", team),
            "eyebrow": f"{a.tag} · Injury report",
            "title": f"{g.get(f'{side}_name', team).split(' ')[-1]} Report",
            "rows": rows,
            "note": "Sorted by who actually changes the game: Franchise, Core, Starter, Rotation, Depth. Questionable is not inactive.",
        }))
    return items


SKILL_POS = {"RB", "FB", "WR", "TE"}


def player_items(a, g: dict, qbs: dict, props_by_player: dict | None = None) -> list[tuple[str, str, dict]]:
    """Cards for skill starters. QBs are the QB-duel slide; linemen and injured
    defenders are the injury report, not a third copy of the same name."""
    items = []
    for side in ("away", "home"):
        team = g[side].upper()
        status = _status_map(g, side)
        people: dict[str, dict] = {}
        for p in g.get(f"{side}_players") or []:
            if p.get("position") == "QB":
                continue
            if p.get("position") not in SKILL_POS:
                continue
            if p.get("depth_rank") != 1 and p["position"] != "WR":
                continue
            if p["position"] == "WR" and p.get("depth_rank", 9) > 2:
                continue
            people[_key(p["name"])] = {**p, "role": f"{p['position']}{p.get('depth_rank', '')}"}
        for k, p in people.items():
            st = status.get(k)
            stats = []
            try:
                from outputs.season_starts import starter_lines
                stats = starter_lines(p["name"], team, p["position"])
            except Exception:
                stats = []
            items.append((f"player-{slug(p['name'])}", "PlayerCard", {
                "league": "nfl", "team": team, "teamName": g.get(f"{side}_name", team),
                "name": p["name"], "position": p["position"], "role": p.get("role", ""),
                "headshot": headshot(p.get("headshot_url")),
                "status": st["status"] if st else "Active", "detail": (st or {}).get("detail", ""),
                "stats": stats,
                "statsLabel": "This season's starts" if stats else "",
                "props": (props_by_player or {}).get(k, [])[:4],
                "eyebrow": f"{a.tag} · {team} {p['position']}",
            }))
    return items


def _pct(v: float) -> str:
    return f"{v * 100:.1f}%"


def _epa(v: float) -> str:
    return f"{v:+.3f}"


def charting_note(g: dict) -> str:
    """Which seasons the scheme rates actually come from.

    nflverse publishes personnel/coverage participation only AFTER a season ends, so
    in-season those rates are last year's while the play-by-play and FTN charting
    (motion, play action, RPO, screens, blitz) are current. Say so on screen rather
    than passing 2025 shells off as this week's.
    """
    s = (g.get("home_scheme") or {})
    part = s.get("participation_source_seasons") or []
    pbp = s.get("source_seasons") or []
    if part and pbp and max(part) < max(pbp):
        return f"Coverage and personnel charted from {max(part)} (the {max(pbp)} release comes after the season); rates and tendencies are {max(pbp)}."
    return f"Charting seasons: {', '.join(str(x) for x in pbp)}." if pbp else ""


def metric_items(a, g: dict) -> list[tuple[str, str, dict]]:
    away, home = g["away"].upper(), g["home"].upper()
    fa, fh = (g.get("away_form") or {}).get("rates", {}), (g.get("home_form") or {}).get("rates", {})
    sa, sh = g.get("away_scheme") or {}, g.get("home_scheme") or {}
    base = {"league": "nfl", "away": away, "home": home,
            "awayName": g.get("away_name", away), "homeName": g.get("home_name", home)}
    items = []

    def form_board(title: str, keys: list[str]):
        keys = [k for k in keys if k in fa and k in fh]
        if not keys:
            return None
        rows = []
        for k in keys:
            ra, rh = fa[k], fh[k]
            fmt = _epa if "epa" in k else (lambda v: f"{v:.1f}") if "ypc" in k else _pct
            rows.append({
                "label": ra["label"], "better": ra.get("better", "high"),
                "away": {"value": ra["value"], "display": fmt(ra["value"]), "rank": ra.get("rank"), "of": ra.get("of", 32)},
                "home": {"value": rh["value"], "display": fmt(rh["value"]), "rank": rh.get("rank"), "of": rh.get("of", 32)},
            })
        window = g.get("form_window") or {}
        through = window.get("through_week")
        season = window.get("season")
        if through and season:
            label = f"Week {through}" if through == 1 else f"Weeks 1–{through}"
            note = (
                f"{season} {label} play-by-play, ranked in the 32-team pool (1st = best). "
                "Not last season's prior. Bar length is league percentile."
            )
            eyebrow = f"{a.tag} · Team form · {label}"
        else:
            note = "Opponent-adjusted rates, graded against the 32-team pool (1st = best). Bar length is league percentile."
            eyebrow = f"{a.tag} · Team form"
        return {**base, "eyebrow": eyebrow, "title": title, "rows": rows, "mixes": [],
                "rankKind": "quality", "note": note}

    def scheme_board(unit: str, cat: str, title: str, labels: dict[str, str], fmt=_pct, mix=None):
        da, dh = (sa.get(unit) or {}).get(cat) or {}, (sh.get(unit) or {}).get(cat) or {}
        if not da or not dh:
            return None
        ranks_a = ((sa.get("league_frequency_ranks") or {}).get(unit) or {}).get(cat) or {}
        ranks_h = ((sh.get("league_frequency_ranks") or {}).get(unit) or {}).get(cat) or {}
        rows = []
        for k, label in labels.items():
            if k not in da or k not in dh:
                continue
            f = fmt if k != "avg_box" else (lambda v: f"{v:.1f}")
            rows.append({
                "label": label, "better": None,
                "away": {"value": da[k], "display": f(da[k]), "rank": (ranks_a.get(k) or {}).get("place"), "of": 32},
                "home": {"value": dh[k], "display": f(dh[k]), "rank": (ranks_h.get(k) or {}).get("place"), "of": 32},
            })
        mixes = []
        if mix:
            segs = [{"label": lab, "away": da.get(k, 0), "home": dh.get(k, 0)} for k, lab in mix[1].items() if k in da]
            mixes.append({"label": mix[0], "segments": segs})
        return {**base, "eyebrow": f"{a.tag} · Scheme · {'defense' if unit == 'defense' else 'offense'}",
                "title": title, "rows": rows, "mixes": mixes, "rankKind": "frequency",
                "note": f"Share of snaps; badge = league frequency rank (1 = most often). {charting_note(g)}"}

    spec_keys = [k for k, _, _, _ in FORM_SPECS]
    boards = {
        "offense": form_board("Offense, Side by Side",
                              [k for k in spec_keys if k.startswith("off_")]),
        "defense": form_board("Defense, Side by Side",
                              [k for k in spec_keys if k.startswith("def_")]),
        "rushing": form_board("Rushing, Side by Side",
                              [k for k in spec_keys if "rush" in k]),
        "pressure": scheme_board("defense", "pressure", "How They Pressure",
                                 {"blitz_rate": "Blitz rate", "pressure_rate": "Pressure rate",
                                  "stacked_box_rate": "Stacked box", "avg_box": "Avg. men in box"}),
        "targets": scheme_board("offense", "target_share", "Who They Throw To",
                                {"target_share_wr_all": "WR target share", "target_share_te_all": "TE target share",
                                 "target_share_rb_all": "RB target share"}),
    }
    for k, props in boards.items():
        if props:
            items.append((f"stats-{k}", "MetricBoard", props))
    return items


# ── live market: opening vs current, and the player prop review ────────────

def _american(v: float | None) -> str:
    return "" if v is None else f"{v:+.0f}"


def _implied(ml_home: float | None, ml_away: float | None) -> float | None:
    """No-vig home win probability from the two moneylines."""
    def p(ml):
        return 100 / (ml + 100) if ml > 0 else -ml / (-ml + 100)
    if ml_home is None or ml_away is None:
        return None
    a, b = p(ml_home), p(ml_away)
    return a / (a + b)


def _spread_label(home: str, away: str, spread_home: float | None) -> str:
    if spread_home is None:
        return ""
    if spread_home == 0:
        return "Pick'em"
    return f"{home if spread_home < 0 else away} -{abs(spread_home):g}"


def line_move_item(a, g: dict, live: dict, model_margin: float, model_total: float) -> tuple[str, str, dict]:
    away, home = g["away"].upper(), g["home"].upper()
    o, c = live["open"], live["current"]
    rows = []
    if c["spread_home"] is not None:
        move = c["spread_home"] - (o["spread_home"] if o["spread_home"] is not None else c["spread_home"])
        toward = home if move < 0 else away
        rows.append({"label": "Spread", "open": _spread_label(home, away, o["spread_home"]),
                     "current": _spread_label(home, away, c["spread_home"]),
                     "openValue": -(o["spread_home"] or 0), "currentValue": -c["spread_home"],
                     "move": f"{abs(move):g} pts toward {toward}" if move else "No move",
                     "team": toward if move else None, "unit": f"{home} margin", "juice": ""})
    if c["total"] is not None:
        move = c["total"] - (o["total"] if o["total"] is not None else c["total"])
        rows.append({"label": "Total", "open": f"{o['total']:g}" if o["total"] is not None else "",
                     "current": f"{c['total']:g}",
                     "openValue": o["total"] or c["total"], "currentValue": c["total"],
                     "move": f"{'Up' if move > 0 else 'Down'} {abs(move):g}" if move else "No move",
                     "team": None, "unit": "points",
                     "juice": f"Over {_american(c['over'])} · Under {_american(c['under'])}" if c["over"] is not None else ""})
    for team, key in ((home, "ml_home"), (away, "ml_away")):
        if c[key] is None:
            continue
        rows.append({"label": f"{team} moneyline", "open": _american(o[key]), "current": _american(c[key]),
                     "openValue": o[key] or c[key], "currentValue": c[key],
                     "move": "", "team": team, "unit": "American odds", "juice": ""})
    po, pc = _implied(o["ml_home"], o["ml_away"]), _implied(c["ml_home"], c["ml_away"])
    lead = home if model_margin >= 0 else away
    return ("line-move", "LineMove", {
        "league": "nfl", "away": away, "home": home,
        "awayName": g.get("away_name", away), "homeName": g.get("home_name", home),
        "eyebrow": f"{a.tag} · {live['provider']} · live",
        "title": "Where the Line Has Moved",
        "rows": rows,
        "winOpen": round(po, 4) if po is not None else None,
        "winCurrent": round(pc, 4) if pc is not None else None,
        "model": f"nfl-model (research only): {lead} by {abs(model_margin):.1f}, total {model_total:.1f}",
        "modelMargin": round(model_margin, 1), "modelTotal": round(model_total, 1),
        "updated": live["updated"],
    })


def prop_items(a, g: dict, board: dict, props: list[dict]) -> tuple[list, dict]:
    """PropBoard items per filter, plus {player key: [prop rows]} for the player cards."""
    away, home = g["away"].upper(), g["home"].upper()
    clubs = club_keys(away) | club_keys(home)
    proj = {_key(p["player_name"]): p for p in board.get("player_projections", [])
            if p.get("team") in clubs}
    rows = []
    for pr in props:
        pj = proj.get(_key(pr["name"]))
        if not pj:
            continue
        m = pj.get("metrics") or {}
        model = None
        for key in pr["metric"]:
            parts = key.split("+")
            if all(k in m for k in parts):
                model = sum(float(m[k]) for k in parts)
                break
        # Token lines (a QB's 0.5 rushing yards) are not a real market to review.
        floor = 9.5 if "yards" in pr["label"].lower() else 0
        if model is None or pr["line"] <= floor:
            continue
        diff = model - pr["line"]
        rows.append({
            "key": _key(pr["name"]),
            "name": pj["player_name"], "team": pj["team"], "position": pj["position"],
            "headshot": headshot(pj.get("headshot_url") or pr.get("headshot")),
            "market": pr["label"], "group": pr["group"],
            "line": pr["line"], "open": pr["open"], "model": round(model, 2),
            "diff": round(diff, 2), "pct": round(diff / pr["line"], 4),
            # Size-adjusted gap (counting-stat scale), so big-number markets and
            # small ones rank on the same footing.
            "score": round(abs(diff) / max(1.0, pr["line"]) ** 0.5, 4),
        })
    rows.sort(key=lambda r: -r["score"])
    base = {"league": "nfl", "away": away, "home": home,
            "note": "DraftKings line (live) vs nfl-model projection. The model is research only and does "
                    "not price props: a gap is a disagreement, not an edge."}
    filters = [
        ("all", "Biggest Gaps", lambda r: True),
        (away.lower(), f"{g.get('away_name', away).split(' ')[-1]} Props",
         lambda r, a=away: r["team"] in club_keys(a)),
        (home.lower(), f"{g.get('home_name', home).split(' ')[-1]} Props",
         lambda r, h=home: r["team"] in club_keys(h)),
    ]
    items = []
    for key, title, keep in filters:
        sel = [r for r in rows if keep(r)][:6]
        if sel:
            items.append((f"props-{key}", "PropBoard", {
                **base, "eyebrow": f"{a.tag} · Player props · DraftKings live", "title": title, "rows": sel}))
    by_player: dict[str, list] = {}
    for r in rows:
        by_player.setdefault(r["key"], []).append(
            {"label": r["market"], "line": r["line"], "open": r["open"], "model": r["model"]})
    return items, by_player
