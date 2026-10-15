"""Topic 10 - basket and reedwork (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .kit_textile import weave_grid
from .registry import item, topic

topic("basket and reedwork")


def reeds(a, x, y, count=7, length=50, spread=3.2, z=0, w=1.6, lean=0.0):
    for k in range(count):
        xx = x + k * spread
        a.line(xx, y, xx + lean * length, y + length, z, w, None if k % 2 == 0 else 0.8)


def bound(a, x0, x1, y, z=6, w=2.4):
    a.line(x0, y, x1, y, z, w)
    a.line(x0, y + 3, x1, y + 3, z, 1.0, 0.5)


def mat(a, x, y, w, h, step=3.5, z=0, wd=2.2, kind="plain"):
    a.rect(x, y, w, h, z, wd)
    weave_grid(a, x + 3, y + 3, x + w - 3, y + h - 3, step, 3, 1.0, 0.7, kind)


def basket(a, cx, top, rt, rb, h, z=0, w=2.2, rows=5, kind="weave"):
    ry = 0.26
    a.ellipse(cx, top, rt, rt * ry, z, w)
    a.path(f"M{n(cx - rt)} {n(top)} L{n(cx - rb)} {n(top + h)} Q{n(cx)} {n(top + h + rb * ry * 2)} {n(cx + rb)} {n(top + h)} L{n(cx + rt)} {n(top)}", z, w)
    for i in range(1, rows):
        t = i / rows
        r = rt + (rb - rt) * t
        y = top + h * t
        a.path(f"M{n(cx - r)} {n(y)} Q{n(cx)} {n(y + r * ry * 1.6)} {n(cx + r)} {n(y)}", 3, 1.1, 0.6)
    for k in range(-3, 4):
        t = k / 3
        a.line(cx + rt * t * 0.9, top + rt * ry * 0.8, cx + rb * t * 0.9, top + h + rb * ry * 0.7, 3, 0.9, 0.35)


@item("Sorted Weaving Reeds")
def _():
    a = Art()
    reeds(a, 14, 20, 6, 52, 4, 0, 1.8)
    reeds(a, 46, 26, 6, 46, 4, 0, 1.4, 0.05)
    a.line(12, 58, 70, 58, 6, 2.0)
    a.line(14, 22, 14, 14, 3, 1.2)
    a.path("M76 30 L90 30 M76 40 L90 40 M76 50 L90 50", 3, 1.6, 0.8)
    a.rect(74, 24, 18, 32, 6, 1.4, 0.6)
    a.ground(88)
    return a


@item("Reed Bundle")
def _():
    a = Art()
    for k in range(9):
        x = 28 + k * 5
        a.path(f"M{x} 18 Q{x + (k - 4)} 50 {x} 82", 0, 1.6, None if k % 2 == 0 else 0.7)
    for y in (34, 66):
        a.line(24, y, 76, y, 6, 2.6)
        a.line(24, y + 3, 76, y + 3, 3, 1.0, 0.5)
    for x in (30, 44, 58, 70):
        a.path(f"M{x} 18 l-2 -6 M{x + 3} 18 l2 -6", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Twined Reed Panel")
def _():
    a = Art()
    a.rect(16, 18, 68, 62, 0, 2.2)
    reeds(a, 22, 22, 11, 54, 5.2, 0, 1.6)
    for y in (30, 48, 66):
        a.path(f"M16 {y} Q24 {y - 4} 32 {y} T48 {y} T64 {y} T84 {y}", 6, 1.6)
        a.path(f"M16 {y + 3} Q24 {y - 1} 32 {y + 3} T48 {y + 3} T64 {y + 3} T84 {y + 3}", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Coiled Reed Basket")
def _():
    a = Art()
    a.ellipse(50, 30, 30, 8, 0, 2.2)
    a.path("M20 30 Q22 70 50 78 Q78 70 80 30", 0, 2.2)
    for y in (38, 46, 54, 62, 70):
        w = 30 - (y - 30) * 0.28
        a.path(f"M{50 - w} {y} Q50 {y + 8} {50 + w} {y}", 3, 1.4, 0.8)
    a.path("M30 33 Q50 41 70 33", 3, 1.0, 0.5)
    a.line(40, 36, 36, 70, 3, 1.0, 0.4)
    a.line(60, 36, 64, 70, 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Lidded Reed Basket")
def _():
    a = Art()
    basket(a, 50, 46, 28, 22, 32, 0, 2.2, 4)
    a.path("M20 46 Q50 22 80 46", 0, 2.4)
    a.ellipse(50, 46, 30, 7.5, 0, 1.6)
    a.path("M30 38 Q50 28 70 38", 3, 1.0, 0.6)
    a.circle(50, 28, 3, 6, 1.6)
    a.ground(90)
    return a


@item("Splint Basket Base")
def _():
    a = Art()
    a.path("M50 16 L84 50 L50 84 L16 50 Z", 0, 2.2)
    weave_grid(a, 30, 32, 70, 68, 4.4, 3, 1.1, 0.8)
    a.path("M50 16 L50 84 M16 50 L84 50", 6, 1.3, 0.8)
    a.ground(92)
    return a


@item("Over Under Basket")
def _():
    a = Art()
    basket(a, 50, 28, 30, 22, 50, 0, 2.2, 6)
    for k in range(5):
        a.path(f"M{30 + k * 8} 40 l4 4 l4 -4", 6, 1.2, 0.8)
        a.path(f"M{30 + k * 8} 58 l4 -4 l4 4", 6, 1.2, 0.8)
    a.ground(90)
    return a


@item("Wicker Carry Basket")
def _():
    a = Art()
    basket(a, 50, 42, 30, 24, 36, 0, 2.2, 6)
    a.path("M20 42 C20 8 80 8 80 42", 0, 2.6)
    a.path("M24 40 C24 14 76 14 76 40", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Reinforced Wicker Hamper")
def _():
    a = Art()
    a.rect(20, 40, 60, 44, 0, 2.2)
    for y in range(46, 82, 6):
        a.path(f"M20 {y} Q30 {y - 3} 40 {y} T60 {y} T80 {y}", 3, 1.0, 0.7)
    a.path("M16 36 L84 36 L80 44 L20 44 Z", 6, 1.8)
    a.line(32, 44, 32, 84, 6, 2.6)
    a.line(68, 44, 68, 84, 6, 2.6)
    a.line(20, 62, 80, 62, 6, 2.6)
    a.path("M20 36 L24 24 L76 24 L80 36", 3, 1.4, 0.6)
    a.ground(92)
    return a


@item("Reed Floor Mat")
def _():
    a = Art()
    a.path("M10 56 L38 36 L92 36 L64 56 Z", 0, 2.2)
    weave_grid(a, 26, 40, 78, 52, 4.0, 3, 1.0, 0.6)
    a.path("M10 56 L10 62 L64 62 L64 56 M64 62 L92 42 L92 36", 0, 2.0)
    for x in range(14, 62, 6):
        a.line(x, 62, x - 1, 68, 3, 1.0, 0.7)
    a.ground(86)
    return a


@item("Joined Reed Mat")
def _():
    a = Art()
    mat(a, 12, 24, 36, 52, 3.8)
    mat(a, 52, 24, 36, 52, 3.8)
    for y in range(30, 74, 8):
        a.path(f"M44 {y} L56 {y + 4}", 6, 1.8)
        a.path(f"M56 {y} L44 {y + 4}", 6, 1.8, 0.7)
    a.ground(88)
    return a


@item("Rolled Reed Screen")
def _():
    a = Art()
    a.ellipse(22, 40, 8, 16, 0, 2.2)
    a.ellipse(22, 40, 3, 6, 3, 1.0, 0.7)
    a.path("M22 24 L84 24 L84 56 L22 56", 0, 2.2)
    for x in range(30, 84, 6):
        a.line(x, 24, x, 56, 3, 1.1, 0.6)
    a.line(30, 34, 84, 34, 6, 1.4)
    a.line(30, 46, 84, 46, 6, 1.4)
    a.ground(76)
    return a


@item("Freestanding Reed Partition")
def _():
    a = Art()
    for i, x in enumerate((14, 38, 62)):
        a.path(f"M{x} {20 + (i % 2) * 3} L{x + 22} {20 + (i + 1) % 2 * 3} L{x + 22} {76 + (i + 1) % 2 * 3} L{x} {76 + (i % 2) * 3} Z", 0, 2.0)
        for k in range(1, 5):
            a.line(x + k * 4.4, 22, x + k * 4.4, 78, 3, 1.0, 0.55)
        a.line(x, 36, x + 22, 36, 6, 1.4)
        a.line(x, 60, x + 22, 60, 6, 1.4)
    a.path("M10 86 L90 86", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Fish Basket Frame")
def _():
    a = Art()
    a.ellipse(26, 50, 8, 18, 0, 2.2)
    a.ellipse(74, 50, 5, 12, 0, 2.2)
    a.line(26, 32, 74, 38, 0, 2.2)
    a.line(26, 68, 74, 62, 0, 2.2)
    a.line(18, 50, 18, 50, 3, 1.0)
    for t in (-0.5, 0, 0.5):
        a.line(26 + 3, 50 + t * 28, 74, 50 + t * 20, 6, 1.6)
    a.ground(90)
    return a


@item("Open Fish Trap Basket")
def _():
    a = Art()
    a.path("M20 30 Q14 50 22 70 L72 70 Q80 50 74 30 Z", 0, 2.2)
    a.ellipse(76, 50, 6, 20, 0, 2.0)
    for x in range(28, 74, 8):
        a.line(x, 32, x, 68, 3, 1.1, 0.7)
    for y in (40, 50, 60):
        a.line(20, y, 76, y, 6, 1.5)
    a.ground(88)
    return a


@item("Conical Fish Trap")
def _():
    a = Art()
    a.path("M12 50 L56 22 L56 78 Z", 0, 2.2)
    a.ellipse(56, 50, 6, 28, 0, 2.2)
    a.path("M70 50 L56 40 L56 60 Z", 6, 1.6)
    for t in (-0.6, -0.3, 0, 0.3, 0.6):
        a.line(12, 50, 56, 50 + t * 28, 3, 1.0, 0.6)
    a.path("M76 40 Q84 44 82 50 Q84 56 76 60", 6, 1.2, 0.6)
    a.ground(88)
    return a


@item("Double Funnel Fish Trap")
def _():
    a = Art()
    a.ellipse(50, 50, 38, 24, 0, 2.2)
    a.path("M12 50 L34 42 M12 50 L34 58 M88 50 L66 42 M88 50 L66 58", 6, 2.0)
    for x in range(30, 74, 8):
        a.line(x, 28, x, 72, 3, 1.0, 0.5)
    a.path("M40 50 Q50 46 60 50 Q50 54 40 50", 3, 1.2)
    arrow(a, 4, 50, 14, 50, 3, 1.3, 0.7, 3)
    a.ground(86)
    return a


@item("Reed Floating Bundle")
def _():
    a = Art()
    for k in range(5):
        y = 34 + k * 5.4
        a.path(f"M16 {y} Q50 {y - 3} 84 {y}", 0, 1.8, None if k % 2 == 0 else 0.8)
    a.ellipse(16, 46, 2.6, 12, 0, 1.6)
    a.ellipse(84, 46, 2.6, 12, 0, 1.6)
    bound(a, 36, 36, 30)
    a.line(36, 30, 36, 64, 6, 2.4)
    a.line(64, 30, 64, 64, 6, 2.4)
    a.path("M12 74 Q24 70 36 74 T60 74 T88 74", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Bound Reed Float")
def _():
    a = Art()
    for k in range(4):
        a.path(f"M{16 + k * 2} {32 + k * 7} Q50 {28 + k * 7} {84 - k * 2} {32 + k * 7}", 0, 1.8)
    for x in (30, 50, 70):
        a.path(f"M{x - 2} 28 L{x + 2} 64", 6, 2.4)
        a.path(f"M{x + 2} 28 L{x - 2} 64", 6, 1.4, 0.7)
    a.path("M14 78 Q30 72 46 78 T80 78", 3, 1.2, 0.6)
    a.ground(92)
    return a


@item("Reed Raft Mat")
def _():
    a = Art()
    a.path("M10 54 L36 34 L90 34 L64 54 Z", 0, 2.2)
    for k in range(1, 6):
        a.line(10 + k * 9, 54, 36 + k * 9, 34, 3, 1.1, 0.7)
    a.path("M10 54 L10 64 L64 64 L64 54 M64 64 L90 44 L90 34", 0, 2.0)
    for x in (22, 38, 54):
        a.line(x, 54, x, 64, 6, 1.6)
    a.path("M8 76 Q24 72 40 76 T72 76 T94 76", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Reed Pontoon Float")
def _():
    a = Art()
    for dx in (0, 34):
        a.path(f"M{14 + dx} 46 Q{14 + dx} 30 {30 + dx} 30 Q{46 + dx} 30 {46 + dx} 46 Q{46 + dx} 60 {30 + dx} 60 Q{14 + dx} 60 {14 + dx} 46 Z", 0, 2.2)
        for k in (-1, 0, 1):
            a.line(18 + dx, 46 + k * 7, 42 + dx, 46 + k * 7, 3, 1.0, 0.6)
    a.line(10, 36, 90, 36, 6, 2.2)
    a.line(10, 56, 90, 56, 6, 2.2)
    a.path("M8 74 Q24 70 40 74 T72 74 T94 74", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Woven Storage Tray")
def _():
    a = Art()
    a.ellipse(50, 44, 38, 14, 0, 2.2)
    a.path("M12 44 L16 54 Q50 72 84 54 L88 44", 0, 2.2)
    a.ellipse(50, 46, 30, 9, 3, 1.0, 0.6)
    for x in range(26, 76, 7):
        a.path(f"M{x} {40 + abs(x - 50) * 0.04} L{x} {50 - abs(x - 50) * 0.08}", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("Shallow Harvest Basket")
def _():
    a = Art()
    basket(a, 50, 40, 38, 28, 22, 0, 2.2, 3)
    for (x, y) in ((34, 38), (46, 34), (58, 36), (68, 40)):
        a.circle(x, y, 3.6, 6, 1.4)
    a.ground(88)
    return a


@item("Deep Harvest Basket")
def _():
    a = Art()
    basket(a, 50, 24, 26, 20, 56, 0, 2.2, 7)
    for (x, y) in ((40, 22), (52, 18), (62, 22)):
        a.circle(x, y, 3.4, 6, 1.4)
    a.ground(92)
    return a


@item("Handled Harvest Basket")
def _():
    a = Art()
    basket(a, 50, 44, 28, 22, 40, 0, 2.2, 5)
    a.path("M24 44 C14 44 12 58 22 58", 6, 2.2)
    a.path("M76 44 C86 44 88 58 78 58", 6, 2.2)
    a.path("M26 44 C26 14 74 14 74 44", 6, 2.0)
    for (x, y) in ((42, 42), (52, 38), (60, 42)):
        a.circle(x, y, 3.2, 6, 1.3)
    a.ground(90)
    return a
