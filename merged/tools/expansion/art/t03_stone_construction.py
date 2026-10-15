"""Topic 03 - stone construction (25)."""
from __future__ import annotations

import math

from .core import Art, arc_back, arc_front, iso_box, n, poly_d, smooth_d
from .kit import RY, blob_pts
from .registry import item, topic

topic("stone construction")


def block_face(a: Art, x: float, y: float, w: float, h: float, z: int = 0, sw: float | None = None, margin: float = 0) -> None:
    a.rect(x, y, w, h, z, sw)
    if margin:
        a.rect(x + margin, y + margin, w - 2 * margin, h - 2 * margin, 3, 1.0, 0.45)


def chisel_marks(a: Art, x0: float, y0: float, x1: float, y1: float, step: float = 3.2, z: int = 3) -> None:
    a.hatch(x0, y0, x1, y1, step, 0.6, z, 0.8, 0.38)


def arch_ring(a: Art, cx: float, cy: float, r_in: float, r_out: float, count: int, z: int = 0, key: bool = True,
              sw: float | None = None) -> None:
    """Semicircular arch ring with `count` voussoirs (radial joints); optional enlarged keystone."""
    a.path(f"M{n(cx - r_in)} {n(cy)} A{n(r_in)} {n(r_in)} 0 0 1 {n(cx + r_in)} {n(cy)}", z, sw)
    a.path(f"M{n(cx - r_out)} {n(cy)} A{n(r_out)} {n(r_out)} 0 0 1 {n(cx + r_out)} {n(cy)}", z, sw)
    for k in range(count + 1):
        t = math.pi + k * math.pi / count
        a.line(cx + r_in * math.cos(t), cy + r_in * math.sin(t), cx + r_out * math.cos(t), cy + r_out * math.sin(t), z + 3 if z == 0 else z, 1.2, 0.8)
    a.line(cx - r_in, cy, cx - r_out, cy, z, sw)
    a.line(cx + r_in, cy, cx + r_out, cy, z, sw)


@item("Dressed Building Stone")
def _():
    a = Art()
    iso_box(a, 18, 46, 46, 28, 18, 0, 1.8)
    chisel_marks(a, 20, 48, 62, 72, 3.4)
    # mallet and chisel at the side
    a.line(74, 58, 86, 40, 8, 2.2)
    a.rect(70, 36, 14, 8, 8, 1.6, None, 1)
    a.line(76, 64, 66, 56, 8, 2.0)
    a.poly([(66, 56), (63, 52), (69, 53)], 8, 1.2, None, True)
    a.dots([(70, 66), (74, 70), (66, 72)], 1.0, 3)
    a.ground(88)
    return a


@item("Rough Ashlar")
def _():
    a = Art()
    pts = [(14, 62), (18, 44), (30, 34), (52, 32), (72, 36), (84, 48), (82, 66), (68, 76), (40, 78), (22, 74)]
    a.poly(pts, 0, 1.8, close=True)
    a.path("M18 44 L34 50 L56 46 L72 36 M34 50 L30 66 L22 74 M56 46 L60 64 L68 76 M30 66 L60 64 L82 66", 3, 1.1, 0.5)
    a.dots([(26, 56), (46, 56), (68, 52), (44, 70), (74, 62)], 1.0, 3)
    # quarry-pitched rough face and spalls
    a.poly([(86, 70), (92, 74), (88, 80)], 8, 1.2, 0.7, True)
    a.poly([(8, 80), (14, 84), (6, 85)], 8, 1.2, 0.7, True)
    a.ground(90)
    return a


@item("Dressed Ashlar")
def _():
    a = Art()
    iso_box(a, 18, 42, 50, 32, 16, 0, 1.8)
    a.rect(23, 47, 40, 22, 3, 1.1, 0.6)                      # drafted margin
    a.line(23, 55, 63, 55, 3, 0.9, 0.35)
    a.line(23, 62, 63, 62, 3, 0.9, 0.35)
    # square and plumb-line used to check the dressing
    a.path("M74 30 L74 62 L90 62", 8, 1.8)
    a.line(74, 36, 82, 36, 8, 1.2, 0.6)
    a.line(74, 44, 82, 44, 8, 1.2, 0.6)
    a.line(74, 52, 82, 52, 8, 1.2, 0.6)
    a.ground(88)
    return a


