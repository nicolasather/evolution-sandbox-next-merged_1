"""Topic 06 - linen textile (25)."""
from __future__ import annotations

from .core import Art, arrow, n, smooth_d
from .kit import droplet, sparkle
from .kit_textile import sine_path, spindle, twist_marks, weave_grid
from .registry import item, topic

topic("linen textile")


def tuft(a, x, y, w=30, h=14, strands=7, z=0, wd=1.4):
    """A loose combed fibre tuft: wavy strands fanning out from a tied head."""
    for k in range(strands):
        t = k / (strands - 1) - 0.5
        a.path(f"M{n(x)} {n(y)} C{n(x + w * 0.35)} {n(y + t * h * 1.2)} {n(x + w * 0.7)} {n(y + t * h * 0.6)} {n(x + w)} {n(y + t * h * 1.8)}",
               z, wd, None if k % 2 == 0 else 0.6)
    a.line(x - 2, y - 4, x - 2, y + 4, 6, 2.2)


def cloth(a, x, y, w, h, z=0, wd=2.0, grid="plain", step=3.4, fold=True):
    a.rect(x, y, w, h, z, wd)
    weave_grid(a, x + 3, y + 3, x + w - 3, y + h - 3, step, 3, 0.9, 0.5, grid)
    if fold:
        a.path(f"M{n(x + w - 10)} {n(y)} L{n(x + w)} {n(y + 10)} L{n(x + w - 10)} {n(y + 10)} Z", 6, 1.2, 0.8)


def bobbin(a, x, y, r=9, hgt=24, z=0, turns=6):
    a.ellipse(x, y, r, r * 0.3, z, 1.8)
    a.ellipse(x, y + hgt, r, r * 0.3, z, 1.8)
    a.line(x - r, y, x - r, y + hgt, z, 1.8)
    a.line(x + r, y, x + r, y + hgt, z, 1.8)
    for k in range(turns):
        yy = y + 4 + k * (hgt - 8) / (turns - 1)
        a.path(f"M{n(x - r + 1)} {n(yy)} Q{n(x)} {n(yy + 3)} {n(x + r - 1)} {n(yy)}", 3, 1.0, 0.55)


def sail(a, pts_mast_x, top, bot, left, right, z=0, curve=6):
    a.line(pts_mast_x, top - 4, pts_mast_x, bot + 6, z, 2.2)
    a.path(f"M{n(left)} {n(top)} Q{n(left + curve)} {n((top + bot) / 2)} {n(left)} {n(bot)} L{n(right)} {n(bot)} L{n(right)} {n(top)} Z", z, 1.8)


@item("Prepared Flax Tow")
def _():
    a = Art()
    tuft(a, 14, 40, 56, 18, 9, 0, 1.5)
    tuft(a, 14, 62, 46, 10, 6, 0, 1.2)
    a.path("M70 22 L84 14 M72 26 L88 20", 3, 1.2, 0.6)
    a.path("M74 70 Q82 60 86 70 Q82 78 74 70", 6, 1.3)
    sparkle(a, 80, 38, 2.4)
    a.ground(88)
    return a


@item("Flax Sliver")
def _():
    a = Art()
    for i, y in enumerate((34, 46, 58)):
        a.path(f"M12 {y} C28 {y - 5} 44 {y + 5} 60 {y} S84 {y - 2} 90 {y}", 0, 2.2 - i * 0.2)
        a.path(f"M12 {y + 3} C28 {y - 2} 44 {y + 8} 60 {y + 3} S84 {y + 1} 90 {y + 3}", 3, 1.0, 0.55)
    a.ellipse(62, 74, 5, 1.8, 6, 1.4)
    a.ellipse(62, 70, 5, 1.8, 6, 1.4)
    a.line(57, 70, 57, 74, 6, 1.4)
    a.line(67, 70, 67, 74, 6, 1.4)
    arrow(a, 20, 22, 40, 22, 3, 1.2, 0.7)
    a.ground(88)
    return a


@item("Hand Spun Linen Yarn")
def _():
    a = Art()
    spindle(a, 34, 16, 54, 0, 1.8)
    a.path("M34 28 C40 36 30 44 36 52 C42 60 30 66 36 72", 3, 1.3, 0.6)
    bobbin(a, 70, 40, 9, 26, 0, 6)
    a.path("M34 54 C44 48 56 52 61 44", 6, 1.2, 0.7)
    a.ground(88)
    return a


