import type { ActionId } from '../types';

/* ============================================================================
   KNOWLEDGE — the questions the game may put to the player, as plain data.

   Each entry: { question, answers, correctAnswer, explanation, source,
   confidence }, plus where it belongs (era, difficulty, region, a dated range)
   and what a right answer may open.

   Rules of the house
   • `source` holds ids into data/sources.json — only ones that exist. A
     question is asked only if `checked` is set: the cited page was read and
     says what the answer says. A claim that could not be confirmed carries
     `hold` (with the reason) and is never asked, until it is confirmed.
   • Where the record is thin or scholars disagree, `confidence` says so and
     `uncertainty` says why. The explanation never claims more than the source.
   • No quotes are attributed to anyone. Names appear only as credited in the
     sources.
   • A question can teach a technique (`teaches`), but only one the player does
     not have yet — the tutor checks. Otherwise the reward is the explanation
     itself, kept in the archive.
   ========================================================================== */

export type Confidence = 'high' | 'medium' | 'contested';
export type Difficulty = 1 | 2 | 3;

export interface Question {
  id: string;
  /** Era it belongs to (EraId). Offered once the player has reached it. */
  era: string;
  difficulty: Difficulty;
  question: string;
  answers: string[];
  correctAnswer: string;
  explanation: string;
  /** Ids in data/sources.json. */
  source: string[];
  confidence: Confidence;
  /** Why the answer is not absolute, when it is not. */
  uncertainty?: string;
  /** Where in the world the story is set, when it matters. */
  region?: string;
  /** Years, negative BCE — the span the answer refers to. */
  range?: [number, number];
  /** A technique a right answer may open. */
  teaches?: ActionId;
  /** ISO date on which the cited page was read and found to say this. Only checked questions are asked. */
  checked?: string;
  /** Set when the claim could not be confirmed from the cited page: the question is kept, and never asked. */
  hold?: string;
}

const Q = (q: Question): Question => q;

