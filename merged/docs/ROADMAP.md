# Evolution Sandbox — Next Major Development Roadmap

This is the standing development brief for the game, kept in the repo so it
survives between sessions instead of living only in chat history. It sets
the long-term direction and the order of work. **Do not implement everything
at once** — follow the phase order at the bottom, protect what already
works, and extend existing systems rather than rebuilding them.

Status notes (marked `[status: ...]`) were added 25 September 2026 by
auditing the actual code against this brief, so future sessions do not
duplicate work. Re-check and update them as phases land — do not let this
section go stale.

---

## Status audit (25 September 2026)

The game already implements most of P0–P3 in some form; the CHANGELOG
(`merged/CHANGELOG.md`, versions 1.4.0–1.11.0) records this same phase
numbering already driving development, so this brief is a continuation of
work already in progress, not a fresh start.

| Phase | State | Notes |
|---|---|---|
| P0 Protect the core | **Ongoing** | Action Rail keeps the middle of the screen for play; folds to a tab. Dead/orphaned components from an earlier merge (`HintPanel`, `MultiRoutesPicker`, `DiscoveryReveal`, `OnboardingModal`, `TierProgressBar`, `lib/hints.ts`, `lib/multiRoutes.ts`, `lib/useSandbox-1.ts`) were unreferenced anywhere in the app and removed 25 Sept 2026 — they predate the 1.4.0 cleanup that was supposed to delete them and were resurrected by the repo merge. |
| P1.1 Physical interaction | **Built** | 25 techniques, each a real gesture (`lib/craft/gesture.ts`): sweep, strike, draw a line, pull apart, scoop, go round, hold. Keyboard/Instant alternatives kept. |
| P1.2 Action discovery through behaviour | **Not started — architecture checked, needs a decision** | See "P1.2 design note" below: the natural free-form-rubbing framing in the brief doesn't map onto either existing input pathway without a real design choice. Flagged for the user rather than guessed. |
| P1.3 Better physical failure | **Built** | Three kinds of "no" (impossible/close/wrong-action), each with its own animation and sound (1.10.0); brittle materials crack and eventually break under repeated hard impact via `Body.wear` (1.11.0, cosmetic only, per the brief). |
| P1.4 Sacred major discoveries | **Built** | Discovery tiers (`lib/discoveryTier.ts`) distinguish minor finds (quick card) from major ones (full ceremony: `components/fx/CeremonyStage.tsx`, `DiscoveryCeremony.tsx`). |
| P1.5 Interactive historical moments | **Not started** | No mini-playable moments (protect-the-flame, open-the-valve, etc.) yet. |
| P2.1 Discovery-driven world changes | **Partially built, extended 25 Sept** | Scenery was purely `era → background` (`components/SceneBackdrop.tsx`, one of 11 fixed SVGs picked by furthest era). A first discovery-driven overlay layer was added on top (see below) as a proof of the mechanism; only one example is wired up — the rest of the P2.1 list is real future work, not a placeholder. |
| P2.2–P2.3 Living civilization / consequences | **Not started as continuous accumulation** | Scenes are still one image per era, not elements that accumulate. Environment states, temperature/moisture, wind already exist per-material (`lib/craft/world.ts`, `app/_physics.css`). |
| P2.4 Tradeoff system | **Not started** | No FOOD/ENERGY/PRODUCTION/etc. dimensions tracked yet. |
| P2.5 Component assembly | **Built** | `Engine.combineMany` / `multiKey`, bench-side clustering, 2–5 ingredient recipes (1.9.0–1.11.0). |
| P2.8 Regional/independent-invention notes | **Deliberately deferred** (per 1.11.0 changelog: a large data-authoring pass). |
| P3.1 Shareable discovery cards | **Built, basic** | Web Share API / clipboard (1.11.0). Not yet the full visual card (artwork + era + achievement context) the brief describes. |
| P3.2 Player journal | **Built, basic** | First discovery, deepest reached, most-used technique, % without hint (1.11.0). Most of the extended stat list (hardest discovery, most-failed experiment, chronological "Your Civilization" history, etc.) is not yet there. |
| P3.3 Daily/weekly challenges | **Partially built** | "Today's find" exists (`lib/daily.ts`, date-seeded, no streaks). No weekly challenges yet. |
| P3.4 Mystery objectives | **Not started.** |
| P4 Property-driven crafting | **Foundations exist, not the capability system** | `lib/processing/physics.ts` already derives `materialClass`/`shapeClass`/`properties`/`stateModifiers` from tags. Tool capability *derived* from properties (P4.2), property inheritance through transforms (P4.3), and generic transformation (P4.4) are not built — techniques are still authored, not derived. |
| P4.5–P4.7 Component logic / invention recognition / tool performance | **Not started.** |
| P5 Civilization branching | **Not started.** |
| P6 World map as memory | **Partially built** | Archive, Timeline, Graph and World are separate, working views; cross-view selection context (P6.2) is not wired. |
| P7 Narrator memory / adaptive education | **Not started** | Narrator (`lib/narrator/narrator.ts`) has priority + cooldown but no memory of specific past player behaviour; no ask-a-question interaction; no generated question pipeline. |
| P8 Procedural invention recognition | **Not started** — correctly gated behind P4–P7 per the brief. |
| P9 Advanced replayability | **Not started** — correctly gated behind everything else. |

