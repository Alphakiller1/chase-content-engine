/**
 * Studio samples for the studio graphics (Formation, PlayerCard, MetricBoard):
 * Thursday Night Football, DET at BUF, from the site's matchup data on 2026-09-17.
 * Headshots are left out (they live in the gitignored public/players/); real
 * renders take the pack's props, which carry them.
 */
import type { FormationProps } from "../studio/Formation";
import type { MetricBoardProps } from "../studio/MetricBoard";
import type { PlayerCardProps } from "../studio/PlayerCard";
import type { LineMoveProps } from "../studio/LineMove";
import type { PropBoardProps } from "../studio/PropBoard";
import type { LastGameProps } from "../studio/LastGame";
import type { TeamCompareProps } from "../studio/TeamCompare";
import type { QbMatchupProps } from "../studio/QbMatchup";
import type { SchemeDiagramProps } from "../studio/SchemeDiagram";
import type { MixTableProps } from "../studio/MixTable";
import type { InjuryBoardProps } from "../studio/InjuryBoard";
import type { ClashBoardProps } from "../studio/ClashBoard";
import type { CoverHeatProps } from "../studio/CoverHeat";

export const SAMPLE_FORMATION: FormationProps = {
  "league": "nfl",
  "team": "BUF",
  "opponent": "DET",
  "unit": "offense",
  "teamName": "Buffalo Bills",
  "package": "3WR 1TE",
  "eyebrow": "TNF \u00b7 BUF offense",
  "title": "Bills Offense",
  "players": [
    {
      "name": "DJ Moore",
      "position": "WR",
      "group": "Receivers",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Khalil Shakir",
      "position": "WR",
      "group": "Receivers",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Keon Coleman",
      "position": "WR",
      "group": "Receivers",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Dion Dawkins",
      "position": "LT",
      "group": "Offensive Line",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Alec Anderson",
      "position": "LG",
      "group": "Offensive Line",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Connor McGovern",
      "position": "C",
      "group": "Offensive Line",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "O'Cyrus Torrence",
      "position": "RG",
      "group": "Offensive Line",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Spencer Brown",
      "position": "RT",
      "group": "Offensive Line",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Josh Allen",
      "position": "QB",
      "group": "Backfield",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "Dalton Kincaid",
      "position": "TE",
      "group": "Receivers",
      "headshot": null,
      "status": "",
      "detail": ""
    },
    {
      "name": "James Cook III",
      "position": "RB",
      "group": "Backfield",
      "headshot": null,
      "status": "",
      "detail": ""
    }
  ],
  "backups": [
    {
      "name": "Tyrell Shavers",
      "position": "WR",
      "status": "Out",
      "detail": ""
    },
    {
      "name": "Ty Johnson",
      "position": "RB",
      "status": "Questionable",
      "detail": "hamstring"
    }
  ],
  "focus": "Josh Allen",
  "focusAt": 2.5,
  "alignment": "shotgun",
  "source": "ESPN depth chart \u00b7 2026-09-16"
};

export const SAMPLE_PLAYER: PlayerCardProps = {
  "league": "nfl",
  "team": "BUF",
  "teamName": "Buffalo Bills",
  "name": "Josh Allen",
  "position": "QB",
  "role": "QB1",
  "headshot": null,
  "status": "Active",
  "detail": "",
  "stats": [
    {
      "label": "Pass yards",
      "value": "243.4"
    },
    {
      "label": "Pass TDs",
      "value": "2.04"
    },
    {
      "label": "Interceptions",
      "value": "0.59"
    },
    {
      "label": "Rush yards",
      "value": "30.4"
    }
  ],
  "statsLabel": "nfl-model next-game centres \u00b7 research only",
  "eyebrow": "TNF \u00b7 BUF QB"
};

