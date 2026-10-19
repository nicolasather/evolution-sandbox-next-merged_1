"""Topic 17 - watercraft hulls (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("watercraft hulls")


def waves(a, y=78, x0=8, x1=92, z=3):
    a.path(f"M{x0} {y} Q{x0 + 10} {y - 4} {x0 + 20} {y} T{x0 + 40} {y} T{x0 + 60} {y} T{x1} {y}", z, 1.2, 0.55)


def side_hull(a, x0=14, x1=86, y=56, depth=14, z=0, w=2.2, sheer=5):
    """Side view of a boat hull: sheer line + keel curve."""
    a.path(f"M{x0} {y - sheer} Q{(x0 + x1) / 2} {y + 2} {x1} {y - sheer}", z, w)
    a.path(f"M{x0} {y - sheer} Q{x0 + 4} {y + depth} {x0 + 18} {y + depth} L{x1 - 18} {y + depth} Q{x1 - 4} {y + depth} {x1} {y - sheer}", z, w)


def planks(a, x0, x1, y, depth, count=3, z=3, clinker=False):
    for i in range(1, count + 1):
        yy = y + depth * i / (count + 1)
        inset = 8 + i * 3
        a.path(f"M{x0 + inset} {yy} Q{(x0 + x1) / 2} {yy + 4} {x1 - inset} {yy}", z, 1.2 if not clinker else 1.5, 0.7)


def paddle(a, x, y, z=6):
    a.line(x, y, x + 12, y - 22, z, 2.0)
    a.path(f"M{x} {y} L{x - 3} {y + 7} L{x + 4} {y + 6} Z", z, 1.4)


def ribs(a, x0, x1, y, depth, count=6, z=3, w=1.2):
    for i in range(count):
        x = x0 + 12 + (x1 - x0 - 24) * i / (count - 1)
        a.path(f"M{x} {y - 4} Q{x} {y + depth * 0.5} {x + (50 - x) * 0.1} {y + depth}", z, w, 0.8)


@item("Carved Watercraft Hull")
def _():
    a = Art()
    side_hull(a, 12, 88, 52, 20, 0, 2.4)
    a.ellipse(50, 48, 28, 5, 3, 1.2, 0.6)
    a.path("M30 58 Q50 66 70 58", 3, 1.0, 0.5)
    a.line(14, 40, 22, 30, 6, 1.6)
    a.path("M84 36 L92 26", 6, 1.6)
    waves(a, 82)
    a.ground(92)
    return a


@item("Dugout Canoe Hull")
def _():
    a = Art()
    side_hull(a, 10, 90, 54, 16, 0, 2.4, 6)
    a.ellipse(50, 50, 30, 4.6, 3, 1.4)
    a.path("M16 56 Q50 66 84 56", 3, 1.0, 0.5)
    a.line(14, 44, 10, 36, 6, 1.6)
    a.line(86, 44, 90, 36, 6, 1.6)
    paddle(a, 40, 54)
    waves(a, 82)
    a.ground(92)
    return a


@item("Outrigger Canoe Hull")
def _():
    a = Art()
    side_hull(a, 10, 88, 46, 14, 0, 2.4, 5)
    a.line(36, 44, 36, 66, 6, 2.0)
    a.line(62, 44, 62, 66, 6, 2.0)
    a.path("M24 68 Q50 62 76 68 Q50 76 24 68 Z", 0, 2.0)
    a.path("M12 34 L22 40", 3, 1.2, 0.6)
    waves(a, 82)
    a.ground(92)
    return a


@item("Double Outrigger Canoe")
def _():
    a = Art()
    a.path("M12 50 Q50 56 88 50 L82 60 Q50 66 18 60 Z", 0, 2.4)
    for x in (34, 66):
        a.line(x, 54, x - 14, 34, 6, 1.8)
        a.line(x, 56, x + 14, 76, 6, 1.8)
    a.path("M14 28 Q36 24 58 28 Q36 34 14 28 Z", 0, 1.8)
    a.path("M42 80 Q64 76 86 80 Q64 86 42 80 Z", 0, 1.8)
    a.ground(92)
    return a


@item("Decked Outrigger Canoe")
def _():
    a = Art()
    side_hull(a, 10, 88, 48, 14, 0, 2.4, 5)
    a.path("M26 44 L74 44 L70 36 L30 36 Z", 6, 1.8)
    a.line(40, 36, 40, 44, 3, 1.0, 0.6)
    a.line(52, 36, 52, 44, 3, 1.0, 0.6)
    a.line(60, 46, 60, 68, 6, 2.0)
    a.path("M40 70 Q60 64 82 70 Q60 78 40 70 Z", 0, 1.8)
    waves(a, 84)
    a.ground(92)
    return a


@item("Planked Boat Hull")
def _():
    a = Art()
    side_hull(a, 10, 90, 48, 22, 0, 2.4, 8)
    planks(a, 10, 90, 48, 22, 4, 3)
    a.line(10, 40, 6, 30, 6, 1.8)
    a.line(90, 40, 94, 30, 6, 1.8)
    waves(a, 82)
    a.ground(92)
    return a


@item("Clinker Built Hull")
def _():
    a = Art()
    side_hull(a, 10, 90, 48, 24, 0, 2.4, 8)
    for i in range(1, 5):
        y = 48 + i * 4.4
        a.path(f"M{12 + i * 3} {y} Q50 {y + 5} {88 - i * 3} {y}", 3, 1.6, 0.9)
        a.path(f"M{12 + i * 3} {y + 1.6} Q50 {y + 6.6} {88 - i * 3} {y + 1.6}", 3, 0.9, 0.4)
    a.line(10, 40, 6, 28, 6, 1.8)
    a.line(90, 40, 94, 28, 6, 1.8)
    waves(a, 84)
    a.ground(92)
    return a


@item("Carvel Built Hull")
def _():
    a = Art()
    side_hull(a, 10, 90, 48, 24, 0, 2.4, 8)
    for i in range(1, 5):
        y = 48 + i * 4.4
        a.path(f"M{12 + i * 3} {y} Q50 {y + 5} {88 - i * 3} {y}", 3, 1.1, 0.7)
    for x in range(22, 80, 12):
        a.line(x, 46, x + (50 - x) * 0.08, 70, 3, 0.9, 0.35)
    a.line(10, 40, 6, 28, 6, 1.8)
    a.line(90, 40, 94, 28, 6, 1.8)
    waves(a, 84)
    a.ground(92)
    return a


@item("Frame First Ship Hull")
def _():
    a = Art()
    side_hull(a, 10, 90, 44, 26, 0, 2.4, 6)
    ribs(a, 10, 90, 44, 26, 8, 6, 1.8)
    a.line(14, 70, 86, 70, 6, 2.2)
    a.path("M14 40 Q50 52 86 40", 3, 1.0, 0.5)
    for i in range(1, 3):
        a.path(f"M{20 + i * 4} {44 + i * 8} Q50 {52 + i * 8} {80 - i * 4} {44 + i * 8}", 3, 1.0, 0.4)
    waves(a, 86)
    a.ground(92)
    return a


@item("Flat Bottom Skiff")
def _():
    a = Art()
    a.path("M10 44 L90 44 L82 62 L20 62 Z", 0, 2.4)
    a.line(10, 44, 4, 38, 0, 2.0)
    a.line(90, 44, 96, 38, 0, 2.0)
    a.line(20, 62, 82, 62, 3, 1.4, 0.6)
    for x in range(26, 80, 14):
        a.line(x, 44, x - 1, 62, 3, 0.9, 0.45)
    a.line(36, 40, 64, 40, 6, 2.0)
    waves(a, 78)
    a.ground(90)
    return a


@item("Punt Boat")
def _():
    a = Art()
    a.path("M8 52 L30 42 L72 42 L92 52 L82 62 L18 62 Z", 0, 2.4)
    a.line(30, 42, 18, 62, 3, 1.0, 0.5)
    a.line(72, 42, 82, 62, 3, 1.0, 0.5)
    a.line(60, 46, 84, 16, 6, 2.2)
    a.line(84, 16, 84, 12, 6, 1.6)
    a.path("M40 52 L60 52", 3, 1.0, 0.45)
    waves(a, 78)
    a.ground(90)
    return a


@item("Canal Barge")
def _():
    a = Art()
    a.path("M8 46 L92 46 L88 66 L12 66 Z", 0, 2.4)
    a.rect(30, 34, 36, 12, 0, 2.2)
    a.line(36, 34, 36, 46, 3, 1.0, 0.5)
    a.line(48, 34, 48, 46, 3, 1.0, 0.5)
    a.line(60, 34, 60, 46, 3, 1.0, 0.5)
    a.path("M80 46 L84 34 L94 34", 6, 1.8)
    a.path("M8 28 L28 38", 3, 1.2, 0.6)
    waves(a, 80)
    a.ground(90)
    return a


@item("Motorized Canal Barge")
def _():
    a = Art()
    a.path("M8 46 L92 46 L88 66 L12 66 Z", 0, 2.4)
    a.rect(52, 30, 26, 16, 0, 2.2)
    a.rect(56, 34, 8, 6, 3, 1.0, 0.7)
    a.rect(66, 34, 8, 6, 3, 1.0, 0.7)
    a.rect(60, 22, 6, 8, 6, 1.8)
    a.path("M60 18 Q64 12 68 18", 3, 1.2, 0.55)
    a.circle(14, 70, 4, 6, 1.6)
    a.path("M12 68 L16 72 M16 68 L12 72", 3, 1.0, 0.7)
    a.line(18, 52, 44, 52, 3, 1.0, 0.4)
    waves(a, 82)
    a.ground(90)
    return a


@item("Skin Covered Frame")
def _():
    a = Art()
    a.path("M12 50 Q50 70 88 50", 0, 2.4)
    a.path("M12 50 Q50 40 88 50", 0, 2.4)
    for x in range(22, 82, 10):
        a.path(f"M{x} {46 + (50 - abs(x - 50)) * 0.1} Q{x + (50 - x) * 0.05} 56 {x + (50 - x) * 0.1} {58 + (50 - abs(x - 50)) * 0.15}", 3, 1.3, 0.8)
    a.path("M12 50 Q50 56 88 50", 3, 1.2, 0.6)
    a.path("M26 30 L74 30 L70 40 L30 40 Z", 6, 1.4, 0.7)
    a.ground(86)
    return a


@item("Skin Boat")
def _():
    a = Art()
    a.path("M10 48 Q50 74 90 48 Q50 40 10 48 Z", 0, 2.4)
    a.path("M16 52 Q50 66 84 52", 3, 1.2, 0.6)
    a.dots([(30, 52), (42, 58), (56, 58), (68, 52)], 1.1, 6)
    for (x, y) in ((24, 54), (50, 62), (76, 54)):
        a.line(x, y, x + 6, y + 2, 3, 1.0, 0.5)
    a.line(14, 46, 8, 40, 6, 1.6)
    waves(a, 82)
    a.ground(92)
    return a


@item("Decked Skin Boat")
def _():
    a = Art()
    a.path("M10 48 Q50 74 90 48 Q50 40 10 48 Z", 0, 2.4)
    a.path("M20 46 Q50 38 80 46 L76 50 Q50 44 24 50 Z", 6, 1.8)
    a.ellipse(50, 46, 8, 3, 6, 1.6)
    a.dots([(30, 56), (44, 62), (58, 62), (70, 56)], 1.1, 6)
    a.line(14, 46, 8, 40, 6, 1.6)
    waves(a, 82)
    a.ground(92)
    return a


@item("Sealed Kayak Hull")
def _():
    a = Art()
    a.path("M6 52 Q50 36 94 52 Q50 62 6 52 Z", 0, 2.4)
    a.ellipse(52, 47, 9, 3.6, 6, 1.8)
    a.path("M14 52 Q50 56 86 52", 3, 1.0, 0.5)
    a.line(52, 46, 52, 46, 6, 1.0)
    a.path("M34 36 L70 62", 6, 2.0)
    a.path("M30 34 L36 40 L32 42 Z", 6, 1.4)
    a.path("M70 62 L74 58 L76 64 Z", 6, 1.4)
    waves(a, 74)
    a.ground(88)
    return a


@item("Reed Bundle Hull")
def _():
    a = Art()
    a.path("M8 52 Q50 74 92 52 Q50 44 8 52 Z", 0, 2.4)
    for k in range(5):
        a.path(f"M{12 + k * 2} {52 + k * 2.6} Q50 {58 + k * 3} {88 - k * 2} {52 + k * 2.6}", 3, 1.1, 0.7)
    for x in (30, 50, 70):
        a.path(f"M{x - 2} 47 L{x + 2} 66", 6, 2.0)
    a.path("M8 52 Q4 44 8 38", 6, 1.8)
    a.path("M92 52 Q96 44 92 38", 6, 1.8)
    waves(a, 82)
    a.ground(92)
    return a


@item("Reed Bundle Canoe")
def _():
    a = Art()
    a.path("M10 54 Q50 70 90 54 Q50 46 10 54 Z", 0, 2.2)
    for k in range(3):
        a.path(f"M{14 + k * 2} {54 + k * 3} Q50 {60 + k * 3} {86 - k * 2} {54 + k * 3}", 3, 1.2, 0.7)
    a.line(38, 50, 38, 62, 6, 2.0)
    a.line(62, 50, 62, 62, 6, 2.0)
    paddle(a, 46, 56)
    a.path("M10 54 Q6 46 10 40", 6, 1.8)
    waves(a, 80)
    a.ground(90)
    return a


@item("Large Reed Boat")
def _():
    a = Art()
    a.path("M6 52 Q50 80 94 52 Q50 42 6 52 Z", 0, 2.4)
    for k in range(5):
        a.path(f"M{12 + k * 2} {52 + k * 3.4} Q50 {58 + k * 3.6} {88 - k * 2} {52 + k * 3.4}", 3, 1.1, 0.7)
    for x in (24, 40, 56, 72):
        a.path(f"M{x - 2} 47 L{x + 3} 70", 6, 1.8)
    a.path("M6 52 Q0 40 8 30 M94 52 Q100 40 92 30", 6, 2.0)
    a.rect(38, 40, 24, 8, 6, 1.6)
    waves(a, 86)
    a.ground(94)
    return a


@item("Rigged Reed Watercraft")
def _():
    a = Art()
    a.path("M8 60 Q50 84 92 60 Q50 52 8 60 Z", 0, 2.4)
    for k in range(3):
        a.path(f"M{14 + k * 2} {60 + k * 3.4} Q50 {66 + k * 3.6} {86 - k * 2} {60 + k * 3.4}", 3, 1.1, 0.7)
    a.line(50, 12, 50, 58, 0, 2.4)
    a.path("M50 14 L72 24 L50 50 Z", 0, 2.0)
    a.path("M50 14 L20 58 M50 14 L80 58", 3, 1.0, 0.6)
    a.path("M8 60 Q2 52 10 44", 6, 1.8)
    waves(a, 88)
    a.ground(94)
    return a


@item("Wooden Keel Timber")
def _():
    a = Art()
    a.path("M10 56 L18 46 L82 46 L90 56 L82 66 L18 66 Z", 0, 2.4)
    a.path("M18 56 L82 56", 3, 1.0, 0.5)
    a.path("M20 50 Q40 52 60 50 M30 62 Q50 60 70 62", 3, 1.0, 0.5)
    a.line(10, 56, 90, 56, 6, 1.4, 0.7)
    a.path("M14 74 L86 74", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Keel And Stem Assembly")
def _():
    a = Art()
    a.path("M10 70 L74 70 L74 64 L12 64 Z", 0, 2.4)
    a.path("M74 70 Q90 66 92 24 L86 24 Q84 56 70 64", 0, 2.4)
    a.line(62, 64, 62, 70, 6, 1.6)
    a.circle(72, 67, 1.6, 6, 1.2)
    a.circle(40, 67, 1.6, 6, 1.2)
    a.path("M16 58 L66 58", 3, 1.0, 0.5)
    a.path("M20 52 L20 64 M34 52 L34 64 M48 52 L48 64", 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Keelson Reinforced Hull")
def _():
    a = Art()
    side_hull(a, 10, 90, 40, 30, 0, 2.4, 4)
    a.line(18, 66, 82, 66, 6, 2.4)
    a.line(22, 58, 78, 58, 6, 2.4)
    ribs(a, 10, 90, 40, 30, 7, 3, 1.4)
    a.path("M30 52 L70 52", 3, 1.0, 0.45)
    waves(a, 86)
    a.ground(92)
    return a


@item("Ballasted Keel Hull")
def _():
    a = Art()
    side_hull(a, 10, 90, 40, 26, 0, 2.4, 4)
    a.path("M36 66 L64 66 L58 82 L42 82 Z", 6, 2.2)
    a.line(40, 72, 60, 72, 3, 1.0, 0.6)
    a.line(40, 78, 60, 78, 3, 1.0, 0.6)
    ribs(a, 10, 90, 40, 26, 6, 3, 1.2)
    waves(a, 88)
    a.ground(94)
    return a