### P1.2 design note (needs a decision before building)

The brief's flavour examples ("rub a hard object against an abrasive
material" → Grind discovered) describe **two bodies in contact**. The game
has two genuinely different input pathways today and neither is a clean fit
as-is:

1. **Single-body hand gestures** (`components/Workbench.tsx`, `startAct`) —
   the only pathway that runs `Gesture` (brush/smash/cut/separate/dig/
   circle/hold). It requires `mode` (a technique) to already be selected
   from the Action Rail, and **unknown techniques are not selectable** — so
   there is no gesture to recognise before the technique is already known.
2. **Two-body combine** (`lib/craft/session.ts`, `CraftSession`) — starts
   only once the engine has already validated the pair as a real recipe;
   dragging two arbitrary bodies together does not open a free-form rub/
   strike minigame on its own.

A safe, additive design that fits the existing architecture: while `mode`
is null and the player is dragging a single body, watch the raw pointer
motion (independent of the body's physical carry) for a recognisable
oscillation/rotation/stroke pattern; when it resembles a *kind* the player
could already perform (i.e. an unknown technique whose `ruleHolds` already
passes for what they're holding), reveal it exactly like the existing
`isNewTech` reveal. This reuses `Gesture`'s geometry rather than
duplicating it, and never runs the risk described in P0 of changing how
the main crafting loop feels to play. Confirm this framing (or propose an
alternative) before it touches `Workbench.tsx`'s pointer state machine —
that file drives the entire primary interaction loop.

---

## Core product direction

Evolution Sandbox should become: **a playable simulation of how humans
transform materials, invent tools, develop technology, and gradually
reshape civilization.**

The player should not feel like they are solving a database of recipes.
They should feel like they are experimenting with a physical world.

The long-term loop:

```
Observe → Think → Manipulate → See material react → Understand a property
→ Experiment again → Discover → Change the world → Unlock new possibilities
```

---

## P0 — Protect and polish the existing core

Do not add advanced systems if they make the current crafting worse. The
primary screen stays the physical sandbox.

Target: **80–90% visual attention = world + resources + physical
interaction.** Archive, Graph, Timeline, Journal, World Progress, Hints and
Information stay contextual. Never let the HUD overwhelm the sandbox.

## P1 — Make invention feel physical

### P1.1 — Continue moving away from recipe-like interaction

Push physical action further. The player should feel *"I performed a
process"*, not *"I selected an action button."* Examples: grinding (drag
repeatedly against an abrasive surface), carving (hold an edge against wood
and move along it), cutting (edge contact + directional movement +
sufficient sharpness), hammering (repeated high-velocity impacts), heating
(move near a heat source and maintain exposure). Keep accessible
alternatives (buttons, keyboard) — physical interaction is the primary
experience, not the only one.

### P1.2 — Action discovery through behaviour

Some techniques should eventually be discovered through player behaviour,
not by holding the right materials. Example: the player repeatedly rubs a
hard object against an abrasive material; the game notices and reveals
**GRIND**. Other candidates: repeated sliding edge → Scrape, rotational
fibre movement → Twist, repeated impact → Hammer, long pressure along wood
→ Carve. Use deterministic gesture detection — never AI — to recognise
basic physical actions.

### P1.3 — Better physical failure

Failure should always teach something; never "nothing happened." Show
material behaviour: the edge bends, the material cracks before cutting, not
enough heat, the fibres separate instead of binding, the material is too
soft to strike effectively. Prefer showing this physically (bend, fracture,
bounce, scorch, deform, stretch, slip, chip, vibrate, absorb, melt) over
text. Failure should create curiosity.

### P1.4 — Sacred major discoveries

Minor discoveries stay fast, responsive, minimal interruption. Major
discoveries (Controlled Fire, Agriculture, Pottery, Writing, Wheel, Bronze,
Iron, Printing, Steam Engine, Electricity, Computer, Internet) get: time
slowing, ambient audio fading, UI retreating, the object becoming central,
deliberate camera movement, a slowly appearing name, historical context,
then a world-location reveal. Keep this rare — not every item is cinematic.

### P1.5 — Interactive historical moments

For civilization-changing inventions, occasionally replace the normal
discovery screen with a tiny (5–15 second) playable moment: protecting a
flame from wind (Fire), placing the first cultivated seeds (Agriculture),
removing a fired vessel from heat (Pottery), completing a connection and
watching the environment light up (Electricity), opening a valve on a large
machine (Steam Power), completing a logical circuit as the environment
shifts from mechanical to informational (Computing). Keep these extremely
short — this is not a cutscene system.

## P2 — World evolution

### P2.1 — Discovery-driven world changes

Move the existing era-based backgrounds gradually from `ERA → background`
toward `DISCOVERIES → world state`. Fire discovered: campfire appears,
night lighting changes, smoke becomes visible. Shelter: first shelter
appears. Cordage: hanging/tied structures. Agriculture: cultivated patches.
Pottery: storage vessels. Construction: buildings improve. Roads: movement
paths appear. Metallurgy: forge appears. Industry: machinery, chimneys,
denser settlement. Electricity: wires, lamps, night illumination.
Computing: screens, digital signals, information layers. The world should
visually remember what the player invented.

### P2.2 — Living civilization development

Extend the existing scenes into a continuous civilization:
wilderness → temporary camp → permanent camp → settlement → village → town
→ city → industrial city → electric city → modern metropolis → digital
civilization. Elements should gradually accumulate (first hut → several
huts → paths → fields → storage → workshop → road → market → walls → dense
buildings), not simply swap one background image for another. The player
should occasionally recognise an old structure that has evolved over
thousands of years.

### P2.3 — World consequences

Technology should visibly affect the environment — agriculture adds fields
and food production but reduces wild vegetation; industry adds machines,
production and transport but also smoke and environmental pressure;
electricity adds light, machines and communications; urbanization adds
density and infrastructure but reduces open land. Present systems and
tradeoffs, never "technology good/bad."

### P2.4 — Technological tradeoff system

Start simple: a few understandable civilization dimensions (Food, Energy,
Production, Population, Environment, Knowledge, Mobility). Agriculture:
Food Stability up, Population Capacity up, Wild Ecosystem down slightly.
Coal industry: Production up-up, Energy up-up, Air Quality down. Writing:
Knowledge Preservation up-up, Administration up. Roads: Mobility up, Trade
up, Land Use up. Explain consequences, don't judge them. Most consequences
should be visible in the world first — no spreadsheets.

### P2.5 — The world should remember

Old discoveries stay visually represented. In the Industrial Era the player
should still be able to find fire, roads, agriculture, pottery, written
language, metal, shipping inside the world. Technology layers historically
rather than replacing everything before it.

## P3 — Personal engagement

No classroom systems for now.

### P3.1 — Upgrade shareable discovery

Extend the existing basic share system into attractive visual cards:
discovery artwork, name, historical era, optional achievement context,
Evolution Sandbox identity. Allow copy / share / save image. Sharing is
always player-initiated — never interrupt the player to ask them to share.

### P3.2 — Expand player journal

Beyond the current First Discovery / Deepest Reached / Most-used Technique
/ Discovered Without Hint / Routes Walked: Hardest Discovery (by failed
attempts), Most Used Material, Most Experimented Material, Most Failed
Experiment, Longest Discovery Chain, Discovered Without Hint %, Discovered
With Only Vague Hint %, Rare Discoveries, Hidden Discoveries, Total
Experiments, Total Physical Actions. Also a chronological personal history
("Your Civilization") — the archaeological record of the player's own
playthrough, not a generic stats screen.

### P3.3 — Real daily/weekly challenges

Turn the existing daily-selection foundation into real optional challenges:
"Discover something using only 4 starting materials," "Reach Cordage
without opening a direct hint," "Create Pottery using fewer than 8
actions," "Discover something involving heat." Weekly challenges can be
larger (e.g. build a complete chain: Fibre → Strands → Cordage → Rope →
Net). No streak punishment, no "37 DAY STREAK — RETURN NOW." Missing a day
has zero negative consequence.

### P3.4 — Mystery objectives

Give human problems instead of checklist language: "Night is dangerous,"
"Food disappears quickly," "Your hands cannot cut this," "Something heavy
needs to move," "The river blocks your path," "The harvest cannot survive
the winter." The player should think "what could solve this?" not "what
recipe is the game asking for?"

## P4 — Systemic sandbox

The biggest technical evolution. Do not replace the existing recipe engine
— build this gradually alongside it.

### P4.1 — Property-based action requirements

Move from manually declaring "Sharp Stone is an edged tool" toward deriving
capability from properties: `sharpness`, `hardness`, `rigidity`, `geometry`
→ `CUTTING CAPABILITY`. E.g. `sharpness > threshold AND rigidity >
threshold → can cut soft material`; `hard + heavy + impact geometry →
hammering capability`; `abrasive + hard + relative sliding → grinding
capability`.

### P4.2 — Tool function from properties

Stop thinking "AXE = CAN CHOP"; think "sharp + rigid + weighted + handled →
effective chopping tool." A badly built axe cuts slowly, breaks easily,
bounces; a well-built one cuts efficiently, transfers more energy, lasts
longer. Makes tool design meaningful.

### P4.3 — Property inheritance

When materials transform, useful properties should persist or change
logically (ore → crushed ore → molten metal → cast metal → sharpened blade,
each step modifying properties rather than only changing an item ID).

### P4.4 — Generic material transformation

Eventually let interactions transform any compatible material via a
generic rule (`CUT requires: sharp tool + cuttable target`, with target
properties determining the result — cut, split, shaved, crushed,
flattened, heated, burned, wet, dried, polished) instead of separate
hard-coded rules per material pair. Deterministic, not AI-guessed.

### P4.5 — Component logic

Functional components (blade, handle, cord, axle, wheel, container, frame,
joint, lever, spring, gear, surface) that combine into capabilities: sharp
component + handle → handled cutting tool; wheel + axle → rotating
assembly; rotating assembly + platform → primitive vehicle structure. This
sits underneath named inventions.

### P4.6 — Invention recognition

Once component logic is reliable, recognise what the player built from
components even before it matches a named invention (2 wheels + axle +
platform → "VEHICLE-LIKE DEVICE," and if it matches historical criteria
strongly enough → "CART"). Deterministic scoring, never freeform AI as the
authority.

### P4.7 — Tool performance

Different constructions should behave differently (force, precision,
speed, durability, efficiency, control) — two axes built differently
should not perform identically. Keep this lightweight initially.

## P5 — Civilization depth

### P5.1 — Technological branching

Let civilizations emphasize different directions (agriculture → population
→ construction → infrastructure; or navigation → ships → trade → mapping;
or materials → metallurgy → mechanics → engineering) without becoming rigid
skill trees — players should still cross between branches. Recognise what
the player prioritized rather than forcing a faction choice.

### P5.2 — Civilization identity

At the end of an era, summarize how the player's civilization developed —
strongest development, unusual strengths, what was discovered before what.
Never say "correct" or "incorrect" history; say "your path differs from the
broad historical sequence." Encourages replay.

### P5.3 — Alternative technology routes

Add more historically/plausibly grounded alternate routes to discoveries —
several cutting tools may solve the same task, several fuels may provide
heat, different containers may solve storage. Avoid "one recipe = one
correct answer"; ask "does this solution logically work?"

## P6 — World map as the civilization memory

Expand the existing globe system instead of replacing it.

### P6.1 — World journey

Every major discovery becomes a point in the player's historical journey.
The globe shows where/when/what/why it mattered. Selecting a discovery can
show its historical period, region/multiple centres, how the player
discovered it, what it unlocked, what later inventions depended on it.

### P6.2 — Connect Graph + Timeline + World

Graph, Archive, Timeline and World should increasingly behave like views of
one underlying system — selecting an object should allow transitions
between Object / Graph / Timeline / World / Archive views while keeping
selection/context across them. Keep the views separate; don't merge into
one cluttered UI.

### P6.3 — Journey zoom

Long-term: crafting world → zoom out → civilization → zoom out → Earth →
zoom out → Timeline/technology graph, and the reverse (Timeline → invention
→ region → civilization → object). Use sparingly — the goal is every scale
feeling connected.

## P7 — AI / adaptive systems

Only after deterministic systems work.

### P7.1 — Narrator memory

Extend the narrator with meaningful memory of gameplay facts: repeated
failed technique, resource experimented with often, discovery made
unusually early, discovery made without hint, long unresolved objective.
Example: player repeatedly smashed Wood; later Carve becomes available;
narrator says "You tried force before. An edge may answer differently."
Log only useful gameplay facts, not everything.

### P7.2 — Narrator conversation

Let the player deliberately ask: "Why didn't this work?" / "What did I
just learn?" / "What should I investigate?" / "Why was this invention
important?" / "What property matters here?" The narrator answers only from
verified game database + player state + known recipes + material
properties + historical sources. Never invents a recipe; never reveals the
exact solution unless the player explicitly asks for a direct answer.

### P7.3 — Keep dynamic hints deterministic

Do not replace the hint system with AI. Continue building hints from player
inventory, known actions, actions already tried, material properties,
current era, valid available routes, failed attempts. AI may rewrite tone
later; it must never decide whether a recipe exists.

### P7.4 — Generated educational questions

Keep the manually-written, fact-checked questions as the highest quality.
Later, generate variants from structured verified facts only (never from
nothing): verified fact → question template → answer choices → validation
→ display.

## P8 — Procedural invention system

The moonshot. Only begin once property system, component system, physics,
tool capability and material transformation (P4) are robust.

### P8.1 — Structural invention evaluator

Evaluate constructions based on materials, geometry, connections,
components, movement, force, energy source, properties (e.g. a rotating
circular component + axle + load-bearing frame may qualify as a "wheeled
transport structure").

### P8.2 — Unknown but valid creations

Do not reject a player construction automatically just because it has no
historical name. Show it as an "UNNAMED DEVICE" with its properties (e.g.
rotates, transfers force, reduces friction); if it later satisfies a known
invention definition, surface the discovery (e.g. BEARING).

## P9 — Replayability

Only after the core systemic game is strong: alternate civilization runs,
no-direct-hint run, limited-material run, historical-sequence challenge,
minimum-actions challenge, experimental run, daily/weekly challenge, hidden
discovery hunting. No competitive leaderboards yet — the main motivation
stays curiosity, experimentation, mastery, discovery.

---

## Important technical rule

Move gradually from **AUTHORED RECIPES** toward **AUTHORED RECIPES +
PHYSICAL PROPERTIES + COMPONENT LOGIC + BEHAVIOUR RECOGNITION**. Do not
suddenly replace the recipe engine. Safe architecture:

```
LAYER 1  Known authored invention recipes
LAYER 2  Generic material transformations
LAYER 3  Property-driven tool capability
LAYER 4  Component recognition
LAYER 5  Procedural invention recognition
```

Each layer should work even if later layers fail.

## Important UX rule

Never expose engine complexity to the player. Internally the game may
compute `hardness = 0.82`, `edgeSharpness = 0.74`, `rigidity = 0.91`,
`impactEnergy = 42`. The player should experience "The edge bites into the
wood" or "The stone is too soft." Show behaviour, not numbers.

## Important educational rule

Teach through consequence. Prefer "player heats wet clay; it cracks" over a
text block explaining that wet clay cracks when fired. Order: experience →
observation → explanation, never paragraph → instruction → button.

## Important design rule

More systems is not automatically a better game. Prefer one material with
excellent physical behaviour over 50 materials that behave identically;
prefer one powerful systemic rule over 30 exceptions.

## Development check before every feature

1. Does an existing system already solve part of this?
2. Can this become a reusable rule instead of another hard-coded exception?
3. Does it make experimentation more interesting?
4. Does the player understand the result through behaviour?
5. Does it make historical/technical relationships clearer?
6. Does it create another meaningful decision?
7. Does it create unnecessary UI?
8. Does it hurt mobile performance?
9. Does it make future systemic crafting easier?
10. Would the game still be fun if all explanatory text disappeared?

If the answer to #10 is no, improve the interaction first.

## Current implementation order

```
P0  Protect existing core
 ↓
P1  Improve physical interaction
 ↓
P2  Make discoveries continuously reshape the world
 ↓
P3  Personal journal / sharing / challenges / mysteries
 ↓
P4  Property-driven crafting and tool behaviour
 ↓
P5  Civilization branching and technological tradeoffs
 ↓
P6  Connect world map, timeline, graph and player journey
 ↓
P7  Narrator memory and adaptive education
 ↓
P8  Procedural invention recognition
 ↓
P9  Advanced replayability
```

The most important transition this brief exists to drive:

**Current** — I know the recipe. I make the item.
**Target** — I understand the material. I try something. The world
reacts. I realize why it works. I invent something.

That should define every future Evolution Sandbox feature.
