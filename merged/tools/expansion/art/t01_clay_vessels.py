"""Topic 01 - clay vessels (25). Each drawing carries the feature its name promises."""
from __future__ import annotations

import math

from .core import Art, arc_front, arc_back, n, smooth_d, zigzag, wave_d
from .kit import (RY, band, blob, bowl_prof, disc, droplet, flame, foot_ring, knob, loop_handle, lug, r_at, sparkle,
                  vessel, zig_band)
from .registry import item, topic

topic("clay vessels")

POT = [(30, 14), (34, 20), (46, 25), (62, 22), (74, 12)]          # round-bellied pot, rim -> base
JAR = [(24, 10), (30, 8), (38, 15), (54, 22), (72, 20), (82, 12)]  # tall jar with neck
CUP = [(36, 13), (50, 12), (64, 10), (74, 9)]


@item("Prepared Vessel Clay")
def _():
    a = Art()
    blob(a, 44, 58, 26, 17, 10, 3, 0.1)
    a.path("M26 56 Q34 50 42 56 M36 66 Q46 60 56 66 M50 52 Q58 48 66 54", 3, 1.2, 0.5)       # kneading folds
    # wedged cut block with wire-cut face
    a.poly([(66, 34), (86, 30), (86, 44), (66, 48)], 6, 1.6, close=True)
    a.poly([(66, 34), (74, 27), (92, 24), (86, 30)], 6, 1.6)
    a.poly([(86, 30), (92, 24), (92, 38), (86, 44)], 6, 1.6)
    a.path("M68 40 Q76 37 84 38", 6, 1.0, 0.5)
    # temper grit and sprinkled water
    a.dots([(20, 40), (25, 44), (17, 47), (30, 38), (36, 34)], 1.1, 3)
    droplet(a, 18, 30, 3.2)
    droplet(a, 26, 24, 2.4)
    a.ground(84, 8, 92)
    return a


@item("Pinch Pot")
def _():
    a = Art()
    prof = [(38, 27), (46, 30), (62, 27), (72, 17)]
    vessel(a, prof, 50, 0)
    for (x, y) in [(30, 54), (36, 62), (44, 66), (58, 66), (66, 60), (71, 52)]:          # finger pinch dents
        a.path(f"M{n(x - 2.6)} {n(y - 1)} Q{n(x)} {n(y + 2.6)} {n(x + 2.6)} {n(y - 1)}", 3, 1.2, 0.55)
    a.path("M26 44 Q50 52 74 44", 3, 1.1, 0.4)
    a.ellipse(50, 38, 22, 5, 3, 1.0, 0.35)
    # thumb print outline beside
    a.ellipse(86, 62, 5, 7, 8, 1.2, 0.5, 20)
    a.path("M83 60 Q86 57 89 60 M82.5 63 Q86 60 89.5 63", 8, 0.9, 0.4)
    a.ground(84)
    return a


@item("Burnished Pinch Pot")
def _():
    a = Art()
    prof = [(34, 25), (43, 28), (60, 26), (72, 16)]
    vessel(a, prof, 46, 0)
    for k, y in enumerate((46, 53, 60)):
        a.path(f"M{n(30 + k)} {n(y)} Q{n(46)} {n(y + 5)} {n(62 - k)} {n(y)}", 3, 1.0, 0.35)
    sparkle(a, 36, 50, 3.2)
    sparkle(a, 58, 58, 2.2)
    a.path("M30 42 Q34 40 40 41", 3, 1.4, 0.8)
    # smooth river pebble used as burnisher
    a.ellipse(82, 72, 8, 5, 8, 1.6, None, -18)
    a.path("M77 71 Q82 68 87 70", 8, 1.0, 0.45)
    a.ground(86)
    return a


