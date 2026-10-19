"""EXP28 batch 08 — instruments, heating, gas, calculation, bells, aqueduct.
Facts only from pages fetched 2026-10-16."""
import math

from common import wp
from svg import arc, circle, ellipse, gear, layer, line, path, pol, poly, radial, rect, spokes, ticks


def nocturnal():
    outer = [circle(50, 56, 34, 1.8), circle(50, 56, 28, 1.0, .5)] + [line(*pol(50, 56, 28, k * 30), *pol(50, 56, 34, k * 30), 1.2) for k in range(12)]
    inner = [circle(50, 56, 20, 1.4)] + [line(*pol(50, 56, 14, k * 45), *pol(50, 56, 20, k * 45), 1.0, .8) for k in range(8)]
    hole = [circle(50, 56, 3, 1.2), circle(50, 56, 1, .8, fill=True)]
    arm = [rect(47, 56, 6, 40, 1.4), line(50, 56, 50, 96, .9, .5)]
    pointer = [line(50, 56, *pol(50, 56, 40, -50), 1.6), poly([pol(50, 56, 40, -50), pol(50, 56, 34, -46), pol(50, 56, 34, -54)], 1.0, closed=True)]
    star = [line(8, 10, 8, 18, 1.0, .7), line(4, 14, 12, 14, 1.0, .7), line(5, 11, 11, 17, .8, .6), line(5, 17, 11, 11, .8, .6)]
    return layer(-4, *star) + layer(0, *outer, *arm) + layer(4, *inner, *pointer, *hole)


def torricelli_barometer():
    tube = [rect(44, 4, 10, 70, 1.8), line(46, 4, 46, 72, .9, .5)]
    column = [line(46, 30, 52, 30, 1.0), rect(45, 30, 8, 44, 1.0, .5)]
    cist = [path("M26 74 Q26 94 50 94 Q74 94 74 74 Z", 1.8), line(28, 78, 72, 78, 1.0, .7)]
    mark = [line(60, 30 + i * 8, 66, 30 + i * 8, 1.0, .8) for i in range(6)] + [line(60, 30, 60, 70, .9, .6)]
    vac = [path("M47 6 L51 6 L51 28 L47 28 Z", .9, .4)]
    return layer(-4, *vac) + layer(0, *tube, *cist) + layer(4, *column, *mark)


def rheostat():
    cyl = [rect(10, 40, 80, 24, 1.8)] + [line(14 + i * 4, 40, 14 + i * 4, 64, .9, .8) for i in range(19)]
    rail = [line(8, 28, 92, 28, 1.6), line(8, 28, 8, 40, 1.4), line(92, 28, 92, 40, 1.4)]
    slide = [rect(44, 24, 14, 8, 1.4), path("M51 32 L51 40", 1.4), poly([(48, 40), (54, 40), (51, 46)], 1.0, closed=True)]
    term = [circle(6, 52, 3, 1.2), circle(94, 52, 3, 1.2), line(9, 52, 10, 52, 1.0)]
    feet = [line(16, 64, 16, 76, 1.4), line(84, 64, 84, 76, 1.4), line(10, 76, 90, 76, 1.2)]
    return layer(-4, *feet) + layer(0, *cyl, *rail) + layer(4, *slide, *term)


def hypocaust():
    floor = [line(4, 28, 96, 28, 1.8), line(4, 32, 96, 32, 1.0, .5)]
    pilae = [rect(10 + i * 16, 36, 7, 40, 1.4) for i in range(5)] + [line(10 + i * 16, 36, 17 + i * 16, 36, 1.0) for i in range(5)]
    base = [line(4, 78, 96, 78, 1.8), line(4, 84, 96, 84, 1.0, .5)]
    heat = [path(f"M{22 + i * 16} 72 q4 -6 0 -12 q-4 -6 0 -12", 1.0, .65) for i in range(4)]
    furn = [rect(0, 52, 6, 26, 1.4), path("M0 56 q4 2 6 0", 1.0, .6)]
    flue = [rect(90, 34, 6, 44, 1.4), line(93, 34, 93, 8, 1.2, .6)]
    return layer(-4, *heat) + layer(0, *floor, *base, *pilae) + layer(4, *furn, *flue)


