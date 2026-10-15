"""Topic 08 - natural colorants (25)."""
from __future__ import annotations

from .core import Art, arrow, n
from .kit import bowl_prof, droplet, sparkle, vessel
from .kit_textile import sine_path, weave_grid
from .registry import item, topic

topic("natural colorants")


def pile(a, cx, y, w=26, h=14, z=0, wd=1.8):
    a.path(f"M{n(cx - w)} {n(y)} Q{n(cx - w * 0.4)} {n(y - h * 1.2)} {n(cx)} {n(y - h)} Q{n(cx + w * 0.4)} {n(y - h * 1.2)} {n(cx + w)} {n(y)}", z, wd)
    a.line(cx - w - 4, y, cx + w + 4, y, z, wd)
    for k in range(5):
        a.dot(cx - w * 0.5 + k * w * 0.25, y - 3 - (k % 2) * 3, 1.0, 3)


def pot(a, cx, y, r=16, h=22, z=0, wd=2.0, fill_top=True):
    a.ellipse(cx, y, r, r * 0.28, z, wd)
    a.path(f"M{n(cx - r)} {n(y)} Q{n(cx - r - 2)} {n(y + h)} {n(cx)} {n(y + h + 4)} Q{n(cx + r + 2)} {n(y + h)} {n(cx + r)} {n(y)}", z, wd)
    if fill_top:
        a.ellipse(cx, y + 1.5, r * 0.8, r * 0.2, 3, 1.0, 0.6)


def brush(a, x, y, length=30, tilt=-0.5, z=6):
    x2, y2 = x + length, y + length * tilt
    a.line(x, y, x2, y2, z, 2.2)
    a.path(f"M{n(x)} {n(y)} l-6 4 l-3 -1 l3 -6 Z", z, 1.4)


def swatch(a, x, y, w, h, z=0, wd=2.0, hatch=True):
    a.rect(x, y, w, h, z, wd)


def thread(a, x0, x1, y, z=0, wd=2.0, amp=3, per=10):
    sine_path(a, x0, x1, y, amp, per, 0, z, wd)


@item("Prepared Natural Pigment")
def _():
    a = Art()
    pile(a, 30, 62, 20, 14)
    pile(a, 70, 62, 16, 10)
    a.ellipse(50, 78, 24, 5, 0, 1.4, 0.6)
    a.path("M20 26 L40 18 L44 30 L26 36 Z", 6, 1.6)
    a.dots([(60, 28), (68, 24), (74, 32), (82, 26)], 1.4, 3)
    a.ground(88)
    return a


@item("Ground Red Ochre")
def _():
    a = Art()
    a.path("M16 58 L28 40 L46 36 L52 52 L40 66 L22 66 Z", 0, 2.0)
    a.path("M28 40 L34 54 L52 52 M34 54 L40 66", 3, 1.0, 0.6)
    a.ellipse(72, 62, 16, 5, 0, 1.8)
    a.path("M56 62 Q58 74 72 76 Q86 74 88 62", 0, 1.8)
    pile(a, 72, 60, 10, 7, 3, 1.2)
    a.line(60, 24, 80, 16, 6, 2.4)
    a.circle(82, 15, 3, 6, 1.6)
    a.ground(88)
    return a


@item("Ochre Paint Paste")
def _():
    a = Art()
    pot(a, 38, 44, 18, 24)
    a.path("M26 36 Q38 28 50 36", 3, 1.2, 0.6)
    a.path("M56 50 L84 40", 6, 2.6)
    a.path("M84 40 l6 -2 l1 4 l-6 2 Z", 6, 1.4)
    droplet(a, 70, 66, 3.4)
    droplet(a, 78, 74, 2.4)
    a.ground(88)
    return a


@item("Ochre Wash")
def _():
    a = Art()
    swatch(a, 16, 24, 68, 38, 0, 2.2, False)
    for y in (32, 40, 48, 56):
        sine_path(a, 20, 80, y, 1.6, 14, y, 3, 1.3, 0.55)
    brush(a, 52, 82, 34, -0.3)
    droplet(a, 30, 76, 3.2)
    droplet(a, 40, 82, 2.4)
    a.ground(90)
    return a


@item("Ochre Wall Painting")
def _():
    a = Art()
    a.path("M12 16 L88 16 L88 80 L12 80 Z", 0, 2.4)
    a.path("M28 66 C26 54 34 46 42 44 C44 36 52 34 58 40 C66 38 72 46 70 54 C74 60 72 66 66 68 L60 74 L56 66 L46 66 L42 74 Z", 3, 1.6)
    a.path("M32 36 L36 28 L40 36", 3, 1.2, 0.7)
    a.path("M70 28 Q76 22 82 28", 3, 1.2, 0.6)
    a.path("M16 74 L84 74", 3, 1.0, 0.4)
    a.dots([(20, 24), (24, 30), (78, 70)], 1.2, 3)
    a.ground(90)
    return a


