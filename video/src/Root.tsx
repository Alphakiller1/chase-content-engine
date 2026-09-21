import "./index.css";
import { CalculateMetadataFunction, Composition, Folder, Still } from "remotion";
import { TNF } from "./fixtures/tnf";
import { MatchupCutaway, Matchup } from "./graphics/MatchupCutaway";
import { LowerThird, LowerThirdProps } from "./graphics/LowerThird";
import { CornerBug, CornerBugProps } from "./graphics/CornerBug";
import { Sting, StingProps } from "./graphics/Sting";
import { MatchupBar, MatchupBarProps } from "./graphics/MatchupBar";
import { NflCutaway, NflMatchup } from "./graphics/NflCutaway";
import { ShowTemplate, ShowTemplateProps } from "./graphics/ShowTemplate";
import { SafeZoneCalibration } from "./graphics/SafeZoneCalibration";
import { ModelSnapshot, ModelSnapshotProps } from "./graphics/ModelSnapshot";
import { BoardMotion, BoardMotionProps } from "./graphics/BoardMotion";
import { StatDuel, StatDuelProps } from "./stats/StatDuel";
import { LineGap, LineGapProps } from "./stats/LineGap";
import { RankCountdown, RankCountdownProps } from "./stats/RankCountdown";
import { EpisodeOpen, EpisodeOpenProps } from "./longform/EpisodeOpen";
import { ChapterCard, ChapterCardProps } from "./longform/ChapterCard";
import { AgendaRail, AgendaRailProps } from "./longform/AgendaRail";
import { SplitFrame, SplitFrameProps } from "./longform/SplitFrame";
import { EndScreen, EndScreenProps } from "./longform/EndScreen";
import { Thumbnail, ThumbnailProps } from "./longform/Thumbnail";
import { Annotate, AnnotateProps, annotateDuration } from "./tools/Annotate";
import { Telestrator, TelestratorProps } from "./tools/Telestrator";
import { Callout, CalloutProps } from "./tools/Callout";
import { Episode, EpisodeProps, episodeDuration } from "./edit/Episode";
import { Formation, FormationProps } from "./studio/Formation";
import { PlayerCard, PlayerCardProps } from "./studio/PlayerCard";
import { MetricBoard, MetricBoardProps } from "./studio/MetricBoard";
import { LineMove, LineMoveProps } from "./studio/LineMove";
import { PropBoard, PropBoardProps } from "./studio/PropBoard";
import { LastGame, LastGameProps } from "./studio/LastGame";
import { TeamCompare, TeamCompareProps } from "./studio/TeamCompare";
import { QbMatchup, QbMatchupProps } from "./studio/QbMatchup";
import { SchemeDiagram, SchemeDiagramProps } from "./studio/SchemeDiagram";
import { MixTable, MixTableProps } from "./studio/MixTable";
import { InjuryBoard, InjuryBoardProps } from "./studio/InjuryBoard";
import { ClashBoard, ClashBoardProps } from "./studio/ClashBoard";
import { CoverHeat, CoverHeatProps } from "./studio/CoverHeat";
import { QbStressTest, QbStressTestProps } from "./studio/QbStressTest";
import { SAMPLE_CLASH, SAMPLE_COVER, SAMPLE_FORMATION, SAMPLE_INJURY, SAMPLE_LAST_GAME, SAMPLE_LINE_MOVE, SAMPLE_METRICS, SAMPLE_MIX, SAMPLE_PLAYER, SAMPLE_PROPS, SAMPLE_QB, SAMPLE_QB_STRESS, SAMPLE_SCHEME, SAMPLE_TEAMS } from "./fixtures/studio";

/** 9:16 master for Reels/Shorts/TikTok. WIDE is 16:9 long-form. */
const VERTICAL = { width: 1080, height: 1920, fps: 30 };
const WIDE = { width: 1920, height: 1080, fps: 30 };

/**
 * ProRes 4444 with a real alpha channel - what DaVinci Resolve wants for an overlay.
 * Set per composition so `npx remotion render X out.mov` needs no flags; --codec on
 * the CLI still overrides it (use `--codec h264` for a quick look).
 */
