"""Topic 05 - cordage and rope (25)."""
from __future__ import annotations

import math

from .core import Art, arc_front, arrow, clip_seg, n, smooth_d
from .kit import RY, droplet, sparkle
from .kit_textile import (chevron_braid, diamond_mesh, knot, rope_outline, sine_path, square_mesh, strands_h, twist_marks,
                          wrap_turns)
from .registry import item, topic

topic("cordage and rope")


@item("Prepared Plant Bast")
def _():
    a = Art()
    # plant stem with a long strip peeled off, and a tied bundle of cleaned bast ribbons
    a.path("M16 84 L16 24 Q16 14 22 12", 0, 1.8)
    a.path("M26 84 L26 30", 0, 1.8)
    a.path("M16 24 Q10 18 8 10 Q16 12 20 18", 3, 1.2, 0.6)
    a.path("M26 34 C34 30 40 38 46 32 C54 26 58 40 66 34", 0, 1.8)
    a.path("M26 44 C34 40 40 48 46 42 C54 36 58 50 66 44", 0, 1.2, 0.55)
    for x in (62, 68, 74, 80, 86):
        a.path(f"M{x} 54 Q{x + 2} 70 {x} 86", 0, 1.3)
    a.line(60, 66, 90, 66, 6, 2.4)
    a.line(60, 70, 90, 70, 6, 1.4, 0.6)
    droplet(a, 40, 70, 3)
    droplet(a, 48, 78, 2.2)
    a.ground(90)
    return a


@item("Twisted Bast Strand")
def _():
    a = Art()
    rope_outline(a, 14, 80, 48, 5.5, 0, 1.8, False)
    twist_marks(a, 16, 78, 48, 5.5, 7, 3, 1.4, 0.8)
    # frayed unspun ends
    for k in range(4):
        a.path(f"M14 {42 + k * 4} Q8 {40 + k * 5} 4 {38 + k * 7}", 0, 1.1, 0.7)
    for k in range(3):
        a.path(f"M80 {44 + k * 4} Q86 {44 + k * 5} 90 {42 + k * 7}", 0, 1.1, 0.7)
    # fingers rolling the fibre against the thigh: curved arrow
    a.path("M30 70 Q46 80 62 70", 8, 1.4, 0.7)
    a.poly([(58, 66), (63, 70), (57, 73)], 8, 1.2, 0.7)
    a.line(26, 64, 66, 64, 3, 1.0, 0.35)
    a.ground(90)
    return a


@item("Two Ply Cord")
def _():
    a = Art()
    # two strands unspun at the left, twisted together across the right
    sine_path(a, 36, 88, 50, 6, 16, 0, 0, 1.8)
    sine_path(a, 36, 88, 50, 6, 16, math.pi, 0, 1.8)
    twist_marks(a, 38, 86, 50, 6, 16, 3, 1.0, 0.4)
    a.path("M36 44 Q26 36 12 38", 0, 1.8)
    a.path("M36 56 Q26 64 12 62", 0, 1.8)
    a.path("M16 40 L22 40 M16 60 L22 60", 3, 1.0, 0.45)
    a.circle(12, 38, 1.6, 6, 1.2)
    a.circle(12, 62, 1.6, 6, 1.2)
    arrow(a, 40, 76, 74, 76, 8, 1.4, 0.6)
    a.ground(90)
    return a


@item("Three Ply Cord")
def _():
    a = Art()
    for k in range(3):
        sine_path(a, 14, 86, 50, 7, 18, 2 * math.pi * k / 3, 0, 1.8 if k == 0 else 1.5, None if k == 0 else 0.85)
    twist_marks(a, 16, 84, 50, 7, 18, 3, 1.0, 0.35)
    # cross-section of the three plies
    for (x, y) in ((24, 78), (32, 78), (28, 71)):
        a.circle(x, y, 4, 6, 1.4)
    a.dots([(78, 76), (84, 76), (81, 71)], 1.6, 6)
    a.ground(92)
    return a


