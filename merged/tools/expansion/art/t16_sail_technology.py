"""Topic 16 - sail technology (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .kit_textile import sine_path
from .registry import item, topic

topic("sail technology")


def hull(a, x0=14, x1=86, y=76, z=0, w=2.2):
    a.path(f"M{x0} {y - 8} L{x1} {y - 8} L{x1 - 8} {y + 4} L{x0 + 10} {y + 4} Z", z, w)
    a.path(f"M{x0 - 2} {y + 10} Q50 {y + 14} {x1 + 2} {y + 10}", 3, 1.0, 0.5)


def mast(a, x, top, bot, z=0, w=2.6):
    a.line(x, top, x, bot, z, w)


def sail_sq(a, x, top, w, h, z=0, wd=2.0, belly=4):
    a.line(x - w / 2 - 3, top, x + w / 2 + 3, top, z, wd + 0.4)
    a.path(f"M{n(x - w / 2)} {n(top)} L{n(x - w / 2 + 2)} {n(top + h)} Q{n(x)} {n(top + h + belly)} {n(x + w / 2 - 2)} {n(top + h)} L{n(x + w / 2)} {n(top)}", z, wd)
    a.path(f"M{n(x)} {n(top)} Q{n(x + 1)} {n(top + h / 2)} {n(x)} {n(top + h + belly * 0.7)}", 3, 1.0, 0.5)


def lateen(a, mx, top, bot, tip_x, tip_y, z=0, wd=2.0):
    a.line(mx, top, mx, bot, z, 2.6)
    a.line(mx - 22, bot - 6, tip_x, tip_y, z, 2.2)
    a.path(f"M{n(mx - 20)} {n(bot - 8)} L{n(tip_x - 1)} {n(tip_y + 2)} L{n(mx + 2)} {n(bot - 8)} Z", z, wd)
    a.path(f"M{n(mx - 6)} {n(bot - 10)} L{n(tip_x - 2)} {n(tip_y + 4)}", 3, 1.0, 0.5)


def cleat_shape(a, cx, cy, w=30, z=0, wd=2.2):
    a.path(f"M{n(cx - w / 2)} {n(cy - 6)} Q{n(cx - w / 2 - 4)} {n(cy - 6)} {n(cx - w / 2 - 4)} {n(cy - 2)} L{n(cx - w / 4)} {n(cy + 4)} L{n(cx + w / 4)} {n(cy + 4)} L{n(cx + w / 2 + 4)} {n(cy - 2)} Q{n(cx + w / 2 + 4)} {n(cy - 6)} {n(cx + w / 2)} {n(cy - 6)} L{n(cx + 4)} {n(cy - 2)} L{n(cx - 4)} {n(cy - 2)} Z", z, wd)


@item("Sailing Rig Components")
def _():
    a = Art()
    mast(a, 50, 12, 70)
    a.line(30, 24, 70, 24, 0, 2.2)
    a.path("M30 24 L34 52 Q50 58 66 52 L70 24", 0, 2.0)
    a.path("M50 12 L22 70 M50 12 L78 70", 3, 1.2, 0.6)
    a.line(14, 70, 86, 70, 0, 2.4)
    a.circle(50, 12, 2.4, 6, 1.4)
    a.path("M30 54 L24 70 M70 54 L76 70", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("Square Sail Panel")
def _():
    a = Art()
    a.line(14, 22, 86, 22, 0, 2.6)
    a.rect(18, 22, 64, 54, 0, 2.0)
    for x in (34, 50, 66):
        a.line(x, 22, x, 76, 3, 1.0, 0.6)
    for y in (36, 50, 64):
        a.line(18, y, 82, y, 3, 1.0, 0.4)
    a.circle(18, 76, 2.2, 6, 1.4)
    a.circle(82, 76, 2.2, 6, 1.4)
    a.ground(90)
    return a


@item("Square Rig Sail")
def _():
    a = Art()
    mast(a, 50, 8, 74)
    sail_sq(a, 50, 18, 56, 40, 0, 2.2, 5)
    a.path("M22 58 L16 74 M78 58 L84 74", 3, 1.2, 0.7)
    hull(a, 14, 86, 78)
    a.ground(94)
    return a


@item("Reefed Square Sail")
def _():
    a = Art()
    mast(a, 50, 8, 74)
    sail_sq(a, 50, 18, 56, 40, 0, 2.2, 4)
    a.line(24, 32, 76, 32, 6, 1.4)
    for x in range(30, 74, 8):
        a.line(x, 32, x + 1, 38, 6, 1.4)
    a.path("M22 58 L16 74 M78 58 L84 74", 3, 1.2, 0.7)
    hull(a, 14, 86, 78)
    a.ground(94)
    return a


@item("Multi Mast Square Rig")
def _():
    a = Art()
    for x, top, w in ((26, 24, 30), (50, 10, 36), (74, 22, 28)):
        mast(a, x, top - 4, 74, 0, 2.2)
        sail_sq(a, x, top, w, 38 - (top - 10) * 0.4, 0, 1.8, 3)
    a.path("M26 20 L50 6 L74 18", 3, 1.0, 0.6)
    hull(a, 10, 90, 78)
    a.ground(94)
    return a


@item("Lateen Sail Panel")
def _():
    a = Art()
    a.path("M14 74 L78 14 L78 74 Z", 0, 2.4)
    a.path("M26 74 L78 26 M42 74 L78 38 M58 74 L78 52", 3, 1.0, 0.55)
    a.line(14, 74, 78, 14, 6, 1.6)
    a.line(14, 78, 78, 78, 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Lateen Yard Rig")
def _():
    a = Art()
    lateen(a, 52, 12, 70, 86, 20)
    a.line(52, 70, 18, 78, 0, 2.0)
    hull(a, 12, 88, 78)
    a.path("M52 12 L86 20", 3, 1.0, 0.5)
    a.ground(94)
    return a


@item("Adjustable Lateen Rig")
def _():
    a = Art()
    lateen(a, 50, 12, 68, 84, 22)
    a.line(46, 30, 56, 38, 6, 1.6)
    a.circle(52, 34, 3, 6, 1.4)
    a.path("M56 38 L70 64 M84 24 L78 64", 3, 1.2, 0.7)
    a.rect(66, 62, 8, 6, 6, 1.4)
    hull(a, 12, 88, 78)
    a.ground(94)
    return a


@item("Balanced Lateen Rig")
def _():
    a = Art()
    mast(a, 46, 10, 70)
    a.line(14, 60, 82, 18, 0, 2.2)
    a.path("M20 58 L80 22 L46 62 Z", 0, 1.8)
    a.path("M14 60 L30 64 L46 62", 0, 1.6)
    a.line(14, 60, 8, 66, 6, 1.6)
    a.circle(8, 68, 2, 6, 1.2)
    a.path("M46 10 L82 18", 3, 1.0, 0.5)
    hull(a, 12, 88, 78)
    a.ground(94)
    return a


@item("Sail Cleat")
def _():
    a = Art()
    cleat_shape(a, 50, 44, 40, 0, 2.4)
    a.circle(36, 56, 2, 6, 1.4)
    a.circle(64, 56, 2, 6, 1.4)
    a.path("M20 70 L80 70", 3, 1.0, 0.45)
    a.ground(86)
    return a


@item("Rigging Cleat")
def _():
    a = Art()
    cleat_shape(a, 50, 40, 36, 0, 2.4)
    a.path("M20 40 Q30 62 50 56 Q70 50 80 70", 6, 2.0)
    a.path("M28 52 Q46 62 56 48", 3, 1.0, 0.5)
    a.circle(34, 58, 1.6, 3, 1.1)
    a.circle(66, 58, 1.6, 3, 1.1)
    a.path("M16 72 L84 72", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Deck Mounted Cleat")
def _():
    a = Art()
    a.path("M10 66 L90 66 L84 78 L16 78 Z", 0, 2.2)
    for x in range(22, 80, 12):
        a.line(x, 66, x - 2, 78, 3, 1.0, 0.45)
    cleat_shape(a, 50, 54, 32, 6, 2.4)
    a.circle(40, 62, 1.6, 3, 1.1)
    a.circle(60, 62, 1.6, 3, 1.1)
    a.ground(90)
    return a


@item("Self Tailing Sail Winch")
def _():
    a = Art()
    a.ellipse(50, 30, 20, 6, 0, 2.2)
    a.path("M30 30 L34 62 Q50 70 66 62 L70 30", 0, 2.2)
    for y in (40, 48, 56):
        a.path(f"M32 {y} Q50 {y + 6} 68 {y}", 3, 1.2, 0.6)
    a.ellipse(50, 30, 8, 2.4, 6, 1.4)
    a.line(70, 22, 90, 14, 6, 2.2)
    a.circle(92, 13, 2.4, 6, 1.4)
    a.path("M20 52 Q30 50 36 48 Q44 44 56 46", 6, 1.8)
    a.ground(90)
    return a


@item("Wooden Mast Section")
def _():
    a = Art()
    a.path("M40 12 L40 80 M60 12 L60 80", 0, 2.4)
    a.ellipse(50, 12, 10, 3, 0, 2.0)
    a.ellipse(50, 80, 10, 3, 0, 2.0)
    for y in (30, 54):
        a.path(f"M38 {y} Q50 {y + 4} 62 {y}", 6, 2.0)
    a.path("M46 18 Q44 40 46 72 M54 22 Q56 44 54 70", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Stayed Mast")
def _():
    a = Art()
    mast(a, 50, 10, 76)
    a.path("M50 14 L18 74 M50 14 L82 74 M50 30 L30 74 M50 30 L70 74", 3, 1.4, 0.8)
    a.line(14, 76, 86, 76, 0, 2.4)
    a.circle(50, 10, 2.4, 6, 1.4)
    a.ground(90)
    return a


@item("Multi Spreader Mast")
def _():
    a = Art()
    mast(a, 50, 8, 76)
    for y, w in ((24, 12), (42, 17), (58, 22)):
        a.line(50 - w, y, 50 + w, y, 6, 2.0)
    a.path("M50 10 L38 24 L33 42 L28 58 L22 76 M50 10 L62 24 L67 42 L72 58 L78 76", 3, 1.3, 0.8)
    a.line(14, 76, 86, 76, 0, 2.4)
    a.ground(90)
    return a


@item("Carbon Composite Mast")
def _():
    a = Art()
    a.path("M44 10 L42 78 M56 10 L58 78", 0, 2.4)
    a.ellipse(50, 10, 6, 2, 0, 2.0)
    for y in range(18, 74, 8):
        a.path(f"M43 {y + 6} L57 {y}", 3, 1.0, 0.55)
        a.path(f"M43 {y} L57 {y + 6}", 3, 1.0, 0.35)
    a.line(42, 78, 58, 78, 0, 2.2)
    sparkle(a, 70, 30, 3)
    sparkle(a, 28, 50, 2.6)
    a.ground(90)
    return a


@item("Standing Rigging Rope")
def _():
    a = Art()
    a.path("M16 74 L50 18", 0, 2.4)
    a.path("M20 74 L52 20", 0, 1.2, 0.6)
    for k in range(7):
        t = k / 6
        a.line(16 + 34 * t - 2, 74 - 56 * t, 16 + 34 * t + 3, 74 - 56 * t - 3, 3, 1.0, 0.7)
    a.circle(50, 16, 3.2, 6, 1.6)
    a.path("M70 74 L88 40", 0, 2.0)
    a.circle(70, 74, 3, 6, 1.4)
    a.ground(90)
    return a


@item("Shrouded Mast Rig")
def _():
    a = Art()
    mast(a, 50, 10, 74)
    for dx in (-26, -18, 18, 26):
        a.line(50, 18, 50 + dx, 76, 3, 1.4, 0.8)
    for y in range(34, 70, 8):
        a.line(50 - (y - 18) * 0.42, y, 50 - (y - 18) * 0.3, y, 6, 1.1)
        a.line(50 + (y - 18) * 0.3, y, 50 + (y - 18) * 0.42, y, 6, 1.1)
    hull(a, 14, 86, 78)
    a.ground(94)
    return a


@item("Turnbuckle Rigging")
def _():
    a = Art()
    a.line(10, 50, 30, 50, 0, 2.2)
    a.line(70, 50, 90, 50, 0, 2.2)
    a.path("M30 42 L70 42 L70 58 L30 58 Z", 0, 2.2)
    a.line(40, 42, 40, 58, 3, 1.0, 0.6)
    a.line(60, 42, 60, 58, 3, 1.0, 0.6)
    for x in range(34, 68, 4):
        a.line(x, 46, x + 2, 54, 6, 1.0, 0.5)
    a.circle(8, 50, 3, 6, 1.6)
    a.circle(92, 50, 3, 6, 1.6)
    a.ground(86)
    return a


@item("Rod Rigging Assembly")
def _():
    a = Art()
    mast(a, 50, 10, 76)
    a.path("M50 16 L22 76 M50 16 L78 76", 0, 2.0)
    for (x, y) in ((50, 16), (22, 76), (78, 76)):
        a.circle(x, y, 2.4, 6, 1.4)
    a.path("M36 46 L40 50 M64 46 L60 50", 6, 1.8)
    a.line(14, 76, 86, 76, 0, 2.4)
    a.path("M30 62 L36 62 M64 62 L70 62", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Sail Steering Oar")
def _():
    a = Art()
    a.line(70, 12, 40, 72, 0, 2.6)
    a.path("M40 72 L30 84 L44 82 L50 70 Z", 0, 2.0)
    a.path("M64 24 L78 22 M70 36 L84 32", 6, 1.8)
    a.path("M10 60 L52 60 L66 70 L10 70 Z", 0, 2.0)
    a.path("M8 80 Q22 74 36 80 T64 80", 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Sternpost Rudder")
def _():
    a = Art()
    a.path("M70 14 L78 70 L66 74", 0, 2.4)
    a.path("M78 70 L66 74 L62 54 L72 52 Z", 0, 2.0)
    for y in (24, 40, 56):
        a.rect(70, y, 6, 4, 6, 1.4)
    a.line(76, 14, 90, 8, 6, 2.2)
    a.path("M10 44 L68 38 L70 66 L10 66 Z", 0, 2.0)
    a.path("M8 78 Q22 72 36 78 T64 78", 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Wheel Driven Rudder")
def _():
    a = Art()
    a.circle(34, 36, 16, 0, 2.4)
    a.circle(34, 36, 4, 6, 1.6)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.line(34 + 4 * math.cos(t), 36 + 4 * math.sin(t), 34 + 22 * math.cos(t), 36 + 22 * math.sin(t), 6, 1.6)
    a.path("M34 52 L34 64 L78 64 M78 64 L78 80 L66 80 Z", 3, 1.4, 0.7)
    a.path("M70 56 L82 56 L84 80 L68 80 Z", 0, 2.0)
    a.line(34, 52, 70, 60, 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Hydraulic Steering Gear")
def _():
    a = Art()
    a.circle(24, 34, 12, 0, 2.2)
    a.circle(24, 34, 3, 6, 1.4)
    for k in range(6):
        t = math.pi * 2 * k / 6
        a.line(24 + 3 * math.cos(t), 34 + 3 * math.sin(t), 24 + 16 * math.cos(t), 34 + 16 * math.sin(t), 6, 1.4)
    a.rect(44, 28, 20, 12, 0, 2.2)
    a.path("M36 36 L44 34 M64 34 L72 34", 3, 1.6)
    a.path("M24 46 L24 66 L56 66 L56 54", 3, 1.6, 0.8)
    a.rect(48, 48, 20, 10, 0, 2.2)
    a.line(68, 53, 82, 53, 6, 2.4)
    a.path("M80 48 L90 64 L84 76 L74 62 Z", 0, 2.0)
    a.ground(90)
    return a
