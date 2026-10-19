"""Topic 04 - timber joinery (25)."""
from __future__ import annotations

import math

from .core import Art, arc_front, iso_box, n, poly_d
from .kit import RY, sparkle
from .registry import item, topic

topic("timber joinery")


def grain(a: Art, x0: float, y0: float, x1: float, y1: float, count: int = 3, z: int = 3, o: float = 0.4) -> None:
    for k in range(count):
        y = y0 + (y1 - y0) * (k + 1) / (count + 1)
        a.path(f"M{n(x0)} {n(y)} Q{n((x0 + x1) / 2)} {n(y + (2 if k % 2 else -2))} {n(x1)} {n(y)}", z, 0.9, o)


def beam(a: Art, x: float, y: float, w: float, h: float, d: float = 6, z: int = 0, sw: float | None = None, g: int = 2) -> None:
    iso_box(a, x, y, w, h, d, z, sw)
    grain(a, x + 2, y, x + w - 2, y + h, g)


def peg_v(a: Art, x: float, y0: float, y1: float, z: int = 6, w: float = 1.8) -> None:
    a.line(x, y0, x, y1, z, w)
    a.ellipse(x, y0, 1.8, 0.9, z, 1.2)


@item("Seasoned Construction Timber")
def _():
    a = Art()
    # squared timbers stacked on spacers (stickers), end-grain checks, air flow arrows
    for k, y in enumerate((60, 44)):
        iso_box(a, 14, y, 54, 12, 12, 0, 1.8)
        a.path(f"M16 {y + 6} Q40 {y + 4} 66 {y + 7}", 3, 0.9, 0.45)
    for x in (22, 50):
        a.rect(x, 72, 5, 6, 0, 1.4)
        a.rect(x, 56, 5, 4, 3, 1.2, 0.6)
    # end-grain rings with a drying check
    a.rect(70, 44, 12, 28, 6, 1.4)
    a.circle(76, 52, 3, 6, 1.0, 0.5)
    a.path("M76 52 L82 48", 6, 1.0, 0.6)
    a.path("M20 36 Q34 30 48 36 M26 28 Q40 22 54 28", 8, 1.2, 0.5)
    a.poly([(52, 36), (56, 34), (54, 39)], 8, 1.1, 0.5)
    a.ground(86)
    return a


@item("Timber Peg")
def _():
    a = Art()
    # tapered round peg with chamfered tip and a flat head
    a.path("M22 44 L68 40 Q80 44 80 50 Q80 56 68 60 L22 56 Z", 0, 1.8)
    a.ellipse(22, 50, 4, 6.4, 0, 1.8)
    a.path("M26 46 L64 43 M26 54 L64 57", 3, 1.0, 0.45)
    a.path("M30 50 Q50 48 70 50", 3, 1.0, 0.35)
    # a mallet driving it into a blank block
    a.rect(40, 72, 44, 12, 8, 1.4, 0.6)
    a.line(60, 74, 60, 72, 8, 1.2, 0.5)
    a.line(88, 18, 88, 32, 8, 2.0)
    a.rect(78, 12, 22, 8, 8, 1.4, None, 1)
    a.ground(90)
    return a


@item("Pegged Butt Joint")
def _():
    a = Art()
    beam(a, 12, 42, 36, 16, 8, 0, 1.6)
    beam(a, 52, 42, 36, 16, 8, 0, 1.6)
    a.line(50, 40, 50, 60, 3, 1.2, 0.6)
    # a splint/cleat spans the joint, pegged across both ends
    a.rect(34, 58, 32, 6, 6, 1.6, None, 1)
    peg_v(a, 40, 44, 66, 8)
    peg_v(a, 60, 44, 66, 8)
    a.path("M28 74 L34 80 M72 74 L66 80", 3, 0.9, 0.35)
    a.ground(88)
    return a


@item("Pegged Frame Joint")
def _():
    a = Art()
    # post meets a horizontal rail; a through-peg locks the corner
    a.rect(14, 12, 16, 74, 0, 1.8)
    a.line(14, 22, 30, 22, 3, 0.9, 0.4)
    a.rect(30, 40, 56, 14, 0, 1.8)
    a.path("M30 40 L30 54", 0, 2)
    a.line(36, 40, 36, 54, 3, 1.0, 0.45)
    a.circle(22, 47, 2.4, 6, 1.6)
    a.rect(40, 36, 3, 22, 6, 1.4)
    grain(a, 32, 40, 86, 54, 2)
    a.path("M92 36 L92 58", 3, 1.0, 0.35)
    a.ground(90)
    return a


