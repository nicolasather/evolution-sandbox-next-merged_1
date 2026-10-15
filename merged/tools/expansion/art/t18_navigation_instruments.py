"""Topic 18 - navigation instruments (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("navigation instruments")


def sun(a, cx, cy, r=5, z=6):
    a.circle(cx, cy, r, z, 1.6)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.line(cx + (r + 2) * math.cos(t), cy + (r + 2) * math.sin(t), cx + (r + 5) * math.cos(t), cy + (r + 5) * math.sin(t), z, 1.2)


def dial(a, cx, cy, r, z=0, w=2.2, ticks=16):
    a.circle(cx, cy, r, z, w)
    for k in range(ticks):
        t = 2 * math.pi * k / ticks
        L = 3 if k % 4 == 0 else 1.8
        a.line(cx + (r - L) * math.cos(t), cy + (r - L) * math.sin(t), cx + r * math.cos(t), cy + r * math.sin(t), 3, 1.0, 0.7)


def needle(a, cx, cy, r, ang, z=6, w=2.0):
    t = math.radians(ang)
    a.path(f"M{n(cx + r * math.cos(t))} {n(cy + r * math.sin(t))} L{n(cx + 3 * math.cos(t + 1.57))} {n(cy + 3 * math.sin(t + 1.57))} L{n(cx - r * 0.7 * math.cos(t))} {n(cy - r * 0.7 * math.sin(t))} L{n(cx - 3 * math.cos(t + 1.57))} {n(cy - 3 * math.sin(t + 1.57))} Z", z, w)


def stars(a, pts, z=6):
    for (x, y) in pts:
        sparkle(a, x, y, 2.4, z, 0.9)


def scale_arc(a, cx, cy, r, a0, a1, ticks=12, z=3):
    a.path(f"M{n(cx + r * math.cos(math.radians(a0)))} {n(cy + r * math.sin(math.radians(a0)))} A{r} {r} 0 0 1 {n(cx + r * math.cos(math.radians(a1)))} {n(cy + r * math.sin(math.radians(a1)))}", z, 1.4)
    for k in range(ticks + 1):
        t = math.radians(a0 + (a1 - a0) * k / ticks)
        a.line(cx + (r - 2.4) * math.cos(t), cy + (r - 2.4) * math.sin(t), cx + r * math.cos(t), cy + r * math.sin(t), z, 0.9, 0.7)


def board(a, x, y, w, h, z=0, wd=2.2):
    a.rect(x, y, w, h, z, wd)


def screen(a, x, y, w, h, z=0, wd=2.2):
    a.rect(x, y, w, h, z, wd, None, 3)
    a.rect(x + 3, y + 3, w - 6, h - 6, 3, 1.0, 0.6)


@item("Navigation Observation Kit")
def _():
    a = Art()
    a.rect(14, 38, 72, 38, 0, 2.4, None, 3)
    a.line(14, 48, 86, 48, 3, 1.0, 0.6)
    a.circle(30, 62, 7, 6, 1.6)
    a.line(30, 62, 30, 56, 6, 1.2)
    a.path("M46 54 L72 54 L72 72 L46 72 Z", 6, 1.4)
    a.line(52, 60, 66, 60, 3, 1.0, 0.6)
    a.line(52, 66, 62, 66, 3, 1.0, 0.6)
    a.path("M40 38 L40 30 L60 30 L60 38", 0, 1.8)
    sun(a, 78, 20, 5)
    a.ground(88)
    return a


@item("Shadow Measuring Rod")
def _():
    a = Art()
    a.line(40, 20, 40, 72, 0, 2.6)
    a.line(40, 72, 86, 72, 3, 1.8)
    for x in range(46, 86, 8):
        a.line(x, 70, x, 74, 3, 1.0, 0.7)
    a.circle(40, 18, 2.4, 6, 1.4)
    sun(a, 16, 20, 6)
    a.line(22, 26, 40, 20, 3, 1.0, 0.45)
    a.line(40, 72, 66, 72, 6, 2.6)
    a.ground(88)
    return a


@item("Portable Gnomon")
def _():
    a = Art()
    a.path("M20 72 L80 72 L80 78 L20 78 Z", 0, 2.2)
    a.path("M36 72 L36 36 L44 36 L44 72", 0, 2.2)
    for x in range(26, 78, 8):
        a.line(x, 72, x, 68, 3, 1.0, 0.6)
    a.path("M44 72 L72 72 L44 40 Z", 3, 1.2, 0.6)
    a.path("M52 28 L58 22 M60 34 L68 30", 3, 1.0, 0.5)
    sun(a, 78, 22, 5)
    a.ground(90)
    return a


@item("Latitude Gnomon Board")
def _():
    a = Art()
    a.rect(14, 28, 72, 48, 0, 2.4)
    scale_arc(a, 24, 70, 40, -80, -2, 10, 3)
    a.line(24, 70, 58, 50, 6, 2.2)
    a.line(24, 70, 24, 36, 0, 2.0)
    a.circle(24, 70, 2.4, 6, 1.4)
    sun(a, 76, 20, 4.4)
    a.path("M30 62 L70 62", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Calibrated Sundial")
def _():
    a = Art()
    a.ellipse(50, 56, 36, 14, 0, 2.4)
    a.ellipse(50, 56, 28, 10, 3, 1.0, 0.6)
    for k in range(-5, 6):
        t = math.pi * (0.5 + k * 0.12)
        a.line(50 + 20 * math.cos(t), 56 - 8 * math.sin(t), 50 + 28 * math.cos(t), 56 - 10 * math.sin(t), 3, 1.0, 0.7)
    a.path("M50 56 L50 28 L66 56 Z", 6, 2.0)
    a.path("M50 56 L50 28", 3, 1.4)
    sun(a, 80, 16, 5)
    a.path("M14 70 Q50 82 86 70", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Magnetized Compass Needle")
def _():
    a = Art()
    needle(a, 50, 50, 32, -45, 0, 2.2)
    a.path("M26 66 L50 50", 3, 1.0, 0.4)
    a.circle(50, 50, 2.4, 6, 1.4)
    a.path("M12 20 L28 20 M20 12 L20 28", 3, 1.2, 0.6)
    a.path("M70 70 L84 70 M70 78 L84 78", 3, 1.2, 0.6)
    a.path("M16 40 Q30 36 40 44", 3, 1.0, 0.45)
    a.path("M70 22 A12 12 0 0 1 82 34", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Floating Compass")
def _():
    a = Art()
    a.path("M20 40 L28 76 L72 76 L80 40", 0, 2.4)
    a.ellipse(50, 40, 30, 9, 0, 2.4)
    a.path("M26 52 Q50 58 74 52", 3, 1.2, 0.8)
    a.path("M30 42 L70 38", 6, 2.2)
    a.path("M70 38 L64 36 M70 38 L66 42", 6, 1.4)
    a.circle(50, 40, 2, 6, 1.2)
    a.ground(90)
    return a


@item("Gimballed Compass Bowl")
def _():
    a = Art()
    a.circle(50, 48, 30, 0, 2.4)
    a.circle(50, 48, 22, 0, 1.6)
    dial(a, 50, 48, 20, 3, 1.0, 16)
    needle(a, 50, 48, 16, -50, 6, 1.8)
    a.line(14, 48, 20, 48, 6, 2.0)
    a.line(80, 48, 86, 48, 6, 2.0)
    a.line(50, 12, 50, 18, 6, 2.0)
    a.line(50, 78, 50, 84, 6, 2.0)
    a.rect(44, 84, 12, 4, 0, 1.6)
    a.ground(92)
    return a


@item("Liquid Damped Compass")
def _():
    a = Art()
    a.path("M16 40 L22 72 Q50 82 78 72 L84 40", 0, 2.4)
    a.ellipse(50, 40, 34, 10, 0, 2.4)
    a.path("M20 52 Q30 48 40 52 T60 52 T80 52", 3, 1.2, 0.7)
    dial(a, 50, 40, 12, 3, 1.0, 12)
    needle(a, 50, 40, 10, -40, 6, 1.6)
    for (x, y) in ((30, 62), (40, 66), (60, 66)):
        a.circle(x, y, 1.4, 6, 1.0)
    a.ground(90)
    return a


@item("Sighted Measuring Staff")
def _():
    a = Art()
    a.line(10, 62, 90, 40, 0, 2.6)
    for k in range(10):
        t = k / 9
        x = 14 + 72 * t
        y = 61 - 21 * t
        a.line(x, y, x - 1.4, y - 5 - (k % 2) * 2, 3, 1.0, 0.7)
    a.rect(60, 36, 10, 6, 6, 1.6)
    a.circle(30, 50, 3, 6, 1.4)
    a.path("M30 72 L70 60", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Cross Staff")
def _():
    a = Art()
    a.line(12, 62, 88, 62, 0, 2.6)
    a.line(66, 38, 66, 86, 0, 2.2)
    for k in range(8):
        a.line(16 + k * 9, 62, 16 + k * 9, 66, 3, 1.0, 0.7)
    a.circle(10, 62, 3, 6, 1.6)
    a.path("M10 62 L66 40", 3, 1.0, 0.5)
    a.path("M10 62 L66 84", 3, 1.0, 0.5)
    sun(a, 82, 24, 5)
    a.ground(90)
    return a


@item("Backstaff")
def _():
    a = Art()
    a.line(10, 70, 78, 70, 0, 2.4)
    scale_arc(a, 78, 70, 34, 180, 250, 8, 3)
    a.path("M78 70 L50 40", 0, 2.2)
    a.path("M44 70 Q44 54 52 46", 0, 2.0)
    a.rect(74, 64, 8, 8, 6, 1.6)
    a.circle(52, 40, 3, 6, 1.4)
    sun(a, 78, 22, 5)
    a.line(10, 70, 10, 62, 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Vernier Sextant")
def _():
    a = Art()
    a.path("M50 14 L20 76 Q50 88 80 76 Z", 0, 2.4)
    scale_arc(a, 50, 14, 62, 62, 118, 14, 3)
    a.line(50, 14, 62, 70, 6, 2.0)
    a.circle(50, 14, 2.6, 6, 1.4)
    a.rect(26, 40, 8, 6, 6, 1.4)
    a.rect(60, 34, 10, 8, 6, 1.4)
    a.path("M62 70 L72 70", 3, 1.4, 0.7)
    a.path("M36 64 Q50 72 64 64", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Star Position Table")
def _():
    a = Art()
    a.rect(14, 18, 72, 62, 0, 2.2)
    for y in (32, 46, 60):
        a.line(14, y, 86, y, 3, 1.0, 0.6)
    for x in (38, 62):
        a.line(x, 18, x, 80, 3, 1.0, 0.6)
    stars(a, [(26, 25), (26, 39), (26, 53), (26, 67)], 6)
    for y in (25, 39, 53, 67):
        a.line(42, y, 56, y, 3, 1.2, 0.7)
        a.line(66, y, 80, y, 3, 1.2, 0.7)
    a.ground(90)
    return a


@item("Hand Drawn Star Chart")
def _():
    a = Art()
    a.circle(50, 48, 34, 0, 2.2)
    a.circle(50, 48, 24, 3, 1.0, 0.5)
    pts = [(36, 34), (46, 40), (56, 36), (66, 44), (60, 56), (44, 62), (34, 54)]
    a.poly(pts, 3, 1.0, 0.7)
    stars(a, pts, 6)
    a.path("M50 14 L50 82 M16 48 L84 48", 3, 1.0, 0.35)
    a.ground(90)
    return a


@item("Navigation Almanac")
def _():
    a = Art()
    a.path("M16 22 L48 18 L48 76 L16 80 Z", 0, 2.2)
    a.path("M48 18 L84 22 L84 80 L48 76", 0, 2.2)
    for y in (30, 40, 50, 60):
        a.line(22, y - 1, 42, y - 3, 3, 1.0, 0.55)
        a.line(54, y - 3, 78, y - 1, 3, 1.0, 0.55)
    sparkle(a, 66, 66, 3.4, 6, 0.9)
    a.circle(28, 66, 4, 6, 1.4)
    a.line(48, 18, 48, 76, 6, 1.6)
    a.ground(90)
    return a


@item("Digital Nautical Almanac")
def _():
    a = Art()
    screen(a, 22, 20, 56, 52, 0, 2.4)
    for y in (32, 40, 48):
        a.line(28, y, 72, y, 3, 1.0, 0.55)
    sparkle(a, 62, 58, 3, 6, 0.9)
    a.circle(34, 60, 3, 6, 1.4)
    a.line(40, 80, 60, 80, 0, 2.2)
    a.line(50, 72, 50, 80, 0, 2.0)
    a.ground(90)
    return a


@item("Depth Sounding Line")
def _():
    a = Art()
    a.line(10, 30, 90, 30, 0, 2.2)
    a.path("M30 30 Q34 56 40 78", 0, 1.8)
    a.path("M34 78 L46 78 L44 86 L36 86 Z", 6, 2.0)
    a.path("M8 24 Q22 20 36 24 T64 24 T92 24", 3, 1.2, 0.5)
    a.path("M10 40 Q22 44 30 42", 3, 1.0, 0.5)
    a.line(54, 30, 54, 70, 3, 1.0, 0.4)
    arrow(a, 60, 40, 60, 66, 3, 1.3, 0.6, 3)
    a.ground(92)
    return a


@item("Marked Lead Line")
def _():
    a = Art()
    a.line(10, 22, 90, 22, 0, 2.2)
    a.path("M40 22 Q42 50 46 72", 0, 1.8)
    for (y, k) in ((30, 1), (40, 2), (50, 3), (60, 4)):
        a.line(40 + (y - 22) * 0.07 - 3, y, 40 + (y - 22) * 0.07 + 3, y, 6, 1.6)
        for j in range(k):
            a.dot(40 + (y - 22) * 0.07 + 5 + j * 2.4, y, 0.9, 6)
    a.path("M42 72 L54 72 L52 82 L44 82 Z", 6, 2.0)
    a.path("M8 18 Q22 14 36 18 T64 18 T92 18", 3, 1.2, 0.5)
    a.ground(90)
    return a


@item("Mechanical Depth Sounder")
def _():
    a = Art()
    a.rect(14, 28, 40, 32, 0, 2.4)
    a.circle(34, 44, 10, 6, 1.8)
    for k in range(6):
        t = 2 * math.pi * k / 6
        a.line(34 + 6 * math.cos(t), 44 + 6 * math.sin(t), 34 + 10 * math.cos(t), 44 + 10 * math.sin(t), 3, 1.0, 0.7)
    a.path("M54 44 L70 44 Q74 44 74 48 L74 76", 0, 1.8)
    a.path("M68 76 L80 76 L78 84 L70 84 Z", 6, 2.0)
    a.line(14, 66, 54, 66, 3, 1.0, 0.5)
    a.line(40, 60, 40, 66, 3, 1.4, 0.7)
    a.ground(92)
    return a


@item("Electronic Depth Sounder")
def _():
    a = Art()
    screen(a, 14, 18, 52, 44, 0, 2.4)
    a.path("M20 26 L30 34 L38 30 L46 42 L54 36 L60 44", 6, 1.6)
    a.line(20, 52, 60, 52, 3, 1.0, 0.5)
    a.circle(76, 30, 5, 6, 1.6)
    a.path("M70 40 L76 70 L82 40", 0, 1.8)
    a.path("M86 40 Q92 46 86 52 M90 34 Q98 46 90 58", 3, 1.2, 0.6)
    a.line(14, 72, 66, 72, 0, 2.2)
    a.ground(90)
    return a


@item("Course Plotting Board")
def _():
    a = Art()
    a.rect(14, 18, 72, 62, 0, 2.4)
    for k in range(1, 6):
        a.line(14 + k * 12, 18, 14 + k * 12, 80, 3, 1.0, 0.35)
        a.line(14, 18 + k * 10, 86, 18 + k * 10, 3, 1.0, 0.35)
    a.path("M24 68 L46 46 L72 34", 6, 2.0)
    a.circle(24, 68, 2.6, 6, 1.4)
    a.circle(72, 34, 2.6, 6, 1.4)
    a.path("M30 28 Q50 20 70 28", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Parallel Ruler Set")
def _():
    a = Art()
    a.rect(14, 28, 72, 9, 0, 2.2)
    a.rect(14, 54, 72, 9, 0, 2.2)
    a.line(28, 37, 28, 54, 6, 1.8)
    a.line(72, 37, 72, 54, 6, 1.8)
    a.line(28, 37, 72, 54, 3, 1.4, 0.7)
    a.line(72, 37, 28, 54, 3, 1.4, 0.7)
    for x in range(20, 82, 8):
        a.line(x, 28, x, 31, 3, 1.0, 0.6)
        a.line(x, 63, x, 60, 3, 1.0, 0.6)
    a.circle(28, 37, 1.8, 6, 1.2)
    a.circle(72, 54, 1.8, 6, 1.2)
    a.ground(90)
    return a


@item("Chart Plotter Table")
def _():
    a = Art()
    a.path("M10 40 L66 40 L90 28 L34 28 Z", 0, 2.2)
    a.path("M10 40 L10 48 L66 48 L66 40 M66 48 L90 36 L90 28", 0, 2.2)
    a.path("M26 38 L50 32 L72 34", 6, 1.8)
    a.circle(26, 38, 2, 6, 1.2)
    a.line(18, 48, 18, 78, 0, 2.2)
    a.line(60, 48, 60, 78, 0, 2.2)
    a.line(18, 66, 60, 66, 3, 1.2, 0.6)
    a.path("M70 20 L78 14 L84 20", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Electronic Chart Display")
def _():
    a = Art()
    screen(a, 14, 18, 72, 52, 0, 2.4)
    a.path("M20 60 Q30 40 44 46 Q56 34 70 40 L80 36", 3, 1.2, 0.7)
    a.path("M22 28 L36 44 L52 40 L72 56", 6, 1.8)
    a.circle(72, 56, 2.6, 6, 1.4)
    a.line(20, 66, 36, 66, 3, 1.0, 0.5)
    a.line(36, 78, 64, 78, 0, 2.2)
    a.line(50, 70, 50, 78, 0, 2.0)
    a.ground(90)
    return a
