"""Topic 07 - wool manufacture (25)."""
from __future__ import annotations

from .core import Art, arrow, n
from .kit import droplet, sparkle
from .kit_textile import sine_path, twist_marks, weave_grid
from .registry import item, topic
from .t06_linen_textile import bobbin, cloth, tuft

topic("wool manufacture")


def fluff(a, cx, cy, r, z=0, w=1.6, k=7):
    """Cloud-like wool lock: scalloped outline."""
    import math
    pts = []
    d = ""
    for i in range(k):
        a0 = 2 * math.pi * i / k
        a1 = 2 * math.pi * (i + 1) / k
        x0, y0 = cx + r * math.cos(a0), cy + r * 0.7 * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), cy + r * 0.7 * math.sin(a1)
        if i == 0:
            d += f"M{n(x0)} {n(y0)} "
        d += f"A{n(r * 0.45)} {n(r * 0.4)} 0 0 1 {n(x1)} {n(y1)} "
    a.path(d.strip(), z, w)


def stitches(a, x0, y0, x1, y1, step=4.0, z=3, w=1.2, o=0.7):
    y = y0
    r = 0
    while y < y1:
        x = x0 + (step / 2 if r % 2 else 0)
        while x < x1:
            a.path(f"M{n(x)} {n(y)} L{n(x + step / 2)} {n(y + step * 0.8)} L{n(x + step)} {n(y)}", z, w, o)
            x += step
        y += step * 0.8
        r += 1


@item("Carded Animal Wool")
def _():
    a = Art()
    a.rect(14, 38, 30, 14, 0, 2.0, None, 1)
    for x in range(18, 42, 4):
        a.line(x, 52, x, 60, 0, 1.2)
    fluff(a, 70, 34, 14, 0, 1.8)
    fluff(a, 74, 54, 12, 0, 1.4)
    a.path("M16 46 C28 42 36 50 46 46", 3, 1.0, 0.5)
    a.path("M16 40 L44 40", 6, 1.2)
    a.ground(88)
    return a


@item("Wool Roving")
def _():
    a = Art()
    a.path("M14 36 C30 26 44 46 60 36 S84 30 90 40", 0, 2.6)
    a.path("M14 44 C30 34 44 54 60 44 S84 38 90 48", 0, 2.6)
    a.path("M14 40 C30 30 44 50 60 40 S84 34 90 44", 3, 1.0, 0.5)
    a.path("M14 64 C30 58 44 70 60 64 S84 60 90 66", 0, 2.6)
    a.path("M14 72 C30 66 44 78 60 72 S84 68 90 74", 0, 2.6)
    a.path("M16 60 L20 54 M30 62 L34 56 M70 56 L74 50", 3, 1.0, 0.6)
    a.ground(88)
    return a


@item("Woolen Yarn")
def _():
    a = Art()
    bobbin(a, 32, 22, 13, 40, 0, 9)
    sine_path(a, 52, 92, 44, 3.5, 8, 0, 0, 2.2)
    for x in range(54, 92, 5):
        a.line(x, 40, x + 1, 37, 3, 0.9, 0.7)
        a.line(x, 48, x - 1, 51, 3, 0.9, 0.7)
    a.ground(88)
    return a


@item("Worsted Yarn")
def _():
    a = Art()
    bobbin(a, 32, 22, 13, 40, 0, 9)
    a.path("M52 44 C64 40 76 48 92 44", 0, 2.0)
    a.path("M52 48 C64 44 76 52 92 48", 0, 1.2, 0.6)
    twist_marks(a, 54, 90, 46, 3.4, 6, 3, 1.0, 0.7)
    a.line(52, 66, 92, 66, 6, 1.4)
    for x in range(56, 92, 8):
        a.line(x, 62, x, 70, 6, 1.0, 0.7)
    a.ground(88)
    return a


