#!/usr/bin/env python3
"""Build a PREVIEW-ONLY overlay: the 918 shipped nodes + the exp26 draft nodes, each flagged UNVERIFIED DRAFT.

Writes build/preview/db.expansion-preview.json and build/preview/art.expansion-preview.json.
It never touches data/db.json, data/art.json or data/nodes/*.json, and it refuses to run on `main`,
on a Vercel production deploy, or when asked to write anywhere inside data/.

  python3 tools/expansion/preview_install.py            # build the preview overlay
  python3 tools/expansion/preview_install.py --check    # verify invariants only (no files written)

Invariants (violations exit 1): the 918 shipped nodes are carried byte-for-byte; no draft id/name collides with a
shipped one; every draft carries the DRAFT flag and its original caution; every draft has a drawing.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "db.json"
DRAFTS = ROOT / "data" / "expansion_drafts" / "exp26_1000.json"
ART = ROOT / "data" / "expansion" / "art_exp26.json"
OUT = ROOT / "build" / "preview"
PREVIEW_LABEL = "UNVERIFIED DRAFT - preview only"


def current_branch() -> str:
    try:
        return subprocess.run(["git", "-C", str(ROOT), "branch", "--show-current"], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""


def refuse_if_unsafe(out: Path) -> None:
    if os.environ.get("VERCEL_ENV") == "production" or os.environ.get("NEXT_PUBLIC_DEPLOY_ENV") == "production":
        sys.exit("refused: production environment")
    if current_branch() in ("main", "master"):
        sys.exit("refused: preview overlay may not be built on main")
    data_dir = (ROOT / "data").resolve()
    if data_dir in out.resolve().parents or out.resolve() == data_dir:
        sys.exit("refused: output may not be inside data/")


def build() -> tuple[dict, dict, list[str]]:
    db = json.loads(DB.read_text(encoding="utf-8"))
    drafts = json.loads(DRAFTS.read_text(encoding="utf-8"))
    art = json.loads(ART.read_text(encoding="utf-8"))
    problems: list[str] = []
    ids = {n["id"] for n in db["nodes"]}
    names = {n["n"].strip().lower() for n in db["nodes"]}
    new_nodes = []
    for d in drafts:
        if d["id"] in ids:
            problems.append(f"id collision: {d['id']}")
        if d["n"].strip().lower() in names:
            problems.append(f"name collision: {d['n']}")
        if "DRAFT" not in d.get("caution", ""):
            problems.append(f"{d['id']}: DRAFT caution missing")
        if d["id"] not in art:
            problems.append(f"{d['id']}: no drawing")
        n = copy.deepcopy(d)
        n["preview"] = True
        n["status"] = PREVIEW_LABEL
        n["verified"] = False
        new_nodes.append(n)
        ids.add(d["id"])
        names.add(d["n"].strip().lower())
    out = copy.deepcopy(db)
    out["nodes"] = db["nodes"] + new_nodes
    out["previewOnly"] = True
    out["previewLabel"] = PREVIEW_LABEL
    out["baseNodeCount"] = len(db["nodes"])
    out["draftNodeCount"] = len(new_nodes)
    if out["nodes"][: len(db["nodes"])] != db["nodes"]:
        problems.append("shipped nodes were altered")
    return out, {k: art[k] for k in sorted(art)}, problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    out_dir = Path(a.out)
    refuse_if_unsafe(out_dir)
    db, art, problems = build()
    print(f"shipped nodes: {db['baseNodeCount']}  draft nodes: {db['draftNodeCount']}  drawings: {len(art)}")
    if problems:
        for p in problems[:40]:
            print("  x", p)
        return 1
    if not a.check:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "db.expansion-preview.json").write_text(json.dumps(db, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        (out_dir / "art.expansion-preview.json").write_text(json.dumps(art, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {out_dir}  (label: {PREVIEW_LABEL})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