@item("Jointed Ashlar Course")
def _():
    a = Art()
    xs = [10, 34, 56, 78, 92]
    for i in range(4):
        a.rect(xs[i], 40, xs[i + 1] - xs[i], 24, 0, 1.8)
        a.line(xs[i] + 2, 44, xs[i + 1] - 2, 44, 3, 0.9, 0.4)
    a.path("M10 64 L8 70 L94 70 L92 64", 0, 1.2, 0.6)
    # mortar bed lines and level line
    a.line(10, 68, 92, 68, 3, 1.0, 0.35)
    a.line(6, 32, 94, 32, 8, 1.2, 0.45)
    a.poly([(46, 30), (50, 32), (46, 34)], 8, 1.1, 0.5, True)
    a.dots([(34, 52), (56, 52), (78, 52)], 1.1, 3)
    a.ground(88)
    return a


@item("Rusticated Stone Facade")
def _():
    a = Art()
    rows = 4
    for r_ in range(rows):
        y = 18 + r_ * 17
        off = 0 if r_ % 2 == 0 else 14
        x = 10 - off
        while x < 90:
            x0, x1 = max(10, x), min(90, x + 28)
            if x1 - x0 > 4:
                a.poly([(x0, y + 15), (x0, y + 2), (x0 + 2, y), (x1 - 2, y), (x1, y + 2), (x1, y + 15)], 0, 1.6)
                a.line(x0 + 3, y + 5, x1 - 3, y + 5, 3, 0.9, 0.35)
                a.dots([(x0 + 8, y + 10), (x1 - 8, y + 9)], 0.8, 3)
            x += 28
    a.ground(90, 8, 92)
    return a


@item("Stone Lintel")
def _():
    a = Art()
    a.rect(16, 32, 68, 14, 0, 1.8)
    a.rect(18, 46, 12, 40, 0)
    a.rect(70, 46, 12, 40, 0)
    a.line(18, 38, 84, 38, 3, 0.9, 0.4)
    # load arrows on the lintel and thrust diagram under it
    for x in (30, 50, 70):
        a.line(x, 8, x, 24, 8, 1.4, 0.7)
        a.poly([(x - 3, 20), (x, 25), (x + 3, 20)], 8, 1.2, 0.7)
    a.path("M30 52 Q50 60 70 52", 3, 1.1, 0.4)
    a.ground(90, 8, 92)
    return a


@item("Relieved Stone Lintel")
def _():
    a = Art()
    a.rect(16, 52, 68, 12, 0, 1.8)
    a.rect(18, 64, 12, 24, 0)
    a.rect(70, 64, 12, 24, 0)
    # relieving triangle opening above the lintel carries the wall load around it
    a.poly([(20, 52), (50, 24), (80, 52)], 0, 1.8)
    a.poly([(30, 52), (50, 34), (70, 52)], 3, 1.2, 0.55, True)
    a.path("M20 52 L28 44 M80 52 L72 44 M24 38 L34 38 M66 38 L76 38 M36 30 L46 30", 3, 1.0, 0.4)
    a.line(40, 56, 40, 60, 3, 0.9, 0.4)
    a.line(60, 56, 60, 60, 3, 0.9, 0.4)
    for (x1, y1, x2, y2) in ((50, 14, 36, 26), (50, 14, 64, 26)):
        a.line(x1, y1, x2, y2, 8, 1.3, 0.65)
    a.ground(90, 8, 92)
    return a


@item("Trabeated Stone Portal")
def _():
    a = Art()
    a.rect(14, 22, 72, 10, 0, 1.8)
    a.rect(10, 18, 80, 4, 0, 1.4)
    a.rect(20, 32, 12, 56, 0)
    a.rect(68, 32, 12, 56, 0)
    a.line(32, 88, 68, 88, 0, 1.4)
    a.path("M24 36 L24 84 M28 36 L28 84 M72 36 L72 84 M76 36 L76 84", 3, 0.9, 0.35)
    a.rect(36, 40, 28, 48, 3, 1.1, 0.4)
    a.path("M40 28 L60 28", 3, 1.0, 0.45)
    a.dots([(18, 27), (82, 27)], 1.2, 3)
    a.ground(92, 6, 94)
    return a


