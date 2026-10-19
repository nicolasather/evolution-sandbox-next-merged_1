"""Topic 11 - cereal cultivation (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .kit_textile import weave_grid
from .registry import item, topic

topic("cereal cultivation")


def ear(a, x, y, h=30, z=0, w=1.5, grains=5, lean=0.0):
    a.path(f"M{n(x)} {n(y + h)} Q{n(x + lean * h * 0.5)} {n(y + h * 0.5)} {n(x + lean * h)} {n(y + 8)}", z, w)
    for k in range(grains):
        yy = y + 2 + k * 3.6
        xx = x + lean * h * (1 - (yy - y) / h) * 0.4
        a.path(f"M{n(xx)} {n(yy + 3)} Q{n(xx - 3.4)} {n(yy)} {n(xx - 1)} {n(yy - 3)}", z, 1.2)
        a.path(f"M{n(xx)} {n(yy + 3)} Q{n(xx + 3.4)} {n(yy)} {n(xx + 1)} {n(yy - 3)}", z, 1.2)
    a.line(x + lean * h, y + 8, x + lean * h * 1.1, y - 2, z, 1.0, 0.6)


def seed(a, x, y, s=3, z=3, w=1.2):
    a.ellipse(x, y, s * 0.55, s, z, w, None, 20)


def furrows(a, y0, rows=4, x0=10, x1=90, z=0, w=1.8, drop=7):
    for i in range(rows):
        y = y0 + i * drop
        a.path(f"M{x0} {y} Q{(x0 + x1) / 2} {y - 4} {x1} {y}", z, w, None if i % 2 == 0 else 0.7)


def sack(a, cx, top, w=34, h=36, z=0, wd=2.0):
    a.path(f"M{n(cx - w / 2)} {n(top)} Q{n(cx - w / 2 - 4)} {n(top + h * 0.6)} {n(cx - w / 2)} {n(top + h)} L{n(cx + w / 2)} {n(top + h)} Q{n(cx + w / 2 + 4)} {n(top + h * 0.6)} {n(cx + w / 2)} {n(top)} Z", z, wd)
    a.path(f"M{n(cx - w / 2)} {n(top + 6)} Q{n(cx)} {n(top + 12)} {n(cx + w / 2)} {n(top + 6)}", 3, 1.2, 0.7)


@item("Selected Cereal Seed")
def _():
    a = Art()
    ear(a, 30, 18, 44, 0, 1.8, 7)
    for (x, y) in ((54, 54), (62, 48), (70, 56), (58, 64), (68, 68), (78, 60)):
        seed(a, x, y, 4.4, 0, 1.5)
        a.line(x, y - 3, x, y + 3, 3, 0.8, 0.5)
    a.path("M46 78 L88 78", 6, 1.4)
    a.ground(88)
    return a


@item("Seed Bed Furrow")
def _():
    a = Art()
    furrows(a, 40, 5, 10, 90, 0, 2.0, 9)
    for i in range(5):
        y = 40 + i * 9
        a.path(f"M10 {y + 4} Q50 {y} 90 {y + 4}", 3, 1.0, 0.45)
    a.path("M70 14 L84 30 L80 34 L66 18 Z", 6, 1.6)
    a.ground(92)
    return a


@item("Hand Sown Cereal Row")
def _():
    a = Art()
    furrows(a, 56, 3, 10, 90, 0, 2.0, 10)
    for i in range(3):
        y = 56 + i * 10
        for x in range(18, 86, 9):
            seed(a, x, y - 2, 2.2, 3, 1.1)
    a.path("M14 34 Q28 26 40 34 Q34 40 22 38 Z", 6, 1.5)
    a.path("M44 30 L60 34 M46 38 L64 40", 3, 1.2, 0.6)
    a.dots([(50, 44), (58, 46), (66, 48)], 1.0, 6)
    a.ground(92)
    return a


@item("Seed Drill Row")
def _():
    a = Art()
    a.rect(30, 14, 30, 18, 0, 2.0)
    a.path("M40 32 L36 56 M50 32 L54 56", 0, 1.8)
    a.circle(24, 62, 8, 0, 2.0)
    a.circle(24, 62, 2, 6, 1.4)
    a.line(24, 62, 40, 56, 3, 1.2, 0.7)
    furrows(a, 72, 2, 12, 88, 0, 1.8, 8)
    for x in range(18, 86, 8):
        seed(a, x, 70, 2, 3, 1.0)
    a.line(60, 24, 88, 18, 6, 2.0)
    a.ground(92)
    return a


@item("Mechanized Row Seeding")
def _():
    a = Art()
    a.rect(34, 18, 40, 22, 0, 2.2)
    a.line(34, 26, 74, 26, 3, 1.0, 0.5)
    for x in (42, 54, 66):
        a.path(f"M{x} 40 L{x} 58", 0, 1.6)
        seed(a, x, 62, 2.4, 6, 1.2)
    a.circle(30, 66, 11, 0, 2.2)
    a.circle(74, 66, 11, 0, 2.2)
    a.circle(30, 66, 3, 6, 1.4)
    a.circle(74, 66, 3, 6, 1.4)
    a.line(30, 66, 74, 66, 3, 1.0, 0.4)
    a.path("M74 30 L90 22 L92 28", 6, 1.8)
    a.ground(90)
    return a


@item("Threshing Floor")
def _():
    a = Art()
    a.ellipse(50, 56, 38, 14, 0, 2.2)
    a.ellipse(50, 56, 26, 8, 3, 1.0, 0.5)
    for k in range(9):
        t = 2 * math.pi * k / 9
        a.line(50 + 12 * math.cos(t), 56 + 4 * math.sin(t), 50 + 26 * math.cos(t), 56 + 8 * math.sin(t), 3, 1.0, 0.55)
    a.path("M36 46 L44 40 L50 50 L56 40 L64 46", 6, 1.6)
    a.dots([(30, 58), (70, 60), (46, 64)], 1.1, 6)
    a.ground(86)
    return a


@item("Hand Flail Threshing")
def _():
    a = Art()
    a.line(20, 80, 56, 22, 0, 2.4)
    a.path("M56 22 C62 14 72 16 70 24 C68 30 60 28 56 22", 6, 1.8)
    a.line(70, 24, 84, 40, 6, 3.0)
    for (x, y) in ((62, 72), (72, 74), (80, 70), (68, 80)):
        seed(a, x, y, 2.6, 3, 1.2)
    a.path("M12 84 L90 84", 3, 1.0, 0.5)
    ear(a, 32, 56, 22, 6, 1.4, 3)
    a.ground(90)
    return a


@item("Winnowing Basket")
def _():
    a = Art()
    a.path("M16 54 Q16 30 50 30 Q84 30 84 54 Q84 64 74 64 L26 64 Q16 64 16 54 Z", 0, 2.2)
    a.path("M16 54 Q50 70 84 54", 3, 1.4, 0.8)
    for x in range(26, 78, 8):
        a.line(x, 36, x, 60, 3, 0.9, 0.5)
    for (x, y) in ((34, 18), (46, 12), (58, 18), (68, 12)):
        seed(a, x, y, 2.4, 6, 1.2)
    a.path("M78 30 Q88 24 94 28 M80 38 Q90 34 96 38", 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Mechanical Grain Thresher")
def _():
    a = Art()
    a.path("M16 34 L84 34 L78 74 L22 74 Z", 0, 2.2)
    a.circle(44, 54, 14, 0, 2.0)
    for k in range(8):
        t = 2 * math.pi * k / 8
        a.line(44 + 10 * math.cos(t), 54 + 10 * math.sin(t), 44 + 14 * math.cos(t), 54 + 14 * math.sin(t), 3, 1.6)
    a.circle(44, 54, 3, 6, 1.4)
    a.path("M16 34 L28 18 L72 18 L84 34", 0, 2.0)
    a.line(60, 74, 60, 84, 6, 1.6)
    a.dots([(66, 82), (72, 84), (78, 82)], 1.2, 6)
    a.line(84, 50, 92, 50, 6, 2.0)
    a.ground(90)
    return a


@item("Grain Winnowing Fan")
def _():
    a = Art()
    a.circle(40, 50, 8, 0, 2.2)
    for k in range(5):
        t = 2 * math.pi * k / 5 + 0.4
        a.path(f"M40 50 L{n(40 + 28 * math.cos(t))} {n(50 + 28 * math.sin(t))} L{n(40 + 26 * math.cos(t + 0.5))} {n(50 + 26 * math.sin(t + 0.5))} Z", 0, 1.6)
    a.circle(40, 50, 3, 6, 1.4)
    arrow(a, 76, 44, 94, 40, 3, 1.5, 0.8, 3.4)
    arrow(a, 76, 56, 94, 58, 3, 1.5, 0.5, 3.4)
    a.dots([(74, 68), (80, 74), (68, 76)], 1.3, 6)
    a.ground(90)
    return a


@item("Screened Grain")
def _():
    a = Art()
    a.ellipse(50, 40, 34, 10, 0, 2.2)
    a.path("M16 40 L16 46 Q50 62 84 46 L84 40", 0, 2.2)
    for k in range(-3, 4):
        a.line(50 + k * 8, 33, 50 + k * 8, 49 - abs(k) * 0.6, 3, 0.9, 0.55)
    for k in range(-2, 3):
        a.line(24, 40 + k * 2.4, 76, 40 + k * 2.4, 3, 0.9, 0.55)
    a.dots([(40, 66), (50, 70), (60, 66), (46, 76), (56, 78)], 1.3, 6)
    arrow(a, 50, 54, 50, 62, 3, 1.2, 0.7, 3)
    a.ground(90)
    return a


@item("Graded Seed Grain")
def _():
    a = Art()
    for i, (x, r) in enumerate(((22, 5.0), (50, 4.0), (78, 3.0))):
        a.path(f"M{x - 12} 40 L{x + 12} 40 L{x + 9} 74 L{x - 9} 74 Z", 0, 1.8)
        for k in range(6):
            seed(a, x - 6 + (k % 3) * 6, 50 + (k // 3) * 10, r * 0.55, 3, 1.0)
        a.line(x - 12, 40, x + 12, 40, 6, 1.6)
    a.path("M14 28 L86 28", 3, 1.0, 0.5)
    a.line(22, 22, 22, 28, 3, 1.0)
    a.line(50, 22, 50, 28, 3, 1.0)
    a.line(78, 22, 78, 28, 3, 1.0)
    a.ground(90)
    return a


@item("Certified Seed Lot")
def _():
    a = Art()
    sack(a, 40, 24, 36, 46, 0, 2.2)
    a.circle(40, 52, 9, 6, 1.6)
    a.path("M35 52 L39 56 L46 47", 6, 1.8)
    a.rect(64, 36, 22, 28, 3, 1.6)
    a.line(68, 44, 82, 44, 3, 1.0, 0.6)
    a.line(68, 50, 82, 50, 3, 1.0, 0.6)
    a.line(68, 56, 78, 56, 3, 1.0, 0.6)
    a.path("M64 30 L75 36 L86 30", 6, 1.2, 0.7)
    a.ground(90)
    return a


@item("Straw Stack")
def _():
    a = Art()
    a.path("M16 78 Q18 40 50 22 Q82 40 84 78 Z", 0, 2.2)
    for k in range(9):
        a.path(f"M{22 + k * 7} 76 Q{26 + k * 6} 50 {44 + k * 1.6} {32 + abs(k - 4) * 3}", 3, 1.0, 0.5)
    a.line(50, 12, 50, 22, 6, 1.6)
    a.path("M46 16 L54 16", 6, 1.2)
    a.ground(88)
    return a


@item("Thatched Straw Bundle")
def _():
    a = Art()
    for k in range(9):
        x = 28 + k * 5
        a.path(f"M{x} 20 Q{x + (k - 4) * 0.8} 50 {x} 80", 0, 1.6, None if k % 2 == 0 else 0.7)
    a.line(24, 44, 76, 44, 6, 2.6)
    a.line(24, 47, 76, 47, 3, 1.0, 0.5)
    a.path("M22 80 L78 80", 3, 1.2, 0.6)
    a.path("M16 20 L34 14 M66 14 L84 20", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Compressed Straw Bale")
def _():
    a = Art()
    a.path("M16 40 L70 40 L86 28 L32 28 Z", 0, 2.0)
    a.path("M16 40 L16 72 L70 72 L70 40 M70 72 L86 60 L86 28", 0, 2.2)
    for x in range(22, 68, 6):
        a.line(x, 44, x - 1, 68, 3, 0.9, 0.5)
    a.line(30, 40, 30, 72, 6, 2.0)
    a.line(56, 40, 56, 72, 6, 2.0)
    a.ground(86)
    return a


@item("Bound Straw Bale")
def _():
    a = Art()
    a.path("M16 40 L70 40 L86 28 L32 28 Z", 0, 2.0)
    a.path("M16 40 L16 72 L70 72 L70 40 M70 72 L86 60 L86 28", 0, 2.2)
    for x in range(22, 68, 6):
        a.line(x, 44, x - 1, 68, 3, 0.9, 0.45)
    for x in (30, 56):
        a.line(x, 40, x, 72, 6, 2.4)
        a.line(x + 3, 40, x + 3, 72, 3, 0.9, 0.5)
        a.path(f"M{x - 2} 40 L{x + 5} 34 L{x + 18} 34", 6, 1.4, 0.8)
        a.circle(x, 56, 1.8, 6, 1.2)
    a.ground(86)
    return a


@item("Grain Drying Tray")
def _():
    a = Art()
    a.path("M12 46 L28 32 L88 32 L72 46 Z", 0, 2.0)
    a.path("M12 46 L12 52 L72 52 L72 46 M72 52 L88 38 L88 32", 0, 2.0)
    for (x, y) in ((28, 42), (38, 40), (46, 43), (56, 40), (64, 42), (36, 36), (52, 36), (66, 36)):
        seed(a, x, y, 2, 3, 1.0)
    a.line(18, 52, 18, 72, 6, 1.8)
    a.line(66, 52, 66, 72, 6, 1.8)
    a.path("M30 20 Q34 12 38 20 M50 18 Q54 10 58 18", 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Raised Grain Dryer")
def _():
    a = Art()
    a.rect(16, 28, 68, 12, 0, 2.2)
    for x in range(22, 80, 6):
        seed(a, x, 34, 2.2, 3, 1.0)
    for x in (22, 78):
        a.line(x, 40, x, 82, 0, 2.4)
    a.line(22, 62, 78, 62, 6, 1.6)
    a.path("M30 82 L22 70 M70 82 L78 70", 6, 1.2, 0.7)
    for x in (36, 50, 64):
        a.path(f"M{x} 56 Q{x + 3} 48 {x} 42", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Ventilated Grain Bin")
def _():
    a = Art()
    a.path("M26 36 L74 36 L74 78 L26 78 Z", 0, 2.2)
    a.path("M20 36 L50 16 L80 36", 0, 2.2)
    for y in (46, 56, 66):
        for x in (34, 44, 54, 64):
            a.line(x, y, x + 5, y, 3, 1.2, 0.8)
    a.line(50, 16, 50, 8, 6, 1.6)
    a.path("M44 8 L56 8", 6, 1.4)
    a.path("M12 80 L88 80", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Temperature Managed Grain Bin")
def _():
    a = Art()
    a.path("M20 38 L68 38 L68 78 L20 78 Z", 0, 2.2)
    a.path("M14 38 L44 18 L74 38", 0, 2.2)
    for y in (48, 58):
        a.line(24, y, 64, y, 3, 1.0, 0.6)
    a.circle(86, 44, 4.4, 6, 1.6)
    a.line(86, 20, 86, 40, 6, 2.0)
    a.line(86, 20, 86, 20, 6, 1.0)
    a.path("M82 20 Q86 14 90 20", 6, 1.4)
    a.line(68, 58, 82, 58, 3, 1.4)
    a.line(82, 48, 82, 58, 3, 1.4)
    a.circle(44, 62, 3, 3, 1.2)
    a.line(44, 59, 44, 66, 3, 0.9, 0.7)
    a.ground(90)
    return a


@item("Harvest Sickle Blade")
def _():
    a = Art()
    a.path("M20 70 C12 40 34 18 66 24 C46 28 34 46 36 70 Z", 0, 2.4)
    a.path("M26 66 C20 44 36 30 56 28", 3, 1.0, 0.5)
    a.path("M20 70 L36 70", 0, 1.8)
    ear(a, 74, 40, 38, 6, 1.4, 4, -0.15)
    a.ground(86)
    return a


@item("Composite Harvest Sickle")
def _():
    a = Art()
    a.path("M16 70 C8 40 30 18 62 24", 0, 2.4)
    a.path("M16 70 C14 44 32 26 62 30", 0, 2.4)
    for k in range(6):
        t = k / 5
        x = 12 + t * 34
        y = 62 - math.sin(t * 2.4) * 36 + 2
        a.rect(x - 2, y - 2, 4, 5, 6, 1.2)
    a.rect(14, 68, 10, 18, 0, 2.2, None, 2)
    a.line(18, 72, 18, 82, 3, 0.9, 0.5)
    ear(a, 76, 38, 38, 6, 1.4, 4, -0.15)
    a.ground(90)
    return a


@item("Cradle Scythe")
def _():
    a = Art()
    a.line(26, 12, 70, 80, 0, 2.4)
    a.line(40, 36, 32, 44, 0, 2.0)
    a.line(52, 56, 62, 54, 0, 2.0)
    a.path("M70 80 C60 60 40 64 18 74", 0, 2.4)
    for k in range(4):
        a.line(30 + k * 7, 66 - k * 3, 30 + k * 7, 40 - k * 4 + 12, 3, 1.4, 0.8)
    a.line(30, 70, 62, 60, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Reaper Cutter Bar")
def _():
    a = Art()
    a.rect(10, 56, 80, 8, 0, 2.2)
    for k in range(7):
        x = 14 + k * 11
        a.path(f"M{x} 64 L{x + 5.5} 76 L{x + 11} 64", 6, 1.5)
    a.line(10, 52, 90, 52, 3, 1.0, 0.5)
    a.circle(22, 36, 10, 0, 2.0)
    a.line(22, 36, 22, 56, 3, 1.4)
    a.line(32, 36, 60, 24, 3, 1.4)
    a.circle(60, 24, 3, 6, 1.4)
    for k in range(3):
        ear(a, 70 + k * 7, 12, 30, 3, 1.0, 3)
    a.ground(90)
    return a
