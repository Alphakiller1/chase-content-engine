"""Contract-aligned Chase social renderer — HTML + Playwright with live logos/headshots."""
from __future__ import annotations

import html
import math
from pathlib import Path

from chase_content import assets
from chase_content.util import number, truncate

WIDTH = 1080
HEIGHT = 1350

CSS = """
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Roboto+Condensed:wght@600;700;800&display=swap');
:root {
  --canvas: #08090F;
  --surface: #12141D;
  --elevated: #181B26;
  --raised: #20232F;
  --border: #262A38;
  --border-strong: #363B4D;
  --text: #F5F6FA;
  --label: #A4A8B6;
  --meta: #6E7383;
  --disabled: #4C5161;
  --purple: #9A6BFF;
  --purple-dark: #5B2BE0;
  --purple-light: #C4B0FF;
  --positive: #3CCB7F;
  --warn: #E8C24A;
  --risk: #F2545B;
  --violet-border: rgba(154,107,255,0.41);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 1080px; height: 1350px; overflow: hidden;
  background: var(--canvas);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
}
body {
  background:
    radial-gradient(ellipse 70% 45% at 88% 8%, rgba(154,107,255,0.14), transparent 55%),
    radial-gradient(ellipse 55% 40% at 8% 92%, rgba(91,43,224,0.10), transparent 50%),
    var(--canvas);
}
.page {
  width: 1080px; height: 1350px; padding: 45px 60px 56px;
  display: flex; flex-direction: column; position: relative;
}
.header {
  display: flex; flex-direction: column; gap: 10px;
  padding-bottom: 14px; border-bottom: 2px solid var(--border-strong);
  margin-bottom: 14px; min-height: 150px; max-height: 190px;
}
.header-row {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
}
.brand-logo { height: 42px; width: auto; display: block; }
.title {
  font-family: 'Roboto Condensed', sans-serif;
  font-weight: 800; font-size: 44px; letter-spacing: 0.02em;
  background: linear-gradient(180deg, #FFFFFF 0%, #E9EAF0 38%, #9DA0AE 56%, #D7D9E2 72%, #FFFFFF 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  text-transform: uppercase; line-height: 1;
}
.meta-line {
  font-size: 14px; color: var(--meta); font-weight: 500;
  display: flex; justify-content: space-between; gap: 16px;
}
.content { flex: 1; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.footer {
  margin-top: 14px; padding-top: 12px; border-top: 2px solid var(--border);
  display: flex; justify-content: space-between; font-size: 13px; color: var(--meta);
}
.footer .site { color: var(--purple-light); font-weight: 600; }

.card {
  background: linear-gradient(180deg, #1A1D2D 0%, #0D101B 55%, #06070D 100%);
  border: 1.5px solid var(--violet-border);
  border-radius: 20px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
  position: relative; overflow: hidden;
  padding: 18px 22px 16px;
}
.card::before {
  content: ''; position: absolute; left: 18px; right: 18px; top: 0; height: 2px;
  background: linear-gradient(90deg, #7C4DFF, #C4B0FF, #7C4DFF);
}
.panel {
  background: var(--surface);
  border: 1.5px solid var(--violet-border);
  border-radius: 20px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
  padding: 22px 24px;
  position: relative; overflow: hidden;
}
.panel::before {
  content: ''; position: absolute; left: 20px; right: 20px; top: 0; height: 2px;
  background: linear-gradient(90deg, #7C4DFF, #C4B0FF, #7C4DFF);
}
.section-title {
  font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 26px;
  letter-spacing: 0.04em; text-transform: uppercase;
  background: linear-gradient(180deg, #FFFFFF 0%, #E9EAF0 38%, #9DA0AE 56%, #D7D9E2 72%, #FFFFFF 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  margin-bottom: 12px;
}
.num {
  font-family: 'Roboto Condensed', sans-serif; font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.label { color: var(--label); font-size: 15px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }

/* Morning slate matchup card */
.matchup { display: flex; flex-direction: column; gap: 8px; height: 100%; width: 100%; }
.matchup-top {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px;
}
.side { display: flex; align-items: center; gap: 10px; }
.side.home { justify-content: flex-end; flex-direction: row-reverse; }
.team-logo { width: 42px; height: 42px; object-fit: contain; flex-shrink: 0; }
.team-abbr {
  font-family: 'Roboto Condensed', sans-serif; font-weight: 700; font-size: 24px;
  color: var(--text); letter-spacing: 0.02em;
}
.at-medallion {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--raised); border: 1px solid var(--border-strong);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 14px;
  color: var(--purple-light);
}
.rank-time {
  display: flex; justify-content: space-between; align-items: center;
}
.rank { color: var(--purple); font-size: 20px; font-weight: 800; font-family: 'Roboto Condensed', sans-serif; }
.time { color: var(--meta); font-size: 14px; font-weight: 600; }
.sep-tag {
  font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 999px; background: var(--raised);
}
.runs-block {
  display: flex; flex-direction: column; gap: 6px; align-items: center;
  background: rgba(14,16,24,0.65); border: 1px solid var(--border);
  border-radius: 14px; padding: 10px 14px;
}
.runs-label { font-size: 12px; color: var(--label); font-weight: 700; letter-spacing: 0.08em; }
.runs-row {
  display: flex; align-items: baseline; gap: 14px;
  font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 32px;
}
.runs-dash { color: var(--meta); font-size: 22px; }
.pitchers {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.pitcher-line {
  display: flex; gap: 10px; align-items: center;
  background: rgba(32,35,47,0.55); border-radius: 12px; padding: 8px 10px;
  border: 1px solid var(--border);
}
.pitcher-line img {
  width: 44px; height: 44px; border-radius: 50%; object-fit: cover;
  border: 2px solid rgba(154,107,255,0.45);
  box-shadow: 0 0 12px rgba(154,107,255,0.25);
  background: #1a1d28;
}
.pitcher-meta { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pitcher-name {
  font-family: 'Roboto Condensed', sans-serif; font-weight: 700; font-size: 16px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pitcher-stats { font-size: 13px; color: var(--label); font-family: 'Roboto Condensed', sans-serif; font-weight: 600; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.chip {
  font-size: 12px; font-weight: 700; font-family: 'Roboto Condensed', sans-serif;
  padding: 2px 7px; border-radius: 6px; background: rgba(32,35,47,0.9);
  border: 1px solid var(--border);
}
.rail {
  display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto;
}
.opinion {
  display: inline-flex; align-items: center; gap: 8px; min-width: 0;
}
.opinion-tag {
  font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
  padding: 5px 10px; border-radius: 999px; color: #08090F; flex-shrink: 0;
}
.opinion-note {
  font-size: 13px; color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lineup-state { font-size: 12px; color: var(--meta); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }

/* Featured hero */
.hero {
  display: flex; flex-direction: column; gap: 18px; height: 100%;
}
.hero-head {
  display: flex; justify-content: space-between; align-items: flex-start;
}
.hero-kicker {
  font-size: 14px; font-weight: 700; color: var(--purple-light);
  letter-spacing: 0.1em; text-transform: uppercase;
}
.hero-match {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center;
  margin-top: 8px;
}
.hero-side { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.hero-side img.team { width: 88px; height: 88px; object-fit: contain; filter: drop-shadow(0 6px 16px rgba(0,0,0,0.45)); }
.hero-abbr { font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 28px; }
.hero-vs {
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--raised); border: 1.5px solid var(--violet-border);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Roboto Condensed', sans-serif; font-weight: 800; color: var(--purple-light); font-size: 18px;
}
.hero-runs {
  display: flex; justify-content: center; gap: 28px; align-items: baseline;
  font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 56px;
}
.hero-pitchers {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
}
.hero-pitcher {
  background: rgba(14,16,24,0.7); border: 1px solid var(--border);
  border-radius: 18px; padding: 16px; display: flex; gap: 14px; align-items: center;
  width: 100%;
}
.hero-pitcher img {
  width: 92px; height: 92px; border-radius: 50%; object-fit: cover; object-position: center top;
  border: 2.5px solid rgba(154,107,255,0.55);
  box-shadow: 0 0 22px rgba(154,107,255,0.35);
  background: #151822;
}
.hero-pname { font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 22px; }
.hero-phand { color: var(--meta); font-size: 13px; font-weight: 600; margin-top: 2px; }
.metric-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px;
}
.metric-cell {
  background: var(--raised); border-radius: 10px; padding: 8px 10px; text-align: center;
  border: 1px solid var(--border);
}
.metric-cell .v { font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 22px; }
.metric-cell .l { font-size: 11px; color: var(--label); font-weight: 700; letter-spacing: 0.04em; margin-top: 2px; }
.edge-banner {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(154,107,255,0.12); border: 1px solid var(--violet-border);
  border-radius: 14px; padding: 14px 18px;
}
.edge-banner .big {
  font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 34px; color: var(--purple-light);
}

/* Rank / market rows */
.grid-2x2 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 14px; flex: 1; }
.rank-row {
  display: grid; grid-template-columns: 28px 40px 1fr auto; gap: 10px;
  align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);
}
.rank-row:last-child { border-bottom: none; }
.rank-row img { width: 36px; height: 36px; object-fit: contain; }
.rank-n { color: var(--purple); font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 18px; }
.rank-team { font-family: 'Roboto Condensed', sans-serif; font-weight: 700; font-size: 22px; }
.rank-sub { font-size: 12px; color: var(--meta); margin-top: 2px; }
.rank-val { font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 24px; }
.market-stack { display: flex; flex-direction: column; gap: 14px; flex: 1; }
.market-row {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 12px 0; border-bottom: 1px solid var(--border);
}
.market-row:last-child { border-bottom: none; }
.market-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.market-left img { width: 32px; height: 32px; object-fit: contain; }
.market-label { font-family: 'Roboto Condensed', sans-serif; font-weight: 700; font-size: 18px; }
.market-sub { font-size: 12px; color: var(--meta); margin-top: 2px; }
.market-right { text-align: right; flex-shrink: 0; }
.pub { color: var(--label); font-family: 'Roboto Condensed', sans-serif; font-weight: 700; font-size: 18px; }
.sharp { color: var(--purple-light); font-family: 'Roboto Condensed', sans-serif; font-weight: 800; font-size: 18px; }
.empty { color: var(--meta); font-size: 18px; padding: 20px 0; }
"""