@item("Slip Decorated Pot")
def _():
    a = Art()
    prof = POT
    vessel(a, prof, 46, 0)
    band(a, prof, 38, 46, 3, 3.0, 0.9)           # thick slip band
    band(a, prof, 42, 46, 3, 1.2, 0.5)
    band(a, prof, 58, 46, 3, 1.4, 0.8)
    band(a, prof, 62, 46, 3, 1.0, 0.45)
    for x in (30, 38, 46, 54, 62):               # slip drips under the rim band
        a.line(x, 40.5 + abs(x - 46) * 0.05, x, 45 + (x % 3), 3, 1.1, 0.6)
    a.ellipse(46, 30, 14, 3.8, 3, 1.0, 0.4)
    # small slip cup + brush
    prof2 = [(66, 9), (74, 7)]
    vessel(a, prof2, 84, 8)
    a.line(80, 60, 90, 52, 8, 1.6)
    a.path("M90 52 Q93 49 95 50", 8, 1.4)
    a.ground(86)
    return a


@item("Painted Storage Pot")
def _():
    a = Art()
    prof = [(24, 17), (30, 23), (44, 31), (62, 28), (76, 16)]
    vessel(a, prof, 50, 0)
    lug(a, -1, 50, 40, prof, 4.5)
    lug(a, 1, 50, 40, prof, 4.5)
    zig_band(a, prof, 36, 50, 3, 1.2, None, 2.2, 5.2, 4)
    a.path(wave_d(25, 75, 52, 2.2, 10), 3, 1.3, 0.8)
    # painted triangles row
    for x in range(30, 72, 8):
        a.poly([(x, 64), (x + 4, 58), (x + 8, 64)], 3, 1.1, 0.7, True)
    # spiral motif
    a.path("M50 46 Q55 46 55 50 Q55 54 50 54 Q46 54 46 50 Q46 47 49 47", 6, 1.0, 0.6)
    a.dots([(28, 56), (72, 56), (36, 70), (64, 70)], 1.0, 3)
    a.ground(86)
    return a


@item("Coil Pot")
def _():
    a = Art()
    prof = [(30, 15), (36, 21), (48, 26), (64, 22), (76, 13)]
    vessel(a, prof, 42, 0)
    for y in (40, 46, 52, 58, 64, 70):             # stacked coil seams
        band(a, prof, y, 42, 3, 1.1, 0.55)
    for x in (30, 40, 52, 60):
        a.line(x, 44, x + 1.2, 49, 3, 0.8, 0.35)
    # a loose coil rope curling beside
    a.path("M70 80 C70 70 90 70 90 78 C90 86 74 86 74 78 C74 74 84 74 84 77", 8, 1.7)
    a.path("M71 77 C72 72 88 72 88 77", 8, 1.0, 0.4)
    a.ground(88)
    return a


@item("Coil Jar")
def _():
    a = Art()
    prof = [(18, 9), (24, 7), (32, 14), (50, 21), (70, 18), (82, 11)]
    vessel(a, prof, 44, 0)
    for y in (34, 40, 46, 52, 58, 64, 70, 76):
        band(a, prof, y, 44, 3, 1.0, 0.5)
    a.path("M30 28 Q44 33 58 28", 3, 1.2, 0.55)
    # a fresh coil rolled out and spiralled, waiting to be added
    a.path("M92 66 C86 56 72 58 72 68 C72 78 88 78 88 70 C88 64 80 64 80 68", 8, 1.7)
    a.path("M91 64 C85 57 74 60 74 68", 8, 1.0, 0.4)
    a.ground(88)
    return a


@item("Collared Storage Jar")
def _():
    a = Art()
    prof = [(18, 14), (24, 11), (30, 9), (38, 16), (52, 23), (70, 21), (82, 12)]
    vessel(a, prof, 50, 0)
    band(a, prof, 29, 50, 0, 1.6, None)           # collar ridge
    band(a, prof, 33, 50, 3, 1.1, 0.5)
    a.ellipse(50, 18, 11, 3, 3, 1.0, 0.4)
    lug(a, -1, 50, 48, prof, 4)
    lug(a, 1, 50, 48, prof, 4)
    zig_band(a, prof, 60, 50, 3, 1.1, 0.7, 2, 5, 5)
    a.ground(86)
    return a


