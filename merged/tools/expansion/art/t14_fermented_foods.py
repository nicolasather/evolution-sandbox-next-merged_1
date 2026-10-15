"""Topic 14 - fermented foods (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .registry import item, topic

topic("fermented foods")


def crock(a, cx, top, w=40, h=40, z=0, wd=2.2):
    a.ellipse(cx, top, w / 2, w * 0.14, z, wd)
    a.path(f"M{n(cx - w / 2)} {n(top)} Q{n(cx - w / 2 - 4)} {n(top + h * 0.7)} {n(cx - w / 2 + 4)} {n(top + h)} Q{n(cx)} {n(top + h + w * 0.2)} {n(cx + w / 2 - 4)} {n(top + h)} Q{n(cx + w / 2 + 4)} {n(top + h * 0.7)} {n(cx + w / 2)} {n(top)}", z, wd)


def bubbles(a, pts, z=6, r=1.6):
    for (x, y) in pts:
        a.circle(x, y, r, z, 1.1)


def bottle(a, cx, top, w=18, h=50, z=0, wd=2.0):
    a.path(f"M{n(cx - 3)} {n(top)} L{n(cx - 3)} {n(top + h * 0.35)} Q{n(cx - w / 2)} {n(top + h * 0.45)} {n(cx - w / 2)} {n(top + h * 0.6)} L{n(cx - w / 2)} {n(top + h)} L{n(cx + w / 2)} {n(top + h)} L{n(cx + w / 2)} {n(top + h * 0.6)} Q{n(cx + w / 2)} {n(top + h * 0.45)} {n(cx + 3)} {n(top + h * 0.35)} L{n(cx + 3)} {n(top)} Z", z, wd)
    a.line(cx - 4, top, cx + 4, top, z, wd)


def jar(a, cx, top, w=34, h=38, z=0, wd=2.0):
    a.rect(cx - w / 2, top, w, h, z, wd, None, 5)
    a.rect(cx - w / 2 + 2, top - 6, w - 4, 6, z, wd)


def cheese_wheel(a, cx, cy, rx=26, h=16, z=0, wd=2.2):
    a.ellipse(cx, cy, rx, rx * 0.3, z, wd)
    a.line(cx - rx, cy, cx - rx, cy + h, z, wd)
    a.line(cx + rx, cy, cx + rx, cy + h, z, wd)
    a.path(f"M{n(cx - rx)} {n(cy + h)} Q{n(cx)} {n(cy + h + rx * 0.6)} {n(cx + rx)} {n(cy + h)}", z, wd)


@item("Food Fermentation Vessel")
def _():
    a = Art()
    crock(a, 50, 30, 44, 42, 0)
    a.path("M32 34 Q50 42 68 34", 3, 1.2, 0.6)
    bubbles(a, [(44, 30), (54, 28), (60, 32)], 6, 1.4)
    a.path("M40 70 L60 70", 3, 1.0, 0.45)
    for x in (40, 52, 62):
        a.path(f"M{x} 22 Q{x + 3} 14 {x} 8", 3, 1.2, 0.55)
    a.ground(90)
    return a


@item("Soured Grain Mash")
def _():
    a = Art()
    crock(a, 40, 40, 40, 34, 0)
    a.path("M26 44 Q40 52 54 44", 3, 1.2, 0.6)
    bubbles(a, [(34, 40), (44, 38), (50, 42), (40, 44)], 6, 1.5)
    for (x, y) in ((70, 56), (78, 52), (84, 60), (74, 64)):
        a.ellipse(x, y, 1.6, 3, 6, 1.2, None, 25)
    a.path("M66 42 L88 42", 3, 1.0, 0.4)
    for x in (30, 42):
        a.path(f"M{x} 30 Q{x + 3} 22 {x} 16", 3, 1.2, 0.55)
    a.ground(90)
    return a


@item("Natural Sourdough Starter")
def _():
    a = Art()
    jar(a, 50, 32, 36, 44, 0, 2.2)
    a.path("M34 54 Q42 48 50 54 T66 54", 3, 1.3, 0.8)
    bubbles(a, [(42, 46), (52, 44), (58, 48), (46, 58), (56, 60)], 6, 1.8)
    a.path("M34 58 L66 58", 3, 1.0, 0.4)
    a.path("M66 30 Q74 24 82 28 Q74 34 66 34", 6, 1.4)
    a.path("M20 40 q-4 -4 -2 -10 q6 2 6 8", 3, 1.1, 0.7)
    a.ground(90)
    return a


@item("Refreshed Sourdough Starter")
def _():
    a = Art()
    jar(a, 38, 34, 32, 42, 0, 2.2)
    a.path("M24 56 Q32 50 40 56 T52 56", 3, 1.3, 0.8)
    bubbles(a, [(32, 48), (42, 46), (36, 62)], 6, 1.7)
    a.path("M66 30 L86 30 L84 52 L68 52 Z", 0, 1.8)
    a.line(66, 38, 86, 38, 3, 1.0, 0.6)
    arrow(a, 58, 44, 50, 52, 3, 1.4, 0.8, 3)
    droplet(a, 76, 62, 3.2)
    a.ground(90)
    return a


@item("Stable Bread Starter")
def _():
    a = Art()
    jar(a, 38, 32, 32, 44, 0, 2.2)
    bubbles(a, [(32, 52), (42, 50)], 6, 1.7)
    a.path("M24 56 Q32 52 40 56 T52 56", 3, 1.3, 0.8)
    a.path("M60 66 Q60 40 78 36 Q90 44 88 62 Q80 72 60 66 Z", 0, 2.2)
    a.path("M68 44 L74 42 M70 52 L80 50 M70 60 L82 58", 3, 1.0, 0.55)
    a.rect(26, 22, 28, 10, 6, 1.6)
    a.ground(90)
    return a


@item("Fermented Milk Curds")
def _():
    a = Art()
    a.ellipse(50, 44, 34, 10, 0, 2.2)
    a.path("M16 44 Q18 70 50 74 Q82 70 84 44", 0, 2.2)
    for (x, y) in ((36, 44), (46, 42), (56, 45), (66, 43), (42, 50), (54, 50)):
        a.circle(x, y, 3.6, 6, 1.4)
    a.path("M20 56 Q50 64 80 56", 3, 1.0, 0.5)
    droplet(a, 82, 24, 3)
    a.ground(88)
    return a


@item("Drained Soft Cheese")
def _():
    a = Art()
    a.path("M22 34 L78 34 L74 70 L26 70 Z", 0, 2.2)
    a.rect(28, 40, 44, 24, 3, 1.0, 0.5)
    for x in (34, 44, 54, 64):
        a.line(x, 40, x, 64, 3, 0.9, 0.5)
    a.path("M28 28 L72 28", 6, 1.6)
    a.line(36, 28, 36, 34, 6, 1.3)
    a.line(64, 28, 64, 34, 6, 1.3)
    droplet(a, 46, 78, 3)
    droplet(a, 58, 82, 2.4)
    a.ground(90)
    return a


@item("Pressed Cheese Wheel")
def _():
    a = Art()
    cheese_wheel(a, 50, 52, 26, 14, 0)
    a.rect(30, 34, 40, 8, 6, 2.2)
    a.line(50, 14, 50, 34, 6, 2.4)
    a.line(40, 14, 60, 14, 6, 2.4)
    arrow(a, 50, 18, 50, 32, 3, 1.3, 0.7)
    a.path("M30 56 Q50 66 70 56", 3, 1.0, 0.5)
    droplet(a, 82, 68, 2.6)
    a.ground(90)
    return a


@item("Aged Hard Cheese")
def _():
    a = Art()
    cheese_wheel(a, 50, 42, 30, 18, 0)
    a.path("M22 50 Q50 60 78 50", 3, 1.3, 0.7)
    a.path("M30 36 Q50 44 70 36", 3, 1.0, 0.5)
    a.path("M30 78 L70 78", 6, 1.6)
    a.path("M26 72 L74 72", 3, 1.0, 0.45)
    a.dots([(40, 40), (52, 44), (60, 38)], 1.1, 3)
    a.ground(90)
    return a


@item("Fermented Cabbage")
def _():
    a = Art()
    a.circle(50, 48, 26, 0, 2.2)
    for k in range(5):
        a.path(f"M50 {22 + k * 5} Q{70 - k * 4} 48 50 {74 - k * 5}", 3, 1.2, 0.6)
        a.path(f"M50 {22 + k * 5} Q{30 + k * 4} 48 50 {74 - k * 5}", 3, 1.2, 0.6)
    a.path("M50 22 L50 74", 3, 1.4, 0.8)
    bubbles(a, [(78, 28), (84, 36), (74, 22)], 6, 1.6)
    a.ground(86)
    return a


@item("Salted Vegetable Ferment")
def _():
    a = Art()
    crock(a, 40, 36, 40, 36, 0)
    for (x, y) in ((32, 40), (42, 38), (50, 42)):
        a.path(f"M{x} {y} q3 -4 6 0 q-3 4 -6 0", 6, 1.3)
    a.dots([(70, 56), (76, 60), (82, 54), (78, 66), (72, 66)], 1.4, 6)
    a.path("M64 50 L90 50 L88 74 L66 74 Z", 0, 1.8)
    a.line(64, 56, 90, 56, 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Weighted Fermentation Crock")
def _():
    a = Art()
    crock(a, 50, 40, 44, 38, 0)
    a.ellipse(50, 40, 18, 4.6, 6, 1.6)
    a.path("M40 38 L40 30 L60 30 L60 38", 6, 2.0)
    a.rect(38, 22, 24, 10, 6, 2.2)
    a.line(50, 14, 50, 22, 3, 1.2, 0.6)
    arrow(a, 50, 10, 50, 22, 3, 1.3, 0.7)
    bubbles(a, [(28, 50), (72, 56)], 6, 1.4)
    a.ground(90)
    return a


@item("Sealed Vegetable Ferment")
def _():
    a = Art()
    jar(a, 50, 34, 40, 44, 0, 2.2)
    a.path("M26 30 Q50 20 74 30", 6, 1.8)
    a.line(50, 20, 50, 16, 6, 1.6)
    a.path("M46 14 Q50 8 54 14 Q50 18 46 14", 6, 1.4)
    for (x, y) in ((40, 52), (52, 50), (60, 56), (46, 64)):
        a.path(f"M{x} {y} q3 -4 6 0 q-3 4 -6 0", 6, 1.3)
    a.path("M34 48 L66 48", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Fruit Must")
def _():
    a = Art()
    a.path("M20 36 L80 36 L72 74 L28 74 Z", 0, 2.2)
    a.ellipse(50, 36, 30, 7, 0, 2.0)
    for (x, y) in ((38, 38), (50, 40), (62, 38), (46, 36)):
        a.circle(x, y, 4, 6, 1.4)
        a.path(f"M{x} {y - 4} q1 -3 3 -3", 6, 1.0)
    a.path("M24 52 Q50 60 76 52", 3, 1.0, 0.5)
    droplet(a, 50, 86, 3.4)
    a.ground(92)
    return a


@item("Primary Fruit Ferment")
def _():
    a = Art()
    crock(a, 50, 34, 46, 42, 0)
    a.path("M30 38 Q50 46 70 38", 3, 1.3, 0.7)
    bubbles(a, [(40, 34), (50, 32), (58, 36), (46, 40), (62, 32)], 6, 1.6)
    for x in (40, 54, 66):
        a.path(f"M{x} 24 Q{x + 3} 16 {x} 10", 3, 1.2, 0.55)
    a.circle(24, 70, 4, 6, 1.4)
    a.circle(80, 66, 4, 6, 1.4)
    a.ground(90)
    return a


@item("Clarified Fruit Ferment")
def _():
    a = Art()
    a.path("M30 14 L70 14 L70 22 Q82 30 82 46 L82 78 L18 78 L18 46 Q18 30 30 22 Z", 0, 2.2)
    a.path("M22 56 L78 56", 3, 1.4, 0.8)
    a.dots([(28, 68), (40, 72), (52, 70), (66, 72), (72, 68)], 1.2, 6)
    a.path("M30 40 Q50 36 70 40", 3, 1.0, 0.5)
    a.path("M34 14 L66 14", 6, 1.6)
    sparkle(a, 62, 46, 3)
    a.ground(90)
    return a


@item("Bottled Fruit Ferment")
def _():
    a = Art()
    bottle(a, 34, 14, 22, 66, 0)
    bottle(a, 66, 20, 22, 60, 0)
    a.path("M26 56 L42 56 M58 58 L74 58", 3, 1.2, 0.7)
    a.circle(34, 14, 2.6, 6, 1.4)
    a.circle(66, 20, 2.6, 6, 1.4)
    a.rect(28, 62, 12, 10, 6, 1.2)
    a.rect(60, 64, 12, 10, 6, 1.2)
    a.ground(90)
    return a


@item("Malted Grain Mash")
def _():
    a = Art()
    a.ellipse(40, 44, 26, 8, 0, 2.2)
    a.path("M14 44 Q16 70 40 74 Q64 70 66 44", 0, 2.2)
    for k in range(7):
        a.ellipse(26 + k * 4.6, 44 + (k % 2) * 2, 1.4, 3, 6, 1.1, None, 20 - k * 6)
    a.path("M20 52 Q40 60 60 52", 3, 1.0, 0.5)
    a.line(72, 18, 56, 52, 6, 2.6)
    a.circle(74, 15, 3, 6, 1.6)
    a.path("M30 34 Q34 28 38 34", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Fermenting Grain Wort")
def _():
    a = Art()
    crock(a, 40, 30, 42, 46, 0)
    bubbles(a, [(34, 26), (44, 24), (50, 28), (40, 32)], 6, 1.6)
    a.path("M26 34 Q40 42 54 34", 3, 1.2, 0.6)
    a.path("M62 24 L84 24 L84 70 L62 70", 0, 1.8)
    a.line(62, 40, 84, 40, 3, 1.0, 0.6)
    a.line(62, 54, 84, 54, 3, 1.0, 0.6)
    for x in (34, 46):
        a.path(f"M{x} 20 Q{x + 3} 12 {x} 6", 3, 1.2, 0.55)
    a.ground(90)
    return a


@item("Conditioned Grain Beverage")
def _():
    a = Art()
    a.path("M24 22 L56 22 L52 76 Q40 80 28 76 Z", 0, 2.2)
    a.path("M24 22 Q40 14 56 22", 0, 2.0)
    a.path("M26 32 Q40 38 54 32", 3, 1.2, 0.8)
    bubbles(a, [(34, 52), (44, 58), (40, 66)], 6, 1.4)
    a.path("M56 34 Q70 34 70 48 Q70 60 56 60", 0, 2.0)
    a.line(76, 28, 76, 70, 3, 1.2, 0.5)
    a.line(72, 70, 88, 70, 3, 1.2, 0.5)
    a.circle(80, 40, 3, 6, 1.3)
    a.ground(88)
    return a


@item("Filtered Malt Beverage")
def _():
    a = Art()
    a.path("M20 16 L52 16 L42 40 L30 40 Z", 0, 2.0)
    for x in (30, 36, 42):
        a.line(x, 22, x + (36 - x) * 0.3, 34, 3, 1.0, 0.5)
    a.line(36, 40, 36, 52, 0, 1.6)
    droplet(a, 36, 56, 3)
    a.path("M62 34 L88 34 L86 78 L64 78 Z", 0, 2.2)
    a.path("M62 34 Q75 28 88 34", 0, 2.0)
    a.path("M64 48 L86 48", 3, 1.4, 0.8)
    a.ground(90)
    return a


@item("Vinegar Mother")
def _():
    a = Art()
    a.ellipse(50, 50, 30, 9, 0, 2.2)
    a.path("M20 50 Q22 72 50 76 Q78 72 80 50", 0, 2.2)
    a.path("M30 50 Q36 44 44 50 Q52 44 58 50 Q66 46 72 50", 6, 1.8)
    a.path("M34 54 Q50 60 66 54", 3, 1.2, 0.6)
    a.dots([(40, 58), (52, 62), (60, 58)], 1.2, 3)
    a.path("M44 30 Q48 22 52 30 M56 28 Q60 20 64 28", 3, 1.2, 0.55)
    a.ground(90)
    return a


@item("Acetic Fermentation Jar")
def _():
    a = Art()
    jar(a, 50, 36, 44, 42, 0, 2.2)
    a.path("M30 52 Q40 46 50 52 T70 52", 6, 1.6)
    a.path("M26 30 Q50 22 74 30 L74 36 L26 36 Z", 6, 1.5)
    a.path("M32 30 L32 36 M44 28 L44 36 M56 28 L56 36 M68 30 L68 36", 3, 1.0, 0.6)
    a.path("M34 58 L66 58", 3, 1.0, 0.45)
    a.path("M38 20 Q42 12 46 20 M54 18 Q58 10 62 18", 3, 1.2, 0.55)
    a.ground(90)
    return a


@item("Filtered Vinegar")
def _():
    a = Art()
    a.path("M22 14 L58 14 L46 40 L34 40 Z", 0, 2.0)
    for x in (32, 40, 48):
        a.line(x, 20, x + (40 - x) * 0.3, 34, 3, 1.0, 0.5)
    a.line(40, 40, 40, 54, 0, 1.6)
    droplet(a, 40, 58, 3)
    a.path("M26 64 L26 80 L54 80 L54 64", 0, 2.0)
    a.ellipse(40, 64, 14, 3.2, 0, 1.6)
    a.path("M66 30 L88 30 L88 70 L66 70 Z", 0, 1.8)
    a.line(66, 40, 88, 40, 3, 1.0, 0.6)
    a.path("M72 24 L82 24", 6, 1.4)
    a.ground(90)
    return a


@item("Stored Vinegar Bottle")
def _():
    a = Art()
    bottle(a, 50, 12, 28, 68, 0, 2.2)
    a.circle(50, 12, 3, 6, 1.6)
    a.rect(40, 52, 20, 16, 6, 1.4)
    a.line(44, 58, 56, 58, 3, 1.0, 0.6)
    a.line(44, 62, 54, 62, 3, 1.0, 0.6)
    a.path("M38 44 L62 44", 3, 1.2, 0.7)
    a.path("M22 80 L78 80", 3, 1.0, 0.4)
    a.path("M76 22 L84 22 L84 36 L76 36", 3, 1.0, 0.5)
    a.ground(90)
    return a
