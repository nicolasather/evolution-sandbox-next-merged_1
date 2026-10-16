"""EXP28 batch 01 — documented instruments, calculating machines, spinning/electric apparatus.

Every item: facts taken from the pages cited in `srcs` (fetched 2026-10-16), each source states the claim it supports.
Recipes are educational reconstructions built only from catalogue items that already exist and are not later than the item.
"""
import math

from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks

WP = "https://en.wikipedia.org/wiki/"


def astrolabe():
    cx, cy = 50, 56
    parts_back = [circle(cx, cy, 33, 1.2, .5), circle(cx, cy, 27.5, 1.0, .4)]
    ring = [circle(cx, cy, 36, 1.8), circle(cx, cy, 30, 1.5)]
    hub = [circle(cx, cy, 5.5, 1.6), circle(cx, cy, 2, 1.2, fill=True)]
    # four tapering spokes of the open wheel (cast in heavy brass)
    sp = ""
    for a in (45, 135, 225, 315):
        x0, y0 = pol(cx, cy, 5.5, a - 11)
        x1, y1 = pol(cx, cy, 30, a - 5)
        x2, y2 = pol(cx, cy, 30, a + 5)
        x3, y3 = pol(cx, cy, 5.5, a + 11)
        sp += poly([(x0, y0), (x1, y1)], 1.4) + poly([(x3, y3), (x2, y2)], 1.4)
    # degree scale on the upper-left quadrant, 90 deg in 18 steps (5 deg each)
    scale = ticks(cx, cy, 30, 33, 180, 270, 18, 1.0, .75) + ticks(cx, cy, 30, 35.5, 180, 270, 9, 1.2, .75)
    # alidade: rotating bar with two sight vanes and a pointed end
    a = 218
    ax0, ay0 = pol(cx, cy, 36, a)
    ax1, ay1 = pol(cx, cy, 36, a + 180)
    alid = [line(ax0, ay0, ax1, ay1, 1.6)]
    for px, py in ((ax0, ay0), (ax1, ay1)):
        nx, ny = -math.sin(math.radians(a)), math.cos(math.radians(a))
        alid.append(line(px + nx * 3.4, py + ny * 3.4, px - nx * 3.4, py - ny * 3.4, 1.4))
    alid.append(circle(*pol(cx, cy, 20, a), 1.2, .7))
    alid.append(circle(*pol(cx, cy, 20, a + 180), 1.2, .7))
    # suspension: shackle and ring above the wheel
    susp = [path(f"M{cx - 4} 20 Q{cx} 15 {cx + 4} 20", 1.5), circle(cx, 11, 5, 1.6), circle(cx, 11, 2.6, 1.0, .6),
            line(cx - 4, 20, cx - 2.5, 24, 1.3), line(cx + 4, 20, cx + 2.5, 24, 1.3)]
    hair = [line(cx, 20, cx, 92, .8, .3), line(8, cy, 92, cy, .8, .3), arc(cx, cy, 24, 200, 250, .8, .4)]
    return layer(-5, *parts_back) + layer(0, *ring, *sp, *hub, *susp) + layer(4, *alid) + layer(6, scale, *hair)


def camera_obscura():
    # cross-section: sunlit tree outside, pinhole in the front wall, inverted image on the rear wall
    wall = [line(36, 28, 36, 47, 1.8), line(36, 59, 36, 78, 1.8), line(36, 28, 90, 28, 1.8), line(90, 28, 90, 78, 1.8),
            line(36, 78, 90, 78, 1.8)]
    back = [path("M36 28 L44 22 L98 22 L98 72 L90 78", 1.2, .5), line(90, 28, 98, 22, 1.2, .5)]
    tree_out = [line(12, 80, 12, 38, 1.6), line(12, 38, 12, 24, 1.4), path("M12 56 L5 64 M12 56 L19 64 M12 46 L6 53 M12 46 L18 53 M12 36 L7 42 M12 36 L17 42", 1.2),
                circle(12, 24, 1.6, 1.0)]
    tree_in = [line(84, 40, 84, 66, 1.6), line(84, 66, 84, 70, 1.4), path("M84 64 L78 56 M84 64 L90 56 M84 56 L79 49 M84 56 L89 49 M84 48 L80 43 M84 48 L88 43", 1.2),
               circle(84, 70, 1.6, 1.0)]
    rays = [line(12, 24, 36, 53, .9, .5), line(36, 53, 84, 70, .9, .5), line(12, 80, 36, 53, .9, .5), line(36, 53, 84, 40, .9, .5),
            line(12, 52, 36, 53, .9, .4), line(36, 53, 84, 55, .9, .4)]
    ground = [line(4, 80, 33, 80, 1.2, .5), line(8, 84, 26, 84, .9, .3)]
    shade = [line(40 + i * 6, 31, 40 + i * 6 + 5, 35, .8, .3) for i in range(8)]
    return layer(-6, *back) + layer(0, *wall, *tree_out, *tree_in) + layer(4, *rays, *ground, *shade)


def leyden_jar():
    body = [path("M34 38 L34 82 Q34 90 42 90 L58 90 Q66 90 66 82 L66 38", 1.8), path("M34 38 Q34 33 40 31 L42 31", 1.6),
            path("M66 38 Q66 33 60 31 L58 31", 1.6), line(42, 31, 42, 24, 1.6), line(58, 31, 58, 24, 1.6)]
    foil = [line(36, 54, 36, 84, 1.0, .55), line(64, 54, 64, 84, 1.0, .55), path("M34 54 L66 54", 1.4), path("M35 84 Q50 88 65 84", 1.2, .6)]
    hatch = [line(38 + i * 4.6, 56, 38 + i * 4.6, 83, .8, .3) for i in range(6)]
    stopper = [rect(40, 18, 20, 7, 1.6), line(40, 21.5, 60, 21.5, .8, .5)]
    rod = [line(50, 18, 50, 8, 1.8), circle(50, 5.5, 3.2, 1.6), path("M50 25 L50 44", 1.2, .6)]
    chain = [path("M50 44 q2 2 0 4 q-2 2 0 4 q2 2 0 4 q-2 2 0 4 q2 2 0 4 q-2 2 0 4 q2 2 0 4 q-2 2 0 4 q2 2 0 4", 1.2, .7)]
    inner = [circle(50, 80, 5, .9, .4), path("M38 88 Q50 91 62 88", .9, .4)]
    spark = [path("M56 5 l6 -2 l-3 4 l6 -2", 1.0, .6)]
    return layer(-4, *inner, *hatch) + layer(0, *body, *stopper, *rod) + layer(3, *foil, *chain, *spark)