@item("Lidded Storage Jar")
def _():
    a = Art()
    prof = [(30, 14), (34, 12), (44, 19), (60, 24), (76, 20), (84, 13)]
    vessel(a, prof, 50, 0, rim=False)
    # lid sits over rim: domed cap + knob
    a.ellipse(50, 30, 16, 4.4, 0)
    a.path("M34 30 Q50 14 66 30", 0)
    a.line(50, 18.5, 50, 22, 0, 1.6)
    knob(a, 50, 17, 3)
    a.path("M38 27 Q50 19 62 27", 3, 1.0, 0.4)
    a.path(arc_front(50, 38, 13, 3.6), 3, 1.2, 0.5)
    band(a, prof, 58, 50, 3, 1.2, 0.5)
    band(a, prof, 66, 50, 3, 1.0, 0.4)
    a.ground(88)
    return a


@item("Clay Cup")
def _():
    a = Art()
    vessel(a, [(34, 17), (50, 16), (66, 13), (76, 12)], 50, 0)
    band(a, [(34, 17), (50, 16), (66, 13), (76, 12)], 46, 50, 3, 1.1, 0.5)
    a.path("M38 52 Q40 62 42 70", 3, 1.0, 0.35)
    a.ground(88)
    return a


@item("Handled Drinking Cup")
def _():
    a = Art()
    prof = [(32, 17), (48, 16), (64, 14), (76, 12)]
    vessel(a, prof, 44, 0)
    loop_handle(a, 1, 44, 38, 64, prof, 13)
    band(a, prof, 44, 44, 3, 1.1, 0.5)
    a.dots([(34, 56), (44, 60), (54, 56)], 1.0, 3)
    a.ground(88)
    return a


@item("Spouted Cup")
def _():
    a = Art()
    prof = [(34, 16), (50, 17), (64, 14), (76, 11)]
    vessel(a, prof, 46, 0)
    # pinched spout lip at the left rim
    a.path("M30 34 Q22 34 20 30 Q24 34 31 38", 0)
    a.path("M20 30 L28 31", 3, 1.1, 0.5)
    loop_handle(a, 1, 46, 40, 64, prof, 12)
    # pour drops
    droplet(a, 16, 42, 2.4)
    droplet(a, 14, 52, 2.0)
    a.ground(88)
    return a


@item("Pouring Jug")
def _():
    a = Art()
    prof = [(18, 9), (28, 7), (36, 12), (52, 21), (70, 19), (82, 13)]
    vessel(a, prof, 44, 0)
    a.path("M35 18 Q26 17 24 22 Q30 22 35.4 21", 0)      # pinched pouring lip
    loop_handle(a, 1, 44, 24, 56, prof, 14)
    band(a, prof, 46, 44, 3, 1.2, 0.5)
    band(a, prof, 54, 44, 3, 1.0, 0.4)
    # stream
    a.path("M22 24 C16 28 14 38 14 54", 8, 1.2, 0.55)
    a.path("M20 26 C13 32 11 40 11 54", 8, 0.9, 0.35)
    a.ground(88)
    return a


@item("Clay Bowl")
def _():
    a = Art()
    prof = bowl_prof(34, 40, 34, 0.4)
    vessel(a, prof, 50, 0, rim_w=1.6)
    a.path("M24 52 Q50 62 76 52", 3, 1.1, 0.4)
    a.ellipse(50, 41, 28, 6.5, 3, 1.0, 0.35)
    a.line(40, 76, 60, 76, 0, 1.6)
    a.ground(86)
    return a