export const SAMPLE_METRICS: MetricBoardProps = {
  "league": "nfl",
  "away": "DET",
  "home": "BUF",
  "awayName": "Detroit Lions",
  "homeName": "Buffalo Bills",
  "eyebrow": "TNF \u00b7 Scheme \u00b7 defense",
  "title": "How They Cover",
  "rows": [
    {
      "label": "Man coverage",
      "better": null,
      "away": {
        "value": 0.4037,
        "display": "40.4%",
        "rank": 4,
        "of": 32
      },
      "home": {
        "value": 0.316,
        "display": "31.6%",
        "rank": 15,
        "of": 32
      }
    },
    {
      "label": "Zone coverage",
      "better": null,
      "away": {
        "value": 0.5963,
        "display": "59.6%",
        "rank": 29,
        "of": 32
      },
      "home": {
        "value": 0.684,
        "display": "68.4%",
        "rank": 18,
        "of": 32
      }
    }
  ],
  "mixes": [
    {
      "label": "Coverage shells",
      "segments": [
        {
          "label": "C0",
          "away": 0.0293,
          "home": 0.0342
        },
        {
          "label": "C1",
          "away": 0.2752,
          "home": 0.1923
        },
        {
          "label": "C2",
          "away": 0.183,
          "home": 0.26
        },
        {
          "label": "C3",
          "away": 0.2822,
          "home": 0.2368
        },
        {
          "label": "C4",
          "away": 0.0791,
          "home": 0.1091
        },
        {
          "label": "C6",
          "away": 0.0421,
          "home": 0.0667
        }
      ]
    }
  ],
  "rankKind": "frequency",
  "note": "Share of snaps; badge = league frequency rank (1 = most often)."
};

export const SAMPLE_LINE_MOVE: LineMoveProps = {
  "league": "nfl",
  "away": "DET",
  "home": "BUF",
  "awayName": "Detroit Lions",
  "homeName": "Buffalo Bills",
  "eyebrow": "TNF \u00b7 DraftKings \u00b7 live",
  "title": "Where the Line Has Moved",
  "rows": [
    {
      "label": "Spread",
      "open": "BUF -3",
      "current": "BUF -5.5",
      "openValue": 3.0,
      "currentValue": 5.5,
      "move": "2.5 pts toward BUF",
      "team": "BUF",
      "unit": "BUF margin",
      "juice": ""
    },
    {
      "label": "Total",
      "open": "52.5",
      "current": "54.5",
      "openValue": 52.5,
      "currentValue": 54.5,
      "move": "Up 2",
      "team": null,
      "unit": "points",
      "juice": "Over -120 \u00b7 Under +100"
    },
    {
      "label": "BUF moneyline",
      "open": "-162",
      "current": "-250",
      "openValue": -162.0,
      "currentValue": -250.0,
      "move": "",
      "team": "BUF",
      "unit": "American odds",
      "juice": ""
    },
    {
      "label": "DET moneyline",
      "open": "+136",
      "current": "+205",
      "openValue": 136.0,
      "currentValue": 205.0,
      "move": "",
      "team": "DET",
      "unit": "American odds",
      "juice": ""
    }
  ],
  "winOpen": 0.5934,
  "winCurrent": 0.6854,
  "model": "nfl-model (research only): BUF by 1.4, total 48.8",
  "updated": "2026-09-17T16:50:07Z"
};

export const SAMPLE_PROPS: PropBoardProps = {
  "league": "nfl",
  "away": "DET",
  "home": "BUF",
  "note": "DraftKings line (live) vs nfl-model projection. The model is research only and does not price props: a gap is a disagreement, not an edge.",
  "eyebrow": "TNF \u00b7 Player props \u00b7 DraftKings live",
  "title": "Biggest Gaps",
  "rows": [
    {
      "key": "keoncoleman",
      "name": "Keon Coleman",
      "team": "BUF",
      "position": "WR",
      "headshot": null,
      "market": "Rec yards",
      "group": "receiving",
      "line": 14.5,
      "open": 10.5,
      "model": 29.22,
      "diff": 14.72,
      "pct": 1.0152,
      "score": 3.8657
    },
    {
      "key": "dawsonknox",
      "name": "Dawson Knox",
      "team": "BUF",
      "position": "TE",
      "headshot": null,
      "market": "Rec yards",
      "group": "receiving",
      "line": 12.5,
      "open": 13.5,
      "model": 21.33,
      "diff": 8.83,
      "pct": 0.7064,
      "score": 2.4975
    },
    {
      "key": "djmoore",
      "name": "DJ Moore",
      "team": "BUF",
      "position": "WR",
      "headshot": null,
      "market": "Rec yards",
      "group": "receiving",
      "line": 63.5,
      "open": 61.5,
      "model": 46.88,
      "diff": -16.62,
      "pct": -0.2617,
      "score": 2.0857
    },
    {
      "key": "jamescook",
      "name": "James Cook",
      "team": "BUF",
      "position": "RB",
      "headshot": null,
      "market": "Rush + rec yards",
      "group": "rushing",
      "line": 103.5,
      "open": 100.5,
      "model": 87.49,
      "diff": -16.01,
      "pct": -0.1547,
      "score": 1.5737
    },
    {
      "key": "samlaporta",
      "name": "Sam LaPorta",
      "team": "DET",
      "position": "TE",
      "headshot": null,
      "market": "Rec yards",
      "group": "receiving",
      "line": 46.5,
      "open": 44.5,
      "model": 36.3,
      "diff": -10.2,
      "pct": -0.2194,
      "score": 1.4958
    },
    {
      "key": "jaredgoff",
      "name": "Jared Goff",
      "team": "DET",
      "position": "QB",
      "headshot": null,
      "market": "Pass yards",
      "group": "passing",
      "line": 256.5,
      "open": 256.5,
      "model": 235.74,
      "diff": -20.76,
      "pct": -0.0809,
      "score": 1.2962
    }
  ]
};

