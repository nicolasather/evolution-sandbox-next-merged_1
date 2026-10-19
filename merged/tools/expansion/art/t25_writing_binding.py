"""Topic 25 - writing and binding (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .registry import item, topic

topic("writing and binding")


def page(a, x, y, w=36, h=48, z=0, wd=2.2, lines=5, fold=True):
    a.rect(x, y, w, h, z, wd)
    for i in range(lines):
        yy = y + 8 + i * (h - 16) / max(1, lines - 1)
        a.line(x + 5, yy, x + w - 5 - (i % 3) * 3, yy, 3, 1.0, 0.55)
    if fold:
        a.path(f"M{x + w - 8} {y} L{x + w} {y + 8} L{x + w - 8} {y + 8} Z", 6, 1.0, 0.7)


def book(a, x, y, w=44, h=52, z=0, wd=2.4, d=8):
    a.path(f"M{x} {y} L{x + w} {y} L{x + w} {y + h} L{x} {y + h} Z", z, wd)
    a.path(f"M{x + w} {y} L{x + w + d} {y - d} L{x + w + d} {y + h - d} L{x + w} {y + h}", z, wd)
    a.path(f"M{x} {y} L{x + d} {y - d} L{x + w + d} {y - d}", z, wd)
    a.line(x + 6, y, x + 6, y + h, 3, 1.0, 0.6)


def quill(a, x, y, L=44, ang=-55, z=0):
    t = math.radians(ang)
    ex, ey = x + L * math.cos(t), y + L * math.sin(t)
    a.line(x, y, ex, ey, z, 2.0)
    px, py = -math.sin(t), math.cos(t)
    a.path(f"M{n(ex)} {n(ey)} Q{n(ex + px * 12)} {n(ey + py * 12 + 6)} {n(x + (ex - x) * 0.35)} {n(y + (ey - y) * 0.35)}", z, 1.8)
    a.path(f"M{n(ex)} {n(ey)} Q{n(ex - px * 8)} {n(ey - py * 8)} {n(x + (ex - x) * 0.4)} {n(y + (ey - y) * 0.4)}", z, 1.2, 0.7)
    for k in range(5):
        tt = 0.5 + k * 0.1
        a.line(x + (ex - x) * tt, y + (ey - y) * tt, x + (ex - x) * tt + px * (10 - k), y + (ey - y) * tt + py * (10 - k) + 3, 3, 0.9, 0.55)


def tablet(a, x, y, w=44, h=52, z=0, wd=2.4):
    a.rect(x, y, w, h, z, wd)
    a.rect(x + 5, y + 5, w - 10, h - 10, 3, 1.2, 0.8)


def stylus(a, x, y, L=30, ang=-50, z=6):
    t = math.radians(ang)
    ex, ey = x + L * math.cos(t), y + L * math.sin(t)
    a.line(x, y, ex, ey, z, 2.4)
    a.path(f"M{n(ex)} {n(ey)} l{n(5 * math.cos(t + 2.3))} {n(5 * math.sin(t + 2.3))} l{n(5 * math.cos(t - 2.3))} {n(5 * math.sin(t - 2.3))} Z", z, 1.4)


@item("Bookmaking Materials")
def _():
    a = Art()
    page(a, 14, 24, 28, 38, 0, 2.0, 4, False)
    a.path("M46 64 L88 64 L88 74 L46 74 Z", 0, 2.0)
    a.line(46, 69, 88, 69, 3, 1.0, 0.5)
    a.path("M52 30 Q64 24 76 30 L76 52 Q64 46 52 52 Z", 0, 1.8)
    a.line(64, 26, 64, 49, 3, 1.0, 0.5)
    a.circle(28, 72, 4, 6, 1.4)
    a.path("M26 78 Q40 84 46 78", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Hand Cut Paper Sheet")
def _():
    a = Art()
    page(a, 24, 20, 48, 58, 0, 2.2, 0, True)
    a.line(14, 70, 34, 56, 6, 2.2)
    a.path("M12 66 L18 74 L24 70 Z", 6, 1.4)
    a.path("M30 36 L66 36", 3, 1.0, 0.4)
    a.path("M30 46 L58 46", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Folded Paper Quire")
def _():
    a = Art()
    for i in range(4):
        a.path(f"M{20 + i * 3} {72 - i * 3} L{50} {62 - i * 3} L{80 - i * 3} {72 - i * 3}", 0, 2.0 - i * 0.1, None if i == 3 else 0.8)
    a.path("M20 72 L20 78 L50 68 L80 78 L80 72", 0, 2.0)
    a.line(50, 62, 50, 68, 3, 1.0, 0.6)
    a.path("M28 52 L50 44 L72 52", 3, 1.2, 0.6)
    arrow(a, 40, 30, 50, 38, 3, 1.3, 0.7, 3)
    a.ground(88)
    return a


@item("Gathered Paper Signatures")
def _():
    a = Art()
    for i in range(3):
        x = 16 + i * 24
        a.path(f"M{x} 70 L{x + 10} 28 L{x + 22} 28 L{x + 22} 70 Z", 0, 2.0)
        a.line(x + 10, 28, x + 10, 70, 3, 1.0, 0.55)
        for y in (36, 46, 56):
            a.line(x + 13, y, x + 20, y, 3, 1.0, 0.45)
    for y in (36, 56):
        a.circle(20, y, 1.6, 6, 1.2)
        a.circle(44, y, 1.6, 6, 1.2)
        a.circle(68, y, 1.6, 6, 1.2)
    a.line(14, 36, 86, 36, 6, 1.2, 0.8)
    a.ground(88)
    return a


@item("Bound Paper Codex")
def _():
    a = Art()
    book(a, 22, 30, 44, 50, 0, 2.4, 8)
    for y in (40, 52, 64):
        a.line(30, y, 58, y, 3, 1.0, 0.5)
    a.line(22, 40, 14, 40, 6, 1.6)
    a.line(22, 70, 14, 70, 6, 1.6)
    a.circle(14, 40, 1.6, 6, 1.2)
    a.circle(14, 70, 1.6, 6, 1.2)
    a.ground(88)
    return a


@item("Writing Quill")
def _():
    a = Art()
    quill(a, 20, 76, 56, -55, 0)
    a.path("M20 76 L14 82", 6, 1.8)
    a.path("M30 84 L70 84", 3, 1.0, 0.4)
    droplet(a, 18, 86, 2.6)
    a.ground(92)
    return a


@item("Cut Quill Nib")
def _():
    a = Art()
    a.path("M24 20 Q40 40 70 70 L74 76 L62 72 Q40 52 24 20 Z", 0, 2.2)
    a.line(70, 70, 66, 62, 6, 1.4)
    a.path("M30 24 Q48 44 66 66", 3, 1.0, 0.5)
    a.path("M14 18 Q28 12 44 18 Q36 26 24 22", 3, 1.2, 0.7)
    a.path("M74 76 L82 82", 6, 1.4)
    droplet(a, 80, 86, 2.4)
    a.ground(92)
    return a


@item("Metal Dip Pen")
def _():
    a = Art()
    a.line(14, 22, 54, 62, 0, 3.4)
    a.path("M54 62 L66 66 L70 78 L58 72 Z", 0, 2.2)
    a.line(60, 68, 68, 76, 3, 1.0, 0.6)
    a.path("M70 78 L74 82", 6, 1.4)
    a.rect(66, 40, 18, 22, 6, 1.8)
    a.ellipse(75, 40, 9, 2.6, 6, 1.4)
    droplet(a, 74, 52, 2.6, 3)
    a.ground(90)
    return a


@item("Reservoir Fountain Pen")
def _():
    a = Art()
    a.path("M14 28 L52 66 L58 60 L20 22 Z", 0, 2.4)
    a.path("M52 66 L60 76 L66 70 L58 60", 0, 2.2)
    a.line(60, 76, 64, 72, 3, 1.0, 0.6)
    a.line(24, 32, 46, 54, 3, 1.0, 0.5)
    a.path("M26 22 L36 22", 6, 1.8)
    droplet(a, 66, 84, 2.6)
    a.path("M70 40 L84 54 M74 36 L88 50", 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Wax Writing Tablet")
def _():
    a = Art()
    tablet(a, 24, 20, 48, 56, 0, 2.6)
    for y in (32, 42, 52):
        a.path(f"M32 {y} L{44 + (y % 3) * 6} {y}", 6, 1.5)
    stylus(a, 74, 74, 30, -135, 6)
    a.ground(88)
    return a


@item("Hinged Wax Diptych")
def _():
    a = Art()
    tablet(a, 12, 24, 34, 48, 0, 2.4)
    tablet(a, 54, 24, 34, 48, 0, 2.4)
    a.line(46, 36, 54, 36, 6, 1.8)
    a.line(46, 60, 54, 60, 6, 1.8)
    a.circle(50, 36, 1.4, 6, 1.0)
    a.circle(50, 60, 1.4, 6, 1.0)
    for y in (38, 48, 58):
        a.line(20, y, 36, y, 3, 1.2, 0.7)
        a.line(62, y, 80, y, 3, 1.2, 0.7)
    a.ground(86)
    return a


@item("Reusable Writing Tablet")
def _():
    a = Art()
    tablet(a, 26, 18, 44, 56, 0, 2.6)
    a.path("M34 30 L58 30 M34 40 L52 40", 6, 1.5)
    a.path("M56 54 A10 10 0 1 1 46 64", 3, 1.6, 0.8)
    arrow(a, 46, 64, 42, 58, 3, 1.4, 0.8, 3)
    stylus(a, 78, 72, 24, -135, 6)
    a.ground(88)
    return a


@item("Portable Note Tablet")
def _():
    a = Art()
    a.rect(30, 30, 40, 50, 0, 2.4)
    a.rect(35, 36, 30, 36, 3, 1.0, 0.6)
    a.path("M40 42 L58 42 M40 50 L54 50 M40 58 L56 58", 6, 1.4)
    a.path("M30 30 Q30 18 44 18 L56 18 Q70 18 70 30", 6, 1.8)
    a.circle(50, 18, 2, 6, 1.2)
    a.ground(88)
    return a


@item("Parchment Sheet")
def _():
    a = Art()
    a.path("M20 22 Q40 18 80 24 Q84 48 78 76 Q50 82 22 76 Q16 50 20 22 Z", 0, 2.4)
    a.path("M26 30 Q50 28 74 32 M28 44 Q50 42 72 46 M28 58 Q50 56 72 60", 3, 1.0, 0.5)
    a.path("M70 76 Q76 82 82 78", 6, 1.4)
    a.path("M16 40 Q10 44 16 48", 6, 1.2, 0.7)
    a.ground(90)
    return a


@item("Ruled Manuscript Page")
def _():
    a = Art()
    a.rect(20, 16, 56, 66, 0, 2.4)
    for y in range(26, 76, 8):
        a.line(26, y, 70, y, 3, 1.0, 0.7)
    a.line(32, 16, 32, 82, 6, 1.0, 0.8)
    a.line(64, 16, 64, 82, 6, 1.0, 0.8)
    for y in (24, 32, 40, 48):
        a.line(36, y + 3, 60 - (y % 3) * 3, y + 3, 6, 1.6)
    a.ground(90)
    return a


@item("Illuminated Manuscript Leaf")
def _():
    a = Art()
    a.rect(18, 14, 62, 70, 0, 2.4)
    a.rect(24, 20, 50, 58, 3, 1.0, 0.5)
    a.path("M28 26 L44 26 L44 44 L28 44 Z", 6, 1.8)
    a.path("M32 30 Q36 40 40 30 M32 38 L40 38", 6, 1.4)
    for y in (30, 38):
        a.line(48, y, 70, y, 3, 1.2, 0.7)
    for y in (52, 60, 68):
        a.line(28, y, 70 - (y % 3) * 4, y, 3, 1.2, 0.7)
    sparkle(a, 62, 24, 2.6, 6, 0.9)
    a.path("M24 20 Q20 14 26 14 M74 78 Q80 84 74 84", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Bound Manuscript Volume")
def _():
    a = Art()
    book(a, 18, 28, 48, 52, 0, 2.6, 9)
    a.rect(26, 38, 32, 14, 6, 1.6)
    a.line(30, 45, 54, 45, 3, 1.0, 0.6)
    a.path("M20 76 L64 76", 3, 1.0, 0.5)
    a.circle(22, 32, 1.4, 6, 1.2)
    a.circle(62, 32, 1.4, 6, 1.2)
    a.circle(22, 76, 1.4, 6, 1.2)
    a.circle(62, 76, 1.4, 6, 1.2)
    sparkle(a, 82, 26, 3, 6, 0.9)
    a.ground(90)
    return a


@item("Book Cover Board")
def _():
    a = Art()
    a.path("M20 70 L20 24 L58 24 L58 70 Z", 0, 2.6)
    a.path("M58 24 L74 14 L74 60 L58 70", 0, 2.4)
    a.path("M20 24 L36 14 L74 14", 0, 2.4)
    a.path("M26 32 L52 32 M26 40 L46 40", 3, 1.0, 0.45)
    a.line(26, 64, 52, 64, 3, 1.0, 0.45)
    a.ground(86)
    return a


@item("Cloth Book Case")
def _():
    a = Art()
    a.rect(12, 28, 34, 46, 0, 2.4)
    a.rect(54, 28, 34, 46, 0, 2.4)
    a.rect(46, 28, 8, 46, 6, 1.6)
    for k in range(3):
        a.path(f"M16 {36 + k * 10} Q24 {32 + k * 10} 34 {36 + k * 10}", 3, 1.0, 0.5)
        a.path(f"M60 {36 + k * 10} Q68 {32 + k * 10} 78 {36 + k * 10}", 3, 1.0, 0.5)
    a.line(18, 20, 82, 20, 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Case Bound Book")
def _():
    a = Art()
    book(a, 20, 28, 44, 52, 0, 2.6, 8)
    a.path("M24 34 L60 34 M24 44 L50 44", 3, 1.2, 0.6)
    a.rect(26, 56, 18, 10, 6, 1.5)
    a.path("M20 80 L64 80 L72 72", 3, 1.0, 0.5)
    a.path("M16 28 L16 80", 6, 2.0)
    a.ground(90)
    return a


@item("Library Binding Book")
def _():
    a = Art()
    book(a, 20, 24, 46, 58, 0, 2.8, 8)
    a.rect(26, 30, 34, 12, 6, 1.6)
    a.line(30, 36, 56, 36, 3, 1.0, 0.6)
    a.rect(26, 62, 12, 14, 6, 1.4)
    a.line(32, 62, 32, 76, 3, 1.0, 0.6)
    a.path("M16 24 L16 82 M20 78 L66 78", 6, 2.2)
    a.path("M72 20 L84 20 L84 30 L72 30 Z", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Handwritten Index Slip")
def _():
    a = Art()
    a.rect(18, 34, 64, 34, 0, 2.4)
    a.line(18, 44, 82, 44, 3, 1.2, 0.7)
    for y in (52, 58, 64):
        a.line(24, y, 76, y, 3, 1.0, 0.4)
    a.line(26, 39, 46, 39, 6, 1.6)
    a.path("M70 20 L78 14 L84 20 L80 28 Z", 6, 1.4)
    a.path("M74 22 L50 34", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Alphabetical Card Index")
def _():
    a = Art()
    a.path("M14 38 L74 38 L86 28 L26 28 Z", 0, 2.2)
    a.path("M14 38 L14 74 L74 74 L74 38 M74 74 L86 64 L86 28", 0, 2.4)
    for k in range(4):
        a.rect(20 + k * 12, 28, 8, 8, 6, 1.4)
        a.line(22 + k * 12, 32, 26 + k * 12, 32, 3, 1.0, 0.7)
    a.line(14, 56, 74, 56, 3, 1.0, 0.45)
    a.circle(44, 66, 2.4, 6, 1.4)
    a.ground(88)
    return a


@item("Printed Library Catalogue")
def _():
    a = Art()
    book(a, 18, 26, 50, 54, 0, 2.6, 8)
    a.line(26, 36, 60, 36, 6, 1.6)
    for y in (46, 54, 62, 70):
        a.line(26, y, 40, y, 3, 1.2, 0.7)
        a.line(44, y, 60, y, 3, 1.0, 0.45)
    a.path("M76 40 L88 40 M76 48 L86 48", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Online Library Catalogue")
def _():
    a = Art()
    a.rect(14, 18, 72, 48, 0, 2.6, None, 3)
    a.rect(19, 23, 62, 38, 3, 1.0, 0.6)
    a.rect(24, 28, 34, 6, 6, 1.4)
    a.circle(66, 31, 3, 6, 1.4)
    a.line(68, 33, 72, 37, 6, 1.4)
    for y in (42, 50, 56):
        a.line(24, y, 56, y, 3, 1.2, 0.6)
        a.line(60, y, 76, y, 3, 1.0, 0.4)
    a.line(38, 76, 62, 76, 0, 2.4)
    a.line(50, 66, 50, 76, 0, 2.2)
    a.ground(90)
    return a
