/**
 * Studio defaults: Thursday Night Football, Week 2 - Detroit Lions at Buffalo Bills,
 * Thu Sep 17 2026, 8:15 PM ET, Highmark Stadium, Prime Video.
 *
 * Numbers are a SNAPSHOT for previewing in Studio, taken from the hosted nfl-model
 * board (generated 2026-09-15T18:07Z; DraftKings lines as of 18:06Z) and the
 * chase-analytics.com slate. Real renders take props from
 *     python -m outputs.video_pack --league nfl --game DET@BUF
 * which re-reads both sources, so nothing here should ever reach a published video
 * unchecked.
 *
 * The board labels itself RESEARCH_ONLY and withholds per-game edges ("model does not
 * beat the closing line"). Anything built from the model numbers below must say so.
 */
export const TNF = {
  league: "nfl" as const,
  away: "DET",
  home: "BUF",
  awayName: "Detroit Lions",
  homeName: "Buffalo Bills",
  awayRecord: "1-0",
  homeRecord: "1-0",
  show: "Thursday Night Football",
  week: "Week 2",
  kickoff: "Thu Sep 17 · 8:15 PM ET",
  network: "Prime Video",
  venue: "Highmark Stadium · Orchard Park, NY",
  // DraftKings via the board's `book` block.
  market: { spread: "BUF -4.5", total: "53.5", moneyline: "BUF -218", awayMoneyline: "DET +180" },
  // Model read (research only).
  model: {
    margin: 1.45, // home points
    marketMargin: 4.5,
    total: 48.81,
    marketTotal: 53.5,
    homeWinProbability: 0.5438,
    marketHomeWinProbability: 0.6575,
    projectedAway: 23.7,
    projectedHome: 25.1,
    action: "MONITOR",
    authority: "RESEARCH_ONLY",
  },
  ratings: { away: 4.56, home: 5.26, awayRank: 7, homeRank: 4 },
  form: {
    away: { offEpa: 0.0768, defEpa: -0.0155, offExplosive: 0.071, defSack: 0.077, offTurnover: 0.0149 },
    home: { offEpa: 0.1108, defEpa: 0.0052, offExplosive: 0.0649, defSack: 0.0662, offTurnover: 0.0191 },
  },
  qbs: {
    away: {
      name: "Jared Goff",
      passYards: 235.7,
      passTds: 1.89,
      completions: 21.3,
      attempts: 31.7,
      interceptions: 0.51,
      rushYards: 8.5,
    },
    home: {
      name: "Josh Allen",
      passYards: 243.4,
      passTds: 2.04,
      completions: 20.2,
      attempts: 30.1,
      interceptions: 0.59,
      rushYards: 30.4,
    },
  },
  context: { awayRest: "4 days", homeRest: "4 days", awayTravel: "219 miles from Detroit" },
  injuries: {
    away: [
      { position: "CB", name: "D.J. Reed", status: "Questionable", detail: "foot", starter: true },
      { position: "G", name: "Christian Mahogany", status: "Questionable", detail: "knee", starter: false },
    ],
    home: [
      { position: "WR", name: "Tyrell Shavers", status: "Out", detail: "", starter: false },
      { position: "DT", name: "T.J. Sanders", status: "Questionable", detail: "knee/illness", starter: true },
    ],
  },
};