@item("Two Ply Linen Yarn")
def _():
    a = Art()
    sine_path(a, 12, 70, 40, 4.5, 14, 0, 0, 2.0)
    sine_path(a, 12, 70, 40, 4.5, 14, 3.14, 0, 2.0)
    twist_marks(a, 14, 66, 40, 4.5, 7, 3, 1.0, 0.5)
    for x, y in ((78, 30), (78, 42)):
        a.circle(x + 6, y, 5, 6, 1.5)
        a.path(f"M{x + 1} {y} L{x + 11} {y}", 3, 1.0, 0.5)
    a.path("M12 62 Q30 58 48 66 T84 62", 3, 1.3, 0.7)
    a.path("M12 72 Q30 68 48 76 T84 72", 3, 1.3, 0.7)
    a.ground(88)
    return a


@item("Mercerized Linen Yarn")
def _():
    a = Art()
    bobbin(a, 32, 26, 12, 34, 0, 8)
    sine_path(a, 50, 92, 48, 3, 10, 0, 0, 1.8)
    sine_path(a, 50, 92, 48, 3, 10, 3.14, 0, 1.8)
    for (x, y) in ((70, 26), (80, 32), (86, 22)):
        sparkle(a, x, y, 3, 3, 0.8)
    a.path("M52 70 Q64 64 78 70 Q86 74 92 68", 6, 1.2, 0.5)
    droplet(a, 58, 80, 3)
    droplet(a, 74, 82, 2.2)
    a.ground(90)
    return a