@item("Charcoal Black Pigment")
def _():
    a = Art()
    for i, (x, y) in enumerate(((24, 50), (46, 40), (62, 56))):
        a.path(f"M{x} {y} L{x + 18} {y - 8} L{x + 24} {y + 6} L{x + 8} {y + 16} Z", 0, 1.8)
        a.path(f"M{x + 4} {y + 2} L{x + 16} {y - 2}", 3, 1.0, 0.5)
    flame_x = 50
    a.path("M46 24 Q50 12 54 24 Q58 30 50 32 Q42 30 46 24", 6, 1.4)
    a.dots([(20, 72), (30, 76), (70, 74), (80, 70)], 1.2, 3)
    a.ground(86)
    return a


@item("Carbon Ink Paste")
def _():
    a = Art()
    a.ellipse(40, 56, 24, 8, 0, 2.0)
    a.path("M16 56 Q18 70 40 72 Q62 70 64 56", 0, 2.0)
    a.ellipse(40, 56, 17, 4.5, 3, 1.0, 0.6)
    a.line(60, 30, 84, 58, 6, 3.0)
    a.ellipse(86, 61, 3, 2, 6, 1.4)
    a.path("M30 52 Q40 50 50 52", 3, 1.0, 0.5)
    droplet(a, 78, 74, 3)
    a.ground(86)
    return a


@item("Carbon Drawing Ink")
def _():
    a = Art()
    a.path("M26 36 L26 28 L44 28 L44 36 Q54 40 54 56 Q54 74 40 74 L30 74 Q16 74 16 56 Q16 40 26 36 Z", 0, 2.0)
    a.line(26, 36, 44, 36, 3, 1.2, 0.7)
    a.path("M20 58 Q35 52 50 58", 3, 1.2, 0.6)
    a.path("M60 24 L86 62", 6, 2.0)
    a.path("M86 62 L82 68 L88 66 Z", 6, 1.4)
    a.path("M62 80 Q70 74 76 80 Q84 86 90 80", 0, 1.6)
    droplet(a, 84, 50, 2.6)
    a.ground(88)
    return a


