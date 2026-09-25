# Changelog

Shared by both editions: `evolution-sandbox/` (single file, canonical data and
tools) and `evolution-sandbox-next/` (Next.js).

## 1.12.0 — 25 September 2026 (unreleased)

### The Global Invention Map — a major progression system, with a 3D Earth
Some discoveries are milestones of the whole species, and they now play like it. Finding one of the
110 **major inventions** (fire, the handaxe, pottery, the wheel, agriculture, writing, bronze, iron,
the printing press, the steam engine, electricity, the telephone, the aeroplane, the computer, the
internet, the smartphone…) pauses the bench for half a second, brings up a dark Earth, carries the
camera from the *previous* major's place to the new one, and registers it on your world map — about
3–5 seconds, skippable after 1.5 s. Finishing every required major of an era is what opens the next.
Next.js build only; the single-file edition is untouched (see the README's deviations).

- **Catalogue** (`data/majors.json`, `lib/world/registry.ts`): 110 majors joined by `id` to `db.json`
  (99 full cinematic, 11 shorter). Each says where it began, **how exactly that may be claimed**
  (`site` / `area` / `region` / `broad` / `unlocated`), **how sure the origin is** (`firm` / `regional`
  / `debated` / `multiple` / `unknown`), and gives one short educational line; other early centres
  (agriculture, writing, pottery…) are `alsoAt` and drawn as quieter markers. Contested origins get
  region-level labels and a ring, never a pin — fire, controlled fire, copper smelting and the
  telescope are all region-level; language has no place at all and rests on the whole world.
- **Era hard lock**: an era opens when every *required* major of the one before it is found (83
  required over the 14 eras). Hidden discoveries (paper, compass, gunpowder, printing, lens, clock,
  vaccine…) are *optional*, never required — the model enforces it even if the data slipped. A closed
  era's recipes answer `era_locked` with the numbers and without naming the discovery; the pair is
  remembered and "Try it again" is said when the era opens. Saves from before this are never locked out
  of ground they already stand on (a floor at the furthest era held; what they already hold counts as
  seen and celebrated). Design consequence worth knowing: *Fire* belongs to the second era, so a new
  player's first "wood + wood" is turned away until the eight Origins majors are found.
- **The reveal** (`lib/world/choreography.ts`, `director.ts`, `components/world/GlobeSequence.tsx`):
  pause 0.2–0.5 s → the globe fades up at the previous major's place (the first ever: a neutral view of
  the whole world) → spin 0.65–1.6 s along the great circle, pulling back for a long journey, with a
  thin arc → zoom 0.7–1.1 s → the marker pulses → a card (name, region, period and culture, certainty
  note, one line of history, "n / N required", "Registered · k / 110") → back to the bench. Tier A is
  the full sequence, tier B two thirds of it, tier C (a repeat found by a new route) a quiet ping on the
  top-bar chip. A nearby place is a short regional shift, not a journey. Several early centres pull the
  camera back so they are all in the picture. Rapid finds are **queued** and played in order (a backlog
  turns into the shorter version). Toasts and the reflective ending wait for the picture (14 s safety
  limit). Skip: click or tap, Space or Enter (this one), Esc (this one and everything queued) — nothing
  is honoured for the first 1.2–1.5 s, and state was saved before the first frame, so skipping breaks
  nothing.
- **Era Complete**: the world lights up marker by marker in the era's own light, the era title and
  what has unlocked arrive, then it settles. `EraShift` waits for it.
- **The picture**: a raw WebGL fragment shader (ray–sphere, a signed-distance land texture,
  atmosphere, terminator, stars) plus a 2D overlay for markers, arc and labels. If WebGL is missing or
  its context is lost, a CPU version of the same globe draws instead (`lib/world/soft.ts`); with no
  canvas at all the card still lands. Adaptive resolution steps down on slow frames.
- **World Progress** (`components/world/WorldProgressPanel.tsx`; top-bar chip, key **M**): the era in
  focus as "6 / 9 required inventions" with a bar and % complete, the next era locked but visible with
  "Complete all major world inventions from this era to advance.", a flat dotted world map, regions
  represented, majors on the map, required overall, hidden majors remaining, progress by region and by
  era, and the reveal setting.
- **Integrations**: the Archive gains a **World origins** tab (every major by era; undiscovered ones
  stay closed, hidden ones show only that they exist; "Watch again" replays a reveal lighter, without
  the arc); the Timeline flags major inventions as world milestones and counts each era's required set;
  the Graph marks them with a small diamond; the Exhibit panel gains "Where it began", the lock message
  for a closed era and "Watch on the globe"; the ceremony stage gives way to the globe for a major.
- **Settings and access**: Full / Quick / Off (`evo.world.mode`); the OS reduced-motion setting always
  wins (the globe fades up already on the place, no spinning or zooming); with the globe off the map and
  counters still update. The card is announced through a polite live region.
- **Data**: land comes from Natural Earth 1:50m (public domain, via `world-atlas`), turned into
  `public/world/land-sdf.png` (4096×2048 signed distance field, ~0.9 MB, served from this origin as the
  content-security policy requires) by `scripts/world/`. Saved state gains one optional block,
  `world: { seen, celebrated, floor }`. New engine API: `eraGate`, `eraProgress`, `worldSummary`,
  `majorsFound`, `takeWorldEvents`, `markMajorSeen`, `waiveEraLock`.
