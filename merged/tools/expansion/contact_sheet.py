#!/usr/bin/env python3
"""Render plate-art markup (the inner SVG used by data/art.json) to a PNG contact sheet.

Used for visual QA of the exp26 expansion artwork next to the existing 918 drawings.
It reproduces the flat wrapper from lib/glyphs.ts -> svg(): viewBox 0 0 100 100, fill none,
stroke currentColor, stroke-width 2, round caps/joins. It does NOT run the Plate3D extrusion
(that needs a browser); `geometry_stats` approximates the point budget instead.

  python3 tools/expansion/contact_sheet.py --ids stone,wood,pottery --out /tmp/sheet.png
  python3 tools/expansion/contact_sheet.py --art data/expansion/art_exp26.json --first 48 --out sheet.png
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]

BG = "#ebe6da"      # warm paper tone of the plate card
INK = "#26221e"
CELL = 220
PAD = 14
LABEL_H = 34


def wrap(inner: str, ink: str = INK, sw: float = 2.0) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="{CELL}" height="{CELL}" '
        f'fill="none" stroke="{ink}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" '
        f'color="{ink}">'
        f'<rect x="0" y="0" width="100" height="100" fill="{BG}" stroke="none"/>'
        f'<g opacity=".28"><line x1="4" y1="4" x2="14" y2="4"/><line x1="4" y1="4" x2="4" y2="14"/>'
        f'<line x1="96" y1="96" x2="86" y2="96"/><line x1="96" y1="96" x2="96" y2="86"/></g>'
        f'{inner.replace("currentColor", ink)}</svg>'
    )


def geometry_stats(inner: str) -> dict:
    """Cheap proxy for lib/plate3d.ts budget: element and path-command counts, z layers."""
    return {
        "bytes": len(inner.encode("utf-8")),
        "paths": len(re.findall(r"<path\b", inner)),
        "elements": len(re.findall(r"<(path|circle|ellipse|rect|line|polyline|polygon)\b", inner)),
        "layers": len(set(re.findall(r'data-z="([^"]+)"', inner))),
        "dots": len(re.findall(r'fill="currentColor"', inner)),
    }


def render_png(inner: str) -> Image.Image:
    png = cairosvg.svg2png(bytestring=wrap(inner).encode("utf-8"), output_width=CELL, output_height=CELL)
    return Image.open(io.BytesIO(png)).convert("RGB")


def sheet(items: list[tuple[str, str]], cols: int = 6, title: str | None = None) -> Image.Image:
    rows = (len(items) + cols - 1) // cols
    w = cols * (CELL + PAD) + PAD
    top = 40 if title else 0
    h = rows * (CELL + LABEL_H + PAD) + PAD + top
    im = Image.new("RGB", (w, h), "#d9d3c4")
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    if title:
        d.text((PAD, 12), title, fill="#26221e", font=font)
    for k, (label, inner) in enumerate(items):
        r, c = divmod(k, cols)
        x = PAD + c * (CELL + PAD)
        y = top + PAD + r * (CELL + LABEL_H + PAD)
        im.paste(render_png(inner), (x, y))
        d.text((x + 2, y + CELL + 6), label[:34], fill="#26221e", font=font)
    return im


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--art", default=str(ROOT / "data" / "art.json"))
    ap.add_argument("--ids", default="")
    ap.add_argument("--first", type=int, default=0)
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--out", required=True)
    ap.add_argument("--title", default=None)
    a = ap.parse_args(argv)
    art = json.loads(Path(a.art).read_text(encoding="utf-8"))
    if a.ids:
        ids = [i for i in a.ids.split(",") if i]
    else:
        ids = list(art.keys())[a.offset:a.offset + (a.first or len(art))]
    items = [(i, art[i]) for i in ids if i in art]
    missing = [i for i in ids if i not in art]
    if missing:
        print("missing art:", missing, file=sys.stderr)
    sheet(items, a.cols, a.title).save(a.out)
    print(f"{len(items)} drawings -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
