"""Topic 35 - photography technology (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("photography technology")


def lens(a, cx, cy, r, z=0, rings=2):
    a.circle(cx, cy, r, z, 2.6)
    for k in range(1, rings + 1):
        a.circle(cx, cy, r * (1 - k * 0.25), 3 if k > 1 else z, 1.4 if k == 1 else 1.0, 1 if k == 1 else 0.6)
    a.path(f"M{n(cx - r * 0.35)} {n(cy - r * 0.35)} Q{n(cx - r * 0.1)} {n(cy - r * 0.55)} {n(cx + r * 0.2)} {n(cy - r * 0.4)}", 6, 1.2, 0.7)


def plate(a, x, y, w, h, z=0, corner=True):
    a.rect(x, y, w, h, z, 2.4)
    a.rect(x + 4, y + 4, w - 8, h - 8, 3, 1.0, 0.55)


def film_strip(a, y, x0=8, x1=92, h=22, frames=3):
    a.rect(x0, y, x1 - x0, h, 0, 2.4)
    fw = (x1 - x0 - 8) / frames
    for i in range(frames):
        a.rect(x0 + 4 + i * fw + 2, y + 5, fw - 4, h - 10, 3, 1.2, 0.8)
    for i in range(int((x1 - x0) / 6)):
        a.line(x0 + 3 + i * 6, y + 1.5, x0 + 3 + i * 6, y + 3.5, 3, 1.2, 0.7)
        a.line(x0 + 3 + i * 6, y + h - 3.5, x0 + 3 + i * 6, y + h - 1.5, 3, 1.2, 0.7)


def bellows(a, x0, x1, cy, h0, h1, folds=6):
    a.line(x0, cy - h0 / 2, x1, cy - h1 / 2, 0, 2.4)
    a.line(x0, cy + h0 / 2, x1, cy + h1 / 2, 0, 2.4)
    for i in range(1, folds):
        t = i / folds
        x = x0 + (x1 - x0) * t
        h = h0 + (h1 - h0) * t
        a.line(x, cy - h / 2, x, cy + h / 2, 3, 1.2, 0.75)


def tray(a, x=16, y=48, w=68, h=22, z=0):
    a.path(f"M{x} {y} L{x + w} {y} L{x + w - 6} {y + h} L{x + 6} {y + h} Z", z, 2.4)
    a.ellipse(x + w / 2, y + 6, w / 2 - 6, 3, 3, 1.0, 0.6)


def cam_body(a, x, y, w, h, z=0):
    a.rect(x, y, w, h, z, 2.6, None, 3)
    a.rect(x + w * 0.62, y - 5, w * 0.2, 5, z, 2.0)


def blade_set(a, cx, cy, r, count=6, z=0, w=2.0, rot=0):
    for k in range(count):
        t = 2 * math.pi * k / count + rot
        t2 = t + 2 * math.pi / count * 0.9
        a.path(f"M{n(cx + r * math.cos(t))} {n(cy + r * math.sin(t))} L{n(cx + r * 0.3 * math.cos(t2))} {n(cy + r * 0.3 * math.sin(t2))}", z, w)


@item("Photographic Materials")
def _():
    a = Art()
    a.rect(14, 20, 30, 24, 0, 2.4)
    a.rect(18, 24, 22, 16, 3, 1.0, 0.55)
    tray(a, 52, 24, 36, 16, 0)
    a.circle(26, 66, 9, 0, 2.2)
    a.circle(26, 66, 3, 3, 1.1, 0.6)
    a.path("M46 58 L86 58 L86 76 L46 76 Z", 0, 2.2)
    a.path("M50 66 L82 66", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Coated Glass Plate")
def _():
    a = Art()
    plate(a, 24, 20, 52, 60, 0)
    a.path("M30 26 L44 26 M30 32 L38 32", 6, 1.2, 0.8)
    a.path("M30 74 L70 74", 3, 1.0, 0.5)
    a.path("M70 26 L60 40", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Silver Gelatin Plate")
def _():
    a = Art()
    plate(a, 24, 20, 52, 60, 0)
    a.dots([(36, 36), (44, 44), (54, 40), (62, 52), (40, 58), (52, 64), (64, 34), (34, 48)], 1.2, 3, 0.8)
    a.path("M28 30 L72 74", 3, 1.0, 0.4)
    sparkle(a, 62, 30, 3, 6, 0.9)
    a.ground(90)
    return a


@item("Dry Plate Negative")
def _():
    a = Art()
    plate(a, 22, 22, 56, 56, 0)
    a.circle(50, 46, 10, 6, 1.8)
    a.path("M32 66 Q50 54 68 66", 6, 1.6)
    a.path("M30 30 L36 30 M64 70 L70 70", 3, 1.2, 0.7)
    a.path("M22 82 L78 82", 3, 1.0, 0.5)
    return a


@item("Large Format Film Negative")
def _():
    a = Art()
    a.rect(20, 18, 60, 64, 0, 2.6)
    a.rect(26, 24, 48, 52, 3, 1.2, 0.7)
    a.path("M32 62 L44 44 L54 58 L62 48 L70 62", 6, 1.8)
    a.circle(40, 36, 3.4, 6, 1.4)
    a.path("M22 18 L28 18 M72 82 L78 82", 3, 1.4, 0.8)
    a.line(14, 40, 20, 40, 0, 2.0)
    return a


@item("Pinhole Camera Box")
def _():
    a = Art()
    a.path("M20 30 L70 30 L80 40 L80 74 L30 74 L20 64 Z", 0, 2.6)
    a.path("M20 30 L30 40 L80 40 M30 40 L30 74", 0, 2.2)
    a.circle(55, 56, 2.4, 6, 1.6)
    a.path("M55 56 L8 56", 3, 1.0, 0.5)
    a.path("M8 52 L8 60", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Single Lens Camera")
def _():
    a = Art()
    cam_body(a, 16, 34, 68, 40, 0)
    lens(a, 50, 54, 14, 0, 2)
    a.circle(74, 42, 2.6, 6, 1.4)
    a.line(26, 42, 36, 42, 3, 1.4, 0.7)
    a.ground(88)
    return a


@item("Folding Bellows Camera")
def _():
    a = Art()
    a.rect(12, 34, 22, 36, 0, 2.6)
    a.rect(70, 38, 18, 28, 0, 2.6)
    bellows(a, 34, 70, 52, 36, 26, 7)
    lens(a, 79, 52, 6, 6, 1)
    a.path("M18 28 L28 28 L28 34", 0, 2.0)
    a.ground(86)
    return a


@item("View Camera")
def _():
    a = Art()
    a.rect(18, 28, 14, 44, 0, 2.6)
    a.rect(68, 34, 12, 32, 0, 2.6)
    bellows(a, 32, 68, 50, 44, 28, 6)
    lens(a, 74, 50, 5, 6, 1)
    a.line(10, 84, 90, 84, 0, 2.4)
    a.line(24, 72, 24, 84, 0, 2.0)
    a.line(74, 66, 74, 84, 0, 2.0)
    a.path("M20 36 L30 36", 3, 1.0, 0.5)
    return a


@item("Darkroom Chemical Tray")
def _():
    a = Art()
    tray(a, 14, 44, 72, 26, 0)
    a.path("M24 54 Q34 50 44 54 T64 54 T76 54", 3, 1.2, 0.7)
    a.rect(34, 42, 22, 14, 6, 1.6)
    a.path("M70 30 L80 24 L84 28", 0, 2.0)
    a.ground(84)
    return a


@item("Contact Print Frame")
def _():
    a = Art()
    a.rect(16, 22, 68, 56, 0, 2.6)
    a.rect(24, 30, 52, 40, 3, 1.2, 0.7)
    a.path("M30 62 L44 44 L54 58 L62 48 L72 62", 6, 1.6)
    a.line(16, 50, 8, 50, 0, 2.0)
    a.line(84, 40, 92, 40, 0, 2.0)
    a.line(84, 60, 92, 60, 0, 2.0)
    return a


@item("Photographic Enlarger")
def _():
    a = Art()
    a.line(26, 86, 26, 14, 0, 2.6)
    a.line(14, 86, 86, 86, 0, 2.6)
    a.rect(26, 14, 34, 18, 0, 2.4)
    a.path("M30 32 L56 32 L48 50 L38 50 Z", 0, 2.2)
    lens(a, 43, 56, 6, 0, 1)
    a.path("M43 62 L22 80 M43 62 L64 80", 3, 1.0, 0.5)
    a.rect(26, 78, 48, 8, 6, 1.6)
    return a


@item("Color Enlarger")
def _():
    a = Art()
    a.line(22, 88, 22, 12, 0, 2.6)
    a.line(12, 88, 88, 88, 0, 2.6)
    a.rect(22, 12, 38, 14, 0, 2.4)
    for i, d in enumerate((30, 38, 46)):
        a.line(24 + i * 12, 26, 24 + i * 12, 34, 3, 1.6, 0.8)
    a.path("M26 36 L56 36 L48 52 L36 52 Z", 0, 2.2)
    lens(a, 42, 58, 6, 0, 1)
    a.rect(24, 80, 50, 8, 6, 1.6)
    a.path("M42 64 L26 80 M42 64 L62 80", 3, 1.0, 0.5)
    return a


@item("Photo Shutter Blade")
def _():
    a = Art()
    a.path("M26 66 Q22 40 44 26 L72 22 Q62 46 52 70 Z", 0, 2.6)
    a.path("M36 56 Q40 40 56 32", 3, 1.2, 0.6)
    a.circle(34, 62, 3, 6, 1.6)
    a.path("M30 74 L70 74", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Mechanical Leaf Shutter")
def _():
    a = Art()
    a.circle(50, 50, 32, 0, 2.6)
    blade_set(a, 50, 50, 26, 6, 6, 2.4)
    a.circle(50, 50, 10, 3, 1.2, 0.6)
    a.path("M78 66 L88 72", 3, 1.6, 0.8)
    return a


@item("Focal Plane Shutter")
def _():
    a = Art()
    a.rect(22, 24, 56, 52, 0, 2.6)
    a.rect(28, 30, 44, 40, 3, 1.2, 0.6)
    a.rect(28, 30, 44, 16, 6, 2.0)
    a.path("M28 46 L72 46", 6, 1.6)
    a.circle(16, 36, 3, 0, 1.8)
    a.circle(84, 64, 3, 0, 1.8)
    a.path("M16 40 L16 60 M84 40 L84 60", 3, 1.0, 0.5)
    return a


@item("Electronic Camera Shutter")
def _():
    a = Art()
    a.rect(22, 24, 56, 50, 0, 2.6)
    a.rect(30, 32, 40, 34, 6, 1.8)
    for i in range(4):
        a.line(30, 38 + i * 7, 70, 38 + i * 7, 3, 1.0, 0.6)
    a.path("M30 80 L36 76 L44 82 L52 76 L60 82", 3, 1.4, 0.9)
    a.line(78, 40, 90, 40, 0, 2.0)
    a.line(78, 56, 90, 56, 0, 2.0)
    return a


@item("Camera Film Spool")
def _():
    a = Art()
    a.ellipse(50, 28, 22, 6, 0, 2.4)
    a.line(28, 28, 28, 72, 0, 2.4)
    a.line(72, 28, 72, 72, 0, 2.4)
    a.path("M28 72 Q50 82 72 72", 0, 2.4)
    a.ellipse(50, 28, 5, 1.6, 6, 1.4)
    a.path("M32 44 Q50 52 68 44 M32 56 Q50 64 68 56", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Roll Film Cartridge")
def _():
    a = Art()
    a.rect(22, 30, 40, 44, 0, 2.6)
    a.circle(42, 52, 12, 3, 1.4, 0.8)
    a.circle(42, 52, 4, 6, 1.6)
    a.path("M62 38 L84 38 L84 62 L62 62", 0, 2.4)
    a.path("M62 44 L84 44", 3, 1.0, 0.6)
    a.ground(86)
    return a


@item("35mm Film Cassette")
def _():
    a = Art()
    a.rect(26, 32, 48, 42, 0, 2.6, None, 4)
    a.rect(44, 22, 12, 10, 0, 2.2)
    a.path("M30 40 L70 40", 3, 1.0, 0.6)
    a.path("M74 58 L92 58 L92 66 L74 66", 6, 1.8)
    for i in range(5):
        a.line(80 + i * 2.4, 58, 80 + i * 2.4, 60, 3, 1.0, 0.7)
    a.circle(50, 56, 3.4, 6, 1.4)
    a.ground(86)
    return a


@item("Reusable Film Magazine")
def _():
    a = Art()
    a.rect(14, 30, 72, 44, 0, 2.6)
    a.circle(34, 52, 12, 0, 2.0)
    a.circle(66, 52, 12, 0, 2.0)
    a.path("M34 40 L66 40 M34 64 L66 64", 6, 1.6)
    a.rect(44, 22, 12, 8, 0, 2.2)
    a.path("M14 82 L86 82", 3, 1.0, 0.5)
    return a


@item("Camera Lens Barrel")
def _():
    a = Art()
    a.rect(18, 32, 64, 36, 0, 2.6)
    for x in (30, 44, 58, 72):
        a.line(x, 32, x, 68, 3, 1.2, 0.7)
    a.ellipse(82, 50, 4, 18, 0, 2.4)
    a.path("M18 40 L10 44 L10 56 L18 60", 0, 2.2)
    a.ground(84)
    return a


@item("Mounted Camera Lens")
def _():
    a = Art()
    a.rect(24, 34, 40, 32, 0, 2.6)
    lens(a, 74, 50, 14, 0, 2)
    a.line(64, 38, 64, 62, 3, 1.2, 0.7)
    a.path("M30 40 L58 40", 3, 1.0, 0.5)
    a.path("M30 60 L52 60", 3, 1.0, 0.5)
    a.ground(84)
    return a


@item("Interchangeable Camera Lens")
def _():
    a = Art()
    a.rect(8, 36, 38, 28, 0, 2.6)
    a.circle(72, 50, 22, 0, 2.6)
    lens(a, 72, 50, 14, 0, 2)
    a.path("M46 42 L52 38 M46 58 L52 62", 6, 1.8)
    a.path("M28 36 L28 64", 3, 1.0, 0.5)
    arrow(a, 48, 50, 56, 50, 3, 1.4, 0.8)
    return a


@item("Optically Stabilized Camera Lens")
def _():
    a = Art()
    a.rect(14, 32, 36, 36, 0, 2.6)
    lens(a, 70, 50, 20, 0, 3)
    a.path("M26 44 L38 44 M26 56 L38 56", 3, 1.2, 0.7)
    a.path("M70 22 L70 28 M70 72 L70 78 M42 50 L48 50", 6, 1.4)
    a.path("M60 50 L80 50 M70 40 L70 60", 3, 1.0, 0.5)
    a.line(14, 50, 8, 50, 0, 2.0)
    return a
