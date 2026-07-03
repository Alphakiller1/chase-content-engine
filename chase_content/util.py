from __future__ import annotations

import csv
import datetime as dt
import json
from pathlib import Path
from typing import Any


def number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    if result != result:
        return None
    return result


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

