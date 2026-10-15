# EXP26 logical merge repair — Claude integration instructions
**Status: REVIEW ONLY. DO NOT AUTO-PUBLISH.** Generated 2026-10-15 on branch `review/exp26-logical-merges-2026-10-15`.
## Input and scope
- Read `data/recipe_review/exp26_logic_proposals_v1.json`. It covers exactly 999 installed exp26 items from `data/nodes/g11.json`; it does not replace them.
- The 1,000 anc27 ancient draft items are **not** integrated. Their review report identified duplicates and invalid historical/physical merges; treat separately.
- Existing `data/nodes/g1.json` through `g10.json` (918 original items), main/other modes, and `data/art.json` must be preserved.
- 456 tentative candidates, 315 need further review and 228 blocked: these statuses only reflect the limited programmatic heuristics. Even a `candidate` must be checked by a human for historical, mechanical, and material plausibility.
## Hard rules
1. Never insert a recipe merely to get two routes per item. **One valid recipe beats five nonsensical recipes; zero acceptable recipes means explicitly hold the item for design or mark non-craftable, not make an arbitrary chain.** Confirm gameplay supports a single recipe before changing data.
2. Pair recipes express a deliberately simplified `starting component + process/tool/component`; explanatory text must name actual missing agents or process constraints. Do not equate a listed enabling *concept* with literally supplying an ingredient.
3. For each item: check existence of both ingredient IDs, compatibility and historical emergence of materials, mechanism and chronology, uniqueness of canonical unordered ingredient pair globally, non-reachability/circularity, and prevention of recipe conflicts with big assembly recipes. Validate known real prerequisites beyond the game's two-input recipe.
4. Use reliable source per item where feasible (museum/excavation catalogues, historical technical works, trusted scientific institutions). Record **item-specific URL, exact supported claim, date/region uncertainty**. Do not mark `source_required` as verified. No invented citation or invented date; existing `ds` is a sorting aid only.
5. If an expected historical process cannot be expressed using existing catalog IDs, **propose a specific missing node** (e.g. prepared slip, glaze flux, weaving loom, salt, alcohol ferment starter, silicon dopant) with its own prereqs; don't swap it for a random primitive. Avoid moving an invention to a clearly wrong historical era.
6. Preserve `art.json` rendering, but manual artwork semantic review (shape recognizable at normal scale and spinning wireframe) is separate from passing art lint.
7. `status: blocked` includes chronology and recipe-key collisions under current data. Fix by actual causal recipe redesign, not by removing guards or recycling unused pairs.
## Priority examples in the proposals
- Burnished Pinch Pot = Pinch Pot + stone burnishing tool; physical action is rubbing a leather-hard clay surface.
- Painted Storage Pot = suitable pot + pigment preparation; binder and firing conditions still need review.
- Handled Drinking Cup = clay cup body + prepared vessel clay (handle stock), followed by attaching before firing.
- Steam Surface Condenser = condenser coil + steam-engine heat/exhaust context; cooling water circuit required.
- Real Time Scene Animation = skeleton animation + real-time rendering pipeline (implementation prerequisite, not physical assembly).
- **Review flagged content critically**: entries such as `exp26_sealed_dried_fish_pack` need food-safe packaging, and `exp26_glazed_serving_bowl` needs an actual glaze mixture/kiln rather than simply glass. Do not approve on heuristic status alone.
## Per-item deliverable
Produce `data/recipe_review/exp26_reviewed.json` with explicit entry fields `id, decision, finalRec, materialJustification, processExplanation, sourceRefs, reviewedBy, chronologyReview, missingDependencies, problems`.
Each item must have an individually written (not generic template) `l1` function, `l2` realistic technical operation/material properties, `l3` use/limitations/historical context, source URLs, confidence flag, and verified historical period only where supported. No automatic replacement in `g11.json` until all hard blockers are resolved.
## Run and integration
- From `merged/`, run `npm run data:build`, `npm run data:validate`, `python3 tools/expansion/sync_modes.py`, appropriate Jest/TS checks, `npm run build` and a playable smoke test for Main/Reverse/Minimum Path/Archaeology/Survival/Escape Room.
- Compare before/after for 918 originals, no duplicate IDs/names/keys, no impossible self/circular recipes, and no wrong-era ingredients. Prove mode-specific injection, do not claim all 999 participate equally in every mode. Explain intentional exclusion of Civilization, Decipher, Alien and curated Museum or design purposeful integrations after user approval.
- Revisit failed Vercel deployment before reporting production complete; a successful status for a different Vercel project does not prove the supplied public URL updated.
- Do not merge to main without review. Report corrected vs blocked count and concrete examples with verified sources.
## Caveats
The bulk proposal heuristics infer mechanism from item name/topic. They do **not** prove historical accuracy, and may pick proxies with subtly wrong semantics or chronology. `reviewRequired: true` is intentional for **every single row**.