export const QUESTIONS: Question[] = [
  // ── origins ─────────────────────────────────────────────────────────────
  Q({ id: 'q_flint_edge', era: 'origins', difficulty: 1,
    question: 'How did early toolmakers in East Africa produce sharp flakes of stone?',
    answers: ['By striking a stone core with a hammerstone', 'By melting the stone in a fire', 'By grinding it with sand', 'By soaking it in water'], correctAnswer: 'By striking a stone core with a hammerstone',
    explanation: 'The Smithsonian describes early humans in East Africa using hammerstones to strike stone cores and produce sharp flakes. The flakes were the tool; the core was the raw material.',
    source: ['si_ho_tools'], confidence: 'high', region: 'East Africa', teaches: 'scrape', checked: '2026-09-24' }),
  Q({ id: 'q_spear_wood', era: 'origins', difficulty: 1,
    question: 'The hunting spears found at Schöningen, in Germany, about 400,000 years old, were made of…',
    answers: ['Wood, shaped into spears', 'Bronze', 'Iron', 'Glass'], correctAnswer: 'Wood, shaped into spears',
    explanation: 'The Smithsonian points to wooden spears about 400,000 years old at Schöningen, found with stone tools and the remains of more than ten butchered horses, and links them to Homo heidelbergensis. Wood rarely survives, so this is a small part of what was made.',
    source: ['si_ho_heidel'], confidence: 'high', region: 'Germany', range: [-400000, -400000], teaches: 'carve', checked: '2026-09-24' }),
  Q({ id: 'q_hafting_glue', era: 'origins', difficulty: 2,
    question: 'The stone-tool industry associated with Neanderthals is called…',
    answers: ['Mousterian', 'Oldowan', 'Bronze Age', 'Neolithic'], correctAnswer: 'Mousterian',
    explanation: 'The Smithsonian describes Neanderthals making and using a diverse set of sophisticated tools, in what is called the Mousterian industry.',
    source: ['si_ho_neander'], confidence: 'high', region: 'Europe and western Asia', checked: '2026-09-24' }),
  Q({ id: 'q_heat_stone', era: 'fire', difficulty: 3,
    question: 'At Gesher Benot Ya’aqov, in Israel, scientists found debris from stone toolmaking that had been…',
    answers: ['Scorched by fire', 'Painted with pigment', 'Buried in ice', 'Melted into glass'], correctAnswer: 'Scorched by fire',
    explanation: 'Stone-toolmaking debris scorched by fire is one line of evidence for early fire use. Burned material alone does not say who lit the fire, or why.',
    source: ['si_ho_firestone'], confidence: 'medium',
    uncertainty: 'Burned debris shows fire was there; it does not show that fire was controlled or used on purpose.', region: 'Israel', teaches: 'heat', checked: '2026-09-24' }),
  Q({ id: 'q_music_flute', era: 'fire', difficulty: 2,
    question: 'Flutes from caves in southwestern Germany are among the oldest musical instruments found in Europe. What were they made from?',
    answers: ['Bone and ivory', 'Bronze tubes', 'Baked clay', 'Reeds'], correctAnswer: 'Bone and ivory',
    explanation: 'The finds include a five-hole bird-bone flute. Nature reports a well-established musical tradition more than 35,000 calendar years ago. Reeds would not have survived, so bone and ivory show only what lasted.',
    source: ['nature_flutes2009', 'unesco_swabian'], confidence: 'high', region: 'Swabian Jura, Germany', checked: '2026-09-24' }),

  // ── fire ────────────────────────────────────────────────────────────────
  Q({ id: 'q_hearth_needs', era: 'fire', difficulty: 2,
    question: 'The earliest known hearths are at least how old?',
    answers: ['About 790,000 years', 'About 7,900 years', 'About 79,000 years', 'About 3 million years'], correctAnswer: 'About 790,000 years',
    explanation: 'The Smithsonian gives at least 790,000 years for the earliest hearths, and notes that some researchers think cooking may reach back more than 1.5 million years.',
    source: ['si_ho_hearths'], confidence: 'medium',
    uncertainty: 'Hearths are the firmest evidence; when fire was first used, and for cooking, is argued.', range: [-790000, -790000], teaches: 'burn', checked: '2026-09-24' }),
  Q({ id: 'q_fire_food', era: 'fire', difficulty: 2,
    question: 'What did cooking do to food?',
    answers: ['Released nutrients and made it easier to digest', 'Made it heavier to carry', 'Made it grow faster', 'Nothing measurable'], correctAnswer: 'Released nutrients and made it easier to digest',
    explanation: 'The Smithsonian says cooking released nutrients in foods, made them easier to digest, and rid some plants of poisons.',
    source: ['si_ho_hearths'], confidence: 'medium', uncertainty: 'How early cooking became regular is argued: some researchers place it more than 1.5 million years ago.', checked: '2026-09-24' }),

  // ── settlement / agriculture ────────────────────────────────────────────
  Q({ id: 'q_seed_selection', era: 'agriculture', difficulty: 1,
    question: 'How did wild plants slowly become crops?',
    answers: ['People kept and sowed seed from the plants they preferred', 'Rain changed them', 'Animals planted them on purpose', 'They were imported from the sea'], correctAnswer: 'People kept and sowed seed from the plants they preferred',
    explanation: 'Choosing seed season after season, generation by generation, shifted plants toward what was easy to harvest and eat. No single moment, and no single place.',
    source: ['brit_domestication', 'brit_agri_began'], confidence: 'high', teaches: 'grind', hold: 'Britannica page read: it describes domestication as a continuum of resource management with natural selection and mutation, not as people choosing seed. Rewrite from a source that says so.' }),
  Q({ id: 'q_storage', era: 'agriculture', difficulty: 1,
    question: 'Which of these marks the Neolithic?',
    answers: ['Settlement in permanent villages', 'Steam power', 'Writing on paper', 'Smelting iron'], correctAnswer: 'Settlement in permanent villages',
    explanation: 'Britannica characterises the Neolithic by stone tools shaped by polishing or grinding, dependence on domesticated plants and animals, settlement in permanent villages, and crafts such as pottery and weaving.',
    source: ['brit_neolithic'], confidence: 'high', checked: '2026-09-24' }),
  Q({ id: 'q_farming_first', era: 'agriculture', difficulty: 1,
    question: 'Which came first in Mesopotamia?',
    answers: ['Domesticated grains and animals', 'Writing on clay tablets', 'Steam engines', 'Printing'], correctAnswer: 'Domesticated grains and animals',
    explanation: 'The Met dates the first domesticated grains and animals at Jarmo to about 8000–7000 BCE, and the first proto-cuneiform tablets to about 3200–3000 BCE. Dates are approximate.',
    source: ['met_meso_early', 'met_writing'], confidence: 'high', region: 'Mesopotamia', range: [-8000, -3000], checked: '2026-09-24' }),

  // ── civilisation ────────────────────────────────────────────────────────
  Q({ id: 'q_uruk', era: 'civilization', difficulty: 2,
    question: 'Around 3200 BCE, Uruk in Mesopotamia was…',
    answers: ['The largest settlement in southern Mesopotamia, if not the world', 'A small hamlet', 'A port for the open ocean', 'An iron-mining camp'], correctAnswer: 'The largest settlement in southern Mesopotamia, if not the world',
    explanation: 'The Met describes Uruk as a city of monumental mud-brick buildings decorated with clay-cone mosaics. “First city” is a convenient label that depends on how a city is defined.',
    source: ['met_uruk'], confidence: 'medium', uncertainty: '“First city” depends on how a city is defined.', region: 'Mesopotamia', range: [-3200, -3200], checked: '2026-09-24' }),
  Q({ id: 'q_tablets', era: 'civilization', difficulty: 1,
    question: 'Early writing in Mesopotamia was marked into what?',
    answers: ['Moistened clay', 'Paper', 'Stone walls only', 'Bark'], correctAnswer: 'Moistened clay',
    explanation: 'The Met says a reed or stick was used to draw signs into moistened clay, which became the preferred medium because it was abundant, cheap and durable.',
    source: ['met_writing', 'met_cuneiform'], confidence: 'high', region: 'Mesopotamia', teaches: 'shape', checked: '2026-09-24' }),
  Q({ id: 'q_glass', era: 'metallurgy', difficulty: 2,
    question: 'What is glass made from, at its heart?',
    answers: ['Sand (silica) and an alkali', 'Baked clay', 'Crushed shells alone', 'Ice'], correctAnswer: 'Sand (silica) and an alkali',
    explanation: 'The Corning Museum of Glass describes a mixture of silica sand or ground quartz pebbles and an alkali as a flux. A cooking fire cannot reach the melting temperature of glass.',
    source: ['cmog_glass'], confidence: 'high', teaches: 'polish', checked: '2026-09-24' }),
  Q({ id: 'q_weights', era: 'trade', difficulty: 1,
    question: 'Why did traders need standardised weights?',
    answers: ['So the same amount meant the same thing in every market', 'To make goods heavier', 'To avoid using coins', 'To measure distance'], correctAnswer: 'So the same amount meant the same thing in every market',
    explanation: 'Trust between strangers needs a shared measure. Balances and weight sets turn a dispute into a reading.',
    source: ['penn_weights'], confidence: 'high', hold: 'Penn Museum page read: it describes how sophisticated Mesopotamian weighing was; it does not say why traders needed standard weights.' }),
  Q({ id: 'q_money_barter', era: 'civilization', difficulty: 2,
    question: 'What does money let you avoid, that barter does not?',
    answers: ['Searching for someone who wants exactly what you have', 'Paying taxes', 'Counting', 'Trade itself'], correctAnswer: 'Searching for someone who wants exactly what you have',
    explanation: 'Britannica: money separates buying from selling, so trade need not depend on the double coincidence of barter, and no one has to hunt for someone able and willing to make the exchange wanted.',
    source: ['brit_money'], confidence: 'high', checked: '2026-09-24' }),
  Q({ id: 'q_silk_roads', era: 'trade', difficulty: 2,
    question: 'What were the Silk Roads?',
    answers: ['Overlapping networks linking communities across Asia, Africa and Europe', 'A single paved road from Rome to Beijing', 'A river route', 'A wall'], correctAnswer: 'Overlapping networks linking communities across Asia, Africa and Europe',
    explanation: 'The British Museum: rather than a single trade route from East to West, the Silk Roads were overlapping networks, and the journeys of people, objects and ideas shaped cultures across three continents.',
    source: ['bm_silkroads'], confidence: 'high', region: 'Eurasia and Africa', checked: '2026-09-24' }),
  Q({ id: 'q_double_entry', era: 'trade', difficulty: 3,
    question: 'Which Italian mathematician and Franciscan friar is often called the “Father of Accounting”?',
    answers: ['Luca Pacioli', 'Johannes Gutenberg', 'Leonardo da Vinci', 'Isaac Newton'], correctAnswer: 'Luca Pacioli',
    explanation: 'ICAEW describes Luca Pacioli as an Italian mathematician, Franciscan friar and seminal figure in the history of modern accounting. The title is an honorific.',
    source: ['icaew_pacioli'], confidence: 'high', region: 'Italy', checked: '2026-09-24' }),

  // ── metallurgy / science ────────────────────────────────────────────────
  Q({ id: 'q_pulley', era: 'metallurgy', difficulty: 2,
    question: 'A pulley or lever lets a small force move a large load. What is traded away?',
    answers: ['Distance: you must move further', 'Nothing', 'The weight of the load', 'Time only'], correctAnswer: 'Distance: you must move further',
    explanation: 'The work done is the same; a longer pull at lower force does the job of a short pull at high force.',
    source: ['ethw_mecheng'], confidence: 'high', teaches: 'hammer', hold: 'ETHW timeline read: it lists dates of levers and pulleys but does not state the force-for-distance trade.' }),
  Q({ id: 'q_gunpowder', era: 'science', difficulty: 2,
    question: 'Where is gunpowder thought to have originated?',
    answers: ['China', 'Egypt', 'Peru', 'Scandinavia'], correctAnswer: 'China',
    explanation: 'Britannica: black powder, a mixture of saltpeter, sulfur and charcoal, is thought to have originated in China, where it was in use in fireworks by the 10th century.',
    source: ['brit_gunpowder'], confidence: 'medium', region: 'China', uncertainty: 'The wording is “thought to have”: the first maker and the exact date are not fixed.', checked: '2026-09-24' }),
  Q({ id: 'q_paper', era: 'civilization', difficulty: 2,
    question: 'Paper as a writing surface was first made in…',
    answers: ['China', 'Greece', 'Mesoamerica', 'Northern Europe'], correctAnswer: 'China',
    explanation: 'Paper from plant fibre was in use in China about two thousand years ago. Traditional accounts credit an official named Cai Lun around 105 CE; finds suggest earlier paper too.',
    source: ['brit_paper'], confidence: 'medium', region: 'China', uncertainty: 'The traditional 105 CE date is later than some finds.', range: [-100, 105], hold: 'Britannica article body was not retrievable; Cai Lun and China not confirmed against the page.' }),
  Q({ id: 'q_movable_type', era: 'science', difficulty: 3,
    question: 'Where did movable type first appear?',
    answers: ['East Asia', 'Northern Europe', 'North Africa', 'The Americas'], correctAnswer: 'East Asia',
    explanation: 'Ceramic type is described in China in the eleventh century, and metal type was used in Korea before Gutenberg. Gutenberg’s contribution was a practical metal-type system for the alphabet.',
    source: ['brit_printing'], confidence: 'high', region: 'China and Korea', range: [1040, 1450], hold: 'Britannica article body was not retrievable; only its table of contents was seen.' }),
  Q({ id: 'q_compass', era: 'science', difficulty: 3,
    question: 'In the 12th century, mariners in which places apparently found, independently, that floating lodestone points to the polestar?',
    answers: ['China and Europe', 'Only Greece', 'Only Polynesia', 'Only the Aztec world'], correctAnswer: 'China and Europe',
    explanation: 'Britannica: sometime in the 12th century, mariners in China and Europe made the discovery, apparently independently, that a lodestone floated on a stick in water aligns with the polestar.',
    source: ['brit_compass'], confidence: 'medium', region: 'China and Europe', uncertainty: '“Apparently independently”: the evidence is thin, and earlier uses of lodestone exist.', range: [1100, 1199], checked: '2026-09-24' }),
  Q({ id: 'q_spectacles', era: 'science', difficulty: 3,
    question: 'In Europe, eyeglasses first appeared in…',
    answers: ['Italy', 'Sweden', 'Portugal', 'Russia'], correctAnswer: 'Italy',
    explanation: 'Britannica: in Europe eyeglasses first appeared in Italy, their introduction attributed to Alessandro di Spina of Florence. The first portrait to show eyeglasses was painted in 1352.',
    source: ['brit_eyeglasses'], confidence: 'medium', region: 'Italy', uncertainty: 'The attribution is traditional; magnifying lenses in frames were also used in China, and which way the knowledge travelled is unclear.', checked: '2026-09-24' }),

  // ── industry / electric ─────────────────────────────────────────────────
  Q({ id: 'q_newcomen', era: 'industry', difficulty: 1,
    question: 'The first commercially successful steam engines were built to do what?',
    answers: ['Pump water out of mines', 'Drive ships', 'Spin cotton', 'Power trains'], correctAnswer: 'Pump water out of mines',
    explanation: 'ETHW: Newcomen’s engine, like Savery’s, was created to pump water from mines. As shallow mines were exhausted, shafts went deeper and seepage became a greater problem. His first engine went into operation around 1710.',
    source: ['ethw_newcomen'], confidence: 'high', region: 'England', range: [1710, 1710], checked: '2026-09-24' }),
  Q({ id: 'q_watt', era: 'industry', difficulty: 2,
    question: 'Which of these was one of the innovations in James Watt’s engines?',
    answers: ['A separate condenser', 'A diesel injector', 'An electric starter', 'A jet nozzle'], correctAnswer: 'A separate condenser',
    explanation: 'ETHW lists the separate condenser, parallel motion, the centrifugal governor, the sun-and-planet crank motion and the double-acting cylinder among the innovations in Watt’s engines.',
    source: ['ethw_watt'], confidence: 'high', region: 'Britain', checked: '2026-09-24' }),
  Q({ id: 'q_bakelite', era: 'industry', difficulty: 3,
    question: 'Bakelite, of 1907, is best known as the first…',
    answers: ['Fully synthetic plastic', 'Alloy of steel', 'Electric battery', 'Vaccine'], correctAnswer: 'Fully synthetic plastic',
    explanation: 'Baekeland made a resin that, once heated and set, does not melt again — useful for electrical parts.',
    source: ['acs_bakelite'], confidence: 'high', range: [1907, 1907], hold: 'ACS page could not be retrieved on 24/09/2026.' }),
  Q({ id: 'q_urban', era: 'industry', difficulty: 3,
    question: 'The claim that the world became majority-urban in 2007 depends most on…',
    answers: ['How “urban” is defined', 'Which year the census was taken', 'Rainfall', 'The size of capital cities'], correctAnswer: 'How “urban” is defined',
    explanation: 'Our World in Data: the 2007 date comes from older UN series that relied on national definitions. Using a shared international standard (the Degree of Urbanisation), the world has been mostly urban since at least the 1950s.',
    source: ['owid_urban'], confidence: 'contested', uncertainty: 'Different countries classify settlements as urban by very different thresholds.', range: [1950, 2007], checked: '2026-09-24' }),
  Q({ id: 'q_telegraph', era: 'electric', difficulty: 1,
    question: 'How did the electric telegraph of 1838 carry a message?',
    answers: ['As electrical pulses along a wire', 'By carrying letters faster', 'With sound waves in air', 'By light in glass'], correctAnswer: 'As electrical pulses along a wire',
    explanation: 'ETHW: electrical pulses sent through two miles of wire made an electromagnet ink dots and dashes on a strip of paper. The 6 January 1838 test used a code of numbers, each standing for a word in a dictionary; commercial service followed from 1844.',
    source: ['ethw_telegraph1838'], confidence: 'high', range: [1838, 1844], checked: '2026-09-24' }),
  Q({ id: 'q_telephone', era: 'electric', difficulty: 2,
    question: 'What was first sent over an electric wire on 10 March 1876?',
    answers: ['Intelligible speech', 'Dots and dashes', 'A photograph', 'A printed page'], correctAnswer: 'Intelligible speech',
    explanation: 'ETHW records the first transmission of intelligible speech over electrical wires on 10 March 1876, by Alexander Graham Bell’s “electrical speech machine”, now called the telephone.',
    source: ['ethw_bell1876'], confidence: 'high', range: [1876, 1876], checked: '2026-09-24' }),
  Q({ id: 'q_light_bulb', era: 'electric', difficulty: 3,
    question: 'The practical electric light bulb was…',
    answers: ['The work of several inventors, refined into a lasting lamp around 1879', 'Invented in one afternoon', 'Known in the Roman era', 'Only possible after transistors'], correctAnswer: 'The work of several inventors, refined into a lasting lamp around 1879',
    explanation: 'Earlier lamps existed; the hard part was a filament that lasted, and a system of power to use it.',
    source: ['si_lighting'], confidence: 'medium', uncertainty: 'Credit for “the” inventor is disputed.', range: [1870, 1880], hold: 'Smithsonian exhibition page read: it does not state the inventors, the date or the filament.' }),
  Q({ id: 'q_radio', era: 'computing', difficulty: 2,
    question: 'The 1909 Nobel Prize in Physics honoured Marconi and Braun for contributions to…',
    answers: ['Wireless telegraphy', 'The steam engine', 'The telephone', 'Photography'], correctAnswer: 'Wireless telegraphy',
    explanation: 'The Nobel Foundation gave half the prize to each “in recognition of their contributions to the development of wireless telegraphy”.',
    source: ['nobel_radio1909'], confidence: 'high', range: [1909, 1909], checked: '2026-09-24' }),
  Q({ id: 'q_vaccine', era: 'science', difficulty: 2,
    question: 'In May 1796, Edward Jenner inoculated a boy with matter from a sore of which disease?',
    answers: ['Cowpox', 'Measles', 'Cholera', 'Plague'], correctAnswer: 'Cowpox',
    explanation: 'WHO: Jenner found that people infected with cowpox were immune to smallpox, and tested it on James Phipps. In 1980 the World Health Assembly declared smallpox eradicated.',
    source: ['who_vaccination'], confidence: 'high', region: 'England', range: [1796, 1980], checked: '2026-09-24' }),
  Q({ id: 'q_penicillin', era: 'science', difficulty: 2,
    question: 'Who shared the 1945 Nobel Prize in Physiology or Medicine for the discovery of penicillin?',
    answers: ['Fleming, Chain and Florey', 'Pasteur, Koch and Lister', 'Jenner, Salk and Sabin', 'Fleming alone'], correctAnswer: 'Fleming, Chain and Florey',
    explanation: 'The prize was “for the discovery of penicillin and its curative effect in various infectious diseases”. It went to Alexander Fleming, Ernst Boris Chain and Howard Walter Florey.',
    source: ['nobel_med1945'], confidence: 'high', range: [1945, 1945], checked: '2026-09-24' }),
  Q({ id: 'q_radar', era: 'electric', difficulty: 3,
    question: 'The cavity magnetron made which technology practical at small sizes?',
    answers: ['Radar', 'Television', 'Photography', 'The telegraph'], correctAnswer: 'Radar',
    explanation: 'ETHW: powerful microwave pulses could be sent from an antenna only tens of centimetres long, shrinking practical radar systems enormously. Development took place at the University of Birmingham; the first working device produced about 400 W on 21 February 1940.',
    source: ['ethw_magnetron'], confidence: 'high', region: 'England', range: [1939, 1941], checked: '2026-09-24' }),
  Q({ id: 'q_wright', era: 'electric', difficulty: 2,
    question: 'Where did the Wright Flyer make its first powered flights?',
    answers: ['Kitty Hawk, North Carolina', 'Paris', 'London', 'Berlin'], correctAnswer: 'Kitty Hawk, North Carolina',
    explanation: 'On 17 December 1903 the Flyer flew four times. The first was 12 seconds and 36 m; the fourth covered 255.6 m in 59 seconds.',
    source: ['nasm_wright_flyer'], confidence: 'high', region: 'United States', range: [1903, 1903], checked: '2026-09-24' }),

  // ── computing / network ─────────────────────────────────────────────────
  Q({ id: 'q_vacuum_tube', era: 'computing', difficulty: 3,
    question: 'The Fleming valve of 1904 detected a wireless signal by letting current flow…',
    answers: ['In one direction only', 'In both directions equally', 'Only when frozen', 'Without any wire'], correctAnswer: 'In one direction only',
    explanation: 'ETHW: the oscillations of a wireless signal are too rapid to move a galvanometer needle, but a current that flows one way only can. Fleming applied for the patent on 16 November 1904.',
    source: ['ethw_fleming_valve'], confidence: 'high', range: [1904, 1904], checked: '2026-09-24' }),
  Q({ id: 'q_transistor', era: 'computing', difficulty: 3,
    question: 'The 1956 Nobel Prize in Physics went to Shockley, Bardeen and Brattain for their researches on semiconductors and their discovery of…',
    answers: ['The transistor effect', 'Nuclear fission', 'The laser', 'Radio waves'], correctAnswer: 'The transistor effect',
    explanation: 'The Nobel Foundation’s motivation is “for their researches on semiconductors and their discovery of the transistor effect”.',
    source: ['nobel_transistor'], confidence: 'high', range: [1956, 1956], checked: '2026-09-24' }),
  Q({ id: 'q_ic', era: 'computing', difficulty: 3,
    question: 'Jack Kilby shared the 2000 Nobel Prize in Physics for his part in the invention of…',
    answers: ['The integrated circuit', 'The transistor', 'The laser', 'The vacuum tube'], correctAnswer: 'The integrated circuit',
    explanation: 'The Nobel Foundation’s motivation is “for his part in the invention of the integrated circuit”.',
    source: ['nobel_ic2000'], confidence: 'high', range: [2000, 2000], checked: '2026-09-24' }),
  Q({ id: 'q_4004', era: 'computing', difficulty: 3,
    question: 'Intel’s 4004 of 1971 put what onto a single chip?',
    answers: ['A complete central processing unit', 'The memory of a whole computer', 'A keyboard', 'A monitor'], correctAnswer: 'A complete central processing unit',
    explanation: 'The Computer History Museum: Hoff and Mazor conceived Intel’s first integrated CPU, the 4-bit 4004; Faggin, assisted by Shima, fitted its 2,300 transistors into a low-cost 16-pin package in 1971.',
    source: ['chm_4004'], confidence: 'high', range: [1971, 1971], checked: '2026-09-24' }),
  Q({ id: 'q_spacewar', era: 'games', difficulty: 3,
    question: 'Spacewar!, an early video game, was written for which computer?',
    answers: ['The PDP-1', 'A smartphone', 'A pocket calculator', 'A games console'], correctAnswer: 'The PDP-1',
    explanation: 'The Computer History Museum: Spacewar! was conceived in 1961 by Steve Russell, Martin Graetz and Wayne Wiitanen; the first version was written by Russell, with major improvements in spring 1962. Its users were at MIT, with access to the PDP-1.',
    source: ['chm_spacewar'], confidence: 'high', region: 'United States', range: [1961, 1962], checked: '2026-09-24' }),
  Q({ id: 'q_sputnik', era: 'network', difficulty: 2,
    question: 'Sputnik 1, the first artificial satellite, was launched in…',
    answers: ['1957', '1927', '1969', '1985'], correctAnswer: '1957',
    explanation: 'NASA’s history gives 4 October 1957, from the Soviet Union’s rocket testing facility near Tyuratam; the Soviet news agency announced the launch of the world’s first Earth-orbiting artificial satellite.',
    source: ['nasa_sputnik'], confidence: 'high', range: [1957, 1957], checked: '2026-09-24' }),
  Q({ id: 'q_gps', era: 'network', difficulty: 3,
    question: 'GPS satellite clocks must be corrected for effects predicted by…',
    answers: ['Relativity', 'Newton’s third law', 'Electromagnetic shielding', 'Plate tectonics'], correctAnswer: 'Relativity',
    explanation: 'Neil Ashby’s review: the clocks have gravitational and motional frequency shifts so large that, without carefully accounting for numerous relativistic effects, the system would not work.',
    source: ['ashby_gps'], confidence: 'high', checked: '2026-09-24' }),
  Q({ id: 'q_internet_protocols', era: 'network', difficulty: 2,
    question: 'What lets independent networks interconnect as one internet?',
    answers: ['Shared protocols such as TCP/IP', 'A single cable', 'One company owning them', 'A central computer'], correctAnswer: 'Shared protocols such as TCP/IP',
    explanation: 'The Internet Society: open-architecture networking. Each network stands on its own, with no internal changes required, and gateways and routers connect them through TCP/IP.',
    source: ['isoc_internet'], confidence: 'high', checked: '2026-09-24' }),
];

/** Era ids in the order the game meets them. */
export const ERA_ORDER = [
  'origins', 'fire', 'settlement', 'agriculture', 'civilization', 'trade', 'metallurgy',
  'science', 'industry', 'electric', 'computing', 'network', 'games', 'simulation',
];

/** What the game may ask: read against its source, and not held back. */
export const askable = (q: Question): boolean => !!q.checked && !q.hold;