def murdoch_gas_lamp():
    retort = [path("M10 82 Q10 60 26 60 L40 60 Q44 60 44 66 L44 82 Z", 1.8), rect(14, 82, 30, 6, 1.2), line(44, 66, 58, 56, 1.4)]
    fire = [path("M18 94 q4 -6 0 -10 M26 94 q4 -6 0 -10 M34 94 q4 -6 0 -10", 1.0, .6)]
    pipe = [path("M58 56 L58 40 L74 40 L74 26", 1.6)]
    lamp = [rect(68, 18, 12, 8, 1.4), path("M70 18 L74 8 L78 18", 1.2), path("M74 8 q2 -4 0 -6", 1.0, .7)]
    flame = [path("M72 18 q2 -6 4 0", 1.0, .8), line(74, 26, 74, 18, 1.0)]
    house = [path("M82 52 L82 30 L94 30 L94 52 Z", 1.0, .5), line(82, 40, 94, 40, .9, .4)]
    return layer(-4, *fire, *house) + layer(0, *retort, *pipe) + layer(4, *lamp, *flame)


def gas_holder():
    tank = [path("M10 52 L10 90 Q10 96 50 96 Q90 96 90 90 L90 52", 1.8), line(12, 70, 88, 70, 1.0, .6)]
    lift1 = [rect(16, 22, 68, 40, 1.6), line(16, 40, 84, 40, 1.0, .5)]
    lift2 = [rect(24, 8, 52, 20, 1.4), line(24, 18, 76, 18, 1.0, .6)]
    guide = [line(8, 6, 8, 52, 1.2), line(92, 6, 92, 52, 1.2), line(6, 8, 14, 8, 1.0), line(86, 8, 94, 8, 1.0)]
    water = [path("M12 72 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0", 1.0, .55)]
    return layer(-4, *water) + layer(0, *tank, *guide) + layer(4, *lift1, *lift2)


def arithmometer():
    body = [path("M6 78 L16 40 L84 40 L94 78 Z", 1.8)]
    slots = [rect(22 + i * 8, 46, 4, 20, 1.0) for i in range(7)] + [circle(24 + i * 8, 70, 1.2, .8, fill=True) for i in range(7)]
    res = [rect(18, 30, 64, 8, 1.2)] + [circle(22 + i * 6.2, 34, 1.6, .9) for i in range(10)]
    crank = [circle(86, 56, 6, 1.4), line(86, 56, 98, 46, 1.6), circle(98, 46, 2, 1.2)]
    knobs = [line(24 + i * 8, 66, 24 + i * 8, 62, .9, .6) for i in range(7)]
    drum = [path("M30 84 Q50 90 70 84", 1.0, .5)]
    return layer(-4, *drum) + layer(0, *body, *res) + layer(4, *slots, *knobs, *crank)


def carillon():
    frame = [line(6, 14, 94, 14, 1.8), line(6, 14, 6, 94, 1.6), line(94, 14, 94, 94, 1.6)]
    bells = []
    for i in range(7):
        x = 18 + i * 11
        h = 26 - i * 2
        bells += [path(f"M{x - 4} {40 + h} Q{x - 4} {30} {x} {28} Q{x + 4} {30} {x + 4} {40 + h} Z", 1.4), line(x, 14, x, 28, 1.0, .7)]
    clap = [circle(18 + i * 11, 40 + 26 - i * 2 + 2, 1.2, .9, fill=True) for i in range(7)]
    keys = [rect(10 + i * 7, 84, 5, 10, 1.0) for i in range(11)]
    wires = [line(20 + i * 11, 68, 12 + i * 7, 84, .9, .5) for i in range(7)]
    return layer(-4, *wires) + layer(0, *frame, *keys) + layer(4, *bells, *clap)


