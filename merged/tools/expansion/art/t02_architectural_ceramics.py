"""Topic 02 - architectural ceramics (25)."""
from __future__ import annotations

import math

from .core import Art, arc_front, iso_box, n, poly_d, smooth_d
from .kit import RY, blob, droplet, flame, sparkle
from .registry import item, topic

topic("architectural ceramics")


def brick(a: Art, x: float, y: float, w: float = 30, h: float = 12, d: float = 10, z: int = 0, sw: float | None = None) -> None:
    iso_box(a, x, y, w, h, d, z, sw)


def rhombus(a: Art, cx: float, cy: float, s: float, z: int = 0, w: float | None = None, o: float | None = None,
            squash: float = 0.5) -> list[tuple[float, float]]:
    pts = [(cx, cy - s * squash), (cx + s, cy), (cx, cy + s * squash), (cx - s, cy)]
    a.poly(pts, z, w, o, True)
    return pts


def sun(a: Art, cx: float, cy: float, r: float = 5, z: int = 3) -> None:
    a.circle(cx, cy, r, z, 1.4)
    for k in range(8):
        t = k * math.pi / 4
        a.line(cx + (r + 2) * math.cos(t), cy + (r + 2) * math.sin(t), cx + (r + 5) * math.cos(t), cy + (r + 5) * math.sin(t), z, 1.2, 0.7)


def pipe_h(a: Art, x0: float, x1: float, cy: float, r: float, z: int = 0, w: float | None = None) -> None:
    """Horizontal pipe with open right end visible as an ellipse."""
    a.line(x0, cy - r, x1, cy - r, z, w)
    a.line(x0, cy + r, x1, cy + r, z, w)
    a.ellipse(x1, cy, r * 0.4, r, z, w)
    a.path(f"M{n(x0)} {n(cy - r)} A{n(r * 0.4)} {n(r)} 0 0 0 {n(x0)} {n(cy + r)}", z, w, 0.5)


@item("Architectural Clay Batch")
def _():
    a = Art()
    blob(a, 36, 64, 26, 15, 9, 5, 0.12)
    a.path("M20 62 Q30 56 40 62 M32 72 Q44 66 54 72", 3, 1.1, 0.45)
    # brick mould frame beside the heap
    a.rect(62, 52, 26, 14, 0, 1.8)
    a.line(75, 52, 75, 66, 3, 1.2, 0.5)
    a.line(62, 59, 88, 59, 3, 1.2, 0.5)
    # straw and sand being mixed in
    for k in range(5):
        a.line(24 + k * 5, 38 - k, 31 + k * 5, 34 - k, 3, 1.1, 0.7)
    a.dots([(60, 38), (64, 34), (68, 40), (72, 36), (76, 41)], 1.0, 3)
    droplet(a, 50, 30, 3.2)
    a.ground(86)
    return a


@item("Sun Dried Brick")
def _():
    a = Art()
    sun(a, 78, 24, 5)
    brick(a, 14, 66, 34, 12, 10)
    brick(a, 44, 54, 34, 12, 10, 6)
    brick(a, 52, 70, 26, 10, 8, 0)
    # straw flecks on the brick faces
    for x, y in ((20, 71), (30, 73), (38, 70), (50, 59), (62, 61)):
        a.line(x, y, x + 4, y + 1, 3, 1.0, 0.65)
    a.path("M16 70 L18 72 L16 74", 3, 0.9, 0.4)      # surface crack of drying
    a.ground(88)
    return a


@item("Fired Building Brick")
def _():
    a = Art()
    brick(a, 14, 70, 36, 11, 10)
    brick(a, 50, 70, 36, 11, 10)
    brick(a, 32, 59, 36, 11, 10)
    # stack of fired bricks, with heat marks and a small kiln glow
    a.line(18, 75, 28, 75, 3, 0.9, 0.45)
    a.line(54, 75, 66, 75, 3, 0.9, 0.45)
    a.line(36, 64, 48, 64, 3, 0.9, 0.45)
    flame(a, 20, 46, 12)
    flame(a, 30, 48, 8)
    a.path("M12 50 Q28 54 44 50", 3, 1.0, 0.4)
    sparkle(a, 66, 50, 3)
    a.ground(88)
    return a


