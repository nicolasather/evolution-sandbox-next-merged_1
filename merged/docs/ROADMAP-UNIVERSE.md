# Evolution Sandbox — Multi-Mode Universe Roadmap

This is the standing brief for turning Evolution Sandbox from one crafting
game into a **historical discovery universe**: several fundamentally
different games (Survival, Civilization, Archaeologist, Historical Escape
Room, Decipher, Alien Archaeology, plus challenge variants like Reverse
Evolution and Minimum Path) sharing one coherent database of discoveries,
artifacts, technologies, eras, geography and historical knowledge — entered
through a Mode Hub, with **Main Evolution remaining the canonical,
unchanged, chronological discovery sandbox** at the center.

It is deliberately a separate document from `docs/ROADMAP.md` (Main
Evolution's own mechanics roadmap, P0–P9) and `docs/ROADMAP-IMMERSIVE.md`
(the visual/interaction brief). Those two describe deepening the *existing*
single game and are still the right plan for that game — nothing here
overrides them. This document describes the *additional* universe being
built around it. Read the relevant one for the layer you're touching; if a
change affects both (e.g. Main Evolution's planned Trade Routes /
Knowledge Transfer / Lost Knowledge integrations, which are additions to
`docs/ROADMAP.md`'s P2/P5/P6 territory but are specified here because they
were requested as part of this universe expansion), it's noted in both.

**Do not implement every mode at once.** The full brief this document
summarizes describes seven-plus standalone games, each explicitly required
to have ~70–80% unique moment-to-moment gameplay from the others and from
Main Evolution. That is realistically many months of work. Follow the
phase order below; each phase should be a complete, working, non-placeholder
slice before the next begins. Never ship a mode as an empty "coming soon"
card — either it's real enough to play, or it isn't in the Hub yet.

---

## Status (28 September 2026, updated same day through Phase 7)

| Phase | State | Notes |
|---|---|---|
| **1. Shared architecture + Mode Hub** | **Built** | See below. Main Evolution's own save, engine and UI are untouched. |
| 2. Research Notebook + Museum data model | **Notebook has a real store + one screen now; Museum is still types only** | `lib/notebook/store.ts` (versioned, tested) went in as part of Phase 3, driven by the Heat Treatment Experiment Workspace. `lib/museum/types.ts` remains unused — no exhibit screen yet. |
| 3. Main Evolution integrations (Trade Routes, Lost Knowledge, Experimentation) | **Built, narrower than first sketched — see below** | Region-gating on new discoveries (not a graduated Knowledge Transfer state), a resilience scorer (warnings only, no removal), one Experiment Workspace slice. All behind opt-in, off by default; verified not to change default behaviour (full existing test suite + a fresh `Engine` with no options passed still behaves identically). |
| 4. Museum shell + automatic artifact pipeline | **Built** | See below. |
| 5. Minimum Path, Daily framework, Tech Sudoku | **Minimum Path and Tech Sudoku built; Daily/Weekly framework still just `lib/daily.ts`** | See below. `lib/daily.ts` ("Today's find") was not migrated onto `lib/seed.ts` this pass — still open, low-risk work. No Weekly Mega Challenge scaffold yet. |
| 6. Survival vertical slice | **Built — first mode that is a genuinely different game, not Main Evolution with new restrictions** | See below. `components/AppRoot.tsx` is the real top-level mode switch this required. |
| 7. Civilization vertical slice | **Built — a second genuinely different game, allocation-based rather than spatial/task-based like Survival** | See below. |
| 8. Archaeologist vertical slice | **Not started** | |
| 9. Decipher (authored tutorial + beginner procedural generator) | **Not started** | |
| 10. One authored Historical Escape Room episode | **Not started** | |
| 11. Alien Archaeology | **Not started** — correctly gated behind 8–10 (shares their evidence/procedural-generation architecture). | |
| Reverse Evolution, Minimum Path variants | Can proceed in parallel with 6–11 once phase 5's graph-edge validation exists. | |

### What "Phase 1" actually built

Nothing here changes how Main Evolution plays, saves, or looks by default.
Every new module is additive and currently unreferenced by anything except
the one new Hub button.

- **`lib/seed.ts`** — a reusable deterministic RNG (`createRng`, `dailyRng`,
  `weeklyRng`, `hashString`). Every future daily/weekly challenge and
  procedural generator (archaeological sites, alien ruins, decipherment
  scripts) should derive its randomness from this, never from scattered
  `Math.random()` calls in UI code. `lib/daily.ts`'s existing "Today's
  find" pre-dates this and still uses its own scheme; migrating it is part
  of Phase 5, not this pass — don't duplicate that migration ad hoc
  elsewhere first.
- **`lib/save/`** — a generic, tested, versioned migration runner
  (`runMigrations`) for *new* persisted stores. It deliberately does **not**
  replace `lib/engine.ts`'s existing save/load — that save already has a
  working, additive-optional-field migration story (`v: 5` today,
  documented in its `Saved` interface) and touching it was flagged in
  `docs/ROADMAP.md` as exactly the kind of "don't rebuild what already
  works" risk to avoid. Use `lib/save/migrate.ts` for every future mode's
  own save and for the profile below.
- **`lib/profile/`** — the shared cross-mode `PlayerProfile`
  (`evo.profile.v1`, independent of Main Evolution's `evo.sandbox.v1`):
  which modes have been visited, a mode-owned resume pointer per mode, and
  which Museum exhibits have been unlocked. Main Evolution now records a
  visit through it (`lib/useSandbox.ts`'s `enter()`) as the first real
  integration point; nothing about Main Evolution requires this file to
  exist, and losing it never touches a mode's own save.
- **`lib/modes/`** — `registry.ts` lists the full planned mode roster
  (`ModeId`s for all seven-plus modes, each with its own future save key)
  so nothing has to be renamed later, but `getMode`/`availableModes` only
  ever surface `main-evolution` as `status: 'available'` today. `flags.ts`
  is a small localStorage-backed dev-flag helper (mirrors
  `lib/world/prefs.ts`'s pattern) for gating in-development work; nothing
  reads it yet.
- **`components/ModeHub.tsx`** — the switcher screen, reachable from a new
  compass-icon button in the top bar (`TopBar`'s `onHub`) and a new `'hub'`
  `ViewId`, without touching the landing/intro animation. It shows exactly
  one real, playable exhibit — Main Evolution, with its actual discovery
  count, era and first-visited date pulled from the live engine and
  profile — never a grid of locked placeholder cards for modes that don't
  exist yet.
- **`lib/types.ts`** — `Discovery` gained a block of fully optional,
  additive fields (`regions`, `confidence`, `artifactType`,
  `physicalProperties`, `tradeImportance`, `decomposition`, `museum`,
  `modeMeta`) so future modes can read richer context off the *same*
  canonical discovery instead of maintaining duplicate item tables. No
  existing `data/nodes/*.json` entry sets any of them yet — the type
  compiles and the game runs identically without a single data change.
  `lib/museum/types.ts` and `lib/notebook/types.ts` are the corresponding
  foundations for automatic Museum exhibits and the Research Notebook
  (Phase 2's actual screens still need to be built).

---

## Main Evolution integrations — what Phase 3 actually built

Two explicit product decisions were made before this phase started (asked
and answered, not guessed): Trade Routes would **really gate crafting**
(not ship as a read-only visualization first), and Lost Knowledge would
ship as **resilience scoring + warnings only**, architected so real
dormancy is a later, localized addition rather than a rewrite.

- **Trade Routes** (`lib/trade/`). Origins are derived at runtime by
  joining `data/majors.json` (`regions.ts`) — never authored twice, and
  only for `certainty: 'firm'|'regional'` entries; `'multiple'`/`'debated'`
  origins (independently invented in more than one place, per the record)
  are deliberately never pinned to one region. `adjacency.ts` is a small,
  documented, coarse 7-region corridor graph (the Americas have no
  corridor yet — a named, deliberate simplification, not a bug).
  `gate.ts`'s `regionGateFor` is the actual gate; `store.ts` persists a
  home region and established routes (`evo.trade.v1`, independent of every
  other save). **`lib/engine.ts` gained one new, optional constructor
  option** (`regionGate?: (node) => RegionLockInfo | null`) and one new
  `CombineResult`/`ProcessResult` status, `'region_locked'`, inserted
  exactly where `era_locked`/`tier_locked` already are — same shape, same
  precedence, same "only ever blocks a discovery not yet found" rule. With
  no option passed (every existing call site except `lib/useSandbox.ts`),
  behaviour is byte-for-byte unchanged — proven by the full pre-existing
  test suite passing untouched, plus new tests in
  `lib/__tests__/engine.regionGate.test.ts` exercising the real integration
  (not a stub). `lib/useSandbox.ts` wires a *live* regionGate (reads
  `lib/modes/flags.ts`'s `trade-routes` flag and the trade store fresh on
  every call, never a stale closure), so enabling the flag takes effect
  immediately without reconstructing the Engine. UI: `components/trade/
  TradePanel.tsx` (opt-in explanation → home-region picker → network view:
  established routes, the corridor "frontier" that can be founded next,
  and which not-yet-made discoveries are waiting on a route, with their
  real documented origin). `Bench.tsx`/`Workbench.tsx` render
  `region_locked` the same way they already render `era_locked`.
  **Not built**: recipe-level material *consumption* — this game was never
  consumption-based (discoveries are held forever once found), so gating
  is on the new discovery's own origin, not on "spending" a resource; a
  future pass could still add scarcity, but that's a bigger, separate
  design question.
- **Lost Knowledge** (`lib/knowledge/`). `resilience.ts`'s `scoreResilience`
  is a deterministic, explainable, tested function: single-documented-
  origin + oral/practice-only category (`cat` in knowledge/culture/society)
  + only one recipe route + depending on a rare ingredient each add a named
  `FragilityCause`; a discovery reachable through an established trade
  route, or independently attested in multiple regions, is more resilient
  — so Trade Routes and Lost Knowledge are systemically linked exactly as
  the brief asks. Surfaced read-only in `ExhibitPanel.tsx` ("Knowledge
  resilience") for already-found, non-primitive discoveries only, and only
  when not fully stable. `lib/knowledge/store.ts` (`evo.knowledge.v1`)
  persists `DormantRecord`s and has working, tested `markDormant`/`relearn`
  methods — **neither is called anywhere in the game yet**; wiring a real
  loss trigger later is "call this method somewhere real," not "invent a
  save format."
- **Experimentation / Research Notebook** (`lib/notebook/`,
  `lib/experiments/`). One real vertical slice, not a generic system:
  Heat Treatment, anchored to the actual `heat_treatment` discovery already
  in `data/db.json` (its own text already describes a heat/duration
  relationship with a real failure mode — thermal shock). Two variables,
  four deterministic physically-described outcomes
  (`lib/experiments/heatTreatment.ts`), every run logged as `Evidence` to
  `lib/notebook/store.ts` (`evo.notebook.v1`, organized by Investigation,
  not timestamp) whether or not it "succeeds." `components/experiments/
  ExperimentWorkspace.tsx` is the Laboratory panel, gated on holding a
  heat source and a stone-like material (mirrors the crafting loop's own
  prerequisites — never a separate resource-check invented for this).
  **Deliberately not wired**: a successful experiment does not auto-grant
  `heat_treatment` — it teaches the relationship; making the actual
  discovery still goes through the normal, unmodified crafting loop. The
  Notebook's `logObservation`/`addHypothesis` methods are real and tested
  but have no caller yet — the next mode with a hypothesis board
  (Archaeologist, Decipher) is the first real consumer.

None of the above required touching `lib/engine.ts`'s save format, and
none of it is reachable by a player who never opens the Trade or
Laboratory panels — the `trade-routes` flag defaults off, and the
Laboratory/resilience UI only ever show real, current game state.

## Phase 4 — what actually built

- **`lib/museum/registry.ts`'s `autoExhibits`** joins `engine.majorsFound()`
  (already used by the World Progress panel) to each node's own citations
  (`node.src`, the `'source_required'` sentinel filtered out) and produces
  a certainty-aware, honest provenance note per exhibit — never a specific
  surviving object, never a fabricated accession number.
  **`components/MuseumGallery.tsx`** reuses `Plate3D` for every card's
  drawing and opens the existing `ExhibitPanel` on click — no second
  rendering pipeline, no duplicate detail view. New `'museum'` `ViewId` +
  top-bar button. `lib/engine.ts` gained one small, additive, read-only
  method (`whenFound(id)`) so exhibits can date themselves.
  **Not built**: curator layout/cases/dioramas, and exhibits from any
  source other than Main Evolution's own majors (Archaeologist finds,
  Decipher tablets, Survival camp memories, …) — those arrive with their
  respective modes.

## Phase 5 — what actually built

- **Minimum Path** (`lib/minpath/`). `graph.ts` builds one well-defined,
  undirected edge type (a discovery ↔ each of its own recipe ingredients)
  from the real database — the brief's "use one well-defined edge type so
  scoring is fair." `pathfind.ts` is a plain BFS shortest path.
  `validate.ts` adapts the brief's "a category like Technology cannot act
  as a universal bridge" concern to this graph's real shape: it has no
  literal category nodes, so `hubIds` flags widely-reused base
  materials/techniques instead, and `pathLeansOnHub` rejects a candidate
  pair whose apparent difficulty is really just a hub shortcut.
  `daily.ts`'s `dailyChallenge` picks a deterministic, hub-free,
  3–8-hop pair via `lib/seed.ts` — proven against the real 322-node
  database in `lib/minpath/__tests__/daily.test.ts`, not just asserted.
  `session.ts` is the click-through state machine (no teleporting — only
  real graph neighbours are ever offered). UI:
  `components/minpath/MinimumPathChallenge.tsx`, a new `'minpath'`
  `ViewId` + top-bar button; the optimal length is never shown until the
  target is reached. **Not built**: practice-run history, curated
  "strange pairs" (Pottery → Smartphone), and the challenge-modifier
  variants (no-backtracking, chronological-only, exactly-N-clicks,
  visit-an-era) — all listed as intentional follow-ups, not oversights.
- **Tech Sudoku** (`lib/techsudoku/`). Deliberately small, and deliberately
  *not* given a top-bar entry — reached from a single small link in the
  Mode Hub, per the brief's own "do not put Tech Sudoku in primary
  navigation as equal to giant modes." `generate.ts` picks 5 real
  discoveries with distinct real dates and derives exactly `n − 1`
  "predates" clues — provably sufficient for a unique solution by a graph
  fact (the transitive reduction of a total order is exactly its adjacent
  chain), not by running a general constraint solver; the uniqueness claim
  is checked exhaustively (all 120 permutations) in
  `lib/techsudoku/__tests__/generate.test.ts` rather than merely assumed.
  Seeded daily via `lib/seed.ts`. UI: `components/techsudoku/
  TechSudokuModal.tsx` — reorder with up/down controls, "Check" reveals
  only how many are correctly placed (never which), solving reveals the
  real dates.
- **Daily/Weekly framework**: still just `lib/seed.ts` (Phase 1) as the
  shared primitive, now proven out by two real consumers (Minimum Path,
  Tech Sudoku). `lib/daily.ts` ("Today's find") was deliberately left
  unmigrated — no reason yet to touch a working, unrelated system. No
  Weekly Mega Challenge scaffold exists yet; that's real, separate work
  (multi-stage, authored scenario identity, mid-week persistence) rather
  than an extension of the daily-seed pattern.

## Phase 6 — what actually built (Survival)

This is the first mode built against the brief's hardest requirement:
~70–80% of its moment-to-moment gameplay had to be genuinely unfamiliar
from Main Evolution, not the crafting loop with new restrictions. It
shares data conventions (the same save/migration pattern, the same
provenance discipline for its Museum output) and nothing else — no
Workbench, no recipe engine, no top bar.

- **A real top-level mode switch** (`components/AppRoot.tsx`) had to be
  built for this — until now every "mode" lived inside Sandbox.tsx's own
  `ViewId` system. `app/page.tsx` now mounts `AppRoot`, which renders
  Main Evolution (`Sandbox`) by default, unchanged, so the protected
  intro/landing sequence is never touched by this change, and swaps to a
  fully separate, lazily-loaded (`next/dynamic`, `ssr: false`) component
  tree only once the player launches another mode from the Hub. Entering
  Main Evolution alone still never downloads Survival's code.
  **Known limitation, honestly logged rather than hidden**: returning
  from Survival to the Hub remounts Sandbox, so the player sees a brief
  "Continue timeline" landing prompt again (Main Evolution's own resumed-
  player state, not the full first-visit cinematic — `Engine.resumed` is
  true) before reaching the Hub — one extra click, no state lost. Fixing
  this properly means either keeping Sandbox persistently mounted (and
  pausing its background work when hidden) or giving it a way to restore
  `view: 'hub'`/`entered: true` on remount; both are real, scoped follow-
  ups, not done this pass because Sandbox's intro state machine is
  explicitly the highest-risk file in this codebase to touch casually.
- **The loop is SCOUT → ASSESS → PRIORITIZE → ASSIGN → ADAPT, not
  drag-item crafting**, over a small, bounded, spatial grid
  (`lib/survival/generate.ts`, seeded, and validated so a run is never
  unwinnable outright — at least one water and two woodland tiles are
  placed before anything else is randomised). `lib/survival/simulate.ts`'s
  `advanceTick` is the entire pure, deterministic simulation core (no
  `Math.random` — a future pass adding variation should reach for
  `lib/seed.ts`): task resolution, universal need decay, fire fuel burn,
  daily food/water consumption, win/loss checks. The UI
  (`components/survival/SurvivalMode.tsx`) holds no simulation logic of
  its own — it only calls `advanceTick` and renders the result.
- **Individual member state is words, not seven progress bars** —
  `lib/survival/read.ts` collapses energy/warmth/morale into
  rested/tired/exhausted/collapsing-style qualitative reads, per the
  brief's explicit instruction. Three members, generated names
  (syllable-combination, never real historical names for an unnamed
  prehistoric group), five simple non-stereotyped traits with real
  mechanical effect (`TRAIT_BONUS` in simulate.ts).
- **Balance was tested empirically, not assumed**: `lib/survival/
  __tests__/simulate.test.ts` includes a deterministic greedy "keep the
  essentials topped up, rest whoever is tired" policy — a stand-in for
  the brief's "run automated simulation tests where simple AI policies
  run scenarios ... to find impossible seeds" — proven to reach the
  objective on three different seeds, and a neglect policy proven to
  fail. The first version of this balance was too harsh (a naive "assign
  fixed roles, never rotate rest" policy could not survive); the numbers
  were tuned against the adaptive-policy test until they could, rather
  than loosening the test to match whatever the numbers happened to do.
- **Failure is an after-action reconstruction, never a bare "GAME
  OVER"** — the ending screen shows the real causal log leading to
  collapse (food/water shortages, then each member's exhaustion), per
  the brief. Both endings offer "start a new run" with zero punishment
  framing.
- **Cross-mode Museum output works, not just types**: a finished run
  becomes a `CampMemory` (`lib/survival/memory.ts`) rendered as a Museum
  exhibit tagged `procedural-fictional` with the run's own seed —
  verified rendering in the real gallery alongside Main Evolution's own
  exhibits in a live browser smoke test, fulfilling the brief's "the
  world remembers" cross-mode requirement end to end for the first time.
- **Not built**: multiple scenario types (only one "survive N days"
  objective exists), weather/season variation, tool wear, hunting,
  teaching/knowledge-continuity mechanics, the fog-of-uncertainty
  exploration layer, and any visual/2.5D rendering beyond a CSS tile
  grid — all real, scoped future work matching what a "vertical slice"
  is supposed to leave out, per this document's own Phase 6 entry above.

## Phase 7 — what actually built (Civilization)

The second mode built against the brief's ~70–80%-different requirement,
and deliberately a different *shape* of game from Survival rather than a
reskin of it: Survival is spatial and task-based (SCOUT → ASSESS →
PRIORITIZE → ASSIGN → ADAPT over a tile grid); Civilization is a turn-based
resource-allocation game with no spatial layer at all — three sliders, one
decision per turn, watching consequences unfold over years.

- **The loop is allocate → advance → read the consequences, not
  crafting or task-assignment.** `lib/civilization/generate.ts` seeds one
  settlement (population, starting farmland, storage) beside a river.
  `lib/civilization/simulate.ts`'s `advanceTurn` is the entire pure,
  deterministic simulation core: the player sets one `Allocation` (food /
  construction / knowledge, normalised to sum to 1) per 5-year turn, and
  the core resolves food production against farmland capacity and
  population, storage growth, irrigation progress, population growth or
  famine decline, and problem detection (water-labor pressure, land
  shortage, storage shortage) — no `Math.random`, same discipline as
  Survival. The UI (`components/civilization/CivilizationMode.tsx`) holds
  no simulation logic — it only calls `advanceTurn` and renders the
  result, same pattern as `SurvivalMode.tsx`.
- **Problems are named causes, not stat bars going red** —
  `PROBLEM_TEXT` in the UI turns each detected `ProblemKind` into real
  written cause-and-effect text (e.g. water-labor pressure explains *why*
  labor is being diverted from other work), matching the brief's
  preference for legible causality over abstract meters. Famine is
  deliberately not a `ProblemKind` of its own — it is reported as log
  text at the moment it happens, since it is an event, not an ongoing
  condition the way land or storage shortage are.
- **Balance was tuned against failing tests, not assumed** —
  `lib/civilization/__tests__/simulate.test.ts` includes both a reasonable
  adaptive allocation policy (shift toward food when land is tight or
  stock is low, otherwise invest in knowledge/construction toward
  irrigation) proven to reach the `'resilient'` ending on three different
  seeds, and a neglected all-food-zero policy proven to collapse. The
  first version of this balance was unwinnable even under the adaptive
  policy: irrigation accumulated over ~100 turns against a 14-turn game,
  storage capacity barely grew (a stray `*0.05` dampener left the
  knowledge/construction stockpile accumulation nearly inert), population
  growth was computed from the wrong quantity (carried-over stock instead
  of this turn's actual production surplus), and the food-production rate
  made breakeven require an unrealistic ~89% food allocation, guaranteeing
  chronic famine under any balanced-looking policy. All four were found
  by writing a temporary turn-by-turn debug trace (deleted once diagnosis
  was complete — it is not part of the committed code), and the constants
  were tuned against the adaptive-policy test until it could pass, rather
  than loosening the test to match whatever the numbers happened to do —
  the same discipline Phase 6's Survival balance work used.
- **Cross-mode Museum output works here too**: a finished run becomes a
  `SettlementMemory` (`lib/civilization/memory.ts`) rendered as a
  `procedural-fictional` Diorama exhibit carrying the run's own seed,
  alongside Main Evolution's majors and Survival's Camp Memories in the
  same gallery — verified in a live browser smoke test showing all three
  exhibit sources together.
- **The Mode Hub now shows three real exhibits**, not one — pulling
  `ModeHub.tsx`'s single-card markup out into a reusable `ExhibitCard`
  presentational component rather than duplicating the card three times.
- **Verified live, not just by unit tests**: a Playwright smoke test
  launched the settlement from the Hub, confirmed the three sliders and
  real settlement stats render, then deliberately drove a *non-adaptive*
  fixed 45/30/25 allocation for 12 turns — population correctly declined
  (31 → 9) from chronic pre-irrigation food deficit, which is intended
  difficulty (the same underlying simulation reliably reaches
  `'resilient'` under the Jest adaptive-policy test), not a balance bug.
- **Not built**: only one scenario type (river settlement, growth vs.
  collapse) — no droughts, disasters, or multi-settlement play; no
  district- or infrastructure-network complexity beyond the single
  irrigation milestone; no population-class or labor-specialization
  allocation beyond the three-way food/construction/knowledge split; no
  map or era-scale transitions. All real, scoped future work, matching
  what a vertical slice is supposed to leave out.

---

## Development order (do not reorder without a reason)

1. Shared data/save architecture + Mode Hub, Main Evolution unchanged. ✅
2. Research Notebook + Museum data model foundations. ✅ Notebook has a real store now; Museum is still types only.
3. Trade Routes/Lost Knowledge/Experimentation in Main Evolution, behind flags, validated against existing saves. ✅ see "what Phase 3 actually built" above. Full graduated Knowledge Transfer (observed/possessed/understood/mastered) was not built — region-gating covers a narrower, real slice of it.
4. Museum shell + automatic representative-artifact pipeline (every later mode outputs into this). ✅ `lib/museum/registry.ts`'s `autoExhibits` + `components/MuseumGallery.tsx` — one exhibit per found major invention, reusing `Plate3D`/`ExhibitPanel` rather than a new rendering pipeline. Curator layout, cases, dioramas and non-Main-Evolution exhibit sources (Archaeologist finds, Decipher tablets, …) remain future work — this is one honest wing, not the finished museum.
5. Minimum Path, Daily framework, Tech Sudoku — validates the shared seed/challenge services against real content. ✅ Minimum Path + Tech Sudoku, see "Phase 5 — what actually built" above. Daily/Weekly framework beyond `lib/seed.ts` itself still open.
6. Survival vertical slice: one environment, one objective, shelter/fire/food, contextual discovery, one Museum output. Don't expand content until this loop is fun. ✅ see "Phase 6 — what actually built" above.
7. Civilization vertical slice: one settlement problem, one infrastructure evolution. ✅ see "Phase 7 — what actually built" above.
8. Archaeologist vertical slice: one small procedural site end to end (survey → trench → context → lab → hypothesis board → report → museum export). This becomes the shared evidence backend Decipher and Alien Archaeology both plug into.
9. Decipher: authored tutorial chapters, then a beginner procedural script generator with a solvability validator, before advanced grammar.
10. One authored Historical Escape Room episode using a real puzzle-authoring schema (not a bespoke React component per puzzle).
11. Alien Archaeology, only once 8–10's evidence/procedural-generation architecture is proven.

Reverse Evolution and Minimum Path's challenge variants (no-backtracking,
chronological-only, etc.) can proceed in parallel with 6–11 once the
underlying graph has been validated for high-degree "cheat nodes" (a
category node like "Technology" acting as a universal bridge).

## Non-negotiables carried over from the full brief

- A mode's moment-to-moment loop must be genuinely different from Main
  Evolution's — reusing data, art direction and profile is fine; reusing
  the crafting loop with new restrictions is not "a new mode."
- Fictional/procedural content (alien ruins, generated archaeology sites,
  generated scripts) must always be visibly marked as such — see
  `ExhibitProvenance.kind` in `lib/museum/types.ts`. Historical Earth
  content stays fact-checkable and cited (`data/sources.json`).
- Every new persisted store gets a version and a migration path
  (`lib/save/migrate.ts`) from the day it's created — never retrofitted
  after players already have saves.
- Daily/weekly challenges and any procedural generation must be
  deterministic and seeded (`lib/seed.ts`) — never `Math.random()`
  scattered through a component.
- No engagement mechanics built on streak punishment, loot boxes, fake
  scarcity, or manipulative notifications, anywhere in the universe.
