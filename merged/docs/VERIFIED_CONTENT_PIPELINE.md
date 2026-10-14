# Verified-content pipeline (Logic-First V3, Phase 1)

How a real, sourced historical item becomes a playable item **without anyone writing a recipe by hand** and
**without inventing one when none is defensible**.

```
EDITOR  ── verified name, date, properties, description, sources (NO recipe) ──▶  data/verified_seeds/<batch>.json
   │
   ▼  seed-validate        facts, sources, chronology, duplicate ids/names  (fails closed)
   ▼  anchor-requests      one envelope per ready seed: facts + a bounded, era/material-admissible ingredient shortlist
   ▼  CLAUDE CODE answers  exactly ONE decision per seed → data/verified_seeds/<batch>.anchors.json
   │                         { status:"proposed", ingredientIds, action, inputRoles, mechanism, … }  or
   │                         { status:"anchor_blocked", reasonCodes, missingPrerequisites }
   ▼  anchor-validate      deterministic hard rules (below) — a decision that fails is rejected, never "fixed up"
   ▼  freeze               immutable; re-running is byte-identical; changing needs  --revise ID --reason "…"
   ▼  publish --dry-run    full plan + real validate.py + scratch build; writes nothing
   ▼  publish --apply      all-or-nothing, compare-and-swap on a base hash, backup manifest, rollback
   ▼  npm run data:build   (you run it after approving) regenerates data/db.json
```

Nothing in `tools/content/` calls a model or the network. “Claude answers” is a step performed by Claude Code
(or by a person) and recorded as data; the code only **checks** it.

## Run it

```
cd merged
npm run content:audit                                   # truth-status of the existing 918 + recipe slot histogram
node tools/py.mjs tools/verified_content.py run --batch pilot      # validate → requests → anchor-validate → report
node tools/py.mjs tools/verified_content.py publish --batch pilot --dry-run --sandbox out/sandbox
npm run content:test                                    # 28 Python tests, standard library only
```

Fixture batches (`"fixture": true`, sources at `example.org`) can only be published into a **sandbox copy**
(`--sandbox DIR`); the real tree refuses them (`fixture_batch_requires_sandbox`).

## Importing thousands of items

* `seed-import --input FILE --split-by-era --chunk N` splits one big file into `<name>_<era>_NNN.json` batches
  (default order: earliest era first, so prerequisites land before dependants).
* Each batch is independent: validate, decide, freeze and publish batch by batch.
* **Dependencies, not fakes.** If a seed needs something the catalogue lacks, its decision is `anchor_blocked`
  with `missingPrerequisites`; `report --batch NAME` lists them (and `dependency_report` shows which blocked
  seeds are waiting for which other seeds). Add the missing item in an earlier batch, then re-decide.
* Importing never edits gameplay code, animations, visuals or modes: a published item gets its material look,
  3D family and motion family from data (`visualBrief.archetype`, `materialProperties.family`).
* Plate numbers: new items get `no` = 919, 920, … in publish order; existing ids and numbers never move.

## What counts as a defensible anchor (hard rules, `tools/content/causal.py`)

An anchor is **one** multiset of 2–5 existing catalogue items plus an action from `ActionId` (+ `assemble`):

