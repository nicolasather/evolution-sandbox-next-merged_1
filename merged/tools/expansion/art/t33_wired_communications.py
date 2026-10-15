"""Topic 33 - wired communications (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("wired communications")


def wire_wave(a, x0, x1, y, amp=4, per=10, z=0, w=2.0, o=None):
    d = f"M{x0} {y}"
    x = x0
    while x < x1:
        d += f" q{per / 4} {-amp} {per / 2} 0 t{per / 2} 0"
        x += per
    a.path(d, z, w, o)


def twist(a, x0, x1, y, amp=3, per=12, z=0, w=1.8):
    d1 = f"M{x0} {y}"
    d2 = f"M{x0} {y}"
    x = x0
    while x < x1:
        d1 += f" q{per / 4} {-amp * 2} {per / 2} 0 t{per / 2} 0"
        d2 += f" q{per / 4} {amp * 2} {per / 2} 0 t{per / 2} 0"
        x += per
    a.path(d1, z, w)
    a.path(d2, z, w, 0.85)


def cable_end(a, x, y, r=8, z=0):
    a.ellipse(x, y, 3, r, z, 2.2)


def knobx(a, x, y, r=3, z=6):
    a.circle(x, y, r, z, 1.6)


def key_base(a, x=18, y=66, w=64):
    a.rect(x, y, w, 8, 0, 2.4)
    a.line(x + 4, y + 8, x + 4, y + 14, 0, 2.0)
    a.line(x + w - 4, y + 8, x + w - 4, y + 14, 0, 2.0)


def handset(a, cx, cy, s=1.0, z=0):
    a.path(f"M{cx - 26 * s} {cy - 6 * s} Q{cx - 26 * s} {cy - 14 * s} {cx - 18 * s} {cy - 14 * s} L{cx - 10 * s} {cy - 14 * s} L{cx - 10 * s} {cy - 2 * s} L{cx - 18 * s} {cy - 2 * s}", z, 2.4)
    a.path(f"M{cx + 26 * s} {cy - 6 * s} Q{cx + 26 * s} {cy - 14 * s} {cx + 18 * s} {cy - 14 * s} L{cx + 10 * s} {cy - 14 * s} L{cx + 10 * s} {cy - 2 * s} L{cx + 18 * s} {cy - 2 * s}", z, 2.4)
    a.path(f"M{cx - 10 * s} {cy - 8 * s} Q{cx} {cy - 14 * s} {cx + 10 * s} {cy - 8 * s}", z, 2.4)


def dial_holes(a, cx, cy, r, count=10, rad=2.2, z=6, start=40, span=270):
    for k in range(count):
        t = math.radians(start + span * k / (count - 1))
        a.circle(cx + r * math.cos(t), cy + r * math.sin(t), rad, z, 1.4)


@item("Wired Signal Components")
def _():
    a = Art()
    a.path("M10 30 Q22 18 34 30 T58 30 T82 30", 0, 2.2)
    a.rect(14, 46, 22, 14, 0, 2.2)
    a.circle(62, 52, 9, 0, 2.2)
    a.circle(62, 52, 3, 3, 1.1, 0.6)
    a.path("M36 53 L53 53", 3, 1.4, 0.8)
    a.rect(18, 68, 30, 8, 0, 2.2)
    a.rect(58, 68, 26, 8, 0, 2.2)
    a.ground(88)
    return a


@item("Telegraph Key Contact")
def _():
    a = Art()
    a.rect(20, 62, 60, 8, 0, 2.4)
    a.circle(34, 58, 4, 0, 2.2)
    a.circle(34, 58, 1.4, 6, 1.2)
    a.path("M34 54 L34 44 L72 40", 0, 2.4)
    a.circle(66, 52, 3.4, 6, 1.6)
    a.line(66, 44, 66, 49, 3, 1.4, 0.8)
    sparkle(a, 66, 56, 3, 6, 0.9)
    a.ground(86)
    return a


@item("Manual Telegraph Key")
def _():
    a = Art()
    key_base(a, 18, 62, 64)
    a.path("M26 62 L26 52 L74 46 L82 48", 0, 2.6)
    a.ellipse(40, 40, 8, 4, 0, 2.2)
    a.path("M32 40 L32 48 M48 40 L48 46", 0, 2.2)
    a.circle(68, 54, 2.6, 6, 1.6)
    a.path("M24 56 L28 56", 3, 1.2, 0.7)
    a.ground(88)
    return a


@item("Sounder Telegraph Circuit")
def _():
    a = Art()
    a.path("M14 24 L86 24 L86 70 L14 70 Z", 0, 1.8, 0.8)
    a.rect(24, 54, 22, 12, 0, 2.2)
    a.path("M32 54 L32 42 L58 40 L58 54", 0, 2.4)
    a.line(66, 40, 76, 40, 3, 1.4)
    a.circle(30, 24, 4, 6, 1.6)
    a.path("M60 24 L76 24 L72 18 M76 24 L72 30", 6, 1.6)
    a.path("M52 62 L72 62", 3, 1.0, 0.5)
    return a


@item("Duplex Telegraph Circuit")
def _():
    a = Art()
    a.path("M8 30 L92 30", 0, 2.2)
    a.path("M8 70 L92 70", 0, 2.2)
    a.rect(14, 38, 18, 24, 0, 2.2)
    a.rect(68, 38, 18, 24, 0, 2.2)
    a.path("M32 44 L68 44", 3, 1.4, 0.8)
    a.path("M68 56 L32 56", 3, 1.4, 0.8)
    arrow(a, 44, 44, 56, 44, 6, 1.4)
    arrow(a, 56, 56, 44, 56, 6, 1.4)
    a.line(23, 30, 23, 38, 3, 1.2, 0.7)
    a.line(77, 62, 77, 70, 3, 1.2, 0.7)
    return a


@item("Telephone Carbon Granule")
def _():
    a = Art()
    a.circle(50, 50, 28, 0, 2.4)
    a.dots([(40, 40), (52, 36), (60, 46), (44, 52), (56, 58), (38, 62), (66, 62), (48, 68), (60, 70)], 3.0, 0, 0.9)
    a.circle(50, 50, 20, 3, 1.0, 0.5)
    a.path("M30 28 L26 22 M70 28 L74 22", 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Carbon Microphone Capsule")
def _():
    a = Art()
    a.circle(50, 48, 24, 0, 2.6)
    a.circle(50, 48, 16, 0, 2.0)
    a.dots([(44, 44), (52, 42), (58, 50), (46, 54), (54, 56)], 1.8, 3, 0.8)
    a.line(50, 72, 50, 84, 0, 2.2)
    a.line(40, 84, 60, 84, 0, 2.2)
    a.path("M30 40 Q50 28 70 40", 3, 1.0, 0.5)
    a.path("M20 30 L12 24 M80 30 L88 24", 6, 1.4, 0.7)
    return a


@item("Handset Telephone")
def _():
    a = Art()
    handset(a, 50, 46, 1.2, 0)
    a.circle(30, 40, 5, 6, 1.6)
    a.dots([(66, 38), (70, 42), (66, 46), (70, 34)], 0.9, 3, 0.8)
    wire_wave(a, 30, 70, 74, 5, 10, 3, 1.6, 0.8)
    a.ground(88)
    return a


@item("Desk Telephone Exchange")
def _():
    a = Art()
    a.rect(14, 22, 72, 52, 0, 2.6)
    for r in range(3):
        for c in range(6):
            a.circle(24 + c * 10.4, 32 + r * 10, 2.4, 6, 1.3)
    a.line(14, 56, 86, 56, 3, 1.0, 0.6)
    for c in range(5):
        a.line(22 + c * 12, 56, 22 + c * 12 + 6, 68, 0, 1.8)
    a.path("M14 74 L8 84 L92 84 L86 74", 0, 2.2)
    return a


@item("Insulated Signal Wire")
def _():
    a = Art()
    a.path("M8 44 L84 44 M8 58 L84 58", 0, 2.6)
    a.path("M84 44 A4 7 0 0 1 84 58", 0, 2.4)
    a.line(56, 51, 94, 51, 6, 1.6)
    a.path("M8 51 L56 51", 3, 1.0, 0.5)
    for x in (20, 34, 48):
        a.line(x, 44, x, 58, 3, 1.0, 0.4)
    a.ground(76)
    return a


@item("Twisted Wire Pair")
def _():
    a = Art()
    twist(a, 8, 88, 50, 7, 16, 0, 2.4)
    twist(a, 8, 88, 50, 2, 16, 3, 1.0)
    a.circle(10, 50, 2.4, 6, 1.4)
    a.circle(90, 50, 2.4, 6, 1.4)
    a.ground(76)
    return a


@item("Multi Pair Cable")
def _():
    a = Art()
    a.path("M8 36 L86 36 M8 64 L86 64", 0, 2.6)
    a.ellipse(86, 50, 6, 14, 0, 2.4)
    for i, y in enumerate((42, 50, 58)):
        twist(a, 14, 80, y, 2.4, 14, 3, 1.4)
    a.circle(86, 50, 1.4, 6, 1.2)
    a.ground(80)
    return a


@item("Shielded Data Cable")
def _():
    a = Art()
    a.path("M8 36 L86 36 M8 64 L86 64", 0, 2.6)
    a.ellipse(86, 50, 6, 14, 0, 2.4)
    a.path("M12 40 L82 60 M12 48 L82 68 M12 32 L82 52", 3, 1.0, 0.45)
    a.path("M12 60 L82 40 M12 52 L82 32", 3, 1.0, 0.45)
    a.line(14, 50, 80, 50, 6, 2.0)
    a.ground(80)
    return a


@item("Mechanical Telephone Dial")
def _():
    a = Art()
    a.circle(50, 50, 34, 0, 2.6)
    a.circle(50, 50, 10, 0, 2.2)
    dial_holes(a, 50, 50, 22, 10, 3.4, 6)
    a.path("M70 82 L82 78", 3, 2.0, 0.8)
    a.circle(50, 50, 4, 3, 1.1, 0.6)
    return a


@item("Rotary Telephone Dial")
def _():
    a = Art()
    a.circle(50, 50, 36, 0, 2.6)
    a.circle(50, 50, 28, 3, 1.0, 0.5)
    a.circle(50, 50, 8, 0, 2.0)
    dial_holes(a, 50, 50, 19, 10, 3.0, 6, 50, 280)
    a.path("M76 78 L82 72", 6, 2.4)
    a.path("M86 54 L90 50 M86 46 L90 50", 3, 1.2, 0.6)
    return a


@item("Push Button Dial")
def _():
    a = Art()
    a.rect(26, 16, 48, 68, 0, 2.6)
    for r in range(4):
        for c in range(3):
            a.rect(32 + c * 14, 24 + r * 14, 10, 9, 6, 1.6)
    a.path("M32 80 L68 80", 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Digital Telephone Keypad")
def _():
    a = Art()
    a.rect(24, 12, 52, 76, 0, 2.6)
    a.rect(30, 18, 40, 12, 0, 1.8)
    a.path("M34 24 L38 24 M42 24 L50 24 M54 24 L66 24", 3, 1.4, 0.8)
    for r in range(4):
        for c in range(3):
            a.circle(36 + c * 14, 40 + r * 11, 3.6, 6, 1.5)
    a.path("M30 84 L70 84", 3, 1.0, 0.5)
    return a


@item("Cable Plug Contact")
def _():
    a = Art()
    a.rect(14, 38, 38, 24, 0, 2.4)
    a.path("M52 44 L82 44 L82 56 L52 56", 0, 2.4)
    a.path("M82 46 L92 46 M82 54 L92 54", 0, 2.2)
    a.path("M8 50 L14 50", 0, 2.4)
    a.line(30, 38, 30, 62, 3, 1.0, 0.6)
    a.path("M56 50 L78 50", 3, 1.0, 0.5)
    a.ground(76)
    return a


@item("Two Pin Cable Connector")
def _():
    a = Art()
    a.rect(14, 34, 40, 32, 0, 2.6)
    a.path("M54 42 L72 42 L72 58 L54 58", 0, 2.4)
    a.line(72, 44, 90, 44, 0, 2.6)
    a.line(72, 56, 90, 56, 0, 2.6)
    a.path("M6 50 L14 50", 0, 2.6)
    a.path("M20 42 L48 42 M20 58 L48 58", 3, 1.0, 0.5)
    a.ground(78)
    return a


@item("Modular Signal Connector")
def _():
    a = Art()
    a.rect(22, 30, 56, 36, 0, 2.6)
    a.rect(30, 42, 40, 18, 0, 2.0)
    for i in range(8):
        a.line(33 + i * 4.8, 46, 33 + i * 4.8, 58, 3, 1.4, 0.8)
    a.path("M44 30 L44 22 L56 22 L56 30", 0, 2.2)
    wire_wave(a, 10, 22, 74, 3, 6, 3, 1.2, 0.7)
    a.ground(84)
    return a


@item("Shielded Network Connector")
def _():
    a = Art()
    a.rect(20, 34, 60, 34, 0, 2.6)
    a.rect(28, 44, 44, 16, 0, 2.0)
    for i in range(8):
        a.line(31 + i * 5, 48, 31 + i * 5, 58, 3, 1.4, 0.8)
    a.path("M20 34 L26 26 L74 26 L80 34", 0, 2.2)
    a.path("M26 26 L26 34 M74 26 L74 34", 3, 1.0, 0.6)
    a.circle(24, 72, 1.6, 6, 1.2)
    a.circle(76, 72, 1.6, 6, 1.2)
    return a


@item("Signal Relay Coil")
def _():
    a = Art()
    a.line(20, 50, 80, 50, 0, 2.6)
    for i in range(7):
        x = 24 + i * 8
        a.path(f"M{x} 62 Q{x + 4} 34 {x + 8} 62", 0, 2.0)
    a.rect(14, 44, 6, 12, 0, 2.0)
    a.rect(80, 44, 6, 12, 0, 2.0)
    a.path("M20 70 L10 70 M80 70 L90 70", 3, 1.4, 0.8)
    return a


@item("Electromagnetic Signal Relay")
def _():
    a = Art()
    a.rect(14, 54, 36, 22, 0, 2.4)
    for i in range(4):
        a.path(f"M{18 + i * 8} 74 Q{22 + i * 8} 56 {26 + i * 8} 74", 3, 1.4, 0.8)
    a.path("M50 56 L50 34 L82 34", 0, 2.6)
    a.path("M70 34 L70 42", 6, 1.8)
    a.circle(70, 46, 3, 6, 1.6)
    a.rect(60, 62, 28, 6, 0, 2.2)
    a.ground(88)
    return a


@item("Telephone Switching Relay")
def _():
    a = Art()
    a.rect(14, 18, 72, 64, 0, 2.6)
    for r in range(3):
        a.rect(20, 24 + r * 18, 26, 12, 0, 1.8)
        a.path(f"M52 {30 + r * 18} L78 {30 + r * 18}", 6, 1.8)
        a.circle(78, 30 + r * 18, 2, 6, 1.3)
    a.path("M20 78 L80 78", 3, 1.0, 0.5)
    return a


@item("Electronic Switching Matrix")
def _():
    a = Art()
    for i in range(5):
        a.line(16, 24 + i * 14, 84, 24 + i * 14, 0, 2.0)
        a.line(24 + i * 14, 16, 24 + i * 14, 80, 0, 2.0)
    for r, c in ((0, 1), (1, 3), (2, 0), (3, 4), (4, 2)):
        a.circle(24 + c * 14, 24 + r * 14, 3.6, 6, 1.8)
    for r, c in ((0, 3), (2, 2), (4, 4)):
        a.circle(24 + c * 14, 24 + r * 14, 2.0, 3, 1.0, 0.6)
    return a