@item("Footed Bowl")
def _():
    a = Art()
    prof = [(30, 32), (38, 31), (50, 23), (58, 10)]
    vessel(a, prof, 50, 0, rim_w=1.6, base=False)
    a.path("M40 58 Q50 62 60 58", 0, 1.2, None)
    foot_ring(a, 50, 58, 9, 14)
    a.path("M26 42 Q50 52 74 42", 3, 1.1, 0.4)
    a.path(arc_front(50, 66, 9, 2.4), 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Glazed Serving Bowl")
def _():
    a = Art()
    prof = bowl_prof(36, 38, 36, 0.5)
    vessel(a, prof, 50, 0, rim_w=1.8)
    a.ellipse(50, 39, 30, 7, 3, 1.0, 0.4)
    a.ellipse(50, 39, 24, 5.6, 3, 1.0, 0.3)
    # glaze shine arcs + sparkle
    a.path("M24 52 Q27 62 34 68", 3, 1.6, 0.8)
    a.path("M30 50 Q32 58 37 63", 3, 1.0, 0.5)
    sparkle(a, 68, 54, 3.2)
    sparkle(a, 74, 63, 2.0)
    a.path(wave_d(30, 70, 46, 1.2, 8), 3, 1.0, 0.5)    # drip line below the rim
    a.line(40, 76, 60, 76, 0, 1.6)
    a.ground(86)
    return a


@item("Stackable Table Bowl")
def _():
    a = Art()
    # three bowls stacked rim to foot: each shows its rim ellipse and the wall down to the bowl below
    levels = [(34, 30), (50, 27), (65, 23)]          # (rim y, rim radius)
    for k, (y, r) in enumerate(levels):
        r2 = levels[k + 1][1] if k + 1 < len(levels) else r * 0.55
        y2 = levels[k + 1][0] if k + 1 < len(levels) else y + 16
        a.ellipse(50, y, r, r * RY, 0, 1.8 if k == 0 else None)
        a.line(50 - r, y, 50 - r2, y2, 0)
        a.line(50 + r, y, 50 + r2, y2, 0)
        a.path(arc_front(50, y2, r2, r2 * RY), 0)
        a.path(arc_front(50, y + (y2 - y) * 0.5, (r + r2) / 2, (r + r2) / 2 * RY), 3, 1.0, 0.35)
    a.ground(88)
    a.line(26, 26, 26, 20, 3, 1.1, 0.4)
    a.line(74, 26, 74, 20, 3, 1.1, 0.4)
    return a


def _lamp_base(a: Art, cx: float, cy: float, rx: float = 20, ry: float = 9, z: int = 0):
    a.ellipse(cx, cy, rx, ry, z)
    a.ellipse(cx, cy, rx * 0.62, ry * 0.55, 3, 1.1, 0.5)
    a.path(f"M{n(cx - rx)} {n(cy)} Q{n(cx - rx)} {n(cy + 12)} {n(cx)} {n(cy + 13)} Q{n(cx + rx)} {n(cy + 12)} {n(cx + rx)} {n(cy)}", z)


@item("Clay Lamp")
def _():
    a = Art()
    _lamp_base(a, 44, 58)
    a.path("M63 54 Q76 52 82 58 Q76 60 64 62", 0)           # nozzle
    a.line(80, 57, 86, 53, 3, 1.8)                           # wick
    flame(a, 87, 53, 11)
    a.path("M34 56 Q44 62 54 56", 3, 1.0, 0.4)
    a.ground(82)
    return a


@item("Double Wick Lamp")
def _():
    a = Art()
    _lamp_base(a, 50, 60, 18, 8)
    for s in (-1, 1):
        x = 50 + s * 18
        a.path(f"M{n(x)} {n(55)} Q{n(x + s * 12)} {n(52)} {n(x + s * 16)} {n(58)} Q{n(x + s * 10)} {n(61)} {n(x)} {n(64)}", 0)
        a.line(x + s * 14, 57, x + s * 19, 53, 3, 1.8)
        flame(a, x + s * 20, 53, 10)
    a.ground(84)
    return a


@item("Hanging Oil Lamp")
def _():
    a = Art()
    _lamp_base(a, 50, 60, 17, 7.5)
    a.path("M67 56 Q78 54 82 59 Q76 61 67 63", 0)
    a.line(80, 58, 85, 54, 3, 1.6)
    flame(a, 86, 54, 9)
    # suspension: three chains to a ring and hook
    for x in (36, 50, 64):
        a.line(x, 57, 50, 22, 0, 1.2, 0.8)
    for t in (0.25, 0.5, 0.75):
        for x in (36, 64):
            px = x + (50 - x) * t
            py = 57 + (22 - 57) * t
            a.circle(px, py, 1.1, 3, 0.9, 0.7)
    a.circle(50, 19, 3.6, 0, 1.6)
    a.path("M50 15 L50 8 Q50 5 54 5", 0, 1.6)
    a.ground(84, 18, 82)
    return a


@item("Multi Nozzle Oil Lamp")
def _():
    a = Art()
    a.ellipse(50, 56, 20, 10, 0)
    a.ellipse(50, 56, 11, 5.4, 3, 1.1, 0.5)
    a.path("M30 56 Q30 68 50 70 Q70 68 70 56", 0)
    for k, ang in enumerate((200, 235, 270, 305, 340)):
        r = math.radians(ang)
        x, y = 50 + 20 * math.cos(r), 56 + 10 * math.sin(r)
        x2, y2 = 50 + 29 * math.cos(r), 56 + 14.5 * math.sin(r)
        a.line(x, y, x2, y2, 0, 3.2)
        flame(a, x2, y2 - 1, 8 if k % 2 == 0 else 6, 3, 1.2)
    a.circle(50, 56, 2, 3, 1.1, 0.6)
    a.ground(86)
    return a


@item("Clay Lid")
def _():
    a = Art()
    disc(a, 50, 56, 28, 5)
    a.ellipse(50, 56, 20, 5.4, 3, 1.0, 0.4)
    a.path("M40 52 Q50 36 60 52", 0)
    knob(a, 50, 42, 4)
    a.path("M44 46 Q50 41 56 46", 3, 1.0, 0.4)
    a.ground(86)
    return a


@item("Fitted Pot Lid")
def _():
    a = Art()
    prof = [(36, 22), (42, 24), (56, 27), (72, 22), (82, 14)]
    vessel(a, prof, 46, 0, rim=False)
    a.ellipse(46, 36, 22, 5.8, 0)
    a.path("M30 36 Q46 24 62 36", 0)
    knob(a, 46, 27, 3)
    # cutaway of the fitted flange (dashed look via short strokes)
    for x in range(30, 62, 5):
        a.line(x, 37, x + 2.6, 37, 6, 1.0, 0.6)
    a.path("M24 36 L24 41 M68 36 L68 41", 3, 1.0, 0.6)
    band(a, prof, 58, 46, 3, 1.1, 0.5)
    # lid close-up inset with flange
    a.rect(76, 12, 18, 14, 8, 1.2, 0.6, 1)
    a.path("M79 22 L79 18 L91 18 L91 22 M82 22 L82 15 L88 15 L88 22", 8, 1.2, 0.8)
    a.ground(88, 8, 78)
    return a


@item("Sealing Jar Lid")
def _():
    a = Art()
    prof = [(34, 12), (40, 14), (56, 22), (74, 20), (84, 12)]
    vessel(a, prof, 50, 0, rim=False)
    a.ellipse(50, 34, 16, 4.4, 0)
    a.path("M34 34 Q50 24 66 34", 0)
    # cord around neck and wax seal
    a.path(arc_front(50, 38, 12, 3.2), 3, 1.8)
    a.path("M50 41 Q52 46 50 49", 3, 1.4)
    a.path("M50 41 Q48 46 50 50", 3, 1.4)
    blob(a, 50, 55, 6, 5, 8, 2, 0.14, 3, 1.4)
    a.circle(50, 55, 2.2, 3, 1.0, 0.7)
    band(a, prof, 66, 50, 3, 1.1, 0.4)
    a.ground(88)
    return a


@item("Reusable Storage Seal")
def _():
    a = Art()
    # cylinder seal with perforated axis, and its rolled impression strip
    a.ellipse(34, 36, 7, 3.6, 0)
    a.line(27, 36, 27, 62, 0)
    a.line(41, 36, 41, 62, 0)
    a.path("M27 62 A7 3.6 0 0 0 41 62", 0)
    a.line(34, 30, 34, 70, 3, 1.0, 0.4)          # axis
    a.line(29, 44, 39, 44, 3, 1.1, 0.5)
    a.line(29, 50, 39, 50, 3, 1.1, 0.5)
    a.line(29, 56, 39, 56, 3, 1.1, 0.5)
    # impression strip on a clay tablet
    a.rect(52, 56, 38, 20, 6, 1.6, None, 2)
    for k in range(5):
        x = 56 + k * 7
        a.path(f"M{n(x)} 60 L{n(x + 3)} 66 L{n(x)} 72 M{n(x + 3)} 60 L{n(x)} 66 L{n(x + 3)} 72", 6, 1.0, 0.7)
    a.path("M40 48 Q50 40 58 50", 8, 1.0, 0.5)        # roll motion
    a.line(60, 50, 56, 52, 8, 1.0, 0.5)
    a.ground(86)
    return a