function alphaExport<T extends Record<string, unknown>>(): CalculateMetadataFunction<T> {
  return () => ({
    defaultCodec: "prores",
    defaultVideoImageFormat: "png",
    defaultPixelFormat: "yuva444p10le",
    defaultProResProfile: "4444",
  });
}

/** Opaque full-frame pieces: H.264 by default, small and ready to upload or cut. */
function opaqueExport<T extends Record<string, unknown>>(): CalculateMetadataFunction<T> {
  return () => ({ defaultCodec: "h264" });
}

/* ── Thursday Night Football defaults (see fixtures/tnf.ts) ──────────────── */
const T = TNF;
const researchNote =
  "nfl-model is research only: it does not beat the closing line, so a gap is a disagreement, not an edge.";

const defaultTemplate: ShowTemplateProps = {
  platform: "reels",
  league: T.league,
  away: T.away,
  home: T.home,
  eyebrow: `TNF · ${T.week}`,
  title: "8:15 PM ET",
  spread: T.market.spread,
  total: T.market.total,
  moneyline: T.market.moneyline,
  lineSource: "current",
};

const defaultModelSnapshot: ModelSnapshotProps = {
  league: T.league,
  away: T.away,
  home: T.home,
  modelMargin: T.model.margin,
  marketMargin: T.model.marketMargin,
  modelTotal: T.model.total,
  marketTotal: T.model.marketTotal,
  winProbability: T.model.homeWinProbability,
  edgeWithheld: true,
  action: T.model.action,
};

const defaultNfl: NflMatchup = {
  away: T.away,
  home: T.home,
  awayRating: T.ratings.away,
  homeRating: T.ratings.home,
  modelMargin: T.model.margin,
  marketMargin: T.model.marketMargin,
  winProbability: T.model.homeWinProbability,
  projectedTotal: T.model.total,
  marketTotal: T.model.marketTotal,
  projectedAwayScore: T.model.projectedAway,
  projectedHomeScore: T.model.projectedHome,
  kickoff: T.kickoff,
  action: T.model.action,
  edgeWithheld: true,
  authority: T.model.authority,
};

const defaultMatchup: Matchup = {
  away: "NYM",
  home: "TBR",
  awaySP: "Sean Manaea",
  awayHand: "L",
  awayPitchScore: 51.5,
  homeSP: "Freddy Peralta",
  homeHand: "R",
  homePitchScore: 79.0,
  awayOSI: 42.0,
  homeOSI: 43.7,
  lineupEdge: "TBR +1.7",
};

const defaultLowerThird: LowerThirdProps = {
  title: T.qbs.home.name,
  subtitle: "QB · Buffalo Bills",
  stat: String(T.qbs.home.passYards),
  statLabel: "Proj. pass yards",
  team: T.home,
  league: T.league,
};

const defaultBug: CornerBugProps = {
  league: T.league,
  away: T.away,
  home: T.home,
  statLabel: "DraftKings",
  statValue: T.market.spread,
};

const defaultBarNFL: MatchupBarProps = {
  league: T.league,
  away: T.away,
  home: T.home,
  awayNote: `Goff · ${T.awayRecord}`,
  homeNote: `Allen · ${T.homeRecord}`,
  centerLabel: "TNF · DraftKings",
  centerValue: T.market.spread,
};

const defaultBarMLB: MatchupBarProps = {
  league: "mlb",
  away: "NYM",
  home: "TBR",
  awayNote: "Manaea 51.5",
  homeNote: "Peralta 79.0",
  centerLabel: "Pitching Edge",
  centerValue: "TBR +27.5",
};

const defaultBoardMotion: BoardMotionProps = {
  platform: "reels",
  league: T.league,
  captures: [],
  eyebrow: T.show,
  title: "Render with --props",
  sub: "content_engine --video writes the captures and this props file.",
  footer: "Access Premium NFL Research At Chase-Analytics.com",
};

const defaultSting: StingProps = { tagline: "NFL & MLB Matchup Research" };