@item("Twist Balanced Wool Yarn")
def _():
    a = Art()
    sine_path(a, 12, 72, 40, 5, 12, 0, 0, 2.0)
    sine_path(a, 12, 72, 40, 5, 12, 3.14, 0, 2.0)
    a.line(76, 28, 90, 28, 3, 1.6)
    a.line(83, 28, 83, 54, 3, 1.6)
    a.line(76, 54, 90, 54, 3, 1.6)
    a.circle(83, 41, 2, 6, 1.2)
    a.path("M16 66 H84", 3, 1.4)
    a.path("M50 66 L50 76 M44 76 H56", 6, 1.4)
    a.ground(90)
    return a


@item("Felt Sheet")
def _():
    a = Art()
    a.path("M16 36 L74 36 L88 24 L30 24 Z", 0, 2.0)
    a.path("M16 36 L16 46 L74 46 L74 36", 0, 2.0)
    a.line(74, 46, 88, 34, 0, 2.0)
    a.line(88, 24, 88, 34, 0, 2.0)
    for k in range(9):
        a.path(f"M{20 + k * 6} {30 + (k % 3)} l3 -1 m4 3 l-3 2", 3, 0.9, 0.55)
    fluff(a, 26, 66, 8, 6, 1.2, 6)
    fluff(a, 50, 70, 7, 6, 1.2, 6)
    arrow(a, 62, 70, 84, 70, 3, 1.2, 0.7)
    a.ground(88)
    return a