@item("Monumental Stone Portal")
def _():
    a = Art()
    # twin tapering pylons joined by a massive lintel, stairs, and a tiny figure for scale
    a.poly([(10, 86), (16, 22), (38, 22), (40, 86)], 0, 1.8, close=True)
    a.poly([(60, 86), (62, 22), (84, 22), (90, 86)], 0, 1.8, close=True)
    a.rect(38, 22, 24, 12, 0, 1.8)
    a.rect(34, 16, 32, 6, 0, 1.4)
    a.path("M16 30 L38 30 M16 44 L38 44 M16 58 L37 58 M16 72 L39 72 M62 30 L84 30 M62 44 L84 44 M63 58 L85 58 M61 72 L88 72", 3, 0.9, 0.35)
    for k in range(4):
        a.line(30 + k * 2, 86 - k * 2, 70 - k * 2, 86 - k * 2, 6, 1.0, 0.5)
    a.circle(50, 70, 2, 8, 1.4)
    a.line(50, 72, 50, 80, 8, 1.4)
    a.line(46, 75, 54, 75, 8, 1.4)
    a.line(50, 80, 47, 85, 8, 1.4)
    a.line(50, 80, 53, 85, 8, 1.4)
    a.ground(92, 6, 94)
    return a


@item("Stone Column Drum")
def _():
    a = Art()
    a.ellipse(50, 40, 22, 6, 0, 1.8)
    a.line(28, 40, 28, 66, 0, 1.8)
    a.line(72, 40, 72, 66, 0, 1.8)
    a.path(arc_front(50, 66, 22, 6), 0, 1.8)
    a.ellipse(50, 40, 3.2, 1, 3, 1.1, 0.8)                  # dowel hole
    a.path("M34 48 L34 64 M42 50 L42 69 M58 50 L58 69 M66 48 L66 64", 3, 0.9, 0.3)
    a.path(arc_front(50, 52, 22, 6), 3, 1.0, 0.4)
    a.dots([(36, 56), (62, 58)], 0.9, 3)
    # lifting bosses
    a.rect(24, 52, 4, 6, 6, 1.2, 0.6)
    a.rect(72, 52, 4, 6, 6, 1.2, 0.6)
    a.ground(88)
    return a


@item("Stacked Column Shaft")
def _():
    a = Art()
    ys = [20, 38, 56, 74]
    for k, y in enumerate(ys):
        a.ellipse(50, y, 16, 4.4, 0 if k else 0, 1.6 if k == 0 else None)
        a.line(34, y, 34, y + 18, 0)
        a.line(66, y, 66, y + 18, 0)
    a.path(arc_front(50, 92, 16, 4.4), 0)
    a.line(34, 92 - 0, 34, 92, 0)
    a.line(66, 92 - 0, 66, 92, 0)
    for y in ys[1:]:
        a.path(arc_front(50, y, 16, 4.4), 3, 1.1, 0.6)
    a.path("M40 28 L40 36 M56 46 L56 54 M44 66 L44 72", 3, 0.9, 0.4)
    a.ground(95, 18, 82)
    return a


@item("Fluted Column Shaft")
def _():
    a = Art()
    # capital (abacus + echinus), fluted shaft, plain base
    a.rect(30, 12, 40, 5, 0, 1.6)
    a.path("M34 17 Q50 24 66 17", 0)
    a.path("M36 22 L64 22", 0, 1.2, 0.5)
    a.line(38, 22, 36, 78, 0, 1.8)
    a.line(62, 22, 64, 78, 0, 1.8)
    for k in range(-2, 3):
        x = 50 + k * 4.8
        a.path(f"M{n(x)} 24 Q{n(x + k * 0.3)} 50 {n(x + k * 0.6)} 78", 3, 1.0 if k else 1.4, 0.55 if k else 0.8)
    a.rect(30, 78, 40, 5, 0, 1.6)
    a.rect(26, 83, 48, 5, 0, 1.6)
    a.ground(92, 18, 82)
    return a


@item("Stone Colonnade")
def _():
    a = Art()
    a.rect(8, 22, 84, 8, 0, 1.6)
    a.rect(6, 16, 88, 5, 0, 1.4)
    for k in range(5):
        x = 14 + k * 18
        a.rect(x - 4, 30, 8, 4, 3, 1.2, 0.8)
        a.line(x - 3, 34, x - 3, 80, 0, 1.4)
        a.line(x + 3, 34, x + 3, 80, 0, 1.4)
        a.line(x, 36, x, 78, 3, 0.9, 0.3)
        a.rect(x - 5, 80, 10, 4, 0, 1.4)
    a.path("M12 24 L88 24", 3, 0.9, 0.4)
    a.path("M20 90 L86 90", 3, 1.0, 0.35)
    a.ground(92, 6, 94)
    return a


