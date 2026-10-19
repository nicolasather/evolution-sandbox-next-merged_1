"""EXP28 batch 04 — water lifting, navigation and astronomy instruments, escapements, textile and musical machines.
Facts only from pages fetched 2026-10-16."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def chain_pump():
    tube = [rect(40, 14, 10, 74, 1.6), rect(54, 14, 10, 74, 1.6)]
    chain = [line(45, 18, 45, 84, .9, .6), line(59, 18, 59, 84, .9, .6)]
    discs = [rect(41.5, 24 + i * 12, 7, 3, 1.0) for i in range(5)] + [rect(55.5, 30 + i * 12, 7, 3, 1.0, .6) for i in range(4)]
    top = [circle(52, 10, 8, 1.6), circle(52, 10, 1.6, 1.0, fill=True), spokes(52, 10, 2, 7, 4, 20, .9, .7), path("M60 14 q12 4 14 14", 1.2, .6)]
    spout = [path("M60 8 L80 8 L84 14", 1.4), path("M78 16 q2 4 0 8", .9, .45)]
    bot = [circle(52, 90, 4, 1.4), line(34, 94, 76, 94, 1.4), path("M30 92 q8 -4 16 0 t16 0 t16 0", 1.0, .45)]
    crank = [line(60, 10, 70, 2, 1.4), circle(71, 1.5, 1.4, 1.0)]
    return layer(-4, *bot, *spout) + layer(0, *tube, *top, *crank) + layer(4, *chain, *discs)


def davis_quadrant():
    big = [arc(20, 80, 62, 270, 320, 1.8), arc(20, 80, 56, 270, 320, 1.0, .6), ticks(20, 80, 56, 62, 270, 320, 10, 1.0, .8)]
    small = [arc(20, 80, 28, 270, 346, 1.8), arc(20, 80, 24, 270, 346, 1.0, .6), ticks(20, 80, 24, 28, 270, 346, 15, 1.0, .8)]
    frame = [line(20, 80, 20, 18, 1.8), line(20, 80, 82, 80, 1.8)]
    shadow = [rect(36, 48, 6, 6, 1.4)] if False else [line(42, 54, 46, 46, 1.6), line(40, 52, 48, 52, 1.2)]
    slit = [line(20, 18, 20, 12, 1.6), line(16, 12, 24, 12, 1.4)]
    sight = [line(78, 76, 82, 84, 1.6), circle(80, 80, 1.6, 1.0)]
    sun = [circle(84, 20, 4, 1.2, .8), spokes(84, 20, 5.5, 8, 8, 0, 1.0, .65)]
    ray = [line(80, 24, 46, 48, .9, .45)]
    return layer(-4, *ray, *sun) + layer(0, *frame, *big, *small) + layer(4, *shadow, *slit, *sight)


def heliograph():
    legs = [line(50, 60, 26, 94, 1.8), line(50, 60, 74, 94, 1.8), line(50, 60, 50, 94, 1.4, .7)]
    mount = [circle(50, 54, 3, 1.4), rect(44, 56, 12, 6, 1.4)]
    mirror = [ellipse(50, 38, 15, 18, 1.8), ellipse(50, 38, 11, 14, .9, .5), line(36, 32, 64, 44, .8, .4)]
    rod = [line(50, 54, 50, 40, 1.4), line(64, 38, 88, 30, 1.4), circle(88, 30, 1.8, 1.2), line(84, 30, 92, 30, 1.0)]
    lever = [line(50, 62, 66, 66, 1.4), circle(66, 66, 1.6, 1.0), line(66, 66, 74, 74, 1.0, .7)]
    beam = [line(36, 28, 6, 12, 1.0, .55), line(36, 38, 4, 38, 1.0, .5), line(36, 48, 6, 62, 1.0, .45)]
    sun = [circle(88, 8, 4, 1.2, .8), spokes(88, 8, 5.5, 8, 8, 0, 1.0, .6)]
    return layer(-4, *beam, *sun) + layer(0, *legs, *mount, *lever) + layer(4, *mirror, *rod)


def meridian_circle():
    piers = [line(14, 92, 14, 38, 2.0), line(86, 92, 86, 38, 2.0), rect(8, 92, 12, 4, 1.4), rect(80, 92, 12, 4, 1.4), line(14, 64, 86, 64, 1.0, .5)]
    axis = [line(14, 50, 86, 50, 1.8)]
    scope = [poly([(32, 40), (68, 40), (66, 60), (34, 60)], 1.4, closed=True)] if False else [rect(44, 16, 12, 70, 1.8), line(50, 12, 50, 16, 1.4), circle(50, 11, 2, 1.2), rect(46, 86, 8, 6, 1.4)]
    circ = [circle(26, 50, 12, 1.4), ticks(26, 50, 10, 12, 0, 360, 36, .8, .7), circle(26, 50, 1.4, 1.0, fill=True)]
    circ2 = [circle(74, 50, 12, 1.0, .55)]
    wires = [line(46, 30, 54, 30, .8, .5), line(46, 34, 54, 34, .8, .5), line(46, 38, 54, 38, .8, .5)]
    micro = [line(26, 62, 26, 70, 1.2, .8), circle(26, 72, 2, 1.0)]
    pool = [ellipse(50, 96, 14, 2.4, 1.0, .5)]
    return layer(-4, *pool) + layer(0, *piers, *axis, *scope) + layer(4, *circ, *circ2, *wires, *micro)


def mural_quadrant():
    wall = [line(8, 6, 8, 94, 2.0)] + [line(8, 10 + i * 8, 2, 14 + i * 8, .9, .45) for i in range(10)]
    arc_ = [arc(10, 84, 72, 270, 360, 2.0), arc(10, 84, 66, 270, 360, 1.0, .7), ticks(10, 84, 62, 72, 270, 360, 45, 1.0, .85)]
    radii = [line(10, 84, 10, 12, 1.6), line(10, 84, 82, 84, 1.6)]
    alid = [line(10, 84, *pol(10, 84, 74, 322), 1.6), rect(*pol(10, 84, 44, 322), 5, 2.4, 1.0) if False else circle(*pol(10, 84, 74, 322), 2.2, 1.2)]
    scope = [line(10, 84, *pol(10, 84, -8, 322), 1.0, .6)]
    cen = [circle(10, 84, 2.6, 1.4), circle(10, 84, .8, 1.0, fill=True)]
    star = [circle(88, 30, 1.6, 1.0, fill=True), spokes(88, 30, 3, 5, 4, 45, .9, .75), line(86, 34, 66, 52, .8, .4)]
    return layer(-4, *star) + layer(0, *wall, *radii) + layer(4, *arc_, *alid, *scope, *cen)


def stick_chart():
    sticks = [path("M8 18 Q40 22 92 14", 1.8), path("M8 40 Q50 38 92 46", 1.8), path("M8 66 Q50 74 92 62", 1.8),
              path("M8 88 Q40 82 92 90", 1.8), path("M16 8 Q22 50 16 94", 1.8), path("M40 8 Q46 48 38 94", 1.8),
              path("M70 8 Q64 50 74 94", 1.8), path("M90 8 Q86 50 92 94", 1.8)]
    ties = [circle(x, y, 1.6, 1.0) for x, y in [(17, 20), (20, 42), (14, 64), (41, 21), (44, 40), (38, 70), (68, 18), (66, 45), (72, 66), (89, 14), (90, 48), (90, 62)]]
    swells = [path("M20 30 Q40 18 60 30 T92 26", 1.0, .5), path("M14 54 Q38 42 62 56 T94 52", 1.0, .5), path("M10 78 Q36 66 60 80 T94 74", 1.0, .45)]
    shells = [circle(30, 30, 2.4, 1.2), circle(56, 54, 2.2, 1.2), circle(80, 78, 2.4, 1.2), circle(30, 30, .8, 1.0, fill=True), circle(56, 54, .8, 1.0, fill=True), circle(80, 78, .8, 1.0, fill=True)]
    return layer(-4, *swells) + layer(0, *sticks) + layer(4, *ties, *shells)


def mercury_arc():
    bulb = [path("M50 6 Q22 8 20 40 Q20 70 36 82 L64 82 Q80 70 80 40 Q78 8 50 6", 1.8), ellipse(50, 82, 14, 3, 1.0, .5)]
    pool_ = [path("M34 80 Q50 90 66 80", 1.6), path("M38 84 Q50 90 62 84", 1.0, .5)]
    anodes = [line(30, 24, 30, 8, 1.8), line(70, 24, 70, 8, 1.8), rect(26, 24, 8, 6, 1.2), rect(66, 24, 8, 6, 1.2), circle(30, 6, 2, 1.2), circle(70, 6, 2, 1.2)]
    arcs = [path("M30 30 Q36 52 46 76", 1.2, .8), path("M70 30 Q64 52 54 76", 1.2, .8), path("M31 32 Q40 54 48 76", .9, .4)]
    cath = [line(50, 82, 50, 94, 1.8), circle(50, 96, 2.4, 1.4)]
    vapour = [path("M44 56 q-3 -4 0 -8 q3 -4 0 -8", 1.0, .4), path("M56 56 q3 -4 0 -8 q-3 -4 0 -8", 1.0, .4)]
    return layer(-4, *vapour) + layer(0, *bulb, *pool_, *cath) + layer(4, *anodes, *arcs)


def barograph():
    case = [rect(8, 36, 84, 50, 1.8), rect(12, 40, 76, 42, 1.0, .5)]
    drum = [ellipse(54, 50, 22, 5, 1.4), line(32, 50, 32, 72, 1.4), line(76, 50, 76, 72, 1.4), path("M32 72 Q54 80 76 72", 1.4), path("M34 58 Q44 56 54 62 Q64 66 74 60", 1.0, .65)]
    cells = [ellipse(24, 70, 8, 2, 1.0)] + [ellipse(24, 64 - i * 5, 8, 2, 1.0, .85) for i in range(3)]
    arm = [line(24, 56, 28, 40, 1.2, .8), line(28, 44, 36, 60, 1.4), circle(36, 60, 1.2, 1.0, fill=True)]
    lid = [path("M8 36 L16 24 L84 24 L92 36", 1.4), line(16, 24, 84, 24, 1.0)]
    feet = [line(14, 86, 14, 92, 1.8), line(86, 86, 86, 92, 1.8)]
    return layer(-4, *drum) + layer(0, *case, *lid, *feet) + layer(4, *cells, *arm)


def shaduf():
    posts = [line(36, 30, 32, 90, 2.0), line(44, 30, 48, 90, 2.0), line(36, 54, 44, 54, 1.0, .6)]
    beam = [line(14, 20, 82, 40, 2.0), line(14, 24, 82, 44, 1.0, .5)]
    weight = [circle(84, 44, 7, 1.8), path("M80 40 L88 48", .9, .5)]
    rope = [line(14, 22, 12, 52, 1.2)]
    bucket = [path("M5 52 L19 52 L17 66 Q12 68 7 66 Z", 1.6), line(5, 52, 19, 52, 1.0, .6)]
    water = [path("M2 92 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0", 1.2, .6), path("M6 98 q6 -3 12 0 t12 0 t12 0", 1.0, .35)]
    chan = [path("M58 84 L96 84 L96 90", 1.2, .55)]
    return layer(-4, *water, *chan) + layer(0, *posts, *beam, *rope) + layer(4, *weight, *bucket)


def saqiya():
    wheel = [circle(46, 44, 34, 1.8), circle(46, 44, 28, 1.0, .6), circle(46, 44, 5, 1.6), circle(46, 44, 1.6, 1.0, fill=True), spokes(46, 44, 5, 28, 12, 0, 1.2, .85)]
    pots = []
    for k in range(10):
        x, y = pol(46, 44, 34, k * 36 + 10)
        pots.append(path(f"M{x - 3:.1f} {y - 2:.1f} q-1 6 3 6 q4 0 3 -6 z", 1.2))
    water = [path("M2 88 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0", 1.2, .6), line(46, 78, 46, 90, .8, .35)]
    trough = [path("M78 22 L96 22 L96 30", 1.4), path("M70 28 q6 -6 12 -6", 1.0, .5), line(84, 30, 84, 40, 1.0, .45)]
    axle = [line(46, 44, 46, 10, 1.0, .4), rect(40, 8, 12, 4, 1.2)]
    return layer(-4, *water, *trough) + layer(0, *wheel, *axle) + layer(4, *pots)


def archimedes_screw():
    tube = [poly([(24, 74), (30, 82), (76, 22), (70, 14)], 1.8, closed=True)]
    helix = []
    for k in range(8):
        t0 = k / 8
        x0, y0 = 28 + 46 * t0, 78 - 60 * t0
        helix.append(path(f"M{x0 + 0:.1f} {y0 + 2:.1f} q4 -8 8 -4", 1.2, .85))
    shaft = [line(22, 76, 78, 16, 1.2, .7), line(18, 80, 22, 76, 1.8), line(78, 16, 84, 10, 1.8), circle(86, 8, 2.4, 1.4)]
    crank = [line(86, 8, 94, 4, 1.4), line(94, 4, 94, 14, 1.4), circle(94, 15, 1.6, 1.0)]
    water = [path("M4 86 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0", 1.2, .6), path("M10 92 q6 -3 12 0 t12 0 t12 0", 1.0, .35)]
    spill = [path("M70 14 q-6 4 -10 14", 1.0, .5)] if False else [path("M72 18 q-8 -4 -14 2", 1.0, .5), path("M60 24 q-4 6 -2 14", 1.0, .4)]
    return layer(-4, *water, *spill) + layer(0, *tube, *shaft, *crank) + layer(4, *helix)


def grasshopper():
    wcx, wcy = 50, 56
    wheel = [circle(wcx, wcy, 22, 1.4), circle(wcx, wcy, 3, 1.4), spokes(wcx, wcy, 3, 18, 5, 10, 1.1)]
    teeth = []
    for k in range(10):
        a = k * 36
        x0, y0 = pol(wcx, wcy, 22, a)
        x1, y1 = pol(wcx, wcy, 27, a + 10)
        x2, y2 = pol(wcx, wcy, 22, a + 20)
        teeth.append(poly([(x0, y0), (x1, y1), (x2, y2)], 1.2))
    pal1 = [line(30, 28, 38, 36, 2.0), circle(26, 24, 2, 1.2), line(26, 24, 30, 28, 1.6)]
    pal2 = [line(70, 28, 62, 36, 2.0), circle(74, 24, 2, 1.2), line(74, 24, 70, 28, 1.6)]
    frame = [line(26, 24, 26, 10, 1.6), line(74, 24, 74, 10, 1.6), line(26, 10, 74, 10, 1.6), circle(50, 10, 2, 1.2)]
    rod = [line(50, 12, 50, 18, 1.0, .6), path("M26 24 q24 -10 48 0", 1.0, .6)]
    pend = [line(50, 10, 50, 4, 1.0), line(50, 4, 90, 4, 1.4), circle(92, 4, 2.2, 1.2)]
    return layer(-5, *rod, *pend) + layer(0, *wheel, *teeth, *frame) + layer(4, *pal1, *pal2)


def deadbeat():
    wcx, wcy = 50, 54
    wheel = [circle(wcx, wcy, 22, 1.4), circle(wcx, wcy, 3, 1.4), spokes(wcx, wcy, 3, 18, 6, 0, 1.1)]
    teeth = []
    for k in range(15):
        a = k * 24
        x0, y0 = pol(wcx, wcy, 22, a)
        x1, y1 = pol(wcx, wcy, 27.5, a + 4)
        x2, y2 = pol(wcx, wcy, 22, a + 12)
        teeth.append(poly([(x0, y0), (x1, y1), (x2, y2)], 1.2))
    anchor = [path("M50 10 L50 18", 1.6), path("M32 28 Q36 12 50 14 Q64 12 68 28", 1.8), arc(50, 14, 22, 205, 235, 1.8, .9), arc(50, 14, 22, 305, 335, 1.8, .9), circle(50, 14, 2, 1.4)]
    pals = [line(28, 26, 34, 34, 2.0), line(72, 26, 66, 34, 2.0), arc(wcx, wcy, 28, 215, 235, 1.0, .5), arc(wcx, wcy, 28, 305, 325, 1.0, .5)]
    crutch = [line(50, 14, 50, 70, 1.0, .6), poly([(47, 70), (53, 70), (52, 78), (48, 78)], 1.2, closed=True), line(50, 78, 50, 92, 1.4), circle(50, 94, 4, 1.4)]
    return layer(-5, *crutch[:1]) + layer(0, *wheel, *teeth) + layer(4, *anchor, *pals, *crutch[1:])


def fusee():
    cone = [path("M60 14 L66 14 L72 78 L48 78 Z", 1.8)] if False else [poly([(50, 12), (62, 12), (74, 76), (38, 76)], 1.8, closed=True)]
    groove = [path(f"M{52 - i * 1.5:.1f} {16 + i * 12:.1f} q12 4 {24 + i * 3:.1f} 0", .9, .7) for i in range(5)]
    barrel = [circle(18, 56, 14, 1.8), circle(18, 56, 8, 1.0, .6), circle(18, 56, 2, 1.2, fill=True), path("M18 56 m-6 0 a6 6 0 1 1 6 6 a3.5 3.5 0 1 1 -3.5 -3.5", .9, .5)]
    chain = [path("M32 50 Q44 46 50 20", 1.4, .8), path("M32 62 Q56 74 66 74", 1.4, .8)] + [circle(40 + i * 4, 48 - i * 3, .9, .8, .7) for i in range(3)]
    axle = [line(56, 6, 56, 92, 1.2, .6), rect(48, 76, 16, 6, 1.4), line(56, 82, 56, 94, 1.6)]
    wheel = [gear(56, 86, 4, 7, 14, 1.0, .75)] if False else []
    key = [rect(52, 2, 8, 6, 1.2), line(60, 5, 70, 5, 1.2)]
    return layer(-4, *axle, *key) + layer(0, *cone, *barrel) + layer(4, *groove, *chain)


def cotton_gin():
    hopper = [poly([(14, 14), (50, 14), (44, 44), (20, 44)], 1.8, closed=True), line(14, 14, 20, 44, .9, .5)]
    cyl = [circle(32, 54, 12, 1.8)] + [line(*pol(32, 54, 12, k * 30), *pol(32, 54, 16, k * 30 + 12), 1.1) for k in range(12)]
    grate = [path("M42 40 Q50 52 46 66", 1.4), line(44, 44, 48, 62, .8, .5)]
    brush = [circle(66, 56, 10, 1.6)] + [line(*pol(66, 56, 10, k * 30), *pol(66, 56, 14, k * 30), 1.0, .85) for k in range(12)]
    frame = [rect(6, 40, 88, 40, 1.8), line(6, 80, 6, 94, 1.8), line(94, 80, 94, 94, 1.8)]
    crank = [line(32, 54, 32, 54, 1.0), line(32, 66, 32, 86, 1.0, .5), path("M32 86 L22 86 L22 92", 1.4), circle(22, 94, 1.6, 1.0)]
    seeds = [circle(16 + i * 4, 76, 1.2, .9, .7) for i in range(5)]
    lint = [path("M72 70 q8 6 16 4", 1.0, .5), path("M70 72 q10 8 20 6", .9, .4)]
    return layer(-4, *lint, *seeds) + layer(0, *frame, *hopper, *crank) + layer(4, *cyl, *grate, *brush)


def mule():
    frame = [line(6, 34, 6, 92, 2.0), line(94, 34, 94, 92, 2.0), line(6, 92, 94, 92, 1.8), line(6, 34, 94, 34, 1.4)]
    rail = [line(6, 80, 94, 80, 1.0, .5), line(6, 84, 94, 84, 1.0, .5)]
    rollers = [circle(18, 28, 4, 1.4), circle(18, 38, 4, 1.4), circle(30, 28, 4, 1.4), circle(30, 38, 4, 1.4)]
    roving = [line(6, 20, 14, 28, .9, .6), line(14, 28, 40, 38, 1.0, .75)]
    carriage = [rect(46, 64, 44, 12, 1.8), circle(54, 78, 3, 1.2), circle(82, 78, 3, 1.2)]
    spindles = [line(52 + i * 8, 64, 52 + i * 8, 40, 1.1) for i in range(5)] + [path(f"M{52 + i * 8} 40 L{49 + i * 8} 48 L{55 + i * 8} 48 Z", .9, .75) for i in range(5)]
    yarn = [line(38 + i * 0, 38, 52 + i * 8, 40, .8, .35) for i in range(1)] + [line(30, 38, 52 + i * 8, 44, .8, .35) for i in range(1, 5)]
    arrow = [line(46, 88, 70, 88, 1.0, .5), poly([(46, 88), (50, 85), (50, 91)], .9, closed=True)]
    return layer(-4, *rail, *yarn, *arrow) + layer(0, *frame, *carriage, *roving) + layer(4, *rollers, *spindles)


def bagpipes():
    bag = [path("M26 30 Q50 18 76 30 Q82 50 70 68 Q50 76 30 66 Q20 50 26 30", 1.8), path("M30 38 Q50 30 70 40", 1.0, .5)]
    blow = [line(30, 34, 14, 20, 1.8), ellipse(11, 17, 4, 2.4, 1.2), line(24, 28, 20, 24, 1.0, .5)]
    chanter = [line(46, 70, 44, 94, 2.0), line(54, 70, 52, 94, 2.0)] + [circle(48, 76 + i * 3.4, .9, .9, .85) for i in range(5)] + [path("M42 94 L40 98 L56 98 L54 94", 1.2)]
    d1 = [line(36, 28, 24, 4, 1.6), rect(21, 2, 6, 4, 1.0), line(32, 24, 28, 12, 1.0, .5)]
    d2 = [line(50, 22, 48, 2, 1.6), rect(45, 0.5, 6, 3.5, 1.0)]
    d3 = [line(66, 28, 78, 6, 1.6), rect(75, 3, 6, 4, 1.0)]
    stocks = [circle(36, 29, 2, 1.2), circle(50, 23, 2, 1.2), circle(66, 28, 2, 1.2), circle(50, 68, 2, 1.2)]
    return layer(-4, *blow) + layer(0, *bag, *d1, *d2, *d3, *chanter) + layer(4, *stocks)


def clarinet():
    body = [rect(46, 12, 8, 74, 1.8), line(46, 12, 46, 86, 1.0), poly([(44, 86), (56, 86), (62, 96), (38, 96)], 1.6, closed=True)]
    mouth = [poly([(46, 12), (54, 12), (53, 4), (47, 4)], 1.4, closed=True), line(50, 4, 50, 12, 1.0, .5)]
    reed = [poly([(50, 4), (53, 4), (52, 12), (50, 12)], 1.0, .7, closed=True), rect(46, 6, 8, 2.4, 1.2, .6)]
    holes = [circle(50, 30 + i * 7, 1.6, 1.0) for i in range(6)]
    keys = [rect(54, 24, 6, 3, 1.0), line(54, 26, 50, 26, .9, .7), rect(54, 42, 6, 3, 1.0), line(54, 44, 50, 44, .9, .7), rect(40, 56, 6, 3, 1.0), line(46, 58, 50, 58, .9, .7), rect(54, 70, 6, 3, 1.0)]
    reg = [circle(50, 20, 1.2, 1.0, fill=True), line(50, 20, 62, 16, 1.0, .7), circle(62, 16, 1.6, 1.0)]
    rings = [rect(44, 34, 12, 2, 1.0, .7), rect(44, 48, 12, 2, 1.0, .7), rect(44, 62, 12, 2, 1.0, .7)]
    return layer(-4, *reg) + layer(0, *body, *mouth) + layer(4, *holes, *keys, *rings, *reed)


ITEMS = [
    dict(id="exp28_chain_pump", n="Chain Pump", era="civilization", cat="engineering", ds=-700, rar="uncommon",
         date="Babylonian text c. 700 BC; Wang Chong describes one c. AD 80; Agricola 1556", vis="endless-chain-lift", topic="water_lifting_exp28",
         region="Mesopotamia; Han China; Renaissance Europe", artifactType="pump", material="wood and metal", physical=True, durable=False,
         l1="An endless chain of discs pulled up a tube carries water to the top.",
         l2="Discs spaced along an endless chain run through a tube slightly wider than the discs; water trapped between them is carried up and discharged. Some versions carry scoops or pots tipped over the top pulley.",
         l3="Earliest evidence is a Babylonian text of about 700 BC; Philo of Byzantium (2nd century BC) and Vitruvius (c. 30 BC) describe such devices. Wang Chong (AD 27–97) described one about AD 80, and Ma Jun built chain pumps for the gardens of Emperor Ming of Wei (226–239). Agricola illustrated them in 1556; the page does not name materials for historical pumps.",
         ev="Babylonian text c. 700 BC; Agricola, De re metallica (1556); Song Yingxing, Tiangong Kaiwu (1637)", first_known="c. 700 BC",
         confidence=dict(level="established", note="The page flags the Egyptian c. 200 BC gear-wheel claim as disputed and gives no materials for historical pumps."),
         srcs=[wp("chainpump_wp", "Chain_pump", "Babylonian text c. 700 BC; Philo 2nd c. BC; Vitruvius c. 30 BC; Wang Chong c. AD 80; Ma Jun 226–239; Agricola 1556; discs on an endless chain in a tube.")],
         pool=['rope', 'wheel', 'pulley', 'wood', 'axle', 'cordage', 'bronze', 'lever', 'water_power'], must=['wheel'], nrec=2,
         tags=["water_lifting", "pump"], regions=["africa_asia", "europe"], art=chain_pump()),
    dict(id="exp28_davis_quadrant", n="Davis Quadrant", era="science", cat="technology", ds=1594, rar="uncommon",
         date="John Davis, Seaman's Secrets, 1594", vis="back-staff", topic="navigation_exp28",
         region="England (John Davis)", artifactType="navigation instrument", material="wood", physical=True, durable=False,
         l1="A two-arc wooden staff that measures the sun's height with your back to the sun.",
         l2="Keep the sun at your back and move the shadow vane until its shadow falls on the slit in the horizon vane, then move the sight vane until the horizon lines up. The sun's altitude is the sum of the readings on the two arcs, corrected for the sun's semidiameter.",
         l3="John Davis described it in Seaman's Secrets in 1594 (the page gives 1594, not 1595). Splitting the arc into a small upper and a large lower arc gave the accuracy of a single big arc without a huge instrument. Flamsteed suggested a projecting glass in place of the shadow vane, and Benjamin Cole invented a backstaff in 1748.",
         ev="Davis, Seaman's Secrets (1594)", first_known="1594",
         confidence=dict(level="established", note="The page does not mention Hadley."),
         srcs=[wp("backstaff_wp", "Backstaff", "John Davis described the backstaff in Seaman's Secrets 1594; shadow vane, horizon vane, two arcs; Flamsteed glass; Cole 1748.")],
         pool=['navigation', 'astronomy', 'wood', 'measurement', 'geometry', 'observation', 'mathematics'], must=['navigation'], nrec=2,
         tags=["navigation", "maritime"], regions=["europe"], tradeImportance="medium", art=davis_quadrant()),
    dict(id="exp28_mance_heliograph", n="Mance Heliograph", era="industry", cat="technology", ds=1869, rar="uncommon",
         date="H. C. Mance, about 1869 (Karachi); Gauss's heliotrope, 1821", vis="signal-mirror", topic="signalling_exp28",
         region="British India (Karachi); United States (Arizona, 1886)", artifactType="signalling device", material="mirror and tripod", physical=True, durable=True,
         l1="A tilting mirror on a tripod that flashes sunlight in Morse code across tens of miles.",
         l2="The operator sights the target through the mirror and its aiming rod, and a keying lever tilts the mirror a few degrees to send flashes in Morse code. A shutter-type version keeps the mirror fixed and interrupts the beam.",
         l3="Carl Friedrich Gauss developed a predecessor, the heliotrope, in 1821. Henry Christopher Mance developed the first widely accepted heliograph about 1869 at Karachi; it was first tested in war in 1877. A US Army detachment set the world record of 183 miles on 17 September 1894, and heliographs were still used by Pakistan's army in 1975.",
         ev="Mance heliograph (c. 1869); US Army record range (1894)", first_known="c. 1869",
         confidence=dict(level="established", note="Page says 'about 1869' for Mance, with no exact date."),
         srcs=[wp("helio_wp", "Heliograph", "Gauss heliotrope 1821; Mance about 1869 at Karachi; first war test 1877; Miles 1886 Arizona; record 183 mi 17 Sep 1894; used 1975.")],
         pool=['glass', 'mathematics', 'optics', 'telegraph', 'metallurgy', 'copper', 'iron', 'observation'], must=['optics'], nrec=2,
         tags=["signalling", "optics"], regions=["africa_asia", "americas"], art=heliograph()),
    dict(id="exp28_meridian_circle", n="Meridian Circle", era="science", cat="science", ds=1704, rar="rare",
         date="Rømer's transit instrument 1690; vertical circle added 1704; Troughton 1806; Airy 1850", vis="transit-telescope", topic="astronomy_exp28",
         region="Copenhagen (Ole Rømer); Greenwich (Airy)", artifactType="astronomical instrument", material="brass and glass", physical=True, durable=True,
         l1="A telescope that swings only north–south and times when stars cross the meridian.",
         l2="The telescope turns on a fixed east–west axis; stars are timed crossing vertical wires, giving right ascension, while circles read by microscopes give altitude, hence declination. A basin of mercury gives a horizontal reference.",
         l3="Ole Rømer invented the transit instrument in 1690 and in 1704 added a vertical circle. The page dates the first modern transit circle to Troughton's Groombridge instrument of 1806, and the Greenwich circle to 1850. The Carlsberg Automatic Meridian Circle (1984) was the first automated one.",
         ev="Groombridge Transit Circle (1806); Airy Transit Circle (1850)", first_known="1690–1704",
         confidence=dict(level="established", note="The page gives 1690 for Rømer's transit instrument and 1704 for the added circle."),
         srcs=[wp("meridian_wp", "Meridian_circle", "Rømer 1690 transit instrument, vertical circle 1704; Troughton 1806; Airy 1850; Carlsberg 1984; times meridian crossings, microscopes read circles, mercury basin reference.")],
         pool=['astronomy', 'lens', 'optics', 'measurement', 'clock', 'mathematics', 'copper', 'geometry'], must=['astronomy', 'clock'], nrec=2,
         tags=["astronomy", "instrument"], regions=["europe"], art=meridian_circle()),
    dict(id="exp28_mural_quadrant", n="Mural Quadrant", era="science", cat="science", ds=1725, rar="uncommon",
         date="Graham's Greenwich mural quadrant, erected 1725 (Bradley's first observation 15 June 1742)", vis="wall-arc", topic="astronomy_exp28",
         region="Greenwich (George Graham); Hven (Tycho Brahe); Alexandria (Ptolemy)", artifactType="astronomical instrument", material="brass", physical=True, durable=True,
         l1="A graduated quarter-circle fixed to a wall that lies exactly on the meridian.",
         l2="The observer moves a second indicator, alidade or reticle telescope along the arc until it lines up with the star and reads its altitude, which gives declination. A sidereal clock times the meridian crossing, giving right ascension.",
         l3="The page names Ptolemy's quadrant at Alexandria and Tycho Brahe's at Uraniborg without dates; the Greenwich quadrant was erected in 1725 by George Graham, and Bradley's first observation with it was on 15 June 1742.",
         ev="Graham's Greenwich quadrant (1725)", first_known="1725 (Greenwich)",
         confidence=dict(level="established", note="Ancient and Tycho examples are mentioned without dates; Bird's dates are not given."),
         srcs=[wp("mural_wp", "Mural_instrument", "Graham quadrant at Greenwich 1725; Bradley first observation 15 June 1742; fixed to a meridian wall; Ptolemy and Tycho examples undated.")],
         pool=['astronomy', 'geometry', 'measurement', 'clock', 'copper', 'mathematics', 'bronze', 'stone'], must=['astronomy', 'geometry'], nrec=2,
         tags=["astronomy", "instrument"], regions=["europe"], art=mural_quadrant()),
    dict(id="exp28_marshallese_stick_chart", n="Marshallese Stick Chart", era="science", cat="knowledge", ds=1862, rar="rare",
         date="Documented by a missionary notice in 1862; described by Winkler in 1898; origin undated", vis="swell-lattice", topic="navigation_exp28",
         region="Marshall Islands (Micronesia)", artifactType="navigation chart", material="coconut frond midribs and shells", physical=True, durable=False,
         l1="A lattice of coconut-rib sticks that teaches how island swells bend.",
         l2="Curved sticks and threads show the four main swells (rilib, kaelib, bungdockerik and bundockeing) and how islands disturb them; shells or lashed junctions mark islands. Mattang charts teach, meddo show part of one island chain, and rebbelib show most of one or both chains.",
         l3="The page dates a public missionary notice revealing the piloting system to 1862 and says Winkler of SMS Bussard, stationed there in 1896, published his description in 1898. It gives no invention date for the charts themselves.",
         ev="Missionary notice (1862); Winkler (1898)", first_known="1862 (documented)",
         confidence=dict(level="uncertain", note="Date is the earliest documentation on the page, not an invention date; the page does not call 1862 the first Western documentation."),
         srcs=[wp("stick_wp", "Marshall_Islands_stick_chart", "Mattang, meddo and rebbelib types; four swells; coconut frond midribs and shells; 1862 missionary notice; Winkler 1898.")],
         pool=['navigation', 'cordage', 'wood', 'observation', 'fiber', 'maps', 'boat', 'rope'], must=['navigation', 'cordage'], nrec=2,
         tags=["navigation", "maritime"], regions=["oceania"], art=stick_chart()),
    dict(id="exp28_mercury_arc_rectifier", n="Mercury-Arc Rectifier", era="electric", cat="technology", ds=1902, rar="rare",
         date="Peter Cooper Hewitt, 1902; HVDC valve on Gotland link, 1954", vis="arc-valve", topic="electronics_exp28",
         region="United States (Peter Cooper Hewitt); Sweden (Uno Lamm, ASEA)", artifactType="electric valve", material="glass or steel and mercury", physical=True, durable=True,
         l1="A sealed tube with a mercury-pool cathode that lets current pass only one way.",
         l2="An arc forms in low-pressure mercury vapour between a mercury cathode and carbon anodes. Carbon anodes emit few electrons, so current flows only from cathode to anode, rectifying alternating current. A control grid can delay conduction to adjust the output voltage.",
         l3="Jamin and Maneuvrier observed the effect in 1882; Hewitt invented the rectifier in 1902. Uno Lamm's work at ASEA produced the first practical HVDC valve, in service in 1954 on the Gotland link. The Inter-Island link in New Zealand, decommissioned 1 August 2012, was the last to use them.",
         ev="Hewitt (1902); Gotland HVDC link (1954)", first_known="1902",
         confidence=dict(level="established", note="Page dates Hewitt's invention 1902 and the first practical HVDC valve 1954."),
         srcs=[wp("arc_wp", "Mercury-arc_valve", "Hewitt 1902; Jamin and Maneuvrier 1882; ASEA Gotland HVDC 1954; mercury-pool cathode and carbon anodes; Inter-Island decommissioned 1 Aug 2012.")],
         pool=['electricity', 'glass', 'physics', 'copper', 'chemistry', 'iron', 'experiment', 'steel'], must=['electricity', 'glass'], nrec=2,
         tags=["electronics", "power"], regions=["americas", "europe"], art=mercury_arc()),
    dict(id="exp28_barograph", n="Stacked-Aneroid Barograph", era="industry", cat="science", ds=1844, rar="uncommon",
         date="Vidie stacked-aneroid barograph 1844; Cumming's 1760s claim; Ronalds' photographic barograph 1845", vis="drum-recorder", topic="meteorology_exp28",
         region="France (Lucien Vidi); England (Francis Ronalds)", artifactType="recording instrument", material="metal and paper", physical=True, durable=True,
         l1="A pen on a clockwork drum that draws the changing air pressure as a line.",
         l2="Stacked aneroid cells drive a lever train to a pen that marks paper on a drum turned slowly by clockwork, once per day, week or month. Rising pressure lifts the pen and falling pressure lowers it.",
         l3="Alexander Cumming claimed the first effective barograph in the 1760s (decade only); Karl Kreil described a siphon-barometer machine in 1843; Lucien Vidi made the stacked-aneroid barograph in 1844; Francis Ronalds created the first successful photographic barograph in 1845 and added temperature compensation in 1847.",
         ev="Vidi (1844); Ronalds (1845, 1847)", first_known="1844",
         confidence=dict(level="established", note="Cumming's 1760s priority is only a claim; the page does not mention Wren, Hooke or Richard."),
         srcs=[wp("barograph_wp", "Barograph", "Cumming claim 1760s; Kreil 1843; Vidi stacked aneroid 1844; Ronalds photographic 1845, compensation 1847; pen on clockwork drum.")],
         pool=['physics', 'clock', 'paper', 'measurement', 'copper', 'mechanism', 'observation', 'lever'], must=['clock'], nrec=2,
         tags=["meteorology", "recording"], regions=["europe"], art=barograph()),
    dict(id="exp28_shaduf", n="Shaduf", era="civilization", cat="technology", ds=-2200, rar="common",
         date="Cylinder seal c. 2200 BCE; possibly Sargon of Akkad's time (24th–23rd centuries BCE)", vis="counterweight-lever", topic="water_lifting_exp28",
         region="Mesopotamia; later Egypt (after 2000 BC), Minoan Crete, China", artifactType="water-lifting device", material="wood, reed and clay", physical=True, durable=False,
         l1="A pole on a post with a bucket on one end and a clay weight on the other.",
         l2="A long pole pivots on an upright frame about one-fifth of its length from one end. The operator pushes the empty bucket down with body weight and the counterweight then lifts the full bucket with little effort.",
         l3="The earliest evidence on the page is a cylinder seal showing a shadoof, dated to about 2200 BCE; one theory places the invention in Mesopotamia in Sargon's time. It reached Upper Egypt after 2000 BC, most likely in the 18th Dynasty. Buckets were skin bags, bitumen-coated reed baskets or buckets; counterweights were clay or stone.",
         ev="Cylinder seal c. 2200 BCE; Theban tomb drawings c. 1250 BCE", first_known="c. 2200 BCE",
         confidence=dict(level="established", note="Page places the seal at c. 2200 BCE, earlier than the c. 2000 BC often quoted."),
         srcs=[wp("shaduf_wp", "Shadoof", "Cylinder seal c. 2200 BCE; Sargon of Akkad theory; Egypt after 2000 BC; counterweight pole one-fifth from end; skin bag or reed basket bucket; clay or stone weight.")],
         pool=['lever', 'wood', 'rope', 'stone', 'pottery', 'cordage', 'plant_thread', 'bone'], must=['lever'], nrec=2,
         tags=["water_lifting", "irrigation"], regions=["africa_asia"], art=shaduf()),
    dict(id="exp28_saqiya_wheel", n="Saqiya Water Wheel", era="civilization", cat="technology", ds=-250, rar="uncommon",
         date="Saqiyah from the Faiyum, 3rd century BC; Callixenus under Ptolemy IV; ceramic-pot noria c. AD 300", vis="pot-wheel", topic="water_lifting_exp28",
         region="Ptolemaic Egypt (Faiyum); later Syria and Spain", artifactType="water-lifting wheel", material="wood and pottery", physical=True, durable=False,
         l1="A large wheel with pots on its rim that scoops water from a stream and tips it into a channel.",
         l2="Containers on the rim lift water to an aqueduct at the top and discharge it sideways into a channel. A sakia is generally animal-driven, while a noria is turned by river current.",
         l3="The oldest archaeological evidence of a water wheel is a saqiyah from the Faiyum, 3rd century BC; Callixenus describes one under Ptolemy IV Philopator in the late 3rd century BC. Around 300 the Romans replaced wooden compartments with separate ceramic pots tied to an open-framed wheel, creating the noria. The page gives no date for the 20 m wheels at Hama.",
         ev="Faiyum saqiyah, 3rd century BC; Callixenus on Ptolemy IV", first_known="3rd century BC",
         confidence=dict(level="established", note="Terms overlap; the page gives no date for Hama's norias."),
         srcs=[wp("noria_wp", "Noria", "Faiyum saqiyah 3rd c. BC; Callixenus under Ptolemy IV; Romans around 300 used ceramic pots; sakia animal-powered, noria current-powered.")],
         pool=['wheel', 'axle', 'pottery', 'wood', 'water_power', 'cart', 'cordage', 'rope'], must=['wheel', 'pottery'], nrec=2,
         tags=["water_lifting", "irrigation"], regions=["africa_asia"], art=saqiya()),
    dict(id="exp28_archimedes_screw", n="Archimedes' Screw", era="civilization", cat="engineering", ds=-250, rar="uncommon",
         date="Moschion's account, written between 250 and 220 BC; traditionally credited to Archimedes", vis="helical-lift", topic="water_lifting_exp28",
         region="Syracuse and Egypt (Hellenistic); possibly Babylon (Dalley's theory)", artifactType="water-lifting machine", material="wood and lead or bronze", physical=True, durable=False,
         l1="A helix inside a tilted tube that raises water as the shaft is turned.",
         l2="A helical surface wraps around a central shaft inside a hollow pipe. Turning the shaft makes the bottom scoop up water, which the helix pushes up the tube until it spills out the top. Run backwards, falling water turns it and can drive a generator.",
         l3="Archimedes is traditionally credited but historians dispute this; Oleson finds no evidence for the device before about 250 BC. Moschion's treatise (250–220 BC) describes one as a bilge pump on Hiero II's great ship; Vitruvius (27–22 BC) details an eight-bladed one. Dalley's theory of Sennacherib's bronze screws at Babylon is contested.",
         ev="Moschion (250–220 BC); Vitruvius, De Architectura (27–22 BC); Pompeii fresco before AD 79", first_known="c. 250 BC",
         confidence=dict(level="debated", note="Attribution to Archimedes is disputed; Dalley's Babylon theory is one scholar's reading."),
         srcs=[wp("arch_wp", "Archimedes%27_screw", "No evidence before c. 250 BC; Moschion 250–220 BC; Vitruvius 27–22 BC; Pompeii fresco before AD 79; helix in pipe lifts water; Dalley theory.")],
         pool=['mathematics', 'wood', 'geometry', 'mechanism', 'wheel', 'engineering', 'lever', 'bronze', 'pulley'], must=['mathematics'], nrec=2,
         tags=["water_lifting", "engineering"], regions=["europe", "africa_asia"], art=archimedes_screw()),
    dict(id="exp28_grasshopper_escapement", n="Grasshopper Escapement", era="science", cat="engineering", ds=1722, rar="rare",
         date="John Harrison, around 1722 (Brocklesby turret clock)", vis="hinged-pallets", topic="timekeeping_exp28",
         region="Lincolnshire, England (John Harrison)", artifactType="mechanism", material="brass and steel", physical=True, durable=True,
         l1="An escapement with two hinged pallets that needs no oil.",
         l2="Two hinged pallets on an anchor both point against the escape wheel; one releases only when the other engages, so each impulse to the pendulum is evenly timed. The pallets move on hinges with little sliding, so little friction arises and no lubrication is needed.",
         l3="John Harrison built it around 1722 for a turret clock at Brocklesby Hall, Lincolnshire, and used it in his marine timekeepers H1 to H3.",
         ev="Harrison's Brocklesby turret clock", first_known="c. 1722",
         confidence=dict(level="established", note="The page says 'around 1722'; no exact date."),
         srcs=[wp("grass_wp", "Grasshopper_escapement", "Harrison around 1722; first built for a turret clock at Brocklesby Hall; two hinged pallets; no lubrication; used in H1 to H3.")],
         pool=['clock', 'gear', 'mechanism', 'lever', 'iron', 'copper', 'metallurgy', 'steel', 'engineering', 'wood'], must=['clock'], nrec=2,
         tags=["timekeeping", "mechanism"], regions=["europe"], art=grasshopper()),
    dict(id="exp28_deadbeat_escapement", n="Deadbeat Escapement", era="science", cat="engineering", ds=1675, rar="rare",
         date="Richard Towneley, about 1675; Graham's regulators about 1715", vis="dead-faces", topic="timekeeping_exp28",
         region="England (Richard Towneley, George Graham)", artifactType="mechanism", material="brass and steel", physical=True, durable=True,
         l1="An escapement whose curved resting faces give the pendulum no backward kick.",
         l2="Each pallet has a curved dead face concentric with the anchor's pivot; a tooth resting on it exerts no force on the pendulum. Near the bottom of the swing the tooth slides onto a sloped impulse face and pushes the pendulum. Unlike the anchor, the escape wheel is never pushed backwards.",
         l3="The page says it was invented around 1675 by Richard Towneley, not George Graham, who introduced it in his precision regulator clocks about 1715; crediting Graham is a common error. It replaced the anchor in regulators in the 18th century and almost all pendulum clocks made today use it.",
         ev="Towneley (c. 1675); Graham regulators (c. 1715)", first_known="c. 1675",
         confidence=dict(level="debated", note="Attribution corrected by the page: Towneley c. 1675, popularised by Graham c. 1715."),
         srcs=[wp("dead_wp", "Deadbeat_escapement", "Invented around 1675 by Towneley; Graham introduced it in regulators about 1715; dead faces concentric with the pivot; no recoil; replaced anchor in regulators.")],
         pool=['clock', 'anchor_escapement', 'gear', 'mechanism', 'lever', 'iron', 'engineering', 'copper'], must=['clock'], nrec=2,
         tags=["timekeeping", "mechanism"], regions=["europe"], art=deadbeat()),
    dict(id="exp28_fusee", n="Fusee", era="science", cat="engineering", ds=1405, rar="uncommon",
         date="Earliest known fusee in a crossbow windlass, 1405; Burgundy clock c. 1430; Zech's dated clock 1525", vis="conical-drum", topic="timekeeping_exp28",
         region="Europe (inventor unknown); Prague (Jacob Zech's dated clock)", artifactType="mechanism", material="brass and steel", physical=True, durable=True,
         l1="A cone with a spiral groove and a chain that evens out a mainspring's pull.",
         l2="A mainspring pulls hardest when fully wound. The fusee is a tapered pulley with a helical groove joined to the barrel by a chain: wound up, the chain sits on the narrow top, giving small leverage to the strong spring; running down, it moves to the wide base, giving more leverage to the weaker spring.",
         l3="The inventor is unknown; the page says crediting Jacob Zech of Prague around 1525 is wrong. The earliest known fusee is in a 1405 crossbow-windlass manuscript, Brunelleschi and Leonardo drew fusees, and the Burgundy clock of about 1430 is the earliest surviving spring-driven fusee clock.",
         ev="Burgundy clock (c. 1430); Zech clock (1525)", first_known="1405",
         confidence=dict(level="established", note="Inventor unknown; the page notes the optimal profile is a hyperboloid rather than a simple cone."),
         srcs=[wp("fusee_wp", "Fusee_(horology)", "Earliest known fusee 1405 in a crossbow windlass manuscript; Burgundy clock c. 1430; Zech 1525 earliest dated clock; conical grooved drum with chain equalises torque.")],
         pool=['clock', 'gear', 'mechanism', 'spring', 'cordage', 'iron', 'metallurgy', 'steel'], must=['clock'], nrec=2,
         tags=["timekeeping", "mechanism"], regions=["europe"], art=fusee()),
    dict(id="exp28_cotton_gin", n="Whitney Cotton Gin", era="industry", cat="technology", ds=1794, rar="uncommon",
         date="Eli Whitney, applied 28 October 1793, patent granted 14 March 1794", vis="toothed-cylinder", topic="textile_machines_exp28",
         region="United States (Eli Whitney); India (earlier roller gins)", artifactType="textile machine", material="wood and iron", physical=True, durable=True,
         l1="A toothed drum that pulls cotton fibre through a grate too fine for the seeds.",
         l2="A toothed cylinder catches the fibres and pulls them through small holes in a metal plate; seeds are too big and fall into a pot. A second cylinder fitted with brushes wipes the cleaned fibre off into a bucket.",
         l3="Whitney applied for the patent on 28 October 1793 and was granted it on 14 March 1794. The page puts earlier single-roller gins in Ajanta paintings of the 5th century, two-roller gins in the 12th–14th centuries, and a worm-gear roller gin in the 13th–14th centuries; it gives no date for the saw gin.",
         ev="Whitney's patent of 1794", first_known="1794",
         confidence=dict(level="established", note="Indian roller gins are older; the page gives only centuries for them."),
         srcs=[wp("gin_wp", "Cotton_gin", "Whitney applied 28 Oct 1793, granted 14 Mar 1794; toothed cylinder, metal plate, brush cylinder; Ajanta 5th-century roller gins; worm-gear gin 13th–14th century.")],
         pool=['mechanism', 'cloth', 'plant_thread', 'wood', 'iron', 'wheel', 'gear', 'lever'], must=['mechanism'], nrec=2,
         tags=["textile", "agriculture"], regions=["americas", "africa_asia"], tradeImportance="high", art=cotton_gin()),
    dict(id="exp28_spinning_mule", n="Spinning Mule", era="industry", cat="technology", ds=1779, rar="rare",
         date="Samuel Crompton, 1779 (intro range 1775–1779); Roberts' self-acting mule patented 1825", vis="moving-carriage", topic="textile_machines_exp28",
         region="Lancashire, England (Samuel Crompton, Richard Roberts)", artifactType="textile machine", material="wood and iron", physical=True, durable=True,
         l1="A spinning machine whose spindles ride out on a carriage, twisting yarn as they retreat.",
         l2="The spindles sit on a carriage that moves away from the feed rollers on the outward run while the roving is twisted into yarn. On the return, 'putting up', the carriage moves back and the new yarn is wound onto the spindle as a cone-shaped cop.",
         l3="Samuel Crompton invented the spinning mule in 1779 per the page (its introduction gives a range of 1775–1779); Richard Roberts patented the self-acting mule in 1825.",
         ev="Crompton's mule (1779); Roberts' patent (1825)", first_known="1779",
         confidence=dict(level="established", note="The page itself gives both 1779 and a wider 1775–1779 range."),
         srcs=[wp("mule_wp", "Spinning_mule", "Crompton 1779 (range 1775–1779); Roberts self-acting mule patent 1825; carriage moves out and back; yarn wound into cops.")],
         pool=['mechanism', 'cloth', 'plant_thread', 'wheel', 'wood', 'iron', 'gear', 'weaving_shuttle'], must=['mechanism', 'wheel'], nrec=2,
         tags=["textile", "factory"], regions=["europe"], art=mule()),
    dict(id="exp28_bagpipes", n="Bagpipes", era="civilization", cat="technology", ds=60, rar="common",
         date="Dio Chrysostom, 1st century AD (possibly Nero); earliest artefact: Rostock chanter, late 14th–early 15th century", vis="bag-and-drones", topic="music_exp28",
         region="Europe, North Africa, West and South Asia", artifactType="musical instrument", material="animal skin, reed and wood", physical=True, durable=False,
         l1="A skin bag squeezed under the arm that feeds air to a melody pipe and droning pipes.",
         l2="Air blown through a blowpipe, or pumped by a bellows, fills an airtight bag; arm pressure forces it through the chanter and drones, where reeds vibrate. The chanter plays the melody with two hands and is hard to silence, so players use ornaments for articulation.",
         l3="The page notes a c. 1000 BCE Hittite slab at Euyuk that some read as bagpipes (others read as a pan flute and friction drum). Dio Chrysostom in the 1st century AD described a sovereign, possibly Nero, with a pipe and bladder under the armpit; Suetonius calls Nero a player of the tibia utricularis. The Rostock chanter found in 1985 is the earliest known artefact.",
         ev="Dio Chrysostom (1st century AD); Rostock chanter (found 1985)", first_known="1st century AD",
         confidence=dict(level="debated", note="The c. 1000 BCE Hittite sculpture is read two ways; the 1st-century text is only 'possibly' Nero."),
         srcs=[wp("bagpipes_wp", "Bagpipes", "Hittite slab c. 1000 BCE debated; Dio Chrysostom 1st century and Suetonius 2nd century on Nero; Rostock chanter earliest artefact; bag, chanter, drones, stocks.")],
         pool=['music', 'flute', 'fiber', 'cordage', 'bone', 'wood', 'cloth', 'pottery'], must=['flute'], nrec=2,
         tags=["music", "wind_instrument"], regions=["europe", "africa_asia"], art=bagpipes()),
    dict(id="exp28_clarinet", n="Clarinet", era="science", cat="culture", ds=1700, rar="uncommon",
         date="Johann Christoph Denner (or son Jacob), about 1700; first use of 'clarinette' 1710", vis="single-reed-tube", topic="music_exp28",
         region="Nuremberg, Germany (Denner family)", artifactType="musical instrument", material="boxwood and brass", physical=True, durable=False,
         l1="A single-reed wooden tube that gained a register key and so a whole new upper range.",
         l2="One reed on a mouthpiece vibrates against a cylindrical bore with finger holes and keys. The register key added to the older chalumeau lets it overblow to a higher register.",
         l3="The page credits Johann Christoph Denner or possibly his son Jacob with adding a register key to the chalumeau around the beginning of the 18th century. The earliest mention of 'clarinette' is a 1710 order from the Duke of Gronsfeld. Iwan Müller presented a 13-key clarinet in 1812, and Klosé and Buffet applied the Böhm key system to it between 1839 and 1843.",
         ev="Gronsfeld order (1710); Müller 13-key clarinet (1812)", first_known="c. 1700",
         confidence=dict(level="debated", note="The page gives only 'around the beginning of the 18th century' and names father or son."),
         srcs=[wp("clarinet_wp", "Clarinet", "Denner or his son added a register key to the chalumeau around 1700; Gronsfeld order 1710; Müller 13-key 1812; Klosé and Buffet Böhm system 1839–1843.")],
         pool=['music', 'flute', 'wood', 'bone', 'metallurgy', 'copper', 'mechanism', 'lever', 'brass'], must=['music', 'flute'], nrec=2,
         tags=["music", "wind_instrument"], regions=["europe"], art=clarinet()),
]