@item("Perforated Building Brick")
def _():
    a = Art()
    brick(a, 16, 50, 50, 22, 14, 0, 1.8)
    # round vertical holes seen on the top face
    for k in range(5):
        x = 28 + k * 10
        a.ellipse(x + 3, 50 - 3, 2.6, 1.6, 3, 1.1, 0.8)
    # cores run straight through: faint verticals down the front face
    for k in range(5):
        a.line(31 + k * 10, 53, 31 + k * 10, 71, 6, 0.9, 0.3)
    a.line(20, 66, 62, 66, 3, 0.9, 0.4)
    a.ground(88)
    return a


@item("Hollow Structural Brick")
def _():
    a = Art()
    # end view: a brick with three rectangular cores
    a.rect(14, 34, 72, 38, 0, 2, None, 2)
    for k in range(3):
        a.rect(22 + k * 21, 42, 14, 22, 3, 1.4, None, 1)
    a.line(14, 34, 22, 26, 0)
    a.line(86, 34, 94, 26, 0)
    a.line(22, 26, 94, 26, 0)
    a.line(94, 26, 94, 64, 0)
    a.line(86, 72, 94, 64, 0)
    for k in range(3):
        a.line(24 + k * 21, 46, 24 + k * 21, 60, 6, 0.9, 0.35)
    # load arrows on top
    for x in (30, 50, 70):
        a.line(x, 8, x, 20, 8, 1.4, 0.7)
        a.poly([(x - 3, 17), (x, 21), (x + 3, 17)], 8, 1.2, 0.7)
    a.ground(86, 10, 90)
    return a


@item("Roof Tile Blank")
def _():
    a = Art()
    # damp clay slab on a drying board, being cut to size with a wire / straightedge
    a.poly([(14, 62), (60, 62), (80, 50), (34, 50)], 0, 1.8, close=True)
    a.line(14, 62, 14, 68, 0)
    a.line(60, 62, 60, 68, 0)
    a.line(14, 68, 60, 68, 0)
    a.line(60, 68, 80, 56, 0)
    a.line(80, 56, 80, 50, 0)
    a.line(30, 56, 66, 56, 3, 1.1, 0.45)
    a.line(44, 56, 52, 52, 3, 1.1, 0.35)
    # wooden sizing frame lying across and a cutting knife
    a.line(50, 40, 74, 40, 8, 2.2)
    a.line(74, 40, 82, 32, 8, 2.2)
    a.line(40, 78, 78, 78, 8, 1.4)
    a.line(78, 78, 82, 82, 8, 1.4)
    a.ground(88)
    return a


@item("Flat Roof Tile")
def _():
    a = Art()
    # three overlapping flat tiles in a sloping course with a nib at the top
    for k in range(3):
        y = 30 + k * 18
        a.poly([(18, y + 22), (82, y + 22), (82, y + 6), (18, y + 6)], 0 if k == 2 else 6 - k * 2, None, close=True)
        a.line(26, y + 6, 26, y + 1, 3, 1.4)
        a.line(74, y + 6, 74, y + 1, 3, 1.4)
    a.line(18, 28, 82, 28, 3, 1.0, 0.4)
    a.line(38, 38, 38, 48, 3, 0.9, 0.35)
    a.line(60, 56, 60, 66, 3, 0.9, 0.35)
    a.dots([(32, 74), (50, 76), (68, 74)], 1.0, 3)
    a.ground(90, 10, 90)
    return a


