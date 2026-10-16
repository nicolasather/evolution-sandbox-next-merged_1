"""EXP28 batch 07 — textile, woodworking, metallurgy, medicine, waterways, harness, springs.
Facts only from pages fetched 2026-10-16."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def fulling_mill():
    wheel = [circle(18, 52, 16, 1.8), spokes(18, 52, 3, 14, 8, 0, 1.2, .85), circle(18, 52, 3, 1.4)] + [line(*pol(18, 52, 16, k * 30), *pol(18, 52, 21, k * 30), 1.6) for k in range(12)]
    shaft = [line(18, 52, 70, 52, 2.0), rect(34, 46, 6, 12, 1.3), rect(52, 46, 6, 12, 1.3)]
    stocks = [poly([(37, 58), (41, 58), (46, 84), (40, 84)], 1.6, closed=True), poly([(55, 58), (59, 58), (64, 84), (58, 84)], 1.6, closed=True)]
    tub = [path("M70 62 Q96 62 96 82 L70 90 Z", 1.8), path("M72 66 Q92 66 92 82", 1.0, .5)]
    cloth = [path("M72 70 q8 -4 14 2 q-6 6 -14 2", 1.0, .65)]
    pivot = [circle(39, 60, 1.8, 1.2), circle(57, 60, 1.8, 1.2)]
    water = [path("M2 78 q6 -4 12 0 t12 0", 1.0, .5), line(14, 70, 18, 78, .9, .5)]
    return layer(-4, *water, *cloth) + layer(0, *shaft, *tub, *wheel) + layer(4, *stocks, *pivot)


def spinning_wheel():
    wheel = [circle(60, 56, 30, 1.8), circle(60, 56, 4, 1.4), spokes(60, 56, 4, 28, 8, 0, 1.3, .85), circle(60, 56, 28, 1.0, .5)]
    frame = [line(60, 56, 60, 92, 1.8), line(46, 92, 74, 92, 1.8), line(60, 56, 20, 40, 1.8), line(20, 40, 20, 24, 1.8)]
    flyer = [circle(20, 24, 4, 1.4), path("M14 20 L26 20 M14 28 L26 28", 1.2), line(8, 24, 14, 24, 1.4), line(26, 24, 36, 18, 1.0, .6)]
    band = [path("M20 20 Q40 6 60 26 M20 28 Q40 44 60 86", .9, .45)]
    treadle = [line(48, 92, 30, 98, 1.4), line(36, 96, 36, 80, 1.0, .5)]
    wool = [path("M2 14 q6 -4 8 2 q4 6 -4 8", 1.0, .55)]
    return layer(-4, *band, *wool) + layer(0, *wheel, *frame) + layer(4, *flyer, *treadle)


def carding_machine():
    cyl = [circle(40, 50, 28, 1.8), circle(40, 50, 4, 1.4)] + [line(*pol(40, 50, 28, k * 15), *pol(40, 50, 33, k * 15), .9, .85) for k in range(24)]
    cards = [circle(40, 50, 24, 1.0, .5)]
    doffer = [circle(82, 50, 12, 1.6), circle(82, 50, 3, 1.2)] + [line(*pol(82, 50, 12, k * 30), *pol(82, 50, 15, k * 30), .9, .8) for k in range(12)]
    frame = [line(8, 90, 94, 90, 1.8), line(14, 90, 14, 78, 1.4), line(86, 90, 86, 72, 1.4)]
    feed = [poly([(2, 36), (14, 40), (14, 48), (2, 46)], 1.2, closed=True), path("M-0 40 q-0 0 0 0", 1.0)] if False else [poly([(2, 36), (12, 40), (12, 48), (2, 46)], 1.2, closed=True)]
    web = [path("M94 46 q4 0 4 8", 1.0, .6), line(94, 50, 98, 56, 1.0, .5)]
    crank = [line(40, 50, 60, 76, .9, .5), circle(60, 78, 2, 1.0)]
    return layer(-4, *crank, *cards) + layer(0, *frame, *cyl, *feed) + layer(4, *doffer, *web)


def bobbin_lace():
    pillow = [path("M10 74 Q10 54 50 52 Q90 54 90 74 Q90 88 50 90 Q10 88 10 74", 1.8), path("M16 72 Q50 62 84 72", 1.0, .5)]
    pins = [circle(30 + i * 8, 62 + (i % 2) * 2, 1.2, .9, fill=True) for i in range(6)]
    thr = [path("M28 8 L34 64", .8, .5), path("M40 8 L44 62", .8, .5), path("M52 8 L52 62", .8, .5), path("M64 8 L60 62", .8, .5), path("M76 8 L68 64", .8, .5)]
    bob = [rect(25 + i * 12, 6 - (i % 2) * 2, 5, 16, 1.0) for i in range(5)] + [circle(27.5 + i * 12, 22 - (i % 2) * 2, 2.2, .9) for i in range(5)]
    lace = [path("M30 62 q6 -8 12 0 t12 0 t12 0", 1.2, .85), path("M32 56 q6 -6 12 0 t12 0 t10 0", 1.0, .6)]
    prick = [rect(22, 54, 56, 14, .9, .35)]
    return layer(-4, *prick) + layer(0, *pillow, *thr) + layer(4, *bob, *pins, *lace)


def brace_bit():
    crank = [path("M20 20 L20 8 Q20 4 24 4 L76 4 Q80 4 80 8 L80 22", 2.2), line(80, 22, 50, 22, 1.8)] if False else [path("M12 18 L12 8 Q12 4 16 4 L72 4 Q76 4 76 8 L76 24", 2.2), path("M76 24 Q76 30 66 30 L50 30", 2.0)]
    handle = [rect(4, 10, 8, 18, 1.4)] if False else [line(14, 4, 14, 22, 1.2), ellipse(10, 14, 6, 10, 1.4)]
    head = [circle(44, 30, 5, 1.4), line(44, 30, 44, 24, 1.6), circle(44, 20, 4, 1.4)]
    chuck = [rect(40, 36, 8, 12, 1.5), line(40, 42, 48, 42, 1.0, .7)]
    bit = [line(44, 48, 44, 92, 1.8), path("M42 58 q2 4 4 0 M42 66 q2 4 4 0 M42 74 q2 4 4 0", 1.0, .8), poly([(41, 92), (47, 92), (44, 98)], 1.2, closed=True)]
    wood = [rect(10, 70, 80, 24, 1.0, .5), path("M12 76 q20 -2 40 2 t36 -2", .8, .35)]
    twist = [path("M82 24 q8 6 0 12", 1.0, .5)]
    return layer(-4, *wood, *twist) + layer(0, *crank, *handle, *head) + layer(4, *chuck, *bit)


def spirit_level():
    body = [rect(6, 38, 88, 22, 1.8), rect(10, 42, 80, 14, 1.0, .5)]
    vial = [path("M34 44 Q50 40 66 44 L66 54 Q50 58 34 54 Z", 1.4), line(46, 42, 46, 56, .9, .65), line(54, 42, 54, 56, .9, .65)]
    bubble = [ellipse(50, 46, 4, 2.2, 1.0), circle(50, 46, 1, .8, fill=True)]
    cap = [rect(2, 34, 6, 30, 1.2, .6), rect(92, 34, 6, 30, 1.2, .6)]
    surf = [line(2, 74, 98, 74, 1.4), line(10, 80, 90, 80, 1.0, .4)]
    hole = [circle(20, 49, 3, 1.0, .7), circle(80, 49, 3, 1.0, .7)]
    ticks_ = [line(6 + i * 4, 60, 6 + i * 4, 64 if i % 2 == 0 else 62, .8, .6) for i in range(22)]
    return layer(-4, *surf) + layer(0, *body, *cap, *ticks_) + layer(4, *vial, *bubble, *hole)


def cupola():
    shell = [path("M32 90 L32 22 L68 22 L68 90", 1.8), path("M36 90 L36 24 L64 24 L64 90", 1.0, .5), rect(28, 90, 44, 6, 1.6)]
    stack = [path("M36 22 Q36 8 50 6 Q64 8 64 22", 1.4), line(50, 6, 50, 2, 1.4)]
    layers_ = [line(37, 32 + i * 8, 63, 32 + i * 8, 1.0, .75) for i in range(5)] + [circle(42 + (i % 3) * 8, 34 + i * 6, 1.3, .9, .6) for i in range(5)]
    tuy = [line(20, 74, 32, 74, 2.0), line(20, 80, 32, 80, 2.0), line(80, 74, 68, 74, 2.0), line(80, 80, 68, 80, 2.0), rect(12, 72, 8, 10, 1.2), rect(80, 72, 8, 10, 1.2)]
    spout = [path("M68 88 L84 90 L88 94", 1.6), path("M72 90 q4 2 8 4", 1.0, .7)]
    door = [rect(40, 14, 20, 4, 1.2), path("M34 22 L34 12 L66 12 L66 22", 1.2, .6)]
    pool = [path("M38 88 Q50 84 62 88", 1.2, .7)]
    return layer(-4, *tuy) + layer(0, *shell, *stack, *door, *spout) + layer(4, *layers_, *pool)


def coke_blast():
    stack = [path("M34 92 L26 52 L34 10 L66 10 L74 52 L66 92 Z", 1.8), path("M38 92 L32 52 L38 14 L62 14 L68 52 L62 92", 1.0, .5)]
    charge = [line(36 + i * 4, 22 + (i % 2) * 2, 36 + i * 4, 24, 1.1, .85) for i in range(7)] + [path("M38 36 q12 4 24 0", 1.0, .65), path("M36 52 q14 4 28 0", 1.0, .65), path("M38 68 q12 4 24 0", 1.0, .6)]
    top = [rect(40, 6, 20, 4, 1.4), path("M44 2 q-2 -2 0 -4", 1.0, .5)]
    tuy = [line(14, 78, 30, 78, 2.0), rect(6, 74, 8, 8, 1.2), path("M14 78 L2 94", 1.0, .5)]
    cast = [path("M68 92 L88 96", 1.6), rect(86, 90, 10, 6, 1.2)] + [line(80, 94 + i * 0, 80, 94, 1.0, .5) for i in range(1)]
    coke = [circle(44, 30, 2, .9, .7), circle(52, 38, 2.4, .9, .7), circle(46, 60, 2, .9, .65), circle(56, 74, 2.2, .9, .65)]
    glow = [circle(50, 82, 8, .9, .3)]
    return layer(-4, *glow) + layer(0, *stack, *top, *tuy, *cast) + layer(4, *charge, *coke)


def trephine():
    handle = [rect(40, 6, 20, 26, 1.8), line(40, 14, 60, 14, 1.0, .5), line(40, 22, 60, 22, 1.0, .5)]
    shaft = [line(50, 32, 50, 58, 2.0)]
    crown = [path("M38 58 L62 58", 1.6), path("M38 58 Q38 74 44 74 L56 74 Q62 74 62 58", 1.8)] + [poly([(38 + i * 4.8, 74), (40.4 + i * 4.8, 80), (43 + i * 4.8, 74)], 1.0, closed=True) for i in range(5)]
    pin = [line(50, 74, 50, 86, 1.2, .8)]
    skull = [path("M8 84 Q8 66 30 66 M70 66 Q92 66 92 84", 1.4, .7), ellipse(50, 90, 42, 6, 1.6, .55)]
    disc = [ellipse(50, 78, 10, 2.4, 1.0, .5)]
    return layer(-4, *skull, *disc) + layer(0, *handle, *shaft, *crown) + layer(4, *pin)


def trocar():
    handle = [path("M70 12 Q80 8 86 16 Q88 28 76 30 L66 26 Z", 1.8), line(66, 26, 56, 34, 1.4)]
    cannula = [rect(14, 36, 46, 8, 1.8), rect(56, 32, 10, 16, 1.4), line(14, 40, 56, 40, .8, .5)]
    obt = [line(8, 40, 56, 40, 1.0, .85), poly([(2, 40), (14, 36), (14, 44)], 1.4, closed=True)]
    valve = [circle(61, 40, 3, 1.2), line(61, 48, 61, 58, 1.4), circle(61, 60, 2, 1.0)]
    body = [path("M4 78 Q30 66 60 74 Q84 80 96 70", 1.4, .55), path("M8 86 Q34 76 60 82 Q82 88 94 80", 1.0, .35)]
    tip = [line(8, 46, 8, 70, 1.0, .45)]
    return layer(-4, *body, *tip) + layer(0, *cannula, *handle) + layer(4, *obt, *valve)


def pound_lock():
    walls = [line(4, 26, 96, 26, 2.0), line(4, 74, 96, 74, 2.0), line(4, 22, 4, 30, 1.6), line(96, 22, 96, 30, 1.6)]
    gate1 = [line(30, 26, 40, 50, 2.0), line(30, 74, 40, 50, 2.0), circle(30, 26, 2, 1.2), circle(30, 74, 2, 1.2)]
    gate2 = [line(70, 26, 60, 50, 2.0), line(70, 74, 60, 50, 2.0), circle(70, 26, 2, 1.2), circle(70, 74, 2, 1.2)]
    boat = [path("M42 44 L58 44 L56 56 L44 56 Z", 1.6), line(50, 44, 50, 36, 1.0), poly([(50, 36), (56, 40), (50, 42)], .9, closed=True)]
    water = [path("M6 36 q6 -3 12 0 t12 0", 1.0, .5), path("M70 60 q6 -3 12 0 t12 0", 1.0, .5), path("M44 62 q3 -2 6 0 t6 0", 1.0, .45)]
    paddle = [rect(20, 20, 6, 6, 1.2, .8), line(23, 20, 23, 12, 1.2, .8), rect(74, 74, 6, 6, 1.2, .8), line(77, 80, 77, 88, 1.2, .8)]
    return layer(-4, *water) + layer(0, *walls, *gate1, *gate2, *paddle) + layer(4, *boat)


def siphon():
    jar1 = [path("M6 32 L6 82 Q6 90 14 90 L38 90 Q46 90 46 82 L46 32", 1.8), line(4, 32, 48, 32, 1.4), path("M8 50 q4 -3 8 0 t8 0 t8 0 t8 0", 1.0, .6)]
    jar2 = [path("M66 62 L66 94 Q66 98 70 98 L92 98 Q96 98 96 94 L96 62", 1.8), line(64, 62, 98, 62, 1.4), path("M68 80 q4 -3 8 0 t8 0 t8 0", 1.0, .5)]
    tube = [path("M20 78 L20 14 Q20 6 28 6 Q36 6 36 14 L36 20 L72 20 Q80 20 80 28 L80 82", 2.0), path("M24 78 L24 16 Q24 10 28 10 Q32 10 32 16 L32 26 L74 26 Q76 26 76 30 L76 82", 1.0, .45)]
    flow = [circle(20, 60, 1.2, .9, .5), circle(20, 46, 1.2, .9, .5), circle(78, 50, 1.2, .9, .5), circle(78, 68, 1.2, .9, .5)]
    drops = [path("M80 82 q-2 4 0 6", 1.0, .6)]
    level = [line(2, 32, 8, 32, .9, .45)]
    return layer(-4, *flow, *drops) + layer(0, *jar1, *jar2) + layer(4, *tube)


def windlass():
    frame = [line(10, 92, 10, 30, 2.0), line(90, 92, 90, 30, 2.0), line(10, 30, 90, 30, 2.0), line(10, 60, 90, 60, 1.0, .4)]
    drum = [rect(10, 36, 80, 14, 1.8), line(10, 43, 90, 43, .9, .5)]
    coil = [path(f"M{16 + i * 6} 36 q-3 7 0 14", 1.0, .75) for i in range(12)]
    crank = [line(90, 43, 98, 43, 1.6), line(98, 43, 98, 22, 1.6), circle(98, 20, 2, 1.2)]
    rope = [path("M30 50 L30 74", 1.4), path("M30 74 L30 76", 1.0)]
    bucket = [path("M22 76 L38 76 L36 92 Q30 94 24 92 Z", 1.6), path("M24 76 Q30 68 36 76", 1.2)]
    well = [path("M14 94 L86 94", 1.2, .5), path("M20 98 q4 -3 8 0 t8 0 t8 0", 1.0, .4)]
    return layer(-4, *well) + layer(0, *frame, *drum, *crank) + layer(4, *coil, *rope, *bucket)


def horse_collar():
    outer = [path("M34 12 Q14 28 16 56 Q20 84 38 90 Q50 94 62 90 Q80 84 84 56 Q86 28 66 12", 2.0), path("M38 18 Q24 32 26 56 Q30 78 42 82 Q50 84 58 82 Q70 78 74 56 Q76 32 62 18", 1.2, .6)]
    pad = [path("M26 56 Q30 78 42 82", 1.6, .8), path("M74 56 Q70 78 58 82", 1.6, .8)] + [line(24 + i * 0, 46 + i * 6, 30, 46 + i * 6, .8, .5) for i in range(3)]
    hames = [path("M30 14 Q22 8 24 4 L32 4", 1.6), path("M70 14 Q78 8 76 4 L68 4", 1.6), line(24, 4, 16, 2, 1.4), line(76, 4, 84, 2, 1.4)]
    trace = [line(16, 58, 4, 66, 1.4), line(84, 58, 96, 66, 1.4), circle(3, 67, 1.6, 1.0), circle(97, 67, 1.6, 1.0)]
    buckle = [line(34, 12, 66, 12, 1.4), rect(46, 8, 8, 6, 1.0, .7)]
    return layer(-4, *trace) + layer(0, *outer, *hames, *buckle) + layer(4, *pad)


def leaf_spring():
    leaves = [path("M6 52 Q50 20 94 52", 2.0), path("M12 56 Q50 28 88 56", 1.8), path("M20 60 Q50 36 80 60", 1.6), path("M28 64 Q50 44 72 64", 1.4), path("M36 67 Q50 52 64 67", 1.2)]
    bolt = [rect(46, 34, 8, 30, 1.4), circle(50, 30, 2.4, 1.2), line(44, 64, 56, 64, 1.2)]
    eyes = [circle(6, 54, 3.4, 1.4), circle(94, 54, 3.4, 1.4)]
    axle = [line(26, 76, 74, 76, 2.0), line(36, 70, 36, 76, 1.2), line(64, 70, 64, 76, 1.2), rect(32, 76, 36, 6, 1.4)]
    shackle = [line(94, 54, 94, 70, 1.2, .6), line(6, 54, 6, 70, 1.2, .6)]
    load = [line(30, 20, 70, 20, 1.2, .5), line(50, 20, 50, 30, 1.0, .5)]
    return layer(-4, *load, *shackle) + layer(0, *axle, *eyes) + layer(4, *leaves, *bolt)


def fan_gate():
    pier = [line(8, 18, 8, 90, 2.0), line(92, 18, 92, 90, 2.0), line(4, 18, 12, 18, 1.6), line(88, 18, 96, 18, 1.6)]
    fan = [path("M50 80 L12 24 Q50 8 88 24 Z", 1.8)] + [line(50, 80, *pol(50, 80, 62, 232 + i * 6.9), 1.0, .75) for i in range(0, 12)]
    arc_ = [arc(50, 80, 62, 232, 308, 1.4, .8)]
    hub = [circle(50, 80, 4, 1.6), circle(50, 80, 1.4, 1.0, fill=True)]
    chain = [line(88, 24, 94, 12, 1.0, .6), circle(95, 10, 1.6, 1.0)]
    flow = [path("M4 84 q6 -3 12 0 t12 0 t12 0", 1.0, .5), path("M60 90 q6 -3 12 0 t12 0", 1.0, .4)]
    return layer(-4, *flow) + layer(0, *pier, *fan, *hub, *chain) + layer(4, *arc_)


ITEMS = [
    dict(id="exp28_water_fulling_mill", n="Water-Powered Fulling Mill", era="science", cat="technology", ds=1086, rar="uncommon",
         date="Medieval Europe, likely from the 9th or 10th century; Normandy c. 1086; Temple Guiting in Domesday Book, 1086", vis="tilt-hammer-tub", topic="textile_machines_exp28",
         region="Medieval Europe (Normandy, Gloucestershire)", artifactType="textile mill", material="timber", physical=True, durable=False,
         l1="Wooden hammers lifted by a water wheel pound wet woollen cloth until it shrinks and felts.",
         l2="A waterwheel turns a shaft with cams, or a tappet wheel, which lifts the hammers. In driving (hanging) stocks the hammer's foot strikes the cloth almost horizontally in a tub rounded on the far side so the cloth turns and is milled evenly; it was taken out every two hours to undo plaits.",
         l3="The page says fulling mills likely began in the 9th or 10th century in Europe, with the earliest French reference about 1086 in Normandy and a mill at Temple Guiting in the Domesday Book (1086); by the late 11th century they were active throughout the medieval world. Fuller's earth and stale urine were used as wash. Scotland kept manual fulling into the 1700s.",
         ev="Domesday Book (1086)", first_known="9th–10th century (likely)",
         confidence=dict(level="uncertain", note="ds is the first dated reference (1086); the page says the earliest mills likely date from the 9th or 10th century and does not mention Persia."),
         srcs=[wp("fulling_wp", "Fulling", "Water-powered fulling mills likely began in the 9th or 10th century in Europe; Normandy c. 1086; Temple Guiting 1086; cams lift stocks; driving and falling stocks.")],
         pool=['water_power', 'cloth', 'wheel', 'wood', 'exp28_cam_and_follower', 'weaving_shuttle', 'axle', 'mechanism'], must=['water_power'], nrec=2,
         tags=["textile", "mill"], regions=["europe"], art=fulling_mill()),
    dict(id="exp28_spinning_wheel", n="Spindle Spinning Wheel", era="science", cat="technology", ds=1030, rar="uncommon",
         date="Evidence of the wheel in the Middle East by 1030; widespread in China by c. 1090; European illustration c. 1280", vis="flyer-wheel", topic="textile_machines_exp28",
         region="Middle East, China and India (accounts disagree); later Europe", artifactType="spinning device", material="wood and cord", physical=True, durable=False,
         l1="A large wheel that spins a spindle by a cord band so thread can be drawn out quickly.",
         l2="The wheel drives the spindle or flyer by a band, and later a treadle freed both hands to draw out the fibre. A treadle wheel with a flyer, the Saxony or flax wheel, was in common use in the 16th century.",
         l3="The page reports disagreeing sources: Kuhn sees a spindle wheel in the first millennium BCE in China, with clear Chinese illustration c. 1270; India's earliest clear reference is 1350; Middle East evidence by 1030, with a clear illustration from Baghdad in 1237; the earliest European illustration c. 1280. The treadle is 'said to' have been added in 1533 by a citizen of Brunswick.",
         ev="Baghdad illustration (1237); European illustration (c. 1280)", first_known="by 1030 (Middle East)",
         confidence=dict(level="debated", note="Sources disagree by region; the page gives no date for the 1530 Saxony wheel or Leonardo's flyer drawing."),
         srcs=[wp("spinwheel_wp", "Spinning_wheel", "Middle East evidence by 1030; Baghdad illustration 1237; China widespread c. 1090, illustration c. 1270; Europe c. 1280; treadle said added 1533; flax wheel in the 16th century.")],
         pool=['wheel', 'fiber', 'plant_thread', 'axle', 'cordage', 'wood', 'weaving_shuttle', 'cloth', 'exp28_saqiya_wheel', 'pottery', 'cart', 'rope', 'mechanism', 'gear', 'exp28_cam_and_follower'], must=[], nrec=2,
         tags=["textile", "spinning"], regions=["africa_asia", "europe"], art=spinning_wheel()),
    dict(id="exp28_paul_carding_machine", n="Lewis Paul's Carding Machine", era="industry", cat="technology", ds=1748, rar="uncommon",
         date="Lewis Paul and Daniel Bourn, 1748; Arkwright's carding patent 1775", vis="card-cylinder", topic="textile_machines_exp28",
         region="England (Lewis Paul, Daniel Bourn, Richard Arkwright)", artifactType="textile machine", material="wood, leather and wire card", physical=True, durable=False,
         l1="A cylinder wrapped in wire-toothed card that combs raw wool into an even sheet.",
         l2="A pair of hand cards brushes wool until the fibres lie roughly in the same direction, and the aligned fibre is peeled off as a rolag. On a machine a swift's card cloth straightens fibres, and a slower worker and faster stripper reverse and re-straighten them before they reach the doffer.",
         l3="Hand cards were paddles covered in card cloth; 'carding' comes from Latin carduus, thistle or teasel. Lewis Paul invented two hand-driven carding machines in 1748, the second wrapping a card of wire slips around a cylinder; Daniel Bourn obtained a similar patent the same year. Arkwright's second patent of 1775 was declared invalid in 1785.",
         ev="Paul's patent (1748); Bourn's patent (1748)", first_known="1748",
         confidence=dict(level="established", note="The page says Bourn probably used his at Leominster; the mill burnt down in 1754."),
         srcs=[wp("carding_wp", "Carding", "Hand cards and teasels; Lewis Paul two carding machines 1748, cylinder with wire card; Daniel Bourn 1748; Arkwright patent 1775, invalid 1785; rolag.")],
         pool=['cloth', 'fiber', 'mechanism', 'wheel', 'wood', 'iron', 'plant_thread', 'weaving_shuttle', 'exp28_spinning_mule', 'exp28_water_frame'], must=['fiber'], nrec=2,
         tags=["textile", "carding"], regions=["europe"], art=carding_machine()),
    dict(id="exp28_bobbin_lace_pillow", n="Bobbin Lace Pillow", era="science", cat="technology", ds=1493, rar="uncommon",
         date="Sforza will mentions lace on twelve bobbins, 1493; pattern books 1559 and 1561", vis="pillow-pins-bobbins", topic="textile_machines_exp28",
         region="Italy (Genoa, Milan); later Flanders and Normandy", artifactType="lace-making tool", material="straw-stuffed pillow, wooden bobbins, pins", physical=True, durable=False,
         l1="A firm pillow pinned with a pattern, where paired thread bobbins are twisted and braided into lace.",
         l2="Lengths of thread wound on bobbins are braided and twisted together on a firm pillow so the pins do not wobble; pins hold the structure while the lacemaker follows the pricking. Bobbins are 3½–4 inches long, used in pairs, traditionally of wood or bone.",
         l3="The page says bobbin lace developed from passementerie in 16th-century Italy, with Genoa known for braids; in the 17th century Flanders and Normandy became the main centres. A Sforza will of 1493 mentions lace on twelve bobbins; Le Pompe (Venice, 1559) and Nüw Modelbuch (Zürich, 1561) are the earliest known pattern books.",
         ev="Le Pompe (1559); Nüw Modelbuch (1561)", first_known="1493",
         confidence=dict(level="established", note="Page does not mention a 1536 pattern book."),
         srcs=[wp("bobbinlace_wp", "Bobbin_lace", "Developed from passementerie in 16th-century Italy; Sforza will 1493 with twelve bobbins; Le Pompe 1559; Nuw Modelbuch 1561; pillow, bobbins of wood or bone, pins and pricking.")],
         pool=['fiber', 'cloth', 'plant_thread', 'bone', 'wood', 'weaving_shuttle', 'cordage', 'paper'], must=['cloth'], nrec=2,
         tags=["textile", "lace"], regions=["europe"], art=bobbin_lace()),
    dict(id="exp28_brace_and_bit", n="Brace and Bit", era="science", cat="technology", ds=1420, rar="common",
         date="U-shaped crank brace in Flanders, 1420–1430", vis="crank-drill", topic="woodworking_exp28",
         region="Flanders", artifactType="hand drill", material="wood and iron", physical=True, durable=True,
         l1="A hand drill with a U-shaped crank that gives great turning force.",
         l2="The U-shaped handle is a crank that gives the brace much more torque than other hand-powered drills. Common Ridgeway and Irwin-pattern bits use a tapered threaded tip, the snail, that pulls the bit forward; modern braces have a three-position ratchet behind the chuck.",
         l3="The page says braces with a U-shaped grip, a compound crank, appeared between 1420 and 1430 in Flanders. It gives no date for the crank, bit history or ratchet.",
         ev="Flemish braces of 1420–1430", first_known="1420–1430",
         confidence=dict(level="established", note="The page does not mention paintings of the 15th century."),
         srcs=[wp("brace_wp", "Brace_(tool)", "Braces with a U-shaped crank grip appeared between 1420 and 1430 in Flanders; crank gives greater torque; snail-tip bits; ratchet.")],
         pool=['wood', 'iron', 'lever', 'bow_drill', 'wheel', 'forging', 'axle', 'mechanism'], must=['iron'], nrec=2,
         tags=["woodworking", "drilling"], regions=["europe"], art=brace_bit()),
    dict(id="exp28_spirit_level", n="Thévenot Spirit Level", era="science", cat="technology", ds=1661, rar="uncommon",
         date="Melchisédech Thévenot, before 2 February 1661", vis="bubble-vial", topic="surveying_exp28",
         region="France (Melchisédech Thévenot)", artifactType="levelling instrument", material="glass vial, alcohol and wood", physical=True, durable=True,
         l1="A tilted glass vial of alcohol with a bubble that sits at the centre when the surface is level.",
         l2="The glass vial is slightly curved upward and partly filled with liquid, leaving an air bubble that rests at the highest point when level. Alcohol is preferred to water because it has low viscosity and surface tension, a wider temperature range, and does not freeze and crack the vial.",
         l3="Thévenot invented it sometime before 2 February 1661, a date established from his correspondence with Christiaan Huygens; within a year he shared details with Robert Hooke and Vincenzo Viviani, and Adrien Auzout recommended Thévenot-type levels for the 1666 Madagascar expedition.",
         ev="Thévenot's letters to Huygens (1661)", first_known="before 2 Feb 1661",
         confidence=dict(level="established", note="Date is the latest-possible invention date from the correspondence."),
         srcs=[wp("spiritlevel_wp", "Spirit_level", "Thévenot invented it before 2 Feb 1661, from his correspondence with Huygens; shared with Hooke and Viviani; Auzout 1666; alcohol in a curved vial with an air bubble.")],
         pool=['glass', 'measurement', 'physics', 'wood', 'geometry', 'observation', 'chemistry', 'experiment'], must=['glass'], nrec=2,
         tags=["surveying", "levelling"], regions=["europe"], art=spirit_level()),
    dict(id="exp28_cupola_furnace", n="Cupola Furnace", era="civilization", cat="engineering", ds=-403, rar="uncommon",
         date="Warring States China (403–221 BC); modern cupola by Réaumur around 1720", vis="coke-bed-shaft", topic="metallurgy_exp28",
         region="Warring States and Han China; France (Réaumur)", artifactType="melting furnace", material="clay and brick", physical=True, durable=False,
         l1="A tall shaft furnace in which coke and cast iron are layered and blasted to remelt iron.",
         l2="Layers of coke are lit and air enters the coke bed through side ports called tuyeres; solid metal goes in at the top alternated with fresh coke and limestone flux. The metal melts and drips through the coke to a pool at the bottom, picking up some carbon.",
         l3="The page says cupola furnaces were built in China as early as the Warring States period (403–221 BC), and in the Han dynasty (202 BC–220 AD) most iron smelted in the blast furnace was remelted in a cupola. Réaumur made a modern cupola around 1720 (approximate). It does not mention John Wilkinson or 1794.",
         ev="Han dynasty remelting; Réaumur's cupola (c. 1720)", first_known="403–221 BC",
         confidence=dict(level="uncertain", note="Page gives 'as early as' the Warring States and an approximate 1720 for the modern cupola; no excavated example is cited."),
         srcs=[wp("cupola_wp", "Cupola_furnace", "Built in China as early as 403–221 BC; Han iron remelted in cupolas; Réaumur modern cupola about 1720; coke, tuyeres, limestone flux.")],
         pool=['iron', 'forging', 'metallurgy', 'casting', 'fire', 'bellows', 'stone', 'bronze', 'copper'], must=['iron', 'casting'], nrec=2,
         tags=["metallurgy", "furnace"], regions=["africa_asia", "europe"], art=cupola()),
    dict(id="exp28_coke_blast_furnace", n="Coke-Fired Blast Furnace", era="industry", cat="engineering", ds=1709, rar="rare",
         date="Abraham Darby I, 1709 (coke patents from 1589 and 1620)", vis="coke-charge-stack", topic="metallurgy_exp28",
         region="Coalbrookdale, England (Abraham Darby I)", artifactType="smelting furnace", material="brick and stone", physical=True, durable=False,
         l1="A blast furnace fed with coke instead of charcoal, to make cast iron from ore.",
         l2="Coke, coal heated to drive off volatile matter, replaced charcoal as the fuel and reducing agent in the blast furnace, and was later made in beehive ovens.",
         l3="The page lists Proctor and Peterson's 1589 patent to make iron with 'earth-coal', William St. John's 1620 patent for coke in smelting, and Abraham Darby I's coke-fired blast furnace in 1709. John Wilkinson built a more practical coking oven in 1768; the page does not mention Dud Dudley.",
         ev="Darby's furnace (1709); patents of 1589 and 1620", first_known="1709",
         confidence=dict(level="established", note="Earlier coke use in malting (1642) and patents did not establish ironmaking with coke."),
         srcs=[wp("coke_wp", "Coke_(fuel)", "Proctor and Peterson patent 1589; St. John patent 1620; Darby coke-fired blast furnace 1709; Wilkinson oven 1768; beehive ovens.")],
         pool=['iron', 'metallurgy', 'fire', 'forging', 'casting', 'bellows', 'chemistry', 'steam_engine', 'water_power'], must=['iron'], nrec=2,
         tags=["metallurgy", "furnace"], regions=["europe"], tradeImportance="high", art=coke_blast()),
    dict(id="exp28_trephine", n="Trephine", era="origins", cat="technology", ds=-6500, rar="uncommon",
         date="Trepanation holes in skulls at a French burial site dated 6500 BCE; trepanation 7,000–10,000 years old", vis="crown-saw", topic="medicine_exp28",
         region="Prehistoric Europe (French burial site); Hippocratic Greece (directions, undated)", artifactType="surgical tool", material="flint or obsidian, later bronze and copper", physical=True, durable=True,
         l1="A drill-like crown cutter that removes a round piece of skull bone.",
         l2="A trephine is an instrument used for cutting out a round piece of skull bone. Early tools were made of flint, obsidian or stone and later of bronze and copper; survival was about 40% at the 6500 BCE French site, about 78% in some Iron Age populations, and about 80% in the 16th and 17th centuries.",
         l3="The page says trepanation dates back 7,000–10,000 years, and gives 6500 BCE for a French burial site where 40 of 120 skulls had trepanation holes. Hippocrates gave specific directions on the procedure, though the page gives no date for him or for the trephine's introduction.",
         ev="French burial site, 6500 BCE", first_known="c. 6500 BCE (trepanation)",
         confidence=dict(level="uncertain", note="The date refers to the skull evidence, not an excavated tool; the page does not mention Ensisheim."),
         srcs=[wp("trepan_wp", "Trepanning", "Trepanation 7,000–10,000 years old; French burial site 6500 BCE with 40 of 120 skulls; flint, obsidian, bronze and copper tools; Hippocrates gave directions; survival rates.")],
         pool=['stone', 'bone', 'flint', 'bow_drill', 'wood', 'copper', 'cordage', 'awl', 'stone_drill_awl', 'rotary_stone_drill_head'], must=[], nrec=2,
         tags=["medicine", "surgery"], regions=["europe"], art=trephine()),
    dict(id="exp28_trocar_cannula", n="Trocar and Cannula", era="science", cat="technology", ds=1694, rar="uncommon",
         date="Word 'trocar' first appears in the Dictionnaire des Arts et des Sciences, 1694; patents early 19th century", vis="obturator-in-tube", topic="medicine_exp28",
         region="France (word); Britain (Southey's tube, mid-19th century)", artifactType="surgical tool", material="metal", physical=True, durable=True,
         l1="A pointed rod inside a hollow tube that punctures the body to drain fluid or gas.",
         l2="A trocar has an obturator with a pointed or tapered tip inside a rigid tube called a cannula, often with a seal and sometimes a valve. It drains or vents fluid or gas, as in hydrothorax or ascites, and serves as a portal for endoscopic instruments.",
         l3="The page says the word first appears in the Dictionnaire des Arts et des Sciences in 1694 by Thomas Corneille, that patents appeared in the early 19th century though use may date back thousands of years, and that Reginald Southey's tube was among the mid-19th-century refinements. It does not mention Sanctorius.",
         ev="Corneille (1694)", first_known="1694 (earliest recorded word)",
         confidence=dict(level="uncertain", note="ds is the first recorded use of the word; the page says use may be thousands of years older."),
         srcs=[wp("trocar_wp", "Trocar", "Word first recorded 1694; patents early 19th century; Southey's tube mid-19th century; obturator in a cannula; drainage and laparoscopic portal uses.")],
         pool=['metallurgy', 'copper', 'iron', 'forging', 'bronze', 'casting', 'glass', 'chemistry'], must=[], nrec=2,
         tags=["medicine", "surgery"], regions=["europe"], art=trocar()),
    dict(id="exp28_pound_lock", n="Pound Lock", era="science", cat="engineering", ds=984, rar="rare",
         date="Qiao Weiyue, Song China, 984; first true European pound lock at Damme, 1396", vis="twin-gate-chamber", topic="waterways_exp28",
         region="Song China (Qiao Weiyue); Damme, Belgium; Milan", artifactType="canal structure", material="timber and masonry", physical=True, durable=True,
         l1="A canal chamber between two gates that is filled and emptied to lift boats between levels.",
         l2="A boat going downstream enters with the chamber filled through the upstream valve, the upstream gates close, the chamber is drained through the downstream valve until the level matches, and the downstream gates open. Upstream travel reverses it; a full cycle takes 10 to 20 minutes.",
         l3="The page dates the earliest pound lock to 984 CE in Song China, where Qiao Weiyue installed a pair of gates about 250 feet apart. Vreeswijk in the Netherlands had a sort of pound lock in 1385, the first true European one was built at Damme in 1396, and Bertola da Novate built 18 on the Naviglio di Bereguardo in 1452–1458. Leonardo is credited with the mitre gate around the late 15th century; the earlier flash lock had a single gate.",
         ev="Qiao Weiyue's locks (984); Damme (1396)", first_known="984",
         confidence=dict(level="established", note="The page does not mention Viterbo or any 1370s lock."),
         srcs=[wp("poundlock_wp", "Lock_(water_navigation)", "Song China 984 Qiao Weiyue pair of gates 250 ft apart; Vreeswijk 1385; Damme 1396; Bertola da Novate 1452–1458; mitre gate late 15th century; flash lock.")],
         pool=['engineering', 'wood', 'stone', 'boat', 'water_power', 'lever', 'rope', 'mechanical_advantage'], must=['engineering'], nrec=2,
         tags=["waterways", "engineering"], regions=["africa_asia", "europe"], tradeImportance="high", art=pound_lock()),
    dict(id="exp28_siphon", n="Siphon", era="civilization", cat="engineering", ds=-1500, rar="common",
         date="Egyptian reliefs c. 1500 BC; Justice cup of Pythagoras, 6th century BC; Pergamon, 3rd century BC", vis="inverted-u-tube", topic="water_lifting_exp28",
         region="Egypt; Samos; Pergamon; Baghdad (Banu Musa)", artifactType="fluid device", material="tube", physical=True, durable=False,
         l1="A bent tube that carries liquid up over a rim and down to a lower outlet without pumping.",
         l2="Liquid in the longer outer leg lowers the pressure at the crest and the liquid is pulled over; the outlet must be lower than the upper reservoir's surface. Once started it needs no additional energy; maximum height is about 10 m for water and 76 cm for mercury at standard pressure.",
         l3="The page dates Egyptian reliefs of siphons drawing liquid from large storage jars to 1500 BC and cites the 6th-century BC Justice cup of Pythagoras on Samos and the 3rd-century BC use by Pergamon's Greek engineers. The Banu Musa brothers invented a double-concentric siphon in 9th-century Baghdad. The page does not mention Ctesibius or Pliny.",
         ev="Egyptian reliefs (c. 1500 BC); Banu Musa, Book of Ingenious Devices", first_known="c. 1500 BC",
         confidence=dict(level="established", note="Whether pressure or cohesion explains it is discussed on the page; both may apply."),
         srcs=[wp("siphon_wp", "Siphon", "Egyptian reliefs 1500 BC; Justice cup of Pythagoras 6th century BC; Pergamon 3rd century BC; Banu Musa 9th century; outlet below reservoir; 10 m water, 76 cm mercury.")],
         pool=['pottery', 'fiber', 'observation', 'copper', 'plant_thread', 'rope', 'wood', 'bronze', 'cordage', 'measurement', 'stone', 'lever'], must=[], nrec=2,
         tags=["water_lifting", "hydraulics"], regions=["africa_asia", "europe"], art=siphon()),
    dict(id="exp28_well_windlass", n="Well Windlass", era="science", cat="technology", ds=600, rar="common",
         date="Isidore of Seville (c. 560–636) gives the oldest description of a well windlass; Wang Zhen 1313", vis="horizontal-drum-crank", topic="water_lifting_exp28",
         region="Visigothic Spain (Isidore of Seville); Yuan China (Wang Zhen)", artifactType="lifting device", material="wood and rope", physical=True, durable=False,
         l1="A horizontal drum with a crank that winds a rope to haul up a bucket from a well.",
         l2="A windlass is a horizontal winch; a rotating wooden rod across a well's mouth winds the rope. It is also used on boats to raise the anchor, with a vertical capstan as an alternative.",
         l3="The page calls Archimedes the inventor of the windlass but gives no date. Hero of Alexandria lists it among the five mechanical powers about a century after Vitruvius (c. 28 BC); Isidore of Seville, c. 560–636, gives the oldest description of a well windlass; Wang Zhen's Book of Agriculture (1313) has the oldest depiction for raising water; a windlass crossbow cocking mechanism is dated to England in 1215.",
         ev="Isidore of Seville; Wang Zhen (1313); surviving Chesterfield windlass (1360–1400)", first_known="c. 560–636 (oldest description)",
         confidence=dict(level="uncertain", note="ds 600 is the midpoint of Isidore's life; the page gives no date for Archimedes' claimed invention."),
         srcs=[wp("windlass_wp", "Windlass", "Archimedes credited undated; Vitruvius c. 28 BC; Hero; Isidore of Seville c. 560–636 oldest well windlass; Wang Zhen 1313; crossbow windlass England 1215.")],
         pool=['rope', 'wood', 'axle', 'lever', 'cordage', 'wheel', 'pulley', 'mechanical_advantage', 'exp28_shaduf', 'exp28_chain_pump', 'iron', 'pottery', 'exp28_saqiya_wheel'], must=[], nrec=2,
         tags=["lifting", "water_lifting"], regions=["europe", "africa_asia"], art=windlass()),
    dict(id="exp28_horse_collar", n="Padded Horse Collar", era="civilization", cat="technology", ds=477, rar="uncommon",
         date="Dunhuang cave 257 mural, 477–499 AD; in clear use in Europe by 1000 AD", vis="shoulder-collar", topic="harness_exp28",
         region="Northern Wei China (Dunhuang); medieval Europe", artifactType="harness", material="leather and wood", physical=True, durable=False,
         l1="A padded ring around a horse's neck that lets it pull from the shoulders without choking.",
         l2="The collar spreads the load across the shoulders and chest without pressing on the windpipe, unlike the throat-and-girth harness. Lefebvre des Noëttes's 1910 experiment suggested two horses in the old harness could pull about half a ton against 1½ tons for one in a collar; later studies argue the collar's main advantage was a lower attachment point.",
         l3="The page calls the Dunhuang cave 257 mural of 477–499 AD the earliest legitimate depiction, with a questionable earlier image on a Three Kingdoms-era tomb (220–265 AD). In Europe use was clearly evident by 1000 AD and widespread by the 12th century; the page does not support a 9th-century date.",
         ev="Dunhuang cave 257 (477–499 AD)", first_known="477–499 AD",
         confidence=dict(level="debated", note="Earlier depictions are questionable; the modern advantage claims are disputed (Spruytte, Littauer 1977)."),
         srcs=[wp("collar_wp", "Horse_collar", "Dunhuang cave 257 mural 477–499 AD earliest legitimate depiction; Europe clearly by 1000 AD, widespread 12th century; spreads load over shoulders; des Noëttes 1910; Spruytte and Littauer 1977.")],
         pool=['leather', 'cloth', 'fiber', 'cordage', 'wood', 'rope', 'stone_leather_burnisher', 'cart'], must=['cordage'], nrec=2,
         tags=["harness", "draft_animals"], regions=["africa_asia", "europe"], art=horse_collar()),
    dict(id="exp28_elliptic_leaf_spring", n="Elliptic Leaf Spring", era="industry", cat="engineering", ds=1804, rar="uncommon",
         date="Obadiah Elliott's patent, 1804; leaf springs on French carriages from the mid-17th century", vis="stacked-leaves", topic="machines_exp28",
         region="France (carriages); England (Obadiah Elliott)", artifactType="suspension spring", material="spring steel", physical=True, durable=True,
         l1="A stack of curved steel leaves that cushions a carriage on its axle.",
         l2="Heavy vehicles use several stacked leaves, the longest being the master leaf, held together by a centre bolt; spring steel with about 1% carbon is most efficient.",
         l3="The page says leaf springs first appeared on French carriages in the mid-17th century as two-part elbow springs, reaching wealthy carriages in England and Germany around 1750; Felton's 1796 Treatise on Carriages shows they were regularly sold. Obadiah Elliott patented elliptical leaf springs in 1804, crediting him with the modern leaf spring; Clark (1855), Reuleaux (1861) and Henderson (1894) developed their theory.",
         ev="Elliott's patent (1804); Felton's Treatise on Carriages (1796)", first_known="mid-17th century",
         confidence=dict(level="established", note="ds is Elliott's 1804 elliptical patent; the earlier elbow springs date from the mid-17th century."),
         srcs=[wp("leafspring_wp", "Leaf_spring", "Mid-17th-century French elbow springs; c. 1750 wealthy carriages; Felton 1796; Elliott elliptical patent 1804; Clark 1855, Reuleaux 1861, Henderson 1894; master leaf.")],
         pool=['steel', 'forging', 'cart', 'wheel', 'axle', 'iron', 'metallurgy', 'lever', 'engineering', 'exp28_fusee', 'exp28_spinning_mule', 'exp28_governor' , 'mechanism', 'factory', 'machine_tools', 'standardized_parts', 'mechanical_advantage'], must=[], nrec=2,
         tags=["machines", "suspension"], regions=["europe"], art=leaf_spring()),
    dict(id="exp28_fan_gate", n="Blanken Fan Gate", era="industry", cat="engineering", ds=1808, rar="uncommon",
         date="Jan Blanken, 1808 (sluice treatise cited 1809)", vis="radial-fan-sluice", topic="waterways_exp28",
         region="Holland (Jan Blanken)", artifactType="sluice gate", material="timber and iron", physical=True, durable=True,
         l1="A sluice gate shaped like a quarter-fan that swings to control water flow.",
         l2="Sluice gates control water in a channel; a radial sluice gate is a section of a cylindrical surface supported by radial members, and the vertical rising gate is the most common type in open channels.",
         l3="The page says the fan gate was invented in 1808 by the Dutch hydraulic engineer Jan Blanken, Inspector-General for Waterstaat of the Kingdom of Holland, and cites a 1809 treatise on sluice design. It gives no dates for the vertical or radial sluice gates.",
         ev="Blanken's fan gate (1808)", first_known="1808",
         confidence=dict(level="established", note="The page does not cover Tainter gates or ancient sluices."),
         srcs=[wp("sluice_wp", "Sluice", "Fan gate invented 1808 by Jan Blanken; 1809 sluice treatise; radial sluice gate is a section of a cylinder on radial supports; vertical rising gate most common.")],
         pool=['engineering', 'wood', 'water_power', 'iron', 'lever', 'mechanism', 'mathematics', 'geometry'], must=['engineering'], nrec=2,
         tags=["waterways", "hydraulics"], regions=["europe"], art=fan_gate()),
]