def napier():
    frame = [rect(10, 12, 80, 78, 1.8), line(10, 22, 90, 22, 1.2), line(10, 82, 90, 82, 1.2)]
    rods = []
    xs = [14, 31, 48, 65]
    cell = 6.6
    for i, x in enumerate(xs):
        rods.append(rect(x, 25, 15, 9 * cell, 1.4))
        for r in range(1, 9):
            rods.append(line(x, 25 + r * cell, x + 15, 25 + r * cell, .8, .5))
        for r in range(9):
            y = 25 + r * cell
            if (r + i) % 2 == 0:
                rods.append(line(x, y + cell, x + 15, y, .8, .45))
            else:
                rods.append(line(x + 15, y + cell, x, y, .8, .45))
    index = [rect(80, 25, 9, 9 * cell, 1.4)] + [line(80, 25 + r * cell, 89, 25 + r * cell, .8, .5) for r in range(1, 9)]
    top = [circle(21.5, 17, 1.4, 1.0), circle(38.5, 17, 1.4, 1.0), circle(55.5, 17, 1.4, 1.0), circle(72.5, 17, 1.4, 1.0)]
    return layer(-3, *frame, *top) + layer(2, *rods) + layer(5, *index)


def pascaline():
    case = [poly([(8, 86), (14, 36), (86, 36), (92, 86)], 1.8, closed=True), line(8, 86, 92, 86, 1.8)]
    top = [poly([(14, 36), (20, 28), (80, 28), (86, 36)], 1.6, closed=True)]
    windows = [rect(25 + i * 10.4, 30.2, 7.2, 4.2, 1.0, .8) for i in range(6)]
    dials, spk = [], []
    for i in range(6):
        cx = 27.5 + i * 9.1
        dials.append(circle(cx, 62, 4.4, 1.2))
        dials.append(circle(cx, 62, 1.1, 1.0, fill=True))
        for k in range(8):
            x0, y0 = pol(cx, 62, 2.1, k * 45)
            x1, y1 = pol(cx, 62, 4.4, k * 45)
            spk.append(line(x0, y0, x1, y1, .7, .6))
        spk.append(circle(cx, 62, 6.2, .8, .45))
    bar = [line(18, 44, 82, 44, 1.2, .7), line(20, 48, 80, 48, 1.0, .5)]
    sill = [line(14, 78, 86, 78, 1.0, .5)]
    return layer(-4, *top) + layer(0, *case, *windows, *bar) + layer(4, *dials) + layer(6, *spk, *sill)


def octant():
    ax, ay = 50, 12
    r = 72
    a0, a1 = 67.5, 112.5  # 45 degree sector pointing down
    p0 = pol(ax, ay, r, a0)
    p1 = pol(ax, ay, r, a1)
    frame = [line(ax, ay, p0[0], p0[1], 1.8), line(ax, ay, p1[0], p1[1], 1.8), arc(ax, ay, r, a0, a1, 1.8),
             arc(ax, ay, r - 7, a0, a1, 1.4)]
    brace = [line(*pol(ax, ay, 30, 82), *pol(ax, ay, 30, 98), 1.2), line(*pol(ax, ay, 48, 76), *pol(ax, ay, 48, 104), 1.2)]
    scale = [ticks(ax, ay, r - 7, r - 2.5, a0, a1, 45, .8, .6), ticks(ax, ay, r - 7, r - 0.5, a0, a1, 9, 1.0, .8)]
    arm_a = 95
    arm = [line(ax, ay, *pol(ax, ay, r + 3, arm_a), 1.6), circle(ax, ay, 2.6, 1.4), circle(ax, ay, 0.9, 1.0, fill=True),
           line(*pol(ax, ay, r + 3, arm_a), *pol(ax, ay, r + 3, arm_a + 3), 1.2)]
    # index mirror on the arm pivot and horizon glass on the left radius
    mir = [rect(ax - 3, ay + 1, 6, 8, 1.2), line(ax - 3, ay + 1, ax + 3, ay + 9, .9, .6)]
    hx, hy = pol(ax, ay, 40, a0)
    hor = [rect(hx - 0.5, hy - 3, 5, 6, 1.2), line(hx - 0.5, hy - 3, hx + 4.5, hy + 3, .9, .6)]
    sight = [rect(*[v - 1.2 for v in pol(ax, ay, 66, a0)], 2.4, 2.4, 1.2)]
    path_ray = [line(hx + 2, hy, 8, hy, .9, .5), line(ax, ay + 5, hx + 2, hy, .9, .5)]
    return layer(-5, circle(ax, ay, 4.4, .8, .35), arc(ax, ay, r - 3.5, a0, a1, .8, .35)) + layer(0, *frame, *brace, *arm, *mir, *hor) + layer(5, *scale, *path_ray)


def spinning_jenny():
    frame = [rect(8, 56, 62, 6, 1.6), line(12, 62, 10, 88, 1.6), line(66, 62, 68, 88, 1.6), line(12, 75, 66, 75, 1.0, .5),
             line(8, 56, 20, 46, 1.2, .6), line(70, 56, 82, 46, 1.2, .6), line(20, 46, 82, 46, 1.2, .6)]
    spindles = []
    for i in range(8):
        x = 14 + i * 7.4
        spindles += [line(x, 56, x, 41, 1.2), ellipse(x, 52, 2.2, 1.2, 1.0), ellipse(x, 57.5, 3, 1.4, .9, .7)]
    beam = [rect(8, 14, 64, 5, 1.5), line(12, 19, 12, 26, 1.0, .6)]
    rovings = [line(13 + i * 7.4, 19, 13.5 + i * 7.4, 40, .8, .5) for i in range(8)]
    clasp = [rect(14, 32, 52, 2.4, 1.4), rect(14, 36, 52, 2.4, 1.4), line(10, 35, 14, 35, 1.2), line(66, 35, 70, 35, 1.2)]
    wheel = [circle(84, 60, 13, 1.6), circle(84, 60, 11, 1.0, .6), circle(84, 60, 2.2, 1.4), spokes(84, 60, 2.2, 11, 8, 10, 1.0, .75),
             line(70, 58, 72, 58, 1.2), path("M72 55 Q78 50 84 47 M72 63 Q78 70 84 73", 1.0, .6)]
    thread_tilt = [line(14 + i * 7.4, 40, 18 + i * 7.4, 33, .8, .4) for i in range(0, 8, 2)]
    return layer(-5, *beam, *rovings) + layer(0, *frame, *spindles) + layer(3, *clasp, *thread_tilt) + layer(6, *wheel)