export const SAMPLE_LAST_GAME: LastGameProps = {
  "league": "nfl",
  "team": "DET",
  "teamName": "Detroit Lions",
  "opponent": "NO",
  "home": true,
  "result": "W",
  "score": "31–30",
  "week": "Week 1",
  "eyebrow": "TNF · DET last game",
  "view": "Passing",
  "title": "Through the Air",
  "tiles": [
    {
      "label": "Comp / Att",
      "value": "26/39"
    },
    {
      "label": "Net pass yds",
      "value": "204"
    },
    {
      "label": "Yds / pass",
      "value": "5.1"
    },
    {
      "label": "Pass 1st downs",
      "value": "10"
    },
    {
      "label": "INT thrown",
      "value": "0"
    },
    {
      "label": "Sacked",
      "value": "1"
    }
  ],
  "people": [
    {
      "name": "Jared Goff",
      "position": "QB",
      "headshot": null,
      "line": "26/39 · 206 yds",
      "stats": [
        {
          "label": "TD",
          "value": "2"
        },
        {
          "label": "INT",
          "value": "0"
        },
        {
          "label": "Rating",
          "value": "96.7"
        }
      ]
    },
    {
      "name": "Amon-Ra St. Brown",
      "position": "",
      "headshot": null,
      "line": "10 rec · 67 yds",
      "stats": [
        {
          "label": "TD",
          "value": "2"
        },
        {
          "label": "Targets",
          "value": "14"
        },
        {
          "label": "Long",
          "value": "19"
        }
      ]
    },
    {
      "name": "Sam LaPorta",
      "position": "",
      "headshot": null,
      "line": "5 rec · 48 yds",
      "stats": [
        {
          "label": "TD",
          "value": "0"
        },
        {
          "label": "Targets",
          "value": "8"
        },
        {
          "label": "Long",
          "value": "19"
        }
      ]
    },
    {
      "name": "Jameson Williams",
      "position": "",
      "headshot": null,
      "line": "4 rec · 45 yds",
      "stats": [
        {
          "label": "TD",
          "value": "0"
        },
        {
          "label": "Targets",
          "value": "9"
        },
        {
          "label": "Long",
          "value": "22"
        }
      ]
    }
  ]
};

export const SAMPLE_TEAMS: TeamCompareProps = {
  league: "nfl",
  away: "DET",
  home: "BUF",
  awayName: "Detroit Lions",
  homeName: "Buffalo Bills",
  eyebrow: "TNF · Clubs",
  title: "The Two Clubs",
  note: "Power rating and EPA are opponent-adjusted (nfl-model, research only).",
  kickoff: "Thu Sep 17 · 8:15 PM ET",
  network: "Prime Video",
  spread: "BUF -4.5",
  total: "53.5",
  modelLine: "BUF by 1.5 · 48.8",
  awaySide: {
    abbr: "DET", name: "Detroit Lions", record: "1-0", rating: "4.56", rank: 7,
    rest: "4 days", travel: "219 miles from Detroit", offEpa: "+0.077", defEpa: "-0.016", score: "23.7",
  },
  homeSide: {
    abbr: "BUF", name: "Buffalo Bills", record: "1-0", rating: "5.26", rank: 4,
    rest: "4 days", travel: "No travel since the last game", offEpa: "+0.111", defEpa: "+0.005", score: "25.1",
  },
};

