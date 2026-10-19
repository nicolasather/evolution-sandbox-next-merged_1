"""Topic 09 - leather crafting (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import blob, droplet, sparkle
from .registry import item, topic

topic("leather crafting")


def hide(a, cx=50, cy=50, s=1.0, z=0, w=2.0):
    """Animal hide outline with four legs and a neck stub."""
    pts = [(-26, -6), (-30, -16), (-20, -20), (-12, -12), (-2, -16), (12, -12), (22, -20), (30, -14), (26, -4),
           (30, 8), (20, 16), (12, 8), (0, 12), (-12, 8), (-20, 16), (-30, 8)]
    d = "M" + " L".join(f"{n(cx + px * s)} {n(cy + py * s)}" for px, py in pts) + " Z"
    a.path(d, z, w)


def stitch_line(a, x0, y0, x1, y1, count=8, z=6, w=1.5, gap=0.35):
    for i in range(count):
        t0 = i / count
        t1 = t0 + (1 / count) * (1 - gap)
        a.line(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, z, w)


def pouch_body(a, cx=50, top=34, w=40, h=40, z=0, wd=2.0):
    a.path(f"M{n(cx - w / 2)} {n(top)} L{n(cx + w / 2)} {n(top)} L{n(cx + w / 2 + 4)} {n(top + h * 0.7)} Q{n(cx)} {n(top + h * 1.15)} {n(cx - w / 2 - 4)} {n(top + h * 0.7)} Z", z, wd)


@item("Prepared Animal Hide")
def _():
    a = Art()
    hide(a, 50, 46, 1.2, 0, 2.2)
    a.path("M30 44 Q50 38 70 44", 3, 1.0, 0.5)
    for (x, y) in ((40, 52), (56, 54), (48, 46)):
        a.dot(x, y, 1.0, 3)
    a.line(14, 74, 86, 74, 6, 1.4, 0.8)
    for x in range(18, 86, 12):
        a.line(x, 74, x, 80, 6, 1.4)
    a.ground(90)
    return a


@item("Scraped Hide")
def _():
    a = Art()
    hide(a, 42, 52, 1.0, 0, 2.0)
    a.line(58, 22, 82, 42, 6, 2.6)
    a.path("M54 20 L62 18 L66 26 L58 28 Z", 6, 1.6)
    for k in range(5):
        a.path(f"M{48 + k * 4} {40 + k * 2} l6 -4", 3, 1.0, 0.55)
    a.dots([(70, 62), (78, 56), (84, 66)], 1.1, 3)
    a.ground(90)
    return a


@item("Softened Hide")
def _():
    a = Art()
    a.path("M16 40 C26 32 36 48 48 40 S72 34 84 42 L82 64 C70 70 60 58 48 64 S28 72 18 64 Z", 0, 2.2)
    a.path("M22 50 C32 44 42 58 54 50 S72 46 78 52", 3, 1.2, 0.6)
    a.circle(50, 26, 5, 6, 1.6)
    a.path("M44 20 L40 14 M56 20 L60 14", 6, 1.4)
    droplet(a, 30, 78, 3)
    a.ground(90)
    return a


@item("Oiled Hide")
def _():
    a = Art()
    a.path("M16 40 C26 32 36 48 48 40 S72 34 84 42 L82 64 C70 70 60 58 48 64 S28 72 18 64 Z", 0, 2.2)
    a.path("M24 52 C34 46 44 60 56 52", 3, 1.2, 0.6)
    a.path("M66 12 Q66 6 72 6 L78 6 Q84 6 84 12 L82 26 L68 26 Z", 6, 1.6)
    droplet(a, 70, 34, 3.4)
    droplet(a, 76, 38, 2.6)
    sparkle(a, 30, 28, 2.8)
    a.ground(90)
    return a


@item("Supple Garment Leather")
def _():
    a = Art()
    a.path("M14 34 C30 24 44 44 60 34 S82 28 88 36 L86 70 C72 80 58 62 44 70 S22 78 14 68 Z", 0, 2.2)
    a.path("M22 46 C34 40 46 56 60 48 S76 46 82 50", 3, 1.2, 0.6)
    a.path("M22 58 C34 52 46 66 60 60 S76 58 82 62", 3, 1.0, 0.5)
    a.path("M70 20 L74 14 L78 20", 6, 1.4)
    a.ground(90)
    return a


@item("Cut Leather Strip")
def _():
    a = Art()
    a.path("M14 30 C30 22 44 40 60 30 S78 26 88 32 L88 60 C74 66 62 52 48 60 S26 68 14 60 Z", 0, 1.8, 0.6)
    for y in (38, 46, 54):
        a.line(14, y, 88, y, 3, 1.0, 0.5)
    a.rect(14, 30, 74, 8, 0, 2.0)
    a.line(18, 74, 84, 74, 6, 2.4)
    a.path("M60 14 L80 20 L76 26", 6, 1.6)
    a.ground(90)
    return a


@item("Leather Lace")
def _():
    a = Art()
    a.path("M12 40 C28 30 44 52 60 40 S84 34 90 42", 0, 2.4)
    a.path("M12 46 C28 36 44 58 60 46 S84 40 90 48", 0, 1.6, 0.7)
    a.path("M14 70 C30 62 46 78 62 70 S82 66 88 72", 0, 2.0)
    for (x, y) in ((22, 58), (40, 60), (58, 58)):
        a.circle(x, y, 2.4, 6, 1.4)
    a.line(62, 14, 86, 22, 6, 1.8)
    a.ground(90)
    return a


@item("Stitched Leather Seam")
def _():
    a = Art()
    a.path("M12 24 L88 24 L88 46 L12 46 Z", 0, 2.0)
    a.path("M12 50 L88 50 L88 72 L12 72 Z", 0, 2.0)
    stitch_line(a, 14, 48, 86, 48, 9)
    for x in range(14, 86, 8):
        a.path(f"M{x} 44 L{x + 4} 52", 3, 1.0, 0.5)
    a.path("M80 14 L92 8", 6, 1.6)
    a.circle(93, 7, 1.4, 6, 1.0)
    a.ground(88)
    return a


@item("Reinforced Leather Seam")
def _():
    a = Art()
    a.rect(12, 22, 76, 24, 0, 2.0)
    a.rect(12, 50, 76, 24, 0, 2.0)
    a.rect(12, 42, 76, 12, 3, 1.6, 0.8)
    stitch_line(a, 14, 44, 86, 44, 9)
    stitch_line(a, 14, 52, 86, 52, 9)
    a.path("M16 80 L84 80", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Leather Pouch")
def _():
    a = Art()
    pouch_body(a, 50, 28, 44, 46, 0, 2.2)
    a.path("M28 32 Q50 40 72 32", 3, 1.4, 0.8)
    stitch_line(a, 26, 36, 30, 66, 4, 6, 1.4)
    stitch_line(a, 74, 36, 70, 66, 4, 6, 1.4)
    a.path("M34 56 Q50 64 66 56", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Drawstring Pouch")
def _():
    a = Art()
    a.path("M30 34 Q24 26 34 22 L66 22 Q76 26 70 34 Q80 58 72 70 Q50 82 28 70 Q20 58 30 34 Z", 0, 2.2)
    for x in (36, 44, 52, 60):
        a.path(f"M{x} 34 Q{x + 2} 30 {x + 4} 34", 3, 1.0, 0.7)
    a.path("M30 34 Q50 40 70 34", 3, 1.4, 0.8)
    a.path("M40 36 C34 46 30 56 24 60 M60 36 C66 46 70 56 76 60", 6, 1.6)
    a.circle(24, 62, 2.4, 6, 1.4)
    a.circle(76, 62, 2.4, 6, 1.4)
    a.ground(90)
    return a


@item("Flap Closure Pouch")
def _():
    a = Art()
    a.rect(26, 34, 48, 42, 0, 2.2, None, 3)
    a.path("M26 34 L74 34 L74 50 Q50 66 26 50 Z", 6, 2.0)
    a.circle(50, 58, 3, 6, 1.6)
    stitch_line(a, 29, 40, 71, 40, 6, 3, 1.1, 0.4)
    a.path("M36 28 L36 34 M64 28 L64 34", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Belt Mounted Pouch")
def _():
    a = Art()
    a.rect(8, 22, 84, 10, 0, 2.0)
    a.rect(40, 18, 8, 18, 6, 1.6)
    a.rect(56, 18, 8, 18, 6, 1.6)
    a.path("M34 40 L70 40 L70 74 Q52 82 34 74 Z", 0, 2.2)
    a.path("M34 40 L70 40 L70 54 Q52 62 34 54 Z", 6, 1.6)
    a.circle(52, 56, 2.6, 6, 1.4)
    a.line(14, 27, 34, 27, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Rawhide Sheet")
def _():
    a = Art()
    a.path("M18 30 L84 26 L88 64 L16 70 Z", 0, 2.2)
    a.path("M24 40 L78 36 M24 52 L80 48 M24 62 L80 58", 3, 1.0, 0.5)
    a.line(14, 22, 14, 80, 6, 2.0)
    a.line(90, 22, 90, 80, 6, 2.0)
    a.line(14, 22, 90, 22, 6, 2.0)
    a.path("M14 22 L22 30 M90 22 L84 28 M14 80 L18 70 M90 80 L88 64", 3, 1.0, 0.6)
    a.ground(90)
    return a


@item("Rawhide Binding")
def _():
    a = Art()
    a.line(44, 14, 44, 84, 0, 2.2)
    a.line(56, 14, 56, 84, 0, 2.2)
    for y in range(26, 72, 6):
        a.path(f"M40 {y + 4} L60 {y - 2}", 6, 2.4)
        a.path(f"M40 {y + 6} L60 {y}", 3, 0.9, 0.4)
    a.path("M60 32 Q76 28 80 40", 6, 1.6)
    a.ground(90)
    return a


@item("Rawhide Shield Cover")
def _():
    a = Art()
    a.circle(50, 48, 32, 0, 2.4)
    a.circle(50, 48, 26, 3, 1.0, 0.6)
    a.circle(50, 48, 7, 6, 2.0)
    for k in range(12):
        t = 2 * math.pi * k / 12
        a.line(50 + 26 * math.cos(t), 48 + 26 * math.sin(t), 50 + 31 * math.cos(t), 48 + 31 * math.sin(t), 6, 1.2)
    a.path("M50 22 L50 41 M50 55 L50 74 M24 48 L43 48 M57 48 L76 48", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Layered Rawhide Shield")
def _():
    a = Art()
    a.circle(50, 46, 32, 0, 2.4)
    a.circle(50, 46, 24, 3, 1.6, 0.8)
    a.circle(50, 46, 16, 3, 1.3, 0.6)
    a.circle(50, 46, 6, 6, 2.0)
    a.path("M26 78 L74 78 M30 84 L70 84", 3, 1.2, 0.6)
    a.line(18, 70, 82, 22, 3, 1.0, 0.4)
    a.ground(92)
    return a


@item("Leather Sole Blank")
def _():
    a = Art()
    a.path("M40 14 C54 12 60 24 58 36 C56 48 64 56 62 70 C60 82 42 86 36 76 C30 66 38 52 36 40 C34 28 32 16 40 14 Z", 0, 2.4)
    a.path("M42 22 C50 22 52 30 50 38 C48 50 56 58 54 68", 3, 1.0, 0.5)
    a.path("M68 20 L84 20 M68 28 L80 28", 6, 1.4, 0.7)
    a.path("M16 40 L28 44 M16 52 L26 52", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Stitched Sandal Sole")
def _():
    a = Art()
    a.path("M40 14 C54 12 60 24 58 36 C56 48 64 56 62 70 C60 82 42 86 36 76 C30 66 38 52 36 40 C34 28 32 16 40 14 Z", 0, 2.4)
    a.path("M42 20 C52 20 55 30 53 38 C51 50 58 58 57 70 C55 78 44 80 40 74", 3, 1.6, 0.5)
    a.dots([(42, 28), (46, 44), (52, 60), (47, 74)], 0.9, 6)
    a.path("M68 22 L88 22 M68 32 L84 32", 6, 1.4, 0.7)
    a.ground(90)
    return a


@item("Multi Layer Sandal")
def _():
    a = Art()
    for i, dy in enumerate((0, 6, 12)):
        a.path(f"M14 {58 + dy} Q50 {64 + dy} 88 {50 + dy}", 0, 2.2 if i == 0 else 1.6, None if i == 0 else 0.7)
    a.path("M14 58 Q14 50 26 50 Q50 54 88 42 Q92 46 88 50", 0, 2.2)
    a.path("M40 52 L46 34 L54 52 M46 34 L46 26", 6, 1.6)
    a.path("M62 48 Q66 34 72 46", 6, 1.6)
    a.ground(90)
    return a


@item("Sewn Leather Shoe")
def _():
    a = Art()
    a.path("M18 36 L40 36 L42 50 Q60 52 82 60 Q90 66 86 74 L16 74 Q12 66 18 36 Z", 0, 2.4)
    a.path("M16 70 L86 70", 3, 1.4, 0.8)
    a.line(40, 36, 40, 46, 6, 1.4)
    for y in (40, 46):
        a.line(30, y, 40, y + 2, 6, 1.4)
    stitch_line(a, 20, 66, 84, 66, 10, 6, 1.1)
    a.ground(90)
    return a


@item("Leather Water Bag")
def _():
    a = Art()
    a.path("M34 24 L66 24 L72 40 Q80 62 66 76 Q50 84 34 76 Q20 62 28 40 Z", 0, 2.4)
    a.path("M40 24 L40 14 L60 14 L60 24", 0, 2.0)
    a.line(38, 18, 62, 18, 6, 1.4)
    stitch_line(a, 34, 30, 28, 62, 5, 6, 1.2)
    droplet(a, 50, 54, 4, 3, 1.4)
    a.ground(90)
    return a


@item("Pitch Sealed Water Bag")
def _():
    a = Art()
    a.path("M34 24 L66 24 L72 40 Q80 62 66 76 Q50 84 34 76 Q20 62 28 40 Z", 0, 2.4)
    a.path("M40 24 L40 14 L60 14 L60 24", 0, 2.0)
    stitch_line(a, 34, 30, 28, 62, 5, 6, 1.2)
    a.path("M28 44 Q34 40 38 46 Q42 52 36 56 M62 44 Q68 40 72 46", 3, 2.0, 0.7)
    a.path("M80 24 Q90 24 90 34 Q90 44 80 44 Q74 44 74 34 Q74 24 80 24 Z", 6, 1.4)
    droplet(a, 50, 60, 3.4, 3, 1.4)
    a.ground(90)
    return a


@item("Stitched Water Skin")
def _():
    a = Art()
    a.path("M30 20 L44 20 L46 30 Q64 34 78 46 Q86 58 76 68 Q60 76 46 70 Q34 66 30 48 Z", 0, 2.4)
    a.path("M30 20 L30 12 L44 12 L44 20", 0, 1.8)
    stitch_line(a, 32, 34, 36, 64, 5, 6, 1.2)
    a.path("M20 14 Q16 30 22 46", 6, 1.6, 0.8)
    a.path("M56 56 Q66 52 72 58", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Carried Water Skin")
def _():
    a = Art()
    a.path("M34 28 L50 28 L52 38 Q68 42 78 54 Q82 66 72 72 Q56 78 46 72 Q36 68 34 52 Z", 0, 2.4)
    a.path("M34 28 L34 22 L50 22 L50 28", 0, 1.8)
    a.path("M36 24 C36 12 56 8 66 18 C76 28 80 46 76 56", 6, 1.8)
    a.circle(34, 24, 2, 6, 1.2)
    a.path("M20 80 Q50 86 80 80", 3, 1.0, 0.45)
    droplet(a, 56, 56, 3.4, 3, 1.3)
    a.ground(90)
    return a