def water_frame():
    wcx, wcy = 24, 62
    wheel = [circle(wcx, wcy, 20, 1.8), circle(wcx, wcy, 15, 1.2), circle(wcx, wcy, 3, 1.4), spokes(wcx, wcy, 3, 15, 8, 0, 1.2)]
    buckets = []
    for k in range(16):
        x0, y0 = pol(wcx, wcy, 20, k * 22.5)
        x1, y1 = pol(wcx, wcy, 15, k * 22.5 + 8)
        buckets.append(line(x0, y0, x1, y1, 1.0, .75))
    flume = [path("M4 40 L12 40 L16 44", 1.2, .7), path("M6 44 Q10 48 14 46", .9, .5)]
    belt = [line(wcx + 3, wcy - 3, 62, 48, 1.0, .7), line(wcx + 3, wcy + 3, 62, 56, 1.0, .7)]
    frame = [line(56, 90, 56, 18, 1.8), line(92, 90, 92, 18, 1.8), line(56, 18, 92, 18, 1.6), line(56, 90, 92, 90, 1.6), line(56, 54, 92, 54, 1.2, .6)]
    rollers = []
    for k, y in enumerate((24, 31, 38)):
        rollers += [circle(66, y, 2.8 - k * 0.3, 1.2), circle(66, y + 6, 2.8 - k * 0.3, 1.2)] if k < 2 else []
    rollers += [circle(66, 38, 2.2, 1.2), circle(66, 44, 2.2, 1.2)]
    rovings = [line(78, 20, 66, 27, .8, .5)]
    flyers = []
    for i in range(3):
        x = 66 + i * 11
        flyers += [line(x, 58, x, 76, 1.2), path(f"M{x - 3} 60 L{x - 3} 72 M{x + 3} 60 L{x + 3} 72", 1.0, .6), ellipse(x, 78, 3.4, 1.4, 1.2)]
    pulley = [circle(60, 64, 3.2, 1.2), circle(60, 64, 1, 1.0, fill=True)]
    water = [path("M2 88 Q8 86 14 88 T26 88 T38 88 T50 88", 1.2, .6)]
    return layer(-4, *flume, *belt, *water) + layer(0, *wheel, *frame, *rollers) + layer(4, *buckets, *flyers, *pulley, *rovings)


def wimshurst():
    base = [rect(14, 84, 72, 5, 1.6), line(14, 84, 20, 80, 1.2, .5), line(86, 84, 92, 80, 1.2, .5)]
    post = [line(30, 84, 30, 62, 1.6), line(70, 84, 70, 62, 1.6)]
    discs_back = [circle(50, 52, 29, 1.2, .55), ticks(50, 52, 24, 29, 0, 345, 23, 1.2, .5)]
    disc_f = [circle(50, 52, 27, 1.8), circle(50, 52, 2, 1.4), circle(50, 52, 6, 1.0, .7)]
    sectors = ticks(50, 52, 17, 25, 7, 352, 23, 1.6, .85)
    neutral = [line(*pol(50, 52, 29, 225), *pol(50, 52, 29, 45), 1.0, .6), line(*pol(50, 52, 29, 135), *pol(50, 52, 29, 315), 1.0, .6)]
    combs = [path("M14 40 Q14 52 21 56", 1.2, .8), path("M86 64 Q86 52 79 48", 1.2, .8)]
    jars = [rect(8, 44, 6, 16, 1.4), rect(86, 44, 6, 16, 1.4), line(11, 38, 11, 44, 1.2), line(89, 38, 89, 44, 1.2), circle(11, 36, 2.2, 1.2), circle(89, 36, 2.2, 1.2)]
    rods = [line(14, 52, 4, 52, 1.0, .7), line(86, 52, 96, 52, 1.0, .7)]
    spark = [path("M13 30 l4 -3 l-2 4 l4 -3", 1.0, .6), circle(11, 24, 4, 1.4), circle(89, 24, 4, 1.4), line(11, 28, 11, 33, 1.2), line(89, 28, 89, 33, 1.2)]
    crank = [line(50, 52, 50, 74, 1.2, .6), circle(50, 76, 4, 1.4), line(54, 76, 62, 82, 1.4), circle(63, 83, 1.5, 1.2)]
    return layer(-5, *discs_back, *post, *crank) + layer(0, *base, *disc_f, *jars, *spark) + layer(4, sectors, *neutral, *combs, *rods)


def tuning_fork():
    prongs = [path("M40 12 L40 58 Q40 68 50 68 Q60 68 60 58 L60 12", 1.8), path("M46 12 L46 56 Q46 62 50 62 Q54 62 54 56 L54 12", 1.4),
              line(40, 12, 46, 12, 1.4), line(54, 12, 60, 12, 1.4)]
    stem = [line(50, 68, 50, 86, 1.8), rect(47, 80, 6, 4, 1.2), circle(50, 90, 3.4, 1.4)]
    bevel = [line(41, 16, 41, 54, .8, .45), line(59, 16, 59, 54, .8, .45), line(47, 14, 47, 52, .8, .4), line(53, 14, 53, 52, .8, .4)]
    waves = []
    for i, r in enumerate((6, 11, 16, 21)):
        waves.append(path(f"M{30 - r * 0.0} {30 - r} Q{20 - r} 30 {30} {30 + r}", .9, .55 - i * .08))
        waves.append(path(f"M{70} {30 - r} Q{80 + r} 30 {70} {30 + r}", .9, .55 - i * .08))
    return layer(-3, *waves) + layer(0, *prongs, *stem) + layer(4, *bevel)


def gunters_chain():
    links = []
    for i in range(18):
        t = i / 17
        x = 10 + 80 * t
        y = 70 - 26 * math.sin(t * math.pi * 1.6)
        ang = math.degrees(math.atan2(-26 * math.pi * 1.6 / 80 * math.cos(t * math.pi * 1.6), 1))
        rad = math.radians(ang)
        dx, dy = math.cos(rad) * 3.2, math.sin(rad) * 3.2
        links.append(line(x - dx, y - dy, x + dx, y + dy, 1.8))
        nx, ny = -math.sin(rad) * 1.2, math.cos(rad) * 1.2
        links.append(line(x - dx + nx, y - dy + ny, x + dx + nx, y + dy + ny, .8, .5))
    handle_l = [rect(3, 62, 5, 16, 1.5), line(3, 70, 8, 70, 1.0, .6)]
    handle_r = [rect(90, 40, 5, 16, 1.5), line(90, 48, 95, 48, 1.0, .6)]
    tags = []
    for k in (3, 6, 9, 12, 15):
        t = k / 17
        x = 10 + 80 * t
        y = 70 - 26 * math.sin(t * math.pi * 1.6)
        tags.append(path(f"M{x - 2.6} {y - 6} L{x + 2.6} {y - 6} L{x + 1.6} {y - 1.5} L{x - 1.6} {y - 1.5} Z", 1.0, .75))
    return layer(-3, line(4, 90, 96, 90, 1.0, .3), line(10, 94, 80, 94, .8, .25)) + layer(0, *links, *handle_l, *handle_r) + layer(4, *tags)


def hourglass():
    plates = [ellipse(50, 12, 24, 4.2, 1.6), ellipse(50, 88, 24, 4.2, 1.6), ellipse(50, 15, 24, 4.2, 1.0, .5), ellipse(50, 85, 24, 4.2, 1.0, .5)]
    posts = [line(27, 12, 27, 88, 1.6), line(73, 12, 73, 88, 1.6), line(26, 40, 28, 40, 1.0, .5), line(72, 60, 74, 60, 1.0, .5)]
    glass = [path("M33 17 Q33 34 46 46 Q50 50 54 46 Q67 34 67 17", 1.8), path("M33 83 Q33 66 46 54 Q50 50 54 54 Q67 66 67 83", 1.8)]
    sand_top = [path("M37 24 Q50 30 63 24", 1.0, .55)] + [line(38 + i * 4.2, 25 + (i % 2), 40 + i * 4.2, 30, .8, .35) for i in range(6)]
    stream = [line(50, 49, 50, 66, 1.0, .8), line(49, 52, 49, 62, .8, .4)]
    heap = [path("M35 82 Q50 62 65 82", 1.2, .8)] + [line(40 + i * 4, 80, 42 + i * 4, 74 - abs(2 - i) * 1.5, .8, .45) for i in range(5)]
    cord = [path("M44 47 Q50 49 56 47", 1.2, .7), path("M44 53 Q50 51 56 53", 1.2, .7)]
    return layer(-5, *posts) + layer(0, *plates, *glass) + layer(4, *sand_top, *stream, *heap, *cord)


