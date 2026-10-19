"""Topic 20 - road making (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("road making")


def road_section(a, x0=10, x1=90, y=44, h=12, layers=3, z=0, w=2.2):
    a.rect(x0, y, x1 - x0, h * layers, z, w)
    for i in range(1, layers):
        a.line(x0, y + i * h, x1, y + i * h, 3, 1.0, 0.6)


def gravel_dots(a, x0, x1, y0, y1, step=6, z=3, r=1.1, seed=3):
    """Gravel stones as ONE path of tiny circles (keeps the element budget)."""
    d = []
    k = 0
    y = y0
    while y < y1:
        x = x0 + (step / 2 if (k % 2) else 0) + 2
        while x < x1 - 2:
            cx = x + ((x * 7 + y * 3) % 3) - 1
            cy = y + ((x * 5 + y) % 3) - 1
            d.append(f"M{n(cx - r)} {n(cy)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0")
            x += step
        y += step * 0.8
        k += 1
    if d:
        a.path("".join(d), z, 0.9, 0.8)


def road_perspective(a, z=0, w=2.2, y_far=26, y_near=80):
    a.line(46, y_far, 14, y_near, z, w)
    a.line(54, y_far, 86, y_near, z, w)


def dashes(a, y0=30, y1=80, z=6, w=1.6):
    for k in range(5):
        t0 = y0 + k * (y1 - y0) / 5
        t1 = t0 + (y1 - y0) / 10
        a.line(50, t0, 50, t1, z, w)


def sign(a, cx, cy, w=26, h=18, z=0, wd=2.2):
    a.rect(cx - w / 2, cy - h / 2, w, h, z, wd)
    a.line(cx, cy + h / 2, cx, cy + h / 2 + 22, z, 2.2)


@item("Road Construction Materials")
def _():
    a = Art()
    a.path("M12 70 Q22 48 34 70 Z", 0, 2.0)
    a.path("M40 70 Q54 40 68 70 Z", 0, 2.0)
    a.path("M74 70 Q82 54 90 70 Z", 0, 2.0)
    gravel_dots(a, 14, 32, 58, 70, 5)
    gravel_dots(a, 44, 66, 54, 70, 5)
    a.rect(16, 24, 22, 10, 6, 1.6)
    a.rect(44, 22, 22, 12, 6, 1.6)
    a.line(54, 22, 54, 34, 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Compacted Earth Track")
def _():
    a = Art()
    road_perspective(a, 0, 2.2, 22, 82)
    a.path("M46 30 Q50 50 40 82 M54 30 Q56 50 64 82", 3, 1.2, 0.5)
    a.path("M30 66 Q42 60 58 66", 3, 1.0, 0.45)
    for (x, y) in ((44, 44), (56, 56), (38, 70), (62, 74)):
        a.dot(x, y, 1.2, 6)
    a.line(4, 22, 96, 22, 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Gravel Road Bed")
def _():
    a = Art()
    road_section(a, 10, 90, 44, 14, 2, 0)
    gravel_dots(a, 12, 88, 46, 56, 5)
    gravel_dots(a, 12, 88, 60, 70, 7)
    a.path("M10 44 Q50 36 90 44", 6, 1.8)
    a.ground(88)
    return a


@item("Macadam Road Course")
def _():
    a = Art()
    road_section(a, 10, 90, 36, 14, 3, 0)
    gravel_dots(a, 12, 88, 38, 48, 6)
    gravel_dots(a, 12, 88, 52, 62, 8)
    gravel_dots(a, 12, 88, 66, 76, 11, 3, 1.5)
    a.path("M10 36 Q50 28 90 36", 6, 1.8)
    a.ground(88)
    return a


@item("Asphalt Road Surface")
def _():
    a = Art()
    road_perspective(a, 0, 2.4, 20, 84)
    dashes(a, 26, 80)
    a.path("M40 40 L60 40 M32 56 L68 56 M24 72 L76 72", 3, 1.0, 0.4)
    a.line(4, 20, 96, 20, 3, 1.0, 0.4)
    a.dots([(34, 70), (66, 64), (44, 50)], 1.0, 6)
    a.ground(92)
    return a


@item("Timber Road Plank")
def _():
    a = Art()
    a.path("M14 40 L74 40 L86 28 L26 28 Z", 0, 2.2)
    a.path("M14 40 L14 50 L74 50 L74 40 M74 50 L86 38 L86 28", 0, 2.2)
    a.line(26, 28, 14, 40, 3, 1.0, 0.5)
    a.path("M20 34 L80 34", 3, 1.0, 0.5)
    a.dots([(24, 45), (64, 45)], 1.4, 6)
    a.path("M30 64 L70 64", 3, 1.0, 0.4)
    a.ground(80)
    return a


@item("Plank Road")
def _():
    a = Art()
    road_perspective(a, 0, 2.2, 22, 84)
    for k in range(7):
        t = k / 6
        y = 28 + t * 52
        d = 4 + t * 32
        a.line(50 - d, y, 50 + d, y, 3, 1.5, 0.85)
    a.line(4, 22, 96, 22, 3, 1.0, 0.4)
    a.ground(92)
    return a


@item("Log Corduroy Road")
def _():
    a = Art()
    road_perspective(a, 0, 2.2, 22, 84)
    for k in range(6):
        t = k / 5
        y = 30 + t * 50
        d = 6 + t * 32
        a.line(50 - d, y, 50 + d, y, 3, 2.2)
        a.ellipse(50 - d, y, 1.6, 2.2, 6, 1.0)
        a.ellipse(50 + d, y, 1.6, 2.2, 6, 1.0)
    a.ground(92)
    return a


@item("Elevated Boardwalk Road")
def _():
    a = Art()
    a.line(8, 40, 92, 40, 0, 2.4)
    a.line(8, 46, 92, 46, 0, 2.4)
    for x in range(14, 90, 8):
        a.line(x, 40, x, 46, 3, 1.0, 0.5)
    for x in (20, 44, 68):
        a.line(x, 46, x, 78, 0, 2.6)
    a.line(14, 56, 50, 56, 3, 1.2, 0.6)
    a.line(38, 66, 74, 66, 3, 1.2, 0.6)
    a.line(8, 34, 92, 34, 3, 1.2, 0.6)
    for x in (14, 38, 62, 86):
        a.line(x, 34, x, 40, 3, 1.2, 0.7)
    a.path("M6 80 Q20 76 34 80 T62 80 T94 80", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Stone Curb Block")
def _():
    a = Art()
    a.path("M24 40 L64 40 L82 28 L42 28 Z", 0, 2.2)
    a.path("M24 40 L24 70 L64 70 L64 40 M64 70 L82 58 L82 28", 0, 2.4)
    a.path("M24 52 L64 52", 3, 1.0, 0.5)
    a.line(44, 40, 44, 70, 3, 1.0, 0.4)
    a.path("M10 76 L90 76", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Laid Road Kerb")
def _():
    a = Art()
    a.line(6, 62, 94, 62, 0, 2.4)
    for x in range(10, 88, 20):
        a.rect(x, 46, 18, 16, 0, 2.2)
        a.line(x, 54, x + 18, 54, 3, 1.0, 0.5)
    a.path("M6 46 L94 46", 3, 1.0, 0.5)
    a.path("M6 62 L2 72 M94 62 L98 72", 3, 1.0, 0.4)
    a.path("M10 76 L90 76", 3, 1.0, 0.45)
    a.dots([(20, 72), (44, 70), (70, 72)], 1.0, 6)
    a.ground(88)
    return a


@item("Kerbed Road Drain")
def _():
    a = Art()
    a.line(6, 66, 94, 66, 0, 2.4)
    a.rect(10, 50, 80, 16, 0, 2.2)
    a.line(10, 56, 90, 56, 3, 1.0, 0.5)
    a.path("M10 66 L10 76 L90 76", 3, 1.2, 0.6)
    for x in (24, 40, 56, 72):
        a.line(x, 66, x, 76, 3, 1.0, 0.5)
    a.path("M16 70 Q30 68 44 70 T72 70 T90 70", 6, 1.2, 0.8)
    a.path("M34 40 L66 40", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Continuous Road Gutter")
def _():
    a = Art()
    a.path("M8 44 L50 44 L92 56", 0, 2.2)
    a.path("M8 56 L50 56 L92 70", 0, 2.2)
    a.path("M8 50 L50 50 L92 63", 3, 1.2, 0.6)
    a.path("M14 53 Q30 49 50 53 T88 63", 6, 1.2, 0.7)
    arrow(a, 20, 36, 40, 40, 3, 1.3, 0.6, 3)
    for x in (24, 48, 72):
        a.line(x, 44 + (x - 24) * 0.08, x, 56 + (x - 24) * 0.1, 3, 1.0, 0.45)
    a.ground(86)
    return a


@item("Road Marker Stone")
def _():
    a = Art()
    a.path("M36 78 L36 36 Q50 20 64 36 L64 78 Z", 0, 2.4)
    a.line(42, 48, 58, 48, 3, 1.2, 0.7)
    a.line(42, 56, 56, 56, 3, 1.2, 0.7)
    a.line(42, 64, 58, 64, 3, 1.2, 0.7)
    a.path("M26 78 L74 78", 0, 2.0)
    a.path("M14 70 Q30 64 40 70", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Mile Marker Post")
def _():
    a = Art()
    a.line(50, 14, 50, 80, 0, 3.0)
    a.rect(34, 18, 32, 22, 0, 2.4)
    a.line(40, 24, 60, 24, 3, 1.4, 0.8)
    a.line(40, 30, 56, 30, 3, 1.4, 0.8)
    a.path("M34 30 L28 29 M66 30 L72 29", 3, 1.0, 0.6)
    a.path("M44 80 L56 80", 0, 2.0)
    a.path("M14 70 L30 62 M70 62 L88 70", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Reflective Road Marker")
def _():
    a = Art()
    a.path("M30 70 L36 50 L64 50 L70 70 Z", 0, 2.4)
    a.circle(44, 58, 3.4, 6, 1.6)
    a.circle(56, 58, 3.4, 6, 1.6)
    a.path("M40 44 L36 36 M50 44 L50 34 M60 44 L64 36", 3, 1.3, 0.7)
    sparkle(a, 24, 34, 3, 6, 0.9)
    sparkle(a, 76, 34, 3, 6, 0.9)
    a.path("M10 76 L90 76", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Electronic Variable Road Sign")
def _():
    a = Art()
    a.rect(16, 18, 68, 36, 0, 2.4)
    for y in (28, 38, 48):
        for x in range(24, 78, 8):
            a.circle(x, y, 1.5, 3, 1.0, 0.8)
    a.line(32, 54, 32, 82, 0, 2.4)
    a.line(68, 54, 68, 82, 0, 2.4)
    a.line(32, 66, 68, 66, 3, 1.0, 0.5)
    a.path("M40 26 L60 26 M44 34 L56 34", 6, 1.8)
    a.ground(92)
    return a


@item("Wheel Rut Filling")
def _():
    a = Art()
    road_perspective(a, 0, 2.2, 22, 84)
    a.path("M42 30 Q40 56 30 84 M58 30 Q60 56 70 84", 6, 2.4)
    a.path("M44 34 Q42 58 34 82 M56 34 Q58 58 66 82", 3, 1.0, 0.5)
    gravel_dots(a, 28, 40, 66, 82, 5)
    gravel_dots(a, 60, 72, 66, 82, 5)
    a.ground(92)
    return a


@item("Graded Road Crown")
def _():
    a = Art()
    a.path("M8 60 Q50 40 92 60", 0, 2.4)
    a.path("M8 60 L8 76 L92 76 L92 60", 0, 2.2)
    a.path("M8 68 Q50 50 92 68", 3, 1.0, 0.5)
    a.line(50, 40, 50, 30, 3, 1.0, 0.6)
    arrow(a, 38, 44, 24, 52, 3, 1.3, 0.7, 3)
    arrow(a, 62, 44, 76, 52, 3, 1.3, 0.7, 3)
    a.dots([(30, 72), (50, 72), (70, 72)], 1.1, 6)
    a.ground(88)
    return a


@item("Cambered Road Surface")
def _():
    a = Art()
    a.path("M8 62 Q50 44 92 62", 0, 2.4)
    a.path("M8 62 L8 78 L92 78 L92 62", 0, 2.2)
    for (x, y) in ((22, 54), (50, 46), (78, 54)):
        a.line(x, y, x, y + 6, 3, 1.0, 0.5)
    for x in (30, 50, 70):
        a.path(f"M{x} 38 q2 4 0 6 q-2 -2 0 -6", 6, 1.2)
    arrow(a, 36, 52, 22, 58, 3, 1.3, 0.7, 3)
    arrow(a, 64, 52, 78, 58, 3, 1.3, 0.7, 3)
    a.ground(90)
    return a


@item("Superelevated Road Curve")
def _():
    a = Art()
    a.path("M14 70 L84 40", 0, 2.4)
    a.path("M14 82 L84 52", 0, 2.4)
    a.path("M14 70 L14 82 M84 40 L84 52", 0, 2.2)
    a.path("M14 76 L84 46", 3, 1.0, 0.5)
    a.path("M26 38 A38 38 0 0 1 62 28", 3, 1.4, 0.7)
    a.rect(40, 50, 14, 8, 6, 1.6)
    a.circle(44, 60, 1.8, 6, 1.2)
    a.circle(52, 56, 1.8, 6, 1.2)
    a.path("M14 82 L84 82", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Stone Culvert Slab")
def _():
    a = Art()
    a.rect(10, 28, 80, 10, 0, 2.2)
    a.path("M10 38 L10 76 M90 38 L90 76", 0, 2.4)
    a.rect(26, 38, 8, 38, 0, 2.2)
    a.rect(66, 38, 8, 38, 0, 2.2)
    a.rect(34, 38, 32, 6, 6, 2.0)
    a.path("M36 70 Q50 64 64 70", 6, 1.4, 0.8)
    for x in (44, 56):
        a.line(x, 28, x, 38, 3, 1.0, 0.5)
    a.path("M6 82 L94 82", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Box Culvert")
def _():
    a = Art()
    a.rect(10, 26, 80, 12, 0, 2.2)
    a.rect(10, 38, 80, 36, 0, 2.4)
    a.rect(24, 44, 52, 24, 0, 2.0)
    a.line(14, 32, 86, 32, 3, 1.0, 0.5)
    a.path("M30 66 Q50 60 70 66", 6, 1.4, 0.8)
    arrow(a, 34, 56, 66, 56, 3, 1.3, 0.6, 3)
    a.path("M16 78 L84 78", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Pipe Culvert")
def _():
    a = Art()
    a.path("M8 36 Q50 22 92 36", 0, 2.2)
    a.path("M8 36 L8 76 M92 36 L92 76", 0, 2.2)
    a.ellipse(50, 58, 20, 16, 0, 2.6)
    a.ellipse(50, 58, 14, 10, 3, 1.0, 0.5)
    a.path("M34 62 Q50 70 66 62", 6, 1.4, 0.8)
    for x in (32, 68):
        a.line(x, 36, x, 42, 3, 1.0, 0.45)
    a.path("M10 70 L30 70 M70 70 L90 70", 3, 1.0, 0.45)
    a.ground(86)
    return a


@item("Precast Drain Culvert")
def _():
    a = Art()
    a.rect(12, 34, 76, 36, 0, 2.4)
    a.line(40, 34, 40, 70, 0, 2.0)
    a.line(66, 34, 66, 70, 0, 2.0)
    a.rect(18, 40, 18, 24, 3, 1.2, 0.6)
    a.rect(44, 40, 18, 24, 3, 1.2, 0.6)
    a.rect(70, 40, 14, 24, 3, 1.2, 0.6)
    a.circle(26, 30, 2, 6, 1.4)
    a.circle(52, 30, 2, 6, 1.4)
    a.line(26, 22, 26, 28, 6, 1.4)
    a.line(52, 22, 52, 28, 6, 1.4)
    a.path("M18 22 L60 22", 6, 1.2, 0.7)
    a.ground(86)
    return a
