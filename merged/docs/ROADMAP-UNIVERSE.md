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

## Status (28 September 2026)

| Phase | State | Notes |
|---|---|---|
| **1. Shared architecture + Mode Hub** | **Built this pass** | See below. Main Evolution's own save, engine and UI are untouched. |
| 2. Research Notebook + Museum data model | **Types only, this pass** | `lib/notebook/types.ts`, `lib/museum/types.ts` — no UI yet. Real notebook/museum screens are still future work. |
| 3. Main Evolution integrations (Trade Routes, Knowledge Transfer, Lost Knowledge, Experimentation) | **Not started** | See "Main Evolution integrations" below for the design this phase should follow when it begins — it extends `lib/world/` (regions/majors already exist there) rather than adding a parallel system. |
| 4. Museum shell + automatic artifact pipeline | **Not started** | |
| 5. Minimum Path, Daily framework, Tech Sudoku | **Partially started** | `lib/seed.ts` (this pass) is the reusable seed service these need. `lib/daily.ts` already exists (Main Evolution's "Today's find") and should be migrated onto `lib/seed.ts` rather than duplicated when this phase starts. |
| 6. Survival vertical slice | **Not started** | |
| 7. Civilization vertical slice | **Not started** | |
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

## Main Evolution integrations (Phase 3 design, for when it starts)

These extend Main Evolution itself — per the brief, they are a *world
layer*, not a separate mode — and should be designed against systems that
already exist rather than added in parallel:

- **Trade Routes / regional knowledge distribution.** `lib/world/` already
  models regions (`data/majors.json`'s `regions`), geo-placed major
  inventions, and era-gating (`lib/world/registry.ts`'s `WorldModel`). A
  discovery's new `regions?: string[]` field (this pass) is the seed for
  "which regions plausibly have this already" — a route/diffusion layer
  should read that, not invent a second geography system. Keep the
  abstraction at the level `lib/world/` already uses (broad regions, not a
  logistics grid).
- **Knowledge Transfer.** Needs a state finer than "found" —
  observed/exposed vs. materially possessed vs. understood vs. mastered.
  This does not exist yet at any layer; it's the one genuinely new piece of
  state Phase 3 has to add, and it should live beside `Engine.found`/`bag`
  in a way that an old save (which has neither) upgrades into cleanly —
  everyone already fully "knows" what they've already discovered.
- **Lost Knowledge.** A resilience model over the same graph — practicing
  regions, documentation (writing), dependency availability. Reuse the
  `Discovery.confidence`/`regions` fields added this pass as inputs rather
  than inventing a parallel scoring table.
  **Experimentation / Research Notebook.** `lib/notebook/types.ts` (this
  pass) is the shape; the actual Experiment Workspace UI and the rule that
  decides which discoveries get a variable-tuning interaction (vs. staying
  a normal recipe) is unbuilt. Keep the existing rule from
  `docs/ROADMAP.md`'s P4 in mind: only where the variable itself teaches
  something, not on every recipe.

---

## Development order (do not reorder without a reason)

1. Shared data/save architecture + Mode Hub, Main Evolution unchanged. ✅ this pass.
2. Research Notebook + Museum data model foundations. ✅ types only, this pass.
3. Trade/Knowledge Transfer/Lost Knowledge/Experimentation in Main Evolution, behind flags, validated against existing saves.
4. Museum shell + automatic representative-artifact pipeline (every later mode outputs into this).
5. Minimum Path, Daily framework, Tech Sudoku — validates the shared seed/challenge services against real content.
6. Survival vertical slice: one environment, one objective, shelter/fire/food, contextual discovery, one Museum output. Don't expand content until this loop is fun.
7. Civilization vertical slice: one settlement problem, one infrastructure evolution.
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