- **Tests**: 367 in 45 suites, all passing (ten of the suites are new). They cover the catalogue's integrity, that the
  whole game plays through under the lock with no hidden discovery, the era gate, events, save/load
  including older saves, the camera maths, every timing rule of the choreography, the queue and skip
  rules, the toast deferral, and the panel, archive tab and globe components.
- **Verified**: `tsc` clean; eslint 0 errors; production build compiles (Google Fonts mocked where the
  sandbox had no network); the reveal watched in Chromium with and without WebGL, on desktop and phone
  widths, and with reduced motion.

## 1.11.0 — 25 September 2026 (unreleased)

### P1 game-feel gaps, filled without touching what already worked
Most of the P1 "game feel" roadmap (layered impact feedback, material-specific sound, drag inertia,
subtle camera, discovery presentation, near-discovery wobble, the technique-unlock "N materials may
react" line) was already built in 1.10.0. This round fills the two pieces that genuinely were not
there — object inspection and an unknown-property system — plus a small session-recap addition, and
adds the two client-only P3 items (shareable find, personal journal). Nothing here rewrites an
existing system; all of it reads data the engine already keeps.

- **Properties, revealed through play** (`lib/processing/reveal.ts`): the Exhibit panel's "What it's
  like" section shows a resource's physical properties (already computed by `physicsOf` for sound,
  drift and hints) as chips — the most obvious one free the moment it is held, the rest `???` until an
  Insight about that exact item has actually been noticed. Reuses `lib/processing/insights.ts`
  one-for-one; no new authored data.
- **Known / unknown reactions**: the same section states how many uses are already found, how many are
  not, and how many properties are still `???` — reusing the exhibit's existing route/use counts.
- **Journal** (`components/JournalPanel.tsx`, a `#journal-open` button in the top bar): first
  discovery, deepest reached, most-used technique, and percent discovered without an escalated hint —
  the last needs two small persisted counters (`Engine.discoveredCount` / a private `hintedCount`);
  everything else reads state the engine already had (`order`, `steps`, `stats().deepest`).
- **Share a find**: a "Share this find" button on a discovered Exhibit entry, using the Web Share API
  where the browser offers it and the clipboard otherwise. Best-effort, never load-bearing.
- **Returning-player recap**: "The world remembers" now also says how many held things still have a
  known, untried technique open on them (`Engine.openWork()`), so a returning player has somewhere to
  start.

### Brittle things take a lasting mark (P2.4)
Checked the rest of the P2 "world depth" list against the code first: most of it (environment states,
temperature/moisture visuals, wind, multiple routes to one result, the timeline and the graph's "???"
branches) turned out to already be built, in `lib/craft/world.ts` / `app/_physics.css` / the recipe
data itself. Durability was the one genuinely missing piece, so it's the one built this round —
cosmetic only, per the brief ("not every resource needs an HP bar. Use visual state instead").

- **`Body.wear`** (`lib/craft/world.ts`): a 0–1 value that only ever climbs, added to on a hard landing,
  wall hit or collision (`World.wearHit`) — and only for a body whose material `physicsOf` already
  calls `brittle` (glass, stone, bone…); anything else just squashes (`q`) and springs back, unchanged.
  Never a stat, never read by any recipe or gesture — purely a paint-time flag.
- **`data-damage="cracked"|"broken"` + `--wear`** (`app/_physics.css`): at 0.35 a hairline crack fades
  in over the piece's art; at 0.85, a second one, plus a touch more contrast and a duller saturation.
  Both are a still CSS filter + a masked overlay, not an animation, so `prefers-reduced-motion` needs no
  special case. Covered by `lib/craft/__tests__/damage.test.ts` (a brittle body cracks and eventually
  breaks under repeated hard drops; a non-brittle one never marks, however hard it lands).

Left for a dedicated round, deliberately: regional/independent-invention notes across the discovery
set (P2.8) — a large data-authoring pass, not a small addition, and risk exactly what the brief warns
against if folded into an already-large patch.

### Component assembly (P2.5) — and a false start worth recording
Investigated first, per the brief. The machinery for "bring 3–5 physical pieces together at once" was
already fully built and already shipping: `Engine.combineMany`/`multiKey` (2–5 ingredients, order-
independent), `Workbench.tsx`'s bench-side clustering (`clusters()` — union-find over touching bodies,
already generalised to groups of 2–5), and `lib/processing/assess.ts`'s partial-match detection all
predate this round. `data/processing.json` already exercises it 42 times, from Axe (`stone_flake +
stick + strands`) up to five-piece endgame items. What P2.5 actually needed was two more data
routes and a fix to a test that would not have caught a bad one.

