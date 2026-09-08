from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

from chase_content.migrate import migrate
from chase_content.render import render_reports
from chase_content.util import read_json, write_json
from chase_content.validate import validate_bundle

REPORTS = ("all", "morning-slate", "offensive-report", "public-vs-sharp", "featured-matchup")


def _path(value: str | None) -> Path | None:
    return Path(value) if value else None


def _print_problems(problems: list[str]) -> None:
    for problem in problems:
        print(f"ERROR: {problem}", file=sys.stderr)


def _eastern_today() -> str:
    return dt.datetime.now(ZoneInfo("America/New_York")).date().isoformat()


def _migrate(args: argparse.Namespace) -> int:
    bundle = migrate(
        pipeline_data=Path(args.pipeline_data),
        model_repo=_path(args.model_repo),
        sharp_json=_path(args.sharp_json),
        opinions=_path(args.opinions),
    )
    problems = validate_bundle(bundle, require_projections=bool(args.model_repo))
    if problems:
        _print_problems(problems)
        return 1
    output = Path(args.out)
    write_json(output, bundle)
    print(f"Wrote canonical bundle: {output}")
    return 0


def _validate(args: argparse.Namespace) -> int:
    bundle = read_json(Path(args.bundle))
    problems = validate_bundle(
        bundle,
        require_projections=not args.allow_missing_projections,
        expected_slate_date=_eastern_today() if args.require_today else None,
    )
    if problems:
        _print_problems(problems)
        return 1
    print(f"Bundle valid: {args.bundle}")
    return 0


def _build(args: argparse.Namespace) -> int:
    bundle = read_json(Path(args.bundle))
    problems = validate_bundle(bundle, require_projections=True)
    if problems:
        _print_problems(problems)
        return 1
    paths = render_reports(bundle, Path(args.out), args.report)
    for path in paths:
        print(f"Wrote graphic: {path}")
    return 0


def _daily(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    bundle = migrate(
        pipeline_data=Path(args.pipeline_data),
        model_repo=Path(args.model_repo),
        sharp_json=_path(args.sharp_json),
        opinions=_path(args.opinions),
    )
    problems = validate_bundle(
        bundle,
        require_projections=True,
        expected_slate_date=_eastern_today(),
    )
    if problems:
        _print_problems(problems)
        return 1
    bundle_path = out_dir / "content-bundle.json"
    write_json(bundle_path, bundle)
    print(f"Wrote canonical bundle: {bundle_path}")
    for path in render_reports(bundle, out_dir, "all"):
        print(f"Wrote graphic: {path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="chase-content",
        description="Migrate verified Chase Analytics data and render social graphics.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    migrate_parser = sub.add_parser("migrate", help="Build the canonical content bundle")
    migrate_parser.add_argument("--pipeline-data", required=True)
    migrate_parser.add_argument("--model-repo")
    migrate_parser.add_argument("--sharp-json")
    migrate_parser.add_argument("--opinions")
    migrate_parser.add_argument("--out", required=True)
    migrate_parser.set_defaults(handler=_migrate)

    validate_parser = sub.add_parser("validate", help="Validate a canonical content bundle")
    validate_parser.add_argument("--bundle", required=True)
    validate_parser.add_argument("--allow-missing-projections", action="store_true")
    validate_parser.add_argument("--require-today", action="store_true")
    validate_parser.set_defaults(handler=_validate)

    build = sub.add_parser("build", help="Render social graphics")
    build.add_argument("--bundle", required=True)
    build.add_argument("--report", choices=REPORTS, default="all")
    build.add_argument("--out", required=True)
    build.set_defaults(handler=_build)

    daily = sub.add_parser("daily", help="Migrate, validate, and render all daily reports")
    daily.add_argument("--pipeline-data", required=True)
    daily.add_argument("--model-repo", required=True)
    daily.add_argument("--sharp-json")
    daily.add_argument("--opinions")
    daily.add_argument("--out", required=True)
    daily.set_defaults(handler=_daily)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    raise SystemExit(args.handler(args))


if __name__ == "__main__":
    main()
