"""EXP28 batch 05 — meteorology, surveying, navigation charts, computing, siege engines, organ.
Facts only from pages fetched 2026-10-16."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def sunshine():
    bowl = [path("M18 70 Q18 54 50 52 Q82 54 82 70", 1.8), arc(50, 62, 30, 190, 350, 1.2, .6)]
    ball = [circle(50, 40, 18, 1.8), circle(50, 40, 14, 1.0, .5), path("M40 32 Q46 26 54 28", 1.0, .6)]
    stand = [line(50, 58, 50, 78, 1.6), rect(34, 78, 32, 5, 1.6), line(30, 83, 70, 83, 1.4)]
    card = [path("M18 70 Q50 60 82 70", 1.2, .85), path("M20 74 Q50 64 80 74", 1.0, .55), path("M24 78 Q50 70 76 78", 1.0, .4)]
    burn = [line(30, 69, 36, 67, 1.6), line(44, 64, 56, 64, 1.6), line(66, 66, 72, 68, 1.6)]
    rays = [line(6, 6, 34, 28, 1.0, .55), line(20, 4, 42, 24, 1.0, .5), line(36, 2, 50, 22, 1.0, .5)]
    sun = [circle(10, 6, 4, 1.2, .8), spokes(10, 6, 5.5, 8, 8, 0, 1.0, .6)]
    return layer(-4, *rays, *sun) + layer(0, *bowl, *stand, *card) + layer(4, *ball, *burn)


def six_thermo():
    tube = [path("M30 24 L30 74 Q30 86 50 86 Q70 86 70 74 L70 24", 1.8), path("M34 24 L34 72 Q34 82 50 82 Q66 82 66 72 L66 24", 1.0, .5)]
    bulbs = [circle(30, 16, 8, 1.6), circle(70, 16, 8, 1.6), circle(30, 16, 5, 1.0, .5)]
    merc = [path("M34 60 Q34 78 50 78 Q66 78 66 60", 1.2, .7), line(34, 60, 66, 60, .8, .35)]
    idx = [rect(31.5, 44, 3, 5, 1.0), rect(65.5, 54, 3, 5, 1.0)]
    scale = [line(22, 30 + i * 6, 26, 30 + i * 6, .9, .7) for i in range(8)] + [line(74, 30 + i * 6, 78, 30 + i * 6, .9, .7) for i in range(8)]
    board = [rect(14, 6, 72, 88, 1.6, .7)]
    magnet = [path("M44 94 L44 98 M56 94 L56 98", 1.4)]
    return layer(-4, *board) + layer(0, *tube, *bulbs, *magnet) + layer(4, *merc, *idx, *scale)


def nephoscope():
    compass = [circle(50, 52, 34, 1.8), circle(50, 52, 30, 1.0, .6), ticks(50, 52, 26, 30, 0, 360, 36, .8, .7)]
    rings = [circle(50, 52, 8, 1.0, .85), circle(50, 52, 16, 1.0, .65), circle(50, 52, 24, 1.0, .45)]
    needle = [line(50, 52, 50, 28, 1.4), line(50, 52, 50, 70, 1.0, .6), circle(50, 52, 1.6, 1.0, fill=True)]
    window = [rect(44, 64, 12, 6, 1.0, .6)]
    pointer = [line(80, 52, 80, 16, 1.4), circle(80, 14, 1.6, 1.0, fill=True), line(80, 52, 62, 52, .9, .5)]
    screws = [circle(14, 88, 2.2, 1.2), circle(86, 88, 2.2, 1.2), circle(50, 94, 2.2, 1.2), line(14, 88, 86, 88, 1.0, .35)]
    cloud = [path("M12 14 q4 -8 12 -4 q6 -6 12 0 q8 -2 8 6 q-4 4 -16 2 q-10 2 -16 -4", 1.0, .55)]
    track = [line(30, 40, 62, 62, .9, .45)]
    return layer(-4, *cloud, *track) + layer(0, *compass, *screws, *pointer) + layer(4, *rings, *needle, *window)


def gregorian():
    tube = [poly([(10, 36), (80, 32), (80, 62), (10, 66)], 1.8, closed=True)]
    prim = [path("M78 34 Q84 48 78 60", 1.8), line(78, 44, 78, 50, 2.4, .0) if False else circle(78, 47, 2.0, 1.0)]
    sec = [path("M18 40 Q10 50 18 62", 1.6), line(14, 51, 8, 51, 1.0, .6)]
    eye = [rect(84, 42, 8, 10, 1.4), circle(94, 47, 2.4, 1.2), line(92, 47, 98, 47, 1.0, .6)]
    rays = [line(2, 38, 76, 40, .9, .5), line(2, 56, 76, 54, .9, .5), line(76, 42, 22, 49, .9, .6), line(76, 52, 22, 51, .9, .6)]
    stand = [line(46, 66, 38, 92, 1.8), line(46, 66, 56, 92, 1.8), line(30, 92, 64, 92, 1.4)]
    mount = [circle(46, 49, 3, 1.2, .6)] if False else [rect(40, 62, 12, 6, 1.4)]
    return layer(-4, *rays) + layer(0, *tube, *stand, *mount) + layer(4, *prim, *sec, *eye)


def groma():
    staff = [line(50, 20, 50, 92, 2.0), line(44, 92, 56, 92, 1.8), line(50, 92, 50, 98, 1.6)]
    cross = [line(18, 20, 82, 20, 2.0), line(50, 8, 50, 32, 2.0), circle(50, 20, 2.4, 1.4)]
    bobs = []
    for x, y in [(18, 20), (82, 20), (50, 8), (50, 32)]:
        bobs += [line(x, y, x, y + 40 if y != 32 else y + 24, .8, .6), poly([(x - 2, y + (40 if y != 32 else 24)), (x + 2, y + (40 if y != 32 else 24)), (x, y + (46 if y != 32 else 30))], 1.0, closed=True)]
    bracket = [path("M50 38 L66 28 L82 20", 1.0, .5)]
    pole = [line(92, 36, 92, 94, 1.4, .6), circle(92, 34, 1.6, 1.0)]
    sight = [line(18, 20, 92, 20, .8, .35)]
    return layer(-4, *sight, *pole) + layer(0, *staff, *cross, *bracket) + layer(4, *bobs)


def chorobates():
    beam = [rect(8, 38, 84, 8, 1.8), line(8, 42, 92, 42, 1.0, .6)]
    legs = [line(18, 46, 16, 92, 2.0), line(82, 46, 84, 92, 2.0), line(18, 62, 82, 62, 1.0, .5)]
    diag = [line(30, 92, 38, 46, 1.2, .8), line(70, 92, 62, 46, 1.2, .8)] + [line(32 + i * 1.2, 78 - i * 8, 36 + i * 1.2, 78 - i * 8, .8, .7) for i in range(3)]
    plumbs = [line(12, 46, 12, 74, .9, .7), poly([(10, 74), (14, 74), (12, 79)], 1.0, closed=True), line(88, 46, 88, 74, .9, .7), poly([(86, 74), (90, 74), (88, 79)], 1.0, closed=True)]
    marks = [line(12, 74, 12, 74, 1.0, .5), line(10, 68, 14, 68, .8, .6), line(86, 68, 90, 68, .8, .6)]
    water = [path("M12 40 L88 40", 1.2, .75), path("M16 38 q4 -2 8 0 t8 0 t8 0", .9, .4)]
    feet = [line(10, 92, 22, 92, 1.4), line(78, 92, 90, 92, 1.4)]
    return layer(-4, *diag) + layer(0, *beam, *legs, *feet) + layer(4, *plumbs, *marks, *water)


def dioptra():
    base = [line(50, 68, 34, 94, 1.8), line(50, 68, 66, 94, 1.8), line(50, 68, 50, 94, 1.4, .7), line(28, 94, 72, 94, 1.4)]
    post = [rect(46, 52, 8, 16, 1.6), circle(50, 52, 3, 1.4)]
    disc = [circle(50, 36, 18, 1.6), ticks(50, 36, 14, 18, 0, 360, 36, .8, .7), circle(50, 36, 2, 1.2)]
    tube = [rect(14, 33, 72, 6, 1.6), line(14, 36, 86, 36, .8, .45)]
    sights = [line(14, 28, 14, 44, 1.6), line(86, 28, 86, 44, 1.6), circle(14, 36, 1.2, 1.0, fill=True), circle(86, 36, 1.2, 1.0, fill=True)]
    screw = [line(50, 54, 50, 62, 1.0, .6), circle(50, 63, 2, 1.0, .6)]
    pole = [line(98, 28, 98, 92, 1.2, .5)]
    return layer(-4, *pole) + layer(0, *base, *post, *disc) + layer(4, *tube, *sights, *screw)


def portolan():
    sheet = [path("M6 16 Q10 8 24 8 L90 10 Q96 14 94 28 L96 80 Q92 92 78 92 L20 90 Q6 88 8 70 Z", 1.8), path("M92 12 q4 -4 4 0", 1.0, .6), path("M6 84 q-4 4 -2 8", 1.0, .6)]
    rose = [circle(50, 50, 22, 1.2, .8), circle(50, 50, 4, 1.2), spokes(50, 50, 4, 22, 16, 0, 1.0, .8), spokes(50, 50, 22, 44, 16, 11.25, .8, .45)]
    star = [poly([pol(50, 50, 8, 90 + i * 45) if False else pol(50, 50, 10, i * 45) for i in range(8)], 1.0, .7, closed=True)]
    coast = [path("M12 62 q6 -4 8 -10 q-2 -8 6 -10 q10 2 14 -4", 1.2, .85), path("M64 74 q8 4 14 -2 q6 -6 4 -12 q4 -6 -2 -10", 1.2, .85), path("M70 20 q8 -4 12 2", 1.0, .7)]
    towns = [line(20, 52, 20, 46, .9, .8), line(26, 42, 26, 36, .9, .8), line(80, 62, 84, 58, .9, .8), circle(20, 44, .8, .9, fill=True)]
    scale = [line(14, 82, 40, 82, 1.0, .6)] + [line(14 + i * 6.5, 80, 14 + i * 6.5, 84, .8, .6) for i in range(5)]
    return layer(-4, *rose[3:]) + layer(0, *sheet, *rose[:3], *scale) + layer(4, *star, *coast, *towns)


def chip_log():
    ship = [path("M6 24 L50 24 L56 36 L10 36 Z", 1.6), line(20, 24, 20, 6, 1.2), poly([(20, 6), (38, 12), (20, 20)], 1.0, .7, closed=True), line(6, 24, 2, 20, 1.4)]
    sea = [path("M2 38 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0", 1.2, .6), path("M2 44 q6 -3 12 0 t12 0 t12 0 t12 0", 1.0, .35)]
    line_ = [path("M54 32 Q74 54 90 60", 1.2)] + [circle(54 + i * 7.5, 32 + (i * 7.5) * .62 - 2 + i * 0.1, 1.1, .9, fill=True) for i in range(5)]
    board = [path("M84 56 L96 56 L94 68 L82 68 Z", 1.6), line(86, 60, 92, 60, .8, .5)]
    reel = [circle(22, 66, 10, 1.6), circle(22, 66, 3, 1.2), spokes(22, 66, 3, 9, 6, 0, 1.0, .75), line(32, 66, 52, 34, 1.0, .5)]
    glass = [path("M46 74 L58 74 L52 84 Z M46 94 L58 94 L52 84 Z", 1.2), line(44, 74, 60, 74, 1.4), line(44, 94, 60, 94, 1.4), line(52, 84, 52, 90, .8, .5)]
    return layer(-4, *sea) + layer(0, *ship, *reel, *glass) + layer(4, *line_, *board)


def plane_table():
    legs = [line(50, 58, 24, 94, 2.0), line(50, 58, 76, 94, 2.0), line(50, 58, 50, 94, 1.6, .7)]
    top = [poly([(14, 46), (86, 46), (96, 58), (4, 58)], 1.8, closed=True), poly([(10, 50), (82, 50), (90, 56), (8, 56)], 1.0, .5, closed=True)] if False else [poly([(12, 40), (84, 40), (94, 56), (2, 56)], 1.8, closed=True)]
    sheet = [poly([(20, 43), (76, 43), (84, 53), (12, 53)], 1.0, .65, closed=True)]
    alidade = [line(22, 48, 70, 48, 1.8), rect(66, 40, 4, 8, 1.2), line(68, 40, 68, 36, 1.0), rect(22, 44, 3, 8, 1.2)]
    lines = [line(46, 48, 30, 44, .8, .6), line(46, 48, 66, 44, .8, .6), line(46, 48, 78, 52, .8, .6)]
    level = [circle(86, 50, 2.2, 1.0, .6)]
    pts = [circle(30, 44, 1.2, .9, fill=True), circle(66, 44, 1.2, .9, fill=True)]
    return layer(-4, *legs) + layer(0, *top, *sheet) + layer(4, *alidade, *lines, *pts, *level)


def gas_mantle():
    burner = [rect(40, 78, 20, 8, 1.6), line(44, 86, 44, 96, 1.4), line(56, 86, 56, 96, 1.4), line(36, 78, 64, 78, 1.8)]
    tube = [line(46, 78, 46, 58, 1.2), line(54, 78, 54, 58, 1.2), rect(40, 54, 20, 6, 1.2)]
    mantle = [path("M36 54 Q36 18 50 14 Q64 18 64 54", 1.4)] + [path(f"M{37 + i * 3} {50 - abs(i - 4.5) * 2:.1f} L{50 + (i - 4.5) * 1.2} 16", .8, .6) for i in range(1, 9)] + [path(f"M{36 + i * 0} {24 + i * 7} q14 3 28 0", .8, .55) for i in range(4)]
    glow = [circle(50, 34, 20, .9, .3), circle(50, 34, 26, .8, .2)]
    ring = [path("M30 56 L70 56", 1.4), line(30, 56, 30, 72, 1.2), line(70, 56, 70, 72, 1.2), rect(26, 72, 8, 4, 1.2), rect(66, 72, 8, 4, 1.2)]
    hook = [line(50, 14, 50, 6, 1.0, .7), circle(50, 4, 1.6, 1.0)]
    return layer(-4, *glow) + layer(0, *burner, *tube, *ring) + layer(4, *mantle, *hook)


def diff_analyser():
    table = [rect(6, 10, 88, 82, 1.8)]
    shafts = [line(10, 22 + i * 18, 90, 22 + i * 18, 1.6) for i in range(4)]
    discs = []
    for i in range(3):
        cx, cy = 22 + i * 28, 36 + i * 0
        discs += [circle(cx, 30 + i * 0, 8, 1.4), ellipse(cx, 46, 8, 2.4, 1.2, .75), line(cx, 30, cx, 46, .8, .5)]
    wheels = [circle(22 + i * 28, 52, 4.4, 1.2) for i in range(3)]
    diffs = [gear(80, 74, 4, 7, 10, 1.0, .7), circle(80, 74, 2, 1.0)]
    cranks = [line(10, 22, 6, 18, 1.4), circle(5, 17, 1.6, 1.0), line(10, 76, 6, 80, 1.4), circle(5, 81, 1.6, 1.0)]
    stylus = [line(40, 84, 40, 94, 1.2, .8), circle(40, 95, 1.4, 1.0, fill=True), line(30, 84, 60, 84, 1.0, .6)]
    return layer(-4, *shafts) + layer(0, *table, *cranks) + layer(4, *discs, *wheels, *diffs, *stylus)


def analytical_engine():
    mill = [rect(8, 34, 36, 44, 1.8)] + [circle(18 + (i % 2) * 14, 44 + (i // 2) * 14, 5, 1.1) for i in range(4)]
    store = [rect(52, 20, 40, 70, 1.8)] + [circle(60 + (i % 3) * 12, 30 + (i // 3) * 12, 4.4, 1.0, .85) for i in range(6)] + [line(54, 78, 90, 78, .8, .5)]
    cards = [poly([(6 + i * 7, 12), (12 + i * 7, 8), (12 + i * 7, 26), (6 + i * 7, 30)], 1.2, closed=True) for i in range(4)] + [circle(9 + i * 7, 18 + i, .9, .9, fill=True) for i in range(4)]
    link = [line(44, 46, 52, 46, 1.4), line(44, 64, 52, 64, 1.4), line(30, 78, 30, 94, 1.2, .6), line(30, 94, 70, 94, 1.2, .6), line(70, 94, 70, 90, 1.2, .6)]
    gears = [gear(30, 24, 3, 5, 10, 1.0, .7)] if False else []
    barrel = [circle(30, 88, 5, 1.0, .5), circle(70, 88, 1.6, 1.0, .5)]
    return layer(-4, *barrel) + layer(0, *mill, *store, *link) + layer(4, *cards)


def trebuchet():
    frame = [line(30, 92, 46, 34, 2.0), line(70, 92, 54, 34, 2.0), line(34, 76, 66, 76, 1.2, .6), line(20, 92, 80, 92, 1.8)]
    beam = [line(20, 72, 76, 14, 2.0), line(20, 72, 14, 78, 1.8)]
    axle = [circle(46, 40, 3, 1.4)]
    cw = [rect(6, 78, 18, 14, 1.8), line(6, 85, 24, 85, 1.0, .5), line(15, 78, 15, 70, 1.0, .6)]
    sling = [path("M76 14 Q90 20 90 34", 1.2), circle(92, 38, 3.6, 1.4)]
    arc_ = [path("M92 38 Q96 60 86 90", 1.0, .35)]
    prop = [line(46, 40, 40, 60, 1.0, .5)]
    return layer(-4, *arc_, *prop) + layer(0, *frame, *beam, *axle) + layer(4, *cw, *sling)


def ballista():
    frame = [rect(14, 44, 72, 8, 1.8), line(14, 48, 86, 48, 1.0, .5), rect(10, 38, 8, 20, 1.6), rect(82, 38, 8, 20, 1.6)]
    skeins = [circle(24, 30, 8, 1.4), circle(76, 30, 8, 1.4), circle(24, 30, 4, 1.0, .6), circle(76, 30, 4, 1.0, .6)] + [line(16 + i * 4, 22, 20 + i * 4, 38, .8, .5) for i in range(2)]
    arms = [path("M24 30 L10 14", 1.8), path("M76 30 L90 14", 1.8)]
    string = [path("M10 14 L50 52 L90 14", 1.4)]
    slider = [rect(46, 46, 8, 36, 1.6), line(50, 50, 50, 78, .9, .6), poly([(48, 46), (52, 46), (50, 36)], 1.2, closed=True)]
    winch = [circle(50, 88, 5, 1.6), line(50, 88, 62, 88, 1.4), circle(63, 88, 1.6, 1.0)]
    stand = [line(30, 52, 24, 94, 1.8), line(70, 52, 76, 94, 1.8)]
    return layer(-4, *stand) + layer(0, *frame, *slider, *winch) + layer(4, *skeins, *arms, *string)


def crossbow():
    stock = [rect(46, 20, 8, 70, 1.8), line(50, 22, 50, 88, 1.0, .5), poly([(46, 90), (54, 90), (58, 98), (42, 98)], 1.4, closed=True)]
    prod = [path("M10 30 Q50 18 90 30", 2.0), path("M10 34 Q50 22 90 34", 1.0, .5)]
    string = [path("M10 30 L50 62 L90 30", 1.4)]
    bolt = [line(50, 12, 50, 62, 1.4), poly([(47, 12), (53, 12), (50, 4)], 1.2, closed=True), line(48, 60, 52, 60, 1.0, .7)]
    nut = [circle(50, 58, 3.4, 1.4), line(50, 58, 50, 58, 1.0), path("M47 58 q3 4 6 0", 1.0, .7)]
    trigger = [line(50, 66, 50, 78, 1.4), path("M44 74 q6 6 12 0", 1.2)]
    stirrup = [path("M42 14 q-6 -2 -6 4 t6 4", 1.4), path("M58 14 q6 -2 6 4 t-6 4", 1.4)]
    return layer(-4, *string) + layer(0, *stock, *prod, *stirrup) + layer(4, *bolt, *nut, *trigger)


def hydraulis():
    tank = [ellipse(50, 80, 26, 8, 1.6), line(24, 80, 24, 94, 1.6), line(76, 80, 76, 94, 1.6), path("M24 94 Q50 102 76 94", 1.6), path("M28 82 q4 -3 8 0 t8 0 t8 0 t8 0", 1.0, .5)]
    bell = [path("M36 74 Q36 62 50 62 Q64 62 64 74", 1.4), line(50, 62, 50, 56, 1.4)]
    pump = [rect(80, 50, 8, 30, 1.4), line(84, 50, 84, 40, 1.6), line(76, 40, 92, 40, 1.8), line(84, 80, 70, 84, 1.0, .6)]
    pipes = [rect(18 + i * 8.5, 14 + abs(i - 4) * 4, 5, 40 - abs(i - 4) * 4, 1.2) for i in range(8)]
    chest = [rect(14, 54, 72, 8, 1.8), line(14, 58, 86, 58, 1.0, .5)]
    keys = [rect(18 + i * 8.5, 64, 4, 8, 1.0, .85) for i in range(8)]
    wind = [line(50, 62, 50, 74, 1.0, .5)]
    return layer(-4, *tank, *wind) + layer(0, *chest, *bell, *pump) + layer(4, *pipes, *keys)


ITEMS = [
    dict(id="exp28_campbell_stokes_recorder", n="Campbell–Stokes Sunshine Recorder", era="industry", cat="science", ds=1853, rar="uncommon",
         date="J. F. Campbell, 1853; modified by G. G. Stokes, 1879", vis="burning-sphere", topic="meteorology_exp28",
         region="United Kingdom (John Francis Campbell, George Gabriel Stokes)", artifactType="meteorological instrument", material="glass sphere and card", physical=True, durable=True,
         l1="A glass ball that burns a trace on a card wherever bright sunshine falls.",
         l2="A crystal ball about 10 cm across focuses sunlight onto a card behind it, scorching a trace that shows how much bright sunshine fell that day. The card holder has three overlapping sets of grooves for the sun's altitude in different seasons.",
         l3="Campbell invented it in 1853 and Stokes modified it in 1879. Each day's card is marked by hour with local noon in the centre, read in tenths; in the Northern Hemisphere it faces south and needs a clear view of the sun.",
         ev="Campbell (1853), Stokes (1879)", first_known="1853",
         confidence=dict(level="established", note="Page gives 1853 for Campbell and 1879 for Stokes's modification."),
         srcs=[wp("campbell_wp", "Campbell%E2%80%93Stokes_recorder", "Campbell 1853; Stokes 1879; glass sphere about 10 cm focuses sunlight to burn a card; daily cards read in tenths.")],
         pool=['glass', 'optics', 'observation', 'measurement', 'lens', 'paper', 'physics', 'wood'], must=['optics'], nrec=2,
         tags=["meteorology", "optics"], regions=["europe"], art=sunshine()),
    dict(id="exp28_six_thermometer", n="Six's Maximum–Minimum Thermometer", era="science", cat="science", ds=1780, rar="uncommon",
         date="James Six, 1780 (page gives 1780)", vis="u-tube-indices", topic="meteorology_exp28",
         region="Britain (James Six)", artifactType="meteorological instrument", material="glass, mercury and steel", physical=True, durable=True,
         l1="A U-shaped thermometer that leaves little steel markers at the day's highest and lowest temperatures.",
         l2="Alcohol in one bulb expands and contracts with temperature and pushes or pulls mercury in the bend; the other bulb is a vacuum that lets the liquids move. Two small steel markers move only when the mercury pushes them, so they stay at the furthest points reached. A magnet resets them.",
         l3="The page credits the British scientist James Six and gives 1780, not 1782. The mercury top shows the current temperature and the markers show the highest and lowest since the last reset, usually every 24 hours.",
         ev="Six's thermometer (1780)", first_known="1780",
         confidence=dict(level="established", note="Page gives 1780; the commonly quoted 1782 is not on the page."),
         srcs=[wp("six_wp", "Six%27s_thermometer", "James Six 1780; U-shaped tube with mercury, alcohol bulb, vacuum bulb and two steel markers; records highest and lowest temperature; magnetic reset.")],
         pool=['measurement', 'glass', 'exp26_graduated_glass_tube', 'exp26_drawn_glass_tube', 'physics', 'iron', 'experiment', 'observation', 'copper', 'chemistry'], must=[], nrec=2,
         tags=["meteorology", "measurement"], regions=["europe"], art=six_thermo()),
    dict(id="exp28_mirror_nephoscope", n="Mirror Nephoscope", era="industry", cat="science", ds=1894, rar="uncommon",
         date="Pomortsev's nephoscope, Russia, 1894; Besson's comb nephoscope, 1912", vis="black-mirror-compass", topic="meteorology_exp28",
         region="Russia (Mikhail Pomortsev); Sweden (Carl Fineman, undated); France (Louis Besson)", artifactType="meteorological instrument", material="metal and black glass", physical=True, durable=True,
         l1="A black mirror over a compass that lets you follow a cloud's reflection to find its direction and speed.",
         l2="Level the mirror, turn it until the compass needle lies along the north–south line, then keep the cloud's image and a vertical pointer's tip aligned at the centre as the image moves outward. The radius it travels gives direction; the time between engraved circles gives relative speed.",
         l3="A nephoscope measures cloud altitude, direction and velocity, unlike a nephometer, which measures cloud cover. The page dates Mikhail Pomortsev's Russian nephoscope to 1894 and Louis Besson's comb nephoscope to 1912; it gives no date for Fineman's mirror nephoscope. It calls the mirror type moderately accurate and not easy to use.",
         ev="Pomortsev (1894); Besson (1912)", first_known="1894",
         confidence=dict(level="uncertain", note="Date is Pomortsev's 1894 nephoscope; the page gives no date for Fineman's mirror type or the page's 1877 Finley claim."),
         srcs=[wp("nepho_wp", "Nephoscope", "Pomortsev 1894; Besson comb nephoscope 1912; Fineman mirror nephoscope undated; mirror over compass; direction from radius, speed from time between circles.")],
         pool=['measurement', 'compass', 'glass', 'observation', 'physics', 'optics', 'iron', 'astronomy'], must=['compass'], nrec=2,
         tags=["meteorology", "observation"], regions=["europe"], art=nephoscope()),
    dict(id="exp28_gregorian_telescope", n="Gregorian Reflecting Telescope", era="science", cat="technology", ds=1663, rar="rare",
         date="Designed by James Gregory in Optica Promota, 1663; first built by Robert Hooke, 1673", vis="paraboloid-and-ellipsoid", topic="optics_exp28",
         region="Scotland (James Gregory); England (Robert Hooke)", artifactType="telescope", material="metal mirrors and brass", physical=True, durable=True,
         l1="A reflecting telescope with a holed parabolic mirror and an elliptical secondary that gives an upright image.",
         l2="The primary is a concave paraboloid with a central hole; the secondary is a concave ellipsoid. Light focuses in front of the secondary, reflects back through the hole in the primary and out to the eyepiece. The image is erect and the tube much shorter than the focal length.",
         l3="Gregory described the design in Optica Promota in 1663, and Hooke built the first working instrument in 1673. It suits spotting scopes and solar telescopes, and amateurs can test the concave secondary with the Foucault test.",
         ev="Gregory, Optica Promota (1663); Hooke's instrument (1673)", first_known="1663",
         confidence=dict(level="established", note="Design date 1663; first working instrument 1673."),
         srcs=[wp("greg_wp", "Gregorian_telescope", "Gregory described the design in Optica Promota 1663; Hooke built the first working instrument 1673; paraboloid primary with hole, ellipsoid secondary; erect image.")],
         pool=['lens', 'optics', 'astronomy', 'glass', 'metallurgy', 'mathematics', 'copper', 'geometry', 'polishing'], must=['optics'], nrec=2,
         tags=["optics", "astronomy"], regions=["europe"], art=gregorian()),
    dict(id="exp28_groma", n="Roman Groma", era="civilization", cat="technology", ds=-150, rar="uncommon",
         date="Large-scale Roman centuriation from the 2nd century BC; origin possibly before the 4th century BC", vis="plumb-cross", topic="surveying_exp28",
         region="Roman world; possible origin Mesopotamia or Greece", artifactType="surveying instrument", material="wood and iron", physical=True, durable=True,
         l1="A cross on a staff with plumb lines that lays out right angles and straight lines.",
         l2="A horizontal cross turns on a vertical staff; a plumb bob hangs from each end and the centre marks the reference point. An assistant places a pole where the surveyor directs and the surveyor sights it along strings on opposite arms.",
         l3="It made centuriation, a rectangular land grid, possible; large-scale Roman centuriation began in the 2nd century BC. It is the only Roman surveying tool with surviving examples: a 5 kg cross was found at Pompeii. Wind disturbs the plumb lines, and archaeologists estimate an error of about 1.5 per mille.",
         ev="Pompeii groma cross; Schulten (1912) reconstruction; Schiöler (1994)", first_known="before the 4th century BC (possible origin)",
         confidence=dict(level="uncertain", note="Date is the Roman centuriation period; the page gives only a possible earlier origin."),
         srcs=[wp("groma_wp", "Groma_(surveying)", "Horizontal cross on a staff with four plumb bobs; centuriation; 2nd century BC large-scale Roman use; Pompeii cross of 5 kg; error about 1.5 per mille.")],
         pool=['geometry', 'measurement', 'cordage', 'wood', 'mathematics', 'bronze', 'iron', 'maps', 'rope'], must=['geometry'], nrec=2,
         tags=["surveying", "roman"], regions=["europe"], art=groma()),
    dict(id="exp28_chorobates", n="Chorobates", era="civilization", cat="technology", ds=-25, rar="uncommon",
         date="Described by Vitruvius, De architectura, Book VIII (the page gives no date)", vis="levelling-bench", topic="surveying_exp28",
         region="Roman world (aqueduct builders)", artifactType="levelling instrument", material="wood", physical=True, durable=False,
         l1="A 6-metre wooden bench with plumb lines and a water groove for levelling aqueducts.",
         l2="A wooden beam about 6 m long on two legs has a plumb line at each end and two diagonal rods with notches. Matching notches on both sides show the beam is level. In wind, water poured into a groove along the top is used instead.",
         l3="Vitruvius describes it in Book VIII of De architectura, with a length of 20 feet (5.92 m) according to Moreno Gallo. The page does not date Vitruvius, so the date here follows the late 1st century BC context, not the page; later engravings of 1547, 1582, 1673 and 1728 reinterpreted it.",
         ev="Vitruvius, De architectura VIII", first_known="Vitruvian description (late 1st century BC)",
         confidence=dict(level="uncertain", note="Page does not date Vitruvius; ds is an approximation to the Augustan period, not stated on the page."),
         srcs=[wp("chorob_wp", "Chorobates", "Described by Vitruvius in Book VIII of De architectura; wooden beam about 6 m with plumb lines and a water groove; 20 feet per Moreno Gallo; Perrault 1673 reinterpretation.")],
         pool=['wood', 'measurement', 'geometry', 'cordage', 'engineering', 'stone', 'rope', 'mathematics'], must=['measurement'], nrec=2,
         tags=["surveying", "roman"], regions=["europe"], art=chorobates()),
    dict(id="exp28_dioptra", n="Dioptra", era="civilization", cat="technology", ds=-250, rar="uncommon",
         date="3rd century BC (page gives the century only)", vis="sighting-tube-disc", topic="surveying_exp28",
         region="Hellenistic world; Hero of Alexandria wrote on its construction", artifactType="surveying instrument", material="bronze and wood", physical=True, durable=True,
         l1="A sighting rod on a stand with a protractor disc for measuring angles on land or sky.",
         l2="A sighting tube or rod with a sight at each end is mounted on a stable stand with adjustable screws for fine calibration. Fitted with protractors it measures angles, in astronomy to aim at a star or in surveying to read graduated scales.",
         l3="The page dates the dioptra to the 3rd century BC and credits Hero of Alexandria with a book on its construction and use. It was used extensively for aqueducts; whether it was used for the Eupalinian tunnel on Samos (6th century BC, 1,036 m) is disputed. The theodolite replaced it in the 16th century.",
         ev="Hero of Alexandria, On the Dioptra", first_known="3rd century BC",
         confidence=dict(level="established", note="Century only; Eupalinos tunnel use is speculative."),
         srcs=[wp("dioptra_wp", "Dioptra", "3rd century BC; sighting tube with a sight at each end on a stand; protractors; Hero of Alexandria's book; aqueducts; Eupalinian tunnel use debated; replaced by the theodolite.")],
         pool=['geometry', 'measurement', 'astronomy', 'bronze', 'mathematics', 'observation', 'wood', 'casting'], must=['geometry', 'measurement'], nrec=2,
         tags=["surveying", "astronomy"], regions=["europe"], art=dioptra()),
    dict(id="exp28_portolan_chart", n="Portolan Chart", era="science", cat="knowledge", ds=1280, rar="rare",
         date="Carta Pisana, dated 1280; Catalan Atlas, 1375", vis="rhumb-line-vellum", topic="navigation_exp28",
         region="Mediterranean and Black Sea", artifactType="sea chart", material="vellum and ink", physical=True, durable=True,
         l1="An ink-on-vellum sea chart criss-crossed by compass lines that radiate from wind roses.",
         l2="Networks of rhumb lines radiating from wind roses represent 16 compass directions, which became 32 from around 1450. The charts are manuscripts drawn in ink on vellum calf skin, mainly covering the Mediterranean and Black Sea coasts.",
         l3="The earliest surviving chart on the page is the Carta Pisana, dated 1280. Abraham Cresques's Catalan Atlas of 1375 was the first to add compass roses at the centres of rhumb-line networks.",
         ev="Carta Pisana (1280); Catalan Atlas (1375)", first_known="1280 (earliest surviving)",
         confidence=dict(level="established", note="Page dates the Carta Pisana 1280; earlier lost charts are not excluded."),
         srcs=[wp("portolan_wp", "Portolan_chart", "Carta Pisana 1280; rhumb lines 16 directions then 32 from about 1450; ink on vellum; Mediterranean and Black Sea; Catalan Atlas 1375 by Cresques.")],
         pool=['maps', 'compass', 'navigation', 'exp26_parchment_sheet', 'exp26_writing_quill', 'exp26_iron_tannin_ink', 'writing', 'observation', 'geometry'], must=[], nrec=2,
         tags=["navigation", "cartography"], regions=["europe"], tradeImportance="medium", art=portolan()),
    dict(id="exp28_chip_log", n="Chip Log", era="science", cat="technology", ds=1574, rar="uncommon",
         date="First printed description: William Bourne, A Regiment for the Sea, 1574", vis="knotted-log-line", topic="navigation_exp28",
         region="England (William Bourne)", artifactType="speed-measuring device", material="wood board, rope and sandglass", physical=True, durable=False,
         l1="A wooden board on a knotted line thrown from the stern, with a sandglass to time the knots, gives a ship's speed.",
         l2="The board acts as a drogue and stays roughly in place as the ship moves away; knots are tied at uniform intervals along the line, and the sailor counts those that run out in the time of a sandglass. Many ships spaced knots 8 fathoms (48 feet) apart and 28-second glasses were common.",
         l3="Bourne's 1574 Regiment for the Sea is the first known printed description, and he also devised a half-minute sandglass. The page states that the word 'knot', for a nautical mile per hour, derives from this method.",
         ev="Bourne, A Regiment for the Sea (1574)", first_known="1574 (first printed description)",
         confidence=dict(level="established", note="Earliest known printed description; earlier use is possible."),
         srcs=[wp("chiplog_wp", "Chip_log", "Bourne's Regiment for the Sea 1574; board as drogue, knotted line, sandglass; 8 fathoms knot spacing, 28-second glass; origin of the word knot.")],
         pool=['rope', 'cordage', 'wood', 'navigation', 'measurement', 'boat', 'glass', 'hourglass'], must=['navigation'], nrec=2,
         tags=["navigation", "maritime"], regions=["europe"], art=chip_log()),
    dict(id="exp28_plane_table", n="Plane Table", era="science", cat="technology", ds=1551, rar="uncommon",
         date="Earliest known mention: Abel Foullon, 1551; Zubler credits Eberhard in 1607", vis="drawing-board-alidade", topic="surveying_exp28",
         region="France (Abel Foullon, 1551); Switzerland (Leonhard Zubler, 1607)", artifactType="surveying instrument", material="wood and brass", physical=True, durable=True,
         l1="A levelled drawing board on a tripod where you sight and draw the map on the spot.",
         l2="The table is set over a point and levelled; a drawing sheet is attached and an alidade is sighted on objects, with a line drawn toward each. The alidade can also be a level, distances come from measurement or stadia marks, and graphical methods let less educated people use it.",
         l3="Abel Foullon's 1551 'holomètre' book is the earliest known mention and describes a developed instrument, so it is older. Cyprian Lucar gives the first English mention in 1590 and Zubler (1607) credits Philipp Eberhard. The page calls Praetorius's 1610 claim apparently incorrect; the name changed from 'plain table' to 'plane table' by 1830.",
         ev="Foullon (1551); Zubler (1607)", first_known="1551 (earliest mention)",
         confidence=dict(level="debated", note="Priority is unresolved: Foullon's 1551 mention, Eberhard's credit in 1607 and the doubtful Praetorius claim."),
         srcs=[wp("planetable_wp", "Plane_table", "Foullon 1551 earliest known mention; Lucar 1590; Zubler 1607 credits Eberhard; Praetorius 1610 doubtful; board, alidade, graphical sighting.")],
         pool=['maps', 'geometry', 'measurement', 'wood', 'exp26_sighted_measuring_staff', 'exp26_parallel_ruler_set', 'exp26_course_plotting_board', 'paper', 'observation', 'mathematics', 'lens'], must=[], nrec=2,
         tags=["surveying", "cartography"], regions=["europe"], art=plane_table()),
    dict(id="exp28_welsbach_gas_mantle", n="Welsbach Gas Mantle", era="industry", cat="technology", ds=1892, rar="uncommon",
         date="Patents 15 March 1887 and 5 March 1889; thoria–ceria mantle perfected 1891, commercial 1892", vis="oxide-mesh", topic="lighting_exp28",
         region="Austria (Carl Auer von Welsbach)", artifactType="lighting component", material="thorium and cerium oxides", physical=True, durable=False,
         l1="A fabric bag that burns away to leave a brittle oxide mesh glowing white in a gas flame.",
         l2="The mantle is a fabric bag impregnated with metal salts; the first heating burns the fabric away, leaving a brittle oxide mesh. The oxides emit strongly in visible light but weakly in infrared, so most energy becomes visible light, and the mantle keeps the flame small and contained.",
         l3="Welsbach's US patent of 15 March 1887 covered 'Actinophor', a magnesium–lanthanum–yttrium oxide mix that gave a greenish, unsuccessful light; his patent of 5 March 1889 first mentioned thorium. In 1891 he perfected 99% thoria and 1% ceria, introduced commercially in 1892. The page lists no patent from 1885.",
         ev="US patents 359,524 (1887) and 399,174 (1889)", first_known="1887–1892",
         confidence=dict(level="established", note="Commercial thoria–ceria mantle is 1892; earlier mixes failed commercially."),
         srcs=[wp("mantle_wp", "Incandescent_gas_mantle", "US patent 15 Mar 1887 (Actinophor); patent 5 Mar 1889 mentions thorium; 1891 99% thoria 1% ceria; commercial 1892; fabric burns off leaving an oxide mesh.")],
         pool=['chemistry', 'cloth', 'fire', 'experiment', 'glass', 'metallurgy', 'plant_thread', 'iron'], must=['chemistry'], nrec=2,
         tags=["lighting", "chemistry"], regions=["europe"], art=gas_mantle()),
    dict(id="exp28_differential_analyser", n="Bush Differential Analyser", era="computing", cat="computing", ds=1931, rar="rare",
         date="MIT machine built 1928–1931; named in Bush's October 1931 paper; theory from J. Thomson, 1876", vis="integrator-shafts", topic="calculating_exp28",
         region="Massachusetts, United States (Vannevar Bush, Harold Hazen)", artifactType="analogue computer", material="metal shafts and wheels", physical=True, durable=True,
         l1="A hall-sized machine of shafts and wheel-and-disc integrators that solves differential equations.",
         l2="Mechanical integrators, wheel-and-disc mechanisms, perform integration; connecting them solves differential equations. An epicyclic differential adds or subtracts, gear ratios multiply and divide by whole numbers, and a multiplier table handles fractions.",
         l3="James Thomson published the first description of a device that could integrate differential equations of any order in 1876, with two companion papers by Kelvin. Hazen and Bush built the MIT differential analyser with six integrators in 1928–1931; Bush's October 1931 paper in the Journal of the Franklin Institute named it.",
         ev="Bush (1931), J. Franklin Institute", first_known="1928–1931",
         confidence=dict(level="established", note="Page gives the build as a range; it does not mention a harmonic analyser or a ball-and-disc design."),
         srcs=[wp("diffan_wp", "Differential_analyser", "Thomson 1876; Hazen and Bush built the MIT machine 1928–1931 with six integrators; named in October 1931; wheel-and-disc integrators, epicyclic differential, multiplier table.")],
         pool=['mathematics', 'gear', 'mechanism', 'electric_motor', 'electricity', 'engineering', 'measurement', 'steel'], must=['mathematics', 'gear'], nrec=2,
         tags=["calculating", "computing_ancestor"], regions=["americas"], art=diff_analyser()),
    dict(id="exp28_analytical_engine", n="Babbage Analytical Engine", era="computing", cat="computing", ds=1837, rar="rare",
         date="Design begun 1833; first described 1837; Lovelace's notes 1843", vis="mill-and-store", topic="calculating_exp28",
         region="England (Charles Babbage, Ada Lovelace)", artifactType="unbuilt computing design", material="design drawings (never completed)", physical=False, durable=False,
         l1="A design for a mechanical computer with a 'mill' and a 'store' read from punched cards.",
         l2="The design has a mill, the arithmetic unit, and a store holding 1,000 numbers of 40 digits each, with input on punched cards. The full engine was never built.",
         l3="Babbage began work in 1833 and first described it in 1837; he lectured in Turin in 1840 and Menabrea published a French description in 1842. Ada Lovelace translated it in 1843 with notes including a program for Bernoulli numbers. Babbage died in 1871 with a small part assembled; his son Henry built part of the mill, which in 1910 computed a faulty list of multiples of pi.",
         ev="Menabrea (1842), Lovelace's notes (1843); Henry Babbage's mill (1880–1910)", first_known="1837",
         confidence=dict(level="established", note="A design only; the page says the full engine was never built."),
         srcs=[wp("analytical_wp", "Analytical_Engine", "Design begun 1833, first described 1837; mill and store of 1,000 numbers of 40 digits; punched cards; Menabrea 1842; Lovelace 1843; Babbage died 1871; never built.")],
         pool=['exp28_difference_engine', 'exp28_jacquard_card_chain', 'mathematics', 'gear', 'mechanism', 'paper', 'engineering', 'number_system', 'record_keeping', 'machine_tools'], must=[], nrec=2,
         tags=["calculating", "computing_ancestor"], regions=["europe"], art=analytical_engine()),
    dict(id="exp28_counterweight_trebuchet", n="Counterweight Trebuchet", era="science", cat="technology", ds=1187, rar="rare",
         date="Earliest description: al-Tarsusi's commentary, 1187; in use around the Mediterranean in the 12th century", vis="swing-beam-box", topic="siege_engines_exp28",
         region="Mediterranean (Christian and Muslim lands)", artifactType="siege engine", material="timber, rope and stone ballast", physical=True, durable=False,
         l1="A swinging beam with a heavy box on the short arm that whips a sling on the long arm.",
         l2="A heavy box filled with stones, sand or lead on the short end of the beam is raised, storing potential energy. On release gravity drops it and rotates the beam; the long projectile end, four to six times longer, whips the sling around until the projectile is released.",
         l3="The earliest known description and illustration is a commentary on Saladin's conquests by Mardi ibn Ali al-Tarsusi, dated 1187, and the engine was probably not new. The page says Mohists probably used a traction trebuchet as early as the 4th century BC, but gives no exact date for the counterweight type.",
         ev="al-Tarsusi's commentary (1187)", first_known="12th century",
         confidence=dict(level="established", note="Page says the counterweight type appeared in the 12th century; the 1187 text is the earliest description, not the first use."),
         srcs=[wp("trebuchet_wp", "Trebuchet", "Earliest description al-Tarsusi 1187; counterweight type appeared in the 12th century around the Mediterranean; Mohist traction trebuchet probably 4th century BC; box of stones raises and drops.")],
         pool=['lever', 'rope', 'wood', 'cordage', 'mechanical_advantage', 'stone', 'pulley', 'engineering'], must=['lever', 'mechanical_advantage'], nrec=2,
         tags=["siege", "mechanism"], regions=["europe", "africa_asia"], art=trebuchet()),
    dict(id="exp28_torsion_ballista", n="Torsion Ballista", era="civilization", cat="technology", ds=-400, rar="uncommon",
         date="Thought developed for Dionysius of Syracuse, c. 400 BC; Alexander's engineers introduced rope-coil springs", vis="twisted-skeins", topic="siege_engines_exp28",
         region="Syracuse and Macedon (Greek); Rome from 146 BC", artifactType="projectile engine", material="timber, sinew rope and bronze", physical=True, durable=False,
         l1="A bolt-thrower whose two arms are driven by tightly twisted skeins of rope.",
         l2="Two levers sit in torsion springs made of several loops of twisted skeins; in the Roman version the springs are sinew rope twisted around the arms attached to the bowstring. Drawing the string back with winches twists the springs and stores energy.",
         l3="The page says the earliest ballista is thought to have been developed for Dionysius of Syracuse about 400 BC and descended from the oxybeles and gastraphetes, with Philip II and Alexander developing it further. Rome adopted it after absorbing the Greek states in 146 BC; at Alesia in 52 BC small ballistae were placed in towers. The largest 4th-century ballistae threw a dart over 1,200 yards.",
         ev="Alesia, 52 BC; later carroballista and manuballista", first_known="c. 400 BC",
         confidence=dict(level="debated", note="Page gives 'c. 400 BC', thought developed for Dionysius; no exact year."),
         srcs=[wp("ballista_wp", "Ballista", "Thought developed for Dionysius of Syracuse c. 400 BC; descended from oxybeles and gastraphetes; torsion springs of twisted skeins; Rome adopted after 146 BC; Alesia 52 BC.")],
         pool=['fiber', 'rope', 'wood', 'lever', 'bronze', 'cordage', 'mechanical_advantage', 'casting', 'sinew'], must=['rope'], nrec=2,
         tags=["siege", "torsion"], regions=["europe"], art=ballista()),
    dict(id="exp28_crossbow", n="Bronze-Lock Crossbow", era="civilization", cat="technology", ds=-650, rar="rare",
         date="Cast-bronze crossbow locks from China, c. 650 BC; bronze bolts mid-5th century BC at Yutaishan; Greek gastraphetes late 5th century BC", vis="trigger-lock-stock", topic="siege_engines_exp28",
         region="Zhou China (Hubei); Greece (Siege of Motya, 397 BC)", artifactType="projectile weapon", material="wood and cast bronze", physical=True, durable=True,
         l1="A bow on a stock with a bronze trigger lock that holds the string cocked until released.",
         l2="A stock carries a prod and a catch that holds the drawn string; pulling the trigger releases the bolt. Qin and Han bronze trigger mechanisms are the earliest found; European crossbows began using winches in the 13th century and Song crossbows added stirrups.",
         l3="The page gives c. 650 BC for cast-bronze crossbow locks found in China and bronze bolts from the mid-5th century BC at a Chu burial site at Yutaishan, Hubei. The Greek gastraphetes probably appeared in the late 5th century BC and was used at the Siege of Motya in 397 BC; the 11th-century Wujing Zongyao mentions winch mechanisms.",
         ev="Chinese bronze locks (c. 650 BC); Yutaishan bolts; Siege of Motya (397 BC)", first_known="c. 650 BC",
         confidence=dict(level="established", note="Page gives no exact date for the trigger nut or the stirrup."),
         srcs=[wp("crossbow_wp", "Crossbow", "Cast-bronze crossbow locks in China c. 650 BC; bronze bolts mid-5th century BC at Yutaishan; gastraphetes late 5th century BC, Motya 397 BC; winches 13th century Europe; stirrups Song.")],
         pool=['bronze', 'casting', 'wood', 'lever', 'cordage', 'mechanism', 'metallurgy', 'fiber', 'rope'], must=['bronze', 'lever'], nrec=2,
         tags=["weapon", "mechanism"], regions=["africa_asia", "europe"], art=crossbow()),
    dict(id="exp28_hydraulis", n="Hydraulis Water Organ", era="civilization", cat="culture", ds=-250, rar="rare",
         date="Ctesibius of Alexandria, 3rd century BC (page gives the century); Aquincum hydraulis dated AD 228", vis="water-pressure-pipes", topic="music_exp28",
         region="Alexandria (Ctesibius); Aquincum (Roman Pannonia)", artifactType="musical instrument", material="bronze pipes and wood", physical=True, durable=False,
         l1="An organ whose wind supply is steadied by water pressure under a bell.",
         l2="Water pressure maintains the wind supply to the pipes, which stand in ranks on a windchest; a pipe sounds only when its rank is admitted and its key pressed. Hand pumps feed air into the bell under the water.",
         l3="The page credits Ctesibius of Alexandria with inventing the organ in the 3rd century BC. A hydraulis dated AD 228 was found in pieces at Aquincum and excavated in 1931. It also dates Constantine V's 757 gift of a pipe organ to Pepin the Short and the first documented permanent organ installation, Halberstadt, in 1361.",
         ev="Aquincum hydraulis (AD 228; excavated 1931)", first_known="3rd century BC",
         confidence=dict(level="established", note="Century only; the page does not call the hydraulis pneumatic."),
         srcs=[wp("organ_wp", "Pipe_organ", "Ctesibius invented the organ in the 3rd century BC; hydraulis uses water pressure for wind supply; Aquincum hydraulis AD 228; windchest and ranks; 757 gift to Pepin.")],
         pool=['music', 'flute', 'bronze', 'wood', 'casting', 'engineering', 'mechanism', 'physics', 'lever'], must=['music'], nrec=2,
         tags=["music", "organ"], regions=["africa_asia", "europe"], art=hydraulis()),
]