@item("Hawser Laid Rope")
def _():
    a = Art()
    # heavy diagonal hawser: three big strands laid left-hand around a core, end in section
    for k in range(3):
        sine_path(a, 10, 78, 46, 10, 22, 2 * math.pi * k / 3, 0, 2.2 if k == 0 else 1.8, None if k == 0 else 0.9)
    a.line(10, 36, 78, 36, 0, 1.2, 0.35)
    a.line(10, 56, 78, 56, 0, 1.2, 0.35)
    a.ellipse(78, 46, 5, 11, 0, 1.8)
    for (x, y) in ((77, 42), (80, 49), (75, 50)):
        a.circle(x, y, 2.6, 3, 1.1, 0.8)
    # yarns within a strand, shown as a little inset
    a.circle(24, 78, 10, 8, 1.4)
    for (dx, dy) in ((0, -4), (-4, 2), (4, 2), (0, 2)):
        a.circle(24 + dx, 78 + dy, 2, 8, 1.0, 0.7)
    a.path("M40 72 Q56 84 72 74", 3, 1.2, 0.5)
    a.ground(94)
    return a


@item("Braided Plant Cord")
def _():
    a = Art()
    chevron_braid(a, 12, 88, 46, 9, 7.5, 0, 1.6)
    a.path("M12 38 L12 54", 0, 1.4)
    a.path("M88 38 L88 54", 0, 1.4)
    # the three working strands lifted off at the left with numbers as dots
    a.path("M12 40 Q6 34 4 24", 0, 1.4)
    a.path("M12 46 Q4 46 2 40", 0, 1.4)
    a.path("M12 52 Q6 58 4 68", 0, 1.4)
    a.dots([(4, 24), (2, 40), (4, 68)], 1.2, 3)
    arrow(a, 30, 70, 70, 70, 8, 1.3, 0.55)
    a.ground(90)
    return a


@item("Flat Plaited Cord")
def _():
    a = Art()
    # five-strand flat plait: alternating slanted bands
    a.line(10, 36, 90, 36, 0, 1.6)
    a.line(10, 62, 90, 62, 0, 1.6)
    for k in range(10):
        x = 12 + k * 8
        a.path(f"M{x} 36 L{x + 10} 62", 0 if k % 2 == 0 else 3, 1.6 if k % 2 == 0 else 1.2, None if k % 2 == 0 else 0.7)
        a.path(f"M{x + 10} 36 L{x} 62", 6 if k % 2 == 0 else 3, 1.3, 0.6)
    a.path("M8 36 L8 62 M92 36 L92 62", 0, 1.2, 0.5)
    for y in (42, 49, 56):
        a.line(10, y, 90, y, 3, 0.8, 0.22)
    a.ground(86)
    return a


@item("Round Braided Cord")
def _():
    a = Art()
    # round braid: criss-cross diagonals inside a tube
    a.line(10, 40, 80, 40, 0, 1.8)
    a.line(10, 60, 80, 60, 0, 1.8)
    a.ellipse(80, 50, 4, 10, 0, 1.8)
    x = 10
    while x < 76:
        a.line(x, 40, x + 10, 60, 3, 1.4, 0.9)
        a.line(x + 10, 40, x, 60, 6, 1.2, 0.7)
        x += 10
    a.circle(86, 78, 8, 8, 1.4)
    a.circle(86, 78, 3, 8, 1.2, 0.6)
    for k in range(6):
        t = k * math.pi / 3
        a.dot(86 + 6 * math.cos(t), 78 + 6 * math.sin(t), 1.2, 8)
    a.ground(90)
    return a