const defaultDuelQB: StatDuelProps = {
  platform: "reels",
  league: T.league,
  away: T.away,
  home: T.home,
  eyebrow: `${T.show} · Projections`,
  title: "Goff vs Allen",
  awayLabel: T.qbs.away.name,
  homeLabel: T.qbs.home.name,
  rows: [
    { label: "Pass yards", away: T.qbs.away.passYards, home: T.qbs.home.passYards, format: "0.0" },
    { label: "Pass TDs", away: T.qbs.away.passTds, home: T.qbs.home.passTds, format: "0.00" },
    { label: "Completions", away: T.qbs.away.completions, home: T.qbs.home.completions, format: "0.0" },
    { label: "Interceptions", away: T.qbs.away.interceptions, home: T.qbs.home.interceptions, format: "0.00", better: "lower" },
    { label: "Rush yards", away: T.qbs.away.rushYards, home: T.qbs.home.rushYards, format: "0.0" },
  ],
  note: "nfl-model next-game centres. Research only - projections, not props.",
};

const defaultLineGap: LineGapProps = {
  platform: "reels",
  league: T.league,
  away: T.away,
  home: T.home,
  eyebrow: `${T.show} · Game total`,
  title: "Market vs Model",
  measure: "Points, both teams",
  markers: [
    { label: "DraftKings", value: T.model.marketTotal, kind: "market" },
    { label: "Model", value: Number(T.model.total.toFixed(1)), kind: "model" },
  ],
  unit: "pts",
  caveat: researchNote,
};

const defaultRank: RankCountdownProps = {
  platform: "reels",
  eyebrow: "NFL Power Ratings · Week 2",
  title: "Where Tonight's Teams Rank",
  valueLabel: "Rating",
  items: [
    // nfl-model power ratings, week 2 (board generated 2026-09-15T18:07Z).
    { rank: 1, label: "Seattle Seahawks", sub: "NFC West", value: "8.37", team: "SEA", league: T.league, share: 8.37 / 8.37 },
    { rank: 2, label: "Jacksonville Jaguars", sub: "AFC South", value: "7.59", team: "JAX", league: T.league, share: 7.59 / 8.37 },
    { rank: 3, label: "San Francisco 49ers", sub: "NFC West", value: "5.82", team: "SF", league: T.league, share: 5.82 / 8.37 },
    { rank: 4, label: T.homeName, sub: "AFC East", value: "5.26", team: T.home, league: T.league, share: 5.26 / 8.37, spotlight: true },
    { rank: 5, label: "Los Angeles Rams", sub: "NFC West", value: "5.04", team: "LAR", league: T.league, share: 5.04 / 8.37 },
    { rank: 6, label: "Baltimore Ravens", sub: "AFC North", value: "4.77", team: "BAL", league: T.league, share: 4.77 / 8.37 },
    { rank: 7, label: T.awayName, sub: "NFC North", value: "4.56", team: T.away, league: T.league, share: 4.56 / 8.37, spotlight: true },
  ],
  note: "Opponent-adjusted rating from nfl-model (research only). Tonight's clubs highlighted.",
};

const defaultOpen: EpisodeOpenProps = {
  league: T.league,
  away: T.away,
  home: T.home,
  show: T.show,
  title: "Can Detroit Keep Pace in Buffalo?",
  awayName: T.awayName,
  homeName: T.homeName,
  kickoff: T.kickoff,
  network: T.network,
  venue: T.venue,
};

const defaultChapter: ChapterCardProps = {
  number: 2,
  title: "The Quarterback Duel",
  subtitle: "Goff and Allen, projected side by side",
  team: T.home,
  league: T.league,
};

const agendaChapters = ["Cold Open", "The Line", "QB Duel", "Injuries", "Scheme", "The Read"];
const defaultAgenda: AgendaRailProps = {
  chapters: agendaChapters,
  current: 2,
  label: "TNF · DET at BUF",
};

const defaultSplit: SplitFrameProps = {
  league: T.league,
  away: T.away,
  home: T.home,
  camera: "left",
  eyebrow: "DraftKings · current",
  title: "The Market",
  kickoff: T.kickoff,
  stats: [
    { label: "Spread", value: T.market.spread, team: T.home },
    { label: "Total", value: T.market.total },
    { label: "Moneyline", value: T.market.moneyline, team: T.home, note: T.market.awayMoneyline },
    { label: "Model total", value: T.model.total.toFixed(1), note: "research only" },
  ],
  footer: "Lines: DraftKings via the nfl-model board, 2026-09-15 18:06 UTC.",
};

const defaultEnd: EndScreenProps = { guides: true };

