# Resource visual system — audit

Scope: how a resource (a node in `data/db.json`) gets its picture today, and where an AI-generated visual prototype can plug in
**without touching production behaviour**. Written for Task 1 (100-resource AI visual generation prototype).
Everything below was read from the repository (application root `merged/`); figures marked *measured* were computed from `data/art.json` /
`data/db.json` with the same code the lab uses (`lib/devlab/metrics.ts → referenceStyle`).

## 1. The catalogue

- `data/db.json`: **918 nodes**, 13 categories (material 168, technique 75, technology 379, biology 81, knowledge 88, society 21,
  engineering 21, computing 21, culture 16, media 16, science 15, economy 10, energy 7), 14 eras. Each node carries `id`, `n` (name),
  `cat`, `vis` (visual key), dates, rarity and two description levels.
- `data/art.json`: **918 hand-authored drawings**, one per node (*measured*: 918 keys, 918 nodes with art, 0 orphans). No node falls back to the
  generic grammar today.
- `lib/processing/art.ts → EXTRA_ART`: a `Record<string,string>` of additional/"worked state" drawings (stick, bark, strands, seed, cleaned_stone, …). It is
  consulted **before** `art.json`, and it is a plain mutable object — that is the extension point the lab uses client-side (see §6).

## 2. The drawing language (what "existing artwork style" means)

Every drawing is inline SVG *inner markup* in a 100×100 box, drawn with `currentColor` strokes (no fills except accent dots):

