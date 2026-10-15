"""Topic 32 - electrical machines (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, gear_d, n
from .kit import sparkle
from .registry import item, topic

topic("electrical machines")


def coil(a, x0, x1, cy, r=9, turns=6, z=0, w=2.0):
    st = (x1 - x0) / turns
    d = ""
    for i in range(turns):
        x = x0 + i * st
        d += f"M{n(x)} {n(cy + r)} Q{n(x + st * 0.6)} {n(cy - r * 1.4)} {n(x + st)} {n(cy - r + 2)} "
    a.path(d, z, w)
    a.line(x0, cy + r, x1, cy + r, 3, 1.0, 0.5)


def lam_stack(a, x, y, w, h, n_l=6, z=0):
    a.rect(x, y, w, h, z, 2.4)
    for i in range(1, n_l):
        a.line(x, y + h * i / n_l, x + w, y + h * i / n_l, 3, 1.0, 0.55)


def bolt_row(a, xs, y, r=1.6):
    for x in xs:
        a.circle(x, y, r, 6, 1.3)


def bolt(a, x, y, z=6):
    a.circle(x, y, 2, z, 1.4)


def bolt2(a, x, y):
    bolt(a, x, y)


def spark(a, x, y, s=3):
    sparkle(a, x, y, s, 6, 0.9)


def stator_ring(a, cx, cy, ro, ri, slots, z=0):
    a.circle(cx, cy, ro, z, 2.4)
    a.circle(cx, cy, ri, z, 2.0)
    d = ""
    for k in range(slots):
        t = 2 * math.pi * k / slots
        d += f"M{n(cx + ri * math.cos(t))} {n(cy + ri * math.sin(t))} L{n(cx + (ri + 6) * math.cos(t))} {n(cy + (ri + 6) * math.sin(t))} "
    a.path(d, 3, 1.4, 0.8)


def rotor(a, cx, cy, r, poles, z=6):
    a.circle(cx, cy, r, z, 2.0)
    a.circle(cx, cy, 2.4, z, 1.6)
    d = ""
    for k in range(poles):
        t = 2 * math.pi * k / poles
        d += f"M{n(cx)} {n(cy)} L{n(cx + r * math.cos(t))} {n(cy + r * math.sin(t))} "
    a.path(d, 3, 1.2, 0.7)


@item("Electrical Workshop Stock")
def _():
    a = Art()
    a.circle(24, 36, 12, 0, 2.4)
    a.circle(24, 36, 5, 3, 1.2, 0.6)
    a.rect(44, 24, 40, 8, 0, 2.2)
    a.rect(44, 40, 40, 8, 0, 2.2)
    a.path("M20 62 L80 62 L80 76 L20 76 Z", 0, 2.4)
    a.line(32, 62, 32, 76, 3, 1.0, 0.5)
    a.line(46, 62, 46, 76, 3, 1.0, 0.5)
    a.path("M30 36 Q36 28 40 36", 6, 1.4)
    a.ground(88)
    return a


@item("Copper Coil Winding")
def _():
    a = Art()
    coil(a, 20, 80, 50, 12, 9, 0, 2.2)
    a.line(10, 62, 20, 62, 0, 2.2)
    a.line(80, 62, 90, 62, 0, 2.2)
    a.path("M20 38 L80 38", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Field Coil Assembly")
def _():
    a = Art()
    a.rect(20, 28, 60, 44, 0, 2.4)
    coil(a, 26, 74, 50, 12, 6, 0, 1.8)
    a.rect(14, 44, 6, 12, 0, 2.0)
    a.rect(80, 44, 6, 12, 0, 2.0)
    bolt_row(a, (26, 74), 34)
    a.path("M30 64 L70 64", 3, 1.0, 0.5)
    return a


@item("Wound Motor Stator")
def _():
    a = Art()
    stator_ring(a, 50, 50, 34, 20, 12, 0)
    for k in range(0, 12, 2):
        t = 2 * math.pi * k / 12
        a.circle(50 + 27 * math.cos(t), 50 + 27 * math.sin(t), 3, 6, 1.4)
    a.circle(50, 50, 8, 3, 1.0, 0.5)
    return a


@item("Brushless Motor Stator")
def _():
    a = Art()
    a.circle(50, 50, 10, 0, 2.2)
    for k in range(9):
        t = 2 * math.pi * k / 9
        x, y = 50 + 12 * math.cos(t), 50 + 12 * math.sin(t)
        x2, y2 = 50 + 26 * math.cos(t), 50 + 26 * math.sin(t)
        a.line(x, y, x2, y2, 0, 2.4)
        a.circle(50 + 31 * math.cos(t), 50 + 31 * math.sin(t), 5, 3, 1.6, 0.85)
    a.circle(50, 50, 3, 6, 1.4)
    return a


@item("Laminated Iron Core")
def _():
    a = Art()
    lam_stack(a, 22, 24, 56, 52, 9, 0)
    a.rect(36, 38, 28, 24, 6, 1.8)
    a.path("M22 24 L28 18 L84 18 L78 24 M78 76 L84 70 L84 18", 3, 1.2, 0.7)
    a.ground(88)
    return a


@item("Electromagnet Core")
def _():
    a = Art()
    a.path("M26 24 L26 66 Q26 76 36 76 L64 76 Q74 76 74 66 L74 24", 0, 3.0)
    coil(a, 20, 40, 34, 8, 4, 0, 1.8)
    a.rect(30, 22, 12, 4, 0, 2.0)
    a.rect(58, 22, 12, 4, 0, 2.0)
    a.path("M40 14 Q50 8 60 14 M40 18 Q50 12 60 18", 3, 1.0, 0.6)
    a.path("M20 50 L10 50 M10 50 L10 60", 6, 1.4)
    return a


@item("Transformer Core")
def _():
    a = Art()
    a.rect(20, 22, 60, 56, 0, 2.6)
    a.rect(34, 34, 32, 32, 0, 2.0)
    a.line(50, 34, 50, 66, 3, 1.0, 0.5)
    for y in (26, 30, 70, 74):
        a.line(20, y, 80, y, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("High Frequency Ferrite Transformer")
def _():
    a = Art()
    a.circle(50, 46, 20, 0, 2.6)
    a.circle(50, 46, 9, 0, 2.0)
    for k in range(10):
        t = 2 * math.pi * k / 10
        a.line(50 + 11 * math.cos(t), 46 + 11 * math.sin(t), 50 + 19 * math.cos(t + 0.35), 46 + 19 * math.sin(t + 0.35), 6, 1.6)
    for x in (24, 34, 66, 76):
        a.line(x, 70, x, 82, 0, 2.2)
    a.line(20, 70, 80, 70, 3, 1.0, 0.5)
    return a


@item("Commutator Segment")
def _():
    a = Art()
    a.path("M30 28 L70 28 L62 72 L38 72 Z", 0, 2.6)
    a.line(50, 28, 50, 72, 3, 1.0, 0.5)
    a.path("M30 28 Q50 20 70 28", 0, 2.2)
    a.path("M38 72 Q50 78 62 72", 0, 2.2)
    a.circle(50, 40, 3, 6, 1.4)
    a.path("M40 54 L60 54", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Segmented Commutator")
def _():
    a = Art()
    a.circle(50, 50, 30, 0, 2.6)
    a.circle(50, 50, 10, 0, 2.2)
    for k in range(12):
        t = 2 * math.pi * k / 12
        a.line(50 + 10 * math.cos(t), 50 + 10 * math.sin(t), 50 + 30 * math.cos(t), 50 + 30 * math.sin(t), 3, 1.4, 0.7)
    a.circle(50, 50, 20, 3, 1.0, 0.5)
    a.circle(50, 50, 3, 6, 1.4)
    return a


@item("Brush Motor Armature")
def _():
    a = Art()
    a.line(8, 50, 92, 50, 0, 2.0)
    lam_stack(a, 34, 34, 34, 32, 5, 0)
    coil(a, 34, 68, 50, 12, 4, 6, 1.4)
    a.rect(14, 42, 14, 16, 0, 2.2)
    for x in (18, 22, 26):
        a.line(x, 42, x, 58, 3, 1.0, 0.7)
    a.path("M12 36 L18 42 M12 64 L18 58", 6, 1.8)
    return a


@item("DC Traction Motor")
def _():
    a = Art()
    a.circle(40, 50, 26, 0, 2.6)
    a.circle(40, 50, 16, 3, 1.4, 0.6)
    a.circle(40, 50, 4, 6, 1.6)
    a.path("M66 44 L88 44 L88 58 L66 58", 0, 2.4)
    a.circle(80, 70, 10, 0, 2.2)
    a.line(80, 60, 80, 80, 3, 1.0, 0.5)
    a.line(20, 28, 14, 20, 0, 2.2)
    a.line(60, 28, 66, 20, 0, 2.2)
    a.ground(90)
    return a


@item("Generator Rotor Blank")
def _():
    a = Art()
    a.rect(16, 36, 68, 28, 0, 2.6)
    a.line(6, 50, 16, 50, 0, 2.4)
    a.line(84, 50, 94, 50, 0, 2.4)
    a.line(16, 50, 84, 50, 3, 1.0, 0.5)
    for x in (30, 44, 58, 72):
        a.line(x, 36, x, 64, 3, 1.0, 0.5)
    a.ground(80)
    return a


@item("Wound Generator Rotor")
def _():
    a = Art()
    a.line(8, 50, 92, 50, 0, 2.2)
    a.rect(20, 32, 60, 36, 0, 2.6)
    coil(a, 22, 78, 50, 13, 8, 6, 1.4)
    a.circle(14, 50, 2.6, 6, 1.4)
    a.circle(86, 50, 2.6, 6, 1.4)
    return a


@item("Alternating Current Generator")
def _():
    a = Art()
    a.circle(40, 52, 28, 0, 2.6)
    rotor(a, 40, 52, 16, 4)
    a.path("M68 44 L84 44 M68 60 L84 60", 0, 2.2)
    a.path("M84 44 Q90 52 84 60", 0, 2.2)
    a.path("M60 22 Q66 16 72 22 Q78 28 84 22", 3, 1.6, 0.8)
    a.circle(24, 28, 3, 6, 1.4)
    a.circle(56, 28, 3, 6, 1.4)
    return a


@item("Permanent Magnet Alternator")
def _():
    a = Art()
    stator_ring(a, 50, 50, 34, 24, 8, 0)
    a.circle(50, 50, 14, 6, 2.0)
    a.path("M50 36 L50 50 L64 50", 3, 1.6, 0.8)
    a.rect(44, 38, 12, 8, 6, 1.6)
    a.rect(44, 54, 12, 8, 6, 1.6)
    a.line(50, 38, 50, 46, 3, 1.0, 0.5)
    return a


@item("Electrical Contact Blank")
def _():
    a = Art()
    a.ellipse(40, 44, 18, 6, 0, 2.4)
    a.path("M22 44 L22 56 Q40 66 58 56 L58 44", 0, 2.4)
    a.circle(76, 36, 6, 0, 2.0)
    a.circle(76, 60, 6, 0, 2.0)
    a.line(76, 30, 76, 42, 3, 1.0, 0.5)
    a.ellipse(40, 44, 10, 3, 3, 1.1, 0.6)
    a.ground(80)
    return a


@item("Spring Electrical Contact")
def _():
    a = Art()
    a.path("M20 70 L20 24 L50 24", 0, 2.4)
    a.path("M20 70 L10 70", 0, 2.4)
    a.path("M50 24 L50 34 L74 34 L74 70", 0, 2.4)
    a.circle(50, 36, 3.4, 6, 1.6)
    a.path("M74 48 L82 52 L66 56 L82 60 L66 64", 3, 1.6, 0.9)
    a.rect(60, 70, 28, 6, 0, 2.2)
    a.ground(88)
    return a


@item("Snap Action Switch")
def _():
    a = Art()
    a.rect(22, 30, 56, 38, 0, 2.6)
    a.path("M30 60 L44 44 L70 48", 6, 2.0)
    a.circle(30, 60, 3, 6, 1.6)
    a.circle(70, 48, 2.6, 6, 1.4)
    a.rect(44, 18, 12, 12, 0, 2.2)
    a.line(50, 30, 50, 38, 3, 1.0, 0.5)
    a.line(14, 70, 22, 70, 0, 2.2)
    a.line(78, 70, 86, 70, 0, 2.2)
    return a


@item("Sealed Limit Switch")
def _():
    a = Art()
    a.rect(26, 40, 40, 34, 0, 2.6)
    a.path("M66 52 L84 52 L84 62 L66 62", 0, 2.4)
    a.line(40, 40, 40, 20, 0, 2.4)
    a.circle(40, 16, 5, 0, 2.2)
    a.circle(32, 58, 2, 6, 1.4)
    a.circle(60, 58, 2, 6, 1.4)
    a.path("M26 48 L66 48", 3, 1.0, 0.5)
    a.path("M30 34 L50 34", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Copper Bus Strip")
def _():
    a = Art()
    a.path("M8 42 L80 42 L92 34 L20 34 Z", 0, 2.6)
    a.path("M8 42 L8 50 L80 50 L80 42 M80 50 L92 42 L92 34", 0, 2.6)
    for x in (22, 46, 68):
        a.circle(x, 46, 2, 6, 1.4)
    a.line(20, 38, 80, 38, 3, 1.0, 0.5)
    a.ground(76)
    return a


@item("Electrical Busbar")
def _():
    a = Art()
    for y in (30, 46, 62):
        a.rect(10, y, 80, 8, 0, 2.2)
    for x in (30, 60):
        a.rect(x - 4, 24, 8, 52, 6, 1.8)
        a.circle(x, 28, 1.6, 3, 1.2, 0.8)
        a.circle(x, 72, 1.6, 3, 1.2, 0.8)
    a.ground(86)
    return a


@item("Insulated Busbar Assembly")
def _():
    a = Art()
    for y in (28, 44, 60):
        a.rect(12, y, 76, 8, 0, 2.2)
    for x in (22, 50, 78):
        a.path(f"M{x - 5} 22 L{x + 5} 22 L{x + 5} 74 L{x - 5} 74 Z", 6, 1.6)
        a.line(x, 22, x, 74, 3, 1.0, 0.5)
    a.path("M12 80 L88 80", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("High Current Switchgear")
def _():
    a = Art()
    a.rect(16, 14, 68, 68, 0, 2.6)
    a.line(50, 14, 50, 82, 3, 1.0, 0.6)
    a.circle(33, 28, 6, 6, 1.6)
    a.line(33, 28, 37, 24, 6, 1.4)
    a.rect(24, 42, 18, 14, 6, 1.6)
    a.line(33, 42, 33, 56, 3, 1.0, 0.5)
    a.path("M58 24 L76 24 M58 34 L76 34 M58 44 L76 44", 6, 1.8)
    a.line(60, 64, 74, 64, 6, 2.4)
    spark(a, 76, 64, 3)
    a.line(16, 70, 84, 70, 3, 1.0, 0.5)
    return a