def aqua_appia():
    chan = [path("M2 40 L38 46 L62 56 L98 62", 1.8), path("M2 46 L38 52 L62 62 L98 68", 1.0, .6)]
    cover = [path("M2 38 L38 44 L62 54 L98 60", 1.0, .5)]
    spring = [path("M2 40 q-0 -12 8 -20", 1.2, .7), circle(4, 22, 3, 1.0)]
    water = [path("M10 44 q6 -2 12 0 t12 0 t12 0", 1.0, .55)]
    fount = [circle(88, 78, 6, 1.4), path("M82 78 Q88 66 94 78", 1.0), line(88, 62, 88, 72, 1.0, .7)]
    ground = [line(2, 90, 98, 90, 1.4), line(10, 96, 90, 96, 1.0, .4)]
    props = [line(16 + i * 18, 48 + i * 2, 16 + i * 18, 90, 1.0, .7) for i in range(5)]
    return layer(-4, *props, *water) + layer(0, *chan, *ground, *cover) + layer(4, *spring, *fount)


def planispheric_astrolabe():
    mater = [circle(50, 52, 38, 1.8), circle(50, 52, 33, 1.0, .5)] + [line(*pol(50, 52, 33, k * 15), *pol(50, 52, 38, k * 15), .9, .8) for k in range(24)]
    rete = [circle(50, 52, 22, 1.2, .8), path("M50 14 L50 90 M12 52 L88 52", .9, .5)] + [path(f"M{50 + 22 * math.cos(math.radians(a))} {52 + 22 * math.sin(math.radians(a))} L{50 + 14 * math.cos(math.radians(a + 40))} {52 + 14 * math.sin(math.radians(a + 40))}", 1.0, .7) for a in (20, 100, 200, 300)]
    ring = [circle(50, 8, 4, 1.4), line(50, 12, 50, 14, 1.2), rect(46, 2, 8, 4, 1.0)]
    alidade = [line(12, 90, 88, 14, 1.4), circle(14, 88, 2, 1.0), circle(86, 16, 2, 1.0)]
    return layer(-4, *ring) + layer(0, *mater, *rete) + layer(4, *alidade, circle(50, 52, 2, 1.2))