- **A false start, reverted before delivery**: the brief's own example — Axe from `sharp_stone + wood +
  cordage`, added straight to `data/db.json` — looked reasonable and passed a quick check, but the full
  suite caught it: every one of that trio's three pairs already makes a *different* item (`wood+cordage`
  → Binding, `wood+sharp_stone` → Spear, `sharp_stone+cordage` → Bolas). Physically that means touching
  any two of the three pieces first — the ordinary way a player would drag things in one at a time —
  quietly turns them into the wrong object before the third can ever join, which is exactly what
  `lib/__tests__/processing.test.ts`'s existing invariant test ("never lets one recipe sit inside another
  that makes something else") exists to catch. Caught, reverted with `git checkout`, no trace left in
  this patch.
- **Two routes added instead, checked against the full recipe pool first** (`data/db.json`): every
  candidate was verified programmatically — no exact duplicate, and no 2-of-3 sub-pair colliding with a
  *different* item anywhere in the merged `db.json` + `processing.json` recipe pool — before being
  written.
  - **Spear**: `composite_tool + wood + bone` — a composite-bladed shaft reinforced with a bone point,
    assembled in one motion instead of two.
  - **Shelter**: `wood + binding + sewing` — poles, lashing and a sewn cover. Verified live in the
    browser bringing binding + sewing together *first* correctly does nothing (neither pair alone makes
    anything — it just "holds," trembling, on the bench) until wood completes the trio, which fires the
    genuine three-body cluster path (`age > 0.5`, not the two-body `CraftSession` minigame) and the
    "New Discovery — Shelter" ceremony.
- **`lib/__tests__/engine.test.ts`**: the recipe-collision validator destructured only the first two
  ingredients of every recipe (`pairKey(a, b)`), which would have silently ignored a 3rd+ ingredient —
  harmless while nothing but pairs existed in `db.json`, but it would not have caught a genuine 3-way
  collision once one did. Switched to the already-exported `multiKey(r)` over the full ingredient array.
- **Not touched**: `lib/craft/session.ts`'s `CraftSession` (the richer hands-on minigame) stays hard-
  coded to exactly two bodies, as before — N-body clusters already route through the simpler, still
  fully physical `beginResolve()` ceremony instead. Extending `CraftSession` itself to N bodies would be
  a genuine rewrite of a large, stable system and was left alone, per the brief.

## 1.10.0 — 24 September 2026 (unreleased)

### Twenty-five techniques, a guiding voice, and a question in the corner
Built around the existing data (`data/db.json` untouched, `data/processing.json` extended) and the
existing craft system; no parallel database, no separate mode.

- **Techniques.** The five hands became 25 (Smash, Hammer, Split, Chisel · Cut, Carve, Scrape, Saw · Brush, Dig,
  Grind, Mix, Shape, Press, Polish · Separate, Pull, Twist, Tie, Stretch · Burn, Heat, Dry, Cool, Pour). They map onto
  seven gesture kinds and five hand poses (`lib/craft/kinds.ts`), so the original five behave exactly as before.
  A technique **appears** the first time the player holds what it needs (`lib/processing/techniques.ts`), with a
  "NEW TECHNIQUE" reveal that says how many held materials may react differently, never which.
- **Action Rail** (`components/ActionRail.tsx`) at the edge of the workspace: a column on the right on a desktop, a strip
  along the bottom on a phone; grouped Impact / Edge / Material / Flexible / Thermal; collapsible; the middle of the
  screen stays for play. Unlearned techniques are only a row of "?" marks per family.
- **Multi-stage making.** ~30 new transforms and 8 new worked states (wet / shaped / dried clay, shavings, flour, polished
  stone, molten and poured copper): clay → pottery is five stages, copper casting four, twist → cordage → rope → net.
- **Physics classes.** Every resource derives `materialClass / shapeClass / properties / stateModifiers` from its tags
  (`lib/processing/physics.ts`). Fire warms and scorches what lies beside it, water wets clay and splashes, wind moves
  light things in the open eras — all CSS-driven and idle at rest.
- **Failure feedback** in three kinds: impossible, close (one step off), right material but wrong action — each with its own
  small animation and sound, none of them a recipe.
- **Hints.** Five rungs (vague → property → action → ghost gesture → direct), aware of what the player has already tried,
  with a varying riddle/behaviour form on rung 2 and a "coach" line when the player is stuck.
- **Micro-discoveries** (`lib/processing/insights.ts`): a short "NOTICED …" line the first time a material behaves in a
  telling way. **Discovery tiers** (`lib/discoveryTier.ts`): minor finds get a quick card, major finds (hidden, rare,
  first of an era, a gate opening) get the full reveal.
- **Questions** (`lib/learn/`, `components/QuestionCard.tsx`): a card top-right, first about a minute in, then every 60–120 s
  (never under 45 s). Not a modal; no score, XP or streak; a wrong answer fades and a different question follows; ignored,
  it folds to "?". A right answer may open a technique. 36 questions are asked: each was checked against a source page that could be read (`checked` date) and carries `source` ids
  from `data/sources.json`, a confidence level, and stated uncertainty where scholars disagree. 7 more are written but held
  back (`hold` reason) until their claim is checked; only `checked` questions without `hold` are ever shown.
- **Narrator** (`lib/narrator/`, `components/Narrator.tsx`): a voice per era with a self-drawn line-art portrait
  (Full / Minimal / Off). Priority era > major find > technique > stuck > minor, with cooldowns. Early voices are anonymous
  archetypes; the Observer, Experimenter and Logician are dramatised figures, labelled as such. No quotations anywhere.
- **The world through the ages.** The bench surface follows the era's material world; the graph draws "???" for things you
  could make right now (never for hidden finds).
- Tests: 34 suites, 182 tests, all passing.

## 1.9.0 — 24 September 2026 (unreleased)

### An experimentation world: hands, materials, several things at once
Discovery is no longer only "two things touch". The 322-entry database is untouched; a new
additive layer (`data/processing.json`, `lib/processing/`) sits on top of it and the old pair
routes keep working exactly as before.

- **Five hands.** Brush, Smash, Cut, Separate and Dig work **one** resource. The player performs
  the gesture (sweep, strike, draw a line, pull apart, scoop); a drawn white line-art hand follows the
  pointer, each with its own motion. What a hand can do follows the material's tags: stone smashes
  to a keen edge, wood needs an edge to cut, soil needs something to dig with. Refusals say why
  ("Fibre is one thing all through") and are never a recipe.
- **Tangible results.** Actions are gestures, not inventory. Discoveries that used to be a verb
  (Fishing, Cutting, Sewing, Cooking…) are now the thing they make (Fishing Rod, Stone Knife, Sewing Kit,
  Cooked Meal). Worked forms of a material (Stick, Clay, Soil, Bark…) are held like resources but never counted
  or drawn in the archive.
- **2–5 ingredient recipes.** `Recipe` is now `string[]`; the engine matches by multiset. Early routes stay
  pairs, mid-game routes take three, later four, the largest five. The validator's conflict rule extends to
  "no recipe may be a strict subset of a different result's recipe".
- **Informative failures.** Wrong processing, needs preparation, right idea but more components needed,
  an irrelevant piece, a wrong state: each has its own quiet line beside the things themselves (no boxed
  card). Nothing names a recipe.
- **Five-level hints** (idea → direction → kind of work with the matching hand pulsing → how many
  components → what roles they play), escalating with failures.
- **Physical bench.** Right click (or a long press on touch) puts a piece away: it flies back to its inventory
  entry, which pulses; nothing is deleted. A hard collision that carries a stone, metal or tool into the boundary
  sends it through the wall for a moment before it returns; fibre and liquids never do. Pieces near a
  complete route react, near-complete routes tremble, resources lean toward what they could become.
  Undo, and the bench is remembered for the session.
- **Layout.** The scenery is the workspace with a "work one thing" ground and a "put things together"
  ground (soft patches, not boxes); the hands are a single quiet line.
- **Life.** Every material has its own way of sitting still (stone glints, fibre sways, fire flickers, signals blink);
  clicking a flame, smoke, wheel, star, lamp or boat in the scenery makes it answer; a hairline volume control
  and a very quiet ambience per era (wind, hearth, murmur, forge, machines, mains hum, digital shimmer).
- **Dependencies** brought to the latest releases (Next 16.3.6, React 19.3, Tailwind 4.3.3, framer-motion 13,
  Sentry 11, Jest 30, Vercel Analytics/Speed Insights 2). Two are held one step back on purpose:
  TypeScript stays on 6.0 (typescript-eslint does not support 7 yet) and ESLint on 9.39 (eslint-plugin-react,
  bundled in eslint-config-next, does not run on ESLint 10). Sentry 11 moved `withSentryConfig` to
  `@sentry/nextjs/config` (`next.config.ts`).
- **Tests.** `lib/__tests__/processing.test.ts` (data invariants, actions, hints, failures, saves),
  `lib/craft/__tests__/{gesture,memory,knockout}.test.ts`.

## 1.8.0 — 24 September 2026

### A playable museum: the visual and interaction redesign
The game is the same game. Every route, hint, source and save is untouched
(`lib/engine.ts` was not edited); what changed is how it is staged.

- **Opening.** A cinematic landing ("How did we get here?") with dust that reacts to the cursor
  and a museum-label BEGIN. BEGIN collapses the screen into a point, opens a **time tunnel**
  (three depth layers, real plates of Stone, Spear, Fire, Pottery, Writing, Wheel, Telescope,
  Steam engine, Electric light, Telephone, Computer and Smartphone flying past), a flash, a
  moment of silence, then one rotating Stone: "Begin with almost nothing." The Stone falls onto
  the bench and the interface arrives layer by layer. Returning players get CONTINUE TIMELINE and
  Replay time journey; the film is skippable (click, Esc, Space) and short on phones.
- **Workbench.** Pieces are **artifact cards** with catalogue numbers. Carrying one near another
  draws the resting one toward it and makes both tremble; combining orbits the pair, the rest of
  the table dims, dust gathers, and the impact scales with the tier (about 0.5 s known route,
  about 1.1 s new discovery, about 2.4 s major).
- **Discovery ceremony.** The room darkens; the piece is lifted to the centre with "NEW
  DISCOVERY", its catalogue number counting up (`018 / 322`), name, era, date and an evidence
  line — "Verified evidence · N sources" or "Source needed", from the record, never invented.
  Rising dust, longer for rare finds. Hidden discoveries arrive as `?????????` and resolve
  letter by letter. Tap to fast-forward, tap again to close.
- **Era shift.** Reaching a later era is marked once (never on resume or reset) with the era's
  name and blurb. Seven material accent colours follow the era.
- **Exhibit.** Spotlight and pedestal, sections that read in order, **PATH 01/02…** for every
  recipe computed from the real data (walked routes first, "Trace it back" for the chain behind
  them), "Source unavailable" when a cited source cannot be loaded.
- **Graph.** Hover any find to light its ancestors and descendants and dim the rest; the route
  draws itself in.
- **Archive.** Catalogue cards, staggered in; hidden finds stay `?????????` and unnumbered
  until found; "Source needed" flag on found entries without a verified source.
- **Timeline (new view, key T).** One horizontal rail, era after era, real recorded dates only;
  unfound entries are unnamed ticks, hidden finds are absent until found.
- **Hints.** After a pair that makes nothing the game may say "Something is forming." or "This
  material has more uses than you think." (`lib/near.ts`) — never a name, never a count.
- **HUD and sound.** A small progress ring, animated counters (including routes walked), one
  Sound on/off button. All sound goes through `lib/sound.ts`; nothing plays before a gesture.
- **Keys.** W G A T switch view; `/` search; `?` help (now with an Effects quality switch).
- **Performance.** `lib/perf.ts` picks HIGH / MEDIUM / LOW from the device (or the player's
  choice) and scales every decorative particle count; transform/opacity/canvas only;
  `prefers-reduced-motion` skips the film and replaces motion with fades.
- **Voice.** Loading reads "Recovering timeline…"; failures read "The archive could not be
  recovered." and say that progress is safe on the device. Returning players are greeted with
  "The world remembers."
- Fixed: a hydration mismatch in `ViewVeil` under reduced motion.

## 1.7.0 — 24 September 2026

### Discoveries are made with the hands, not by clicking two things together
- The two craft slots are gone. Items now live on a **physical workbench** (`components/Workbench.tsx`):
  drag, throw and drop them and they carry weight, inertia and bounce. Tap an item in the
  inventory (or drag it in) to put it on the bench; tap **Stone** twice and the second one
  walks over to the first.
- Bringing two things together no longer resolves them. The pair starts a short **process**
  chosen by their materials and by how important the result is: hold, rub and grind, shake,
  stretch or separate, align and rotate into place, wrap, pour, trace a line, link matching
  ends, guide a piece along a channel, keep it inside a ring, hit the beat, strike, stack,
  and assemble a multi-part build with gentle snapping (the cart takes wheels, axle and frame).
- **Hidden difficulty tiers.** Quick finds take about a second, mid-game finds two to four
  steps, and the important milestones ask for five to fifteen seconds of work. A pacing
  governor (`govern()` in `lib/craft/specs.ts`) trims or pads any recipe to fit its tier.
- **Stations.** Fire and metalwork recipes are worked at a hearth, an anvil or a basin that
  lights up on the bench.
- **Never stuck.** Every step has a keyboard route (Space, E, R, mouse wheel, hold), failures
  quietly widen the windows for the next try, and a **Do it for me** button appears after
  22 seconds. An **Instant** switch on the bench restores the old one-touch combine.
- Restrained feedback: squash on impact, dust, sparks, a soft ring on success and a few
  synthesised sounds (mute with the Sound button). Reduced motion is respected.

### What did not change
- `lib/engine.ts` is untouched and still the only authority: the craft layer decides *how* the
  player reaches an answer, `Engine.combine` decides *what* it is. Discoveries, routes, tiers,
  hints and saved progress work exactly as before.
- `app/_design-system.css` is byte-identical to the single-file build; new styles are in
  `app/_craft.css`.

### Tests
- `lib/craft/__tests__`: every one of the 664 recipe pairs is completed by a keyboard-only bot
  and by an ideal-hands pointer bot with no failures, and the pointer bot's times are asserted
  against the tier targets.

## 1.6.0 — 23 September 2026

### Full screen, with the chrome out of the way
- On a desktop the game opens in **full screen** when you press Begin, and a new button in
  the top bar enters and leaves it.
- The **top bar tucks away**: it slides down when the pointer reaches the top edge of the
  screen (or keyboard focus enters it, e.g. with `/`) and hides again when you move away.
  A small handle at the top centre hints that it is there. Phones keep the fixed bar.

### Eleven scene backdrops behind the craft screen
- Engraved line-art landscapes in the same style as the plates (`data/scenes.json`):
  Open Savanna, Night Camp, River Village, First Fields, Ancient City, Trading Harbour,
  Forge Valley, Observatory Hill, Industrial Age, Electric City, Digital Frontier.
- The scene follows the furthest era reached, or pick one with the ‹ › control on the
  bench. Layers drift with the mouse (parallax); clouds drift, grass sways, fires flicker,
  smoke rises, water flows, lights blink. Faded under the centre and the side columns so
  text stays readable; loaded lazily in its own chunk (`components/SceneBackdrop.tsx`).

### Round, animated craft slots
- The two square slots are now **circles**: a tick ring, a counter-rotating dashed orbit, a
  sweeping accent arc and a breathing inner ring. They speed up and light up under a
  dragged item, the placed item floats, a flowing link joins the circles and the + turns as
  they fill. On a combine the circles pull into each other and the + flashes.

### Hover and press animation
- Inventory resources: a light sweep, the icon springs and tilts, the name nudges; pressing
  one sends a ghost of its icon flying in an arc to the circle it lands in.
- Buttons, chips, tabs and the path lift on hover and press in on click; every press
  answers with a ring-and-sparks burst (`lib/fx.ts`). All of it respects reduced motion.

## 1.5.0 — 23 September 2026

### Every discovery has its own drawing
- **322 hand-drawn plates** (`data/art.json`) replace the abstract glyph grammar. Each
  entry is a line illustration of the real thing — a hand axe is a knapped biface, a
  steam engine has boiler, cylinder and flywheel, abstract ideas become a recognisable
  emblem (Law → balance over a tablet, Language → two speakers). No two are alike; a
  test (`lib/__tests__/art.test.ts`) checks coverage, uniqueness and the stroke-only
  grammar. The old primitive grammar in `lib/glyphs.ts` stays only as a fallback.

### The exhibit plate is a 3D object
- **`components/Plate3D.tsx`**: the drawing floats as an extruded wireframe (front and
  back contours joined at the corners; `data-z` groups sit at different depths), bobs
  and sways, and sits in a cloud of drifting particles. Drag with the mouse to spin it
  freely (flick for inertia, double-click to spin, arrow keys on the keyboard, sideways
  swipe on touch). Used on the exhibit panel and the "New discovery" card.
- Canvas 2D with its own perspective projection — no WebGL, no new dependency. Pauses
  when off-screen or in a background tab; honours reduced motion; the flat SVG is the
  server render and the fallback.

### Neon blue theme
- The theme button now cycles **System → Light → Dark → Neon blue**. Neon is a deep
  navy ground with an electric-cyan accent and a restrained glow on the accent rules,
  the active tab and the 3D plate. It lives in `app/_theme-neon.css`, so
  `_design-system.css` stays in sync with the single-file build.

## 1.4.0 — 23 September 2026

A gameplay upgrade, built on the existing engine rather than a rewrite.

### Crafting that can be figured out
- **The graph was mostly unreachable.** 34 ingredient pairs were declared for two to
  five different results, and the engine kept only the last, so a player could reach
  50 of 322 entries. Every pair now yields exactly one result, the nine entries with no
  working recipe have one, and 311 entries have two or more routes
  (`tools/rework_recipes.py`). A test plays the whole graph from the four raw materials,
  tier gates included, on every run.
- **Stone Age tiers** open at 25% of the previous stage (was 50%) and are named as
  gameplay stages, not archaeological periods. A right pair tried too early now says so,
  shows the progress needed, and is offered again when its stage opens.
- **Failure feedback nudges without spoiling**: it says which of the two items still has
  something to give, or that both are used up — never what they make. Repeated pairs
  are recognised.
- **Progressive hints**: a direction, then the idea (the entry's own description with its
  name taken out), then one ingredient — never both. Each level opens only after two more
  tries. The bench offers a nudge by itself after four misses in a row. Hints can be aimed
  at any undiscovered entry that is within reach, from the archive or the graph.
- **Routes are collectable**: reaching something you already have by a new pair is a
  "New route", counted per entry and in the archive.

### Feedback, flow and mobile
- Discovery card with a short spring and ring, slot merge / shake, toasts only for rare,
  hidden, new-route, stage-opened and "you figured it out" moments. Feedback stays until
  the next pair — nothing is taken away on a timer.
- Tap-to-combine everywhere; "Use" puts a result straight back on the bench. Items with
  nothing left to make are struck through and can be hidden. A "within reach" count is
  always visible.
- Onboarding is one line on the bench (tap Stone twice), no modal.
- Phones get their own layout: bench on top, a grid of large tiles below, a bottom nav,
  a bottom-sheet exhibit that opens only when asked, 16px inputs, no horizontal overflow.

### Graph, archive, theme
- Graph: eras wrap into sub-columns, pinch-zoom, zoom buttons, animated camera, a pulse
  on new finds, and tracing of an entry's origins and descendants. Undiscovered entries
  are never named.
- Archive: stage progress, per-era counts, "within reach" and "routes left" filters,
  a personal discovery history, and a pressure-free "Today's find".
- Light, dark and system themes across every screen and the graph canvas, chosen before
  first paint and remembered.
- Search covers your own collection; undiscovered matches are counted, not named.

### Trust
- 85 Stone Age entries carried placeholder text, one false date ("~3 million years ago")
  and a non-existent source id. They now have original descriptions, hedged or
  "not yet sourced" dates, `source_required`, and a gameplay caution
  (`tools/rewrite_placeholders.py`). The validator reports 0 errors.
- Exhibits of undiscovered entries no longer show names, text or recipes; found entries
  show only the routes you have used.

### Removed
- Unwired components from an earlier attempt (HintPanel, MultiRoutesPicker,
  DiscoveryReveal, OnboardingModal, the old ThemeToggle, TierProgressBar,
  `theme-system.css`, `mobile-responsive.css`, `lib/hints.ts`, `lib/multiRoutes.ts`,
  `lib/useSandbox-1.ts`). The last commit that added them did not compile.

## 1.3.0 — 12 September 2026

A pass against a general-purpose 200-point website checklist, keeping only
what applies to a single-page, account-free, static-data game and does not
contradict this project's own stated design or privacy rules.

- **Security headers** (`next.config.ts`): `Content-Security-Policy` (self-only;
  the app never contacts a third-party origin at runtime), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.
  These are headers, not certificates — they take effect once the app is
  deployed behind HTTPS; see "What deployment still has to provide" below.
- **Canonical URLs** on every route (`alternates.canonical` in each page's
  metadata) and two new JSON-LD blocks: `WebSite` in the root layout, `WebApplication`
  on the sandbox itself — in addition to the `FAQPage` schema the 1.1.0 audit
  already added.
- **New `/terms` page**: what the project is, that it carries no warranty, that
  external source links follow their own sites' terms, and the MIT attribution
  for the Vengeance UI components. Linked from the existing method/FAQ/privacy
  footer nav and added to `sitemap.ts`. No business identity, contact address or
  jurisdiction is asserted anywhere — there wasn't one on file to state truthfully.
- **Git**: the delivered tree had no repository. Initialized one so the project
  has version history from here on.

### Deliberately left alone

- **No analytics, tracking pixels, heatmap, or cookie banner.** `/privacy`
  already promises "No analytics, tracking pixels, or advertising identifiers"
  and "No cookies" — adding any of them would make that page false. If
  first-party analytics is wanted later, it should ship alongside a rewrite of
  that page, not as a silent addition to it.
- **The colour tokens in `app/globals.css`.** `--color-bone-4` (`#474441` on
  `#0a0a0b`) sits at roughly 2:1 contrast — well under the 4.5:1 WCAG AA
  minimum for normal text — and it is used for more than decoration: the
  eyebrow label above every page title, and the archive's table headers. It
  reads as a deliberate "quiet secondary label" choice from the audited 1.1.0
  design, not an oversight, so it wasn't changed without design sign-off; it's
  worth a conscious decision either way.
