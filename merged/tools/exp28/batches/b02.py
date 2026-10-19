"""EXP28 batch 02 — calculating aids, meteorology, timekeeping, punched-card machines, photography and projection.
Facts only from pages fetched 2026-10-16 (each `claim` says what the page supports)."""
import math

from common import src, wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def slide_rule():
    body = [rect(6, 30, 88, 12, 1.6), rect(6, 58, 88, 12, 1.6), rect(10, 42, 80, 16, 1.6)]
    t = []
    for i in range(0, 21):
        x = 12 + 76 * math.log10(1 + 9 * i / 20)
        t.append(line(x, 42, x, 42 + (6 if i % 5 == 0 else 3.5), .8, .75))
        x2 = 12 + 76 * math.log10(1 + 9 * i / 20)
        t.append(line(x2, 58, x2, 58 - (6 if i % 5 == 0 else 3.5), .8, .75))
    outer = [line(12 + 76 * math.log10(1 + 9 * i / 10), 30, 12 + 76 * math.log10(1 + 9 * i / 10), 34, .8, .6) for i in range(11)]
    cursor = [rect(52, 24, 14, 52, 1.5), line(59, 24, 59, 76, .9, .6), rect(53.5, 27, 11, 46, .9, .4)]
    return layer(-3, line(6, 76, 94, 76, 1.0, .3)) + layer(0, *body, *cursor) + layer(4, *t, *outer)


def planimeter():
    pole = [circle(14, 72, 5, 1.6), circle(14, 72, 1.6, 1.2, fill=True), rect(6, 78, 16, 5, 1.4)]
    arm1 = [line(14, 72, 44, 40, 2.0), line(16, 73.5, 46, 41.5, .9, .5)]
    joint = [circle(44, 40, 3.2, 1.6), circle(44, 40, 1, 1.0, fill=True)]
    arm2 = [line(44, 40, 82, 56, 2.0), line(44.5, 42, 82.5, 58, .9, .5)]
    tracer = [line(82, 56, 90, 70, 1.6), circle(91, 72, 2.2, 1.4), circle(91, 72, .6, 1.0, fill=True)]
    wheel = [ellipse(60, 48, 3.8, 6, 1.6), line(60, 42, 60, 54, .8, .6), rect(54, 38, 12, 4, 1.2), circle(60, 36, 2.4, 1.2)]
    counter = [rect(64, 24, 14, 10, 1.4), line(66, 29, 76, 29, .8, .6)] + [line(66 + i * 2, 24, 66 + i * 2, 34, .8, .4) for i in range(1, 6)]
    shape = [path("M72 80 Q84 74 92 80 Q96 88 86 92 Q74 94 72 86 Z", 1.2, .5)]
    return layer(-4, *shape) + layer(0, *pole, *arm1, *joint, *arm2, *tracer) + layer(4, *wheel, *counter)


def aneroid():
    case = [circle(50, 46, 34, 1.8), circle(50, 46, 30, 1.2, .6), circle(50, 46, 3, 1.5), circle(50, 46, 1, 1.0, fill=True)]
    sc = ticks(50, 46, 24, 29, 135, 405, 40, 1.0, .7) + ticks(50, 46, 22, 29, 135, 405, 8, 1.3, .8)
    needle = [line(50, 46, *pol(50, 46, 26, 300), 1.6), line(50, 46, *pol(50, 46, -7, 300), 1.6)]
    set_hand = [line(50, 46, *pol(50, 46, 21, 200), 1.0, .5)]
    ring = [circle(50, 8, 4, 1.4), line(50, 12, 50, 12, 1.0, .5)]
    cap = [ellipse(50, 90, 22, 4, 1.4), path("M28 90 L28 84 Q50 78 72 84 L72 90", 1.2, .6)]
    spring = [path("M36 84 q3 -4 6 0 t6 0 t6 0 t6 0", 1.0, .6)]
    lever = [line(50, 82, 66, 66, 1.2, .55), circle(66, 66, 1.4, 1.0, .6)]
    return layer(-4, *cap, *spring, *lever) + layer(0, *case, *ring) + layer(5, sc, *needle, *set_hand)


def stevenson():
    legs = [line(24, 56, 20, 92, 1.8), line(76, 56, 80, 92, 1.8), line(30, 56, 28, 86, 1.0, .5), line(70, 56, 72, 86, 1.0, .5), line(20, 74, 80, 74, 1.0, .5)]
    roof = [poly([(16, 28), (84, 28), (78, 16), (22, 16)], 1.8, closed=True), line(16, 28, 84, 28, 1.0)]
    box = [rect(22, 28, 56, 28, 1.8)]
    louvres = []
    for i in range(7):
        y = 31 + i * 3.6
        louvres.append(line(24, y + 2.4, 76, y + 2.4, 1.1, .85))
        louvres.append(line(24, y, 76, y + 2.4, .8, .35))
    door = [line(50, 28, 50, 56, 1.2, .7), circle(46, 42, 1, 1.0, fill=True)]
    inside = [rect(30, 60, 10, 4, 1.0, .5), line(35, 60, 35, 50, .8, .4)]
    ground = [line(10, 92, 90, 92, 1.0, .4)]
    return layer(-4, *ground, *inside) + layer(0, *legs, *box, *roof) + layer(4, *louvres, *door)


def jacquard():
    cards = []
    for i in range(6):
        x = 8 + i * 13
        cards += [poly([(x, 36), (x + 11, 32), (x + 11, 62), (x, 66)], 1.4, closed=True)]
        for k, yy in enumerate((40, 45, 50, 55, 60)):
            if (i * 3 + k * 2) % 3 != 0:
                cards.append(circle(x + 5.5, yy - (4 - k) * .2, 1.1, .9, .8))
    prism = [path("M4 66 Q4 74 16 74 L78 74 Q90 74 90 66", 1.2, .6)]
    rods = [line(14 + i * 6, 20, 14 + i * 6, 32, 1.0, .75) for i in range(10)]
    hooks = [path(f"M{14 + i * 6} 12 q2 0 2 4", 1.0, .8) for i in range(10)]
    knife = [rect(10, 8, 62, 3, 1.5), line(10, 14, 72, 14, 1.0, .5)]
    cords = [line(14 + i * 6, 6, 14 + i * 6, 3, 1.0, .5) for i in range(10)] if False else []
    harness = [line(80, 10, 94, 40, 1.2, .7), line(86, 10, 96, 36, 1.2, .5), circle(94, 42, 1.6, 1.2), circle(96, 38, 1.4, 1.0)]
    warp = [line(70 + i * 5, 46, 74 + i * 5, 88, .8, .35) for i in range(5)]
    return layer(-4, *prism, *warp) + layer(0, *cards, *knife) + layer(4, *rods, *hooks, *harness)