def verge():
    frame = [line(18, 92, 18, 22, 1.6), line(82, 92, 82, 22, 1.6), line(18, 92, 82, 92, 1.6), line(18, 22, 82, 22, 1.4)]
    wheel_back = [ellipse(50, 70, 24, 8, 1.0, .5)]
    wheel = [ellipse(50, 70, 24, 8, 1.6), ellipse(50, 68, 24, 8, 1.2)]
    teeth = []
    for k in range(14):
        a = k * 360 / 14
        x, y = 50 + 24 * math.cos(math.radians(a)), 68 + 8 * math.sin(math.radians(a))
        teeth.append(poly([(x - 1.6 * math.sin(math.radians(a)) - 0.5, y), (x, y - 6), (x + 1.6, y)], 1.0, .8))
    verge_rod = [line(50, 34, 50, 82, 1.8), line(50, 82, 50, 90, 1.2, .6)]
    pallets = [poly([(50, 60), (40, 64), (40, 68), (50, 66)], 1.4, closed=True), poly([(50, 74), (60, 72), (60, 76), (50, 79)], 1.4, closed=True)]
    foliot = [line(20, 34, 80, 34, 1.8), line(20, 38, 80, 38, 1.0, .5), circle(21, 36, 4, 1.6), circle(79, 36, 4, 1.6),
              circle(50, 36, 2.4, 1.4)] + [line(24 + i * 4.5, 31, 24 + i * 4.5, 33.5, .8, .4) for i in range(5)]
    top = [line(50, 22, 50, 34, 1.2, .6), circle(50, 22, 2, 1.2)]
    return layer(-4, *wheel_back, *top) + layer(0, *frame, *wheel, *verge_rod, *foliot) + layer(4, *teeth, *pallets)


def stepped_reckoner():
    case = [poly([(6, 78), (14, 62), (94, 62), (88, 78)], 1.6, closed=True), rect(6, 78, 82, 10, 1.6), line(88, 78, 94, 62, 1.0, .5)]
    drums = []
    for i in range(3):
        x0 = 20 + i * 24
        drums += [ellipse(x0, 54, 8, 3, 1.5), line(x0 - 8, 54, x0 - 8, 28, 1.5), line(x0 + 8, 54, x0 + 8, 28, 1.5), ellipse(x0, 28, 8, 3, 1.4)]
        for k in range(9):
            h = 3 + k * 2.6
            xx = x0 - 7 + k * 1.75
            drums.append(line(xx, 54 + 1.8, xx, 54 - h, .8, .55))
    shaft = [line(14, 40, 80, 40, 1.0, .5)]
    pinions = [gear(20 + i * 24 + 6, 42, 3.6, 5, 10, 1.1, phase=i * 7) for i in range(3)]
    crank = [line(90, 70, 98, 54, 1.4), circle(98, 52, 2.2, 1.4), circle(90, 70, 3.4, 1.4)]
    dials = [rect(14 + i * 24, 66, 12, 7, 1.2) for i in range(3)]
    return layer(-4, *shaft) + layer(0, *case, *drums, *dials) + layer(5, *pinions, *crank)


def clay_type():
    plate = [poly([(8, 70), (20, 50), (92, 50), (80, 70)], 1.8, closed=True), line(8, 70, 8, 76, 1.6), line(80, 70, 80, 76, 1.6),
             line(8, 76, 80, 76, 1.6), line(80, 76, 92, 56, 1.4), line(92, 50, 92, 56, 1.4)]
    frame = [poly([(16, 66), (26, 52), (86, 52), (76, 66)], 1.4, closed=True)]
    grid = []
    rows, cols = 4, 8
    for r in range(rows + 1):
        a = (16 + 10 * (r / rows) * 0 + 0, 66)
        t = r / rows
        x0, y0 = 16 + (26 - 16) * t, 66 - 14 * t
        x1, y1 = 76 + (86 - 76) * t, 66 - 14 * t
        grid.append(line(x0, y0, x1, y1, .8, .55))
    for c in range(cols + 1):
        t = c / cols
        grid.append(line(16 + 60 * t, 66, 26 + 60 * t, 52, .8, .55))
    marks = []
    for r in range(rows):
        for c in range(cols):
            if (r * 3 + c * 5) % 3 == 0:
                tr, tc = (r + .5) / rows, (c + .5) / cols
                x = 16 + 60 * tc + 10 * tr
                y = 66 - 14 * tr
                marks.append(line(x - 1.6, y - .6, x + 1.6, y + .6, .9, .8))
                marks.append(line(x - .8, y - 1.6, x + .8, y + 1.4, .9, .6))
    loose = []
    for k, (x, y) in enumerate(((20, 36), (30, 30), (40, 38))):
        loose += [poly([(x, y), (x + 6, y - 2), (x + 10, y + 3), (x + 4, y + 5)], 1.4, closed=True), line(x + 4, y + 5, x + 4, y + 11, 1.2),
                  line(x + 10, y + 3, x + 10, y + 9, 1.2), line(x + 4, y + 11, x + 10, y + 9, 1.2)]
    case = [rect(60, 18, 30, 22, 1.4), line(60, 29, 90, 29, 1.0, .6), line(70, 18, 70, 40, 1.0, .6), line(80, 18, 80, 40, 1.0, .6)]
    return layer(-5, *case) + layer(0, *plate, *frame, *loose) + layer(4, *grid) + layer(6, *marks)


def src(k, title, org, url, claim, t="B", type_="reference"):
    return dict(k=k, title=title, org=org, url=url, claim=claim, t=t, type=type_, scope="topic")