@item("Plain Linen Cloth")
def _():
    a = Art()
    cloth(a, 18, 24, 64, 52, 0, 2.2, "plain", 4.2)
    a.path("M18 80 Q50 86 82 80", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Fine Plain Linen")
def _():
    a = Art()
    cloth(a, 18, 24, 64, 52, 0, 1.8, "plain", 2.6)
    sparkle(a, 74, 20, 3)
    sparkle(a, 24, 82, 2.4)
    a.ground(90)
    return a


@item("Bleached Linen Cloth")
def _():
    a = Art()
    cloth(a, 16, 36, 54, 44, 0, 2.0, "plain", 4.0)
    for x in (74, 82, 90):
        a.line(x, 24, x - 6, 14, 3, 1.3, 0.8)
    a.circle(80, 14, 6, 6, 1.6)
    droplet(a, 78, 50, 3.2)
    droplet(a, 88, 58, 2.6)
    a.ground(90)
    return a


@item("Damask Linen Cloth")
def _():
    a = Art()
    a.rect(16, 20, 68, 60, 0, 2.2)
    a.rect(22, 26, 56, 48, 3, 1.0, 0.6)
    for (cx, cy) in ((36, 40), (64, 40), (36, 62), (64, 62), (50, 51)):
        a.path(f"M{cx} {cy - 7} L{cx + 5} {cy} L{cx} {cy + 7} L{cx - 5} {cy} Z", 6, 1.4)
        a.circle(cx, cy, 1.4, 6, 1.0)
    weave_grid(a, 24, 28, 76, 72, 3.6, -1, 0.7, 0.25, "twill")
    a.ground(90)
    return a


@item("Linen Thread")
def _():
    a = Art()
    a.ellipse(36, 30, 14, 4, 0, 1.8)
    a.ellipse(36, 58, 14, 4, 0, 1.8)
    a.line(22, 30, 22, 58, 0, 1.8)
    a.line(50, 30, 50, 58, 0, 1.8)
    for k in range(7):
        a.line(23, 33 + k * 3.8, 49, 33 + k * 3.8 + 2, 3, 0.9, 0.5)
    a.path("M50 50 C62 50 66 62 78 60 S92 54 90 66", 6, 1.5)
    a.line(88, 70, 94, 62, 6, 1.4)
    a.circle(90, 76, 1.2, 6, 1.0)
    a.line(90, 64, 90, 77, 3, 0.9, 0.5)
    a.ground(90)
    return a


@item("Running Stitch Seam")
def _():
    a = Art()
    a.rect(12, 20, 76, 26, 0, 2.0)
    a.rect(12, 50, 76, 26, 0, 2.0)
    for k, x in enumerate(range(16, 84, 10)):
        a.line(x, 36, x + 6, 36, 6, 2.0)
        a.line(x + 6, 36, x + 8, 36, 3, 1.0, 0.4)
        a.line(x + 8, 56, x + 14, 56, 3, 1.4, 0.7)
    a.line(14, 48, 86, 48, 3, 1.0, 0.5)
    a.path("M84 36 L96 28", 6, 1.6)
    a.circle(97, 27, 1.6, 6, 1.0)
    a.ground(88)
    return a


@item("Flat Felled Linen Seam")
def _():
    a = Art()
    a.rect(12, 22, 76, 20, 0, 2.0)
    a.rect(12, 46, 76, 20, 0, 2.0)
    a.path("M12 42 L88 42", 3, 1.0, 0.5)
    a.path("M12 54 L88 54", 6, 1.3)
    a.path("M12 60 L88 60", 6, 1.3, 0.8)
    for x in range(16, 86, 6):
        a.line(x, 54, x + 3, 54, 3, 1.0, 0.45)
    a.path("M70 72 L90 72 L90 80 L70 80", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Tailored Linen Garment")
def _():
    a = Art()
    a.path("M32 20 Q50 30 68 20 L88 32 L80 46 L70 40 L70 82 L30 82 L30 40 L20 46 L12 32 Z", 0, 2.0)
    a.path("M40 20 Q50 34 60 20", 3, 1.2, 0.7)
    a.line(50, 34, 50, 82, 3, 1.0, 0.5)
    for y in (44, 54, 64):
        a.circle(50, y, 1.1, 6, 1.0)
    a.path("M30 76 L70 76", 3, 1.0, 0.5)
    a.path("M20 46 L30 40", 6, 1.3)
    a.ground(90)
    return a


@item("Warped Linen Frame")
def _():
    a = Art()
    a.rect(14, 14, 72, 72, 0, 2.6)
    for x in range(22, 80, 6):
        a.line(x, 14, x, 86, 3, 1.0, 0.75)
    a.rect(14, 70, 72, 6, 6, 1.4)
    for x in range(22, 80, 12):
        a.line(x, 70, x, 76, 6, 1.0)
    a.line(22, 42, 78, 42, 3, 1.6, 0.9)
    a.path("M22 46 L50 46", 3, 1.0, 0.5)
    a.ground(92)
    return a


@item("Plain Weave Linen")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2.2)
    weave_grid(a, 22, 22, 78, 78, 5.6, 3, 1.5, 0.9, "plain")
    a.path("M18 50 L82 50 M50 18 L50 82", -1, 0.9, 0.3)
    a.path("M26 86 L74 86", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Basket Weave Linen")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2.2)
    weave_grid(a, 22, 22, 78, 78, 4.2, 3, 1.4, 0.9, "basket")
    a.path("M18 82 L26 90 L82 90", 3, 1.0, 0.45)
    a.ground(92)
    return a


@item("Herringbone Linen")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2.2)
    for r, y in enumerate(range(24, 78, 10)):
        for c, x in enumerate(range(22, 78, 12)):
            a.path(f"M{x} {y + 8} L{x + 6} {y} L{x + 12} {y + 8}", 3, 1.6, 0.9 if (r + c) % 2 == 0 else 0.6)
    a.ground(90)
    return a


@item("Linen Bandage")
def _():
    a = Art()
    a.ellipse(34, 36, 20, 6, 0, 2.0)
    a.ellipse(34, 60, 20, 6, 0, 2.0)
    a.line(14, 36, 14, 60, 0, 2.0)
    a.line(54, 36, 54, 60, 0, 2.0)
    a.path("M20 40 Q34 46 48 40 M20 46 Q34 52 48 46 M20 52 Q34 58 48 52", 3, 1.0, 0.55)
    a.path("M54 44 C64 40 72 52 80 48 S92 58 88 66 L66 70", 0, 2.0)
    a.path("M56 52 C66 48 72 58 80 56", 3, 1.0, 0.5)
    a.ground(88)
    return a


@item("Folded Linen Dressing")
def _():
    a = Art()
    for i in range(3):
        a.path(f"M{20 + i * 2} {64 - i * 8} L{80 + i * 2} {64 - i * 8} L{84 + i * 2} {58 - i * 8} L{24 + i * 2} {58 - i * 8} Z", 0, 1.8 - i * 0.1)
    a.line(20, 64, 20, 72, 0, 1.8)
    a.line(80, 64, 80, 72, 0, 1.8)
    a.line(20, 72, 80, 72, 0, 1.8)
    weave_grid(a, 24, 66, 76, 70, 3.2, 3, 0.8, 0.5)
    a.path("M30 36 L70 36", 6, 1.4, 0.8)
    a.circle(50, 28, 2, 6, 1.2)
    a.ground(86)
    return a


@item("Sewn Linen Dressing")
def _():
    a = Art()
    a.rect(18, 28, 64, 44, 0, 2.0)
    a.rect(26, 36, 48, 28, 0, 1.2, 0.6)
    for x in range(20, 82, 8):
        a.line(x, 32, x + 4, 32, 6, 1.6)
        a.line(x, 68, x + 4, 68, 6, 1.6)
    a.line(36, 44, 64, 44, 3, 1.0, 0.5)
    a.line(36, 50, 64, 50, 3, 1.0, 0.5)
    a.line(36, 56, 64, 56, 3, 1.0, 0.5)
    a.path("M82 50 L94 42", 6, 1.5)
    a.ground(86)
    return a


@item("Reusable Linen Dressing")
def _():
    a = Art()
    a.rect(14, 30, 48, 36, 0, 2.0)
    for x in range(18, 60, 8):
        a.line(x, 34, x + 4, 34, 6, 1.5)
        a.line(x, 62, x + 4, 62, 6, 1.5)
    weave_grid(a, 20, 40, 56, 56, 3.4, 3, 0.9, 0.5)
    a.path("M70 40 A14 14 0 1 1 70 62", 3, 1.8)
    arrow(a, 70, 62, 62, 64, 3, 1.6, None, 4)
    a.path("M70 40 L76 36 M70 40 L74 46", 3, 1.2, 0.6)
    droplet(a, 80, 74, 3.2)
    a.ground(88)
    return a


@item("Linen Sailcloth")
def _():
    a = Art()
    cloth(a, 14, 22, 72, 56, 0, 2.2, "plain", 5.0)
    a.path("M14 78 Q50 70 86 78", 3, 1.0, 0.4)
    for x in (32, 50, 68):
        a.line(x, 22, x, 78, 6, 1.0, 0.55)
    a.ground(90)
    return a


@item("Reinforced Sailcloth")
def _():
    a = Art()
    cloth(a, 14, 22, 72, 56, 0, 2.2, "plain", 4.6, False)
    a.line(14, 30, 86, 30, 6, 2.4)
    a.line(14, 70, 86, 70, 6, 2.4)
    a.line(22, 22, 22, 78, 6, 2.4)
    a.line(78, 22, 78, 78, 6, 2.4)
    for x in range(18, 84, 6):
        a.line(x, 26, x + 3, 26, 3, 1.0, 0.7)
        a.line(x, 74, x + 3, 74, 3, 1.0, 0.7)
    a.circle(78, 70, 3.4, 6, 1.6)
    a.ground(90)
    return a


@item("Paneled Linen Sail")
def _():
    a = Art()
    sail(a, 22, 20, 74, 22, 82, 0, 0)
    a.path("M22 20 L82 20 L82 74 Q54 80 22 74 Z", 0, 1.8)
    for x in (38, 54, 70):
        a.path(f"M{x} 20 Q{x + 2} 47 {x} 77", 6, 1.5)
        a.path(f"M{x + 2} 21 Q{x + 4} 47 {x + 2} 77", 3, 0.9, 0.5)
    a.line(14, 84, 90, 84, 0, 1.8)
    a.path("M10 90 Q30 86 50 90 T90 90", 3, 1.0, 0.5)
    return a


@item("Reefable Linen Sail")
def _():
    a = Art()
    a.line(22, 14, 22, 82, 0, 2.2)
    a.line(18, 20, 86, 20, 0, 2.2)
    a.path("M26 20 L82 20 L82 70 Q54 76 26 70 Z", 0, 1.8)
    for y in (36, 52):
        a.line(26, y, 82, y, 6, 1.2, 0.8)
        for x in range(32, 82, 10):
            a.line(x, y, x + 1.5, y + 7, 6, 1.4)
            a.line(x, y, x - 1.5, y + 7, 6, 1.4, 0.7)
    a.path("M10 88 Q30 84 50 88 T90 88", 3, 1.0, 0.5)
    return a