def hollerith():
    base = [rect(6, 78, 88, 10, 1.6), line(6, 78, 12, 72, 1.0, .5)]
    dials = []
    for r in range(2):
        for c in range(10):
            cx, cy = 14 + c * 7.4, 22 + r * 14
            dials += [circle(cx, cy, 3.2, 1.2), line(cx, cy, *pol(cx, cy, 2.8, 20 + c * 36 + r * 40), .9, .8)]
    panel = [rect(6, 10, 88, 32, 1.6)]
    press = [rect(26, 52, 40, 8, 1.6), line(30, 60, 30, 76, 1.5), line(62, 60, 62, 76, 1.5), rect(30, 68, 32, 6, 1.4)]
    pins = [line(32 + i * 2.8, 60, 32 + i * 2.8, 68, .8, .8) for i in range(11)]
    cups = [path(f"M{31 + i * 2.8} 74 q1 2 2 0", .8, .6) for i in range(11)]
    card = [poly([(28, 64), (64, 64), (64, 66.6), (28, 66.6)], 1.0, closed=True)]
    box = [rect(74, 46, 18, 28, 1.4), line(74, 54, 92, 54, 1.0, .6), line(74, 62, 92, 62, 1.0, .6), line(74, 70, 92, 70, 1.0, .6)]
    lid = [line(74, 46, 82, 38, 1.2, .7), line(82, 38, 92, 46, 1.2, .5)]
    return layer(-4, *panel) + layer(0, *base, *press, *box, *lid) + layer(4, *dials, *pins, *cups, *card)


def difference_engine():
    frame = [line(10, 90, 10, 14, 2.0), line(90, 90, 90, 14, 2.0), line(10, 90, 90, 90, 1.8), line(10, 14, 90, 14, 1.8)]
    cols = []
    for c in range(5):
        x = 24 + c * 13.5
        cols.append(line(x, 18, x, 86, 1.2, .8))
        for k in range(6):
            y = 24 + k * 11
            cols.append(circle(x, y, 3.4, 1.0, .85 if k % 2 else 1))
    cranks = [line(90, 50, 98, 50, 1.4), circle(98, 50, 2, 1.4), line(98, 50, 98, 58, 1.2)]
    carry = [line(24 + c * 13.5, 18, 37.5 + c * 13.5, 22, .8, .4) for c in range(4)]
    gearr = [gear(78, 76, 4, 6, 12, 1.0, .7)]
    return layer(-5, *carry) + layer(0, *frame, *cranks) + layer(3, *cols) + layer(6, *gearr)


def chronometer():
    outer = [rect(10, 10, 80, 80, 1.8), rect(14, 14, 72, 72, 1.0, .5)]
    ring = [circle(50, 50, 34, 1.6), circle(50, 50, 31, 1.0, .5)]
    pivots = [circle(10, 50, 2.4, 1.2), circle(90, 50, 2.4, 1.2), circle(50, 16, 2.4, 1.2), circle(50, 84, 2.4, 1.2)]
    dial = [circle(50, 50, 24, 1.6), ticks(50, 50, 20, 24, 0, 330, 11, 1.2, .8), line(50, 50, *pol(50, 50, 17, 320), 1.4), line(50, 50, *pol(50, 50, 12, 90), 1.4),
            circle(50, 50, 1.6, 1.2, fill=True), circle(50, 63, 4, 1.0, .6), line(50, 63, 50, 67, .8, .6)]
    spring = [path("M50 50 m-9 0 a9 9 0 1 1 9 9 a6 6 0 1 1 -6 -6 a3 3 0 1 1 3 3", .9, .45)]
    bars = [line(10, 50, 26, 50, 1.2, .6), line(90, 50, 74, 50, 1.2, .6), line(50, 16, 50, 26, 1.2, .6), line(50, 84, 50, 74, 1.2, .6)]
    return layer(-4, *spring) + layer(0, *outer, *ring, *pivots) + layer(5, *dial, *bars)


def anchor_escapement():
    wcx, wcy = 50, 40
    wheel = [circle(wcx, wcy, 22, 1.4), circle(wcx, wcy, 3, 1.4), spokes(wcx, wcy, 3, 18, 6, 15, 1.1)]
    teeth = []
    for k in range(15):
        a = k * 24
        x0, y0 = pol(wcx, wcy, 22, a)
        x1, y1 = pol(wcx, wcy, 27.5, a + 9)
        x2, y2 = pol(wcx, wcy, 22, a + 14)
        teeth.append(poly([(x0, y0), (x1, y1), (x2, y2)], 1.2))
    anchor = [path("M50 6 L50 14", 1.6), path("M34 22 Q36 10 50 12 Q64 10 66 22", 1.8), path("M34 22 L38 24 M66 22 L62 24", 1.4),
              line(31, 20, 35, 26, 2.0), line(69, 20, 65, 26, 2.0), circle(50, 12, 2, 1.4)]
    crutch = [line(50, 12, 50, 58, 1.2, .7), poly([(47, 58), (53, 58), (52, 66), (48, 66)], 1.2, closed=True), line(50, 66, 50, 92, 1.4)]
    pend = [circle(50, 92, 5, 1.6), circle(50, 92, 2.4, 1.0, .5)]
    arc_ = [arc(50, 66, 14, 55, 125, .9, .35)]
    return layer(-5, *arc_) + layer(0, *wheel, *teeth) + layer(4, *anchor, *crutch, *pend)


