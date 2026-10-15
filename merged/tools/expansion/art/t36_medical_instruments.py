"""Topic 36 - medical instruments (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .registry import item, topic

topic("medical instruments")


def tube_ear(a, x, y, z=6):
    a.circle(x, y, 2.4, z, 1.6)


def chest(a, cx, cy, r=9, z=0):
    a.circle(cx, cy, r, z, 2.4)
    a.circle(cx, cy, r * 0.62, 3, 1.1, 0.6)


def scale_ticks(a, x, y0, y1, cnt=6):
    for i in range(cnt):
        yy = y0 + (y1 - y0) * i / (cnt - 1)
        a.line(x, yy, x + (4 if i % 2 == 0 else 2.4), yy, 3, 1.0, 0.7)


def roll(a, cx, cy, rx, ry, z=0, w=2.4):
    a.ellipse(cx, cy, rx, ry, z, w)
    a.ellipse(cx, cy, rx * 0.32, ry * 0.32, 3, 1.1, 0.6)


def forceps(a, ang=0.0, z=0, locking=False, tip=1.0):
    a.path("M50 14 L46 56 L48 82 M50 14 L54 56 L52 82", z, 2.4)
    a.path("M50 14 L50 8", z, 2.4)


def syringe(a, x0=16, x1=72, cy=50, h=12, z=0):
    a.rect(x0, cy - h / 2, x1 - x0, h, z, 2.4)
    a.line(x0 - 8, cy, x0, cy, z, 2.4)
    a.line(x0 - 8, cy - 7, x0 - 8, cy + 7, z, 2.4)
    a.line(x1, cy, x1 + 12, cy, z, 2.4)
    a.line(x1 + 12, cy - 2, x1 + 20, cy, z, 1.6)
    for i in range(1, 7):
        a.line(x0 + i * (x1 - x0) / 7, cy - h / 2, x0 + i * (x1 - x0) / 7, cy - h / 2 + (4 if i % 2 == 0 else 2.4), 3, 1.0, 0.7)


def sink(a, x=14, y=50, w=72, d=20):
    a.path(f"M{x} {y} L{x + w} {y} L{x + w - 8} {y + d} L{x + 8} {y + d} Z", 0, 2.4)
    a.ellipse(x + w / 2, y, w / 2, 4, 3, 1.1, 0.6)


def tap(a, x, y, z=0):
    a.path(f"M{x} {y + 14} L{x} {y} Q{x} {y - 8} {x + 10} {y - 8} L{x + 18} {y - 8} L{x + 18} {y - 2}", z, 2.4)


@item("Clinical Examination Toolkit")
def _():
    a = Art()
    chest(a, 24, 34, 10, 0)
    a.path("M24 44 Q24 60 40 60 Q56 60 56 44", 0, 2.2)
    a.rect(60, 22, 6, 30, 0, 2.2)
    a.circle(63, 58, 5, 0, 2.0)
    a.rect(20, 70, 52, 10, 0, 2.2)
    a.path("M28 70 L28 76 M38 70 L38 76 M48 70 L48 76", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Wooden Stethoscope")
def _():
    a = Art()
    a.path("M50 80 L50 40 L38 22 L62 22 L50 40", 0, 2.6)
    a.ellipse(50, 22, 14, 4, 0, 2.2)
    a.ellipse(50, 22, 5, 1.5, 3, 1.1, 0.6)
    a.path("M40 60 L60 60 M42 70 L58 70", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Flexible Tube Stethoscope")
def _():
    a = Art()
    a.path("M30 16 Q30 40 50 48 Q70 40 70 16", 0, 2.4)
    tube_ear(a, 30, 14)
    tube_ear(a, 70, 14)
    a.path("M50 48 Q50 64 50 66", 0, 2.4)
    chest(a, 50, 74, 10, 0)
    a.path("M36 30 Q40 42 50 46", 3, 1.0, 0.5)
    return a


@item("Dual Head Stethoscope")
def _():
    a = Art()
    a.path("M28 14 Q28 40 50 48 Q72 40 72 14", 0, 2.4)
    tube_ear(a, 28, 12)
    tube_ear(a, 72, 12)
    a.line(50, 48, 50, 62, 0, 2.4)
    a.circle(40, 74, 9, 0, 2.4)
    a.ellipse(62, 74, 7, 9, 0, 2.4)
    a.circle(40, 74, 4, 3, 1.1, 0.6)
    a.path("M46 66 L56 66", 3, 1.0, 0.6)
    return a


@item("Electronic Stethoscope")
def _():
    a = Art()
    a.path("M28 14 Q28 40 50 48 Q72 40 72 14", 0, 2.4)
    tube_ear(a, 28, 12)
    tube_ear(a, 72, 12)
    a.line(50, 48, 50, 58, 0, 2.4)
    chest(a, 50, 70, 11, 0)
    a.rect(66, 58, 18, 12, 0, 2.0)
    a.path("M69 64 L72 60 L75 68 L78 62 L81 64", 6, 1.2, 0.9)
    return a


@item("Mercury Thermometer Tube")
def _():
    a = Art()
    a.rect(14, 44, 64, 12, 0, 2.4, None, 6)
    a.circle(84, 50, 7, 0, 2.4)
    a.line(18, 50, 76, 50, 3, 1.0, 0.5)
    for x in range(24, 70, 6):
        a.line(x, 44, x, 47, 3, 1.0, 0.7)
    a.ground(76)
    return a


@item("Clinical Mercury Thermometer")
def _():
    a = Art()
    a.rect(12, 42, 64, 16, 0, 2.4, None, 6)
    a.circle(84, 50, 8, 0, 2.4)
    a.circle(84, 50, 4, 6, 1.6)
    a.line(16, 50, 80, 50, 6, 2.0)
    for x in range(22, 70, 5):
        a.line(x, 42, x, 46 if (x - 22) % 10 == 0 else 44.5, 3, 1.0, 0.7)
    a.path("M54 42 L54 58", 3, 1.0, 0.5)
    a.ground(76)
    return a


@item("Digital Thermometer")
def _():
    a = Art()
    a.path("M14 44 L70 40 L70 60 L14 56 Z", 0, 2.6)
    a.path("M70 44 L90 50 L70 56", 0, 2.4)
    a.rect(24, 46, 22, 8, 6, 1.6)
    a.path("M26 50 L30 48 L34 52 L38 48 L42 50", 3, 1.2, 0.9)
    a.circle(56, 50, 2.4, 6, 1.4)
    a.ground(76)
    return a


@item("Infrared Tympanic Thermometer")
def _():
    a = Art()
    a.path("M26 30 L58 22 L66 44 L40 52 Z", 0, 2.6)
    a.path("M58 22 L74 16 L78 24 L66 30", 0, 2.4)
    a.path("M40 52 L36 78 L50 80 L54 48", 0, 2.4)
    a.rect(32, 32, 16, 8, 6, 1.6)
    a.path("M80 16 L90 12 M82 22 L92 20", 3, 1.4, 0.8)
    a.circle(44, 66, 2.4, 6, 1.4)
    return a


@item("Bandage Roll")
def _():
    a = Art()
    roll(a, 36, 50, 18, 18, 0)
    a.path("M54 50 L86 50 L86 62 L54 62", 0, 2.4)
    a.path("M18 50 L54 50", 3, 1.0, 0.4)
    a.path("M60 56 L84 56", 3, 1.0, 0.5)
    for x in (62, 72, 82):
        a.line(x, 50, x, 62, 3, 1.0, 0.4)
    a.ground(76)
    return a


@item("Wound Dressing Pad")
def _():
    a = Art()
    a.rect(18, 28, 64, 44, 0, 2.6, None, 4)
    a.rect(30, 38, 40, 24, 3, 1.6, 0.8)
    a.path("M34 44 L66 44 M34 50 L66 50 M34 56 L66 56", 3, 1.0, 0.5)
    a.path("M18 28 L12 22 M82 72 L88 78", 3, 1.2, 0.6)
    a.ground(86)
    return a


@item("Sterile Gauze Dressing")
def _():
    a = Art()
    a.rect(24, 24, 52, 52, 0, 2.6)
    for i in range(1, 7):
        a.line(24 + i * 7.4, 24, 24 + i * 7.4, 76, 3, 1.0, 0.55)
        a.line(24, 24 + i * 7.4, 76, 24 + i * 7.4, 3, 1.0, 0.55)
    sparkle(a, 70, 30, 3.4, 6, 0.9)
    a.ground(88)
    return a


@item("Adhesive Sterile Dressing")
def _():
    a = Art()
    a.rect(12, 34, 76, 32, 0, 2.6, None, 6)
    a.rect(34, 40, 32, 20, 6, 1.8)
    a.path("M38 46 L62 46 M38 52 L62 52", 3, 1.0, 0.5)
    a.dots([(18, 40), (18, 50), (18, 60), (82, 40), (82, 50), (82, 60), (26, 40), (26, 60)], 0.9, 3, 0.7)
    a.ground(80)
    return a


@item("Surgical Forceps Blank")
def _():
    a = Art()
    a.path("M20 78 L46 18 L52 18 L30 80 Z", 0, 2.4)
    a.path("M80 78 L54 18 L48 18 L70 80 Z", 0, 2.4)
    a.path("M46 18 L54 18", 3, 1.4, 0.7)
    a.path("M34 66 L42 66 M58 66 L66 66", 3, 1.2, 0.7)
    a.circle(50, 44, 2.4, 6, 1.6)
    a.ground(90)
    return a


@item("Nonlocking Forceps")
def _():
    a = Art()
    a.path("M50 14 Q44 40 28 78", 0, 2.6)
    a.path("M50 14 Q56 40 72 78", 0, 2.6)
    a.path("M46 30 L54 30", 3, 1.2, 0.7)
    a.path("M34 62 L40 62 M60 62 L66 62", 3, 1.2, 0.7)
    a.path("M26 78 L30 78 M70 78 L74 78", 0, 2.6)
    a.ground(90)
    return a


@item("Locking Hemostat")
def _():
    a = Art()
    a.path("M26 82 Q24 66 36 60 L58 24", 0, 2.4)
    a.path("M74 82 Q76 66 64 60 L42 24", 0, 2.4)
    a.circle(30, 78, 6, 0, 2.2)
    a.circle(70, 78, 6, 0, 2.2)
    a.circle(50, 56, 2.4, 6, 1.6)
    a.path("M44 66 L56 66 M46 70 L54 70", 3, 1.2, 0.8)
    a.path("M40 28 L44 32 M60 28 L56 32", 3, 1.0, 0.7)
    return a


@item("Micro Surgical Forceps")
def _():
    a = Art()
    a.path("M30 84 L48 22 L52 22 L38 84", 0, 2.2)
    a.path("M70 84 L52 22 L48 22 L62 84", 0, 2.2)
    a.line(49, 22, 49, 10, 0, 1.4)
    a.line(51, 22, 51, 10, 0, 1.4)
    a.path("M40 50 L60 50", 3, 1.0, 0.5)
    sparkle(a, 50, 8, 3, 6, 0.9)
    return a


@item("Hand Washing Station")
def _():
    a = Art()
    sink(a, 16, 52, 68, 22)
    tap(a, 40, 40, 0)
    a.path("M58 40 L58 32 L66 32", 0, 2.0)
    a.rect(60, 18, 14, 14, 0, 2.0)
    droplet(a, 58, 50, 3, 3, 1.1, 0.8)
    a.rect(24, 74, 52, 10, 0, 2.2)
    a.ground(92)
    return a


@item("Clinical Scrub Sink")
def _():
    a = Art()
    a.rect(12, 46, 76, 32, 0, 2.6)
    a.path("M18 54 L82 54 L76 70 L24 70 Z", 3, 1.4, 0.8)
    tap(a, 36, 36, 0)
    tap(a, 62, 36, 0)
    a.line(12, 36, 88, 36, 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Hands Free Scrub Sink")
def _():
    a = Art()
    a.rect(14, 48, 72, 30, 0, 2.6)
    a.path("M20 56 L80 56 L74 70 L26 70 Z", 3, 1.4, 0.8)
    tap(a, 44, 38, 0)
    a.path("M40 78 L40 88 M30 88 L50 88", 0, 2.4)
    a.rect(60, 84, 14, 6, 6, 1.8)
    arrow(a, 56, 88, 50, 88, 3, 1.2, 0.8)
    return a


@item("Sensor Operated Scrub Sink")
def _():
    a = Art()
    a.rect(14, 50, 72, 30, 0, 2.6)
    a.path("M20 58 L80 58 L74 72 L26 72 Z", 3, 1.4, 0.8)
    tap(a, 46, 40, 0)
    a.circle(40, 34, 2.4, 6, 1.6)
    a.path("M30 28 Q40 20 50 28 M24 24 Q40 12 56 24", 3, 1.2, 0.7)
    droplet(a, 64, 46, 3, 3, 1.1, 0.8)
    a.ground(88)
    return a


@item("Glass Medicine Syringe")
def _():
    a = Art()
    syringe(a, 20, 66, 50, 14, 0)
    a.rect(20, 46, 20, 8, 6, 1.4, 0.8)
    a.ground(76)
    return a


@item("Reusable Glass Syringe")
def _():
    a = Art()
    syringe(a, 22, 64, 48, 14, 0)
    a.circle(18, 48, 3, 6, 1.6)
    a.path("M6 48 L12 48 M12 44 L12 52", 6, 1.8)
    a.path("M50 66 L60 76 L70 66", 3, 1.2, 0.7)
    a.ground(80)
    return a


@item("Disposable Plastic Syringe")
def _():
    a = Art()
    syringe(a, 24, 68, 52, 12, 0)
    a.path("M30 52 L62 52", 6, 1.4, 0.8)
    a.path("M12 40 L12 64", 3, 1.0, 0.4)
    droplet(a, 92, 62, 3, 3, 1.1, 0.8)
    return a


@item("Safety Retractable Syringe")
def _():
    a = Art()
    syringe(a, 20, 62, 46, 14, 0)
    a.path("M62 46 L74 46", 6, 1.6)
    a.circle(16, 46, 3, 6, 1.6)
    a.rect(30, 40, 20, 4, 6, 1.4)
    a.path("M70 56 L40 56", 3, 1.4, 0.8)
    arrow(a, 70, 60, 46, 60, 3, 1.3, 0.8)
    a.ground(76)
    return a
