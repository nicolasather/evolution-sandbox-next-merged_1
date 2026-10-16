"""EXP28 batch 11 — signalling, arms and armour, wind instruments, farming and workshop tools, sanitation, weather.
Facts only from pages fetched 2026-10-16. Unknowns are stated as '(not known)' in l3, followed by a fun fact from the same page."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def optical_telegraph():
    tower = [rect(42, 40, 16, 54, 1.8), line(42, 54, 58, 54, 1.0, .5), line(42, 70, 58, 70, 1.0, .5), rect(46, 80, 8, 14, 1.0, .6)]
    mast = [line(50, 40, 50, 20, 2.0)]
    beam = [line(26, 20, 74, 20, 2.2), circle(26, 20, 2, 1.2), circle(74, 20, 2, 1.2)]
    arms = [line(26, 20, 20, 8, 1.6), line(26, 20, 22, 32, 1.6), line(74, 20, 82, 10, 1.6), line(74, 20, 80, 30, 1.6)]
    rods = [line(30, 20, 30, 44, .9, .5), line(70, 20, 70, 44, .9, .5)]
    hill = [path("M0 94 Q30 80 50 94 Q70 84 100 94", 1.0, .5)]
    return layer(-4, *hill, *rods) + layer(0, *tower, *mast, *beam) + layer(4, *arms)


def pavise():
    body = [path("M26 10 L74 10 L74 78 L50 90 L26 78 Z", 1.8)]
    ridge = [line(50, 10, 50, 90, 1.6), path("M26 10 L50 14 L74 10", 1.0, .6)]
    canvas = [line(26 + i * 8, 12 + (i % 2) * 2, 26 + i * 8, 78 - (i % 2) * 2, .9, .45) for i in range(1, 6)]
    spike = [line(50, 90, 50, 98, 1.8), poly([(47, 94), (53, 94), (50, 100)], 1.0, closed=True)]
    emblem = [circle(38, 40, 5, 1.0, .7), path("M62 34 L66 46 L58 46 Z", 1.0, .7)]
    return layer(-4, *canvas) + layer(0, *body, *spike) + layer(4, *ridge, *emblem)


def steelyard():
    beam = [line(8, 40, 94, 40, 2.0), circle(34, 40, 3, 1.4), line(34, 40, 34, 28, 1.4)]
    hook = [path("M34 28 q0 -8 6 -8", 1.4)]
    pan = [line(14, 40, 14, 62, 1.2), path("M4 62 L24 62", 1.4), path("M6 62 Q14 74 22 62", 1.2)]
    poise = [line(70, 40, 70, 50, 1.2), circle(70, 56, 6, 1.6)]
    marks = [line(46 + i * 6, 40, 46 + i * 6, 44 - (i % 2) * 2, .9, .75) for i in range(9)]
    goods = [rect(8, 68, 12, 10, 1.0, .6)]
    return layer(-4, *goods) + layer(0, *beam, *pan) + layer(4, *hook, *poise, *marks)


def lamellar():
    rows = []
    for r in range(5):
        for c in range(6):
            rows.append(rect(10 + c * 14 + (r % 2) * 5, 14 + r * 14, 12, 12, 1.2))
    laces = [line(10, 20 + r * 14, 94, 20 + r * 14, .9, .6) for r in range(5)] + [circle(16 + c * 14, 20, .9, .8, fill=True) for c in range(6)]
    neck = [path("M34 14 Q50 4 66 14", 1.4)]
    return layer(-4, *neck) + layer(0, *rows) + layer(4, *laces)


def mail_armour():
    rings = []
    for r in range(6):
        for c in range(7):
            rings.append(circle(12 + c * 12 + (r % 2) * 6, 14 + r * 12, 5, 1.0, None if (r + c) % 2 == 0 else .75))
    link = [line(18, 8, 18, 4, 1.2), line(54, 8, 54, 4, 1.2)]
    collar = [path("M20 6 Q50 -4 80 6", 1.4)]
    return layer(-4, *collar) + layer(0, *rings) + layer(4, *link)


def shawm():
    body = [path("M40 20 L60 20 L64 90 L36 90 Z", 1.8)]
    bell = [path("M30 92 Q50 100 70 92 L64 82 L36 82 Z", 1.4)]
    holes = [circle(50, 34 + i * 7, 2, 1.0) for i in range(6)]
    reed = [line(50, 20, 50, 8, 1.4), path("M44 8 L56 8 L53 3 L47 3 Z", 1.2), rect(44, 18, 12, 4, 1.2)]
    pirouette = [ellipse(50, 24, 9, 3, 1.2)]
    sound = [path("M72 76 q8 -6 8 -12 M78 82 q12 -8 12 -16", 1.0, .5)]
    return layer(-4, *sound) + layer(0, *body, *bell) + layer(4, *reed, *pirouette, *holes)


def sheng():
    bowl = [path("M24 74 Q24 54 50 54 Q76 54 76 74 Q76 92 50 92 Q24 92 24 74 Z", 1.8), line(50, 54, 50, 40, 1.2)]
    pipes = []
    for i in range(9):
        a = i * 20 - 80
        x = 50 + a * .55
        h = 46 - abs(a) * .12
        pipes += [rect(x - 2, 50 - h, 4, h, 1.2), circle(x, 30 + abs(a) * .1, 1, .8)]
    mouth = [line(76, 70, 92, 62, 1.8), rect(90, 58, 6, 8, 1.2)]
    reeds = [line(30, 64, 70, 64, .9, .5)]
    return layer(-4, *reeds) + layer(0, *bowl, *mouth) + layer(4, *pipes)


def natural_horn():
    coil = [circle(50, 56, 38, 1.8), circle(50, 56, 31, 1.4), circle(50, 56, 24, 1.0, .6)]
    bell = [path("M12 56 Q2 30 22 22 Q18 40 20 56", 1.6) if False else path("M14 70 Q0 80 8 94 Q30 96 34 80", 1.6)]
    mouth = [line(86, 30, 96, 24, 1.8), circle(98, 22, 3, 1.4)]
    crook = [circle(70, 28, 6, 1.2), line(64, 28, 56, 28, 1.0)]
    hand = [path("M22 84 Q16 90 24 94", 1.0, .6)]
    return layer(-4, *hand) + layer(0, *coil, *bell, *mouth) + layer(4, *crook)


def brass_valve():
    cyl = [rect(32, 30, 12, 50, 1.6), rect(56, 30, 12, 50, 1.6)]
    piston = [line(38, 14, 38, 66, 1.6), rect(34, 8, 8, 6, 1.2), line(62, 14, 62, 54, 1.6), rect(58, 8, 8, 6, 1.2)]
    tubes = [path("M32 80 Q20 96 50 96 Q80 96 68 80", 1.4), path("M44 40 Q50 48 56 40", 1.0, .6)]
    spring = [path("M38 66 q-4 -2 0 -4 q4 -2 0 -4", 1.0, .7), path("M62 54 q-4 -2 0 -4 q4 -2 0 -4", 1.0, .7)]
    ports = [circle(32, 50, 2, 1.0), circle(68, 50, 2, 1.0)]
    return layer(-4, *spring) + layer(0, *cyl, *tubes) + layer(4, *piston, *ports)


def pitch_pipe():
    body = [rect(8, 40, 84, 20, 1.8)] + [line(8 + i * 12, 40, 8 + i * 12, 60, 1.0, .5) for i in range(1, 7)]
    reeds = [rect(14 + i * 12, 46, 6, 8, 1.0) for i in range(7)]
    mouth = [rect(92, 44, 6, 12, 1.2), line(8, 50, 2, 50, 1.2)]
    labels = [circle(17 + i * 12, 66, 1.4, .9, fill=True) for i in range(7)]
    breath = [path("M98 50 q4 -4 0 -8", 1.0, .5)]
    return layer(-4, *breath) + layer(0, *body, *mouth) + layer(4, *reeds, *labels)


def screw_press():
    frame = [rect(18, 8, 64, 8, 1.6), line(22, 16, 22, 88, 1.8), line(78, 16, 78, 88, 1.8), rect(14, 88, 72, 6, 1.6)]
    screw = [line(50, 4, 50, 62, 2.0)] + [path(f"M44 {18 + i * 6} L56 {22 + i * 6}", 1.0, .8) for i in range(7)]
    bar = [line(24, 4, 76, 4, 2.2), circle(24, 4, 2, 1.2), circle(76, 4, 2, 1.2)]
    plate = [rect(32, 62, 36, 6, 1.6)]
    bed = [rect(30, 78, 40, 10, 1.4), line(30, 83, 70, 83, 1.0, .5)]
    drip = [path("M36 92 q-2 4 0 6 M64 92 q2 4 0 6", 1.0, .6)]
    return layer(-4, *drip) + layer(0, *frame, *bed) + layer(4, *screw, *bar, *plate)


def seed_drill():
    hopper = [path("M30 20 L70 20 L62 44 L38 44 Z", 1.8), line(30, 20, 70, 20, 1.6)]
    tubes = [line(40 + i * 7, 44, 38 + i * 8, 76, 1.2) for i in range(4)]
    shares = [poly([(36 + i * 8, 76), (42 + i * 8, 76), (39 + i * 8, 84)], 1.0, closed=True) for i in range(4)]
    wheel = [circle(78, 66, 20, 1.8), circle(78, 66, 3, 1.2), spokes(78, 66, 6, 18, 3, 0, 1.0, .6)]
    frame = [line(24, 44, 78, 66, 1.4), line(10, 30, 30, 36, 1.4)]
    furrow = [line(2, 90, 98, 90, 1.2), path("M30 92 q4 -4 8 0 t8 0 t8 0", 1.0, .5)]
    seeds = [circle(38 + i * 8, 62, 1, .8, fill=True) for i in range(4)]
    return layer(-4, *furrow) + layer(0, *hopper, *wheel, *frame) + layer(4, *tubes, *shares, *seeds)


def hand_plane():
    body = [path("M4 66 L96 66 L96 54 L74 50 L74 40 L60 40 L60 52 L4 56 Z", 1.8)]
    mouth = [rect(54, 56, 8, 10, 1.0), line(58, 40, 58, 62, 1.4)]
    blade = [poly([(60, 40), (68, 40), (62, 66)], 1.2, closed=True), line(62, 66, 62, 70, 1.4)]
    tote = [path("M84 54 q4 -16 8 0", 1.4), line(14, 54, 14, 48, 1.4), circle(14, 46, 3, 1.2)]
    shaving = [path("M50 70 q-6 12 4 18 q10 4 12 -4", 1.2, .7)]
    wood = [rect(2, 72, 96, 14, 1.0, .5), line(6, 80, 94, 80, .9, .4)]
    return layer(-4, *wood, *shaving) + layer(0, *body, *tote) + layer(4, *mouth, *blade)


def alembic():
    cucurbit = [path("M20 62 Q20 44 42 44 Q64 44 64 62 Q64 88 42 88 Q20 88 20 62 Z", 1.8), rect(36, 36, 12, 8, 1.4)]
    head = [path("M32 36 Q32 14 42 12 Q52 14 52 36", 1.6), circle(42, 12, 3, 1.0)]
    beak = [path("M52 22 L84 30 L88 40", 1.6), path("M52 26 L82 34", 1.0, .6)]
    receiver = [path("M78 56 Q78 74 90 74 Q100 74 100 56 L96 52 L82 52 Z", 1.4), path("M88 40 L88 52", 1.2)]
    furnace = [rect(14, 90, 56, 8, 1.4), path("M24 98 q4 -6 0 -10 M42 98 q4 -6 0 -10 M58 98 q4 -6 0 -10", 1.0, .6)]
    liquid = [path("M24 66 Q42 60 60 66", 1.0, .55)]
    return layer(-4, *liquid) + layer(0, *cucurbit, *head, *receiver) + layer(4, *beak, *furnace)


def crosscut_saw():
    blade = [path("M2 40 L98 34 L98 58 L2 52 Z", 1.8)]
    teeth = [poly([(4 + i * 6, 52 - i * .3), (7 + i * 6, 58 - i * .3), (10 + i * 6, 52 - i * .35)], .9, closed=False) for i in range(15)]
    h1 = [line(2, 40, 2, 20, 1.8), line(2, 20, 12, 20, 1.6)]
    h2 = [line(98, 34, 98, 14, 1.8), line(98, 14, 88, 14, 1.6)]
    log = [rect(26, 66, 48, 22, 1.4), circle(26, 77, 2, 1.0, .6), path("M30 70 q40 6 40 14", .9, .4)]
    kerf = [line(50, 58, 50, 66, 1.6)]
    return layer(-4, *log) + layer(0, *blade, *h1, *h2) + layer(4, *teeth, *kerf)


def cheugugi():
    pillar = [rect(36, 40, 28, 52, 1.8), line(36, 46, 64, 46, 1.0, .5)]
    gauge = [path("M30 40 L70 40 L64 20 L36 20 Z", 1.6), ellipse(50, 20, 14, 3, 1.2)]
    rain = [line(20 + i * 12, 4, 16 + i * 12, 14, 1.0, .65) for i in range(6)]
    stick = [line(50, 22, 50, 58, 1.0, .7)] + [line(46, 28 + i * 6, 50, 28 + i * 6, .9, .75) for i in range(5)]
    step = [rect(24, 92, 52, 4, 1.4)]
    water = [path("M38 36 Q50 32 62 36", 1.0, .6)]
    return layer(-4, *rain) + layer(0, *pillar, *step, *gauge) + layer(4, *stick, *water)


def tipping_gauge():
    funnel = [path("M20 8 L80 8 L56 32 L44 32 Z", 1.8), line(50, 32, 50, 40, 1.4)]
    seesaw = [path("M24 52 L50 62 L76 52 L76 70 L50 78 L24 70 Z", 1.6), line(50, 62, 50, 78, 1.2)]
    pivot = [circle(50, 70, 2.4, 1.2), line(50, 70, 50, 86, 1.0, .6)]
    drip = [path("M50 40 q-3 6 0 8", 1.0, .75)]
    vessel = [rect(30, 86, 40, 10, 1.4)]
    count = [circle(84, 84, 5, 1.0, .7), line(84, 84, 84, 80, 1.0, .7)]
    return layer(-4, *count) + layer(0, *funnel, *seesaw, *vessel) + layer(4, *pivot, *drip)


def harington_wc():
    cistern = [rect(54, 4, 40, 24, 1.8), line(54, 12, 94, 12, 1.0, .5), circle(74, 20, 2, 1.0)]
    pipe = [path("M70 28 L70 52 L56 52", 1.6)]
    bowl = [path("M10 56 L52 56 L52 72 Q52 84 30 84 Q10 84 10 72 Z", 1.8), path("M14 60 L48 60", 1.0, .5)]
    valve = [rect(48, 48, 10, 8, 1.2), line(53, 48, 53, 40, 1.2), circle(53, 38, 2, 1.0)]
    seat = [rect(6, 50, 50, 6, 1.4)]
    drain = [path("M30 84 L30 96 L74 96", 1.4), path("M34 90 q4 -3 8 0 t8 0", 1.0, .5)]
    return layer(-4, *drain) + layer(0, *bowl, *seat, *cistern) + layer(4, *pipe, *valve)


def s_trap():
    bowl = [path("M8 8 L8 30 Q8 44 28 44 L40 44", 1.8), path("M28 8 L28 28 Q28 34 36 34 L40 34", 1.0, .5)]
    trap = [path("M40 44 Q54 44 54 58 Q54 70 66 70 Q80 70 80 56 L80 44", 1.8)]
    water = [path("M44 48 Q54 54 60 58", 1.2, .7), path("M62 70 Q72 74 78 66", 1.0, .6)]
    pipe = [path("M80 44 L80 28 L96 28", 1.6), path("M80 30 L96 30", 1.0, .5)]
    drain = [line(66, 70, 66, 96, 1.4)]
    air = [path("M90 20 q4 -6 0 -12", 1.0, .5)]
    return layer(-4, *air, *water) + layer(0, *bowl, *trap, *pipe) + layer(4, *drain)


def ballcock():
    tank = [path("M6 20 L6 90 L94 90 L94 20", 1.8), path("M10 60 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0", 1.0, .6)]
    inlet = [line(4, 20, 36, 20, 1.8), rect(30, 14, 12, 12, 1.4)]
    lever = [path("M42 20 L76 34", 1.8), circle(46, 21, 2, 1.2)]
    float_ = [circle(82, 38, 10, 1.6), line(76, 34, 80, 36, 1.4)]
    spigot = [line(36, 26, 36, 40, 1.4)]
    drops = [circle(36, 46, 1.2, .9, fill=True), circle(36, 52, 1.2, .8, fill=True)]
    return layer(-4, *drops) + layer(0, *tank, *inlet) + layer(4, *lever, *float_, *spigot)


def minoan_toilet():
    seat = [path("M14 30 Q14 16 36 16 L64 16 Q86 16 86 30 L86 44 L14 44 Z", 1.8), ellipse(50, 30, 22, 8, 1.2)]
    pedestal = [rect(30, 44, 40, 24, 1.6), line(30, 54, 70, 54, 1.0, .5)]
    channel = [path("M50 68 L50 84 Q50 92 66 92 L96 92", 1.6), path("M54 70 L54 82", 1.0, .5)]
    pot = [path("M76 4 Q74 12 82 14 L90 14 Q98 12 96 4 Z", 1.4), path("M86 14 L86 20", 1.0, .6)]
    water = [path("M80 22 q4 8 0 14", 1.0, .6)]
    return layer(-4, *water) + layer(0, *seat, *pedestal, *pot) + layer(4, *channel)


def sextant():
    arc_ = [poly([(50, 94)] + [pol(50, 94, 70, -120 + k * 5) for k in range(13)], 1.8, closed=True)]
    scale = [line(*pol(50, 94, 70, -120 + k * 5), *pol(50, 94, 76, -120 + k * 5), .9, .8) for k in range(0, 13)]
    arm = [line(50, 94, *pol(50, 94, 76, -70), 1.8), circle(50, 94, 2.4, 1.2), rect(*pol(50, 94, 20, -70), 5, 5, 1.0)]
    mirrors = [rect(34, 54, 8, 6, 1.2), rect(62, 38, 8, 6, 1.2)]
    scope = [line(66, 66, 94, 56, 1.6), circle(96, 55, 2, 1.0)]
    handle = [line(50, 70, 50, 84, 1.0, .6)]
    return layer(-4, *handle) + layer(0, *arc_, *scale) + layer(4, *arm, *mirrors, *scope)


ITEMS = [
    dict(id="exp28_chappe_optical_telegraph", n="Chappe Optical Telegraph", era="network", cat="technology", ds=1791, rar="rare",
         date="Chappe's first public demonstration 2 March 1791; Paris–Lille line from summer 1792; Paris–Strasbourg 1798; Edelcrantz Sweden 1794; Murray Britain 1795", vis="tower-beam-arms", topic="signalling_exp28",
         region="France (Brûlon, Parcé, Paris–Lille); Sweden; Britain", artifactType="semaphore signalling tower", material="timber tower with jointed arms", physical=True, durable=True,
         l1="A hilltop tower with movable arms that relays coded messages from tower to tower.",
         l2="Claude Chappe and his brothers built the first successful optical telegraph; it spread across France as a network, and Swedish (shutter) and British (Murray shutter) variants followed.",
         l3="The first public demonstration was on 2 March 1791 between Brûlon and Parcé, 16 km apart; Claude Chappe was appointed Ingénieur-Télégraphiste in summer 1792 to build a Paris–Lille line, and in 1794 it relayed news of the capture of Condé-sur-l'Escaut in under an hour. The Paris–Strasbourg line (50 stations, 488 km) was complete in 1798. Fun fact: in 1844 Dumas's 'The Count of Monte Cristo' features a semaphore line. (not known: the exact opening date of the Paris–Lille line.)",
         ev="Brûlon–Parcé demonstration (2 March 1791)", first_known="1684 (Hooke outline, never built)",
         confidence=dict(level="established", note="The page gives only summer 1792 for the Paris–Lille appointment, not an opening date."),
         srcs=[wp("optel_wp", "Optical_telegraph", "Chappe demonstration 2 March 1791 Brulon-Parce 16 km; Paris-Lille from summer 1792; Conde 1794; Paris-Strasbourg 1798 50 stations 488 km; Edelcrantz 1794; Murray 1795; Monte Cristo.")],
         pool=['wood', 'lever', 'cordage', 'rope', 'pulley', 'observation', 'exp28_dioptra', 'exp28_mance_heliograph', 'mechanism', 'exp28_meridian_circle', 'record_keeping', 'writing'], must=[], nrec=2,
         tags=["signal", "network"], regions=["europe"], art=optical_telegraph()),
    dict(id="exp28_pavise", n="Pavise Shield", era="trade", cat="technology", ds=1350, rar="uncommon",
         date="In use mid-14th to early 16th century; Bellifortis treatise 1405; Burgundian pavises 1450–1475", vis="convex-ridged-spiked-shield", topic="arms_exp28",
         region="Italy (Genoese crossbowmen); Burgundy; Bohemia (Hussite Wars); Germany", artifactType="defensive shield", material="wood covered in canvas, painted", physical=True, durable=False,
         l1="A tall painted shield with a ridge and a ground spike, used as a wall by crossbowmen.",
         l2="Pavises were large, square and convex with a central ridge, covered in coarse canvas and painted with oil and egg-based paints; a spike on the bottom planted them in the ground. A smaller version served in hand-to-hand combat.",
         l3="The page dates their use from the mid-14th to the early 16th century (the 1350 ds is the start of that span); Genoese crossbowmen, an elite corps, shared them, with more than three men to a pavise. The Hussite chalice was often painted on them. Fun fact: only about 200 survive, and towns kept them painted with coats of arms in arsenals. (not known: exact dates for the Genoese corps or the Hussite Wars; the page does not mention Pavia.)",
         ev="Bellifortis treatise (1405)", first_known="mid-14th century",
         confidence=dict(level="uncertain", note="ds is the start of the page's 'mid-14th century' span."),
         srcs=[wp("pavise_wp", "Pavise", "Used mid-14th to early 16th century; Bellifortis pavise 1405; Burgundian 1450-1475; large square convex ridge; spike; canvas covered, oil and egg paints; about 200 survive.")],
         pool=['wood', 'cloth', 'exp28_crossbow', 'cordage', 'iron', 'exp28_rack_and_pinion', 'fiber', 'exp28_crossbow', 'engineering'], must=['wood'], nrec=2,
         tags=["arms", "shield"], regions=["europe"], art=pavise()),
    dict(id="exp28_roman_steelyard", n="Steelyard Balance", era="trade", cat="technology", ds=-200, rar="uncommon",
         date="Greek use 5th–4th century BC; Roman and Chinese steelyards invented c. 200 BC; simple lever steelyard over 5,000 years ago", vis="sliding-poise-beam", topic="weights_measures_exp28",
         region="Rome, China, Greece, the ancient Near East", artifactType="weighing instrument", material="bronze or iron beam", physical=True, durable=True,
         l1="A one-pan balance whose weight slides along a marked arm until the beam balances.",
         l2="A counterweight slides along the graduated longer arm until the beam balances; its position shows the load's weight. The Latin statera comes from the Greek statḗr.",
         l3="The page says Roman steelyards were invented around 200 BC and Chinese ones independently around 200 BC; Greek craftsmen used them in the 5th and 4th centuries BC, before Archimedes demonstrated the law of the lever. Fun fact: Wildman Whitehouse used a steelyard to measure current in telegraph cables in 1856. (not known: the exact date of the simple lever steelyard of the ancient Near East, 'over 5,000 years ago'.)",
         ev="Roman and Chinese steelyards (c. 200 BC)", first_known="over 5,000 years ago (ancient Near East)",
         confidence=dict(level="debated", note="Dates differ by region; ds uses c. 200 BC for the Roman and Chinese forms."),
         srcs=[wp("steelyard_wp", "Steelyard_balance", "Roman steelyards invented c. 200 BC; Chinese independently c. 200 BC; Greek 5th-4th century BC; Near East over 5,000 years ago; sliding weight; Whitehouse 1856; Simmons 1840.")],
         pool=['lever', 'bronze', 'iron', 'measurement', 'anc27_bronze_balance_scale', 'anc27_bronze_balance_weight', 'mathematics', 'cordage', 'copper'], must=['lever'], nrec=2,
         tags=["weighing", "lever"], regions=["europe", "africa_asia"], art=steelyard()),
    dict(id="exp28_lamellar_armour", n="Lamellar Armour", era="metallurgy", cat="technology", ds=-900, rar="uncommon",
         date="Possible lamellar examples c. 900–600 BC (Neo-Assyrian Empire 911–609 BC); Japan around the 5th century (keiko)", vis="laced-plate-rows", topic="arms_exp28",
         region="Assyria, Central Asia, China, Byzantium, Japan", artifactType="body armour", material="small plates laced with cord", physical=True, durable=True,
         l1="Armour of many small plates punched and laced together in rows.",
         l2="Lamellae are small platelets punched and laced together, typically in horizontal rows; peoples using the lamellar cuirass include the Sarmatians, Avars, Rus, Mongols and Turks.",
         l3="The page dates possible Assyrian lamellar examples to circa 900–600 BC; lamellar reached Japan about the 5th century, where the keiko was a sleeveless jacket. Fun fact: a helmet from Yi county, Hebei, was made of 89 lamellae averaging 5 cm by 4 cm, and the Terracotta Army wears six or seven categories of lamellar armour by rank. (not known: who first laced plates; the page does not mention Scythians.)",
         ev="Neo-Assyrian remains (c. 900–600 BC)", first_known="c. 900 BC",
         confidence=dict(level="uncertain", note="The page dates 'possible' Assyrian lamellar to circa 900–600 BC; 900 BC is the start of that span."),
         srcs=[wp("lamellar_wp", "Lamellar_armour", "Possible lamellar circa 900-600 BC Neo-Assyrian 911-609 BC; Japan 5th century keiko; platelets punched and laced in horizontal rows; Yi county helmet 89 lamellae; Terracotta Army.")],
         pool=['cordage', 'bronze', 'iron', 'leather_wrapped_axe_handle', 'needle', 'rope', 'forging', 'metallurgy', 'casting', 'fiber', 'smelting'], must=[], nrec=2,
         tags=["armour", "metal"], regions=["africa_asia", "europe"], art=lamellar()),
    dict(id="exp28_mail_armour", n="Riveted Mail Armour", era="metallurgy", cat="technology", ds=-250, rar="uncommon",
         date="Earliest surviving mail 3rd century BC (Horný Jatov, Ciumești); Etruscan mail from at least 4th century BC; plate supplements by the 14th century", vis="linked-ring-fabric", topic="arms_exp28",
         region="Celtic Europe, Etruria, Rome, later China and Japan", artifactType="body armour", material="small linked iron rings", physical=True, durable=True,
         l1="A flexible shirt of interlinked iron rings.",
         l2="The most common pattern is 4-to-1, each ring linked with four others; European mail was typically riveted to stop rings splitting. A knee-length mail shirt is a hauberk.",
         l3="The earliest surviving mail is 3rd century BC, found at Horný Jatov, Slovakia, and Ciumești, Romania, and is commonly credited to the Celts, with Etruscan mail from at least the 4th century BC; Rome adopted it as the lorica hamata. The oldest intact hauberk is thought to have belonged to Leopold III of Austria, who died at Sempach in 1386. Fun fact: mail reached China in 718 as tribute to the Tang emperor; Monty Python used spray-painted knitted string. (not known: who invented mail.)",
         ev="Horný Jatov and Ciumești finds (3rd century BC)", first_known="4th century BC (Etruscan)",
         confidence=dict(level="debated", note="Credit to the Celts is 'commonly' given; Etruscan mail is at least as early."),
         srcs=[wp("mail_wp", "Mail_(armour)", "Earliest surviving mail 3rd century BC Horny Jatov and Ciumesti; Etruscan at least 4th century BC; lorica hamata; 4-to-1; riveted; hauberk; plate by 14th century; Leopold III 1386; China 718.")],
         pool=['iron', 'forging', 'smelting', 'metallurgy', 'cordage', 'exp26_iron_chain_link', 'copper', 'bronze', 'exp26_linked_iron_chain'], must=['iron'], nrec=2,
         tags=["armour", "iron"], regions=["europe"], art=mail_armour()),
    dict(id="exp28_shawm", n="Shawm", era="trade", cat="culture", ds=1200, rar="uncommon",
         date="Europe 13th or possibly 12th century; baroque hautbois replaced it c. 1670; still played by German town musicians until 1830", vis="double-reed-conical-bore", topic="music_instruments_exp28",
         region="Eastern Mediterranean; Europe; Persia (surnāy); Turkey (zūrnā)", artifactType="double-reed wind instrument", material="wood", physical=True, durable=True,
         l1="A loud medieval double-reed pipe with a flared bell, ancestor of the oboe.",
         l2="Martin Hotteterre (d. 1712) devised the baroque hautbois, which kept the double reed and conical bore but put the lips directly on the reed.",
         l3="The page dates the shawm to the 'thirteenth or possibly 12th century' in Europe, from similar Near Eastern instruments (Persian surnāy, Turkish zūrnā) probably brought 'around the time of the Crusades'. Around 1670 the hautbois began replacing it and by 1700 it had all but disappeared from concerts. Fun fact: the Mary Rose wreck yielded the only surviving still shawm. (not known: who first brought the shawm to Europe.)",
         ev="Mary Rose still shawm", first_known="12th–13th century",
         confidence=dict(level="uncertain", note="No exact date is given; ds is the 13th-century marker."),
         srcs=[wp("shawm_wp", "Shawm", "Europe 13th or possibly 12th century from Near East surnay and zurna; Hotteterre hautbois c. 1670 replaced it, by 1700 gone from concerts; Mary Rose still shawm; German town musicians to 1830.")],
         pool=['flute', 'music', 'wood', 'exp28_clarinet', 'exp28_bagpipes', 'exp28_sackbut', 'bronze', 'exp26_cut_quill_nib', 'cordage'], must=['music'], nrec=2,
         tags=["music", "reed"], regions=["europe", "africa_asia"], art=shawm()),
    dict(id="exp28_sheng", n="Sheng Mouth Organ", era="trade", cat="culture", ds=-433, rar="rare",
         date="Images c. 1100 BCE; mentioned in bone oracle writings 14th–12th century BCE; Zeng Hou Yi tomb c. 433 BCE; Shōsōin 8th century; Europe 1740 and 1777", vis="pipes-wind-chamber", topic="music_instruments_exp28",
         region="China; Japan (Shōsōin); Europe", artifactType="free-reed wind instrument", material="bamboo pipes with metal reeds in a gourd or wooden chamber", physical=True, durable=True,
         l1="A bundle of bamboo pipes with free reeds that sounds on both blowing and sucking.",
         l2="Players can sound continuously by switching between exhaling and inhaling, much like a harmonica. Zheng Jinwen increased the pipes to 32 between 1872 and 1935.",
         l3="Instruments with gourd wind chambers and bamboo or metal reeds were found in the tomb of Marquis Yi of Zeng (c. 433 BCE); three 17-pipe shengs sent to the Japanese court in the 8th century survive in the Shōsōin. Johann Wilde (1740) and Père Amiot (1777) are believed to have brought it to Europe. Fun fact: the page does not say it inspired the accordion, though it notes similar free-reed instruments were known in Europe about a century before 1740. (not known: when the first sheng was made.)",
         ev="Tomb of Marquis Yi of Zeng (c. 433 BCE)", first_known="c. 1100 BCE (images)",
         confidence=dict(level="established", note="ds uses the physical finds in the tomb of Marquis Yi (c. 433 BCE)."),
         srcs=[wp("sheng_wp", "Sheng_(instrument)", "Images c. 1100 BCE; bone oracle 14th-12th century BCE; Marquis Yi tomb c. 433 BCE; Shosoin 8th century 17 pipes; Zheng Jinwen 32 pipes; Wilde 1740, Amiot 1777; free reed sounding on blow and suck.")],
         pool=['flute', 'music', 'wood', 'bronze', 'anc27_bronze_bell_casting', 'copper', 'cordage', 'pottery', 'anc27_bronze_chime_set'], must=['music'], nrec=2,
         tags=["music", "free_reed"], regions=["africa_asia"], art=sheng()),
    dict(id="exp28_natural_horn", n="Natural Horn", era="trade", cat="culture", ds=1740, rar="uncommon",
         date="Crooks in common use by 1740; Inventionshorn 1753; hand stopping first half of 18th century (Hampel, Dresden)", vis="coiled-tube-bell-crook", topic="music_instruments_exp28",
         region="Dresden and Germany; Paris", artifactType="brass instrument", material="brass tube", physical=True, durable=True,
         l1="A coiled brass horn with no valves, played with the hand in the bell.",
         l2="Crooks were swapped in to change the instrument's length and key; hand stopping changes pitch with the hand in the bell. The playing range runs from Bb2 to Eb5.",
         l3="Hand stopping is 'commonly thought' to have emerged in the first half of the 18th century at the Dresden court with Anton Hampel (account from Domnich, 1807); crooks were in common use by 1740; in 1753 Hampel and Johann Werner developed the Inventionshorn with a fixed mouthpiece position. Fun fact: Brahms wrote for the natural horn because he did not care for the valved horn. (not known: the exact year of hand stopping.)",
         ev="Inventionshorn (1753)", first_known="1740 (crooks in common use)",
         confidence=dict(level="uncertain", note="The page gives no exact year for hand stopping."),
         srcs=[wp("horn_wp", "Natural_horn", "Hand stopping first half of 18th century Dresden Hampel (Domnich 1807); crooks by 1740; Inventionshorn 1753; Haltenhof tuning slide 1770s; Raoux Paris 1797; range Bb2-Eb5; Brahms.")],
         pool=['music', 'bronze', 'copper', 'forging', 'casting', 'anc27_bronze_bell_casting', 'exp28_sackbut', 'metallurgy', 'exp28_bagpipes'], must=['music'], nrec=2,
         tags=["music", "brass"], regions=["europe"], art=natural_horn()),
    dict(id="exp28_brass_piston_valve", n="Périnet Piston Valve", era="industry", cat="technology", ds=1814, rar="rare",
         date="Stölzel valve 1814; Vienna double-piston 1821; Riedl rotary valve 1832; Périnet piston 1839", vis="paired-pistons-loops", topic="music_instruments_exp28",
         region="Germany, Austria, France", artifactType="brass instrument mechanism", material="brass piston and tubing", physical=True, durable=True,
         l1="Button pistons that add extra tubing to a brass horn so it can play every note.",
         l2="Modern three-valve sets lower the pitch by two, one and three half-steps, so combined they reach a tritone; tubas often add a fourth valve lowering by a perfect fourth.",
         l3="The page says no successful valve design existed before Heinrich Stölzel applied his valve to the French horn in 1814; François Périnet patented the modern piston valve in 1839, and Joseph Riedl patented the rotary valve in 1832. Fun fact: Adolphe Sax built instruments with six piston valves, but only the most dexterous players could manage them. (not known: the Blühmel 1818 patent; the page does not mention it.)",
         ev="Stölzel's valve (1814); Périnet patent (1839)", first_known="1814",
         confidence=dict(level="established", note="The page gives years only."),
         srcs=[wp("valve_wp", "Valve_(brass_instrument)", "Stolzel valve 1814; Vienna double-piston 1821; Riedl rotary 1832; Perinet piston patented 1839; three-valve sets two, one, three half-steps; Sax six valves; Stacy 1924.")],
         pool=['exp28_natural_horn', 'music', 'copper', 'bronze', 'forging', 'machine_tools', 'exp28_elliptic_leaf_spring', 'mechanism', 'exp28_sackbut'], must=['exp28_natural_horn'], nrec=2,
         tags=["music", "valve"], regions=["europe"], art=brass_valve()),
    dict(id="exp28_pitch_pipe", n="Pitch Pipe", era="industry", cat="culture", ds=1750, rar="uncommon",
         date="18th and 19th centuries (no exact dates given)", vis="free-reed-bank", topic="music_instruments_exp28",
         region="Europe and America (church choirs)", artifactType="pitch reference", material="wood or brass with brass reeds", physical=True, durable=True,
         l1="A small reed pipe that gives singers their starting note.",
         l2="The earliest pitch pipes resembled recorders with a slide-whistle plunger and a square bore; chromatic pipes give thirteen pitches, each a half step above the last, covering an octave.",
         l3="Most often used in churches without an organ, to give the opening note of a hymn, mainly in the 18th and 19th centuries (the page gives no exact dates; ds 1750 is a marker). Fun fact: a recorded pipe beep can reveal the playback speed of a gramophone record or phonograph cylinder. (not known: who made the first pitch pipe or when.)",
         ev="Church use (18th–19th century)", first_known="18th century",
         confidence=dict(level="uncertain", note="The page gives only the 18th and 19th centuries; ds is a round marker."),
         srcs=[wp("pitchpipe_wp", "Pitch_pipe", "Earliest pitch pipes like recorders with slide whistle plunger; church use 18th and 19th centuries; chromatic pipe thirteen pitches; recorded pipe beep reveals playback speed; brass reeds.")],
         pool=['music', 'wood', 'flute', 'exp28_tuning_fork', 'exp28_clarinet', 'copper', 'bronze', 'cordage'], must=['music'], nrec=2,
         tags=["music", "pitch"], regions=["europe", "americas"], art=pitch_pipe()),
    dict(id="exp28_roman_screw_press", n="Roman Screw Press", era="civilization", cat="technology", ds=50, rar="uncommon",
         date="Invented and used by the Romans in the first century AD; part of Gutenberg's press in the mid-15th century", vis="screw-beam-bed", topic="presses_exp28",
         region="Roman world", artifactType="pressing machine", material="timber frame and screw", physical=True, durable=True,
         l1="A big wooden screw that squeezes grapes or olives under a plate.",
         l2="A screw turned by a bar presses a plate down on the material; a fly press's weights keep its motion going.",
         l3="The page says the Romans first invented and used the screw press in the first century AD, mainly for wine and olive oil. It was part of Gutenberg's printing press in the mid-15th century (no exact year). Fun fact: screw presses are still used in hand bookbinding to keep book covers flat while glue dries. (not known: the Greek origin sometimes claimed and Hero's design; the page does not mention them or minting presses.)",
         ev="Roman presses (1st century AD)", first_known="1st century AD",
         confidence=dict(level="established", note="The page does not mention a Greek origin."),
         srcs=[wp("screwpress_wp", "Screw_press", "Romans invented and used the screw press in the first century AD for wine and olive oil; part of Gutenberg's press mid-15th century; fly press weights; bookbinding.")],
         pool=['lever', 'wood', 'exp28_archimedes_screw', 'exp26_pressed_cheese_wheel', 'engineering', 'cordage', 'rope', 'gear', 'iron', 'exp28_well_windlass'], must=['exp28_archimedes_screw'], nrec=2,
         tags=["press", "screw"], regions=["europe"], art=screw_press()),
    dict(id="exp28_babylonian_seed_drill", n="Seed Drill", era="agriculture", cat="technology", ds=-1400, rar="uncommon",
         date="Babylonians 1400 BCE; China 2nd century BCE multi-tube iron drills; Venetian patent 1566 (Torello); Cavalina 1602; Tull 1701", vis="hopper-tubes-shares", topic="farming_exp28",
         region="Mesopotamia; China; Venice; England", artifactType="planting machine", material="timber hopper, tubes and shares", physical=True, durable=True,
         l1="A wheeled hopper that drops seed through tubes into furrows in even rows.",
         l2="Seed drills can increase yield (seeds harvested per seed planted) by up to eight times compared with broadcast seeding; some modern drills are 12 m wide.",
         l3="The page says Babylonians used primitive seed drills in 1400 BCE and the Chinese invented multi-tube iron seed drills in the 2nd century BCE; the Venetian Senate patented the first known European drill in 1566 (attributed to Camillo Torello), Tadeo Cavalina described one in 1602 and Jethro Tull refined it in 1701. Fun fact: in the 16th-century Mughal Empire peasants widely used seed drills. (not known: who built the Babylonian drill; the page does not name Han or Zhao Guo.)",
         ev="Venetian patent (1566); Cavalina's description (1602)", first_known="1400 BCE",
         confidence=dict(level="uncertain", note="The page spells the name Torello, not Tarello."),
         srcs=[wp("seeddrill_wp", "Seed_drill", "Babylonians 1400 BCE; Chinese multi-tube iron drills 2nd century BCE; Venetian patent 1566 Torello; Cavalina 1602; Tull 1701; up to eight times yield; Mughal 16th century.")],
         pool=['farming_tools', 'stone_ploughshare', 'wood', 'wheel', 'axle', 'exp26_seed_bed_furrow', 'exp26_selected_cereal_seed', 'cordage', 'bronze', 'farming_community'], must=['farming_tools'], nrec=2,
         tags=["farming", "seed"], regions=["africa_asia", "europe"], art=seed_drill()),
    dict(id="exp28_roman_hand_plane", n="Roman Hand Plane", era="civilization", cat="technology", ds=79, rar="uncommon",
         date="Earliest known planes found in Pompeii (before AD 79, the page gives no date); Bailey's iron planes mid-1860s", vis="stock-iron-blade", topic="woodworking_exp28",
         region="Pompeii, Roman Italy; later United States (Leonard Bailey, Stanley)", artifactType="woodworking tool", material="wood or iron stock with iron blade", physical=True, durable=True,
         l1="A wooden or iron block holding a blade that shaves wood flat.",
         l2="A jack plane is usually 14 to 20 inches long and used for initial material removal; a smoothing plane is up to 10 inches. Japanese planes are pulled toward the body.",
         l3="The page says the earliest known examples of the woodworking plane were found in Pompeii (the page gives no date; ds 79 is the year Pompeii was buried, an outside fact). In the mid-1860s Leonard Bailey began producing cast-iron planes, whose patents Stanley Rule & Level bought. Fun fact: in 1918 an air-powered hand planing tool let one man do the planing work of up to fifteen. (not known: who invented the plane; the page does not describe Egyptian planes.)",
         ev="Pompeii finds", first_known="before AD 79",
         confidence=dict(level="uncertain", note="ds 79 is the burial of Pompeii, not a date given by the page."),
         srcs=[wp("plane_wp", "Hand_plane", "Earliest known planes found in Pompeii; Leonard Bailey cast-iron planes mid-1860s, patents bought by Stanley; jack 14-20 inches; smoothing up to 10 inches; 1918 air-powered planer.")],
         pool=['iron', 'wood', 'forging', 'bronze', 'exp28_brace_and_bit', 'stone_plane', 'copper', 'lever', 'measurement', 'exp28_spirit_level', 'stone', 'bone', 'cordage', 'fire', 'metallurgy', 'smelting', 'casting', 'exp28_crosscut_saw', 'exp28_cam_and_follower', 'gear', 'engineering', 'geometry'], must=[], nrec=2,
         tags=["woodworking", "plane"], regions=["europe"], art=hand_plane()),
    dict(id="exp28_alembic", n="Alembic Still", era="science", cat="science", ds=300, rar="rare",
         date="Dioscorides' ambix c. 50 CE; Zosimos of Panopolis c. 300 CE credits Mary the Jewess; Ibn al-Awwam rose-water", vis="cucurbit-head-beak", topic="distillation_exp28",
         region="Roman Egypt (Alexandria); the Arab world", artifactType="distillation vessel", material="glass or copper", physical=True, durable=True,
         l1="A flask and domed cap with a sloping spout that turns vapour back into liquid.",
         l2="The head or cap (Arabic al-inbīq) fits over the cucurbit's mouth to catch vapours, and a downward-sloping tube carries the condensate to the receiver.",
         l3="The word comes from Arabic al-inbīq, from Greek ambix ('cup, beaker'). Dioscorides' ambix (c. 50 CE) was a helmet-shaped lid for gathering condensed mercury; Zosimos of Panopolis (c. 300 CE) credited Mary the Jewess with inventing the alembic. Fun fact: Unicode has three alembic symbols, and its modern descendant is the pot still. (not known: Jabir ibn Hayyan's role; the page does not mention him.)",
         ev="Zosimos's account (c. 300 CE)", first_known="c. 50 CE (Dioscorides' ambix)",
         confidence=dict(level="uncertain", note="ds 300 is the Zosimos date the page gives; the page dates Zosimos at c. 300 CE."),
         srcs=[wp("alembic_wp", "Alembic", "From Arabic al-inbiq from Greek ambix; Dioscorides ambix c. 50 CE; Zosimos c. 300 CE credits Mary the Jewess; head receives vapours, sloping tube to receiver; Ibn al-Awwam rose-water; pot still.")],
         pool=['glass', 'copper', 'fire', 'kiln', 'chemistry', 'pottery', 'exp26_molten_glass_batch', 'exp26_blown_glass_cup', 'bronze', 'observation', 'exp26_glass_bead_blank'], must=['glass'], nrec=2,
         tags=["distillation", "alchemy"], regions=["europe", "africa_asia"], art=alembic()),
    dict(id="exp28_crosscut_saw", n="Crosscut Saw", era="civilization", cat="technology", ds=100, rar="common",
         date="In use during the Roman Empire 'although not widely'; the page gives only approximate later dates (15th century, about 1880)", vis="two-handle-toothed-blade", topic="woodworking_exp28",
         region="Roman Empire; Europe and North America", artifactType="saw", material="steel blade with wooden handles", physical=True, durable=True,
         l1="A long toothed blade with a handle at each end for two sawyers to cut logs across the grain.",
         l2="Each tooth's bevelled edge acts like a knife, severing fibres instead of tearing along the grain; bucking saws have straighter backs and greater stiffness so one person can push as well as pull.",
         l3="The page says crosscut saws were used during the Roman Empire although not widely, and gives no exact early dates. Fun fact: Japanese saws and those of ancient Egypt cut only on the pull stroke, and vintage saws could be folded end to end and carried on the back. (not known: the first crosscut saw's date; ds 100 is a mid-Empire marker, not from the page.)",
         ev="Roman use (undated)", first_known="Roman Empire",
         confidence=dict(level="uncertain", note="ds is a mid-Roman-Empire marker; the page gives no exact date."),
         srcs=[wp("crosscut_wp", "Crosscut_saw", "Crosscut saws in use during the Roman Empire although not widely; teeth sever fibres across the grain; one- and two-man; bucking saws; Japanese saws cut on the pull stroke; folded for carrying.")],
         pool=['iron', 'forging', 'wood', 'stone_saw', 'bone_saw', 'bronze', 'metallurgy', 'lever', 'copper', 'steel'], must=['iron'], nrec=2,
         tags=["woodworking", "saw"], regions=["europe"], art=crosscut_saw()),
    dict(id="exp28_cheugugi", n="Cheugugi Rain Gauge", era="science", cat="science", ds=1441, rar="rare",
         date="Invented 1441 under Sejong the Great of Joseon; Tianchi basins 1247 (Qin Jiushao)", vis="cylinder-on-pillar", topic="meteorology_exp28",
         region="Joseon Korea; Song China (Qin Jiushao)", artifactType="rainfall gauge", material="bronze or iron cylinder on a stone pillar", physical=True, durable=True,
         l1="A cylinder on a stone pillar that catches rain so its depth can be measured.",
         l2="The page calls the Cheugugi the 'first standardized rain gauge'. Gauges can slightly underestimate rainfall because drops stick to the funnel and sides.",
         l3="It was invented in 1441 during the reign of Sejong the Great of the Joseon dynasty. Qin Jiushao invented Tianchi basin rain and snow gauges in 1247, and Christopher Wren made Britain's first tipping-bucket gauge in 1662. Fun fact: George James Symons published British Rainfall's first annual volume in 1860; the 1899 volume had figures from 3,528 stations. (not known: the date of the Arthashastra's rainfall standards or the Palestine text mentioned; the page gives no dates.)",
         ev="Sejong's reign (1441)", first_known="1247 (Tianchi basins)",
         confidence=dict(level="established", note="ds uses the 1441 Cheugugi, called the first standardized rain gauge."),
         srcs=[wp("raingauge_wp", "Rain_gauge", "Cheugugi 1441 under Sejong the Great, first standardized rain gauge; Qin Jiushao Tianchi basins 1247; Wren tipping bucket 1662; Symons British Rainfall 1860, 3,528 stations in 1899.")],
         pool=['measurement', 'bronze', 'observation', 'record_keeping', 'mathematics', 'copper', 'casting', 'exp28_mural_quadrant', 'astronomy'], must=['measurement'], nrec=2,
         tags=["weather", "korea"], regions=["africa_asia"], art=cheugugi()),
    dict(id="exp28_wren_tipping_bucket_gauge", n="Wren's Tipping-Bucket Rain Gauge", era="science", cat="science", ds=1662, rar="rare",
         date="Christopher Wren with Robert Hooke, 1662; Towneley's rainfall series 1677–1694", vis="funnel-seesaw-bucket", topic="meteorology_exp28",
         region="England (Wren, Hooke, Towneley)", artifactType="rainfall gauge", material="metal funnel and tipping bucket", physical=True, durable=True,
         l1="A funnel that fills a seesaw bucket that tips every set amount of rain.",
         l2="Rain falls into a funnel and fills one half of a small seesaw; when it holds a fixed amount it tips, empties, and the other half fills. Each tip is counted.",
         l3="The page says Christopher Wren, working with Robert Hooke, created the first tipping-bucket rain gauge in Britain in 1662 (the page gives no details of its build). Richard Towneley made systematic rainfall measurements from 1677 to 1694. Fun fact: Thomas Barker recorded meteorological data including rainfall for 59 years. (not known: how Wren's seesaw counted tips; the page does not describe it. The seesaw counting above is the general principle.)",
         ev="Wren and Hooke (1662)", first_known="1662",
         confidence=dict(level="established", note="The page gives the date but not the mechanism details."),
         srcs=[wp("raingauge_wp2", "Rain_gauge", "Wren created first tipping-bucket gauge in Britain in 1662 with Hooke; Towneley measurements 1677-1694; Barker 59 years.")],
         pool=['measurement', 'physics', 'mechanism', 'lever', 'copper', 'bronze', 'exp28_cheugugi', 'exp28_torricelli_barometer', 'observation', 'experiment'], must=['measurement'], nrec=2,
         tags=["weather", "rain"], regions=["europe"], art=tipping_gauge()),
    dict(id="exp28_harington_water_closet", n="Harington's Water Closet", era="industry", cat="technology", ds=1596, rar="rare",
         date="John Harington, A New Discourse of a Stale Subject 1596; installed at Richmond Palace for Elizabeth I", vis="cistern-valve-bowl", topic="sanitation_exp28",
         region="England (Kelston, Somerset; Richmond Palace)", artifactType="flush toilet", material="cistern, valve and pipe", physical=True, durable=True,
         l1="An early flush toilet with a cistern and a valve that sends water to wash the bowl.",
         l2="The design is described as a forerunner of the modern flush toilet; Alexander Cumming's S-trap (1775) later added a water seal against sewer air.",
         l3="John Harington published A New Discourse of a Stale Subject in 1596 describing a forerunner of the flush toilet at his Kelston house in Somerset and later installed one for his godmother, Queen Elizabeth I, at Richmond Palace. Fun fact: in 1851 George Jennings's Monkey Closets at the Great Exhibition drew 827,280 paying visitors at a penny each. (not known: the exact year of the Richmond installation; the page does not give one.)",
         ev="A New Discourse of a Stale Subject (1596)", first_known="2nd millennium BCE (Minoan flushable toilets)",
         confidence=dict(level="established", note="The page gives 1596 for the publication, not for the Richmond installation."),
         srcs=[wp("flush_wp", "Flush_toilet", "Harington 1596 A New Discourse of a Stale Subject, Kelston, Richmond Palace for Elizabeth I; Cumming S-trap 1775; Bramah 1778; Crapper 1880 U-trap; Jennings 1851 827,280 visitors; Sloan flushometer 1906.")],
         pool=['wood', 'exp26_pottery_water_pipe', 'exp26_socketed_water_pipe', 'iron', 'copper', 'lever', 'exp26_pipe_culvert', 'writing', 'pottery', 'exp28_siphon'], must=['exp28_siphon'], nrec=2,
         tags=["sanitation", "toilet"], regions=["europe"], art=harington_wc()),
    dict(id="exp28_cumming_s_trap", n="Cumming's S-Trap", era="industry", cat="technology", ds=1775, rar="rare",
         date="Alexander Cumming, 1775; Joseph Bramah float-valve patent 1778; Crapper U-trap 1880", vis="s-bend-water-seal", topic="sanitation_exp28",
         region="England (Cumming, Bramah, Crapper)", artifactType="drain trap", material="metal or ceramic pipe", physical=True, durable=True,
         l1="An S-shaped pipe bend that keeps a plug of water to block sewer smells.",
         l2="The S-trap uses standing water to block foul air rising from the sewer through the bowl and is still used today.",
         l3="Alexander Cumming invented the S-trap in 1775; in 1778 Joseph Bramah patented a float-valve system for the flush tank, having begun by installing toilets based on Cumming's design. Thomas Crapper did not invent the flush toilet; in 1880 he introduced the U-shaped trap and held nine patents. Fun fact: Thomas MacAvity Stewart invented the vortex-flushing bowl in 1907. (not known: how many S-traps Cumming sold.)",
         ev="Cumming's invention (1775)", first_known="1775",
         confidence=dict(level="established", note="The page credits Frederick Humpherson, not Twyford, with the 1885 pedestal flush-down toilet."),
         srcs=[wp("flush_wp2", "Flush_toilet", "Cumming S-trap 1775 standing water blocks sewer air; Bramah float valve patent 1778; Crapper U-trap 1880, nine patents; Humpherson 1885; Twyford; vortex bowl 1907.")],
         pool=['exp28_harington_water_closet', 'iron', 'exp28_siphon', 'exp26_socketed_drain_pipe', 'exp26_curved_drain_elbow', 'exp26_pipe_culvert', 'copper', 'pottery', 'engineering'], must=['exp28_harington_water_closet'], nrec=2,
         tags=["sanitation", "trap"], regions=["europe"], art=s_trap()),
    dict(id="exp28_alzate_ballcock", n="Ballcock Float Valve", era="industry", cat="technology", ds=1790, rar="uncommon",
         date="José Antonio de Alzate y Ramírez 1790; Edmund Cartwright patent 1797; Cahill US 418,162 (1889); Mueller 1955", vis="lever-float-valve", topic="sanitation_exp28",
         region="Mexico (Alzate); England (Cartwright); United States", artifactType="water-level control valve", material="brass valve and copper float", physical=True, durable=True,
         l1="A float on a lever that closes the water inlet when the tank is full.",
         l2="A valve on the water supply is opened and closed by a lever with a float on its end: as the level falls the float drops and opens the valve, and as it rises the lever pushes it shut. The page calls it negative feedback.",
         l3="José Antonio de Alzate y Ramírez, a Mexican priest and scientist, described the modern ballcock in 1790 in the Gaceta de Literatura Méxicana; Edmund Cartwright patented the device for steam engines in 1797; W. J. Cahill's 'Ball cock' patent (US 418,162) was issued on 31 December 1889. Fun fact: Mueller's patent describes a hissing noise from water leaking past a slightly open valve. (not known: floatless fill valve dates; the page gives none, nor does it mention Ctesibius or Crapper.)",
         ev="Alzate's description (1790)", first_known="1790",
         confidence=dict(level="established", note="The page does not mention Ctesibius or Crapper."),
         srcs=[wp("ballcock_wp", "Ballcock", "Alzate described the ballcock in 1790; Cartwright patent 1797 for steam engines; Cahill US 418162 issued 31 December 1889; Mueller 1955; lever and float, negative feedback.")],
         pool=['lever', 'copper', 'iron', 'exp28_siphon', 'mechanism', 'exp28_centrifugal_governor', 'exp28_harington_water_closet', 'steam_engine', 'water_power'], must=['lever'], nrec=2,
         tags=["valve", "water"], regions=["americas", "europe"], art=ballcock()),
    dict(id="exp28_minoan_flush_toilet", n="Minoan Flush Toilet", era="civilization", cat="engineering", ds=-1700, rar="rare",
         date="Minoan flushable pedestal toilets by the second millennium BCE (Knossos, Akrotiri); Skara Brae c. 31st century BC; Xi'an c. 2,400 years old", vis="pedestal-seat-channel", topic="sanitation_exp28",
         region="Minoan Crete (Knossos); Santorini (Akrotiri); Orkney (Skara Brae); China (Xi'an)", artifactType="flushable pedestal toilet", material="stone or ceramic with drain channel", physical=True, durable=True,
         l1="A pedestal seat over a drain, washed out by poured or channelled water.",
         l2="At Skara Brae the village drainage used a stream to wash waste away; Mesopotamians used clay sewer pipes from about 4000 BCE.",
         l3="The page says the Minoans developed flushable pedestal toilets by the second millennium BCE, with examples excavated at Knossos and Akrotiri (no exact date; ds -1700 is a mid-point marker). Skara Brae's drain is dated only to the 31st century BC. Fun fact: in February 2023 archaeologists in Xi'an announced what may be the world's oldest known flush toilet, about 2,400 years old. (not known: how the Minoan toilets were flushed in detail; the page gives no further description.)",
         ev="Knossos and Akrotiri remains", first_known="c. 31st century BC (Skara Brae drain)",
         confidence=dict(level="uncertain", note="The page gives only 'second millennium BCE'; ds is a round marker."),
         srcs=[wp("flush_wp3", "Flush_toilet", "Skara Brae circa 31st century BC drainage; Minoans flushable pedestal toilets second millennium BCE Knossos and Akrotiri; Mesopotamian clay sewer pipes c. 4000 BCE; Xi'an 2,400 years old February 2023.")],
         pool=['brick', 'exp26_pottery_water_pipe', 'exp26_terracotta_drain', 'anc27_household_flush_drain', 'pottery', 'kiln', 'engineering', 'lime', 'mortar', 'exp26_socketed_drain_pipe'], must=[], nrec=2,
         tags=["sanitation", "minoan"], regions=["europe", "africa_asia"], art=minoan_toilet()),
    dict(id="exp28_sextant", n="Marine Sextant", era="science", cat="technology", ds=1731, rar="rare",
         date="Hadley and Godfrey c. 1731; lunar distances tabulated in the Nautical Almanac 1767; Gago Coutinho aeronautical 1922; Gemini XII 1966", vis="sixty-degree-arc-mirrors", topic="navigation_exp28",
         region="England (Hadley); Philadelphia (Godfrey)", artifactType="navigation instrument", material="brass frame, mirrors and telescope", physical=True, durable=True,
         l1="A one-sixth-circle brass frame with two mirrors that measures a star's angle above the horizon.",
         l2="The index arm moves the index mirror; the scale is graduated so marked degrees register twice the angle the arm turns. A half-horizon mirror splits the view between horizon and object; a whole-horizon mirror is half-silvered.",
         l3="The page puts Hadley and Godfrey's implementation 'around 1731' and the name comes from the Latin for 'one sixth', for the frame's roughly 60° sector. Fun fact: Buzz Aldrin used a sextant and chart on Gemini XII in 1966 after a radar problem, and an emergency sextant was kept ready for Artemis II. (not known: John Bird's 1759 sextant; the page does not mention him.)",
         ev="Hadley and Godfrey (c. 1731)", first_known="c. 1731",
         confidence=dict(level="uncertain", note="The page says 'around 1731', not 1730."),
         srcs=[wp("sextant_wp", "Sextant", "Hadley and Godfrey around 1731; Gago Coutinho 1922; Gemini XII Aldrin 1966; ISS experiment 2018; index arm, horizon mirror; name from Latin for one sixth."),
               wp("octant_wp", "Octant_(instrument)", "1767 first Nautical Almanac tabulated lunar distances, leading to the sextant; double reflection doubles angle.")],
         pool=['exp28_hadley_octant', 'exp26_vernier_sextant', 'navigation', 'measurement', 'optics', 'glass', 'mathematics', 'astronomy', 'compass', 'lens'], must=['exp28_hadley_octant'], nrec=2,
         tags=["navigation", "angle"], regions=["europe", "americas"], art=sextant()),
]