| property | value (*measured over the 918 drawings*) |
|---|---|
| paths per drawing | median 13 (90th percentile ≈ 40), markup median 1.3 KB (max 5.6 KB) |
| depth layers | 98.7 % of drawings use two or more `<g data-z="…">` groups (915 of 918 contain `data-z`) |
| line weights | 75 % of paths carry an explicit `stroke-width` below 2 (typically 1.2 detail / 1.4–1.6 body); the default is 2 |
| opacity | 58 % of paths carry an `opacity` attribute (≈ 0.3–0.6 for secondary detail) |
| accent dots | 34 % of drawings include `<circle … fill="currentColor" stroke="none">` sparks |
| vocabulary | `path`, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`; cubic Béziers, arcs, straight facets, hatching |

## 3. Rendering pipeline

1. **Lookup** — `lib/glyphs.ts → build(node)`: `EXTRA_ART[id] ?? ART[id]` → else the procedural *grammar* `S[node.vis]` → else a per-category
   `FALLBACK` (`culture`, `society`, `science`, … each a couple of generic primitives such as rings, dots, teeth). `markup(node)` exposes the inner
   markup; `svg(node, opts)` wraps it in a flat `<svg>` with `stroke="currentColor"`.
2. **Model** — `lib/plate3d.ts → buildModel(key, markup)`: mounts the markup in a hidden `<svg>`, samples every shape with
   `getPointAtLength()` mapped through `getCTM()`, extrudes each polyline into a front and back contour joined by struts at corners, adds
   `<circle fill="currentColor">` as dots, sums `data-z` and multiplies `opacity` up the tree. Hard budget `MAX_POINTS = 5200`. Results are cached by
   `key` (so changed art needs a new key). Browser-only.
3. **Canvas** — `components/Plate3D.tsx`: Canvas 2D, hand-rolled perspective (focal 230), floating bob/sway, drag to spin, drifting particle cloud
   (seeded from the key), floor shadow, glow. Colours from the theme tokens `--plate-line`, `--plate-spark`, `--plate-glow`. The flat SVG is
   rendered first (SSR/no-JS/jsdom) and swapped when the canvas has drawn a frame. Reduced-motion and off-screen throttling are handled.

So the look of "Plant Thread No. 315" is not a shader or a texture: it is **hand-authored SVG line art → sampled wireframe → perspective canvas**.
Any generated art that wants the same look must enter at step 2 as SVG markup in this grammar.

## 4. The other 3D path (not the target)

`lib/visual3d/*` + `components/Reconstruction3D.tsx` is a separate system: shaded low-poly meshes built from 16 archetypes
(blade, hafted_tool, axe, vessel, brick, wheel, bead, circuit, plant, …) and material families, rendered with OGL/WebGL, with a flat
silhouette fallback. It produces solid shaded objects, **not** thin glowing wireframes, so it cannot reproduce the plate style.
`lib/visuals/resolver.ts` fixes the order of authority: curated hand art → reviewed published generated asset (manifest + owner flag) →
Phase 1 procedural reconstruction → glyph. Hand art always wins; the lab does not alter this order.

## 5. Existing AI / dev conventions (reused, not modified)

- Server AI exists for recipes (`lib/server/aiRecipeProvider.ts`) and a gated Phase 2 sidecar (see `docs/PHASE2_STATUS.md`); none of it generates plate art
  and none talks to a local Ollama. The lab does not call or change it.
- Dev gating convention: `lib/dev/env.ts` (`ENABLE_DEV_TOOLS` and never `VERCEL_ENV=production`), `lib/server/ownerAuth.ts → gateOpen`,
  `app/admin/visual3d/page.tsx` (404 when closed), `app/api/dev/status/route.ts` (plain 404 when closed). The lab follows the same shape and is
  stricter (§6).
- Tooling: Next ^16, React 19, TypeScript strict + `noUnusedLocals/Parameters` + `isolatedModules`, jest (jsdom, `babel-jest` with `next/babel`, `@/` alias), CLI
  tools through `tsx`. `tsconfig.json` includes `**/*.ts`, so lab tests/tools are type-checked by `npm run typecheck`.

## 6. Findings that shaped the design

| finding | consequence |
|---|---|
| The style is a drawing *grammar*, and `buildModel` accepts any markup in it | The model must not emit SVG or code. Qwen emits a small JSON spec; `lib/devlab` compiles it to this grammar deterministically. Nothing generated is ever executed. |
| Free-form SVG from an LLM is unreliable (broken paths, off-canvas, wrong weights) | A closed catalogue of procedural components with bounded numeric parameters (38 components; see `RESOURCE_VISUAL_LAB_SCHEMA.md`) does the geometry; the model only chooses, places and tunes. |
| `buildModel` caches by key | Lab plates are registered under versioned keys (`lab_<id>_v<n>_<source>`), so regenerating shows the new drawing. |
| `EXTRA_ART` is a mutable map consulted first | The lab page injects lab markup into it **in the browser tab only**; no file in `data/` or `lib/processing/` is written. |
| 98.7 % of hand art is multi-layer | Prompt demands 2–4 `data-z` layers; the compiler emits `<g data-z>` per layer. |
| Hand art is sparse (median 13 paths) but "intricate" plates exist | The automated style proxy penalises only drawings sparser than the median or far denser than the 90th percentile (×3); intricacy is not penalised. |
| `.env.example` ships `VERCEL_ENV=development` | The lab's Vercel check treats `development` as local and refuses `production`/`preview` (and `VERCEL` set outside `vercel dev`). |
| The app has a strict CSP (`connect-src 'self'`, no remote scripts) | The gallery talks only to its own `/api/dev/visual-lab`; the server calls Ollama. The browser never contacts Ollama. |

## 7. What the prototype adds and what it deliberately does not touch

Added (all new files; see `docs/RESOURCE_VISUAL_LAB.md` for the list): `lib/devlab/**`, `components/devlab/**`, `app/admin/visual-lab/**`,
`app/api/dev/visual-lab/**`, `tools/devlab/**`, `dev-data/visual-lab/**`, docs, additive `package.json` scripts, `.env.example` / `.gitignore` / `CHANGELOG.md` entries.

Not touched: `data/db.json`, `data/art.json`, `data/nodes/*`, recipes and the engine (`lib/engine.ts`, `lib/unlocks/*`, chronology), `lib/glyphs.ts`,
`lib/plate3d.ts`, `components/Plate3D.tsx`, `lib/processing/art.ts`, `lib/visual3d/*`, `lib/visuals/*`. Chronological unlock logic and gameplay recipes are untouched; the 100 lab
resources are **not** catalogue nodes (verified absent by name and id, `dev-data/visual-lab/dataset.json`, enforced by `lib/devlab/__tests__/dataset.test.ts`).

## 8. Risks and limits

- The lab's renderer is the production one, but the *content* is generated, so a plate can look wrong while passing every automated check. Recognisability needs a human (gallery review).
- The component library encodes what *I* anticipated; objects needing shapes outside it will be expressible only through `polyline`/`lathe`/`facets` approximations.
- Performance in the browser (frame cost of the 3D canvas) is not measurable in Node; the gallery shows `buildModel` time live but nothing is stored or claimed.
- `.vercelignore` only affects CLI uploads. A Git-connected deploy of a branch containing these files would include the code, but it is inert there (404s: `VISUAL_LAB` unset and Vercel detected). Do not merge to a Vercel-connected branch unless that is acceptable.
