# Phase 2 status — Live Discovery sidecar, asset pipeline, mode packets

Last updated: 14 Oct 2026. Branch/SHA: **BLOCKED in the sandbox** (no git repository here; the owner commits through GitHub
Desktop — record the SHA in the table at the bottom after the commit). **No production deploy was done. No paid service was created.**

Legend: PASSED = proven by the command shown · BLOCKED = needs an owner account/key/decision (see `docs/PHASE2_OWNER_STEPS_VI.md`) ·
NOT RUN = not executed · FAILED = executed and failed. A mock/fake result is never reported as a real-provider PASSED.

## 1. What exists

* `lib/server/creative/*` — the sidecar. Gate order, cheapest first, all before any paid call:
  release pin → canonical recipe first → deterministic impossibility filter → bounded verified target pool (≤12) → flags →
  negative cache → per-actor quota → global compute dedup (lease) → atomic budget reservation (advisory lock, default cap **0 USD**) →
  one model call (12 s abort, 1 retry for retryable errors only, never for "billable unknown") → strict parse → judge →
  independent validator → **private** proposal. Nothing is live until: human approval → immutable release (SHA-256 manifest) → deploy → activation; rollback = pointer swap.
* `db/migrations/001–004` — schema `creative` (releases, routes, proposals, compute, negative cache, ledger, assets, mode packets, audit) with SQL-level guards.
* Assets: durable leases (`SKIP LOCKED`), write-once provider task id, GLB validation, human review, manifest; Mock + Meshy adapters; Vercel Blob store.
* Mode packets (8 modes): the model returns only `approvedItemIds` (from a server pool of 10–30 verified items) + flavour text. The server derives seeds/scenarios; independent solvers certify 20 seeds; stored `certified`; a human approves + publishes. The Humanity Museum is never AI-published (SQL + static tests).
* Browser: `lib/creative/client.ts`, `lib/content/releaseManifest.ts`, `lib/visuals/*`, `lib/modes/packets.ts`, `Workbench.tsx`, `Reconstruction3D.tsx`, `ModeHub.tsx` — each behind a `NEXT_PUBLIC_*` flag that is OFF by default and fail-closed.
* Flags, all OFF by default: `CREATIVE_LLM_ENABLED, CREATIVE_PUBLIC_ROLLOUT, MODE_AI_ENABLED, ASSET_AI_ENABLED, NEXT_PUBLIC_CREATIVE_UI, NEXT_PUBLIC_ASSET_UI, NEXT_PUBLIC_MODE_PACKETS`; `CREATIVE_DAILY_USD_CAP=0`.

## 2. Verification evidence (container, 14 Oct 2026)

| Command | Result | Exit |
|---|---|---|
| `npx tsc --noEmit -p .` | no errors | 0 |
| `npx eslint .` | 0 errors; 5 warnings, all in Phase-1 `lib/glyphs.ts` (not touched by Phase 2) | 0 errors |
| `npx jest` (jsdom + node) | 153 suites, **1285 tests passed** | 0 |
| `npm run test:db` (PGlite 0.5.9 = real PostgreSQL engine, WASM) | 9 suites, **113 tests passed** | 0 |
| `TEST_DATABASE_URL=postgres://…@localhost:5499/es_test npm run test:db` (**real PostgreSQL 16.15 server**, production `pg` adapter) | 9 suites, **113 tests passed** | 0 |
| `npm run db:migrate` twice on real PG 16.15 | 001–004 applied, then "already applied" (idempotent, checksummed, CRLF-safe) | 0 |
| `npm run release:check` | OK, 0 routes, sha256 `86604a742645f62df85c8b23fb3a8ede69e88073a9a7e2fc1ab0faabd99cb9ed` | 0 |
| `python3 tools/validate.py` | errors: none | 0 |
| `npm run content:test` (Python unittest) | 28 tests OK | 0 |
| Real Next dev server + real PG 16.15 + HTTP (try-recipe, admin, mode-packets generate→approve→publish→export, kill switch) | all expected status codes (see §5) | — |
| Playwright/Chromium against `next dev`, provider OFF | page renders, `/api/creative/try-recipe` → 503 `{"kind":"unavailable"}`, all admin/internal routes 404, no uncaught page errors; same with every `NEXT_PUBLIC_*` UI flag ON and backend OFF | — |
| `next build` | **NOT RUN** in the sandbox (Google Fonts blocked). Owner: run `npm run build` locally / Vercel build log. | — |