def _esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def _date_label(bundle: dict) -> str:
    return str((bundle.get("meta") or {}).get("slate_date") or "Date unavailable")


def _updated_label(bundle: dict) -> str:
    raw = str((bundle.get("meta") or {}).get("generated_at") or "")
    return raw.replace("T", " ")[:19] + (" UTC" if raw else "")


def _run_sep(game: dict) -> float:
    proj = game.get("projection") or {}
    away = number(proj.get("away_runs"))
    home = number(proj.get("home_runs"))
    if away is None or home is None:
        return -1.0
    return abs(home - away)


def _separation_label(sep: float) -> tuple[str, str]:
    if sep >= 1.5:
        return "LOPSIDED", "#F2545B"
    if sep >= 1.0:
        return "CLEAR EDGE", "#E8C24A"
    if sep >= 0.5:
        return "LEAN", "#C4B0FF"
    return "TOSS-UP", "#6E7383"


def _opinion_colors(tag: str) -> str:
    return {
        "MY BET": "#3CCB7F",
        "LEAN": "#9A6BFF",
        "WATCH": "#E8C24A",
        "PASS": "#6E7383",
        "NO OPINION": "#6E7383",
    }.get(tag, "#6E7383")


def _logo_img(team: str, cls: str = "team-logo") -> str:
    path = assets.team_logo_file(team, required=True)
    return f'<img class="{cls}" src="{_esc(assets.data_uri(path))}" alt="{_esc(team)}" />'


