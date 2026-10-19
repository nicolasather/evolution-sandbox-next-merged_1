"""Topic 19 - bridges and spans (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("bridges and spans")


def river(a, y=76, x0=6, x1=94, z=3):
    a.path(f"M{x0} {y} Q{x0 + 12} {y - 4} {x0 + 24} {y} T{x0 + 48} {y} T{x0 + 72} {y} T{x1} {y}", z, 1.2, 0.55)
    a.path(f"M{x0 + 8} {y + 6} Q{x0 + 20} {y + 2} {x0 + 32} {y + 6} T{x0 + 56} {y + 6} T{x1 - 6} {y + 6}", z, 1.0, 0.4)


def banks(a, y=58, gap0=30, gap1=70, z=0, w=2.2):
    a.path(f"M6 {y} L{gap0} {y} L{gap0 - 4} 80 L6 80", z, w)
    a.path(f"M94 {y} L{gap1} {y} L{gap1 + 4} 80 L94 80", z, w)


def deck(a, x0, x1, y, z=0, w=2.2, t=5):
    a.line(x0, y, x1, y, z, w)
    a.line(x0, y + t, x1, y + t, z, w)


def railing(a, x0, x1, y, h=8, step=8, z=3):
    a.line(x0, y - h, x1, y - h, z, 1.2, 0.8)
    x = x0
    while x <= x1 + 0.1:
        a.line(x, y - h, x, y, z, 1.0, 0.7)
        x += step


def pier(a, cx, top, bot, w=8, z=0, wd=2.2):
    a.rect(cx - w / 2, top, w, bot - top, z, wd)


def tower(a, cx, top, bot, w=6, z=0):
    a.line(cx - w / 2, top, cx - w, bot, z, 2.4)
    a.line(cx + w / 2, top, cx + w, bot, z, 2.4)
    a.line(cx - w * 0.75, (top + bot) / 2, cx + w * 0.75, (top + bot) / 2, z, 1.6)


@item("Bridge Construction Kit")
def _():
    a = Art()
    a.line(10, 40, 90, 40, 0, 2.4)
    for x in range(16, 90, 12):
        a.line(x, 40, x + 6, 28, 3, 1.4, 0.8)
        a.line(x + 6, 28, x + 12, 40, 3, 1.4, 0.8)
    a.rect(14, 56, 28, 10, 6, 1.8)
    a.line(18, 56, 18, 66, 3, 1.0, 0.5)
    a.line(28, 56, 28, 66, 3, 1.0, 0.5)
    a.path("M52 62 L88 62 M52 70 L88 70 M58 56 L58 76 M82 56 L82 76", 6, 1.6)
    a.circle(66, 64, 4, 3, 1.2, 0.7)
    a.ground(90)
    return a


@item("Log Footbridge")
def _():
    a = Art()
    banks(a, 56, 30, 70)
    a.ellipse(50, 54, 28, 4, 0, 2.4)
    a.line(22, 54, 22, 58, 0, 2.0)
    a.line(78, 54, 78, 58, 0, 2.0)
    a.path("M26 52 L74 52 L74 56 L26 56 Z", 6, 2.0)
    a.ellipse(24, 54, 2, 4, 6, 1.2)
    a.path("M30 54 Q50 58 70 54", 3, 1.0, 0.5)
    river(a, 76)
    a.ground(90)
    return a


@item("Timber Beam Footbridge")
def _():
    a = Art()
    banks(a, 52, 28, 72)
    deck(a, 20, 80, 50, 0, 2.2, 6)
    for x in range(26, 78, 7):
        a.line(x, 50, x, 56, 3, 1.0, 0.5)
    railing(a, 24, 76, 50, 9, 10)
    river(a, 78)
    a.ground(90)
    return a


@item("Timber Truss Footbridge")
def _():
    a = Art()
    banks(a, 56, 24, 76)
    deck(a, 16, 84, 54, 0, 2.4, 5)
    a.line(24, 28, 76, 28, 0, 2.2)
    for x in range(24, 76, 13):
        a.line(x, 54, x + 6.5, 28, 3, 1.5)
        a.line(x + 6.5, 28, x + 13, 54, 3, 1.5)
    a.line(24, 28, 24, 54, 0, 2.0)
    a.line(76, 28, 76, 54, 0, 2.0)
    river(a, 80)
    a.ground(92)
    return a


@item("Covered Timber Bridge")
def _():
    a = Art()
    banks(a, 58, 24, 76)
    a.path("M16 36 L50 20 L84 36", 0, 2.4)
    a.rect(20, 36, 60, 22, 0, 2.2)
    a.path("M32 44 L32 58 L46 58 L46 44 Z", 3, 1.4, 0.8)
    a.rect(54, 42, 14, 10, 3, 1.4, 0.8)
    for x in (22, 78):
        a.line(x, 36, x, 58, 3, 1.0, 0.5)
    river(a, 80)
    a.ground(92)
    return a


@item("Stone Stepping Crossing")
def _():
    a = Art()
    for (x, y, rx) in ((16, 54, 7), (32, 56, 8), (48, 54, 7), (64, 56, 8), (80, 54, 7)):
        a.ellipse(x, y, rx, 4, 0, 2.2)
        a.path(f"M{x - rx} {y} L{x - rx} {y + 8} Q{x} {y + 14} {x + rx} {y + 8} L{x + rx} {y}", 0, 2.0)
    river(a, 72)
    a.path("M8 80 Q30 76 50 80 T92 80", 3, 1.0, 0.4)
    a.path("M10 40 L24 36 M70 40 L88 34", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Stone Slab Bridge")
def _():
    a = Art()
    banks(a, 52, 22, 78)
    a.rect(16, 46, 68, 8, 0, 2.4)
    a.line(16, 50, 84, 50, 3, 1.0, 0.5)
    pier(a, 50, 54, 78, 10, 0, 2.2)
    a.path("M45 60 L55 60 M45 68 L55 68", 3, 1.0, 0.5)
    river(a, 80)
    a.ground(92)
    return a


@item("Stone Arch Span")
def _():
    a = Art()
    a.path("M8 36 L92 36", 0, 2.4)
    a.path("M8 36 L8 78 M92 36 L92 78", 0, 2.4)
    a.path("M26 78 L26 62 A24 24 0 0 1 74 62 L74 78", 0, 2.4)
    for k in range(7):
        t = math.pi * (0.1 + 0.8 * k / 6)
        a.line(50 - 24 * math.cos(t), 62 - 24 * math.sin(t), 50 - 32 * math.cos(t), 62 - 32 * math.sin(t), 3, 1.2, 0.8)
    a.line(8, 44, 92, 44, 3, 1.0, 0.45)
    river(a, 80)
    a.ground(92)
    return a


@item("Multi Span Stone Arch Bridge")
def _():
    a = Art()
    a.line(6, 32, 94, 32, 0, 2.4)
    a.line(6, 40, 94, 40, 3, 1.0, 0.5)
    for cx in (24, 50, 76):
        a.path(f"M{cx - 11} 76 L{cx - 11} 62 A11 11 0 0 1 {cx + 11} 62 L{cx + 11} 76", 0, 2.2)
    for x in (13, 37, 63, 87):
        a.line(x, 40, x, 76, 0, 2.2)
    a.line(6, 32, 6, 76, 0, 2.2)
    a.line(94, 32, 94, 76, 0, 2.2)
    river(a, 80)
    a.ground(92)
    return a


@item("Rope Suspension Crossing")
def _():
    a = Art()
    a.line(10, 26, 10, 78, 0, 2.6)
    a.line(90, 26, 90, 78, 0, 2.6)
    a.path("M10 30 Q50 62 90 30", 0, 2.0)
    a.path("M10 44 Q50 76 90 44", 0, 2.0)
    for k in range(1, 9):
        x = 10 + k * 10
        t = k / 9
        y1 = 30 + 32 * 4 * t * (1 - t) * 0.97
        y2 = 44 + 32 * 4 * t * (1 - t) * 0.97
        a.line(x, y1, x, y2, 3, 1.0, 0.7)
    a.path("M10 44 L2 56 M90 44 L98 56", 3, 1.2, 0.6)
    a.ground(92)
    return a


@item("Simple Rope Bridge")
def _():
    a = Art()
    a.line(10, 24, 10, 76, 0, 2.6)
    a.line(90, 24, 90, 76, 0, 2.6)
    a.path("M10 52 Q50 68 90 52", 0, 2.6)
    for k in range(1, 12):
        x = 10 + k * 6.7
        t = k / 12
        y = 52 + 16 * 4 * t * (1 - t) * 0.97
        a.line(x - 2, y - 1, x + 2, y + 1, 6, 1.8)
    a.path("M10 36 Q50 52 90 36", 3, 1.4, 0.7)
    river(a, 82)
    a.ground(92)
    return a


@item("Suspension Footbridge")
def _():
    a = Art()
    tower(a, 22, 18, 76, 5)
    tower(a, 78, 18, 76, 5)
    a.path("M4 66 L22 20 Q50 54 78 20 L96 66", 0, 2.0)
    deck(a, 6, 94, 62, 0, 2.2, 4)
    for k in range(1, 9):
        x = 22 + k * 7
        t = k / 8
        y = 20 + 24 * 4 * t * (1 - t) * 0.97
        a.line(x, y + 2, x, 62, 3, 1.0, 0.7)
    river(a, 82)
    a.ground(92)
    return a


@item("Cable Stayed Footbridge")
def _():
    a = Art()
    a.line(50, 12, 50, 74, 0, 3.0)
    deck(a, 6, 94, 60, 0, 2.2, 4)
    for k in range(1, 5):
        a.line(50, 18 + k * 6, 50 - k * 9, 60, 3, 1.3, 0.85)
        a.line(50, 18 + k * 6, 50 + k * 9, 60, 3, 1.3, 0.85)
    pier(a, 50, 64, 78, 8, 0, 2.0)
    river(a, 82)
    a.ground(92)
    return a


@item("Timber Pile Support")
def _():
    a = Art()
    for x in (24, 40, 56, 72):
        a.line(x, 36, x, 78, 0, 3.0)
        a.path(f"M{x - 3} 78 L{x} 84 L{x + 3} 78", 0, 1.6)
        a.ellipse(x, 36, 3, 1.2, 6, 1.2)
    a.line(18, 34, 80, 34, 6, 2.6)
    a.line(18, 28, 80, 28, 6, 2.0)
    a.line(24, 50, 56, 66, 3, 1.4, 0.6)
    a.line(72, 50, 40, 66, 3, 1.4, 0.6)
    river(a, 72)
    a.ground(92)
    return a


@item("Bridge Trestle Pier")
def _():
    a = Art()
    a.line(10, 30, 90, 30, 0, 2.4)
    a.line(26, 30, 14, 78, 0, 2.6)
    a.line(74, 30, 86, 78, 0, 2.6)
    a.line(26, 30, 50, 54, 3, 1.5)
    a.line(74, 30, 50, 54, 3, 1.5)
    a.line(20, 54, 80, 54, 6, 1.8)
    a.line(14, 78, 40, 54, 3, 1.3, 0.7)
    a.line(86, 78, 60, 54, 3, 1.3, 0.7)
    a.line(8, 78, 92, 78, 0, 2.0)
    a.ground(92)
    return a


@item("Braced Bridge Pier")
def _():
    a = Art()
    a.line(10, 28, 90, 28, 0, 2.4)
    a.line(34, 28, 30, 78, 0, 2.6)
    a.line(66, 28, 70, 78, 0, 2.6)
    for (y0, y1) in ((28, 44), (44, 60), (60, 78)):
        a.line(34 - (y0 - 28) * 0.08, y0, 66 + (y0 - 28) * 0.08, y1, 3, 1.4)
        a.line(66 + (y0 - 28) * 0.08, y0, 34 - (y0 - 28) * 0.08, y1, 3, 1.4, 0.7)
    for y in (44, 60):
        a.line(32, y, 68, y, 6, 1.6)
    a.line(22, 78, 78, 78, 0, 2.4)
    a.ground(92)
    return a


@item("Reinforced Concrete Bridge Pier")
def _():
    a = Art()
    a.line(8, 28, 92, 28, 0, 2.4)
    a.line(8, 36, 92, 36, 0, 2.0)
    a.rect(38, 36, 24, 36, 0, 2.4)
    for x in (43, 50, 57):
        a.line(x, 40, x, 68, 3, 1.4, 0.8)
    for y in (44, 54, 64):
        a.line(40, y, 60, y, 3, 1.0, 0.6)
    a.rect(26, 72, 48, 8, 0, 2.4)
    a.path("M26 80 L20 86 M74 80 L80 86", 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Cantilever Timber Beam")
def _():
    a = Art()
    a.path("M6 50 L36 50 L36 78 L6 78", 0, 2.4)
    a.rect(16, 40, 60, 8, 0, 2.4)
    for x in (24, 40, 56):
        a.line(x, 40, x, 48, 3, 1.0, 0.5)
    a.line(36, 48, 56, 48, 3, 1.0, 0.5)
    a.path("M20 48 L36 62 M20 48 L20 62", 3, 1.2, 0.6)
    arrow(a, 70, 28, 70, 38, 3, 1.4, 0.8, 3)
    a.path("M78 44 Q90 50 92 62", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Cantilever Bridge Arm")
def _():
    a = Art()
    pier(a, 24, 46, 78, 12, 0, 2.4)
    a.line(6, 44, 48, 44, 0, 2.4)
    a.path("M12 44 L24 28 L48 40", 0, 2.0)
    a.line(24, 28, 24, 44, 3, 1.3, 0.8)
    a.line(36, 34, 36, 44, 3, 1.3, 0.8)
    a.line(48, 44, 66, 44, 6, 2.0)
    river(a, 82)
    a.ground(92)
    return a


@item("Balanced Cantilever Span")
def _():
    a = Art()
    pier(a, 50, 44, 80, 12, 0, 2.4)
    a.line(8, 40, 92, 40, 0, 2.4)
    a.line(8, 46, 92, 46, 3, 1.0, 0.5)
    a.path("M50 14 L22 40 M50 14 L78 40", 0, 2.0)
    a.line(50, 14, 50, 40, 3, 1.3, 0.8)
    a.line(36, 27, 36, 40, 3, 1.1, 0.7)
    a.line(64, 27, 64, 40, 3, 1.1, 0.7)
    a.path("M8 40 L8 66 M92 40 L92 66", 0, 2.0)
    river(a, 84)
    a.ground(94)
    return a


@item("Steel Cantilever Bridge")
def _():
    a = Art()
    a.line(6, 52, 94, 52, 0, 2.4)
    for cx in (28, 72):
        a.path(f"M{cx - 10} 52 L{cx} 18 L{cx + 10} 52", 0, 2.2)
        a.line(cx - 6, 36, cx + 6, 36, 3, 1.3)
        a.line(cx, 18, cx, 52, 3, 1.2, 0.7)
    a.path("M28 18 L50 36 L72 18", 0, 2.0)
    for x in range(12, 90, 8):
        a.line(x, 52, x + 4, 44, 3, 1.1, 0.6)
    a.path("M16 52 L16 78 M84 52 L84 78", 0, 2.2)
    river(a, 82)
    a.ground(94)
    return a


@item("Pontoon Float")
def _():
    a = Art()
    a.path("M16 50 L84 50 L76 66 L24 66 Z", 0, 2.4)
    a.path("M16 50 L28 40 L96 40 L84 50", 0, 2.2)
    a.line(96, 40, 96, 52, 0, 2.2)
    a.line(84, 66, 96, 52, 0, 2.2)
    a.line(24, 58, 76, 58, 3, 1.0, 0.5)
    river(a, 78)
    a.ground(90)
    return a


@item("Linked Pontoon Bridge")
def _():
    a = Art()
    for x in (10, 38, 66):
        a.path(f"M{x} 54 L{x + 22} 54 L{x + 18} 66 L{x + 4} 66 Z", 0, 2.2)
    a.line(6, 48, 94, 48, 0, 2.4)
    a.line(6, 52, 94, 52, 3, 1.0, 0.5)
    for x in (32, 60, 88):
        a.circle(x, 54, 2, 6, 1.4)
    railing(a, 8, 92, 48, 7, 12)
    river(a, 76)
    a.ground(90)
    return a


@item("Anchored Floating Bridge")
def _():
    a = Art()
    for x in (14, 42, 70):
        a.path(f"M{x} 46 L{x + 22} 46 L{x + 18} 58 L{x + 4} 58 Z", 0, 2.2)
    a.line(8, 42, 94, 42, 0, 2.4)
    for x in (25, 53, 81):
        a.path(f"M{x} 58 L{x - 4} 80 M{x} 58 L{x + 4} 80", 3, 1.2, 0.7)
        a.path(f"M{x - 5} 80 Q{x} 86 {x + 5} 80", 6, 1.6)
    river(a, 70)
    a.ground(92)
    return a


@item("Modular Military Pontoon Bridge")
def _():
    a = Art()
    for x in (8, 30, 52, 74):
        a.path(f"M{x} 48 L{x + 18} 48 L{x + 15} 60 L{x + 3} 60 Z", 0, 2.0)
    a.rect(6, 36, 88, 7, 0, 2.2)
    for x in range(14, 92, 10):
        a.line(x, 36, x, 43, 3, 1.0, 0.5)
    for x in (26, 48, 70):
        a.rect(x - 3, 42, 6, 8, 6, 1.6)
    a.path("M70 22 L86 22 L86 32 L70 32 Z", 6, 1.6)
    a.circle(74, 34, 2, 6, 1.2)
    a.circle(84, 34, 2, 6, 1.2)
    river(a, 74)
    a.ground(90)
    return a
