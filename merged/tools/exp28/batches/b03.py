"""EXP28 batch 03 — instruments, optics toys, electronics, safety. Facts only from pages fetched 2026-10-16."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def cup_anemometer():
    mast = [line(50, 92, 50, 36, 2.0), rect(42, 88, 16, 6, 1.5), circle(50, 36, 3, 1.4)]
    arms, cups = [], []
    for k in range(4):
        a = k * 90 + 20
        x, y = pol(50, 36, 24, a)
        arms.append(line(50, 36, x, y, 1.6))
        cups.append(arc(x, y, 7, a + 90 - 90, a + 90 + 90, 1.8))
        cups.append(line(*pol(x, y, 7, a), *pol(x, y, 7, a + 180), 1.0, .6))
    ring = [ellipse(50, 36, 24, 7, .9, .35)]
    wind = [path("M6 16 q10 -6 20 0 t20 0", 1.0, .45), path("M4 26 q10 -6 20 0 t16 0", .9, .35)]
    return layer(-4, *ring, *wind) + layer(0, *mast) + layer(4, *arms, *cups)


def camera_lucida():
    stand = [line(20, 92, 20, 40, 2.0), line(10, 92, 30, 92, 1.8), line(20, 40, 40, 30, 1.6), circle(20, 62, 2.2, 1.2)]
    prism = [poly([(40, 22), (52, 22), (56, 34), (40, 38)], 1.8, closed=True), line(40, 22, 56, 34, 1.0, .6), line(40, 38, 52, 22, 1.0, .5)]
    eye = [ellipse(46, 8, 6, 3.4, 1.4), circle(46, 8, 1.4, 1.0, fill=True)]
    rays = [line(46, 11, 46, 22, .9, .6), line(48, 36, 70, 76, .9, .5), line(46, 38, 46, 76, .9, .5)]
    table = [line(30, 82, 96, 82, 1.8), line(34, 86, 92, 86, 1.0, .5)]
    paper = [poly([(48, 82), (88, 82), (92, 78), (52, 78)], 1.2, closed=True), path("M56 80 q6 -3 12 0", 1.0, .6)]
    obj = [path("M74 72 L78 60 L82 72 Z", 1.2, .6), line(78, 60, 78, 56, 1.0, .6), circle(78, 55, 1.6, 1.0, .6)]
    return layer(-4, *rays, *obj) + layer(0, *stand, *table, *paper) + layer(4, *prism, *eye)


def galvanometer():
    base = [rect(14, 76, 72, 8, 1.8), line(14, 80, 86, 80, 1.0, .5)]
    coil = [rect(28, 38, 44, 30, 1.8)] + [rect(30 + i * 1.8, 40 + i * 1.8, 40 - i * 3.6, 26 - i * 3.6, .9, .7) for i in range(4)]
    needle = [line(50, 58, *pol(50, 53, 18, 28), 1.8), line(50, 58, *pol(50, 53, -18, 28), 1.4), circle(50, 53, 2.4, 1.4), circle(50, 53, .8, 1.0, fill=True)]
    dial = [circle(50, 53, 24, 1.0, .6), ticks(50, 53, 20, 24, 200, 340, 14, 1.0, .75)]
    wire = [path("M28 52 Q14 52 14 70 L14 76", 1.4), path("M72 52 Q86 52 86 70 L86 76", 1.4), circle(14, 76, 2.2, 1.2), circle(86, 76, 2.2, 1.2)]
    cap = [path("M32 36 Q50 14 68 36", 1.4, .6), line(50, 24, 50, 14, 1.0, .6), circle(50, 12, 2, 1.2)]
    return layer(-4, *dial) + layer(0, *base, *coil, *wire) + layer(4, *needle, *cap)


def kamal():
    string = [path("M10 62 Q40 60 62 56", 1.6)] + [circle(12 + i * 9, 61.5 - i * .8, 1.3, .9, fill=True) for i in range(6)]
    card = [rect(58, 42, 6, 26, 1.8), circle(61, 56, 1.4, 1.0), line(58, 42, 64, 42, 2.0), line(58, 68, 64, 68, 2.0)]
    teeth = [path("M8 56 q2 6 2 10 q-2 2 -4 0 q0 -6 2 -10", 1.2, .7), line(8, 62, 12, 62, 1.0, .6)]
    horizon = [line(4, 70, 96, 70, 1.4), path("M70 76 q6 -3 12 0 t12 0", 1.0, .45)]
    pol_star = [line(84, 20, 84, 32, 1.0, .75), line(78, 26, 90, 26, 1.0, .75), line(80, 22, 88, 30, .8, .6), line(88, 22, 80, 30, .8, .6), circle(84, 26, 1.4, 1.0, fill=True)]
    sight = [line(61, 40, 82, 28, .8, .45)]
    return layer(-4, *sight, *horizon) + layer(0, *string, *card, *teeth) + layer(5, *pol_star)


def triode():
    env = [path("M32 90 L32 48 Q32 10 50 10 Q68 10 68 48 L68 90", 1.8), line(32, 90, 68, 90, 1.8), path("M46 10 L50 4 L54 10", 1.0, .6)]
    plate = [rect(40, 16, 20, 22, 1.4), line(40, 27, 60, 27, .9, .5), line(50, 16, 50, 6, 1.0)]
    grid = [path("M38 48 l6 -3 l-6 -3 l6 -3 l-6 -3 l6 -3", 1.1, .8), path("M62 48 l-6 -3 l6 -3 l-6 -3 l6 -3 l-6 -3", 1.1, .8), line(38, 48, 62, 48, .8, .5)]
    fil = [path("M44 74 L44 56 Q50 52 56 56 L56 74", 1.4), line(44, 74, 44, 90, 1.2), line(56, 74, 56, 90, 1.2)]
    base = [rect(30, 90, 40, 6, 1.6)] + [line(36 + i * 7, 96, 36 + i * 7, 99, 1.2) for i in range(4)]
    glow = [circle(50, 62, 8, .9, .35), circle(50, 62, 12, .8, .25)]
    gridlead = [line(38, 36, 26, 36, 1.0, .7), line(26, 36, 26, 42, 1.0, .7)]
    return layer(-4, *glow) + layer(0, *env, *base, *plate) + layer(4, *grid, *fil, *gridlead)


def theodolite():
    legs = [line(50, 58, 22, 94, 2.0), line(50, 58, 78, 94, 2.0), line(50, 58, 50, 94, 1.6, .7), line(30, 80, 70, 80, 1.0, .45)]
    base = [rect(36, 52, 28, 8, 1.6), ellipse(50, 52, 16, 3, 1.0, .6)]
    circle_h = [ellipse(50, 48, 18, 4.5, 1.2), ticks(50, 48, 0, 0, 0, 0, 1, 1)] if False else [ellipse(50, 48, 18, 4.5, 1.2)]
    stand = [line(40, 48, 38, 24, 1.8), line(60, 48, 62, 24, 1.8)]
    scope = [rect(36, 14, 34, 10, 1.8), line(70, 17, 84, 15, 1.4), line(70, 21, 84, 23, 1.4), line(84, 15, 84, 23, 1.4), circle(36, 19, 3, 1.4), circle(36, 19, 1, 1.0, fill=True)]
    vcircle = [circle(62, 34, 8, 1.2, .8), ticks(62, 34, 6, 8, 0, 360, 24, .8, .6)]
    sight = [line(84, 19, 98, 14, .9, .45)]
    return layer(-4, *sight, *legs) + layer(0, *base, *circle_h, *stand) + layer(4, *scope, *vcircle)


def orrery():
    sun = [circle(50, 54, 6, 1.6), circle(50, 54, 2.4, 1.0, fill=True), spokes(50, 54, 7.5, 10, 8, 0, 1.0, .75)]
    orbits = [circle(50, 54, 16, .9, .4), circle(50, 54, 26, .9, .4), circle(50, 54, 36, .9, .4)]
    planets = [circle(*pol(50, 54, 16, 215), 2.4, 1.3), circle(*pol(50, 54, 26, 320), 3.4, 1.4), circle(*pol(50, 54, 36, 80), 4, 1.4),
               circle(*pol(*pol(50, 54, 36, 80), 8, 20), 1.4, 1.0)]
    arms = [line(50, 54, *pol(50, 54, 16, 215), 1.0, .6), line(50, 54, *pol(50, 54, 26, 320), 1.0, .6), line(50, 54, *pol(50, 54, 36, 80), 1.0, .6)]
    stand = [line(50, 60, 50, 84, 2.0), ellipse(50, 90, 26, 4, 1.8), gear(50, 76, 6, 8, 12, 1.0, .65)]
    return layer(-5, *orbits) + layer(0, *stand, *arms) + layer(4, *sun, *planets)


def pantograph():
    pivot = [circle(14, 80, 3.4, 1.6), circle(14, 80, 1, 1.0, fill=True), rect(6, 86, 16, 5, 1.4)]
    a1 = [line(14, 80, 38, 56, 1.8), line(14, 80, 36, 60, .8, .4)]
    a2 = [line(38, 56, 62, 32, 1.8), line(62, 32, 86, 8, 1.8)]
    b1 = [line(38, 56, 62, 80, 1.8), line(62, 80, 86, 56, 1.8), line(62, 32, 86, 56, 1.8)]
    joints = [circle(*p, 2.2, 1.3) for p in [(38, 56), (62, 32), (62, 80), (86, 56)]]
    pointer = [line(62, 80, 66, 90, 1.4), circle(66, 91, 1.2, 1.0, fill=True)]
    pen = [line(86, 8, 90, 4, 1.4), circle(91, 3, 1.2, 1.0, fill=True)]
    shapes = [path("M58 92 q6 -8 12 0 q-6 4 -12 0", 1.0, .55), path("M82 14 q4 -6 8 0 q-4 2 -8 0", 1.0, .55)]
    return layer(-4, *shapes) + layer(0, *pivot, *a1, *a2, *b1) + layer(4, *joints, *pointer, *pen)


def kaleidoscope():
    tube = [poly([(8, 38), (84, 30), (84, 66), (8, 58)], 1.8, closed=True), line(8, 48, 84, 48, .9, .4)]
    ends = [ellipse(84, 48, 4, 18, 1.6), ellipse(8, 48, 3, 10, 1.4), ellipse(8, 48, 1.4, 4, 1.0, .6)]
    mirrors = [line(14, 44, 78, 40, 1.0, .65), line(14, 52, 78, 56, 1.0, .65), line(14, 48, 78, 48, 1.0, .5)]
    bits = [circle(24, 48, 1.4, .9, .5), circle(36, 46, 1.0, .9, .5), circle(30, 51, 1.2, .9, .5), circle(44, 50, 1.0, .9, .5)]
    star = []
    for k in range(6):
        a = k * 60 + 15
        star.append(line(*pol(88, 82, 4, a), *pol(88, 82, 10, a), 1.2))
        star.append(circle(*pol(88, 82, 12, a + 30), 1.2, .9))
    star.append(circle(88, 82, 3, 1.2))
    return layer(-4, *mirrors, *bits) + layer(0, *tube, *ends) + layer(5, *star)


def phenakistiscope():
    disc = [circle(50, 50, 40, 1.8), circle(50, 50, 6, 1.4), circle(50, 50, 2, 1.0, fill=True)]
    slits = [rect(48.6, 10, 2.8, 8, 1.1) for _ in range(1)]
    slits = []
    for k in range(12):
        x0, y0 = pol(50, 50, 33, k * 30)
        x1, y1 = pol(50, 50, 39, k * 30)
        slits.append(line(x0, y0, x1, y1, 2.4))
    figs = []
    for k in range(12):
        x, y = pol(50, 50, 22, k * 30 + 15)
        figs.append(circle(x, y, 1.6, 1.0, .85))
        figs.append(line(x, y + 1.6, *pol(x, y + 1.6, 4, 90 + (k % 3 - 1) * 28), .9, .7))
    handle = [line(50, 56, 50, 92, 2.0), rect(46, 88, 8, 6, 1.4)]
    mirror = [path("M92 30 L92 76", 1.4, .5), path("M95 32 L95 74", .9, .3)]
    return layer(-4, *mirror) + layer(0, *disc, *handle) + layer(4, *slits, *figs)


def thaumatrope():
    disc = [circle(50, 42, 24, 1.8), circle(50, 42, 21.5, 1.0, .5)]
    bird = [path("M40 40 q6 -8 12 -2 q6 -6 10 2 q-8 2 -10 8 q-4 -6 -12 -8", 1.2, .85)]
    cage = [line(40, 54, 60, 54, 1.0, .6)] + [line(42 + i * 4, 28, 42 + i * 4, 56, .8, .6) for i in range(5)]
    cord1 = [line(26, 42, 6, 42, 1.4), circle(6, 42, 1.6, 1.0)]
    cord2 = [line(74, 42, 94, 42, 1.4), circle(94, 42, 1.6, 1.0)]
    spin = [path("M30 14 q20 -10 40 0", 1.0, .45), path("M28 72 q22 10 44 0", 1.0, .45)]
    fingers = [path("M4 50 q-4 8 4 14 q6 2 8 -4", 1.2, .55), path("M96 50 q4 8 -4 14 q-6 2 -8 -4", 1.2, .55)]
    return layer(-4, *spin, *fingers) + layer(0, *disc, *cord1, *cord2) + layer(4, *bird, *cage)


def crt():
    env = [path("M36 40 L8 52 L8 64 L36 72", 1.8), path("M36 40 Q40 16 62 14 L92 14 Q96 14 96 18 L96 94 Q96 98 92 98 L62 98 Q40 96 36 72", 1.8)]
    screen = [rect(70, 22, 22, 68, 1.4, .8), line(72, 36, 90, 36, .8, .5), line(72, 54, 90, 54, .8, .5), line(72, 72, 90, 72, .8, .5)]
    gun = [rect(8, 54, 14, 6, 1.4), line(22, 57, 36, 57, 1.4), circle(10, 57, 1.4, 1.0, fill=True)]
    beam = [line(36, 57, 70, 44, 1.0, .75), line(36, 57, 70, 70, .9, .35)]
    coils = [rect(40, 46, 8, 22, 1.4), rect(48, 44, 8, 26, 1.4)] + [line(42, 48 + i * 4, 46, 48 + i * 4, .8, .6) for i in range(5)]
    spot = [circle(70, 44, 1.6, 1.0, fill=True)]
    return layer(-4, *beam) + layer(0, *env, *gun, *screen) + layer(4, *coils, *spot)


def hair_hygrometer():
    frame = [rect(8, 8, 84, 84, 1.8), rect(12, 12, 76, 76, 1.0, .5)]
    scale = [arc(50, 70, 36, 210, 330, 1.2, .8), ticks(50, 70, 30, 36, 210, 330, 20, 1.0, .75)]
    needle = [line(50, 70, *pol(50, 70, 30, 255), 1.6), circle(50, 70, 2.4, 1.4)]
    hair = [path("M50 14 q3 10 -1 20 t1 22", 1.0, .75), line(50, 14, 50, 10, 1.0)]
    weight = [circle(50, 62, 3, 1.4), line(50, 59, 50, 56, .9, .7)]
    lever = [line(50, 64, 50, 70, 1.0, .6)]
    drops = [path("M26 24 q-3 5 0 7 q3 -2 0 -7", 1.0, .6), path("M74 24 q-3 5 0 7 q3 -2 0 -7", 1.0, .6)]
    return layer(-4, *drops) + layer(0, *frame, *scale) + layer(4, *hair, *weight, *lever, *needle)


def seismoscope():
    jar = [path("M24 34 Q24 26 50 26 Q76 26 76 34 L80 70 Q80 82 50 82 Q20 82 20 70 Z", 1.8), ellipse(50, 26, 26, 4, 1.4), path("M26 40 Q50 46 74 40", 1.0, .6)]
    lid = [path("M28 24 Q50 4 72 24", 1.6), circle(50, 10, 2.2, 1.2), line(50, 12, 50, 26, 1.0, .6)]
    dragons = []
    for k in range(8):
        a = 180 + k * 22.5 - 11
        x, y = pol(50, 50, 30, a) if False else (14 + k * 10.2, 36 + (abs(k - 3.5) * -0.2))
        dragons.append(line(x, 36, x + (-3 if k < 4 else 3), 44, 1.1, .85))
        dragons.append(circle(x + (-3 if k < 4 else 3), 46, 1.4, .9, .8))
    toads = [ellipse(24, 90, 8, 4, 1.4), circle(20, 86, 1.2, 1.0), circle(28, 86, 1.2, 1.0), ellipse(50, 92, 8, 3.6, 1.4), ellipse(76, 90, 8, 4, 1.4)]
    column = [line(50, 30, 50, 66, 1.4, .6), circle(50, 66, 3, 1.2, .6)]
    waves = [path("M4 96 q6 -3 12 0 t12 0 t12 0", 1.0, .4)]
    return layer(-4, *waves, *column) + layer(0, *jar, *lid, *toads) + layer(4, *dragons)


def diving_bell():
    bell = [path("M26 34 Q26 12 50 12 Q74 12 74 34 L78 56 L22 56 Z", 1.8), line(22, 56, 78, 56, 1.6), line(50, 12, 50, 4, 1.4), circle(50, 3, 2, 1.2)]
    ring = [circle(50, 24, 5, 1.2, .8), circle(36, 30, 2.4, 1.0, .7), circle(64, 30, 2.4, 1.0, .7)]
    water = [path("M4 50 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0", 1.2, .6), path("M4 72 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0", 1.0, .35)]
    barrel = [path("M70 80 q-4 4 0 12 L84 92 q4 -4 0 -12 Z", 1.4), line(70, 86, 84, 86, .8, .5), path("M77 80 L77 66 L77 58", .9, .5)]
    diver = [circle(42, 48, 3, 1.2), line(42, 51, 42, 64, 1.2), line(42, 55, 36, 62, 1.0), line(42, 55, 48, 62, 1.0), line(42, 64, 38, 74, 1.0), line(42, 64, 46, 74, 1.0)]
    air = [circle(36, 40, 1, .8, .5), circle(60, 44, 1.2, .8, .5), circle(54, 38, 1.0, .8, .5)]
    ropes = [path("M50 4 q10 -3 22 -2", 1.0, .5)]
    return layer(-4, *water, *air, *ropes) + layer(0, *bell, *barrel) + layer(4, *ring, *diver)


def davy_lamp():
    base = [path("M30 90 L30 66 Q30 60 38 60 L62 60 Q70 60 70 66 L70 90", 1.8), line(30, 90, 70, 90, 1.8), line(30, 74, 70, 74, 1.0, .55)]
    gauze = [rect(34, 24, 32, 36, 1.4)] + [line(36 + i * 4, 24, 36 + i * 4, 60, .8, .55) for i in range(7)] + [line(34, 28 + i * 5, 66, 28 + i * 5, .8, .5) for i in range(7)]
    cap = [path("M32 24 Q50 8 68 24", 1.8), line(32, 24, 68, 24, 1.4), circle(50, 8, 2.4, 1.4), path("M44 8 Q50 -2 56 8", 1.2, .7)]
    flame = [path("M50 54 Q42 44 50 34 Q58 44 50 54", 1.4), path("M50 52 Q46 46 50 42 Q54 46 50 52", 1.0, .6)]
    wick = [line(50, 54, 50, 60, 1.0, .6)]
    hook = [path("M70 70 q10 0 10 10 q0 8 -8 8", 1.4)]
    return layer(-4, *hook, *wick) + layer(0, *base, *cap) + layer(4, *gauze, *flame)


ITEMS = [
    dict(id="exp28_cup_anemometer", n="Cup Anemometer", era="industry", cat="science", ds=1845, rar="uncommon",
         date="J. T. R. Robinson, 1845 (Armagh Observatory); improved 1846", vis="cup-wheel", topic="meteorology_exp28",
         region="Ireland (Armagh Observatory)", artifactType="meteorological instrument", material="metal", physical=True, durable=True,
         l1="Four hollow cups on a spinning cross that count wind speed by how fast they turn.",
         l2="Wind pushes the open side of a cup harder than the back of the cup opposite, so the cross spins. The rotation rate is roughly proportional to wind speed, so counting turns gives speed.",
         l3="The page credits Rev. John Thomas Romney Robinson of Armagh with a four-cup design in 1845, improved in 1846. John Patterson's 1926 three-cup design gave steadier torque and quicker gust response; in 1935 Brevoort and Joiner's cups gave a nearly linear response with under 3% error up to 60 mph.",
         ev="Robinson's four-cup anemometer (1845/1846)", first_known="1845",
         confidence=dict(level="established", note="Page gives 1845 for the invention and 1846 for Robinson's improvement; the earlier plate anemometer is Alberti, 1450."),
         srcs=[wp("anemometer_wp", "Anemometer", "Robinson four-cup anemometer 1845/1846; Alberti plate anemometer 1450; Patterson three-cup 1926; Brevoort and Joiner 1935.")],
         pool=['measurement', 'physics', 'observation', 'wheel', 'mechanism', 'iron', 'copper', 'experiment'], must=['measurement'], nrec=2,
         tags=["meteorology", "measurement"], regions=["europe"], art=cup_anemometer()),
    dict(id="exp28_camera_lucida", n="Camera Lucida", era="science", cat="technology", ds=1806, rar="uncommon",
         date="Patented by W. H. Wollaston, 1806", vis="drawing-prism", topic="optics_exp28",
         region="England (William Hyde Wollaston)", artifactType="drawing aid", material="glass prism and brass", physical=True, durable=True,
         l1="A glass prism on a stand that lets an artist see the scene lying on the drawing paper and trace it.",
         l2="A prism with four optical faces gives two total internal reflections. The eye sees the scene superimposed on the paper, upright and not reversed, so key points can be traced by pencil.",
         l3="Wollaston patented it in 1806. Kepler described the optics in Dioptrice (1611) but there is no evidence he built a working one; the page also says Arthur Gregory's 1596 'perspective box' likely worked on similar principles and was lost.",
         ev="Wollaston's patent of 1806", first_known="1806",
         confidence=dict(level="established", note="Patent year; earlier optics by Kepler (1611) were not built, per the page."),
         srcs=[wp("lucida_wp", "Camera_lucida", "Wollaston patented the camera lucida in 1806; prism with four optical faces and two total internal reflections; Kepler 1611 described optics; Gregory 1596 perspective box.")],
         pool=['glass', 'optics', 'lens', 'geometry', 'observation', 'copper', 'iron', 'paper', 'mathematics', 'maps', 'experiment', 'astronomy', 'writing', 'mirror', 'brass', 'steel'], must=[], nrec=2,
         tags=["optics", "drawing"], regions=["europe"], art=camera_lucida()),
    dict(id="exp28_galvanometer", n="Schweigger Multiplier Galvanometer", era="electric", cat="science", ds=1820, rar="uncommon",
         date="Reported by Johann Schweigger, 16 September 1820", vis="coil-needle", topic="electrical_instruments_exp28",
         region="Halle, Germany (Johann Schweigger); Denmark (Ørsted)", artifactType="measuring instrument", material="wire and magnetised needle", physical=True, durable=True,
         l1="A magnetic needle inside a coil of wire that swings when current flows.",
         l2="A current through a wire deflects a compass needle; winding the wire into many turns multiplies the effect. That is why early galvanometers were called multipliers.",
         l3="Ørsted noticed the deflection in 1820; Johann Schweigger reported the earliest galvanometer on 16 September 1820 at Halle. Nobili's astatic galvanometer (1825) used two opposed needles to cancel the Earth's field; Kelvin patented a mirror galvanometer in 1858; d'Arsonval and Deprez developed the moving-coil type in 1882.",
         ev="Schweigger (1820); Nobili (1825); Kelvin (1858); d'Arsonval and Deprez (1882)", first_known="1820",
         confidence=dict(level="established", note="Ørsted's discovery is the basis but he did not build a galvanometer, per the page."),
         srcs=[wp("galvo_wp", "Galvanometer", "Schweigger reported the earliest galvanometer 16 Sep 1820; Ørsted 1820; Nobili astatic 1825; Kelvin 1858; d'Arsonval and Deprez 1882; coil multiplies deflection.")],
         pool=['electricity', 'copper', 'compass', 'measurement', 'physics', 'experiment', 'iron'], must=['electricity', 'compass'], nrec=2,
         tags=["electricity", "measurement"], regions=["europe"], art=galvanometer()),
    dict(id="exp28_kamal", n="Kamal", era="science", cat="technology", ds=890, rar="uncommon",
         date="Arab navigators, late 9th century; Indian Ocean use from the 10th century", vis="knotted-latitude-card", topic="navigation_exp28",
         region="Arabian Sea and Indian Ocean", artifactType="navigation instrument", material="wood and cord", physical=True, durable=False,
         l1="A small wooden card on a knotted string that reads the height of the pole star to give latitude.",
         l2="Hold one end of the string in the teeth and slide the card so its lower edge touches the horizon and its upper edge hides Polaris. Count the knots to the card, or use the knot tied for a known port's latitude.",
         l3="The page dates it to Arab navigators of the late 9th century, used in the Indian Ocean from the 10th, then adopted by Indian navigators soon after and by Chinese navigators before the 16th century. It gives no single year or first written record.",
         ev="Arab navigation texts as summarised on the page", first_known="late 9th century",
         confidence=dict(level="debated", note="Page gives a century, not a year; no first written record is named."),
         srcs=[wp("kamal_wp", "Kamal_(navigation)", "Late 9th-century origin among Arab navigators; Indian Ocean use from the 10th century; wooden card on a knotted string held in the teeth to read Polaris altitude.")],
         pool=['navigation', 'astronomy', 'cordage', 'wood', 'observation', 'measurement', 'cloth'], must=['navigation'], nrec=2,
         tags=["navigation", "astronomy"], regions=["africa_asia"], art=kamal()),
    dict(id="exp28_triode_audion", n="Triode Audion Tube", era="electric", cat="technology", ds=1907, rar="rare",
         date="De Forest, patent filed 29 January 1907 (issued 18 February 1908)", vis="grid-tube", topic="electronics_exp28",
         region="United States (Lee de Forest); Austria (Robert von Lieben)", artifactType="electron tube", material="glass and metal", physical=True, durable=True,
         l1="A glass bulb with a heated filament, a grid and a plate, where a tiny grid voltage steers a large current.",
         l2="The grid sits between filament and plate. Because it is close to the filament, a small change in grid voltage changes the plate current more than the plate voltage can. That made the first practical electronic amplifier.",
         l3="Fleming invented the diode in 1904; de Forest patented the grid design on 29 January 1907 (issued 18 February 1908), and Robert von Lieben independently patented a three-element tube in March 1906. William Eccles coined the name triode around 1920. Transistors replaced it from the 1960s.",
         ev="De Forest's 1907 patent; Fleming (1904)", first_known="1906–1907",
         confidence=dict(level="established", note="Independent invention by von Lieben (March 1906) is stated on the page."),
         srcs=[wp("triode_wp", "Triode", "De Forest grid patent filed 29 Jan 1907, issued 18 Feb 1908; von Lieben March 1906; Fleming diode 1904; grid controls plate current; amplifier for radio and telephony.")],
         pool=['electricity', 'glass', 'physics', 'copper', 'experiment', 'iron', 'chemistry', 'telegraph'], must=['electricity', 'glass'], nrec=2,
         tags=["electronics", "amplifier"], regions=["americas", "europe"], tradeImportance="high", art=triode()),
    dict(id="exp28_theodolite", n="Great Theodolite", era="science", cat="technology", ds=1787, rar="rare",
         date="Ramsden's great theodolite, 1787; word first attested in Digges' Pantometria, 1571", vis="angle-telescope", topic="surveying_exp28",
         region="England (Jesse Ramsden; Leonard Digges)", artifactType="surveying instrument", material="brass and glass", physical=True, durable=True,
         l1="A telescope that turns on two circles so a surveyor can read horizontal and vertical angles.",
         l2="Sight a first point, then other points from the same place; the angle readings relate them to one another. A precise dividing engine marks the circles finely enough for survey triangulation.",
         l3="The earliest known use of the word is in Leonard Digges's Pantometria (1571), for an instrument measuring horizontal angles only. The page says the theodolite became a modern, accurate instrument in 1787 with Jesse Ramsden's great theodolite, built with his dividing engine and used for the Principal Triangulation of Great Britain.",
         ev="Ramsden's great theodolite (1787)", first_known="1571 (word) / 1787 (precision form)",
         confidence=dict(level="established", note="The word's origin is unknown; Digges is only the earliest known use."),
         srcs=[wp("theodolite_wp", "Theodolite", "Earliest known use of the word in Digges' Pantometria 1571; Ramsden's great theodolite 1787 built with his dividing engine; used for the Principal Triangulation of Great Britain.")],
         pool=['measurement', 'geometry', 'lens', 'maps', 'optics', 'astronomy', 'copper', 'machine_tools'], must=['measurement', 'geometry'], nrec=2,
         tags=["surveying", "measurement"], regions=["europe"], art=theodolite()),
    dict(id="exp28_orrery", n="Orrery", era="science", cat="knowledge", ds=1710, rar="uncommon",
         date="Graham and Tompion c. 1710; Rowley's version c. 1712; named by 1714", vis="planet-arms", topic="astronomy_exp28",
         region="England (George Graham, John Rowley)", artifactType="model of the solar system", material="brass and wood", physical=True, durable=True,
         l1="A clockwork model that carries small planets round a sun on arms of gears.",
         l2="A gear train sets each planet's arm turning at its own rate round a central sun. Turn the handle and the whole solar system moves in step.",
         l3="The page puts George Graham and Thomas Tompion's orrery at c. 1710 and John Rowley's improved device at c. 1712; the name honours Rowley's patron Charles Boyle, 4th Earl of Orrery, and has existed since 1714. Earlier planetary mechanisms: the Antikythera mechanism (205–87 BC), Giovanni Dondi (1348), and Eise Eisinga's planetarium (1774–1781).",
         ev="Rowley's orrery (c. 1712)", first_known="c. 1700–1712",
         confidence=dict(level="debated", note="Plaque credits Graham with 1700; the page says the claim that Steele coined the name is spurious."),
         srcs=[wp("orrery_wp", "Orrery", "Graham and Tompion c. 1710; Rowley c. 1712; named for the 4th Earl of Orrery, term used since 1714; Dondi 1348; Antikythera mechanism 205–87 BC; Eisinga 1774–1781.")],
         pool=['gear', 'astronomy', 'mechanism', 'clock', 'copper', 'mathematics', 'wood', 'iron'], must=['astronomy', 'gear'], nrec=2,
         tags=["astronomy", "mechanism"], regions=["europe"], art=orrery()),
    dict(id="exp28_pantograph", n="Pantograph", era="science", cat="technology", ds=1603, rar="uncommon",
         date="Scheiner used one in 1603; Pantographice, Rome, 1631", vis="parallelogram-linkage", topic="drawing_exp28",
         region="Rome (Christoph Scheiner); Alexandria (Hero, described pantographs)", artifactType="copying linkage", material="wood or brass", physical=True, durable=True,
         l1="A jointed parallelogram linkage: trace a drawing with one arm and a pen on another copies it larger or smaller.",
         l2="One arm holds a pointer that traces the original; another holds a pen. Moving the pivots changes the scale, so the copy can be enlarged, reduced or the same size.",
         l3="The page says Hero of Alexandria described pantographs in his Mechanics, and that Christoph Scheiner used one in 1603 to copy and scale diagrams, writing about it in Pantographice (Rome, 1631). It lists three-dimensional versions (Cheverton, 1836), coin-relief reduction, and duplicating phonograph discs in the 1890s.",
         ev="Scheiner, Pantographice (1631)", first_known="1603",
         confidence=dict(level="established", note="Page does not credit Scheiner with the invention itself; Hero's pantographs are older."),
         srcs=[wp("pantograph_wp", "Pantograph", "Hero described pantographs in Mechanics; Scheiner used one in 1603 and wrote Pantographice, Rome 1631; parallelogram linkage; Cheverton 1836; coin reduction.")],
         pool=['geometry', 'lever', 'wood', 'measurement', 'mechanism', 'copper', 'maps', 'writing'], must=['geometry', 'lever'], nrec=2,
         tags=["drawing", "mechanism"], regions=["europe"], art=pantograph()),
    dict(id="exp28_kaleidoscope", n="Kaleidoscope", era="industry", cat="media", ds=1815, rar="uncommon",
         date="Brewster's key observation February 1815; British patent no. 4136 granted July 1817", vis="mirror-tube", topic="optics_exp28",
         region="Scotland (David Brewster)", artifactType="optical toy", material="tube, mirrors and glass", physical=True, durable=False,
         l1="A tube whose tilted mirrors turn a few coloured scraps into symmetrical patterns.",
         l2="Two or more mirrors set at an angle reflect objects at one end repeatedly, so the viewer at the other end sees a symmetric pattern. Brewster's patent favoured angles of 18°, 20° or 22.5°; his 1819 treatise used 45°, 36° and 30°.",
         l3="Brewster first noted the circular arrangement of candle images in 1814 and saw the stronger effect in February 1815; patent no. 4136 was granted in July 1817 and his Treatise on the Kaleidoscope followed in 1819. The page says the optimal configuration was not recorded before 1815, though Della Porta, Kircher (1646) and Bradley (1717) described multiple reflections.",
         ev="Brewster, Treatise on the Kaleidoscope (1819)", first_known="1815",
         confidence=dict(level="established", note="Page mentions no 1816; it gives 1815 for the observation and July 1817 for the patent."),
         srcs=[wp("kaleido_wp", "Kaleidoscope", "Brewster noted the effect 1814, observed it Feb 1815, patent no. 4136 July 1817, Treatise 1819; mirrors at an angle make symmetric patterns; Kircher 1646, Bradley 1717.")],
         pool=['glass', 'optics', 'observation', 'experiment', 'lens', 'paper', 'iron', 'copper'], must=['optics'], nrec=2,
         tags=["optics", "toy"], regions=["europe"], art=kaleidoscope()),
    dict(id="exp28_phenakistiscope", n="Phenakistiscope", era="industry", cat="media", ds=1832, rar="uncommon",
         date="Plateau, Nov–Dec 1832 (published 20 Jan 1833); Stampfer's Austrian patent 7 May 1833", vis="slit-disc", topic="optics_exp28",
         region="Belgium (Joseph Plateau); Austria (Simon Stampfer)", artifactType="optical toy", material="card", physical=True, durable=False,
         l1="A spinning card disc of pictures that you watch in a mirror through slits to see movement.",
         l2="A handle-held disc has pictures around its centre and slits round the rim. Spun in front of a mirror and viewed through the slits, each picture is replaced by the next, so the sequence appears as motion. Narrower slits give a sharper but darker image.",
         l3="Plateau built a working model in November or December 1832 and published it in a letter dated 20 January 1833. Stampfer developed 'stroboscopic discs' after reading of Faraday's findings in December 1832; he and Trentsensky received an Austrian patent on 7 May 1833.",
         ev="Plateau's letter of 20 January 1833; Stampfer's patent of 1833", first_known="1832",
         confidence=dict(level="established", note="Near-simultaneous invention by two people, per the page."),
         srcs=[wp("phena_wp", "Phenakistiscope", "Plateau Nov/Dec 1832, letter 20 Jan 1833; Stampfer patent 7 May 1833; card disc with pictures and slits viewed in a mirror.")],
         pool=['optics', 'paper', 'wheel', 'observation', 'mechanism', 'experiment', 'glass'], must=['optics', 'paper'], nrec=2,
         tags=["optics", "animation_ancestor"], regions=["europe"], art=phenakistiscope()),
    dict(id="exp28_thaumatrope", n="Thaumatrope", era="industry", cat="media", ds=1825, rar="common",
         date="First commercial thaumatrope registered 2 April 1825 (London); described by J. A. Paris, 1827", vis="two-sided-disc", topic="optics_exp28",
         region="London (John Ayrton Paris, W. H. Fitton)", artifactType="optical toy", material="card and string", physical=True, durable=False,
         l1="A card with a bird on one side and a cage on the other: spin it on strings and the bird sits in the cage.",
         l2="Twirling the strings flips the disc so fast that the two pictures seem to merge, because each impression lingers in the mind for about an eighth of a second.",
         l3="Usually credited to John Ayrton Paris, who described it in Philosophy in Sport made Science in Earnest (1827), though Charles Babbage recalled in 1864 that William Henry Fitton invented it. The page says the first commercial thaumatrope was registered on 2 April 1825 and published by W. Phillips in London; persistence of vision as an explanation is disputed.",
         ev="Paris (1827); W. Phillips registration (1825)", first_known="1825",
         confidence=dict(level="debated", note="Attribution to Paris or Fitton is disputed; the page gives no 1824 date."),
         srcs=[wp("thaum_wp", "Thaumatrope", "Credited to Paris, 1827; Babbage's 1864 recollection credits Fitton; first commercial thaumatrope registered 2 April 1825 by W. Phillips; persistence of vision about one-eighth second.")],
         pool=['paper', 'cordage', 'optics', 'observation', 'experiment', 'fiber', 'cloth'], must=['paper'], nrec=2,
         tags=["optics", "toy"], regions=["europe"], art=thaumatrope()),
    dict(id="exp28_cathode_ray_tube", n="Braun Cathode-Ray Tube", era="electric", cat="technology", ds=1897, rar="rare",
         date="Ferdinand Braun, 1897", vis="electron-gun-screen", topic="electronics_exp28",
         region="Strasbourg, Germany (Ferdinand Braun)", artifactType="display tube", material="glass and phosphor", physical=True, durable=True,
         l1="A glass funnel in which a steered beam of electrons draws light on a glowing screen.",
         l2="A heated cathode emits electrons that are focused and accelerated toward a phosphor-coated screen, which glows where struck. Deflection coils steer the beam across the screen in a fixed scanning pattern called a raster.",
         l3="Braun's 1897 tube was a cold-cathode diode with a phosphor screen, and he was the first to propose a CRT as a display. Schuster and Crookes showed rays deflect in electric and magnetic fields in 1890; J. J. Thomson measured the rays' mass-to-charge ratio in 1897; Zworykin named it the CRT in 1929.",
         ev="Braun tube (1897)", first_known="1897",
         confidence=dict(level="established", note="The page does not mention Geissler; Plücker and Hittorf are named for cathode rays, with no year."),
         srcs=[wp("crt_wp", "Cathode-ray_tube", "Braun invented the Braun tube in 1897, cold-cathode diode with phosphor screen; Schuster and Crookes 1890; J. J. Thomson 1897; Zworykin named CRT 1929; deflection coils and raster.")],
         pool=['electricity', 'glass', 'physics', 'experiment', 'copper', 'chemistry', 'iron', 'optics'], must=['electricity', 'glass'], nrec=2,
         tags=["electronics", "display"], regions=["europe"], art=crt()),
    dict(id="exp28_hair_hygrometer", n="Saussure Hair Hygrometer", era="science", cat="science", ds=1783, rar="uncommon",
         date="Horace Bénédict de Saussure, 1783", vis="hair-and-dial", topic="meteorology_exp28",
         region="Geneva (Horace Bénédict de Saussure)", artifactType="meteorological instrument", material="human hair and brass", physical=True, durable=False,
         l1="A stretched human hair that lengthens in damp air and moves a needle over a dial.",
         l2="Human hair expands when the air is damp and shrinks when dry. A weight keeps the hair taut and a pointer shows the change on a scale.",
         l3="The page lists Leonardo da Vinci's prototype (1480), Francesco Folli's practical version in the 1600s (no year given), Lambert's more modern version (1755), and Saussure's first hair hygrometer in 1783. The Assmann wet-and-dry-bulb psychrometer of the late 1800s was among the most precise.",
         ev="Saussure's hair hygrometer (1783)", first_known="1783",
         confidence=dict(level="established", note="Page gives no 1664 date for Folli and no Daniell hygrometer."),
         srcs=[wp("hygro_wp", "Hygrometer", "Leonardo prototype 1480; Folli in the 1600s; Lambert 1755; Saussure first hair hygrometer 1783; Assmann psychrometer late 1800s.")],
         pool=['measurement', 'physics', 'observation', 'fiber', 'copper', 'experiment', 'mechanism'], must=['measurement'], nrec=2,
         tags=["meteorology", "measurement"], regions=["europe"], art=hair_hygrometer()),
    dict(id="exp28_zhang_heng_seismoscope", n="Zhang Heng Seismoscope", era="science", cat="science", ds=132, rar="rare",
         date="AD 132 (Han dynasty, Zhang Heng)", vis="dragon-urn", topic="seismology_exp28",
         region="Luoyang, Han China (Zhang Heng)", artifactType="seismoscope", material="bronze", physical=True, durable=True,
         l1="A bronze urn ringed by eight dragon heads, each holding a ball that drops into a toad when the ground shakes.",
         l2="The History of the Later Han Dynasty describes a bronze vessel about 2 m across with eight dragon heads holding balls. In an earthquake one mouth opened and dropped its ball into a bronze toad, its position showing the direction. A central column moving on eight tracks is thought to have been a pendulum.",
         l3="Zhang Heng is said to have invented it in AD 132. A first recorded quake was confirmed by a rider days later; about AD 143 it signalled a quake that was not felt. It shows that shaking occurred rather than recording it, so it is a seismoscope. How the pendulum opened only one mouth is not known.",
         ev="History of the Later Han Dynasty (description)", first_known="AD 132",
         confidence=dict(level="debated", note="The page hedges ('is said to have invented', 'supposedly'); the internal mechanism is not known."),
         srcs=[wp("seismo_wp", "Seismoscope", "Zhang Heng said to have invented it in AD 132; bronze vessel about 2 m with eight dragons and balls; toad below; pendulum thought; later Cecchi c.1875, Milne 1880, Palmieri 1856.")],
         pool=['bronze', 'casting', 'observation', 'mechanism', 'measurement', 'astronomy', 'metallurgy', 'lever'], must=['bronze'], nrec=2,
         tags=["seismology", "bronze"], regions=["africa_asia"], art=seismoscope()),
    dict(id="exp28_diving_bell", n="Diving Bell", era="science", cat="technology", ds=1691, rar="uncommon",
         date="Aristotle (4th century BC) describes the principle; Halley's plans, 1691; Smeaton, 1789", vis="open-bottom-bell", topic="underwater_exp28",
         region="England (Edmond Halley, John Smeaton)", artifactType="underwater chamber", material="wood and lead", physical=True, durable=True,
         l1="An open-bottomed bell lowered into the sea that keeps a pocket of air for divers.",
         l2="Water pressure traps air in the bell; the bell is ballasted to sink upright even full of air. Because depth compresses the air, fresh air must be supplied to keep its volume constant so water does not fill the bell.",
         l3="Aristotle noted that a lowered cauldron retains air. The page says Halley completed his plans in 1691 (not 1690), replenishing air with weighted barrels sent down from the surface; Papin proposed a force pump in 1689 and Smeaton used the concept in 1789.",
         ev="Halley's design (1691); Smeaton's pump-fed bell (1789)", first_known="4th century BC (principle)",
         confidence=dict(level="established", note="Page gives 1691, not 1690, for Halley's plans."),
         srcs=[wp("divebell_wp", "Diving_bell", "Aristotle describes the principle; Halley plans 1691 with weighted air barrels; Papin 1689 force pump; Smeaton 1789; wet-bell air supply keeps volume constant.")],
         pool=['wood', 'physics', 'experiment', 'engineering', 'lead', 'iron', 'cordage', 'boat', 'measurement'], must=['wood'], nrec=2,
         tags=["underwater", "engineering"], regions=["europe"], art=diving_bell()),
    dict(id="exp28_davy_safety_lamp", n="Davy Safety Lamp", era="industry", cat="technology", ds=1815, rar="uncommon",
         date="Paper to the Royal Society 9 November 1815; first trial at Hebburn Colliery 9 January 1816", vis="gauze-lamp", topic="mining_exp28",
         region="England (Humphry Davy); Killingworth (George Stephenson); Sunderland (W. R. Clanny)", artifactType="safety lamp", material="iron gauze and oil lamp", physical=True, durable=True,
         l1="A miner's oil lamp whose flame sits inside fine wire gauze so it cannot ignite firedamp outside.",
         l2="Air and methane pass through the mesh but the holes are too small for a flame to cross. Firedamp makes the flame taller with a blue tinge, and poor air extinguishes it, which warns the miner.",
         l3="Davy presented his paper on 9 November 1815 and won the Rumford Medal; the wire-sieve version was first tried at Hebburn on 9 January 1816. Clanny's lamp (Royal Society paper, May 1813) was more cumbersome, and George Stephenson's 'Geordie' lamp was shown at Killingworth a month earlier; a House of Commons committee in 1833 found Stephenson had an equal claim.",
         ev="Davy's 1815 paper; Stephenson's Geordie lamp", first_known="1815",
         confidence=dict(level="debated", note="Priority between Davy and Stephenson was disputed; the page records both."),
         srcs=[wp("davy_wp", "Davy_lamp", "Davy paper 9 Nov 1815, Rumford Medal; first trial Hebburn 9 Jan 1816; wire gauze stops flame; Clanny May 1813; Stephenson Geordie lamp; 1833 committee equal claim.")],
         pool=['fire', 'iron', 'chemistry', 'experiment', 'metallurgy', 'observation', 'steel', 'copper', 'cloth'], must=['fire', 'iron'], nrec=2,
         tags=["mining", "safety"], regions=["europe"], art=davy_lamp()),
]
