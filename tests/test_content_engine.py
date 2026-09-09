from __future__ import annotations

import csv
import inspect
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageDraw

from chase_content import render
from chase_content.cli import REPORTS
from chase_content.migrate import load_pipeline, load_sharp
from chase_content.render import (
    FONTS,
    MUTED,
    _FONTS_DIR,
    _run_separation,
    _font,
    _model_separation_sort_key,
    _separation,
    format_market_move,
    format_osi_window,
    market_divergence,
    render_reports,
)
from chase_content.validate import validate_bundle

ROOT = Path(__file__).resolve().parents[1]


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


class PipelineMigrationTests(unittest.TestCase):
    def test_pipeline_adapter_builds_offense_and_trajectory(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            write_csv(
                data / "today_matchups.csv",
                [{
                    "Slate_Date": "2026-07-03",
                    "Time": "7:10 PM ET",
                    "Away": "NYY",
                    "Home": "BOS",
                    "Away_SP": "Away Starter",
                    "Away_Hand": "R",
                    "Home_SP": "Home Starter",
                    "Home_Hand": "L",
                }],
            )
            write_csv(
                data / "metrics_vs_RHP.csv",
                [
                    {"Tm": "BOS", "OSI": "70", "ABQ": "60", "RCV": "75", "OBR": "68"},
                    {"Tm": "NYY", "OSI": "65", "ABQ": "55", "RCV": "70", "OBR": "64"},
                ],
            )
            write_csv(
                data / "metrics_vs_LHP.csv",
                [
                    {"Tm": "NYY", "OSI": "72", "ABQ": "62", "RCV": "76", "OBR": "69"},
                    {"Tm": "BOS", "OSI": "61", "ABQ": "53", "RCV": "64", "OBR": "60"},
                ],
            )
            write_csv(
                data / "team_profiles.csv",
                [
                    {"team": "BOS", "osi_ytd": "50", "osi_l7": "65"},
                    {"team": "NYY", "osi_ytd": "62", "osi_l7": "55"},
                ],
            )

            result = load_pipeline(data)
            self.assertEqual(result["slate_date"], "2026-07-03")
            self.assertEqual(result["games"][0]["key"], "NYY@BOS")
            self.assertEqual(result["offense"]["vs_rhp"][0]["team"], "BOS")
            self.assertEqual(result["offense"]["vs_lhp"][0]["team"], "NYY")
            self.assertEqual(result["offense"]["risers"][0]["team"], "BOS")
            self.assertEqual(result["offense"]["fallers"][0]["team"], "NYY")

    def test_legacy_sharp_adapter_discards_wrong_slate(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sharp.json"
            path.write_text(
                json.dumps({
                    "sharp_signals_recent": [
                        {
                            "snapshot_time": "2026-07-02T15:00:00+00:00",
                            "market_type": "ml",
                            "selection": "NYY",
                            "sharp_novig_prob": 0.58,
                            "soft_novig_prob": 0.52,
                        },
                        {
                            "snapshot_time": "2026-07-03T15:00:00+00:00",
                            "market_type": "total",
                            "selection": "over",
                            "sharp_novig_prob": 0.56,
                            "soft_novig_prob": 0.51,
                        },
                    ]
                }),
                encoding="utf-8",
            )
            result = load_sharp(path, "2026-07-03")
            self.assertEqual(result["ml"], [])
            self.assertEqual(len(result["totals"]), 1)
            self.assertAlmostEqual(result["totals"][0]["divergence"], 0.05)


class BundleAndRenderTests(unittest.TestCase):
    def setUp(self):
        self.bundle = json.loads(
            (ROOT / "examples" / "sample_bundle.json").read_text(encoding="utf-8")
        )

    def test_sample_bundle_is_valid(self):
        self.assertEqual(validate_bundle(self.bundle), [])

    def test_invalid_probabilities_fail_closed(self):
        self.bundle["games"][0]["projection"]["home_win_probability"] = 0.80
        problems = validate_bundle(self.bundle)
        self.assertTrue(any("sum to" in problem for problem in problems))

    def test_expected_slate_date_rejects_stale_bundle(self):
        problems = validate_bundle(self.bundle, expected_slate_date="2026-07-04")
        self.assertTrue(any("does not match expected" in problem for problem in problems))

    def test_all_reports_render_at_social_dimensions(self):
        with tempfile.TemporaryDirectory() as temp:
            paths = render_reports(self.bundle, Path(temp), "all")
            self.assertEqual(len(paths), 3)
            for path in paths:
                self.assertTrue(path.exists())
                with Image.open(path) as image:
                    self.assertEqual(image.size, (1080, 1350))

    def test_render_reports_validates_bundle(self):
        self.bundle["games"][0]["projection"]["home_win_probability"] = 0.80
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError):
            render_reports(self.bundle, Path(temp), "morning-slate")

    def test_render_reports_invokes_validate_bundle(self):
        with tempfile.TemporaryDirectory() as temp, patch(
            "chase_content.render.validate_bundle", return_value=[]
        ) as mocked:
            render_reports(self.bundle, Path(temp), "offensive-report")
            mocked.assert_called_once()
            self.assertEqual(mocked.call_args.args[0], self.bundle)
            self.assertTrue(mocked.call_args.kwargs.get("require_projections"))

    def test_missing_required_values_fail_closed(self):
        self.bundle["games"][0]["projection"].pop("away_win_probability")
        problems = validate_bundle(self.bundle, require_projections=True)
        self.assertTrue(any("win probabilities are missing" in problem for problem in problems))
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError) as raised:
            render_reports(self.bundle, Path(temp), "morning-slate")
        self.assertIn("win probabilities are missing", str(raised.exception))

    def test_invalid_market_probabilities_fail_closed(self):
        self.bundle["markets"]["ml"][0]["sharp_probability"] = None
        problems = validate_bundle(self.bundle)
        self.assertTrue(any("sharp probability" in problem for problem in problems))

    def test_missing_osi_and_market_values_are_not_zero(self):
        self.assertEqual(
            format_osi_window({"osi_ytd": None, "osi_l7": None}),
            "YTD — → L7 —",
        )
        self.assertEqual(
            format_market_move({"public_probability": None, "sharp_probability": 0.6}),
            "observation pending",
        )
        self.assertIsNone(market_divergence({"public_probability": None, "sharp_probability": 0.6}))
        self.assertIsNone(market_divergence({}))
        self.assertAlmostEqual(
            market_divergence({"public_probability": 0.4, "sharp_probability": 0.55, "divergence": -0.9}),
            0.15,
        )
        self.assertNotIn("0.0%", format_market_move({}))
        self.assertNotIn("+0.0", format_osi_window({}))

    def test_missing_projection_is_not_fabricated(self):
        self.assertIsNone(_run_separation({"projection": {}}))
        self.assertEqual(_separation(None), ("PENDING", MUTED))
        self.assertNotEqual(_separation(None)[0], "TOSS-UP")
        self.assertEqual(
            _model_separation_sort_key({"projection": {}}),
            float("-inf"),
        )

    def test_ranking_and_labels_derive_from_runs_not_probability(self):
        """Contract 5.2 and 5.5.

        `_model_separation_sort_key` previously ranked by win probability while
        being named for run separation, so the violation read as fixed. A close
        game with a lopsided probability must not outrank a genuine blowout.
        """
        blowout = {"projection": {"away_runs": 2.0, "home_runs": 6.0,
                                  "away_win_probability": 0.51,
                                  "home_win_probability": 0.49}}
        coinflip = {"projection": {"away_runs": 4.1, "home_runs": 4.3,
                                   "away_win_probability": 0.05,
                                   "home_win_probability": 0.95}}
        self.assertEqual(_run_separation(blowout), 4.0)
        self.assertGreater(
            _model_separation_sort_key(blowout),
            _model_separation_sort_key(coinflip),
        )
        self.assertEqual(_separation(_run_separation(blowout))[0], "LOPSIDED")
        self.assertEqual(_separation(_run_separation(coinflip))[0], "TOSS-UP")
        for sep, label in ((1.5, "LOPSIDED"), (1.0, "CLEAR EDGE"),
                           (0.5, "LEAN"), (0.49, "TOSS-UP")):
            self.assertEqual(_separation(sep)[0], label)

    def test_morning_slate_shows_no_win_probability(self):
        """Contract 5.5: no %, no win-prob bar, no probability-derived split."""
        source = Path(render.__file__).read_text(encoding="utf-8")
        self.assertNotIn("win_probability", source)
        self.assertNotIn("60A5FA", source)

    def test_renderer_source_has_no_fabricated_probability_defaults(self):
        source = (ROOT / "chase_content" / "render.py").read_text(encoding="utf-8")
        for needle in ("or 0.5", "or 0.0", "or 0)", "or 0,", "or 0 "):
            self.assertNotIn(needle, source)

    def test_bundled_fonts_are_dm_sans_and_roboto_condensed(self):
        for name in (
            "DMSans-Regular.ttf",
            "DMSans-Bold.ttf",
            "RobotoCondensed-Regular.ttf",
            "RobotoCondensed-Bold.ttf",
            "RobotoCondensed-ExtraBold.ttf",
        ):
            path = _FONTS_DIR / name
            self.assertTrue(path.is_file(), msg=path)
            self.assertGreater(path.stat().st_size, 1000)

        loaded = _font(24, display=False, bold=False)
        self.assertTrue(Path(loaded.path).is_file())
        self.assertTrue(str(Path(loaded.path).resolve()).startswith(str(_FONTS_DIR.resolve())))
        self.assertTrue(FONTS["title"].getname()[0].startswith("Roboto Condensed"))
        self.assertTrue(FONTS["body"].getname()[0].startswith("DM Sans"))

        for path in (ROOT / "chase_content").rglob("*.py"):
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("fonts.googleapis.com", text, msg=str(path))
            self.assertNotIn("fonts.gstatic.com", text, msg=str(path))
            self.assertNotIn("@font-face", text, msg=str(path))

    def test_metallic_fill_is_only_used_on_major_headings(self):
        source = inspect.getsource(__import__("chase_content.render", fromlist=["render"]))
        self.assertIn("_metallic_text(image, (60, 82), title, FONTS[\"title\"])", source)
        self.assertIn("_metallic_text(image, (x1 + 26, y1 + 24), title, FONTS[\"panel_title\"])", source)
        self.assertIn("_metallic_text(image, (x1 + 26, y1 + 20), _market_title(category), FONTS[\"panel_title\"])", source)
        call_count = source.count("_metallic_text(")
        self.assertEqual(call_count, 4)  # definition + 3 call sites

    def test_featured_matchup_is_dropped_not_emitted(self):
        contracts = json.loads((ROOT / "content_plan" / "report_contracts.json").read_text(encoding="utf-8"))
        self.assertEqual(contracts["featured-matchup"]["status"], "dropped")
        self.assertNotIn("featured-matchup", REPORTS)
        import chase_content.render as render_mod

        self.assertFalse(hasattr(render_mod, "render_featured_matchup"))

    def test_missing_projected_runs_fail_closed(self):
        self.bundle["games"][0]["projection"].pop("away_runs")
        problems = validate_bundle(self.bundle, require_projections=True)
        self.assertTrue(any("projected runs are missing" in problem for problem in problems))
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError):
            render_reports(self.bundle, Path(temp), "all")

    def test_missing_market_timestamp_fail_closed(self):
        self.bundle["markets"]["ml"][0]["snapshot_time"] = ""
        problems = validate_bundle(self.bundle)
        self.assertTrue(any("observation timestamp is missing or invalid" in problem for problem in problems))

    def test_contradictory_divergence_fail_closed(self):
        self.bundle["markets"]["ml"][0]["public_probability"] = 0.4
        self.bundle["markets"]["ml"][0]["sharp_probability"] = 0.6
        self.bundle["markets"]["ml"][0]["divergence"] = -0.9
        problems = validate_bundle(self.bundle)
        self.assertTrue(any("does not match" in problem for problem in problems))
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError):
            render_reports(self.bundle, Path(temp), "public-vs-sharp")

    def test_infinite_divergence_fail_closed(self):
        self.bundle["markets"]["ml"][0]["divergence"] = float("inf")
        problems = validate_bundle(self.bundle)
        self.assertTrue(any("divergence is not a finite number" in problem for problem in problems))

    def test_boolean_and_out_of_range_probabilities_fail_closed(self):
        self.bundle["games"][0]["projection"]["away_win_probability"] = False
        self.bundle["games"][0]["projection"]["home_win_probability"] = True
        problems = validate_bundle(self.bundle)
        self.assertTrue(any("away win probability" in problem for problem in problems))
        self.bundle = json.loads((ROOT / "examples" / "sample_bundle.json").read_text(encoding="utf-8"))
        self.bundle["games"][0]["projection"]["away_win_probability"] = -0.2
        self.bundle["games"][0]["projection"]["home_win_probability"] = 1.2
        problems = validate_bundle(self.bundle)
        self.assertTrue(any("away win probability" in problem for problem in problems))
        self.assertTrue(any("home win probability" in problem for problem in problems))
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError):
            render_reports(self.bundle, Path(temp), "morning-slate")

    def test_metallic_heading_keeps_full_glyph_height(self):
        from chase_content.render import BG, _metallic_text

        image = Image.new("RGB", (1080, 200), BG)
        xy = (60, 82)
        text = "MORNING SLATE"
        font = FONTS["title"]
        bbox = ImageDraw.Draw(image).textbbox(xy, text, font=font, anchor="lt")
        _metallic_text(image, xy, text, font, anchor="lt")
        x0, y0, x1, y1 = bbox
        crop = image.crop((x0, y0, x1, y1))
        bg = tuple(int(BG.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
        rows_with_ink = 0
        for y in range(crop.size[1]):
            if any(crop.getpixel((x, y)) != bg for x in range(crop.size[0])):
                rows_with_ink += 1
        self.assertGreaterEqual(rows_with_ink, (y1 - y0) - 2)
        self.assertGreater(rows_with_ink, 28)


class SharpZeroObservationTests(unittest.TestCase):
    def test_load_sharp_preserves_zero_probability(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sharp.json"
            path.write_text(
                json.dumps({
                    "signals": [
                        {
                            "snapshot_time": "2026-07-03T15:00:00+00:00",
                            "market_type": "ml",
                            "selection": "NYY",
                            "sharp_probability": 0,
                            "public_probability": 0.4,
                        },
                        {
                            "snapshot_time": "2026-07-03T15:00:00+00:00",
                            "market_type": "total",
                            "selection": "over",
                            "sharp_probability": 0,
                            "sharp_novig_prob": 0.7,
                            "public_probability": 0.4,
                        },
                    ]
                }),
                encoding="utf-8",
            )
            result = load_sharp(path, "2026-07-03")
            self.assertEqual(len(result["ml"]), 1)
            self.assertAlmostEqual(result["ml"][0]["sharp_probability"], 0.0)
            self.assertAlmostEqual(result["ml"][0]["divergence"], -0.4)
            self.assertAlmostEqual(result["totals"][0]["sharp_probability"], 0.0)
            self.assertAlmostEqual(result["totals"][0]["divergence"], -0.4)


if __name__ == "__main__":
    unittest.main()
