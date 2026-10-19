"""Topic 24 - optical apparatus (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("optical apparatus")


def lens(a, cx, cy, rx=8, ry=18, z=0, w=2.2):
    a.path(f"M{cx} {cy - ry} Q{cx + rx * 2} {cy} {cx} {cy + ry} Q{cx - rx * 2} {cy} {cx} {cy - ry} Z", z, w)


def concave(a, cx, cy, rx=8, ry=18, z=0, w=2.2):
    a.path(f"M{cx - rx} {cy - ry} Q{cx} {cy} {cx - rx} {cy + ry} L{cx + rx} {cy + ry} Q{cx} {cy} {cx + rx} {cy - ry} Z", z, w)


def rays(a, x0, cy, x1, spread=12, count=3, z=3, focus=None):
    for k in range(count):
        t = (k - (count - 1) / 2) / max(1, (count - 1) / 2)
        a.line(x0, cy + t * spread, x1, cy + (t * spread if focus is None else focus), z, 1.0, 0.7)


def scope_body(a, x0, x1, cy, r0, r1, z=0, w=2.4):
    a.path(f"M{x0} {cy - r0} L{x1} {cy - r1} L{x1} {cy + r1} L{x0} {cy + r0} Z", z, w)


def tripod(a, cx, top, spread=18, h=26, z=0):
    a.line(cx, top, cx - spread, top + h, z, 2.2)
    a.line(cx, top, cx + spread, top + h, z, 2.2)
    a.line(cx, top, cx, top + h, z, 2.0, 0.8)


def stand_base(a, cx, y, w=40, z=0):
    a.rect(cx - w / 2, y, w, 6, z, 2.2)


@item("Polished Optical Glass")
def _():
    a = Art()
    a.circle(50, 48, 28, 0, 2.4)
    a.circle(50, 48, 22, 3, 1.0, 0.5)
    a.path("M32 38 Q38 28 50 26", 6, 1.8, 0.8)
    sparkle(a, 70, 36, 3.4, 6, 0.9)
    sparkle(a, 36, 64, 2.6, 6, 0.8)
    a.path("M20 80 L80 80", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Single Magnifying Lens")
def _():
    a = Art()
    lens(a, 50, 48, 9, 24, 0, 2.4)
    rays(a, 10, 48, 41, 14, 3, 3)
    rays(a, 59, 48, 90, 0, 3, 3)
    a.path("M59 34 L90 48 M59 62 L90 48 M59 48 L90 48", 3, 1.0, 0.6)
    a.dot(90, 48, 1.6, 6)
    a.ground(88)
    return a


@item("Mounted Magnifier")
def _():
    a = Art()
    a.circle(40, 40, 22, 0, 2.6)
    a.circle(40, 40, 17, 3, 1.0, 0.5)
    a.line(56, 56, 84, 82, 0, 4.0)
    a.path("M30 32 Q34 26 42 26", 6, 1.6, 0.8)
    a.path("M28 40 L52 40", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Folding Pocket Magnifier")
def _():
    a = Art()
    a.path("M20 34 L56 34 L56 70 L20 70 Z", 0, 2.4)
    a.circle(38, 52, 12, 6, 1.8)
    a.path("M56 40 Q80 36 86 54 L60 62", 0, 2.2)
    a.line(56, 70, 76, 80, 6, 2.4)
    a.circle(74, 46, 2.4, 6, 1.4)
    a.path("M30 44 Q34 40 40 40", 6, 1.2, 0.7)
    a.ground(90)
    return a


@item("Illuminated Inspection Magnifier")
def _():
    a = Art()
    a.circle(50, 38, 22, 0, 2.6)
    a.circle(50, 38, 16, 3, 1.0, 0.5)
    for k in range(8):
        t = math.pi * 2 * k / 8
        a.circle(50 + 20 * math.cos(t), 38 + 20 * math.sin(t), 1.6, 6, 1.1)
    a.line(50, 60, 50, 74, 0, 3.0)
    a.rect(36, 74, 28, 8, 0, 2.2)
    sparkle(a, 20, 18, 3, 6, 0.9)
    sparkle(a, 82, 18, 3, 6, 0.9)
    a.ground(90)
    return a


@item("Convex Lens Pair")
def _():
    a = Art()
    lens(a, 36, 50, 8, 22, 0, 2.4)
    lens(a, 64, 50, 8, 22, 0, 2.4)
    a.path("M8 36 L28 40 M8 50 L28 50 M8 64 L28 60", 3, 1.0, 0.6)
    a.path("M44 40 L56 42 M44 50 L56 50 M44 60 L56 58", 3, 1.0, 0.6)
    a.path("M72 42 L94 50 M72 58 L94 50", 3, 1.0, 0.6)
    a.dot(94, 50, 1.6, 6)
    a.ground(88)
    return a


@item("Simple Refracting Telescope")
def _():
    a = Art()
    scope_body(a, 12, 78, 44, 7, 7, 0, 2.4)
    a.line(12, 36, 12, 52, 6, 2.4)
    a.line(78, 40, 78, 48, 6, 2.0)
    a.rect(78, 40, 8, 8, 0, 1.8)
    tripod(a, 50, 54, 18, 28, 0)
    a.path("M6 28 Q8 36 12 40", 3, 1.0, 0.5)
    sparkle(a, 20, 22, 2.6, 6, 0.8)
    a.ground(90)
    return a


@item("Achromatic Refractor")
def _():
    a = Art()
    scope_body(a, 12, 74, 42, 8, 6, 0, 2.4)
    lens(a, 14, 42, 2.4, 9, 6, 1.8)
    lens(a, 20, 42, 2.4, 9, 6, 1.8)
    a.rect(74, 38, 12, 8, 0, 2.0)
    a.line(40, 50, 40, 56, 0, 2.2)
    tripod(a, 40, 56, 16, 26, 0)
    a.path("M28 34 L64 36", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Apochromatic Telescope")
def _():
    a = Art()
    scope_body(a, 10, 72, 40, 9, 7, 0, 2.4)
    for dx in (14, 20, 26):
        lens(a, dx, 40, 2.2, 8, 6, 1.5)
    a.rect(72, 36, 14, 8, 0, 2.0)
    a.line(82, 28, 82, 36, 6, 2.0)
    a.circle(82, 26, 3, 6, 1.4)
    tripod(a, 42, 50, 18, 30, 0)
    a.path("M14 70 L24 70 M70 70 L78 70", 3, 1.0, 0.4)
    sparkle(a, 86, 62, 3, 6, 0.9)
    a.ground(90)
    return a


@item("Concave Mirror Blank")
def _():
    a = Art()
    a.ellipse(50, 44, 30, 22, 0, 2.4)
    a.ellipse(50, 48, 24, 16, 3, 1.0, 0.5)
    a.path("M20 44 L20 58 Q50 84 80 58 L80 44", 0, 2.4)
    a.path("M28 56 Q50 70 72 56", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Polished Concave Mirror")
def _():
    a = Art()
    a.ellipse(50, 44, 30, 22, 0, 2.4)
    a.ellipse(50, 48, 22, 15, 6, 1.4)
    a.path("M20 44 L20 58 Q50 84 80 58 L80 44", 0, 2.4)
    a.path("M34 40 Q42 32 56 34", 6, 1.8, 0.8)
    sparkle(a, 72, 32, 3.4, 6, 0.9)
    a.path("M26 62 Q50 76 74 62", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Newtonian Reflector")
def _():
    a = Art()
    a.path("M14 30 L66 30 L66 72 L14 72", 0, 2.4)
    a.path("M14 72 Q22 56 14 30", 0, 2.4)
    a.path("M16 36 Q22 51 16 66", 6, 1.8)
    a.line(40, 26, 56, 40, 6, 2.0)
    a.path("M70 40 L84 40 L84 48 L70 48 Z", 0, 2.0)
    a.line(48, 30, 70, 44, 3, 1.0, 0.5)
    a.line(20, 51, 48, 36, 3, 1.0, 0.5)
    a.line(40, 72, 40, 84, 0, 2.2)
    a.line(26, 84, 54, 84, 0, 2.2)
    a.ground(92)
    return a


@item("Compound Reflecting Telescope")
def _():
    a = Art()
    a.path("M12 30 L58 30 L58 66 L12 66", 0, 2.4)
    a.path("M12 66 Q20 48 12 30", 0, 2.4)
    a.circle(40, 48, 6, 6, 1.6)
    a.line(40, 30, 40, 42, 6, 1.6)
    a.path("M58 36 L82 36 L82 60 L58 60", 0, 2.2)
    a.circle(70, 48, 5, 6, 1.4)
    a.line(84, 48, 92, 48, 6, 2.0)
    a.line(36, 66, 24, 84, 0, 2.2)
    a.line(36, 66, 48, 84, 0, 2.2)
    a.path("M16 40 L40 44 M16 56 L40 52", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Ground Lens Blank")
def _():
    a = Art()
    a.ellipse(50, 44, 28, 10, 0, 2.4)
    a.path("M22 44 L22 54 Q50 66 78 54 L78 44", 0, 2.4)
    a.path("M30 48 Q50 56 70 48", 3, 1.0, 0.5)
    a.dots([(34, 70), (50, 74), (66, 70), (42, 78), (58, 78)], 1.1, 6)
    a.path("M30 26 L70 26", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Microscope Objective")
def _():
    a = Art()
    a.path("M34 16 L66 16 L66 40 L58 52 L58 70 L42 70 L42 52 L34 40 Z", 0, 2.4)
    a.line(34, 28, 66, 28, 3, 1.0, 0.6)
    a.ellipse(50, 74, 8, 2.4, 6, 1.6)
    a.path("M44 34 L56 34 M44 42 L56 42", 3, 1.0, 0.5)
    a.path("M30 86 L70 86", 3, 1.0, 0.4)
    a.path("M46 78 L40 86 M54 78 L60 86", 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Compound Microscope")
def _():
    a = Art()
    a.rect(46, 12, 8, 36, 0, 2.2)
    a.rect(44, 8, 12, 6, 0, 2.0)
    a.path("M44 48 L56 48 L54 58 L46 58 Z", 0, 2.0)
    a.line(24, 66, 76, 66, 0, 2.4)
    a.path("M30 64 L34 78 L66 78 L70 64", 0, 2.4)
    a.path("M62 22 Q84 24 82 50 Q80 64 66 66", 0, 2.4)
    a.line(58, 22, 62, 22, 0, 2.2)
    a.circle(84, 44, 3, 6, 1.4)
    a.path("M36 60 L64 60", 6, 1.8)
    a.ground(90)
    return a


@item("Binocular Laboratory Microscope")
def _():
    a = Art()
    a.path("M36 10 L44 24 M64 10 L56 24", 0, 2.2)
    a.rect(38, 24, 24, 14, 0, 2.2)
    a.rect(46, 38, 8, 12, 0, 2.0)
    a.path("M44 50 L56 50 L54 58 L46 58 Z", 0, 2.0)
    a.line(22, 68, 78, 68, 0, 2.4)
    a.path("M28 66 L32 80 L68 80 L72 66", 0, 2.4)
    a.path("M66 28 Q88 30 86 54 Q84 66 70 68", 0, 2.4)
    a.circle(36, 10, 3, 6, 1.4)
    a.circle(64, 10, 3, 6, 1.4)
    a.line(38, 62, 62, 62, 6, 1.8)
    a.ground(92)
    return a


@item("Glass Prism Blank")
def _():
    a = Art()
    a.path("M20 58 L80 58 L80 34 L20 34 Z", 0, 2.4)
    a.path("M20 58 L34 70 L94 70 L80 58 M94 70 L94 46 L80 34", 0, 2.4)
    a.path("M26 40 L62 40", 6, 1.2, 0.6)
    sparkle(a, 74, 24, 3.4, 6, 0.9)
    a.ground(88)
    return a


@item("Triangular Optical Prism")
def _():
    a = Art()
    a.path("M50 22 L22 70 L78 70 Z", 0, 2.6)
    a.path("M50 22 L58 30 L90 78 L78 70", 0, 2.0)
    a.path("M8 52 L36 48", 6, 1.6)
    a.path("M64 50 L92 38 M64 54 L92 52 M64 58 L92 66", 3, 1.2, 0.7)
    a.path("M36 48 L64 52", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Direct Vision Spectroscope")
def _():
    a = Art()
    a.path("M14 40 L74 40 L74 56 L14 56 Z", 0, 2.4)
    a.rect(74, 42, 10, 12, 0, 2.0)
    a.line(14, 40, 14, 56, 6, 2.6)
    a.line(14, 44, 6, 40, 3, 1.2, 0.6)
    a.line(14, 52, 6, 56, 3, 1.2, 0.6)
    a.path("M34 40 L44 56 M44 40 L34 56", 3, 1.2, 0.7)
    for k in range(5):
        a.line(24 + k * 8, 66, 24 + k * 8, 74, 6, 1.4 - (k % 2) * 0.4)
    a.line(20, 70, 70, 70, 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Prism Spectrometer")
def _():
    a = Art()
    a.circle(50, 62, 26, 0, 2.2)
    a.path("M50 36 L40 54 L62 54 Z", 6, 2.0)
    a.path("M8 40 L40 46", 6, 1.8)
    a.rect(4, 34, 12, 10, 0, 2.0)
    a.path("M62 52 L90 38", 6, 1.8)
    a.path("M62 56 L90 56 M62 60 L90 72", 3, 1.0, 0.6)
    a.rect(82, 30, 12, 12, 0, 2.0)
    a.ground(92)
    return a


@item("Glass Reticle Blank")
def _():
    a = Art()
    a.circle(50, 48, 28, 0, 2.4)
    a.circle(50, 48, 22, 3, 1.0, 0.5)
    a.path("M30 36 Q36 28 46 26", 6, 1.6, 0.7)
    a.dots([(36, 72), (50, 76), (64, 72)], 1.1, 6)
    a.ground(88)
    return a


@item("Etched Optical Reticle")
def _():
    a = Art()
    a.circle(50, 48, 28, 0, 2.4)
    a.line(22, 48, 78, 48, 6, 1.2)
    a.line(50, 20, 50, 76, 6, 1.2)
    for k in range(-5, 6):
        if k == 0:
            continue
        a.line(50 + k * 5, 45, 50 + k * 5, 51, 6, 1.0)
        a.line(47, 48 + k * 5, 53, 48 + k * 5, 6, 1.0)
    a.circle(50, 48, 10, 3, 1.0, 0.6)
    a.ground(88)
    return a


@item("Crosshair Eyepiece")
def _():
    a = Art()
    a.path("M20 36 L50 36 L50 60 L20 60 Z", 0, 2.4)
    a.path("M50 40 L74 40 L74 56 L50 56", 0, 2.4)
    a.path("M74 42 Q88 42 88 48 Q88 54 74 54", 0, 2.2)
    a.circle(35, 48, 9, 6, 1.4)
    a.path("M26 48 L44 48 M35 39 L35 57", 6, 1.2)
    a.line(14, 70, 86, 70, 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Rangefinding Optical Sight")
def _():
    a = Art()
    a.path("M12 38 L88 38 L88 58 L12 58 Z", 0, 2.4)
    a.circle(24, 48, 7, 6, 1.6)
    a.circle(76, 48, 7, 6, 1.6)
    a.path("M24 44 L24 52 M20 48 L28 48", 3, 1.0, 0.7)
    a.path("M76 44 L76 52 M72 48 L80 48", 3, 1.0, 0.7)
    a.path("M30 48 L70 48", 3, 1.0, 0.5)
    a.line(50, 38, 50, 28, 6, 2.0)
    a.circle(50, 26, 3, 6, 1.6)
    a.path("M40 68 L60 68", 3, 1.2, 0.6)
    a.path("M18 74 L82 74", 3, 1.0, 0.4)
    a.ground(88)
    return a
