from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

from chase_content.migrate import migrate
from chase_content.render import render_reports
from chase_content.render_site import SITE_REPORTS, render_site_reports
from chase_content.site import load_site_bundle, validate_site_bundle
from chase_content.util import read_json, write_json
from chase_content.validate import validate_bundle

REPORTS = ("all", "morning-slate", "offensive-report", "public-vs-sharp")


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


def _site_source(args: argparse.Namespace) -> dict:
    return load_site_bundle(
        site_root=_path(getattr(args, "site_root", None)),
        site_base=getattr(args, "site_base", None),
    )


def _sync_site(args: argparse.Namespace) -> int:
    bundle = _site_source(args)
    problems = validate_site_bundle(bundle, max_age_hours=args.max_age_hours)
    if problems:
        _print_problems(problems)
        return 1
    output = Path(args.out)
    write_json(output, bundle)
    print(f"Wrote canonical site bundle: {output}")
    return 0


def _validate_site(args: argparse.Namespace) -> int:
    problems = validate_site_bundle(
        read_json(Path(args.bundle)), max_age_hours=args.max_age_hours
    )
    if problems:
        _print_problems(problems)
        return 1
    print(f"Site bundle valid: {args.bundle}")
    return 0


def _site_build(args: argparse.Namespace) -> int:
    bundle = read_json(Path(args.bundle))
    try:
        paths = render_site_reports(bundle, Path(args.out), args.report, args.game)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    for path in paths:
        print(f"Wrote graphic: {path}")
    return 0


def _site_daily(args: argparse.Namespace) -> int:
    bundle = _site_source(args)
    problems = validate_site_bundle(bundle, max_age_hours=args.max_age_hours)
    if problems:
        _print_problems(problems)
        return 1
    out_dir = Path(args.out)
    bundle_path = out_dir / "site-content-bundle.json"
    write_json(bundle_path, bundle)
    print(f"Wrote canonical site bundle: {bundle_path}")
    for path in render_site_reports(bundle, out_dir, args.report, args.game):
        print(f"Wrote graphic: {path}")
    return 0


def _add_site_source(parser: argparse.ArgumentParser) -> None:
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--site-root", help="Local chase-analytics.com repository root")
    source.add_argument("--site-base", help="Published site base URL")
    parser.add_argument("--max-age-hours", type=float)


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

    sync_site = sub.add_parser(
        "sync-site", help="Build a canonical MLB + NFL bundle from public site contracts"
    )
    _add_site_source(sync_site)
    sync_site.add_argument("--out", required=True)
    sync_site.set_defaults(handler=_sync_site)

    validate_site = sub.add_parser("validate-site", help="Validate a canonical site bundle")
    validate_site.add_argument("--bundle", required=True)
    validate_site.add_argument("--max-age-hours", type=float)
    validate_site.set_defaults(handler=_validate_site)

    site_build = sub.add_parser("site-build", help="Render current-site MLB and NFL reports")
    site_build.add_argument("--bundle", required=True)
    site_build.add_argument("--report", choices=SITE_REPORTS, default="all")
    site_build.add_argument("--game", help="NFL AWAY@HOME key or game id")
    site_build.add_argument("--out", required=True)
    site_build.set_defaults(handler=_site_build)

    site_daily = sub.add_parser("site-daily", help="Sync, validate, and render public site data")
    _add_site_source(site_daily)
    site_daily.add_argument("--report", choices=SITE_REPORTS, default="all")
    site_daily.add_argument("--game", help="NFL AWAY@HOME key or game id")
    site_daily.add_argument("--out", required=True)
    site_daily.set_defaults(handler=_site_daily)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    raise SystemExit(args.handler(args))


if __name__ == "__main__":
    main()
