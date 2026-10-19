"""Topic 31 - public water systems (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n, wave_d
from .kit import droplet
from .registry import item, topic

topic("public water systems")


def ring_well(a, cx=50, top=44, rx=16, h=26, z=0, courses=3):
    a.ellipse(cx, top, rx, 5, z, 2.4)
    a.ellipse(cx, top, rx - 4, 3, 3, 1.2, 0.6)
    a.line(cx - rx, top, cx - rx, top + h, z, 2.4)
    a.line(cx + rx, top, cx + rx, top + h, z, 2.4)
    a.path(f"M{cx - rx} {top + h} Q{cx} {top + h + 8} {cx + rx} {top + h}", z, 2.4)
    for k in range(1, courses + 1):
        y = top + k * h / (courses + 1)
        a.path(f"M{cx - rx} {y} Q{cx} {y + 6} {cx + rx} {y}", 3, 1.0, 0.55)


def pipe_h(a, x0, x1, y, r=4, z=0, w=2.4):
    a.line(x0, y - r, x1, y - r, z, w)
    a.line(x0, y + r, x1, y + r, z, w)


def water(a, x0, x1, y, z=3):
    a.path(wave_d(x0, x1, y, 1.6, 8), z, 1.1, 0.6)


def tank(a, x, y, w, h, z=0, fill=0.5):
    a.rect(x, y, w, h, z, 2.4)
    wy = y + h * (1 - fill)
    a.path(wave_d(x + 2, x + w - 2, wy, 1.4, 7), 3, 1.1, 0.6)


def dropx(a, x, y, s=3):
    droplet(a, x, y, s, 3, 1.1, 0.8)


def basin(a, cx, y, rx, z=0):
    a.ellipse(cx, y, rx, rx * 0.3, z, 2.4)
    a.path(f"M{cx - rx} {y} L{cx - rx + 4} {y + 8} L{cx + rx - 4} {y + 8} L{cx + rx} {y}", z, 2.4)
    a.ellipse(cx, y, rx - 5, rx * 0.3 - 2, 3, 1.1, 0.6)


@item("Settlement Water Network")
def _():
    a = Art()
    for x, y in ((18, 30), (46, 24), (78, 32), (30, 62), (68, 66)):
        a.circle(x, y, 5, 0, 2.2)
    a.path("M23 30 L41 25 M51 25 L73 32 M20 35 L28 57 M45 28 L32 57 M78 37 L70 61 M35 62 L63 66", 0, 2.0)
    a.circle(50, 88, 4, 6, 1.6)
    a.path("M50 84 L50 70 L68 66", 3, 1.4, 0.7)
    dropx(a, 18, 30, 2.6)
    a.ground(92)
    return a


@item("Stone Lined Well")
def _():
    a = Art()
    ring_well(a, 50, 40, 20, 34, 0, 4)
    a.path("M30 40 L34 34 M42 36 L44 32 M58 36 L60 32 M70 40 L66 34", 3, 1.1, 0.6)
    a.path("M34 62 Q50 72 66 62", 3, 1.0, 0.5)
    water(a, 36, 64, 68)
    a.ground(86)
    return a


@item("Covered Village Well")
def _():
    a = Art()
    ring_well(a, 50, 56, 18, 22, 0, 2)
    a.path("M26 40 L50 22 L74 40 Z", 0, 2.4)
    a.line(32, 40, 32, 56, 0, 2.2)
    a.line(68, 40, 68, 56, 0, 2.2)
    a.line(50, 22, 50, 40, 3, 1.0, 0.5)
    a.path("M40 40 L40 48 M60 40 L60 48", 3, 1.2, 0.7)
    a.ground(86)
    return a


@item("Lift Equipped Well")
def _():
    a = Art()
    ring_well(a, 40, 62, 16, 20, 0, 2)
    a.line(40, 62, 40, 24, 0, 2.4)
    a.line(40, 24, 74, 24, 0, 2.4)
    a.line(74, 24, 74, 36, 3, 1.4, 0.8)
    a.rect(70, 36, 8, 8, 6, 2.0)
    a.circle(40, 24, 4, 6, 1.8)
    a.line(40, 28, 40, 54, 3, 1.4, 0.7)
    a.rect(36, 54, 8, 6, 6, 1.8)
    a.ground(88)
    return a


@item("Sanitary Wellhead")
def _():
    a = Art()
    a.rect(30, 52, 40, 26, 0, 2.4)
    a.path("M26 52 L74 52 L74 46 L26 46 Z", 0, 2.4)
    a.line(50, 46, 50, 22, 0, 2.4)
    a.path("M50 22 L62 22 L62 28", 0, 2.4)
    a.circle(40, 64, 3, 6, 1.4)
    a.circle(60, 64, 3, 6, 1.4)
    a.path("M30 70 L70 70", 3, 1.0, 0.5)
    a.path("M14 78 L86 78 L90 86 L10 86 Z", 3, 1.2, 0.6)
    dropx(a, 62, 36, 2.6)
    return a


@item("Pottery Water Pipe")
def _():
    a = Art()
    for i in range(3):
        x = 14 + i * 24
        a.path(f"M{x} 40 L{x + 20} 40 L{x + 20} 60 L{x} 60 Z", 0, 2.4)
        a.ellipse(x + 20, 50, 3, 10, 3, 1.1, 0.6)
    a.path("M20 46 L30 46 M44 54 L54 54 M68 46 L78 46", 3, 1.0, 0.5)
    water(a, 14, 86, 72)
    a.ground(88)
    return a


@item("Socketed Water Pipe")
def _():
    a = Art()
    a.path("M8 42 L52 42 L52 58 L8 58", 0, 2.4)
    a.path("M44 38 L62 38 L62 62 L44 62 Z", 0, 2.4)
    a.path("M62 44 L92 44 L92 56 L62 56", 0, 2.4)
    a.line(48, 42, 48, 58, 3, 1.0, 0.5)
    a.line(56, 42, 56, 58, 3, 1.0, 0.5)
    a.path("M16 50 L36 50", 3, 1.0, 0.5)
    a.path("M70 50 L84 50", 3, 1.0, 0.5)
    a.ground(80)
    return a


@item("Branch Water Junction")
def _():
    a = Art()
    pipe_h(a, 6, 94, 56, 6, 0)
    a.path("M44 50 L44 20 L56 20 L56 50", 0, 2.4)
    a.circle(50, 56, 3, 3, 1.2, 0.7)
    a.line(44, 34, 56, 34, 3, 1.0, 0.5)
    arrow(a, 10, 56, 34, 56, 3, 1.4, 0.7)
    arrow(a, 50, 46, 50, 26, 3, 1.4, 0.7)
    a.ground(80)
    return a


@item("Pressure Water Main")
def _():
    a = Art()
    pipe_h(a, 6, 94, 54, 9, 0, 2.6)
    for x in (22, 44, 66, 86):
        a.line(x, 45, x, 63, 3, 1.4, 0.6)
    a.circle(50, 26, 10, 0, 2.2)
    a.line(50, 26, 56, 20, 3, 1.4)
    a.line(50, 36, 50, 45, 0, 2.0)
    arrow(a, 12, 54, 38, 54, 6, 1.4, 0.8)
    a.ground(80)
    return a


@item("Rainwater Catchment Jar")
def _():
    a = Art()
    a.path("M34 36 Q28 54 34 72 Q50 80 66 72 Q72 54 66 36", 0, 2.4)
    a.ellipse(50, 36, 16, 4, 0, 2.2)
    a.path("M24 20 L36 30 M76 20 L64 30", 3, 1.2, 0.6)
    a.path("M40 14 L38 22 M52 12 L50 20 M62 14 L60 22", 3, 1.2, 0.8)
    water(a, 38, 62, 60)
    a.ground(86)
    return a


@item("Covered Cistern")
def _():
    a = Art()
    a.path("M16 46 Q50 22 84 46", 0, 2.4)
    a.line(16, 46, 16, 76, 0, 2.4)
    a.line(84, 46, 84, 76, 0, 2.4)
    a.line(16, 76, 84, 76, 0, 2.4)
    a.circle(50, 38, 4, 6, 1.6)
    water(a, 18, 82, 62)
    a.path("M30 36 Q50 26 70 36", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Underground Storage Cistern")
def _():
    a = Art()
    a.line(6, 34, 94, 34, 0, 2.2)
    a.path("M20 34 L20 78 L80 78 L80 34", 0, 2.4)
    for x in (36, 50, 64):
        a.line(x, 40, x, 78, 0, 2.0)
        a.path(f"M{x - 6} 40 Q{x} 34 {x + 6} 40", 3, 1.2, 0.7)
    water(a, 21, 79, 66)
    a.path("M46 34 L46 22 L54 22 L54 34", 6, 1.8)
    return a


@item("Rainwater Harvesting Tank")
def _():
    a = Art()
    a.path("M28 36 L72 36 L72 78 L28 78 Z", 0, 2.4)
    a.ellipse(50, 36, 22, 5, 0, 2.2)
    a.path("M8 20 L40 30", 0, 2.2)
    a.path("M8 20 L8 12", 3, 1.2, 0.7)
    a.circle(72, 70, 2.6, 6, 1.6)
    a.line(72, 70, 84, 70, 6, 1.8)
    water(a, 30, 70, 58)
    a.path("M32 44 L32 72 M40 44 L40 72", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Sand Filter Bed")
def _():
    a = Art()
    a.rect(16, 30, 68, 46, 0, 2.4)
    a.line(16, 44, 84, 44, 3, 1.2, 0.7)
    a.line(16, 56, 84, 56, 3, 1.2, 0.7)
    a.dots([(24 + i * 6, 50) for i in range(10)], 0.9, 3, 0.7)
    a.dots([(26 + i * 8, 64) for i in range(8)], 1.4, 3, 0.7)
    a.path(wave_d(18, 82, 36, 1.6, 8), 3, 1.1, 0.6)
    dropx(a, 50, 16, 3)
    arrow(a, 50, 84, 50, 90, 6, 1.4)
    return a


@item("Slow Sand Water Filter")
def _():
    a = Art()
    a.rect(24, 24, 52, 52, 0, 2.4)
    a.line(24, 38, 76, 38, 3, 1.0, 0.6)
    a.dots([(30 + i * 5, 48) for i in range(10)], 0.9, 3, 0.7)
    a.dots([(30 + i * 8, 60) for i in range(6)], 1.6, 3, 0.7)
    a.path("M30 70 L70 70", 6, 1.6)
    a.path("M76 68 L90 68 L90 80", 0, 2.2)
    a.path("M10 22 L30 30", 0, 2.0)
    dropx(a, 12, 34, 2.6)
    a.path("M30 33 Q50 36 70 33", 3, 1.0, 0.5)
    return a


@item("Rapid Sand Water Filter")
def _():
    a = Art()
    a.rect(34, 20, 32, 56, 0, 2.4)
    a.line(34, 40, 66, 40, 3, 1.0, 0.6)
    a.dots([(38 + i * 5, 50) for i in range(6)], 1.0, 3, 0.7)
    a.dots([(40 + i * 8, 62) for i in range(4)], 1.6, 3, 0.7)
    a.path("M10 30 L34 30 M10 24 L10 36", 0, 2.2)
    a.path("M66 70 L90 70 L90 78", 0, 2.2)
    a.circle(80, 44, 7, 6, 1.8)
    a.line(80, 44, 84, 40, 6, 1.4)
    arrow(a, 18, 30, 30, 30, 3, 1.4, 0.8)
    return a


@item("Multi Media Filter")
def _():
    a = Art()
    a.rect(36, 18, 28, 60, 0, 2.4)
    for y, r, c in ((34, 2.0, 6), (48, 1.4, 6), (62, 0.9, 7)):
        a.line(36, y - 6, 64, y - 6, 3, 1.0, 0.6)
        a.dots([(39 + i * (22 / c), y) for i in range(c)], r, 3, 0.7)
    a.path("M12 28 L36 28 M64 70 L88 70", 0, 2.2)
    for y in (34, 48, 62):
        a.line(70, y, 80, y, 3, 1.0, 0.6)
    a.circle(86, 48, 3, 6, 1.4)
    return a


@item("Open Wastewater Ditch")
def _():
    a = Art()
    a.path("M6 40 L30 40 L38 62 L62 62 L70 40 L94 40", 0, 2.4)
    a.path(wave_d(38, 62, 54, 1.6, 7), 3, 1.1, 0.6)
    a.path("M12 48 L28 48 M72 48 L88 48", 3, 1.0, 0.5)
    a.dots([(44, 58), (52, 59), (58, 57)], 1.2, 3, 0.7)
    a.path("M6 40 Q10 34 14 40 M80 40 Q86 34 92 40", 3, 1.2, 0.7)
    a.ground(76)
    return a


@item("Covered Wastewater Drain")
def _():
    a = Art()
    a.path("M6 36 L94 36", 0, 2.4)
    a.path("M20 36 L20 62 L80 62 L80 36", 0, 2.4)
    a.rect(26, 36, 48, 6, 0, 2.0)
    for x in (34, 46, 58, 66):
        a.line(x, 36, x, 42, 3, 1.0, 0.7)
    water(a, 22, 78, 56)
    a.ground(76)
    arrow(a, 30, 50, 70, 50, 3, 1.3, 0.7)
    return a


@item("Combined Sewer Channel")
def _():
    a = Art()
    a.ellipse(50, 56, 26, 18, 0, 2.4)
    a.path("M24 56 L76 56", 3, 1.0, 0.5)
    water(a, 28, 72, 60)
    a.path("M10 26 L34 40", 0, 2.2)
    a.path("M90 24 L66 40", 0, 2.2)
    a.path("M50 10 L50 38", 0, 2.0)
    dropx(a, 14, 36, 2.6)
    dropx(a, 86, 36, 2.6)
    a.ground(86)
    return a


@item("Separated Sewer Network")
def _():
    a = Art()
    a.path("M6 36 L94 36 M6 44 L94 44", 0, 2.4)
    a.path("M6 62 L94 62 M6 70 L94 70", 0, 2.4)
    a.path("M30 44 L30 62 M62 44 L62 62", 3, 1.0, 0.4)
    dropx(a, 24, 22, 3)
    a.path("M70 20 Q76 26 70 30 Q64 26 70 20", 6, 1.4)
    a.line(46, 36, 46, 28, 3, 1.4, 0.8)
    a.line(54, 70, 54, 80, 3, 1.4, 0.8)
    arrow(a, 12, 40, 40, 40, 3, 1.3, 0.8)
    arrow(a, 12, 66, 40, 66, 3, 1.3, 0.8)
    return a


@item("Public Fountain Basin")
def _():
    a = Art()
    basin(a, 50, 66, 32)
    a.line(50, 66, 50, 38, 0, 2.4)
    a.ellipse(50, 38, 8, 2.4, 0, 2.0)
    a.path("M50 34 Q40 28 36 40 M50 34 Q60 28 64 40", 3, 1.3, 0.8)
    water(a, 24, 76, 66)
    a.ground(84)
    return a


@item("Gravity Fed Fountain")
def _():
    a = Art()
    tank(a, 36, 10, 28, 18, 0, 0.6)
    a.line(50, 28, 50, 54, 0, 2.4)
    a.path("M50 54 Q50 62 40 62", 0, 2.2)
    basin(a, 50, 72, 26)
    arrow(a, 70, 20, 70, 44, 3, 1.4, 0.7)
    a.path("M40 62 L40 68", 3, 1.4, 0.8)
    dropx(a, 40, 66, 2.4)
    a.ground(88)
    return a


@item("Valved Public Fountain")
def _():
    a = Art()
    a.rect(38, 26, 24, 40, 0, 2.4)
    a.path("M62 44 L76 44 L76 52", 0, 2.4)
    a.circle(50, 38, 5, 6, 1.8)
    a.line(50, 38, 54, 34, 6, 1.4)
    a.path("M30 66 L70 66 L74 78 L26 78 Z", 0, 2.4)
    dropx(a, 76, 60, 2.6)
    a.path("M44 54 L56 54", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Timed Drinking Fountain")
def _():
    a = Art()
    a.rect(34, 24, 32, 44, 0, 2.4)
    a.circle(50, 38, 10, 6, 1.8)
    a.line(50, 38, 50, 31, 6, 1.4)
    a.line(50, 38, 56, 41, 6, 1.4)
    a.path("M66 56 L82 56 L82 60", 0, 2.4)
    a.rect(70, 66, 20, 6, 0, 2.0)
    dropx(a, 82, 62, 2.4)
    a.path("M40 56 L60 56", 3, 1.0, 0.5)
    a.ground(86)
    return a