@item("Water Resistant Carbon Ink")
def _():
    a = Art()
    a.path("M26 36 L26 28 L44 28 L44 36 Q54 40 54 56 Q54 74 40 74 L30 74 Q16 74 16 56 Q16 40 26 36 Z", 0, 2.0)
    a.path("M20 58 Q35 52 50 58", 3, 1.2, 0.6)
    a.path("M64 40 L88 40 M64 46 L88 46 M64 52 L88 52", 0, 2.0)
    for x in (66, 76, 86):
        droplet(a, x, 22, 3)
        a.path(f"M{x - 4} 36 Q{x} 30 {x + 4} 36", 3, 1.2, 0.7)
    a.path("M62 58 L90 58", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Plant Yellow Dye")
def _():
    a = Art()
    a.line(24, 84, 24, 40, 0, 1.8)
    for (x, y, s) in ((24, 54, 1), (24, 44, -1), (24, 66, -1)):
        a.path(f"M24 {y} Q{24 + s * 12} {y - 8} {24 + s * 16} {y - 2} Q{24 + s * 10} {y + 4} 24 {y}", 0, 1.4)
    for (x, y) in ((24, 34), (18, 30), (30, 30)):
        a.circle(x, y, 3.2, 6, 1.4)
        a.circle(x, y, 1, 3, 0.9)
    pot(a, 66, 46, 18, 22)
    droplet(a, 66, 24, 3.4)
    a.path("M52 52 Q66 46 80 52", 3, 1.2, 0.6)
    a.ground(88)
    return a


@item("Concentrated Yellow Bath")
def _():
    a = Art()
    a.path("M14 40 L86 40 L80 74 Q50 82 20 74 Z", 0, 2.2)
    a.ellipse(50, 40, 36, 7, 0, 2.0)
    for x in (30, 44, 58, 72):
        a.path(f"M{x} 36 Q{x + 3} 28 {x} 20", 3, 1.2, 0.6)
    a.path("M24 56 Q50 64 76 56", 3, 1.2, 0.6)
    a.circle(40, 48, 2, 6, 1.0)
    a.circle(60, 50, 1.6, 6, 1.0)
    a.ground(88)
    return a


@item("Yellow Dyed Thread")
def _():
    a = Art()
    a.ellipse(36, 32, 14, 4, 0, 1.8)
    a.ellipse(36, 60, 14, 4, 0, 1.8)
    a.line(22, 32, 22, 60, 0, 1.8)
    a.line(50, 32, 50, 60, 0, 1.8)
    for k in range(7):
        a.line(23, 35 + k * 3.8, 49, 35 + k * 3.8 + 2, 3, 0.9, 0.55)
    thread(a, 52, 92, 52, 0, 1.8)
    droplet(a, 70, 24, 3.2)
    sparkle(a, 82, 36, 2.8)
    a.path("M66 66 Q78 60 90 66", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Pattern Dyed Textile")
def _():
    a = Art()
    a.rect(16, 20, 68, 60, 0, 2.2)
    for (cx, cy) in ((34, 38), (66, 38), (34, 62), (66, 62)):
        a.circle(cx, cy, 8, 6, 1.6)
        a.circle(cx, cy, 3, 3, 1.1, 0.7)
    a.path("M50 24 L58 50 L50 76 L42 50 Z", 3, 1.3, 0.7)
    a.path('M20 50 L80 50 M50 24 L50 76', -1, 0.8, 0.3)
    a.ground(90)
    return a


@item("Indigo Leaf Paste")
def _():
    a = Art()
    for (x, y, rot) in ((22, 44, -20), (34, 30, 10), (46, 46, 30)):
        a.path(f"M{x} {y} Q{x + 8} {y - 14} {x + 16} {y} Q{x + 8} {y + 8} {x} {y}", 0, 1.6)
        a.line(x, y, x + 16, y, 3, 0.9, 0.55)
    a.ellipse(70, 62, 18, 6, 0, 2.0)
    a.path("M52 62 Q54 78 70 80 Q86 78 88 62", 0, 2.0)
    a.ellipse(70, 62, 12, 3.4, 3, 1.0, 0.6)
    a.line(60, 40, 76, 54, 6, 2.6)
    a.ground(88)
    return a


@item("Reduced Indigo Vat")
def _():
    a = Art()
    a.path("M20 36 L24 80 L76 80 L80 36", 0, 2.4)
    a.ellipse(50, 36, 30, 8, 0, 2.2)
    a.ellipse(50, 37, 22, 5, 3, 1.0, 0.6)
    for (x, y) in ((40, 36), (50, 38), (58, 35), (46, 34)):
        a.circle(x, y, 1.8, 6, 1.0)
    for x in (36, 50, 64):
        a.path(f"M{x} 30 Q{x + 3} 22 {x} 14", 3, 1.2, 0.6)
    a.line(28, 52, 72, 52, 3, 1.0, 0.45)
    a.line(28, 64, 72, 64, 3, 1.0, 0.45)
    a.ground(90)
    return a


@item("Indigo Dyed Yarn")
def _():
    a = Art()
    thread(a, 12, 88, 30, 0, 2.0, 3.4, 12)
    a.path("M20 46 C28 40 36 54 44 48 S60 42 68 50 S84 54 90 46", 0, 2.0)
    a.path("M14 60 C26 54 34 68 46 62 S66 56 74 64 S88 66 90 60", 0, 2.0)
    a.path("M22 72 C34 68 44 78 56 72 S76 70 86 74", 3, 1.2, 0.6)
    droplet(a, 30, 84, 3)
    a.ground(90)
    return a


@item("Indigo Resist Cloth")
def _():
    a = Art()
    a.rect(16, 20, 68, 60, 0, 2.2)
    for r in range(3):
        for c in range(4):
            cx, cy = 28 + c * 15, 32 + r * 18
            a.circle(cx, cy, 5, 6, 1.4)
            a.path(f"M{cx - 3} {cy - 3} L{cx + 3} {cy + 3} M{cx + 3} {cy - 3} L{cx - 3} {cy + 3}", 3, 0.9, 0.5)
    a.path("M16 80 L22 86 L84 86", 3, 1.0, 0.45)
    a.ground(92)
    return a


@item("Iron Tannin Ink")
def _():
    a = Art()
    a.path("M20 28 L38 30 L40 44 L24 46 Z", 0, 1.8)
    a.path("M26 34 L34 34 M26 40 L36 40", 3, 1.0, 0.6)
    a.path("M50 36 L82 28 L84 40 L56 48 Z", 0, 1.8)
    a.line(56, 40, 76, 34, 3, 1.0, 0.55)
    pot(a, 50, 62, 22, 14)
    a.path("M34 60 Q50 54 66 60", 3, 1.2, 0.6)
    a.dots([(24, 36), (80, 36)], 1.0, 6)
    a.ground(88)
    return a


@item("Filtered Iron Gall Ink")
def _():
    a = Art()
    a.path("M20 20 L52 20 L40 44 L32 44 Z", 0, 2.0)
    for x in (30, 36, 42):
        a.line(x, 28, x, 38, 3, 1.0, 0.5)
    a.line(36, 44, 36, 54, 0, 1.6)
    droplet(a, 36, 58, 3)
    a.path("M20 62 L20 80 L52 80 L52 62", 0, 2.0)
    a.ellipse(36, 62, 16, 3.4, 0, 1.6)
    a.path("M62 30 L88 70", 6, 1.8)
    a.path("M88 70 L84 76 L90 74 Z", 6, 1.4)
    a.ground(88)
    return a


@item("Thickened Writing Ink")
def _():
    a = Art()
    a.path("M22 40 L22 32 L40 32 L40 40 Q50 44 50 58 Q50 74 38 74 L26 74 Q14 74 14 58 Q14 44 22 40 Z", 0, 2.0)
    a.path("M18 58 Q32 52 46 58", 3, 1.2, 0.6)
    a.path("M54 34 Q70 26 86 36 Q76 48 64 44", 0, 1.8)
    a.line(66, 22, 80, 60, 6, 2.0)
    a.line(66, 22, 64, 20, 6, 1.4)
    a.path("M56 74 Q66 68 76 74 Q84 78 90 72", 3, 1.4, 0.8)
    a.path("M56 80 Q66 74 76 80 Q84 84 90 78", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Bound Ink Recipe")
def _():
    a = Art()
    a.path("M16 24 L48 20 L48 74 L16 78 Z", 0, 2.0)
    a.path("M48 20 L82 24 L82 78 L48 74", 0, 2.0)
    for y in (32, 40, 48, 56):
        a.line(22, y - 1, 42, y - 3, 3, 1.0, 0.55)
        a.line(54, y - 3, 76, y - 1, 3, 1.0, 0.55)
    a.path("M62 62 L72 62 L72 68 L62 68 Z", 6, 1.3)
    a.path("M26 62 Q32 58 38 62", 6, 1.3)
    a.line(48, 20, 48, 74, 6, 1.6)
    a.ground(90)
    return a


@item("Egg Tempera Medium")
def _():
    a = Art()
    a.path("M30 20 Q44 20 44 42 Q44 58 30 58 Q16 58 16 42 Q16 20 30 20 Z", 0, 2.0)
    a.path("M22 32 Q26 26 32 26", 3, 1.0, 0.6)
    a.ellipse(66, 52, 18, 6, 0, 2.0)
    a.path("M48 52 Q50 68 66 70 Q82 68 84 52", 0, 2.0)
    a.circle(66, 52, 6, 3, 1.2, 0.7)
    droplet(a, 40, 70, 3.2)
    droplet(a, 56, 80, 2.6)
    a.line(70, 26, 84, 44, 6, 2.0)
    a.ground(88)
    return a


@item("Tempera Paint")
def _():
    a = Art()
    for i, x in enumerate((24, 50, 76)):
        a.path(f"M{x - 10} 54 L{x - 10} 46 Q{x} 40 {x + 10} 46 L{x + 10} 54 Q{x + 12} 68 {x} 70 Q{x - 12} 68 {x - 10} 54 Z", 0, 1.8)
        a.ellipse(x, 47, 8, 2.4, 3, 1.0, 0.6)
    brush(a, 30, 36, 40, -0.35)
    a.path("M16 80 Q30 74 44 80 T72 80 T88 80", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Layered Tempera Panel")
def _():
    a = Art()
    a.path("M16 16 L84 16 L84 80 L16 80 Z", 0, 2.4)
    a.rect(22, 22, 56, 52, 3, 1.0, 0.6)
    for i, (y, h) in enumerate(((22, 18), (40, 18), (58, 16))):
        a.path(f"M22 {y + h} Q50 {y + h - 4} 78 {y + h}", 6, 1.4, 0.9 - i * 0.15)
    a.circle(50, 38, 8, 6, 1.5)
    a.path("M36 66 Q50 50 64 66", 6, 1.4)
    a.ground(90)
    return a


@item("Gilded Tempera Panel")
def _():
    a = Art()
    a.path("M16 16 L84 16 L84 80 L16 80 Z", 0, 2.4)
    a.rect(22, 22, 56, 52, 3, 1.0, 0.6)
    a.circle(50, 40, 12, 6, 1.7)
    a.circle(50, 40, 8, 3, 1.0, 0.6)
    for k in range(10):
        import math
        t = 2 * math.pi * k / 10
        a.line(50 + 13 * math.cos(t), 40 + 13 * math.sin(t), 50 + 18 * math.cos(t), 40 + 18 * math.sin(t), 6, 1.3, 0.85)
    a.path("M36 70 Q50 54 64 70", 6, 1.4)
    sparkle(a, 28, 28, 3)
    sparkle(a, 72, 66, 3)
    a.ground(90)
    return a
