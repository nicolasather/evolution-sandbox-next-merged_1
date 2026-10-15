"""Topic 12 - irrigation works (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n, wave_d
from .kit import droplet, sparkle
from .registry import item, topic

topic("irrigation works")


def water(a, x0, x1, y, z=3, w=1.2, o=0.6, amp=1.6, period=9):
    a.path(wave_d(x0, x1, y, amp, period), z, w, o)


def channel(a, x0, y0, x1, y1, width=10, z=0, w=2.2):
    """Straight open channel drawn as two parallel banks (iso-flat)."""
    a.line(x0, y0 - width / 2, x1, y1 - width / 2, z, w)
    a.line(x0, y0 + width / 2, x1, y1 + width / 2, z, w)


def post(a, x, y0, y1, z=0, w=2.2):
    a.line(x, y0, x, y1, z, w)


def bucket(a, cx, cy, r=6, z=0, w=1.8):
    a.path(f"M{n(cx - r)} {n(cy)} L{n(cx - r * 0.7)} {n(cy + r * 1.3)} L{n(cx + r * 0.7)} {n(cy + r * 1.3)} L{n(cx + r)} {n(cy)}", z, w)
    a.ellipse(cx, cy, r, r * 0.28, z, w)


def sluice_frame(a, x, y, w=36, h=44, z=0, wd=2.2):
    a.line(x, y, x, y + h, z, wd)
    a.line(x + w, y, x + w, y + h, z, wd)
    a.line(x - 4, y, x + w + 4, y, z, wd)


@item("Lined Irrigation Channel")
def _():
    a = Art()
    a.path("M8 44 L44 44 L92 62 L56 62 Z", 0, 2.2)
    a.path("M8 52 L44 52 L92 70 L56 70 Z", 0, 1.6, 0.8)
    a.line(8, 44, 8, 52, 0, 2.0)
    a.line(56, 62, 56, 70, 0, 2.0)
    a.line(92, 62, 92, 70, 0, 2.0)
    water(a, 18, 50, 54, 3, 1.4, 0.7)
    for x in (24, 48, 70):
        a.line(x, 44 + (x - 8) * 0.2, x + 12, 62 + (x - 8) * 0.2 - 4, 3, 1.0, 0.45)
    arrow(a, 20, 30, 40, 30, 3, 1.3, 0.7)
    a.ground(90)
    return a


@item("Field Water Furrow")
def _():
    a = Art()
    for i in range(4):
        y = 40 + i * 10
        a.path(f"M10 {y} Q50 {y - 6} 90 {y}", 0, 2.0)
        water(a, 16, 84, y + 3, 3, 1.1, 0.6, 1.2, 8)
    a.line(10, 28, 90, 28, 6, 2.0)
    a.path("M20 34 L20 28 M40 34 L40 28 M60 34 L60 28 M80 34 L80 28", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Branching Field Furrow")
def _():
    a = Art()
    a.path("M10 50 L40 50", 0, 3.0)
    for dy, ang in ((-24, 1), (-10, 1), (10, 1), (24, 1)):
        a.path(f"M40 50 Q54 {50 + dy / 2} 90 {50 + dy}", 0, 1.8)
    for dy in (-24, -10, 10, 24):
        a.path(f"M50 {50 + dy * 0.3} q8 {dy * 0.2} 14 {dy * 0.3}", 3, 1.0, 0.5)
    water(a, 12, 38, 54, 3, 1.1, 0.6)
    droplet(a, 80, 26, 2.6)
    droplet(a, 84, 74, 2.6)
    a.ground(90)
    return a


@item("Contour Furrow Grid")
def _():
    a = Art()
    for i in range(4):
        y = 30 + i * 12
        a.path(f"M12 {y + 6} Q36 {y - 8} 60 {y} T90 {y - 4}", 0, 1.8)
    for k in range(4):
        x = 24 + k * 18
        a.path(f"M{x} 22 Q{x + 6} 50 {x + 2} 78", 3, 1.3, 0.6)
    a.path("M10 84 L90 84", 6, 1.2, 0.5)
    a.ground(92)
    return a


@item("Level Basin Irrigation")
def _():
    a = Art()
    a.path("M12 40 L60 40 L88 54 L40 54 Z", 0, 2.4)
    a.path("M12 40 L12 48 L40 62 L40 54 M40 62 L88 62 L88 54", 0, 2.2)
    a.path("M20 44 L58 44 L74 52 L36 52 Z", 3, 1.0, 0.5)
    water(a, 26, 66, 49, 3, 1.3, 0.8, 1.2, 8)
    a.line(40, 62, 40, 54, 6, 1.4)
    a.path("M10 74 L90 74", 3, 1.0, 0.4)
    droplet(a, 50, 24, 3.2)
    a.ground(88)
    return a


@item("Earthen Check Dam")
def _():
    a = Art()
    a.path("M10 74 L36 36 L64 36 L90 74 Z", 0, 2.4)
    for k in range(4):
        a.path(f"M{22 + k * 5} {58 - k * 5} Q50 {52 - k * 5} {78 - k * 5 - 1} {58 - k * 5}", 3, 1.0, 0.5)
    water(a, 12, 30, 62, 3, 1.4, 0.7)
    water(a, 70, 88, 72, 3, 1.4, 0.7)
    a.line(34, 36, 66, 36, 6, 1.8)
    a.ground(88)
    return a


@item("Stone Check Weir")
def _():
    a = Art()
    a.path("M20 74 L26 38 L74 38 L80 74 Z", 0, 2.4)
    for (y, off) in ((46, 0), (54, 5), (62, 0), (70, 5)):
        for x in range(26 + off, 76, 10):
            a.rect(x, y - 3, 8, 6, 3, 1.0, 0.7)
    water(a, 8, 24, 56, 3, 1.4, 0.7)
    water(a, 78, 94, 72, 3, 1.4, 0.7)
    a.path("M26 38 L74 38", 6, 2.0)
    arrow(a, 14, 30, 30, 30, 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Adjustable Diversion Weir")
def _():
    a = Art()
    a.path("M14 76 L20 40 L80 40 L86 76 Z", 0, 2.4)
    a.rect(34, 20, 32, 20, 6, 2.0)
    a.line(40, 20, 40, 40, 3, 1.0, 0.6)
    a.line(50, 20, 50, 40, 3, 1.0, 0.6)
    a.line(60, 20, 60, 40, 3, 1.0, 0.6)
    a.path("M46 12 L54 12 M50 12 L50 20", 6, 1.6)
    a.path("M86 60 L96 66", 6, 1.8)
    water(a, 8, 20, 62, 3, 1.4, 0.7)
    a.path("M90 78 L96 72", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Gated Diversion Weir")
def _():
    a = Art()
    a.path("M12 78 L18 42 L82 42 L88 78 Z", 0, 2.4)
    for x in (34, 54):
        a.rect(x, 22, 14, 22, 6, 2.0)
        a.line(x + 7, 22, x + 7, 14, 6, 1.6)
        a.line(x + 2, 14, x + 12, 14, 6, 1.6)
    a.line(48, 42, 48, 78, 3, 1.2, 0.5)
    a.path("M82 62 L94 70 L94 78", 6, 1.6)
    water(a, 6, 18, 62, 3, 1.4, 0.7)
    a.ground(90)
    return a


@item("Water Lift Bucket")
def _():
    a = Art()
    a.line(50, 10, 50, 46, 0, 1.8)
    bucket(a, 50, 50, 11, 0, 2.2)
    a.path("M30 60 L40 60 M60 60 L70 60", 3, 1.0, 0.5)
    water(a, 10, 90, 78, 3, 1.4, 0.7, 1.8, 10)
    a.path("M12 82 L88 82", 3, 1.0, 0.4)
    droplet(a, 50, 68, 3.2)
    a.line(40, 10, 60, 10, 6, 2.2)
    a.ground(90)
    return a


@item("Counterpoise Water Lift")
def _():
    a = Art()
    a.line(70, 84, 70, 38, 0, 3.0)
    a.line(70, 84, 56, 84, 0, 2.4)
    a.line(22, 26, 90, 46, 0, 2.4)
    a.line(22, 26, 22, 56, 3, 1.4)
    bucket(a, 22, 58, 6, 0, 1.8)
    a.circle(86, 50, 7, 6, 2.2)
    a.path("M70 38 L80 30", 3, 1.4, 0.6)
    water(a, 6, 40, 84, 3, 1.4, 0.7)
    a.ground(90)
    return a


@item("Chain Water Lift")
def _():
    a = Art()
    a.circle(50, 22, 9, 0, 2.2)
    a.circle(50, 76, 9, 0, 2.2)
    a.line(41, 22, 41, 76, 0, 1.6)
    a.line(59, 22, 59, 76, 0, 1.6)
    for y in range(28, 74, 12):
        bucket(a, 41, y, 3.4, 6, 1.3)
        a.rect(56, y - 2, 6, 4, 6, 1.2)
    a.circle(50, 22, 3, 3, 1.2)
    water(a, 10, 90, 86, 3, 1.4, 0.7)
    droplet(a, 70, 40, 3)
    a.ground(92)
    return a


@item("Animal Powered Water Lift")
def _():
    a = Art()
    a.ellipse(40, 60, 28, 8, 0, 1.6, 0.7)
    a.line(40, 60, 40, 30, 0, 2.6)
    a.line(40, 40, 68, 56, 0, 2.2)
    a.ellipse(68, 56, 8, 5, 6, 1.6)
    a.path("M62 52 L62 46 L74 46 L74 52", 6, 1.5)
    a.path("M66 46 L66 42 M72 46 L72 42", 6, 1.3)
    a.circle(40, 28, 6, 3, 1.6)
    a.path("M18 70 L10 76 M62 70 L72 76", 3, 1.0, 0.5)
    water(a, 60, 94, 78, 3, 1.3, 0.7)
    a.ground(90)
    return a


@item("Channel Gate Board")
def _():
    a = Art()
    a.path("M10 56 L40 56 M60 56 L90 56", 0, 2.2)
    a.path("M10 70 L40 70 M60 70 L90 70", 0, 2.2)
    sluice_frame(a, 38, 28, 24, 46, 0, 2.2)
    a.rect(42, 40, 16, 10, 6, 2.0)
    a.line(46, 32, 46, 40, 6, 1.4)
    a.line(54, 32, 54, 40, 6, 1.4)
    water(a, 12, 36, 62, 3, 1.3, 0.7)
    a.path("M64 62 L88 62", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Sliding Sluice Board")
def _():
    a = Art()
    sluice_frame(a, 30, 20, 40, 56, 0, 2.4)
    a.line(36, 20, 36, 76, 3, 1.0, 0.5)
    a.line(64, 20, 64, 76, 3, 1.0, 0.5)
    a.rect(38, 34, 24, 24, 6, 2.2)
    a.line(44, 38, 56, 38, 3, 1.0, 0.6)
    a.line(44, 44, 56, 44, 3, 1.0, 0.6)
    arrow(a, 50, 18, 50, 32, 3, 1.4, 0.8, 3.2)
    water(a, 8, 28, 70, 3, 1.3, 0.7)
    water(a, 72, 92, 76, 3, 1.3, 0.7)
    a.ground(88)
    return a


@item("Screw Operated Sluice")
def _():
    a = Art()
    sluice_frame(a, 30, 28, 40, 48, 0, 2.4)
    a.rect(38, 44, 24, 22, 6, 2.2)
    a.line(50, 12, 50, 44, 0, 2.2)
    for y in range(16, 42, 5):
        a.line(46, y + 2, 54, y - 1, 6, 1.4)
    a.line(40, 12, 60, 12, 0, 2.6)
    a.line(40, 12, 40, 18, 3, 1.4)
    a.line(60, 12, 60, 18, 3, 1.4)
    water(a, 8, 28, 72, 3, 1.3, 0.7)
    a.ground(88)
    return a


@item("Automated Sluice Gate")
def _():
    a = Art()
    sluice_frame(a, 24, 32, 36, 44, 0, 2.4)
    a.rect(32, 46, 20, 20, 6, 2.0)
    a.line(42, 22, 42, 46, 0, 2.0)
    a.rect(64, 20, 24, 24, 0, 2.2)
    a.circle(76, 32, 6, 6, 1.6)
    a.path("M76 26 L76 32 L80 34", 6, 1.4)
    a.line(60, 32, 64, 32, 3, 1.4)
    a.path("M42 22 L50 22 L50 32 L64 32", 3, 1.2, 0.7)
    water(a, 6, 24, 70, 3, 1.3, 0.7)
    a.ground(88)
    return a


@item("Settling Pond")
def _():
    a = Art()
    a.ellipse(50, 56, 38, 16, 0, 2.4)
    a.ellipse(50, 56, 30, 11, 3, 1.0, 0.5)
    water(a, 26, 74, 54, 3, 1.3, 0.8, 1.4, 10)
    water(a, 30, 70, 60, 3, 1.1, 0.5, 1.2, 9)
    a.path("M4 40 L22 48 M78 66 L96 72", 6, 2.0)
    a.dots([(40, 66), (50, 68), (60, 66)], 1.2, 6)
    a.ground(86)
    return a


@item("Desilting Basin")
def _():
    a = Art()
    a.path("M14 36 L86 36 L74 72 L26 72 Z", 0, 2.4)
    a.ellipse(50, 36, 36, 6, 0, 2.0)
    water(a, 20, 80, 42, 3, 1.3, 0.7)
    for (x, y) in ((36, 64), (46, 68), (56, 66), (64, 64), (42, 60), (52, 62)):
        a.dot(x, y, 1.3, 6)
    a.path("M26 66 Q50 60 74 66", 3, 1.0, 0.5)
    arrow(a, 4, 40, 14, 44, 3, 1.3, 0.7, 3)
    a.ground(86)
    return a


@item("Graded Sediment Trap")
def _():
    a = Art()
    a.path("M12 34 L88 34 L88 74 L12 74 Z", 0, 2.4)
    a.line(40, 34, 40, 74, 0, 2.0)
    a.line(64, 34, 64, 74, 0, 2.0)
    for (x0, r) in ((16, 3.2), (44, 2.2), (68, 1.4)):
        for k in range(4):
            a.circle(x0 + 2 + k * 5, 68 - (k % 2) * 3, r * 0.6, 6, 1.1)
    water(a, 14, 86, 44, 3, 1.2, 0.7)
    arrow(a, 14, 24, 34, 24, 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Multi Chamber Sediment Trap")
def _():
    a = Art()
    a.path("M8 32 L92 32 L92 74 L8 74 Z", 0, 2.4)
    for x in (30, 52, 74):
        a.line(x, 32, x, 62, 0, 2.0)
    for (x0, n_) in ((12, 4), (34, 3), (56, 2), (78, 1)):
        for k in range(n_):
            a.dot(x0 + k * 4, 70 - (k % 2) * 2, 1.2, 6)
    water(a, 10, 90, 42, 3, 1.2, 0.7)
    arrow(a, 8, 22, 26, 22, 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Clay Drainage Tile")
def _():
    a = Art()
    a.path("M14 40 Q14 28 50 28 Q86 28 86 40 L86 60 Q86 72 50 72 Q14 72 14 60 Z", 0, 2.4)
    a.ellipse(86, 50, 5, 20, 0, 2.2)
    a.ellipse(86, 50, 2, 12, 3, 1.0, 0.6)
    for x in range(26, 80, 12):
        a.path(f"M{x} 34 Q{x - 2} 50 {x} 66", 3, 1.0, 0.5)
    a.dots([(30, 48), (44, 54), (58, 46)], 1.2, 6)
    a.ground(86)
    return a


@item("Field Tile Drain")
def _():
    a = Art()
    a.path("M8 36 L92 36", 3, 1.4, 0.7)
    a.path("M8 44 Q50 40 92 44", 3, 1.0, 0.5)
    for k in range(6):
        x = 10 + k * 14
        a.rect(x, 56, 12, 9, 0, 1.8, None, 2)
        a.line(x + 6, 56, x + 6, 65, 3, 0.9, 0.5)
    for x in (22, 46, 70):
        a.path(f"M{x} 44 L{x} 56", 6, 1.2, 0.8)
        droplet(a, x, 49, 2.2, 3, 1.1)
    a.path("M8 72 L92 72", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Collector Drain")
def _():
    a = Art()
    a.rect(10, 58, 80, 10, 0, 2.4, None, 2)
    for k in range(5):
        a.line(24 + k * 14, 58, 24 + k * 14, 68, 3, 1.0, 0.5)
    for (x, y) in ((22, 20), (40, 24), (58, 20), (76, 24)):
        a.path(f"M{x} {y + 10} L{x + (50 - x) * 0.3} 58", 0, 1.8)
        a.rect(x - 4, y, 8, 10, 6, 1.4, None, 1)
    arrow(a, 70, 76, 92, 76, 3, 1.4, 0.8, 3)
    a.ground(88)
    return a


@item("Controlled Drainage Outlet")
def _():
    a = Art()
    a.rect(8, 50, 46, 12, 0, 2.4, None, 2)
    a.rect(54, 36, 18, 40, 0, 2.2)
    a.line(54, 44, 72, 44, 3, 1.0, 0.6)
    a.rect(58, 28, 10, 8, 6, 1.6)
    a.line(63, 18, 63, 28, 6, 1.8)
    a.line(58, 18, 68, 18, 6, 1.8)
    a.path("M72 62 L92 62 L92 70 L72 70", 0, 2.2)
    water(a, 74, 90, 66, 3, 1.1, 0.7, 1.0, 6)
    droplet(a, 30, 42, 3, 3, 1.3)
    a.ground(88)
    return a