const defaultThumb: ThumbnailProps = {
  league: T.league,
  away: T.away,
  home: T.home,
  line1: "Lions at Bills",
  line2: "Market vs Model",
  badge: "TNF",
};

const defaultAnnotate: AnnotateProps = {
  platform: "reels",
  capture: { src: "", width: 1032, height: 1309, anchors: [] },
  steps: [],
  eyebrow: T.show,
  title: "Buffalo's Injury Report",
};

const defaultTele: TelestratorProps = {
  strokes: [
    { points: [[0.2, 0.72], [0.34, 0.6], [0.52, 0.56], [0.7, 0.4]], at: 0.3, dur: 1.0, tone: "caution", arrow: true },
    { points: [[0.26, 0.78], [0.44, 0.78]], at: 1.4, dur: 0.6, tone: "accent", dashed: true },
  ],
  marks: [
    { type: "ring", x: 0.7, y: 0.4, at: 1.2, tone: "caution", label: "Target" },
    { type: "x", x: 0.5, y: 0.7, at: 1.8, tone: "negative" },
  ],
};

const defaultCallout: CalloutProps = {
  x: 0.36,
  y: 0.46,
  label: "Proj. pass yards",
  value: String(T.qbs.home.passYards),
  sub: "Josh Allen · nfl-model centre",
  team: T.home,
  league: T.league,
};

/* Auto-edit sample: no camera, a scripted 24 s of talk over the TNF graphics.
   Real edits come from scripts/edit.mjs, which writes every field. */