def _headshot_img(mlb_id, size_cls: str = "") -> str:
    path = assets.headshot_file(mlb_id, required=False)
    if path is None:
        return ""
    cls = f' class="{size_cls}"' if size_cls else ""
    return f'<img{cls} src="{_esc(assets.data_uri(path))}" alt="" />'


def _pitcher_proj_line(pitcher: dict) -> str:
    name = truncate(pitcher.get("name") or "TBD", 18)
    hand = str(pitcher.get("hand") or "").upper()
    ip = number(pitcher.get("projected_ip"))
    er = number(pitcher.get("projected_er"))
    k = number(pitcher.get("projected_k"))
    bits = []
    if ip is not None:
        bits.append(f"{ip:.1f} IP")
    if er is not None:
        bits.append(f'<span style="color:{assets.er_color(er)}">{er:.1f} ER</span>')
    if k is not None:
        bits.append(f"{k:.1f} K")
    stats = " · ".join(bits) if bits else "projection pending"
    hand_bit = f" ({hand})" if hand else ""
    return name + hand_bit, stats


def _fmt_pct(value) -> str:
    v = number(value)
    if v is None:
        return "—"
    # Accept either 0-1 or already percent-like
    if v <= 1.5:
        v *= 100
    return f"{v:.1f}%"


