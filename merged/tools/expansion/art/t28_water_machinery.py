"""Topic 28 - water machinery (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, gear_d, n, wave_d
from .kit import droplet, sparkle
from .registry import item, topic

topic("water machinery")


def water(a, x0, x1, y, z=3, o=0.6):
    a.path(wave_d(x0, x1, y, 1.6, 9), z, 1.2, o)


def wheel(a, cx, cy, r, blades=10, z=0, w=2.4, paddle=7):
    a.circle(cx, cy, r, z, w)
    a.circle(cx, cy, r - paddle, z, 1.4, 0.8)
    a.circle(cx, cy, 3, 6, 1.6)
    for k in range(blades):
        t = 2 * math.pi * k / blades
        a.line(cx + (r - paddle) * math.cos(t), cy + (r - paddle) * math.sin(t), cx + r * math.cos(t), cy + r * math.sin(t), z, 1.6)
        a.line(cx + r * math.cos(t), cy + r * math.sin(t), cx + r * math.cos(t + 0.3), cy + r * math.sin(t + 0.3), z, 1.8)


def stone(a, cx, cy, rx=24, h=8, z=0, w=2.4):
    a.ellipse(cx, cy, rx, rx * 0.28, z, w)
    a.path(f"M{cx - rx} {cy} L{cx - rx} {cy + h} Q{cx} {cy + h + rx * 0.5} {cx + rx} {cy + h} L{cx + rx} {cy}", z, w)
    a.ellipse(cx, cy, rx * 0.18, rx * 0.05, 6, 1.4)


def piston(a, x, y0, y1, w=14, z=0):
    a.rect(x - w / 2, y0, w, y1 - y0, z, 2.4)
    a.line(x, y0 - 14, x, y0 + 8, 6, 2.4)
    a.rect(x - w / 2 + 1, y0 + 8, w - 2, 5, 6, 1.6)


def pipe(a, pts, z=0, w=2.4):
    a.poly(pts, z, w)


@item("Hydraulic Mill Components")
def _():
    a = Art()
    wheel(a, 30, 48, 18, 8, 0)
    a.path(gear_d(66, 40, 12, 9, 10), 0, 2.0)
    a.circle(66, 40, 3, 6, 1.4)
    stone(a, 70, 66, 16, 6, 0)
    a.line(30, 48, 66, 40, 3, 1.2, 0.5)
    water(a, 6, 40, 78)
    a.ground(90)
    return a


@item("Paddle Waterwheel")
def _():
    a = Art()
    wheel(a, 50, 42, 26, 12, 0)
    a.path("M10 66 L90 66", 0, 2.0)
    water(a, 8, 92, 62, 3, 0.8)
    water(a, 12, 88, 70, 3, 0.5)
    a.line(50, 42, 50, 74, 3, 1.0, 0.4)
    arrow(a, 76, 76, 90, 76, 3, 1.3, 0.7, 3)
    a.ground(90)
    return a


@item("Undershot Waterwheel")
def _():
    a = Art()
    wheel(a, 50, 38, 24, 12, 0)
    a.path("M4 62 L30 62 L36 66 L66 66 L72 62 L96 62", 0, 2.2)
    water(a, 6, 94, 64, 3, 0.8)
    arrow(a, 8, 52, 26, 56, 3, 1.4, 0.7, 3)
    a.line(50, 62, 50, 76, 0, 2.0)
    a.line(40, 76, 60, 76, 0, 2.0)
    a.ground(90)
    return a


@item("Overshot Waterwheel")
def _():
    a = Art()
    wheel(a, 56, 52, 24, 12, 0)
    a.path("M6 24 L42 24 L46 30", 0, 2.2)
    a.path("M6 30 L40 30", 3, 1.0, 0.5)
    water(a, 10, 40, 27, 3, 0.8)
    droplet(a, 44, 36, 2.6)
    droplet(a, 46, 44, 2.2)
    a.path("M30 78 L90 78", 0, 2.0)
    water(a, 40, 90, 74)
    a.ground(90)
    return a


@item("Breastshot Waterwheel")
def _():
    a = Art()
    wheel(a, 54, 46, 24, 12, 0)
    a.path("M4 44 L28 44 Q42 46 46 60", 0, 2.2)
    water(a, 6, 28, 47, 3, 0.8)
    a.path("M46 60 L96 60", 3, 1.2, 0.5)
    water(a, 48, 94, 66, 3, 0.7)
    a.line(54, 70, 54, 80, 0, 2.0)
    a.ground(90)
    return a


@item("Millstone Runner")
def _():
    a = Art()
    stone(a, 50, 38, 32, 16, 0, 2.6)
    a.circle(50, 38, 2, 6, 1.4)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.line(50 + 6 * math.cos(t), 38 + 1.7 * math.sin(t), 50 + 26 * math.cos(t), 38 + 7.3 * math.sin(t), 3, 1.0, 0.7)
    a.path("M20 66 L80 66", 3, 1.0, 0.45)
    a.line(50, 24, 50, 14, 6, 2.2)
    a.ground(88)
    return a


@item("Water Driven Millstone")
def _():
    a = Art()
    wheel(a, 24, 54, 18, 8, 0)
    a.line(24, 54, 62, 54, 0, 2.4)
    stone(a, 70, 42, 20, 8, 0)
    stone(a, 70, 54, 20, 8, 0)
    a.line(70, 28, 70, 40, 6, 2.0)
    a.path("M60 22 L80 22 L76 30 L64 30 Z", 6, 1.8)
    water(a, 4, 40, 78)
    a.ground(90)
    return a


@item("Adjustable Grain Mill")
def _():
    a = Art()
    stone(a, 50, 56, 28, 8, 0)
    stone(a, 50, 44, 28, 8, 0)
    a.path("M36 20 L64 20 L58 32 L42 32 Z", 0, 2.2)
    a.line(50, 14, 50, 20, 6, 2.0)
    a.path("M82 40 L92 40 M82 52 L92 52", 6, 1.6)
    arrow(a, 88, 56, 88, 46, 3, 1.4, 0.8, 3)
    a.line(76, 66, 84, 74, 6, 2.0)
    a.circle(86, 76, 3, 6, 1.4)
    a.ground(90)
    return a


@item("Automatic Roller Mill")
def _():
    a = Art()
    a.path("M30 14 L70 14 L60 30 L40 30 Z", 0, 2.2)
    a.circle(40, 44, 9, 0, 2.4)
    a.circle(60, 44, 9, 0, 2.4)
    a.circle(40, 44, 2, 6, 1.4)
    a.circle(60, 44, 2, 6, 1.4)
    a.circle(40, 64, 9, 0, 2.4)
    a.circle(60, 64, 9, 0, 2.4)
    a.path("M30 76 L70 76 L66 86 L34 86 Z", 0, 2.2)
    a.path(gear_d(84, 54, 8, 5.8, 8), 0, 1.8)
    a.line(49, 44, 76, 54, 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Wooden Pump Piston")
def _():
    a = Art()
    a.rect(38, 14, 24, 56, 0, 2.6)
    a.line(50, 6, 50, 36, 6, 2.6)
    a.rect(40, 36, 20, 8, 6, 2.4)
    a.line(40, 40, 60, 40, 3, 1.0, 0.6)
    a.path("M38 70 L62 70 L66 80 L34 80 Z", 0, 2.2)
    a.path("M42 54 Q50 58 58 54", 6, 1.2, 0.7)
    droplet(a, 78, 40, 3.2)
    a.ground(90)
    return a


@item("Reciprocating Water Pump")
def _():
    a = Art()
    piston(a, 36, 28, 62, 18, 0)
    a.path("M36 62 L36 76 L76 76 L76 40", 0, 2.4)
    a.path("M70 40 L82 40 L82 34 L70 34", 6, 2.0)
    a.line(36, 14, 60, 14, 6, 2.2)
    a.line(60, 14, 60, 24, 3, 1.4)
    a.circle(60, 26, 3, 6, 1.4)
    droplet(a, 88, 40, 3)
    water(a, 10, 40, 84)
    a.ground(92)
    return a


@item("Double Acting Water Pump")
def _():
    a = Art()
    a.rect(24, 34, 52, 22, 0, 2.6)
    a.line(50, 34, 50, 56, 6, 2.0)
    a.rect(44, 38, 12, 14, 6, 2.2)
    a.line(76, 44, 90, 44, 6, 2.6)
    a.circle(92, 44, 3, 6, 1.4)
    a.path("M24 40 L14 40 L14 20 L28 20 M76 50 L84 50 L84 20 L70 20", 0, 2.0)
    a.path("M30 56 L30 72 L70 72 L70 56", 0, 2.0)
    a.line(14, 20, 84, 20, 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Multi Stage Piston Pump")
def _():
    a = Art()
    for x in (24, 50, 76):
        a.rect(x - 8, 40, 16, 32, 0, 2.4)
        a.line(x, 24, x, 48, 6, 2.2)
        a.rect(x - 6, 48, 12, 5, 6, 1.6)
    a.line(18, 24, 82, 24, 6, 2.6)
    a.path("M24 72 L24 80 L76 80 L76 72", 0, 2.0)
    a.path("M32 56 L42 56 M58 56 L68 56", 3, 1.4, 0.7)
    a.circle(50, 24, 3, 6, 1.4)
    a.ground(90)
    return a


@item("Water Turbine Runner")
def _():
    a = Art()
    a.circle(50, 48, 30, 0, 2.4)
    a.circle(50, 48, 6, 6, 1.8)
    for k in range(10):
        t = 2 * math.pi * k / 10
        a.path(f"M{n(50 + 6 * math.cos(t))} {n(48 + 6 * math.sin(t))} Q{n(50 + 18 * math.cos(t + 0.5))} {n(48 + 18 * math.sin(t + 0.5))} {n(50 + 30 * math.cos(t + 0.2))} {n(48 + 30 * math.sin(t + 0.2))}", 6, 1.8)
    a.circle(50, 48, 22, 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Impulse Turbine")
def _():
    a = Art()
    a.circle(52, 46, 24, 0, 2.2)
    for k in range(12):
        t = 2 * math.pi * k / 12
        x, y = 52 + 24 * math.cos(t), 46 + 24 * math.sin(t)
        a.path(f"M{n(x)} {n(y)} q{n(4 * math.cos(t + 0.8))} {n(4 * math.sin(t + 0.8))} {n(6 * math.cos(t))} {n(6 * math.sin(t))}", 6, 1.6)
        a.path(f"M{n(x)} {n(y)} q{n(4 * math.cos(t - 0.8))} {n(4 * math.sin(t - 0.8))} {n(6 * math.cos(t))} {n(6 * math.sin(t))}", 6, 1.6)
    a.circle(52, 46, 4, 6, 1.6)
    a.path("M4 74 L30 66 L34 70 L4 80 Z", 0, 2.0)
    a.line(32, 68, 46, 66, 3, 1.8, 0.8)
    droplet(a, 76, 74, 3.2)
    a.ground(90)
    return a


@item("Francis Turbine")
def _():
    a = Art()
    a.path("M12 48 Q12 18 50 18 Q88 18 88 48 Q88 78 50 78 Q12 78 12 48 Z", 0, 2.4)
    a.circle(50, 48, 14, 6, 2.0)
    for k in range(8):
        t = 2 * math.pi * k / 8
        a.path(f"M{n(50 + 14 * math.cos(t))} {n(48 + 14 * math.sin(t))} Q{n(50 + 22 * math.cos(t + 0.4))} {n(48 + 22 * math.sin(t + 0.4))} {n(50 + 28 * math.cos(t + 0.1))} {n(48 + 28 * math.sin(t + 0.1))}", 3, 1.4, 0.8)
    a.circle(50, 48, 3, 6, 1.4)
    a.path("M4 40 L14 40 M4 50 L14 50", 3, 1.4, 0.6)
    a.ground(88)
    return a


@item("Adjustable Kaplan Turbine")
def _():
    a = Art()
    a.path("M14 26 L86 26 M14 70 L86 70", 0, 2.4)
    a.line(14, 26, 14, 36, 0, 2.4)
    a.line(14, 60, 14, 70, 0, 2.4)
    a.line(50, 26, 50, 70, 0, 2.6)
    for (y, ang) in ((34, 20), (48, 0), (62, -20)):
        a.path(f"M50 {y} L{50 + 20 * math.cos(math.radians(ang))} {y - 6}", 6, 2.4)
        a.path(f"M50 {y} L{50 - 20 * math.cos(math.radians(ang))} {y + 6}", 6, 2.4)
    a.circle(50, 48, 6, 6, 1.6)
    arrow(a, 20, 48, 36, 48, 3, 1.3, 0.7, 3)
    a.path("M80 34 A14 14 0 0 1 88 52", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Water Ram Chamber")
def _():
    a = Art()
    a.path("M30 78 L30 40 Q30 28 50 28 Q70 28 70 40 L70 78 Z", 0, 2.6)
    a.path("M36 60 L64 60", 3, 1.0, 0.5)
    a.path("M20 78 L80 78", 0, 2.4)
    a.path("M40 40 Q44 34 50 36", 6, 1.4, 0.7)
    a.circle(50, 46, 3, 6, 1.4)
    water(a, 34, 66, 68, 3, 0.8)
    droplet(a, 80, 50, 3)
    a.ground(90)
    return a


@item("Hydraulic Ram Pump")
def _():
    a = Art()
    a.path("M14 30 L30 38 L30 62", 0, 2.4)
    a.path("M14 40 L24 44", 3, 1.0, 0.5)
    a.rect(30, 56, 26, 14, 0, 2.4)
    a.path("M56 62 L82 62 L82 30", 0, 2.4)
    a.path("M44 56 L44 44 Q44 36 52 36 Q60 36 60 44 L60 56", 0, 2.2)
    a.circle(42, 63, 3, 6, 1.6)
    droplet(a, 90, 24, 3.2)
    arrow(a, 76, 30, 88, 22, 3, 1.3, 0.7, 3)
    water(a, 4, 24, 28)
    a.ground(86)
    return a


@item("Multi Impulse Ram Pump")
def _():
    a = Art()
    a.path("M8 36 L30 44 L30 62", 0, 2.4)
    for x in (40, 62):
        a.rect(x, 56, 16, 14, 0, 2.4)
        a.path(f"M{x + 2} 56 L{x + 2} 44 Q{x + 2} 36 {x + 8} 36 Q{x + 14} 36 {x + 14} 44 L{x + 14} 56", 0, 2.0)
        a.circle(x + 8, 63, 2.6, 6, 1.4)
    a.line(30, 62, 40, 62, 0, 2.2)
    a.path("M78 62 L90 62 L90 28", 0, 2.4)
    droplet(a, 90, 22, 3)
    a.ground(86)
    return a


@item("High Head Ram Pump")
def _():
    a = Art()
    a.path("M12 12 L12 56 L30 62", 0, 2.4)
    a.line(8, 12, 20, 12, 0, 2.0)
    a.rect(30, 56, 24, 16, 0, 2.4)
    a.path("M42 56 L42 40 Q42 32 50 32 Q58 32 58 40 L58 56", 0, 2.2)
    a.path("M54 64 L84 64 L84 22", 0, 2.4)
    a.circle(40, 64, 3, 6, 1.6)
    a.line(14, 24, 14, 50, 3, 1.0, 0.5)
    arrow(a, 18, 28, 18, 46, 3, 1.3, 0.7, 3)
    droplet(a, 84, 16, 3)
    a.ground(86)
    return a


@item("Irrigation Scoop Wheel")
def _():
    a = Art()
    a.circle(50, 44, 28, 0, 2.4)
    a.circle(50, 44, 4, 6, 1.6)
    for k in range(8):
        t = 2 * math.pi * k / 8
        x, y = 50 + 28 * math.cos(t), 44 + 28 * math.sin(t)
        a.line(50, 44, x, y, 3, 1.4, 0.8)
        a.path(f"M{n(x)} {n(y)} l{n(7 * math.cos(t + 1.2))} {n(7 * math.sin(t + 1.2))} l{n(-3 * math.cos(t))} {n(-3 * math.sin(t))}", 6, 1.8)
    water(a, 6, 94, 76)
    a.path("M70 26 L90 20", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Sakia Water Wheel")
def _():
    a = Art()
    a.path(gear_d(30, 36, 18, 14, 14), 0, 2.2)
    a.circle(30, 36, 3, 6, 1.4)
    a.circle(66, 52, 24, 0, 2.4)
    for k in range(6):
        t = 2 * math.pi * k / 6
        x, y = 66 + 24 * math.cos(t), 52 + 24 * math.sin(t)
        a.line(66, 52, x, y, 3, 1.3, 0.8)
        a.path(f"M{n(x - 3)} {n(y - 3)} l6 0 l-1 6 l-4 0 Z", 6, 1.5)
    a.circle(66, 52, 4, 6, 1.6)
    a.line(30, 36, 66, 52, 3, 1.0, 0.5)
    water(a, 40, 94, 82)
    a.ground(92)
    return a


@item("Chain Of Pots Lift")
def _():
    a = Art()
    a.circle(50, 20, 8, 0, 2.2)
    a.circle(50, 76, 8, 0, 2.2)
    a.line(42, 20, 42, 76, 0, 1.6)
    a.line(58, 20, 58, 76, 0, 1.6)
    for y in range(30, 72, 10):
        a.path(f"M{36} {y} Q{34} {y + 8} {42} {y + 8} L42 {y}", 6, 1.6)
        a.path(f"M{64} {y + 8} Q{66} {y} {58} {y} L58 {y + 8}", 6, 1.6)
    a.path("M70 14 L86 14 L86 24", 0, 2.0)
    droplet(a, 78, 24, 2.6)
    water(a, 10, 90, 86)
    a.ground(92)
    return a


@item("Mechanized Water Lift")
def _():
    a = Art()
    a.rect(14, 50, 30, 26, 0, 2.4)
    a.circle(29, 63, 8, 6, 1.8)
    a.circle(29, 63, 2.4, 3, 1.2)
    a.path(gear_d(64, 40, 12, 9, 10), 0, 2.0)
    a.circle(64, 40, 3, 6, 1.4)
    a.line(44, 56, 56, 44, 3, 1.4, 0.8)
    a.path("M76 40 L90 40 L90 20", 0, 2.4)
    a.path("M64 52 L64 82 L90 82", 0, 2.4)
    droplet(a, 90, 14, 3)
    a.path("M20 38 Q24 30 28 38", 3, 1.2, 0.55)
    a.ground(92)
    return a