| Rule | Code on failure |
|---|---|
| ingredients exist, are catalogue **nodes** (worked *states* such as `clay`/`stick` live only in processing.json and cannot appear in a base recipe) | `UNKNOWN_INGREDIENT`, `STATE_NOT_ALLOWED_IN_BASE_RECIPE` |
| none is a legacy placeholder (500 in `g10.json`) | `UNVERIFIED_INGREDIENT` |
| every ingredient existed no later than the target | `ERA_CONFLICT` |
| the action needs a role the ingredients actually provide (`tie` needs a binding, `grind` an abrasive, `heat` a heat source …) | `PROCESS_UNAVAILABLE` |
| the object’s archetype needs its parts (a hafted tool needs head + haft + binding; a vessel needs a plastic body + heat …) | `MISSING_REQUIRED_COMPONENT` |
| declared role of each ingredient is true of that ingredient (data-driven predicates) | `ROLE_MISMATCH` |
| material can flow from inputs to the result (stone→stone, never stone→metal without ore + heat) | `MATERIAL_IMPOSSIBLE` |
| mechanism ≥ 40 chars and not word-association (“symbolically”, “represents”, “theme” …) | `NO_CAUSAL_MECHANISM`, `WEAK_SEMANTIC_ASSOCIATION` |
| the multiset is not already another item’s recipe | `RECIPE_ALREADY_CLAIMED` |
| target not among inputs; no cycle in the dependency graph | `CYCLE_OR_SELF_REFERENCE`, `TARGET_IN_INPUTS` |
| heat/dry/pour/… state their conditions | `UNKNOWN_CONDITIONS` (review) |
| evidence class `documented` needs topic-level sources the batch really has | `INSUFFICIENT_EVIDENCE` |

`score`/confidence never exists in this path. Archetypes the rules cannot judge (`wheel`, `circuit`, `plant`,
`abstract_diagram`) are **always** `needs_review` — never auto-frozen.

The legacy graph is dense (every pair of existing items already has a meaning), so a new item’s route is
usually a **3-slot** multiset (e.g. `stone + stone + stone`, `bone + stone + stone`). That is by design: it is
what keeps the 2-slot space of the existing 918 untouched.

## Recipe keys (Python and TypeScript agree)

`recipe-v2:<n>:<len>:<id>…` over the **sorted** ids, repeats kept. `tools/content/keys.py` and
`lib/content/recipeKey.ts` both run `tools/tests/fixtures/recipe_key_golden.json`. The engine’s own `multiKey`
(sorted ids joined by a space — what old saves persist) is **not** replaced; `legacyKey` is the same function
and a test proves it for every real recipe. `frozenset()` is no longer used for recipe identity in
`validate.py` / `build_db.py` / `rework_recipes.py`.

## Optional alternative routes (0..N, never new items)

`suggest --batch B --target ID (--rules-only | --from-response FILE)`. Zero is the normal result. Proposals are
stored hash-bound and append-only in `data/verified/proposals/<batch>.json`; `review` records an editor’s
approve/reject; only a separate publish writes `data/verified/alt_routes.json`, which `lib/processing/index.ts`
folds into the playable graph as extra recipes of an **existing** item. The shipped `alt_routes.json` is empty.

At runtime nothing public calls a model. The owner-only route `POST /api/admin/recipe-suggestions`
(`app/api/admin/recipe-suggestions/route.ts`) is a 404 unless `ENABLE_DEV_TOOLS=true` **and**
`OWNER_REVIEW_TOKEN` is set and the deployment is not production; the provider defaults to NONE without
`ALT_AI_URL/KEY/MODEL`; whatever a provider returns passes `lib/content/altValidation.ts` first.
**The HTTP provider has never been called against a real API** (no credentials were used in Phase 1).

## Status of the existing catalogue (`npm run content:audit`)

118 verified · 36 verified-with-uncertainty · 264 pending evidence · 500 legacy placeholders · 20 fictional /
gameplay. Placeholders are quarantined by status, never relabelled as verified, never offered to generated content.

## Safety nets

* Backups: every `publish --apply` writes `data/verified/backups/<batch>_<stamp>/` with a manifest;
  `rollback --backup DIR` restores byte-for-byte (tested).
* Compare-and-swap: a plan records the base hash of the files it will touch; if they changed, apply refuses.
* Preservation goldens (`lib/content/__tests__/preservation.test.ts`): majors.json, the museum, and the ids / plate
  numbers / recipes of the original 918.

## Known limits

* Role/material knowledge is a rule table, not a historian: it rejects the impossible and the thematic, it cannot
  *prove* an object was historically made that way. Anchors are labelled `plausible_reconstruction` unless sourced.
* Python depth (used only for the “progression shortcut” heuristic) differs from `db.json` depth for 55 nodes that
  processing transforms shorten; the heuristic is advisory.
* The pilot fixture items (`fx_*`) are test data and are **not** in the shipped game.
