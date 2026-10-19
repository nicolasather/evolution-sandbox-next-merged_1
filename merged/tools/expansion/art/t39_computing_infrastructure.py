"""Topic 39 - computing infrastructure (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("computing infrastructure")


def pcb(a, x=14, y=24, w=72, h=52, z=0, holes=True):
    a.rect(x, y, w, h, z, 2.6)
    if holes:
        for dx, dy in ((4, 4), (w - 4, 4), (4, h - 4), (w - 4, h - 4)):
            a.circle(x + dx, y + dy, 1.8, 6, 1.3)


def trace(a, pts, z=3, w=1.2, o=0.8):
    a.poly(pts, z, w, o)


def chip(a, cx, cy, w, h, legs=5, z=0, side="both"):
    a.rect(cx - w / 2, cy - h / 2, w, h, z, 2.2)
    for i in range(legs):
        x = cx - w / 2 + (i + 0.5) * w / legs
        a.line(x, cy - h / 2, x, cy - h / 2 - 5, z, 1.6)
        a.line(x, cy + h / 2, x, cy + h / 2 + 5, z, 1.6)
    a.circle(cx - w / 2 + 3, cy - h / 2 + 3, 1.2, 3, 1.0, 0.8)


def platter(a, cx, cy, r, z=0, tracks=3):
    a.circle(cx, cy, r, z, 2.6)
    a.circle(cx, cy, r * 0.22, z, 1.8)
    for k in range(tracks):
        a.circle(cx, cy, r * (0.4 + 0.18 * k), 3, 1.0, 0.55)


def conn_pins(a, x0, x1, y, count, length=6, z=0, w=1.6):
    for i in range(count):
        x = x0 + (x1 - x0) * i / max(1, count - 1)
        a.line(x, y, x, y + length, z, w)


def rack_unit(a, x, y, w=60, h=12, z=0, leds=3, label=True):
    a.rect(x, y, w, h, z, 2.2)
    for i in range(leds):
        a.circle(x + 6 + i * 6, y + h / 2, 1.3, 6, 1.2)
    a.line(x + w - 22, y + h / 2, x + w - 6, y + h / 2, 3, 1.2, 0.7)


def port_row(a, x, y, count, step=7, w=5, h=5, z=6):
    for i in range(count):
        a.rect(x + i * step, y, w, h, z, 1.4)


@item("Computer System Components")
def _():
    a = Art()
    pcb(a, 12, 20, 40, 30, 0)
    chip(a, 70, 32, 22, 16, 4, 0)
    platter(a, 70, 72, 12, 0, 2)
    a.rect(14, 62, 36, 14, 0, 2.2)
    conn_pins(a, 18, 46, 76, 6, 5, 0)
    a.ground(92)
    return a


@item("Printed Circuit Board Blank")
def _():
    a = Art()
    pcb(a, 14, 24, 72, 52, 0)
    a.rect(20, 30, 60, 40, 3, 1.0, 0.5)
    for x in (30, 40, 50, 60, 70):
        a.line(x, 30, x, 70, 3, 1.0, 0.35)
    a.ground(88)
    return a


@item("Through Hole Circuit Board")
def _():
    a = Art()
    pcb(a, 14, 24, 72, 52, 0)
    for r in range(4):
        for c in range(8):
            a.circle(24 + c * 8, 34 + r * 10, 1.4, 3, 1.0, 0.8)
    chip(a, 50, 50, 28, 12, 6, 6)
    a.ground(88)
    return a


@item("Surface Mount Circuit Board")
def _():
    a = Art()
    pcb(a, 14, 24, 72, 52, 0)
    for x, y in ((24, 34), (34, 34), (24, 62), (64, 62), (74, 34)):
        a.rect(x, y, 6, 3, 6, 1.4)
    a.rect(40, 42, 20, 16, 6, 1.8)
    trace(a, [(30, 36), (40, 36), (40, 44)])
    trace(a, [(60, 50), (74, 50), (74, 38)])
    a.ground(88)
    return a


@item("Multilayer Printed Circuit Board")
def _():
    a = Art()
    for i, y in enumerate((60, 48, 36)):
        a.path(f"M16 {y} L50 {y - 14} L84 {y} L50 {y + 14} Z", 0 if i == 2 else 3, 2.4 if i == 2 else 1.6, None if i == 2 else 0.85)
    a.line(50, 62, 50, 36, 6, 1.4)
    a.circle(50, 36, 2.4, 6, 1.4)
    a.path("M24 64 L50 76 L76 64", 3, 1.2, 0.6)
    return a


@item("Magnetic Storage Platter")
def _():
    a = Art()
    platter(a, 50, 50, 34, 0, 4)
    a.path("M50 50 L84 50", 3, 1.0, 0.4)
    a.circle(50, 50, 4, 6, 1.6)
    a.path("M30 28 Q40 22 50 22", 3, 1.2, 0.6)
    return a


@item("Hard Disk Platter Stack")
def _():
    a = Art()
    for i, y in enumerate((68, 54, 40)):
        a.ellipse(50, y, 32, 9, 0 if i == 2 else 3, 2.4 if i == 2 else 1.8)
    a.line(50, 32, 50, 76, 0, 2.2)
    a.ellipse(50, 40, 6, 2, 6, 1.4)
    a.line(18, 40, 18, 68, 3, 1.0, 0.5)
    a.line(82, 40, 82, 68, 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Hard Disk Drive")
def _():
    a = Art()
    a.rect(14, 22, 72, 56, 0, 2.6)
    platter(a, 40, 50, 20, 6, 2)
    a.path("M76 28 L58 44", 6, 2.4)
    a.circle(76, 28, 3, 6, 1.6)
    a.path("M18 74 L82 74", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Network Attached Storage Array")
def _():
    a = Art()
    a.rect(20, 16, 60, 68, 0, 2.6)
    for i in range(4):
        a.rect(26, 22 + i * 15, 38, 11, 6, 1.6)
        a.circle(72, 27.5 + i * 15, 1.8, 6, 1.4)
        a.line(30, 27.5 + i * 15, 56, 27.5 + i * 15, 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Computer Bus Connector")
def _():
    a = Art()
    a.rect(14, 38, 72, 18, 0, 2.6)
    conn_pins(a, 20, 80, 56, 10, 10, 0, 2.0)
    a.line(18, 47, 82, 47, 3, 1.0, 0.5)
    a.rect(46, 30, 8, 8, 6, 1.6)
    a.ground(88)
    return a


@item("Peripheral Expansion Bus")
def _():
    a = Art()
    a.line(10, 30, 90, 30, 0, 2.4)
    a.line(10, 36, 90, 36, 0, 2.4)
    for x in (22, 46, 70):
        a.rect(x - 8, 46, 16, 22, 0, 2.2)
        a.line(x, 36, x, 46, 6, 1.6)
        a.line(x - 4, 68, x - 4, 76, 3, 1.2, 0.7)
        a.line(x + 4, 68, x + 4, 76, 3, 1.2, 0.7)
    a.path("M10 83 L90 83", 3, 1.0, 0.5)
    return a


@item("PCI Expansion Interface")
def _():
    a = Art()
    a.rect(12, 44, 76, 14, 0, 2.6)
    a.line(46, 44, 46, 58, 6, 1.8)
    a.path("M18 52 L40 52 M52 52 L82 52", 3, 1.0, 0.6)
    a.rect(30, 20, 38, 24, 0, 2.2)
    conn_pins(a, 18, 82, 58, 14, 8, 0, 1.4)
    a.path("M36 28 L62 28 M36 36 L56 36", 3, 1.0, 0.5)
    return a


@item("PCI Express Interface")
def _():
    a = Art()
    a.rect(10, 48, 80, 12, 0, 2.6)
    a.line(32, 48, 32, 60, 6, 1.8)
    a.line(36, 48, 36, 60, 3, 1.0, 0.5)
    conn_pins(a, 14, 86, 60, 16, 9, 0, 1.2)
    a.path("M14 40 L86 40 L80 22 L20 22 Z", 0, 2.2)
    arrow(a, 30, 31, 70, 31, 3, 1.3, 0.8)
    return a


@item("Network Packet Buffer")
def _():
    a = Art()
    for i in range(5):
        a.rect(14 + i * 14, 38, 11, 24, 0 if i < 3 else 3, 2.2 if i < 3 else 1.4, None if i < 3 else 0.8)
    arrow(a, 8, 28, 40, 28, 3, 1.3, 0.8)
    arrow(a, 60, 72, 92, 72, 3, 1.3, 0.8)
    a.path("M14 50 L25 50 M28 50 L39 50", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("Network Interface Card")
def _():
    a = Art()
    a.rect(14, 28, 72, 40, 0, 2.6)
    a.rect(8, 36, 14, 14, 0, 2.2)
    chip(a, 52, 48, 20, 14, 4, 6)
    conn_pins(a, 20, 80, 68, 12, 8, 0, 1.4)
    a.path("M24 36 L44 36 M64 36 L80 36", 3, 1.0, 0.5)
    return a


@item("Ethernet Switch")
def _():
    a = Art()
    rack_unit(a, 12, 38, 76, 22, 0, 3)
    port_row(a, 20, 44, 8, 8, 5, 6, 6)
    port_row(a, 20, 52, 8, 8, 5, 4, 3)
    a.path("M16 66 L84 66", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Managed Network Switch")
def _():
    a = Art()
    rack_unit(a, 10, 34, 80, 30, 0, 4)
    port_row(a, 18, 42, 8, 8, 5, 6, 6)
    a.rect(18, 52, 22, 8, 6, 1.4)
    a.path("M22 56 L26 54 L30 58 L34 54 L38 56", 3, 1.0, 0.9)
    a.line(50, 56, 82, 56, 3, 1.4, 0.7)
    a.ground(86)
    return a


@item("Processor Package")
def _():
    a = Art()
    a.rect(24, 24, 52, 52, 0, 2.6)
    a.rect(34, 34, 32, 32, 6, 1.8)
    for i in range(6):
        a.line(30 + i * 8, 76, 30 + i * 8, 84, 0, 1.6)
        a.line(30 + i * 8, 24, 30 + i * 8, 16, 0, 1.6)
    a.circle(30, 30, 1.8, 3, 1.2, 0.8)
    a.ground(90)
    return a


@item("Single Core Processor")
def _():
    a = Art()
    a.rect(22, 22, 56, 56, 0, 2.6)
    a.rect(38, 38, 24, 24, 6, 2.0)
    a.path("M30 30 L70 30 M30 70 L70 70 M30 30 L30 70 M70 30 L70 70", 3, 1.0, 0.5)
    for i in range(5):
        a.line(30 + i * 10, 78, 30 + i * 10, 86, 0, 1.6)
    a.ground(92)
    return a


@item("Multicore Processor")
def _():
    a = Art()
    a.rect(20, 20, 60, 60, 0, 2.6)
    for r in range(2):
        for c in range(2):
            a.rect(28 + c * 24, 28 + r * 24, 20, 20, 6, 1.8)
    a.path("M28 52 L72 52 M52 28 L52 72", 3, 1.0, 0.5)
    for i in range(6):
        a.line(26 + i * 10, 80, 26 + i * 10, 88, 0, 1.6)
    return a


@item("System On Chip Package")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2.6)
    a.rect(24, 24, 28, 22, 6, 1.8)
    a.rect(56, 24, 20, 22, 6, 1.6)
    a.rect(24, 52, 22, 24, 6, 1.6)
    a.circle(62, 64, 10, 6, 1.6)
    a.path("M24 50 L76 50", 3, 1.0, 0.5)
    for i in range(7):
        a.circle(24 + i * 8.6, 88, 1.8, 0, 1.3)
    return a


@item("Computer Memory Cell")
def _():
    a = Art()
    a.rect(30, 30, 40, 40, 0, 2.6)
    a.circle(50, 50, 8, 6, 1.8)
    a.line(14, 40, 30, 40, 0, 2.2)
    a.line(14, 60, 30, 60, 0, 2.2)
    a.line(70, 50, 86, 50, 0, 2.2)
    a.path("M40 40 L60 60 M60 40 L40 60", 3, 1.0, 0.5)
    return a


@item("Memory Integrated Circuit")
def _():
    a = Art()
    chip(a, 50, 50, 48, 28, 8, 0)
    for r in range(2):
        for c in range(4):
            a.rect(32 + c * 9, 40 + r * 11, 7, 8, 3, 1.2, 0.75)
    a.ground(90)
    return a


@item("Memory Module")
def _():
    a = Art()
    a.rect(10, 34, 80, 28, 0, 2.6)
    for i in range(4):
        a.rect(18 + i * 16, 40, 12, 16, 6, 1.6)
    conn_pins(a, 14, 86, 62, 18, 8, 0, 1.2)
    a.rect(46, 62, 6, 4, 3, 1.0, 0.7)
    return a


@item("ECC Server Memory Module")
def _():
    a = Art()
    a.rect(10, 30, 80, 32, 0, 2.6)
    for i in range(5):
        a.rect(16 + i * 12, 36, 9, 14, 6, 1.6)
    a.rect(78, 36, 8, 14, 6, 2.2)
    a.path("M16 56 L72 56", 3, 1.0, 0.5)
    a.path("M76 56 L86 56", 3, 1.4, 0.8)
    conn_pins(a, 14, 86, 62, 18, 8, 0, 1.2)
    a.path("M10 30 L10 22 L90 22 L90 30", 3, 1.0, 0.5)
    return a
