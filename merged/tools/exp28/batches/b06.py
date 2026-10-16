"""EXP28 batch 06 — electrostatics, tubes, cables, photography chemistry, mechanisms, music, mining.
Facts only from pages fetched 2026-10-16."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def electrophorus():
    base = [ellipse(50, 78, 34, 8, 1.8), path("M16 78 L16 86 Q50 96 84 86 L84 78", 1.8), ellipse(50, 78, 28, 6, 1.0, .5)]
    cake = [path("M26 76 Q50 70 74 76", 1.2, .7)]
    plate = [ellipse(50, 48, 24, 6, 1.8), path("M26 48 L26 54 Q50 62 74 54 L74 48", 1.6), ellipse(50, 48, 20, 4.4, 1.0, .5)]
    handle = [line(50, 42, 50, 18, 2.0), circle(50, 14, 4, 1.6), line(46, 14, 54, 14, .8, .5)]
    sparks = [path("M70 40 l6 -8 l-4 0 l6 -8", 1.4), path("M80 44 l4 -6", 1.0, .6)]
    plus = [line(40, 66, 40, 70, .9, .6), line(38, 68, 42, 68, .9, .6), line(60, 66, 60, 70, .9, .6), line(58, 68, 62, 68, .9, .6)]
    fur = [path("M84 28 q6 2 8 10 q-4 6 -10 4 q-4 -6 2 -14", 1.2, .55)]
    return layer(-4, *plus, *fur) + layer(0, *base, *cake) + layer(4, *plate, *handle, *sparks)


def reflecting_circle():
    ring = [circle(50, 52, 34, 1.8), circle(50, 52, 29, 1.0, .5), ticks(50, 52, 29, 34, 0, 360, 36, .8, .65), circle(50, 52, 3, 1.4)]
    arm1 = [line(50, 52, *pol(50, 52, 40, 215), 1.8), line(50, 52, *pol(50, 52, 40, 35), 1.4, .7)]
    mirror = [rect(*pol(50, 52, 6, 215), 6, 3, 1.4) if False else line(*pol(50, 52, 5, 130), *pol(50, 52, 10, 130), 2.4)]
    scope = [rect(10, 46, 20, 8, 1.6), circle(10, 50, 3, 1.2), line(30, 50, 44, 50, 1.2, .6)]
    horizon = [rect(70, 46, 8, 6, 1.2), line(70, 49, 80, 49, 1.0, .6)]
    handle = [path("M50 86 L50 96", 2.0), rect(44, 94, 12, 4, 1.4)]
    ray = [line(2, 30, 44, 48, .9, .45), line(90, 40, 56, 50, .9, .4)]
    vern = [rect(*pol(50, 52, 31, 215), 6, 3, 1.0) if False else circle(*pol(50, 52, 40, 215), 2.4, 1.2)]
    return layer(-4, *ray) + layer(0, *ring, *handle, *scope) + layer(4, *arm1, *mirror, *horizon, *vern)


def tetrode():
    env = [path("M32 90 L32 48 Q32 8 50 8 Q68 8 68 48 L68 90", 1.8), line(32, 90, 68, 90, 1.8), path("M46 8 L50 2 L54 8", 1.0, .6)]
    plate = [rect(40, 12, 20, 22, 1.4), line(50, 12, 50, 4, 1.0)]
    scr = [path("M39 44 l6 -3 l-6 -3 l6 -3 l-6 -3 l6 -3", 1.1, .85), path("M61 44 l-6 -3 l6 -3 l-6 -3 l6 -3 l-6 -3", 1.1, .85), line(26, 32, 39, 32, 1.0, .7)]
    ctl = [path("M42 58 l5 -2.4 l-5 -2.4 l5 -2.4 l-5 -2.4", 1.0, .7), path("M58 58 l-5 -2.4 l5 -2.4 l-5 -2.4 l5 -2.4 l-5 -2.4", 1.0, .7), line(74, 46, 58, 46, 1.0, .7)]
    fil = [path("M45 80 L45 66 Q50 62 55 66 L55 80", 1.4), line(45, 80, 45, 90, 1.2), line(55, 80, 55, 90, 1.2)]
    base = [rect(30, 90, 40, 6, 1.6)] + [line(36 + i * 7, 96, 36 + i * 7, 99, 1.2) for i in range(4)]
    cap = [circle(50, 4, 2, 1.0)]
    return layer(-4, *cap) + layer(0, *env, *base, *plate) + layer(4, *scr, *ctl, *fil)


def pentode():
    env = [path("M30 90 L30 50 Q30 8 50 8 Q70 8 70 50 L70 90", 1.8), line(30, 90, 70, 90, 1.8)]
    plate = [rect(40, 12, 20, 18, 1.4), line(50, 12, 50, 3, 1.0)]
    supp = [path("M38 36 l5 -2 l-5 -2 l5 -2", 1.0, .7), path("M62 36 l-5 -2 l5 -2 l-5 -2", 1.0, .7), line(78, 36, 62, 36, 1.0, .7)]
    scr = [path("M38 48 l5 -2 l-5 -2 l5 -2", 1.0, .7), path("M62 48 l-5 -2 l5 -2 l-5 -2", 1.0, .7), line(24, 44, 38, 44, 1.0, .7)]
    ctl = [path("M40 60 l5 -2 l-5 -2 l5 -2", 1.0, .7), path("M60 60 l-5 -2 l5 -2 l-5 -2", 1.0, .7), line(78, 56, 60, 56, 1.0, .7)]
    fil = [path("M45 82 L45 70 Q50 66 55 70 L55 82", 1.4), line(45, 82, 45, 90, 1.2), line(55, 82, 55, 90, 1.2)]
    base = [rect(28, 90, 44, 6, 1.6)] + [line(34 + i * 6, 96, 34 + i * 6, 99, 1.2) for i in range(5)]
    return layer(0, *env, *base, *plate) + layer(4, *supp, *scr, *ctl, *fil)


def gutta_cable():
    core = [circle(50, 50, 6, 1.4), circle(50, 50, 2, 1.0, fill=True)]
    strands = [circle(*pol(50, 50, 5.4, k * 60), 2.4, .9, .85) for k in range(6)]
    gutta = [circle(50, 50, 16, 1.6), circle(50, 50, 13, 1.0, .5)]
    armour = [circle(50, 50, 28, 1.8)] + [circle(*pol(50, 50, 28, k * 24), 3.4, 1.1, .85) for k in range(15)]
    tar = [circle(50, 50, 22, 1.0, .5)]
    coil = [path("M4 94 q-2 -8 8 -10 q10 -2 14 6", 1.0, .45), path("M96 94 q2 -8 -8 -10 q-10 -2 -14 6", 1.0, .45)]
    wave = [path("M4 6 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0", 1.0, .4)]
    return layer(-4, *wave, *coil) + layer(0, *armour, *tar, *gutta) + layer(4, *core, *strands)


def electrolytic_cap():
    can = [path("M30 18 L30 84 Q30 90 36 90 L64 90 Q70 90 70 84 L70 18", 1.8), ellipse(50, 18, 20, 5, 1.6), ellipse(50, 18, 15, 3.4, 1.0, .5)]
    foil = [path(f"M36 {26 + i * 3} q14 -3 28 0", 1.0, .75) for i in range(10)]
    anode = [line(42, 18, 42, 6, 1.6), circle(42, 4, 2.2, 1.2), line(40, 4, 44, 4, .9, .6)]
    cath = [line(58, 18, 58, 6, 1.6), circle(58, 4, 2.2, 1.2)]
    seal = [rect(32, 82, 36, 6, 1.0, .6)]
    plus = [line(78, 12, 78, 20, 1.2), line(74, 16, 82, 16, 1.2)]
    ox = [path("M34 58 q16 -4 32 0", 1.0, .4), path("M34 62 q16 -4 32 0", 1.0, .35)]
    return layer(-4, *ox) + layer(0, *can, *seal, *anode, *cath) + layer(4, *foil, *plus)


def spark_plug():
    term = [circle(50, 6, 3, 1.4), line(50, 9, 50, 20, 1.8), rect(44, 20, 12, 4, 1.4)]
    ins = [path("M42 24 L42 56 L40 62 L60 62 L58 56 L58 24 Z", 1.8)] + [line(42, 30 + i * 6, 58, 30 + i * 6, .9, .6) for i in range(5)]
    shell = [rect(34, 56, 32, 8, 1.6), poly([(36, 64), (64, 64), (64, 80), (36, 80)], 1.6, closed=True)] + [line(37, 66 + i * 3, 63, 66 + i * 3, .8, .65) for i in range(5)]
    electrode = [line(50, 62, 50, 84, 1.8), line(36, 80, 36, 88, 1.8), path("M36 88 Q36 90 42 90 L48 90", 1.8)]
    gap = [line(50, 84, 50, 90, 1.0, .5), path("M46 86 l3 -3 l1 4 l3 -3", 1.0, .8)]
    hex_ = [path("M34 56 L38 50 L62 50 L66 56", 1.0, .6)]
    return layer(-4, *gap) + layer(0, *ins, *shell, *term) + layer(4, *electrode, *hex_)


def roll_film():
    spool = [circle(26, 50, 22, 1.8), circle(26, 50, 7, 1.4), circle(26, 50, 2.6, 1.0, fill=True), circle(26, 50, 22, 1.0, .5)]
    wind = [circle(26, 50, 16, .9, .55), circle(26, 50, 12, .9, .45)]
    strip = [path("M46 50 Q62 54 74 46 L96 40", 1.6), path("M46 58 Q62 62 74 54 L96 48", 1.6)]
    frames = [rect(60 + i * 0, 43, 12, 9, 1.2, .8) if False else poly([(62, 48), (74, 46), (74, 56), (62, 58)], 1.2, closed=True), poly([(78, 44), (92, 41), (92, 51), (78, 54)], 1.2, closed=True)]
    perf = [circle(50 + i * 5, 49 + i * .3 - (0 if i < 4 else 2), .8, .8, fill=True) for i in range(6)] if False else []
    holes = [rect(58 + i * 6, 46 + i * -0.4, 2, 1.6, .6, .8) for i in range(6)]
    tab = [line(96, 40, 98, 36, 1.0, .6), line(96, 48, 98, 52, 1.0, .6)]
    box = [path("M6 90 L94 90", 1.2, .4)]
    return layer(-4, *box) + layer(0, *spool, *wind, *strip) + layer(4, *frames, *holes, *tab)


def flash_powder():
    tray = [path("M8 70 L92 70 L84 84 L16 84 Z", 1.8), line(8, 70, 92, 70, 1.0, .6)]
    powder = [path("M30 70 Q50 56 70 70", 1.4), path("M38 70 Q50 62 62 70", 1.0, .6)]
    flare = [poly([pol(50, 40, 8 if i % 2 else 22, i * 30) for i in range(12)], 1.4, closed=True), circle(50, 40, 6, 1.2, .8), circle(50, 40, 30, 1.0, .3)]
    handle = [line(86, 70, 96, 56, 1.6), circle(97, 54, 1.6, 1.0)]
    mag = [line(18, 76, 34, 76, 1.2, .6), path("M18 80 q8 -4 16 0", 1.0, .5)]
    return layer(-4, *mag) + layer(0, *tray, *handle) + layer(4, *flare, *powder)


def cam_follower():
    cam = [path("M50 16 Q74 18 78 44 Q76 66 54 74 Q32 78 24 56 Q22 30 50 16 Z", 1.8), circle(50, 52, 4, 1.4), circle(50, 52, 1.4, 1.0, fill=True)]
    rad = [line(50, 52, 50, 16, .9, .5), line(50, 52, 78, 44, .9, .5), line(50, 52, 24, 56, .9, .5)]
    follower = [rect(46, 4, 8, 4, 1.4), line(50, 8, 50, 16, 1.4), circle(50, 16, 2.4, 1.2)]
    guide = [line(42, 2, 42, 14, 1.2, .7), line(58, 2, 58, 14, 1.2, .7)]
    shaft = [line(50, 52, 50, 90, 1.4, .6), line(8, 90, 92, 90, 1.4)]
    spring = [path("M70 4 q4 2 -4 4 q8 2 -4 4", .9, .5)]
    arrow = [path("M84 30 q8 8 0 18", 1.0, .5), poly([(84, 48), (80, 44), (88, 44)], .9, closed=True)]
    return layer(-4, *rad, *arrow) + layer(0, *cam, *shaft) + layer(4, *follower, *guide, *spring)


def rack_pinion():
    rack = [rect(6, 62, 88, 10, 1.8)] + [poly([(8 + i * 6, 62), (10 + i * 6, 56), (13 + i * 6, 56), (15 + i * 6, 62)], 1.1, closed=True) for i in range(14)]
    pinion = [gear(50, 40, 10, 15, 12, 1.6, 1.0, 8), circle(50, 40, 3, 1.4), circle(50, 40, 1, 1.0, fill=True)]
    spokes_ = [spokes(50, 40, 4, 10, 6, 0, 1.0, .75)]
    axle = [line(50, 40, 50, 14, 1.4), rect(44, 8, 12, 6, 1.4)]
    crank = [line(56, 11, 80, 11, 1.4), circle(82, 11, 2.2, 1.2), line(82, 13, 82, 26, 1.2)]
    arrows = [line(10, 84, 40, 84, 1.0, .5), poly([(40, 84), (36, 81), (36, 87)], .9, closed=True)]
    return layer(-4, *arrows) + layer(0, *rack, *axle) + layer(4, *pinion, *spokes_, *crank)


def flywheel():
    rim = [circle(50, 50, 38, 2.0), circle(50, 50, 33, 1.0, .5)]
    hub = [circle(50, 50, 10, 1.8), circle(50, 50, 4, 1.4), circle(50, 50, 1.4, 1.0, fill=True)]
    arms = [spokes(50, 50, 10, 33, 6, 0, 1.8), spokes(50, 50, 10, 33, 6, 8, .9, .45)]
    axle = [line(4, 50, 96, 50, 1.2, .5), rect(0, 46, 8, 8, 1.2) if False else line(6, 44, 6, 56, 1.4), line(94, 44, 94, 56, 1.4)]
    crank = [line(50, 50, 66, 72, 1.0, .6), circle(66, 73, 2.6, 1.2)]
    mass = [path("M16 28 q4 -4 8 -2", 1.0, .5), path("M84 72 q-4 4 -8 2", 1.0, .5)]
    return layer(-4, *axle, *mass) + layer(0, *rim, *hub, *arms) + layer(4, *crank)


def sackbut():
    bell = [path("M64 24 Q92 14 94 4", 1.6), path("M64 32 Q96 24 98 6", 1.6), path("M94 4 Q97 3 98 6", 1.2)]
    outer = [line(6, 90, 6, 30, 1.8), line(14, 90, 14, 38, 1.8), path("M6 30 Q10 24 14 30", 1.6)]
    inner = [line(26, 82, 26, 28, 1.8), line(34, 82, 34, 36, 1.8), path("M26 28 Q30 22 34 28", 1.6)]
    cross = [line(6, 88, 26, 88, 1.8), line(14, 80, 34, 80, 1.4, .8), rect(2, 82, 6, 10, 1.0, .6)]
    bow = [path("M14 38 Q40 20 64 28", 1.6), path("M34 36 Q46 28 64 32", 1.4)]
    mouth = [line(6, 30, 6, 20, 1.4), circle(6, 18, 3, 1.4), circle(6, 18, 1.2, 1.0, fill=True)]
    brace = [line(14, 56, 34, 56, 1.0, .6), line(14, 70, 34, 70, 1.0, .6)]
    return layer(-4, *brace) + layer(0, *outer, *inner, *cross, *bow) + layer(4, *bell, *mouth)


def cradle_scythe():
    snath = [path("M70 6 Q50 30 46 62 Q44 84 38 94", 2.2), path("M72 8 Q54 32 50 62", .9, .45)]
    grips = [line(56, 36, 68, 40, 1.6), circle(70, 40, 1.8, 1.0), line(48, 58, 38, 54, 1.6), circle(36, 54, 1.8, 1.0)]
    blade = [path("M44 80 Q18 80 4 66 Q14 74 40 74", 1.8), line(44, 80, 40, 74, 1.4), path("M6 66 L4 68", 1.2)]
    fingers = [line(40 + i * 0, 68, 40, 68, 1.0) for i in range(0)] + [line(42, 70 - i * 5, 18 + i * 1.6, 56 - i * 2.4, 1.2, .9) for i in range(5)]
    rail = [path("M44 70 L44 54", 1.4, .6), line(18, 58, 44, 56, 1.0, .55)]
    grain = [line(12 + i * 6, 96, 14 + i * 6, 82, .9, .5) for i in range(5)]
    return layer(-4, *grain, *rail) + layer(0, *snath, *grips, *blade) + layer(4, *fingers)


def arrastra():
    pit = [ellipse(50, 66, 42, 18, 1.8), ellipse(50, 66, 36, 14, 1.0, .5)]
    floor = [path(f"M{20 + i * 6} 66 q3 3 6 0", .8, .4) for i in range(10)]
    post = [line(50, 66, 50, 14, 2.0), circle(50, 12, 3, 1.4), rect(44, 62, 12, 4, 1.4)]
    arm = [line(50, 22, 88, 30, 1.8), line(50, 30, 88, 38, 1.0, .5), poly([(86, 28), (96, 32), (88, 40)], 1.4, closed=True)]
    stones = [poly([(26, 62), (40, 60), (42, 70), (28, 72)], 1.6, closed=True), poly([(60, 68), (76, 66), (78, 76), (62, 78)], 1.6, closed=True)]
    ropes = [line(50, 26, 33, 62, 1.0, .65), line(50, 26, 69, 68, 1.0, .65)]
    ore = [circle(46, 70, 1.2, .9, .6), circle(52, 72, 1.0, .9, .6), circle(40, 74, .9, .9, .5)]
    return layer(-4, *floor, *ore) + layer(0, *pit, *post, *arm) + layer(4, *stones, *ropes)


def stamp_mill():
    wheel = [circle(20, 50, 18, 1.8), spokes(20, 50, 3, 16, 8, 0, 1.2, .85), circle(20, 50, 3, 1.4)]
    paddles = [rect(*pol(20, 50, 17, k * 45), 6, 3, 1.2) if False else line(*pol(20, 50, 18, k * 30), *pol(20, 50, 24, k * 30), 1.6) for k in range(12)]
    shaft = [line(20, 50, 80, 50, 2.0), circle(80, 50, 2.4, 1.2)]
    cams = [rect(36, 46, 8, 8, 1.3), rect(52, 44, 8, 12, 1.3), rect(68, 47, 8, 6, 1.3)]
    stamps = []
    for x, y in [(40, 66), (56, 58), (72, 70)]:
        stamps += [line(x, 30, x, y, 2.2), rect(x - 4, y, 8, 8, 1.4)]
    frame = [line(34, 26, 80, 26, 1.8), line(34, 80, 80, 80, 1.8), line(34, 26, 34, 90, 1.8), line(80, 26, 80, 90, 1.8)]
    ore = [path("M34 90 L80 90", 1.4)] + [circle(40 + i * 7, 87, 1.2, .9, .7) for i in range(6)]
    water = [path("M4 76 q6 -4 12 0 t12 0", 1.0, .5), line(14, 68, 20, 76, .9, .5)]
    return layer(-4, *water) + layer(0, *frame, *shaft, *wheel, *ore) + layer(4, *paddles, *cams, *stamps)


ITEMS = [
    dict(id="exp28_electrophorus", n="Electrophorus", era="science", cat="science", ds=1762, rar="uncommon",
         date="J. C. Wilcke, 1762; improved and popularised by Volta, 1775", vis="resin-cake-plate", topic="electrical_instruments_exp28",
         region="Sweden (Johan Carl Wilcke); Italy (Alessandro Volta)", artifactType="electrostatic device", material="resin cake and metal plate", physical=True, durable=True,
         l1="A charged resin cake and a handled metal plate that makes charge again and again.",
         l2="Rub the dielectric cake with fur; set the insulated metal plate on it. Its field separates charge in the plate; touch the top briefly to ground it, then lift the plate off. Lifting takes work, raising its voltage, and the cake keeps its charge so the cycle repeats.",
         l3="The page credits Swedish professor Johan Carl Wilcke with the first version in 1762 and Volta with improving and popularising it in 1775; Volta is sometimes wrongly credited with inventing it. The cake was originally resin, pitch or wax and is now usually plastic.",
         ev="Wilcke (1762); Volta (1775)", first_known="1762",
         confidence=dict(level="established", note="Volta improved it; he did not invent it, per the page."),
         srcs=[wp("electrophorus_wp", "Electrophorus", "Wilcke invented the first version in 1762; Volta improved and popularised it in 1775; charged dielectric cake and metal plate on an insulating handle.")],
         pool=['electricity', 'physics', 'experiment', 'glass', 'cloth', 'wood', 'fiber', 'observation', 'exp26_wax_writing_tablet', 'exp28_leyden_jar', 'chemistry', 'copper', 'weaving_shuttle', 'bone'], must=[], nrec=2,
         tags=["electricity", "electrostatics"], regions=["europe"], art=electrophorus()),
    dict(id="exp28_reflecting_circle", n="Mayer Reflecting Circle", era="science", cat="technology", ds=1752, rar="uncommon",
         date="Tobias Mayer, 1752 (published 1767); Borda and Lenoir's definitive form, 1777", vis="full-circle-double-mirror", topic="navigation_exp28",
         region="Germany (Tobias Mayer); France (Jean-Charles de Borda, Étienne Lenoir)", artifactType="navigation instrument", material="brass and glass", physical=True, durable=True,
         l1="A full circle with two mirrors that measures the angle between two objects.",
         l2="A mirror on the index arm reflects one object into the telescope while the other is seen directly; aligning the two images gives their angular separation. The mirror and arm turn through half the angle between the objects, so the scale is doubled.",
         l3="The page says Tobias Mayer invented it in 1752, with details published in 1767, and Borda and Lenoir refined it to its definitive form in 1777 (the 1787 date quoted elsewhere is not on the page). Hadley and Godfrey independently developed the octant around 1731; Fouchy made one in 1732 and Caleb Smith in 1734.",
         ev="Mayer (1752, published 1767); Borda and Lenoir (1777)", first_known="1752",
         confidence=dict(level="established", note="Page gives 1777 for Borda and Lenoir; the 1787 date and Hadley's 1730 are not on the page."),
         srcs=[wp("reflect_wp", "Reflecting_instrument", "Mayer invented the reflecting circle 1752, published 1767; Borda and Lenoir 1777 definitive form; Hadley and Godfrey around 1731; mirror turns through half the angle.")],
         pool=['navigation', 'astronomy', 'mathematics', 'geometry', 'measurement', 'glass', 'optics', 'copper', 'exp28_hadley_octant'], must=[], nrec=2,
         tags=["navigation", "astronomy"], regions=["europe"], art=reflecting_circle()),
    dict(id="exp28_screen_grid_tetrode", n="Screen-Grid Tetrode", era="electric", cat="technology", ds=1916, rar="rare",
         date="Schottky, developed 1915–1916 (German patent 1916, US 1919); Hull's improved tubes marketed 1927", vis="four-electrode-tube", topic="electronics_exp28",
         region="Germany (Walter Schottky); United States (Albert Hull, Neal Williams)", artifactType="electron tube", material="glass and metal", physical=True, durable=True,
         l1="A tube with an extra grid between control grid and plate that shields the plate's capacitance.",
         l2="The screen grid sits between the control grid and the anode and acts as an electrostatic shield, cutting grid-to-anode capacitance to a very small value: 0.025 pF against 8 pF for a typical triode. Radio-frequency stages then needed no neutralising circuits.",
         l3="The page says Schottky developed the first tubes with a screen grid in 1915–1916, patented in Germany in 1916 and in the US in 1919. Hull and Williams at General Electric developed improved screen-grid tubes in the later 1920s, first marketed in 1927.",
         ev="Schottky's 1916 patent; Hull and Williams (1927)", first_known="1915–1916",
         confidence=dict(level="established", note="Page gives 1915–1916 for development and patents in 1916 (Germany) and 1919 (US)."),
         srcs=[wp("tetrode_wp", "Tetrode", "Schottky developed screen-grid tubes 1915–1916, patents 1916 Germany and 1919 US; Hull and Williams marketed 1927; screen grid shields capacitance, 0.025 pF versus 8 pF.")],
         pool=['exp28_triode_audion', 'electricity', 'glass', 'physics', 'copper', 'experiment', 'steel'], must=['exp28_triode_audion'], nrec=2,
         tags=["electronics", "amplifier"], regions=["europe", "americas"], art=tetrode()),
    dict(id="exp28_pentode", n="Pentode Valve", era="electric", cat="technology", ds=1926, rar="rare",
         date="Gilles Holst and Bernard Tellegen, 1926; US patent cited January 1934", vis="five-electrode-tube", topic="electronics_exp28",
         region="Netherlands (Gilles Holst, Bernard Tellegen)", artifactType="electron tube", material="glass and metal", physical=True, durable=True,
         l1="A five-electrode tube whose extra grid sends stray electrons back to the plate.",
         l2="A suppressor grid between the screen grid and the anode, held at low potential, repels electrons knocked off the anode (secondary emission) back to the anode, while primary electrons from the cathode still arrive.",
         l3="The page credits Gilles Holst and Bernard Tellegen with inventing the pentode in 1926. RCA's 239 (1932) was the first commercially available variable-mu pentode and the Mullard VP4 followed in 1933.",
         ev="Holst and Tellegen (1926); US Patent 1945040", first_known="1926",
         confidence=dict(level="established", note="Page credits both Holst and Tellegen and does not name Philips."),
         srcs=[wp("pentode_wp", "Pentode", "Holst and Tellegen invented the pentode in 1926; suppressor grid repels secondary-emission electrons; RCA 239 1932; Mullard VP4 1933.")],
         pool=['exp28_screen_grid_tetrode', 'exp28_triode_audion', 'electricity', 'glass', 'physics', 'copper'], must=['exp28_screen_grid_tetrode'], nrec=2,
         tags=["electronics", "amplifier"], regions=["europe"], art=pentode()),
    dict(id="exp28_gutta_percha_cable", n="Gutta-Percha Submarine Cable", era="electric", cat="technology", ds=1847, rar="rare",
         date="Siemens' gutta-percha cable across the Rhine, 1847; first transatlantic cable operational 16 August 1858", vis="armoured-core", topic="telegraphy_exp28",
         region="Germany (William Siemens); Atlantic (1858, 1865–1866)", artifactType="communication cable", material="copper, gutta-percha and iron wire", physical=True, durable=True,
         l1="A copper core wrapped in gutta-percha and armoured with iron wire for laying under water.",
         l2="Nineteenth-century transatlantic cables used gutta-percha around a multi-stranded copper core; the insulating gum is meltable by heat. Gutta-percha was introduced to Europe by William Montgomerie, and the cables had no in-line repeaters.",
         l3="Wheatstone suggested gutta-percha in 1845 for a Dover–Calais wire; William Siemens laid the first successful underwater gutta-percha cable across the Rhine in 1847. The first transatlantic cable was operational on 16 August 1858 and worked about a month; the SS Great Eastern attempts of 1865 and 1866 produced the first successful one.",
         ev="Siemens' Rhine cable (1847); Atlantic cable of 1858", first_known="1847",
         confidence=dict(level="established", note="Page gives only years for the 1865 and 1866 attempts and for the gum's 1842 introduction."),
         srcs=[wp("subcable_wp", "Submarine_communications_cable", "Wheatstone 1845 suggestion; Siemens first successful gutta-percha cable across the Rhine 1847; first transatlantic cable operational 16 Aug 1858; 1865 and 1866 attempts; copper core.")],
         pool=['telegraph', 'copper', 'electricity', 'rope', 'boat', 'iron', 'cordage', 'chemistry', 'exp28_galvanometer'], must=['telegraph'], nrec=2,
         tags=["telegraphy", "cable"], regions=["europe", "americas"], tradeImportance="high", art=gutta_cable()),
    dict(id="exp28_electrolytic_capacitor", n="Aluminium Electrolytic Capacitor", era="electric", cat="technology", ds=1896, rar="uncommon",
         date="Charles Pollak, patent filed 14 January 1896, granted 19 May 1897", vis="oxide-foil-can", topic="electronics_exp28",
         region="Frankfurt, Germany (Charles Pollak)", artifactType="electronic component", material="aluminium foil, electrolyte and oxide", physical=True, durable=True,
         l1="A can of foil and electrolyte where a thin grown oxide layer is the insulator.",
         l2="A positive voltage on the aluminium anode in an electrolyte grows an insulating oxide layer whose thickness matches the voltage, about 1.4 nm per volt. The oxide is the dielectric and the electrolyte the cathode. It is polarised, and roughening the anode raises capacitance.",
         l3="Buff observed in 1857 that an oxide on aluminium blocks current one way; Ducretet used it in 1875 and coined 'valve metal'. Charles Pollak filed a patent for an 'Electric liquid capacitor with aluminium electrodes' on 14 January 1896, granted 19 May 1897; reversing polarity destroys the layer.",
         ev="Pollak's patent (1896/1897)", first_known="1896",
         confidence=dict(level="established", note="Filing and grant dates are both on the page."),
         srcs=[wp("elcap_wp", "Electrolytic_capacitor", "Buff 1857; Ducretet 1875; Pollak patent filed 14 Jan 1896, granted 19 May 1897; aluminium oxide dielectric 1.4 nm per volt; polarised.")],
         pool=['electricity', 'chemistry', 'copper', 'physics', 'experiment', 'metallurgy', 'glass', 'iron'], must=['electricity', 'chemistry'], nrec=2,
         tags=["electronics", "component"], regions=["europe"], art=electrolytic_cap()),
    dict(id="exp28_high_voltage_spark_plug", n="High-Voltage Spark Plug", era="electric", cat="engineering", ds=1902, rar="uncommon",
         date="Gottlob Honold (Bosch), 1902; Lenoir used a spark plug in 1860", vis="insulated-electrode", topic="engines_exp28",
         region="Stuttgart, Germany (Gottlob Honold, Robert Bosch); France (Étienne Lenoir, 1860)", artifactType="engine part", material="steel and ceramic insulator", physical=True, durable=True,
         l1="A threaded plug with an insulated centre electrode that sparks across a gap to light the fuel.",
         l2="An ignition coil or magneto applies 12,000–25,000 V across the central and side electrodes; once the voltage exceeds the gas's dielectric strength the gap ionises and a spark ignites the fuel-air mixture.",
         l3="Étienne Lenoir used an electric spark plug in his 1860 gas engine, the first internal combustion piston engine. Patents of 1898 include Tesla, Simms and Bosch; in 1902 Bosch engineer Gottlob Honold invented the first commercially viable high-voltage plug as part of a magneto ignition. Sintered alumina insulators replaced older mica stacks.",
         ev="Honold (1902); Siemens sintered alumina insulators (1930s)", first_known="1902",
         confidence=dict(level="established", note="Page says modern insulators are sintered alumina, not porcelain."),
         srcs=[wp("sparkplug_wp", "Spark_plug", "Lenoir 1860; 1898 patents by Tesla, Simms, Bosch; Honold 1902 first commercially viable high-voltage plug; 12,000–25,000 volts; sintered alumina from the 1930s.")],
         pool=['electricity', 'steel', 'pottery', 'engineering', 'iron', 'copper', 'machine_tools', 'physics', 'steam'], must=['electricity'], nrec=2,
         tags=["engine", "ignition"], regions=["europe"], art=spark_plug()),
    dict(id="exp28_nitrate_roll_film", n="Transparent Nitrate Roll Film", era="electric", cat="technology", ds=1889, rar="uncommon",
         date="Eastman's paper-base roll film, 1885; transparent cellulose-nitrate roll film, 1889", vis="film-spool", topic="photography_exp28",
         region="United States (Eastman)", artifactType="photographic medium", material="cellulose nitrate and emulsion", physical=True, durable=False,
         l1="A transparent, flexible, highly flammable roll of film that photographers could wind on frame by frame.",
         l2="Roll film coated on a clear plastic base replaced glass plates; the first transparent plastic roll film of 1889 was cellulose nitrate, which is highly flammable.",
         l3="The page says George Eastman sold the first flexible roll film in 1885, coated on paper, and the first transparent plastic roll film appeared in 1889. Kodak introduced cellulose acetate 'safety film' in 1908; the changeover for X-ray films was complete in 1933 and nitrate was discontinued for theatrical 35 mm film in 1951.",
         ev="Eastman roll film (1885, 1889); Kodak safety film (1908)", first_known="1889",
         confidence=dict(level="established", note="The page does not mention Goodwin, 1887, or celluloid by name."),
         srcs=[wp("film_wp", "Photographic_film", "Eastman first flexible roll film 1885 on paper; first transparent plastic roll film 1889 cellulose nitrate; safety film 1908; nitrate discontinued for theatrical 35 mm 1951.")],
         pool=['chemistry', 'photography', 'paper', 'glass', 'experiment', 'cloth', 'plant_thread', 'exp28_wet_collodion_plate'], must=['chemistry'], nrec=2,
         tags=["photography", "chemistry"], regions=["americas"], art=roll_film()),
    dict(id="exp28_flash_powder", n="Magnesium Flash Powder", era="electric", cat="technology", ds=1887, rar="uncommon",
         date="Miethe and Gaedicke, 1887; magnesium ribbon from 1864", vis="flash-tray", topic="photography_exp28",
         region="Germany (Adolf Miethe, Johannes Gaedicke); Manchester (Sonstadt and Mellor)", artifactType="photographic light source", material="magnesium and potassium chlorate", physical=True, durable=False,
         l1="A pinch of magnesium powder and potassium chlorate that burns with a bright flash for photographs indoors.",
         l2="Magnesium burns with a light similar to daylight. Flash powder is magnesium powder mixed with potassium chlorate and ignited by hand to give a brief intense flash.",
         l3="Bunsen and Roscoe found in 1859 that burning magnesium gave daylight-like light; Edward Sonstadt applied for magnesium patents in 1862 and the Manchester Magnesium Company made flat ribbon from 1864. Adolf Miethe and Johannes Gaedicke introduced flash powder in 1887; manufactured flashbulbs replaced it from 1929.",
         ev="Miethe and Gaedicke (1887); Sonstadt patents (1862)", first_known="1887",
         confidence=dict(level="established", note="Dates from the page; flashbulbs commercially from 1929 in Germany."),
         srcs=[wp("flash_wp", "Flash_(photography)", "Bunsen and Roscoe 1859; Sonstadt patents 1862; Manchester Magnesium Company 1864; Miethe and Gaedicke flash powder 1887; flashbulbs 1929.")],
         pool=['chemistry', 'fire', 'photography', 'metallurgy', 'experiment', 'iron', 'copper', 'glass', 'exp28_wet_collodion_plate', 'exp28_daguerreotype_plate', 'electricity', 'physics', 'observation'], must=[], nrec=2,
         tags=["photography", "chemistry"], regions=["europe"], art=flash_powder()),
    dict(id="exp28_cam_and_follower", n="Cam and Follower", era="civilization", cat="engineering", ds=-600, rar="uncommon",
         date="Cam-shaped crossbow trigger arm c. 600 BC (China); water-driven Hellenistic automata, 3rd century BC; al-Jazari 1206", vis="eccentric-disc-follower", topic="machines_exp28",
         region="Zhou and Han China; Hellenistic Greece; medieval Islamic and European workshops", artifactType="mechanism", material="wood or metal", physical=True, durable=True,
         l1="An odd-shaped rotating disc that pushes a follower up and down with each turn.",
         l2="A rotating or sliding piece strikes or presses on a follower, typically a lever, at points along its path. An eccentric disc gives smooth back-and-forth motion, as a camshaft opens engine valves.",
         l3="The page puts a cam-shaped swing arm in a Chinese crossbow trigger about 600 BC and cams in water-driven trip hammers by the later Western Han (206 BC–8 AD). Continuously rotating cams worked in Hellenistic water-driven automata from the 3rd century BC; al-Jazari described cams and camshafts in 1206 and they appear in European mechanisms from the 14th century.",
         ev="Han trip hammers; al-Jazari (1206)", first_known="c. 600 BC",
         confidence=dict(level="established", note="Page notes later research showed the 600 BC trigger cams did rotate on their own axes."),
         srcs=[wp("cam_wp", "Cam_(mechanism)", "Cam in a crossbow trigger c. 600 BC China; Western Han trip hammers; Hellenistic automata 3rd century BC; al-Jazari 1206; Schmidmuhlen hammers 1010; European cams 14th century.")],
         pool=['wheel', 'axle', 'lever', 'wood', 'water_power', 'mechanism', 'bronze', 'gear', 'mechanical_advantage'], must=['wheel', 'lever'], nrec=2,
         tags=["mechanism", "machine_element"], regions=["africa_asia", "europe"], art=cam_follower()),
    dict(id="exp28_rack_and_pinion", n="Cranequin Rack and Pinion", era="science", cat="engineering", ds=1450, rar="uncommon",
         date="Cranequin for spanning crossbows, 15th century; Xuanyuan arquebus 1598", vis="toothed-bar-gear", topic="machines_exp28",
         region="Europe (cranequin); Ming China (1598)", artifactType="mechanism", material="steel and wood", physical=True, durable=True,
         l1="A toothed bar driven by a small gear that turns rotation into a straight push.",
         l2="Rotating the pinion drives the rack in a straight line and moving the rack turns the pinion; a full turn moves the rack by the pinion's pitch circle circumference.",
         l3="The page cites the 15th-century cranequin, a rack-and-pinion device for drawing back crossbow strings (century only), Zhao Shizhen's 1598 Xuanyuan arquebus with a rack-and-pinion matchlock, and the 1621 Wu Pei Chih description of Ottoman muskets. Uses include rack railways, drill presses, stairlifts, lock gates and car steering.",
         ev="Cranequin crossbows; Wu Pei Chih (1621)", first_known="15th century",
         confidence=dict(level="uncertain", note="The page gives only the century for the cranequin; ds 1450 is a midpoint, not a stated year."),
         srcs=[wp("rack_wp", "Rack_and_pinion", "Cranequin rack-and-pinion device in the 15th century; Xuanyuan arquebus 1598; Wu Pei Chih 1621; rotation converts to linear motion.")],
         pool=['gear', 'lever', 'wheel', 'iron', 'mechanism', 'metallurgy', 'wood', 'exp28_crossbow'], must=['gear'], nrec=2,
         tags=["mechanism", "machine_element"], regions=["europe", "africa_asia"], art=rack_pinion()),
    dict(id="exp28_flywheel", n="Flywheel", era="science", cat="engineering", ds=1038, rar="uncommon",
         date="Ibn Bassal (AD 1038–75) used flywheels in the noria and saqiya; Theophilus, c. 1070–1125", vis="rim-wheel", topic="machines_exp28",
         region="Al-Andalus (Ibn Bassal); Germany (Theophilus Presbyter)", artifactType="mechanism", material="wood or metal", physical=True, durable=True,
         l1="A heavy wheel that keeps turning and smooths the jerks of a machine's drive.",
         l2="A flywheel stores rotational kinetic energy, which depends on its moment of inertia and the square of its rotational speed. It evens out the delivery of power.",
         l3="The page places the principle in the Neolithic spindle and potter's wheel; Ibn Bassal (AD 1038–75) pioneered flywheels in the noria and saqiya to smooth power delivery, and Theophilus Presbyter (c. 1070–1125) recorded one to equalise rotational speed, per Lynn White Jr. James Pickard combined a flywheel with a crank; the page gives no date for Pickard or Watt.",
         ev="Ibn Bassal; Theophilus, De diversibus artibus", first_known="Neolithic principle; documented 11th century",
         confidence=dict(level="uncertain", note="ds 1038 is the start of Ibn Bassal's life dates, a lower bound for documented machine use."),
         srcs=[wp("flywheel_wp", "Flywheel", "Neolithic potter's wheel principle; Ibn Bassal AD 1038–75 flywheels in the noria and saqiya; Theophilus c. 1070–1125; stores rotational kinetic energy.")],
         pool=['wheel', 'axle', 'water_power', 'wood', 'mechanism', 'pottery', 'exp28_saqiya_wheel', 'gear'], must=['wheel'], nrec=2,
         tags=["mechanism", "machine_element"], regions=["europe", "africa_asia"], art=flywheel()),
    dict(id="exp28_sackbut", n="Sackbut", era="science", cat="culture", ds=1466, rar="uncommon",
         date="Name saqueboute attested in France 1466; sacabuche in Spain 1478; English shakbusshe 1495", vis="slide-trumpet", topic="music_exp28",
         region="France, Spain and England (names); developed in the mid-15th century", artifactType="musical instrument", material="brass", physical=True, durable=True,
         l1="A trumpet with a U-shaped slide that changes the length of the air column.",
         l2="The player slides a double tube in and out to change pitch; the trombone's modern system has seven chromatic slide positions, described about 1795 by André Braun after an older four-position system.",
         l3="The page dates the French saqueboute to 1466, Spanish sacabuche to 1478 and English shakbusshe to 1495, and puts the instrument's development at the mid-15th century without an exact year. The name 'trombone' is Italian for 'large trumpet' and English used 'sackbut' until the early 18th century. Riedlocker designed the tuning slide in the early 19th century.",
         ev="Name attestations of 1466, 1478 and 1495", first_known="1466 (earliest name)",
         confidence=dict(level="uncertain", note="Page gives name dates and 'mid-15th century' development; no exact invention year or earliest depiction."),
         srcs=[wp("trombone_wp", "Trombone", "saqueboute 1466; sacabuche 1478; shakbusshe 1495; mid-15th-century development; Braun c. 1795 seven positions; Riedlocker tuning slide early 19th century.")],
         pool=['music', 'metallurgy', 'bronze', 'casting', 'flute', 'copper', 'forging', 'metal_working'], must=['music'], nrec=2,
         tags=["music", "brass"], regions=["europe"], art=sackbut()),
    dict(id="exp28_cradle_scythe", n="Grain Cradle Scythe", era="industry", cat="technology", ds=1800, rar="common",
         date="Grain cradle added to the scythe 'in about 1800'; scythe had replaced the sickle by the 16th century", vis="finger-rail-blade", topic="harvesting_exp28",
         region="Europe and North America", artifactType="harvesting tool", material="wood and steel", physical=True, durable=False,
         l1="A scythe with light wooden fingers above the blade that lay the cut stalks in a neat swath.",
         l2="A grain cradle's light wooden fingers above the blade keep the grain stems aligned as they are cut with the scythe's long snath and blade.",
         l3="The page says that 'in about 1800' a grain cradle was sometimes added to the scythe for mowing grain; scythes had replaced the sickle for reaping crops by the 16th century. The Abbeydale hamlet in Sheffield made scythes from the end of the 18th century to the 1930s. The page's c. 7000 BC date for the earliest scythes is marked 'citation needed'.",
         ev="Abbeydale Industrial Hamlet, Sheffield (museum of scythe-making)", first_known="c. 1800",
         confidence=dict(level="uncertain", note="'In about 1800' is the page's wording; the earliest-scythe claim is uncited there."),
         srcs=[wp("scythe_wp", "Scythe", "Grain cradle added in about 1800; scythe replaced sickle by the 16th century; Abbeydale scythe works from the end of the 18th century to the 1930s; c. 7000 BC claim marked citation needed.")],
         pool=['wood', 'steel', 'forging', 'lever', 'iron', 'fiber', 'cordage', 'metallurgy', 'exp26_edge_joined_board', 'plant_thread', 'rope', 'machine_tools', 'standardized_parts', 'mechanical_advantage'], must=[], nrec=2,
         tags=["harvesting", "agriculture"], regions=["europe", "americas"], art=cradle_scythe()),
    dict(id="exp28_arrastra", n="Arrastra", era="science", cat="technology", ds=1540, rar="common",
         date="Phoenician use (no date on the page); reached Mexico around 1540", vis="drag-stone-pit", topic="mining_exp28",
         region="Mediterranean (Phoenician); New Spain (c. 1540)", artifactType="ore-grinding mill", material="stone, wood and rope", physical=True, durable=True,
         l1="A circular stone pit where drag stones on a pole arm are hauled round to grind ore.",
         l2="Two or more flat-bottomed drag stones sit in a circular pit paved with flat stones, attached to a central post by a long arm that a horse, mule or person pulls. Gold is trapped with mercury; silver ore is treated with salt, copper sulfate and mercury to make an amalgam.",
         l3="Arrastras were widely used in the Mediterranean since Phoenician times (the page gives no exact date); the Spanish introduced them to the New World in the 16th century and they reached Mexico around 1540. Some were powered by water wheels and a few by steam, gasoline or electricity.",
         ev="Spanish colonial silver mills (c. 1540)", first_known="c. 1540 (Mexico)",
         confidence=dict(level="uncertain", note="ds is the page's only dated point (c. 1540 in Mexico); the device is much older."),
         srcs=[wp("arrastra_wp", "Arrastra", "Used since Phoenician times (no date); Spanish brought it to the New World in the 16th century, Mexico around 1540; drag stones in a paved pit; mercury amalgamation.")],
         pool=['stone', 'rope', 'wood', 'cordage', 'metallurgy', 'chemistry', 'lever', 'axle', 'cart'], must=['stone'], nrec=2,
         tags=["mining", "milling"], regions=["americas", "europe"], art=arrastra()),
    dict(id="exp28_water_stamp_mill", n="Water-Powered Stamp Mill", era="science", cat="engineering", ds=973, rar="uncommon",
         date="Stamp mills used by miners in Samarkand, 973; Styrian texts 1135 and 1175; Agricola's illustrations 1556", vis="cam-lifted-stamps", topic="mining_exp28",
         region="Samarkand (973); Styria; later Europe and California", artifactType="ore-crushing machine", material="timber and iron shoes", physical=True, durable=True,
         l1="A line of heavy stamps lifted by cams on a water wheel's axle that drop to crush ore.",
         l2="A heavy stamp sits loosely in a frame; a cam on a rotating shaft lifts it, and as the cam moves out the stamp drops onto the ore below. Agricola's mills were mostly wood with iron shoes on each stamp, the camshaft directly on the waterwheel's axle and stamps in gangs of three.",
         l3="The page notes cams in water-driven automata in the 3rd century BC, Pliny's water-driven pestles in the 1st century AD, miners using stamp mills at Samarkand in 973, and Styrian texts of 1135 and 1175 on vertical stamp mills. It dates the first US stamp mill to 1829 at the Capps mine and the California Stamp to 1894.",
         ev="Agricola, De Re Metallica (1556)", first_known="973",
         confidence=dict(level="established", note="Page gives 973 for Samarkand use; origin earlier in Hellenistic or Roman times is implied but undated."),
         srcs=[wp("stamp_wp", "Stamp_mill", "Pliny 1st century AD; Samarkand 973; Styrian texts 1135 and 1175; Agricola 1556 water-powered stamp mills; first US stamp mill 1829; camshaft lifts stamps.")],
         pool=['water_power', 'wheel', 'axle', 'wood', 'iron', 'exp28_cam_and_follower', 'metallurgy', 'mechanism', 'lever'], must=['water_power'], nrec=2,
         tags=["mining", "milling"], regions=["africa_asia", "europe"], art=stamp_mill()),
]
