"""Topic 21 - copper fabrication (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .registry import item, topic

topic("copper fabrication")


def hammer(a, x, y, ang=-40, z=6, L=26):
    t = math.radians(ang)
    ex, ey = x + L * math.cos(t), y + L * math.sin(t)
    a.line(x, y, ex, ey, z, 2.4)
    px, py = -math.sin(t), math.cos(t)
    a.path(f"M{n(ex + px * 6)} {n(ey + py * 6)} L{n(ex - px * 6)} {n(ey - py * 6)} L{n(ex - px * 6 + math.cos(t) * 7)} {n(ey - py * 6 + math.sin(t) * 7)} L{n(ex + px * 6 + math.cos(t) * 7)} {n(ey + py * 6 + math.sin(t) * 7)} Z", z, 1.8)


def sheet(a, x, y, w=54, h=34, dz=7, z=0, wd=2.2):
    a.path(f"M{x} {y + dz} L{x + w - dz} {y + dz} L{x + w} {y} L{x + dz} {y} Z", z, wd)
    a.path(f"M{x} {y + dz} L{x} {y + dz + 4} L{x + w - dz} {y + dz + 4} L{x + w - dz} {y + dz} M{x + w - dz} {y + dz + 4} L{x + w} {y + 4} L{x + w} {y}", z, wd)


def anvil(a, cx, y, w=34, z=0):
    a.path(f"M{cx - w / 2} {y} L{cx + w / 2 + 6} {y} L{cx + w / 2} {y + 6} L{cx + 6} {y + 6} L{cx + 8} {y + 16} L{cx - 8} {y + 16} L{cx - 6} {y + 6} L{cx - w / 2} {y + 6} Z", z, 2.2)


def coil(a, cx, cy, rx, ry, turns=4, z=0, w=2.0):
    for k in range(turns):
        a.ellipse(cx, cy + k * 5, rx, ry, z, w, None if k == 0 else 0.9)


def tube(a, x0, x1, cy, r, z=0, w=2.2):
    a.line(x0, cy - r, x1, cy - r, z, w)
    a.line(x0, cy + r, x1, cy + r, z, w)
    a.ellipse(x1, cy, r * 0.4, r, z, w)
    a.ellipse(x0, cy, r * 0.4, r, z, w, 0.6)


def bowl(a, cx, y, rx, h, z=0, w=2.2):
    a.ellipse(cx, y, rx, rx * 0.28, z, w)
    a.path(f"M{cx - rx} {y} Q{cx - rx * 0.9} {y + h} {cx} {y + h + 3} Q{cx + rx * 0.9} {y + h} {cx + rx} {y}", z, w)


def shine(a, pts):
    for (x, y) in pts:
        sparkle(a, x, y, 2.4, 6, 0.8)


@item("Worked Copper Stock")
def _():
    a = Art()
    a.path("M12 58 L44 58 L50 50 L18 50 Z", 0, 2.2)
    a.path("M12 58 L12 64 L44 64 L44 58 M44 64 L50 56 L50 50", 0, 2.2)
    a.circle(70, 54, 10, 0, 2.2)
    a.circle(70, 54, 4, 3, 1.0, 0.6)
    a.path("M20 76 L80 76 L84 70 L24 70 Z", 0, 1.8)
    shine(a, [(24, 36), (76, 32)])
    a.ground(88)
    return a


@item("Copper Sheet Blank")
def _():
    a = Art()
    sheet(a, 16, 36, 66, 30, 12, 0, 2.2)
    a.line(24, 44, 64, 44, 3, 1.0, 0.5)
    a.path("M20 76 L80 76", 3, 1.0, 0.4)
    shine(a, [(70, 28)])
    a.ground(86)
    return a


@item("Hammered Copper Sheet")
def _():
    a = Art()
    sheet(a, 12, 46, 60, 28, 10, 0, 2.2)
    a.dots([(28, 52), (38, 56), (48, 52), (58, 56), (34, 62), (46, 60)], 1.1, 3)
    hammer(a, 70, 48, -50, 6, 22)
    a.path("M70 30 L66 24 M76 32 L80 26", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("Annealed Copper Sheet")
def _():
    a = Art()
    sheet(a, 12, 40, 60, 28, 10, 0, 2.2)
    for x in (26, 40, 54):
        a.path(f"M{x} 82 Q{x + 5} 74 {x} 68", 3, 1.4, 0.7)
    a.path("M14 84 L70 84", 6, 2.0)
    a.line(14, 78, 14, 84, 6, 1.6)
    a.line(70, 78, 70, 84, 6, 1.6)
    a.path("M78 30 Q82 22 86 30 Q82 36 78 30", 6, 1.4)
    a.path("M20 50 Q42 46 62 52", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Repousse Copper Panel")
def _():
    a = Art()
    a.rect(18, 20, 64, 52, 0, 2.4)
    a.circle(50, 46, 14, 6, 1.8)
    a.circle(50, 46, 8, 3, 1.2, 0.7)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.path(f"M{n(50 + 14 * math.cos(t))} {n(46 + 14 * math.sin(t))} Q{n(50 + 20 * math.cos(t + 0.3))} {n(46 + 20 * math.sin(t + 0.3))} {n(50 + 22 * math.cos(t))} {n(46 + 22 * math.sin(t))}", 3, 1.2, 0.7)
    a.path("M22 24 L28 24 M72 68 L78 68", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("Copper Rod Blank")
def _():
    a = Art()
    tube(a, 12, 88, 40, 5, 0)
    tube(a, 20, 80, 62, 3.4, 0)
    a.line(12, 40, 88, 40, 3, 1.0, 0.45)
    shine(a, [(50, 26), (30, 74)])
    a.ground(86)
    return a


@item("Drawn Copper Rod")
def _():
    a = Art()
    a.path("M10 36 L40 44 L40 56 L10 64 Z", 0, 2.2)
    a.rect(38, 38, 12, 24, 6, 2.4)
    a.circle(44, 50, 3, 3, 1.4)
    tube(a, 50, 90, 50, 3.4, 0)
    arrow(a, 56, 66, 80, 66, 3, 1.3, 0.7, 3)
    a.ground(86)
    return a


@item("Copper Wire Coil")
def _():
    a = Art()
    coil(a, 50, 34, 28, 8, 6, 0, 2.0)
    a.path("M22 34 L22 64 M78 34 L78 64", 0, 2.0)
    a.path("M78 64 Q80 74 90 72", 0, 1.6)
    a.path("M22 64 Q50 74 78 64", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Insulated Copper Winding")
def _():
    a = Art()
    a.rect(30, 18, 40, 54, 0, 2.4)
    for y in range(24, 68, 5):
        a.path(f"M30 {y} Q50 {y + 4} 70 {y}", 3, 1.6, 0.9)
        a.path(f"M30 {y + 1.8} Q50 {y + 5.8} 70 {y + 1.8}", 3, 0.8, 0.4)
    a.path("M70 22 Q84 22 86 34", 6, 1.6)
    a.path("M30 66 Q16 66 14 76", 6, 1.6)
    a.circle(86, 36, 2, 6, 1.2)
    a.circle(14, 78, 2, 6, 1.2)
    a.ground(88)
    return a


@item("Copper Nail Blank")
def _():
    a = Art()
    a.line(20, 70, 44, 24, 0, 2.6)
    a.line(36, 70, 60, 24, 0, 2.6)
    a.line(52, 70, 76, 24, 0, 2.6)
    a.path("M16 74 L30 74 L28 70", 3, 1.2, 0.6)
    shine(a, [(70, 56)])
    a.path("M12 80 L88 80", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Hammered Copper Nail")
def _():
    a = Art()
    a.line(36, 78, 36, 38, 0, 2.6)
    a.ellipse(36, 34, 8, 3, 0, 2.4)
    a.line(28, 34, 28, 38, 0, 2.0)
    a.line(44, 34, 44, 38, 0, 2.0)
    a.line(36, 78, 33, 84, 0, 1.4)
    hammer(a, 70, 52, -140, 6, 24)
    a.path("M50 22 L46 16 M58 20 L60 14", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Copper Rivet Set")
def _():
    a = Art()
    for x in (22, 44, 66):
        a.ellipse(x, 40, 7, 3, 0, 2.0)
        a.path(f"M{x - 7} 40 Q{x - 7} 36 {x} 34 Q{x + 7} 36 {x + 7} 40", 0, 2.0)
        a.line(x, 44, x, 66, 0, 2.2)
    a.path("M14 72 L82 72", 3, 1.2, 0.6)
    a.rect(14, 72, 68, 6, 6, 1.6)
    a.ground(88)
    return a


@item("Flush Copper Rivet")
def _():
    a = Art()
    a.rect(14, 44, 72, 14, 0, 2.4)
    a.rect(14, 58, 72, 14, 0, 2.4)
    for x in (30, 50, 70):
        a.circle(x, 58, 4, 6, 1.8)
        a.circle(x, 58, 1.4, 3, 1.0, 0.7)
    a.path("M14 58 L86 58", 3, 1.0, 0.5)
    a.path("M22 30 L36 30 M46 30 L60 30", 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Copper Bowl Blank")
def _():
    a = Art()
    a.circle(50, 48, 28, 0, 2.4)
    a.circle(50, 48, 20, 3, 1.0, 0.5)
    a.dots([(50, 48)], 1.6, 6)
    a.path("M26 48 L74 48 M50 24 L50 72", 3, 1.0, 0.4)
    shine(a, [(76, 22)])
    a.ground(86)
    return a


@item("Raised Copper Bowl")
def _():
    a = Art()
    bowl(a, 40, 40, 26, 26, 0, 2.4)
    a.path("M20 48 Q40 56 60 48", 3, 1.0, 0.5)
    hammer(a, 80, 30, -140, 6, 22)
    anvil(a, 70, 66, 26, 0)
    a.dots([(32, 46), (44, 50), (38, 56)], 1.0, 3)
    a.ground(90)
    return a


@item("Planished Copper Bowl")
def _():
    a = Art()
    bowl(a, 50, 34, 34, 34, 0, 2.4)
    for (x, y) in ((34, 50), (46, 56), (58, 54), (68, 48), (40, 62), (54, 64)):
        a.circle(x, y, 2.4, 3, 1.0, 0.6)
    a.ellipse(50, 35, 26, 6, 3, 1.0, 0.5)
    shine(a, [(24, 26), (78, 26)])
    a.ground(90)
    return a


@item("Spun Copper Vessel")
def _():
    a = Art()
    a.path("M34 24 Q28 44 36 62 Q50 72 64 62 Q72 44 66 24", 0, 2.4)
    a.ellipse(50, 24, 16, 4.6, 0, 2.2)
    for y in (34, 44, 54):
        a.path(f"M{34 - (50 - y) * 0.02} {y} Q50 {y + 4} {66} {y}", 3, 1.0, 0.5)
    a.path("M76 26 A14 14 0 0 1 82 44", 6, 1.4)
    arrow(a, 82, 44, 78, 52, 3, 1.4, 0.8, 3)
    a.line(12, 40, 28, 40, 6, 2.0)
    a.line(12, 40, 12, 66, 6, 2.0)
    a.ground(86)
    return a


@item("Copper Tube Blank")
def _():
    a = Art()
    a.path("M14 36 L60 36 L72 28 L26 28 Z", 0, 2.2)
    a.path("M14 36 L14 40 L60 40 L60 36 M60 40 L72 32 L72 28", 0, 2.2)
    a.line(16, 64, 80, 64, 0, 2.4)
    a.line(16, 74, 80, 74, 0, 2.4)
    a.ellipse(80, 69, 3, 5, 0, 2.2)
    a.ellipse(16, 69, 3, 5, 0, 1.6, 0.6)
    arrow(a, 40, 50, 40, 58, 3, 1.3, 0.7, 3)
    a.ground(88)
    return a


@item("Rolled Copper Tube")
def _():
    a = Art()
    tube(a, 14, 82, 44, 11, 0, 2.4)
    a.path("M20 40 L82 40", 3, 1.0, 0.4)
    a.line(14, 55, 82, 55, 6, 1.4, 0.8)
    a.ellipse(82, 44, 4.4, 11, 0, 2.2)
    a.ellipse(82, 44, 2, 6, 3, 1.0, 0.6)
    a.path("M10 74 L90 74", 3, 1.0, 0.45)
    a.circle(30, 74, 4, 6, 1.4)
    a.circle(60, 74, 4, 6, 1.4)
    a.ground(88)
    return a


@item("Brazed Copper Tube")
def _():
    a = Art()
    tube(a, 12, 44, 46, 7, 0, 2.2)
    tube(a, 50, 88, 46, 7, 0, 2.2)
    a.rect(42, 36, 12, 20, 6, 2.0)
    a.path("M30 66 Q34 58 38 66 Q34 72 30 66", 6, 1.4)
    a.path("M26 74 L42 74", 3, 1.2, 0.6)
    a.path("M62 22 L72 14 M66 26 L78 20", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("Seamless Copper Tube")
def _():
    a = Art()
    tube(a, 12, 88, 46, 10, 0, 2.4)
    a.ellipse(88, 46, 4, 10, 0, 2.2)
    a.ellipse(88, 46, 2, 6, 3, 1.0, 0.6)
    shine(a, [(40, 28), (64, 66)])
    a.path("M10 76 L90 76", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Copper Foil Sheet")
def _():
    a = Art()
    a.path("M14 60 Q30 36 50 52 Q70 68 86 36 L86 60 Q70 80 50 68 Q30 52 14 76 Z", 0, 2.2)
    a.path("M20 62 Q32 44 48 56", 3, 1.0, 0.5)
    a.path("M86 36 L92 32", 6, 1.4)
    shine(a, [(26, 30), (74, 24)])
    a.ground(88)
    return a


@item("Thin Copper Foil")
def _():
    a = Art()
    a.path("M16 40 L70 40 L84 28 L30 28 Z", 0, 1.8)
    a.line(16, 40, 16, 42, 0, 1.4)
    a.line(70, 40, 70, 42, 0, 1.4)
    a.line(16, 42, 70, 42, 0, 1.4)
    a.line(70, 42, 84, 30, 0, 1.4)
    a.path("M20 60 Q40 54 60 62 T90 60", 6, 1.8)
    a.path("M20 68 Q40 62 60 70 T90 68", 3, 0.9, 0.5)
    a.path("M70 20 L80 12 M78 24 L90 16", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Patterned Copper Foil")
def _():
    a = Art()
    a.rect(14, 22, 72, 52, 0, 2.2)
    for r in range(3):
        for c in range(4):
            x, y = 26 + c * 16, 34 + r * 14
            a.path(f"M{x} {y - 5} L{x + 5} {y} L{x} {y + 5} L{x - 5} {y} Z", 3, 1.3, 0.85)
    a.path("M18 28 L82 28", 3, 1.0, 0.45)
    a.ground(86)
    return a


@item("Printed Circuit Copper Trace")
def _():
    a = Art()
    a.rect(14, 20, 72, 56, 0, 2.4)
    a.path("M24 32 L44 32 L44 48 L68 48", 6, 2.0)
    a.path("M24 62 L52 62 L52 40 L76 40", 6, 2.0)
    a.path("M30 44 L30 54 L40 54", 6, 1.6)
    for (x, y) in ((24, 32), (68, 48), (24, 62), (76, 40), (30, 44)):
        a.circle(x, y, 2.6, 6, 1.6)
        a.circle(x, y, 0.9, 3, 0.9, 0.7)
    a.rect(58, 56, 18, 10, 3, 1.4, 0.7)
    a.ground(88)
    return a
