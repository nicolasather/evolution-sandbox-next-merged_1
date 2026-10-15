"""Topic 23 - glass vessels (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, flame, sparkle
from .registry import item, topic

topic("glass vessels")


def gloss(a, x, y, h=14):
    a.path(f"M{x} {y} L{x} {y + h}", 6, 1.2, 0.7)
    a.path(f"M{x + 3} {y + 2} L{x + 3} {y + h * 0.5}", 6, 1.0, 0.5)


def bead(a, cx, cy, r=8, z=0, w=2.2):
    a.circle(cx, cy, r, z, w)
    a.circle(cx, cy, r * 0.3, 3, 1.2, 0.8)
    a.path(f"M{n(cx - r * 0.6)} {n(cy - r * 0.4)} Q{n(cx - r * 0.2)} {n(cy - r * 0.9)} {n(cx + r * 0.3)} {n(cy - r * 0.7)}", 6, 1.0, 0.6)


def cup(a, cx, top, w=26, h=30, z=0, wd=2.2):
    a.ellipse(cx, top, w / 2, w * 0.14, z, wd)
    a.path(f"M{cx - w / 2} {top} L{cx - w / 2 + 3} {top + h} Q{cx} {top + h + 4} {cx + w / 2 - 3} {top + h} L{cx + w / 2} {top}", z, wd)
    gloss(a, cx - w / 2 + 5, top + 6, h * 0.5)


def bottle(a, cx, top, w=22, h=56, neck=5, z=0, wd=2.2, neck_len=0.35):
    nl = h * neck_len
    a.path(f"M{cx - neck} {top} L{cx - neck} {top + nl} Q{cx - w / 2} {top + nl + 6} {cx - w / 2} {top + nl + 16} L{cx - w / 2} {top + h} Q{cx} {top + h + 4} {cx + w / 2} {top + h} L{cx + w / 2} {top + nl + 16} Q{cx + w / 2} {top + nl + 6} {cx + neck} {top + nl} L{cx + neck} {top}", z, wd)
    a.ellipse(cx, top, neck, 1.6, z, 1.6)
    gloss(a, cx - w / 2 + 4, top + nl + 18, h * 0.3)


def tube(a, x0, x1, cy, r, z=0, w=2.2):
    a.line(x0, cy - r, x1, cy - r, z, w)
    a.line(x0, cy + r, x1, cy + r, z, w)
    a.ellipse(x1, cy, r * 0.4, r, z, w)
    a.ellipse(x0, cy, r * 0.4, r, z, w, 0.6)


def glow(a, cx, y):
    flame(a, cx, y, 8, 6, 1.4)


@item("Molten Glass Batch")
def _():
    a = Art()
    a.path("M20 46 L24 78 L76 78 L80 46", 0, 2.4)
    a.ellipse(50, 46, 30, 8, 0, 2.2)
    a.path("M26 48 Q38 52 50 48 T74 48", 6, 1.8)
    for (x, y) in ((38, 46), (52, 50), (62, 46)):
        a.circle(x, y, 2, 6, 1.1)
    for x in (34, 50, 66):
        flame(a, x, 90, 7, 6, 1.3)
    sparkle(a, 50, 28, 3.4, 6, 0.9)
    a.ground(92)
    return a


@item("Glass Bead Blank")
def _():
    a = Art()
    a.path("M30 58 Q30 38 50 38 Q70 38 70 58 Q70 74 50 74 Q30 74 30 58 Z", 0, 2.4)
    a.line(14, 56, 30, 56, 0, 2.2)
    a.line(70, 56, 86, 56, 0, 2.2)
    a.circle(50, 56, 3, 3, 1.2, 0.7)
    flame(a, 50, 90, 8, 6, 1.4)
    a.path("M38 46 Q42 42 48 44", 6, 1.0, 0.6)
    a.ground(92)
    return a


@item("Drawn Glass Bead")
def _():
    a = Art()
    for (x, y) in ((24, 50), (50, 50), (76, 50)):
        bead(a, x, y, 9)
    a.line(8, 50, 92, 50, 3, 1.0, 0.45)
    a.path("M16 74 L84 74", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Multicolor Glass Bead")
def _():
    a = Art()
    bead(a, 50, 46, 16)
    a.path("M36 40 Q50 52 64 40 M36 48 Q50 60 64 48 M38 56 Q50 66 62 56", 6, 1.3, 0.8)
    for (x, y) in ((22, 74), (36, 78), (64, 78), (78, 74)):
        bead(a, x, y, 5)
    a.ground(90)
    return a


@item("Decorated Millefiori Bead")
def _():
    a = Art()
    bead(a, 50, 48, 24)
    for k in range(6):
        t = math.pi * 2 * k / 6
        x, y = 50 + 13 * math.cos(t), 48 + 13 * math.sin(t)
        a.circle(x, y, 4, 6, 1.2)
        a.circle(x, y, 1.4, 3, 1.0, 0.7)
    a.circle(50, 48, 5, 6, 1.4)
    a.ground(86)
    return a


@item("Glass Cup Blank")
def _():
    a = Art()
    a.path("M30 62 Q30 40 50 40 Q70 40 70 62 Q70 78 50 78 Q30 78 30 62 Z", 0, 2.4)
    a.line(50, 12, 50, 40, 0, 2.2)
    a.ellipse(50, 12, 4, 2, 0, 1.8)
    gloss(a, 38, 50, 12)
    flame(a, 28, 88, 6, 6, 1.3)
    a.ground(92)
    return a


@item("Blown Glass Cup")
def _():
    a = Art()
    cup(a, 50, 34, 40, 36, 0, 2.4)
    a.path("M30 46 Q50 54 70 46", 3, 1.0, 0.45)
    a.line(14, 22, 30, 36, 0, 2.2)
    a.circle(12, 20, 3, 6, 1.4)
    a.path("M76 28 Q82 24 86 28", 3, 1.0, 0.5)
    sparkle(a, 78, 54, 3, 6, 0.8)
    a.ground(90)
    return a


@item("Handled Glass Tankard")
def _():
    a = Art()
    cup(a, 42, 26, 40, 50, 0, 2.4)
    a.path("M62 36 Q82 34 82 50 Q82 66 62 66", 0, 2.4)
    a.path("M62 42 Q74 42 74 50 Q74 60 62 60", 3, 1.0, 0.5)
    a.path("M26 50 L58 50", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Heat Resistant Glass Beaker")
def _():
    a = Art()
    a.path("M30 24 L30 76 L70 76 L70 24", 0, 2.4)
    a.path("M26 24 L34 24 M66 24 L74 24", 0, 2.2)
    a.ellipse(50, 76, 20, 3.4, 0, 1.6, 0.6)
    for y in (36, 46, 56, 66):
        a.line(30, y, 38, y, 3, 1.2, 0.8)
    a.path("M34 56 Q50 60 66 56", 6, 1.2, 0.7)
    flame(a, 42, 90, 6, 6, 1.3)
    flame(a, 58, 90, 6, 6, 1.3)
    a.ground(92)
    return a


@item("Glass Bottle Blank")
def _():
    a = Art()
    a.path("M30 40 Q30 28 50 28 Q70 28 70 40 L70 76 Q50 80 30 76 Z", 0, 2.4)
    a.line(50, 12, 50, 28, 0, 2.2)
    a.ellipse(50, 12, 4, 2, 0, 1.8)
    gloss(a, 38, 44, 20)
    flame(a, 80, 88, 6, 6, 1.3)
    a.ground(92)
    return a


@item("Long Neck Glass Bottle")
def _():
    a = Art()
    bottle(a, 50, 10, 38, 70, 4.5, 0, 2.4, 0.55)
    a.path("M36 62 Q50 68 64 62", 3, 1.0, 0.45)
    a.ground(92)
    return a


@item("Stoppered Glass Bottle")
def _():
    a = Art()
    bottle(a, 50, 18, 36, 62, 5, 0, 2.4, 0.3)
    a.path("M44 12 L56 12 L54 18 L46 18 Z", 6, 2.0)
    a.line(46, 12, 54, 12, 6, 2.0)
    a.path("M36 58 Q50 64 64 58", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Pressure Rated Glass Bottle")
def _():
    a = Art()
    bottle(a, 50, 14, 38, 68, 6, 0, 2.8, 0.3)
    a.line(40, 14, 60, 14, 6, 2.6)
    a.circle(50, 12, 2.4, 6, 1.4)
    a.path("M34 54 Q50 60 66 54", 3, 1.2, 0.8)
    a.path("M34 70 Q50 76 66 70", 3, 1.2, 0.8)
    a.path("M74 34 L84 34 M74 44 L82 44", 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Glass Window Pane")
def _():
    a = Art()
    a.rect(24, 16, 52, 62, 0, 2.6)
    a.rect(29, 21, 42, 52, 3, 1.0, 0.5)
    a.path("M34 62 L56 28 M44 68 L66 32", 6, 1.6, 0.7)
    a.path("M30 50 L40 40", 6, 1.2, 0.6)
    a.ground(88)
    return a


@item("Flattened Glass Pane")
def _():
    a = Art()
    a.path("M14 56 L62 56 L86 40 L38 40 Z", 0, 2.4)
    a.path("M14 56 L14 62 L62 62 L62 56 M62 62 L86 46 L86 40", 0, 2.4)
    a.line(60, 28, 40, 38, 6, 3.0)
    a.circle(62, 27, 3.4, 6, 1.6)
    a.path("M30 52 L50 44", 6, 1.2, 0.7)
    a.ground(86)
    return a


@item("Lead Came Window")
def _():
    a = Art()
    a.rect(20, 14, 60, 66, 0, 2.4)
    for k in range(1, 4):
        a.line(20 + k * 15, 14, 20 + k * 15, 80, 6, 2.2)
        a.line(20, 14 + k * 16.5, 80, 14 + k * 16.5, 6, 2.2)
    for k in range(1, 4):
        a.line(20 + k * 15, 14, 20, 14 + k * 15, 3, 1.0, 0.5)
    a.path("M26 22 L34 22 M56 50 L64 50", 3, 1.0, 0.6)
    a.ground(88)
    return a


@item("Double Glazed Window")
def _():
    a = Art()
    a.rect(20, 14, 60, 66, 0, 2.6)
    a.line(36, 14, 36, 80, 0, 1.8)
    a.line(64, 14, 64, 80, 0, 1.8)
    a.path("M40 24 L58 24 M42 32 L54 32", 3, 1.0, 0.5)
    a.path("M26 62 L34 26", 6, 1.4, 0.7)
    a.path("M68 62 L76 26", 6, 1.4, 0.7)
    a.dots([(50, 48), (50, 56), (50, 64)], 1.0, 3)
    a.ground(88)
    return a


@item("Glass Tube Blank")
def _():
    a = Art()
    a.path("M14 36 L60 36 Q86 36 86 50 Q86 64 60 64 L14 64 Z", 0, 2.4)
    a.path("M20 42 L60 42", 6, 1.2, 0.6)
    a.line(86, 50, 94, 50, 0, 2.2)
    flame(a, 40, 82, 7, 6, 1.4)
    flame(a, 56, 82, 7, 6, 1.4)
    a.ground(90)
    return a


@item("Drawn Glass Tube")
def _():
    a = Art()
    tube(a, 10, 90, 44, 6, 0, 2.2)
    a.path("M10 38 L10 50", 3, 1.0, 0.5)
    tube(a, 10, 90, 66, 3, 0, 2.2)
    arrow(a, 34, 80, 66, 80, 3, 1.3, 0.7, 3)
    a.path("M20 40 L80 40", 6, 1.0, 0.6)
    a.ground(90)
    return a


@item("Graduated Glass Tube")
def _():
    a = Art()
    tube(a, 12, 88, 46, 9, 0, 2.4)
    for k in range(10):
        x = 20 + k * 7
        a.line(x, 37 if k % 2 else 37, x, 42 if k % 5 else 46, 6, 1.2)
    a.path("M20 54 L80 54", 6, 1.0, 0.5)
    a.path("M12 72 L88 72", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Calibrated Glass Pipette")
def _():
    a = Art()
    a.path("M46 12 Q46 8 50 8 Q54 8 54 12 L54 36 Q58 42 58 52 L54 60 L52 86 L48 86 L46 60 L42 52 Q42 42 46 36 Z", 0, 2.4)
    for y in (22, 28, 34):
        a.line(46, y, 51, y, 6, 1.2)
    for y in (66, 72, 78):
        a.line(48, y, 52, y, 6, 1.0)
    droplet(a, 50, 90, 3.4)
    a.path("M70 40 L84 40 M70 52 L82 52", 3, 1.0, 0.5)
    a.ground(94)
    return a


@item("Glass Sphere Blank")
def _():
    a = Art()
    a.circle(50, 56, 22, 0, 2.4)
    a.line(50, 12, 50, 34, 0, 2.2)
    a.ellipse(50, 12, 4, 2, 0, 1.8)
    gloss(a, 38, 48, 14)
    flame(a, 30, 90, 6, 6, 1.3)
    flame(a, 70, 90, 6, 6, 1.3)
    a.ground(92)
    return a


@item("Hollow Glass Sphere")
def _():
    a = Art()
    a.circle(50, 48, 28, 0, 2.4)
    a.circle(50, 48, 24, 3, 1.0, 0.5)
    a.path("M34 36 Q40 28 50 26", 6, 1.8, 0.8)
    a.path("M70 62 Q64 70 54 72", 6, 1.2, 0.5)
    a.ellipse(50, 78, 12, 2.4, 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Silvered Glass Ornament")
def _():
    a = Art()
    a.circle(50, 54, 24, 0, 2.4)
    a.rect(44, 26, 12, 6, 6, 1.8)
    a.path("M50 26 Q50 14 60 12", 3, 1.4, 0.8)
    a.path("M34 46 Q40 36 52 34", 6, 1.6)
    a.path("M26 60 Q50 80 74 60", 3, 1.0, 0.45)
    sparkle(a, 72, 38, 3.2, 6, 0.9)
    sparkle(a, 30, 70, 2.4, 6, 0.8)
    a.ground(90)
    return a


@item("Vacuum Insulated Glass Vessel")
def _():
    a = Art()
    a.path("M34 22 L30 74 Q50 82 70 74 L66 22", 0, 2.4)
    a.path("M40 22 L38 70 Q50 76 62 70 L60 22", 0, 1.6)
    a.ellipse(50, 22, 16, 4, 0, 2.2)
    a.ellipse(50, 22, 10, 2.6, 3, 1.0, 0.6)
    a.path("M44 40 L44 62", 6, 1.2, 0.7)
    a.dots([(33, 40), (32, 52), (33, 64), (67, 40), (68, 52), (67, 64)], 0.8, 3)
    a.path("M70 30 Q82 26 86 36", 3, 1.0, 0.5)
    a.ground(90)
    return a
