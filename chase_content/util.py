from __future__ import annotations

import csv
import datetime as dt
import json
import math
from pathlib import Path
from typing import Any


def number(value: Any) -> float | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(result):
        return None
    return result


def unit_probability(value: Any) -> float | None:
    parsed = number(value)
    if parsed is None or parsed < 0 or parsed > 1:
        return None
    return parsed


def first_present_number(row: dict[str, Any], *keys: str) -> float | None:
    """Parse the first present alias. Zero is a real observation, not a missing flag."""
    for key in keys:
        if key not in row:
            continue
        raw = row[key]
        if raw is None or raw == "":
            continue
        return number(raw)
    return None


def integer(value: Any) -> int | None:
    parsed = number(value)
    return int(parsed) if parsed is not None else None


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists() or not path.stat().st_size:
        return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, default=str) + "\n",
        encoding="utf-8",
    )


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def game_key(away: str, home: str) -> str:
    return f"{str(away).strip().upper()}@{str(home).strip().upper()}"


def parse_iso_date(value: Any) -> str | None:
    raw = str(value or "").strip()
    if len(raw) < 10:
        return None
    candidate = raw[:10]
    try:
        return dt.date.fromisoformat(candidate).isoformat()
    except ValueError:
        return None


def find_file(directory: Path, *names: str) -> Path:
    for name in names:
        candidate = directory / name
        if candidate.exists():
            return candidate
    return directory / names[0]


def truncate(value: Any, length: int) -> str:
    text = str(value or "").strip()
    return text if len(text) <= length else text[: max(0, length - 1)].rstrip() + "…"

