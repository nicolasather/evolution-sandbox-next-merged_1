"""Topic 30 - railway mechanics (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, gear_d, n
from .kit import droplet, sparkle
from .registry import item, topic

topic("railway mechanics")


def rail_profile(a, cx, y, w=16, h=22, z=0, wd=2.4):
    a.path(f"M{cx - w / 2} {y} L{cx + w / 2} {y} L{cx + w / 2} {y + 4} L{cx + 3} {y + 7} L{cx + 3} {y + h - 6} L{cx + w / 2 + 4} {y + h - 4} L{cx + w / 2 + 4} {y + h} L{cx - w / 2 - 4} {y + h} L{cx - w / 2 - 4} {y + h - 4} L{cx - 3} {y + h - 6} L{cx - 3} {y + 7} L{cx - w / 2} {y + 4} Z", z, wd)


def track_persp(a, z=0):
    a.line(44, 20, 24, 78, z, 2.4)
    a.line(56, 20, 76, 78, z, 2.4)
    for k in range(6):
        t = k / 5
        y = 26 + t * 48
        d = 7 + t * 24
        a.line(50 - d - 4, y, 50 + d + 4, y, 3, 2.0 if k % 2 == 0 else 1.6, 0.8)


def wheel(a, cx, cy, r, z=0, w=2.4, flange=True):
    a.circle(cx, cy, r, z, w)
    a.circle(cx, cy, r * 0.62, 3, 1.2, 0.7)
    a.circle(cx, cy, 3, 6, 1.6)
    for k in range(6):
        t = 2 * math.pi * k / 6
        a.line(cx + 3 * math.cos(t), cy + 3 * math.sin(t), cx + r * 0.62 * math.cos(t), cy + r * 0.62 * math.sin(t), 3, 1.2, 0.8)


def lamp(a, cx, cy, r=5, z=6, on=True):
    a.circle(cx, cy, r, z, 1.8)
    if on:
        a.circle(cx, cy, r * 0.4, 3, 1.0, 0.8)


@item("Railway Mechanical Stock")
def _():
    a = Art()
    rail_profile(a, 24, 38, 14, 22, 0)
    a.rect(44, 40, 38, 8, 0, 2.2)
    a.rect(44, 56, 38, 8, 0, 2.2)
    wheel(a, 30, 72, 8, 0, 2.0)
    a.line(44, 44, 82, 44, 3, 1.0, 0.5)
    a.circle(52, 60, 1.4, 6, 1.1)
    a.circle(74, 60, 1.4, 6, 1.1)
    a.ground(90)
    return a


@item("Iron Rail Section")
def _():
    a = Art()
    rail_profile(a, 36, 30, 20, 40, 0, 2.6)
    a.path("M20 76 L80 76 L86 70 L26 70 Z", 0, 1.8)
    a.line(60, 34, 84, 34, 3, 1.0, 0.5)
    a.line(60, 44, 80, 44, 3, 1.0, 0.5)
    a.line(60, 56, 78, 56, 3, 1.0, 0.5)
    a.path("M44 34 L56 34 M44 52 L56 52", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Fishplate Rail Joint")
def _():
    a = Art()
    a.path("M8 44 L48 44 L48 60 L8 60", 0, 2.4)
    a.path("M52 44 L92 44 L92 60 L52 60", 0, 2.4)
    a.rect(34, 40, 32, 24, 6, 2.2)
    for x in (40, 48, 56, 64):
        a.circle(x, 52, 2, 6, 1.4)
    a.line(48, 44, 48, 60, 3, 1.0, 0.5)
    a.path("M14 70 L86 70", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Continuous Welded Rail")
def _():
    a = Art()
    a.path("M6 40 L94 40 L94 56 L6 56", 0, 2.4)
    a.line(6, 48, 94, 48, 3, 1.0, 0.5)
    a.path("M44 34 Q50 26 56 34", 6, 1.8)
    a.path("M44 62 Q50 70 56 62", 6, 1.8)
    sparkle(a, 50, 48, 3.4, 6, 0.9)
    a.path("M14 74 L86 74", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Slab Track Rail")
def _():
    a = Art()
    a.path("M8 60 L70 60 L92 48 L30 48 Z", 0, 2.4)
    a.path("M8 60 L8 72 L70 72 L70 60 M70 72 L92 60 L92 48", 0, 2.4)
    a.line(24, 56, 70, 44, 6, 2.2)
    a.line(36, 62, 82, 50, 6, 2.2)
    for x in (30, 44, 58):
        a.line(x, 66, x + 18, 54, 3, 1.0, 0.6)
    a.path("M12 78 L72 78", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Wooden Sleeper")
def _():
    a = Art()
    a.path("M12 50 L64 50 L90 38 L38 38 Z", 0, 2.4)
    a.path("M12 50 L12 62 L64 62 L64 50 M64 62 L90 50 L90 38", 0, 2.4)
    a.path("M20 54 L56 54 M24 58 L58 58", 3, 1.0, 0.5)
    a.circle(30, 44, 1.6, 6, 1.1)
    a.circle(62, 44, 1.6, 6, 1.1)
    a.ground(86)
    return a


@item("Ballasted Track Sleeper")
def _():
    a = Art()
    a.path("M20 40 L60 40 L68 34 L28 34 Z", 0, 2.2)
    a.path("M20 40 L20 46 L60 46 L60 40", 0, 2.2)
    a.line(14, 28, 74, 28, 6, 2.4)
    a.line(18, 22, 70, 22, 6, 1.6, 0.9)
    for (x, y) in ((16, 60), (28, 66), (40, 62), (52, 68), (64, 62), (76, 66), (22, 74), (46, 76), (70, 74)):
        a.circle(x, y, 3, 3, 1.4, 0.9)
    a.path("M8 54 Q50 50 92 54", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Concrete Rail Sleeper")
def _():
    a = Art()
    a.path("M10 52 L78 52 L90 44 L22 44 Z", 0, 2.4)
    a.path("M10 52 L10 66 L78 66 L78 52 M78 66 L90 58 L90 44", 0, 2.4)
    a.line(10, 59, 78, 59, 3, 1.0, 0.5)
    a.circle(28, 49, 2.4, 6, 1.4)
    a.circle(62, 49, 2.4, 6, 1.4)
    a.line(20, 70, 70, 70, 3, 1.0, 0.4)
    a.line(30, 40, 30, 36, 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Resilient Rail Fastener")
def _():
    a = Art()
    rail_profile(a, 50, 30, 18, 24, 0, 2.2)
    a.path("M30 56 L70 56 L70 62 L30 62 Z", 0, 2.4)
    a.path("M30 48 Q40 44 44 52 L44 56 M70 48 Q60 44 56 52 L56 56", 6, 2.2)
    a.path("M22 70 L78 70", 3, 1.0, 0.4)
    a.circle(30, 66, 1.4, 6, 1.1)
    a.circle(70, 66, 1.4, 6, 1.1)
    a.ground(86)
    return a


@item("Rail Wagon Wheel")
def _():
    a = Art()
    wheel(a, 50, 46, 28, 0, 2.6)
    a.ellipse(50, 46, 28, 28, 3, 1.0, 0.45)
    a.path("M8 78 L92 78", 3, 1.4, 0.7)
    a.rect(44, 74, 12, 4, 6, 1.4)
    a.ground(88)
    return a


@item("Flanged Rail Wheel")
def _():
    a = Art()
    a.path("M30 20 L70 20 L70 24 L76 28 L76 64 L70 68 L70 72 L30 72 L30 68 L24 64 L24 28 L30 24 Z", 0, 2.4)
    a.line(30, 24, 30, 68, 3, 1.0, 0.5)
    a.line(70, 24, 70, 68, 3, 1.0, 0.5)
    a.ellipse(50, 46, 8, 14, 6, 1.6)
    a.path("M24 78 L76 78", 3, 1.4, 0.7)
    a.ground(88)
    return a


@item("Rail Wheelset")
def _():
    a = Art()
    wheel(a, 24, 50, 16, 0, 2.4)
    wheel(a, 76, 50, 16, 0, 2.4)
    a.line(24, 50, 76, 50, 6, 3.0)
    a.line(14, 70, 14, 74, 3, 1.0, 0.5)
    a.line(6, 70, 94, 70, 3, 1.4, 0.7)
    a.ground(86)
    return a


@item("Self Steering Rail Bogie")
def _():
    a = Art()
    a.path("M14 36 L86 36 L82 46 L18 46 Z", 0, 2.4)
    wheel(a, 26, 62, 12, 0, 2.2)
    wheel(a, 74, 62, 12, 0, 2.2)
    a.line(26, 62, 74, 62, 6, 2.0)
    a.path("M34 46 L34 54 M66 46 L66 54", 6, 1.8)
    a.path("M40 50 Q50 56 60 50", 3, 1.2, 0.7)
    a.path("M8 78 L92 78", 3, 1.4, 0.6)
    arrow(a, 38, 28, 62, 28, 3, 1.3, 0.7, 3)
    a.ground(88)
    return a


@item("Hand Operated Track Switch")
def _():
    a = Art()
    a.line(10, 44, 54, 44, 0, 2.4)
    a.line(10, 54, 54, 54, 0, 2.4)
    a.path("M54 44 L92 36 M54 54 L92 44", 0, 2.4)
    a.line(54, 54, 92, 54, 0, 2.4)
    a.line(54, 62, 92, 62, 0, 2.4)
    a.path("M40 44 L56 38 M40 54 L56 48", 3, 1.6, 0.8)
    a.line(46, 70, 46, 56, 6, 2.2)
    a.circle(46, 72, 3, 6, 1.6)
    a.ground(88)
    return a


@item("Lever Track Switch")
def _():
    a = Art()
    a.line(8, 40, 56, 40, 0, 2.4)
    a.line(8, 50, 56, 50, 0, 2.4)
    a.path("M56 40 L92 32 M56 50 L92 42 M56 50 L92 58 M56 40 L92 50", 0, 2.0)
    a.line(30, 50, 30, 76, 6, 2.6)
    a.path("M22 76 L38 76", 6, 2.4)
    a.line(30, 62, 44, 56, 6, 2.0)
    a.circle(30, 62, 2.6, 3, 1.4)
    a.path("M30 50 L44 56", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Interlocked Railway Switch")
def _():
    a = Art()
    a.line(8, 38, 50, 38, 0, 2.4)
    a.line(8, 48, 50, 48, 0, 2.4)
    a.path("M50 38 L92 30 M50 48 L92 56 M50 38 L92 48", 0, 2.0)
    a.rect(14, 60, 36, 18, 0, 2.4)
    a.line(22, 60, 22, 72, 6, 2.0)
    a.line(32, 60, 32, 72, 6, 2.0)
    a.line(42, 60, 42, 72, 6, 2.0)
    a.path("M50 66 L66 66 L66 52", 6, 1.8)
    a.circle(66, 50, 3, 6, 1.4)
    a.ground(88)
    return a


@item("Power Operated Track Switch")
def _():
    a = Art()
    a.line(6, 38, 54, 38, 0, 2.4)
    a.line(6, 48, 54, 48, 0, 2.4)
    a.path("M54 38 L94 30 M54 48 L94 56", 0, 2.0)
    a.rect(24, 60, 24, 18, 0, 2.4)
    a.circle(36, 69, 5, 6, 1.6)
    a.path("M30 60 L30 52 M42 60 L42 52", 6, 1.8)
    a.path("M70 66 L82 66 L76 76 L88 76", 6, 1.8)
    a.ground(88)
    return a


@item("Mechanical Rail Signal")
def _():
    a = Art()
    a.line(40, 80, 40, 18, 0, 3.0)
    a.path("M40 24 L76 24 L76 32 L40 32", 0, 2.4)
    a.circle(40, 24, 3, 6, 1.4)
    a.path("M34 40 L46 40 L44 54 L36 54 Z", 6, 1.6)
    a.path("M40 54 L40 60", 3, 1.2, 0.7)
    a.line(32, 80, 48, 80, 0, 2.4)
    a.path("M80 44 L90 44 M80 52 L88 52", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Semaphore Signal")
def _():
    a = Art()
    a.line(40, 82, 40, 14, 0, 3.0)
    a.path("M40 22 L80 14 L82 24 L40 32 Z", 0, 2.4)
    a.line(46, 21, 76, 17, 3, 1.0, 0.6)
    a.circle(40, 28, 3, 6, 1.6)
    a.path("M48 46 L60 42 L62 52 L50 56 Z", 3, 1.4, 0.7)
    a.path("M32 36 L24 40 L24 54 L40 54", 3, 1.2, 0.6)
    a.line(30, 82, 50, 82, 0, 2.4)
    a.ground(90)
    return a


@item("Color Light Railway Signal")
def _():
    a = Art()
    a.line(50, 80, 50, 60, 0, 3.0)
    a.rect(38, 12, 24, 48, 0, 2.6)
    lamp(a, 50, 24, 6, 6, True)
    lamp(a, 50, 36, 6, 6, False)
    lamp(a, 50, 48, 6, 6, False)
    a.path("M70 20 L80 16 M70 28 L82 28", 3, 1.2, 0.6)
    a.line(40, 80, 60, 80, 0, 2.4)
    a.ground(90)
    return a


@item("Cab Signalling Display")
def _():
    a = Art()
    a.path("M12 24 L88 24 L82 70 L18 70 Z", 0, 2.6)
    a.rect(22, 32, 24, 22, 3, 1.4, 0.8)
    a.path("M26 48 L32 38 L38 44 L42 36", 6, 1.6)
    lamp(a, 60, 40, 5, 6, True)
    lamp(a, 74, 40, 5, 6, False)
    a.line(54, 58, 78, 58, 3, 1.4, 0.7)
    a.path("M24 76 L76 76", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Rail Brake Shoe")
def _():
    a = Art()
    wheel(a, 56, 40, 24, 0, 2.4)
    a.path("M20 46 Q18 62 30 70 L42 66 Q34 56 36 46 Z", 0, 2.6)
    a.line(36, 52, 22, 64, 3, 1.0, 0.6)
    a.path("M18 70 L18 80", 6, 2.0)
    a.line(6, 80, 40, 80, 6, 2.0)
    arrow(a, 14, 38, 24, 44, 3, 1.3, 0.8, 3)
    a.ground(90)
    return a


@item("Vacuum Train Brake")
def _():
    a = Art()
    a.circle(30, 44, 16, 0, 2.4)
    a.circle(30, 44, 3, 6, 1.4)
    a.line(30, 44, 38, 36, 6, 1.6)
    a.path("M46 44 L66 44 L66 66 L90 66", 0, 2.2)
    a.ellipse(76, 36, 12, 8, 0, 2.2)
    a.path("M64 36 L64 44 M88 36 L88 44", 0, 2.2)
    a.path("M66 28 Q78 22 88 28", 3, 1.2, 0.6)
    a.path("M64 80 L90 80", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Air Train Brake")
def _():
    a = Art()
    a.rect(14, 30, 36, 26, 0, 2.6)
    a.circle(32, 43, 7, 6, 1.6)
    a.path("M50 43 L66 43 L66 66 L88 66", 0, 2.2)
    a.circle(76, 34, 9, 0, 2.2)
    a.line(76, 34, 82, 28, 6, 1.6)
    a.path("M20 62 L20 72 L42 72 L42 62", 3, 1.6, 0.8)
    a.path("M56 24 L64 20 M56 28 L66 28", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Electronically Controlled Train Brake")
def _():
    a = Art()
    a.rect(14, 24, 36, 28, 0, 2.6)
    a.path("M20 42 L26 32 L32 38 L38 30 L44 36", 6, 1.6)
    a.path("M50 38 L62 38 L62 62 L90 62", 0, 2.2)
    a.rect(64, 44, 22, 14, 0, 2.2)
    a.circle(75, 51, 4, 6, 1.4)
    a.path("M26 62 L26 74 M38 62 L38 74", 6, 1.8)
    a.path("M20 78 L90 78", 3, 1.0, 0.4)
    sparkle(a, 80, 26, 3, 6, 0.9)
    a.ground(90)
    return a
