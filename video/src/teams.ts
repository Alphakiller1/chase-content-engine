/**
 * Team identity for the graphics package: official colors and the ESPN slug used
 * for the local logo file.
 *
 * LEAGUE IS REQUIRED, NOT OPTIONAL. MLB and NFL share sixteen abbreviations -
 * SF, SEA, WSH, ATL, CLE, CIN, DET, HOU, MIA, MIN, PHI, PIT, BAL, ARI, KC, TB -
 * so a shared lookup would silently paint the Seahawks in Mariners navy and pull
 * the Mariners' logo for a Seahawks graphic. Every call names its league.
 *
 * Logos are downloaded locally by outputs/fetch_team_logos.py. Do not hotlink
 * ESPN from a composition: a slow fetch renders a missing logo with no error.
 */

export type League = "mlb" | "nfl";
export type TeamColors = { primary: string; secondary: string };

const MLB_TEAMS: Record<string, TeamColors> = {
  ari: { primary: "#A71930", secondary: "#E3D4AD" },
  atl: { primary: "#CE1141", secondary: "#13274F" },
  bal: { primary: "#DF4601", secondary: "#000000" },
  bos: { primary: "#BD3039", secondary: "#0C2340" },
  chc: { primary: "#0E3386", secondary: "#CC3433" },
  chw: { primary: "#27251F", secondary: "#C4CED4" },
  cin: { primary: "#C6011F", secondary: "#000000" },
  cle: { primary: "#00385D", secondary: "#E50022" },
  col: { primary: "#333366", secondary: "#C4CED4" },
  det: { primary: "#0C2340", secondary: "#FA4616" },
  hou: { primary: "#002D62", secondary: "#EB6E1F" },
  kc: { primary: "#004687", secondary: "#BD9B60" },
  laa: { primary: "#BA0021", secondary: "#003263" },
  lad: { primary: "#005A9C", secondary: "#EF3E42" },
  mia: { primary: "#00A3E0", secondary: "#EF3340" },
  mil: { primary: "#12284B", secondary: "#FFC52F" },
  min: { primary: "#002B5C", secondary: "#D31145" },
  nym: { primary: "#002D72", secondary: "#FF5910" },
  nyy: { primary: "#003087", secondary: "#E4002C" },
  oak: { primary: "#003831", secondary: "#EFB21E" },
  phi: { primary: "#E81828", secondary: "#002D72" },
  pit: { primary: "#FDB827", secondary: "#27251F" },
  sd: { primary: "#2F241D", secondary: "#FFC425" },
  sf: { primary: "#FD5A1E", secondary: "#27251F" },
  sea: { primary: "#0C2C56", secondary: "#005C5C" },
  stl: { primary: "#C41E3A", secondary: "#0C2340" },
  tb: { primary: "#092C5C", secondary: "#8FBCE6" },
  tex: { primary: "#003278", secondary: "#C0111F" },
  tor: { primary: "#134A8E", secondary: "#E8291C" },
  wsh: { primary: "#AB0003", secondary: "#14225A" },
};

const NFL_TEAMS: Record<string, TeamColors> = {
  ari: { primary: "#97233F", secondary: "#000000" },
  atl: { primary: "#A71930", secondary: "#000000" },
  bal: { primary: "#241773", secondary: "#000000" },
  buf: { primary: "#00338D", secondary: "#C60C30" },
  car: { primary: "#0085CA", secondary: "#101820" },
  chi: { primary: "#0B162A", secondary: "#C83803" },
  cin: { primary: "#FB4F14", secondary: "#000000" },
  cle: { primary: "#311D00", secondary: "#FF3C00" },
  dal: { primary: "#003594", secondary: "#869397" },
  den: { primary: "#FB4F14", secondary: "#002244" },
  det: { primary: "#0076B6", secondary: "#B0B7BC" },
  gb: { primary: "#203731", secondary: "#FFB612" },
  hou: { primary: "#03202F", secondary: "#A71930" },
  ind: { primary: "#002C5F", secondary: "#A2AAAD" },
  jax: { primary: "#101820", secondary: "#D7A22A" },
  kc: { primary: "#E31837", secondary: "#FFB81C" },
  lv: { primary: "#000000", secondary: "#A5ACAF" },
  lac: { primary: "#0080C6", secondary: "#FFC20E" },
  lar: { primary: "#003594", secondary: "#FFA300" },
  mia: { primary: "#008E97", secondary: "#FC4C02" },
  min: { primary: "#4F2683", secondary: "#FFC62F" },
  ne: { primary: "#002244", secondary: "#C60C30" },
  no: { primary: "#D3BC8D", secondary: "#101820" },
  nyg: { primary: "#0B2265", secondary: "#A71930" },
  nyj: { primary: "#125740", secondary: "#000000" },
  phi: { primary: "#004C54", secondary: "#A5ACAF" },
  pit: { primary: "#FFB612", secondary: "#101820" },
  sf: { primary: "#AA0000", secondary: "#B3995D" },
  sea: { primary: "#002244", secondary: "#69BE28" },
  tb: { primary: "#D50A0A", secondary: "#FF7900" },
  ten: { primary: "#0C2340", secondary: "#4B92DB" },
  wsh: { primary: "#5A1414", secondary: "#FFB612" },
};