const sampleWords = (
  "Thursday night football, Detroit at Buffalo. Buffalo is laying four and a half. " +
  "Now look at the quarterbacks: Goff against Allen, and the projections are closer than the line says. " +
  "The total sits at fifty three and a half, and the model is way under that."
).split(" ");
const defaultEpisode: EpisodeProps = {
  format: "vertical",
  platform: "reels",
  league: T.league,
  away: T.away,
  home: T.home,
  host: "Chase Analytics",
  show: T.show,
  line: `${T.market.spread} · O/U ${T.market.total}`,
  camera: null,
  music: null,
  cuts: [{ from: 0, to: 24 }],
  words: sampleWords.map((w, i) => ({ text: w, start: 0.4 + i * 0.52, end: 0.4 + i * 0.52 + 0.45 })),
  segments: [
    { id: "hero", label: "Matchup", composition: "MatchupHero", from: 0, to: 6,
      props: { league: T.league, away: T.away, home: T.home, awayName: T.awayName, homeName: T.homeName,
        eyebrow: `TNF · ${T.week}`, kickoff: T.kickoff, network: T.network, spread: T.market.spread,
        total: T.market.total, moneyline: T.market.moneyline } },
    { id: "duel-qb", label: "QB duel", composition: "StatDuel", from: 6, to: 16, props: defaultDuelQB },
    { id: "gap-total", label: "Total", composition: "LineGap", from: 16, to: 24, props: defaultLineGap },
  ],
  intro: null,
  outro: { composition: "Sting", props: { tagline: T.show, ground: true }, seconds: 2.5 },
  captions: true,
  // Shows each layout once, and one telestration stroke on the QB duel.
  layouts: [
    { from: 0, mode: "bubble" },
    { from: 8, mode: "split" },
    { from: 13, mode: "full" },
    { from: 19, mode: "bubble" },
  ],
  // Small graphics laid over the stage, and the size the stage runs at.
  overlays: [
    { name: "Ticker", from: 2, to: 10,
      props: { league: T.league, away: T.away, home: T.home, platform: "reels",
               items: [`${T.away} at ${T.home}`, T.market.spread, `O/U ${T.market.total}`, T.kickoff, "chase-analytics.com"] } },
    { name: "CornerBug", from: 10, to: 20, props: { ...defaultBug } },
  ],
  sizes: [
    { from: 0, size: "full" },
    { from: 13, size: "compact" },
  ],
  strokes: [
    {
      id: 1, tone: "caution", arrow: true, from: 15, until: 18.5,
      points: Array.from({ length: 24 }, (_, i) => [0.2 + i * 0.022, 0.62 - Math.sin(i / 7) * 0.08, i * 0.03] as [number, number, number]),
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Studio">
        {/* Data-driven: formations with headshots, player cards, filterable stat boards. */}
        <Composition id="Formation" component={Formation} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_FORMATION} calculateMetadata={opaqueExport<FormationProps>()} />
        <Composition id="FormationWide" component={Formation} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_FORMATION} calculateMetadata={opaqueExport<FormationProps>()} />
        <Composition id="PlayerCard" component={PlayerCard} durationInFrames={6 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_PLAYER} calculateMetadata={opaqueExport<PlayerCardProps>()} />
        <Composition id="PlayerCardWide" component={PlayerCard} durationInFrames={6 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_PLAYER} calculateMetadata={opaqueExport<PlayerCardProps>()} />
        <Composition id="MetricBoard" component={MetricBoard} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_METRICS} calculateMetadata={opaqueExport<MetricBoardProps>()} />
        <Composition id="MetricBoardWide" component={MetricBoard} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_METRICS} calculateMetadata={opaqueExport<MetricBoardProps>()} />
        <Composition id="LineMove" component={LineMove} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_LINE_MOVE} calculateMetadata={opaqueExport<LineMoveProps>()} />
        <Composition id="LineMoveWide" component={LineMove} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_LINE_MOVE} calculateMetadata={opaqueExport<LineMoveProps>()} />
        <Composition id="PropBoard" component={PropBoard} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_PROPS} calculateMetadata={opaqueExport<PropBoardProps>()} />
        <Composition id="PropBoardWide" component={PropBoard} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_PROPS} calculateMetadata={opaqueExport<PropBoardProps>()} />
        <Composition id="LastGame" component={LastGame} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_LAST_GAME} calculateMetadata={opaqueExport<LastGameProps>()} />
        <Composition id="LastGameWide" component={LastGame} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_LAST_GAME} calculateMetadata={opaqueExport<LastGameProps>()} />
        <Composition id="TeamCompare" component={TeamCompare} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_TEAMS} calculateMetadata={opaqueExport<TeamCompareProps>()} />
        <Composition id="TeamCompareWide" component={TeamCompare} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_TEAMS} calculateMetadata={opaqueExport<TeamCompareProps>()} />
        <Composition id="QbMatchup" component={QbMatchup} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_QB} calculateMetadata={opaqueExport<QbMatchupProps>()} />
        <Composition id="QbMatchupWide" component={QbMatchup} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_QB} calculateMetadata={opaqueExport<QbMatchupProps>()} />
        <Composition id="SchemeDiagram" component={SchemeDiagram} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_SCHEME} calculateMetadata={opaqueExport<SchemeDiagramProps>()} />
        <Composition id="SchemeDiagramWide" component={SchemeDiagram} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_SCHEME} calculateMetadata={opaqueExport<SchemeDiagramProps>()} />
        <Composition id="MixTable" component={MixTable} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_MIX} calculateMetadata={opaqueExport<MixTableProps>()} />
        <Composition id="MixTableWide" component={MixTable} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_MIX} calculateMetadata={opaqueExport<MixTableProps>()} />
        <Composition id="InjuryBoard" component={InjuryBoard} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_INJURY} calculateMetadata={opaqueExport<InjuryBoardProps>()} />
        <Composition id="InjuryBoardWide" component={InjuryBoard} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_INJURY} calculateMetadata={opaqueExport<InjuryBoardProps>()} />
        <Composition id="ClashBoard" component={ClashBoard} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_CLASH} calculateMetadata={opaqueExport<ClashBoardProps>()} />
        <Composition id="ClashBoardWide" component={ClashBoard} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_CLASH} calculateMetadata={opaqueExport<ClashBoardProps>()} />
        <Composition id="CoverHeat" component={CoverHeat} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_COVER} calculateMetadata={opaqueExport<CoverHeatProps>()} />
        <Composition id="CoverHeatWide" component={CoverHeat} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_COVER} calculateMetadata={opaqueExport<CoverHeatProps>()} />
        <Composition id="QbStressTest" component={QbStressTest} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={SAMPLE_QB_STRESS} calculateMetadata={opaqueExport<QbStressTestProps>()} />
        <Composition id="QbStressTestWide" component={QbStressTest} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={SAMPLE_QB_STRESS} calculateMetadata={opaqueExport<QbStressTestProps>()} />
      </Folder>

      <Folder name="Edit">
        {/* THE AUTO-EDIT: node scripts/edit.mjs <recording> writes these props. */}
        <Composition id="Episode" component={Episode} durationInFrames={30 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultEpisode}
          calculateMetadata={({ props }) => ({
            durationInFrames: episodeDuration(props, VERTICAL.fps),
            ...(props.format === "wide" ? { width: WIDE.width, height: WIDE.height } : {}),
            defaultCodec: "h264" as const,
          })}
        />
      </Folder>

      <Folder name="Show-Package">
        {/* THE TEMPLATE - lay this over your footage for the whole video. Near static
            after its entrance: freeze the last frame in Resolve and stretch it. */}
        {(["reels", "reels-ads", "tiktok", "shorts"] as const).map((p) => (
          <Composition
            key={p}
            id={"Template-" + p}
            component={ShowTemplate}
            durationInFrames={4 * VERTICAL.fps}
            {...VERTICAL}
            defaultProps={{ ...defaultTemplate, platform: p }}
            calculateMetadata={alphaExport<ShowTemplateProps>()}
          />
        ))}
        <Composition id="Template-youtube" component={ShowTemplate} durationInFrames={4 * WIDE.fps} {...WIDE}
          defaultProps={{ ...defaultTemplate, platform: "youtube" }} calculateMetadata={alphaExport<ShowTemplateProps>()} />
        <Composition id="MatchupBarNFL" component={MatchupBar} durationInFrames={20 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultBarNFL} calculateMetadata={alphaExport<MatchupBarProps>()} />
        <Composition id="MatchupBarMLB" component={MatchupBar} durationInFrames={20 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultBarMLB} calculateMetadata={alphaExport<MatchupBarProps>()} />
        <Composition id="LowerThird" component={LowerThird} durationInFrames={6 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultLowerThird} calculateMetadata={alphaExport<LowerThirdProps>()} />
        <Composition id="LowerThirdWide" component={LowerThird} durationInFrames={6 * WIDE.fps} {...WIDE}
          defaultProps={defaultLowerThird} calculateMetadata={alphaExport<LowerThirdProps>()} />
        <Composition id="CornerBug" component={CornerBug} durationInFrames={20 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultBug} calculateMetadata={alphaExport<CornerBugProps>()} />
        <Composition id="CornerBugWide" component={CornerBug} durationInFrames={20 * WIDE.fps} {...WIDE}
          defaultProps={defaultBug} calculateMetadata={alphaExport<CornerBugProps>()} />
        <Composition id="Sting" component={Sting} durationInFrames={Math.round(2.5 * VERTICAL.fps)} {...VERTICAL}
          defaultProps={defaultSting} calculateMetadata={alphaExport<StingProps>()} />
        <Composition id="StingWide" component={Sting} durationInFrames={Math.round(2.5 * WIDE.fps)} {...WIDE}
          defaultProps={defaultSting} calculateMetadata={alphaExport<StingProps>()} />
      </Folder>

      <Folder name="Cutaways">
        <Composition id="NflCutaway" component={NflCutaway} durationInFrames={10 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultNfl} calculateMetadata={alphaExport<NflMatchup>()} />
        <Composition id="MatchupCutaway" component={MatchupCutaway} durationInFrames={10 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultMatchup} calculateMetadata={alphaExport<Matchup>()} />
        <Composition id="ModelSnapshot" component={ModelSnapshot} durationInFrames={9 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultModelSnapshot} calculateMetadata={alphaExport<ModelSnapshotProps>()} />
        <Composition id="BoardMotion" component={BoardMotion} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultBoardMotion} calculateMetadata={alphaExport<BoardMotionProps>()} />
        <Composition id="BoardMotionWide" component={BoardMotion} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={{ ...defaultBoardMotion, platform: "youtube" }} calculateMetadata={alphaExport<BoardMotionProps>()} />
      </Folder>

      <Folder name="Data">
        <Composition id="StatDuel" component={StatDuel} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultDuelQB} calculateMetadata={opaqueExport<StatDuelProps>()} />
        <Composition id="StatDuelWide" component={StatDuel} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={{ ...defaultDuelQB, platform: "youtube" }} calculateMetadata={opaqueExport<StatDuelProps>()} />
        <Composition id="LineGap" component={LineGap} durationInFrames={8 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultLineGap} calculateMetadata={opaqueExport<LineGapProps>()} />
        <Composition id="LineGapWide" component={LineGap} durationInFrames={8 * WIDE.fps} {...WIDE}
          defaultProps={{ ...defaultLineGap, platform: "youtube" }} calculateMetadata={opaqueExport<LineGapProps>()} />
        <Composition id="RankCountdown" component={RankCountdown} durationInFrames={9 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultRank} calculateMetadata={opaqueExport<RankCountdownProps>()} />
        <Composition id="RankCountdownWide" component={RankCountdown} durationInFrames={9 * WIDE.fps} {...WIDE}
          defaultProps={{ ...defaultRank, platform: "youtube" }} calculateMetadata={opaqueExport<RankCountdownProps>()} />
      </Folder>

      <Folder name="Long-form">
        <Composition id="EpisodeOpen" component={EpisodeOpen} durationInFrames={6 * WIDE.fps} {...WIDE}
          defaultProps={defaultOpen} calculateMetadata={opaqueExport<EpisodeOpenProps>()} />
        <Composition id="EpisodeOpenVertical" component={EpisodeOpen} durationInFrames={6 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultOpen} calculateMetadata={opaqueExport<EpisodeOpenProps>()} />
        <Composition id="ChapterCard" component={ChapterCard} durationInFrames={3 * WIDE.fps} {...WIDE}
          defaultProps={defaultChapter} calculateMetadata={alphaExport<ChapterCardProps>()} />
        <Composition id="ChapterCardVertical" component={ChapterCard} durationInFrames={3 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultChapter} calculateMetadata={alphaExport<ChapterCardProps>()} />
        <Composition id="AgendaRail" component={AgendaRail} durationInFrames={10 * WIDE.fps} {...WIDE}
          defaultProps={defaultAgenda} calculateMetadata={alphaExport<AgendaRailProps>()} />
        <Composition id="SplitFrame" component={SplitFrame} durationInFrames={6 * WIDE.fps} {...WIDE}
          defaultProps={defaultSplit} calculateMetadata={alphaExport<SplitFrameProps>()} />
        <Composition id="EndScreen" component={EndScreen} durationInFrames={20 * WIDE.fps} {...WIDE}
          defaultProps={defaultEnd} calculateMetadata={opaqueExport<EndScreenProps>()} />
      </Folder>

      <Folder name="Tools">
        <Composition
          id="Annotate"
          component={Annotate}
          durationInFrames={10 * VERTICAL.fps}
          {...VERTICAL}
          defaultProps={defaultAnnotate}
          calculateMetadata={({ props }) => ({
            durationInFrames: props.steps.length ? annotateDuration(props.steps, VERTICAL.fps) : 6 * VERTICAL.fps,
            ...(props.platform === "youtube" ? { width: WIDE.width, height: WIDE.height } : {}),
            defaultCodec: "h264" as const,
          })}
        />
        <Composition id="Telestrator" component={Telestrator} durationInFrames={5 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultTele} calculateMetadata={alphaExport<TelestratorProps>()} />
        <Composition id="TelestratorWide" component={Telestrator} durationInFrames={5 * WIDE.fps} {...WIDE}
          defaultProps={defaultTele} calculateMetadata={alphaExport<TelestratorProps>()} />
        <Composition id="Callout" component={Callout} durationInFrames={5 * VERTICAL.fps} {...VERTICAL}
          defaultProps={defaultCallout} calculateMetadata={alphaExport<CalloutProps>()} />
        <Composition id="CalloutWide" component={Callout} durationInFrames={5 * WIDE.fps} {...WIDE}
          defaultProps={defaultCallout} calculateMetadata={alphaExport<CalloutProps>()} />
      </Folder>

      <Folder name="Snapshots">
        <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} defaultProps={defaultThumb} />
        <Still id="ThumbnailVertical" component={Thumbnail} width={1080} height={1920} defaultProps={defaultThumb} />
      </Folder>

      <Folder name="Utilities">
        <Composition id="SafeZoneCalibration" component={SafeZoneCalibration} durationInFrames={5 * VERTICAL.fps}
          {...VERTICAL} defaultProps={{}} />
      </Folder>
    </>
  );
};
