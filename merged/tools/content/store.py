"""Paths and safe JSON IO for the verified-content workflow."""
from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

BATCH_RE = re.compile(r"^[a-z][a-z0-9_-]{0,47}$")


class StoreError(RuntimeError):
    pass


def check_batch_name(name: str) -> str:
    if not BATCH_RE.fullmatch(name or ""):
        raise StoreError("invalid_batch_name")
    return name


def read_json(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise StoreError(f"file_not_found:{path.name}")
    except json.JSONDecodeError as e:
        raise StoreError(f"invalid_json:{path.name}:{e.msg}@{e.lineno}")


def dumps(obj: Any) -> str:
    """Stable, human-diffable JSON (sorted keys, 2 spaces, trailing newline, LF)."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else "absent"


class Paths:
    def __init__(self, root: Path | str, batch: str):
        self.root = Path(root)
        self.batch = check_batch_name(batch)
        d = self.root / "data"
        self.seeds = d / "verified_seeds" / f"{batch}.json"
        self.decisions = d / "verified_seeds" / f"{batch}.anchors.json"
        self.frozen = d / "verified_seeds" / f"{batch}.anchors.frozen.json"
        self.reviews = d / "verified_seeds" / f"{batch}.reviews.json"
        self.proposals = d / "verified" / "proposals" / f"{batch}.json"
        self.claims = d / "verified" / "claims" / f"{batch}.json"
        self.release = d / "verified" / "releases" / f"{batch}.release.json"
        self.alt_routes = d / "verified" / "alt_routes.json"
        self.nodes = d / "nodes" / f"v3_{batch}.json"
        self.sources = d / "sources.json"
        self.backups = d / "verified" / "backups"
        self.out = self.root / "out"
