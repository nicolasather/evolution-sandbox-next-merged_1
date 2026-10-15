"""Topic 13 - food drying (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, flame, sparkle
from .kit_textile import weave_grid
from .registry import item, topic

topic("food drying")


def rack(a, x=14, y=40, w=72, h=34, z=0, bars=4):
    a.line(x, y, x + w, y, z, 2.2)
    a.line(x, y, x, y + h, z, 2.2)
    a.line(x + w, y, x + w, y + h, z, 2.2)
    for i in range(1, bars):
        a.line(x, y + i * h / bars, x + w, y + i * h / bars, z, 1.2, 0.7)


def sun(a, cx=80, cy=18, r=6, z=6):
    a.circle(cx, cy, r, z, 1.8)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.line(cx + (r + 3) * math.cos(t), cy + (r + 3) * math.sin(t), cx + (r + 7) * math.cos(t), cy + (r + 7) * math.sin(t), z, 1.4)


def fruit(a, x, y, r=4, z=0, w=1.6):
    a.circle(x, y, r, z, w)
    a.path(f"M{n(x)} {n(y - r)} q1 -3 3 -4", z, 1.1)


def fillet(a, x, y, w=36, h=14, z=0, wd=2.0, tilt=0.0):
    a.path(f"M{n(x)} {n(y)} Q{n(x + w * 0.5)} {n(y - h)} {n(x + w)} {n(y + tilt)} Q{n(x + w * 0.5)} {n(y + h * 0.4)} {n(x)} {n(y)} Z", z, wd)
    a.path(f"M{n(x + w * 0.2)} {n(y)} Q{n(x + w * 0.5)} {n(y - h * 0.5)} {n(x + w * 0.8)} {n(y + tilt)}", 3, 1.0, 0.5)


def jar(a, cx, top, w=26, h=34, z=0, wd=2.0):
    a.rect(cx - w / 2, top, w, h, z, wd, None, 3)
    a.rect(cx - w / 2 - 2, top - 6, w + 4, 6, z, wd)


def strips(a, x, y, w=40, count=4, gap=6, z=0, wd=2.0):
    for i in range(count):
        a.path(f"M{n(x)} {n(y + i * gap)} Q{n(x + w * 0.5)} {n(y + i * gap - 3)} {n(x + w)} {n(y + i * gap)}", z, wd, None if i % 2 == 0 else 0.8)


@item("Food Drying Rack")
def _():
    a = Art()
    rack(a, 14, 38, 72, 34, 0, 4)
    for x in range(22, 82, 10):
        a.line(x, 38, x, 72, 3, 1.0, 0.45)
    a.line(20, 72, 14, 84, 6, 1.6)
    a.line(80, 72, 86, 84, 6, 1.6)
    sun(a, 78, 18, 5)
    a.path("M26 26 Q30 20 34 26 M44 22 Q48 16 52 22", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Sun Dried Fruit")
def _():
    a = Art()
    rack(a, 14, 52, 72, 18, 0, 2)
    for x in (26, 40, 54, 68):
        a.ellipse(x, 48, 5, 3.4, 6, 1.5)
        a.line(x - 3, 48, x + 3, 48, 3, 0.9, 0.5)
    sun(a, 50, 20, 7)
    a.line(20, 70, 16, 84, 6, 1.6)
    a.line(80, 70, 84, 84, 6, 1.6)
    a.ground(90)
    return a


@item("Layered Fruit Leather")
def _():
    a = Art()
    for i in range(3):
        a.path(f"M{16 + i * 3} {62 - i * 10} L{74 + i * 3} {62 - i * 10} L{86 + i * 3} {52 - i * 10} L{28 + i * 3} {52 - i * 10} Z", 0, 1.9 - i * 0.1, None if i == 2 else 0.8)
    a.line(16, 62, 16, 70, 0, 2.0)
    a.line(74, 62, 74, 70, 0, 2.0)
    a.line(16, 70, 74, 70, 0, 2.0)
    a.line(74, 70, 86, 60, 0, 2.0)
    a.line(86, 60, 86, 52, 0, 2.0)
    fruit(a, 20, 24, 4, 6)
    fruit(a, 34, 20, 3.4, 6)
    a.ground(86)
    return a


@item("Rolled Fruit Leather")
def _():
    a = Art()
    a.ellipse(26, 50, 9, 14, 0, 2.2)
    a.ellipse(26, 50, 5, 8, 3, 1.2, 0.7)
    a.ellipse(26, 50, 2, 3.4, 3, 1.0, 0.7)
    a.path("M26 36 L74 36 M26 64 L74 64", 0, 2.2)
    a.ellipse(74, 50, 9, 14, 0, 2.2)
    a.path("M30 42 L70 42 M30 58 L70 58", 3, 1.0, 0.45)
    a.ground(86)
    return a


@item("Sealed Fruit Leather")
def _():
    a = Art()
    a.path("M14 30 L86 30 L86 70 L14 70 Z", 0, 2.2)
    a.path("M20 36 L80 36 L80 64 L20 64 Z", 3, 1.0, 0.5)
    a.ellipse(40, 50, 8, 11, 6, 1.6)
    a.ellipse(40, 50, 4, 6, 3, 1.0, 0.7)
    a.path("M14 30 L20 36 M86 30 L80 36 M14 70 L20 64 M86 70 L80 64", 3, 1.0, 0.6)
    for x in range(16, 86, 5):
        a.line(x, 30, x + 2.5, 27, 6, 1.0, 0.7)
    a.line(54, 44, 76, 44, 3, 1.0, 0.5)
    a.line(54, 52, 70, 52, 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Air Dried Herbs")
def _():
    a = Art()
    a.line(10, 20, 90, 20, 0, 2.4)
    for x in (24, 50, 76):
        a.line(x, 20, x, 30, 0, 1.4)
        for k in range(5):
            a.path(f"M{x} 30 Q{x - 6 + k * 3} {44} {x - 8 + k * 4} {62}", 0, 1.4, None if k % 2 == 0 else 0.7)
            a.path(f"M{x - 4 + k * 2} 46 q-3 -2 -4 1 q3 2 4 -1", 3, 1.0, 0.7)
        a.line(x - 5, 32, x + 5, 32, 6, 2.0)
    a.ground(86)
    return a


@item("Bundled Dry Herbs")
def _():
    a = Art()
    for k in range(7):
        x = 36 + k * 4.4
        a.path(f"M{x} 22 Q{x + (k - 3) * 2} 52 {x + (k - 3) * 1.2} 80", 0, 1.6, None if k % 2 == 0 else 0.7)
    a.line(32, 54, 68, 54, 6, 2.6)
    a.line(32, 58, 68, 58, 3, 1.0, 0.5)
    for (x, y) in ((34, 34), (66, 30), (40, 44), (60, 42)):
        a.path(f"M{x} {y} q-4 -3 -5 1 q4 3 5 -1", 3, 1.2, 0.8)
    a.ground(90)
    return a


@item("Powdered Dried Herbs")
def _():
    a = Art()
    a.ellipse(36, 58, 22, 7, 0, 2.2)
    a.path("M14 58 Q16 76 36 78 Q56 76 58 58", 0, 2.2)
    a.path("M20 56 Q36 40 52 56", 3, 1.4, 0.8)
    a.line(66, 20, 82, 56, 6, 2.6)
    a.circle(84, 60, 4, 6, 1.8)
    a.dots([(30, 52), (38, 50), (44, 54), (34, 56)], 1.1, 3)
    a.path("M70 74 Q80 70 90 74", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Stored Herb Sachet")
def _():
    a = Art()
    a.path("M26 30 L74 30 L70 76 L30 76 Z", 0, 2.2)
    a.path("M26 30 Q50 40 74 30", 3, 1.4, 0.8)
    a.path("M30 28 L34 20 M70 28 L66 20", 6, 1.6)
    a.path("M34 20 Q50 12 66 20", 6, 1.6)
    for (x, y) in ((42, 54), (56, 50), (50, 62)):
        a.path(f"M{x} {y} q-5 -3 -6 1 q5 3 6 -1", 6, 1.2)
    a.ground(90)
    return a


@item("Dried Fish Fillet")
def _():
    a = Art()
    a.line(12, 18, 88, 18, 0, 2.4)
    fillet(a, 22, 40, 24, 14, 0, 2.0)
    fillet(a, 52, 44, 28, 16, 0, 2.0)
    a.line(34, 18, 34, 36, 0, 1.4)
    a.line(66, 18, 66, 38, 0, 1.4)
    a.path("M60 70 Q70 64 80 70", 3, 1.0, 0.5)
    sun(a, 80, 70, 4)
    a.ground(90)
    return a


@item("Salt Cured Fish")
def _():
    a = Art()
    fillet(a, 16, 40, 40, 14, 0, 2.0)
    fillet(a, 22, 54, 40, 14, 0, 2.0)
    a.dots([(30, 34), (40, 30), (48, 34), (36, 48), (50, 46), (58, 50)], 1.3, 6)
    a.path("M66 28 L86 28 L84 56 L68 56 Z", 0, 1.8)
    a.line(66, 34, 86, 34, 3, 1.0, 0.6)
    a.dots([(72, 46), (78, 48), (74, 52)], 1.0, 6)
    a.ground(86)
    return a


@item("Smoked Salt Fish")
def _():
    a = Art()
    a.line(14, 22, 86, 22, 0, 2.2)
    fillet(a, 22, 44, 24, 14, 0, 2.0)
    fillet(a, 52, 48, 28, 16, 0, 2.0)
    a.line(34, 22, 34, 40, 0, 1.4)
    a.line(66, 22, 66, 42, 0, 1.4)
    for x in (30, 46, 62, 76):
        a.path(f"M{x} 84 Q{x + 6} 74 {x} 66 Q{x - 6} 60 {x} 54", 3, 1.3, 0.6)
    flame(a, 46, 88, 6, 6, 1.4)
    a.ground(92)
    return a


@item("Sealed Dried Fish Pack")
def _():
    a = Art()
    a.path("M16 30 L84 30 L84 70 L16 70 Z", 0, 2.2)
    a.path("M22 36 L78 36 L78 64 L22 64 Z", 3, 1.0, 0.5)
    fillet(a, 28, 52, 30, 10, 6, 1.6)
    a.path("M16 30 L22 36 M84 30 L78 36", 3, 1.0, 0.6)
    a.line(64, 44, 74, 44, 3, 1.0, 0.5)
    a.line(64, 52, 72, 52, 3, 1.0, 0.5)
    a.path("M16 24 L84 24 M16 24 L16 30 M84 24 L84 30", 6, 1.4)
    a.ground(86)
    return a


@item("Dried Meat Strips")
def _():
    a = Art()
    a.line(12, 18, 88, 18, 0, 2.4)
    for x in (26, 44, 62, 78):
        a.path(f"M{x} 18 Q{x - 3} 40 {x + 1} 58 Q{x + 3} 66 {x} 72", 0, 2.4)
        a.path(f"M{x + 3} 18 Q{x} 40 {x + 4} 58 Q{x + 6} 66 {x + 3} 72", 3, 1.0, 0.55)
    a.ground(86)
    return a


@item("Smoke Dried Meat")
def _():
    a = Art()
    a.line(14, 24, 86, 24, 0, 2.4)
    for x in (30, 50, 70):
        a.path(f"M{x} 24 Q{x - 3} 40 {x + 1} 52", 0, 2.4)
    for x in (24, 44, 64, 78):
        a.path(f"M{x} 86 Q{x + 6} 76 {x} 68 Q{x - 6} 62 {x} 56", 3, 1.3, 0.6)
    flame(a, 50, 90, 6, 6, 1.4)
    a.path("M14 16 L86 16", 3, 1.0, 0.4)
    a.ground(92)
    return a


@item("Pressed Dried Meat")
def _():
    a = Art()
    a.rect(20, 56, 60, 8, 0, 2.2)
    a.rect(20, 66, 60, 8, 0, 2.2)
    a.line(50, 20, 50, 42, 0, 2.4)
    a.line(32, 42, 68, 42, 0, 2.6)
    a.rect(26, 46, 48, 8, 6, 2.0)
    arrow(a, 50, 28, 50, 44, 3, 1.3, 0.7)
    a.line(26, 60, 74, 60, 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Vacuum Packed Dried Meat")
def _():
    a = Art()
    a.path("M16 32 Q50 24 84 32 L82 70 Q50 78 18 70 Z", 0, 2.2)
    a.path("M26 40 Q50 36 74 40 L72 62 Q50 66 28 62 Z", 3, 1.2, 0.6)
    a.line(36, 46, 36, 58, 6, 2.0)
    a.line(46, 46, 46, 58, 6, 2.0)
    a.line(56, 46, 56, 58, 6, 2.0)
    a.path("M20 36 L32 44 M80 36 L68 44 M20 66 L32 58 M80 66 L68 58", 3, 1.0, 0.5)
    a.path("M80 20 L90 14 M84 26 L94 22", 3, 1.0, 0.5)
    a.ground(86)
    return a


def kernels(a, pts, z=6, r=1.8):
    for (x, y) in pts:
        a.ellipse(x, y, r * 0.6, r, z, 1.2, None, 25)


@item("Toasted Grain")
def _():
    a = Art()
    a.ellipse(46, 54, 28, 8, 0, 2.2)
    a.path("M18 54 Q20 74 46 76 Q72 74 74 54", 0, 2.2)
    kernels(a, [(34, 50), (42, 48), (50, 50), (58, 48), (40, 54), (54, 54)])
    a.line(74, 52, 92, 40, 0, 2.2)
    flame(a, 40, 90, 6, 6, 1.4)
    flame(a, 52, 90, 6, 6, 1.4)
    a.ground(92)
    return a


@item("Parched Grain Meal")
def _():
    a = Art()
    a.ellipse(36, 56, 22, 7, 0, 2.2)
    a.path("M14 56 Q16 74 36 76 Q56 74 58 56", 0, 2.2)
    kernels(a, [(28, 52), (36, 50), (44, 52)])
    a.path("M64 74 L90 74", 3, 1.2, 0.5)
    for x in range(66, 90, 5):
        a.circle(x, 70, 1.4, 6, 1.0)
    a.path("M70 40 L86 40 L84 64 L72 64 Z", 0, 1.8)
    a.line(70, 46, 86, 46, 3, 1.0, 0.6)
    a.ground(88)
    return a


@item("Ground Parched Meal")
def _():
    a = Art()
    a.path("M20 52 Q18 74 40 76 Q62 74 60 52 Z", 0, 2.4)
    a.ellipse(40, 52, 20, 5.6, 0, 2.2)
    a.line(66, 18, 46, 54, 6, 3.0)
    a.circle(68, 15, 4, 6, 1.8)
    a.path("M26 52 Q40 44 54 52", 3, 1.2, 0.6)
    a.dots([(70, 72), (76, 74), (82, 72), (74, 78)], 1.2, 3)
    a.ground(88)
    return a


@item("Instant Grain Mix")
def _():
    a = Art()
    a.path("M24 24 L56 24 L52 72 L28 72 Z", 0, 2.2)
    a.line(24, 24, 56, 24, 6, 2.2)
    a.line(26, 36, 54, 36, 3, 1.0, 0.5)
    a.path("M28 28 Q40 32 52 28", 3, 1.0, 0.5)
    a.path("M64 52 L86 52 L84 72 L66 72 Z", 0, 2.0)
    a.path("M62 52 L88 52", 6, 1.6)
    a.path("M70 46 Q74 38 78 46", 3, 1.2, 0.6)
    arrow(a, 54, 40, 68, 48, 3, 1.3, 0.7, 3)
    droplet(a, 76, 62, 2.8, 6)
    a.ground(86)
    return a


@item("Sun Dried Vegetables")
def _():
    a = Art()
    rack(a, 14, 54, 72, 16, 0, 2)
    for x in (24, 38, 52, 66, 78):
        a.path(f"M{x - 4} 52 Q{x} 44 {x + 4} 52 Q{x} 54 {x - 4} 52", 6, 1.4)
    sun(a, 50, 22, 7)
    a.line(20, 70, 16, 84, 6, 1.6)
    a.line(80, 70, 84, 84, 6, 1.6)
    a.ground(90)
    return a


@item("Blanched Dried Vegetables")
def _():
    a = Art()
    a.path("M14 40 L58 40 L54 74 Q36 80 18 74 Z", 0, 2.2)
    a.ellipse(36, 40, 22, 5.6, 0, 2.0)
    for x in (26, 38, 48):
        a.path(f"M{x} 34 Q{x + 3} 26 {x} 18", 3, 1.2, 0.6)
    a.path("M66 40 L90 40 M66 52 L90 52 M66 64 L90 64", 0, 1.8)
    for (x, y) in ((70, 46), (80, 46), (74, 58), (84, 58)):
        a.circle(x, y, 2.2, 6, 1.2)
    a.ground(90)
    return a


@item("Dehydrated Vegetable Flakes")
def _():
    a = Art()
    a.path("M26 32 L74 32 L70 74 L30 74 Z", 0, 2.2)
    a.ellipse(50, 32, 24, 5, 0, 1.8)
    for (x, y) in ((38, 54), (46, 60), (54, 52), (62, 58), (44, 68), (56, 66), (50, 44)):
        a.path(f"M{x - 2.5} {y} L{x} {y - 2.4} L{x + 2.5} {y} L{x} {y + 2.4} Z", 6, 1.1)
    a.path("M30 44 L70 44", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Freeze Dried Vegetable Pieces")
def _():
    a = Art()
    a.path("M24 22 L76 22 L72 78 L28 78 Z", 0, 2.4)
    a.rect(30, 30, 40, 40, 3, 1.0, 0.5)
    for (x, y) in ((40, 40), (56, 38), (44, 54), (60, 56), (50, 46)):
        a.path(f"M{x - 4} {y} L{x} {y - 4} L{x + 4} {y} L{x} {y + 4} Z", 6, 1.4)
        a.dot(x, y, 0.9, 3)
    for (x, y) in ((14, 28), (86, 28), (14, 60), (86, 60)):
        a.path(f"M{x - 3} {y} L{x + 3} {y} M{x} {y - 3} L{x} {y + 3} M{x - 2} {y - 2} L{x + 2} {y + 2} M{x - 2} {y + 2} L{x + 2} {y - 2}", 3, 0.9, 0.7)
    a.ground(90)
    return a