@item("Pegged Timber Truss")
def _():
    a = Art()
    # A-frame truss with a tie beam, king strut and pegged joints
    a.poly([(10, 78), (50, 20), (90, 78)], 0, 1.8)
    a.line(10, 78, 90, 78, 0, 1.8)
    a.line(10, 84, 90, 84, 0, 1.4)
    a.line(50, 20, 50, 78, 0, 1.6)
    a.line(32, 52, 50, 70, 3, 1.4)
    a.line(68, 52, 50, 70, 3, 1.4)
    for (x, y) in ((50, 22), (12, 78), (88, 78), (50, 76), (32, 52), (68, 52)):
        a.circle(x, y, 1.9, 6, 1.3)
        a.dot(x, y, 0.8, 8)
    a.poly([(10, 78), (16, 70), (24, 78)], 3, 1.0, 0.45)
    a.ground(92, 6, 94)
    return a


@item("Mortise Cut")
def _():
    a = Art()
    iso_box(a, 16, 40, 44, 34, 18, 0, 1.8)
    # rectangular mortise pocket on the front face + chips, and a chisel with mallet
    a.rect(30, 48, 14, 18, 3, 1.6)
    a.rect(32.6, 50.6, 8.8, 12.8, 6, 1.0, 0.45)
    a.path("M30 48 L34 46 M44 48 L48 46", 3, 1.0, 0.45)
    a.path("M26 80 L30 82 M50 78 L54 80 M40 84 L44 85", 8, 1.0, 0.5)
    a.line(76, 34, 58, 54, 8, 2.4)
    a.poly([(58, 54), (54, 60), (62, 58)], 8, 1.4, None, True)
    a.rect(72, 22, 18, 10, 8, 1.6, None, 1)
    a.line(80, 32, 76, 34, 8, 1.6)
    a.ground(90)
    return a


@item("Mortise And Tenon Joint")
def _():
    a = Art()
    # exploded: a tenon end (left rail) aimed at the mortise in a post (right)
    a.rect(60, 12, 24, 74, 0, 1.8)
    a.rect(66, 38, 12, 20, 3, 1.5)
    a.line(60, 22, 84, 22, 3, 0.9, 0.4)
    a.poly([(10, 36), (44, 36), (44, 40), (52, 40), (52, 56), (44, 56), (44, 60), (10, 60)], 0, 1.8, close=True)
    a.line(52, 40, 60, 38, 3, 1.0, 0.5)
    a.line(52, 56, 60, 58, 3, 1.0, 0.5)
    grain(a, 12, 36, 42, 60, 2)
    a.poly([(54, 46), (58, 48), (54, 50)], 8, 1.2, 0.8)
    a.ground(90)
    return a


@item("Drawbored Tenon")
def _():
    a = Art()
    # tenon through a post: the peg hole in the tenon is bored slightly closer to the shoulder than the one in the cheek
    a.rect(52, 14, 26, 72, 0, 1.8)
    a.rect(8, 40, 44, 18, 0, 1.8)
    a.line(8, 49, 52, 49, 3, 0.9, 0.3)
    a.circle(62, 49, 2.6, 6, 1.4)
    a.circle(64.2, 49, 2.6, 3, 1.1, 0.55)       # offset hole in the tenon
    a.dot(62, 49, 0.9, 8)
    # tapered peg being driven through
    a.path("M92 44 L66 48.4 L66 49.6 L92 54", 8, 1.6)
    a.line(92, 44, 92, 54, 8, 1.6)
    a.path("M56 62 Q62 68 68 62", 3, 1.0, 0.4)
    a.ground(90)
    return a


@item("Wedged Tenon Frame")
def _():
    a = Art()
    a.rect(14, 12, 26, 76, 0, 1.8)
    a.rect(40, 40, 50, 18, 0, 1.8)
    # through-tenon end proud of the post with two wedges driven into saw-kerfs
    a.rect(34, 40, 6, 18, 6, 1.4)
    a.line(38, 40, 38, 58, 3, 1.0, 0.4)
    a.poly([(40, 44), (46, 49), (40, 50)], 6, 1.5, None, True)
    a.poly([(40, 54), (46, 49), (40, 52)], 6, 1.5, None, True)
    grain(a, 44, 40, 88, 58, 2)
    a.line(14, 26, 40, 26, 3, 0.9, 0.35)
    a.ground(92)
    return a