/** Slate abbreviation -> ESPN slug. MLB mirrors ESPN_ABBR_MAP in mlbma_assets.js. */
const MLB_SLUGS: Record<string, string> = {
  ARI: "ari", ATL: "atl", BAL: "bal", BOS: "bos", CHC: "chc", CHW: "chw",
  CWS: "chw", CIN: "cin", CLE: "cle", COL: "col", DET: "det", HOU: "hou",
  KC: "kc", KCR: "kc", LAA: "laa", LAD: "lad", MIA: "mia", MIL: "mil",
  MIN: "min", NYM: "nym", NYY: "nyy", ATH: "oak", OAK: "oak", PHI: "phi",
  PIT: "pit", SD: "sd", SDP: "sd", SF: "sf", SFG: "sf", SEA: "sea",
  STL: "stl", TB: "tb", TBR: "tb", TEX: "tex", TOR: "tor", WSH: "wsh",
  WAS: "wsh", WSN: "wsh",
};

/** nfl-model emits these (see docs/board.json "teams"). */
const NFL_SLUGS: Record<string, string> = {
  ARI: "ari", ATL: "atl", BAL: "bal", BUF: "buf", CAR: "car", CHI: "chi",
  CIN: "cin", CLE: "cle", DAL: "dal", DEN: "den", DET: "det", GB: "gb",
  HOU: "hou", IND: "ind", JAX: "jax", JAC: "jax", KC: "kc", LV: "lv",
  OAK: "lv", LAC: "lac", SD: "lac", LAR: "lar", STL: "lar", LA: "lar",
  MIA: "mia", MIN: "min", NE: "ne", NO: "no", NYG: "nyg", NYJ: "nyj",
  PHI: "phi", PIT: "pit", SF: "sf", SEA: "sea", TB: "tb", TEN: "ten",
  WSH: "wsh", WAS: "wsh",
};

const slugMap = (league: League) => (league === "nfl" ? NFL_SLUGS : MLB_SLUGS);
const teamMap = (league: League) => (league === "nfl" ? NFL_TEAMS : MLB_TEAMS);

export const teamSlug = (abbr: string, league: League): string => {
  const key = String(abbr || "").toUpperCase();
  return slugMap(league)[key] ?? key.toLowerCase();
};

/** Local file written by outputs/fetch_team_logos.py, for staticFile(). */
export const teamLogoPath = (abbr: string, league: League): string =>
  `logos/${league}/${teamSlug(abbr, league)}.png`;

export const teamColors = (abbr: string, league: League): TeamColors =>
  teamMap(league)[teamSlug(abbr, league)] ?? {
    primary: "#9A6BFF",
    secondary: "#5B2BE0",
  };

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" +
  [r, g, b]
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0"),
    )
    .join("");

/** WCAG relative luminance. */
const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Mix a color toward white by `amount` (0-1). */
const lighten = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
};

/**
 * A team color guaranteed to read on the site's black ground (#050506 page, #0D0D10 card).
 *
 * Many official primaries are unusable as an accent on #08090F - the Raiders are
 * literally black, the White Sox near-black, the Padres brown, and a third of
 * both leagues run a navy that disappears. So: take the brighter of
 * primary/secondary, then lift it toward white until it clears a luminance
 * floor. Computed rather than hand-picked, so all 62 teams get the same rule.
 */
export const teamAccent = (abbr: string, league: League): string => {
  const { primary, secondary } = teamColors(abbr, league);
  let pick = luminance(primary) >= luminance(secondary) ? primary : secondary;
  let guard = 0;
  while (luminance(pick) < 0.18 && guard < 12) {
    pick = lighten(pick, 0.16);
    guard += 1;
  }
  return pick;
};

/**
 * Ink for text drawn ON a team's own colour field, e.g. the abbreviation inside
 * the header bar's colour wedge.
 *
 * This is NOT teamAccent. teamAccent guarantees contrast against the dark page
 * ground and is right in the body of a card; used on the team's own primary it
 * collides, because both come from the same palette - Carolina blue lettering
 * on a Carolina blue field, Denver orange on orange, Saints gold on gold. Here
 * the only thing that matters is the field underneath, so pick white or near
 * black by that field's luminance, the way a broadcast lower third does.
 */
export const onTeamInk = (abbr: string, league: League): string =>
  luminance(teamColors(abbr, league).primary) > 0.42 ? "#050506" : "#FFFFFF";