def _page_shell(title: str, meta_left: str, meta_right: str, body: str, updated: str) -> str:
    logo = assets.data_uri(assets.chase_logo_path())
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>{CSS}</style></head>
<body><div class="page">
  <header class="header">
    <div class="header-row">
      <img class="brand-logo" src="{_esc(logo)}" alt="Chase Analytics" />
      <div class="title">{_esc(title)}</div>
    </div>
    <div class="meta-line"><span>{_esc(meta_left)}</span><span>{_esc(meta_right)}</span></div>
  </header>
  <main class="content">{body}</main>
  <footer class="footer">
    <span>Updated {_esc(updated)} · Model projections are not guarantees.</span>
    <span class="site">chase-analytics.com</span>
  </footer>
</div></body></html>"""


def _matchup_card_html(game: dict, rank: int, *, portraits: bool = True) -> str:
    away, home = game.get("away", "AWY"), game.get("home", "HME")
    proj = game.get("projection") or {}
    away_runs = number(proj.get("away_runs"))
    home_runs = number(proj.get("home_runs"))
    sep = _run_sep(game)
    sep_label, sep_color = _separation_label(sep if sep >= 0 else 0)
    opinion = game.get("opinion") or {}
    tag = str(opinion.get("tag") or "NO OPINION").upper()
    note = truncate(opinion.get("text"), 48)
    away_p = game.get("away_pitcher") or {}
    home_p = game.get("home_pitcher") or {}
    aname, astats = _pitcher_proj_line(away_p)
    hname, hstats = _pitcher_proj_line(home_p)
    away_osi = number(game.get("away_osi"))
    home_osi = number(game.get("home_osi"))
    away_ps = number(away_p.get("pitch_score") or game.get("away_pitch_score"))
    home_ps = number(home_p.get("pitch_score") or game.get("home_pitch_score"))
    edge = str(game.get("lineup_edge") or "").strip()
    conf = proj.get("confidence")
    conf_txt = f" · conf {conf}" if conf not in (None, "") else ""

    away_shot = _headshot_img(away_p.get("mlb_id")) if portraits else ""
    home_shot = _headshot_img(home_p.get("mlb_id")) if portraits else ""

    runs_html = (
        f'<span class="num" style="color:{assets.runs_color(away_runs)}">{away_runs:.1f}</span>'
        f'<span class="runs-dash">—</span>'
        f'<span class="num" style="color:{assets.runs_color(home_runs)}">{home_runs:.1f}</span>'
        if away_runs is not None and home_runs is not None
        else '<span class="num" style="color:var(--disabled)">pending</span>'
    )

    chips_away = []
    chips_home = []
    if away_osi is not None:
        chips_away.append(
            f'<span class="chip" style="color:{assets.osi_color(away_osi)}">OSI {away_osi:.1f}</span>'
        )
    if away_ps is not None:
        chips_away.append(
            f'<span class="chip" style="color:{assets.pitch_score_color(away_ps)}">PS {away_ps:.0f}</span>'
        )
    if home_osi is not None:
        chips_home.append(
            f'<span class="chip" style="color:{assets.osi_color(home_osi)}">OSI {home_osi:.1f}</span>'
        )
    if home_ps is not None:
        chips_home.append(
            f'<span class="chip" style="color:{assets.pitch_score_color(home_ps)}">PS {home_ps:.0f}</span>'
        )

    return f"""
    <article class="card matchup">
      <div class="rank-time">
        <span class="rank">#{rank}</span>
        <span class="sep-tag" style="color:{sep_color}">{_esc(sep_label)}</span>
        <span class="time">{_esc((game.get('time') or 'TBD') + conf_txt)}</span>
      </div>
      <div class="matchup-top">
        <div class="side">
          {_logo_img(away)}
          <span class="team-abbr">{_esc(away)}</span>
        </div>
        <div class="at-medallion">@</div>
        <div class="side home">
          {_logo_img(home)}
          <span class="team-abbr">{_esc(home)}</span>
        </div>
      </div>
      <div class="runs-block">
        <div class="runs-label">Run Projection</div>
        <div class="runs-row">{runs_html}</div>
      </div>
      <div class="pitchers">
        <div class="pitcher-line">
          {away_shot}
          <div class="pitcher-meta">
            <div class="pitcher-name">{_esc(aname)}</div>
            <div class="pitcher-stats">{astats}</div>
            <div class="chips">{''.join(chips_away)}</div>
          </div>
        </div>
        <div class="pitcher-line">
          {home_shot}
          <div class="pitcher-meta">
            <div class="pitcher-name">{_esc(hname)}</div>
            <div class="pitcher-stats">{hstats}</div>
            <div class="chips">{''.join(chips_home)}</div>
          </div>
        </div>
      </div>
      <div class="rail">
        <div class="opinion">
          <span class="opinion-tag" style="background:{_opinion_colors(tag)}">{_esc(tag)}</span>
          <span class="opinion-note">{_esc(note or edge)}</span>
        </div>
        <span class="lineup-state">{_esc(str(game.get('lineup_status') or 'projected').title())}</span>
      </div>
    </article>"""


def _featured_html(game: dict, rank: int) -> str:
    away, home = game.get("away", "AWY"), game.get("home", "HME")
    proj = game.get("projection") or {}
    away_runs = number(proj.get("away_runs"))
    home_runs = number(proj.get("home_runs"))
    away_p = game.get("away_pitcher") or {}
    home_p = game.get("home_pitcher") or {}
    sep = _run_sep(game)
    sep_label, sep_color = _separation_label(sep if sep >= 0 else 0)
    opinion = game.get("opinion") or {}
    tag = str(opinion.get("tag") or "NO OPINION").upper()
    note = truncate(opinion.get("text"), 70)
    edge = str(game.get("lineup_edge") or "").strip() or "—"

    def side_block(team, pitcher, runs, osi, side_label):
        shot = _headshot_img(pitcher.get("mlb_id"))
        ps = number(pitcher.get("pitch_score"))
        k = number(pitcher.get("k_pct"))
        bb = number(pitcher.get("bb_pct"))
        fip = number(pitcher.get("fip"))
        hand = str(pitcher.get("hand") or "").upper()
        name = pitcher.get("name") or "TBD"
        return f"""
        <div class="hero-side">
          {_logo_img(team, 'team')}
          <div class="hero-abbr">{_esc(team)}</div>
          <div class="hero-pitcher" style="width:100%; text-align:left;">
            {shot or '<div style="width:92px;height:92px;border-radius:50%;background:#1a1d28;border:2px solid #363B4D;flex-shrink:0;"></div>'}
            <div style="min-width:0;flex:1;">
              <div class="hero-pname">{_esc(truncate(name, 18))}</div>
              <div class="hero-phand">{_esc(side_label)} · {_esc(hand) or '—'}HP</div>
              <div class="metric-grid">
                <div class="metric-cell"><div class="v" style="color:{assets.runs_color(runs)}">{f'{runs:.1f}' if runs is not None else '—'}</div><div class="l">RUNS</div></div>
                <div class="metric-cell"><div class="v" style="color:{assets.osi_color(osi)}">{f'{osi:.1f}' if osi is not None else '—'}</div><div class="l">OSI</div></div>
                <div class="metric-cell"><div class="v" style="color:{assets.pitch_score_color(ps)}">{f'{ps:.0f}' if ps is not None else '—'}</div><div class="l">PS</div></div>
                <div class="metric-cell"><div class="v">{_fmt_pct(k)}</div><div class="l">K%</div></div>
                <div class="metric-cell"><div class="v">{_fmt_pct(bb)}</div><div class="l">BB%</div></div>
                <div class="metric-cell"><div class="v">{f'{fip:.2f}' if fip is not None else '—'}</div><div class="l">FIP</div></div>
              </div>
            </div>
          </div>
        </div>"""

    return f"""
    <article class="card hero" style="flex:1;">
      <div class="hero-head">
        <div>
          <div class="hero-kicker">Featured Matchup · #{rank}</div>
          <div style="margin-top:6px;color:var(--meta);font-size:14px;font-weight:600;">{_esc(game.get('time') or 'TBD')}</div>
        </div>
        <span class="sep-tag" style="color:{sep_color}">{_esc(sep_label)}</span>
      </div>
      <div class="hero-match">
        {side_block(away, away_p, away_runs, number(game.get('away_osi')), 'AWAY')}
        <div class="hero-vs">@</div>
        {side_block(home, home_p, home_runs, number(game.get('home_osi')), 'HOME')}
      </div>
      <div class="edge-banner">
        <div>
          <div class="label">Lineup Edge</div>
          <div class="big">{_esc(edge)}</div>
        </div>
        <div class="opinion" style="flex-direction:column;align-items:flex-end;gap:8px;">
          <span class="opinion-tag" style="background:{_opinion_colors(tag)}">{_esc(tag)}</span>
          <span class="opinion-note" style="max-width:360px;text-align:right;white-space:normal;">{_esc(note)}</span>
        </div>
      </div>
    </article>"""


def _rank_panel(title: str, rows: list[dict], metric: str) -> str:
    items = []
    for i, row in enumerate(rows[:5], start=1):
        team = str(row.get("team") or "—")
        value = number(row.get(metric))
        if metric == "delta":
            color = assets.delta_color(value)
            label = f"{value:+.1f}" if value is not None else "—"
            sub = (
                f"YTD {number(row.get('osi_ytd')) or 0:.1f} → L7 {number(row.get('osi_l7')) or 0:.1f}"
            )
        else:
            color = assets.osi_color(value)
            label = f"{value:.1f}" if value is not None else "—"
            sub = "Offensive Strength Index"
        try:
            logo = _logo_img(team)
        except RuntimeError:
            logo = f'<div style="width:36px;height:36px;border-radius:8px;background:#20232F;"></div>'
        items.append(f"""
          <div class="rank-row">
            <div class="rank-n">{i}</div>
            {logo}
            <div>
              <div class="rank-team">{_esc(team)}</div>
              <div class="rank-sub">{_esc(sub)}</div>
            </div>
            <div class="rank-val" style="color:{color}">{_esc(label)}</div>
          </div>""")
    return f'<section class="panel"><div class="section-title">{_esc(title)}</div>{"".join(items)}</section>'


def _team_from_game_key(game: str) -> str | None:
    raw = str(game or "")
    if "@" in raw:
        parts = raw.split("@")
        # Prefer home for market selection context when selection matches
        return parts[-1].strip().upper() or None
    return None


def _market_panel(category: str, rows: list[dict]) -> str:
    title = {"pitching": "PITCHING", "ml": "MONEYLINE", "totals": "TOTALS"}[category]
    if not rows:
        body = '<div class="empty">No current paired market observations.</div>'
    else:
        items = []
        for row in rows[:4]:
            game = str(row.get("game") or "")
            selection = str(row.get("selection") or row.get("market") or "")
            label = truncate(" · ".join(p for p in (game, selection) if p), 42)
            public = (number(row.get("public_probability")) or 0) * 100
            sharp = (number(row.get("sharp_probability")) or 0) * 100
            div = (number(row.get("divergence")) or 0) * 100
            div_color = assets.metric_color(abs(div), mean=1.0, std=1.5)
            team = None
            sel_u = selection.strip().upper()
            if sel_u in assets.ESPN_ABBR_MAP or len(sel_u) <= 3:
                team = sel_u if sel_u in assets.ESPN_ABBR_MAP or sel_u.isalpha() else None
            if team is None and "@" in game:
                # try match selection to away/home
                away, home = game.split("@", 1)
                if sel_u == away.strip().upper():
                    team = away.strip().upper()
                elif sel_u == home.strip().upper():
                    team = home.strip().upper()
                else:
                    team = home.strip().upper()
            logo = ""
            if team:
                try:
                    logo = _logo_img(team)
                except RuntimeError:
                    logo = ""
            items.append(f"""
              <div class="market-row">
                <div class="market-left">
                  {logo}
                  <div>
                    <div class="market-label">{_esc(label)}</div>
                    <div class="market-sub">{_esc(truncate(row.get('snapshot_time'), 36))}</div>
                  </div>
                </div>
                <div class="market-right">
                  <div><span class="pub">{public:.1f}%</span> → <span class="sharp">{sharp:.1f}%</span></div>
                  <div class="num" style="color:{div_color};font-size:16px;margin-top:2px;">{div:+.1f}</div>
                </div>
              </div>""")
        body = "".join(items)
    return f"""
    <section class="panel" style="flex:1;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div class="section-title" style="margin-bottom:4px;">{title}</div>
        <div class="label" style="color:var(--purple-light);">PUBLIC → SHARP</div>
      </div>
      {body}
    </section>"""


def _screenshot(html_doc: str, out_path: Path) -> Path:
    from playwright.sync_api import sync_playwright

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=2,
        )
        page.set_content(html_doc, wait_until="load")
        page.evaluate("() => document.fonts.ready")
        page.wait_for_timeout(250)
        page.screenshot(path=str(out_path), type="png", full_page=False)
        browser.close()
    return out_path


def render_morning_slate(bundle: dict, out_dir: Path) -> list[Path]:
    games = list(bundle.get("games") or [])
    games.sort(key=_run_sep, reverse=True)
    # Contract: max 3 pages × 4 cards (standard). Drop lowest-separation overflow.
    per_page = 4
    pages = min(3, max(1, math.ceil(min(len(games), 12) / per_page)))
    games = games[: pages * per_page]
    paths = []
    date = _date_label(bundle)
    updated = _updated_label(bundle)
    for page_index in range(pages):
        page_games = games[page_index * per_page : (page_index + 1) * per_page]
        cards = []
        for offset, game in enumerate(page_games):
            rank = page_index * per_page + offset + 1
            cards.append(_matchup_card_html(game, rank, portraits=True))
        # Equal-height flex children
        body = (
            '<div style="display:flex;flex-direction:column;gap:14px;flex:1;min-height:0;">'
            + "".join(
                f'<div style="flex:1;min-height:0;display:flex;">{c}</div>' for c in cards
            )
            + "</div>"
        )
        doc = _page_shell(
            "Morning Slate",
            f"{date} · ranked by run separation",
            f"{page_index + 1} / {pages}" if pages > 1 else "1 / 1",
            body,
            updated,
        )
        path = out_dir / f"morning-slate-{page_index + 1:02d}.png"
        paths.append(_screenshot(doc, path))
    return paths


def render_featured_matchups(bundle: dict, out_dir: Path, *, limit: int = 3) -> list[Path]:
    """Standout hero cards with logos + verified pitcher headshots."""
    games = list(bundle.get("games") or [])

    def _edge_mag(game: dict) -> float:
        raw = str(game.get("lineup_edge") or "")
        import re

        m = re.search(r"([-+]?\d+(?:\.\d+)?)", raw)
        return abs(float(m.group(1))) if m else 0.0

    def _primetime(game: dict) -> float:
        t = str(game.get("time") or "").upper()
        if "PM ET" not in t:
            return 0.0
        # Boost 7pm+ / 8pm+ / 10pm cards for social standout
        hour_bit = t.split(":", 1)[0].strip()
        try:
            hour = int("".join(ch for ch in hour_bit if ch.isdigit()) or "0")
        except ValueError:
            return 0.0
        if "PM" in t and hour != 12 and hour >= 7:
            return 3.0
        if "PM" in t and hour >= 4:
            return 0.5
        return 0.0

    def _score(game: dict) -> float:
        return _run_sep(game) * 2.0 + _edge_mag(game) / 10.0 + _primetime(game)

    def _star_power(game: dict) -> float:
        away_ps = number((game.get("away_pitcher") or {}).get("pitch_score") or game.get("away_pitch_score")) or 0
        home_ps = number((game.get("home_pitcher") or {}).get("pitch_score") or game.get("home_pitch_score")) or 0
        away_osi = number(game.get("away_osi")) or 0
        home_osi = number(game.get("home_osi")) or 0
        return max(away_ps, home_ps) + 0.15 * max(away_osi, home_osi) + _primetime(game) * 10

    # Always include: largest run-sep, largest lineup edge, and highest star-power/primetime
    by_sep = sorted(games, key=_run_sep, reverse=True)
    by_edge = sorted(games, key=_edge_mag, reverse=True)
    by_star = sorted(games, key=_star_power, reverse=True)
    picked: list[dict] = []
    for candidate in (by_sep[:1] + by_edge[:1] + by_star[:1] + sorted(games, key=_score, reverse=True)):
        key = candidate.get("key")
        if key and key not in {g.get("key") for g in picked}:
            picked.append(candidate)
        if len(picked) >= limit:
            break
    featured = picked[:limit]
    paths = []
    date = _date_label(bundle)
    updated = _updated_label(bundle)
    for i, game in enumerate(featured, start=1):
        body = _featured_html(game, i)
        doc = _page_shell(
            "Featured Matchup",
            f"{date} · {game.get('key')}",
            f"{i} / {len(featured)}",
            body,
            updated,
        )
        path = out_dir / f"featured-matchup-{i:02d}.png"
        paths.append(_screenshot(doc, path))
    return paths


def render_offensive_report(bundle: dict, out_dir: Path) -> list[Path]:
    offense = bundle.get("offense") or {}
    body = f"""
    <div class="grid-2x2">
      {_rank_panel("Top vs Righties", offense.get("vs_rhp") or [], "osi")}
      {_rank_panel("Top vs Lefties", offense.get("vs_lhp") or [], "osi")}
      {_rank_panel("Risers", offense.get("risers") or [], "delta")}
      {_rank_panel("Fallers", offense.get("fallers") or [], "delta")}
    </div>"""
    doc = _page_shell(
        "Offensive Report",
        f"{_date_label(bundle)} · handedness + L7 movement",
        "",
        body,
        _updated_label(bundle),
    )
    path = out_dir / "offensive-report.png"
    return [_screenshot(doc, path)]


def render_public_vs_sharp(bundle: dict, out_dir: Path) -> list[Path]:
    markets = bundle.get("markets") or {}
    body = f"""
    <div class="market-stack">
      {_market_panel("pitching", markets.get("pitching") or [])}
      {_market_panel("ml", markets.get("ml") or [])}
      {_market_panel("totals", markets.get("totals") or [])}
    </div>"""
    doc = _page_shell(
        "Public vs Sharp",
        f"{_date_label(bundle)} · paired de-vigged observations",
        "",
        body,
        _updated_label(bundle),
    )
    path = out_dir / "public-vs-sharp.png"
    return [_screenshot(doc, path)]


def render_reports(bundle: dict, out_dir: Path, report: str = "all") -> list[Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    # Fail-closed on Chase logo before any export
    assets.chase_logo_path()
    paths: list[Path] = []
    if report in {"all", "morning-slate"}:
        paths.extend(render_morning_slate(bundle, out_dir))
    if report in {"all", "featured", "featured-matchup"}:
        paths.extend(render_featured_matchups(bundle, out_dir))
    if report in {"all", "offensive-report"}:
        paths.extend(render_offensive_report(bundle, out_dir))
    if report in {"all", "public-vs-sharp"}:
        paths.extend(render_public_vs_sharp(bundle, out_dir))
    return paths
