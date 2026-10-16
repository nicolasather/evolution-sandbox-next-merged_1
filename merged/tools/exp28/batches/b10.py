"""EXP28 batch 10 — mills, metals, transport, flight, war, medicine. Facts only from pages fetched 2026-10-16.
Unknowns are stated as '(not known)' in l3, followed by a fun fact from the same page."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def post_mill():
    body = [rect(30, 30, 30, 30, 1.8), poly([(28, 30), (45, 18), (62, 30)], 1.6, closed=True), line(45, 18, 45, 14, 1.2)]
    post = [line(45, 60, 45, 90, 2.2), line(45, 74, 24, 92, 1.4), line(45, 74, 66, 92, 1.4), line(45, 82, 45, 82, 1.0), circle(45, 74, 2, 1.0)]
    sails = [line(30, 44, 6, 8, 1.6), line(30, 44, 6, 80, 1.6), line(30, 44, 2, 44, 1.2), line(30, 44, 54, 44, 1.2, .0 + 0.01) if False else line(30, 44, 30, 44, 1.0)]
    lat = []
    for k in range(4):
        a = k * 90 + 25
        x2, y2 = pol(30, 44, 34, a)
        lat += [line(30, 44, x2, y2, 1.6)]
        for j in (14, 24, 34):
            xa, ya = pol(30, 44, j, a)
            xb, yb = pol(xa, ya, 5, a + 90)
            xc, yc = pol(xa, ya, 5, a - 90)
            lat += [line(xb, yb, xc, yc, .9, .8)]
    ladder = [line(60, 60, 78, 88, 1.2), line(66, 60, 84, 88, 1.2)]
    return layer(-4, line(2, 94, 98, 94, 1.0, .5)) + layer(0, *body, *post, *ladder) + layer(4, *lat, circle(30, 44, 2.4, 1.2))


def tin_can():
    can = [path("M24 22 L24 84 Q50 92 76 84 L76 22", 1.8), ellipse(50, 22, 26, 6, 1.6), path("M24 84 Q50 76 76 84", 1.0, .5)]
    ridge = [path("M24 34 Q50 40 76 34", 1.0, .6), path("M24 72 Q50 78 76 72", 1.0, .6)]
    seam = [line(70, 26, 70, 84, 1.0, .5)]
    label = [rect(30, 44, 40, 22, 1.0, .5), circle(50, 55, 5, 1.0, .5)]
    return layer(-4, *label) + layer(0, *can, *seam) + layer(4, *ridge)


def friction_match():
    stick = [rect(46, 20, 6, 76, 1.6), line(48, 20, 48, 94, .9, .5)]
    head = [ellipse(49, 14, 8, 10, 1.8), path("M44 10 q2 -3 5 -3", 1.0, .6)]
    flame = [path("M49 0 q-6 -6 0 -2", 1.0, .6)] if False else [path("M44 2 q5 -8 10 0", 1.0, .0 + 0.65)]
    strike = [rect(66, 52, 30, 40, 1.4), line(70, 60, 92, 60, 1.0, .6), line(70, 70, 92, 70, 1.0, .6), line(70, 80, 92, 80, 1.0, .6)]
    spark = [line(64, 50, 58, 44, 1.0, .8), line(66, 46, 62, 38, 1.0, .8), line(68, 52, 62, 54, 1.0, .8)]
    return layer(-4, *strike) + layer(0, *stick, *head) + layer(4, *flame, *spark)


def puddling_furnace():
    shell = [path("M6 90 L6 52 Q6 36 30 36 L70 36 Q94 36 94 52 L94 90 Z", 1.8), line(6, 90, 94, 90, 1.8)]
    stack = [rect(74, 8, 12, 28, 1.6), line(80, 8, 80, 2, 1.2)]
    bed = [path("M20 70 Q50 76 80 70", 1.2), path("M20 62 q10 -4 20 0 t20 0 t20 0", 1.0, .65)]
    rake = [line(2, 54, 52, 66, 2.0), circle(2, 54, 2, 1.2), poly([(52, 62), (60, 66), (52, 70)], 1.2, closed=True)]
    door = [rect(8, 44, 12, 12, 1.2, .7), line(14, 44, 14, 56, .9, .5)]
    fire = [path("M30 96 q4 -6 0 -10 M44 96 q4 -6 0 -10 M58 96 q4 -6 0 -10", 1.0, .6)]
    return layer(-4, *fire) + layer(0, *shell, *stack, *bed) + layer(4, *rake, *door)


def rolling_mill():
    r1 = [circle(50, 30, 16, 1.8), circle(50, 30, 3, 1.2)] + [line(34, 30 + k, 66, 30 + k, .8, .5) for k in (-6, 6)]
    r2 = [circle(50, 70, 16, 1.8), circle(50, 70, 3, 1.2)] + [line(34, 70 + k, 66, 70 + k, .8, .5) for k in (-6, 6)]
    bar = [rect(2, 46, 36, 8, 1.4), path("M62 48 L98 48 L98 52 L62 52", 1.4)]
    arrow = [poly([(10, 40), (20, 40), (15, 34)], 1.0, closed=True)]
    stand = [rect(24, 4, 6, 92, 1.4), rect(70, 4, 6, 92, 1.4), line(24, 4, 76, 4, 1.4), line(24, 96, 76, 96, 1.4)]
    groove = [circle(50, 50, 2, 1.0, .8)]
    return layer(-4, *arrow) + layer(0, *stand, *bar) + layer(4, *r1, *r2, *groove)


def safety_elevator():
    shaft = [rect(14, 4, 72, 92, 1.8), line(14, 20, 86, 20, 1.0, .5)]
    car = [rect(26, 46, 48, 36, 1.8), line(26, 56, 74, 56, 1.0, .5), line(50, 46, 50, 82, 1.0, .5)]
    rope = [line(50, 4, 50, 46, 1.6), circle(50, 8, 4, 1.2)]
    pawl = [poly([(14, 52), (26, 56), (14, 60)], 1.2, closed=True), poly([(86, 52), (74, 56), (86, 60)], 1.2, closed=True)]
    teeth = [line(14, 28 + i * 8, 18, 28 + i * 8, 1.0, .75) for i in range(9)] + [line(86, 28 + i * 8, 82, 28 + i * 8, 1.0, .75) for i in range(9)]
    spring = [path("M42 46 q-4 -4 0 -8 q4 -4 0 -8 M58 46 q-4 -4 0 -8 q4 -4 0 -8", 1.0, .6)]
    return layer(-4, *spring, *teeth) + layer(0, *shaft, *car, *rope) + layer(4, *pawl)


def airship():
    env = [path("M4 48 Q4 30 40 30 L66 30 Q96 30 96 48 Q96 66 66 66 L40 66 Q4 66 4 48 Z", 1.8)]
    ribs = [line(18 + i * 10, 32, 18 + i * 10, 64, 1.0, .5) for i in range(8)] + [line(8, 48, 94, 48, 1.0, .5)]
    gondola = [rect(38, 76, 24, 10, 1.6), line(42, 66, 42, 76, 1.2), line(58, 66, 58, 76, 1.2)]
    fins = [poly([(90, 40), (100, 28), (100, 44)], 1.2, closed=True), poly([(90, 56), (100, 52), (100, 68)], 1.2, closed=True)]
    prop = [line(66, 80, 78, 80, 1.2), line(78, 74, 78, 86, 1.6), line(38, 80, 26, 80, 1.2)]
    return layer(-4, *ribs) + layer(0, *env, *gondola) + layer(4, *fins, *prop)


def glider():
    wing = [path("M2 40 Q50 24 98 40 Q50 36 2 40 Z", 1.8), path("M50 38 L50 66", 1.2)]
    fuse = [path("M50 38 L50 74 L40 90 L60 90 L50 74", 1.6)] if False else [line(50, 36, 50, 82, 1.8), line(36, 82, 64, 82, 1.6), line(50, 82, 50, 90, 1.4)]
    pilot = [circle(50, 56, 4, 1.4), line(50, 60, 50, 72, 1.4), line(44, 66, 56, 66, 1.2)]
    ribs = [line(14 + i * 12, 35 - (6 - abs(i - 3) * 2) * 0.6, 14 + i * 12, 38, .9, .5) for i in range(7)]
    wind = [path("M0 20 q10 -3 20 0 M80 14 q10 -3 20 0", 1.0, .5)]
    return layer(-4, *wind) + layer(0, *wing, *fuse, *ribs) + layer(4, *pilot)


def fire_arrow():
    shaft = [line(8, 50, 86, 50, 1.6), poly([(86, 46), (98, 50), (86, 54)], 1.4, closed=True)]
    tube = [rect(30, 42, 28, 16, 1.6), line(30, 50, 58, 50, .9, .5)]
    fuse = [path("M30 50 q-6 -8 -12 -4 q-6 4 -8 -2", 1.0, .75)]
    fl = [path("M2 50 q-0 -8 6 -12 M4 56 q6 4 10 8", 1.0, .6)]
    fletch = [poly([(10, 50), (4, 42), (16, 46)], 1.0, closed=True), poly([(10, 50), (4, 58), (16, 54)], 1.0, closed=True)]
    bands = [line(36, 42, 36, 58, 1.0), line(52, 42, 52, 58, 1.0)]
    return layer(-4, *fl) + layer(0, *shaft, *tube, *fletch) + layer(4, *fuse, *bands)


def torpedo():
    body = [path("M10 50 Q10 36 36 36 L74 36 Q92 36 98 50 Q92 64 74 64 L36 64 Q10 64 10 50 Z", 1.8)]
    ribs = [line(30, 36, 30, 64, 1.0, .5), line(54, 36, 54, 64, 1.0, .5), line(72, 36, 72, 64, 1.0, .5)]
    prop = [line(10, 50, 4, 50, 1.4), line(4, 40, 4, 60, 1.6), line(2, 44, 8, 44, 1.0), line(2, 56, 8, 56, 1.0)]
    fins = [poly([(22, 36), (28, 24), (34, 36)], 1.2, closed=True), poly([(22, 64), (28, 76), (34, 64)], 1.2, closed=True)]
    nose = [circle(94, 50, 2, 1.0), line(98, 50, 100, 50, 1.2)]
    wake = [path("M2 80 q8 -3 16 0 t16 0 t16 0", 1.0, .5)]
    return layer(-4, *wake) + layer(0, *body, *fins) + layer(4, *ribs, *prop, *nose)


def ironclad():
    hull = [path("M4 66 L96 66 L88 82 L12 82 Z", 1.8), line(4, 66, 96, 66, 1.8)]
    casemate = [path("M22 66 L28 40 L72 40 L78 66", 1.8), line(28, 52, 72, 52, 1.0, .55)]
    plates = [line(24 + i * 8, 66, 28 + i * 8, 40, .9, .5) for i in range(6)]
    funnel = [rect(46, 22, 8, 18, 1.4), line(50, 22, 50, 14, 1.0, .6)]
    ports = [circle(36, 59, 2, 1.0), circle(50, 59, 2, 1.0), circle(64, 59, 2, 1.0)]
    water = [path("M0 88 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t16 0", 1.0, .5)]
    return layer(-4, *water, *plates) + layer(0, *hull, *casemate) + layer(4, *funnel, *ports)


def paddle_steamer():
    hull = [path("M6 60 L94 60 L84 78 L16 78 Z", 1.8)]
    box = [path("M38 60 Q38 38 50 38 Q62 38 62 60", 1.6)]
    wheel = [circle(50, 62, 14, 1.4), circle(50, 62, 3, 1.2)] + [line(*pol(50, 62, 3, k * 45), *pol(50, 62, 14, k * 45), .9, .7) for k in range(8)] + [line(*pol(50, 62, 14, k * 45 + 10), *pol(50, 62, 18, k * 45 + 10), 1.2) for k in range(8)]
    funnel = [rect(20, 28, 8, 32, 1.4), line(24, 28, 24, 20, 1.2, .6), path("M24 20 q4 -6 8 -2", 1.0, .5)]
    mast = [line(78, 60, 78, 24, 1.4), line(70, 32, 86, 32, 1.0, .7)]
    water = [path("M0 82 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t16 0", 1.0, .5), path("M60 70 q10 6 22 6", 1.0, .45)]
    return layer(-4, *water) + layer(0, *hull, *funnel, *mast) + layer(4, *box, *wheel)


def gyrocompass():
    ring = [circle(50, 50, 40, 1.8), circle(50, 50, 33, 1.0, .5)] + [line(*pol(50, 50, 33, k * 22.5), *pol(50, 50, 40, k * 22.5), .9, .8) for k in range(16)]
    gyro = [ellipse(50, 50, 18, 6, 1.6), ellipse(50, 50, 18, 6, 1.0, .5), circle(50, 50, 3, 1.2)]
    gimbal = [circle(50, 50, 24, 1.2, .8), line(50, 26, 50, 74, 1.0, .6)]
    north = [poly([(50, 8), (45, 20), (55, 20)], 1.2, closed=True), line(50, 20, 50, 34, 1.0)]
    lub = [line(26, 50, 14, 50, 1.2), line(74, 50, 86, 50, 1.2)]
    return layer(-4, *lub) + layer(0, *ring, *gimbal) + layer(4, *gyro, *north)


def sonar():
    ship = [path("M6 20 L40 20 L34 32 L12 32 Z", 1.8), line(14, 20, 14, 10, 1.2)]
    water = [path("M0 36 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t16 0", 1.0, .55)]
    pings = [arc(24, 34, 14 + i * 10, 20, 100, 1.2 if i == 0 else 1.0, None if i == 0 else .7) for i in range(4)] if False else [path(f"M{24 - r * .5} {34 + r * .86} A {r} {r} 0 0 0 {24 + r * .5} {34 + r * .86}", 1.2 if i == 0 else 1.0, None if i == 0 else .6) for i, r in enumerate((14, 26, 38, 50))]
    floor = [path("M0 92 L20 86 L40 94 L60 84 L80 90 L100 82", 1.6)]
    sub = [ellipse(70, 66, 12, 4, 1.4), rect(66, 58, 8, 4, 1.0), line(70, 58, 70, 54, 1.0)]
    echo = [path("M64 70 q-20 6 -40 -24", 1.0, .45)]
    return layer(-4, *echo, *water) + layer(0, *ship, *floor) + layer(4, *pings, *sub)


def refrigerating_machine():
    flask = [circle(26, 62, 16, 1.6), rect(22, 36, 8, 12, 1.4), line(26, 36, 26, 28, 1.4)]
    pump = [rect(66, 20, 14, 36, 1.6), line(73, 8, 73, 36, 1.4), rect(66, 8, 14, 4, 1.2)]
    pipe = [path("M26 28 L26 18 L66 18", 1.4), path("M73 56 L73 70 L40 70", 1.2, .7)]
    ice = [rect(14, 82, 24, 12, 1.2, .7), line(18, 86, 34, 86, .9, .5), line(18, 90, 30, 90, .9, .5)]
    vap = [path("M20 54 q4 -4 0 -8 M30 54 q4 -4 0 -8", 1.0, .6)]
    return layer(-4, *vap) + layer(0, *flask, *pump) + layer(4, *pipe, *ice)


def crookes_tube():
    glass = [path("M10 50 Q10 18 40 18 L60 18 Q90 18 90 50 Q90 82 60 82 L40 82 Q10 82 10 50 Z", 1.8)]
    cath = [line(2, 50, 18, 50, 1.6), rect(18, 38, 4, 24, 1.4)]
    anode = [line(98, 50, 78, 50, 1.6), poly([(70, 38), (78, 50), (70, 62)], 1.4, closed=True)]
    rays = [line(24, 50 + k * 4, 68, 50 + k * 3, 1.0, .55) for k in (-3, -1, 0, 1, 3)] if False else [line(24, 44 + k * 3, 68, 44 + k * 3, 1.0, .55) for k in range(5)]
    xr = [line(72, 60, 90, 94, .9, .5), line(76, 62, 96, 92, .9, .5)]
    port = [line(40, 18, 40, 10, 1.2), line(60, 18, 60, 10, 1.2)]
    return layer(-4, *xr) + layer(0, *glass, *port) + layer(4, *cath, *anode, *rays)


ITEMS = [
    dict(id="exp28_post_windmill", n="Post Windmill", era="science", cat="technology", ds=1185, rar="uncommon",
         date="Persian panemone c. 700–900 AD; Weedley, Yorkshire 1185; tower mill late 13th century; Dutch drainage mills early 15th century", vis="pivoting-body-sails", topic="mills_exp28",
         region="Northwestern Europe (northern France, eastern England, Flanders); Persia earlier", artifactType="windmill", material="timber and cloth sails", physical=True, durable=False,
         l1="A wooden mill body that turns whole on a central post to face the wind.",
         l2="The page lists the buck and post holding the machinery, trestle and roundhouse supporting a post mill, a windshaft and brake wheel carrying power from the sails, and a wallower, great spur wheel and stone nuts turning the millstones.",
         l3="The earliest certain northern European reference is at Weedley, Yorkshire, in 1185. The post mill was the earliest European type; tower mills (late 13th century) turn only the cap, and smock mills are 17th century. Persian panemones (c. 700–900) had horizontal sails on a vertical shaft. Fun fact: in the Netherlands sails stopped in a '+' meant the mill was open, an 'X' closed. (not known: who built the first post mill; the page does not mention Normandy.)",
         ev="Weedley reference (1185)", first_known="c. 700–900 (Persian panemone)",
         confidence=dict(level="uncertain", note="ds is the first certain northern European reference (1185); the Persian design was horizontal, not vertical."),
         srcs=[wp("windmill_wp", "Windmill", "Persian panemone c. 700-900; Weedley Yorkshire 1185 earliest certain northern European reference; post mill earliest European type; tower mill late 13th century; smock mill 17th century; sails + and X signals.")],
         pool=['wood', 'water_power', 'gear', 'axle', 'cloth', 'lever', 'engineering', 'mechanism', 'exp28_water_stamp_mill', 'exp28_water_fulling_mill'], must=['wood'], nrec=2,
         tags=["mill", "wind"], regions=["europe", "africa_asia"], art=post_mill()),
    dict(id="exp28_tin_can", n="Tin Can (Durand's Preserving Can)", era="industry", cat="technology", ds=1810, rar="uncommon",
         date="Appert's glass-jar method 1809; Peter Durand patent 1810; sold to Donkin and Hall 1811; first American cannery 1812", vis="sealed-cylinder", topic="food_exp28",
         region="France (Appert, Girard); England (Durand, Donkin and Hall); New York (Ayars)", artifactType="food container", material="tinned iron", physical=True, durable=True,
         l1="A sealed tin cylinder in which cooked food keeps for years.",
         l2="Appert observed that food cooked in a jar did not spoil unless the seals leaked and sealed food in glass jars; Max Ams invented the double seam in 1888.",
         l3="In 1810 Appert was awarded the French government's 12,000-franc prize for preserving food for the armies; the same year Peter Durand patented the tin can process, based on Philippe de Girard's idea, and sold the patent in 1811 to Bryan Donkin and John Hall. Robert Ayars set up the first American cannery in New York in 1812. Fun fact: in 1974 canned food from the 1865 wreck of the steamboat Bertrand was found still safe to eat after 109 years. (not known: the date of the can opener; the page says only 'another thirty years' after 1810, not 1855.)",
         ev="Durand's patent (1810)", first_known="1809",
         confidence=dict(level="established", note="The page gives no exact date for the prize offer and does not link 1812 to Donkin and Hall."),
         srcs=[wp("canning_wp", "Canning", "Appert 1809 glass jars; 12,000-franc prize 1810; Durand tin can patent 1810 from Girard's idea; sold 1811 to Donkin and Hall; Ayars first American cannery 1812; double seam 1888; Bertrand cans eaten 1974.")],
         pool=['iron', 'fire', 'chemistry', 'glass', 'machine_tools', 'exp26_lead_came_window', 'copper', 'engineering', 'steel'], must=['iron'], nrec=2,
         tags=["food", "preservation"], regions=["europe", "americas"], art=tin_can()),
    dict(id="exp28_friction_match", n="Walker's Friction Match", era="industry", cat="technology", ds=1827, rar="uncommon",
         date="Sulphur splints 577; Chancel 1805; Walker first recorded sale 7 April 1827; Sauria white phosphorus 1830/1831; Lundström 1855", vis="splint-head-striker", topic="fire_exp28",
         region="England (Walker); France (Chancel, Sauria); Sweden (Lundström)", artifactType="fire starter", material="wood splint and chemical head", physical=True, durable=False,
         l1="A wooden splint whose chemical head lights when it is scraped.",
         l2="Chancel's 1805 self-igniting match head held potassium chlorate, sulfur, gum arabic and sugar, lit by dipping in sulfuric acid; it was too expensive and dangerous for common use.",
         l3="John Walker may have made his discovery in 1826; his first recorded sale on credit was 7 April 1827, and he stopped making his formula by 1830. Charles Sauria used white phosphorus in 1830 or January 1831; Richard Bell opened the first match factory in London in 1832; the Lundström brothers' red-phosphorus matches date to 1855. Fun fact: the 1888 London matchgirls strike focused on the harm from white phosphorus, and US Congress barred its matches from interstate shipment in 1910. (not known: Walker's own name for his product; the page says he never called them matches.)",
         ev="Walker's first recorded sale (7 April 1827)", first_known="577 (sulphur splints)",
         confidence=dict(level="established", note="Sauria's date varies by source (1830 or January 1831)."),
         srcs=[wp("match_wp", "Match", "Sulphur splints 577; Chancel 1805; Walker first sale 7 April 1827; Sauria 1830/1831; Bell factory 1832; Lundstrom 1855; matchgirls strike 1888; white phosphorus ban 1910.")],
         pool=['fire', 'wood', 'chemistry', 'exp28_flash_powder', 'gunpowder', 'paper', 'experiment', 'glass'], must=['fire'], nrec=2,
         tags=["fire", "chemistry"], regions=["europe"], art=friction_match()),
    dict(id="exp28_puddling_furnace", n="Puddling Furnace", era="industry", cat="technology", ds=1783, rar="rare",
         date="Peter Onions at Dowlais 1783 (patent 1370); Henry Cort at Fontley, patent 1784", vis="reverberatory-hearth-rake", topic="metals_exp28",
         region="England and Wales (Dowlais, Fontley, Cyfarthfa)", artifactType="ironmaking furnace", material="brick furnace and iron rake", physical=True, durable=True,
         l1="A coal-fired reverberatory furnace where a worker stirs molten iron until it becomes tough wrought iron.",
         l2="Stirring the molten iron in an oxidising atmosphere burns off its carbon; when the iron reached a pasty state it was gathered into a puddled ball, shingled and rolled.",
         l3="Peter Onions built a larger reverberatory furnace at Dowlais in 1783 and was granted patent 1370; Henry Cort improved it at Fontley with chimney dampers and patented the process in 1784. As patented it worked only on white cast iron, and Richard Crawshay at Cyfarthfa later modified it. Fun fact: puddled iron went into the Eiffel Tower and the Statue of Liberty's frame, and most puddlers died in their thirties. (not known: how a puddler judged when the balls had 'come to nature', which the page says could not be automated.)",
         ev="Onions' patent 1370 (1783); Cort's patent (1784)", first_known="1783",
         confidence=dict(level="established", note="Page credits both Onions (1783) and Cort (1783–84)."),
         srcs=[wp("puddling_wp", "Puddling_(metallurgy)", "Onions 1783 Dowlais patent 1370; Cort Fontley patent 1784; reverberatory furnace; puddled ball shingled and rolled; wet puddling Joseph Hall yields; Eiffel Tower and Statue of Liberty.")],
         pool=['iron', 'coal', 'exp28_coke_blast_furnace', 'forging', 'exp28_cupola', 'smelting', 'engineering', 'chemistry'], must=['iron'], nrec=2,
         tags=["iron", "furnace"], regions=["europe"], art=puddling_furnace()),
    dict(id="exp28_grooved_rolling_mill", n="Cort's Grooved Rolling Mill", era="industry", cat="technology", ds=1783, rar="rare",
         date="Slitting mills introduced to England 1590; Cort's patent for grooved rolls 1783; steam engine coupled 1786", vis="roll-pair-stand", topic="metals_exp28",
         region="England (Hampshire, Pontypool, Bradley Works)", artifactType="metal rolling machine", material="cast iron rolls", physical=True, durable=True,
         l1="Two grooved iron rollers that squeeze hot iron into bars and plates.",
         l2="Hot rolling is done above the recrystallisation temperature, with tolerances of about 2 to 5%; cold rolling at room temperature strain-hardens the metal up to about 20% and improves finish.",
         l3="Slitting mills, the earliest rolling mills, came to England from what is now Belgium in 1590; Henry Cort patented grooved rolls for iron bars in 1783, reportedly giving 15 times the output of a hammer, and is called the 'father of modern rolling'. A steam engine was first coupled directly to a mill at John Wilkinson's Bradley Works in 1786. Fun fact: aluminium foil's two surface finishes come from pack rolling. (not known: the Leonardo rolling-mill sketch some sources cite; the page does not mention it.)",
         ev="Cort's patent (1783)", first_known="1590 (slitting mills)",
         confidence=dict(level="established", note="The page does not mention Leonardo or call slitting mills Dutch."),
         srcs=[wp("rolling_wp", "Rolling_(metalworking)", "Slitting mills 1590; Cort grooved rolls patent 1783, output 15 times a hammer; steam coupled 1786 Bradley Works; hot and cold rolling; aluminium foil pack rolling.")],
         pool=['iron', 'steam_engine', 'machine_tools', 'forging', 'gear', 'water_power', 'exp28_puddling_furnace', 'engineering'], must=['iron'], nrec=2,
         tags=["iron", "rolling"], regions=["europe"], art=rolling_mill()),
    dict(id="exp28_otis_safety_elevator", n="Otis Safety Elevator", era="industry", cat="engineering", ds=1852, rar="rare",
         date="Archimedes 236 BC (probably); Colosseum 80 AD; flying chair 1743; Otis safety elevator 1852, demonstrated 1854; first passenger elevator 23 March 1857", vis="car-rope-pawls", topic="vertical_transport_exp28",
         region="United States (New York); France (Versailles); Rome", artifactType="passenger lift", material="iron and timber", physical=True, durable=True,
         l1="A hoist cage with toothed rails and spring catches that stop it falling if the rope breaks.",
         l2="Elisha Otis introduced the safety elevator in 1852 and demonstrated it at the New York Crystal Palace in 1854.",
         l3="Vitruvius's writings are the earliest known reference to an elevator and say Archimedes probably built one in 236 BC; the Colosseum (80 AD) had about 25 elevators raising animals; Louis XV had a 'flying chair' built in 1743. The first passenger elevator was installed at 488 Broadway on 23 March 1857. Fun fact: in 1894 a Chicago physician documented 'elevator sickness'. (not known: how Archimedes's elevator worked; the page gives no details.)",
         ev="Crystal Palace demonstration (1854); 488 Broadway (23 March 1857)", first_known="236 BC (probable, Archimedes)",
         confidence=dict(level="established", note="The page gives 1852 for the safety elevator, not 1853."),
         srcs=[wp("elevator_wp", "Elevator", "Archimedes 236 BC probable per Vitruvius; Colosseum 80 AD about 25 elevators; flying chair 1743; Otis safety elevator 1852, Crystal Palace 1854; 488 Broadway 23 March 1857; elevator sickness 1894.")],
         pool=['rope', 'pulley', 'iron', 'lever', 'steam_engine', 'engineering', 'exp28_windlass', 'exp28_elliptic_leaf_spring', 'steel', 'machine_tools'], must=['pulley'], nrec=2,
         tags=["lift", "safety"], regions=["americas", "europe"], art=safety_elevator()),
    dict(id="exp28_dirigible_airship", n="Dirigible Airship", era="industry", cat="technology", ds=1901, rar="rare",
         date="Santos-Dumont No. 6 around the Eiffel Tower 19 October 1901; Giffard 1852; La France 1884; Shenandoah helium 4 September 1923; Hindenburg 6 May 1937", vis="envelope-gondola-fins", topic="flight_exp28",
         region="France (Santos-Dumont, Giffard); Germany (Zeppelin)", artifactType="lighter-than-air aircraft", material="fabric envelope, framework and gas", physical=True, durable=False,
         l1="A powered, steerable gas-filled balloon shaped like a cigar.",
         l2="Rigid airships have an outer framework carrying all loads with gas in internal cells; non-rigid 'blimps' keep shape by gas pressure only. Hydrogen lifts most but burns; helium is safe but rarer and gives somewhat less lift.",
         l3="Santos-Dumont flew Number 6 around the Eiffel Tower and back in under thirty minutes on 19 October 1901, winning a 100,000-franc prize. The page gives only the years 1852 (Giffard) and 1884 (La France) and 'July 1900' for LZ 1. USS Shenandoah (4 September 1923) was the first helium airship; the Hindenburg burned on 6 May 1937, killing 35 of 97. Fun fact: the Graf Zeppelin flew over 1,600,000 km without a passenger injury. (not known: Giffard's exact flight date, which the page omits.)",
         ev="Eiffel Tower flight (19 Oct 1901)", first_known="1852 (Giffard)",
         confidence=dict(level="established", note="The page gives only years for Giffard's flight and La France, and 'July 1900' for LZ 1."),
         srcs=[wp("airship_wp", "Airship", "Santos-Dumont Number 6 19 October 1901, 100,000 francs; Giffard 1852; La France 1884; LZ 1 July 1900; Shenandoah helium 4 September 1923; Hindenburg 6 May 1937; rigid vs non-rigid; Graf Zeppelin 1,600,000 km.")],
         pool=['exp28_montgolfier_balloon', 'internal_combustion_engine', 'cloth', 'steel', 'chemistry', 'engineering', 'exp28_screw_propeller', 'rope', 'cordage'], must=['exp28_montgolfier_balloon'], nrec=2,
         tags=["flight", "airship"], regions=["europe"], art=airship()),
    dict(id="exp28_cayley_glider", n="Cayley Glider", era="industry", cat="technology", ds=1849, rar="rare",
         date="Eilmer of Malmesbury c. 1000–1010; Hezârfen Çelebi c. 1630–1632; Cayley c. 1849; Maloney 1905", vis="fixed-wing-pilot", topic="flight_exp28",
         region="England (Cayley); Malmesbury; Istanbul", artifactType="unpowered aircraft", material="wood, cloth and cord", physical=True, durable=False,
         l1="A fixed-wing frame with no engine that a pilot glides on.",
         l2="George Cayley's gliders achieved brief wing-borne hops around 1849; in 1905 Daniel Maloney showed controlled flight with a balloon-launched glider released from 4,000 feet.",
         l3="Eilmer of Malmesbury reportedly glided about 200 metres c. 1000–1010 (recorded by William of Malmesbury); Hezârfen Ahmed Çelebi is alleged to have flown across the Bosphorus c. 1630–1632. Fun fact: Eilmer and Ibn Firnas both reportedly blamed their crashes on lacking a tail; POWs built the 'Colditz Cock' glider in 1944. (not known: exact dates of Lilienthal's flights; the page says only he made over 2,000, and has no date for Cayley's 1799 concept or the Wright gliders of 1900–1902.)",
         ev="Cayley's gliders (c. 1849)", first_known="c. 1000–1010 (Eilmer, reported)",
         confidence=dict(level="uncertain", note="Early flights are legendary or alleged; the page gives c. 1849 for Cayley."),
         srcs=[wp("glider_wp", "Glider_(aircraft)", "Eilmer c. 1000-1010 glided 200 m; Hezarfen c. 1630-1632 alleged; Cayley c. 1849 hops; Maloney 1905 from 4,000 feet; Colditz Cock 1944; lacking a tail.")],
         pool=['wood', 'cloth', 'cordage', 'fiber', 'geometry', 'exp28_dandy_horse', 'physics', 'observation', 'exp28_montgolfier_balloon'], must=['wood'], nrec=2,
         tags=["flight", "glider"], regions=["europe", "africa_asia"], art=glider()),
    dict(id="exp28_fire_arrow", n="Song Fire Arrow", era="science", cat="technology", ds=969, rar="rare",
         date="Yue Yifang and Feng Jisheng 969; History of Song credits Tang Fu 1000; 350,000 fire arrows produced 1083", vis="arrow-powder-pouch", topic="gunpowder_exp28",
         region="Song China", artifactType="incendiary arrow", material="bamboo or wood shaft, gunpowder pouch, pine resin", physical=True, durable=False,
         l1="An arrow with a gunpowder pouch that burns, and in later rocket form flies by its own blast.",
         l2="A pouch of gunpowder was bound to the shaft, sealed with pine resin and fused, then shot from a bow or crossbow. Gunpowder carries its own oxygen, so its flames were harder to put out than earlier incendiaries.",
         l3="Gunpowder rocket arrows were invented in 969 by Yue Yifang and Feng Jisheng (the page spells the first name this way); the History of Song also credits Tang Fu in 1000. Joseph Needham argues rockets could not exist before the 12th century and Stephen Haw sees only slight evidence before 1200. Fun fact: Song records say the court produced 350,000 fire arrows in 1083. (not known: whether the 969 arrows were propelled rockets; the page does not mention a 1232 Kaifeng use or a 'gunpowder tube'.)",
         ev="History of Song (969; 1000; 1083)", first_known="969",
         confidence=dict(level="debated", note="Dating of true rockets is disputed (Needham, Haw)."),
         srcs=[wp("firearrow_wp", "Fire_arrow", "Rocket arrows invented 969 by Yue Yifang and Feng Jisheng; History of Song credits Tang Fu 1000; Needham 12th century; Haw before 1200; pouch sealed with pine resin; 350,000 fire arrows 1083.")],
         pool=['gunpowder', 'bow', 'exp28_crossbow', 'wood', 'paper', 'cordage', 'chemistry', 'fire'], must=['gunpowder'], nrec=2,
         tags=["gunpowder", "weapon"], regions=["africa_asia"], art=fire_arrow()),
    dict(id="exp28_whitehead_torpedo", n="Whitehead Torpedo", era="industry", cat="technology", ds=1866, rar="rare",
         date="Fulton's attacks April 1804 and 20 July 1807; Whitehead presented 21 December 1866; first sinking 16 January 1878", vis="tube-prop-fins", topic="naval_exp28",
         region="Austria (Fiume, Whitehead); Russia; Chile", artifactType="naval weapon", material="steel casing, compressed air engine", physical=True, durable=False,
         l1="A self-propelled underwater missile driven by compressed air.",
         l2="Whitehead's tubular, self-propelled torpedo was powered by compressed air and officially presented to the Austrian Imperial Naval commission on 21 December 1866.",
         l3="Robert Fulton's torpedo attacks on French ships at Boulogne in April 1804 did no significant damage; on 20 July 1807 he destroyed a vessel in New York Harbor as a demonstration. Russian torpedo boats under Stepan Makarov sank the Turkish steamer Intibah on 16 January 1878. Whitehead bought Ludwig Obry's gyroscope rights in 1888 and a better design in 1890. Fun fact: on 23 April 1891 the Chilean ironclad Blanco Encalada became the first ironclad sunk by a self-propelled torpedo. (not known: the 1895 gyroscope date; the page does not give it.)",
         ev="Presentation to the naval commission (21 Dec 1866)", first_known="1804 (Fulton)",
         confidence=dict(level="established", note="The attacker at Intibah was Russian, not Turkish."),
         srcs=[wp("torpedo_wp", "Torpedo", "Fulton April 1804 and 20 July 1807; Whitehead presented 21 December 1866 compressed air; Obry gyroscope 1888 and 1890; Intibah sunk 16 January 1878; Blanco Encalada 23 April 1891.")],
         pool=['steel', 'iron', 'exp28_screw_propeller', 'gunpowder', 'chemistry', 'engineering', 'exp28_difference_engine', 'machine_tools'], must=['exp28_screw_propeller'], nrec=2,
         tags=["naval", "weapon"], regions=["europe"], art=torpedo()),
    dict(id="exp28_ironclad_warship", n="Ironclad Warship", era="industry", cat="engineering", ds=1859, rar="rare",
         date="French batteries at Kinburn 1855; Gloire launched November 1859; HMS Warrior 1860; Monitor v Virginia 9 March 1862", vis="armoured-casemate-hull", topic="naval_exp28",
         region="France; Britain; United States", artifactType="warship", material="wrought iron over teak", physical=True, durable=True,
         l1="A steam warship whose wooden sides are covered in thick iron plates.",
         l2="Gloire had 4.5 in (114 mm) iron plates and a top speed of 13 knots, with thirty-six 6.4 in rifled guns; HMS Warrior carried the same 4.5 in plate backed by 15 in of teak and steamed at 14.3 knots.",
         l3="Three French ironclad batteries (Lave, Tonnante and Dévastation) fought at Kinburn in 1855, reaching only about 4 knots. The Monitor and Virginia fought on 9 March 1862 and showed wooden warships were obsolete. Krupp developed gas cementing in 1894. Fun fact: CSS Manassas became the first ironclad in combat on 12 October 1861, and Spain's Numancia was the first to circumnavigate the world, arriving in Cádiz on 20 September 1867. (not known: Warrior's exact launch date; the page gives only 1860.)",
         ev="Gloire (1859); Hampton Roads (9 March 1862)", first_known="1855 (floating batteries)",
         confidence=dict(level="established", note="The page gives only the year 1860 for HMS Warrior."),
         srcs=[wp("ironclad_wp", "Ironclad_warship", "Gloire November 1859 4.5 in plate 13 knots; Warrior 1860 teak backing 14.3 knots; Hampton Roads 9 March 1862; Kinburn 1855 batteries; Krupp 1894; Manassas 12 October 1861; Numancia 20 September 1867.")],
         pool=['iron', 'steam_engine', 'wood', 'exp28_screw_propeller', 'exp28_grooved_rolling_mill', 'exp28_puddling_furnace', 'gunpowder', 'engineering', 'boat'], must=['iron'], nrec=2,
         tags=["naval", "armour"], regions=["europe", "americas"], art=ironclad()),
    dict(id="exp28_paddle_steamer", n="Paddle Steamer", era="industry", cat="technology", ds=1783, rar="rare",
         date="Pyroscaphe 1783; Charlotte Dundas 1802; Clermont 1807; PS Comet 1812; Savannah 1819; Sirius 1838", vis="paddlebox-wheel-funnel", topic="ships_exp28",
         region="France (Saône); Scotland (Clyde); United States (Hudson)", artifactType="steamboat", material="timber, iron and steam engine", physical=True, durable=True,
         l1="A steamboat driven by big side wheels with paddle blades.",
         l2="About the bottom quarter of the wheel sits in the water; feathering linkages keep each blade nearly vertical while immersed, and a paddlebox reduces splashing.",
         l3="Claude de Jouffroy's Pyroscaphe steamed up the Saône for 15 minutes in 1783 before its engine failed; Symington's Charlotte Dundas (1802) hauled two 70-ton barges nearly 20 mi in 6 hours; Fulton's Clermont entered commercial service in 1807; Henry Bell's PS Comet began Europe's first scheduled passenger service on the Clyde in 1812. Fun fact: Brunel's Great Eastern, at 692 ft and over 32,000 tons, was the largest paddle steamer ever built, and the Waverley is the last seagoing one. (not known: what happened to the Pyroscaphe after 1783.)",
         ev="Pyroscaphe (1783); Comet (1812)", first_known="1783",
         confidence=dict(level="established", note="The page gives only years for each early vessel."),
         srcs=[wp("paddle_wp", "Paddle_steamer", "Pyroscaphe 1783 15 minutes; Charlotte Dundas 1802; Clermont 1807; Comet 1812; Savannah 1819; Sirius 1838; feathering floats; Great Eastern 692 ft; Waverley last seagoing.")],
         pool=['steam_engine', 'boat', 'wheel', 'wood', 'iron', 'exp26_paddle_waterwheel', 'engineering', 'axle', 'exp28_newcomen_engine'], must=['steam_engine'], nrec=2,
         tags=["ships", "steam"], regions=["europe", "americas"], art=paddle_steamer()),
    dict(id="exp28_gyrocompass", n="Gyrocompass", era="industry", cat="technology", ds=1906, rar="rare",
         date="Usable gyrocompass invented 1906 (Germany), tested 1908; Sperry patent 1908; US Navy 1911; Plath commercial 1913", vis="spinning-rotor-card", topic="navigation_exp28",
         region="Germany; United States", artifactType="navigation instrument", material="steel rotor, brass, fluid", physical=True, durable=True,
         l1="A fast-spinning wheel that finds true north from the Earth's rotation.",
         l2="A gyroscope alone does not find north; a gyrocompass adds either viscous-fluid friction or weights so torque turns the axis until it points to the celestial pole.",
         l3="The page says a usable gyrocompass was invented in Germany in 1906 and passed tests in 1908; Elmer Sperry's patent 1,242,065 is dated 1908 and the US Navy adopted his unit in 1911. In 1913 C. Plath developed the first one on a commercial vessel. Fun fact: Max Schuler found in 1923 that tuning to 84.4 minutes makes it insensitive to lateral motion, and Sperry's 'Metal Mike' was the first gyroscope-guided autopilot. (not known: the Foucault 1852 gyroscope and an Anschütz-Kaempfe 1908 patent, which the page does not mention.)",
         ev="German tests (1908); Navy adoption (1911)", first_known="1906",
         confidence=dict(level="established", note="The page does not mention Foucault or an Anschütz-Kaempfe patent."),
         srcs=[wp("gyro_wp", "Gyrocompass", "Usable gyrocompass invented 1906 Germany, tested 1908; Sperry patent 1908; US Navy 1911; Plath 1913; Schuler 84.4 minutes 1923; Krebs 1889; Metal Mike autopilot.")],
         pool=['compass', 'steel', 'electric_motor', 'navigation', 'physics', 'mechanism', 'measurement', 'exp28_marine_chronometer', 'machine_tools', 'electricity'], must=['compass'], nrec=2,
         tags=["navigation", "gyroscope"], regions=["europe", "americas"], art=gyrocompass()),
    dict(id="exp28_fessenden_sonar", n="Active Sonar", era="industry", cat="technology", ds=1912, rar="rare",
         date="Leonardo tube 1490; Fessenden from 1912, tested 1914; Langevin 1915; Boyle quartz prototype mid-1917; ASDIC tested 1920, production 1922", vis="pings-hull-seabed", topic="navigation_exp28",
         region="Canada/Newfoundland (Fessenden); France (Langevin); Britain (Boyle)", artifactType="sound-ranging device", material="oscillator or quartz transducer", physical=True, durable=True,
         l1="A ship's sound pinger that listens for echoes from icebergs, submarines or the seabed.",
         l2="Fessenden's system in 1914 demonstrated depth sounding, Morse code and echo ranging and detected an iceberg at 2 miles (3.2 km); at about 500 Hz its 3 m wavelength was too long to find the bearing.",
         l3="Leonardo da Vinci recorded in 1490 a tube in the water used to detect vessels by ear. After the Titanic disaster (1912) Fessenden built a system tested off Newfoundland in 1914; in 1915 Langevin and Chilowsky developed active devices against submarines; in mid-1917 Boyle's team made the first practical one with quartz piezoelectric crystals. Fun fact: the 'Allied Submarine Detection Investigation Committee' meaning of ASDIC was invented in 1939; no such committee appears in the archives. (not known: the Colladon and Sturm 1826 experiment, which the page does not mention.)",
         ev="Fessenden's 1914 test; Boyle prototype (1917)", first_known="1490",
         confidence=dict(level="established", note="ds uses Fessenden's system begun in 1912; the page does not mention Colladon and Sturm."),
         srcs=[wp("sonar_wp", "Sonar", "Leonardo 1490 tube; Fessenden 1912, tested 1914 iceberg 2 miles; Langevin and Chilowsky 1915; Boyle quartz mid-1917; ASDIC 1920 and 1922; ASDIC name story 1939; Hunt coined sonar.")],
         pool=['electricity', 'physics', 'exp28_galvanometer', 'exp28_triode', 'boat', 'measurement', 'exp28_marshallese_stick_chart', 'anc27_sounding_lead_weight', 'vacuum_tube', 'exp28_diving_bell'], must=[], nrec=2,
         tags=["sound", "ocean"], regions=["americas", "europe"], art=sonar()),
    dict(id="exp28_cullen_refrigerating_machine", n="Cullen Refrigerating Machine", era="industry", cat="technology", ds=1755, rar="rare",
         date="Cullen 1755; Franklin and Hadley 1758; Evans 1805; Perkins 1834; Gorrie 1842; Harrison 1851; Carré 1859 (patent 1860)", vis="flask-ether-pump", topic="cooling_exp28",
         region="Scotland (Cullen); England, United States", artifactType="cooling apparatus", material="glass flask, pump and ether", physical=True, durable=False,
         l1="A pump that boils ether in a vacuum so it draws heat out and makes ice.",
         l2="A pump makes a partial vacuum over diethyl ether, which boils and absorbs heat; Evans (1805) described a closed vapour-compression cycle and Perkins (1834) built the first working one.",
         l3="William Cullen built a small refrigerating machine in 1755 (the page gives 1755, not 1748); in 1758 Franklin and Hadley cooled a thermometer bulb below freezing by evaporation. Gorrie built an ice-making prototype in 1842, and Ferdinand Carré's ammonia absorption system (1859) was patented in 1860. Fun fact: the Dunedin's 15 February 1882 voyage is considered the first commercially successful refrigerated shipment. (not known: James Harrison's 1851 machine's design, which the page names only as the 1851 ice machine.)",
         ev="Cullen's machine (1755); Perkins's system (1834)", first_known="1755",
         confidence=dict(level="established", note="The page does not give 1851 for Gorrie; it says Harrison built the 1851 ice machine."),
         srcs=[wp("fridge_wp", "Refrigeration", "Cullen 1755 ether partial vacuum; Franklin and Hadley 1758; Evans 1805; Perkins 1834; Gorrie 1842; Carre 1859 patent 1860; Dunedin 15 February 1882; GE 1911; Monitor Top 1927.")],
         pool=['glass', 'physics', 'experiment', 'exp26_graduated_glass_tube', 'exp26_drawn_glass_tube', 'exp28_torricelli_barometer', 'measurement', 'observation', 'steam', 'steam_engine', 'exp28_siphon', 'exp28_chain_pump', 'copper', 'exp28_diving_bell', 'exp28_newcomen_engine'], must=[], nrec=2,
         tags=["cooling", "chemistry"], regions=["europe"], art=refrigerating_machine()),
    dict(id="exp28_crookes_tube_xray", n="Crookes Tube (X-ray Source)", era="electric", cat="science", ds=1895, rar="rare",
         date="Röntgen discovered X-rays 8 November 1895; first paper submitted 28 December 1895", vis="evacuated-glass-electrodes", topic="radiation_exp28",
         region="Germany (Würzburg)", artifactType="vacuum discharge tube", material="evacuated glass and metal electrodes", physical=True, durable=True,
         l1="An evacuated glass tube whose electron beam makes invisible X-rays when it hits the glass or anode.",
         l2="Crookes tubes ionised residual air using a high DC voltage, from a few kilovolts to 100 kV; the accelerated electrons made X-rays on striking the anode or the glass wall.",
         l3="Wilhelm Röntgen discovered X-rays on 8 November 1895 while experimenting with Lenard and Crookes tubes and submitted his first paper on 28 December 1895. Fun fact: he noticed a glow from a screen about 1 metre away while the tube was wrapped in black cardboard, and named the rays 'X' for unknown. (not known: the date of the radiograph of his wife's hand and the year of his Nobel Prize; the page gives neither.)",
         ev="Röntgen's discovery (8 Nov 1895)", first_known="1895",
         confidence=dict(level="established", note="The page does not date the first radiograph of Röntgen's wife's hand."),
         srcs=[wp("xray_wp", "X-ray", "Rontgen discovered X-rays 8 November 1895 with Lenard and Crookes tubes; first paper 28 December 1895; Crookes tubes few kV to 100 kV; glow 1 m away through black cardboard; named X for unknown.")],
         pool=['glass', 'electricity', 'exp26_drawn_glass_tube', 'physics', 'experiment', 'exp28_voltaic_pile', 'exp28_pixii_dynamo', 'exp28_galvanometer', 'photography'], must=['glass'], nrec=2,
         tags=["radiation", "physics"], regions=["europe"], art=crookes_tube()),
]
