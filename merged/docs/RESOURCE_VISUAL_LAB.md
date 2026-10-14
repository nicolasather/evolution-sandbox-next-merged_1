# Resource Visual Lab (development prototype)

A local-only workbench that asks a local **Ollama `qwen3:14b`** to design wireframe "plates" for 100 resources that are **not** in the game, renders them with the game's own
plate renderer, and lets you judge them. Nothing here ships: it is not part of the catalogue, not deployed, and the Ollama server is never exposed.

Companion docs: `RESOURCE_VISUAL_SYSTEM_AUDIT.md` (how art works today), `RESOURCE_VISUAL_LAB_SCHEMA.md` (the JSON spec + component catalogue), `RESOURCE_VISUAL_LAB_REPORT.md` (generated results).

## How it works

```
dataset.json ──► prompt (catalogue built from the same tables as the validator)
                   │  Ollama /api/chat  (127.0.0.1 only, timeout, concurrency limit, retries)
                   ▼
            JSON spec ──► validate (closed catalogue, clamp / reject) ──► compile (pure TS geometry)
                   ▲                                                         │
        feedback on rejection (≤ 3 attempts)                       SVG inner markup in the art grammar
                                                                             ▼
                                   metrics + quality gate ──► results/<id>.json   (failures are recorded as failures)
                                                                             ▼
                                   gallery → components/Plate3D (the real renderer)
```

Model output is **data**, never code: only component ids and bounded numbers survive validation; the compiler is deterministic.

## Run it (Windows PowerShell, from `merged/`)

```powershell
npm ci                              # if node_modules is missing
npm run lab:test                    # unit tests for the lab (no Ollama needed)
npm run typecheck
ollama pull qwen3:14b               # once; Ollama must be running locally
npm run lab:check                   # connection + model + one smoke call (exit 0 only if usable)
npm run lab:generate -- --limit 3   # try 3 resources first
npm run lab:generate                # all 100 (resumes: skips ones already generated; --retry-failed, --force, --only vl_a,vl_b, --category A)
npm run lab:sheet                   # dev-data/visual-lab/contact-sheet.svg (all 100 cells; failures drawn as failures)
npm run lab:report                  # docs/RESOURCE_VISUAL_LAB_REPORT.md from what is actually stored
```

Gallery (local dev server): add to `.env.local`

```
VISUAL_LAB=true
ENABLE_DEV_TOOLS=true
# optional: OLLAMA_URL=http://127.0.0.1:11434  OLLAMA_MODEL=qwen3:14b  OLLAMA_TIMEOUT_MS=240000  OLLAMA_CONCURRENCY=1  OLLAMA_MAX_ATTEMPTS=3
```

then `npm run dev` and open <http://localhost:3000/admin/visual-lab>. `npm run lab:fixtures` (optional) stores 8 **hand-authored** reference plates, labelled FIXTURE everywhere and never counted as AI output.

## Gallery

View all · filter by category / state / review · search by name · enlarge (real 3D plate) · compare with any existing resource (defaults to *Plant Thread*) · JSON spec · validation warnings, per-attempt log, last raw reply · automated metrics · regenerate one resource · approve / reject with 1–5 scores and a note (stored in `dev-data/visual-lab/reviews.json`).

## Safety rules (enforced in code and tests)

| rule | where |
|---|---|
| Open only if `VISUAL_LAB=true` **and** `ENABLE_DEV_TOOLS=true`, `NODE_ENV≠production`, not on Vercel (`VERCEL_ENV` production/preview, or `VERCEL` outside `vercel dev`), request host is loopback | `lib/devlab/gate.ts`; page and API return a plain 404 otherwise |
| Mutations need `x-visual-lab: 1` and a same-origin loopback `Origin` | `lib/devlab/server.ts` |
| `OLLAMA_URL` must be loopback; anything else throws | `lib/devlab/ollama.ts → assertLoopbackUrl` |
| Bounded time, bounded concurrency (default 1), transport retries, validation-feedback retries (≤ 3) | `OllamaClient`, `generateResource` |
| AI output validated; unknown components/params rejected or ignored; numbers clamped; size capped | `lib/devlab/schema.ts` |
| Failures are stored with reasons; no placeholder/icon is drawn in their place | `generateResource`, contact sheet, gallery |
| Tools refuse on Vercel/production; `generate` stops before writing anything if Ollama is not ready | `tools/devlab/*` |
| `.vercelignore` excludes the lab from CLI uploads (Git-connected deploys include inert, 404ing code) | `.vercelignore` |
| Lab IDs are `vl_*`, validated against a path-traversal regex | `lib/devlab/store.ts` |

## Quality evaluation

**Automated (measured by code, `lib/devlab/metrics.ts`)** — geometric detail (parts, layers, paths, segments, dots, component kinds), composition (bbox, centre offset, ink coverage of a 16×16 grid, margin),
rendering correctness (finite numbers, geometry inside the plate box, markup contains no scripts/links), uniqueness (silhouette-grid overlap with the nearest other plate), style proxy (statistical distance to the 918 hand drawings),
runtime (spec→markup compile time in Node). A quality gate rejects obviously broken output (too few paths for the target complexity, near-empty, off-canvas, non-finite).

**Manual (you, in the gallery)** — recognisability, style fit, detail, uniqueness, composition: 1–5 scores + approve/reject. **Not measured:** per-frame browser cost (the gallery shows live `buildModel` time per plate; nothing is stored).

## File map (all new)

`lib/devlab/` — `geom`, `params`, `components/*` (38 procedural components), `schema`, `compile`, `metrics`, `prompt`, `ollama`, `store`, `gate`, `server`, `preview`, `fixtures`, `types`, `__tests__/*` ·
`components/devlab/Gallery.{tsx,module.css}` · `app/admin/visual-lab/page.tsx` · `app/api/dev/visual-lab/route.ts` · `tools/devlab/*` · `dev-data/visual-lab/dataset.json` · `.vercelignore`.
