# Evolution Sandbox

An explorable discovery graph. You start with four raw materials — stone, wood,
bone, fibre — and combine them into 322 discoveries (306 core, 16 hidden), most of
them reachable by more than one route. See CHANGELOG 1.4.0 for the hint system,
route collection, themes and the mobile layout. Each carries a short
definition, an argument for why it mattered, an account of how we know, and
its sources: subject-level pages where one has been verified, and an honest
**source required** flag where it has not.

Reaching Grand Theft Auto VI takes a **minimum of 101 distinct combinations**
and sits at depth 35. There is no shortcut.

This is the Next.js build. The same game ships as a single HTML file from the
sibling project `evolution-sandbox/`, which is the **canonical** home of the
data, the Python tools and the design-system stylesheet — see
[Keeping the two builds in step](#keeping-the-two-builds-in-step).

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16**, App Router | every page is statically rendered |
| Language | **TypeScript**, strict | |
| Styling | **Tailwind CSS v4** + the shared design system | see [Styling](#styling) |
| Components | **Vengeance UI** — `AnimatedNumber`, `StatsCounter`, `Kbd`, `LineHoverLink`, `FaqAccordion` | copied in from its registry; `components/vengeance/README.md` |
| Motion | **framer-motion** | drives the two animated Vengeance components |
| Fonts | `next/font/google` — Instrument Serif, Archivo, JetBrains Mono | self-hosted at build time |
| Lint | ESLint 9 flat config, `eslint-config-next` | Next 16 removed `next lint` |
| Utils | `clsx` + `tailwind-merge` → `cn()` | Vengeance UI's documented helper |

---

## Getting started

Needs Node.js 20.9 or newer, and Python 3 for the data tools.

```bash
npm install          # first install after this update also refreshes package-lock.json
npm run dev          # http://localhost:3000
```

```bash
npm run build        # production build (downloads the three fonts once, so it needs network)
npm start
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run data:validate
npm run data:check   # are data, tools and stylesheet identical to ../evolution-sandbox?
```

The Python tools run through `node tools/py.mjs`, which finds `python3`,
`python` or the Windows `py` launcher — so the scripts work on Windows,
macOS and Linux alike.

### Deploying

Set `NEXT_PUBLIC_SITE_URL` to the site's public origin (see `.env.example`).
It feeds canonical and Open Graph URLs, `robots.txt` and `sitemap.xml`. On
Vercel the production domain is picked up automatically when it is unset;
anywhere else, an unset value falls back to `http://localhost:3000`, which is
only right for local runs. There is deliberately no invented placeholder domain.

---

## Architecture

```
app/                    App Router: the game, plus method / FAQ / privacy / 404
  _design-system.css    the shared stylesheet — identical to ../evolution-sandbox/src/styles.css
  _museum.css           the 1.8 layer: landing film, world reveal, cards, ceremony, exhibit, timeline, HUD
  globals.css           Tailwind, the design system (in the components layer), tokens
components/             view layer — presentational, no game rules
  ConfirmDialog.tsx     in-page confirmation (window.confirm is blocked in sandboxed frames)
  Landing.tsx           the cinematic opening; drives lib/intro (canvas time tunnel) and the stone's fall
  Workbench.tsx         the physical bench: pieces with weight, five hands, clusters of 2-5, knock-out, put-away
  HandIcon.tsx          the small line-art hand on each action button
  TimelineView.tsx      one horizontal rail, real recorded dates only
  fx/CeremonyStage.tsx  the full-screen discovery ceremony; fx/EraShift.tsx marks a new era
  vengeance/            Vengeance UI components, copied from the registry (MIT)
lib/
  engine.ts             the whole game: pair index, combining, nudges, hints, routes, tiers — and a tiny store
  theme.ts              light / dark / system, applied before first paint
  daily.ts              "Today's find" (date-seeded, no streaks)
  glyphs.ts             the shape grammar that draws all 220 marks
  useSandbox.ts         the only place React and the engine meet
  perf.ts               HIGH / MEDIUM / LOW quality tiers, reduced motion, tunnel length by device
  sound.ts              the one door for every sound (SOUND on/off); synthesis in craft/audio.ts
  routes.ts, near.ts    PATH 01/02… derived from recipes; vague "something is forming" lines
  processing/           the additive layer: tags, actions, states, 2-5 piece recipes, assess()/probe() (see below)
  intro/                tunnel canvas (fx.ts) and the real plates that fly through it (objects.ts)
  site.ts, format.ts    site URL resolution; locale-independent dates
  types.ts              the database contract
data/
  nodes/g1..g6.json     authored data — edit in ../evolution-sandbox, then `npm run data:sync`
  sources.json          the citation registry, with scope and checked date per source
  db.json               built artefact — do not edit by hand
tools/                  validator, builder, sync (python3) and the cross-platform runner
```

**The engine has no React in it and no DOM beyond a `localStorage` guard.** It is
a plain class that doubles as an external store: every change bumps a version
and notifies subscribers, and `useSandbox` reads it through
`useSyncExternalStore`. Saved progress is restored *after* hydration, so the
server's HTML and the browser's first render always match — loading it during
the first render used to make every returning player's page fail hydration.

The same logic drives the single-file build; a randomised run of 16,000
combinations through both engines gives identical results.

### The processing layer (hands, states, multi-item recipes)

`data/processing.json` (generated by a script from tags and a list of transforms) is applied over
`data/db.json` at load by `applyProcessing` → `playDb`. The base file is never edited. It adds
*states* (Stick, Clay, Soil… held, never counted), single-resource *routes* (`via`: stone + smash),
extra recipes of 3-5 pieces, unlock rules (Soil appears after the first Stick) and renames verbs into
objects. `Engine.process(id, action)` answers one hand on one piece; `combineMany(ids)` answers a cluster;
`assess(ids)` explains a failure by *kind* without naming a recipe; `probe(ids)` says whether pieces are
about to work (exact / unstable / attract). Gestures live in `lib/craft/gesture.ts` as pure geometry.

### The craft system (physical merging)

Combining is a physical act. Two items are put on a bench, brought together, and the
pair runs a short process before the engine is asked for the result.

```
lib/craft/
  types.ts        Body, StepSpec / CraftSpec (the data), StepCtx (what a step can use)
  specs.ts        recipe -> CraftSpec: FAMILIES (rules by material/tags), CRAFT_OVERRIDES (by pair), govern() pacing
  materials.ts    stone, wood, metal, fibre, liquid, fire ... registerMaterial()
  world.ts        the lightweight circle physics: held spring, walls, impulses, squash, zones
  session.ts      CraftSession: runs a spec's steps in order, routes pointer / keys / wheel
  steps/          one runtime per interaction kind; index.ts is the registry (registerStep)
  fx.ts, audio.ts one canvas overlay; synthesised WebAudio sounds
  prefs.ts, bus.ts  Instant / sound / seen-cue prefs; lets the rail and drag-and-drop spawn onto the bench
components/Workbench.tsx   the DOM bench: bodies, HUD, tools, input
```

`Engine.combine` remains the only authority on what a pair makes; the craft layer only
decides how the player gets there. Recipes name their interaction in data, so new
behaviour never needs a change to the engine.

- **Add a material:** `registerMaterial({...})` in `materials.ts` (weight, bounce, sound, colour).
  Steps read those properties, so the new material behaves sensibly everywhere.
- **Add an interaction kind:** write a `StepDef` `{ kind, verb, estimate, create }`, add the name
  to `StepKind`, `registerStep()` it and give it a line in `HINTS`. Recipes then use
  `{ kind: 'yours', ...params }`.
- **Change one recipe:** add it to `CRAFT_OVERRIDES` in `specs.ts` (keyed by the two item ids).
  Everything else is derived from materials and the discovery's era and tier.
- **Add an assembly:** add a layout to `LAYOUTS` in `steps/build.ts`.
- **Pacing:** `BUDGET` in `specs.ts` sets the target seconds per tier; `govern()` enforces it.
  `lib/craft/__tests__/pointer.test.ts` fails if an ideal player runs over.
- **Accessibility:** every step has a keyboard route (Space, E, R, wheel), an **Instant** mode
  turns the whole layer off, and **Do it for me** appears after 22 seconds of being stuck.

### The glyph system

220 discoveries, zero emoji. `lib/glyphs.ts` is a shape grammar: about thirty
primitive drawing functions composed by a spec table, all in one stroke
language — 100×100 box, 2px stroke, `currentColor` — so the set reads as one
engraved plate series. Anything without a spec falls back to a category-seeded
procedural form, so no node ever renders blank.

### Styling

Two layers, one palette:

- The **game screens** use the shared design system, byte-for-byte the
  single-file build's stylesheet, so both builds look the same. It is imported
  into Tailwind's `components` layer, so a Tailwind utility always wins over it
  when both apply.
- Everything **only this app has** — the method, FAQ, privacy and 404 pages,
  the Vengeance components, the search-box key hint — is Tailwind utilities on
  the same tokens (`ink-*`, `bone-*`, `line*`, `ochre`, declared in
  `app/globals.css`).

Deliberately single-theme: a near-black museum interior with a red-ochre
accent, the oldest pigment humans used. No light theme, no gradients, square
corners, no emoji anywhere in the interface.

---

## Sources

Every source in `data/sources.json` has a **scope**:

- `topic` — a page about the entry's subject or its field (a species page, a
  museum essay, a Nobel citation, an IEEE milestone, a peer-reviewed paper);
- `general` — a homepage, portal, collection search or index list: background,
  never evidence for a particular claim.

An entry whose sources are all general carries the literal `source_required`,
and the exhibit says so. The validator enforces the rule (`E10`), so it cannot
lapse quietly. Each source also records the date its URL was last fetched and
confirmed (`checked`). As of 11 September 2026: 71 sources (59 subject-level,
12 general), 153 of 220 entries with at least one subject-level source, 67
still marked source required — the archive can filter to them.

## Editing the data

The data lives in `../evolution-sandbox/data/`. Edit it there, then:

```bash
npm run data:sync      # copy data, tools and stylesheet in; rebuild data/db.json
npm run data:check     # verify nothing has drifted
```

`tools/validate.py` fails on duplicate ids or catalogue numbers, recipes naming
nodes that do not exist, a node listing itself as an ingredient, missing
required fields, unknown or malformed sources, a rarity that disagrees with the
hidden flag — and on the three that actually matter:

- **an unreachable node** — it computes the forward closure from the four
  starting materials and asserts all 220 fall inside it;
- **an ambiguous pair** — two recipes producing different results from the same
  pair would make the engine non-deterministic. The first run found six;
- **an unflagged entry** — only general references, but no `source_required`.

Derived fields (`depth`, `need`, `uses`) and the `dataHash` fingerprint are
computed by `tools/build_db.py` and must never be hand-edited.

> The minimal-derivation calculation uses a monotone fixpoint, not a
> depth-first walk. A DFS has to cut cycles, and memoising a cycle-truncated
> result poisons every node above it — that bug made *Music* report 2 required
> crafts when its only ingredient needs 8. The fixpoint only accepts smaller
> *complete* sets, so it cannot.

## Keeping the two builds in step

`npm run data:check` compares, against `../evolution-sandbox`: the six node
files, `sources.json`, the three shared Python tools, `src/styles.css` against
`app/_design-system.css`, and the `dataHash` of `data/db.json`. It exits
non-zero on any difference; `npm run data:sync` fixes it.

---

## Known deviations from the original brief

Recorded because they were choices, not oversights.

1. **Node numbering was reordered inside groups** where the brief's order
   contradicted dependency (Language/Communication, Optics/Observation,
   Telegraph/Electricity).
2. **Item 085 "Mathematics" was renamed "Number System"**, because the brief
   lists Mathematics twice (085 and 113).
3. **Sixteen hidden discoveries were added beyond the 204.** The counter reads
   *n / 204*; hidden finds are tracked separately. Grand Theft Auto VI is one
   of the 204 and is rated *rare*, not hidden.
4. **No stock imagery and no fabricated image credits.** Every mark is drawn by
   the shape grammar.
5. **Vengeance UI supplies five components, not the layout.** Most of the
   library is built for bright, rounded, gradient-heavy landing pages; the
   parts that fit a dark, square museum interface are used, restyled onto the
   project tokens, and each change is listed in the file's header.

See `CHANGELOG.md` for what changed in 1.1.0.

## Licence

Code is yours, except `components/vengeance/`, which is MIT-licensed by its
author (see the LICENSE file there). The cited sources belong to the
institutions that hold them and are linked, not reproduced.