def daguerreotype():
    case = [rect(8, 22, 84, 60, 1.8), line(50, 22, 50, 82, 1.2, .6)]
    plate = [rect(14, 28, 32, 48, 1.4), rect(18, 32, 24, 40, 1.0, .5), path("M22 62 Q30 40 38 62", 1.2, .6), circle(30, 46, 3.2, 1.0, .6)]
    mat = [poly([(54, 28), (86, 28), (86, 76), (54, 76)], 1.2, closed=True), rect(58, 32, 24, 40, 1.4), line(58, 32, 82, 72, .8, .35), line(82, 32, 58, 72, .8, .35)]
    hinge = [line(50, 30, 50, 34, 2.0), line(50, 48, 50, 52, 2.0), line(50, 66, 50, 70, 2.0)]
    clasp = [circle(92, 52, 2, 1.2), line(92, 52, 96, 52, 1.2)]
    fumes = [path("M12 10 q4 -4 8 0 t8 0 t8 0", 1.0, .5), path("M14 14 q4 -4 8 0 t8 0", .9, .35)]
    return layer(-4, *fumes) + layer(0, *case, *hinge, *clasp) + layer(4, *plate, *mat)


def collodion():
    plate = [poly([(30, 20), (74, 14), (78, 62), (34, 68)], 1.6, closed=True), poly([(33, 24), (71, 19), (75, 58), (37, 64)], 1.0, .5)]
    fingers = [path("M26 66 Q32 60 34 68 L32 74 Q28 76 24 72 Z", 1.4), line(28, 68, 31, 66, .8, .5)]
    drip = [path("M74 14 q4 8 0 16", 1.0, .5), circle(75, 34, 1.2, 1.0, .6)]
    bottle = [path("M82 6 L82 14 L88 14 L88 6", 1.4), path("M80 14 Q80 24 82 28 L88 28 Q90 24 90 14", 1.6), line(84, 6, 86, 6, 1.0)]
    tray = [poly([(8, 84), (46, 84), (50, 92), (4, 92)], 1.6, closed=True), path("M12 86 Q28 90 42 86", 1.0, .6)]
    dark = [poly([(58, 76), (94, 70), (94, 94), (58, 94)], 1.6, closed=True), line(58, 82, 94, 78, 1.0, .5)]
    return layer(-4, *dark, *drip) + layer(0, *plate, *bottle, *tray) + layer(4, *fingers)


def magic_lantern():
    box = [rect(10, 40, 36, 32, 1.8), path("M10 40 L16 34 L52 34 L46 40", 1.2, .6), line(46, 40, 52, 34, 1.0, .5)]
    chimney = [rect(24, 20, 10, 20, 1.6), poly([(22, 20), (36, 20), (34, 12), (24, 12)], 1.4, closed=True), path("M26 8 q-3 -4 0 -7", .9, .45)]
    lamp = [circle(28, 60, 4, 1.2), path("M24 66 L32 66 L30 72 L26 72 Z", 1.1, .6), circle(28, 60, 1.4, 1.0, fill=True)]
    mirror = [path("M14 50 Q10 60 14 70", 1.6)]
    slide = [rect(46, 48, 4, 16, 1.4), rect(44, 46, 8, 20, 1.2, .5)]
    tube = [path("M52 50 L66 48 L66 64 L52 62 Z", 1.6), line(66, 48, 66, 64, 1.4), ellipse(66, 56, 2, 8, 1.4)]
    rays = [line(66, 50, 94, 28, .9, .5), line(66, 62, 94, 84, .9, .5), line(66, 56, 94, 56, .9, .4)]
    screen = [line(94, 22, 94, 90, 1.8), path("M94 40 l-2 6 l2 4 M94 40 l2 6 l-2 4", 1.0, .6)]
    return layer(-5, *rays) + layer(0, *box, *chimney, *tube, *screen) + layer(4, *lamp, *mirror, *slide)


def zoetrope():
    drum_t = [ellipse(50, 28, 32, 8, 1.8), ellipse(50, 28, 28, 6.5, 1.0, .5)]
    sides = [line(18, 28, 18, 66, 1.8), line(82, 28, 82, 66, 1.8), path("M18 66 Q50 78 82 66", 1.8)]
    slits = [rect(22 + i * 7.6, 28, 2.2, 14, 1.0) for i in range(7)]
    strip = [path("M20 52 Q50 62 80 52", 1.0, .6), path("M20 60 Q50 70 80 60", 1.0, .6)] + \
            [line(22 + i * 8, 53 + i * .2, 22 + i * 8, 62, .8, .4) for i in range(8)]
    figs = [circle(26 + i * 12, 54 + (i % 2) * 1.5, 1.4, .9, .6) for i in range(5)]
    spindle = [line(50, 70, 50, 82, 1.6), ellipse(50, 90, 18, 4, 1.6), line(32, 90, 32, 86, 1.4), line(68, 90, 68, 86, 1.4), path("M32 86 Q50 82 68 86", 1.4)]
    spin = [path("M84 36 q6 8 0 16", 1.0, .5), path("M84 52 l-2 -3 m2 3 l3 -2", 1.0, .5)]
    return layer(-4, *spin, *strip, *figs) + layer(0, *drum_t, *sides, *spindle) + layer(4, *slits)


def stereoscope():
    hood = [path("M10 34 L10 60 Q10 66 18 66 L40 66 L40 28 L18 28 Q10 28 10 34", 1.8), path("M10 34 L40 40", 1.0, .5)]
    lenses = [circle(26, 47, 7, 1.6), circle(26, 47, 4.4, 1.0, .6), circle(26, 47, 7, 1.0, .4)]
    lens2 = [ellipse(40, 47, 3, 10, 1.4)]
    rod = [line(40, 47, 92, 47, 1.8), line(40, 52, 92, 52, 1.0, .5)]
    slider = [rect(62, 40, 8, 18, 1.4), line(62, 47, 70, 47, .8, .5)]
    card = [rect(80, 30, 4, 34, 1.4), line(78, 30, 86, 30, 1.2), line(78, 64, 86, 64, 1.2)]
    pair = [rect(76.5, 34, 3, 10, .9, .6), rect(76.5, 48, 3, 10, .9, .6)]
    handle = [line(20, 66, 20, 90, 1.8), line(16, 90, 24, 90, 1.6)]
    nose = [path("M10 50 Q4 52 4 58 Q6 64 12 62", 1.2, .6)]
    return layer(-4, *nose) + layer(0, *hood, *rod, *handle, *card) + layer(4, *lenses, *lens2, *slider, *pair)


