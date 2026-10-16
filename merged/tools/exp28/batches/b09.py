"""EXP28 batch 09 — everyday & industrial inventions. Facts only from pages fetched 2026-10-16.
Unknowns are stated as '(not known)' in l3, followed by a fun fact from the same page."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def barbed_wire():
    w1 = [path("M2 50 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0", 1.6)]
    w2 = [path("M2 50 q8 8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0", 1.6)]
    barbs = []
    for x in (18, 50, 82):
        barbs += [line(x, 44, x - 6, 34, 1.2), line(x, 44, x + 6, 34, 1.2), line(x, 56, x - 6, 66, 1.2), line(x, 56, x + 6, 66, 1.2)]
    post = [rect(4, 14, 6, 80, 1.4), rect(90, 14, 6, 80, 1.4)]
    return layer(-4, line(2, 94, 98, 94, 1.0, .5)) + layer(0, *post, *w1, *w2) + layer(4, *barbs)


def typewriter():
    body = [path("M10 80 L16 50 L84 50 L90 80 Z", 1.8)]
    keys = [circle(24 + i * 8, 62 + (i % 2) * 6, 2.6, 1.0) for i in range(8)]
    bars = [line(50, 50, *pol(50, 50, 30, -150 + i * 20), 1.0, .75) for i in range(8)]
    platen = [rect(14, 24, 72, 8, 1.6), circle(10, 28, 3, 1.2), circle(90, 28, 3, 1.2)]
    paper = [rect(28, 4, 44, 22, 1.2, .8), line(32, 10, 66, 10, .9, .5), line(32, 16, 58, 16, .9, .5)]
    return layer(-4, *paper) + layer(0, *body, *platen) + layer(4, *bars, *keys)


def sewing_machine():
    arm = [path("M8 84 L8 40 Q8 28 22 28 L84 28 Q92 28 92 38 L92 52 L82 52 L82 40 L24 40 L24 84 Z", 1.8)]
    needle = [line(80, 40, 80, 70, 1.6), circle(80, 66, 1.2, 1.0), line(78, 40, 82, 40, 1.4)]
    plate = [rect(60, 70, 36, 6, 1.4), line(60, 73, 96, 73, .9, .5)]
    wheel = [circle(14, 60, 8, 1.4), circle(14, 60, 2, 1.0)]
    thread = [path("M40 28 q0 -10 12 -12 M52 16 L80 40", 1.0, .6), circle(40, 24, 4, 1.2)]
    treadle = [line(6, 84, 94, 84, 1.4), line(30, 84, 40, 96, 1.2), line(14, 68, 30, 84, 1.0, .6)]
    return layer(-4, *treadle, *thread) + layer(0, *arm, *plate) + layer(4, *needle, *wheel)


def dandy_horse():
    wf = [circle(24, 68, 20, 1.8), circle(24, 68, 2, 1.2)] + [line(*pol(24, 68, 2, k * 45), *pol(24, 68, 20, k * 45), .9, .6) for k in range(8)]
    wr = [circle(78, 68, 20, 1.8), circle(78, 68, 2, 1.2)] + [line(*pol(78, 68, 2, k * 45), *pol(78, 68, 20, k * 45), .9, .6) for k in range(8)]
    beam = [line(24, 68, 38, 40, 1.6), line(38, 40, 78, 44, 1.8), line(78, 68, 78, 44, 1.4), rect(52, 32, 18, 6, 1.2)]
    steer = [line(38, 40, 34, 22, 1.6), line(26, 22, 44, 22, 1.8)]
    return layer(-4, line(4, 90, 96, 90, 1.0, .5)) + layer(0, *wf, *wr, *beam) + layer(4, *steer)


def pneumatic_tyre():
    outer = [circle(50, 50, 40, 2.0), circle(50, 50, 32, 1.4)]
    tread = [line(*pol(50, 50, 40, k * 15), *pol(50, 50, 44, k * 15), 1.0, .85) for k in range(24)]
    rim = [circle(50, 50, 22, 1.4), circle(50, 50, 5, 1.2)] + [line(*pol(50, 50, 5, k * 30), *pol(50, 50, 22, k * 30), .9, .6) for k in range(12)]
    tube = [circle(50, 50, 36, 1.0, .5)]
    valve = [line(50, 28, 50, 20, 1.4), rect(48, 14, 4, 8, 1.0)]
    return layer(-4, *tube) + layer(0, *outer, *tread) + layer(4, *rim, *valve)


def newcomen_engine():
    beam = [path("M18 18 L82 12", 2.2), line(50, 16, 50, 34, 1.6), poly([(44, 34), (56, 34), (50, 24)], 1.2, closed=True)]
    cyl = [rect(10, 26, 16, 34, 1.8), line(18, 12, 18, 48, 1.0)]
    boiler = [path("M6 90 Q6 62 22 62 L40 62 Q56 62 56 90 Z", 1.8), line(16, 60, 16, 60, 1.0)]
    pump = [line(82, 12, 82, 62, 1.4), rect(72, 62, 20, 30, 1.2), line(72, 78, 92, 78, 1.0, .6)]
    pipe = [path("M18 60 L18 62", 1.4), path("M26 40 L40 40 L40 62", 1.0, .6)]
    fire = [path("M24 98 q4 -6 0 -10 M32 98 q4 -6 0 -10", 1.0, .6)]
    return layer(-4, *fire, *pipe) + layer(0, *boiler, *cyl, *pump) + layer(4, *beam)


def steam_turbine():
    shaft = [line(4, 50, 96, 50, 2.0)]
    rotors = []
    for i in range(4):
        x = 20 + i * 18
        rotors += [rect(x, 28 - i * 2, 4, 44 + i * 4, 1.2)] + [line(x - 4, 28 - i * 2 + j * 6, x + 8, 28 - i * 2 + j * 6 + 2, .9, .75) for j in range(7 + i)]
    casing = [path("M12 18 L12 8 L88 8 L88 92 L12 92 L12 82", 1.8)]
    inlet = [line(4, 28, 12, 28, 1.6), line(4, 72, 12, 72, 1.6)]
    steam = [path("M0 24 q4 -4 8 0 M0 76 q4 -4 8 0", 1.0, .6)]
    return layer(-4, *steam) + layer(0, *casing, *shaft, *inlet) + layer(4, *rotors)


def phonograph():
    cyl = [rect(30, 46, 40, 24, 1.6)] + [line(32 + i * 4, 46, 32 + i * 4, 70, .9, .7) for i in range(9)]
    horn = [path("M28 56 L8 40 Q4 56 8 72 L28 62 Z", 1.6), path("M12 44 Q8 56 12 68", 1.0, .6)]
    crank = [line(70, 58, 88, 58, 1.8), circle(92, 58, 4, 1.4), line(92, 58, 92, 76, 1.4)]
    base = [rect(22, 74, 56, 8, 1.6), line(26, 82, 26, 92, 1.2), line(74, 82, 74, 92, 1.2)]
    stylus = [line(50, 34, 50, 46, 1.2), circle(50, 32, 3, 1.0)]
    return layer(-4, *stylus) + layer(0, *cyl, *base) + layer(4, *horn, *crank)


def incandescent_bulb():
    glass = [path("M50 6 Q80 6 80 38 Q80 54 64 62 L64 74 L36 74 L36 62 Q20 54 20 38 Q20 6 50 6", 1.8)]
    base = [rect(36, 74, 28, 20, 1.6)] + [line(36, 78 + i * 4, 64, 78 + i * 4, 1.0, .75) for i in range(4)] + [circle(50, 96, 3, 1.2)]
    fil = [path("M42 62 L42 34 q4 -6 8 0 t8 0 L58 62", 1.4), line(42, 62, 42, 74, 1.0), line(58, 62, 58, 74, 1.0)]
    glow = [circle(50, 36, 18, 1.0, .35)]
    return layer(-4, *glow) + layer(0, *glass, *base) + layer(4, *fil)


def dynamo():
    mag = [path("M16 30 Q16 8 50 8 Q84 8 84 30 L72 30 Q72 18 50 18 Q28 18 28 30 Z", 1.8), rect(14, 30, 14, 10, 1.2), rect(72, 30, 14, 10, 1.2)]
    arm = [rect(38, 40, 24, 30, 1.6)] + [line(38, 44 + i * 5, 62, 44 + i * 5, .9, .7) for i in range(5)]
    shaft = [line(50, 34, 50, 86, 1.8), circle(50, 38, 2, 1.0)]
    comm = [rect(42, 78, 16, 10, 1.4)] + [line(42 + i * 4, 78, 42 + i * 4, 88, .8, .7) for i in range(1, 4)]
    brush = [rect(30, 80, 8, 6, 1.0), rect(62, 80, 8, 6, 1.0), line(22, 83, 30, 83, 1.0), line(70, 83, 78, 83, 1.0)]
    crank = [line(50, 88, 50, 96, 1.4), line(50, 96, 70, 96, 1.4), circle(74, 96, 3, 1.2)]
    return layer(-4, *crank) + layer(0, *mag, *shaft) + layer(4, *arm, *comm, *brush)


def voltaic_pile():
    discs = []
    for i in range(9):
        y = 20 + i * 8
        discs += [ellipse(50, y, 22, 4, 1.4 if i % 2 == 0 else 1.0, None if i % 2 == 0 else .7)]
    sides = [line(28, 20, 28, 84, 1.2), line(72, 20, 72, 84, 1.2)]
    wire = [path("M72 20 Q92 20 92 50", 1.4), path("M28 84 Q8 84 8 60", 1.4)]
    ends = [circle(92, 54, 4, 1.2), circle(8, 56, 4, 1.2)]
    base = [line(14, 90, 86, 90, 1.6)]
    return layer(-4, *base) + layer(0, *sides, *wire) + layer(4, *discs, *ends)


def bessemer_converter():
    vessel = [path("M30 90 L26 46 Q26 20 50 14 Q74 20 74 46 L70 90 Z", 1.8), path("M50 14 L62 4 L74 14", 1.4)]
    liquid = [path("M28 70 Q50 62 72 70", 1.0, .6), line(30, 80, 70, 80, 1.0, .5)]
    trunnion = [circle(26, 56, 5, 1.4), circle(74, 56, 5, 1.4), line(10, 56, 21, 56, 1.4), line(79, 56, 92, 56, 1.4)]
    blast = [line(50, 98, 50, 92, 1.6), rect(40, 90, 20, 4, 1.2)] + [line(40 + i * 5, 90, 38 + i * 6, 74, .9, .6) for i in range(5)]
    flame = [path("M46 10 q-4 -6 0 -10 M54 10 q4 -6 0 -10", 1.0, .7)]
    return layer(-4, *flame, *liquid) + layer(0, *vessel, *trunnion) + layer(4, *blast)


def lathe():
    bed = [rect(6, 74, 88, 6, 1.8), line(14, 80, 14, 94, 1.4), line(86, 80, 86, 94, 1.4)]
    head = [rect(6, 44, 16, 30, 1.6), line(22, 59, 32, 59, 1.6)]
    tail = [rect(80, 48, 14, 26, 1.6), line(80, 60, 70, 60, 1.6)]
    work = [rect(32, 52, 38, 14, 1.4)] + [line(36 + i * 6, 52, 36 + i * 6, 66, .9, .6) for i in range(6)]
    tool = [poly([(50, 44), (58, 44), (54, 52)], 1.2, closed=True), rect(46, 34, 16, 10, 1.2), line(54, 34, 54, 24, 1.4)]
    belt = [path("M14 44 Q14 24 34 24", 1.0, .6)]
    return layer(-4, *belt) + layer(0, *bed, *head, *tail) + layer(4, *work, *tool)


def fresnel_lens():
    rings = [circle(50, 50, 6 + i * 6.5, 1.6 if i % 2 == 0 else 1.0, None if i % 2 == 0 else .7) for i in range(7)]
    frame = [rect(6, 6, 88, 88, 1.8), line(6, 50, 94, 50, .9, .35), line(50, 6, 50, 94, .9, .35)]
    beams = [line(0, 50 + k * 3, 6, 50 + k * 3, 1.0, .5) for k in (-2, -1, 0, 1, 2)]
    return layer(-4, *beams) + layer(0, *frame) + layer(4, *rings)


def screw_propeller():
    hub = [circle(50, 50, 7, 1.8), circle(50, 50, 2, 1.0)]
    blades = []
    for k in range(3):
        a = k * 120 - 90
        x1, y1 = pol(50, 50, 7, a)
        x2, y2 = pol(50, 50, 42, a - 12)
        x3, y3 = pol(50, 50, 42, a + 12)
        blades += [poly([(x1, y1), (x2, y2), (x3, y3)], 1.6, closed=True), path(f"M{x1} {y1} L{(x2 + x3) / 2} {(y2 + y3) / 2}", .9, .6)]
    shaft = [line(4, 50, 43, 50, 1.4, .6), line(57, 50, 96, 50, 1.4, .6)]
    wake = [arc(50, 50, 46, -60, 60, 1.0, .5) if False else path("M92 30 q6 20 0 40", 1.0, .45)]
    return layer(-4, *wake) + layer(0, *shaft, *hub) + layer(4, *blades)


def hot_air_balloon():
    env = [path("M50 6 Q86 6 82 38 Q80 54 62 68 L38 68 Q20 54 18 38 Q14 6 50 6", 1.8)]
    gores = [path("M50 6 Q36 32 42 68", 1.0, .6), path("M50 6 Q64 32 58 68", 1.0, .6), path("M50 6 L50 68", 1.0, .5)]
    ropes = [line(38, 68, 42, 82, 1.0), line(62, 68, 58, 82, 1.0), line(44, 68, 46, 82, .9, .6), line(56, 68, 54, 82, .9, .6)]
    basket = [rect(40, 82, 20, 12, 1.6), line(40, 88, 60, 88, 1.0, .6)]
    flame = [path("M50 80 q-3 -6 0 -10 q3 4 0 10", 1.0, .8)]
    return layer(-4, *gores) + layer(0, *env, *basket) + layer(4, *ropes, *flame)


def parachute():
    canopy = [path("M8 40 Q50 -2 92 40", 1.8), path("M8 40 Q18 48 30 40 Q40 48 50 40 Q60 48 70 40 Q82 48 92 40", 1.4)]
    lines = [line(8, 40, 50, 82, 1.0), line(30, 42, 50, 82, 1.0), line(50, 42, 50, 82, 1.0), line(70, 42, 50, 82, 1.0), line(92, 40, 50, 82, 1.0)]
    rider = [circle(50, 86, 3.4, 1.4), line(50, 90, 50, 98, 1.4), line(44, 94, 56, 94, 1.2)]
    vent = [circle(50, 14, 3, 1.0, .7)]
    return layer(-4, *vent) + layer(0, *canopy, *lines) + layer(4, *rider)


def safety_pin():
    body = [line(14, 40, 86, 40, 1.8), line(14, 56, 86, 56, 1.8)]
    coil = [path("M14 40 q-14 0 -14 8 q0 8 14 8", 1.8), circle(8, 48, 3, 1.0)]
    guard = [path("M86 36 L96 36 L96 60 L86 60 L86 52", 1.6), line(86, 40, 86, 36, 1.4)]
    tip = [poly([(80, 56), (86, 56), (83, 60)], 1.0, closed=True)]
    shine = [line(24, 44, 76, 44, .9, .4)]
    return layer(-4, *shine) + layer(0, *body, *coil) + layer(4, *guard, *tip)


def zipper():
    tapes = [rect(14, 4, 18, 92, 1.6), rect(68, 4, 18, 92, 1.6)]
    teeth = []
    for i in range(14):
        y = 8 + i * 6
        x = 32 if i % 2 == 0 else 36
        teeth += [rect(x if i % 2 == 0 else 50 - 14 + 0, y, 14, 3, 1.0) if False else rect(33 if i % 2 == 0 else 51, y, 16, 3, 1.0)]
    slider = [path("M38 40 L62 40 L56 66 L44 66 Z", 1.6), rect(46, 66, 8, 12, 1.2), circle(50, 82, 4, 1.2)]
    return layer(-4, line(50, 4, 50, 40, 1.0, .5)) + layer(0, *tapes, *teeth) + layer(4, *slider)


ITEMS = [
    dict(id="exp28_barbed_wire", n="Barbed Wire", era="industry", cat="technology", ds=1867, rar="uncommon",
         date="Lucien Smith patent June 1867; William Hunt July 1867; Michael Kelly 1868; Joseph Glidden November 1874", vis="barbed-twist-fence", topic="farming_exp28",
         region="United States (Ohio, New York, Illinois)", artifactType="fencing wire", material="galvanized steel wire", physical=True, durable=True,
         l1="Twisted steel wire with sharp barbs that fences cattle cheaply.",
         l2="Barbed wire is steel wire with sharp points spaced along the strands; farm wire is usually double-strand, 12½-gauge galvanized steel.",
         l3="Lucien B. Smith of Kent, Ohio, held the first US barbed-wire patent (June 1867, no. 66,182); William Hunt followed in July 1867 and Michael Kelly in 1868. Joseph Glidden of DeKalb, Illinois, patented twisted fence wires with short spurs in November 1874, the most popular design; he twisted the wires on a grindstone and made barbs with a coffee mill. Fun fact: the Kansas Barbed Wire Museum in La Crosse is the only museum devoted solely to it. (not known: Smith's wire gauge or output.)",
         ev="US patents 66,182 (1867) and 157,124 (1874)", first_known="June 1867",
         confidence=dict(level="established", note="The page gives only the year 1868 for Kelly's patent."),
         srcs=[wp("barbedwire_wp", "Barbed_wire", "Smith patent June 1867 (US 66,182); Hunt July 1867; Kelly 1868; Glidden November 1874 (US 157,124); coffee-mill barbs; double-strand 12.5-gauge galvanized steel; Kansas Barbed Wire Museum.")],
         pool=['iron', 'steel', 'fence', 'machine_tools', 'rope', 'exp26_copper_coil_winding', 'exp26_threaded_iron_rod', 'cordage'], must=[], nrec=2,
         tags=["farming", "fence"], regions=["americas"], art=barbed_wire()),
    dict(id="exp28_sholes_typewriter", n="Sholes and Glidden Typewriter", era="industry", cat="technology", ds=1868, rar="rare",
         date="Henry Mill patent 1714; Turri 1801–1808; Sholes & Glidden patent 1868; Remington production 1 March 1873; QWERTY 1874", vis="typebar-platen", topic="writing_machines_exp28",
         region="United States (Milwaukee, Ilion NY); earlier England and Italy", artifactType="writing machine", material="iron, wood and ribbon", physical=True, durable=True,
         l1="A keyboard machine whose typebars strike an inked ribbon against paper on a roller.",
         l2="Each key is on a typebar with a reversed letter; striking presses an inked ribbon against paper on a cylindrical platen. Early under-strike machines hid the text until the carriage returned; the 1893 Daugherty Visible made front-strike standard.",
         l3="Henry Mill held a British patent in 1714 for a machine similar to a typewriter; Pellegrino Turri built one for a blind friend between 1801 and 1808. Sholes, Hall, Glidden and Soule patented theirs (US 79,265) in 1868, with a prototype by Matthias Schwalbach; Remington began production on 1 March 1873 and QWERTY was established in the 1874 model. Fun fact: Mark Twain bought a Remington in autumn 1874 and the shift key arrived on the No. 2 in 1878. (not known: how many Mill machines were made.)",
         ev="US patent 79,265 (1868); Remington production (1 March 1873)", first_known="1714 (Mill patent)",
         confidence=dict(level="established", note="The page says the 'avoid typebar clashes' story for QWERTY is popular but incorrect."),
         srcs=[wp("typewriter_wp", "Typewriter", "Mill patent 1714; Turri 1801-1808; Sholes and Glidden US 79,265 (1868); Remington production 1 March 1873; QWERTY 1874; typebars strike ribbon on platen; shift key Remington No. 2 1878; Twain bought Remington 1874.")],
         pool=['mechanism', 'lever', 'paper', 'writing', 'iron', 'wood', 'printing', 'machine_tools', 'gear', 'exp28_hollerith_tabulator'], must=['writing'], nrec=2,
         tags=["writing", "machine"], regions=["americas", "europe"], art=typewriter()),
    dict(id="exp28_lockstitch_sewing_machine", n="Lockstitch Sewing Machine", era="industry", cat="technology", ds=1832, rar="rare",
         date="Saint 1790; Thimonnier patent 17 July 1830; Hunt lockstitch 1832; Howe 1845, patent 10 September 1846; Singer patent 1851", vis="needle-shuttle-arm", topic="textile_machines_exp28",
         region="England, France, United States", artifactType="sewing machine", material="iron, steel needle, treadle", physical=True, durable=True,
         l1="A needle and shuttle that lock two threads into each stitch, driven by a foot treadle.",
         l2="Lockstitch machines use two threads, one from the needle and one from a bobbin or shuttle, interlocked by a bobbin driver. Howe's needle has the eye at its point; Hunt's and Singer's machines carried the lower thread on a falling shuttle.",
         l3="Thomas Saint designed a chain-stitch machine for leather in 1790; Barthélemy Thimonnier's practical machine was patented on 17 July 1830; Walter Hunt invented the first American lockstitch in 1832; Elias Howe built his in 1845 (US patent 10 September 1846); Isaac Singer patented his in 1851. Fun fact: a shirt took about one hour by machine against about 14.5 hours by hand, and Singer and Edward Clark created the first hire-purchase plan. (not known: how many machines Thimonnier built before his factory was burned.)",
         ev="Thimonnier patent (17 July 1830); Howe patent (10 Sept 1846)", first_known="1790 (Saint)",
         confidence=dict(level="established", note="ds is Hunt's lockstitch (1832); the page gives 1832, not 1834."),
         srcs=[wp("sewing_wp", "Sewing_machine", "Saint 1790; Thimonnier patent 17 July 1830; Hunt lockstitch 1832; Howe 1845, patent 10 Sept 1846; Singer 1851; eye-pointed needle, falling shuttle; shirt 1 hour vs 14.5 hours; hire-purchase.")],
         pool=['thread_and_needle', 'needle', 'exp28_spinning_wheel', 'exp28_fan_gate', 'mechanism', 'cloth', 'iron', 'gear', 'weaving_shuttle', 'exp28_leaf_spring'], must=['needle'], nrec=2,
         tags=["textile", "sewing"], regions=["europe", "americas"], art=sewing_machine()),
    dict(id="exp28_dandy_horse", n="Draisine (Dandy Horse)", era="industry", cat="technology", ds=1817, rar="uncommon",
         date="Karl Drais, Laufmaschine 1817; French patent February 1818; Niépce 1818; Johnson London 1818–1819", vis="two-wheel-beam-steer", topic="transport_exp28",
         region="Germany (Karl Drais); France, England", artifactType="wheeled vehicle", material="wood and iron", physical=True, durable=True,
         l1="A two-wheeled wooden bike with no pedals, pushed along by the rider's feet.",
         l2="Two wheels in line, the rider pushing along the ground; the front wheel and handlebar are hinged for steering. It reached about 10 mph (16 km/h) on level ground.",
         l3="Karl Drais called it the Laufmaschine ('running machine') in 1817 and patented it in France as a vélocipède in February 1818; Niépce's 1818 model had an adjustable saddle. Pedals and cranks reached the front hub in 1860s France, giving the pedal bicycle. Fun fact: Drais was partly motivated by horse die-offs after the 1815 Tambora eruption and the 1816 'Year Without a Summer'. (not known: the date and place of the first ride.)",
         ev="Drais's French patent (February 1818)", first_known="1817",
         confidence=dict(level="established", note="The page gives no exact first-ride date or place; Mannheim appears only for 1820."),
         srcs=[wp("dandy_wp", "Dandy_horse", "Karl Drais Laufmaschine 1817; French patent February 1818; Niepce 1818; Johnson 1818-1819; about 10 mph; steering front wheel; Tambora 1815 and 1816 motivation; pedals 1860s.")],
         pool=['wheel', 'axle', 'wood', 'iron', 'lever', 'exp28_horse_collar', 'exp28_elliptic_leaf_spring', 'cordage', 'mechanism'], must=['wheel'], nrec=2,
         tags=["transport", "bicycle"], regions=["europe"], art=dandy_horse()),
    dict(id="exp28_pneumatic_tyre", n="Pneumatic Tyre", era="industry", cat="technology", ds=1845, rar="uncommon",
         date="Robert William Thomson patents 1845 (London), 1846 (France), 8 May 1847 (US); Dunlop 31 October 1888; Michelin 1895", vis="tube-tread-rim", topic="transport_exp28",
         region="Scotland, Ireland (Belfast), France", artifactType="wheel tyre", material="rubber and cord", physical=True, durable=False,
         l1="An air-filled rubber ring around a wheel that cushions the ride.",
         l2="Tyre development depended on vulcanising natural rubber with sulfur (the page gives no date or inventor). Radial tyres were developed by Michelin in 1946, with cords at roughly right angles to the centreline and stabiliser belts under the tread.",
         l3="Thomson filed patents in London in 1845, France in 1846 and the USA in 1847 (8 May), but it never went into production. Dunlop made the first practical pneumatic tyre in 1888 on May Street, Belfast (specification dated 31 October 1888); his patent was declared invalid in 1892 because of Thomson. Michelin made the first pneumatic car tyres in 1895 for L'Éclair. Fun fact: 'tire' is short for 'attire', a dressed wheel; Willie Hume won the tyre's first races in 1889. (not known: Thomson's tyre production.)",
         ev="Thomson patent (8 May 1847); Dunlop specification (31 Oct 1888)", first_known="1845",
         confidence=dict(level="established", note="The page does not mention a Michelin detachable tyre of 1891 nor Goodyear."),
         srcs=[wp("tyre_wp", "Pneumatic_tire", "Thomson patents 1845 London, 1846 France, US 8 May 1847; Dunlop specification 31 October 1888, patent invalid 1892; Michelin 1895 L'Eclair; radial 1946; Hume races 1889; tire from attire.")],
         pool=['wheel', 'axle', 'cordage', 'cloth', 'chemistry', 'exp28_dandy_horse', 'fiber', 'rope', 'mechanism'], must=['wheel'], nrec=2,
         tags=["transport", "rubber"], regions=["europe"], art=pneumatic_tyre()),
    dict(id="exp28_newcomen_engine", n="Newcomen Atmospheric Engine", era="industry", cat="engineering", ds=1712, rar="rare",
         date="Newcomen's engine at Conygree Coalworks, Tipton, 1712; Watt's separate condenser 1769", vis="beam-cylinder-pump", topic="steam_exp28",
         region="Staffordshire, England (Tipton, Dudley)", artifactType="steam pumping engine", material="brass cylinder, iron beam, timber", physical=True, durable=True,
         l1="A beam engine that condenses steam under a piston so air pressure pushes it down and pumps a mine.",
         l2="A haystack boiler gave steam at about 1–2 psi; steam filled the cylinder, a jet of cold water condensed it, and atmospheric pressure pushed the piston down, pulling the beam's inner end to lift the pump rods. It cycled about 12 times a minute.",
         l3="The Tipton engine of 1712 has the earliest reliable records and was the first practical device to turn steam into mechanical work; over a hundred were installed by Newcomen's death. Watt's separate condenser (1769) roughly doubled fuel efficiency; his patents expired in 1800. Fun fact: the 'snifter valve' was named for its noise, 'like a man snifting with a cold'. (not known: the exact mechanism of Humphrey Potter's 1713 'potter cord' legend, which the page treats as legend.)",
         ev="Tipton engine (1712)", first_known="1712",
         confidence=dict(level="established", note="The page associates the Dudley Castle name with the first engine; Conygree Coalworks in Tipton is the site with reliable records."),
         srcs=[wp("newcomen_wp", "Newcomen_atmospheric_engine", "1712 Conygree Coalworks Tipton, Dudley Castle linked; haystack boiler 1-2 psi; cold water jet condenses; 12 cycles per minute; over a hundred by Newcomen's death; Watt 1769; snifter valve; Humphrey Potter legend.")],
         pool=['steam', 'iron', 'lever', 'engineering', 'machine_tools', 'coal', 'exp28_chain_pump', 'exp28_coke_blast_furnace', 'water_power', 'copper'], must=['steam'], nrec=2,
         tags=["steam", "mining"], regions=["europe"], art=newcomen_engine()),
    dict(id="exp28_parsons_steam_turbine", n="Parsons Steam Turbine", era="industry", cat="energy", ds=1884, rar="rare",
         date="Hero's aeolipile (1st century); Taqi al-Din 1551; Branca 1629; Verbiest 1672; Parsons 1884 (7.5 kW dynamo)", vis="staged-rotor-casing", topic="steam_exp28",
         region="England (Charles Parsons); Alexandria, Ottoman Egypt, Italy, Flanders earlier", artifactType="steam turbine", material="steel blades and casing", physical=True, durable=True,
         l1="Steam jets spin rings of blades on a shaft that drives a generator.",
         l2="Steam from a boiler passes through nozzles; in impulse turbines it hits curved blades, in reaction turbines the moving blades also act as nozzles; multiple stages divide the expansion and a condenser draws more energy from the exhaust.",
         l3="Charles Parsons invented the modern steam turbine in 1884; his first model drove a dynamo of 7.5 kW. Earlier steps: Hero's aeolipile (1st century), Taqi al-Din's spit turbine (1551), Branca (1629) and Verbiest's toy car (1672). Fun fact: the largest steam turbine ever built is the 1,770 MW Arabelle, and steam turbines made about 42% of US electricity in 2022. (not known: de Laval's date or Turbinia's date, which this page omits.)",
         ev="Parsons' first model (1884)", first_known="1st century (aeolipile)",
         confidence=dict(level="established", note="The page gives only a century for Hero's aeolipile and no date for de Laval or Turbinia."),
         srcs=[wp("turbine_wp", "Steam_turbine", "Hero aeolipile 1st century; Taqi al-Din 1551; Branca 1629; Verbiest 1672; Parsons 1884, 7.5 kW dynamo; impulse and reaction; Arabelle 1,770 MW; 42% US electricity 2022.")],
         pool=['steam', 'steel', 'iron', 'machine_tools', 'exp28_newcomen_engine', 'engineering', 'physics', 'exp28_centrifugal_governor', 'steam_engine'], must=['steel'], nrec=2,
         tags=["steam", "power"], regions=["europe"], art=steam_turbine()),
    dict(id="exp28_edison_phonograph", n="Edison Tinfoil Phonograph", era="electric", cat="media", ds=1877, rar="rare",
         date="Scott's phonautograph patent 25 March 1857; Edison announced 21 November 1877, patent 19 February 1878; Bell and Tainter 1886", vis="grooved-cylinder-horn", topic="recorded_sound_exp28",
         region="United States (Menlo Park); France (Scott)", artifactType="sound recorder", material="brass cylinder, tinfoil, horn", physical=True, durable=False,
         l1="A hand-cranked cylinder wrapped in tinfoil that records and plays back sound.",
         l2="Sound was recorded on tinfoil wrapped round a grooved cylinder; the foil tore easily and wore out after a few playbacks. Scott's 1857 phonautograph traced waves on lampblack-coated glass and was built to be read, not played.",
         l3="Edison conceived it between May and July 1877, announced it on 21 November and demonstrated it on 29 November 1877; US patent 200,521 followed on 19 February 1878. Bell and Tainter's wax-cylinder patents date from 1886. Fun fact: Scott's 1860 recording of 'Au Clair de la Lune' was first played back in 2008, and Edison's 'Mary Had a Little Lamb' is not preserved. (not known: Berliner's 1887 date, which the page does not give; it dates his commercial discs to 1892.)",
         ev="US patent 200,521 (19 Feb 1878)", first_known="1857 (phonautograph)",
         confidence=dict(level="established", note="The page gives 1892 for Berliner's commercial discs, not 1887."),
         srcs=[wp("phonograph_wp", "Phonograph", "Scott phonautograph patent 25 March 1857; Edison announced 21 Nov 1877, demonstrated 29 Nov, patent 19 Feb 1878 (US 200,521); tinfoil cylinder; Bell and Tainter 1886; Au Clair de la Lune 1860 played 2008.")],
         pool=['electricity', 'music', 'mechanism', 'lever', 'paper', 'exp28_zoetrope', 'exp28_galvanometer', 'writing', 'exp28_hollerith_tabulator', 'exp28_magic_lantern'], must=[], nrec=2,
         tags=["sound", "recording"], regions=["americas", "europe"], art=phonograph()),
    dict(id="exp28_carbon_filament_bulb", n="Carbon-Filament Light Bulb", era="electric", cat="technology", ds=1879, rar="rare",
         date="de la Rue 1840; Swan demonstration December 1878–January 1879, patent 1880; Edison first test 22 October 1879; tungsten 1910; Langmuir gas fill patent 1916", vis="glass-envelope-filament", topic="lighting_exp28",
         region="England (de la Rue, Swan); United States (Menlo Park)", artifactType="electric lamp", material="glass, carbon filament, vacuum", physical=True, durable=False,
         l1="A glass bulb with a glowing carbon thread in a vacuum.",
         l2="Early bulbs were evacuated to protect the filament from oxygen; a vacuum insulates well but lets the filament evaporate faster. Langmuir found that filling bulbs with inert gas, first nitrogen then argon, doubled luminous efficacy (patent 1916).",
         l3="Warren de la Rue enclosed a coiled platinum filament in a vacuum tube in 1840; Joseph Swan demonstrated a carbon-rod lamp in December 1878–January 1879 and was patented in 1880. Edison's first successful carbon-filament test was on 22 October 1879 and lasted 13.5 hours; Coolidge's ductile tungsten (1910) made tungsten filaments practical. Fun fact: the Centennial Light in Livermore, California, has burned almost continuously since 1901. (not known: why Edison's test ended at 13.5 hours.)",
         ev="Edison test (22 Oct 1879); Swan patent (1880)", first_known="1840 (de la Rue)",
         confidence=dict(level="established", note="The page also dates Coolidge's tungsten method to 1906; ds uses Edison's 1879 test."),
         srcs=[wp("bulb_wp", "Incandescent_light_bulb", "de la Rue 1840 platinum; Swan 1878-1879, patent 1880; Edison test 22 October 1879, 13.5 hours; tungsten Coolidge 1910; Langmuir gas fill 1916; Centennial Light 1901.")],
         pool=['glass', 'electricity', 'vacuum_tube', 'exp28_galvanometer', 'exp26_drawn_glass_tube', 'physics', 'chemistry', 'exp28_murdoch_coal_gas_lamp', 'copper'], must=['electricity'], nrec=2,
         tags=["lighting", "electric"], regions=["europe", "americas"], art=incandescent_bulb()),
    dict(id="exp28_pixii_dynamo", n="Pixii Dynamo", era="electric", cat="technology", ds=1832, rar="rare",
         date="Faraday disc 1831–1832; Pixii commutated dynamo 1832; Jedlik c. 1856; Siemens and Wheatstone 17 January 1867; Gramme 1871", vis="magnet-armature-commutator", topic="electrical_exp28",
         region="France (Pixii); England (Faraday, Wheatstone); Germany (Siemens); Belgium and France (Gramme)", artifactType="electric generator", material="iron, copper wire, permanent magnet", physical=True, durable=True,
         l1="A hand-cranked magnet and coil with a commutator that makes direct current.",
         l2="Pixii's 1832 machine used a permanent magnet and a split-cylinder commutator; Faraday's disc produced only a small DC voltage. Gramme reinvented Pacinotti's ring armature in 1871 for the first commercial power plants in Paris.",
         l3="The page gives 1831–1832 for Faraday's discovery and Faraday coined 'dynamo' in 1831 from the Greek 'dynamis' (power). Jedlik formulated self-excitation c. 1856; Siemens and Wheatstone announced theirs at the Royal Society on 17 January 1867. Fun fact: rotary converters supplied 600 V DC to New York's West Side IRT subway into the late 1960s. (not known: Pixii's exact month.)",
         ev="Pixii's dynamo (1832)", first_known="1831",
         confidence=dict(level="established", note="The page dates Jedlik's self-excitation concept to c. 1856, not 1861."),
         srcs=[wp("dynamo_wp", "Dynamo", "Faraday disc 1831-1832; Pixii commutated dynamo 1832; Jedlik c. 1856; Siemens and Wheatstone 17 January 1867; Gramme ring armature 1871; dynamo coined 1831; rotary converters NYC subway.")],
         pool=['electricity', 'exp26_copper_wire_coil', 'exp26_copper_coil_winding', 'iron', 'exp28_galvanometer', 'electric_motor', 'physics', 'experiment', 'exp26_electromagnet_core'], must=['electricity'], nrec=3,
         tags=["electric", "generator"], regions=["europe"], art=dynamo()),
    dict(id="exp28_voltaic_pile", n="Voltaic Pile", era="electric", cat="energy", ds=1800, rar="rare",
         date="Volta's letter to the Royal Society, 20 March 1800", vis="disc-stack-wires", topic="electrical_exp28",
         region="Italy (Volta, Pavia); England (Nicholson and Carlisle)", artifactType="battery", material="zinc, copper and brine-soaked cardboard", physical=True, durable=False,
         l1="A stack of zinc and copper discs with brine-soaked cardboard that gives a steady current.",
         l2="Volta stacked alternating copper (or silver) and zinc discs separated by cloth or cardboard soaked in brine; it was the first battery to give a continuous charge. Each zinc/brine/copper cell gives 0.76 V.",
         l3="Volta wrote to the Royal Society on 20 March 1800; in 1794 he had shown that two metals with brine-soaked cloth in a circuit give a current, building on Galvani's frog-leg work of the 1780s. Nicholson and Carlisle used the pile in 1800 to split water into oxygen and hydrogen. Fun fact: Davy's 2,000-pair pile at the Royal Institution in 1808 isolated five new elements. (not known: the piles shown at Pavia are not originals; the originals were lost in a fire.)",
         ev="Volta's letter (20 March 1800)", first_known="1794 (two-metal circuit)",
         confidence=dict(level="established", note="Page gives the 0.76 V per cell figure."),
         srcs=[wp("pile_wp", "Voltaic_pile", "Volta wrote 20 March 1800; copper and zinc discs, brine-soaked cardboard; 1794 two-metal circuit; Galvani 1780s; Nicholson and Carlisle electrolysis 1800; 0.76 V per cell; Davy 1808 2000-pair pile.")],
         pool=['electricity', 'copper', 'chemistry', 'experiment', 'cloth', 'paper', 'physics', 'observation', 'exp26_copper_tube_blank'], must=['copper'], nrec=2,
         tags=["electric", "battery"], regions=["europe"], art=voltaic_pile()),
    dict(id="exp28_bessemer_converter", n="Bessemer Converter", era="industry", cat="technology", ds=1856, rar="rare",
         date="Bessemer first filing October 1855; patent 1856; Kelly claimed 1851, patent 1857; Sheffield commercial production 1858", vis="tilting-vessel-air-blast", topic="metals_exp28",
         region="England (Bessemer, Sheffield); United States (Kelly)", artifactType="steelmaking vessel", material="iron shell, refractory lining", physical=True, durable=True,
         l1="A tilting egg-shaped vessel where air blown through molten iron burns out impurities to make steel.",
         l2="Air blown through the molten pig iron oxidises silicon, manganese and carbon, which also keeps the iron molten; carbon is added back at the end. A heat held 5 to 30 tons and the blow took 10 to 20 minutes, against at least a day with earlier methods.",
         l3="Bessemer patented the process in 1856 (first filing October 1855); William Kelly claimed independent discovery in 1851 and won a priority patent in 1857. Robert Mushet's addition of spiegeleisen fixed the quality problem; the first commercial steel came in Sheffield in 1858. Fun fact: steel rails lasted ten times longer than iron rails and steel fell from £40 to £6–7 a long ton. (not known: whether Kelly really learned the method from Chinese ironworkers, which the page says only 'may have' inspired him.)",
         ev="Bessemer patent (1856)", first_known="1856",
         confidence=dict(level="debated", note="Kelly's 1851 priority claim is disputed."),
         srcs=[wp("bessemer_wp", "Bessemer_process", "Patent 1856, first filing October 1855; Kelly claimed 1851, patent 1857; Mushet spiegeleisen; Sheffield 1858; blow 10-20 minutes; heats 5-30 tons; rails ten times longer; US stopped 1968.")],
         pool=['iron', 'exp28_coke_blast_furnace', 'exp28_cupola', 'steel', 'chemistry', 'engineering', 'smelting', 'coal', 'machine_tools'], must=['exp28_coke_blast_furnace'], nrec=2,
         tags=["steel", "metallurgy"], regions=["europe", "americas"], art=bessemer_converter()),
    dict(id="exp28_lathe", n="Rotary Lathe", era="metallurgy", cat="technology", ds=-400, rar="rare",
         date="Mycenaean tenuous evidence 13th–14th century BC; Etruscan and Turkish turned artifacts 6th century BC; China c. 400 BC; Petosiris tomb 4th century BC", vis="headstock-tailstock-work", topic="machine_tools_exp28",
         region="Egypt, Greece, Italy, China", artifactType="machine tool", material="wood, later iron", physical=True, durable=True,
         l1="A machine that spins a workpiece against a cutting tool to turn round shapes.",
         l2="The slide rest constrains the tool to cut accurate cylinders and cones; a clear one appears in the 1772 Encyclopédie. Nartov's lathe dates to 1718 and his copying lathe to 1721.",
         l3="The earliest depiction is in the tomb of Petosiris (4th century BC); clear turned artifacts date to the 6th century BC in Etruria and Turkey, with tenuous Mycenaean evidence from the 13th–14th century BC. In China c. 400 BC rotary lathes sharpened tools and weapons at industrial scale. Fun fact: the page calls the precision lathe 'a child of many parents' with no single inventor. (not known: the bow-lathe's date, and the two-person Egyptian lathe c. 1300 BC and Henry Maudslay's 1800 screw-cutting lathe, which this page does not mention.)",
         ev="Petosiris tomb (4th century BC)", first_known="13th–14th century BC (tenuous)",
         confidence=dict(level="uncertain", note="ds is China c. 400 BC; the page does not mention an Egyptian two-person lathe or Maudslay's date."),
         srcs=[wp("lathe_wp", "Lathe", "Petosiris tomb 4th century BC; Mycenaean tenuous 13th-14th century BC; Etruscan and Turkey 6th century BC; China c. 400 BC; Nartov 1718, copying lathe 1721; slide rest 1772; a child of many parents.")],
         pool=['bow_drill', 'wood', 'wheel', 'axle', 'cordage', 'rope', 'lever', 'iron', 'machine_tools', 'pulley'], must=['wheel'], nrec=2,
         tags=["machine", "turning"], regions=["africa_asia", "europe"], art=lathe()),
    dict(id="exp28_fresnel_lens", n="Fresnel Lighthouse Lens", era="science", cat="technology", ds=1822, rar="rare",
         date="Buffon 1748; Condorcet 1790; Fresnel memoir 29 July 1822; test 20 August 1822; Cordouan lit 25 July 1823", vis="concentric-ring-lens", topic="optics_exp28",
         region="France (Fresnel; Cordouan Lighthouse)", artifactType="lighthouse lens", material="cut glass prisms in a brass frame", physical=True, durable=True,
         l1="A flat lens built from concentric glass rings that throws a lighthouse beam far to sea.",
         l2="Fresnel designed six sizes in four orders; a first-order lens has a 920 mm focal length and stands about 2.59 m high, 1.8 m wide, and a sixth-order one is 150 mm focal length and 433 mm high.",
         l3="Buffon (1748) first replaced a convex lens with concentric annular prisms ground in one piece; Condorcet (1790) proposed making the sections separately on a frame. Fresnel read his memoir on 29 July 1822, tested a rotating apparatus on the unfinished Arc de Triomphe on 20 August 1822, and the first Fresnel lens was lit at Cordouan on 25 July 1823, visible over 32 km. Fun fact: it has been called 'the invention that saved a million ships'. (not known: Condorcet's date exactly, as secondary sources give 1773 or 1788.)",
         ev="Cordouan lens lit (25 July 1823)", first_known="1748 (Buffon)",
         confidence=dict(level="established", note="Condorcet's date varies in secondary sources (1773, 1788, 1790)."),
         srcs=[wp("fresnel_wp", "Fresnel_lens", "Buffon 1748; Condorcet 1790; Fresnel memoir 29 July 1822; test 20 August 1822; Cordouan lit 25 July 1823, visible 32 km; six sizes four orders; first order 920 mm focal length; saved a million ships.")],
         pool=['lens', 'glass', 'optics', 'geometry', 'mathematics', 'exp28_theodolite', 'physics', 'exp26_convex_lens_pair', 'measurement'], must=['lens'], nrec=2,
         tags=["optics", "lighthouse"], regions=["europe"], art=fresnel_lens()),
    dict(id="exp28_screw_propeller", n="Screw Propeller", era="industry", cat="technology", ds=1775, rar="rare",
         date="Sennacherib's water screws 704–681 BC; Bushnell Turtle 1775; Stevens 1802; Ressel 1827; Smith 1837; SS Archimedes 1838; SS Great Britain 1843", vis="three-blade-hub", topic="ships_exp28",
         region="United States, Austria, England, Scotland-born Ericsson", artifactType="ship propulsion", material="brass or iron blades", physical=True, durable=True,
         l1="A twisted-blade screw that spins in the water to push a ship forward.",
         l2="Bushnell's 1775 submarine Turtle had a brass propeller built by Isaac Doolittle; in 1827 Josef Ressel's multi-bladed screw drove the Civetta to 6 knots in 1829.",
         l3="A cuneiform inscription of Sennacherib (704–681 BC) describes bronze-cast water screws. Francis Pettit Smith's wooden propeller broke in February 1837 and the shortened one doubled the boat's speed; SS Archimedes (1838) was the first screw-driven steamship. SS Great Britain (launched 1843) was the first screw steamer to cross the Atlantic in August 1845. Fun fact: in 1845 the screw-driven HMS Rattler pulled the paddle steamer Alecto backward at 2.5 knots. (not known: Watt's 1771 'spiral oars' were never built.)",
         ev="Bushnell's Turtle propeller (1775); SS Archimedes (1838)", first_known="704–681 BC (water screws)",
         confidence=dict(level="debated", note="ds uses the 1775 Turtle propeller; the page gives only approximate dates for Archimedes."),
         srcs=[wp("propeller_wp", "Propeller", "Sennacherib 704-681 BC; Bushnell Turtle 1775; Stevens 1802; Ressel 1827, Civetta 1829; Smith February 1837; SS Archimedes 1838; Great Britain 1843, Atlantic August 1845; Rattler 1845.")],
         pool=['exp28_archimedes_screw', 'boat', 'steam_engine', 'iron', 'bronze', 'machine_tools', 'axle', 'engineering', 'mechanism', 'exp28_newcomen_engine'], must=['exp28_archimedes_screw'], nrec=2,
         tags=["ships", "propulsion"], regions=["americas", "europe"], art=screw_propeller()),
    dict(id="exp28_montgolfier_balloon", n="Montgolfier Hot-Air Balloon", era="science", cat="technology", ds=1783, rar="rare",
         date="First public demonstration 4 June 1783; tethered ascent c. 15 October 1783; first free manned flight 21 November 1783", vis="envelope-basket-flame", topic="flight_exp28",
         region="France (Annonay, Paris)", artifactType="lighter-than-air craft", material="paper-lined cloth and wicker", physical=True, durable=False,
         l1="A huge paper-and-cloth bag filled with hot air that lifted the first human flyers.",
         l2="Pilâtre de Rozier made a tethered ascent to 26 m (85 ft) on or about 15 October 1783; on 21 November he and François Laurent d'Arlandes made the first untethered manned flight in Paris.",
         l3="The Montgolfier brothers' balloon gave its first public demonstration on 4 June 1783, an unmanned 10-minute flight (the page also mentions 19 September 1783 at Annonay, a conflict it does not resolve). Fun fact: Louis XVI had decreed condemned criminals should fly first until the two nobles petitioned to go. The kongming lantern of Zhuge Liang (220–280 CE) is an earlier signalling balloon. (not known: an exact date for the kongming lantern.)",
         ev="First free flight (21 Nov 1783)", first_known="220–280 CE (kongming lantern)",
         confidence=dict(level="debated", note="The page gives two conflicting dates for the first public demonstration."),
         srcs=[wp("balloon_wp", "Hot_air_balloon", "Montgolfier first public demonstration 4 June 1783 (page also says 19 September 1783); tethered ascent c. 15 October 1783 to 26 m; free manned flight 21 November 1783; kongming lantern 220-280 CE; Louis XVI decree.")],
         pool=['cloth', 'paper', 'fire', 'rope', 'cordage', 'fiber', 'exp28_diving_bell', 'chemistry', 'wood', 'weaving_shuttle'], must=['fire'], nrec=2,
         tags=["flight", "balloon"], regions=["europe"], art=hot_air_balloon()),
    dict(id="exp28_silk_parachute", n="Garnerin Parachute", era="science", cat="technology", ds=1797, rar="rare",
         date="Leonardo c. 1485; Vrančić 1615/1616; Lenormand 1783; Garnerin 1797; Berry 1 March 1912", vis="canopy-suspension-lines", topic="flight_exp28",
         region="France (Lenormand, Garnerin); Croatia/Venice (Vrančić); St. Louis (Berry)", artifactType="descent canopy", material="silk and cord", physical=True, durable=False,
         l1="A big silk canopy on cords that slows a person falling from a balloon.",
         l2="André Garnerin made the first descent with a frameless, silk-covered parachute in 1797; Louis-Sébastien Lenormand had made the first recorded public jump in France in 1783.",
         l3="Leonardo da Vinci sketched a pyramid-shaped parachute c. 1485 in the Codex Atlanticus; Faust Vrančić published his design in Machinae Novae (1615/1616; the page doubts his claimed 1617 jump). Albert Berry made the first jump from a fixed-wing aircraft on 1 March 1912 over St. Louis. Fun fact: Jeanne Geneviève Garnerin became the first woman to parachute in 1799. (not known: whether Armen Firman's 852 cloak jump from Córdoba slowed his fall.)",
         ev="Garnerin's descent (1797)", first_known="c. 1485 (sketch)",
         confidence=dict(level="established", note="The page gives no 1595 date for Vrančić."),
         srcs=[wp("parachute_wp", "Parachute", "Leonardo c. 1485; Vrancic 1615/1616; Lenormand 1783; Garnerin 1797 frameless silk; Berry 1 March 1912; Jeanne Genevieve Garnerin 1799; Reichelt 4 February 1912.")],
         pool=['cloth', 'cordage', 'rope', 'fiber', 'exp28_montgolfier_balloon', 'weaving_shuttle', 'geometry', 'physics', 'exp28_spinning_wheel'], must=['cordage'], nrec=2,
         tags=["flight", "textile"], regions=["europe", "americas"], art=parachute()),
    dict(id="exp28_hunt_safety_pin", n="Hunt's Safety Pin", era="industry", cat="technology", ds=1849, rar="uncommon",
         date="Mycenaean fibula 14th–13th century BC; Walter Hunt patent 10 April 1849 (US 6,281)", vis="coil-spring-guard", topic="clothing_exp28",
         region="United States (Hunt); Mycenaean Greece (fibula)", artifactType="fastener", material="brass wire", physical=True, durable=True,
         l1="A bent wire pin with a coil spring and a guard that covers the point.",
         l2="Hunt coiled the centre of a roughly 8-inch brass wire so it would spring open when released, with a clasp covering the point.",
         l3="US patent 6,281 was issued to Walter Hunt on 10 April 1849. The Mycenaean fibula, a brooch invented between the 14th and 13th centuries BC, secured Greek tunics in the same way. Fun fact: Hunt invented it to pay a $15 debt and sold the patent to W. R. Grace and Company for $400. (not known: how many safety pins Hunt himself made.)",
         ev="US patent 6,281 (10 April 1849)", first_known="14th–13th century BC (fibula)",
         confidence=dict(level="established", note="The fibula is the ancient fastener, not the modern coil-sprung pin."),
         srcs=[wp("pin_wp", "Safety_pin", "Hunt patent 6,281 issued 10 April 1849; clasp covering point; coil in centre of 8-inch brass wire; fibula 14th-13th century BC; $15 debt, $400 sale to W.R. Grace.")],
         pool=['needle', 'thread_and_needle', 'cloth', 'iron', 'exp28_elliptic_leaf_spring', 'machine_tools', 'copper', 'bronze'], must=['needle'], nrec=2,
         tags=["clothing", "fastener"], regions=["americas", "europe"], art=safety_pin()),
    dict(id="exp28_sundback_zipper", n="Sundback Zipper", era="industry", cat="technology", ds=1913, rar="uncommon",
         date="Howe patent 25 November 1851; Judson 29 August 1893; Sundback patent 29 April 1913 (US 1,060,378); Goodrich 'zipper' 1923", vis="interlocking-teeth-slider", topic="clothing_exp28",
         region="United States (Howe, Judson, Sundback)", artifactType="fastener", material="metal teeth on cloth tape", physical=True, durable=True,
         l1="Two rows of interlocking teeth drawn together by a slider.",
         l2="Sundback's redesign raised the fastening elements from about four per inch to ten or eleven; the name came from galoshes fastened 'with a single zip of the hand'.",
         l3="Elias Howe received US patent 8,540 on 25 November 1851 for an 'automatic continuous clothing closure' more like a drawstring; Whitcomb Judson's clasp locker (patents of 29 August 1893) was shown at the Chicago World's Fair; Gideon Sundback's 'separable fastener' (US 1,060,378) was issued on 29 April 1913, and B.F. Goodrich called it the zipper in 1923. Fun fact: NASA developed airtight zippers for pressure suits and space suits. (not known: the exact date of its first sale in 1913.)",
         ev="US patent 1,060,378 (29 April 1913)", first_known="1851 (Howe)",
         confidence=dict(level="established", note="The page does not mention a 'Hookless Fastener No. 2' name."),
         srcs=[wp("zipper_wp", "Zipper", "Howe US 8,540 25 November 1851; Judson 504,037 and 504,038 29 August 1893; Sundback US 1,060,378 29 April 1913; Goodrich zipper 1923; 10-11 elements per inch; NASA airtight zippers.")],
         pool=['cloth', 'needle', 'exp28_hunt_safety_pin', 'exp28_lockstitch_sewing_machine', 'machine_tools', 'iron', 'mechanism', 'thread_and_needle', 'exp28_elliptic_leaf_spring'], must=['cloth'], nrec=2,
         tags=["clothing", "fastener"], regions=["americas"], art=zipper()),
]
