/** League-anchored 7-step colour, matching the live site metric chips. */

export type StatCat = "quality" | "rate" | "count" | "identity" | "market";

export const METRIC_STEPS = [
  "var(--metric-very-weak, #F2545B)",
  "var(--metric-weak, #F0935B)",
  "var(--metric-below, #E8C24A)",
  "var(--metric-neutral, #A1A1AA)",
  "var(--metric-above, #86D76F)",
  "var(--metric-strong, #4ADE80)",
  "var(--metric-elite, #22C55E)",
] as const;

const stepAt = (t: number) => METRIC_STEPS[Math.max(0, Math.min(6, Math.round(t * 6)))];

/** Distinct shells/packages in a mix bar — not a rank scale. */
export const MIX_SEGMENTS = ["#8B7CFF", "#4ADE80", "#38BDF8", "#F5B942", "#F2545B", "#E879F9", "#94A3B8"] as const;
export const toneFromMix = (i: number) => MIX_SEGMENTS[i % MIX_SEGMENTS.length];

/** Rank 1 is best (quality) or most often (rate). `invert` flips so 1 is worst. */
export const toneFromRank = (rank: number | null, of: number, cat: StatCat = "quality", invert = false) => {
  if (cat === "count") return "var(--text-secondary)";
  if (cat === "identity") return "var(--text-primary)";
  if (cat === "market") return "var(--text-accent)";
  if (!rank || !of) {
    if (cat === "rate") return "var(--text-accent)";
    return "var(--text-muted)";
  }
  const q = (rank - 1) / Math.max(1, of - 1);
  return stepAt(invert ? q : 1 - q);
};

/** Typical EPA/play band (−0.20 … +0.20) on the 7-step scale. */
export const toneFromEpa = (v: number, invert = false) => {
  const t = Math.max(0, Math.min(1, (v + 0.2) / 0.4));
  return stepAt(invert ? 1 - t : t);
};

/** Head-to-head with no league rank: leader elite, trailer weak. */
export const toneFromPair = (a: number, b: number, better: "high" | "low" | "higher" | "lower" | "none") => {
  if (better === "none" || a === b) return { a: METRIC_STEPS[3], b: METRIC_STEPS[3], aLeads: null as boolean | null };
  const high = better === "high" || better === "higher";
  const aLeads = high ? a > b : a < b;
  return { a: aLeads ? METRIC_STEPS[6] : METRIC_STEPS[1], b: aLeads ? METRIC_STEPS[1] : METRIC_STEPS[6], aLeads };
};

/** Signed gap (model − line) / line: green above, red below. */
export const toneFromGap = (pct: number) => {
  const mag = Math.min(1, Math.abs(pct) / 0.22);
  if (pct >= 0) return stepAt(0.5 + mag * 0.5);
  return stepAt(0.5 - mag * 0.5);
};

export const parseStat = (s: string) => {
  const m = String(s).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

export const ordinal = (n: number | null) => {
  if (!n) return "";
  const v = n % 100;
  const s = v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${s}`;
};

/** @deprecated use toneFromRank — kept so older boards keep compiling. */
export const rankTone = (rank: number | null, of: number, kind: "quality" | "frequency" | "none") => {
  if (kind === "none") return "var(--text-muted)";
  if (kind === "frequency") return toneFromRank(rank, of, "rate");
  return toneFromRank(rank, of, "quality");
};
