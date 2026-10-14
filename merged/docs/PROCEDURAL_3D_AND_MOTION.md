# Procedural 3D and reusable motion

## 3D (`lib/visual3d/`)
* `types.ts` — 16 enumerated archetypes (blade, hafted_tool, axe, stone_fragment, polished_stone, wood_rod,
  woven_fibre, vessel, brick, metal_ingot, wheel, bone_tool, bead, circuit, plant, abstract_diagram) and a
  `Visual3DSpec` that is **data only**: enumerations and numbers in 0..1. No html / svg / script / URL / texture field exists.
* `geometry.ts` — real vertices, normals and indices from primitives (box, wedge, cylinder, cone, sphere, torus, lathe). Capped at 65 000 vertices.
* `families.ts` — one builder per archetype; knobs change proportions, never the family.
* `plan.ts` — `planFor()` (deterministic from item id + archetype + material family), `parseSpec()` (strict; unknown keys are errors), `meshFor(spec, lod)`; 3 LODs.
* `silhouette.ts` — orthographic 24×24 silhouette + SVG fallback + a distance metric (used by tests to prove the families differ).
* `cache.ts` — key `(itemId, specHash, styleVersion, format)`; bounded LRU.
* `renderer.ts` — optional, lazy OGL renderer; skipped when WebGL is absent or reduced motion is requested.

**What is verified:** geometry validity, determinism, silhouette difference between all 16 families, LODs, spec rejection,
cache identity — by Jest (no GPU). **What is not:** the OGL renderer has not been looked at in a browser in this
session; nothing in the game imports it yet, and the existing hand-drawn glyphs (`lib/glyphs.ts`) are unchanged.
Visuals are labelled reconstructions (`stylized: true`), not claims about the real object’s shape.

## Motion (`lib/craft/motionPlan.ts`)
A `MotionPlan` is chosen from the materials of the ingredients and the step kinds of the existing `CraftSpec`:
`percussive`, `binding`, `abrasive`, `thermal`, `fluid`, `carving`, `assembly`, `signal`, `insight`, `organic`, `gentle`.
Phases (approach, contact, work, settle, reveal), easing, particles (≤ 48), sounds and shake come from data;
`reduced` is a still, < 0.5 s variant with no particles or shake. `stone + stone` is percussive, `fibre + wood` is
binding (tested). A new item needs no new JSX; **the plan is not yet consumed by the Workbench** (the existing
engine still decides what a craft makes and how it plays).