@item("Interlocking Roof Tile")
def _():
    a = Art()
    # top: two tiles seen from above, the right tile's side rib laps over the left tile's channel
    a.poly([(10, 44), (44, 44), (44, 12), (10, 12)], 0, None, close=True)
    a.poly([(40, 44), (74, 44), (74, 12), (40, 12)], 6, None, close=True)
    a.line(16, 12, 16, 44, 3, 1.1, 0.5)
    a.line(46, 12, 46, 44, 3, 1.1, 0.5)
    a.path("M40 12 L40 44", 3, 1.8)
    a.path("M20 18 Q26 26 32 18 M50 18 Q56 26 62 18", 3, 1.0, 0.45)
    # below: cross-section showing rib dropping into the neighbour's channel
    a.path("M8 72 L20 72 L20 64 L28 64 L28 72 L40 72 L40 64 L48 64 L48 72 L60 72 L60 64 L68 64 L68 72 L84 72", 0, 1.8)
    a.path("M8 78 L22 78 L22 70 L26 70 L26 78 L42 78 L42 70 L46 70 L46 78 L62 78 L62 70 L66 70 L66 78 L84 78", 6, 1.2, 0.5)
    a.line(78, 28, 90, 28, 8, 1.3, 0.7)
    a.poly([(86, 25), (91, 28), (86, 31)], 8, 1.2, 0.7)
    a.ground(90)
    return a


@item("Ridge Roof Tile")
def _():
    a = Art()
    # two sloping tile courses meeting at a half-round ridge tile
    a.path("M10 74 L50 38 L90 74", 0)
    a.path("M10 82 L50 46 L90 82", 0, 1.2, 0.5)
    a.path("M36 48 Q50 30 64 48", 0, 2)
    a.path("M36 48 L40 56 M64 48 L60 56", 0)
    a.path("M40 56 Q50 46 60 56", 3, 1.1, 0.5)
    a.path("M30 62 L50 44 L70 62", 3, 1.0, 0.4)
    a.path("M22 70 L50 46 L78 70", 3, 1.0, 0.3)
    for t in range(3):
        a.line(18 + t * 9, 68 - t * 8, 24 + t * 9, 74 - t * 8, 6, 1.0, 0.45)
        a.line(82 - t * 9, 68 - t * 8, 76 - t * 9, 74 - t * 8, 6, 1.0, 0.45)
    a.ground(90)
    return a


@item("Terracotta Drain")
def _():
    a = Art()
    pipe_h(a, 14, 78, 50, 16)
    a.path("M36 34 Q40 50 36 66 M50 34 Q54 50 50 66 M64 34 Q68 50 64 66", 3, 1.1, 0.4)
    for x in (18, 28, 38):
        a.path(f"M{x} 58 Q{x + 3} 62 {x + 6} 58", 3, 0.9, 0.45)
    # water flow through the bore
    a.path("M20 76 Q28 72 36 76 Q44 80 52 76 Q60 72 68 76", 3, 1.4, 0.7)
    a.path("M82 49 L90 49", 8, 1.4, 0.8)
    a.ground(88)
    return a


