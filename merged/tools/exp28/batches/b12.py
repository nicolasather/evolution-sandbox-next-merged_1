"""EXP28 batch 12 — medicine, chemistry, materials, textile and farm machines, early electronics.
Facts only from pages fetched 2026-10-16. Unknowns are stated as '(not known)' in l3, followed by a fun fact from the same page."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def ether_inhaler():
    flask = [path("M26 46 Q26 34 46 34 Q66 34 66 46 Q66 78 46 78 Q26 78 26 46 Z", 1.8), rect(40, 20, 12, 14, 1.4)]
    sponge = [circle(46, 58, 10, 1.0, .6), path("M38 58 q4 -3 8 0 t8 0", .9, .5)]
    tube = [path("M52 20 Q74 10 86 28", 1.6), path("M52 24 Q72 16 82 30", 1.0, .5)]
    mask = [path("M80 28 Q96 28 96 44 Q96 58 82 58 Q76 58 76 44 Z", 1.6), circle(86, 44, 3, 1.0, .7)]
    vapor = [path("M40 30 q4 -6 0 -10 M48 30 q4 -6 0 -10", 1.0, .55)]
    stand = [line(30, 90, 62, 90, 1.4), line(46, 78, 46, 90, 1.2)]
    return layer(-4, *vapor) + layer(0, *flask, *mask, *stand) + layer(4, *tube, *sponge)


def carbolic_spray():
    boiler = [path("M10 74 Q10 56 28 56 Q46 56 46 74 L46 88 L10 88 Z", 1.8), rect(22, 44, 12, 12, 1.4)]
    nozzle = [path("M34 48 L60 40 L60 34 L34 40", 1.4), line(60, 37, 76, 37, 1.6)]
    mist = [circle(82 + (i % 3) * 5, 28 + i * 4, 1.2, .8, fill=True) for i in range(6)] + [path("M76 37 q10 -2 16 6 M76 37 q14 4 20 16", 1.0, .5)]
    flame = [path("M20 98 q4 -6 0 -10 M34 98 q4 -6 0 -10", 1.0, .6), line(8, 88, 48, 88, 1.4)]
    table = [rect(60, 68, 36, 6, 1.4), line(66, 74, 66, 94, 1.2), line(90, 74, 90, 94, 1.2)]
    wound = [path("M70 64 q8 -4 16 0", 1.0, .7)]
    return layer(-4, *mist) + layer(0, *boiler, *flame, *table) + layer(4, *nozzle, *wound)


def pasteurizer():
    vat = [path("M16 36 L16 80 Q16 90 50 90 Q84 90 84 80 L84 36", 1.8), ellipse(50, 36, 34, 6, 1.4)]
    jacket = [path("M20 44 L20 78 Q20 84 50 84", 1.0, .55), path("M80 44 L80 78 Q80 84 50 84", 1.0, .55)]
    therm = [line(50, 12, 50, 52, 1.4), circle(50, 56, 3, 1.2), line(44, 18, 50, 18, 1.0, .8), line(44, 26, 50, 26, 1.0, .8), line(44, 34, 50, 34, 1.0, .8)]
    steam = [path("M26 28 q4 -6 0 -12 M74 28 q4 -6 0 -12", 1.0, .55)]
    liquid = [path("M20 52 q10 -4 20 0 t20 0 t20 0", 1.0, .6)]
    spout = [path("M84 70 L96 74", 1.4), line(96, 74, 96, 86, 1.2)]
    return layer(-4, *steam, *jacket) + layer(0, *vat, *liquid, *spout) + layer(4, *therm)


def ophthalmoscope():
    mirror = [circle(40, 38, 16, 1.8), circle(40, 38, 2.4, 1.2), circle(40, 38, 10, 1.0, .5)]
    handle = [rect(30, 54, 8, 40, 1.6), line(34, 54, 34, 94, .9, .5)]
    lamp = [circle(76, 22, 8, 1.4), line(68, 22, 56, 36, 1.0, .65), path("M72 28 q-4 -4 0 -8", 1.0, .6)]
    eye = [ellipse(84, 66, 12, 8, 1.4), circle(84, 66, 4, 1.2), circle(84, 66, 1.2, .9, fill=True)]
    beam = [line(48, 36, 74, 62, 1.0, .5), line(48, 40, 74, 68, 1.0, .5)]
    disc = [circle(40, 38, 20, 1.0, .35)]
    return layer(-4, *disc, *beam) + layer(0, *mirror, *handle, *eye) + layer(4, *lamp)


def ecg_galvanometer():
    magnet = [rect(8, 22, 20, 56, 1.8), rect(72, 22, 20, 56, 1.8), line(28, 28, 72, 28, .9, .45), line(28, 72, 72, 72, .9, .45)]
    string = [line(50, 10, 50, 90, 1.0), path("M50 42 q4 4 0 8", 1.0, .8)]
    trace = [path("M2 96 L14 96 L18 88 L22 96 L30 96 L34 74 L38 98 L42 96 L52 96 L58 90 L66 96 L98 96", 1.2, .85)]
    electrodes = [circle(6, 10, 4, 1.2), circle(94, 10, 4, 1.2), path("M10 10 Q50 -2 90 10", 1.0, .6)]
    scope = [rect(36, 36, 28, 28, 1.2, .6)]
    return layer(-4, *scope) + layer(0, *magnet, *string) + layer(4, *trace, *electrodes)


def chamberlen_forceps():
    h1 = [path("M44 94 L44 56 Q44 44 36 36", 1.8), rect(40, 76, 8, 14, 1.2)]
    h2 = [path("M56 94 L56 56 Q56 44 64 36", 1.8)]
    blade1 = [path("M36 36 Q18 30 20 14 Q34 6 42 18 Q42 28 36 36", 1.6), path("M28 18 Q32 26 34 32", 1.0, .55)]
    blade2 = [path("M64 36 Q82 30 80 14 Q66 6 58 18 Q58 28 64 36", 1.6), path("M72 18 Q68 26 66 32", 1.0, .55)]
    pivot = [circle(50, 56, 3, 1.4), line(44, 56, 56, 56, 1.0)]
    box = [rect(4, 80, 28, 14, 1.2, .5)]
    return layer(-4, *box) + layer(0, *h1, *h2, *pivot) + layer(4, *blade1, *blade2)


def liebig_condenser():
    inner = [rect(10, 42, 80, 8, 1.6)]
    jacket = [rect(24, 34, 52, 24, 1.8), line(24, 46, 76, 46, .9, .45)]
    ports = [line(34, 58, 34, 72, 1.4), line(66, 34, 66, 20, 1.4), circle(34, 74, 2, 1.0), circle(66, 18, 2, 1.0)]
    flask = [path("M2 30 Q2 22 10 22 L10 56 Q2 56 2 48 Z", 1.2, .6)]
    receiver = [path("M90 50 L94 74 L84 74 Z", 1.2), path("M86 78 q4 2 8 0", 1.0, .6)]
    water = [path("M30 66 q4 -3 8 0 M62 24 q4 -3 8 0", 1.0, .6)]
    drip = [circle(90, 62, 1.2, .9, fill=True)]
    return layer(-4, *flask, *water) + layer(0, *inner, *jacket, *receiver) + layer(4, *ports, *drip)


def periodic_table():
    cells = []
    for r in range(5):
        for c in range(8):
            if (r == 0 and 0 < c < 7) or (r in (1, 2) and False):
                continue
            cells.append(rect(6 + c * 11, 10 + r * 14, 10, 12, 1.0, None if (r + c) % 3 else .65))
    gap = [rect(28 + c * 11, 78 + r * 0, 10, 10, 1.0, .75) for c in range(5)]
    arrow = [line(6, 94, 94, 94, 1.0, .5), poly([(88, 90), (94, 94), (88, 98)], 1.0)]
    blank = [path("M6 82 L22 82", 1.0, .45)]
    return layer(-4, *arrow) + layer(0, *cells) + layer(4, *gap, *blank)


def portland_kiln():
    shell = [path("M4 54 L4 40 Q4 34 10 34 L90 34 Q96 34 96 40 L96 54 Z", 1.8), path("M4 54 L96 66", 0)] if False else [path("M4 40 L96 52 L96 66 L4 54 Z", 1.8)]
    ring = [line(26, 43, 26, 59, 1.4), line(50, 46, 50, 62, 1.4), line(74, 49, 74, 65, 1.4)]
    wheel = [circle(20, 78, 6, 1.2), circle(50, 82, 6, 1.2), circle(80, 86, 6, 1.2), line(10, 94, 90, 94, 1.0, .5)]
    flame = [path("M98 44 q-8 -4 -2 -10 M94 40 q-6 -4 0 -10", 1.0, .65)]
    clinker = [circle(8 + i * 3, 60 + i * 2, 1.2, .9, fill=True) for i in range(5)] + [circle(40, 20, 6, 1.2, .6)]
    hopper = [path("M20 8 L50 8 L44 24 L26 24 Z", 1.4), line(35, 24, 35, 40, 1.0, .6)]
    return layer(-4, *clinker, *flame) + layer(0, *shell, *wheel) + layer(4, *ring, *hopper)


def vulcanized_rubber():
    sheet = [path("M10 60 Q10 40 30 40 L70 40 Q90 40 90 60 Q90 80 70 80 L30 80 Q10 80 10 60 Z", 1.8)]
    chains = [path(f"M{18 + k * 2} {48 + k * 8} q8 -6 16 0 t16 0 t16 0 t14 0", 1.0, .75) for k in range(3)]
    links = [line(34, 48, 38, 72, 1.2), line(54, 48, 50, 72, 1.2), line(72, 56, 68, 74, 1.2)]
    pan = [path("M20 88 Q50 100 80 88", 1.6), line(80, 88, 96, 84, 1.4)]
    sulfur = [circle(26, 24, 3, 1.0, .7), circle(36, 20, 3, 1.0, .7), circle(46, 24, 3, 1.0, .7), line(50, 28, 50, 36, 1.0, .5)]
    heat = [path("M30 98 q4 -6 0 -10 M50 100 q4 -6 0 -10 M70 98 q4 -6 0 -10", 1.0, .55)]
    return layer(-4, *heat, *sulfur) + layer(0, *sheet, *pan) + layer(4, *chains, *links)


def nylon_spinneret():
    pot = [path("M24 8 L76 8 L76 36 L56 54 L44 54 L24 36 Z", 1.8), line(24, 16, 76, 16, 1.0, .5)]
    plate = [rect(40, 54, 20, 6, 1.4)] + [circle(43 + i * 3.5, 57, .9, .8, fill=True) for i in range(5)]
    fibres = [line(43 + i * 3.5, 60, 43 + i * 3.5 - (i - 2) * 1.5, 86, 1.0, .85) for i in range(5)]
    reel = [circle(50, 90, 8, 1.6), circle(50, 90, 2, 1.0)] + [line(*pol(50, 90, 2, k * 60), *pol(50, 90, 8, k * 60), .9, .6) for k in range(6)]
    melt = [path("M28 24 q10 -4 20 0 t24 0", 1.0, .6)]
    pipe = [line(76, 20, 96, 20, 1.4), line(96, 20, 96, 40, 1.2)]
    return layer(-4, *melt) + layer(0, *pot, *plate, *pipe) + layer(4, *fibres, *reel)


def hall_heroult():
    cell = [rect(10, 40, 80, 46, 1.8), rect(14, 46, 72, 36, 1.0, .5)]
    anodes = [rect(24, 12, 10, 40, 1.4), rect(66, 12, 10, 40, 1.4), line(14, 12, 86, 12, 1.4), circle(29, 56, 1.2, .8, fill=True)]
    bath = [path("M16 58 q8 -4 16 0 t16 0 t16 0 t16 0", 1.0, .6)]
    metal = [rect(18, 74, 64, 6, 1.2), line(18, 77, 82, 77, .9, .45)]
    tap = [line(90, 78, 98, 78, 1.4), circle(98, 78, 2, 1.0)]
    gas = [path("M30 40 q4 -6 0 -12 M70 40 q4 -6 0 -12", 1.0, .5)]
    return layer(-4, *gas, *bath) + layer(0, *cell, *metal, *tap) + layer(4, *anodes)


def float_glass():
    bath = [rect(4, 62, 92, 12, 1.8), path("M6 66 q12 -3 24 0 t24 0 t24 0 t14 0", 1.0, .55)]
    ribbon = [path("M2 58 L98 58", 1.8), path("M2 54 L98 54", 1.0, .6), path("M2 58 L2 54 M98 58 L98 54", 1.0)]
    furnace = [path("M2 40 L2 12 L24 12 L24 40", 1.6), line(2, 26, 24, 26, 1.0, .5), path("M24 32 L34 54", 1.2)]
    rollers = [circle(80 + i * 8 - 8, 80, 4, 1.2) for i in range(3)] + [line(70, 84, 98, 84, 1.0, .5)]
    heat = [path("M8 8 q4 -6 0 -6 M16 8 q4 -6 0 -6", 1.0, .5)]
    gas = [path("M40 82 q16 8 32 0", 1.0, .45)]
    return layer(-4, *heat, *gas) + layer(0, *bath, *furnace, *rollers) + layer(4, *ribbon)


def haber_bosch():
    vessel = [rect(34, 14, 32, 70, 1.8), path("M34 14 Q50 2 66 14", 1.6), path("M34 84 Q50 96 66 84", 1.6)]
    beds = [line(36, 32, 64, 32, 1.0, .7), line(36, 50, 64, 50, 1.0, .7), line(36, 68, 64, 68, 1.0, .7)] + [circle(40 + i * 6, 40, 1.2, .8, fill=True) for i in range(5)]
    in_ = [line(2, 30, 34, 30, 1.6), line(2, 40, 34, 40, 1.6), rect(0, 26, 6, 18, 1.2)]
    out = [line(66, 70, 98, 70, 1.6), circle(98, 70, 2, 1.0)]
    recycle = [path("M66 74 L80 74 L80 96 L14 96 L14 44 L34 44", 1.0, .55)]
    return layer(-4, *recycle) + layer(0, *vessel, *in_, *out) + layer(4, *beds)


def power_loom():
    frame = [rect(6, 20, 8, 70, 1.6), rect(86, 20, 8, 70, 1.6), line(6, 20, 94, 20, 1.6), line(6, 90, 94, 90, 1.6)]
    warp = [line(20 + i * 6, 24, 20 + i * 6, 74, .9, .6) for i in range(12)]
    reed = [rect(18, 44, 66, 6, 1.4)]
    cloth = [rect(18, 74, 66, 12, 1.2, .8)] + [line(20, 76 + i * 3, 82, 76 + i * 3, .8, .5) for i in range(3)]
    shuttle = [path("M30 58 Q40 54 50 58 Q40 62 30 58", 1.2), line(24, 58, 62, 58, .8, .5)]
    drive = [circle(94, 4, 0.1, .1)] if False else [line(86, 56, 98, 56, 1.4), circle(98, 56, 2, 1.0)]
    cam = [circle(10, 60, 4, 1.0, .0 + .7)]
    return layer(-4, *warp, *cloth) + layer(0, *frame, *reed) + layer(4, *shuttle, *drive, *cam)


def flying_shuttle():
    box1 = [rect(4, 52, 20, 14, 1.6)]
    box2 = [rect(76, 52, 20, 14, 1.6)]
    race = [line(24, 56, 76, 56, 1.4), line(24, 62, 76, 62, 1.4)]
    shuttle = [path("M44 56 Q52 52 60 56 L60 62 Q52 66 44 62 Z", 1.6), line(46, 59, 58, 59, .9, .6)]
    picker = [line(6, 59, 14, 59, 1.0, .7), line(86, 59, 94, 59, 1.0, .7), circle(10, 59, 1.4, .9)]
    cord = [path("M10 52 L10 24 L50 12 L90 24 L90 52", 1.2), line(50, 12, 50, 4, 1.4), circle(50, 4, 2, 1.0)]
    warp = [line(30 + i * 8, 20, 30 + i * 8, 90, .9, .5) for i in range(6)]
    return layer(-4, *warp) + layer(0, *box1, *box2, *race) + layer(4, *shuttle, *picker, *cord)


def bell_reaper():
    wheel = [circle(24, 70, 22, 1.8), circle(24, 70, 3, 1.2), spokes(24, 70, 8, 20, 3, 0, 1.0, .6)]
    frame = [line(24, 70, 66, 52, 1.6), line(66, 52, 90, 52, 1.6), line(24, 70, 24, 40, 1.4), rect(14, 30, 28, 8, 1.4)]
    reel = [circle(80, 30, 14, 1.4)] + [line(*pol(80, 30, 2, k * 60), *pol(80, 30, 18, k * 60), 1.2) for k in range(6)]
    cutter = [line(60, 86, 98, 86, 1.8)] + [poly([(60 + i * 6, 86), (63 + i * 6, 92), (66 + i * 6, 86)], .9) for i in range(6)]
    grain = [line(64 + i * 8, 86, 64 + i * 8, 70, 1.0, .65) for i in range(4)]
    seat = [path("M22 40 L22 46", 1.0)]
    return layer(-4, *grain) + layer(0, *wheel, *frame, *cutter) + layer(4, *reel, *seat)


def steel_plough():
    beam = [line(8, 26, 56, 40, 2.0), line(56, 40, 76, 36, 1.6)]
    handles = [line(76, 36, 90, 10, 1.8), line(70, 38, 84, 12, 1.6), line(84, 12, 90, 10, 1.2)]
    mould = [path("M44 42 Q40 60 50 74 Q60 82 78 76 Q66 68 64 52 Q62 44 56 40", 1.8), path("M52 52 Q54 66 66 72", 1.0, .6)]
    share = [poly([(34, 84), (60, 78), (46, 74)], 1.4, closed=True), line(34, 84, 30, 88, 1.4)]
    wheel = [circle(20, 48, 10, 1.4), circle(20, 48, 2, 1.0), line(20, 48, 14, 28, 1.2)]
    soil = [path("M2 92 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0", 1.0, .5), line(2, 96, 98, 96, 1.2)]
    return layer(-4, *soil) + layer(0, *beam, *handles, *wheel) + layer(4, *mould, *share)


def transistor():
    can = [circle(50, 44, 24, 1.8), circle(50, 44, 18, 1.0, .55), line(26, 44, 20, 44, 1.2)]
    crystal = [rect(40, 36, 20, 16, 1.4), line(40, 44, 60, 44, .9, .5)]
    points = [poly([(44, 36), (46, 28), (48, 36)], 1.0, closed=True), poly([(52, 36), (54, 28), (56, 36)], 1.0, closed=True)]
    leads = [line(38, 68, 34, 96, 1.4), line(50, 68, 50, 96, 1.4), line(62, 68, 66, 96, 1.4)]
    wires = [path("M46 28 L40 20 L36 20 M54 28 L60 20 L64 20", 1.0, .7)]
    return layer(-4, *wires) + layer(0, *can, *leads) + layer(4, *crystal, *points)


def mouse():
    shell = [path("M24 28 Q24 14 50 14 Q76 14 76 28 L80 74 Q80 92 50 92 Q20 92 20 74 Z", 1.8)]
    buttons = [line(50, 14, 50, 44, 1.2), path("M24 44 Q50 52 76 44", 1.2)]
    wheels = [circle(30, 62, 5, 1.2), circle(70, 62, 5, 1.2), line(30, 57, 30, 67, .9, .6), line(70, 57, 70, 67, .9, .6)]
    cord = [path("M50 14 Q50 4 62 2", 1.4)]
    button = [circle(50, 30, 3, 1.0, .8)]
    pad = [rect(4, 86, 92, 10, 1.0, .45)]
    return layer(-4, *pad) + layer(0, *shell, *cord) + layer(4, *buttons, *wheels, *button)


def floppy():
    body = [path("M10 6 L78 6 L92 20 L92 94 L10 94 Z", 1.8)]
    shutter = [rect(30, 6, 36, 22, 1.4), rect(52, 10, 10, 14, 1.0, .7)]
    label = [rect(18, 50, 66, 36, 1.2), line(24, 60, 78, 60, .9, .6), line(24, 68, 70, 68, .9, .6), line(24, 76, 64, 76, .9, .6)]
    notch = [rect(78, 14, 8, 6, 1.0, .7)]
    hub = [circle(50, 36, 6, 1.0, .5)] if False else []
    return layer(-4, *notch) + layer(0, *body, *label) + layer(4, *shutter)


ITEMS = [
    dict(id="exp28_ether_anaesthesia", n="Ether Anaesthesia Inhaler", era="science", cat="technology", ds=1846, rar="rare",
         date="Crawford Long 30 March 1842 (announced 1849); Horace Wells 1845; William Morton 16 October 1846; Simpson chloroform 1847", vis="flask-sponge-mask", topic="medicine_exp28",
         region="United States (Georgia, Boston); Scotland (Simpson)", artifactType="anaesthetic apparatus", material="glass flask with sponge and mask", physical=True, durable=False,
         l1="A flask of ether vapour breathed through a mask to make a patient insensible during surgery.",
         l2="Diethyl ether is breathed in as vapour; Morton first called his ether 'Letheon' to hide its nature, and Oliver Wendell Holmes Sr. proposed the terms 'anesthesia' and 'anesthetic'.",
         l3="Crawford Long used ether for a painless operation on James Venable on 30 March 1842 but did not announce it until 1849; Horace Wells gave the first public nitrous-oxide demonstration at Massachusetts General Hospital in 1845; William Morton's public ether demonstration was on 16 October 1846 (surgeon John Collins Warren removed a neck tumour), and James Young Simpson demonstrated chloroform on humans in 1847. Fun fact: Hanaoka Seishū performed surgery under general anaesthesia on 14 November 1804, unpublicised outside Japan until 1854. (not known: what Morton's 'Letheon' contained beyond ether; the page does not say.)",
         ev="Morton's demonstration (16 Oct 1846)", first_known="1804 (Hanaoka Seishū)",
         confidence=dict(level="established", note="The page gives 1845, not 1844, for Wells's demonstration."),
         srcs=[wp("anesthesia_wp", "Anesthesia", "Long 30 March 1842, announced 1849; Wells 1845 nitrous oxide; Morton 16 October 1846 Massachusetts General Hospital, Warren; Simpson chloroform 1847; Hanaoka 14 November 1804; Letheon; Holmes anesthesia.")],
         pool=['chemistry', 'glass', 'exp26_graduated_glass_tube', 'medicine', 'exp28_alembic', 'observation', 'experiment', 'exp26_molten_glass_batch'], must=['medicine'], nrec=2,
         tags=["medicine", "anaesthesia"], regions=["americas", "europe", "africa_asia"], art=ether_inhaler()),
    dict(id="exp28_lister_carbolic_spray", n="Lister's Carbolic Spray", era="science", cat="technology", ds=1867, rar="rare",
         date="Semmelweis handwashing 1847–1848; Lister's 'Antiseptic Principle of the Practice of Surgery' 1867", vis="boiler-nozzle-mist", topic="medicine_exp28",
         region="Scotland and England (Lister); Hungary/Austria (Semmelweis)", artifactType="antiseptic apparatus", material="steam boiler and nozzle", physical=True, durable=True,
         l1="A hand-pumped boiler that sprays carbolic acid mist over a wound during surgery.",
         l2="Lister explained reduced surgical infection through Pasteur's germ theory. Iodine will eventually kill even spores, the hardest microorganisms to inactivate.",
         l3="Semmelweis showed in 1847–1848 that handwashing before delivery reduced puerperal fever (the page does not say it was in Vienna). Joseph Lister published 'Antiseptic Principle of the Practice of Surgery' in 1867 (the page gives no 1865 date). Fun fact: Sumerian clay tablets from 2150 BC advocate similar techniques, and some surgeons took pride in bloodstained gowns even after Semmelweis. (not known: the design of Lister's spray apparatus; the page does not describe it.)",
         ev="Lister's paper (1867)", first_known="2150 BC (Sumerian tablets)",
         confidence=dict(level="uncertain", note="The page does not describe the carbolic spray; the plate shows a generic steam spray."),
         srcs=[wp("antiseptic_wp", "Antiseptic", "Semmelweis handwashing 1847-1848; Lister 1867 Antiseptic Principle of the Practice of Surgery citing Pasteur; Sumerian tablets 2150 BC; Hugh of Lucca and Henri de Mondeville wine; iodine kills spores.")],
         pool=['chemistry', 'medicine', 'exp28_ether_anaesthesia', 'glass', 'exp26_gas_controlled_laboratory_burner', 'exp26_spirit_burner', 'observation', 'experiment', 'exp28_alembic'], must=['medicine'], nrec=2,
         tags=["medicine", "antisepsis"], regions=["europe"], art=carbolic_spray()),
    dict(id="exp28_pasteurization_vat", n="Pasteurisation Vat", era="science", cat="technology", ds=1864, rar="rare",
         date="Spallanzani 1768; Appert 1795, prize January 1810; Pasteur's wine heating 1864; Lederle New York milk 1910", vis="jacketed-vat-thermometer", topic="food_exp28",
         region="France (Arbois, Massy); Italy; United States", artifactType="heat-treatment vessel", material="jacketed metal vat with thermometer", physical=True, durable=True,
         l1="A heated vat that holds liquid at a set temperature long enough to kill the microbes that spoil it.",
         l2="Batch pasteurisation of milk is 63 °C (145 °F) for 30 minutes; HTST is 71.5 °C (160.7 °F) for 15 seconds; Rosenau's early 20th-century standard was 60 °C for 20 minutes.",
         l3="During an 1864 summer holiday in Arbois Louis Pasteur found that briefly heating young wine to 50–60 °C killed microbes without spoiling its final quality. Spallanzani boiled meat broth for an hour and sealed it in 1768; Appert began preserving in sealed jars in 1795 and won the 12,000-franc prize in January 1810. Fun fact: heating wine for preservation has been known in China since AD 1117. (not known: the date of the Pasteur–Bernard 1862 test sometimes cited; the page does not mention it.)",
         ev="Pasteur's Arbois experiments (1864)", first_known="AD 1117 (China, wine)",
         confidence=dict(level="established", note="The page does not mention Pasteur in 1862 or Claude Bernard."),
         srcs=[wp("pasteur_wp", "Pasteurization", "Pasteur Arbois 1864 wine heated 50-60 C; batch 63 C for 30 minutes; HTST 71.5 C for 15 seconds; Spallanzani 1768; Appert 1795, prize January 1810; Lederle 1910; China AD 1117; Yeates can opener 1855.")],
         pool=['fire', 'chemistry', 'exp26_mercury_thermometer_tube', 'exp28_tin_can', 'measurement', 'copper', 'observation', 'experiment', 'glass', 'exp28_six_thermometer'], must=['chemistry'], nrec=2,
         tags=["food", "microbes"], regions=["europe"], art=pasteurizer()),
    dict(id="exp28_ophthalmoscope", n="Helmholtz Ophthalmoscope", era="science", cat="technology", ds=1851, rar="rare",
         date="Babbage 1847; Helmholtz 1851; Rekoss disc 1852; name in common use 1854", vis="mirror-lamp-eye", topic="medicine_exp28",
         region="England (Babbage); Prussia (Helmholtz)", artifactType="eye examination instrument", material="mirror, lenses and lamp", physical=True, durable=True,
         l1="A small mirror with a sight hole that lets a doctor look into the back of the eye.",
         l2="The direct type gives an upright image at about 15× magnification; the indirect gives an inverted image at 2–5× with a headband light and a hand lens, and works even when cataracts cloud the lens.",
         l3="Charles Babbage invented an early instrument in 1847 but could not get an image when demonstrating it, and gave up; Hermann von Helmholtz independently reinvented it in 1851 while teaching, wanting to show why the pupil sometimes looks black. In 1852 his machinist Egbert Rekoss added rotating lens discs. Fun fact: Helmholtz called it an Augenspiegel ('eye mirror') and 'ophthalmoscope' came into common use in 1854. (not known: how many Helmholtz built.)",
         ev="Helmholtz's instrument (1851)", first_known="1847 (Babbage)",
         confidence=dict(level="established", note="Page credits Helmholtz with independent reinvention."),
         srcs=[wp("ophthalmoscope_wp", "Ophthalmoscope", "Babbage 1847; Helmholtz 1851 Augenspiegel; Rekoss disc 1852; name 1854; direct 15x upright; indirect 2-5x inverted; Anagnostakis concave mirror.")],
         pool=['lens', 'glass', 'optics', 'observation', 'exp28_camera_lucida', 'medicine', 'exp28_difference_engine', 'physics', 'copper'], must=['lens'], nrec=2,
         tags=["medicine", "eye"], regions=["europe"], art=ophthalmoscope()),
    dict(id="exp28_einthoven_string_galvanometer", n="Einthoven String Galvanometer ECG", era="electric", cat="science", ds=1901, rar="rare",
         date="Waller 1887 capillary electrometer; Ader string galvanometer 1897; Einthoven first practical ECG 1901; Nobel Prize 1924", vis="string-between-poles", topic="medicine_exp28",
         region="Netherlands (Einthoven); England (Waller); France (Ader)", artifactType="heart recorder", material="quartz string between electromagnet poles", physical=True, durable=True,
         l1="A fine wire between magnet poles that wiggles with each heartbeat and writes the trace on film.",
         l2="Einthoven assigned the letters P, Q, R, S and T to the deflections of the waveform in 1895, likely following Descartes' use of P in geometry.",
         l3="Augustus Waller recorded a human ECG in 1887 using a capillary electrometer, projecting the trace onto a plate fixed to a toy train; Clément Ader invented the string galvanometer in 1897; Einthoven made 'the first practical ECG' with it in 1901 and its precision measurement dates from 1903. He received the 1924 Nobel Prize in Medicine. Fun fact: in 1872 Alexander Muirhead reportedly attached wires to a feverish patient's wrist to record a heartbeat. (not known: the string's material; the page does not state it.)",
         ev="Einthoven's first practical ECG (1901)", first_known="1887 (Waller)",
         confidence=dict(level="established", note="The page gives 1901 and 1903 for Einthoven's galvanometer ECG."),
         srcs=[wp("ecg_wp", "Electrocardiography", "Waller 1887 capillary electrometer toy train; Ader string galvanometer 1897; Einthoven first practical ECG 1901, 1903; Nobel 1924; PQRST letters 1895; Muirhead 1872.")],
         pool=['exp28_galvanometer', 'electricity', 'physics', 'photography', 'exp28_daguerreotype_plate', 'exp28_wet_collodion_plate', 'medicine', 'measurement'], must=['exp28_galvanometer'], nrec=2,
         tags=["medicine", "heart"], regions=["europe"], art=ecg_galvanometer()),
    dict(id="exp28_chamberlen_forceps", n="Chamberlen Obstetric Forceps", era="science", cat="technology", ds=1670, rar="rare",
         date="Chamberlen family reached England 1569; Hugh Chamberlen's failed Paris demonstration 1670; Palfijn 1723; Levret 1747; Smellie 1751; hoard found 1813", vis="crossed-blades-pivot", topic="medicine_exp28",
         region="England (Chamberlen family); France; Flanders (Palfijn)", artifactType="birth instrument", material="iron or steel blades", physical=True, durable=True,
         l1="Two crossed, curved blades that cradle a baby's head to help deliver it.",
         l2="The instrument was kept secret for 150 years by the Chamberlen family and brought into the birthing room in a lined box, used only after everyone had left and the mother was blindfolded.",
         l3="The Chamberlens migrated to England in 1569 to escape religious violence; Peter Chamberlen the elder probably invented the forceps. In 1670 Hugh Chamberlen tried to sell it in Paris and his demonstration for François Mauriceau failed, killing mother and child; Jan Palfijn presented his 'Hands of Palfijn' in 1723, Levret added the pelvic curve in 1747, and Smellie published in England in 1751. Fun fact: in 1813 Peter Chamberlen's midwifery tools were found in the attic of Woodham Mortimer Hall, with gloves and old coins. (not known: the invention date; the page gives none, so 'c. 1600' is not supported and ds uses 1670, the first dated event.)",
         ev="Attic find at Woodham Mortimer Hall (1813)", first_known="1569 (family reaches England)",
         confidence=dict(level="uncertain", note="ds 1670 is the first dated event; the invention date is not given."),
         srcs=[wp("forceps_wp", "Obstetrical_forceps", "Chamberlens reached England 1569; Hugh Chamberlen Paris 1670; Palfijn 1723; Levret 1747; Smellie 1751; Woodham Mortimer Hall 1813; secret for 150 years; lined box and blindfold.")],
         pool=['iron', 'forging', 'steel', 'medicine', 'anc27_iron_medical_forceps', 'exp28_trephine', 'observation', 'casting', 'metallurgy'], must=['medicine'], nrec=2,
         tags=["medicine", "obstetrics"], regions=["europe"], art=chamberlen_forceps()),
    dict(id="exp28_mendeleev_periodic_table", n="Mendeleev's Periodic Table", era="science", cat="science", ds=1869, rar="rare",
         date="Mendeleev's first generally accepted table 1869; noble gases accepted 1902; technetium 1937; group numbering 1988", vis="grid-of-elements", topic="chemistry_exp28",
         region="Russia (Mendeleev)", artifactType="classification chart", material="paper chart", physical=True, durable=True,
         l1="A chart that arranges the elements in rows and columns by weight and recurring properties.",
         l2="Mendeleev framed the periodic law around atomic mass and predicted some properties of 'some of the missing elements'. Helium is nearly always placed in group 18, though some chemists argue for group 2.",
         l3="The page calls Mendeleev's 1869 table the first generally accepted version; he accepted noble-gas evidence in 1902; technetium (1937) was the first element made by synthesis; neptunium (1940) started the search beyond uranium; Glenn Seaborg showed in 1945 that the actinides are f-block elements; IUPAC adopted 1–18 group numbering in 1988. Fun fact: bismuth's almost-stable isotope has a half-life over a billion times the age of the universe. (not known: the exact day of Mendeleev's table, Lothar Meyer, Moseley's atomic number and the names of the predicted elements; this page does not give them.)",
         ev="Mendeleev's periodic law (1869)", first_known="1869",
         confidence=dict(level="established", note="The page does not give an exact day or mention Meyer or Moseley."),
         srcs=[wp("periodic_wp", "Periodic_table", "Mendeleev first generally accepted table 1869; noble gases 1902; technetium 1937; neptunium 1940; Seaborg actinides 1945; IUPAC 1-18 numbering 1988; oganesson 2002; tennessine 2009.")],
         pool=['chemistry', 'mathematics', 'measurement', 'observation', 'paper', 'record_keeping', 'writing', 'experiment', 'number_system', 'physics'], must=['chemistry'], nrec=2,
         tags=["chemistry", "elements"], regions=["europe"], art=periodic_table()),
    dict(id="exp28_portland_cement_kiln", n="Portland Cement Kiln", era="industry", cat="material", ds=1824, rar="rare",
         date="Smeaton's experiments 1756; Joseph Aspdin patent 1824; William Aspdin's calcium silicates in the 1840s", vis="rotating-tube-clinker", topic="building_materials_exp28",
         region="England (Aspdin, Smeaton; Isle of Portland)", artifactType="cement-burning kiln", material="brick-lined iron tube", physical=True, durable=True,
         l1="A sloping furnace that bakes limestone and clay into clinker ground into cement.",
         l2="Aspdin named his cement 'Portland' for its resemblance to Portland stone; the page calls his product a 'proto-Portland cement', a first step rather than the modern version.",
         l3="Joseph Aspdin patented it in 1824. Modern Portland-cement development began in 1756 when John Smeaton experimented with limestone and additives for a lighthouse (Smeaton's Tower); Louis Vicat's cement is the 'principal forerunner'. Fun fact: at 4.4 billion tons in 2023 it ranks third by mass among manufactured materials behind sand and gravel, and cement is about 10% of world CO₂ emissions. (not known: when Isaac Johnson refined meso-Portland cement; the page gives no date.)",
         ev="Aspdin's patent (1824)", first_known="1756 (Smeaton)",
         confidence=dict(level="established", note="The 1840s date belongs to William Aspdin; the page gives no date for Isaac Johnson."),
         srcs=[wp("cement_wp", "Portland_cement", "Aspdin patent 1824 proto-Portland; Smeaton 1756 lighthouse; Vicat principal forerunner; William Aspdin 1840s; Johnson meso-Portland undated; 4.4 billion tons 2023; 10% of CO2.")],
         pool=['lime', 'kiln', 'brick', 'mortar', 'chemistry', 'coal', 'engineering', 'exp28_coke_blast_furnace', 'iron', 'fire'], must=['lime'], nrec=2,
         tags=["cement", "building"], regions=["europe"], art=portland_kiln()),
    dict(id="exp28_vulcanized_rubber", n="Vulcanised Rubber", era="industry", cat="material", ds=1839, rar="rare",
         date="Goodyear 1839 (patent 30 January 1844); Hancock patent 21 November 1843; Mesoamerican sulfur-cured rubber (undated)", vis="crosslinked-chains", topic="materials_exp28",
         region="United States (Goodyear); England (Hancock); Mesoamerica", artifactType="processed material", material="natural rubber cured with sulfur", physical=True, durable=True,
         l1="Rubber heated with sulfur so it turns firm, springy and weatherproof.",
         l2="Heating rubber with sulfur forms cross-links between polymer chains, making the rubber more rigid and durable; the change is generally irreversible. William Brockedon suggested the name after Vulcan.",
         l3="One day in 1839 Charles Goodyear dropped a rubber-and-sulfur mixture into a hot frying pan and it stayed firm, hardening as it got hotter; he patented the process on 30 January 1844, but Thomas Hancock had patented the sulfur process in Britain on 21 November 1843. Fun fact: most rubber products are vulcanised, including tyres, shoe soles and erasers. (not known: the date of the Mesoamericans' sulfur-rich plant-juice curing; the page gives none.)",
         ev="Goodyear's patent (30 Jan 1844); Hancock's patent (21 Nov 1843)", first_known="undated (Mesoamerican)",
         confidence=dict(level="debated", note="Goodyear's discovery (1839) and Hancock's earlier British patent (1843) are both recorded."),
         srcs=[wp("vulcan_wp", "Vulcanization", "Goodyear 1839 frying pan, patent 30 January 1844; Hancock patent 21 November 1843; sulfur cross-links; Mesoamerican sulfur-rich plant juices; Brockedon named it; tyres, soles, erasers.")],
         pool=['chemistry', 'fire', 'experiment', 'cloth', 'observation', 'fiber', 'cordage', 'coal', 'iron'], must=['chemistry'], nrec=2,
         tags=["rubber", "chemistry"], regions=["americas", "europe"], art=vulcanized_rubber()),
    dict(id="exp28_nylon_66", n="Nylon 66", era="industry", cat="material", ds=1935, rar="rare",
         date="Carothers synthesised nylon 66 on 28 February 1935; US patent 20 September 1938; stockings sold 24 October 1939; Seaford plant 15 December 1939", vis="spinneret-filaments", topic="materials_exp28",
         region="United States (DuPont, Delaware); Germany (Schlack, nylon 6)", artifactType="synthetic fibre", material="polyamide", physical=True, durable=True,
         l1="A man-made thread spun from melted polymer through a nozzle plate.",
         l2="The page calls nylon the first commercially successful synthetic thermoplastic polymer; DuPont's 1938 announcement described it as the 'first man-made organic textile fibre'.",
         l3="Wallace Carothers, a Harvard instructor hired by DuPont, synthesised nylon 66 on 28 February 1935 and died 16 months before nylon was announced; US patent 2130523 followed on 20 September 1938; nylon stockings first sold in Wilmington on 24 October 1939 (4,000 pairs in three hours); the first plant at Seaford began production on 15 December 1939. Fun fact: the name came from 'No-Run', changed to avoid an unjustified claim. (not known: what the 'nyl' in nylon stands for; the page says only that it came from 'No-Run'.)",
         ev="US patent 2130523 (20 Sept 1938)", first_known="28 February 1935",
         confidence=dict(level="established", note="Paul Schlack's nylon 6 (29 January 1938) is a separate molecule."),
         srcs=[wp("nylon_wp", "Nylon", "Carothers synthesised nylon 66 28 February 1935; patent 2130523 20 September 1938; stockings 24 October 1939; Seaford 15 December 1939; Schlack nylon 6 29 January 1938; No-Run; 64 million pairs first year.")],
         pool=['chemistry', 'exp28_vulcanized_rubber', 'fiber', 'coal', 'cloth', 'experiment', 'plastic', 'machine_tools', 'physics'], must=['chemistry'], nrec=2,
         tags=["polymer", "textile"], regions=["americas", "europe"], art=nylon_spinneret()),
    dict(id="exp28_hall_heroult_cell", n="Hall–Héroult Electrolytic Cell", era="electric", cat="technology", ds=1886, rar="rare",
         date="Héroult French patent filed 23 April 1886; Hall US patent issued 2 April 1889; Hall's Pittsburgh plant 1888", vis="anodes-in-cryolite-bath", topic="metals_exp28",
         region="United States (Hall, Pittsburgh); France (Héroult)", artifactType="aluminium smelting cell", material="carbon-lined steel pot, carbon anodes", physical=True, durable=True,
         l1="A carbon-lined pot where electric current splits alumina dissolved in molten cryolite into aluminium.",
         l2="Alumina is dissolved in molten cryolite to lower its melting point (pure alumina melts at 2072 °C); electrolysis runs at about 940–980 °C and aluminium collects at the cathode and sinks to the bottom.",
         l3="Charles Martin Hall and Paul Héroult independently discovered it in 1886, both 22 years old; Héroult's French patent 175,711 was filed 23 April 1886 and issued 1 September 1886; Hall's US patent 400,664 was issued on 2 April 1889 and his first large plant (later Alcoa) opened in Pittsburgh in 1888. Fun fact: in 1884 aluminium was still pricier than silver when chosen for the Washington Monument's cap. (not known: Henri Sainte-Claire Deville's earlier work; the page does not mention him.)",
         ev="Héroult's patent (23 April 1886); Hall's patent (2 April 1889)", first_known="1886",
         confidence=dict(level="established", note="Page says independent, near-simultaneous discovery in 1886."),
         srcs=[wp("hallheroult_wp", "Hall%E2%80%93H%C3%A9roult_process", "Independent discovery 1886 by Hall and Heroult aged 22; Heroult patent 175,711 filed 23 April 1886; Hall US 400664 issued 2 April 1889; Pittsburgh 1888; cryolite; 940-980 C; Washington Monument cap 1884.")],
         pool=['electricity', 'exp28_pixii_dynamo', 'chemistry', 'metallurgy', 'smelting', 'coal', 'exp28_voltaic_pile', 'iron'], must=['electricity'], nrec=2,
         tags=["aluminium", "electrolysis"], regions=["americas", "europe"], art=hall_heroult()),
    dict(id="exp28_float_glass_line", n="Pilkington Float Glass Line", era="industry", cat="technology", ds=1957, rar="rare",
         date="Bessemer's tin-bath patent 22 September 1848; Pilkington and Bickerstaff developed it 1953–1957; profitable sales 1960", vis="glass-ribbon-on-tin", topic="glass_exp28",
         region="England (St Helens, Lancashire)", artifactType="glass manufacturing line", material="molten tin bath and furnace", physical=True, durable=True,
         l1="A long line where molten glass spreads out on a bath of liquid tin to make perfectly flat sheets.",
         l2="The tin bath is about 3–4 m wide, 50 m long and 6 cm deep; tin works because it is denser than glass and boils above glass's melting point; a nitrogen and hydrogen atmosphere stops it oxidising.",
         l3="Alastair Pilkington and Kenneth Bickerstaff developed the process at the Cowley Hill Works, St Helens, between 1953 and 1957 (the page gives no 1952 or 1959 start/end dates); full-scale profitable sales came in 1960 and it was licensed worldwide in the 1960s. Henry Bessemer had patented a tin-bath idea in 1848 (British patent 12,101) but it was unworkable. Fun fact: the lehr that anneals the glass is about 100 m long. (not known: Bicheroux's earlier process; the page does not mention it.)",
         ev="Cowley Hill Works development (1953–1957)", first_known="1848 (Bessemer's patent)",
         confidence=dict(level="established", note="ds uses the end of the development period (1957); full sales came in 1960."),
         srcs=[wp("floatglass_wp", "Float_glass", "Pilkington and Bickerstaff 1953-1957 Cowley Hill Works St Helens; sales 1960; Bessemer patent 12,101 of 22 September 1848; tin bath 3-4 m wide 50 m long 6 cm deep; nitrogen and hydrogen; lehr 100 m.")],
         pool=['glass', 'exp26_molten_glass_batch', 'kiln', 'fire', 'iron', 'chemistry', 'engineering', 'exp28_bessemer_converter', 'exp28_hall_heroult_cell', 'copper'], must=['glass'], nrec=2,
         tags=["glass", "flat"], regions=["europe"], art=float_glass()),
    dict(id="exp28_haber_bosch_reactor", n="Haber–Bosch Ammonia Reactor", era="industry", cat="technology", ds=1909, rar="rare",
         date="Haber and Le Rossignol demonstration summer 1909; Mittasch iron catalyst 1909; Bosch scale-up 1910; Oppau plant 1913; Nobel prizes 1918 and 1931", vis="pressure-vessel-catalyst-beds", topic="chemistry_exp28",
         region="Germany (Karlsruhe, BASF Oppau)", artifactType="high-pressure reactor", material="steel pressure vessel with iron catalyst", physical=True, durable=True,
         l1="A high-pressure steel tower that makes ammonia from nitrogen in air and hydrogen.",
         l2="Haber and Le Rossignol made ammonia from air at about 125 mL per hour in 1909; Alwin Mittasch's much cheaper iron-based catalyst is still used.",
         l3="Carl Bosch scaled the tabletop apparatus up to industrial size for BASF in 1910; ammonia was first made on an industrial scale at Oppau in 1913, reaching 20 tonnes a day in 1914; Haber and Bosch received Nobel Prizes in Chemistry in 1918 and 1931. Fun fact: the page calls it the 'detonator of the population explosion', and nearly 50% of the nitrogen in human tissues is said to come from it. (not known: the first catalyst Haber tried beyond osmium; the page says uranium was nearly as effective.)",
         ev="Oppau plant (1913)", first_known="1909",
         confidence=dict(level="established", note="Page dates the lab demonstration to summer 1909."),
         srcs=[wp("haber_wp", "Haber_process", "Haber and Le Rossignol summer 1909 125 mL/hour; Mittasch iron catalyst 1909; Bosch 1910; Oppau 1913, 20 tonnes/day 1914; Nobel 1918 and 1931; 230 million tonnes 2018; 3-5% of natural gas.")],
         pool=['chemistry', 'steel', 'iron', 'electricity', 'engineering', 'exp26_pressure_vessel_parts', 'experiment', 'machine_tools', 'exp28_bessemer_converter', 'physics'], must=['chemistry'], nrec=2,
         tags=["ammonia", "fertiliser"], regions=["europe"], art=haber_bosch()),
    dict(id="exp28_cartwright_power_loom", n="Power Loom", era="industry", cat="technology", ds=1785, rar="rare",
         date="Cartwright patent 1785; water-driven versions 1787; Horrocks 1803, 1813, 1821; Roberts Loom 1830", vis="frame-warp-reed-shuttle", topic="textile_machines_exp28",
         region="England (Cartwright; Stockport; Lancashire)", artifactType="weaving machine", material="timber and iron frame", physical=True, durable=True,
         l1="A weaving loom driven by water or steam power instead of by hand.",
         l2="Cartwright's 1785 loom was 'initially hand-operated and mechanically crude'; looms had to stop to dress the warp. Weaving speeds rose from 120–130 picks per minute on a Cartwright loom to 220–260 on a Lancashire loom.",
         l3="By 1787 Cartwright had water-driven versions and soon coupled looms to steam; Horrocks kept a wooden frame in 1803 and improved the lathe motion in 1813; in 1830 the Roberts Loom added a geared take-up wheel and tappets for multiple heddles. Fun fact: the 1816 Calton weavers' riot had about two thousand rioters trying to destroy power-loom mills. (not known: whether the Roberts Loom was iron; the page does not say, nor mention the Luddites.)",
         ev="Cartwright's patent (1785)", first_known="1785",
         confidence=dict(level="established", note="The page does not mention iron frames or the Luddites."),
         srcs=[wp("powerloom_wp", "Power_loom", "Cartwright patent 1785; water-driven 1787; Horrocks 1803, 1813, 1821; Roberts 1830; 120-130 picks vs 220-260; Calton riot 1816; UK looms 2,400 in 1803 to 250,000 in 1857.")],
         pool=['weaving_shuttle', 'steam_engine', 'water_power', 'gear', 'wood', 'iron', 'exp28_spinning_mule', 'exp28_water_frame', 'cloth', 'mechanism', 'machine_tools'], must=['weaving_shuttle'], nrec=2,
         tags=["weaving", "loom"], regions=["europe"], art=power_loom()),
    dict(id="exp28_kay_flying_shuttle", n="Kay's Flying Shuttle", era="industry", cat="technology", ds=1733, rar="rare",
         date="John Kay patent 1733; patent suits 1737–1743; drop box by Robert Kay; reached the United States 1788", vis="shuttle-boxes-picker", topic="textile_machines_exp28",
         region="England (John Kay, Lancashire); France", artifactType="loom attachment", material="wood shuttle with iron tips", physical=True, durable=True,
         l1="A shuttle knocked through the warp by a cord-pulled picker so one weaver can weave wide cloth.",
         l2="It let one weaver operate a loom that previously needed two people for wide cloth and roughly doubled weaving productivity; weaving then outpaced spinning, spurring spinning inventions.",
         l3="John Kay patented it in 1733; the uprising it caused largely ignored the patent, and Kay's partners sued weavers between 1737 and 1743; shuttle makers formed the 'Shuttle Club' to fight them. His son Robert invented the drop box for patterned multicoloured cloth. Fun fact: in 1901 the House of Commons debated guards because the shuttle could be thrown from the loom and hurt workers. (not known: the 1753 'Wheel Shuttle' attack the page calls doubtful, since it is not recorded before the 19th century.)",
         ev="Kay's patent (1733)", first_known="1733",
         confidence=dict(level="established", note="The page says Kay moved to France to rent out looms, not to flee an attack."),
         srcs=[wp("flyingshuttle_wp", "Flying_shuttle", "Kay patented 1733; one weaver for wide cloth; suits 1737-1743; Shuttle Club; Robert Kay drop box; 1753 attack doubtful; 1901 guards debate; US 1788.")],
         pool=['weaving_shuttle', 'wood', 'cordage', 'lever', 'cloth', 'fiber', 'mechanism', 'exp28_spinning_wheel', 'anc27_warp_weighted_loom', 'anc27_ground_horizontal_loom'], must=['weaving_shuttle'], nrec=2,
         tags=["weaving", "shuttle"], regions=["europe"], art=flying_shuttle()),
    dict(id="exp28_bell_reaper", n="Bell's Mechanical Reaper", era="agriculture", cat="technology", ds=1828, rar="rare",
         date="Gallic reaper in Roman times; Patrick Bell 1828; McCormick claimed 1831, patent issued 21 June 1834; Hussey 1833", vis="reel-cutter-bar-wheel", topic="farming_exp28",
         region="Scotland (Bell); United States (McCormick, Hussey); Roman Gaul", artifactType="harvesting machine", material="timber frame, iron cutter bar", physical=True, durable=True,
         l1="A horse-drawn machine with a spinning reel and a toothed bar that cuts standing grain.",
         l2="Hussey's sawlike cutter bar was a key advantage; the Hussey reaper needed two horses, one operator and a driver. McCormick gained rights to that mechanism around 1850.",
         l3="The first documented reaping machines were Gallic reapers of Roman times in what is now France (no date); Patrick Bell invented a reaper in Scotland in 1828; Cyrus McCormick claimed 1831, with his patent issued 21 June 1834; Obed Hussey patented his in Ohio in 1833. Fun fact: in 1861 the US Patent Office ruled that Hussey's improvements were the foundation of the reaper's success. (not known: the date of the Gallic reaper; the page does not mention Pliny or a 'vallus'.)",
         ev="Bell's reaper (1828); McCormick patent (21 June 1834)", first_known="Roman times (Gallic reaper)",
         confidence=dict(level="debated", note="McCormick's 1831 date is his own claim."),
         srcs=[wp("reaper_wp", "Reaper", "Gallic reaper Roman times; Bell 1828; McCormick claimed 1831, patent 21 June 1834; Hussey 1833 Ohio; sawlike cutter bar; 1861 Patent Office ruling; Springfield Ohio.")],
         pool=['farming_tools', 'wheel', 'axle', 'wood', 'iron', 'gear', 'exp26_reaper_cutter_bar', 'exp28_horse_collar', 'lever'], must=['farming_tools'], nrec=2,
         tags=["farming", "harvest"], regions=["europe", "americas"], art=bell_reaper()),
    dict(id="exp28_deere_steel_plough", n="Deere's Steel Plough", era="agriculture", cat="technology", ds=1837, rar="rare",
         date="Rotherham plough 1730; Ransome chilled ploughshares 1789; John Deere steel plough 1837; stump-jump plough 1876", vis="beam-mouldboard-share", topic="farming_exp28",
         region="United States (John Deere); England (Foljambe, Ransome); Australia", artifactType="plough", material="polished steel mouldboard", physical=True, durable=True,
         l1="A plough with a polished steel blade that turns sticky prairie soil without clogging.",
         l2="Early mould-board ploughs could only turn soil to one side, so fields were ploughed in long strips; the furlong and the acre come from those strip sizes.",
         l3="Joseph Foljambe developed the Rotherham plough in 1730; Robert Ransome started casting ploughshares by chilled casting at Ipswich in 1789; John Deere introduced a steel plough in 1837; Richard Bowyer Smith invented the stump-jump plough in Australia in 1876. Fun fact: the Romans used 'aratrum' for the early wheel-less plough. (not known: Jethro Tull's role; the page does not mention him, only Jethro Wood.)",
         ev="Deere's steel plough (1837)", first_known="c. 2800 BCE (ploughed field, Kalibangan)",
         confidence=dict(level="established", note="The page gives c. 2800 BCE for the Kalibangan field and 1st–2nd century AD for the Han heavy plough."),
         srcs=[wp("plough_wp", "Plough", "Kalibangan c. 2800 BCE; detachable ploughshares c. 1000 BC; iron ploughshares China c. 500 BC; Han mould-board 1st-2nd century AD; 643 Europe; Rotherham 1730; Ransome 1789; Deere 1837; stump-jump 1876.")],
         pool=['steel', 'iron', 'wood', 'farming_tools', 'stone_ploughshare', 'forging', 'metallurgy', 'exp28_puddling_furnace', 'exp28_bessemer_converter'], must=['iron'], nrec=2,
         tags=["farming", "plough"], regions=["americas", "europe"], art=steel_plough()),
    dict(id="exp28_point_contact_transistor", n="Point-Contact Transistor", era="electric", cat="technology", ds=1947, rar="rare",
         date="Lilienfeld's FET patent 1925; Bardeen and Brattain at Bell Labs, 17 November–23 December 1947; Shockley junction patent 26 June 1948; Nobel 1956; MOSFET 1959–1960", vis="crystal-two-points-can", topic="electronics_exp28",
         region="United States (Bell Labs); Canada (Lilienfeld)", artifactType="semiconductor amplifier", material="germanium crystal with two metal points", physical=True, durable=True,
         l1="A tiny crystal with two sharp metal points that amplifies electrical signals without a vacuum tube.",
         l2="John Pierce coined 'transistor' as a contraction of 'transresistance'. MOSFETs now account for about 99.9% of all transistors; more than 13 sextillion had been made by 2018.",
         l3="Julius Lilienfeld filed a Canadian patent for a field-effect transistor in 1925 but had no working prototype; John Bardeen and Walter Brattain observed a signal with greater output power than input between 17 November and 23 December 1947; William Shockley applied for his junction patent on 26 June 1948; the three shared the 1956 Nobel Prize in Physics; Atalla and Kahng proposed the silicon MOS transistor in 1959 and demonstrated it in 1960. Fun fact: the Sony TR-63 (1957) was the first mass-produced transistor radio. (not known: the exact day in December 1947 the page treats as the end of the experiments, beyond 23 December.)",
         ev="Bell Labs experiments (17 Nov–23 Dec 1947)", first_known="1925 (Lilienfeld patent)",
         confidence=dict(level="established", note="Page gives 1947 for the point-contact device and 1948 for Shockley's junction patent."),
         srcs=[wp("transistor_wp", "Transistor", "Lilienfeld 1925; Bardeen and Brattain 17 November-23 December 1947; Shockley patent 2,569,347 filed 26 June 1948; Nobel 1956; MOSFET 1959-1960; Pierce coined transistor; Sony TR-63 1957; 13 sextillion by 2018.")],
         pool=['vacuum_tube', 'electronics', 'semiconductor', 'physics', 'electricity', 'experiment', 'chemistry'], must=['semiconductor'], nrec=2,
         tags=["electronics", "semiconductor"], regions=["americas"], art=transistor()),
    dict(id="exp28_engelbart_mouse", n="Engelbart's Computer Mouse", era="computing", cat="computing", ds=1963, rar="rare",
         date="Engelbart's notebook idea 14 November 1963; first prototype with Bill English 1964; Telefunken Rollkugel shown 2 October 1968; demo 9 December 1968", vis="shell-wheels-cord", topic="computing_input_exp28",
         region="United States (SRI, Menlo Park); Germany (Telefunken)", artifactType="pointing device", material="shell with two wheels", physical=True, durable=True,
         l1="A hand-sized box with a button that moves a pointer on a screen.",
         l2="The cursor was once called 'CAT', which may have inspired the name 'mouse'; SRI held the patent and it expired before the mouse became widely used.",
         l3="Douglas Engelbart first recorded the idea in his notebook on 14 November 1963; Bill English helped build the first prototype in 1964; Telefunken's Rollkugel ball mouse appeared in a sales brochure on 2 October 1968, a parallel invention; Engelbart demonstrated the mouse publicly at 'The Mother of All Demos' on 9 December 1968. Fun fact: Engelbart never received royalties, and Logitech built its billionth mouse in November 2008. (not known: the 1964 wooden shell and a 1970 patent year; the page gives neither, and gives no date for Xerox's first mouse except Bill English's ball mouse of 1972.)",
         ev="The Mother of All Demos (9 December 1968)", first_known="14 November 1963",
         confidence=dict(level="established", note="The page does not mention a wooden shell or a patent year."),
         srcs=[wp("mouse_wp", "Computer_mouse", "Engelbart notebook 14 November 1963; English prototype 1964; Telefunken 2 October 1968; demo 9 December 1968; SRI patent; Xerox PARC ball mouse 1972; CAT cursor; Logitech billionth November 2008.")],
         pool=['computer', 'electronics', 'wheel', 'wood', 'mechanism', 'electricity', 'exp28_hollerith_tabulator', 'exp28_cam_and_follower', 'exp26_telegraph_key_contact'], must=[], nrec=2,
         tags=["computing", "input"], regions=["americas", "europe"], art=mouse()),
    dict(id="exp28_floppy_disk", n="Floppy Disk", era="computing", cat="computing", ds=1971, rar="uncommon",
         date="IBM 8-inch 1971; Shugart 5.25-inch 1976; 1.44 MB 3.5-inch shipped 1986; iMac without drive 1998; Sony ended sales March 2011", vis="jacket-shutter-label", topic="computing_storage_exp28",
         region="United States (IBM, Shugart Associates); Japan (Sony)", artifactType="magnetic storage medium", material="magnetic disc in a plastic jacket", physical=True, durable=False,
         l1="A flexible magnetic disc in a plastic case that stores a small amount of data.",
         l2="IBM's 8-inch 3740 format stored 242,944 bytes; the common 5.25-inch DOS capacity was 360 KB; high-density 3.5-inch held 1.44 MB (1,474,560 bytes).",
         l3="The page says 8-inch disks were 'invented and made by IBM in 1971', Shugart Associates introduced the 5.25-inch drive in 1976, the 1.44 MB 3.5-inch drive first shipped in 1986, Apple's iMac G3 shipped without a drive in 1998, and Sony ended domestic sales in March 2011. Fun fact: many programs still use a floppy-disk icon for 'save', and British Airways' 747-400 fleet loaded avionics from 3.5-inch floppies until 2020. (not known: Alan Shugart's role and a 1981 Sony release; the page gives neither.)",
         ev="IBM's 8-inch disks (1971)", first_known="1971",
         confidence=dict(level="established", note="The page gives no release date for the 3.5-inch Sony design."),
         srcs=[wp("floppy_wp", "Floppy_disk", "IBM 8-inch 1971 242,944 bytes; Shugart 5.25-inch 1976 360 KB; 3.5-inch 1.44 MB shipped 1986; iMac G3 1998; Sony ended March 2011; five billion in use 1996; save icon; BA 747-400 until 2020.")],
         pool=['memory', 'storage', 'electronics', 'computer', 'exp28_hollerith_tabulator', 'physics', 'electricity', 'plastic', 'exp28_jacquard_card_chain', 'exp28_engelbart_mouse'], must=['storage'], nrec=2,
         tags=["computing", "storage"], regions=["americas"], art=floppy()),
]