ITEMS = [
    dict(id="exp28_nocturnal", n="Nocturnal", era="science", cat="technology", ds=850, rar="uncommon",
         date="Pacificus of Verona (9th century); Lull's Nova geometria (1299); Apianus c. 1530; Cortés 1551", vis="star-time-disc", topic="timekeeping_exp28",
         region="Medieval and early modern Europe (Verona, Spain)", artifactType="astronomical time instrument", material="wood or brass", physical=True, durable=True,
         l1="A hand disc that tells the hour at night by sighting Polaris and a pointer star.",
         l2="An outer disc is marked with months and an inner disc with hours and reference stars; a pointer on a shared pivot is lined up on a star sighted through a hollow rivet. Stars circle Polaris in about 23 h 56 min, so the sky works as a clock once the date is set.",
         l3="The page names Pacificus of Verona (9th century) as inventor of the horologium nocturnum, the precursor to later nocturnals; the earliest image of one in use is 12th century; Raymond Lull's Nova geometria (1299) mentions it; Petrus Apianus describes it c. 1530 and Martín Cortés's Arte de Navegar (1551) popularised it.",
         ev="Nova geometria (1299); Cosmographicus Liber (c. 1530)", first_known="9th century (precursor)",
         confidence=dict(level="debated", note="ds is a round 850 for the 9th-century precursor; the page gives no exact date for the earliest instrument."),
         srcs=[wp("nocturnal_wp", "Nocturnal_(instrument)", "Pacificus of Verona 9th-century horologium nocturnum; 12th-century image; Lull 1299; Apianus c. 1530; Cortés 1551; discs, pointer and hollow rivet; stars circle Polaris in 23 h 56 min.")],
         pool=['astronomy', 'observation', 'wood', 'measurement', 'clock', 'geometry', 'exp26_star_position_table', 'anc27_star_rising_navigation', 'navigation'], must=['astronomy'], nrec=2,
         tags=["astronomy", "timekeeping"], regions=["europe"], art=nocturnal()),
    dict(id="exp28_torricelli_barometer", n="Torricelli Mercury Barometer", era="science", cat="science", ds=1643, rar="rare",
         date="Torricelli, 1643 (disputed; 1644 report); Puy de Dôme, September 1648", vis="mercury-column-cistern", topic="meteorology_exp28",
         region="Italy (Torricelli); France (Puy de Dôme)", artifactType="pressure instrument", material="glass tube and mercury", physical=True, durable=False,
         l1="A glass tube of mercury standing in a dish that shows the weight of the air.",
         l2="The column of mercury stands about 760 mm (29.92 in) at one standard atmosphere; its height changes with the weight of the air above it. The Fortin type uses a cistern of variable volume.",
         l3="The page credits Torricelli with inventing the barometer, dated 1643 (disputed; W. E. Knowles Middleton suggests 1644, when Torricelli reported it to Michelangelo Ricci, arguing that the weight of air supports the column). In September 1648 Florin Périer carried one up the Puy de Dôme and found the column fell with altitude, confirming Pascal's prediction.",
         ev="Torricelli's letter to Ricci (1644); Puy de Dôme trial (Sept 1648)", first_known="1643 (disputed)",
         confidence=dict(level="debated", note="Date disputed between 1643 and 1644; the page gives no date for the Fortin cistern."),
         srcs=[wp("barometer_wp", "Barometer", "Torricelli credited 1643 (disputed; 1644 report to Ricci); Puy de Dome September 1648; 760 mm = 1 atmosphere; Fortin variable cistern.")],
         pool=['exp26_graduated_glass_tube', 'exp26_drawn_glass_tube', 'glass', 'physics', 'experiment', 'measurement', 'observation', 'mathematics'], must=['exp26_graduated_glass_tube'], nrec=2,
         tags=["meteorology", "pressure"], regions=["europe"], art=torricelli_barometer()),
    dict(id="exp28_rheostat", n="Wheatstone Rheostat", era="electric", cat="technology", ds=1843, rar="uncommon",
         date="Charles Wheatstone coined the name, 1843", vis="wire-cylinder-slider", topic="electrical_exp28",
         region="England (Wheatstone)", artifactType="variable resistor", material="resistance wire, metal and wood", physical=True, durable=True,
         l1="A wire-wound cylinder with a sliding contact that varies how much current passes.",
         l2="A rheostat is a two-terminal variable resistor. High-power ones wind resistance wire round an insulator with a wiper sliding from turn to turn; in the other design the wire is on a heat-resistant cylinder and metal fingers slide to move the tap point.",
         l3="The page says Sir Charles Wheatstone coined 'rheostat' in 1843 from Greek roots for 'stream' and 'setter'. It shows his 1843 instruments with a metal and wooden cylinder and a version with a moving whisker. Wire-wound rheostats serve DC motor drives, welding and generator controls.",
         ev="Wheatstone's instruments (1843)", first_known="1843",
         confidence=dict(level="established", note="The page gives the 1843 naming only, no other dates for variable resistors."),
         srcs=[wp("rheostat_wp", "Rheostat", "Wheatstone coined rheostat in 1843; two-terminal variable resistor; wire wound on insulator with sliding wiper; wire-wound uses in motor drives, welding, generators.")],
         pool=['electricity', 'exp26_copper_wire_coil', 'exp26_copper_coil_winding', 'wood', 'measurement', 'exp28_galvanometer', 'physics', 'copper'], must=['electricity'], nrec=2,
         tags=["electric", "resistor"], regions=["europe"], art=rheostat()),
    dict(id="exp28_hypocaust", n="Hypocaust", era="civilization", cat="engineering", ds=-80, rar="rare",
         date="Attributed to Sergius Orata c. 80 BC (disputed); described by Vitruvius c. 15 BC", vis="pilae-under-floor", topic="heating_exp28",
         region="Roman world", artifactType="underfloor heating system", material="brick, tile and stone", physical=True, durable=True,
         l1="A raised floor on brick pillars through which furnace hot air flows to heat a room.",
         l2="The page describes a furnace feeding hot gases beneath a floor held up by stacks of pillars (pilae), with tile flues (caliducts) in the walls; Vitruvius describes its construction and operation. The article does not use the Latin terms suspensurae, tubuli or praefurnium.",
         l3="Vitruvius attributes the invention to Sergius Orata c. 80 BC, though a 1996 paper by Garrett G. Fagan disputes his priority; the earliest reference on the page is 350 BC, suggesting the Temple of Ephesus was heated this way. Vitruvius describes it c. 15 BC. A hypocaust at Dzalisi dates to 200–400 AD.",
         ev="Vitruvius, De architectura (c. 15 BC)", first_known="350 BC (earliest reference)",
         confidence=dict(level="debated", note="ds uses Vitruvius's attribution to Orata (c. 80 BC); Fagan 1996 disputes it."),
         srcs=[wp("hypocaust_wp", "Hypocaust", "Vitruvius attributes to Sergius Orata c. 80 BC (disputed); Vitruvius describes c. 15 BC; 350 BC earliest reference; pilae stacks and caliducts; heats public baths.")],
         pool=['brick', 'kiln', 'fire', 'lime', 'mortar', 'engineering', 'exp26_roof_tile_blank', 'exp26_flat_roof_tile', 'exp26_barrel_vault'], must=['fire'], nrec=3,
         tags=["heating", "roman"], regions=["europe"], art=hypocaust()),
    dict(id="exp28_murdoch_coal_gas_lamp", n="Murdoch's Coal-Gas Lighting", era="industry", cat="energy", ds=1792, rar="rare",
         date="William Murdoch, Redruth, 1792; Philippe Lebon, 1801; Baltimore street lamp, 7 February 1817", vis="retort-pipe-lamp", topic="lighting_exp28",
         region="Cornwall, England (Redruth); Paris; Baltimore", artifactType="gas lighting system", material="iron retort, pipe and lamp", physical=True, durable=False,
         l1="Coal is baked in a closed retort and the gas it gives off is piped to burn in a lamp.",
         l2="Coal is heated and distilled (carbonised) and the gas is led away; in 1726 Stephen Hales distilled 158 grains of Newcastle coal into 180 cubic inches of gas. Murdoch built a retort to heat coal in 1792.",
         l3="The page says William Murdoch first lit his own house in Redruth, Cornwall, with coal gas in 1792; Philippe Lebon lit his house and gardens in Paris in 1801; Rembrandt Peale's Museum in Baltimore used gas in 1816 and Baltimore's first gas street lamp was lit on 7 February 1817. It does not mention Pall Mall.",
         ev="Murdoch's Redruth house (1792); Baltimore street lamp (7 Feb 1817)", first_known="1792",
         confidence=dict(level="established", note="The page does not cover Pall Mall (1807); that date comes from the separate gasometer page."),
         srcs=[wp("gaslight_wp", "Gas_lighting", "Murdoch lit his Redruth house with coal gas in 1792; Lebon 1801; Baltimore museum 1816, first street lamp 7 Feb 1817; coal carbonized; Hales 1726."),
               wp("gasometer_wp", "Gasometer", "Murdoch built a retort in 1792; first public piped gas supply at Pall Mall in 1807.")],
         pool=['exp28_coke_blast_furnace', 'iron', 'fire', 'chemistry', 'coal', 'exp28_davy_safety_lamp', 'exp26_pressure_vessel_parts', 'exp26_gas_controlled_laboratory_burner', 'engineering'], must=['chemistry'], nrec=2,
         tags=["lighting", "energy"], regions=["europe", "americas"], art=murdoch_gas_lamp()),
    dict(id="exp28_telescopic_gas_holder", n="Telescopic Gas Holder", era="industry", cat="engineering", ds=1824, rar="uncommon",
         date="'Gasometer' name adopted 1782; telescopic holder first invented 1824; cup-and-dip seal patented 1833", vis="nested-lifts-water-tank", topic="lighting_exp28",
         region="Britain (gasworks)", artifactType="gas storage vessel", material="iron plate and brick, water", physical=True, durable=True,
         l1="A tank that rises on water as gas fills it, in nested sections like a telescope.",
         l2="Gas pressure lifts the tank floating in a water reservoir; its weight sets the pressure in the gas system. Nested lifts are linked by a cup at the bottom of one that picks up water and engages a downward lip, the dip or grip, on the next, keeping the water seal as it rises; holders had up to four lifts.",
         l3="The page says the telescopic gas holder was first invented in 1824, without naming an inventor, and that Hutchinson patented the cup and dip seal in 1833. Brick tanks arrived in 1818 and carried up to 20,000 cubic feet; Pease invented cable-guided holders in 1880 and Gadd the spiral-guided holder in 1890.",
         ev="Telescopic holder (1824); Hutchinson patent (1833)", first_known="1824",
         confidence=dict(level="established", note="The page does not name the inventor of the 1824 telescopic holder."),
         srcs=[wp("gasometer_wp2", "Gasometer", "Telescopic gas holder first invented 1824; Hutchinson cup and dip seal 1833; brick tanks 1818; Pease 1880; Gadd 1890; nested lifts floating in water, up to four lifts.")],
         pool=['exp28_murdoch_coal_gas_lamp', 'iron', 'engineering', 'exp26_pressure_vessel_parts', 'exp26_pressure_water_main', 'brick', 'chemistry', 'water_power'], must=['exp28_murdoch_coal_gas_lamp'], nrec=2,
         tags=["gas", "storage"], regions=["europe"], art=gas_holder()),
    dict(id="exp28_arithmometer", n="Thomas de Colmar's Arithmometer", era="industry", cat="computing", ds=1820, rar="rare",
         date="Patented 18 November 1820; industrial production from 1851; production ended 1915", vis="crank-slider-register", topic="calculation_exp28",
         region="France (Thomas de Colmar)", artifactType="mechanical calculator", material="brass and wood", physical=True, durable=True,
         l1="A crank-driven brass calculator that adds, subtracts, multiplies and divides with sliding setters.",
         l2="The page describes a set of linked Leibniz wheels driven by a crank handle, a descendant of Leibniz's stepped reckoner (the page does not say 'stepped drum').",
         l3="Thomas de Colmar patented the arithmometer on 18 November 1820; industrial production began in 1851 and the page calls it the first commercially successful mechanical calculator. Production stopped in 1915 during World War I. Odhner's pinwheel redesign overtook it in machines made by 1900; the page gives no 1873 date.",
         ev="Patent (18 Nov 1820); production (1851)", first_known="1820",
         confidence=dict(level="established", note="Page does not date the Odhner machine."),
         srcs=[wp("arithmometer_wp", "Arithmometer", "Patented 18 Nov 1820; industrial production 1851, first commercially successful mechanical calculator; ended 1915; linked Leibniz wheels with a crank; Odhner pinwheel redesign.")],
         pool=['mechanism', 'gear', 'number_system', 'mathematics', 'clock', 'exp28_jacquard_card_chain', 'exp28_hollerith_tabulator', 'exp28_difference_engine'], must=['mechanism'], nrec=2,
         tags=["calculation", "machine"], regions=["europe"], art=arithmometer()),
    dict(id="exp28_hemony_carillon", n="Tuned-Bell Carillon", era="science", cat="culture", ds=1644, rar="uncommon",
         date="Dunkirk bell melodies 1478; Oudenaarde 1510; van Eyck's tuning 1633; Hemony brothers' Zutphen carillon 1644", vis="bell-frame-keyboard", topic="music_instruments_exp28",
         region="Low Countries (Zutphen, Oudenaarde, Mechelen)", artifactType="keyboard bell instrument", material="cast bronze bells and timber frame", physical=True, durable=True,
         l1="A tower of tuned bells played from a keyboard of batons.",
         l2="Jacob van Eyck worked out in 1633 how to isolate a bell's five main overtones and tune them to sound harmonious by adjusting the thickness of the bell.",
         l3="The page records a 1478 chronicle of a man playing melodies on bells in Dunkirk; in 1510 Oudenaarde's town hall combined a clock forestrike with nine bells connected to a keyboard. In 1644 Pieter and François Hemony cast 19 bells for Zutphen's Wijnhuistoren with van Eyck as consultant, the first carillon by the modern definition; they produced 51 carillons in the next 36 years. Jef Denyn gave the first carillon concert on 1 August 1892.",
         ev="Zutphen Wijnhuistoren carillon (1644)", first_known="1510 (primitive)",
         confidence=dict(level="established", note="ds uses the 1644 Hemony carillon, the first by the modern definition; Oudenaarde's 1510 set was primitive."),
         srcs=[wp("carillon_wp", "Carillon", "1478 Dunkirk bells; 1510 Oudenaarde nine bells with keyboard; van Eyck 1633 overtone tuning; Hemony brothers Zutphen 1644 first modern carillon, 19 bells; Denyn first concert 1 Aug 1892.")],
         pool=['anc27_bronze_bell_casting', 'music', 'clock', 'exp28_diving_bell', 'mechanism', 'bronze', 'lever', 'mathematics', 'physics'], must=['anc27_bronze_bell_casting'], nrec=2,
         tags=["music", "bells"], regions=["europe"], art=carillon()),
    dict(id="exp28_aqua_appia", n="Aqua Appia", era="civilization", cat="engineering", ds=-312, rar="rare",
         date="Completed 312 BC, commissioned by Appius Claudius Caecus", vis="sloped-covered-channel", topic="waterworks_exp28",
         region="Rome, Italy", artifactType="aqueduct", material="stone-lined channel", physical=True, durable=True,
         l1="Rome's first aqueduct, a covered sloping channel from a spring 16.4 km away to the Forum Boarium.",
         l2="Roman aqueducts carried water by gravity; the page notes siphons in soldered lead pipe crossed valleys where arcades were impractical, and terminal castella acted as settling tanks and cisterns that fed branch pipes through bronze stopcocks.",
         l3="The Aqua Appia was completed in 312 BC, commissioned by the censor Appius Claudius Caecus, fed by a spring 16.4 km from Rome and discharging into a fountain at the Forum Boarium. The page gives no exact dates for the siphons, castella or the Pont du Gard.",
         ev="Aqua Appia (312 BC)", first_known="312 BC",
         confidence=dict(level="established", note="Exact dates for later aqueduct features are not given on the page."),
         srcs=[wp("aqueduct_wp", "Roman_aqueduct", "Aqua Appia completed 312 BC by Appius Claudius Caecus, spring 16.4 km away, fountain at Forum Boarium; lead siphons; castellum settling tanks with bronze stopcocks.")],
         pool=['engineering', 'geometry', 'measurement', 'lime', 'mortar', 'brick', 'exp26_keyed_stone_arch', 'exp26_socketed_water_pipe', 'exp26_pottery_water_pipe', 'anc27_aqueduct_settling_tank'], must=['engineering'], nrec=2,
         tags=["water", "roman"], regions=["europe"], art=aqua_appia()),
    dict(id="exp28_planispheric_astrolabe", n="Planispheric Astrolabe", era="science", cat="science", ds=775, rar="rare",
         date="Theon of Alexandria's treatise (c. 335–405); al-Fazari built the first in the Islamic world (8th century)", vis="mater-rete-alidade", topic="timekeeping_exp28",
         region="Alexandria; Islamic world", artifactType="astronomical instrument", material="brass", physical=True, durable=True,
         l1="A brass disc with a rotating star map that measures a star's height and tells time and latitude.",
         l2="A mater holds one or more latitude plates (tympans); a free-turning rete carries a projection of the ecliptic and pointers to bright stars, and an alidade on the back reads altitude from the graduated edge. One full turn of the rete is one day.",
         l3="The page says Theon of Alexandria (c. 335–405) wrote a detailed treatise on the astrolabe and that al-Fazari, an eighth-century mathematician, is credited as the first to build one in the Islamic world; it gives no exact date, so ds uses 775 as a round mid-8th-century marker. Uses include altitude measurement, identifying stars, latitude and time, and surveying.",
         ev="Theon of Alexandria's treatise (4th century)", first_known="4th century (treatise)",
         confidence=dict(level="uncertain", note="No exact date is given for al-Fazari; ds is a round marker. The page says Hipparchus probably used an armillary sphere, not an astrolabe."),
         srcs=[wp("astrolabe_wp", "Astrolabe", "Theon of Alexandria (c. 335-405) treatise; al-Fazari 8th century first in Islamic world; mater, tympan, rete, alidade; altitude, latitude and time, surveying.")],
         pool=['astronomy', 'observation', 'geometry', 'mathematics', 'measurement', 'exp26_star_position_table', 'exp26_hand_drawn_star_chart', 'navigation', 'exp26_sundial_gnomon', 'exp26_equatorial_sundial', 'exp26_shadow_measuring_rod', 'anc27_ancient_star_catalogue', 'anc27_polynesian_star_compass', 'copper', 'bronze', 'exp26_adjustable_portable_sundial'], must=[], nrec=2,
         tags=["astronomy", "navigation"], regions=["africa_asia", "europe"], art=planispheric_astrolabe()),
]