@item("Thick Felt Mat")
def _():
    a = Art()
    for i in range(4):
        a.path(f"M{14} {58 - i * 5} L{70} {58 - i * 5} L{86} {46 - i * 5} L{30} {46 - i * 5} Z", 0, 1.8 if i == 3 else 1.2, None if i == 3 else 0.7)
    a.line(14, 58, 14, 66, 0, 2.0)
    a.line(70, 58, 70, 66, 0, 2.0)
    a.line(14, 66, 70, 66, 0, 2.0)
    a.line(70, 66, 86, 54, 0, 2.0)
    a.line(86, 54, 86, 46, 0, 2.0)
    a.path("M30 28 L74 28", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Layered Felt Panel")
def _():
    a = Art()
    for i, y in enumerate((20, 38, 56)):
        a.rect(18 + i * 6, y, 52, 14, 0 if i == 2 else 3, 1.8 if i == 2 else 1.2, None if i == 2 else 0.8)
        a.line(22 + i * 6, y + 7, 66 + i * 6, y + 7, 3, 0.9, 0.5)
    a.line(14, 78, 86, 78, 6, 1.6)
    for x in (22, 50, 78):
        a.circle(x, 78, 2.4, 6, 1.2)
    a.ground(90)
    return a


@item("Stiffened Felt Hat")
def _():
    a = Art()
    a.path("M30 58 Q30 24 50 24 Q70 24 70 58", 0, 2.2)
    a.ellipse(50, 60, 40, 8, 0, 2.2)
    a.path("M30 52 Q50 58 70 52", 3, 1.3, 0.8)
    a.path("M40 32 Q50 28 58 32", 3, 1.0, 0.5)
    a.path("M12 62 Q50 76 88 62", 3, 1.0, 0.5)
    droplet(a, 80, 28, 3)
    sparkle(a, 22, 32, 2.6)
    a.ground(90)
    return a


@item("Wool Cloth")
def _():
    a = Art()
    cloth(a, 18, 24, 64, 52, 0, 2.2, "twill", 4.0)
    fluff(a, 70, 84, 6, 6, 1.0, 6)
    a.ground(90)
    return a


@item("Fulled Wool Cloth")
def _():
    a = Art()
    cloth(a, 22, 28, 56, 44, 0, 2.2, "plain", 3.0, False)
    for x in (10, 90):
        arrow(a, x, 50, 50 + (x - 50) * 0.6, 50, 3, 1.6, None, 4)
    droplet(a, 40, 18, 3.4)
    droplet(a, 60, 16, 2.6)
    droplet(a, 50, 82, 3)
    a.path("M26 76 Q50 82 74 76", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Raised Wool Nap")
def _():
    a = Art()
    a.rect(14, 54, 72, 14, 0, 2.0)
    for x in range(18, 84, 3):
        a.line(x, 54, x + 1.5, 46 + (x % 5) * 0.6, 3, 1.0, 0.7)
    a.path("M70 20 L76 34 M74 18 L80 32 M78 16 L84 30", 6, 1.4)
    a.line(66, 18, 90, 12, 6, 1.8)
    a.line(66, 18, 70, 24, 6, 1.4)
    a.ground(88)
    return a


@item("Sheared Broadcloth")
def _():
    a = Art()
    a.rect(14, 52, 72, 16, 0, 2.0)
    a.line(14, 49, 86, 49, 3, 1.0, 0.5)
    a.path("M20 24 L80 24 L74 40 L26 40 Z", 6, 1.8)
    a.line(20, 24, 26, 40, 3, 1.0, 0.5)
    a.line(32, 20, 32, 24, 6, 1.6)
    a.line(60, 20, 60, 24, 6, 1.6)
    a.line(32, 20, 60, 20, 6, 1.6)
    for x in range(20, 82, 6):
        a.line(x, 56, x + 3, 56, 3, 0.9, 0.5)
        a.line(x, 62, x + 3, 62, 3, 0.9, 0.5)
    a.ground(86)
    return a


@item("Wool Rib Knit")
def _():
    a = Art()
    a.rect(18, 20, 64, 60, 0, 2.2)
    for x in range(24, 80, 8):
        a.path(f"M{x} 22 Q{x + 3} 30 {x} 38 Q{x + 3} 46 {x} 54 Q{x + 3} 62 {x} 70 Q{x + 3} 76 {x} 78", 3, 1.5, 0.9)
    for x in range(28, 80, 16):
        a.line(x, 22, x, 78, 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Knitted Wool Tube")
def _():
    a = Art()
    a.ellipse(50, 24, 22, 7, 0, 2.2)
    a.line(28, 24, 28, 70, 0, 2.2)
    a.line(72, 24, 72, 70, 0, 2.2)
    a.path("M28 70 Q50 82 72 70", 0, 2.2)
    stitches(a, 32, 34, 70, 70, 6, 3, 1.1, 0.6)
    a.path("M30 28 Q50 34 70 28", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Knitted Wool Sock")
def _():
    a = Art()
    a.path("M34 14 L62 14 L62 52 Q80 54 86 64 Q88 74 78 76 L42 76 Q34 74 34 64 Z", 0, 2.2)
    a.line(34, 22, 62, 22, 6, 1.6)
    a.line(34, 28, 62, 28, 6, 1.2, 0.7)
    stitches(a, 36, 32, 60, 52, 4, 3, 1.0, 0.6)
    a.path("M40 64 Q58 70 76 66", 3, 1.0, 0.5)
    a.path("M34 56 Q40 60 44 56", 6, 1.2)
    a.ground(88)
    return a


@item("Ribbed Wool Cuff")
def _():
    a = Art()
    a.ellipse(50, 30, 26, 8, 0, 2.2)
    a.line(24, 30, 24, 62, 0, 2.2)
    a.line(76, 30, 76, 62, 0, 2.2)
    a.path("M24 62 Q50 74 76 62", 0, 2.2)
    for x in range(30, 74, 5):
        a.path(f"M{x} {37 + abs(x - 50) * 0.04} L{x} {68 - abs(x - 50) * 0.12}", 3, 1.3, 0.8 if (x // 5) % 2 else 0.5)
    a.ground(88)
    return a


@item("Woven Wool Blanket")
def _():
    a = Art()
    cloth(a, 14, 24, 72, 52, 0, 2.2, "plain", 4.0, False)
    for x in range(14, 88, 6):
        a.line(x, 76, x, 84, 3, 1.4, 0.8)
    for x in range(14, 88, 6):
        a.line(x, 24, x, 16, 3, 1.4, 0.8)
    a.ground(90)
    return a


@item("Bound Edge Blanket")
def _():
    a = Art()
    a.rect(14, 24, 72, 52, 0, 2.2)
    a.rect(20, 30, 60, 40, 3, 1.2, 0.6)
    weave_grid(a, 24, 34, 76, 66, 4.0, 3, 0.9, 0.5)
    for x in range(14, 86, 6):
        a.line(x, 24, x + 3, 30, 6, 1.2)
        a.line(x, 76, x + 3, 70, 6, 1.2)
    a.ground(90)
    return a


@item("Patterned Wool Blanket")
def _():
    a = Art()
    a.rect(14, 24, 72, 52, 0, 2.2)
    for y in (32, 46, 60):
        a.line(14, y, 86, y, 6, 1.4)
    for x in range(20, 82, 12):
        a.path(f"M{x} 36 L{x + 6} 42 L{x} 48 L{x - 6} 42 Z", 3, 1.2, 0.8)
        a.path(f"M{x} 50 L{x + 6} 56 L{x} 62 L{x - 6} 56 Z", 3, 1.2, 0.6)
    a.ground(90)
    return a


@item("Double Weave Blanket")
def _():
    a = Art()
    a.rect(14, 22, 72, 22, 0, 2.0)
    a.rect(14, 46, 72, 22, 0, 2.0)
    weave_grid(a, 18, 26, 82, 40, 3.6, 3, 0.9, 0.55, "plain")
    weave_grid(a, 18, 50, 82, 64, 3.6, 3, 0.9, 0.55, "basket")
    a.path("M14 44 L86 44", 6, 1.8)
    a.path("M14 68 L86 68", 6, 1.8)
    a.circle(90, 56, 1.4, 6, 1.0)
    a.ground(86)
    return a


@item("Wool Twill")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2.2)
    for k in range(0, 120, 8):
        x0, y0 = 20 + k, 80
        x1, y1 = 20 + k - 60, 20
        pts = [(x0, y0), (x1, y1)]
        from .core import clip_seg
        s = clip_seg(x0, y0, x1, y1, 20, 20, 80, 80)
        if s:
            a.line(*s, z=3, w=1.6, o=0.9)
    a.ground(90)
    return a


@item("Herringbone Twill")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2.2)
    for r, y in enumerate(range(22, 78, 10)):
        for c, x in enumerate(range(22, 78, 14)):
            for j in range(2):
                a.line(x + j * 2, y + 7, x + 7 + j * 2, y, 3, 1.3, 0.9)
                if x + 14 < 78:
                    a.line(x + 7 + j * 2 + 2, y, x + 14 + j * 2 - 3, y + 7, 3, 1.3, 0.55)
    a.line(50, 18, 50, 82, 6, 1.4, 0.8)
    a.ground(90)
    return a


@item("Checked Wool Twill")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2.2)
    for x in (30, 50, 70):
        a.line(x, 18, x, 82, 6, 2.6, 0.9)
    for y in (30, 50, 70):
        a.line(18, y, 82, y, 6, 2.6, 0.9)
    from .core import clip_seg
    for k in range(0, 150, 7):
        s = clip_seg(20 + k, 80, 20 + k - 62, 20, 20, 20, 80, 80)
        if s:
            a.line(*s, z=3, w=0.9, o=0.45)
    a.ground(90)
    return a


@item("Tailored Wool Coat")
def _():
    a = Art()
    a.path("M34 18 L50 30 L66 18 L88 32 L82 52 L72 46 L74 84 L26 84 L28 46 L18 52 L12 32 Z", 0, 2.2)
    a.path("M34 18 L42 34 L50 30 L58 34 L66 18", 3, 1.3, 0.8)
    a.line(50, 30, 50, 84, 3, 1.2, 0.7)
    for y in (46, 58, 70):
        a.circle(46, y, 1.6, 6, 1.3)
        a.circle(54, y, 1.6, 6, 1.3)
    a.rect(30, 62, 10, 8, 3, 1.0, 0.6)
    a.rect(60, 62, 10, 8, 3, 1.0, 0.6)
    stitches(a, 30, 76, 70, 82, 5, 3, 0.9, 0.5)
    a.ground(92)
    return a
