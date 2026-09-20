"""Game pack: every video graphic for one game, from live data, in one command.

    python -m outputs.video_pack --league nfl --game DET@BUF
    python -m outputs.video_pack --league nfl --game DET@BUF --platform tiktok --captures
    python -m outputs.video_pack --league mlb --game NYY@MIN --date 2026-09-16

Writes video/props/pack/<date>-<AWAY>-<HOME>/:
    *.json         props for each composition
    pack.json      the manifest (name -> composition + props file)
    render.bat     one render line per item (ProRes 4444 for overlays, H.264 for
                   full-frame pieces), plus the snapshot line that stills them all

Sources, all live:
    chase-analytics.com  /data/public/<sport>/slate.json   teams, records, starters,
                         venue, network, availability
    nfl-model (hosted)   board.json                        DraftKings lines (book),
                         model margin/total/win prob, power ratings, unit form, QB
                         projections. It self-reports RESEARCH_ONLY and withholds
                         per-game edges, so every model-derived item carries that note.

--captures also runs the still engine for the injury formations (both clubs, offense
and defense, banner-headed) with --video, and turns each capture into an Annotate
props file whose steps are generated from what the capture actually shows: a push-in
on the injury report and a highlight on each listed backup, then a ring on every
starter carrying a designation.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from outputs.content_engine import (
    NFL_BOARD_URL,
    PIPELINE,
    SITE_URL,
    _et_date,
    _fetch,
    fail,
)
from outputs.last_game import last_game_items
from outputs.live_lines import game_odds, player_props
from outputs.video_studio import (
    clash_items,
    cover_heat_items,
    formation_items,
    line_move_item,
    metric_items,
    player_items,
    prop_items,
    qb_matchup_item,
    scheme_diagram_items,
    skill_duel_items,
    team_compare_item,
    injury_items,
)

VIDEO = PIPELINE / "video"
PACK_ROOT = VIDEO / "props" / "pack"
RESEARCH = ("nfl-model is research only: it does not beat the closing line, so a gap "
            "is a disagreement, not an edge.")

# Site slate uses WSH; nfl-model board uses WAS.
NFL_TEAM_ALIAS = {"WSH": "WAS", "WAS": "WSH"}


def club_keys(code: str) -> set[str]:
    c = code.upper()
    return {c, NFL_TEAM_ALIAS.get(c, c)}


def club_get(d: dict, code: str, default=None):
    c = code.upper()
    if c in d:
        return d[c]
    alt = NFL_TEAM_ALIAS.get(c)
    return d.get(alt, default) if alt else default

# Compositions that render with alpha (overlays) vs opaque (full frame).
ALPHA = {"Template-reels", "Template-reels-ads", "Template-tiktok", "Template-shorts",
         "Template-youtube", "MatchupBarNFL", "MatchupBarMLB", "LowerThird",
         "LowerThirdWide", "CornerBug", "CornerBugWide", "Sting", "StingWide",
         "NflCutaway", "MatchupCutaway", "ModelSnapshot", "BoardMotion",
         "BoardMotionWide", "ChapterCard", "ChapterCardVertical", "AgendaRail",
         "SplitFrame", "Telestrator", "TelestratorWide", "Callout", "CalloutWide"}
STILLS = {"Thumbnail", "ThumbnailVertical"}

# Remotion merges a composition's defaultProps UNDER the props you pass, so any
# optional field a pack item leaves out is filled from the Studio sample (the TNF
# fixture) - "How They Play" rendered with Goff and Allen as its side labels that
# way. Every optional field is therefore written explicitly: null or empty means
# "not shown".
OPTIONAL = {
    "StatDuel": {"eyebrow": "", "title": "", "awayLabel": None, "homeLabel": None, "note": ""},
    "LineGap": {"eyebrow": "", "title": "", "min": None, "max": None, "caveat": "", "unit": "pts"},
    "RankCountdown": {"eyebrow": "", "title": "", "valueLabel": "", "note": ""},
    "SplitFrame": {"eyebrow": "", "title": "", "capture": None, "stats": [], "bullets": [],
                   "kickoff": "", "footer": "", "camera": "left"},
    "ChapterCard": {"subtitle": "", "team": None, "league": None, "transparent": False},
    "AgendaRail": {"label": "", "position": "top", "fill": True},
    "EpisodeOpen": {"awayName": None, "homeName": None, "kickoff": "", "network": "", "venue": ""},
    "EndScreen": {"guides": False},
    "Thumbnail": {"line2": "", "badge": ""},
    "LowerThird": {"subtitle": "", "stat": "", "statLabel": "", "team": None, "league": None},
    "CornerBug": {"statLabel": "", "statValue": ""},
    "MatchupBar": {"awayNote": "", "homeNote": "", "centerLabel": "", "centerValue": ""},
    "Template": {"eyebrow": "", "title": "", "spread": "", "total": "", "moneyline": "",
                 "stats": [], "footer": "", "lineSource": "current"},
    "Callout": {"sub": "", "team": None, "league": None, "value": None},
    "Sting": {"tagline": "", "ground": False},
    "NflCutaway": {"take": "", "kickoff": ""},
    "Annotate": {"eyebrow": "", "title": ""},
    "QbMatchup": {"starts": [], "note": ""},
}


def complete(comp: str, props: dict) -> dict:
    family = next((k for k in OPTIONAL if comp.startswith(k)), None)
    return {**OPTIONAL.get(family, {}), **props} if family else props


def site_game(sport: str, token: str, day: str | None) -> dict:
    board = json.loads(_fetch(f"{SITE_URL}/data/public/{sport}/slate.json"))
    away, _, home = token.upper().partition("@")
    hits = [g for g in board.get("games", [])
            if str(g.get("away", "")).upper() == away and str(g.get("home", "")).upper() == home]
    if day:
        hits = [g for g in hits if _et_date(g.get("kickoff_utc", "")) == day] or hits
    if not hits:
        names = ", ".join(f"{g['away']}@{g['home']}" for g in board.get("games", []))
        fail(f"{token} is not on the live {sport.upper()} slate. Available: {names}")
    if len(hits) > 1:
        fail(f"{token} appears {len(hits)} times on the slate (doubleheader) - pass --date")
    return hits[0]


def nfl_board() -> dict:
    return json.loads(_fetch(NFL_BOARD_URL.rstrip("/") + "/board.json"))


def short_name(full: str) -> str:
    return full.split(" ")[-1] if full else full


def kickoff_label(g: dict, board_game: dict | None) -> str:
    if board_game and board_game.get("kickoff"):
        return board_game["kickoff"]
    return g.get("kickoff_utc", "")


def week_label(a, g: dict, board: dict) -> str:
    """Prefer the show/slate week over a stale nfl-model board (often last week's)."""
    show = str(getattr(a, "show", "") or "")
    m = re.search(r"week\s*(\d+)", show, re.I)
    if m:
        return f"Week {int(m.group(1))}"
    for src in (g.get("week"), g.get("nfl_week")):
        if src not in (None, ""):
            s = str(src)
            return s if s.lower().startswith("week") else f"Week {s}"
    m = re.fullmatch(r"W(\d+)", str(getattr(a, "tag", "") or ""), re.I)
    if m:
        return f"Week {int(m.group(1))}"
    if board.get("week") is not None:
        return f"Week {board['week']}"
    return "NFL"


def r1(value: float) -> float:
    """Round half up to one decimal: 1.45 -> 1.5 (float formatting gives 1.4)."""
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def by_margin(away: str, home: str, home_margin: float) -> str:
    """'BUF by 1.5' - never '+1.5', which in betting notation reads as the underdog."""
    return f"{home if home_margin >= 0 else away} by {abs(r1(home_margin)):.1f}"


DESIGNATIONS = ("QUESTIONABLE", "DOUBTFUL", "OUT", "INJURED")


def injury_label(text: str, name_words: int = 2) -> tuple[str, str, str]:
    """'RB Isiah Pacheco back INJURED RESERVE' -> (name, 'Injured Reserve · back', tone)."""
    words = text.split(" ")
    idx = next((i for i, w in enumerate(words) if i > name_words and w.upper() in DESIGNATIONS),
               len(words))
    name = " ".join(words[1:1 + name_words])
    detail = " ".join(words[1 + name_words:idx]).strip()
    status = " ".join(words[idx:]).title()
    tone = "caution" if status.upper() in ("QUESTIONABLE", "DOUBTFUL") else "negative"
    label = status + (f" · {detail.lower()}" if detail and detail.lower() != "no detail" else "")
    return name, label, tone


def build_nfl(a, g: dict) -> tuple[list[tuple[str, str, dict]], dict]:
    board = nfl_board()
    away, home = g["away"].upper(), g["home"].upper()
    bg = next((x for x in board.get("games", [])
               if x["away"].upper() in club_keys(away) and x["home"].upper() in club_keys(home)), None)
    if bg is None:
        fail(f"{away}@{home} is not on the nfl-model board (week {board.get('week')})")
    teams = {t["team"].upper(): t for t in board.get("teams", [])}
    ta, th = club_get(teams, away, {}), club_get(teams, home, {})
    book = bg.get("book") or {}
    # Live DraftKings numbers (ESPN feed) replace the board's snapshot when available.
    live = game_odds(str(g["id"])) if g.get("id") else None
    if live and live["current"]["spread_home"] is not None:
        cur = live["current"]
        book = {**book, "name": live["provider"], "spread": cur["spread_home"], "margin": -cur["spread_home"],
                "total": cur["total"] if cur["total"] is not None else book.get("total"),
                "home_moneyline": cur["ml_home"], "away_moneyline": cur["ml_away"],
                "last_update": live["updated"], "live": True}
    week = week_label(a, g, board)
    show = a.show or f"{week} Matchup"
    kickoff = kickoff_label(g, bg)
    network = g.get("broadcast") or ""
    venue = " · ".join(x for x in (g.get("venue"), g.get("venue_city")) if x)
    fav = home if (book.get("spread") or 0) <= 0 else away
    spread = f"{fav} {book.get('spread') if fav == home else -book.get('spread', 0):+g}" if book else ""
    ml_home = book.get("home_moneyline")
    ml_away = book.get("away_moneyline")
    moneyline = (f"{home} {ml_home:+g}" if ml_home is not None and ml_home < 0
                 else f"{away} {ml_away:+g}" if ml_away is not None else "")
    total = f"{book.get('total'):g}" if book.get("total") is not None else ""
    lines_note = (f"Lines: DraftKings {'live (ESPN feed)' if book.get('live') else 'via the nfl-model board'}, "
                  f"{str(book.get('last_update', board.get('generated_at_utc', '')))[:16].replace('T', ' ')} UTC.")

    qbs = {}
    for p in board.get("player_projections", []):
        if (p.get("position") == "QB" and p.get("depth_rank") == 1
                and {p.get("team"), p.get("opponent")} == {away, home}):
            qbs[p["team"]] = p
    qa, qh = club_get(qbs, away), club_get(qbs, home)
    fa, fh = ta.get("form", {}), th.get("form", {})
    model_margin = float(bg["model_margin"])
    market_margin = float(book["margin"]) if book.get("live") else float(bg["published_margin"])
    market_total = (float(book["total"]) if book.get("live") and book.get("total") is not None
                    else float(bg["market_total"]))
    items: list[tuple[str, str, dict]] = []
    base = {"league": "nfl", "away": away, "home": home}
    P = a.platform

    daypart = kickoff.split("·")[0].strip() if "·" in kickoff else ""
    template = {**base, "platform": P, "eyebrow": " · ".join(x for x in (week, daypart) if x),
                "title": kickoff.split("·")[-1].strip() if "·" in kickoff else kickoff,
                "spread": spread, "total": total, "moneyline": moneyline,
                "lineSource": "current"}
    items.append(("template", f"Template-{P}", template))
    items.append(("template-youtube", "Template-youtube", {**template, "platform": "youtube"}))
    items.append(("bar", "MatchupBarNFL", {
        **base,
        "awayNote": f"{short_name(g.get('away_starter', ''))} · {g.get('away_record', '')}".strip(" ·"),
        "homeNote": f"{short_name(g.get('home_starter', ''))} · {g.get('home_record', '')}".strip(" ·"),
        "centerLabel": f"{a.tag} · DraftKings", "centerValue": spread}))
    items.append(("bug", "CornerBug", {**base, "statLabel": "DraftKings", "statValue": spread}))
    items.append(("bug-wide", "CornerBugWide", {**base, "statLabel": "DraftKings", "statValue": spread}))
    items.append(("sting", "Sting", {"tagline": show}))

    for side, q in (("away", qa), ("home", qh)):
        if not q:
            continue
        team = q["team"]
        lt = {"title": q["player_name"],
              "subtitle": f"QB · {g.get(side + '_name', team)}",
              "stat": f"{q['metrics']['passing_yards']:.1f}",
              "statLabel": "Proj. pass yards", "team": team, "league": "nfl"}
        slug = re.sub(r"[^a-z]+", "-", q["player_name"].lower()).strip("-")
        items.append((f"lower-{slug}", "LowerThird", lt))
        items.append((f"lower-{slug}-wide", "LowerThirdWide", lt))
        items.append((f"callout-{slug}", "Callout", {
            "x": 0.36, "y": 0.46, "label": "Proj. pass yards",
            "value": f"{q['metrics']['passing_yards']:.1f}",
            "sub": f"{q['player_name']} · nfl-model centre", "team": team, "league": "nfl"}))

    cut = {**base, "awayRating": round(float(ta.get("rating", 0)), 1),
           "homeRating": round(float(th.get("rating", 0)), 1),
           "modelMargin": r1(model_margin), "marketMargin": r1(market_margin),
           "winProbability": round(float(bg.get("model_win_probability", bg["win_probability"])), 4),
           "projectedTotal": round(float(bg["projected_total"]), 1),
           "marketTotal": round(market_total, 1),
           "projectedAwayScore": round(float(bg["projected_away_score"]), 1),
           "projectedHomeScore": round(float(bg["projected_home_score"]), 1),
           "kickoff": kickoff, "action": bg.get("action", "MONITOR"),
           "edgeWithheld": bg.get("edge_points") is None,
           "authority": bg.get("authority", board.get("authority", "RESEARCH_ONLY"))}
    if a.take:
        cut["take"] = a.take
    items.append(("cutaway", "NflCutaway", cut))
    items.append(("model-snapshot", "ModelSnapshot", {
        **base, "modelMargin": cut["modelMargin"], "marketMargin": cut["marketMargin"],
        "modelTotal": cut["projectedTotal"], "marketTotal": cut["marketTotal"],
        "winProbability": cut["winProbability"], "edgeWithheld": cut["edgeWithheld"],
        "action": cut["action"]}))

    gap_total = {**base, "platform": P, "eyebrow": f"{a.tag} · Game total",
                 "title": "Market vs Model", "measure": "Points, both teams",
                 "markers": [{"label": "DraftKings", "value": market_total, "kind": "market"},
                             {"label": "Model", "value": round(float(bg["projected_total"]), 1), "kind": "model"}],
                 "unit": "pts", "caveat": RESEARCH}
    gap_margin = {**base, "platform": P, "eyebrow": f"{a.tag} · Spread",
                  "title": "Spread Projection",
                  "measure": f"{home} margin (points)",
                  "markers": [{"label": "DraftKings", "value": round(market_margin, 1), "kind": "market"},
                              {"label": "Model", "value": r1(model_margin), "kind": "model"}],
                  "unit": "pts", "caveat": RESEARCH}
    for name, props in (("gap-total", gap_total), ("gap-margin", gap_margin)):
        items.append((name, "LineGap", props))
        items.append((name + "-wide", "LineGapWide", {**props, "platform": "youtube"}))

    ranked = sorted(board.get("teams", []), key=lambda t: t["rank"])
    top = max((t["rating"] for t in ranked), default=1) or 1
    cut_to = max(8, ta.get("rank", 0), th.get("rank", 0))
    rows = [{"rank": t["rank"], "label": t["name"], "sub": t.get("division", ""),
             "value": f"{t['rating']:.2f}", "team": t["team"], "league": "nfl",
             "share": max(0.0, t["rating"] / top),
             **({"spotlight": True} if t["team"] in (away, home) else {})}
            for t in ranked if t["rank"] <= cut_to][:10]
    items.append(("ranks", "RankCountdown", {
        "platform": P, "eyebrow": f"NFL Power Ratings · {week}",
        "title": "Where These Clubs Rank", "valueLabel": "Rating", "items": rows,
        "note": "Opponent-adjusted rating from nfl-model (research only). These two clubs highlighted."}))

    open_props = {**base, "show": show,
                  "title": a.title or f"{g.get('away_name', away)} at {g.get('home_name', home)}",
                  "awayName": g.get("away_name", away), "homeName": g.get("home_name", home),
                  "kickoff": kickoff, "network": network, "venue": venue}
    items.append(("open", "EpisodeOpen", open_props))
    items.append(("open-vertical", "EpisodeOpenVertical", open_props))

    chapters = ["Cold Open", "The Line", "QB Duel", "Injuries", "Unit Form", "The Read"]
    for i, c in enumerate(chapters, start=1):
        items.append((f"chapter-{i:02d}", "ChapterCard",
                      {"number": i, "title": c, **({"team": home, "league": "nfl"} if i % 2 == 0 else {"team": away, "league": "nfl"})}))
        items.append((f"agenda-{i:02d}", "AgendaRail",
                      {"chapters": chapters, "current": i - 1, "label": f"{a.tag} · {away} at {home}"}))

    items.append(("split-market", "SplitFrame", {
        **base, "camera": "left", "eyebrow": "DraftKings · current", "title": "The Market",
        "kickoff": kickoff,
        "stats": [s for s in (
            {"label": "Spread", "value": spread, "team": fav} if spread else None,
            {"label": "Total", "value": total} if total else None,
            {"label": "Moneyline", "value": moneyline, "team": fav,
             "note": f"{away} {ml_away:+g}" if ml_away is not None and fav == home else ""} if moneyline else None,
        ) if s],
        "footer": lines_note}))
    items.append(("split-model", "SplitFrame", {
        **base, "camera": "right", "eyebrow": "nfl-model · research only", "title": "The Model",
        "kickoff": kickoff,
        "stats": [
            {"label": "Model margin", "value": by_margin(away, home, model_margin),
             "team": home if model_margin >= 0 else away},
            {"label": "Model total", "value": f"{float(bg['projected_total']):.1f}"},
            {"label": f"{home} win probability", "value": f"{float(bg.get('model_win_probability', 0)) * 100:.0f}%",
             "note": f"market {float(bg.get('market_fair_home', 0)) * 100:.0f}%"},
        ],
        "bullets": [bg.get("edge_withheld_reason") or RESEARCH],
        "footer": f"Board generated {board.get('generated_at_utc', '')[:16].replace('T', ' ')} UTC."}))
    items.append(("end-screen", "EndScreen", {"guides": False}))
    items.append(("end-screen-guides", "EndScreen", {"guides": True}))

    thumb = {**base, "line1": f"{g.get('away_name', away).split(' ')[-1]} at {g.get('home_name', home).split(' ')[-1]}",
             "line2": a.thumb or "Market vs Model", "badge": a.tag}
    items.append(("thumbnail", "Thumbnail", thumb))
    items.append(("thumbnail-vertical", "ThumbnailVertical", thumb))

    # Studio graphics from the site's own matchup data: formations with headshots,
    # player cards and filterable stat boards (outputs/video_studio.py).
    props_by_player = {}
    if g.get("id"):
        live_props = player_props(str(g["id"]))
        if live_props:
            prop_list, props_by_player = prop_items(a, g, board, live_props)
            items += prop_list
    if live:
        items.append(line_move_item(a, g, live, model_margin, float(bg["projected_total"])))
    items.append(team_compare_item(a, g, ta, th, bg, spread, total, model_margin, float(bg["projected_total"]), kickoff))
    qb_card = qb_matchup_item(a, g, qa, qh)
    if qb_card:
        items.append(qb_card)
    items += skill_duel_items(a, g)
    items += scheme_diagram_items(a, g)
    items += clash_items(a, g, qa, qh)
    items += cover_heat_items(a, g)
    items += injury_items(a, g)
    items += formation_items(a, g) + player_items(a, g, qbs, props_by_player) + metric_items(a, g)
    try:
        items += last_game_items(a, g)
    except Exception as exc:  # a missing box score should not stop the pack
        print(f"[video-pack] last-game stats unavailable: {exc}")

    meta = {"league": "nfl", "away": away, "home": home, "kickoff": kickoff, "week": week,
            "board_generated": board.get("generated_at_utc"), "book_update": book.get("last_update"),
            "site_slate_game": g.get("id"), "live": bool(book.get("live")),
            "line": " · ".join(x for x in (spread, f"O/U {total}" if total else "") if x)}
    return items, meta


def build_mlb(a, g: dict) -> tuple[list[tuple[str, str, dict]], dict]:
    """MLB carries no market in the published slate, so the pack is identity + starters."""
    away, home = g["away"].upper(), g["home"].upper()
    base = {"league": "mlb", "away": away, "home": home}
    P = a.platform
    items: list[tuple[str, str, dict]] = []
    sp_a, sp_h = g.get("away_starter", ""), g.get("home_starter", "")
    items.append(("template", f"Template-{P}", {**base, "platform": P,
                  "eyebrow": a.tag, "title": f"{short_name(sp_a)} vs {short_name(sp_h)}",
                  "stats": [{"label": f"{away} ERA", "value": str(g.get("away_era", "")), "team": away},
                            {"label": "Venue", "value": g.get("venue", "")},
                            {"label": f"{home} ERA", "value": str(g.get("home_era", "")), "team": home}]}))
    items.append(("bar", "MatchupBarMLB", {**base, "awayNote": f"{short_name(sp_a)} {g.get('away_era', '')}",
                  "homeNote": f"{short_name(sp_h)} {g.get('home_era', '')}",
                  "centerLabel": a.tag, "centerValue": f"{away} @ {home}"}))
    items.append(("bug", "CornerBug", {**base}))
    for side, name in (("away", sp_a), ("home", sp_h)):
        if name:
            team = g[side].upper()
            slug = re.sub(r"[^a-z]+", "-", name.lower()).strip("-")
            items.append((f"lower-{slug}", "LowerThird", {
                "title": name, "subtitle": f"{g.get(side + '_hand', '')}HP · {g.get(side + '_name', team)}",
                "stat": str(g.get(side + "_era", "")), "statLabel": "ERA", "team": team, "league": "mlb"}))
    open_props = {**base, "show": a.show or "MLB Matchup", "title": a.title or f"{g.get('away_name')} at {g.get('home_name')}",
                  "awayName": g.get("away_name"), "homeName": g.get("home_name"),
                  "network": g.get("broadcast", ""), "venue": g.get("venue", "")}
    items.append(("open", "EpisodeOpen", open_props))
    items.append(("open-vertical", "EpisodeOpenVertical", open_props))
    items.append(("sting", "Sting", {"tagline": a.show or "MLB Matchup Research"}))
    items.append(("end-screen", "EndScreen", {"guides": False}))
    thumb = {**base, "line1": f"{away} at {home}", "line2": a.thumb or f"{short_name(sp_a)} vs {short_name(sp_h)}", "badge": a.tag}
    items.append(("thumbnail", "Thumbnail", thumb))
    items.append(("thumbnail-vertical", "ThumbnailVertical", thumb))
    return items, {"league": "mlb", "away": away, "home": home, "site_slate_game": g.get("id")}


def injury_annotations(a, league_game: str, out_dir: Path, day: str) -> list[tuple[str, str, dict]]:
    """Capture the injury formations and turn each into an Annotate item."""
    items = []
    for unit in ("offense", "defense"):
        for side in ("away", "home"):
            art = f"nfl_{unit}_{side}"
            cmd = [sys.executable, "-m", "outputs.content_engine", "deep", "--sport", "nfl",
                   "--games", league_game, "--artifacts", art, "--video",
                   "--video-platform", a.platform, "--date", day]
            print("[video-pack] capturing", art)
            res = subprocess.run(cmd, cwd=PIPELINE, capture_output=True, text=True,
                                 encoding="utf-8", errors="replace")
            if res.returncode != 0:
                print(res.stdout[-800:], res.stderr[-800:])
                fail(f"capture of {art} failed")
            src = VIDEO / "props" / "nfl" / f"deep_{league_game.replace('@', '')}_{art}.annotate.json"
            ann = json.loads(src.read_text(encoding="utf-8"))
            anchors = ann["capture"]["anchors"]
            steps, t = [], 1.0
            report = [x for x in anchors if x["text"].lower().startswith("also on the injury report")]
            backups = [x for x in anchors if x.get("kind", "").startswith("li.ca-avail-row")]
            if report and backups:
                steps.append({"type": "focus", "target": "Also On The Injury Report", "at": t, "dur": 1.0})
                t += 1.1
                for b in backups[:4]:
                    target, label, tone = injury_label(b["text"])
                    steps.append({"type": "highlight", "target": target, "at": round(t, 2),
                                  "text": f"{target} · {label}", "tone": tone,
                                  "until": round(t + 2.2, 2)})
                    t += 1.5
                steps.append({"type": "reset", "at": round(t, 2), "dur": 1.0})
                t += 1.2
            flagged = [x for x in anchors if x.get("kind", "").startswith("article.ca-lineup-player")
                       and any(w in x["text"].upper() for w in ("QUESTIONABLE", "DOUBTFUL", " OUT", "RESERVE"))]
            for f in flagged[:3]:
                # Card text: POSITION NAME... DESIGNATION [detail]
                words = f["text"].split(" ")
                idx = next((i for i, w in enumerate(words)
                            if w.upper() in ("QUESTIONABLE", "DOUBTFUL", "OUT", "INJURED")), len(words))
                target = " ".join(words[1:idx]) or f["text"]
                status = " ".join(words[idx:idx + (2 if idx < len(words) and words[idx].upper() == "INJURED" else 1)])
                steps.append({"type": "circle", "target": target, "at": round(t, 2),
                              "text": status.title(),
                              "tone": "negative" if status.upper() != "QUESTIONABLE" and status.upper() != "DOUBTFUL" else "caution"})
                t += 1.3
            marks = [st for st in steps if st["type"] not in ("focus", "reset")]
            for cur, nxt in zip(marks, marks[1:]):
                cur.setdefault("textUntil", nxt["at"])
            ann["steps"] = steps
            ann["eyebrow"] = f"{a.tag} · Injury report"
            ann["title"] = f"{(league_game.split('@')[0] if side == 'away' else league_game.split('@')[1])} {unit.title()}"
            name = f"annotate-{side}-{unit}"
            items.append((name, "Annotate", ann))
    return items


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--league", choices=("nfl", "mlb"))
    ap.add_argument("--game", help="AWAY@HOME, as the site's slate lists it")
    ap.add_argument("--date", help="MLB: the slate date (default: the site's own)")
    ap.add_argument("--platform", default="reels", choices=("reels", "reels-ads", "tiktok", "shorts"))
    ap.add_argument("--show", help="show / slot name, e.g. 'Thursday Night Football'")
    ap.add_argument("--tag", help="short badge, e.g. 'TNF' (default from --show)")
    ap.add_argument("--title", help="episode title for the open")
    ap.add_argument("--thumb", help="second thumbnail line")
    ap.add_argument("--take", help="your angle, for the cutaway")
    ap.add_argument("--captures", action="store_true",
                    help="NFL: capture the injury formations and build Annotate items")
    ap.add_argument("--refresh", metavar="PACK_DIR",
                    help="re-read live lines and data for an existing pack, with the settings it was "
                         "built with; its injury-board captures are kept (fast: no browser)")
    ap.add_argument("--all", action="store_true",
                    help="build a pack for every game on the live slate (used by the hosted booth deploy)")
    argv = sys.argv[1:]
    a = ap.parse_args(argv)
    reuse: list[tuple[str, str, dict]] = []
    if a.refresh:
        old_dir = Path(a.refresh).resolve()
        old = json.loads((old_dir / "pack.json").read_text(encoding="utf-8"))
        saved = old.get("argv")
        if not saved:
            fail(f"{old_dir} was built before --refresh existed; rebuild it once with the full command")
        a = ap.parse_args(saved)
        argv = saved
        for it in old["items"]:
            if it["composition"] == "Annotate":
                reuse.append((it["name"], it["composition"],
                              json.loads((old_dir / it["props"]).read_text(encoding="utf-8"))))
    if a.all:
        if not a.league:
            ap.error("--league is required with --all")
        board = json.loads(_fetch(f"{SITE_URL}/data/public/{a.league}/slate.json"))
        games = board.get("games") or []
        if not games:
            fail(f"live {a.league} slate has no games")
        for g in games:
            token = f"{g['away']}@{g['home']}"
            cmd = [sys.executable, "-m", "outputs.video_pack", "--league", a.league, "--game", token,
                   "--platform", a.platform]
            if a.date:
                cmd += ["--date", a.date]
            if a.show:
                cmd += ["--show", a.show]
            if a.tag:
                cmd += ["--tag", a.tag]
            print(f"[video-pack] slate {token}")
            r = subprocess.run(cmd, cwd=str(PIPELINE))
            if r.returncode != 0:
                print(f"[video-pack] skip {token} (exit {r.returncode})")
        return
    if not a.league or not a.game:
        ap.error("--league and --game are required (or --refresh PACK_DIR, or --all)")
    if not a.tag:
        a.tag = "".join(w[0] for w in (a.show or "").split()).upper() or a.league.upper()

    g = site_game(a.league, a.game, a.date)
    day = a.date or _et_date(g.get("kickoff_utc", "")) or date.today().isoformat()
    items, meta = build_nfl(a, g) if a.league == "nfl" else build_mlb(a, g)
    out = PACK_ROOT / f"{day}-{meta['away']}-{meta['home']}"
    # Overwrite in place (the recording booth may be reading this folder); files that
    # are no longer part of the pack are removed after the new manifest is written.
    out.mkdir(parents=True, exist_ok=True)
    items += reuse
    if a.captures:
        if a.league != "nfl":
            fail("--captures builds the NFL injury formations; MLB has no equivalent yet")
        items += injury_annotations(a, f"{meta['away']}@{meta['home']}", out, day)

    from datetime import datetime, timezone
    manifest = {"game": meta, "platform": a.platform, "items": [],
                "built_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                # What --refresh replays. Captures are reused, never re-shot, on refresh.
                "argv": [x for x in argv if x != "--captures"]}
    lines = ["@echo off", "REM Render this game pack. Run from the video folder.",
             f"REM {meta['away']} at {meta['home']} - generated by outputs.video_pack", "pushd %~dp0..\\..\\..",
             "if not exist out\\pack mkdir out\\pack"]
    for name, comp, props in items:
        props = complete(comp, props)
        (out / f"{name}.json").write_text(json.dumps(props, indent=2), encoding="utf-8")
        manifest["items"].append({"name": name, "composition": comp, "props": f"{name}.json"})
        rel = f"props/pack/{out.name}/{name}.json"
        if comp in STILLS:
            lines.append(f"call npx remotion still {comp} out/pack/{out.name}/{name}.png --props={rel}")
        else:
            ext = "mov" if comp in ALPHA else "mp4"
            lines.append(f"call npx remotion render {comp} out/pack/{out.name}/{name}.{ext} --props={rel}")
    lines.append(f"REM Stills of everything (hero frames): node scripts/snap.mjs --pack props/pack/{out.name} --out out/pack/{out.name}/snapshots")
    lines.append("popd")
    tmp = out / "pack.json.tmp"
    tmp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    tmp.replace(out / "pack.json")
    (out / "render.bat").write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
    keep = {f"{n}.json" for n, _, _ in items} | {"pack.json", "render.bat"}
    for f in out.glob("*.json"):
        if f.name not in keep:
            f.unlink()
    print(f"[video-pack] {len(items)} item(s) -> {out.relative_to(PIPELINE)}")
    print(f"[video-pack] snapshots: cd video && node scripts/snap.mjs --pack props/pack/{out.name} --out out/pack/{out.name}/snapshots")
    print(f"[video-pack] full render: video\\props\\pack\\{out.name}\\render.bat")


if __name__ == "__main__":
    main()