Versions: Next 16.3.6 · React 19.3.0 · TypeScript 6.0.3 · Jest 30.5.2 · Node v22.22.0 (sandbox) · Python 3.13.16 · `pg` 8.23.1 · `zod` 3.25.76 · `@anthropic-ai/sdk` 0.133.0 · `@vercel/blob` 2.8.1 · `@electric-sql/pglite` 0.5.9.
Model: **no model id was called.** `CREATIVE_MODEL_ID` must be copied by the owner from the provider console; the code accepts only a syntactically valid id and never guesses one. Meshy adapter follows docs.meshy.ai/en/api/text-to-3d (read 2026-10-14); not called.
Migrations: 001_phase2, 002_guards, 003_asset_guards, 004_mode_packets.

## 3. Ticket matrix (069–100)

| # | Ticket | Status | Evidence / what is left |
|---|---|---|---|
| 069 | Baseline + Phase-1 freeze | PASSED (code) · git branch/SHA BLOCKED | Baseline release SHA above; originals backed up; Phase-1 suites still green. Owner creates the feature branch + records SHA. |
| 070 | Recipe v2 key parity | PASSED | `preflight.test.ts` golden fixture shared with Python; SQL function parity in `migrations.db.test.ts`. |
| 071 | HTTP schema, server-only entry | PASSED | `handler.db.test.ts`, `client.test.ts`; real server probe §5. |
| 072 | Canonical-first | PASSED | 100 sampled canonical recipes → `known`, 0 provider calls. |
| 073 | Impossibility filter | PASSED | 400 deliberate negatives rejected, 0 provider calls; ≤5 % of 5000 random attempts reach a model (measured ≈1.2 %). |
| 074 | Approved target retrieval | PASSED | Bounded ≤12, verified-only, era-ordered, explained, deterministic. |
| 075 | Decision contract + fake | PASSED | 18 malformed/hostile outputs refused; `none` is first-class. |
| 076 | SQL migration + parity | PASSED (PGlite + real PG 16.15) · managed cloud DB BLOCKED | §2. |
| 077 | Global compute dedup | PASSED | 1000 identical concurrent attempts → exactly 1 winner (both engines). |
| 078 | Negative cache | PASSED | Keyed by release + rules version. |
| 079 | Spending reservations + kill switch | PASSED | 200 concurrent reservations of 0.05 USD never exceed the cap (`stores.db.test.ts`); `load.db.test.ts` 200 concurrent distinct attempts never exceed cap; cap 0 and kill switch → 0 provider calls; UTC-day boundary bug found and fixed. |
| 080 | Proposal persistence + inbox | PASSED | `stores.db.test.ts`, `admin.db.test.ts`. |
| 081 | Optimistic approval + constraints | PASSED | Stale `expectedVersion` → 409; SQL rejects illegal transitions. |
| 082 | Immutable release compiler | PASSED | `release:compile` / `release:check`; manifest SHA over canonical routes; activation + rollback pointer swap tested. |
| 083 | Legacy save compatibility | PASSED | `lib/content/__tests__/release083.test.ts` (saves v1/v2/v3/v5 load identically with a release applied; canonical recipes unchanged; unknown/self/duplicate routes ignored) + Phase-1 `oldSaves.test.ts`. |
| 084 | Real structured LLM adapter | PASSED (offline, SDK mocked) · real call **BLOCKED** | Needs `ANTHROPIC_API_KEY`, `CREATIVE_MODEL_ID`. |
| 085 | Prompt + cross-check policy | PASSED | `llm.test.ts`: 100-case hand-audited borderline corpus (50 accepted, 50 refused incl. embedded instructions); judge + independent validator. |
| 086 | Auth, quotas, CSRF, privacy | PASSED for: Origin == Host, Sec-Fetch-Site, JSON-only, burst limit, hashed salted actor, owner Bearer gate closed on production, no env leakage, fake admin flag in body → 401/404. **BLOCKED**: signed-cookie sessions, reviewer roles, owner MFA need an owner-chosen auth provider (not selected). |
| 087 | HTTP fallback + observability | PASSED (offline + Chromium smoke with provider off). Drag-and-drop craft in a real browser: **NOT RUN** (canvas drag; covered by jest client/component tests) — owner to click-test on Preview. | Metrics endpoint shows counters, latency, dedup ratio, spend. |
| 088 | Visual resolver + hashing | PASSED | `lib/visuals/__tests__`. |
| 089 | Asset scheduler/leases | PASSED | 100 identical enqueue → 1 job; SKIP LOCKED leases; write-once task id; budget-gated. |
| 090 | 3D provider adapter + mock | PASSED mock · real Meshy **BLOCKED** | Needs `MESHY_API_KEY`, spend allowance. |
| 091 | GLB validation | PASSED | `glb.test.ts` (bad magic, truncated, wrong length, oversize, NaN positions, out-of-range indices, 300-corruption fuzz never throws). |
| 092 | Blob storage, review, publish | PASSED (memory store) · real Blob **BLOCKED** | Needs `BLOB_READ_WRITE_TOKEN`. |
| 093 | Mode packet shared gateway | PASSED | `modes.db.test.ts` (33 tests). |
| 094 | Survival + Civilization | PASSED | Solvers certify 20 seeds; negative tests. |
| 095 | Archaeology, Decipher, Escape | PASSED | Escape: digits and authored answers in flavour refused. |
| 096 | Alien, Reverse, Minimum Path | PASSED | Server-derived targets; BFS oracle. |
| 097 | Museum, cross-mode saves, copy | PASSED | `phase2Isolation.test.ts` (static import scan + golden digest of `data/museum`), SQL guard on `museum-draft`, `packets.test.ts` (hash verify, release mismatch, opt-out, pin), `ModeHub*.test.tsx`. |
| 098 | Load / concurrency / budget / adversarial | PASSED | `load.db.test.ts`: 3000 mixed attempts, 200 concurrent, cap 0, kill switch, outage, SQL-injection / path / bidi / injection strings. |
| 099 | Owner-approved staging + real provider smoke | **BLOCKED** | No staging DB, key, Blob, Meshy, preview URL. Dry-run on a local real PG 16 + Next server done (§5). Steps: `docs/PHASE2_OWNER_STEPS_VI.md`. |
| 101 | Owner extension: item onboarding (new verified item → 3D job + private route proposals; modes pick it up) | PASSED offline (13 DB tests on PGlite and real PG 16, UI test) · real model/Meshy **BLOCKED** | `docs/ITEM_ONBOARDING.md`, `onboard.db.test.ts`, `OnboardPanel.test.tsx` |
| 100 | Production readiness audit | **INCOMPLETE — production blocked** | Mandatory real-service proof (099) missing; see §6. |