export const SAMPLE_QB: QbMatchupProps = {
  league: "nfl",
  away: "DET",
  home: "BUF",
  eyebrow: "TNF · Quarterbacks",
  title: "Goff vs Allen",
  note: "1 start this season, then the aggregate. Tonight's model: Goff 236 pass yds · Allen 243.",
  awayQb: { name: "Jared Goff", team: "DET", teamName: "Detroit Lions", headshot: null, status: "Active", detail: "", position: "QB" },
  homeQb: { name: "Josh Allen", team: "BUF", teamName: "Buffalo Bills", headshot: null, status: "Active", detail: "", position: "QB" },
  starts: [
    { week: 1, awayOpp: "GB", homeOpp: "BAL", awayHome: true, homeHome: true,
      awayLine: "31/39 · 277 yds · 3 TD", homeLine: "21/30 · 248 yds · 2 TD", awayVal: 277, homeVal: 248 },
  ],
  rows: [
    { label: "Pass yds", away: 277, home: 248, awayDisplay: "277", homeDisplay: "248", better: "high" },
    { label: "Pass TD", away: 3, home: 2, awayDisplay: "3", homeDisplay: "2", better: "high" },
    { label: "INT", away: 0, home: 0, awayDisplay: "0", homeDisplay: "0", better: "low" },
    { label: "Yds / start", away: 277, home: 248, awayDisplay: "277.0", homeDisplay: "248.0", better: "high" },
  ],
};

const COVER3 = [
  { x: 18, y: 46, role: "DE" }, { x: 38, y: 46, role: "DT" }, { x: 62, y: 46, role: "DT" }, { x: 82, y: 46, role: "DE" },
  { x: 32, y: 34, role: "LB" }, { x: 68, y: 34, role: "LB" },
  { x: 12, y: 18, role: "CB" }, { x: 88, y: 18, role: "CB" }, { x: 50, y: 14, role: "FS" },
  { x: 22, y: 32, role: "NB" }, { x: 78, y: 32, role: "SS" },
];

export const SAMPLE_SCHEME: SchemeDiagramProps = {
  league: "nfl",
  away: "DET",
  home: "BUF",
  awayName: "Detroit Lions",
  homeName: "Buffalo Bills",
  eyebrow: "TNF · Scheme",
  title: "How They Cover",
  note: "Illustrated from charted tendencies.",
  view: "coverage",
  awayLook: {
    team: "DET", teamName: "Detroit Lions", shell: "Cover 3", shellRate: "28%",
    shotgun: "53.5%", motion: "59.1%", blitz: "29%",
    personnel: [{ code: "11", label: "11 · 3 WR", rate: 0.61 }, { code: "12", label: "12 · 2 TE", rate: 0.22 }, { code: "21", label: "21 · FB", rate: 0.05 }],
    dots: COVER3,
  },
  homeLook: {
    team: "BUF", teamName: "Buffalo Bills", shell: "Cover 2", shellRate: "26%",
    shotgun: "49.8%", motion: "58.2%", blitz: "24%",
    personnel: [{ code: "11", label: "11 · 3 WR", rate: 0.58 }, { code: "12", label: "12 · 2 TE", rate: 0.25 }, { code: "21", label: "21 · FB", rate: 0.08 }],
    dots: COVER3,
  },
};

export const SAMPLE_MIX: MixTableProps = {
  league: "nfl",
  team: "BUF",
  teamName: "Buffalo Bills",
  opponent: "DET",
  opponentName: "Detroit Lions",
  eyebrow: "TNF · Tendencies",
  title: "Bills",
  subtitle: "Season to date",
  columns: { usage: "Usage", count: "Snaps", stat: "EPA", opp: "DET Pass%", extra: "Success" },
  rows: [
    { label: "Neutral pass", usage: 0.574, usageDisplay: "57.4%", count: "637", stat: "+0.041", statRank: 12, opp: "59.6%", oppRank: 8, extra: "45.1%", extraRank: null, of: 32 },
    { label: "Play action", usage: 0.258, usageDisplay: "25.8%", count: "286", stat: "+0.111", statRank: 6, opp: "", oppRank: null, extra: "", extraRank: null, of: 32 },
    { label: "Under center", usage: 0.192, usageDisplay: "19.2%", count: "213", stat: "-0.018", statRank: 22, opp: "", oppRank: null, extra: "42.0%", extraRank: null, of: 32 },
  ],
  note: "EPA only on looks with their own split. DET Pass% is Detroit's season pass rate.",
};

