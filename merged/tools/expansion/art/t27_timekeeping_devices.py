"""Topic 27 - timekeeping devices (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, gear_d, n
from .kit import droplet, sparkle
from .registry import item, topic

topic("timekeeping devices")


def face(a, cx, cy, r, z=0, w=2.4, ticks=12):
    a.circle(cx, cy, r, z, w)
    for k in range(ticks):
        t = 2 * math.pi * k / ticks
        a.line(cx + (r - 4) * math.cos(t), cy + (r - 4) * math.sin(t), cx + (r - 1) * math.cos(t), cy + (r - 1) * math.sin(t), 3, 1.2, 0.8)


def hand(a, cx, cy, L, ang, z=6, w=2.0):
    t = math.radians(ang)
    a.line(cx, cy, cx + L * math.cos(t), cy + L * math.sin(t), z, w)


def sun(a, cx, cy, r=5, z=6):
    a.circle(cx, cy, r, z, 1.6)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.line(cx + (r + 2) * math.cos(t), cy + (r + 2) * math.sin(t), cx + (r + 5) * math.cos(t), cy + (r + 5) * math.sin(t), z, 1.2)


def vessel(a, cx, top, w=30, h=30, z=0, wd=2.4):
    a.ellipse(cx, top, w / 2, w * 0.14, z, wd)
    a.path(f"M{cx - w / 2} {top} L{cx - w / 2 + 4} {top + h} Q{cx} {top + h + 5} {cx + w / 2 - 4} {top + h} L{cx + w / 2} {top}", z, wd)


def spring(a, cx, cy, r, z=6, turns=3):
    d = f"M{n(cx)} {n(cy)}"
    pts = []
    for i in range(turns * 14 + 1):
        t = i / 14
        rr = r * (0.15 + 0.85 * i / (turns * 14))
        ang = 2 * math.pi * t
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    a.poly(pts, z, 1.6, 0.9)


@item("Measured Timekeeping Parts")
def _():
    a = Art()
    face(a, 32, 38, 18, 0)
    hand(a, 32, 38, 12, -60)
    a.path(gear_d(70, 36, 12, 8.6, 10), 0, 2.0)
    a.circle(70, 36, 3, 6, 1.4)
    a.line(16, 72, 84, 72, 0, 2.2)
    a.line(50, 62, 50, 72, 0, 2.0)
    a.circle(50, 60, 4, 6, 1.6)
    a.ground(88)
    return a


@item("Water Clock Bowl")
def _():
    a = Art()
    vessel(a, 50, 28, 44, 40, 0, 2.4)
    a.path("M32 44 Q50 52 68 44", 6, 1.4, 0.8)
    for y in (46, 54, 62):
        a.line(34, y, 40, y, 6, 1.4)
    a.circle(50, 68, 2.4, 6, 1.4)
    droplet(a, 50, 82, 3.2)
    a.ground(90)
    return a


@item("Overflow Water Clock")
def _():
    a = Art()
    vessel(a, 32, 22, 34, 34, 0, 2.4)
    vessel(a, 68, 46, 34, 34, 0, 2.4)
    a.path("M44 34 L56 40 L56 50", 0, 2.0)
    a.line(32, 60, 36, 66, 3, 1.0, 0.5)
    for y in (54, 62, 70):
        a.line(58, y, 64, y, 6, 1.4)
    droplet(a, 50, 44, 2.6)
    a.path("M22 32 Q32 38 42 32", 6, 1.2, 0.7)
    a.ground(90)
    return a


@item("Regulated Water Clock")
def _():
    a = Art()
    vessel(a, 34, 16, 34, 30, 0, 2.4)
    vessel(a, 66, 52, 36, 28, 0, 2.4)
    a.line(34, 50, 34, 58, 0, 2.0)
    a.path("M30 58 L38 58 L36 64 L32 64 Z", 6, 1.8)
    a.path("M34 64 L34 68 L56 68", 3, 1.4, 0.7)
    for y in (58, 66, 74):
        a.line(56, y, 62, y, 6, 1.4)
    droplet(a, 46, 70, 2.4)
    a.ground(90)
    return a


@item("Automated Water Clock")
def _():
    a = Art()
    vessel(a, 30, 22, 30, 32, 0, 2.4)
    face(a, 68, 38, 18, 0, 2.4, 12)
    hand(a, 68, 38, 12, -80, 6, 2.0)
    a.line(30, 56, 30, 70, 0, 2.0)
    a.path(gear_d(46, 72, 8, 5.8, 8), 0, 1.8)
    a.path("M46 72 L68 56", 3, 1.2, 0.6)
    droplet(a, 30, 78, 2.6)
    a.ground(90)
    return a


@item("Sundial Gnomon")
def _():
    a = Art()
    a.path("M30 72 L30 28 L70 72 Z", 0, 2.6)
    a.path("M30 72 L72 72", 0, 2.6)
    a.line(30, 28, 30, 72, 3, 1.0, 0.5)
    sun(a, 78, 20, 5)
    a.line(18, 72, 18, 66, 3, 1.0, 0.7)
    a.path("M34 62 L52 72", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Horizontal Sundial")
def _():
    a = Art()
    a.ellipse(50, 58, 38, 14, 0, 2.4)
    a.ellipse(50, 58, 30, 10, 3, 1.0, 0.5)
    for k in range(-4, 5):
        t = math.pi / 2 + k * 0.22
        a.line(50 + 18 * math.cos(t), 58 - 7 * math.sin(t), 50 + 29 * math.cos(t), 58 - 10 * math.sin(t), 3, 1.0, 0.7)
    a.path("M50 58 L50 34 L62 58 Z", 6, 2.0)
    sun(a, 82, 22, 5)
    a.ground(86)
    return a


@item("Equatorial Sundial")
def _():
    a = Art()
    a.ellipse(50, 40, 28, 18, 0, 2.4)
    a.ellipse(50, 40, 20, 12, 3, 1.0, 0.5)
    a.line(32, 66, 68, 18, 6, 2.2)
    a.line(32, 66, 32, 70, 6, 2.0)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.line(50 + 20 * math.cos(t), 40 + 12 * math.sin(t), 50 + 27 * math.cos(t), 40 + 16.5 * math.sin(t), 3, 1.0, 0.7)
    a.path("M22 76 L78 76 L70 82 L30 82 Z", 0, 2.0)
    sun(a, 84, 14, 4)
    a.ground(90)
    return a


@item("Adjustable Portable Sundial")
def _():
    a = Art()
    a.path("M16 66 L62 66 L62 74 L16 74 Z", 0, 2.4)
    a.path("M20 66 L20 34 L56 34 L56 66", 0, 2.4)
    for k in range(5):
        a.line(24 + k * 7, 66, 28 + k * 7 * 0.7, 44, 3, 1.0, 0.7)
    a.line(38, 36, 52, 60, 6, 1.8)
    a.circle(38, 34, 3, 6, 1.4)
    a.path("M66 40 A12 12 0 0 1 74 58", 3, 1.4, 0.7)
    arrow(a, 74, 58, 72, 64, 3, 1.3, 0.8, 3)
    sun(a, 82, 24, 4)
    a.ground(90)
    return a


@item("Clock Weight")
def _():
    a = Art()
    a.line(50, 8, 50, 30, 0, 1.8)
    a.circle(50, 32, 4, 6, 1.6)
    a.path("M36 38 L64 38 L68 76 L32 76 Z", 0, 2.6)
    a.line(36, 52, 64, 52, 3, 1.0, 0.5)
    a.path("M34 62 L66 62", 3, 1.0, 0.5)
    a.path("M26 82 L74 82", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Weight Driven Clock")
def _():
    a = Art()
    a.rect(22, 12, 56, 46, 0, 2.6)
    face(a, 50, 34, 16, 3, 1.6, 12)
    hand(a, 50, 34, 11, -90, 6, 2.0)
    hand(a, 50, 34, 8, 20, 6, 2.4)
    a.line(36, 58, 36, 66, 0, 1.6)
    a.line(64, 58, 64, 70, 0, 1.6)
    a.path("M30 66 L42 66 L44 80 L28 80 Z", 6, 2.0)
    a.path("M58 70 L70 70 L72 84 L56 84 Z", 6, 2.0)
    a.ground(92)
    return a


@item("Escapement Clock")
def _():
    a = Art()
    a.path(gear_d(42, 46, 22, 17, 16), 0, 2.2)
    a.circle(42, 46, 3, 6, 1.4)
    a.path("M54 26 L66 18 L78 26 M66 18 L66 30", 6, 2.0)
    a.path("M54 28 L62 34", 3, 1.2, 0.7)
    a.line(66, 30, 66, 62, 6, 1.8)
    a.rect(60, 62, 12, 6, 6, 1.6)
    a.path("M20 78 L80 78", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Pendulum Regulated Clock")
def _():
    a = Art()
    a.rect(26, 10, 48, 70, 0, 2.6)
    face(a, 50, 30, 14, 3, 1.6, 12)
    hand(a, 50, 30, 10, -90, 6, 2.0)
    hand(a, 50, 30, 7, 30, 6, 2.4)
    a.rect(32, 48, 36, 26, 3, 1.2, 0.6)
    a.line(50, 48, 46, 64, 6, 1.6)
    a.circle(46, 66, 4, 6, 1.8)
    a.path("M40 74 L60 74", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Watch Mainspring")
def _():
    a = Art()
    spring(a, 50, 48, 30, 0, 5)
    a.circle(50, 48, 4, 6, 1.6)
    a.path("M80 48 Q88 48 88 58", 0, 2.0)
    a.circle(88, 60, 2, 6, 1.2)
    a.path("M20 80 L80 80", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Spring Driven Watch")
def _():
    a = Art()
    a.circle(50, 50, 28, 0, 2.6)
    face(a, 50, 50, 24, 3, 1.2, 12)
    hand(a, 50, 50, 16, -80, 6, 2.0)
    hand(a, 50, 50, 11, 10, 6, 2.4)
    a.path("M44 22 L44 10 L56 10 L56 22", 0, 2.2)
    a.circle(50, 8, 3, 6, 1.4)
    a.ground(86)
    return a


@item("Balance Wheel Watch")
def _():
    a = Art()
    a.circle(50, 48, 30, 0, 2.6)
    a.circle(50, 48, 18, 6, 2.0)
    a.line(32, 48, 68, 48, 6, 1.6)
    a.line(50, 30, 50, 66, 6, 1.6)
    a.circle(50, 48, 3, 6, 1.4)
    spring(a, 50, 48, 10, 3, 3)
    a.path("M36 30 L26 24 M64 30 L74 24", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Lever Escapement Watch")
def _():
    a = Art()
    a.path(gear_d(34, 46, 18, 13.6, 14), 0, 2.2)
    a.circle(34, 46, 3, 6, 1.4)
    a.path("M52 36 L66 44 L84 38 M66 44 L66 60", 6, 2.0)
    a.circle(66, 62, 5, 6, 1.6)
    a.path("M56 34 L60 40 M78 36 L82 42", 6, 1.6)
    a.path("M20 74 L80 74", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Quartz Crystal Blank")
def _():
    a = Art()
    a.path("M36 22 L64 22 L72 40 L64 74 L36 74 L28 40 Z", 0, 2.4)
    a.line(36, 22, 36, 74, 3, 1.0, 0.5)
    a.line(64, 22, 64, 74, 3, 1.0, 0.5)
    a.path("M28 40 L72 40", 3, 1.0, 0.5)
    sparkle(a, 78, 26, 3.4, 6, 0.9)
    sparkle(a, 22, 62, 2.6, 6, 0.8)
    a.ground(88)
    return a


@item("Quartz Oscillator Module")
def _():
    a = Art()
    a.rect(18, 30, 64, 40, 0, 2.4)
    a.path("M40 40 L60 40 L62 60 L38 60 Z", 6, 1.8)
    a.path("M44 46 Q48 42 50 50 T56 50", 6, 1.4)
    for x in (24, 34, 66, 76):
        a.line(x, 30, x, 22, 6, 1.8)
        a.line(x, 70, x, 78, 6, 1.8)
    a.circle(26, 56, 2, 3, 1.2)
    a.ground(90)
    return a


@item("Quartz Wristwatch")
def _():
    a = Art()
    a.path("M36 8 L64 8 L66 28 L34 28 Z", 0, 2.2)
    a.path("M34 72 L66 72 L64 92 L36 92 Z", 0, 2.2)
    a.circle(50, 50, 22, 0, 2.6)
    face(a, 50, 50, 18, 3, 1.2, 12)
    hand(a, 50, 50, 12, -90, 6, 2.0)
    hand(a, 50, 50, 8, 40, 6, 2.4)
    a.line(72, 50, 76, 50, 6, 2.0)
    a.ground(92)
    return a


@item("Radio Controlled Quartz Watch")
def _():
    a = Art()
    a.circle(40, 54, 24, 0, 2.6)
    face(a, 40, 54, 20, 3, 1.2, 12)
    hand(a, 40, 54, 14, -90, 6, 2.0)
    hand(a, 40, 54, 9, 30, 6, 2.4)
    a.path("M72 24 Q86 32 86 46 M76 14 Q96 26 96 46", 3, 1.4, 0.7)
    a.line(82, 52, 82, 74, 6, 1.6)
    a.path("M76 58 L82 52 L88 58", 6, 1.6)
    a.ground(90)
    return a


@item("Clock Dial Blank")
def _():
    a = Art()
    a.circle(50, 48, 32, 0, 2.6)
    a.circle(50, 48, 28, 3, 1.0, 0.5)
    a.circle(50, 48, 3, 6, 1.6)
    a.path("M30 78 L70 78", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Numbered Clock Face")
def _():
    a = Art()
    a.circle(50, 48, 32, 0, 2.6)
    for k in range(12):
        t = 2 * math.pi * k / 12 - math.pi / 2
        x, y = 50 + 25 * math.cos(t), 48 + 25 * math.sin(t)
        if k % 3 == 0:
            a.rect(x - 2.4, y - 2.4, 4.8, 4.8, 6, 1.4)
        else:
            a.circle(x, y, 1.4, 6, 1.2)
    a.circle(50, 48, 3, 6, 1.6)
    a.ground(86)
    return a


@item("Three Hand Clock Face")
def _():
    a = Art()
    a.circle(50, 48, 32, 0, 2.6)
    face(a, 50, 48, 28, 3, 1.2, 12)
    hand(a, 50, 48, 14, -60, 6, 3.0)
    hand(a, 50, 48, 22, 20, 6, 2.0)
    hand(a, 50, 48, 24, 110, 6, 1.0)
    a.circle(50, 48, 2.4, 6, 1.4)
    a.ground(86)
    return a


@item("Chronograph Watch Dial")
def _():
    a = Art()
    a.circle(50, 48, 34, 0, 2.6)
    face(a, 50, 48, 30, 3, 1.2, 12)
    for (cx, cy) in ((36, 48), (64, 48), (50, 64)):
        a.circle(cx, cy, 7, 6, 1.4)
        a.line(cx, cy, cx + 4, cy - 4, 6, 1.2)
    hand(a, 50, 48, 22, -90, 6, 1.6)
    a.circle(50, 48, 2, 6, 1.4)
    a.path("M70 14 L76 8 L82 14", 6, 1.8)
    a.ground(88)
    return a
