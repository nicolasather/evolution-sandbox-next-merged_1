"""Topic 22 - iron blacksmithing (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import flame, sparkle
from .registry import item, topic
from .t21_copper_fabrication import anvil, hammer

topic("iron blacksmithing")


def bar(a, x0, x1, cy, h=8, z=0, w=2.4, taper=0.0):
    a.path(f"M{x0} {cy - h / 2} L{x1} {cy - h / 2 + taper} L{x1} {cy + h / 2 - taper} L{x0} {cy + h / 2} Z", z, w)


def link(a, cx, cy, rx=9, ry=5.5, z=0, w=2.4, rot=0):
    a.ellipse(cx, cy, rx, ry, z, w, None, rot)
    a.ellipse(cx, cy, rx * 0.5, ry * 0.42, 3, 1.0, 0.6, rot)


def sparks(a, pts):
    for (x, y) in pts:
        sparkle(a, x, y, 2.4, 6, 0.8)


def glow(a, x, y):
    a.path(f"M{x} {y} Q{x + 4} {y - 8} {x} {y - 14} Q{x - 4} {y - 8} {x} {y}", 6, 1.4)


@item("Wrought Iron Stock")
def _():
    a = Art()
    bar(a, 12, 74, 36, 10, 0, 2.4)
    bar(a, 18, 82, 56, 6, 0, 2.2)
    a.path("M14 74 L78 74 L84 68 L20 68 Z", 0, 1.8)
    a.path("M16 38 Q40 34 70 38", 3, 1.0, 0.5)
    sparks(a, [(84, 30)])
    a.ground(88)
    return a


@item("Iron Bar Blank")
def _():
    a = Art()
    a.path("M12 40 L72 40 L84 30 L24 30 Z", 0, 2.2)
    a.path("M12 40 L12 54 L72 54 L72 40 M72 54 L84 44 L84 30", 0, 2.2)
    a.path("M20 47 L66 47", 3, 1.0, 0.5)
    a.path("M18 66 L82 66", 3, 1.0, 0.4)
    sparks(a, [(80, 62)])
    a.ground(86)
    return a


@item("Forge Drawn Iron Bar")
def _():
    a = Art()
    bar(a, 10, 40, 52, 14, 0, 2.4)
    bar(a, 40, 86, 52, 8, 0, 2.4)
    a.path("M40 45 L40 59", 3, 1.2, 0.7)
    anvil(a, 56, 60, 36, 0)
    hammer(a, 84, 22, -140, 6, 22)
    a.ground(88)
    return a


@item("Square Iron Bar")
def _():
    a = Art()
    a.path("M12 50 L62 50 L82 36 L32 36 Z", 0, 2.2)
    a.path("M12 50 L12 64 L62 64 L62 50 M62 64 L82 50 L82 36", 0, 2.4)
    a.path("M12 57 L62 57", 3, 1.0, 0.5)
    a.rect(78, 66, 8, 8, 6, 1.6)
    a.path("M20 74 L60 74", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Threaded Iron Rod")
def _():
    a = Art()
    a.line(12, 44, 88, 44, 0, 2.4)
    a.line(12, 58, 88, 58, 0, 2.4)
    for x in range(18, 86, 6):
        a.line(x, 44, x + 4, 58, 3, 1.4, 0.9)
    a.ellipse(88, 51, 3, 7, 0, 2.2)
    a.path("M20 70 L80 70", 3, 1.0, 0.45)
    a.ground(86)
    return a


@item("Iron Chisel Blank")
def _():
    a = Art()
    a.path("M14 50 L70 44 L70 56 Z", 0, 2.4)
    a.line(70, 44, 86, 44, 0, 2.2)
    a.line(70, 56, 86, 56, 0, 2.2)
    a.line(86, 44, 86, 56, 0, 2.2)
    a.path("M20 50 L66 50", 3, 1.0, 0.5)
    a.path("M14 70 L86 70", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Forged Cold Chisel")
def _():
    a = Art()
    a.path("M12 50 L26 44 L26 56 Z", 0, 2.4)
    a.path("M26 44 L82 44 L82 56 L26 56", 0, 2.4)
    a.ellipse(86, 50, 4, 8, 0, 2.2)
    a.line(32, 50, 76, 50, 3, 1.0, 0.5)
    hammer(a, 66, 18, -40, 6, 14)
    a.path("M10 44 L6 38 M10 56 L6 62", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("Tempered Cold Chisel")
def _():
    a = Art()
    a.path("M12 50 L26 44 L26 56 Z", 0, 2.4)
    a.path("M26 44 L82 44 L82 56 L26 56", 0, 2.4)
    a.ellipse(86, 50, 4, 8, 0, 2.2)
    a.path("M12 50 L26 44 M12 50 L26 56", 6, 1.8)
    a.rect(18, 66, 28, 14, 0, 2.0)
    a.path("M20 72 Q32 68 44 72", 3, 1.2, 0.6)
    a.dots([(60, 68), (70, 72)], 1.2, 6)
    a.ground(88)
    return a


@item("Set Of Cold Chisels")
def _():
    a = Art()
    for i, (y, L) in enumerate(((28, 62), (44, 70), (60, 56))):
        a.path(f"M12 {y} L22 {y - 5} L22 {y + 5} Z", 0, 2.2)
        a.rect(22, y - 5, L, 10, 0, 2.2)
        a.line(26, y, 22 + L - 4, y, 3, 1.0, 0.5)
    a.line(8, 76, 92, 76, 6, 2.0)
    a.ground(88)
    return a


@item("Iron Hinge Strap")
def _():
    a = Art()
    a.path("M10 44 L66 40 L66 56 L10 52 Z", 0, 2.4)
    a.path("M66 40 Q82 38 82 48 Q82 58 66 56", 0, 2.4)
    a.circle(80, 48, 3.2, 6, 1.6)
    for x in (22, 38, 54):
        a.circle(x, 47, 2, 6, 1.4)
    a.path("M10 70 L82 70", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Strap Hinge")
def _():
    a = Art()
    a.rect(12, 20, 28, 60, 0, 2.4)
    a.path("M40 36 L70 32 L70 44 L40 44 Z", 0, 2.2)
    a.path("M40 56 L70 52 L70 64 L40 64 Z", 0, 2.2)
    a.line(70, 28, 70, 68, 0, 2.4)
    for y in (36, 54, 66):
        a.circle(20, y, 2, 6, 1.4)
    a.circle(52, 38, 1.6, 6, 1.2)
    a.circle(52, 58, 1.6, 6, 1.2)
    a.path("M78 30 L88 30 M78 66 L88 66", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Pin Hinged Gate")
def _():
    a = Art()
    a.line(14, 14, 14, 84, 0, 3.0)
    a.rect(24, 24, 60, 44, 0, 2.4)
    for x in (40, 56, 70):
        a.line(x, 24, x, 68, 3, 1.4, 0.8)
    a.line(24, 46, 84, 46, 3, 1.4, 0.8)
    a.path("M14 30 L24 30 M14 62 L24 62", 6, 2.2)
    a.circle(14, 30, 2, 6, 1.2)
    a.circle(14, 62, 2, 6, 1.2)
    a.path("M84 46 L92 46", 6, 2.0)
    a.ground(90)
    return a


@item("Adjustable Iron Hinge")
def _():
    a = Art()
    a.rect(14, 26, 22, 48, 0, 2.4)
    a.rect(64, 26, 22, 48, 0, 2.4)
    a.line(36, 50, 64, 50, 0, 2.6)
    a.circle(50, 50, 6, 6, 2.0)
    a.circle(50, 50, 2, 3, 1.2)
    for y in (34, 66):
        a.circle(25, y, 2, 6, 1.3)
        a.circle(75, y, 2, 6, 1.3)
    a.path("M40 38 L60 38 M40 62 L60 62", 3, 1.2, 0.6)
    arrow(a, 40, 78, 60, 78, 3, 1.3, 0.7, 3)
    a.ground(90)
    return a


@item("Iron Chain Link")
def _():
    a = Art()
    link(a, 50, 50, 26, 14, 0, 2.6)
    a.path("M28 44 Q50 34 72 44", 3, 1.0, 0.5)
    sparks(a, [(78, 24)])
    a.ground(86)
    return a


@item("Linked Iron Chain")
def _():
    a = Art()
    for k in range(5):
        x = 14 + k * 16
        if k % 2 == 0:
            link(a, x + 8, 50, 11, 6, 0, 2.4)
        else:
            a.ellipse(x + 8, 50, 11, 3.6, 0, 2.4)
    a.path("M14 70 L86 70", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Welded Link Chain")
def _():
    a = Art()
    for k in range(4):
        x = 16 + k * 20
        if k % 2 == 0:
            link(a, x + 6, 46, 11, 6, 0, 2.4)
        else:
            a.ellipse(x + 6, 46, 11, 3.6, 0, 2.4)
    for x in (22, 62):
        a.circle(x + 11, 46, 2, 6, 1.2)
    sparks(a, [(40, 68), (60, 74), (30, 76)])
    a.path("M16 66 L84 66", 6, 1.4, 0.7)
    a.ground(88)
    return a


@item("Calibrated Hoist Chain")
def _():
    a = Art()
    for k in range(4):
        y = 16 + k * 16
        if k % 2 == 0:
            a.ellipse(50, y + 6, 6, 10, 0, 2.4)
        else:
            a.ellipse(50, y + 6, 3.4, 10, 0, 2.4)
    a.line(60, 22, 76, 22, 6, 1.6)
    a.line(60, 38, 72, 38, 6, 1.6)
    a.line(60, 54, 76, 54, 6, 1.6)
    a.line(60, 70, 72, 70, 6, 1.6)
    a.path("M30 78 L70 78 L66 86 L34 86 Z", 6, 2.0)
    a.ground(92)
    return a


@item("Iron Hook Blank")
def _():
    a = Art()
    a.line(50, 14, 50, 62, 0, 4.0)
    a.path("M50 62 Q50 82 70 78 Q80 72 76 62", 0, 4.0)
    a.line(50, 14, 50, 62, 3, 1.0, 0.4)
    a.circle(50, 14, 4, 6, 1.6)
    a.path("M24 60 L40 60 M24 68 L36 68", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Forged S Hook")
def _():
    a = Art()
    a.path("M36 26 Q36 14 50 14 Q62 14 62 26 Q62 38 50 44 Q38 50 38 62 Q38 80 54 80 Q66 80 66 68", 0, 3.4)
    a.circle(50, 44, 1.4, 6, 1.0)
    sparks(a, [(78, 30), (22, 70)])
    a.ground(90)
    return a


@item("Forged J Hook")
def _():
    a = Art()
    a.line(36, 12, 36, 62, 0, 3.6)
    a.path("M36 62 Q36 82 56 82 Q72 82 72 62 L72 56", 0, 3.6)
    a.path("M72 56 L68 52 M72 56 L76 52", 6, 1.6)
    a.circle(36, 12, 3.4, 6, 1.6)
    hammer(a, 84, 30, -140, 6, 18)
    a.ground(90)
    return a


@item("Load Rated Lifting Hook")
def _():
    a = Art()
    a.circle(50, 16, 8, 0, 2.6)
    a.circle(50, 16, 3, 3, 1.2, 0.6)
    a.path("M44 24 L40 50 Q36 74 54 80 Q72 82 72 62 L66 62 Q66 72 56 72 Q48 70 50 52 L56 24", 0, 2.4)
    a.path("M66 60 Q74 52 76 58", 6, 1.8)
    a.rect(70, 36, 18, 12, 6, 1.4)
    a.line(74, 42, 84, 42, 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Iron Horseshoe Blank")
def _():
    a = Art()
    a.rect(14, 38, 72, 14, 0, 2.4)
    a.line(14, 45, 86, 45, 3, 1.0, 0.5)
    a.path("M14 64 L86 64", 3, 1.0, 0.4)
    a.path("M22 28 L36 28 M60 28 L76 28", 3, 1.0, 0.5)
    sparks(a, [(80, 70)])
    a.ground(86)
    return a


def shoe(a, cx=50, cy=48, R=26, z=0, w=3.0):
    a.path(f"M{cx - R * 0.7} {cy + R * 0.9} Q{cx - R * 1.1} {cy - R * 0.4} {cx} {cy - R} Q{cx + R * 1.1} {cy - R * 0.4} {cx + R * 0.7} {cy + R * 0.9}", z, w)
    a.path(f"M{cx - R * 0.35} {cy + R * 0.9} Q{cx - R * 0.6} {cy - R * 0.1} {cx} {cy - R * 0.55} Q{cx + R * 0.6} {cy - R * 0.1} {cx + R * 0.35} {cy + R * 0.9}", z, w)
    a.line(cx - R * 0.7, cy + R * 0.9, cx - R * 0.35, cy + R * 0.9, z, w)
    a.line(cx + R * 0.7, cy + R * 0.9, cx + R * 0.35, cy + R * 0.9, z, w)


@item("Forged Horseshoe")
def _():
    a = Art()
    shoe(a, 50, 46, 28)
    for (x, y) in ((28, 56), (30, 38), (40, 26), (60, 26), (70, 38), (72, 56)):
        a.circle(x, y, 1.6, 6, 1.2)
    hammer(a, 84, 22, -140, 6, 18)
    a.ground(90)
    return a


@item("Nailless Horseshoe")
def _():
    a = Art()
    shoe(a, 50, 46, 28)
    a.path("M30 66 Q50 76 70 66", 6, 1.6)
    a.path("M26 70 L26 78 M74 70 L74 78", 6, 1.8)
    a.path("M32 44 Q50 34 68 44", 3, 1.0, 0.5)
    a.path("M20 30 L12 24 M80 30 L88 24", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Orthopedic Horseshoe")
def _():
    a = Art()
    shoe(a, 50, 46, 28)
    a.path("M34 62 L66 62", 6, 2.0)
    a.path("M40 40 L60 40 L56 52 L44 52 Z", 6, 1.6)
    a.circle(50, 46, 2, 3, 1.0, 0.7)
    a.path("M24 74 L76 74", 3, 1.0, 0.45)
    a.path("M14 38 L8 34 M86 38 L92 34", 3, 1.0, 0.5)
    a.ground(90)
    return a
