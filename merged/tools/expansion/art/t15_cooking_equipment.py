"""Topic 15 - cooking equipment (24; Stone Pestle is quarantined as a duplicate)."""
from __future__ import annotations

import math

from .core import Art, arrow, gear_d, n
from .kit import droplet, flame, sparkle
from .registry import item, topic

topic("cooking equipment")


def pot(a, cx, top, w=34, h=24, z=0, wd=2.2, lid=False):
    a.ellipse(cx, top, w / 2, w * 0.14, z, wd)
    a.path(f"M{n(cx - w / 2)} {n(top)} L{n(cx - w / 2 + 3)} {n(top + h)} Q{n(cx)} {n(top + h + w * 0.2)} {n(cx + w / 2 - 3)} {n(top + h)} L{n(cx + w / 2)} {n(top)}", z, wd)
    a.path(f"M{n(cx - w / 2)} {n(top + 4)} q-6 0 -6 4 M{n(cx + w / 2)} {n(top + 4)} q6 0 6 4", z, 1.6)
    if lid:
        a.path(f"M{n(cx - w / 2 - 1)} {n(top - 1)} Q{n(cx)} {n(top - 12)} {n(cx + w / 2 + 1)} {n(top - 1)}", 6, 1.8)
        a.circle(cx, top - 9, 2, 6, 1.4)


def fire(a, cx, y, n_=3, z=6, h=8):
    for k in range(n_):
        flame(a, cx - (n_ - 1) * 5 + k * 10, y, h, z, 1.4)


def tripod(a, cx, top, spread=18, h=26, z=0, wd=2.2):
    a.line(cx - spread, top, cx - spread + 4, top + h, z, wd)
    a.line(cx + spread, top, cx + spread - 4, top + h, z, wd)
    a.line(cx, top + 4, cx, top + h - 2, z, wd, 0.8)
    a.line(cx - spread - 2, top, cx + spread + 2, top, z, wd)