## 4. Budget and safety data

* Default daily cap 0 USD ⇒ no call possible. Reserve per call 0.02 USD (configurable). Unknown-cost outcomes are booked at the reserve and counted as spent.
* Kill switch: one SQL flag, checked inside the reservation transaction; `POST /api/admin/creative/kill-switch`.
* Spend ledger and day boundary are UTC, with explicit timestamptz bounds (independent of DB session timezone).

## 5. Local end-to-end dry run (real PostgreSQL 16.15 + real Next dev server, fake model)

known recipe → 200 `known` (target not disclosed) · wrong release → `release_mismatch` · missing Origin → 403 · admin without token → 401 · admin with token → 200 · mode packet generate → `certified` · publish before approve → 409 · approve → publish → export contains it · `museum-draft` → 400 · kill switch on → generate 503 `kill_switch` · off → restored.

## 6. Production-readiness audit (ticket 100)

| Item | State |
|---|---|
| AI can be turned off without disrupting the game | PASSED (flags, cap 0, kill switch, outage tests) |
| Status matrix + exact commands/exit codes | this file |
| Rollback artifact | previous release row + `alt_routes.json` in git; `activateRelease` pointer swap tested |
| Monitoring / budget alert | metrics endpoint exists; external alerting + provider-side spend limit: **BLOCKED** (owner) |
| Incident drill (outage, kill switch, rollback) | scripted in `LIVE_DISCOVERY_RUNBOOK.md`; offline drill PASSED, real drill **BLOCKED** |
| Privacy | provider payload contains only item names/eras/rationales from curated data; no user text, no IP (salted hash only) |
| Auth | owner Bearer gate only; production admin intentionally closed; real auth provider **BLOCKED** (decision) |
| Real LLM / DB / Blob / Meshy proof | **BLOCKED** ⇒ per spec: declare incomplete, block production |
| Distinct owner production sign-off | **NOT RUN** |

## 7. Record to fill after commit

| Item | Value |
|---|---|
| Feature branch | |
| Git SHA | |
| Preview URL | |
| Owner sign-off (staging) | |
| Owner sign-off (production) | |