@item("Wooden Dowel")
def _():
    a = Art()
    # round rod with chamfered ends and fluted glue grooves, shown next to a drilled hole
    a.path("M12 40 L74 40 L80 44 L80 56 L74 60 L12 60", 0, 1.8)
    a.line(12, 40, 12, 60, 0, 1.8)
    a.ellipse(12, 50, 3.2, 10, 0, 1.8)
    for y in (44, 50, 56):
        a.line(16, y, 72, y, 3, 0.9, 0.4)
    a.path("M30 40 Q32 50 30 60 M44 40 Q46 50 44 60 M58 40 Q60 50 58 60", 3, 0.9, 0.35)
    a.rect(56, 68, 34, 12, 8, 1.4, 0.6)
    a.circle(73, 74, 4, 8, 1.2, 0.7)
    a.ground(90)
    return a


@item("Cross Dowel Joint")
def _():
    a = Art()
    # two members meeting at right angles, a short dowel crossing both
    a.rect(14, 56, 72, 16, 0, 1.8)
    a.rect(38, 14, 16, 42, 0, 1.8)
    a.rect(44.6, 30, 2.8, 56, 8, 1.8)
    a.circle(46, 30, 1.6, 8, 1.2)
    grain(a, 16, 56, 84, 72, 2)
    a.line(38, 36, 54, 36, 3, 0.9, 0.35)
    a.ground(90)
    return a


@item("Knockdown Dowel Assembly")
def _():
    a = Art()
    # exploded kit: two panels, four dowels and arrows showing assembly
    a.rect(10, 42, 22, 34, 0, 1.8)
    a.rect(68, 42, 22, 34, 0, 1.8)
    for y in (50, 60, 70):
        a.circle(32, y, 1.6, 3, 1.1, 0.8)
        a.circle(68, y, 1.6, 3, 1.1, 0.8)
    for y in (50, 60, 70):
        a.line(38, y, 62, y, 6, 1.8)
        a.ellipse(38, y, 1.2, 2.2, 6, 1.0)
    a.line(36, 34, 64, 34, 8, 1.3, 0.6)
    a.poly([(38, 31), (34, 34), (38, 37)], 8, 1.2, 0.6)
    a.poly([(62, 31), (66, 34), (62, 37)], 8, 1.2, 0.6)
    a.path("M20 82 L80 82", 3, 1.0, 0.35)
    a.ground(90)
    return a


@item("Demountable Timber Frame")
def _():
    a = Art()
    # one bay of posts and rails with assembly marks and withdrawable pegs
    a.rect(12, 18, 10, 68, 0, 1.6)
    a.rect(78, 18, 10, 68, 0, 1.6)
    a.rect(22, 20, 56, 10, 0, 1.6)
    a.rect(22, 70, 56, 10, 0, 1.6)
    a.line(22, 30, 78, 70, 3, 1.2, 0.5)
    a.line(78, 30, 22, 70, 3, 1.2, 0.5)
    for (x, y) in ((17, 25), (83, 25), (17, 75), (83, 75)):
        a.circle(x, y, 1.6, 6, 1.2)
    a.path("M46 18 L46 12 M50 18 L50 12 M54 18 L54 12", 8, 1.4, 0.7)      # Roman assembly marks
    a.path("M44 22 L48 26 M56 22 L52 26", 3, 0.9, 0.4)
    a.path("M92 42 Q98 50 92 58", 8, 1.2, 0.5)
    a.poly([(90, 56), (92, 60), (95, 56)], 8, 1.1, 0.5)
    a.ground(92)
    return a


@item("Lapped Beam")
def _():
    a = Art()
    # two timbers overlapped side by side and pinned through the lap
    a.rect(10, 40, 56, 14, 0, 1.8)
    a.rect(34, 54, 56, 14, 0, 1.8)
    for x in (42, 52, 62):
        a.circle(x, 54, 2.2, 6, 1.4)
    a.line(34, 40, 34, 54, 3, 1.0, 0.5)
    a.line(66, 54, 66, 68, 3, 1.0, 0.5)
    grain(a, 12, 40, 64, 54, 2)
    grain(a, 36, 54, 88, 68, 2)
    a.line(34, 36, 66, 36, 8, 1.2, 0.5)
    a.line(34, 33, 34, 39, 8, 1.1, 0.5)
    a.line(66, 33, 66, 39, 8, 1.1, 0.5)
    a.ground(86)
    return a