@item("Socketed Drain Pipe")
def _():
    a = Art()
    # two pipe lengths: left has a flared socket (bell) that receives the right pipe's spigot end
    a.line(12, 38, 46, 38, 0)
    a.line(12, 62, 46, 62, 0)
    a.path("M46 38 L52 32 L58 32 M46 62 L52 68 L58 68", 0)
    a.line(58, 32, 58, 68, 0)
    a.ellipse(12, 50, 4.4, 12, 0)
    a.line(70, 38, 94, 38, 0)
    a.line(70, 62, 94, 62, 0)
    a.line(70, 38, 70, 62, 0)
    a.ellipse(94, 50, 4.4, 12, 0)
    a.line(58, 36, 66, 36, 3, 1.2, 0.6)
    a.line(58, 64, 66, 64, 3, 1.2, 0.6)
    a.poly([(64, 46), (68, 50), (64, 54)], 8, 1.3, 0.8)
    a.line(48, 50, 66, 50, 8, 1.2, 0.5)
    a.path("M24 44 Q28 50 24 56 M34 44 Q38 50 34 56", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Curved Drain Elbow")
def _():
    a = Art()
    # 90-degree elbow: outer and inner arcs, sockets at both ends
    a.path("M14 36 L34 36 A34 34 0 0 1 68 70 L68 90", 0)
    a.path("M14 60 L34 60 A10 10 0 0 1 44 70 L44 90", 0)
    a.ellipse(14, 48, 4, 12, 0)
    a.ellipse(56, 90, 12, 4, 0)
    a.path("M34 48 A22 22 0 0 1 56 70", 3, 1.2, 0.4)
    # arrow of the flow
    a.path("M22 48 L40 48", 3, 1.4, 0.7)
    a.path("M56 62 L56 80", 3, 1.4, 0.7)
    a.poly([(52, 76), (56, 82), (60, 76)], 3, 1.2, 0.7)
    a.poly([(36, 44), (42, 48), (36, 52)], 3, 1.2, 0.7)
    a.ground(94, 10, 90)
    return a


@item("Buried Drain Junction")
def _():
    a = Art()
    # ground line with hatch, T-junction pipe beneath, riser to the surface
    a.line(8, 30, 92, 30, 0, 1.6)
    a.hatch(8, 30, 92, 38, 4, 1, 3, 0.9, 0.3)
    a.line(14, 52, 86, 52, 0)
    a.line(14, 72, 86, 72, 0)
    a.line(42, 52, 42, 30, 0)
    a.line(60, 52, 60, 30, 0)
    a.ellipse(14, 62, 4, 10, 0)
    a.ellipse(86, 62, 4, 10, 0)
    a.ellipse(51, 30, 9, 3, 0)
    a.path("M20 62 L38 62 M64 62 L80 62", 3, 1.3, 0.6)
    a.path("M51 58 L51 36", 3, 1.3, 0.6)
    a.poly([(47, 40), (51, 35), (55, 40)], 3, 1.2, 0.7)
    a.dots([(22, 42), (74, 44), (30, 80), (68, 80)], 1.0, 3)
    a.ground(90)
    return a


@item("Floor Paver")
def _():
    a = Art()
    rhombus(a, 50, 54, 36, 0, 1.8, None, 0.5)
    a.line(14, 54, 14, 62, 0)
    a.line(86, 54, 86, 62, 0)
    a.path("M14 62 L50 80 L86 62", 0)
    a.line(50, 72, 50, 80, 0)
    # laying bed of sand under and joints
    a.path("M30 54 L50 64 L70 54 L50 44Z", 3, 1.0, 0.35)
    a.path("M8 80 Q30 90 50 90 Q72 90 92 80", 3, 1.0, 0.35)
    a.dots([(20, 84), (34, 88), (66, 88), (80, 84)], 0.9, 3)
    a.ground(94, 12, 88)
    return a


@item("Patterned Paver")
def _():
    a = Art()
    rhombus(a, 50, 50, 38, 0, 1.8, None, 0.5)
    a.line(12, 50, 12, 58, 0)
    a.line(88, 50, 88, 58, 0)
    a.path("M12 58 L50 77 L88 58", 0)
    # inlaid diamond lattice + central rosette
    for s, o in ((28, 0.6), (18, 0.5), (8, 0.7)):
        rhombus(a, 50, 50, s, 3, 1.1, o, 0.5)
    for k in range(8):
        t = k * math.pi / 4
        a.line(50 + 4 * math.cos(t), 50 + 2 * math.sin(t), 50 + 12 * math.cos(t), 50 + 6 * math.sin(t), 3, 1.0, 0.5)
    a.dots([(24, 50), (76, 50), (50, 34), (50, 66)], 1.0, 3)
    a.ground(92, 12, 88)
    return a


@item("Glazed Floor Paver")
def _():
    a = Art()
    rhombus(a, 50, 54, 36, 0, 1.8, None, 0.5)
    a.line(14, 54, 14, 62, 0)
    a.line(86, 54, 86, 62, 0)
    a.path("M14 62 L50 80 L86 62", 0)
    rhombus(a, 50, 54, 28, 3, 1.1, 0.45, 0.5)
    a.path("M34 48 L48 41", 3, 1.8, 0.85)
    a.path("M38 52 L56 43", 3, 1.0, 0.5)
    sparkle(a, 66, 52, 3.4)
    sparkle(a, 38, 60, 2.2)
    a.path("M16 64 Q50 78 84 64", 3, 1.0, 0.4)
    a.ground(94, 12, 88)
    return a


@item("Non Slip Ceramic Paver")
def _():
    a = Art()
    rhombus(a, 50, 50, 38, 0, 1.8, None, 0.5)
    a.line(12, 50, 12, 58, 0)
    a.line(88, 50, 88, 58, 0)
    a.path("M12 58 L50 77 L88 58", 0)
    # raised grip studs in a staggered grid, plus a little shoe-sole arrow
    for r_ in range(5):
        for c in range(6):
            x = 26 + c * 9 + (4.5 if r_ % 2 else 0)
            y = 41 + r_ * 4.6
            if abs(x - 50) / 36 + abs(y - 50) / 18 < 0.85:
                a.circle(x, y, 1.3, 3, 1.0, 0.8)
    a.path("M80 20 Q86 22 84 30 L76 30 Q72 24 80 20Z", 8, 1.3, 0.8)
    a.ground(94, 12, 88)
    return a


@item("Decorative Tile")
def _():
    a = Art()
    a.rect(18, 18, 64, 64, 0, 2, None, 3)
    a.rect(24, 24, 52, 52, 3, 1.1, 0.45, 2)
    # four-petal flower with stem cross, corners dotted
    for k in range(4):
        t = k * math.pi / 2
        cx, cy = 50 + 11 * math.cos(t), 50 + 11 * math.sin(t)
        a.ellipse(cx, cy, 8, 4.4, 3, 1.3, 0.85, k * 90)
    a.circle(50, 50, 4, 3, 1.4)
    a.dot(50, 50, 1.4, 6)
    a.dots([(29, 29), (71, 29), (29, 71), (71, 71)], 1.4, 3)
    a.path("M24 40 Q32 44 28 52 M76 60 Q68 56 72 48", 3, 1.0, 0.4)
    a.ground(92, 12, 88)
    return a


@item("Relief Wall Tile")
def _():
    a = Art()
    a.rect(16, 20, 64, 58, 0, 2, None, 2)
    a.line(80, 20, 90, 14, 0)
    a.line(80, 78, 90, 70, 0)
    a.line(90, 14, 90, 70, 0)
    a.line(16, 20, 26, 14, 0, 1.2, 0.5)
    a.line(26, 14, 90, 14, 0)
    # raised relief: a bird/leaf scroll with a drop-shadow offset
    a.path("M34 56 Q40 36 58 38 Q70 40 66 52 Q58 48 52 56 Q46 64 34 56Z", 6, 1.8)
    a.path("M38 58 Q44 40 60 42 Q70 44 68 54", 3, 1.0, 0.4)
    a.path("M42 52 Q50 46 58 46", 6, 1.2, 0.5)
    a.circle(60, 44, 1.6, 6, 1.0)
    a.path("M24 68 L72 68", 3, 1.0, 0.35)
    a.path("M70 72 L78 72", 3, 1.0, 0.35)
    a.ground(90)
    return a


@item("Colored Mosaic Tile")
def _():
    a = Art()
    a.rect(14, 18, 72, 64, 0, 2, None, 2)
    # grid of small tesserae, some filled dots to read as colours
    for r_ in range(6):
        for c in range(7):
            x = 17.4 + c * 9.6
            y = 21 + r_ * 9.8
            a.rect(x, y, 8.4, 8.6, 3, 0.9, 0.55, 1)
            if (r_ + c) % 3 == 0:
                a.dot(x + 4.2, y + 4.3, 1.6, 6)
            elif (r_ * 2 + c) % 5 == 0:
                a.line(x + 1.4, y + 1.4, x + 7, y + 7, 6, 0.9, 0.5)
    a.ground(92)
    return a


@item("Geometric Tile Panel")
def _():
    a = Art()
    # 2x2 panel of tiles whose quarters join into a star-and-octagon motif
    a.rect(14, 14, 72, 72, 0, 2, None, 2)
    a.line(50, 14, 50, 86, 0, 1.6)
    a.line(14, 50, 86, 50, 0, 1.6)
    c = (50, 50)
    pts = []
    for k in range(16):
        t = k * math.pi / 8 - math.pi / 2
        r = 26 if k % 2 == 0 else 13
        pts.append((c[0] + r * math.cos(t), c[1] + r * math.sin(t)))
    a.poly(pts, 6, 1.6, close=True)
    a.circle(50, 50, 6, 3, 1.2, 0.6)
    for (x, y) in ((24, 24), (76, 24), (24, 76), (76, 76)):
        a.poly([(x, y - 6), (x + 6, y), (x, y + 6), (x - 6, y)], 3, 1.1, 0.55, True)
    a.ground(92)
    return a


@item("Refractory Brick")
def _():
    a = Art()
    brick(a, 14, 52, 52, 24, 14, 0, 1.8)
    # heat shimmer and ember glow above the face, grog flecks on the surface
    a.path("M24 40 Q28 34 24 28 Q20 22 24 16 M40 40 Q44 34 40 28 Q36 22 40 16 M56 40 Q60 34 56 28 Q52 22 56 16", 3, 1.2, 0.5)
    a.dots([(24, 62), (36, 66), (48, 60), (56, 68), (30, 70)], 1.1, 3, 0.9)
    a.line(18, 58, 62, 58, 3, 0.9, 0.35)
    flame(a, 80, 62, 16, 6)
    flame(a, 72, 68, 10, 6)
    a.ground(90)
    return a


@item("Firebox Lining Brick")
def _():
    a = Art()
    # semicircular firebox lined with bricks, flame at the centre
    a.path("M12 78 L12 54 A38 36 0 0 1 88 54 L88 78", 0, 1.8)
    a.path("M24 78 L24 56 A26 26 0 0 1 76 56 L76 78", 0)
    for k in range(9):
        t = math.pi + k * math.pi / 8
        a.line(50 + 26 * math.cos(t), 56 + 26 * math.sin(t), 50 + 38 * math.cos(t), 54 + 36 * math.sin(t), 3, 1.1, 0.6)
    for y in (62, 70):
        a.line(12, y, 24, y, 3, 1.1, 0.6)
        a.line(76, y, 88, y, 3, 1.1, 0.6)
    flame(a, 50, 78, 22, 6, 1.8)
    flame(a, 38, 78, 12, 6)
    flame(a, 62, 78, 12, 6)
    a.line(12, 78, 88, 78, 0)
    a.ground(90)
    return a


@item("Insulated Furnace Brick")
def _():
    a = Art()
    brick(a, 14, 44, 56, 30, 14, 0, 1.8)
    # porous cells: many small circles of different sizes inside the front face
    cells = [(22, 52, 3), (34, 58, 2.2), (46, 52, 2.8), (58, 60, 3.2), (26, 66, 2.4), (40, 68, 3), (52, 70, 2), (62, 52, 2),
             (30, 52, 1.6), (48, 62, 1.8), (20, 60, 1.8), (62, 68, 1.6)]
    for x, y, r in cells:
        a.circle(x, y, r, 3, 1.0, 0.7)
    # heat arrows stopping at the brick
    a.line(86, 52, 78, 52, 8, 1.6, 0.8)
    a.line(86, 62, 78, 62, 8, 1.6, 0.8)
    a.poly([(81, 49), (77, 52), (81, 55)], 8, 1.2, 0.8)
    a.poly([(81, 59), (77, 62), (81, 65)], 8, 1.2, 0.8)
    a.line(12, 20, 40, 20, 8, 1.4, 0.4)
    a.ground(90)
    return a


@item("High Alumina Furnace Brick")
def _():
    a = Art()
    brick(a, 12, 46, 50, 28, 16, 0, 1.8)
    # hex crystal lattice and fired-grain sparkle across the face
    for r_ in range(3):
        for c in range(4):
            x = 20 + c * 10 + (5 if r_ % 2 else 0)
            y = 54 + r_ * 7
            pts = [(x + 4 * math.cos(k * math.pi / 3), y + 3.6 * math.sin(k * math.pi / 3)) for k in range(6)]
            a.poly(pts, 3, 0.9, 0.55, True)
    # crucible with molten surface
    a.path("M70 40 L74 70 L90 70 L94 40", 6, 1.6)
    a.ellipse(82, 40, 12, 3.2, 6, 1.4)
    a.path("M72 44 Q82 48 92 44", 6, 1.0, 0.5)
    sparkle(a, 82, 30, 3)
    a.ground(90)
    return a
