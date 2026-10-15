"""Topic 34 - radio technologies (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("radio technologies")


def helix(a, x0, x1, cy, r=10, turns=6, z=0, w=2.0, o=None):
    st = (x1 - x0) / turns
    d = ""
    for i in range(turns):
        x = x0 + i * st
        d += f"M{n(x)} {n(cy + r)} Q{n(x + st * 0.6)} {n(cy - r * 1.4)} {n(x + st)} {n(cy - r + 2)} "
    a.path(d, z, w, o)


def waves(a, cx, cy, r0=8, count=3, z=3, w=1.4, span=50, step=7):
    for i in range(count):
        r = r0 + i * step
        t0, t1 = math.radians(-span), math.radians(span)
        a.path(f"M{n(cx + r * math.cos(t0))} {n(cy + r * math.sin(t0))} A{r} {r} 0 0 1 {n(cx + r * math.cos(t1))} {n(cy + r * math.sin(t1))}", z, w, 0.9 - 0.2 * i)


def knob(a, x, y, r=5, z=6):
    a.circle(x, y, r, z, 1.8)
    a.line(x, y, x + r * 0.7, y - r * 0.7, z, 1.4)


def tube(a, cx, y, w=16, h=30, z=0):
    a.path(f"M{cx - w / 2} {y + h} L{cx - w / 2} {y + 8} Q{cx - w / 2} {y} {cx} {y} Q{cx + w / 2} {y} {cx + w / 2} {y + 8} L{cx + w / 2} {y + h} Z", z, 2.4)
    a.line(cx - 4, y + h - 4, cx - 4, y + 12, 3, 1.2, 0.7)
    a.line(cx + 4, y + h - 4, cx + 4, y + 12, 3, 1.2, 0.7)
    a.path(f"M{cx - 5} {y + 10} L{cx + 5} {y + 10}", 3, 1.2, 0.7)
    for k in range(-2, 3):
        a.line(cx + k * 3, y + h, cx + k * 3, y + h + 6, 0, 1.6)


def trans(a, cx, y, r=9, z=0):
    a.path(f"M{cx - r} {y + r} A{r} {r} 0 0 1 {cx + r} {y + r} Z", z, 2.4)
    for dx in (-4, 0, 4):
        a.line(cx + dx, y + r, cx + dx, y + r + 12, z, 1.6)


def cone(a, cx, cy, r, z=0):
    a.circle(cx, cy, r, z, 2.6)
    a.circle(cx, cy, r * 0.62, z, 1.8)
    a.circle(cx, cy, r * 0.2, 6, 1.6)
    a.circle(cx, cy, r * 0.42, 3, 1.0, 0.5)


def antenna_mast(a, x, y0, y1):
    a.line(x, y0, x, y1, 0, 2.2)
    a.line(x - 6, y0 + 6, x + 6, y0 + 6, 0, 2.0)
    a.line(x - 4, y0 + 12, x + 4, y0 + 12, 0, 1.6)


@item("Radio Circuit Materials")
def _():
    a = Art()
    helix(a, 14, 44, 36, 7, 4, 0, 2.0)
    a.rect(54, 28, 28, 14, 0, 2.2)
    a.circle(24, 66, 8, 0, 2.2)
    a.circle(24, 66, 2.6, 3, 1.1, 0.6)
    a.path("M46 60 L66 60 M46 72 L66 72 M52 60 L52 72 M60 60 L60 72", 0, 2.0)
    a.line(74, 60, 74, 74, 6, 1.8)
    a.ground(86)
    return a


@item("Wire Loop Antenna")
def _():
    a = Art()
    a.circle(50, 42, 24, 0, 2.6)
    a.path("M50 66 L50 80 M44 80 L56 80", 0, 2.2)
    waves(a, 78, 42, 6, 2, 3, 1.3, 40, 6)
    a.circle(50, 66, 2.4, 6, 1.4)
    a.path("M30 28 Q34 22 40 20", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Tuned Loop Antenna")
def _():
    a = Art()
    a.path("M26 66 L26 22 L74 22 L74 66", 0, 2.6)
    a.path("M26 66 L44 66 M56 66 L74 66", 0, 2.6)
    a.line(44, 58, 44, 74, 6, 2.0)
    a.line(56, 58, 56, 74, 6, 2.0)
    a.circle(50, 22, 3, 6, 1.4)
    waves(a, 82, 40, 5, 2, 3, 1.2, 40, 6)
    a.ground(86)
    return a


@item("Ferrite Rod Antenna")
def _():
    a = Art()
    a.rect(14, 42, 72, 16, 0, 2.6)
    helix(a, 28, 66, 50, 12, 7, 6, 1.6)
    a.line(14, 50, 86, 50, 3, 1.0, 0.5)
    a.path("M28 64 L28 74 M66 64 L66 74", 0, 2.0)
    a.ground(86)
    return a


@item("Active Loop Antenna")
def _():
    a = Art()
    a.circle(40, 44, 22, 0, 2.6)
    a.rect(64, 56, 24, 18, 0, 2.2)
    trans(a, 76, 34, 6, 6)
    a.path("M40 66 L40 74 L64 66", 0, 2.0)
    a.path("M70 66 L82 66", 3, 1.2, 0.7)
    a.path("M80 22 L86 16 M84 28 L92 22", 3, 1.4, 0.8)
    a.ground(88)
    return a


@item("Crystal Detector Contact")
def _():
    a = Art()
    a.rect(26, 56, 48, 12, 0, 2.4)
    a.path("M36 56 L42 40 L56 40 L62 56 Z", 0, 2.4)
    a.path("M40 50 L58 50", 3, 1.0, 0.6)
    a.path("M72 30 L56 30 L46 40", 6, 1.4)
    a.circle(72, 30, 3, 6, 1.6)
    a.path("M56 30 L52 36", 3, 1.0, 0.5)
    a.ground(84)
    return a


@item("Crystal Radio Receiver")
def _():
    a = Art()
    a.rect(14, 54, 72, 24, 0, 2.6)
    helix(a, 20, 44, 42, 8, 5, 0, 1.8)
    a.path("M56 46 L66 34 L74 40 Z", 6, 1.8)
    a.circle(66, 64, 5, 6, 1.8)
    a.circle(30, 66, 3, 6, 1.4)
    a.path("M50 14 L50 26 M44 14 L56 14", 0, 2.0)
    a.path("M50 26 L50 42", 3, 1.2, 0.7)
    a.ground(90)
    return a


@item("Vacuum Tube Radio Receiver")
def _():
    a = Art()
    a.rect(12, 38, 76, 44, 0, 2.6)
    tube(a, 28, 16, 12, 24, 0)
    tube(a, 50, 16, 12, 24, 0)
    knob(a, 28, 62, 6)
    knob(a, 72, 62, 6)
    a.path("M40 56 L60 56 L60 70 L40 70 Z", 6, 1.6)
    a.path("M44 63 L56 63", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Transistor Radio Receiver")
def _():
    a = Art()
    a.rect(16, 28, 68, 46, 0, 2.6, None, 6)
    a.circle(34, 52, 12, 0, 2.2)
    a.dots([(30, 50), (34, 54), (38, 50), (34, 46), (30, 56), (38, 56)], 0.9, 3, 0.8)
    a.path("M54 38 L76 38", 6, 1.6)
    a.circle(66, 56, 5, 6, 1.8)
    a.line(66, 56, 69, 52, 6, 1.4)
    a.line(72, 28, 84, 10, 0, 2.2)
    a.ground(88)
    return a


@item("Variable Capacitor Plate")
def _():
    a = Art()
    a.path("M50 22 A28 28 0 0 1 50 78 L50 22", 0, 2.6)
    a.circle(50, 50, 4, 6, 1.6)
    a.circle(50, 50, 14, 3, 1.0, 0.5)
    a.line(50, 50, 72, 36, 3, 1.0, 0.5)
    a.line(30, 78, 20, 84, 0, 2.0)
    a.line(70, 78, 80, 84, 0, 2.0)
    a.circle(50, 50, 22, 3, 1.0, 0.5)
    return a


@item("Air Variable Capacitor")
def _():
    a = Art()
    a.line(50, 18, 50, 60, 0, 2.4)
    for k in range(5):
        a.path(f"M{24 + k * 6} {30 + k * 3} A{22 - k * 3} {22 - k * 3} 0 0 1 {50 + (26 - k * 6)} {30 + k * 3}", 0, 2.0)
    a.line(18, 66, 82, 66, 0, 2.4)
    a.line(22, 66, 22, 76, 0, 2.0)
    a.line(78, 66, 78, 76, 0, 2.0)
    a.circle(50, 14, 3, 6, 1.6)
    for k in range(4):
        a.line(34 + k * 10, 66, 34 + k * 10, 56, 3, 1.2, 0.7)
    return a


@item("Resonant Tuning Circuit")
def _():
    a = Art()
    a.path("M16 28 L84 28 L84 72 L16 72 Z", 0, 1.8, 0.7)
    helix(a, 22, 46, 28, 7, 4, 6, 1.8)
    a.line(62, 22, 62, 34, 6, 2.2)
    a.line(70, 22, 70, 34, 6, 2.2)
    a.path("M16 50 L36 50", 3, 1.0, 0.5)
    a.path("M30 62 Q38 50 46 62 T62 62 T78 62", 3, 1.4, 0.9)
    return a


@item("Frequency Synthesizer Module")
def _():
    a = Art()
    a.rect(14, 22, 72, 50, 0, 2.6)
    a.rect(22, 30, 26, 16, 0, 1.8)
    a.path("M26 38 L30 34 L34 42 L38 34 L42 42", 3, 1.4, 0.9)
    a.circle(66, 38, 8, 0, 2.0)
    a.circle(66, 38, 2.4, 6, 1.2)
    for x in (24, 34, 44, 54, 64, 74):
        a.line(x, 72, x, 80, 0, 2.0)
    a.path("M22 58 L76 58", 3, 1.0, 0.5)
    return a


@item("Copper Radio Coil")
def _():
    a = Art()
    a.circle(50, 50, 30, 0, 2.2)
    a.circle(50, 50, 22, 0, 2.0)
    a.circle(50, 50, 14, 0, 2.0)
    a.circle(50, 50, 6, 0, 1.8)
    a.path("M20 50 L8 50 M50 80 L50 90", 6, 1.8)
    a.circle(50, 50, 26, 3, 1.0, 0.5)
    return a


@item("Solenoid Inductor")
def _():
    a = Art()
    helix(a, 18, 82, 50, 14, 9, 0, 2.2)
    a.line(8, 64, 18, 64, 0, 2.2)
    a.line(82, 64, 92, 64, 0, 2.2)
    a.line(18, 64, 82, 64, 3, 1.0, 0.5)
    a.path("M30 28 L70 28", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("RF Transformer Coil")
def _():
    a = Art()
    helix(a, 14, 46, 36, 8, 5, 0, 2.0)
    helix(a, 54, 86, 36, 8, 5, 0, 2.0)
    a.line(48, 22, 48, 54, 6, 1.8)
    a.line(52, 22, 52, 54, 6, 1.8)
    a.rect(30, 62, 40, 14, 0, 2.2)
    a.path("M40 62 L40 76 M60 62 L60 76", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Shielded RF Inductor")
def _():
    a = Art()
    a.rect(26, 22, 48, 54, 0, 2.6)
    helix(a, 32, 68, 50, 12, 6, 6, 1.6)
    a.path("M26 22 L32 16 L80 16 L74 22 M74 76 L80 70 L80 16", 3, 1.2, 0.7)
    for x in (34, 50, 66):
        a.line(x, 76, x, 84, 0, 2.0)
    return a


@item("Radio Oscillator Circuit")
def _():
    a = Art()
    helix(a, 16, 40, 30, 7, 4, 0, 1.8)
    a.line(52, 24, 52, 38, 6, 2.2)
    a.line(60, 24, 60, 38, 6, 2.2)
    a.path("M16 60 Q26 48 36 60 T56 60 T76 60 T92 60", 0, 2.2)
    a.path("M10 74 L90 74", 3, 1.0, 0.5)
    arrow(a, 70, 30, 88, 30, 3, 1.4, 0.8)
    return a


@item("Vacuum Tube Oscillator")
def _():
    a = Art()
    tube(a, 34, 18, 18, 34, 0)
    helix(a, 56, 84, 36, 8, 4, 0, 1.8)
    a.path("M34 58 L34 70 L84 70", 3, 1.2, 0.7)
    a.path("M20 80 Q30 72 40 80 T60 80 T80 80", 6, 1.6, 0.9)
    return a


@item("Transistor RF Oscillator")
def _():
    a = Art()
    trans(a, 34, 26, 12, 0)
    helix(a, 56, 84, 40, 8, 4, 0, 1.8)
    a.rect(22, 64, 14, 8, 6, 1.6)
    a.path("M36 54 L36 64", 3, 1.2, 0.7)
    a.path("M20 82 Q30 74 40 82 T60 82 T80 82", 6, 1.6, 0.9)
    return a


@item("Phase Locked Loop Oscillator")
def _():
    a = Art()
    a.circle(30, 30, 10, 0, 2.2)
    a.rect(58, 22, 24, 16, 0, 2.2)
    a.circle(70, 66, 10, 0, 2.2)
    a.circle(30, 66, 8, 0, 2.2)
    arrow(a, 40, 30, 58, 30, 3, 1.4)
    arrow(a, 70, 38, 70, 56, 3, 1.4)
    arrow(a, 60, 66, 42, 66, 3, 1.4)
    arrow(a, 30, 58, 30, 42, 3, 1.4)
    a.path("M24 30 L28 26 L32 34 L36 30", 6, 1.2, 0.8)
    return a


@item("Radio Speaker Cone")
def _():
    a = Art()
    a.path("M20 30 L80 30 L62 70 L38 70 Z", 0, 2.6)
    a.ellipse(50, 30, 30, 6, 0, 2.2)
    a.ellipse(50, 70, 12, 3, 0, 2.0)
    a.path("M30 40 L70 40 M36 52 L64 52", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Moving Coil Speaker")
def _():
    a = Art()
    a.path("M24 26 L76 26 L60 56 L40 56 Z", 0, 2.6)
    a.rect(38, 56, 24, 14, 0, 2.2)
    helix(a, 40, 60, 62, 4, 4, 6, 1.4)
    a.rect(34, 70, 32, 8, 0, 2.2)
    a.path("M30 36 L70 36", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Enclosed Radio Loudspeaker")
def _():
    a = Art()
    a.rect(20, 14, 60, 72, 0, 2.6)
    cone(a, 50, 34, 14, 0)
    cone(a, 50, 66, 10, 0)
    a.path("M26 20 L30 20 M70 20 L74 20", 3, 1.2, 0.7)
    a.ground(92)
    return a


@item("Powered Monitor Speaker")
def _():
    a = Art()
    a.rect(22, 12, 56, 74, 0, 2.6)
    cone(a, 50, 34, 15, 0)
    cone(a, 50, 66, 9, 0)
    a.circle(30, 20, 2, 6, 1.4)
    a.line(66, 20, 72, 20, 6, 2.0)
    a.line(44, 80, 56, 80, 3, 1.4, 0.8)
    a.line(8, 70, 22, 70, 0, 2.2)
    a.ground(94)
    return a