@item("Half Lap Joint")
def _():
    a = Art()
    # exploded cross-halving: two members each notched to half depth, meeting flush
    a.rect(8, 20, 40, 14, 0, 1.8)
    a.rect(20, 20, 14, 7, 3, 1.2, 0.5)
    a.line(20, 20, 20, 27, 3, 1.5)
    a.line(34, 20, 34, 27, 3, 1.5)
    a.line(20, 27, 34, 27, 3, 1.5)
    a.rect(26, 52, 14, 36, 0, 1.8)
    a.rect(26, 62, 14, 7, 3, 1.2, 0.5)
    a.line(26, 62, 40, 62, 3, 1.5)
    a.line(26, 69, 40, 69, 3, 1.5)
    # the joined cross on the right
    a.rect(60, 62, 34, 12, 0, 1.8)
    a.rect(71, 46, 12, 42, 6, 1.8)
    a.line(71, 62, 83, 62, 3, 1.0, 0.4)
    a.poly([(44, 38), (44, 46)], 8, 1.4, 0.7)
    a.poly([(41, 43), (44, 48), (47, 43)], 8, 1.2, 0.7)
    a.ground(92)
    return a


@item("Scarf Joined Beam")
def _():
    a = Art()
    # two beams joined end-to-end with a long sloped scarf, bolts through
    a.poly([(8, 42), (60, 42), (46, 58), (8, 58)], 0, 1.8, close=True)
    a.poly([(40, 42), (92, 42), (92, 58), (54, 58)], 0, 1.8, close=True)
    a.line(40, 42, 54, 58, 3, 1.2, 0.5)
    a.line(60, 42, 46, 58, 6, 1.4)
    for x in (44, 52):
        a.line(x, 38, x, 62, 8, 1.6)
        a.circle(x, 38, 1.6, 8, 1.2)
    grain(a, 10, 42, 40, 58, 2)
    grain(a, 60, 42, 90, 58, 2)
    a.ground(86)
    return a


@item("Long Span Scarf Beam")
def _():
    a = Art()
    # three scarfed lengths spanning between two posts, deflection exaggerated
    a.rect(6, 52, 8, 34, 0, 1.6)
    a.rect(86, 52, 8, 34, 0, 1.6)
    a.path("M14 40 Q50 48 86 40 L86 52 Q50 60 14 52Z", 0, 1.8)
    for x in (38, 62):
        a.line(x, 43, x - 4, 55, 3, 1.4, 0.8)
    a.path("M16 46 Q50 53 84 46", 3, 0.9, 0.4)
    for x in (36, 60):
        a.line(x, 40, x, 56, 8, 1.2, 0.6)
    a.path("M14 30 Q50 40 86 30", 8, 1.0, 0.35)
    a.line(50, 20, 50, 28, 8, 1.4, 0.6)
    a.poly([(47, 25), (50, 29), (53, 25)], 8, 1.2, 0.6)
    a.ground(92)
    return a


@item("Shaped Rafter")
def _():
    a = Art()
    # inclined rafter with a bird's-mouth notch where it sits on the wall plate
    a.poly([(10, 72), (74, 18), (82, 26), (24, 76)], 0, 1.8, close=True)
    a.poly([(24, 76), (24, 86), (40, 86), (40, 76)], 0, 1.4, close=True)       # wall plate
    a.path("M24 76 L24 70 L32 70", 6, 1.8)
    a.line(14, 70, 78, 22, 3, 0.9, 0.4)
    a.line(18, 74, 82, 26, 3, 0.9, 0.3)
    a.circle(56, 36, 1.8, 6, 1.2)
    a.path("M8 90 L92 90", 3, 1.0, 0.35)
    a.ground(94, 6, 94)
    return a


@item("Rafter Pair")
def _():
    a = Art()
    a.poly([(10, 78), (50, 26), (58, 32), (22, 80)], 0, 1.8, close=True)
    a.poly([(90, 78), (50, 26), (42, 32), (78, 80)], 0, 1.8, close=True)
    a.circle(50, 32, 2, 6, 1.4)
    a.line(50, 24, 50, 18, 6, 1.6)
    a.rect(8, 80, 18, 8, 0, 1.4)
    a.rect(74, 80, 18, 8, 0, 1.4)
    a.line(14, 78, 52, 30, 3, 0.9, 0.4)
    a.line(86, 78, 48, 30, 3, 0.9, 0.4)
    a.path("M30 54 L34 58 M70 54 L66 58", 3, 0.9, 0.45)
    a.ground(94, 6, 94)
    return a


