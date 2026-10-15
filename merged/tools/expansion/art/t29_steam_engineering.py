"""Topic 29 - steam engineering (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, gear_d, n
from .kit import droplet, flame, sparkle
from .registry import item, topic

topic("steam engineering")


def puff(a, x, y, z=3, o=0.6):
    h = min(24, y - 6)
    if h < 8:
        return
    k = h / 24
    a.path(f"M{x} {y} Q{x + 4} {n(y - 6 * k)} {x} {n(y - 12 * k)} Q{x - 4} {n(y - 18 * k)} {x} {n(y - h)}", z, 1.3, o)


def boiler_shell(a, x0=14, x1=70, cy=48, r=18, z=0, w=2.6):
    a.line(x0, cy - r, x1, cy - r, z, w)
    a.line(x0, cy + r, x1, cy + r, z, w)
    a.path(f"M{x0} {cy - r} Q{x0 - 8} {cy} {x0} {cy + r}", z, w)
    a.ellipse(x1, cy, 6, r, z, w)
    for x in range(x0 + 10, x1 - 4, 14):
        a.line(x, cy - r, x, cy + r, 3, 1.0, 0.45)


def cylinder(a, x0, x1, cy, r=10, z=0, w=2.4):
    a.line(x0, cy - r, x1, cy - r, z, w)
    a.line(x0, cy + r, x1, cy + r, z, w)
    a.line(x0, cy - r, x0, cy + r, z, w)
    a.line(x1, cy - r, x1, cy + r, z, w)


def piston_rod(a, x0, x1, cy, z=6, w=2.2):
    a.line(x0, cy, x1, cy, z, w)


def flywheel(a, cx, cy, r=20, spokes=6, z=0, w=2.4):
    a.circle(cx, cy, r, z, w)
    a.circle(cx, cy, r - 4, z, 1.2, 0.7)
    a.circle(cx, cy, 3, 6, 1.6)
    for k in range(spokes):
        t = 2 * math.pi * k / spokes
        a.line(cx + 3 * math.cos(t), cy + 3 * math.sin(t), cx + (r - 4) * math.cos(t), cy + (r - 4) * math.sin(t), 3, 1.4)


def gauge(a, cx, cy, r=7, z=6):
    a.circle(cx, cy, r, z, 1.6)
    a.line(cx, cy, cx + r * 0.6, cy - r * 0.5, z, 1.4)


@item("Pressure Vessel Parts")
def _():
    a = Art()
    a.ellipse(34, 42, 18, 6, 0, 2.4)
    a.path("M16 42 L16 66 Q34 76 52 66 L52 42", 0, 2.4)
    a.path("M60 38 L86 38 L86 66 L60 66 Z", 0, 2.2)
    gauge(a, 73, 52, 7)
    a.circle(24, 54, 1.6, 6, 1.2)
    a.circle(44, 54, 1.6, 6, 1.2)
    a.path("M58 74 L88 74", 3, 1.0, 0.45)
    a.ground(88)
    return a


@item("Boiler Firebox")
def _():
    a = Art()
    a.rect(20, 28, 50, 44, 0, 2.6)
    a.rect(28, 50, 34, 16, 3, 1.4, 0.7)
    flame(a, 40, 64, 9, 6, 1.6)
    flame(a, 52, 64, 9, 6, 1.6)
    for x in (30, 38, 46, 54, 62):
        a.line(x, 66, x, 72, 3, 1.4, 0.8)
    a.path("M70 40 L84 40 L84 28 L92 28", 0, 2.0)
    puff(a, 88, 28)
    a.ground(86)
    return a


@item("Shell Steam Boiler")
def _():
    a = Art()
    boiler_shell(a, 14, 72, 48, 18, 0, 2.6)
    a.rect(66, 14, 8, 14, 0, 2.2)
    puff(a, 70, 12)
    a.rect(20, 66, 44, 12, 0, 2.2)
    flame(a, 34, 76, 6, 6, 1.4)
    flame(a, 50, 76, 6, 6, 1.4)
    gauge(a, 40, 28, 5)
    a.ground(90)
    return a


@item("Water Tube Boiler")
def _():
    a = Art()
    a.ellipse(50, 22, 28, 8, 0, 2.4)
    a.path("M22 22 L22 32 M78 22 L78 32", 0, 2.4)
    a.ellipse(50, 74, 28, 8, 0, 2.4)
    for x in range(28, 76, 8):
        a.line(x, 28, x, 70, 3, 1.6)
    flame(a, 40, 54, 8, 6, 1.4)
    flame(a, 60, 54, 8, 6, 1.4)
    a.path("M78 22 L90 22 L90 10", 0, 2.0)
    puff(a, 90, 8)
    a.ground(90)
    return a


@item("Superheated Steam Boiler")
def _():
    a = Art()
    boiler_shell(a, 12, 62, 48, 16, 0, 2.6)
    a.path("M62 36 L80 36 L80 58 L52 58", 6, 2.0)
    a.path("M64 40 L76 40 L76 54 L56 54", 6, 1.4, 0.7)
    for x in (68, 74):
        a.path(f"M{x} 30 Q{x + 3} 22 {x} 14", 3, 1.4, 0.7)
    flame(a, 30, 72, 7, 6, 1.4)
    flame(a, 44, 72, 7, 6, 1.4)
    a.ground(90)
    return a


@item("Steam Piston")
def _():
    a = Art()
    a.rect(34, 40, 32, 32, 0, 2.6)
    a.line(50, 12, 50, 40, 6, 2.4)
    a.rect(38, 44, 24, 8, 6, 2.4)
    a.line(38, 48, 62, 48, 3, 1.0, 0.6)
    puff(a, 74, 36)
    a.path("M26 80 L74 80", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Single Acting Steam Cylinder")
def _():
    a = Art()
    cylinder(a, 20, 70, 48, 14, 0, 2.6)
    a.rect(26, 38, 10, 20, 6, 2.2)
    a.line(36, 48, 90, 48, 6, 2.4)
    a.line(76, 48, 76, 48, 6, 1.0)
    puff(a, 30, 32)
    a.path("M28 26 L28 34", 3, 1.4, 0.7)
    arrow(a, 54, 64, 76, 64, 3, 1.4, 0.7, 3)
    a.ground(86)
    return a


@item("Double Acting Steam Engine")
def _():
    a = Art()
    cylinder(a, 14, 56, 40, 12, 0, 2.6)
    a.rect(32, 30, 8, 20, 6, 2.2)
    a.line(40, 40, 78, 40, 6, 2.2)
    a.path("M20 28 L20 18 L50 18 L50 28", 0, 1.8)
    puff(a, 22, 16)
    puff(a, 48, 16)
    flywheel(a, 78, 60, 16, 6, 0)
    a.line(78, 40, 78, 60, 3, 1.4, 0.8)
    a.ground(90)
    return a


@item("Compound Steam Engine")
def _():
    a = Art()
    cylinder(a, 14, 36, 36, 8, 0, 2.4)
    cylinder(a, 14, 44, 58, 12, 0, 2.4)
    a.line(36, 36, 62, 36, 6, 2.0)
    a.line(44, 58, 62, 58, 6, 2.0)
    a.line(62, 36, 62, 58, 6, 2.0)
    flywheel(a, 76, 48, 14, 6, 0, 2.2)
    a.path("M14 28 L14 20 L36 20 L36 28", 3, 1.4, 0.8)
    a.path("M24 46 L24 50", 3, 1.4, 0.6)
    a.ground(86)
    return a


@item("Piston Connecting Rod")
def _():
    a = Art()
    a.rect(14, 38, 22, 20, 0, 2.4)
    a.line(36, 48, 66, 48, 0, 2.6)
    a.circle(74, 48, 9, 0, 2.4)
    a.circle(74, 48, 3, 6, 1.6)
    a.line(14, 48, 8, 48, 6, 2.2)
    a.circle(26, 48, 3, 6, 1.4)
    a.path("M40 54 L64 54", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Crank And Rod Drive")
def _():
    a = Art()
    a.circle(66, 48, 16, 0, 2.4)
    a.circle(66, 48, 3, 6, 1.6)
    a.circle(76, 40, 3, 6, 1.6)
    a.line(66, 48, 76, 40, 6, 2.0)
    a.line(76, 40, 22, 56, 6, 2.2)
    a.rect(12, 50, 14, 12, 0, 2.2)
    a.line(2, 56, 12, 56, 6, 2.0)
    a.ground(86)
    return a


@item("Flywheel Crank Drive")
def _():
    a = Art()
    flywheel(a, 62, 46, 24, 6, 0, 2.6)
    a.line(62, 46, 76, 36, 6, 2.0)
    a.circle(76, 36, 3, 6, 1.6)
    a.line(76, 36, 20, 52, 6, 2.2)
    a.rect(10, 46, 12, 12, 0, 2.2)
    a.path("M40 74 L84 74", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Rotary Steam Engine")
def _():
    a = Art()
    a.circle(50, 48, 28, 0, 2.6)
    a.circle(50, 48, 8, 6, 1.8)
    a.path("M50 48 L58 30 L74 38 Z", 6, 1.6)
    a.path("M50 48 L42 66 L26 58 Z", 6, 1.6, 0.8)
    a.path("M78 24 L88 14 L88 8", 0, 2.0)
    puff(a, 88, 8)
    a.path("M28 78 L72 78", 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Slide Valve Blank")
def _():
    a = Art()
    a.rect(22, 38, 46, 22, 0, 2.6)
    a.rect(32, 44, 26, 10, 3, 1.4, 0.7)
    a.path("M68 44 L84 44 L84 54 L68 54", 0, 2.0)
    a.line(40, 38, 40, 60, 3, 1.0, 0.5)
    a.line(50, 38, 50, 60, 3, 1.0, 0.5)
    a.path("M20 68 L70 68", 3, 1.0, 0.4)
    a.ground(84)
    return a


@item("Slide Valve Gear")
def _():
    a = Art()
    a.path("M14 30 L50 30 L50 48 L14 48 Z", 0, 2.4)
    a.rect(22, 34, 20, 10, 6, 2.0)
    a.line(50, 40, 74, 40, 6, 2.0)
    a.circle(80, 50, 10, 0, 2.2)
    a.circle(80, 50, 3, 6, 1.4)
    a.line(74, 40, 82, 44, 6, 1.8)
    a.line(14, 60, 14, 76, 0, 2.0)
    a.line(14, 76, 56, 76, 3, 1.4, 0.7)
    puff(a, 30, 28)
    a.ground(88)
    return a


@item("Stephenson Valve Gear")
def _():
    a = Art()
    a.circle(24, 48, 10, 0, 2.2)
    a.circle(24, 48, 3, 6, 1.4)
    a.path("M34 40 Q56 30 70 38 M34 56 Q56 66 70 58", 0, 2.0)
    a.path("M34 40 Q50 48 34 56", 3, 1.4, 0.7)
    a.line(56, 48, 56, 22, 6, 2.0)
    a.line(56, 22, 88, 22, 6, 2.0)
    a.line(16, 70, 88, 70, 3, 1.2, 0.5)
    a.circle(52, 46, 3, 6, 1.4)
    a.ground(88)
    return a


@item("Walschaerts Valve Gear")
def _():
    a = Art()
    a.circle(36, 56, 18, 0, 2.4)
    a.circle(36, 56, 3, 6, 1.4)
    a.line(36, 56, 50, 48, 6, 2.0)
    a.line(50, 48, 76, 28, 6, 2.0)
    a.path("M20 36 L60 28 L84 28", 0, 2.0)
    a.line(60, 28, 60, 44, 6, 1.8)
    a.rect(76, 22, 12, 12, 0, 2.2)
    a.path("M14 78 L88 78", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Steam Condenser Coil")
def _():
    a = Art()
    for k in range(3):
        y = 26 + k * 14
        a.path(f"M20 {y} L74 {y} Q84 {y} 84 {y + 7} Q84 {y + 14} 74 {y + 14}", 0, 2.2)
    a.line(20, 68, 74, 68, 0, 2.2)
    a.path("M20 26 L12 26 L12 12", 0, 2.0)
    puff(a, 12, 10)
    droplet(a, 20, 76, 3.2)
    a.path("M20 68 L20 74", 3, 1.4, 0.7)
    a.ground(88)
    return a


@item("Surface Steam Condenser")
def _():
    a = Art()
    a.rect(20, 30, 60, 40, 0, 2.6)
    for y in (38, 46, 54, 62):
        a.line(24, y, 76, y, 3, 1.6)
    a.path("M40 30 L40 18 L60 18 L60 30", 0, 2.0)
    puff(a, 50, 16)
    a.line(14, 56, 20, 56, 6, 2.4)
    a.line(80, 44, 88, 44, 6, 2.4)
    arrow(a, 4, 56, 14, 56, 3, 1.3, 0.7, 3)
    droplet(a, 50, 78, 3.2)
    a.ground(90)
    return a


@item("Jet Condenser Assembly")
def _():
    a = Art()
    a.path("M36 20 L64 20 L68 70 L32 70 Z", 0, 2.6)
    a.path("M20 30 L36 30 M64 40 L80 40", 0, 2.2)
    for k in range(5):
        a.line(42 + k * 4, 40, 40 + k * 5, 50, 6, 1.2, 0.8)
    droplet(a, 46, 36, 2.4)
    puff(a, 14, 28)
    a.line(50, 70, 50, 80, 0, 2.2)
    a.path("M36 80 L64 80", 0, 2.2)
    a.ground(90)
    return a


@item("Vacuum Condenser System")
def _():
    a = Art()
    a.rect(14, 26, 38, 40, 0, 2.6)
    for y in (36, 46, 56):
        a.line(18, y, 48, y, 3, 1.5)
    a.circle(76, 40, 12, 0, 2.4)
    a.circle(76, 40, 3, 6, 1.4)
    a.line(76, 40, 82, 34, 6, 1.6)
    a.path("M52 40 L64 40", 0, 2.0)
    a.path("M33 66 L33 76 L76 76 L76 52", 0, 2.0)
    gauge(a, 76, 20, 6)
    a.ground(88)
    return a


@item("Steam Whistle Valve")
def _():
    a = Art()
    a.rect(38, 44, 24, 22, 0, 2.6)
    a.circle(50, 55, 5, 6, 1.6)
    a.line(50, 44, 50, 26, 0, 2.4)
    a.line(40, 26, 60, 26, 6, 2.6)
    a.line(62, 52, 82, 40, 6, 2.6)
    a.circle(84, 38, 3, 6, 1.4)
    a.path("M30 74 L70 74", 3, 1.0, 0.4)
    puff(a, 50, 24, 3, 0.5)
    a.ground(86)
    return a


@item("Steam Whistle")
def _():
    a = Art()
    a.path("M40 74 L40 38 Q40 30 50 30 Q60 30 60 38 L60 74", 0, 2.6)
    a.rect(34, 74, 32, 6, 0, 2.2)
    a.line(40, 46, 60, 46, 3, 1.2, 0.7)
    a.path("M72 34 Q82 38 84 48 M76 26 Q92 32 94 48", 3, 1.4, 0.7)
    puff(a, 50, 28)
    a.line(50, 80, 50, 86, 0, 2.2)
    a.ground(92)
    return a


@item("Multi Tone Steam Whistle")
def _():
    a = Art()
    for i, (x, h) in enumerate(((22, 40), (40, 30), (58, 36), (76, 24))):
        a.path(f"M{x - 6} 74 L{x - 6} {74 - h} Q{x - 6} {70 - h} {x} {70 - h} Q{x + 6} {70 - h} {x + 6} {74 - h} L{x + 6} 74", 0, 2.2)
        a.line(x - 6, 62, x + 6, 62, 3, 1.0, 0.6)
    a.rect(12, 74, 74, 6, 0, 2.2)
    puff(a, 40, 36, 3, 0.55)
    puff(a, 76, 44, 3, 0.55)
    a.ground(90)
    return a


@item("Air Operated Warning Horn")
def _():
    a = Art()
    a.path("M20 40 L52 34 L84 22 L84 66 L52 54 L20 48 Z", 0, 2.6)
    a.rect(10, 40, 12, 8, 0, 2.2)
    a.line(52, 34, 52, 54, 3, 1.0, 0.5)
    a.path("M90 30 Q96 44 90 58", 3, 1.4, 0.7)
    a.line(40, 54, 40, 70, 6, 2.2)
    a.circle(40, 74, 4, 6, 1.6)
    a.ground(88)
    return a
