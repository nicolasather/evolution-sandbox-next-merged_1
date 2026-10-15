#!/usr/bin/env python3
"""Plate art for the Ancient individual-recipe expansion (data/nodes/g12.json).

The 999 exp26 plates are hand composed. For the 841 anc27 items this module composes line drawings from a
library of ~30 archetype drawers (vessel, granary, wall, column, arch, canal, boat, wheel, tool, kiln, loom,
tablet, ...). An item is routed to the archetype that matches what the object *is* (keywords in its id),
its proportions and details come from a few per-item parameters, and a small maker's mark (a 3 x 3 pattern
derived from the id) guarantees that no two plates are identical. The grammar is the same as data/art.json:
<g data-z> layers, currentColor strokes, hairline detail at reduced opacity, whitelisted elements only.

  python3 tools/expansion/art_anc27.py            # build data/expansion/art_anc27.json + coverage report
  python3 tools/expansion/art_anc27.py --install  # also merge into data/art.json
  python3 tools/expansion/art_anc27.py --check    # lint only
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from art.core import Art, arc_front, cylinder, gear_d, iso_box, n, smooth_d, spokes, wave_d, zigzag  # noqa: E402
from art.kit import band, blob, bowl_prof, flame, foot_ring, loop_handle, vessel  # noqa: E402
from build_art import lint  # noqa: E402

G12 = ROOT / "data" / "nodes" / "g12.json"
OUT = ROOT / "data" / "expansion" / "art_anc27.json"


def H(item_id: str, salt: str = "") -> int:
    return int(hashlib.md5((item_id + salt).encode()).hexdigest(), 16)


class P:
    """Per-item parameters, all derived from the id so output is deterministic."""

    def __init__(self, item_id: str):
        self.id = item_id
        h = H(item_id)
        self.h = h
        self.a = (h >> 3) % 100 / 100.0
        self.b = (h >> 11) % 100 / 100.0
        self.c = (h >> 19) % 100 / 100.0
        self.k = (h >> 27) % 6
        self.words = set(item_id.replace("anc27_", "").split("_"))

    def has(self, *ws: str) -> bool:
        return any(w in self.words for w in ws)


def span(p: P, lo: float, hi: float, which: str = "a") -> float:
    return lo + (hi - lo) * getattr(p, which)


# ------------------------------------------------------------------------------------------ archetypes
def d_vessel(a: Art, p: P) -> None:
    tall = span(p, 0, 1, "a")
    if p.has("amphora", "urn", "jar", "crock", "vat", "pot", "cauldron"):
        top = 14 + 6 * p.b
        mid = 52 + 8 * p.c
        prof = [(top, 9 + 3 * p.a), (top + 8, 7 + 2 * p.a), (top + 20, 20 + 6 * tall), (mid, 26 + 5 * tall), (74, 18), (82, 9 + 3 * p.b)]
    elif p.has("basin", "bowl", "tank", "reservoir", "cistern", "trough", "pit", "fermenter", "mash", "tun"):
        prof = bowl_prof(30 + 8 * p.a, 40, 22 + 8 * p.b, 0.45)
    else:
        prof = [(26, 15), (36, 19 + 6 * p.a), (54, 26 + 4 * p.b), (70, 20), (80, 12)]
    vessel(a, prof, 50, 0)
    band(a, prof, prof[0][0] + (prof[-1][0] - prof[0][0]) * 0.5, 50, 3)
    if p.has("amphora", "pot", "cauldron", "jar", "bin", "crock"):
        loop_handle(a, -1, 50, prof[1][0], prof[2][0] + 6, prof, 8 + 3 * p.c, 0)
        loop_handle(a, 1, 50, prof[1][0], prof[2][0] + 6, prof, 8 + 3 * p.c, 0)
    if p.has("lid", "sealed", "cellar", "stored", "storage", "covered", "closed"):
        y = prof[0][0] - 3
        a.ellipse(50, y, prof[0][1] + 2, 3, 6, 1.4)
        a.line(50, y - 3, 50, y - 7, 6, 1.4)
        a.circle(50, y - 8, 1.6, 6, 1.2)
    if p.has("fermenter", "fermentation", "vat", "brine", "wine", "beer", "mead", "vinegar", "sauce", "garum", "pickled", "cheese", "yogurt", "milk"):
        for i in range(3):
            a.circle(44 + i * 6, 26 - 5 * i % 7, 1.2 + 0.4 * i, 6, 0.9, 0.6)
    a.shadow(50, 87, prof[-1][1] + 14)


def d_basket(a: Art, p: P) -> None:
    w = 18 + 8 * p.a
    h = 30 + 10 * p.b
    top = 70 - h
    a.path(f"M{n(50 - w)} {n(top)} Q{n(50 - w - 6)} {n(top + h * .6)} {n(50 - w + 5)} 72 L{n(50 + w - 5)} 72 Q{n(50 + w + 6)} {n(top + h * .6)} {n(50 + w)} {n(top)}", 0, 1.8)
    a.ellipse(50, top, w, 4.5, 0, 1.6)
    for i in range(1, 6):
        x = 50 - w + i * (2 * w / 6)
        a.line(x, top + 3, x + (x - 50) * 0.08, 72, 3, 0.9, 0.5)
    for j in range(3):
        y = top + 8 + j * (h - 10) / 3
        a.path(f"M{n(50 - w + 3)} {n(y)} Q50 {n(y + 5)} {n(50 + w - 3)} {n(y)}", 3, 1.0, 0.5)
    if p.has("hamper", "bin", "wicker"):
        a.path(f"M{n(50 - w)} {n(top)} Q50 {n(top - 16)} {n(50 + w)} {n(top)}", 6, 1.6)
    a.shadow(50, 80, w + 8)


def d_house(a: Art, p: P) -> None:
    w = 28 + 10 * p.a
    base = 74
    wh = 18 + 8 * p.b
    x0, x1 = 50 - w / 2, 50 + w / 2
    stilts = p.has("stilt", "crannog", "raised", "loft")
    if stilts:
        base = 58
        for i in range(4):
            x = x0 + 3 + i * (w - 6) / 3
            a.line(x, base, x, 80, 0, 1.6)
    a.rect(x0, base - wh, w, wh, 0, 1.8)
    kind = p.k % 3
    if p.has("dome", "domed", "roundhouse", "hut", "pit", "silo", "circular"):
        a.path(f"M{n(x0)} {n(base - wh)} Q50 {n(base - wh - 24)} {n(x1)} {n(base - wh)}", 0, 1.8)
    elif p.has("flat", "terrace", "courtyard", "adobe", "mud", "cellar", "storehouse", "warehouse"):
        a.line(x0 - 3, base - wh, x1 + 3, base - wh, 0, 2)
        a.line(x0 + 4, base - wh - 4, x1 - 4, base - wh - 4, 3, 1.0, 0.5)
    else:
        a.poly([(x0 - 4, base - wh), (50, base - wh - 14 - 6 * p.c), (x1 + 4, base - wh)], 0, 1.8)
        a.line(50, base - wh - 14 - 6 * p.c, 50, base - wh, 3, 0.9, 0.45)
    a.rect(50 - 4, base - 12, 8, 12, 3, 1.3)
    if kind == 1:
        a.rect(x0 + 4, base - wh + 4, 5, 5, 3, 1.1)
    for i in range(3):
        a.line(x0 + 2, base - wh + 4 + i * 4, x1 - 2, base - wh + 4 + i * 4, 4, 0.8, 0.3)
    if p.has("vent", "smoke", "hearth", "chimney"):
        a.path(f"M60 {n(base - wh - 8)} q4 -4 0 -8 q-4 -4 0 -8", 6, 1.0, 0.6)
    a.ground(86)


def d_wall(a: Art, p: P) -> None:
    rows = 4 + int(p.a * 2)
    h = 6.5
    w = 62 + 8 * p.b
    x0 = 50 - w / 2
    megal = p.has("megalithic", "cyclopean", "ashlar", "stone", "masonry", "platform", "pyramid", "stepped", "terraced", "retaining")
    stepped = p.has("pyramid", "stepped", "terraced", "platform", "ziggurat")
    for r in range(rows):
        y = 78 - (r + 1) * h
        inset = r * (5 if stepped else 0)
        a.rect(x0 + inset, y, w - 2 * inset, h, 0, 1.5)
        pos = x0 + inset
        step = (w - 2 * inset) / (3 + (r + int(p.c * 3)) % 3)
        k = 0
        while pos + step < x0 + w - inset - 1:
            pos += step * (1 + 0.15 * ((r + k) % 2))
            a.line(pos, y, pos, y + h, 3, 0.9, 0.5)
            k += 1
    if p.has("gate", "gateway", "pylon", "portal"):
        a.path("M42 78 L42 54 Q50 44 58 54 L58 78", 6, 1.6)
    if p.has("mud", "puddled", "cob", "rammed", "adobe", "plaster", "lime"):
        a.path("M" + " L".join(f"{n(x0 + i * 6)} {n(38 + (2 if i % 2 else -1))}" for i in range(int(w / 6) + 1)), 6, 1.0, 0.5)
    a.ground(86)


def d_column(a: Art, p: P) -> None:
    cols = 1 if p.has("obelisk", "stele", "marker", "pillar", "milestone", "monument", "stone", "column", "capital") and not p.has("hall", "temple", "colonnade") else 3
    order = "ionic" if p.has("ionic") else ("corinthian" if p.has("corinthian") else ("doric" if p.has("doric") else None))
    xs = [50] if cols == 1 else [26, 50, 74]
    for cx in xs:
        w = 5.5 + 2 * p.a if cols > 1 else 7 + 3 * p.a
        top = 24 + 4 * p.b
        a.line(cx - w, top + 6, cx - w + 0.6, 76, 0, 1.6)
        a.line(cx + w, top + 6, cx + w - 0.6, 76, 0, 1.6)
        a.rect(cx - w - 2, 76, 2 * w + 4, 4, 0, 1.5)
        a.rect(cx - w - 2, top, 2 * w + 4, 5, 0, 1.5)
        for i in range(-1, 2):
            a.line(cx + i * w * 0.5, top + 7, cx + i * w * 0.5, 74, 3, 0.8, 0.4)
        if order == "ionic":
            a.circle(cx - w - 1, top + 2, 2.2, 6, 1.1)
            a.circle(cx + w + 1, top + 2, 2.2, 6, 1.1)
        if order == "corinthian":
            a.path(f"M{n(cx - w)} {n(top + 6)} q-3 -8 3 -6 q3 -6 {n(w)} 0 q3 -6 {n(w)} 0 q6 -2 3 6", 6, 1.1)
    if cols > 1:
        a.rect(10, 18, 80, 5, 0, 1.6)
        a.poly([(10, 18), (50, 8 + 3 * p.c), (90, 18)], 0, 1.5)
    if p.has("obelisk"):
        a.poly([(43, 24), (50, 12), (57, 24)], 6, 1.4, close=True)
    a.ground(86)


def d_arch(a: Art, p: P) -> None:
    spans = 1 + int(p.a * 3) if p.has("viaduct", "multiarch", "aqueduct", "arcade", "bridge", "colonnade") else 1
    w = 56 / spans
    base = 74
    a.rect(14, 30, 72, 8, 0, 1.6)
    for i in range(spans):
        x0 = 14 + i * w
        a.path(f"M{n(x0 + 3)} {n(base)} L{n(x0 + 3)} {n(base - 14)} Q{n(x0 + w / 2)} {n(base - 14 - w * 0.7)} {n(x0 + w - 3)} {n(base - 14)} L{n(x0 + w - 3)} {n(base)}", 0, 1.7)
        a.line(x0 + w / 2, base - 14 - w * 0.62, x0 + w / 2, base - 14 - w * 0.62 - 3, 3, 1.0, 0.5)
        for j in range(5):
            t = (j + 1) / 6
            xa = x0 + 3 + (w - 6) * t
            a.line(xa, base - 14 - w * 0.55 * math.sin(math.pi * t) - 1, xa, base - 14 - w * 0.55 * math.sin(math.pi * t) - 4, 3, 0.8, 0.45)
    if p.has("corbel", "corbelled", "corbeled"):
        a.poly([(20, 66), (28, 58), (36, 52), (50, 48)], 6, 1.2)
        a.poly([(80, 66), (72, 58), (64, 52), (50, 48)], 6, 1.2)
    a.ground(86)


def d_tower(a: Art, p: P) -> None:
    w = 14 + 6 * p.a
    top = 18 + 6 * p.b
    a.poly([(50 - w, 78), (50 - w + 2, top), (50 + w - 2, top), (50 + w, 78)], 0, 1.8)
    for i in range(3):
        a.rect(50 - w + 1 + i * (2 * w - 4) / 3, top - 5, (2 * w - 4) / 3 - 2, 5, 0, 1.3)
    a.rect(47, top + 12, 6, 9, 3, 1.1)
    for y in (top + 28, top + 40):
        a.line(50 - w + 3, y, 50 + w - 3, y, 4, 0.8, 0.35)
    if p.has("lighthouse", "beacon", "signal", "watchtower"):
        flame(a, 50, top - 6, 9, 6, 1.3)
        for k in (-1, 1):
            a.line(50 + k * 4, top - 10, 50 + k * 14, top - 14, 6, 1.0, 0.6)
    if p.has("citadel", "fortified", "bastion", "gatehouse", "fortification", "camp"):
        a.line(10, 78, 90, 78, 0, 1.6)
        a.poly([(10, 78), (10, 64), (30, 64)], 0, 1.4)
        a.poly([(90, 78), (90, 64), (70, 64)], 0, 1.4)
    a.ground(86)


def d_canal(a: Art, p: P) -> None:
    drop = 6 + 10 * p.a
    a.poly([(8, 44), (92, 44 + drop)], 0, 1.6)
    a.poly([(8, 66), (92, 66 + drop)], 0, 1.6)
    a.poly([(8, 44), (8, 66)], 0, 1.4)
    a.poly([(92, 44 + drop), (92, 66 + drop)], 0, 1.4)
    for i in range(3):
        y = 52 + i * 5
        a.path(wave_d(14, 86, y + drop * 0.5, 1.6, 9), 3, 1.0, 0.55)
    if p.has("gate", "headgate", "sluice", "weir", "spillway", "intake"):
        a.rect(46, 34, 8, 40, 6, 1.5)
        a.line(50, 34, 50, 74, 6, 0.9, 0.5)
        a.line(44, 30, 56, 30, 6, 1.6)
    if p.has("pipe", "culvert", "drain", "sewer", "tile", "ceramic"):
        a.ellipse(24, 55, 6, 8, 6, 1.4)
        a.ellipse(24, 55, 3, 4, 6, 0.9, 0.5)
    if p.has("lined", "brick", "stone", "embankment", "bank"):
        for i in range(8):
            a.line(10 + i * 10, 44 + drop * i / 8, 10 + i * 10, 48 + drop * i / 8, 4, 0.8, 0.4)
    a.ground(88, 8, 92)


def d_well(a: Art, p: P) -> None:
    a.ellipse(50, 56, 22, 7, 0, 1.8)
    a.ellipse(50, 56, 15, 4.5, 0, 1.2, 0.6)
    a.line(28, 56, 28, 70, 0, 1.6)
    a.line(72, 56, 72, 70, 0, 1.6)
    a.path(arc_front(50, 70, 22, 7), 0, 1.6)
    if p.has("qanat", "falaj", "puquio", "shaft", "tunnel", "spring", "seep"):
        a.line(50, 63, 50, 84, 3, 1.0, 0.5)
        a.line(46, 70, 54, 70, 3, 0.8, 0.4)
        a.line(46, 78, 54, 78, 3, 0.8, 0.4)
    if p.has("lift", "windlass", "bucket", "yoke", "hoist", "curb"):
        a.line(32, 56, 32, 28, 6, 1.6)
        a.line(68, 56, 68, 28, 6, 1.6)
        a.line(32, 30, 68, 30, 6, 1.8)
        a.circle(50, 30, 3, 6, 1.2)
        a.line(50, 33, 50, 50, 6, 0.9, 0.6)
        a.poly([(46, 50), (54, 50), (52, 56), (48, 56)], 6, 1.1, close=True)
    if p.has("roof", "house", "covered", "chamber"):
        a.poly([(24, 36), (50, 22), (76, 36)], 0, 1.6)
    a.ground(86)


def d_boat(a: Art, p: P) -> None:
    long = p.has("canoe", "barge", "galley", "scow", "ship", "dhow", "ferry", "flatboat", "boat", "hull")
    reed = p.has("reed", "papyrus", "raft", "coracle", "bundle")
    if p.has("coracle"):
        a.path("M26 56 Q50 90 74 56", 0, 1.8)
        a.ellipse(50, 56, 24, 5, 0, 1.6)
        for i in range(4):
            a.line(34 + i * 10, 58, 36 + i * 9, 72, 3, 0.9, 0.5)
    elif reed or p.has("raft"):
        for i in range(5):
            a.path(f"M{n(18 + i * 2)} {n(52 + i * 5)} Q50 {n(48 + i * 5)} {n(82 - i * 2)} {n(52 + i * 5)}", 0, 1.5)
        a.path("M18 52 Q10 46 14 40 M82 52 Q90 46 86 40", 6, 1.4)
    else:
        L = 34 + 6 * p.a
        a.path(f"M{n(50 - L)} 56 Q{n(50 - L + 6)} 74 50 76 Q{n(50 + L - 6)} 74 {n(50 + L)} 56 Z", 0, 1.8)
        a.line(50 - L, 56, 50 + L, 56, 0, 1.6)
        for i in range(1, 5):
            x = 50 - L + i * (2 * L / 5)
            a.line(x, 56, x * 0.3 + 35, 70, 3, 0.8, 0.4)
        if p.has("outrigger", "double", "twin"):
            a.line(34, 58, 34, 70, 6, 1.1)
            a.line(66, 58, 66, 70, 6, 1.1)
            a.path("M24 72 Q50 78 76 72", 6, 1.4)
    if p.has("sail", "sailboat", "galley", "ship", "dhow", "merchant", "seagoing", "voyaging", "sewn", "cargo", "phoenician"):
        a.line(50, 56, 50, 16, 6, 1.7)
        a.poly([(50, 18), (50, 50), (76, 48)] if p.k % 2 else [(50, 18), (50, 50), (26, 48), (30, 22)], 6, 1.5, close=True)
    elif p.has("pole", "punt", "flatboat", "propelled", "canoe"):
        a.line(30, 52, 78, 24, 6, 1.5)
    a.path(wave_d(8, 92, 80, 1.8, 10), -4, 1.1, 0.55)
    a.path(wave_d(14, 86, 86, 1.4, 8), -4, 0.9, 0.35)


def d_wheel(a: Art, p: P) -> None:
    r = 20 + 4 * p.a
    cx, cy = 34, 60
    a.circle(cx, cy, r, 0, 1.8)
    a.circle(cx, cy, r - 3, 0, 1.0, 0.5)
    a.circle(cx, cy, 4, 0, 1.6)
    if p.has("spoke", "spoked", "chariot", "wheel"):
        spokes(a, cx, cy, 4, r - 3, 6 + 2 * (p.k % 3), 3, 1.3)
    else:
        a.circle(cx, cy, r - 9, 3, 0.9, 0.4)
    a.line(cx, cy, 80, cy, 0, 1.8)
    a.rect(58, cy - 14, 28, 14, 0, 1.6)
    a.line(86, cy - 7, 94, cy - 14 - 4, 6, 1.4)
    if p.has("yoke", "oxen", "harness", "bit", "bridle", "rein", "team", "saddle", "horse", "camel", "donkey", "mule"):
        a.path("M92 38 Q96 44 92 50", 6, 1.5)
    a.ground(cy + r + 4)


def d_tool(a: Art, p: P) -> None:
    ang = -28 + 10 * p.a
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))

    def pt(u: float, v: float) -> tuple[float, float]:
        return 50 + u * c - v * s, 56 + u * s + v * c

    a.poly([pt(-34, -1.6), pt(30, -1.6), pt(30, 1.6), pt(-34, 1.6)], 0, 1.6, close=True)
    for i in range(5):
        u = -26 + i * 6.5
        a.poly([pt(u, -1.6), pt(u + 1, 1.6)], 3, 0.8, 0.4)
    if p.has("sickle", "scythe"):
        a.path(f"M{n(pt(26, 0)[0])} {n(pt(26, 0)[1])} q18 -4 14 -22 q-12 10 -18 14", 0, 1.8)
    elif p.has("awl", "needle", "probe", "pin", "drill", "hook"):
        a.poly([pt(30, -1.2), pt(46, 0), pt(30, 1.2)], 0, 1.5, close=True)
    elif p.has("chisel", "scalpel", "knife", "blade", "sword", "razor"):
        a.poly([pt(30, -2), pt(44, -2), pt(46, 0), pt(44, 2), pt(30, 2)], 0, 1.6, close=True)
    elif p.has("hoe", "adze", "mattock", "pick", "plough", "coulter", "shovel", "spade", "ard"):
        a.poly([pt(26, -3), pt(34, -12), pt(40, -12), pt(40, 4), pt(26, 3)], 0, 1.6, close=True)
        a.line(*pt(30, -2), *pt(38, -9), z=3, w=0.8, o=0.4)
    else:
        a.poly([pt(24, -9), pt(40, -6), pt(40, 6), pt(24, 9)], 0, 1.7, close=True)
        a.line(*pt(28, -5), *pt(28, 5), z=3, w=0.9, o=0.45)
    a.circle(*pt(-30, 0), 2.1, 6, 1.1)
    a.ground(84)


def d_furnace(a: Art, p: P) -> None:
    w = 26 + 8 * p.a
    a.path(f"M{n(50 - w)} 76 L{n(50 - w)} 56 Q50 {n(24 - 6 * p.b)} {n(50 + w)} 56 L{n(50 + w)} 76 Z", 0, 1.8)
    a.path(f"M{n(50 - w * .45)} 76 L{n(50 - w * .45)} 62 Q50 50 {n(50 + w * .45)} 62 L{n(50 + w * .45)} 76", 3, 1.4)
    flame(a, 50, 72, 8, 6, 1.4)
    if p.has("chimney", "flue", "vent", "shaft", "updraft", "downdraft", "reduction", "bloomery", "smelting"):
        a.rect(44, 18, 12, 14, 0, 1.5)
        a.path("M50 14 q4 -4 0 -8", 6, 1.0, 0.6)
    for i in range(4):
        a.line(50 - w + 4 + i * (2 * w - 8) / 3, 78, 50 - w + 4 + i * (2 * w - 8) / 3, 82, 4, 0.8, 0.4)
    if p.has("anvil", "forge", "smithing", "hearth", "tongs", "quench"):
        a.poly([(62, 84), (88, 84), (84, 78), (92, 76), (92, 72), (60, 72)], 6, 1.4, close=True)
    a.ground(88)


def d_loom(a: Art, p: P) -> None:
    a.rect(22, 20, 56, 58, 0, 1.8)
    a.rect(26, 24, 48, 50, 0, 1.0, 0.45)
    cols = 8 + int(p.a * 4)
    for i in range(cols):
        x = 28 + i * 44 / (cols - 1)
        a.line(x, 24, x, 66, 3, 0.9, 0.5)
    for j in range(3):
        a.path(wave_d(28, 72, 56 + j * 4, 1.4, 6), 6, 1.0, 0.7)
    if p.has("weighted", "warp"):
        for i in range(0, cols, 2):
            x = 28 + i * 44 / (cols - 1)
            a.circle(x, 70, 2, 6, 1.0)
    if p.has("spindle", "whorl", "spinning"):
        a.line(86, 20, 86, 80, 6, 1.6)
        a.ellipse(86, 66, 6, 2.4, 6, 1.4)
    a.ground(88)


def d_tablet(a: Art, p: P) -> None:
    w = 24 + 8 * p.a
    h = 30 + 10 * p.b
    rnd = p.has("clay", "cuneiform", "tablet", "token", "ledger", "ostracon")
    if p.has("scroll", "papyrus", "roll", "codex", "book", "manuscript", "vellum"):
        a.rect(50 - w, 30, 2 * w, 38, 0, 1.7)
        a.line(50, 30, 50, 68, 0, 1.2)
        for i in range(4):
            a.line(50 - w + 4, 38 + i * 6, 46, 38 + i * 6, 3, 0.9, 0.5)
            a.line(54, 38 + i * 6, 50 + w - 4, 38 + i * 6, 3, 0.9, 0.5)
    elif p.has("stele", "inscription", "monument", "stone", "marker"):
        a.path(f"M{n(50 - w / 2)} 80 L{n(50 - w / 2)} {n(26)} Q50 {n(14)} {n(50 + w / 2)} 26 L{n(50 + w / 2)} 80 Z", 0, 1.8)
        for i in range(5):
            a.line(50 - w / 2 + 4, 34 + i * 8, 50 + w / 2 - 4, 34 + i * 8, 3, 0.9, 0.5)
    else:
        a.path(f"M{n(50 - w)} {n(46 - h / 2)} Q50 {n(40 - h / 2)} {n(50 + w)} {n(46 - h / 2)} L{n(50 + w)} {n(46 + h / 2)} Q50 {n(52 + h / 2)} {n(50 - w)} {n(46 + h / 2)} Z", 0, 1.8)
        for i in range(4):
            y = 46 - h / 2 + 7 + i * (h - 10) / 4
            a.line(50 - w + 5, y, 50 + w - 5 - (i % 2) * 6, y, 3, 0.9, 0.5)
        if rnd:
            for i in range(5):
                a.poly([(50 - w + 6 + i * 9, 44), (50 - w + 9 + i * 9, 49), (50 - w + 6 + i * 9, 49)], 6, 1.0, close=True)
    if p.has("seal", "stamped", "witness", "receipt"):
        a.circle(76, 70, 6, 6, 1.5)
        a.circle(76, 70, 3, 6, 0.9, 0.5)
    a.ground(86)


def d_disc(a: Art, p: P) -> None:
    r = 18 + 8 * p.a
    if p.has("coin", "money", "cash", "spade", "knife", "denarius"):
        a.circle(50, 50, r, 0, 1.8)
        a.circle(50, 50, r - 4, 0, 1.0, 0.5)
        a.rect(46, 50 - r + 1, 8, 6, 3, 1.0)
    elif p.has("bell", "chime", "drum", "mirror", "gong"):
        if p.has("bell", "chime"):
            a.path(f"M{n(50 - r)} 66 Q{n(50 - r)} 34 50 28 Q{n(50 + r)} 34 {n(50 + r)} 66 Z", 0, 1.8)
            a.ellipse(50, 66, r, 4, 0, 1.4)
            a.circle(50, 70, 2.2, 3, 1.2)
        elif p.has("mirror"):
            a.circle(50, 42, r, 0, 1.8)
            a.line(50, 42 + r, 50, 80, 0, 2.2)
        else:
            cylinder(a, 50, 40, r, 24, None, 0, 1.8)
            for i in range(4):
                a.line(50 - r + 3 + i * (2 * r - 6) / 3, 41, 50 - r + 3 + i * (2 * r - 6) / 3 + 3, 62, 3, 0.9, 0.5)
    else:
        a.ellipse(50, 56, r, r * 0.6, 0, 1.8)
        a.ellipse(50, 50, r, r * 0.6, 0, 1.6)
        a.line(50 - r, 50, 50 - r, 56, 0, 1.6)
        a.line(50 + r, 50, 50 + r, 56, 0, 1.6)
        if p.has("weight", "balance", "scale", "bob"):
            a.line(50, 20, 50, 38, 6, 1.4)
            a.line(26, 22, 74, 22, 6, 1.8)
    a.ground(86)


def d_music(a: Art, p: P) -> None:
    if p.has("flute", "aulos", "panpipes", "pipe", "shofar", "trumpet", "conch", "horn", "organ"):
        if p.has("panpipes", "organ"):
            for i in range(6):
                h = 40 - i * 4
                a.rect(24 + i * 8, 30, 6, h, 0, 1.5)
                a.ellipse(27 + i * 8, 30, 3, 1.2, 0, 1.0, 0.6)
        elif p.has("trumpet", "conch", "horn", "shofar"):
            a.path("M16 64 Q34 40 62 36 Q84 34 88 22 Q92 40 74 54 Q50 70 16 64 Z", 0, 1.8)
            a.ellipse(88, 24, 4, 7, 0, 1.4, rot=-30)
        else:
            a.poly([(14, 62), (86, 40), (88, 46), (16, 68)], 0, 1.7, close=True)
            for i in range(5):
                a.circle(28 + i * 11, 58 - i * 3.2, 1.6, 3, 1.1)
    elif p.has("harp", "lyre", "kithara", "lute", "qin", "zither"):
        if p.has("harp"):
            a.path("M30 78 Q22 40 44 22 Q66 20 66 30 Q60 50 52 78", 0, 1.8)
            for i in range(6):
                a.line(34 + i * 4, 70 - i * 5, 56 - i * 1, 30 + i * 3, 3, 0.8, 0.5)
        elif p.has("qin", "zither"):
            a.poly([(12, 56), (88, 52), (88, 66), (12, 70)], 0, 1.7, close=True)
            for i in range(5):
                a.line(14, 58 + i * 2, 86, 54 + i * 2.4, 3, 0.8, 0.5)
        else:
            a.path("M34 80 Q28 56 40 52 L60 52 Q72 56 66 80 Z", 0, 1.7)
            a.line(36, 52, 34, 22, 0, 1.6)
            a.line(64, 52, 66, 22, 0, 1.6)
            a.line(32, 24, 68, 24, 0, 1.8)
            for i in range(5):
                a.line(40 + i * 5, 24, 40 + i * 5, 54, 3, 0.8, 0.5)
    else:
        a.ellipse(50, 40, 22, 7, 0, 1.7)
        a.path("M28 40 Q26 66 50 74 Q74 66 72 40", 0, 1.7)
        for i in range(4):
            a.line(34 + i * 10, 42, 40 + i * 6, 70, 3, 0.9, 0.5)
    a.ground(86)


def d_road(a: Art, p: P) -> None:
    a.poly([(38, 26), (62, 26), (88, 82), (12, 82)], 0, 1.7, close=True)
    for i in range(1, 6):
        y = 26 + i * 9.5
        t = (y - 26) / 56
        xl, xr = 38 - 26 * t, 62 + 26 * t
        a.line(xl, y, xr, y, 3, 0.9, 0.45)
        k = 2 + i
        for j in range(1, k):
            a.line(xl + (xr - xl) * j / k, y, xl + (xr - xl) * j / k + 1, y + 9.5, 3, 0.8, 0.35)
    if p.has("marker", "milestone", "post"):
        a.rect(80, 50, 5, 20, 6, 1.5)
    if p.has("ditch", "drain", "gutter", "channel"):
        a.path(wave_d(8, 24, 70, 1.2, 6), 6, 0.9, 0.6)
    if p.has("causeway", "bridge", "ford", "crossing", "stepping"):
        a.path(wave_d(6, 94, 84, 1.6, 8), -4, 1.0, 0.5)
    a.line(50, 30, 50, 40, 4, 1.0, 0.4)


def d_mine(a: Art, p: P) -> None:
    a.poly([(8, 40), (92, 40)], 0, 1.8)
    a.path("M20 40 L28 60 L40 72 L60 72 L72 60 L80 40", 0, 1.8)
    a.path("M30 62 L70 62", 3, 1.0, 0.5)
    if p.has("gallery", "underground", "tunnel", "drainage", "ventilation", "shaft", "prop", "salt"):
        a.rect(44, 40, 12, 32, 3, 1.4)
        a.line(46, 50, 54, 50, 6, 1.0)
        a.line(46, 60, 54, 60, 6, 1.0)
        a.line(40, 56, 60, 56, 6, 1.8)
    if p.has("quarry", "stone", "granite", "limestone", "obsidian", "flint"):
        for i in range(3):
            a.rect(24 + i * 16, 62 - i * 8, 16, 8, 6, 1.3)
    if p.has("pick", "hammer"):
        a.line(72, 20, 84, 34, 6, 1.8)
        a.path("M68 20 Q80 14 88 22", 6, 1.6)
    if p.has("fire", "setting"):
        flame(a, 50, 70, 8, 6, 1.4)
    a.ground(86)


def d_machine(a: Art, p: P) -> None:
    if p.has("waterwheel", "noria", "saqiya", "paddle"):
        a.circle(46, 52, 24, 0, 1.8)
        a.circle(46, 52, 17, 0, 1.0, 0.5)
        spokes(a, 46, 52, 4, 24, 8, 3, 1.3)
        for i in range(8):
            t = i * math.pi / 4
            a.rect(46 + 24 * math.cos(t) - 2, 52 + 24 * math.sin(t) - 2, 4, 4, 3, 1.0)
        a.path(wave_d(10, 90, 76, 1.6, 9), -4, 1.1, 0.55)
    elif p.has("pump", "screw", "ctesibian", "piston"):
        cylinder(a, 36, 28, 8, 34, None, 0, 1.7)
        cylinder(a, 66, 36, 8, 34, None, 0, 1.7)
        a.path("M36 62 Q50 74 66 70", 0, 1.5)
        a.line(36, 14, 36, 36, 6, 1.7)
        a.line(30, 14, 42, 14, 6, 1.8)
    elif p.has("crane", "shaduf", "lever", "lift", "hoist", "windlass", "capstan", "pulley", "shears"):
        a.line(30, 80, 30, 26, 0, 2)
        a.line(14, 38, 70, 20, 0, 2)
        a.circle(30, 32, 2.2, 3, 1.2)
        a.line(66, 21, 66, 48, 6, 1.0, 0.6)
        a.poly([(60, 48), (72, 48), (70, 58), (62, 58)], 6, 1.3, close=True)
        a.circle(18, 40, 5, 6, 1.5)
    else:
        a.path(gear_d(38, 52, 22, 17, 10 + 2 * (p.k % 3)), 0, 1.7)
        a.circle(38, 52, 5, 0, 1.4)
        a.path(gear_d(70, 40, 14, 10, 8 + (p.k % 3)), 3, 1.5)
        a.circle(70, 40, 3.2, 3, 1.2)
    a.ground(88)


def d_building(a: Art, p: P) -> None:
    w = 34 + 6 * p.a
    a.rect(50 - w, 36, 2 * w, 38, 0, 1.8)
    a.poly([(50 - w - 4, 36), (50, 18 + 4 * p.b), (50 + w + 4, 36)], 0, 1.7, close=True)
    for i in range(5):
        x = 50 - w + 6 + i * (2 * w - 12) / 4
        a.line(x, 40, x, 72, 3, 1.1, 0.7)
    a.rect(44, 56, 12, 18, 3, 1.3)
    a.line(50, 56, 50, 74, 4, 0.8, 0.4)
    if p.has("court", "magistrate", "council", "assembly", "law", "judicial"):
        a.line(50, 12, 50, 20, 6, 1.4)
        a.line(40, 14, 60, 14, 6, 1.6)
        a.circle(40, 18, 2.2, 6, 1.1)
        a.circle(60, 18, 2.2, 6, 1.1)
    a.shadow(50, 80, w + 8)


def d_field(a: Art, p: P) -> None:
    for i in range(7):
        y = 38 + i * 7
        a.path(f"M{n(10 + i * 2)} {n(y)} Q50 {n(y - 6 + 2 * (p.k % 3))} {n(90 - i * 2)} {n(y)}", 0, 1.3)
    if p.has("terrace", "terraced", "highland"):
        for i in range(4):
            a.line(14 + i * 8, 40 + i * 12, 86 - i * 8, 40 + i * 12, 3, 1.4)
            a.line(14 + i * 8, 40 + i * 12, 14 + i * 8, 46 + i * 12, 3, 1.0, 0.5)
    for i in range(6):
        a.line(16 + i * 13, 28, 16 + i * 13, 36, 3, 1.0, 0.55)
        a.path(f"M{n(16 + i * 13)} 30 q-3 -3 -5 -3 M{n(16 + i * 13)} 32 q3 -3 5 -3", 3, 0.9, 0.5)
    if p.has("raised", "waru", "chinampa", "basin"):
        a.path(wave_d(10, 90, 82, 1.4, 8), -4, 1.0, 0.55)
    a.ground(90)


def d_sky(a: Art, p: P) -> None:
    a.circle(50, 46, 14 + 4 * p.a, 0, 1.8)
    for i in range(10):
        t = i * math.pi / 5
        a.line(50 + 20 * math.cos(t), 46 + 20 * math.sin(t), 50 + 28 * math.cos(t), 46 + 28 * math.sin(t), 3, 1.0, 0.6)
    if p.has("lunar", "moon", "eclipse", "phase"):
        a.path("M58 36 A14 14 0 1 0 58 56 A10 10 0 1 1 58 36", 6, 1.5)
    if p.has("armillary", "globe", "sphere", "celestial", "ring"):
        a.ellipse(50, 46, 26, 9, 6, 1.4, rot=-20)
        a.ellipse(50, 46, 9, 26, 6, 1.2, 0.7, rot=20)
    if p.has("gnomon", "marker", "pillar", "solar", "sunrise", "horizon", "equinox", "calendar"):
        a.line(50, 84, 50, 66, 6, 2)
        a.line(50, 84, 80, 84, 6, 1.2)
    for i in range(5):
        a.dot(14 + i * 18 + 4 * (i % 2), 18 + 6 * (i % 3), 1.2, 3)
    a.ground(88)


def d_food(a: Art, p: P) -> None:
    a.line(16, 36, 84, 36, 0, 2)
    a.line(20, 36, 20, 80, 0, 1.8)
    a.line(80, 36, 80, 80, 0, 1.8)
    a.line(16, 56, 84, 56, 0, 1.6)
    for i in range(5):
        x = 26 + i * 12
        a.ellipse(x, 46 + (i % 2), 4, 8, 3, 1.2)
        a.line(x, 36, x, 38, 3, 0.9, 0.5)
    for i in range(5):
        a.ellipse(26 + i * 12, 66, 5, 3, 3, 1.1)
    if p.has("smoke", "smoked", "curing"):
        a.path("M40 28 q4 -4 0 -8 q-4 -4 0 -8", 6, 1.0, 0.6)
        a.path("M60 28 q4 -4 0 -8 q-4 -4 0 -8", 6, 1.0, 0.6)
    a.ground(86)


def d_social(a: Art, p: P) -> None:
    """Institutions, rites and records: a seated circle around a central object."""
    a.circle(50, 56, 20, 0, 1.6, None)
    a.ellipse(50, 56, 20, 7, 0, 1.2, 0.6)
    for i in range(6):
        t = i * math.pi / 3 + 0.3
        x, y = 50 + 28 * math.cos(t), 56 + 10 * math.sin(t)
        a.circle(x, y - 6, 2.4, 3, 1.3)
        a.path(f"M{n(x - 3)} {n(y + 6)} Q{n(x)} {n(y - 2)} {n(x + 3)} {n(y + 6)}", 3, 1.3)
    if p.has("altar", "shrine", "votive", "ritual", "libation", "incense", "burial", "urn", "mask", "sacred", "temple", "offering"):
        a.rect(42, 36, 16, 12, 0, 1.7)
        a.rect(40, 46, 20, 4, 0, 1.5)
        flame(a, 50, 34, 7, 6, 1.3)
    else:
        a.rect(44, 38, 12, 14, 0, 1.6)
        a.line(46, 42, 54, 42, 3, 0.9, 0.5)
        a.line(46, 46, 54, 46, 3, 0.9, 0.5)
    a.ground(88)


def d_frame(a: Art, p: P) -> None:
    """Yokes, harness, saddles, rods, poles: a beam on supports."""
    a.path("M14 40 Q50 26 86 40", 0, 2.2)
    a.path("M14 46 Q50 32 86 46", 0, 1.6)
    for x in (30, 70):
        a.line(x, 36, x, 66, 0, 1.8)
        a.circle(x, 68, 3, 3, 1.3)
    a.path("M18 44 Q22 62 30 66 M82 44 Q78 62 70 66", 3, 1.2, 0.6)
    a.line(50, 30, 50, 18, 6, 1.6)
    a.circle(50, 16, 2.4, 6, 1.3)
    a.ground(86)


def d_textile(a: Art, p: P) -> None:
    w = 26 + 8 * p.a
    top = 22
    a.path(f"M{n(50 - w)} {n(top)} Q50 {n(top - 6 - 4 * p.b)} {n(50 + w)} {n(top)} L{n(50 + w - 3)} 70 Q50 {n(78 + 4 * p.c)} {n(50 - w + 3)} 70 Z", 0, 1.8)
    for i in range(1, 7):
        x = 50 - w + i * (2 * w / 7)
        a.line(x, top + 3, x * 0.96 + 2, 70, 3, 0.8, 0.4)
    for j in range(5):
        y = top + 8 + j * 9
        a.path(wave_d(50 - w + 3, 50 + w - 3, y, 1.1, 5), 3, 0.8, 0.45)
    if p.has("tunic", "cloak", "garment", "coat"):
        a.poly([(50 - w, top), (50 - w - 12, top + 16), (50 - w - 4, top + 22)], 6, 1.5)
        a.poly([(50 + w, top), (50 + w + 12, top + 16), (50 + w + 4, top + 22)], 6, 1.5)
        a.path("M44 22 Q50 30 56 22", 6, 1.3)
    elif p.has("dyed", "dye", "dyeing", "resist"):
        for i in range(3):
            a.circle(38 + i * 12, 46 + (i % 2) * 8, 4 + i, 6, 1.1, 0.7)
    elif p.has("bandage", "dressing", "poultice"):
        a.line(14, 50, 86, 44, 6, 1.4)
        a.circle(50, 47, 3, 6, 1.2)
    a.line(50 - w, top, 50 + w, top, 0, 2)
    a.ground(86)


def d_quern(a: Art, p: P) -> None:
    a.ellipse(50, 60, 32, 9, 0, 1.8)
    a.path("M18 60 L18 66 Q50 82 82 66 L82 60", 0, 1.8)
    if p.has("mortar", "pestle"):
        a.ellipse(50, 50, 18, 6, 0, 1.6)
        a.path("M32 50 L34 64 Q50 72 66 64 L68 50", 0, 1.6)
        a.line(62, 20, 52, 54, 6, 3.4)
    elif p.has("sieve", "hopper"):
        a.ellipse(50, 38, 22, 7, 0, 1.6)
        a.path("M28 38 L38 56 L62 56 L72 38", 0, 1.6)
        for i in range(5):
            a.circle(38 + i * 6, 44, 1, 3, 0.9)
    else:
        a.ellipse(50, 50, 22, 6, 6, 1.6)
        a.ellipse(50, 56, 22, 6, 0, 1.4)
        a.line(28, 50, 28, 56, 6, 1.4)
        a.line(72, 50, 72, 56, 6, 1.4)
        a.line(50, 50, 78, 34, 6, 1.8)
        a.circle(78, 33, 2.2, 6, 1.3)
    a.dots([(30, 74), (40, 76), (52, 74), (62, 76), (72, 73)], 0.9, 3)
    a.ground(88)


def d_bridgespan(a: Art, p: P) -> None:
    a.line(8, 52, 92, 52, 0, 2.2)
    a.line(8, 56, 92, 56, 0, 1.4)
    if p.has("catenary", "cable", "traverse", "suspension", "rope"):
        a.path("M8 30 Q50 62 92 30", 0, 1.6)
        for i in range(1, 8):
            x = 8 + i * 84 / 8
            y = 30 + 22 * math.sin(math.pi * i / 8) ** 1.1
            a.line(x, y, x, 52, 3, 0.8, 0.5)
        a.line(8, 30, 8, 80, 0, 1.8)
        a.line(92, 30, 92, 80, 0, 1.8)
    elif p.has("pontoon", "floating", "barge"):
        for i in range(5):
            a.ellipse(18 + i * 16, 64, 8, 4, 0, 1.4)
        a.path(wave_d(8, 92, 78, 1.6, 9), -4, 1.1, 0.5)
    else:
        for x in (22, 50, 78):
            a.line(x, 56, x, 80, 0, 1.6)
            a.line(x - 7, 80, x + 7, 80, 0, 1.4)
            a.line(x, 56, x - 9, 80, 3, 0.9, 0.5)
            a.line(x, 56, x + 9, 80, 3, 0.9, 0.5)
        a.path(wave_d(8, 92, 84, 1.4, 8), -4, 1.0, 0.5)
    for i in range(10):
        a.line(14 + i * 8, 52, 14 + i * 8, 56, 4, 0.8, 0.4)


def d_chart(a: Art, p: P) -> None:
    a.circle(50, 50, 28, 0, 1.8)
    a.circle(50, 50, 22, 0, 1.0, 0.5)
    for i in range(8):
        t = i * math.pi / 4
        a.line(50 + 4 * math.cos(t), 50 + 4 * math.sin(t), 50 + 28 * math.cos(t), 50 + 28 * math.sin(t), 3, 1.0 if i % 2 == 0 else 0.8, None if i % 2 == 0 else 0.5)
    a.poly([(50, 24), (54, 50), (50, 76), (46, 50)], 6, 1.4, close=True)
    if p.has("swell", "wave", "tide", "currents", "sounding", "seabed", "tallow", "sampler"):
        a.path(wave_d(10, 90, 82, 1.8, 9), -4, 1.2, 0.6)
        a.line(50, 76, 50, 90, 6, 1.0, 0.6)
    if p.has("bird", "island"):
        a.path("M72 26 q4 -4 8 0 q4 -4 8 0", 6, 1.2)
    if p.has("log", "knotted", "reckoning", "distance"):
        a.path("M12 70 q10 -6 20 0 t20 0 t20 0", 6, 1.1, 0.6)
    a.ground(90, 14, 86)


def d_anchor(a: Art, p: P) -> None:
    if p.has("paddle"):
        a.line(24, 24, 70, 74, 0, 2.4)
        a.path("M66 66 Q80 70 76 84 Q64 84 62 72 Z", 0, 1.8)
    else:
        a.line(50, 18, 50, 70, 0, 2.4)
        a.circle(50, 14, 3.6, 0, 1.8)
        a.path("M24 56 Q32 78 50 78 Q68 78 76 56", 0, 2)
        a.poly([(20, 52), (28, 58), (24, 62)], 0, 1.6)
        a.poly([(80, 52), (72, 58), (76, 62)], 0, 1.6)
        a.line(38, 28, 62, 28, 3, 1.8)
        if p.has("stock", "wooden", "stone"):
            a.rect(36, 22, 28, 5, 6, 1.5)
    a.path(wave_d(8, 92, 86, 1.6, 9), -4, 1.0, 0.5)


def d_implement(a: Art, p: P) -> None:
    """Field implements: harrow, roller, sledge, sled, flail, fork, dibble, staff."""
    if p.has("harrow", "rake"):
        a.rect(18, 48, 64, 8, 0, 1.8)
        a.rect(18, 62, 64, 8, 0, 1.8)
        for i in range(8):
            x = 22 + i * 8
            a.line(x, 70, x - 1, 80, 0, 1.4)
        a.line(18, 48, 8, 36, 6, 1.5)
        a.line(82, 48, 92, 36, 6, 1.5)
    elif p.has("roller"):
        cylinder(a, 50, 40, 12, 36, None, 0, 1.8)
        a.line(26, 58, 74, 58, 6, 1.8)
    elif p.has("sled", "sledge", "board", "cradle"):
        a.path("M12 72 Q20 70 22 66 L84 66 Q88 66 86 72", 0, 1.8)
        a.line(30, 66, 30, 52, 0, 1.5)
        a.line(70, 66, 70, 52, 0, 1.5)
        a.line(24, 52, 78, 52, 0, 1.6)
        for i in range(6):
            a.line(30 + i * 8, 66, 30 + i * 8, 78, 3, 0.9, 0.5)
    elif p.has("flail"):
        a.line(22, 80, 62, 22, 0, 2.2)
        a.line(62, 22, 76, 30, 6, 1.4)
        a.rect(72, 28, 14, 4, 6, 1.6)
    elif p.has("fork"):
        a.line(34, 84, 56, 28, 0, 2)
        for i in range(3):
            a.line(52 + i * 4, 30, 58 + i * 6, 12, 0, 1.6)
    else:
        a.line(26, 82, 66, 20, 0, 2.4)
        a.poly([(63, 20), (70, 14), (74, 24)], 0, 1.6, close=True)
        a.line(28, 66, 40, 70, 3, 0.9, 0.4)
    a.ground(88)


def d_cord(a: Art, p: P) -> None:
    pts = [(12, 58), (24, 46), (38, 62), (52, 44), (66, 62), (80, 46), (90, 58)]
    a.path(smooth_d(pts), 0, 2.2)
    a.path(smooth_d([(x, y + 3) for x, y in pts]), 0, 1.0, 0.5)
    for i, (x, y) in enumerate(pts[1:-1]):
        a.circle(x, y + 1.5, 2 + (i % 2), 3, 1.3)
    if p.has("chain", "barrier", "harbour", "measuring"):
        for i in range(8):
            a.ellipse(14 + i * 10, 74, 4, 2.4, 6, 1.3, rot=(i % 2) * 90)
    a.ground(88)


def d_bundle(a: Art, p: P) -> None:
    for i in range(7):
        x = 32 + i * 6
        a.line(x, 24, x + (i - 3) * 1.5, 74, 0, 1.4)
    a.path("M34 48 Q50 54 68 48", 0, 2)
    a.path("M34 54 Q50 60 68 54", 3, 1.0, 0.5)
    for i in range(5):
        a.path(f"M{n(34 + i * 8)} 24 q-2 -6 -4 -8", 3, 0.9, 0.5)
    if p.has("bed", "plot", "crop", "mulched", "intercropping", "seed"):
        a.path(wave_d(14, 86, 80, 1.2, 7), 3, 1.0, 0.5)
    a.ground(86)


def d_ingot(a: Art, p: P) -> None:
    for r, y in enumerate((70, 58, 46)):
        for i in range(3 - r):
            x = 30 + i * 22 + r * 11
            a.poly([(x, y), (x + 20, y), (x + 17, y - 9), (x + 3, y - 9)], 0, 1.7, close=True)
            a.line(x + 5, y - 5, x + 15, y - 5, 3, 0.8, 0.45)
    a.ground(76, 16, 84)


ARCHETYPES = [
    # (archetype, predicate on words). First match wins, so order from specific to general.
    (d_boat, ("canoe", "raft", "coracle", "barge", "galley", "scow", "ship", "dhow", "ferry", "flatboat", "riverboat", "boat", "hull", "sailboat", "towboat")),
    (d_music, ("flute", "aulos", "panpipes", "shofar", "trumpet", "harp", "lyre", "kithara", "lute", "zither", "qin", "organ", "conch", "drum", "chime")),
    (d_wheel, ("wheel", "cart", "wagon", "chariot", "handbarrow", "axle", "yoke", "harness", "saddle", "bridle", "bit", "reins", "stirrup", "girth", "collar", "breastband", "hub")),
    (d_machine, ("waterwheel", "noria", "saqiya", "pump", "crane", "shaduf", "windlass", "hoist", "capstan", "gear", "camshaft", "pulley", "lever", "shears", "ratchet", "treadwheel", "mill", "escapement")),
    (d_furnace, ("kiln", "furnace", "forge", "hearth", "anvil", "tongs", "crucible", "bloomery", "smelting", "quench", "annealing", "roasting", "smithing")),
    (d_loom, ("warp", "loom", "spindle", "whorl", "heddle", "weaving", "tapestry", "embroidery", "tablet_weaving")),
    (d_well, ("well", "qanat", "falaj", "puquio", "spring", "seep", "shaft")),
    (d_mine, ("mine", "quarry", "mining", "pit_mine")),
    (d_canal, ("canal", "ditch", "drain", "sewer", "channel", "culvert", "aqueduct", "gutter", "headgate", "gate", "weir", "spillway", "sluice", "embankment", "pipe", "funnel", "trunk", "outfall")),
    (d_arch, ("arch", "vault", "viaduct", "bridge", "arcade", "colonnade", "corbelled")),
    (d_column, ("column", "obelisk", "stele", "pillar", "milestone", "capital", "triliton", "hypostyle", "monument")),
    (d_tower, ("tower", "lighthouse", "beacon", "citadel", "bastion", "gatehouse", "watchtower", "fortification", "camp", "palisade")),
    (d_road, ("road", "street", "avenue", "causeway", "track", "path", "footpath", "ford", "switchback", "waystation", "station", "pass")),
    (d_wall, ("wall", "masonry", "platform", "pyramid", "ashlar", "plaster", "adobe", "mud", "cob", "rammed", "courtyard", "square", "paved", "marker")),
    (d_house, ("house", "hut", "longhouse", "roundhouse", "granary", "silo", "storehouse", "warehouse", "room", "loft", "cellar", "niche", "alcove", "dwelling", "shelter", "chamber", "tomb", "temple", "store")),
    (d_field, ("field", "terrace", "plough", "ard", "irrigation", "furrow", "garden", "orchard", "waru", "chinampa", "basin_field")),
    (d_food, ("drying", "rack", "smoke", "smoked", "curing", "dried", "desiccated", "salted", "preserved")),
    (d_sky, ("star", "lunar", "solar", "sidereal", "armillary", "celestial", "gnomon", "eclipse", "sunrise", "solstice", "equinox", "zenith", "almanac", "dioptra", "astronomical")),
    (d_tablet, ("tablet", "ledger", "inscription", "scroll", "codex", "book", "manuscript", "script", "ostracon", "receipt", "contract", "token", "decree", "registry", "catalogue", "archive", "table", "numerals", "diagram", "record", "notice", "letter", "desk")),
    (d_disc, ("coin", "money", "cash", "bell", "mirror", "weight", "balance", "scale", "seal", "bob", "abacus", "counting", "rods")),
    (d_basket, ("basket", "bin", "hamper", "wicker")),
    (d_building, ("office", "bureau", "court", "council", "assembly", "magistrate", "inspector", "service", "relay", "committee", "administration", "governor", "school", "library", "infirmary", "sanctuary", "bath", "latrine", "market", "stall", "complex")),
    (d_social, ("ritual", "altar", "shrine", "votive", "urn", "burial", "feast", "oath", "mask", "banner", "pilgrimage", "libation", "incense", "offering", "ancestor", "festival", "procession", "calendar", "caravan", "exchange", "trade", "convoy", "fleet", "cargo")),
    (d_tool, ("blade", "axe", "adze", "hoe", "sickle", "chisel", "needle", "awl", "hook", "pick", "knife", "scalpel", "forceps", "probe", "drill", "saw", "mattock", "spade", "shovel", "coulter", "hammer", "comb", "rod", "bob", "stake", "gauge", "square", "groma", "tool", "splint", "spatula", "catheter", "cautery", "stylus", "pen")),
    (d_vessel, ("amphora", "jar", "pot", "vat", "urn", "crock", "bowl", "cup", "basin", "tank", "reservoir", "cistern", "trough", "cauldron", "vessel", "fermenter", "bucket", "bag", "stool", "tun", "oven", "mould", "mold", "tray", "pit")),
    (d_ingot, ("ingot", "ingots")),
    (d_textile, ("cloth", "yarn", "felt", "tunic", "cloak", "bandage", "dressing", "thread", "stitch", "poultice", "garment", "fastener", "padding", "dyed", "wool", "carded", "woolen", "blanket", "hide")),
    (d_quern, ("quern", "slab", "mortar", "pestle", "sieve", "hopper", "metate")),
    (d_bridgespan, ("catenary", "cable", "traverse", "crossing", "trestle", "footbridge", "span", "pontoon", "suspension")),
    (d_chart, ("pilotage", "guide", "swell", "chart", "sampler", "reckoning", "sounding", "tide", "currents", "knotted_distance", "compass", "bird", "observation")),
    (d_anchor, ("anchor", "paddle")),
    (d_implement, ("harrow", "roller", "sledge", "sled", "flail", "fork", "dibble", "staff", "stick", "cradle", "ploughshare", "ploughing", "board", "spike", "wedge", "splitter")),
    (d_cord, ("rope", "chain", "chain_barrier", "knotted", "measuring_chain", "sling", "halter", "noseband")),
    (d_bundle, ("sheaf", "bundler", "bed", "plot", "intercropping", "mulched", "binding", "bundle", "seed_bed")),
    (d_frame, ("frame", "pack", "burden", "string", "hitch", "carrying")),
    (d_house, ("tent", "yurt", "caravanserai", "roof", "perimeter_house")),
    (d_wall, ("floor", "perimeter", "rodent_barrier", "mantlet", "block", "shelf_wall")),
    (d_food, ("shelf", "bread", "baking", "griddle", "flatbread", "loaf")),
    (d_furnace, ("dome", "oven", "forging", "hammering", "casting", "bloom", "enriched", "vent", "investment", "setting")),
    (d_tool, ("nail", "rivet", "riveted", "spear", "point", "wire", "sheet", "lock", "clench", "bar", "staff", "digging", "stake")),
    (d_machine, ("crusher", "crushing", "fulling", "drive", "press", "mechanism", "torsion", "device", "ramp")),
    (d_vessel, ("pottery", "slipping", "glaze", "culture", "measure", "infusion", "sourdough", "slip_pot")),
    (d_tablet, ("roster", "allocation", "obligation", "stela", "slip", "formulation", "medica", "hieroglyphic", "ayurvedic")),
    (d_basket, ("kit", "case", "midwife")),
    (d_well, ("watering", "hole", "catchment", "point")),
    (d_tower, ("signal", "post")),
    (d_field, ("threshing", "yard", "floor_field", "tillage")),
    (d_road, ("plane",)),
]


def classify(p: P):
    """Match a keyword against the id tokens; later words in an id name the head noun, so prefer the last match."""
    toks = p.id.replace("anc27_", "").split("_")
    best, best_pos = None, -1
    for fn, kws in ARCHETYPES:
        for kw in kws:
            parts = kw.split("_")
            for i in range(len(toks) - len(parts) + 1):
                if toks[i:i + len(parts)] == parts and i + len(parts) > best_pos:
                    best, best_pos = fn, i + len(parts)
    return best


FALLBACKS = (d_frame, d_building, d_vessel, d_wall, d_tool)


def mark(a: Art, item_id: str, tries: int) -> None:
    """Maker's mark: 3 x 3 grid of tick/dot cells chosen from the id hash. Guarantees distinct plates."""
    h = H(item_id, f"mark{tries}")
    x0, y0 = 80, 8
    for i in range(9):
        cx, cy = x0 + (i % 3) * 5.5, y0 + (i // 3) * 5.5
        v = (h >> (i * 2)) & 3
        if v == 0:
            continue
        if v == 1:
            a.dot(cx, cy, 0.9, 3)
        elif v == 2:
            a.line(cx - 1.6, cy, cx + 1.6, cy, 3, 0.9, 0.7)
        else:
            a.line(cx, cy - 1.6, cx, cy + 1.6, 3, 0.9, 0.7)


def compose(item_id: str, tries: int = 0) -> str:
    p = P(item_id)
    fn = classify(p) or FALLBACKS[p.k % len(FALLBACKS)]
    a = Art()
    fn(a, p)
    mark(a, item_id, tries)
    if not any("opacity" in e for els in a.layers.values() for e in els):
        a.line(14, 92, 30, 92, -4, 0.9, 0.4)
    return a.markup()


def build() -> tuple[dict[str, str], dict[str, int]]:
    nodes = json.loads(G12.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    seen: dict[str, str] = {}
    stats: dict[str, int] = {}
    for nd in nodes:
        iid = nd["id"]
        tries = 0
        while True:
            m = compose(iid, tries)
            key = m.replace(" ", "")
            if key not in seen:
                break
            tries += 1
        seen[key] = iid
        out[iid] = m
        fn = classify(P(iid))
        stats[fn.__name__ if fn else "fallback"] = stats.get(fn.__name__ if fn else "fallback", 0) + 1
    return out, stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--install", action="store_true")
    args = ap.parse_args()
    art, stats = build()
    problems = {k: lint(v) for k, v in art.items() if lint(v)}
    for k, v in list(problems.items())[:20]:
        print("LINT", k, v)
    print("archetype use:", dict(sorted(stats.items(), key=lambda kv: -kv[1])))
    if args.check:
        return 1 if problems else 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(art, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(art)} plates -> {OUT.relative_to(ROOT)}; lint problems: {len(problems)}")
    if args.install and not problems:
        p = ROOT / "data" / "art.json"
        cur = json.loads(p.read_text(encoding="utf-8"))
        cur.update(art)
        p.write_text(json.dumps(cur, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"installed; data/art.json now has {len(cur)} plates")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
