#!/usr/bin/env python3
"""Contact sheet of the EXP28 plates -> PNG (uses the same stroke grammar as lib/glyphs.ts).
   python3 tools/exp28/sheet.py [--ids a,b] [--cols 5] [--out /tmp/sheet.png]"""
import argparse, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser(); ap.add_argument("--ids", default=""); ap.add_argument("--cols", type=int, default=5)
ap.add_argument("--out", default="/tmp/work/sheet.png"); ap.add_argument("--batch", default=""); a = ap.parse_args()
art = json.loads((ROOT / "data/art.json").read_text(encoding="utf-8"))
nodes = {n["id"]: n for n in json.loads((ROOT / "data/nodes/g13.json").read_text(encoding="utf-8"))}
ids = [i for i in a.ids.split(",") if i] or list(nodes)
cells = ""
for i in ids:
    cells += f'<div class="c"><svg viewBox="0 0 100 100" width="260" height="260" fill="none" stroke="#e8e2d0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{art[i]}</svg><div>{nodes[i]["n"]}</div></div>'
html = f'<html><body style="margin:0;background:#15130f;color:#bbb;font:12px sans-serif"><style>.c{{display:inline-block;width:268px;text-align:center;margin:4px;background:#1d1a14}}</style>{cells}</body></html>'
Path("/tmp/work/sheet.html").write_text(html, encoding="utf-8")
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 280 * a.cols, "height": 400}); pg.goto("file:///tmp/work/sheet.html")
    pg.screenshot(path=a.out, full_page=True); b.close()
print(a.out)