@item("Eight Strand Braid")
def _():
    a = Art()
    # square braid: lattice of small diamonds, 8 strands shown as numbered end dots
    a.rect(10, 38, 66, 24, 0, 1.8)
    for k in range(7):
        x = 10 + k * 11
        a.poly([(x, 50), (x + 5.5, 38), (x + 11, 50), (x + 5.5, 62)], 3, 1.2, 0.8, True)
    a.line(10, 50, 76, 50, 6, 1.0, 0.4)
    # cross-section: 8 strands around a square
    a.rect(80, 70, 12, 12, 8, 1.4)
    for (x, y) in ((80, 70), (86, 70), (92, 70), (92, 76), (92, 82), (86, 82), (80, 82), (80, 76)):
        a.circle(x, y, 2.2, 8, 1.2)
    a.path("M12 28 L20 22 M76 28 L68 22", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Fiber Fishing Line")
def _():
    a = Art()
    # rod tip top-left, line drooping to a hook and float on the waterline
    a.line(6, 20, 40, 12, 0, 2.2)
    a.path("M40 12 Q70 16 76 52", 0, 1.2)
    a.circle(76, 56, 3.4, 0, 1.6)
    a.line(76, 52.6, 76, 59.4, 3, 1.0, 0.6)
    a.path(smooth_d([(8, 62), (22, 59), (38, 63), (54, 59), (70, 63), (92, 60)]), 3, 1.3, 0.6)
    a.path("M76 60 L76 74 Q76 82 82 80 Q88 78 86 72", 0, 1.6)
    a.poly([(86, 72), (89, 68), (84, 69)], 6, 1.2, None, True)
    a.path("M20 72 Q30 66 40 72 Q30 78 20 72Z M40 72 L46 68 L46 76Z", 8, 1.2, 0.5)
    a.dots([(26, 71)], 1.0, 8)
    a.ground(90, 10, 90)
    return a


@item("Twined Fishing Leader")
def _():
    a = Art()
    # main line ends in a loop-to-loop join; a short twined leader carries the hook
    a.path("M8 36 L36 36", 0, 1.8)
    a.circle(40, 36, 4, 0, 1.6)
    a.circle(46, 36, 4, 0, 1.6)
    sine_path(a, 50, 82, 36, 2.6, 7, 0, 0, 1.6)
    sine_path(a, 50, 82, 36, 2.6, 7, math.pi, 0, 1.6)
    a.path("M82 36 Q92 36 92 46 Q92 62 84 66 Q78 68 78 62", 0, 1.8)
    a.poly([(78, 62), (74, 58), (80, 58)], 6, 1.2, None, True)
    a.path("M24 56 Q34 50 44 56 Q34 62 24 56Z M44 56 L50 52 L50 60Z", 8, 1.2, 0.5)
    a.line(12, 80, 88, 80, 3, 1.0, 0.35)
    a.ground(90)
    return a


@item("Knotted Net Cord")
def _():
    a = Art()
    a.path(smooth_d([(8, 52), (22, 46), (36, 54), (50, 46), (64, 54), (78, 46), (92, 52)]), 0, 1.8)
    for x, y in ((22, 46.6), (36, 53.4), (50, 46.6), (64, 53.4), (78, 46.6)):
        knot(a, x, y, 3.2, 0, 1.6)
    # a single sheet-bend-like knot enlarged below
    a.path("M30 78 C30 66 50 66 50 76 C50 88 34 88 40 78 C44 72 60 72 66 80", 8, 1.6)
    a.circle(40, 78, 1.0, 8, 1.0, 0.7)
    a.ground(92)
    return a


@item("Net Repair Cord")
def _():
    a = Art()
    diamond_mesh(a, 10, 14, 66, 82, 12, 0, 1.4, 0.85)
    # torn gap: a hole with loose ends, and the mending needle trailing new cord
    a.path("M30 38 L40 44 L34 52 L24 48Z", 6, 1.6)
    a.path("M34 46 L42 52 M28 44 L22 38", 3, 1.0, 0.5)
    a.path("M76 24 L88 36 L82 40 L70 28Z", 8, 1.6)
    a.circle(74, 28, 1.6, 8, 1.0)
    a.path("M70 28 Q56 40 44 46 Q36 50 34 46", 8, 1.4, 0.8)
    a.path("M20 70 L40 70", 3, 1.0, 0.3)
    a.ground(90, 10, 90)
    return a


@item("Plant Binding Strip")
def _():
    a = Art()
    # a flat leaf strip wound spirally around a bundle of reeds
    for x in (30, 38, 46, 54, 62, 70):
        a.path(f"M{x} 12 L{x} 88", 0, 1.6)
    for k in range(6):
        y = 28 + k * 10
        a.poly([(28, y + 6), (72, y - 2), (72, y + 3), (28, y + 11)], 6, 1.4, close=True)
    a.path("M72 22 Q82 18 88 26 Q84 32 76 30", 8, 1.6)
    a.path("M28 78 Q16 82 12 76", 8, 1.6)
    a.ground(92)
    return a


@item("Wrapped Lash")
def _():
    a = Art()
    # two poles side by side bound with a run of turns, then two frapping turns between them
    a.rect(36, 10, 10, 80, 0, 1.8)
    a.rect(54, 10, 10, 80, 0, 1.8)
    for k in range(7):
        y = 26 + k * 6.2
        a.line(34, y + 4, 66, y, 6, 2.2)
        a.line(34, y + 4.6, 66, y + 0.6, 3, 1.0, 0.4)
    a.path("M46 28 L54 28 M46 52 L54 52", 8, 2.2)
    a.path("M30 28 Q24 22 22 14 M70 52 Q76 56 80 66", 8, 1.6)
    a.dots([(22, 14), (80, 66)], 1.2, 3)
    a.ground(92, 20, 80)
    return a


@item("Cross Lash")
def _():
    a = Art()
    # square lashing: vertical and horizontal pole, cord goes round both in a square
    a.rect(44, 8, 12, 84, 0, 1.8)
    a.rect(8, 44, 84, 12, 0, 1.8)
    for k in range(4):
        d = k * 2.2
        a.rect(35 + d, 35 + d, 30 - 2 * d, 30 - 2 * d, 6, 1.7 - k * 0.1, None, 1)
    a.line(50, 35, 50, 65, 8, 1.2, 0.5)
    a.line(35, 50, 65, 50, 8, 1.2, 0.5)
    a.path("M65 40 Q78 34 82 24", 8, 1.5)
    a.circle(82, 24, 1.4, 8, 1.2)
    a.ground(94, 20, 80)
    return a


@item("Diagonal Lash")
def _():
    a = Art()
    # two poles crossing at an angle, cord wrapped diagonally to draw them together
    a.poly([(14, 22), (22, 14), (88, 78), (80, 86)], 0, 1.8, close=True)
    a.poly([(84, 20), (92, 28), (28, 86), (20, 78)], 0, 1.8, close=True)
    for k in range(4):
        d = k * 3.2
        a.path(f"M{n(40 + d)} {n(40 + d)} L{n(62 - d)} {n(58 - d)}", 6, 1.8)
        a.path(f"M{n(42 + d)} {n(58 - d)} L{n(60 - d)} {n(40 + d)}", 8, 1.8)
    a.path("M46 50 L54 50", 8, 2.0)
    a.path("M54 50 Q62 56 66 66", 8, 1.5)
    a.circle(66, 66, 1.4, 8, 1.2)
    a.ground(94, 20, 80)
    return a


@item("Fiber Carry Loop")
def _():
    a = Art()
    # a twisted loop carrying a bundle of sticks: loop over a shoulder-arc handle
    for x in (28, 36, 44, 52, 60):
        a.line(x, 54, x + 4, 88, 0, 1.6)
    a.line(24, 66, 68, 62, 6, 2.6)
    a.line(24, 70, 68, 66, 3, 1.0, 0.4)
    a.path("M24 66 C10 66 10 30 40 22 C70 14 80 40 68 62", 0, 1.8)
    a.path("M24 70 C14 66 14 34 40 26 C66 18 74 42 68 66", 3, 1.1, 0.5)
    for t in (0.2, 0.4, 0.6, 0.8):
        x = 24 + (68 - 24) * t
    a.dots([(40, 24)], 1.2, 8)
    a.ground(94, 14, 86)
    return a


@item("Simple Sling")
def _():
    a = Art()
    # pouch with a stone, two cords, motion arc
    a.path("M34 54 Q50 48 66 54 Q64 66 50 68 Q36 66 34 54Z", 0, 1.8)
    a.path("M34 54 Q16 38 20 18", 0, 1.8)
    a.path("M66 54 Q84 38 80 18", 0, 1.8)
    a.circle(20, 16, 2.2, 6, 1.4)
    a.circle(80, 16, 2.2, 6, 1.4)
    a.ellipse(50, 56, 5.4, 3.6, 6, 1.6, None, -12)
    a.path("M38 58 Q50 62 62 58", 3, 1.0, 0.45)
    a.path("M8 40 Q50 4 92 40", 8, 1.2, 0.4)
    a.poly([(88, 34), (93, 40), (86, 41)], 8, 1.1, 0.5)
    a.dots([(86, 68), (92, 62)], 1.2, 8)
    a.ground(90)
    return a


@item("Woven Carry Strap")
def _():
    a = Art()
    a.path("M8 36 L84 36 L92 50 L84 64 L8 64", 0, 1.8)
    a.line(8, 36, 8, 64, 0, 1.8)
    # herringbone weave along the strap
    x = 12
    while x < 80:
        a.path(f"M{x} 40 L{x + 5} 50 L{x} 60", 3, 1.1, 0.8)
        a.path(f"M{x + 6} 40 L{x + 11} 50 L{x + 6} 60", 3, 1.1, 0.5)
        x += 12
    # end loop stitched
    a.circle(88, 50, 3.4, 6, 1.4)
    a.line(14, 70, 78, 70, 3, 1.0, 0.35)
    a.ground(90)
    return a


@item("Adjustable Carry Strap")
def _():
    a = Art()
    # strap with a sliding wrapped collar that lengthens or shortens the loop
    a.path("M8 30 L70 30 Q86 30 86 46 Q86 62 70 62 L8 62", 0, 1.8)
    a.path("M8 38 L66 38 Q78 38 78 46 Q78 54 66 54 L8 54", 3, 1.1, 0.5)
    a.rect(30, 26, 10, 40, 6, 1.8, None, 2)
    for k in range(3):
        a.line(32 + k * 3, 28, 32 + k * 3, 64, 8, 1.0, 0.6)
    arrow(a, 24, 78, 62, 78, 8, 1.3, 0.6)
    arrow(a, 62, 84, 24, 84, 8, 1.3, 0.4)
    a.ground(94, 10, 90)
    return a


@item("Cord Net Mesh")
def _():
    a = Art()
    a.line(8, 18, 92, 18, 0, 2.2)
    diamond_mesh(a, 12, 18, 88, 84, 11, 0, 1.4, 0.9)
    a.circle(10, 18, 2, 3, 1.2)
    a.circle(90, 18, 2, 3, 1.2)
    a.path("M12 18 L12 84 M88 18 L88 84", 3, 1.0, 0.3)
    a.ground(94, 10, 90)
    return a


@item("Knotted Fishing Mesh")
def _():
    a = Art()
    a.line(8, 28, 92, 28, 0, 2.0)
    for x in range(14, 90, 12):
        a.circle(x, 24, 3, 6, 1.4)                         # floats
    diamond_mesh(a, 10, 28, 90, 72, 14, 0, 1.3, 0.85, True)
    for x in range(16, 90, 14):
        a.rect(x - 2.2, 72, 4.4, 5, 6, 1.3, None, 1)       # sinkers
        a.line(x, 72, x, 70, 6, 1.0)
    a.ground(90, 8, 92)
    return a


@item("Square Net Panel")
def _():
    a = Art()
    a.rect(12, 14, 76, 72, 0, 2.2)
    square_mesh(a, 18, 20, 82, 80, 8, 0, 1.2, 0.8)
    for (x, y) in ((12, 14), (88, 14), (12, 86), (88, 86)):
        a.circle(x, y, 2.6, 6, 1.4)
    a.path("M12 14 L18 20 M88 14 L82 20 M12 86 L18 80 M88 86 L82 80", 3, 1.0, 0.5)
    a.dots([(50, 50)], 1.4, 8)
    a.ground(94, 10, 90)
    return a


@item("Large Seine Net")
def _():
    a = Art()
    # a big bowed seine: float line above, lead line below, two haul ropes
    a.path("M10 30 Q50 14 90 30", 0, 2)
    a.path("M12 72 Q50 90 88 72", 0, 2)
    diamond_mesh(a, 14, 28, 86, 76, 10, 0, 1.0, 0.45)
    for t in (0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.94):
        x = 10 + 80 * t
        y = 30 - 16 * (1 - (2 * t - 1) ** 2) * 0.8 - 0.5
        a.circle(x, y - 2, 2.2, 6, 1.2)
    for t in (0.14, 0.3, 0.46, 0.62, 0.78, 0.9):
        x = 12 + 76 * t
        y = 72 + 18 * (1 - (2 * t - 1) ** 2) * 0.55
        a.rect(x - 1.6, y + 1, 3.2, 4, 6, 1.1, None, 0.6)
    a.path("M10 30 Q4 44 6 70 M90 30 Q96 44 94 70", 8, 1.8)
    a.path("M6 70 L2 90 M94 70 L98 90", 8, 1.4, 0.6)
    a.ground(95, 6, 94)
    return a