- **Contact / About Us page.** Nothing on file states who or what entity is
  behind this project, and inventing an address or email would violate the
  project's own no-invented-data rule. Add `/about` once there's a real answer
  to "who is publishing this."

### What deployment still has to provide

Not achievable by editing files in this repository — they need a live server,
domain, or third-party account: the SSL certificate itself, a CDN, HTTP/2 or
HTTP/3 (both are the hosting layer's job — Vercel provides all three by
default), actual Gzip/Brotli negotiation, a real TTFB measurement, uptime
monitoring, Google Search Console / Analytics enrollment, and A/B testing
infrastructure. The code changes above (headers, canonical tags, schema) are
already in place and will take effect the moment the site is live; they do
nothing while the project only exists as this source tree.

## 1.2.0 — 12 September 2026

Merged in a second Next.js export (a same-day re-port from the HTML artifact)
that had drifted from this 1.1.0 codebase: it carried four new, properly
sourced discoveries but had regressed the Vengeance UI integration, the FAQ
/ method / privacy pages, the split `data/nodes/*.json` + tooling, and the
CHANGELOG itself. This release keeps the 1.1.0 codebase as the base and
ports across only the genuine data additions, verified against it.

### Data

- **Four new discoveries**, era `trade` (new — inserted after `civilization`):
  **Standardized Weights & Measures** (#217), **Banking** (#218),
  **Double-Entry Bookkeeping** (#219), **Long-Distance Caravan Trade** (#220).
  Each cites at least one subject-level source (Penn Museum, Encyclopaedia
  Britannica, ICAEW, British Museum) fetched and checked on 12 September 2026;
  none needs `source_required`. Added as `data/nodes/g7.json`; nothing in
  `g1`–`g6` moved.
- **Four new sources** in `data/sources.json`: `penn_weights`, `brit_bank`,
  `icaew_pacioli`, `bm_silkroads`.
- **Three existing recipes gained an alternate path**: `cordage` (+ stone ×
  fibre), `fishing` (+ bone × fibre), `spear` (+ wood × bone) — extra ways to
  reach early tools, not new endpoints.
- Totals: 220 nodes (204 core, 16 hidden, still 67 `source_required`), 71
  sources (59 topic-level, 12 general). Grand Theft Auto VI is unaffected:
  still depth 35, still a 101-craft minimum — the new branch is additive and
  does not sit on its path.
- `tools/validate.py` and `tools/build_db.py` both learned the `trade` era;
  the three new leaf discoveries were added to validate.py's `ENDPOINTS` so
  the dead-end check (`W3`) does not fire on them, matching how the project
  already treats other legitimate terminal nodes (`gps`, `virtual_world`).
  `data/db.json` was regenerated from the tools — `dataHash`, `depth`, `need`
  and `uses` are all freshly derived, never hand-edited.
- All copy that quoted the discovery count (`README.md`, `app/layout.tsx`,
  `app/method`, `app/faq`, `app/not-found.tsx`, `package.json`,
  `lib/types.ts`) updated from 216/200 to 220/204.

### Not carried over from the drifted export

Everything else in that export was either an inferior mechanical re-port of
code this codebase already had in a more finished form (a `@ts-nocheck`
functional `engine.ts`/`glyphs.ts` vs. this codebase's typed, class-based,
`useSyncExternalStore` versions — see 1.1.0 above), or simply missing
(Vengeance UI, the FAQ/method/privacy pages, the Python data tooling, this
changelog). None of it was ported.

### Known follow-up

This merge only had the two Next.js exports to work from — not the sibling
single-file HTML edition (`../evolution-sandbox/`) that `data:sync` /
`data:check` normally keep in step with this one. The four new discoveries
and three new recipes above should be backported into that project's data
by hand (or regenerated there) the next time it's available, or the two
editions will disagree on what's discoverable.

## 1.1.0 — 11 September 2026

An audit of the 9 September build, then fixes for everything it found.

### Data and sources

- **Sources are now graded, and the honesty rule is enforced.** Each source has a
  `scope`: `topic` (a page about the subject or its field) or `general` (a
  homepage, portal, collection search or index). 88 entries had been citing only
  general pages — 91 counting three whose one specific citation was off-topic —
  while the interface said "Every claim carries its evidence and its source",
  and none used the `source_required` flag the project's own rule called for.
- **28 new subject-level sources**, each fetched and checked against the entry's
  claims on 11 September 2026 — among them UNESCO, WHO, NASA, GPS.gov, the Nobel
  Foundation, the Smithsonian's 1903 Wright Flyer record, IEEE milestones, the
  Corning Museum of Glass, the American Chemical Society, and two peer-reviewed
  papers (*Nature* 2009 on the Swabian Jura flutes; *Living Reviews in
  Relativity* 2003 on GPS relativity). They cover the 14 hidden finds that had
  none, and computer, integrated circuit, microprocessor, vacuum tube, radio,
  telegraph, telephone, flight, artificial intelligence and smartphone.
- **67 entries are now marked `source_required`** (91 − 24); the archive has a
  filter for them. Four citations that did not cover their entry were removed
  (cinema ← a computer-graphics timeline; photography ← electric lighting; data
  and virtual city ← urbanisation data).
- All 39 existing URLs re-checked. The Met's Uruk essay moved to its current
  address, same essay.
- **Grand Theft Auto VI** is rated *rare*: it is one of the 200 core entries but
  had the rarity *hidden*, so its exhibit said "Hidden find" while the counters
  treated it as core. Its release date (19 November 2026) was re-verified against
  Take-Two's fiscal Q1 2027 results of 7 August 2026, now cited.
- Three texts aligned with their sources: **music** (the flutes are more than
  35,000 years old; UNESCO places the region's finds at 43,000–33,000 years),
  **glass** (≈ 4,000 years ago, not 3,500), **compass** (navigational use in the
  12th century; the contested Han-dynasty claim dropped).

### Tools

- `validate.py`: new checks — rarity vs hidden flag (E9), general-only sources
  without `source_required` (E10), malformed registry entries (E11), duplicate
  flags (E12), flag alongside a real source (W4), uncited sources (W5). UTF-8
  output so the report prints on a Windows console.
- `build_db.py`: adds `dataHash` (fingerprint of the authored data),
  `sourcesChecked` and `counts.sourceRequired`; escapes `</` in `db.js` so data
  text can never close the inline script.
- `build_artifact.py`: the check for a stray `</script>` or `</style>` in the
  injected files was dead code; it now fails the build, and a missing
  `build/db.js` gives a clear message.
- `patch_recipes.py`: safe to re-run — already-applied patches are skipped.
- `test_artifact.js`: no hard-coded browser path; 12 scenarios instead of 9,
  covering every fix below.

### Single-file edition

- **Exhibits opened from the graph or the archive were invisible** — the panel
  lived inside the hidden workspace view. It is now a column beside the bench,
  a drawer over the graph and the archive (with a close button and focus
  handling), and a full-width sheet on a phone.
- **"Start over" works in sandboxed frames.** `window.confirm()` is silently
  blocked there (the Artifact host is one), which left the button dead; it now
  asks in the page, keyboard-accessible.
- **Search results are clickable in every view.** The top bar now sits above
  the views; its dropdown had been painted under the graph canvas.
- The graph repaints only when something changes, instead of 60 times a second.
- The phone menu button is hidden on desktop by the stylesheet rather than an
  inline style, and the sheet's grab handle is hidden on desktop too.
- The search box shows its `/` shortcut; the archive footnote shows the date the
  sources were last checked.

### Next.js edition

- **Hydration no longer fails for returning players.** Saved progress was read
  during the first render, so the browser's markup never matched the server's.
  The engine is now an external store read with `useSyncExternalStore`, and
  progress loads after hydration.
- **Vengeance UI is actually used**: `AnimatedNumber` (top-bar counter),
  `StatsCounter` (archive), `Kbd` (search hint), `LineHoverLink` (page links),
  `FaqAccordion` (FAQ) — copied from the registry under MIT, restyled onto the
  project's tokens, each change listed in its header. framer-motion, previously
  an unused dependency, now drives two of them, pinned to the major version
  upstream uses (12.x).
- **Tailwind carries this app's own pages**; the shared design system moved into
  Tailwind's `components` layer, where its `button { padding: 0 }`-style resets
  no longer override utilities.
- **FAQ structured data fixed** — every JSON-LD answer was the question repeated.
  The FAQ's lens/telescope sentence now matches the graph.
- **Linting works again**: Next.js 16 removed `next lint`; ESLint 9 with
  `eslint-config-next` in a flat config.
- **No placeholder domain.** The site URL comes from `NEXT_PUBLIC_SITE_URL`
  (see `.env.example`), then Vercel's production domain, then localhost.
- Fonts via `next/font`, self-hosted: visitors' browsers no longer contact Google.
- Parity with the single-file edition: the same exhibit drawer, in-page reset
  confirmation, `/` shortcut, desktop-hidden menu button, idle graph and
  non-passive wheel zoom; "See the whole path" filters and frames the graph;
  clearing the first slot slides the second across instead of duplicating it.
- `npm run data:sync` / `data:check` keep data, tools and stylesheet identical
  to the canonical project; the Python tools run through `tools/py.mjs`, and
  `data:build` no longer shells out to `cp`, so all scripts work on Windows.

### Not verified here

The Next.js app could not be installed or built in the environment where these
fixes were made (the package registry was unreachable). Its components were
exercised instead through a harness: server-rendered and hydrated by React 19 in
Chromium, with `next/link` and framer-motion replaced by minimal stand-ins and
Tailwind compiled by a local Tailwind 3 — 13 scenarios, including the
returning-player hydration case that fails on the 1.0 code. Run
`npm install && npm run typecheck && npm run lint && npm run build` once on a
machine with network access to confirm.
