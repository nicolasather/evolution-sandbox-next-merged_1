#!/usr/bin/env python3
"""Build data/expansion/art_exp26.json from the hand-composed drawing registry and lint every drawing.

  python3 tools/expansion/build_art.py                 # build + lint, write the art file and a coverage report
  python3 tools/expansion/build_art.py --check         # lint only, exit 1 on any problem (used by tests / CI)

Lint rules mirror what lib/plate3d.ts + the plate renderer can safely consume:
  * only whitelisted elements: g path line circle ellipse rect polyline polygon
  * no scripts / event handlers / external refs / <text> (no generated letters)
  * 2+ depth layers (<g data-z>), at least one hairline-detail path (opacity < 1)
  * no invisible geometry (opacity 0 / stroke-width 0), no NaN, coordinates inside -6..106
  * markup <= 6.5 KB and <= 140 geometric elements (hand art: median 13 paths, max 5.6 KB)
Every drawing must be distinct: identical markup for two items is an error.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from art import REGISTRY, TOPIC_OF, draw, load_all  # noqa: E402

ALLOWED = {"g", "path", "line", "circle", "ellipse", "rect", "polyline", "polygon"}
GEOM = {"path", "line", "circle", "ellipse", "rect", "polyline", "polygon"}
DRAFT = ROOT / "data" / "expansion_drafts" / "exp26_1000.json"
OUT = ROOT / "data" / "expansion" / "art_exp26.json"
MAX_BYTES, MAX_ELEMENTS = 6500, 140


def name_to_id() -> dict[str, str]:
    nodes = json.loads(DRAFT.read_text(encoding="utf-8"))
    return {n["n"]: n["id"] for n in nodes}


def lint(markup: str) -> list[str]:
    p: list[str] = []
    for tag in re.findall(r"<\s*([A-Za-z][A-Za-z0-9]*)", markup):
        if tag not in ALLOWED:
            p.append(f"element <{tag}> not allowed")
    if re.search(r"(?i)<script|javascript:|\bon[a-z]+\s*=|href\s*=|xlink|<text|<image|<use|style\s*=|url\(", markup):
        p.append("forbidden construct (script/handler/href/text/image/use/style/url)")
    if "NaN" in markup or "inf" in markup.lower().replace("fill", "").replace("info", ""):
        p.append("non-finite number")
    if not markup.startswith("<g"):
        p.append("must start with a <g data-z> layer")
    layers = set(re.findall(r'data-z="(-?\d+)"', markup))
    if len(layers) < 2:
        p.append(f"needs 2+ depth layers, has {len(layers)}")
    if not re.search(r'opacity="0?\.\d+"', markup):
        p.append("no hairline (opacity<1) detail")
    if re.search(r'opacity="0(\.0+)?"', markup) or re.search(r'stroke-width="0(\.0+)?"', markup):
        p.append("invisible geometry (opacity/stroke-width 0)")
    if len(markup.encode("utf-8")) > MAX_BYTES:
        p.append(f"markup too large ({len(markup.encode('utf-8'))} B)")
    els = len(re.findall(r"<(?:path|line|circle|ellipse|rect|polyline|polygon)\b", markup))
    if els > MAX_ELEMENTS:
        p.append(f"too many elements ({els})")
    if els < 6:
        p.append(f"too sparse ({els} elements)")
    for m in re.finditer(r'\b(?:cx|cy|x1|x2|y1|y2|x|y)="(-?\d+(?:\.\d+)?)"', markup):
        v = float(m.group(1))
        if not -6 <= v <= 106:
            p.append(f"coordinate {v} outside the plate")
            break
    for m in re.finditer(r'points="([^"]+)"', markup):
        nums = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", m.group(1))]
        if any(not -6 <= v <= 106 for v in nums):
            p.append("polyline point outside the plate")
            break
    for m in re.finditer(r' d="([^"]+)"', markup):
        d = m.group(1)
        if re.search(r"[^MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]", d):
            p.append("bad path data")
            break
    return p


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    load_all()
    n2i = name_to_id()
    art: dict[str, str] = {}
    problems: list[str] = []
    seen: dict[str, str] = {}
    unknown = [nm for nm in REGISTRY if nm not in n2i]
    for nm in unknown:
        problems.append(f"{nm}: no draft item with this name")
    for nm, fn in REGISTRY.items():
        if nm not in n2i:
            continue
        markup = fn().markup()
        for why in lint(markup):
            problems.append(f"{nm}: {why}")
        h = hashlib.sha256(markup.encode()).hexdigest()
        if h in seen:
            problems.append(f"{nm}: identical to {seen[h]}")
        seen[h] = nm
        art[n2i[nm]] = markup
    missing = sorted(set(n2i) - set(REGISTRY))
    print(f"drawings: {len(art)}  / draft items: {len(n2i)}   (not yet drawn: {len(missing)})")
    for t in sorted(set(TOPIC_OF.values())):
        c = sum(1 for k, v in TOPIC_OF.items() if v == t)
        print(f"  {t:<28}{c}")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for x in problems[:60]:
            print("  ✗", x)
        if len(problems) > 60:
            print(f"  … and {len(problems) - 60} more")
        return 1
    if not a.check:
        out = Path(a.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        ordered = {k: art[k] for k in sorted(art)}
        out.write_text(json.dumps(ordered, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT).as_posix()}  ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