ITEMS = [
    dict(id="exp28_clay_movable_type", n="Bi Sheng's Clay Movable Type", era="science", cat="technology", ds=1041, rar="rare",
         date="Between 1039 and 1048 (Qingli era 1041–1048), Song-dynasty China", vis="clay-type-block", topic="printing_exp28",
         region="Song-dynasty China", artifactType="printing type", material="fired clay",
         l1="A separate fired-clay block for every character, set in an iron frame and printed from — movable type centuries before Gutenberg.",
         l2="Bi Sheng cut each character in a thin clay tile and fired it hard. The tiles were set in an iron frame on an iron plate coated with pine resin, wax and paper ash, warmed so the paste gripped them, and levelled with a flat board. Two frames alternated: one was printed while the other was set, and common characters were cut twenty or more times.",
         l3="The only account is Shen Kuo's Dream Pool Essays (c. 1090s), which credits Bi Sheng; no type of his survives. Shen Kuo says Bi Sheng also tried wood type and gave it up because grain and ink-soaking made it uneven. A Western Xia-period Buddhist text found at Wuwei, Gansu shows broken and hollow strokes that scholars link to clay movable type.",
         ev="Shen Kuo, Dream Pool Essays (c. 1090s); Western Xia print from Wuwei, Gansu with traits of clay type",
         first_known="1039–1048", confidence=dict(level="established", note="Dated by Shen Kuo's description; Bi Sheng's own place of work is not stated in the source."),
         srcs=[src("bisheng_wp", "Bi Sheng", "Wikipedia (citing Shen Kuo, Dream Pool Essays)", WP + "Bi_Sheng",
                   "Clay type made between 1039 and 1048; iron plate, resin/wax/paper-ash paste; two alternating formes; Shen Kuo is the only record; no Bi Sheng type survives.")],
         pool=['pottery', 'writing', 'paper', 'kiln', 'clay', 'casting', 'stone'], must=['pottery'], nrec=2, tags=["printing", "east_asia"], regions=["east_asia"],
         tradeImportance="medium", art=clay_type()),
    dict(id="exp28_camera_obscura", n="Camera Obscura", era="metallurgy", cat="science", ds=-400, rar="uncommon",
         date="Mozi (c. 470 – c. 391 BC) gives the earliest documented explanation; Ibn al-Haytham (c. 965–1040) describes it quantitatively",
         vis="pinhole-chamber", topic="optics_exp28", region="Warring States China; Classical Greece; the medieval Islamic world",
         artifactType="optical apparatus", material="wood and cloth", physical=True, durable=False,
         l1="A dark room with a small hole: the outside world appears upside down on the opposite wall.",
         l2="Light travels in straight lines, so rays from the top of a scene cross at the hole and land at the bottom of the screen. Mozi explained the inverted image for exactly this reason. The same box later became the drawing aid and the ancestor of the photographic camera.",
         l3="Mozi is described as the earliest documented explanation; Ibn al-Haytham used a darkened room with a small opening and is credited with the first geometrical, quantitative description. Wikipedia's account notes Joseph Needham (Science and Civilisation in China IV.1, pp. 98–99) on Shen Kuo and the pinhole's focal relation.",
         ev="Mozi's explanation of the inverted image; Ibn al-Haytham's experiments in a darkened room (Needham, SCC IV.1)",
         first_known="5th–4th century BC (Mozi)", confidence=dict(level="debated", note="Several traditions describe the effect; the page gives Mozi's dates both as c. 470–391 BC and as 5th century BC."),
         srcs=[src("camera_hist_wp", "History of the camera", "Wikipedia (citing Needham, Wade & Finger, Plott)", WP + "History_of_the_camera",
                   "Mozi earliest documented explanation of the inverted pinhole image; Ibn al-Haytham's darkened-room experiments, first geometrical and quantitative description.")],
         pool=['shelter', 'awl', 'observation', 'stone', 'wood', 'astronomy', 'geometry', 'mathematics'], must=['observation'], nrec=2, tags=["optics", "multi_origin"],
         regions=["east_asia", "west_central_asia", "europe"], art=camera_obscura()),
    dict(id="exp28_hourglass", n="Hourglass", era="science", cat="technology", ds=1338, rar="uncommon",
         date="First documented in Ambrogio Lorenzetti's fresco of 1338; marine sandglass receipt c. 1345", vis="sandglass", topic="timekeeping_exp28",
         region="Late medieval Europe (Italy; English royal ships)", artifactType="timekeeper", material="glass and sand", physical=True,
         l1="Two glass bulbs joined by a narrow neck: sand runs through at a steady rate and measures an hour or a watch.",
         l2="Unlike a water clock, a sandglass is hardly affected by a ship's motion or by condensation, so it became the sailor's timer. Used with a chip log it let a navigator turn the log line into speed. Magellan's fleet carried 18 of them and a ship's boy turned them on the hour.",
         l3="The first documented example is in Ambrogio Lorenzetti's 1338 Allegory of Good Government; the earliest reference taken as certainly a marine sandglass is a c. 1345 receipt for the ship La George of Edward III. The early glasses were two bulbs bound with cord and wax; one-piece blowing came about 1760. Fill ranged from sand to powdered marble and burnt eggshell.",
         ev="Lorenzetti fresco (1338); c. 1345 receipt of Thomas de Stetesham for the king's ship La George",
         first_known="1338", confidence=dict(level="debated", note="First documentation, not necessarily first invention."),
         srcs=[src("hourglass_wp", "Hourglass", "Wikipedia (citing Balmer 1978, 1979; Turner 1993)", WP + "Hourglass",
                   "First documented in Lorenzetti's 1338 fresco; c. 1345 La George receipt; marine use with a chip log; Magellan carried 18 glasses; bulbs blown as one piece c. 1760.")],
         pool=['glass', 'clock', 'wood', 'measurement', 'lever', 'cordage', 'calendar'], must=['glass'], nrec=2, tags=["timekeeping", "maritime"], regions=["europe"],
         art=hourglass()),
    dict(id="exp28_verge_escapement", n="Verge Escapement", era="science", cat="engineering", ds=1300, rar="rare",
         date="Late 13th century (uncertain; Dunstable Priory, 1283, is one candidate)", vis="crown-wheel", topic="timekeeping_exp28",
         region="Europe", artifactType="mechanism", material="iron", physical=True,
         l1="A toothed crown wheel and a swinging bar that lets a weight drive a clock one tick at a time.",
         l2="A crown wheel's teeth catch two angled pallets on a vertical rod, the verge. Each push swings a weighted bar, the foliot, the other way, and releasing one tooth at a time turns steady rotation into regulated beats. It was the only escapement for about the first 200 years of mechanical clocks.",
         l3="The date is not settled: the verge is believed to appear in late-13th-century tower clocks, but early 'horologe' could mean a water clock. Richard of Wallingford's 1327 account describes a related 'strob' escapement, not a true verge. The pendulum (1656) and balance spring (1658) exposed its inaccuracy; the anchor escapement spread from about 1680.",
         ev="Early tower clocks; Richard of Wallingford's 1327 description (strob escapement)",
         first_known="late 13th century (uncertain)", confidence=dict(level="uncertain", note="'The sources are unclear' on first use; the date is a documentary window, not a proven first."),
         srcs=[src("verge_wp", "Verge escapement", "Wikipedia (citing Cipolla, Macey, North, Dohrn-van Rossum)", WP + "Verge_escapement",
                   "Earliest known mechanical escapement, believed in late-13th-century tower clocks, sources unclear; parts and action; dominant ~350 years until anchor escapement c. 1660.")],
         pool=['gear', 'lever', 'iron', 'mechanism', 'forging', 'pulley', 'engineering'], must=['gear'], nrec=2, tags=["timekeeping", "mechanism"], regions=["europe"], art=verge()),
    dict(id="exp28_mariners_astrolabe", n="Mariner's Astrolabe", era="science", cat="technology", ds=1496, rar="rare",
         date="Oldest surviving example dated 1496–1501 (Sodré astrolabe, found 2014)", vis="open-wheel-astrolabe", topic="navigation_exp28",
         region="Portugal and the Atlantic; surviving specimen from the wreck of the Esmeralda off Oman (1503)", artifactType="navigation instrument",
         material="cast brass", physical=True,
         l1="A heavy open ring with a sighting arm: the sailor's tool for reading the sun's height to find latitude.",
         l2="South of the equator the Pole Star disappears. Portuguese pilots on north–south Atlantic voyages instead measured the sun's altitude at noon and used declination tables in a regimento to work out latitude. An open-wheel ring in heavy brass hung steady on a ship and could be read with an alidade.",
         l3="The Sodré astrolabe, found in 2014 on the Esmeralda wreck (sunk off Oman in 1503), is dated 1496–1501 and is the oldest mariner's astrolabe known. The earliest surviving regimento was printed in Lisbon c. 1509, and similar books were probably in use in the 1480s. Heavier brass mariner's astrolabes appear about two decades later.",
         ev="Sodré astrolabe (1496–1501) from the Esmeralda wreck; regimento printed Lisbon c. 1509",
         first_known="1496–1501 (oldest surviving)", confidence=dict(level="established", note="Dating is of the surviving object; earlier use is inferred from regimentos of the 1480s."),
         srcs=[src("astrolabe_ox", "The mariner's astrolabe and Portuguese exploration", "University of Oxford (Cabinet)",
                   "https://www.cabinet.ox.ac.uk/node/7661",
                   "Sodré astrolabe oldest known mariner's astrolabe, found 2014, dated 1496–1501; Esmeralda sank off Oman 1503; sun altitude + declination tables; regimento printed c. 1509.", t="S", type_="institutional")],
         pool=['casting', 'astronomy', 'navigation', 'bronze', 'measurement', 'geometry', 'maps', 'copper', 'observation'], must=['navigation'], nrec=2, tags=["navigation", "maritime"], regions=["europe"],
         tradeImportance="high", art=astrolabe()),
    dict(id="exp28_stepped_reckoner", n="Leibniz Stepped Reckoner", era="science", cat="computing", ds=1673, rar="rare",
         date="Idea 1672; wooden model shown to the Royal Society 1 February 1673; surviving machine 1690–1720", vis="stepped-drum", topic="calculating_exp28",
         region="Paris and Hanover (Leibniz)", artifactType="calculating machine", material="brass and iron", physical=True, durable=True,
         l1="A hand-cranked calculator whose key part, the stepped drum, lets one turn of a crank multiply a digit.",
         l2="Leibniz's stepped drum (Staffelwalze) is a cylinder with nine teeth of increasing length. A sliding gear meets as many teeth as the digit set, so a turn adds that digit several times. The machine multiplied by repeated addition and divided by repeated subtraction.",
         l3="Two prototypes were built, and only one survives, in Hanover. Precision gearwork was beyond the fabrication of the time and a design flaw in the carry kept the machines from working reliably. The stepped drum itself lived on for about 200 years, until the Curta hand calculator in the 1970s.",
         ev="Surviving machine in Hanover; wooden model presented to the Royal Society (1673)",
         first_known="1673", confidence=dict(level="established", note="Design date and prototypes are documented; reliable operation was not achieved."),
         srcs=[src("stepped_wp", "Stepped reckoner", "Wikipedia (citing Kidwell & Williams, The Calculating Machines)", WP + "Stepped_reckoner",
                   "Idea 1672 in Paris; wooden model to the Royal Society 1 Feb 1673; stepped drum mechanism; two prototypes, one survives in Hanover; carry flaw.")],
         pool=['gear', 'mathematics', 'mechanism', 'number_system', 'iron', 'copper', 'engineering', 'casting'], must=['gear'], nrec=2, tags=["calculating", "mechanism"], regions=["europe"],
         art=stepped_reckoner()),
    dict(id="exp28_napiers_bones", n="Napier's Bones", era="science", cat="knowledge", ds=1617, rar="uncommon",
         date="Published in Rabdologiae, 1617 (name popularised 1667)", vis="multiplication-rods", topic="calculating_exp28",
         region="Scotland (John Napier)", artifactType="calculating aid", material="wood or ivory", physical=True, durable=False,
         l1="A set of numbered rods that turns multiplication into reading a row and adding along the diagonals.",
         l2="Each rod shows the multiples of one digit, every two-digit product split by a diagonal. Set the rods for the number to multiply side by side, read the row for each digit of the multiplier, and add the digits along each diagonal strip; only addition is needed.",
         l3="Napier published the method as Rabdologiae in 1617. William Leybourne's 1667 book The art of numbering by speaking rods gave them the name 'Napier's bones'. A surviving set of 1679 comes in a box with interest tables and a calendar for 1679–1693.",
         ev="Rabdologiae (1617); surviving 1679 set in its box",
         first_known="1617", confidence=dict(level="established", note="Printed first publication."),
         srcs=[src("napier_mt", "Napier's rods", "MacTutor History of Mathematics, University of St Andrews", "https://mathshistory.st-andrews.ac.uk/Extras/Napier_rods/",
                   "Rabdologia published 1617; 10 rods with four faces; diagonal-split squares; only addition needed; 'Napier's bones' name from Leybourne 1667; 1679 boxed set.", t="S", type_="institutional")],
         pool=['mathematics', 'wood', 'number_system', 'writing', 'measurement', 'bone', 'stone', 'paper'], must=['mathematics'], nrec=2, tags=["calculating", "mathematics"], regions=["europe"],
         art=napier()),
    dict(id="exp28_pascaline", n="Pascaline", era="science", cat="computing", ds=1642, rar="rare",
         date="Designed 1642; presented 1645 after about fifty prototypes", vis="dial-calculator", topic="calculating_exp28",
         region="France (Blaise Pascal)", artifactType="calculating machine", material="metal", physical=True, durable=True,
         l1="A box of dials that adds and subtracts by turning wheels — the first mechanical calculator Pascal sold.",
         l2="Pascal began at 18 to help his father, a tax supervisor in Rouen. Each digit has a spoked dial turned with a stylus, a window shows the result, and a falling part, the sautoir, passes the carry to the next wheel so carries ripple down the machine. Subtraction uses nines' complement.",
         l3="After about fifty prototypes Pascal presented the machine in 1645, dedicated to Chancellor Pierre Séguier. About twenty were built or sold by 1654 and nine survive, mostly in European museums.",
         ev="Pascal, La Machine d'arithmétique (1645); nine surviving machines",
         first_known="1642–1645", confidence=dict(level="established", note="Dating from Pascal's own dedication; the workshop is not named in the source."),
         srcs=[src("pascaline_wp", "Pascal's calculator", "Wikipedia (citing Pascal 1645; Mourlevat 1988)", WP + "Pascaline",
                   "Designed 1642 by Blaise Pascal aged 18; presented 1645 after 50 prototypes; sautoir carry; about twenty built; nine survive.")],
         pool=['gear', 'mechanism', 'number_system', 'mathematics', 'copper', 'iron', 'engineering', 'casting'], must=['gear'], nrec=2, tags=["calculating", "mechanism"], regions=["europe"],
         art=pascaline()),
    dict(id="exp28_hadley_octant", n="Hadley Octant", era="science", cat="technology", ds=1730, rar="rare",
         date="1730 (invented independently by Thomas Godfrey of Philadelphia)", vis="octant-frame", topic="navigation_exp28",
         region="England (John Hadley); Philadelphia (Thomas Godfrey)", artifactType="navigation instrument", material="wood and brass", physical=True, durable=False,
         l1="A wooden sector with two mirrors that lets a sailor bring the sun and the horizon together in one view.",
         l2="Two reflections do the work: a mirror on a swinging arm and a fixed horizon glass bring the image of the sun down to the horizon, and the arm's position on the arc gives its altitude. Because both images sit in one view, the instrument stays accurate on a pitching deck, a great step over the back-staff.",
         l3="Britannica credits John Hadley with the double-reflecting octant in 1730 and notes he invented it independently of Thomas Godfrey of Philadelphia. Hadley also added a spirit level to take a meridian altitude when the horizon was invisible. Its design later evolved into the sextant.",
         ev="Hadley's reflecting instrument of 1730; independent invention by Godfrey",
         first_known="1730", confidence=dict(level="established", note="Britannica gives 1730; no Royal Society date is stated in the page used."),
         srcs=[src("hadley_brit", "John Hadley", "Encyclopædia Britannica", "https://www.britannica.com/biography/John-Hadley",
                   "Hadley invented the double-reflecting octant in 1730, independently of Thomas Godfrey of Philadelphia; later evolved into the sextant.")],
         pool=['glass', 'optics', 'navigation', 'wood', 'measurement', 'astronomy', 'geometry', 'observation', 'copper'], must=['navigation'], nrec=2, tags=["navigation", "maritime"], regions=["europe", "americas"],
         art=octant()),
    dict(id="exp28_spinning_jenny", n="Spinning Jenny", era="industry", cat="technology", ds=1764, rar="uncommon",
         date="Invented 1764–1765; patent no. 962 of 12 July 1770", vis="multi-spindle-frame", topic="textile_machines_exp28",
         region="Stanhill, Oswaldtwistle, Lancashire, England (James Hargreaves)", artifactType="textile machine", material="wood and iron", physical=True, durable=False,
         l1="A wooden frame that spins eight threads at once from one turn of the wheel.",
         l2="Eight rovings were fed through two bars clasped by the spinner's left hand; drawing them out drew the fibre, a turn of the wheel twisted all spindles, and on the return stroke the thread wound onto them. One worker could tend eight or more spindles, later up to 120.",
         l3="Hargreaves's patent (no. 962) is dated 12 July 1770. Local spinners angered by falling yarn prices broke into his house and smashed his machines, and he fled to Nottingham in 1768. The yarn was coarse until Arkwright's water frame; jennies stayed common until about 1810.",
         ev="Patent no. 962 (1770); contemporary accounts of the Blackburn riots",
         first_known="1764–1765", confidence=dict(level="established", note="Invention date from the patent history; exact month not stated."),
         srcs=[src("jenny_wp", "Spinning jenny", "Wikipedia (citing Baines 1835; Guest 1828)", WP + "Spinning_jenny",
                   "Hargreaves 1764–1765 at Stanhill, Oswaldtwistle; patent no. 962 of 12 July 1770; eight spindles; riots; in use until about 1810.")],
         pool=['plant_thread', 'wheel', 'mechanism', 'wood', 'weaving_shuttle', 'cloth', 'cordage', 'iron', 'gear'], must=['plant_thread'], nrec=2, tags=["textile", "industrial_revolution"], regions=["europe"],
         art=spinning_jenny()),
    dict(id="exp28_water_frame", n="Water Frame", era="industry", cat="technology", ds=1769, rar="uncommon",
         date="Developed in Nottingham 1768–1769; water-powered at Cromford from about 1774", vis="roller-spinning-frame", topic="textile_machines_exp28",
         region="Nottingham and Cromford, England (Richard Arkwright)", artifactType="textile machine", material="wood, iron, brass rollers", physical=True, durable=False,
         l1="A spinning machine driven by a water wheel, drawing fibre between rollers turning at different speeds.",
         l2="Rollers rotating at different speeds draw the cotton out to the thickness wanted before it is twisted, and a water wheel supplies the power, so one mill could run hundreds of spindles. It made strong warp yarn, which the jenny could not.",
         l3="Arkwright formed a partnership in Nottingham in 1768, leased premises in 1769 for a horse-powered factory, and probably had the water-powered Cromford mill working from 1774. His patents for the frame and carding machinery were challenged and lost in 1785; the page notes that the originality of his innovations is debated.",
         ev="Cromford Mill; partnership at Nottingham 1768; patents lost 1785",
         first_known="1768–1769", confidence=dict(level="debated", note="The source gives no patent date; originality is disputed."),
         srcs=[src("arkwright_erih", "Sir Richard Arkwright (1732–92)", "European Route of Industrial Heritage (ERIH)", "https://www.erih.net/how-it-started/stories-about-people-biographies/biography/arkwright",
                   "Rollers at different speeds; Nottingham partnership 1768; 1769 premises; Cromford mill from c. 1774; patents lost 1785; first factory-based cotton yarn production.", t="A", type_="heritage")],
         pool=['plant_thread', 'water_power', 'mechanism', 'wheel', 'gear', 'cordage', 'iron'], must=['plant_thread', 'water_power'], nrec=2, tags=["textile", "industrial_revolution"], regions=["europe"],
         art=water_frame()),
    dict(id="exp28_leyden_jar", n="Leyden Jar", era="science", cat="science", ds=1745, rar="rare",
         date="Kleist at Cammin, autumn 1745 (11 October per Wikipedia, 4 November per ETHW); Musschenbroek at Leiden, letter of 20 January 1746",
         vis="charged-jar", topic="electrostatics_exp28", region="Cammin, Pomerania and Leiden, Netherlands", artifactType="electrical apparatus",
         material="glass and metal", physical=True, durable=True,
         l1="A glass jar lined inside and out with metal that stores an electric charge.",
         l2="Two people found it independently. Ewald von Kleist, dean of the cathedral at Cammin, charged a bottle through a nail; at Leiden Pieter van Musschenbroek and Andreas Cunaeus did it with water in a glass jar. Later makers coated the glass inside and out with foil and dropped the water.",
         l3="A glass jar with foil inside and out, stopping short of the neck, a metal rod through a stopper joined to the inner foil by a hanging chain. Franklin showed in 1749 that the charge lay in the glass of his dissectible jar; later work attributed residual charge to corona and moisture in soda glass. Today it would be called a capacitor.",
         ev="Kleist (1745); Musschenbroek's letter of 20 January 1746; Franklin's letter of 29 April 1749",
         first_known="1745", confidence=dict(level="established", note="Two independent discoveries; the exact day of Kleist's trial differs between the two sources."),
         srcs=[src("leyden_wp", "Leyden jar", "Wikipedia (citing Heilbron 1979; Pence 2022)", WP + "Leyden_jar",
                   "Kleist, dean at Cammin in Pomerania, 11 Oct 1745; Musschenbroek and Cunaeus at Leiden, letter 20 Jan 1746; construction; Franklin 1749."),
               src("leyden_ethw", "Leyden jar", "Engineering and Technology History Wiki (IEEE)", "https://ethw.org/Leyden_jar",
                   "Von Kleist, 4 November 1745; Musschenbroek 1746; first device capable of storing electric charge; a capacitor.", t="S", type_="institutional")],
         pool=['glass', 'iron', 'physics', 'experiment', 'copper', 'observation', 'cordage'], must=['glass'], nrec=2, tags=["electricity", "multi_origin"], regions=["europe"],
         major=dict(tier="B", lat=53.97, lon=14.77, precision="site", geo="europe", region="Cammin (Kamień Pomorski), Pomerania",
                    civ="Ewald von Kleist", period="Enlightenment", certainty="multiple",
                    fact="In 1745 the cathedral dean Ewald von Kleist at Cammin, and almost at once Musschenbroek at Leiden, found that a jar could store electric charge.",
                    alsoAt=[dict(lat=52.16, lon=4.49, label="Leiden, Netherlands")],
                    evidence="Wikipedia 'Leyden jar' (Kleist, Cammin, 1745; Leiden letter 1746) and ETHW"),
         art=leyden_jar()),
    dict(id="exp28_wimshurst_machine", n="Wimshurst Machine", era="electric", cat="technology", ds=1882, rar="uncommon",
         date="Early 1880s (James Wimshurst)", vis="influence-machine", topic="electrostatics_exp28", region="Britain (James Wimshurst)",
         artifactType="electrical apparatus", material="glass, metal, wood", physical=True, durable=True,
         l1="Two glass discs turning in opposite directions build a charge with no rubbing, and sparks leap the gap.",
         l2="An influence machine creates electricity without friction: two discs on one axis spin in opposite directions past fixed metal brushes, charges build up and are gathered by metal fixtures near each disc, and the growing charge sparks between two metal globes.",
         l3="The National MagLab museum dates the machine to the early 1880s (the page title gives 1880) and names the British scientist James Wimshurst as its inventor. Many surviving examples add Leyden jars as capacitors, though that detail is not in the page cited here.",
         ev="National High Magnetic Field Laboratory museum record, 'Wimshurst Machine, 1880'",
         first_known="1880s", confidence=dict(level="established", note="Decade only; the page does not give a precise year."),
         srcs=[src("wimshurst_maglab", "Wimshurst Machine (1880)", "National High Magnetic Field Laboratory, Magnet Academy",
                   "https://nationalmaglab.org/magnet-academy/history-of-electricity-magnetism/museum/wimshurst-machine-1880/",
                   "James Wimshurst, early 1880s; two discs counter-rotating past brushes; influence machine; sparks between globes.", t="S", type_="institutional")],
         pool=['electricity', 'glass', 'wheel', 'gear', 'copper', 'iron', 'mechanism', 'experiment', 'physics'], must=['electricity', 'glass'], nrec=2, tags=["electricity"], regions=["europe"], art=wimshurst()),
    dict(id="exp28_tuning_fork", n="Tuning Fork", era="science", cat="science", ds=1711, rar="uncommon",
         date="1711 (John Shore, trumpeter to the English Royal Court)", vis="u-fork", topic="acoustics_exp28", region="England (John Shore)",
         artifactType="acoustic standard", material="steel or iron", physical=True, durable=True,
         l1="A two-pronged steel fork that rings one pure pitch, used to give a musician the note.",
         l2="Before it, musicians relied on wooden pitch pipes, which temperature and humidity made unreliable. The fork holds its pitch across a wide range of conditions and produces a very pure tone, so it became a standard: in the 1830s Johann Scheibler used a set of 56 forks to measure concert A in Vienna.",
         l3="The Whipple Museum's note credits John Shore (d. 1752), musician, instrument maker and trumpeter at the English Royal Court, with inventing the tuning fork in 1711. Ernst Chladni first studied forks systematically with his powder patterns, and Jules Lissajous made a standard fork of 335 Hz.",
         ev="Whipple Museum acoustics collection note",
         first_known="1711", confidence=dict(level="established", note="Attribution to Shore as stated by the museum note."),
         srcs=[src("fork_whipple", "Historical Notes: a Brief Chronicle of the Tuning Fork", "Whipple Museum of the History of Science, University of Cambridge",
                   "https://www.whipplemuseum.cam.ac.uk/explore-whipple-collections/acoustics/historical-notes-brief-chronicle-tuning-fork",
                   "John Shore invented the tuning fork in 1711; pure tone; Scheibler 56 forks 1830s; Chladni; Lissajous 335 Hz.", t="S", type_="institutional")],
         pool=['iron', 'forging', 'physics', 'music', 'mathematics', 'observation', 'experiment', 'measurement'], must=['iron', 'music'], nrec=2, tags=["acoustics", "music"], regions=["europe"], art=tuning_fork()),
    dict(id="exp28_gunters_chain", n="Gunter's Chain", era="science", cat="technology", ds=1620, rar="common",
         date="Introduced by Edmund Gunter in 1620", vis="survey-chain", topic="surveying_exp28", region="England (Edmund Gunter)",
         artifactType="surveying instrument", material="iron and brass", physical=True, durable=True,
         l1="A chain of 100 iron links, 66 feet long, laid end over end to measure land.",
         l2="The chain has 98 full links of 7.92 inches plus two shorter end links, with brass tags marking every tenth link, so a surveyor can read distance from either end. Ten square chains make an acre, which tied field measurement to the area the land would be taxed on.",
         l3="Edmund Gunter, an English clergyman and mathematician, introduced it in 1620. Links stretched with use, so chains were checked against a standard; Edinburgh surveyors calibrated theirs against brass plates set in the steps of the National Gallery of Scotland. Its use declined in the first half of the 20th century.",
         ev="Heriot-Watt ICE Museum chain no. 1977/003 (c. 1900)",
         first_known="1620", confidence=dict(level="established", note="Introduction date as stated by the museum record; the ten-chains-to-an-acre relation is general knowledge not in the page."),
         srcs=[src("gunter_ice", "Measuring Chain (1977/003)", "ICE Museum Scotland, Heriot-Watt University", "https://ice-museum-scotland.hw.ac.uk/item/1977-003/",
                   "66-foot, 100-link iron chain with brass handles; Edmund Gunter introduced it in 1620; 98 full links of 7.92 in; tags every tenth link; calibration in Edinburgh.", t="S", type_="institutional")],
         pool=['iron', 'measurement', 'geometry', 'forging', 'maps', 'cordage', 'rope', 'mathematics', 'number_system'], must=['iron'], nrec=2, tags=["surveying", "measurement"], regions=["europe"], art=gunters_chain()),
]
