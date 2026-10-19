"""Topic 26 - printing processes (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .registry import item, topic

topic("printing processes")


def sheet(a, x, y, w=40, h=48, z=0, wd=2.2, lines=4):
    a.rect(x, y, w, h, z, wd)
    for i in range(lines):
        yy = y + 8 + i * (h - 16) / max(1, lines - 1)
        a.line(x + 5, yy, x + w - 6 - (i % 2) * 4, yy, 3, 1.0, 0.55)


def block(a, x, y, w=44, h=36, d=8, z=0, wd=2.4):
    a.path(f"M{x} {y} L{x + w} {y} L{x + w + d} {y - d} L{x + d} {y - d} Z", z, wd)
    a.path(f"M{x} {y} L{x} {y + h} L{x + w} {y + h} L{x + w} {y} M{x + w} {y + h} L{x + w + d} {y + h - d} L{x + w + d} {y - d}", z, wd)


def roller(a, x, y, w=30, r=6, z=6):
    a.ellipse(x, y, r * 0.5, r, z, 2.0)
    a.line(x, y - r, x + w, y - r, z, 2.0)
    a.line(x, y + r, x + w, y + r, z, 2.0)
    a.ellipse(x + w, y, r * 0.5, r, z, 2.0)


def letter_blocks(a, x, y, count=4, w=7, h=14, z=0):
    for i in range(count):
        a.rect(x + i * (w + 2), y, w, h, z, 1.8)
        a.line(x + i * (w + 2) + 2, y + 3, x + i * (w + 2) + w - 2, y + 3, 3, 1.0, 0.6)


def screw(a, cx, top, bot, z=0):
    a.line(cx, top, cx, bot, z, 3.0)
    for y in range(int(top) + 4, int(bot) - 2, 5):
        a.line(cx - 4, y + 2, cx + 4, y - 1, 3, 1.2, 0.8)


def press_frame(a, x0=20, x1=80, top=18, bot=78, z=0):
    a.line(x0, top, x0, bot, z, 2.8)
    a.line(x1, top, x1, bot, z, 2.8)
    a.line(x0, top, x1, top, z, 2.8)
    a.line(x0 - 4, bot, x1 + 4, bot, z, 2.8)


@item("Ink Transfer Matrix")
def _():
    a = Art()
    block(a, 16, 56, 40, 14, 8, 0, 2.2)
    a.path("M20 52 L54 52", 6, 1.6)
    droplet(a, 70, 28, 3.4)
    sheet(a, 62, 44, 26, 32, 0, 2.0, 3)
    arrow(a, 54, 56, 62, 56, 3, 1.4, 0.8, 3)
    a.dots([(26, 62), (38, 62), (46, 64)], 1.1, 6)
    a.ground(88)
    return a


@item("Woodblock Printing Plate")
def _():
    a = Art()
    block(a, 18, 54, 48, 20, 9, 0, 2.4)
    a.path("M26 48 Q34 40 42 48 Q50 56 58 46", 6, 2.0)
    a.path("M26 54 L58 54", 3, 1.0, 0.5)
    a.line(14, 40, 36, 28, 6, 2.0)
    a.path("M36 28 L42 22", 6, 1.6)
    a.path("M40 34 L44 40", 3, 1.0, 0.5)
    a.line(18, 74, 66, 74, 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Relief Woodblock Print")
def _():
    a = Art()
    sheet(a, 20, 20, 52, 58, 0, 2.4, 0)
    a.path("M30 36 Q40 26 50 36 Q60 46 66 34", 6, 2.4)
    a.path("M30 52 L62 52", 6, 2.0)
    a.path("M30 62 Q46 58 62 64", 6, 2.0)
    a.circle(36, 68, 2.4, 6, 1.6)
    a.path("M76 30 L86 24 M78 40 L90 36", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Multicolor Woodblock Print")
def _():
    a = Art()
    sheet(a, 22, 22, 50, 56, 0, 2.4, 0)
    a.path("M30 36 Q40 26 50 36", 6, 2.2)
    a.path("M34 44 Q46 54 60 44", 3, 2.0, 0.85)
    a.path("M30 62 L62 62", 6, 1.8, 0.7)
    a.circle(58, 34, 5, 6, 1.6)
    a.circle(62, 38, 5, 3, 1.4, 0.6)
    block(a, 72, 68, 16, 10, 4, 0, 1.6)
    block(a, 70, 52, 16, 10, 4, 0, 1.6)
    a.ground(88)
    return a


@item("Registered Color Woodblock")
def _():
    a = Art()
    block(a, 16, 62, 52, 14, 8, 0, 2.2)
    a.path("M16 62 L16 44 L36 44 M16 44 L16 40", 6, 1.8)
    a.rect(24, 28, 40, 28, 3, 1.2, 0.6)
    a.circle(24, 28, 2, 6, 1.4)
    a.circle(64, 28, 2, 6, 1.4)
    a.circle(24, 56, 2, 6, 1.4)
    a.circle(64, 56, 2, 6, 1.4)
    a.path("M34 40 Q44 32 54 40", 6, 1.8)
    a.ground(88)
    return a


@item("Carved Metal Type")
def _():
    a = Art()
    for i, x in enumerate((20, 40, 60)):
        a.rect(x, 36, 14, 30, 0, 2.4)
        a.rect(x + 2, 26, 10, 10, 6, 1.6)
    a.path("M24 30 L30 30 M44 28 L50 34 M64 30 L70 30", 6, 1.8)
    a.line(14, 66, 82, 66, 3, 1.2, 0.5)
    a.path("M70 20 L84 20 L80 28", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Punch Cut Type")
def _():
    a = Art()
    a.rect(34, 18, 14, 48, 0, 2.4)
    a.path("M34 66 L48 66 L46 74 L36 74 Z", 6, 2.0)
    a.path("M38 70 L44 70", 3, 1.0, 0.7)
    a.path("M30 12 L52 12", 6, 2.4)
    a.line(62, 22, 78, 44, 6, 2.4)
    a.path("M78 44 L74 52 L82 48 Z", 6, 1.4)
    a.path("M60 80 L88 80 L88 74 L60 74 Z", 0, 1.8)
    a.ground(90)
    return a


@item("Cast Movable Type")
def _():
    a = Art()
    a.path("M20 40 L52 40 L52 66 L20 66 Z", 0, 2.4)
    a.rect(26, 46, 20, 14, 3, 1.2, 0.7)
    a.path("M52 48 L68 48 L68 60 L52 60", 0, 2.0)
    letter_blocks(a, 62, 24, 3, 8, 14, 0)
    a.path("M30 28 Q34 20 38 28 Q34 34 30 28", 6, 1.4)
    droplet(a, 34, 76, 3)
    a.ground(88)
    return a


@item("Composed Letterpress Form")
def _():
    a = Art()
    a.rect(14, 22, 72, 52, 0, 2.6)
    for r in range(4):
        for c in range(7):
            a.rect(18 + c * 9.6, 26 + r * 11, 8, 10, 3, 1.0, 0.8)
    a.path("M14 22 L14 74 M86 22 L86 74", 6, 1.8)
    a.line(14, 48, 86, 48, 6, 1.4, 0.7)
    a.ground(88)
    return a


@item("Printing Press Screw")
def _():
    a = Art()
    screw(a, 50, 16, 66, 0)
    a.line(30, 22, 70, 22, 0, 2.8)
    a.circle(30, 22, 2.4, 6, 1.4)
    a.circle(70, 22, 2.4, 6, 1.4)
    a.rect(34, 66, 32, 8, 0, 2.4)
    a.path("M20 80 L80 80", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Hand Screw Press")
def _():
    a = Art()
    press_frame(a, 24, 76, 14, 80)
    screw(a, 50, 14, 52, 0)
    a.line(30, 22, 70, 22, 6, 2.6)
    a.rect(32, 52, 36, 6, 6, 2.2)
    a.rect(30, 66, 40, 10, 0, 2.2)
    a.line(40, 70, 60, 70, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Iron Hand Press")
def _():
    a = Art()
    a.path("M26 80 L26 22 Q26 14 36 14 L64 14 Q74 14 74 22 L74 80", 0, 3.0)
    a.line(50, 14, 50, 46, 0, 3.0)
    a.rect(36, 46, 28, 8, 6, 2.4)
    a.line(76, 34, 92, 28, 6, 2.6)
    a.circle(92, 27, 2.4, 6, 1.4)
    a.rect(30, 66, 40, 8, 0, 2.4)
    a.path("M30 40 L36 40 M64 40 L70 40", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Steam Driven Printing Press")
def _():
    a = Art()
    a.circle(24, 58, 16, 0, 2.4)
    a.circle(24, 58, 5, 6, 1.6)
    a.line(24, 58, 36, 50, 3, 1.4)
    a.path("M40 44 L84 44 L84 72 L40 72 Z", 0, 2.4)
    a.circle(62, 58, 10, 6, 1.8)
    a.line(40, 36, 84, 36, 3, 1.2, 0.6)
    a.rect(20, 32, 10, 12, 0, 2.0)
    a.path("M22 28 Q26 20 30 28 M30 24 Q34 16 38 24", 3, 1.2, 0.55)
    a.path("M40 78 L84 78", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Lithographic Limestone")
def _():
    a = Art()
    a.path("M14 48 L74 48 L86 36 L26 36 Z", 0, 2.4)
    a.path("M14 48 L14 62 L74 62 L74 48 M74 62 L86 50 L86 36", 0, 2.4)
    a.path("M20 54 Q34 50 48 54 T70 54", 3, 1.0, 0.5)
    a.dots([(30, 42), (44, 40), (56, 42), (64, 40)], 1.2, 3)
    a.path("M20 68 L70 68", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Greased Lithography Stone")
def _():
    a = Art()
    a.path("M14 50 L74 50 L86 38 L26 38 Z", 0, 2.4)
    a.path("M14 50 L14 64 L74 64 L74 50 M74 64 L86 52 L86 38", 0, 2.4)
    a.path("M30 46 Q40 40 50 46 Q60 52 68 44", 6, 2.2)
    a.line(14, 24, 34, 38, 6, 2.2)
    a.circle(12, 22, 3, 6, 1.4)
    droplet(a, 80, 24, 3)
    a.ground(86)
    return a


@item("Planographic Lithograph")
def _():
    a = Art()
    a.path("M12 56 L60 56 L80 44 L32 44 Z", 0, 2.2)
    a.path("M12 56 L12 62 L60 62 L60 56 M60 62 L80 50 L80 44", 0, 2.2)
    roller(a, 40, 34, 28, 5, 6)
    sheet(a, 62, 14, 26, 32, 0, 1.8, 3)
    droplet(a, 24, 72, 3)
    a.path("M16 74 L60 74", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Offset Lithographic Plate")
def _():
    a = Art()
    a.circle(30, 44, 14, 0, 2.4)
    a.circle(62, 44, 14, 0, 2.4)
    a.circle(46, 74, 10, 0, 2.4)
    a.circle(30, 44, 3, 6, 1.4)
    a.circle(62, 44, 3, 6, 1.4)
    a.path("M20 36 Q30 28 40 36", 6, 1.8)
    a.path("M52 36 Q62 28 72 36", 6, 1.8, 0.8)
    a.line(40, 62, 52, 62, 3, 1.0, 0.5)
    arrow(a, 76, 30, 86, 30, 3, 1.3, 0.7, 3)
    a.ground(90)
    return a


@item("Stencil Sheet")
def _():
    a = Art()
    a.rect(18, 18, 54, 62, 0, 2.4)
    a.path("M28 30 L44 30 L44 44 L28 44 Z", 3, 1.6, 0.9)
    a.circle(58, 38, 8, 3, 1.6, 0.9)
    a.path("M28 56 L62 56 M28 64 L52 64", 3, 1.6, 0.9)
    a.path("M76 32 L88 32 M76 42 L84 42", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Hand Cut Stencil")
def _():
    a = Art()
    a.rect(18, 22, 50, 56, 0, 2.4)
    a.path("M26 34 L40 34 L40 48 L26 48 Z", 3, 1.6)
    a.circle(54, 40, 7, 3, 1.6)
    a.line(26, 62, 60, 62, 3, 1.6)
    a.line(70, 28, 56, 52, 6, 2.2)
    a.path("M56 52 L54 58 L60 54 Z", 6, 1.4)
    a.path("M74 70 L86 70", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Silk Screen Stencil")
def _():
    a = Art()
    a.rect(14, 22, 62, 52, 0, 2.8)
    a.rect(20, 28, 50, 40, 3, 1.0, 0.6)
    for x in range(24, 70, 6):
        a.line(x, 28, x, 68, 3, 0.9, 0.35)
    for y in range(34, 68, 6):
        a.line(20, y, 70, y, 3, 0.9, 0.35)
    a.circle(45, 48, 12, 6, 1.8)
    a.path("M80 26 L92 26 L92 40 L80 40", 3, 1.0, 0.5)
    a.line(80, 66, 92, 66, 6, 2.4)
    a.ground(86)
    return a


@item("Multi Color Screen Print")
def _():
    a = Art()
    for i, (dx, dy) in enumerate(((0, 0), (8, 6), (16, 12))):
        a.rect(18 + dx, 18 + dy, 36, 40, 0 if i == 2 else 3, 2.0 if i == 2 else 1.4, None if i == 2 else 0.8)
    a.circle(42, 38, 8, 6, 1.8)
    a.circle(52, 44, 8, 6, 1.4, 0.8)
    a.circle(62, 50, 8, 6, 1.2, 0.6)
    a.path("M18 74 L82 74", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Photographic Print Plate")
def _():
    a = Art()
    a.rect(18, 24, 44, 52, 0, 2.4)
    a.circle(40, 46, 10, 6, 1.8)
    a.path("M28 66 L36 56 L44 62 L54 52", 6, 1.6)
    a.rect(66, 36, 20, 26, 0, 2.0)
    a.circle(76, 49, 6, 6, 1.4)
    a.rect(70, 30, 12, 6, 6, 1.4)
    sparkle(a, 78, 22, 3, 6, 0.9)
    a.ground(88)
    return a


@item("Halftone Printing Plate")
def _():
    a = Art()
    a.rect(16, 20, 68, 58, 0, 2.4)
    for r in range(6):
        for c in range(8):
            rad = 0.8 + 2.6 * (c / 7) * (1 - abs(r - 2.5) / 5)
            a.circle(24 + c * 8.2, 28 + r * 8.4, rad, 6, 1.0)
    a.ground(88)
    return a


@item("Four Color Printing Plate")
def _():
    a = Art()
    for i, (x, y) in enumerate(((16, 18), (52, 18), (16, 52), (52, 52))):
        a.rect(x, y, 32, 28, 0, 2.2, None, 2)
        a.circle(x + 16, y + 14, 8 + (i % 2) * 2, 6, 1.4)
        a.path(f"M{x + 8} {y + 22} L{x + 24} {y + 22}", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Digital Printing Plate")
def _():
    a = Art()
    a.rect(14, 18, 44, 36, 0, 2.4, None, 3)
    a.rect(18, 22, 36, 28, 3, 1.0, 0.6)
    a.path("M22 44 L30 34 L38 40 L48 28", 6, 1.6)
    a.path("M56 60 L90 60 L90 78 L56 78 Z", 0, 2.2)
    a.rect(60, 64, 22, 14, 6, 1.4)
    a.path("M36 54 L36 64 L56 64", 3, 1.4, 0.7)
    a.circle(36, 66, 2, 6, 1.2)
    sparkle(a, 76, 32, 3, 6, 0.9)
    a.ground(88)
    return a