export const SAMPLE_INJURY: InjuryBoardProps = {
  league: "nfl",
  team: "CIN",
  teamName: "Cincinnati Bengals",
  eyebrow: "W3 · Injury report",
  title: "Bengals Report",
  note: "Sorted by who actually changes the game: Franchise, Core, Starter, Rotation, Depth. Questionable is not inactive.",
  rows: [
    { name: "Joe Burrow", position: "QB", status: "Questionable", detail: "back", headshot: null, starter: true, impact: 5, impactLabel: "Franchise" },
    { name: "B.J. Hill", position: "DT", status: "Questionable", detail: "", headshot: null, starter: true, impact: 3, impactLabel: "Starter" },
    { name: "Brian Parker II", position: "OT", status: "Injured Reserve", detail: "", headshot: null, starter: false, impact: 1, impactLabel: "Depth" },
    { name: "Ja'Sir Taylor", position: "CB", status: "Injured Reserve", detail: "undisclosed", headshot: null, starter: false, impact: 2, impactLabel: "Rotation" },
  ],
};

export const SAMPLE_CLASH: ClashBoardProps = {
  league: "nfl",
  away: "IND",
  home: "KC",
  offense: "IND",
  defense: "KC",
  offenseName: "Colts",
  defenseName: "Chiefs",
  eyebrow: "SNF · Pass vs run",
  title: "When IND has the ball",
  note: "Coverage charted from 2025; rates are 2026.",
  lanes: [
    {
      id: "pass",
      title: "Pass success rate",
      hero: { value: 0.458, display: "45.8%", rank: 18, of: 32 },
      heroLabel: "Pass success rate",
      yards: { display: "229", label: "Jones proj. yds" },
      offEpa: { value: 0.028, display: "+0.028", rank: 20, of: 32 },
      defEpa: { value: 0.014, display: "+0.014", rank: 11, of: 32 },
      context: { value: 0.309, display: "30.9%", rank: 5, of: 32 },
      contextOpp: { value: 0.27, display: "27.0%", rank: 7, of: 32 },
      contextLabel: "1st-down rate",
    },
    {
      id: "run",
      title: "Success rate",
      hero: { value: 0.454, display: "45.4%", rank: 6, of: 32 },
      heroLabel: "Success rate",
      yards: null,
      offEpa: { value: 0.053, display: "+0.053", rank: 4, of: 32 },
      defEpa: { value: -0.078, display: "-0.078", rank: 5, of: 32 },
      context: { value: 0.056, display: "5.6%", rank: 15, of: 32 },
      contextOpp: { value: 0.05, display: "5.0%", rank: 7, of: 32 },
      contextLabel: "explosive plays",
    },
  ],
};

export const SAMPLE_COVER: CoverHeatProps = {
  league: "nfl",
  away: "IND",
  home: "KC",
  offense: "IND",
  defense: "KC",
  offenseName: "Colts",
  defenseName: "Chiefs",
  eyebrow: "SNF · vs coverage",
  title: "IND vs KC shells",
  note: "How often KC plays each look, then how IND throws it vs what KC allows.",
  shells: [
    { label: "Cover 3", rate: "26.7%", rateValue: 0.267, rateRank: 8, off: { value: 0.06, display: "+0.057", rank: 11, of: 32 }, opp: { value: 0.12, display: "+0.120", rank: 22, of: 32 } },
    { label: "Cover 1", rate: "25.3%", rateValue: 0.253, rateRank: 10, off: { value: 0.09, display: "+0.090", rank: 7, of: 32 }, opp: { value: 0.16, display: "+0.163", rank: 26, of: 32 } },
    { label: "Cover 2", rate: "24.2%", rateValue: 0.242, rateRank: 6, off: { value: 0.08, display: "+0.077", rank: 9, of: 32 }, opp: { value: 0.00, display: "+0.005", rank: 8, of: 32 } },
  ],
};



