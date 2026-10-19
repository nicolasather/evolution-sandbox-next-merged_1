"""Topic 38 - semiconductor devices (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("semiconductor devices")


def wafer(a, cx=50, cy=50, r=32, z=0, flat=True):
    if flat:
        a.path(f"M{cx - r * 0.55} {cy + r * 0.82} A{r} {r} 0 1 1 {cx + r * 0.55} {cy + r * 0.82} Z", z, 2.6)
    else:
        a.circle(cx, cy, r, z, 2.6)


def die_grid(a, cx=50, cy=48, step=9, rr=24, z=3, w=1.0, o=0.6):
    d = ""
    for i in range(-3, 4):
        x = cx + i * step
        h = math.sqrt(max(0, rr * rr - (i * step) ** 2))
        if h > 3:
            d += f"M{n(x)} {n(cy - h)} L{n(x)} {n(cy + h)} "
            d += f"M{n(cx - h)} {n(cy + i * step)} L{n(cx + h)} {n(cy + i * step)} "
    a.path(d, z, w, o)


def layer_stack(a, x, y, w, layers, z=0):
    for i in range(layers):
        a.rect(x, y + i * 9, w, 8, z if i == 0 else 3, 2.2 if i == 0 else 1.4, None if i == 0 else 0.85)


def sym_diode(a, cx, cy, z=0, s=14):
    a.poly([(cx - s * 0.6, cy - s), (cx - s * 0.6, cy + s), (cx + s * 0.6, cy)], z, 2.4, None, True)
    a.line(cx + s * 0.6, cy - s, cx + s * 0.6, cy + s, z, 2.4)
    a.line(cx - s * 2.2, cy, cx - s * 0.6, cy, z, 2.2)
    a.line(cx + s * 0.6, cy, cx + s * 2.2, cy, z, 2.2)


def pkg_to92(a, cx, y, w=24, z=0):
    a.path(f"M{cx - w / 2} {y + 26} L{cx - w / 2} {y + 12} A{w / 2} {w / 2} 0 0 1 {cx + w / 2} {y + 12} L{cx + w / 2} {y + 26} Z", z, 2.6)
    for dx in (-6, 0, 6):
        a.line(cx + dx, y + 26, cx + dx, y + 42, z, 1.8)
    a.path(f"M{cx - 6} {y + 12} L{cx + 6} {y + 12}", 3, 1.0, 0.6)


def pkg_to220(a, cx, y, z=0):
    a.rect(cx - 16, y + 8, 32, 26, z, 2.6)
    a.rect(cx - 16, y, 32, 8, z, 2.2)
    a.circle(cx, y + 4, 2.2, 6, 1.4)
    for dx in (-8, 0, 8):
        a.line(cx + dx, y + 34, cx + dx, y + 50, z, 1.8)


def gate_box(a, x, y, w=22, h=22, z=0, bubble=False):
    a.rect(x, y, w, h, z, 2.4)
    if bubble:
        a.circle(x + w + 3, y + h / 2, 2.6, z, 1.8)


def pad_leads(a, x, y, count, step, length=8, vertical=True, z=0):
    for i in range(count):
        if vertical:
            a.line(x + i * step, y, x + i * step, y + length, z, 1.8)
        else:
            a.line(x, y + i * step, x + length, y + i * step, z, 1.8)


@item("Semiconductor Fabrication Stock")
def _():
    a = Art()
    wafer(a, 30, 42, 20, 0)
    a.rect(58, 22, 28, 12, 0, 2.2)
    a.rect(58, 40, 28, 12, 0, 2.2)
    a.circle(30, 76, 7, 0, 2.2)
    a.rect(48, 64, 38, 14, 0, 2.2)
    a.path("M52 70 L82 70", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Doped Silicon Wafer")
def _():
    a = Art()
    wafer(a, 50, 48, 32, 0)
    a.dots([(38, 36), (50, 30), (62, 38), (44, 48), (56, 52), (36, 58), (66, 58), (50, 66)], 1.4, 3, 0.8)
    a.circle(50, 48, 24, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Photolithography Wafer")
def _():
    a = Art()
    wafer(a, 50, 56, 28, 0)
    a.path("M30 14 L70 14 L60 30 L40 30 Z", 0, 2.2)
    a.path("M50 30 L50 42", 3, 1.4, 0.8)
    a.path("M36 56 L64 56 M40 48 L60 48 M40 64 L60 64", 3, 1.0, 0.6)
    sparkle(a, 50, 44, 3, 6, 0.9)
    return a


@item("Etched Silicon Wafer")
def _():
    a = Art()
    wafer(a, 50, 50, 32, 0)
    die_grid(a, 50, 48, 9, 26, 3, 1.4, 0.8)
    a.circle(50, 48, 2.4, 6, 1.4)
    a.circle(50, 48, 26, 3, 1.0, 0.5)
    a.dots([(41, 39), (59, 57), (41, 57)], 1.2, 6)
    a.ground(90)
    return a


@item("Multilayer Device Wafer")
def _():
    a = Art()
    a.path("M20 56 L50 40 L80 56 L50 72 Z", 0, 2.6)
    a.path("M20 56 L20 64 L50 80 L80 64 L80 56", 0, 2.4)
    a.path("M26 48 L50 36 L74 48", 3, 1.4, 0.8)
    a.path("M30 40 L50 30 L70 40", 3, 1.2, 0.7)
    a.path("M34 32 L50 24 L66 32", 3, 1.0, 0.6)
    a.path("M50 72 L50 80", 3, 1.0, 0.5)
    return a


@item("Silicon Diode Junction")
def _():
    a = Art()
    a.rect(24, 30, 52, 20, 0, 2.4)
    a.rect(24, 50, 52, 20, 0, 2.4)
    a.path("M24 50 L76 50", 6, 2.0)
    a.dots([(34, 40), (50, 38), (66, 42)], 1.4, 3, 0.8)
    a.path("M34 60 L38 60 M46 60 L50 60 M60 60 L64 60", 3, 1.4, 0.8)
    a.ground(82)
    return a


@item("Rectifier Diode")
def _():
    a = Art()
    sym_diode(a, 50, 40, 0, 12)
    a.rect(30, 62, 40, 14, 0, 2.4)
    a.line(62, 62, 62, 76, 6, 1.8)
    a.line(14, 69, 30, 69, 0, 2.2)
    a.line(70, 69, 86, 69, 0, 2.2)
    a.path("M34 66 L58 66", 3, 1.0, 0.5)
    return a


@item("Fast Recovery Diode")
def _():
    a = Art()
    sym_diode(a, 50, 38, 0, 12)
    a.path("M30 66 L40 66 L40 56 L52 56 L52 66 L72 66", 6, 1.8)
    arrow(a, 70, 76, 30, 76, 3, 1.2, 0.8)
    a.line(32, 82, 68, 82, 3, 1.0, 0.4)
    return a


@item("Schottky Rectifier Diode")
def _():
    a = Art()
    a.poly([(38, 24), (38, 56), (60, 40)], 0, 2.4, None, True)
    a.path("M60 24 L60 56 M60 24 L66 24 L66 28 M60 56 L54 56 L54 52", 0, 2.4)
    a.line(14, 40, 38, 40, 0, 2.2)
    a.line(60, 40, 86, 40, 0, 2.2)
    a.rect(30, 66, 40, 14, 3, 1.6, 0.8)
    a.path("M30 90 L70 90", 3, 1.0, 0.5)
    a.circle(49, 40, 2, 6, 1.4)
    return a


@item("Bipolar Transistor Die")
def _():
    a = Art()
    a.rect(26, 26, 48, 48, 0, 2.6)
    a.rect(36, 36, 28, 28, 3, 1.6, 0.8)
    a.rect(44, 44, 12, 12, 6, 1.8)
    for p in ((30, 30), (70, 30), (30, 70), (70, 70)):
        a.circle(p[0], p[1], 2, 6, 1.3)
    a.ground(86)
    return a


@item("Packaged Bipolar Transistor")
def _():
    a = Art()
    pkg_to92(a, 50, 24, 28, 0)
    a.path("M40 40 L60 40", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Darlington Transistor Pair")
def _():
    a = Art()
    pkg_to92(a, 32, 28, 22, 0)
    pkg_to92(a, 68, 28, 22, 0)
    a.path("M40 58 L60 58", 6, 1.6)
    arrow(a, 44, 46, 56, 46, 3, 1.2, 0.8)
    a.ground(90)
    return a


@item("Integrated Darlington Array")
def _():
    a = Art()
    a.rect(24, 30, 52, 36, 0, 2.6)
    for i in range(7):
        a.line(30 + i * 7, 66, 30 + i * 7, 78, 0, 1.8)
        a.line(30 + i * 7, 30, 30 + i * 7, 20, 0, 1.8)
    a.circle(30, 38, 2.4, 3, 1.2, 0.8)
    a.path("M36 48 L68 48 M36 56 L68 56", 3, 1.0, 0.5)
    return a


@item("MOS Gate Oxide")
def _():
    a = Art()
    a.rect(14, 56, 72, 22, 0, 2.4)
    a.rect(34, 44, 32, 12, 0, 2.0)
    a.rect(36, 30, 28, 14, 6, 2.2)
    a.path("M14 56 L34 56 M66 56 L86 56", 6, 2.0)
    a.path("M20 66 L30 66 M70 66 L80 66", 3, 1.4, 0.8)
    a.line(50, 30, 50, 16, 0, 2.0)
    return a


@item("MOSFET Transistor Cell")
def _():
    a = Art()
    a.rect(12, 50, 76, 28, 0, 2.4)
    a.rect(16, 42, 20, 8, 0, 2.0)
    a.rect(64, 42, 20, 8, 0, 2.0)
    a.rect(38, 34, 24, 10, 6, 2.0)
    a.line(26, 42, 26, 24, 0, 2.0)
    a.line(74, 42, 74, 24, 0, 2.0)
    a.line(50, 34, 50, 20, 0, 2.0)
    a.path("M36 56 Q50 66 64 56", 3, 1.2, 0.7)
    return a


@item("Power MOSFET Package")
def _():
    a = Art()
    pkg_to220(a, 50, 12, 0)
    a.path("M40 24 L60 24 M40 30 L60 30", 3, 1.0, 0.6)
    a.path("M34 74 L66 74", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Integrated Power MOSFET Module")
def _():
    a = Art()
    a.rect(14, 24, 72, 48, 0, 2.6)
    for i in range(3):
        a.rect(20 + i * 22, 30, 18, 18, 6, 1.6)
        a.circle(29 + i * 22, 39, 2.4, 3, 1.2, 0.8)
    a.path("M20 58 L80 58", 3, 1.4, 0.7)
    for x in (24, 40, 56, 72):
        a.line(x, 72, x, 82, 0, 2.0)
    return a


@item("Silicon Logic Gate")
def _():
    a = Art()
    a.path("M30 30 L30 70 L52 70 A20 20 0 0 0 52 30 Z", 0, 2.6)
    a.line(14, 40, 30, 40, 0, 2.0)
    a.line(14, 60, 30, 60, 0, 2.0)
    a.line(72, 50, 88, 50, 0, 2.0)
    a.path("M34 40 L46 40 M34 60 L46 60", 3, 1.0, 0.5)
    a.circle(70, 50, 3, 6, 1.6)
    a.path("M36 50 L52 50", 3, 1.0, 0.4)
    return a


@item("CMOS Inverter")
def _():
    a = Art()
    a.poly([(30, 30), (30, 70), (62, 50)], 0, 2.6, None, True)
    a.circle(66, 50, 3.6, 0, 2.2)
    a.line(12, 50, 30, 50, 0, 2.0)
    a.line(70, 50, 90, 50, 0, 2.0)
    a.path("M44 20 L44 30 M44 70 L44 80", 6, 1.8)
    a.path("M36 20 L52 20 M36 84 L52 84", 3, 1.4, 0.8)
    return a


@item("CMOS NAND Gate")
def _():
    a = Art()
    a.path("M28 30 L28 70 L46 70 A20 20 0 0 0 46 30 Z", 0, 2.6)
    a.circle(70, 50, 3.6, 0, 2.2)
    a.line(12, 42, 28, 42, 0, 2.0)
    a.line(12, 58, 28, 58, 0, 2.0)
    a.line(74, 50, 90, 50, 0, 2.0)
    a.path("M40 20 L40 30 M40 70 L40 82", 6, 1.8)
    a.path("M34 50 L46 50", 3, 1.0, 0.5)
    return a


@item("Complex CMOS Logic Cell")
def _():
    a = Art()
    a.rect(16, 24, 68, 52, 0, 2.6)
    a.path("M24 36 L44 36 L44 48 L24 48 M56 36 L76 36 L76 48 L56 48", 6, 1.6)
    a.path("M24 56 L76 56 M24 66 L76 66", 3, 1.0, 0.6)
    a.circle(50, 42, 3, 3, 1.2, 0.8)
    a.ground(88)
    return a


@item("Photodiode Junction")
def _():
    a = Art()
    a.rect(24, 38, 52, 16, 0, 2.4)
    a.rect(24, 54, 52, 16, 0, 2.4)
    a.path("M30 12 L42 34 M44 10 L56 32 M58 12 L68 34", 3, 1.6, 0.9)
    a.path("M38 30 L42 36 L36 36 M52 28 L56 34 L50 34", 6, 1.2)
    a.line(24, 62, 14, 62, 0, 2.0)
    a.line(76, 62, 86, 62, 0, 2.0)
    return a


@item("Photodiode Package")
def _():
    a = Art()
    a.path("M30 66 L30 40 Q30 22 50 22 Q70 22 70 40 L70 66 Z", 0, 2.6)
    a.ellipse(50, 36, 12, 8, 3, 1.4, 0.8)
    a.line(40, 66, 40, 84, 0, 1.8)
    a.line(60, 66, 60, 84, 0, 1.8)
    a.path("M80 14 L70 24 M88 24 L78 32", 3, 1.6, 0.8)
    a.path("M38 56 L62 56", 3, 1.0, 0.5)
    a.circle(50, 46, 2.4, 6, 1.4)
    return a


@item("Phototransistor")
def _():
    a = Art()
    pkg_to92(a, 50, 28, 26, 0)
    a.path("M26 18 L36 30 M16 28 L28 40", 3, 1.6, 0.8)
    a.ellipse(50, 42, 8, 5, 3, 1.3, 0.8)
    a.ground(90)
    return a


@item("Imaging Sensor Pixel")
def _():
    a = Art()
    a.rect(20, 52, 60, 24, 0, 2.6)
    a.rect(30, 40, 40, 12, 0, 2.2)
    a.path("M30 40 Q50 22 70 40", 6, 2.0)
    a.path("M34 8 L46 26 M52 6 L56 24 M66 10 L60 26", 3, 1.6, 0.8)
    a.path("M30 64 L70 64", 3, 1.0, 0.5)
    a.line(32, 76, 32, 84, 0, 1.8)
    a.line(68, 76, 68, 84, 0, 1.8)
    return a
