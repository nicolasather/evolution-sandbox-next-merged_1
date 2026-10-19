"""Topic 37 - chemistry instruments (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, flame, sparkle
from .registry import item, topic

topic("chemistry instruments")


def tube(a, cx, y0, y1, r=7, z=0, open_top=True):
    a.line(cx - r, y0, cx - r, y1 - r, z, 2.4)
    a.line(cx + r, y0, cx + r, y1 - r, z, 2.4)
    a.path(f"M{cx - r} {y1 - r} A{r} {r} 0 0 0 {cx + r} {y1 - r}", z, 2.4)
    if open_top:
        a.line(cx - r - 2, y0, cx + r + 2, y0, z, 2.0)


def liquid(a, cx, y, r, z=3):
    a.path(f"M{cx - r + 1} {y} Q{cx - r / 2} {y - 1.6} {cx} {y} T{cx + r - 1} {y}", z, 1.1, 0.7)


def ticks(a, x, y0, y1, cnt=6, side=1, ln=3):
    for i in range(cnt):
        yy = y0 + (y1 - y0) * i / max(1, cnt - 1)
        a.line(x, yy, x + side * (ln if i % 2 == 0 else ln * 0.6), yy, 3, 1.0, 0.7)


def flask_conical(a, cx, y0, y1, nr=6, br=22, z=0):
    a.path(f"M{cx - nr} {y0} L{cx - nr} {y0 + 12} L{cx - br} {y1} L{cx + br} {y1} L{cx + nr} {y0 + 12} L{cx + nr} {y0}", z, 2.4)
    a.line(cx - nr - 2, y0, cx + nr + 2, y0, z, 2.0)


def jacket(a, x0, x1, cy, r=6, z=0):
    a.line(x0, cy - r, x1, cy - r, z, 2.4)
    a.line(x0, cy + r, x1, cy + r, z, 2.4)
    a.line(x0, cy - r, x0, cy + r, z, 2.0)
    a.line(x1, cy - r, x1, cy + r, z, 2.0)


def crucible(a, cx, y, rt=18, rb=11, h=28, z=0):
    a.path(f"M{cx - rt} {y} L{cx - rb} {y + h} L{cx + rb} {y + h} L{cx + rt} {y} Z", z, 2.6)
    a.ellipse(cx, y, rt, 4, z, 2.2)


@item("Laboratory Glassware Batch")
def _():
    a = Art()
    tube(a, 20, 24, 70, 5, 0)
    tube(a, 34, 24, 70, 5, 0)
    flask_conical(a, 62, 24, 74, 5, 18, 0)
    a.circle(84, 62, 10, 0, 2.2)
    a.line(84, 40, 84, 52, 0, 2.2)
    a.ground(88)
    return a


@item("Glass Test Tube")
def _():
    a = Art()
    tube(a, 50, 16, 84, 9, 0)
    liquid(a, 50, 56, 9)
    a.path("M44 22 L44 50", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Graduated Test Tube")
def _():
    a = Art()
    tube(a, 50, 16, 84, 9, 0)
    ticks(a, 59, 30, 70, 9, -1, 5)
    liquid(a, 50, 50, 9)
    a.ground(90)
    return a


@item("Culture Test Tube")
def _():
    a = Art()
    tube(a, 50, 22, 84, 9, 0)
    a.rect(41, 14, 18, 10, 6, 1.8)
    a.dots([(46, 66), (52, 70), (49, 62), (54, 64)], 1.2, 3, 0.8)
    a.path("M42 52 L58 58", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Sealed Reaction Tube")
def _():
    a = Art()
    tube(a, 50, 28, 84, 9, 0, False)
    a.path("M41 28 Q50 12 59 28", 0, 2.4)
    a.line(50, 12, 50, 18, 0, 1.6)
    liquid(a, 50, 62, 9)
    droplet(a, 50, 70, 3, 3, 1.1, 0.8)
    a.ground(90)
    return a


@item("Glass Flask Blank")
def _():
    a = Art()
    a.circle(50, 60, 22, 0, 2.6)
    a.path("M44 40 L44 18 M56 40 L56 18", 0, 2.4)
    a.line(40, 18, 60, 18, 0, 2.0)
    a.path("M34 54 Q38 46 46 44", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Conical Laboratory Flask")
def _():
    a = Art()
    flask_conical(a, 50, 16, 80, 6, 26, 0)
    liquid(a, 50, 62, 18)
    a.path("M40 62 L36 70", 3, 1.0, 0.5)
    ticks(a, 36, 50, 70, 3, 1, 3)
    a.ground(88)
    return a


@item("Vacuum Filter Flask")
def _():
    a = Art()
    flask_conical(a, 46, 22, 84, 6, 24, 0)
    a.path("M52 34 L74 34 L74 44", 0, 2.4)
    a.path("M26 20 L66 20 L56 12 L36 12 Z", 0, 2.0)
    a.line(74, 44, 86, 44, 0, 2.2)
    a.circle(82, 24, 8, 6, 1.6)
    a.path("M74 44 L74 56", 3, 1.2, 0.7)
    a.ground(90)
    return a


@item("Round Bottom Reaction Flask")
def _():
    a = Art()
    a.circle(50, 62, 22, 0, 2.6)
    a.path("M44 42 L44 18 M56 42 L56 18", 0, 2.4)
    a.rect(42, 14, 16, 4, 0, 2.0)
    liquid(a, 50, 66, 18)
    a.path("M24 84 Q50 94 76 84", 0, 2.4)
    a.path("M30 56 Q34 50 40 48", 3, 1.2, 0.6)
    return a


@item("Simple Condenser Tube")
def _():
    a = Art()
    a.path("M12 28 L88 62", 0, 2.4)
    a.path("M12 38 L84 70", 0, 2.4)
    a.path("M14 28 L10 38", 0, 2.0)
    a.line(88, 62, 84, 70, 0, 2.0)
    droplet(a, 84, 76, 3, 3, 1.1, 0.8)
    a.path("M30 40 L70 58", 3, 1.0, 0.5)
    return a


@item("Liebig Condenser")
def _():
    a = Art()
    jacket(a, 16, 78, 44, 11, 0)
    a.line(14, 44, 86, 44, 6, 2.0)
    a.path("M30 33 L30 20 L38 20 M62 55 L62 70 L70 70", 0, 2.2)
    arrow(a, 40, 24, 30, 24, 3, 1.2, 0.8)
    a.path("M16 44 L10 46", 0, 2.0)
    a.ground(86)
    return a


@item("Allihn Condenser")
def _():
    a = Art()
    jacket(a, 14, 80, 40, 10, 0)
    for i in range(5):
        a.circle(24 + i * 11, 40, 5.6, 6, 1.8)
    a.path("M30 30 L30 18 M66 50 L66 62", 0, 2.2)
    a.line(8, 40, 94, 40, 3, 1.0, 0.4)
    a.ground(84)
    return a


@item("Fractionating Condenser")
def _():
    a = Art()
    a.rect(38, 10, 24, 70, 0, 2.6)
    for y in (22, 34, 46, 58, 70):
        a.path(f"M38 {y} L50 {y - 4} L62 {y}", 6, 1.8)
    a.path("M62 56 L82 56 L82 70", 0, 2.2)
    a.path("M38 28 L22 28 L22 40", 0, 2.2)
    a.ground(88)
    return a


@item("Clay Crucible")
def _():
    a = Art()
    crucible(a, 50, 38, 22, 12, 36, 0)
    a.dots([(38, 52), (46, 60), (58, 54), (52, 66)], 1.4, 3, 0.8)
    a.path("M34 44 L42 70", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Porcelain Crucible")
def _():
    a = Art()
    crucible(a, 50, 34, 20, 11, 34, 0)
    a.path("M36 34 Q50 40 64 34", 3, 1.4, 0.8)
    a.ellipse(50, 34, 12, 2, 3, 1.1, 0.6)
    a.path("M40 56 L60 56", 3, 1.0, 0.5)
    a.rect(30, 24, 40, 5, 6, 1.6)
    a.ground(88)
    return a


@item("Quartz Crucible")
def _():
    a = Art()
    crucible(a, 50, 28, 24, 18, 44, 0)
    a.ellipse(50, 28, 15, 2.4, 3, 1.1, 0.6)
    a.path("M34 40 L40 60 M62 40 L58 60", 3, 1.2, 0.6)
    sparkle(a, 66, 34, 3, 6, 0.9)
    a.ground(88)
    return a


@item("High Alumina Crucible")
def _():
    a = Art()
    crucible(a, 50, 24, 22, 20, 52, 0)
    a.line(28, 40, 72, 40, 3, 1.0, 0.55)
    a.line(30, 56, 70, 56, 3, 1.0, 0.55)
    a.dots([(42, 48), (58, 48), (50, 64), (46, 70), (56, 70)], 1.2, 3, 0.8)
    a.ground(88)
    return a


@item("Graduated Pipette Tube")
def _():
    a = Art()
    a.line(50, 10, 50, 22, 0, 2.2)
    a.rect(44, 22, 12, 50, 0, 2.4)
    a.path("M44 72 L50 86 L56 72", 0, 2.4)
    ticks(a, 56, 28, 66, 10, 1, 4)
    a.path("M46 40 L54 40", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Volumetric Pipette")
def _():
    a = Art()
    a.line(50, 8, 50, 28, 0, 2.2)
    a.ellipse(50, 48, 11, 16, 0, 2.6)
    a.line(50, 64, 50, 76, 0, 2.2)
    a.path("M46 76 L50 88 L54 76", 0, 2.2)
    a.line(44, 24, 56, 24, 3, 1.4, 0.8)
    a.path("M42 44 Q44 36 50 34", 3, 1.2, 0.6)
    return a


@item("Micropipette")
def _():
    a = Art()
    a.rect(42, 10, 16, 10, 0, 2.4, None, 3)
    a.path("M40 20 L60 20 L58 58 L42 58 Z", 0, 2.6)
    a.rect(46, 24, 8, 12, 6, 1.6)
    a.line(50, 58, 50, 72, 0, 2.4)
    a.path("M46 72 L50 88 L54 72", 0, 2.2)
    a.line(60, 30, 70, 30, 3, 1.2, 0.7)
    return a


@item("Adjustable Volume Micropipette")
def _():
    a = Art()
    a.rect(40, 8, 20, 12, 0, 2.4, None, 3)
    a.path("M38 20 L62 20 L58 60 L42 60 Z", 0, 2.6)
    a.rect(44, 26, 12, 14, 6, 1.6)
    a.path("M47 30 L53 30 M47 34 L53 34", 3, 1.0, 0.8)
    a.path("M62 34 L72 34 L72 44", 0, 2.0)
    a.line(50, 60, 50, 74, 0, 2.4)
    a.path("M46 74 L50 88 L54 74", 0, 2.2)
    return a


@item("Laboratory Burner Stand")
def _():
    a = Art()
    a.line(26, 84, 26, 16, 0, 2.6)
    a.line(14, 84, 86, 84, 0, 2.6)
    a.circle(50, 38, 14, 0, 2.4)
    a.line(26, 38, 36, 38, 0, 2.2)
    a.path("M40 52 L40 74 M60 52 L60 74", 0, 2.2)
    flame(a, 50, 72, 8, 3, 1.3)
    a.path("M44 72 L56 72", 3, 1.4, 0.8)
    return a


@item("Spirit Burner")
def _():
    a = Art()
    a.path("M32 56 Q26 76 40 82 L60 82 Q74 76 68 56 Z", 0, 2.6)
    a.rect(44, 40, 12, 16, 0, 2.2)
    a.line(50, 40, 50, 34, 0, 2.0)
    flame(a, 50, 34, 10, 6, 1.6)
    a.path("M34 66 L66 66", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Bunsen Burner")
def _():
    a = Art()
    a.rect(44, 18, 12, 42, 0, 2.6)
    a.path("M36 84 L64 84 L58 62 L42 62 Z", 0, 2.4)
    a.circle(50, 56, 3, 6, 1.4)
    a.path("M56 70 L74 70 L74 80", 0, 2.2)
    flame(a, 50, 14, 11, 6, 1.6)
    a.line(48, 36, 52, 36, 3, 1.4, 0.7)
    a.ground(90)
    return a


@item("Gas Controlled Laboratory Burner")
def _():
    a = Art()
    a.rect(44, 16, 12, 36, 0, 2.6)
    a.path("M30 84 L70 84 L62 56 L38 56 Z", 0, 2.4)
    a.circle(66, 66, 5, 6, 1.8)
    a.line(66, 66, 69, 62, 6, 1.4)
    a.path("M70 70 L86 70", 0, 2.2)
    a.path("M44 38 L56 38", 3, 1.4, 0.7)
    flame(a, 50, 12, 10, 6, 1.6)
    a.path("M50 56 L50 62", 3, 1.2, 0.7)
    a.ground(90)
    return a