def geneva():
    drv = [circle(30, 62, 16, 1.6), circle(30, 62, 3, 1.4), circle(30, 62, 1, 1.0, fill=True), line(30, 62, 30, 46, 1.4), circle(30, 46, 2.2, 1.4)]
    lockdisc = [path("M30 46 m-5 0 a5 5 0 1 1 10 0 a5 5 0 1 1 -10 0", 1.0, .5), arc(30, 62, 10, 20, 200, 1.4)]
    cx, cy = 66, 40
    drn = [circle(cx, cy, 5, 1.4), circle(cx, cy, 1.4, 1.0, fill=True)]
    slots = []
    for k in range(4):
        a = k * 90
        x0, y0 = pol(cx, cy, 8, a)
        x1, y1 = pol(cx, cy, 26, a)
        nx, ny = -math.sin(math.radians(a)) * 2.2, math.cos(math.radians(a)) * 2.2
        slots.append(poly([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], 1.4))
        xa, ya = pol(cx, cy, 26, a + 45)
        xb, yb = pol(cx, cy, 26, a + 135)
        slots.append(path(f"M{f1(x1 + nx)} {f1(y1 + ny)} Q{f1(xa)} {f1(ya)} {f1(pol(cx, cy, 26, a + 90)[0] - ny)} {f1(pol(cx, cy, 26, a + 90)[1] + nx)}", 1.6))
    for k in range(4):
        a = k * 90 + 45
        slots.append(arc(cx, cy, 14.5, a - 18, a + 18, 1.2, .7))
    return layer(-4, *lockdisc) + layer(0, *drv, *drn) + layer(4, *slots)


def f1(v):
    return ("%.1f" % v)


def governor():
    spindle = [line(50, 82, 50, 26, 2.0), rect(44, 82, 12, 8, 1.6), circle(50, 22, 3.4, 1.6)]
    arms = [line(50, 22, 28, 46, 1.6), line(50, 22, 72, 46, 1.6), circle(25, 50, 6, 1.8), circle(75, 50, 6, 1.8), circle(25, 50, 6, .9, .4)]
    links = [line(28, 44, 42, 58, 1.2, .8), line(72, 44, 58, 58, 1.2, .8), circle(42, 58, 1.6, 1.0), circle(58, 58, 1.6, 1.0)]
    sleeve = [rect(44, 56, 12, 8, 1.5), line(44, 60, 56, 60, .8, .5)]
    lever = [path("M56 60 L72 70 L88 70", 1.4), circle(72, 70, 1.6, 1.0), rect(88, 64, 6, 12, 1.4)]
    pulley = [circle(50, 80, 9, 1.2, .55), path("M41 80 L22 90 M59 80 L78 90", 1.0, .5)]
    motion = [path("M12 50 q-6 0 -6 -8", .9, .45), path("M88 50 q6 0 6 -8", .9, .45)]
    return layer(-4, *pulley, *motion) + layer(0, *spindle, *sleeve, *lever) + layer(4, *arms, *links)


