#!/usr/bin/env python3
"""Render the registered exp26 drawings of one topic (or all) to a PNG contact sheet for visual QA.

  python3 tools/expansion/render_topic.py --topic "clay vessels" --out /tmp/sheet.png
  python3 tools/expansion/render_topic.py --names "Pinch Pot,Clay Lamp" --out /tmp/x.png --cols 2
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from contact_sheet import sheet  # noqa: E402
from art import REGISTRY, TOPIC_OF, draw, load_all  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", default="")
    ap.add_argument("--names", default="")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    load_all()
    if a.names:
        names = [x.strip() for x in a.names.split(",") if x.strip()]
    elif a.topic:
        names = [k for k in REGISTRY if TOPIC_OF[k] == a.topic]
    else:
        names = list(REGISTRY)
    items = [(nm, draw(nm).markup()) for nm in names]
    sheet(items, a.cols, a.topic or "exp26 drawings").save(a.out)
    print(f"{len(items)} drawings -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
