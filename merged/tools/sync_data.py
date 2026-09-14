#!/usr/bin/env python3
"""Keep this app in step with the single-file build it was ported from.

The two projects ship side by side:

    evolution-sandbox/        <- canonical: data/, tools/, src/styles.css
    evolution-sandbox-next/   <- this app

  python3 tools/sync_data.py            copy the canonical data, tools and design
                                        system in, then rebuild data/db.json
  python3 tools/sync_data.py --check    change nothing; exit 1 if anything differs
  python3 tools/sync_data.py --from PATH   canonical project somewhere else

Compared: data/nodes/*.json, data/sources.json, the three shared python tools,
src/styles.css against app/_design-system.css, and data/db.json against a
fresh build of the canonical data (via its dataHash).
"""
from __future__ import annotations

import argparse
import filecmp
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
DEFAULT_CANON = HERE.parent / "evolution-sandbox"

SHARED_TOOLS = ("validate.py", "build_db.py", "patch_recipes.py")


def pairs(canon: Path) -> list[tuple[Path, Path]]:
    """(canonical file, file in this app) — everything that must be identical."""
    out = []
    for src in sorted((canon / "data" / "nodes").glob("*.json")):
        out.append((src, HERE / "data" / "nodes" / src.name))
    out.append((canon / "data" / "sources.json", HERE / "data" / "sources.json"))
    for name in SHARED_TOOLS:
        out.append((canon / "tools" / name, HERE / "tools" / name))
    out.append((canon / "src" / "styles.css", HERE / "app" / "_design-system.css"))
    return out


def data_hash(db_path: Path) -> str | None:
    try:
        return json.loads(db_path.read_text(encoding="utf-8")).get("dataHash")
    except (OSError, ValueError):
        return None


def build_db() -> None:
    """Run the shared builder here and install its output as data/db.json."""
    subprocess.run([sys.executable, str(HERE / "tools" / "build_db.py")], check=True, cwd=HERE)
    shutil.copyfile(HERE / "build" / "db.json", HERE / "data" / "db.json")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report differences, change nothing")
    ap.add_argument("--from", dest="canon", type=Path, default=DEFAULT_CANON,
                    help=f"canonical project (default: {DEFAULT_CANON})")
    args = ap.parse_args()

    canon = args.canon.resolve()
    if not (canon / "data" / "nodes").is_dir():
        print(f"canonical project not found at {canon}\n"
              f"  unzip evolution-sandbox-source.zip next to this folder, or pass --from PATH")
        return 2

    diffs = [(a, b) for a, b in pairs(canon) if not b.exists() or not filecmp.cmp(a, b, shallow=False)]
    extra = sorted({p.name for p in (HERE / "data" / "nodes").glob("*.json")} -
                   {p.name for p in (canon / "data" / "nodes").glob("*.json")})

    if args.check:
        for a, b in diffs:
            print(f"DIFFERS  {b.relative_to(HERE)}  vs  {a.relative_to(canon.parent)}")
        for name in extra:
            print(f"EXTRA    data/nodes/{name} (not in the canonical project)")
        canon_db = canon / "build" / "db.json"
        mine, theirs = data_hash(HERE / "data" / "db.json"), data_hash(canon_db)
        if theirs and mine != theirs:
            print(f"DIFFERS  data/db.json dataHash {str(mine)[:12]} vs canonical build {theirs[:12]}")
            diffs.append((canon_db, HERE / "data" / "db.json"))
        if diffs or extra:
            print("out of sync — run: npm run data:sync")
            return 1
        print(f"in sync with {canon}  (dataHash {str(mine)[:12]})")
        return 0

    for a, b in diffs:
        b.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(a, b)
        print(f"copied   {a.relative_to(canon.parent)}  ->  {b.relative_to(HERE)}")
    for name in extra:
        print(f"note     data/nodes/{name} exists only here; remove it if it was deleted upstream")
    build_db()
    print(f"data/db.json rebuilt  (dataHash {str(data_hash(HERE / 'data' / 'db.json'))[:12]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