@item("Stone Voussoir")
def _():
    a = Art()
    # single wedge block + the radial lines it came from
    a.poly([(30, 36), (66, 30), (72, 74), (24, 78)], 0, 1.8, close=True)
    a.poly([(30, 36), (40, 28), (74, 24), (66, 30)], 0, 1.6)
    a.poly([(66, 30), (74, 24), (80, 68), (72, 74)], 0, 1.6)
    a.path("M30 36 L24 78 M66 30 L72 74", 3, 1.0, 0.4)
    for (x1, y1, x2, y2) in ((6, 40, 30, 52), (8, 28, 30, 44), (94, 28, 80, 46)):
        a.line(x1, y1, x2, y2, 8, 1.0, 0.4)
    a.path("M36 54 Q48 58 60 54", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Keyed Stone Arch")
def _():
    a = Art()
    arch_ring(a, 50, 70, 22, 32, 9)
    # emphasised keystone
    a.poly([(46, 38), (54, 38), (56, 48), (44, 48)], 6, 1.8, None, True)
    a.line(18, 70, 18, 86, 0)
    a.line(28, 70, 28, 86, 0)
    a.line(72, 70, 72, 86, 0)
    a.line(82, 70, 82, 86, 0)
    a.path("M18 76 L28 76 M18 82 L28 82 M72 76 L82 76 M72 82 L82 82", 3, 0.9, 0.4)
    a.ground(90, 8, 92)
    return a


@item("Barrel Vault")
def _():
    a = Art()
    # receding semicircular arches forming a tunnel: front ring, back ring offset up-right
    cx, cy = 42, 72
    for k, (dx, dy, r_in, r_out) in enumerate(((0, 0, 24, 32), (14, -10, 24, 32))):
        z = 0 if k == 0 else 6
        a.path(f"M{n(cx + dx - r_in)} {n(cy + dy)} A{n(r_in)} {n(r_in)} 0 0 1 {n(cx + dx + r_in)} {n(cy + dy)}", z)
        a.path(f"M{n(cx + dx - r_out)} {n(cy + dy)} A{n(r_out)} {n(r_out)} 0 0 1 {n(cx + dx + r_out)} {n(cy + dy)}", z)
    # barrel lines connect the front and back rings
    for t in (math.pi, math.pi * 1.25, math.pi * 1.5, math.pi * 1.75, 2 * math.pi):
        a.line(cx + 24 * math.cos(t), cy + 24 * math.sin(t), cx + 14 + 24 * math.cos(t), cy - 10 + 24 * math.sin(t), 3, 1.1, 0.55)
    a.line(cx - 24, cy, cx - 32, cy, 0)
    a.line(cx + 24, cy, cx + 32, cy, 0)
    a.line(cx - 32, cy, cx - 32, cy + 14, 0)
    a.line(cx + 32, cy, cx + 32, cy + 14, 0)
    a.line(cx - 24, cy, cx - 24, cy + 14, 0)
    a.line(cx + 24, cy, cx + 24, cy + 14, 0)
    a.line(cx + 32, cy, cx + 46, cy - 10, 0)
    a.line(cx + 32, cy + 14, cx + 46, cy + 4, 0, 1.2, 0.5)
    a.ground(92, 8, 92)
    return a


@item("Groin Vault")
def _():
    a = Art()
    # one square bay seen from below: four piers, four edge arches, two diagonal groins crossing at the boss
    A, B, C, D = (20, 84), (62, 84), (86, 66), (44, 66)           # pier bases (front-left, front-right, back-right, back-left)
    h = 30
    tops = [(x, y - h) for x, y in (A, B, C, D)]
    for (x, y), (tx, ty) in zip((A, B, C, D), tops):
        a.line(x, y, tx, ty, 0 if (x, y) in (A, B) else 6, 1.8 if (x, y) in (A, B) else 1.4)
        a.rect(x - 4, y, 8, 3, 0, 1.2)
    E = (53, 28)
    def arch(p, q, lift):
        mx, my = (p[0] + q[0]) / 2, min(p[1], q[1]) - lift
        a.path(f"M{n(p[0])} {n(p[1])} Q{n(mx)} {n(my)} {n(q[0])} {n(q[1])}", 0, 1.8)
    arch(tops[0], tops[1], 26)
    arch(tops[1], tops[2], 24)
    arch(tops[3], tops[2], 22)
    arch(tops[0], tops[3], 24)
    a.path(f"M{n(tops[0][0])} {n(tops[0][1])} Q{n(E[0] - 8)} {n(E[1] - 10)} {n(E[0])} {n(E[1])} Q{n(E[0] + 10)} {n(E[1] + 4)} {n(tops[2][0])} {n(tops[2][1])}", 3, 1.6)
    a.path(f"M{n(tops[1][0])} {n(tops[1][1])} Q{n(E[0] + 2)} {n(E[1] - 6)} {n(E[0])} {n(E[1])} Q{n(E[0] - 8)} {n(E[1] + 4)} {n(tops[3][0])} {n(tops[3][1])}", 3, 1.6)
    a.circle(E[0], E[1], 2.4, 6, 1.4)
    a.ground(94, 10, 90)
    return a

@item("Stone Foundation Block")
def _():
    a = Art()
    a.line(8, 40, 92, 40, 0, 1.8)                                 # ground surface
    a.hatch(8, 40, 92, 56, 4.4, 1, 3, 0.9, 0.3)
    iso_box(a, 24, 44, 52, 30, 16, 0, 1.8)
    a.line(24, 58, 76, 58, 3, 0.9, 0.35)
    a.line(40, 44, 40, 58, 3, 0.9, 0.35)
    a.line(62, 58, 62, 74, 3, 0.9, 0.35)
    # compacted bed and wall course above
    a.rect(30, 22, 40, 18, 0, 1.4)
    a.line(30, 31, 70, 31, 3, 0.9, 0.45)
    a.dots([(14, 66), (86, 70), (20, 80)], 1.0, 3)
    a.ground(90)
    return a


@item("Stepped Foundation")
def _():
    a = Art()
    a.line(8, 38, 92, 38, 0, 1.8)
    a.hatch(8, 38, 92, 52, 4.4, 1, 3, 0.9, 0.25)
    a.path("M40 38 L40 20 L60 20 L60 38", 0)
    a.path("M30 38 L30 56 L70 56 L70 38", 0, 1.2, 0.5)
    a.path("M34 56 L34 66 L66 66 L66 56", 0)
    a.path("M26 66 L26 78 L74 78 L74 66", 0, 1.8)
    a.path("M20 78 L20 84 L80 84 L80 78", 0)
    a.line(40, 28, 60, 28, 3, 0.9, 0.4)
    a.path("M22 80 L78 80", 3, 0.9, 0.35)
    # load spreading arrows
    a.poly([(50, 10), (50, 18)], 8, 1.6, 0.8)
    a.poly([(47, 15), (50, 20), (53, 15)], 8, 1.2, 0.8)
    a.ground(92)
    return a


@item("Stone Retaining Wall")
def _():
    a = Art()
    # earth bank held behind a battered dry-stone wall
    a.poly([(22, 84), (30, 28), (44, 28), (44, 84)], 0, 1.8, close=True)
    for r_ in range(5):
        y = 34 + r_ * 10
        a.line(24 + r_ * 1.2 * 0, y, 44, y, 3, 1.0, 0.5)
        a.line(30 + (r_ % 2) * 6, y, 30 + (r_ % 2) * 6, y + 10, 3, 1.0, 0.45)
    a.hatch(44, 28, 90, 84, 4.4, 0.8, 3, 0.9, 0.3)
    a.path("M44 28 Q60 26 76 34 L90 40", 0, 1.6)
    a.line(8, 84, 92, 84, 0, 1.6)
    # weep hole with seep
    a.circle(34, 74, 2, 6, 1.2)
    a.path("M34 77 Q33 82 30 86", 6, 1.2, 0.6)
    a.poly([(66, 48), (60, 56)], 8, 1.4, 0.7)
    a.poly([(62, 50), (60, 57), (66, 55)], 8, 1.1, 0.7)
    a.ground(92)
    return a


@item("Buttressed Retaining Wall")
def _():
    a = Art()
    # front view of a long wall held back by three tapering buttresses; earth bank hatched above
    a.rect(8, 38, 84, 46, 0, 1.8)
    a.hatch(8, 22, 92, 38, 4.4, 0.8, 3, 0.9, 0.3)
    a.line(8, 38, 92, 38, 0, 1.6)
    for x in (22, 50, 78):
        a.poly([(x - 8, 84), (x - 3, 42), (x + 3, 42), (x + 8, 84)], 6, 1.6, close=True)
        for k, y in enumerate((52, 62, 72)):
            half = 3 + (y - 42) * 5 / 42
            a.line(x - half, y, x + half, y, 3, 0.9, 0.4)
    a.line(8, 50, 92, 50, 3, 0.9, 0.25)
    for x in (36, 64):
        a.line(x, 10, x, 26, 8, 1.4, 0.6)
        a.poly([(x - 3, 22), (x, 27), (x + 3, 22)], 8, 1.2, 0.6)
    a.ground(92, 6, 94)
    return a

@item("Stone Stair Tread")
def _():
    a = Art()
    iso_box(a, 14, 54, 60, 12, 22, 0, 1.8)
    a.line(14, 60, 74, 60, 3, 0.9, 0.4)
    a.path("M20 50 Q44 46 68 50", 3, 1.0, 0.4)
    # worn dip in the walking surface + footprint arrows
    a.path("M34 48 Q44 53 54 47", 3, 1.2, 0.6)
    a.path("M76 36 L84 36 Q88 40 84 46 L76 46 Q72 40 76 36Z", 8, 1.4, 0.8)
    a.line(60, 24, 60, 38, 8, 1.2, 0.5)
    a.ground(86)
    return a


@item("Stone Stair Flight")
def _():
    a = Art()
    # side view: six risers; nosing detail
    x, y = 10, 82
    pts = [(x, y)]
    for k in range(6):
        pts.append((x + k * 12, y - (k + 1) * 10))
        pts.append((x + (k + 1) * 12, y - (k + 1) * 10))
    pts = [(10, 82)]
    for k in range(6):
        pts += [(10 + k * 13, 82 - k * 11), (10 + k * 13, 82 - (k + 1) * 11), (10 + (k + 1) * 13, 82 - (k + 1) * 11)]
    pts.append((88, 82))
    a.poly(pts, 0, 1.8, close=True)
    for k in range(1, 6):
        a.line(10 + k * 13 + 1, 82 - k * 11 + 3, 88, 82 - k * 11 + 3, 3, 0.9, 0.3)
    a.path("M10 82 L88 16", 3, 1.0, 0.3)
    a.ground(90, 6, 94)
    return a


@item("Spiral Stone Staircase")
def _():
    a = Art()
    # plan of a newel stair, tilted: outer wall, central newel, wedge treads, climbing handrail spiral
    cx, cy, R, r, ky, steps = 50.0, 46.0, 38.0, 7.0, 0.5, 14
    a.ellipse(cx, cy, R, R * ky, 0, 1.8)
    a.ellipse(cx, cy, R - 5, (R - 5) * ky, 3, 1.0, 0.45)
    a.ellipse(cx, cy, r, r * ky, 0, 1.8)
    for k in range(steps):
        t = k * 2 * math.pi / steps
        a.line(cx + r * math.cos(t), cy + r * ky * math.sin(t), cx + R * math.cos(t), cy + R * ky * math.sin(t),
               0 if k % 2 == 0 else 3, 1.4 if k % 2 == 0 else 1.1, None if k % 2 == 0 else 0.6)
    # outer wall thickness going down on the near side
    a.path(f"M{n(cx - R)} {n(cy)} L{n(cx - R)} {n(cy + 12)} A{n(R)} {n(R * ky)} 0 0 0 {n(cx + R)} {n(cy + 12)} L{n(cx + R)} {n(cy)}", 0, 1.8)
    # handrail spiral climbing toward the newel
    pts = []
    for k in range(0, 41):
        t = k * 0.2
        rr = R - 8 - k * 0.55
        pts.append((cx + rr * math.cos(t), cy - k * 0.5 + rr * ky * math.sin(t)))
    a.path("M" + " L".join(f"{n(x)} {n(y)}" for x, y in pts), 6, 1.5, 0.85)
    a.ground(92, 10, 90)
    return a


@item("Cantilevered Stone Stair")
def _():
    a = Art()
    # steps built into a wall at one end, free at the other, no support beneath
    a.rect(8, 10, 20, 82, 0, 1.8)
    a.hatch(8, 10, 28, 92, 4.4, 0.8, 3, 0.9, 0.3)
    for k in range(6):
        y = 80 - k * 11
        a.poly([(28, y), (28 + 8 + k * 7, y), (28 + 8 + k * 7, y - 6), (28, y - 6)], 0, 1.4, close=True)
        a.line(28, y - 3, 28 + 8 + k * 7, y - 3, 3, 0.8, 0.3)
    # shear arrow at the wall bearing
    a.poly([(34, 40), (34, 50)], 8, 1.4, 0.8)
    a.poly([(31, 47), (34, 52), (37, 47)], 8, 1.2, 0.8)
    a.ground(94, 6, 94)
    return a