@item("Collar Tie Roof")
def _():
    a = Art()
    a.poly([(10, 78), (50, 24), (90, 78)], 0, 2)
    a.poly([(16, 78), (50, 32), (84, 78)], 0, 1.4)
    a.line(30, 52, 70, 52, 0, 1.8)             # collar high on the rafters
    a.line(28, 56, 72, 56, 0, 1.8)
    for x in (30, 70):
        a.circle(x, 54, 1.8, 6, 1.2)
    a.rect(6, 78, 14, 8, 0, 1.4)
    a.rect(80, 78, 14, 8, 0, 1.4)
    # outward thrust arrows resisted by the collar
    a.line(34, 60, 24, 60, 8, 1.3, 0.6)
    a.line(66, 60, 76, 60, 8, 1.3, 0.6)
    a.poly([(27, 57), (23, 60), (27, 63)], 8, 1.1, 0.6)
    a.poly([(73, 57), (77, 60), (73, 63)], 8, 1.1, 0.6)
    a.ground(92, 6, 94)
    return a


@item("King Post Roof Truss")
def _():
    a = Art()
    a.poly([(8, 76), (50, 20), (92, 76)], 0, 1.8)
    a.rect(8, 76, 84, 8, 0, 1.8)                                 # tie beam
    a.rect(46, 24, 8, 52, 0, 1.6)                                # king post
    a.line(46, 70, 24, 76, 0, 1.6)
    a.line(46, 62, 28, 74, 3, 1.4)
    a.line(54, 70, 76, 76, 0, 1.6)
    a.line(54, 62, 72, 74, 3, 1.4)
    for (x, y) in ((50, 30), (50, 78), (12, 80), (88, 80)):
        a.circle(x, y, 1.8, 6, 1.2)
    a.ground(92, 6, 94)
    return a


@item("Split Wooden Plank")
def _():
    a = Art()
    # a log end with radial cleft lines, wedge, and the riven plank leaning beside it
    a.ellipse(34, 50, 24, 20, 0, 1.8)
    a.circle(34, 50, 14, 3, 1.0, 0.45)
    a.circle(34, 50, 7, 3, 1.0, 0.45)
    a.line(34, 30, 34, 70, 0, 2)                                 # the cleft
    a.poly([(30, 30), (38, 30), (34, 42)], 8, 1.6, None, True)   # wedge
    a.line(10, 50, 58, 50, 3, 0.9, 0.35)
    a.poly([(66, 78), (74, 28), (86, 28), (80, 78)], 6, 1.6, close=True)
    grain(a, 70, 30, 84, 76, 2)
    a.line(60, 20, 48, 32, 8, 1.8)
    a.rect(52, 10, 14, 8, 8, 1.4, None, 1)
    a.ground(88)
    return a


@item("Edge Joined Board")
def _():
    a = Art()
    # three boards glued edge to edge with dowels, clamp across
    for k, y in enumerate((34, 48, 62)):
        iso_box(a, 14, y, 56, 12, 10, 0, 1.6)
        grain(a, 16, y, 68, y + 12, 1)
    for k in range(3):
        a.circle(26 + k * 18, 46, 1.4, 6, 1.0, 0.8)
        a.circle(26 + k * 18, 60, 1.4, 6, 1.0, 0.8)
    a.path("M6 28 L6 22 L84 22 L84 28", 8, 1.8)
    a.line(6, 70, 6, 80, 8, 1.8)
    a.line(6, 80, 84, 80, 8, 1.8)
    a.line(84, 66, 84, 80, 8, 1.8)
    a.path("M84 28 L84 66", 8, 1.2, 0.4)
    a.ground(90)
    return a


@item("Planked Wall Panel")
def _():
    a = Art()
    # vertical planks with a gap line each, two horizontal battens and nail dots
    for k in range(6):
        x = 14 + k * 12
        a.rect(x, 14, 12, 72, 0, 1.6)
        a.path(f"M{n(x + 4)} 18 Q{n(x + 6)} 50 {n(x + 4)} 82", 3, 0.9, 0.35)
    for y in (30, 70):
        a.rect(10, y - 4, 80, 8, 6, 1.6, None, 1)
        for k in range(6):
            a.dot(20 + k * 12, y, 1.1, 8)
    a.ground(92)
    return a


@item("Weatherboard Cladding")
def _():
    a = Art()
    # side section: overlapping horizontal boards, each lapped over the one below, on studs
    a.rect(10, 12, 8, 76, 0, 1.6)
    for k in range(6):
        y = 18 + k * 12
        a.path(f"M22 {y} L{n(34)} {y + 2} L{n(34)} {y + 14} L22 {y + 12}Z", 0, 1.5)
    # elevation strip on the right with lap lines
    a.rect(48, 12, 44, 76, 6, 1.6)
    for k in range(1, 7):
        y = 12 + k * 10.8
        a.line(48, y, 92, y, 3, 1.4)
        a.line(48, y + 2, 92, y + 2, 3, 0.8, 0.4)
    a.dots([(56, 22), (80, 33), (62, 44)], 0.9, 8)
    a.ground(92)
    return a