ITEMS = [
    dict(id="exp28_slide_rule", n="Slide Rule", era="science", cat="knowledge", ds=1622, rar="uncommon",
         date="c. 1622 (Oughtred, Cambridge), from Gunter's 1620 logarithmic scale", vis="logarithmic-slide", topic="calculating_exp28",
         region="England (Edmund Gunter, William Oughtred)", artifactType="calculating aid", material="wood", physical=True, durable=False,
         l1="Two sliding logarithmic scales that turn multiplication into adding lengths.",
         l2="Edmund Gunter built a single logarithmic scale in 1620; about 1622 William Oughtred joined two Gunter rules into a design resembling a slide rule. Slide the strip so one number sits over another, and the answer lies under a hairline on the cursor. Accuracy is about three significant digits.",
         l3="Oughtred's ideas reached print only through his student William Forster in 1632 and 1653, and a priority dispute followed with Richard Delamain. Amédée Mannheim's 1859 rule with a cursor became the standard layout, and the HP-35 pocket calculator of 1972 began its end.",
         ev="Gunter (1620) and Oughtred (c. 1622) rules; Mannheim rule of 1859",
         first_known="c. 1620–1630", confidence=dict(level="established", note="Invention dated 'around 1620–1630'; priority between Oughtred and Delamain was disputed."),
         srcs=[wp("sliderule_wp", "Slide_rule", "Gunter 1620 single scale; Oughtred c. 1622 joined two rules; Forster 1632/1653; Mannheim 1859 cursor; wood construction; ~3 significant digits; replaced by pocket calculators in the 1970s.", "Stoll 2006; Smith 1958; Petroski 2011")],
         pool=['mathematics', 'measurement', 'wood', 'number_system', 'geometry', 'writing'], must=['mathematics'], nrec=2,
         tags=["calculating", "mathematics"], regions=["europe"], art=slide_rule()),
    dict(id="exp28_planimeter", n="Amsler Polar Planimeter", era="industry", cat="technology", ds=1854, rar="uncommon",
         date="Amsler's polar planimeter, 1854 (Hermann's earlier concept, 1818)", vis="tracer-arm", topic="surveying_exp28",
         region="Switzerland (Jakob Amsler-Laffon); Bavaria (J. M. Hermann)", artifactType="measuring instrument", material="brass and steel", physical=True, durable=True,
         l1="A two-armed instrument that measures the area of any traced outline by rolling a small wheel.",
         l2="A tracer follows the outline; the other arm pivots on a fixed weight at the pole. A calibrated wheel near the elbow registers only motion at right angles to its axis, so after one circuit its turns give the enclosed area. The principle rests on Green's theorem.",
         l3="Johann Martin Hermann pioneered the concept in 1818; the Swiss mathematician Jakob Amsler-Laffon built the first modern, polar planimeter in 1854.",
         ev="Amsler's 1854 instrument",
         first_known="1818 / 1854", confidence=dict(level="established", note="Wikipedia gives 1818 for Hermann (not 1814) and 1854 for Amsler; the page offers a single unnamed reference."),
         srcs=[wp("planimeter_wp", "Planimeter", "Hermann pioneered the concept in 1818; Amsler built the first modern polar planimeter in 1854; tracer, pole arm, measuring wheel; area proportional to wheel turns.")],
         pool=['measurement', 'geometry', 'mathematics', 'maps', 'iron', 'copper', 'mechanism', 'gear'], must=['measurement'], nrec=2,
         tags=["surveying", "measurement"], regions=["europe"], art=planimeter()),
    dict(id="exp28_aneroid_barometer", n="Aneroid Barometer", era="industry", cat="science", ds=1844, rar="uncommon",
         date="Lucien Vidi, 1844 (Leibniz had proposed the concept c. 1700)", vis="capsule-dial", topic="meteorology_exp28",
         region="France (Lucien Vidi)", artifactType="meteorological instrument", material="metal", physical=True, durable=True,
         l1="A sealed, springy metal box that swells and shrinks with the air pressure and moves a needle — a barometer with no liquid.",
         l2="The evacuated capsule is held open by a strong spring, so outside pressure squeezes it a little more or less. Levers magnify that movement onto a dial. In a barograph the lever carries a pen onto a slowly turning drum to record the changes.",
         l3="Leibniz first proposed the concept around 1700; Lucien Vidi successfully invented it in 1844. Louis Figuier and Émile Gautier (1867) describe the beryllium-copper cell.",
         ev="Vidi's 1844 instrument",
         first_known="1844", confidence=dict(level="established", note="The page gives 1844 (not 1845); Heidorn 2002 is the cited basis."),
         srcs=[wp("aneroid_wp", "Aneroid_barometer", "Leibniz proposed the concept c. 1700; Lucien Vidi invented it in 1844; evacuated capsule, spring, levers and dial; barograph version.", "Heidorn 2002; Middleton 1964")],
         pool=['physics', 'copper', 'iron', 'measurement', 'mechanism', 'experiment', 'lever', 'glass'], must=['physics'], nrec=2,
         tags=["meteorology", "measurement"], regions=["europe"], art=aneroid()),
    dict(id="exp28_stevenson_screen", n="Stevenson Screen", era="industry", cat="science", ds=1864, rar="common",
         date="Thomas Stevenson's thermometer box, reported 1864", vis="louvred-box", topic="meteorology_exp28",
         region="Scotland (Thomas Stevenson)", artifactType="meteorological shelter", material="painted wood", physical=True, durable=False,
         l1="A white louvred wooden box that keeps rain and sun off the thermometers while letting the air through.",
         l2="Double-louvred walls and no floor let air circulate; white paint reflects sunshine. The WMO standard puts thermometers 1.25 to 2 m above the ground. Every station using the same box makes readings comparable.",
         l3="Thomas Stevenson (1818–1887), a Scottish civil engineer and lighthouse designer, described his box in the Journal of the Scottish Meteorological Society in 1864. Original roofs used two asbestos boards with an air gap; laminate replaced them.",
         ev="Stevenson (1864), Journal of the Scottish Meteorological Society",
         first_known="1864", confidence=dict(level="established", note="Dated by Stevenson's 1864 description."),
         srcs=[wp("stevenson_wp", "Stevenson_screen", "Thomas Stevenson reported a thermometer box in 1864; double-louvred wooden box, no floor, white paint; WMO height 1.25–2 m; houses thermometers, hygrometers, barometers.", "Stevenson 1864; Middleton 1966")],
         pool=['wood', 'measurement', 'observation', 'physics', 'experiment', 'lumber', 'glass'], must=['measurement'], nrec=2,
         tags=["meteorology", "measurement"], regions=["europe"], art=stevenson()),
    dict(id="exp28_jacquard_card_chain", n="Jacquard Punched Card Chain", era="industry", cat="technology", ds=1804, rar="rare",
         date="Jacquard's patent, 1804 (after Bouchon 1725, Falcon 1728, Vaucanson 1740)", vis="card-chain", topic="textile_machines_exp28",
         region="Lyon, France", artifactType="loom control", material="pasteboard", physical=True, durable=False,
         l1="A chain of punched cards, one per row of cloth, that tells a loom which threads to lift.",
         l2="At each quarter turn a card is pressed against rods: a hole lets a rod pass, no hole pushes it aside. Hooks not displaced are raised, lifting their warp threads to form the shed. Change the cards and the same loom weaves a different pattern.",
         l3="Basile Bouchon used a perforated paper band in 1725, Jean Baptiste Falcon individual pasteboard cards in 1728, and Jacques Vaucanson a perforated barrel in 1740; Jacquard patented the combined machine in 1804.",
         ev="Jacquard machine of 1804 and its predecessors; Jacquard-woven Livre de Prières (Lyon, 1886–87)",
         first_known="1725–1804", confidence=dict(level="established", note="Patent year 1804 as stated by the page; the page does not date the cards' adoption in Lyon."),
         srcs=[wp("jacquard_wp", "Jacquard_machine", "Jacquard patented in 1804; predecessors Bouchon 1725, Falcon 1728, Vaucanson 1740; chain of cards, holes pass rods, hooks lift warp threads, Lyon.", "Essinger 2004; Posselt 1887")],
         pool=['mechanism', 'cloth', 'weaving_shuttle', 'paper', 'plant_thread', 'iron', 'wheel', 'lever'], must=['mechanism', 'cloth'], nrec=2,
         tags=["textile", "programming_ancestor"], regions=["europe"], art=jacquard()),
    dict(id="exp28_hollerith_tabulator", n="Hollerith Tabulating Machine", era="electric", cat="computing", ds=1889, rar="rare",
         date="Late 1880s; used for the 1890 US Census", vis="tabulator", topic="calculating_exp28",
         region="United States (Herman Hollerith)", artifactType="data-processing machine", material="metal and wood", physical=True, durable=True,
         l1="A machine that reads holes in cards with electric pins and counts them on dials.",
         l2="Spring-loaded wires hung over the card, which sat above pools of mercury, one per hole position. Where a hole was punched, a wire dipped into the mercury and closed a circuit; each pulse advanced an electromechanical counter. The tabulator also controlled a sorting box that opened the lid of the compartment chosen by the card's data.",
         l3="Hollerith's first tabulators compiled mortality statistics for Baltimore, Jersey City and New York City in 1886 and then the 1890 US Census. The machine had 40 counters, each counting up to 9,999. His 1894 paper 'The Electric Tabulating Machine' is in the Journal of the Royal Statistical Society.",
         ev="Hollerith (1894), J. Royal Statistical Society 57(4); Truesdell (1965) on the Census Bureau",
         first_known="1886–1890", confidence=dict(level="established", note="'Late 1880s' per the page; the 1886 mortality statistics and 1890 Census are both named."),
         srcs=[wp("hollerith_wp", "Tabulating_machine", "Hollerith, late 1880s; 1886 mortality statistics and 1890 US Census; pins dip through holes into mercury cups to close circuits; 40 counters up to 9,999; sorting box.", "Hollerith 1894; Truesdell 1965; Austrian 1982")],
         pool=['electricity', 'paper', 'mechanism', 'copper', 'iron', 'data', 'gear', 'telegraph'], must=['electricity'], nrec=2,
         tags=["calculating", "data_processing"], regions=["americas"], art=hollerith()),
    dict(id="exp28_difference_engine", n="Babbage Difference Engine", era="industry", cat="computing", ds=1822, rar="rare",
         date="Announced 14 June 1822; Difference Engine No. 2 designed 1846–1849", vis="figure-wheel-columns", topic="calculating_exp28",
         region="England (Charles Babbage); Sweden (Scheutz)", artifactType="calculating machine", material="brass and steel", physical=True, durable=True,
         l1="A machine of stacked number wheels that makes mathematical tables by repeated addition alone.",
         l2="The method of finite differences lets a polynomial be tabulated with only addition: each column of figure wheels adds its value into its neighbour. Column 1 shows or prints the result and the last column holds a constant.",
         l3="Babbage announced it on 14 June 1822 to the Royal Astronomical Society; government funding began in 1823 and the project was abandoned in 1842 without a working full-size engine. The Science Museum built the calculating section of No. 2 in 1985–1991 and its printer by 2002. Per Georg Scheutz built a smaller engine in 1853, which reached the Dudley Observatory in 1856.",
         ev="Science Museum build of Difference Engine No. 2 (1991); Scheutz engine (1853)",
         first_known="1822", confidence=dict(level="established", note="The page gives 1846 (not 1847) for the start of No. 2's design."),
         srcs=[wp("diffengine_wp", "Difference_engine", "Announced 14 June 1822; government funding 1823, abandoned 1842; No. 2 designed 1846–1849; Science Museum build 1985–1991; Scheutz engine 1853 to Dudley Observatory 1856; finite differences, addition only.", "Swade 2002; Lardner 1834")],
         pool=['gear', 'mathematics', 'mechanism', 'number_system', 'iron', 'copper', 'engineering', 'machine_tools'], must=['mathematics', 'gear'], nrec=2,
         tags=["calculating", "computing_ancestor"], regions=["europe"], art=difference_engine()),
    dict(id="exp28_marine_chronometer", n="Marine Chronometer", era="science", cat="technology", ds=1741, rar="rare",
         date="Harrison's H1 and H2 completed 1741; H4 submitted 1761; Le Roy's chronometer 1766", vis="gimballed-timepiece", topic="timekeeping_exp28",
         region="England (John Harrison); France (Pierre Le Roy)", artifactType="timekeeper", material="brass and steel", physical=True, durable=True,
         l1="A clock steady enough at sea to carry home time, so that a navigator can work out longitude.",
         l2="The earth turns at a known rate, so the difference between local time (from the sun or stars) and the chronometer's Greenwich time gives longitude; each four seconds of error can move the position by up to about a nautical mile. The timepiece sat in a box hung in gimbals so it stayed level as the ship rolled.",
         l3="Britain offered a longitude prize in 1714 (awards from £10,000 to £20,000). Harrison finished H1 and H2 in 1741 and H4 was submitted in 1761. Pierre Le Roy invented the detent escapement in 1748 and in 1766 built a chronometer with a detent escapement, temperature-compensated balance and isochronous balance spring; Arnold and Earnshaw simplified the spring detent in 1780.",
         ev="Harrison's timekeepers; Le Roy 1766; Arnold and Earnshaw patents of 1780",
         first_known="1741", confidence=dict(level="established", note="The page gives no sea-trial dates for H4."),
         srcs=[wp("chronometer_wp", "Marine_chronometer", "Longitude prize 1714; Harrison H1/H2 1741, H4 submitted 1761; Le Roy detent escapement 1748 and 1766 chronometer; Arnold and Earnshaw 1780; gimbals; time difference gives longitude.", "Landes, Revolution in Time; Britten; Macey")],
         pool=['clock', 'navigation', 'gear', 'mechanism', 'astronomy', 'iron', 'copper', 'mathematics'], must=['clock', 'navigation'], nrec=2,
         tags=["timekeeping", "maritime"], regions=["europe"], tradeImportance="high", art=chronometer()),
    dict(id="exp28_anchor_escapement", n="Anchor Escapement", era="science", cat="engineering", ds=1670, rar="rare",
         date="Oldest known anchor clock: Wadham College, Oxford, 1670; popularised by William Clement c. 1680", vis="anchor-and-wheel", topic="timekeeping_exp28",
         region="England (William Clement; Joseph Knibb)", artifactType="mechanism", material="brass and steel", physical=True, durable=True,
         l1="A ship's-anchor-shaped lever that rocks over a toothed wheel and lets a pendulum clock tick.",
         l2="The anchor's two pallets catch and release the escape wheel's teeth while its crutch pushes the pendulum. Placing the pallets farther from the pivot cut the pendulum swing from about 100° in a verge clock to 4–6°, so clocks could use long, slow seconds pendulums in tall longcase cases.",
         l3="The oldest known anchor clock is the Wadham College clock of 1670, probably by Joseph Knibb. Wikipedia notes that the claim that Robert Hooke invented it is 'now regarded as untrue': his 1671 invention was a constant-force escapement. The anchor recoils, which adds wear; the deadbeat escapement later replaced it in precision clocks.",
         ev="Wadham College clock (1670); Headrick (2002) on the anchor escapement's origin",
         first_known="1670", confidence=dict(level="debated", note="Attribution to Clement is the page's view; Hooke's priority is 'regarded as untrue'."),
         srcs=[wp("anchor_wp", "Anchor_escapement", "Clement popularised it c. 1680; oldest known anchor clock Wadham College 1670 probably by Knibb; Hooke attribution regarded as untrue; pendulum swing from ~100° to 4–6°; recoil.", "Headrick 2002; Britten 1896")],
         pool=['gear', 'lever', 'clock', 'iron', 'mechanism', 'physics', 'experiment'], must=['clock', 'lever'], nrec=2,
         tags=["timekeeping", "mechanism"], regions=["europe"], art=anchor_escapement()),
    dict(id="exp28_daguerreotype_plate", n="Daguerreotype Plate", era="electric", cat="technology", ds=1839, rar="rare",
         date="Process presented by Arago, 19 August 1839", vis="silvered-plate", topic="photography_exp28",
         region="France (Louis Daguerre, Nicéphore Niépce)", artifactType="photographic plate", material="silvered copper", physical=True, durable=True,
         l1="A mirror-polished silver plate that records a camera image, shown under glass in a small case.",
         l2="A silvered copper sheet is polished, sensitised with iodine fumes, exposed in the camera, developed in heated mercury vapour and fixed. Each plate is a one-off positive image, sealed behind glass in a protective case.",
         l3="François Arago presented the process to the French academies on 19 August 1839. Niépce's earlier heliography laid the groundwork; after his death in 1833 his son Isidore signed a new agreement with Daguerre. The French government bought the rights for lifetime pensions to Daguerre and Isidore Niépce and gave the process to the world.",
         ev="Daguerre's 1839 process; Isidore Niépce, Post tenebras lux (1841)",
         first_known="1839", confidence=dict(level="established", note="Announcement date, not first experiments."),
         srcs=[wp("daguerre_wp", "Daguerreotype", "Presented by Arago 19 Aug 1839; silvered copper plate, iodine fumes, mercury vapour development, fixing; Niépce's heliography; French government bought the rights.", "Lowry 2000; Buerger 1989; Eder 1978")],
         pool=['photography', 'copper', 'chemistry', 'glass', 'lens', 'optics', 'experiment', 'iron'], must=['chemistry', 'copper'], nrec=2,
         tags=["photography", "chemistry"], regions=["europe"], art=daguerreotype()),
    dict(id="exp28_wet_collodion_plate", n="Wet Collodion Plate", era="electric", cat="technology", ds=1851, rar="uncommon",
         date="Invented 1848, published 1851 (Frederick Scott Archer)", vis="glass-negative", topic="photography_exp28",
         region="England (Frederick Scott Archer)", artifactType="photographic plate", material="glass", physical=True, durable=True,
         l1="A glass plate coated with sticky collodion and silver, exposed while still wet.",
         l2="Coat the plate with collodion, sensitise it in silver nitrate, expose it while it is wet and develop it. The whole sequence had to finish within about 10 to 15 minutes, before the film dried, but exposures needed only seconds of daylight.",
         l3="Archer created the process in 1848 and published it in 1851. By the end of the 1860s it almost entirely replaced the daguerreotype; gelatin dry plates largely replaced it in the 1870s, though tintypes continued into the 1930s and wet plate was still used in printing in the 1960s.",
         ev="Archer (1851); Towler, The Silver Sunbeam (1864)",
         first_known="1848–1851", confidence=dict(level="established", note="Wikipedia gives 1848 invention and 1851 publication."),
         srcs=[wp("collodion_wp", "Collodion_process", "Archer created it 1848, published 1851; collodion on glass, silver nitrate, expose wet, develop; 10–15 minute window; replaced daguerreotype by late 1860s, then gelatin dry plates in the 1870s.", "Towler 1864; Peres 2007")],
         pool=['photography', 'glass', 'chemistry', 'lens', 'optics', 'iron', 'experiment', 'copper', 'paper', 'electricity', 'metallurgy', 'observation', 'physics', 'steel', 'machine_tools'], must=[], nrec=2,
         tags=["photography", "chemistry"], regions=["europe"], art=collodion()),
    dict(id="exp28_magic_lantern", n="Magic Lantern", era="science", cat="media", ds=1659, rar="uncommon",
         date="Huygens' sketches dated to 1659; Kircher's 'Steganographic Mirror' 1645", vis="slide-projector", topic="optics_exp28",
         region="Netherlands (Christiaan Huygens); Rome (Athanasius Kircher)", artifactType="projector", material="wood, tin and glass", physical=True, durable=False,
         l1="A box with a lamp, a mirror and a lens that throws a painted glass slide onto a wall.",
         l2="A concave mirror behind the lamp sends light through a painted glass slide, which is placed upside down, and through a lens focused on the screen. Early slides were hand-painted, often on black backgrounds; the light source went from candles and oil lamps to Argand lamps, limelight and electric arcs.",
         l3="Athanasius Kircher's Ars Magna Lucis et Umbrae (1645) described a 'Steganographic Mirror', a primitive projector. Christiaan Huygens's oldest magic-lantern document, ten sketches of a skeleton removing its skull, is dated to 1659. In 1848 the Langenheim brothers made photographic lantern slides (patented 1850).",
         ev="Huygens's 1659 sketches; Kircher (1645); Vermeir (2005)",
         first_known="1659", confidence=dict(level="established", note="Date of the oldest surviving document, based on its surrounding papers."),
         srcs=[wp("lantern_wp", "Magic_lantern", "Kircher 1645; Huygens's oldest document c. 1659; lamp, mirror, painted glass slide inserted upside down, lens; Langenheim photographic slides 1848.", "Kircher 1645; Vermeir 2005; Rossell 2002")],
         pool=['lens', 'glass', 'optics', 'fire', 'wood', 'experiment', 'iron', 'copper', 'mirror', 'metallurgy', 'cloth', 'paper', 'observation', 'astronomy', 'physics', 'forging'], must=[], nrec=2,
         tags=["optics", "projection"], regions=["europe"], art=magic_lantern()),
    dict(id="exp28_zoetrope", n="Zoetrope", era="industry", cat="media", ds=1834, rar="uncommon",
         date="Horner's Dædaleum, January 1834; Lincoln's zoetrope patent granted 23 April 1867", vis="slit-drum", topic="optics_exp28",
         region="Britain (William George Horner); United States (William E. Lincoln)", artifactType="optical toy", material="metal and paper", physical=True, durable=False,
         l1="A slotted drum that makes a strip of drawings seem to move when you spin it and look through the slits.",
         l2="A strip of pictures showing the phases of a motion sits against the inside of the drum. Looking through the slits as it spins scans the pictures one at a time rather than blurring them; the faster it turns, the smoother the animation.",
         l3="William George Horner published a cylindrical variation of the phenakistoscope, the Dædaleum, in January 1834. William E. Lincoln's definitive zoetrope dates from 1865; he applied for a US patent on 27 July 1866 (assigned to Milton Bradley) and it was granted on 23 April 1867.",
         ev="Horner (1834); Lincoln's US patent of 1867",
         first_known="1834", confidence=dict(level="established", note="Two inventors a generation apart; the drum with outer slits is Lincoln's."),
         srcs=[wp("zoetrope_wp", "Zoetrope", "Horner's Dædaleum January 1834; Lincoln invented the zoetrope 1865, applied 27 July 1866, patent granted 23 April 1867; drum with slits and picture strip.", "Herbert; Veras 2022; Hopwood 1899")],
         pool=['optics', 'wheel', 'paper', 'observation', 'mechanism', 'iron', 'lens'], must=['optics', 'wheel'], nrec=2,
         tags=["optics", "animation_ancestor"], regions=["europe", "americas"], art=zoetrope()),
    dict(id="exp28_stereoscope", n="Stereoscope", era="electric", cat="media", ds=1838, rar="uncommon",
         date="Wheatstone's mirror stereoscope presented 21 June 1838; Holmes stereoscope 1861", vis="stereo-viewer", topic="optics_exp28",
         region="England (Charles Wheatstone); Scotland (David Brewster); United States (Oliver Wendell Holmes)", artifactType="viewer", material="wood and glass", physical=True, durable=False,
         l1="A viewer that shows each eye its own picture so that a pair of photographs fuses into one image with depth.",
         l2="Each eye sees the scene from a slightly different position; the stereoscope shows each eye only its own picture of a pair and the brain fuses them. Lenses also make the picture seem more distant, which relaxes the eyes.",
         l3="Charles Wheatstone presented mirrors set at 45° on 21 June 1838, using drawings because practical photography did not yet exist. David Brewster suggested lenses in 1849 and his handheld model was shown at the Great Exhibition of 1851. Oliver Wendell Holmes made a cheap handheld viewer in 1861 and deliberately did not patent it; it stayed in production for a century.",
         ev="Wheatstone (1838), Contributions to the Physiology of Vision; Brewster (1856)",
         first_known="1838", confidence=dict(level="established", note="Wheatstone's 1838 presentation; the page also mentions an optician building a device in 1832."),
         srcs=[wp("stereo_wp", "Stereoscope", "Wheatstone presented 21 June 1838; Brewster lenticular 1849, shown 1851; Holmes stereoscope 1861 unpatented; how paired views create depth.", "Wheatstone 1838; Brewster 1856; Wing 1996")],
         pool=['lens', 'optics', 'photography', 'glass', 'wood', 'experiment', 'biology'], must=['lens', 'photography'], nrec=2,
         tags=["optics", "photography"], regions=["europe", "americas"], art=stereoscope()),
    dict(id="exp28_geneva_drive", n="Geneva Drive", era="industry", cat="engineering", ds=1700, rar="uncommon",
         date="Related watch 'Geneva stop' by 17th–18th-century watchmakers; film-projector use from 1896", vis="maltese-cross", topic="machines_exp28",
         region="Geneva watchmaking; later film projectors", artifactType="mechanism", material="steel and brass", physical=True, durable=True,
         l1="A pin on a spinning wheel steps a slotted wheel round one slot at a time, then locks it still.",
         l2="The drive wheel's pin enters a slot of the driven wheel, advances it one step and leaves; a raised locking disc then holds the driven wheel in place between steps. With four slots it looks like a Maltese cross. Film projectors use it to move the film frame by frame.",
         l3="The name comes from its first use in mechanical watches popularised in Geneva; the page says the related Geneva stop, which limits spring tension, was invented by '17th or 18th century watchmakers' and dates the first film-projector uses to 1896. Wikipedia lists other uses: plotter pen changers, banknote counters, CNC tool changers and turret lathes.",
         ev="Willis (1945) 'Analysis of Geneva Mechanisms'; Bickford (1972)",
         first_known="17th–18th century (watch stop)", confidence=dict(level="uncertain", note="No firm invention date for the drive itself; the page names the watch stop's period and the 1896 projector use."),
         srcs=[wp("geneva_wp", "Geneva_drive", "Named for use in Geneva watches; Geneva stop by 17th/18th-century watchmakers; drive wheel pin, slotted driven wheel, locking disc; film projectors 1896.", "Willis 1945; Bickford 1972; Sclater 2011")],
         pool=['gear', 'wheel', 'mechanism', 'iron', 'clock', 'lever', 'engineering'], must=['gear', 'wheel'], nrec=2,
         tags=["mechanism"], regions=["europe"], art=geneva()),
    dict(id="exp28_centrifugal_governor", n="Centrifugal Governor", era="industry", cat="engineering", ds=1788, rar="uncommon",
         date="Huygens' windmill regulator (17th century); Watt's conical pendulum governor, 1788", vis="flyball-governor", topic="machines_exp28",
         region="Netherlands (Christiaan Huygens); Britain (James Watt, Matthew Boulton)", artifactType="control device", material="iron and brass", physical=True, durable=True,
         l1="Two spinning iron balls that swing out as the engine speeds up and shut its throttle — the first feedback control.",
         l2="Power from the engine drives a spindle carrying two weighted arms. As speed rises the balls move outward and upward, pulling a sleeve down that moves a linkage and reduces the throttle opening; as speed falls the reverse happens. A simple governor keeps a speed range, not an exact speed.",
         l3="Christiaan Huygens's governor in the 17th century regulated windmills and water wheels, controlling the distance and pressure between millstones. Following a suggestion from Matthew Boulton, James Watt designed a conical pendulum governor for his steam engine in 1788. James Clerk Maxwell analysed governors in 1868.",
         ev="Maxwell (1868), 'On Governors', Proc. Royal Society 16; Hills (1996), Power From Wind",
         first_known="17th century / 1788", confidence=dict(level="established", note="Page names Huygens for the governor and Watt for the steam-engine adaptation of 1788."),
         srcs=[wp("governor_wp", "Centrifugal_governor", "Huygens invented it in the 17th century for windmills and water wheels; Watt's conical pendulum governor 1788 after Boulton's suggestion; flyballs and sleeve linkage reduce the throttle; Maxwell 1868.", "Hills 1996; Maxwell 1868")],
         pool=['steam_engine', 'mechanism', 'iron', 'lever', 'gear', 'wheel', 'mechanical_power', 'water_power', 'physics', 'engineering', 'machine_tools', 'steel', 'factory', 'standardized_parts', 'pulley', 'measurement', 'cordage'], must=[], nrec=2,
         tags=["mechanism", "control"], regions=["europe"], art=governor()),
]