@item("Portable Cooking Hearth")
def _():
    a = Art()
    a.path("M20 44 L80 44 L74 76 L26 76 Z", 0, 2.4)
    a.ellipse(50, 44, 30, 6, 0, 2.2)
    fire(a, 50, 46, 3, 6, 9)
    a.path("M12 44 L20 44 M80 44 L88 44", 0, 2.0)
    a.rect(44, 60, 12, 10, 3, 1.2, 0.6)
    a.line(24, 60, 76, 60, 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Clay Griddle")
def _():
    a = Art()
    a.ellipse(50, 44, 34, 9, 0, 2.4)
    a.path("M16 44 L16 52 Q50 66 84 52 L84 44", 0, 2.4)
    a.ellipse(50, 45, 26, 6, 3, 1.0, 0.5)
    a.path("M34 40 Q40 36 46 40 M54 42 Q60 38 66 42", 3, 1.2, 0.7)
    fire(a, 50, 86, 3, 6, 8)
    a.line(30, 68, 30, 80, 0, 2.0)
    a.line(70, 68, 70, 80, 0, 2.0)
    a.ground(90)
    return a


@item("Flat Baking Griddle")
def _():
    a = Art()
    a.path("M14 48 L70 48 L88 38 L32 38 Z", 0, 2.2)
    a.path("M14 48 L14 54 L70 54 L70 48 M70 54 L88 44 L88 38", 0, 2.2)
    a.circle(40, 44, 8, 6, 1.4)
    a.circle(64, 42, 6, 6, 1.4)
    a.line(20, 54, 20, 74, 0, 1.8)
    a.line(64, 54, 64, 74, 0, 1.8)
    fire(a, 42, 84, 3, 6, 7)
    a.ground(90)
    return a


@item("Handled Baking Griddle")
def _():
    a = Art()
    a.ellipse(40, 50, 28, 8, 0, 2.4)
    a.path("M12 50 L12 56 Q40 68 68 56 L68 50", 0, 2.4)
    a.line(68, 52, 92, 44, 0, 3.0)
    a.circle(93, 43, 2, 6, 1.4)
    a.circle(34, 48, 7, 6, 1.4)
    a.path("M30 46 L38 50", 3, 1.0, 0.6)
    a.path("M30 28 Q34 20 38 28 M44 26 Q48 18 52 26", 3, 1.2, 0.55)
    a.ground(86)
    return a


@item("Multi Zone Cooktop")
def _():
    a = Art()
    a.path("M12 36 L68 36 L88 26 L32 26 Z", 0, 2.2)
    a.path("M12 36 L12 62 L68 62 L68 36 M68 62 L88 52 L88 26", 0, 2.2)
    a.ellipse(34, 48, 12, 5, 6, 1.6)
    a.ellipse(34, 48, 6, 2.6, 6, 1.2)
    a.ellipse(56, 48, 8, 3.6, 6, 1.6)
    a.circle(24, 56, 1.8, 6, 1.2)
    a.circle(34, 56, 1.8, 6, 1.2)
    a.circle(44, 56, 1.8, 6, 1.2)
    a.circle(54, 56, 1.8, 6, 1.2)
    fire(a, 34, 22, 2, 3, 6)
    a.ground(76)
    return a


@item("Cooking Spit")
def _():
    a = Art()
    a.line(12, 40, 12, 80, 0, 2.4)
    a.line(88, 40, 88, 80, 0, 2.4)
    a.line(8, 40, 16, 40, 0, 2.4)
    a.line(84, 40, 92, 40, 0, 2.4)
    a.line(12, 40, 88, 40, 0, 1.8)
    a.path("M30 40 Q30 28 50 28 Q70 28 70 40 Q70 52 50 52 Q30 52 30 40 Z", 6, 2.2)
    a.path("M38 36 Q50 32 62 36", 3, 1.0, 0.6)
    fire(a, 50, 82, 4, 6, 8)
    a.ground(90)
    return a


@item("Rotating Cooking Spit")
def _():
    a = Art()
    a.line(12, 40, 12, 80, 0, 2.4)
    a.line(76, 40, 76, 80, 0, 2.4)
    a.line(8, 40, 16, 40, 0, 2.4)
    a.line(12, 40, 80, 40, 0, 1.8)
    a.path("M26 40 Q26 28 44 28 Q62 28 62 40 Q62 52 44 52 Q26 52 26 40 Z", 6, 2.2)
    a.line(80, 40, 90, 40, 0, 1.8)
    a.line(90, 40, 90, 54, 0, 2.2)
    a.circle(90, 58, 4, 6, 1.6)
    a.path("M84 34 A10 10 0 0 1 94 34", 3, 1.4, 0.8)
    arrow(a, 94, 34, 96, 40, 3, 1.2, 0.8, 2.6)
    fire(a, 44, 82, 3, 6, 8)
    a.ground(90)
    return a


@item("Geared Roasting Spit")
def _():
    a = Art()
    a.line(10, 36, 10, 80, 0, 2.4)
    a.line(66, 36, 66, 80, 0, 2.4)
    a.line(10, 36, 66, 36, 0, 1.8)
    a.path("M22 36 Q22 24 38 24 Q54 24 54 36 Q54 48 38 48 Q22 48 22 36 Z", 6, 2.2)
    a.path("M66 36 L72 36", 0, 1.8)
    a.path(gear_d(78, 36, 9, 6.4, 10), 0, 1.8)
    a.circle(78, 36, 2, 6, 1.2)
    a.path(gear_d(78, 58, 7, 5, 8), 0, 1.8)
    a.line(78, 58, 90, 70, 6, 2.0)
    a.circle(92, 72, 2.4, 6, 1.4)
    fire(a, 38, 82, 3, 6, 8)
    a.ground(90)
    return a


@item("Motor Driven Rotisserie")
def _():
    a = Art()
    a.rect(10, 26, 24, 40, 0, 2.2)
    a.circle(22, 42, 8, 6, 1.6)
    a.circle(22, 42, 2.6, 3, 1.2)
    a.line(34, 42, 90, 42, 0, 2.0)
    a.path("M44 42 Q44 30 60 30 Q76 30 76 42 Q76 54 60 54 Q44 54 44 42 Z", 6, 2.2)
    a.line(90, 34, 90, 80, 0, 2.2)
    a.path("M14 18 L18 10 L22 18 L26 10 L30 18", 3, 1.3, 0.8)
    a.line(40, 70, 86, 70, 3, 1.4)
    for x in (44, 56, 68, 80):
        a.line(x, 66, x, 74, 6, 1.4)
    a.ground(88)
    return a


@item("Cooking Pot Stand")
def _():
    a = Art()
    a.path("M22 44 L78 44", 0, 2.4)
    a.path("M26 44 L22 78 M74 44 L78 78", 0, 2.4)
    a.path("M26 44 Q50 54 74 44", 3, 1.2, 0.6)
    pot(a, 50, 26, 30, 16, 6, 2.0)
    a.line(22, 66, 78, 66, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Three Leg Pot Stand")
def _():
    a = Art()
    a.ellipse(50, 40, 28, 7, 0, 2.2)
    a.line(24, 42, 18, 80, 0, 2.4)
    a.line(76, 42, 82, 80, 0, 2.4)
    a.line(50, 47, 50, 82, 0, 2.4)
    pot(a, 50, 18, 28, 16, 6, 2.0)
    fire(a, 50, 86, 2, 6, 6)
    a.ground(90)
    return a


@item("Adjustable Pot Trivet")
def _():
    a = Art()
    a.path("M20 44 L80 44", 0, 2.4)
    for x in (24, 76):
        a.line(x, 44, x, 78, 0, 2.2)
        a.line(x - 3, 56, x + 3, 56, 6, 2.0)
        a.line(x - 3, 62, x + 3, 62, 6, 1.4, 0.7)
    a.rect(32, 44, 36, 5, 6, 1.6)
    arrow(a, 50, 56, 50, 66, 3, 1.3, 0.7, 3)
    pot(a, 50, 22, 26, 14, 6, 2.0)
    a.ground(88)
    return a


@item("Folding Pot Stand")
def _():
    a = Art()
    a.line(26, 40, 14, 80, 0, 2.4)
    a.line(74, 40, 86, 80, 0, 2.4)
    a.line(26, 40, 40, 80, 0, 2.0, 0.8)
    a.line(74, 40, 60, 80, 0, 2.0, 0.8)
    a.line(22, 40, 78, 40, 0, 2.4)
    a.circle(26, 40, 2.4, 6, 1.4)
    a.circle(74, 40, 2.4, 6, 1.4)
    a.path("M44 60 A8 8 0 0 1 56 60", 3, 1.2, 0.7)
    pot(a, 50, 20, 28, 14, 6, 2.0)
    a.ground(90)
    return a


@item("Lidded Stew Pot")
def _():
    a = Art()
    pot(a, 50, 40, 44, 34, 0, 2.4, True)
    a.path("M30 52 L70 52", 3, 1.0, 0.5)
    for x in (38, 52, 62):
        a.path(f"M{x} 22 Q{x + 3} 14 {x} 8", 3, 1.2, 0.55)
    a.ground(90)
    return a


@item("Sealed Slow Cooker Pot")
def _():
    a = Art()
    a.path("M20 44 Q18 72 50 76 Q82 72 80 44 Z", 0, 2.4)
    a.path("M16 44 L84 44", 0, 2.4)
    a.path("M20 44 Q50 22 80 44", 6, 2.2)
    a.circle(50, 28, 2.4, 6, 1.5)
    a.path("M20 56 L80 56", 3, 1.0, 0.45)
    a.path("M20 74 L80 74 L76 82 L24 82 Z", 0, 2.0)
    a.circle(30, 78, 1.5, 6, 1.1)
    a.path("M12 50 q-4 0 -4 6 M88 50 q4 0 4 6", 6, 1.6)
    a.ground(90)
    return a


@item("Insulated Cooking Pot")
def _():
    a = Art()
    pot(a, 50, 38, 44, 36, 0, 2.4, True)
    a.path("M30 42 Q28 70 50 76 Q72 70 70 42", 3, 1.2, 0.55)
    a.path("M34 48 Q50 54 66 48", 3, 1.0, 0.5)
    a.ellipse(50, 38, 18, 4.6, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Thermal Retention Cooker")
def _():
    a = Art()
    a.path("M18 38 L82 38 L82 78 L18 78 Z", 0, 2.4)
    a.ellipse(50, 38, 32, 7, 0, 2.2)
    a.rect(24, 46, 52, 26, 3, 1.4, 0.6)
    a.path("M30 36 Q50 20 70 36", 6, 2.0)
    a.circle(50, 24, 2.4, 6, 1.4)
    pot(a, 50, 52, 24, 14, 6, 1.6)
    for x in (30, 42, 54, 66):
        a.line(x, 74, x + 1, 74, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Grain Grinding Set")
def _():
    a = Art()
    a.path("M16 60 Q18 76 50 78 Q82 76 84 60 Z", 0, 2.4)
    a.ellipse(50, 60, 34, 8, 0, 2.2)
    a.line(66, 18, 46, 56, 6, 3.0)
    a.circle(68, 15, 4, 6, 1.8)
    a.dots([(34, 62), (44, 64), (58, 62), (66, 64)], 1.3, 3)
    a.path("M26 60 Q50 70 74 60", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Rotary Hand Mill")
def _():
    a = Art()
    a.ellipse(50, 56, 34, 9, 0, 2.4)
    a.path("M16 56 L16 64 Q50 78 84 64 L84 56", 0, 2.4)
    a.ellipse(50, 46, 28, 7.5, 6, 2.2)
    a.path("M22 46 L22 52 Q50 62 78 52 L78 46", 6, 2.0)
    a.circle(50, 42, 4, 6, 1.4)
    a.line(66, 44, 66, 24, 6, 2.2)
    a.circle(66, 22, 3, 6, 1.6)
    a.path("M62 58 L74 70", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Geared Grain Mill")
def _():
    a = Art()
    a.circle(34, 52, 20, 0, 2.4)
    a.circle(34, 52, 8, 3, 1.2, 0.7)
    a.path(gear_d(70, 38, 14, 10.5, 12), 0, 2.0)
    a.circle(70, 38, 3, 6, 1.4)
    a.line(70, 38, 70, 12, 6, 2.2)
    a.line(62, 12, 78, 12, 6, 2.2)
    a.path(gear_d(66, 70, 9, 6.6, 8, 0.3), 0, 1.8)
    a.dots([(20, 80), (30, 82), (40, 80)], 1.3, 3)
    a.ground(90)
    return a


@item("Fireplace Hood")
def _():
    a = Art()
    a.path("M20 70 L20 40 L36 22 L64 22 L80 40 L80 70", 0, 2.4)
    a.path("M30 70 L30 46 L40 34 L60 34 L70 46 L70 70", 3, 1.2, 0.6)
    fire(a, 50, 72, 3, 6, 9)
    a.line(14, 70, 86, 70, 0, 2.4)
    a.line(44, 22, 44, 10, 0, 2.2)
    a.line(56, 22, 56, 10, 0, 2.2)
    a.ground(86)
    return a


@item("Smoke Flue Hood")
def _():
    a = Art()
    a.path("M16 70 L16 46 L38 26 L62 26 L84 46 L84 70", 0, 2.4)
    a.rect(42, 8, 16, 18, 0, 2.2)
    a.line(46, 12, 46, 24, 3, 1.0, 0.5)
    a.line(54, 12, 54, 24, 3, 1.0, 0.5)
    arrow(a, 50, 42, 50, 28, 3, 1.4, 0.7, 3)
    fire(a, 50, 72, 3, 6, 8)
    a.line(10, 70, 90, 70, 0, 2.4)
    a.ground(86)
    return a


@item("Ventilated Chimney Hood")
def _():
    a = Art()
    a.path("M18 74 L18 50 L36 32 L64 32 L82 50 L82 74", 0, 2.4)
    a.rect(42, 8, 16, 24, 0, 2.2)
    a.rect(38, 4, 24, 6, 6, 2.0)
    for x in (24, 38, 52, 66):
        a.line(x, 56, x + 4, 56, 3, 1.2, 0.8)
    a.path("M24 62 L76 62", 3, 1.0, 0.45)
    fire(a, 50, 76, 3, 6, 8)
    arrow(a, 50, 40, 50, 24, 3, 1.3, 0.7, 3)
    a.ground(88)
    return a


@item("Forced Draft Kitchen Hood")
def _():
    a = Art()
    a.path("M14 46 L86 46 L72 24 L28 24 Z", 0, 2.4)
    a.circle(50, 34, 8, 6, 1.6)
    for k in range(4):
        t = math.pi / 2 * k
        a.line(50, 34, 50 + 7 * math.cos(t + 0.5), 34 + 7 * math.sin(t + 0.5), 6, 1.4)
    a.rect(42, 4, 16, 20, 0, 2.2)
    arrow(a, 50, 56, 50, 48, 3, 1.4, 0.7, 3)
    a.rect(22, 68, 56, 8, 0, 2.2)
    a.ellipse(40, 66, 8, 2.6, 6, 1.4)
    a.ellipse(62, 66, 8, 2.6, 6, 1.4)
    a.path("M36 56 Q40 52 44 56 M58 56 Q62 52 66 56", 3, 1.2, 0.55)
    a.ground(88)
    return a
