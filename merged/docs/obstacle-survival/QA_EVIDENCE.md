# Obstacle Survival – acceptance evidence (131 criteria)

Legend: **V** = verified by an automated test run in this workspace · **P** = partly verified (what is missing is stated) · **N** = not verified here · **B** = blocked on the owner (hosted gate).
"Local" means jest / PGlite (in-process Postgres) / Playwright against `next dev` with UI states built by the real engine. **Nothing in this table was run against the hosted Supabase project or the Vercel deployment.**

| IDs | Topic | Status | Evidence / gap |
|---|---|---|---|
| OS-001..011, 014, 016 | Setup, lobby, role pick, desktop/phone traversal, checkpoint shop, barrier question, teacher console, projector, win/finish results, tutorial, leaderboard | **P** | `tests/e2e/os-ui.spec.ts` renders 8 phases at 360/390/768/1280/1440/1920 and host + projector at 1440/360 from engine-built snapshots; `components/quiz/os/__tests__/OSGame.test.tsx` (17 tests) checks actions and copy. Screenshots are full-page; 1280×720 and 390×844 viewports are not captured at those exact heights. No real hosted room was driven. A separate "loss" results screen does not exist: results show rank/outcome (`winner`/`escaped`/`partial`). |
| OS-012, 013 | Error state, reconnect overlay | **P** | Error rendering is component-tested; the connection badge/paused view is rendered, but a real network drop was not exercised in a browser. |
| OS-015 | Four-map gallery | **P** | Practice map picker (`/quiz/os/practice`) covered by Playwright. |
| OS-017..039 (odd) | 12 hazards validated server-side | **P** | Generic: wall fuzz (20 000 ticks), 100-tick replay, 2 000-tick stress, hazard-effect tests (`physics.test.ts`), 1000 seeds × 4 maps solved by the solver *and* by a closed-loop bot on real physics (`course.test.ts`). There is no dedicated per-hazard property test for each of the 12 kinds. |
| OS-018..040 (even) | Hazard animation states | **P** | `render.ts` draws idle / warn (dashed + "!") / active for all 12; the Hazard guide is keyboard-tested; screenshots exist. Frame-by-frame capture and a reduced-motion frame comparison were not done. |
| OS-041..049 (odd) | 5 roles solo | **P** | Bot rotates all roles over 1000 seeds on real physics; abilities and cooldowns tested in `physics.test.ts`/server DB test. No separate per-role "3 maps solo" simulation file. |
| OS-042..050 (even) | Ability communication | **P** | Role icon/tooltip/disabled reason are rendered and component-tested for the shared ability button, not per role. |
| OS-051..070 | Adversarial security | **V** (local) | `engine.test.ts`, `physics.test.ts`, `server.db.test.ts` carry the OS-id in test names: foreign token 051, forged correct 052, duplicate credit 053, duplicate/concurrent spend 054 (50 simultaneous purchases), future/old tick 055/056, teleport 057, wall 058, cooldowns 059/060, cross-room/revoked projector link 061, host-only controls 062, kicked seat 063, oversize 064, 21st seat 065, wrong phase 066, late answer 067, underflow 068, answer-key secrecy 069, race 070. |
| OS-071..075 | Coop with 1–5 players end to end | **P** | A full 6-chapter match through the real DB functions is run in `server.db.test.ts`; engine match runs through every phase. Not parameterised over 1..5 players and not in a real browser. |
| OS-076..079 | Relay fairness 1v5, 2v2, 3v4, 4v5 | **V** (engine) | `test.each` in `engine.test.ts`; plus deterministic tie-break test. |
| OS-080..084 | 5 native question kinds | **V** (local) | `server.db.test.ts` grades every kind through the existing answer pipeline; secrecy until reveal checked. Accessible UI for each kind is the existing quiz component set (not re-audited). |
| OS-085, 087, 088, 095, 096, 097, 098, 099, 110 | Freeze, pause, CAS conflict, join-full, cleanup, grade trust, pool shortage, projector secrecy | **V** (local DB) | Named in `engine.test.ts` / `server.db.test.ts`. |
| OS-086, 089..094, 100..109, 111 | Late submit, host return, network loss, refresh, duplicate click, normalisation, render-speed, reduced motion, touch/controller, 360/1920, captions, tutorial replay, nickname, QR | **P / N** | Late submit, duplicate purchase, normalisation, touch, 360/1920 layout, tutorial and reload-keeps-answered are covered locally. Not done: real multi-client browser runs for network loss mid-answer/mid-batch, host exit/return, QR join without email, question media captions. |
| OS-113, 114 | No rewarded demo; no Evolution Sandbox regression | **P** | Practice awards nothing and calls no API. Full jest suite (214 suites, 2475 tests) passes, which includes existing Evolution Sandbox/TD/Swarm tests; no browser regression run of Evolution Sandbox. |
| OS-115 | 1000-seed solvability sweep | **V** | `course.test.ts` (solver and bot). |
| OS-116, 117 | 100-tick replay, 2000-tick stress | **V** | `physics.test.ts`. |
| OS-118 | 20 students × 15 min | **N** | Not run. |
| OS-119, 120 | 250 ms latency, 5 % packet drop | **P** | Predictor/batch tests prove replay equivalence and no gaps (`predict.test.ts`); no network-condition simulation was run. |
| OS-121 | Hidden-tab restore | **N** | Catch-up is lazy by design, but a browser visibility test was not written. |
| OS-122 | Sound off by default | **V** | Component test + prefs default. |
| OS-123 | Keyboard-only completion | **P** | Keyboard movement/hop/ability/answer tested; a full keyboard-only match was not run. |
| OS-124, 125 | Focus state, high-contrast/greyscale | **P** | Focus rings and high-contrast/simple-graphics prefs exist; no automated WCAG scan or greyscale capture. Squad identity uses shape + dashed/solid ring, not colour alone. |
| OS-126 | No licensed external assets | **V** | All art is the supplied SVG/PNG/GIF set; no external fonts/images added. |
| OS-127 | All graphic buttons are real | **P** | Buttons are real `<button>`s with labels (component tests); no automated sweep. |
| OS-128 | API 400/401/403/409 | **P** | Covered across the DB tests (400 oversize/invalid, 403 foreign/kicked/host, 409 race/full/stale). No table-driven test over every route. |
| OS-129 | Migrations reversible | **V** (local) | `server.db.test.ts`: up → down → up on PGlite; 007/008 coexist. |
| OS-130 | Secrets never bundled | **P** | No new env vars or secrets; no bundle scan beyond the build. |
| OS-131 | Migrations applied in staging | **B** | Not applied anywhere. Owner approval needed. |

OS-112 (host reward anti-farm): **N** — this mode grants no host reward; nothing was added and nothing tested.

## Addendum — OS-F07 (honest hosted QA)
Evidence after the OS-F01…F06 fixes: engine and component tests, the PGlite database test (`npm run test:db -- lib/quiz/os`) and the Playwright UI spec against engine-built mock snapshots. **Not done:** no hosted Supabase migration, no deployed build of these fixes and no multi-device run were performed; the two supplied Vercel URLs were only fetched read-only and do not contain this branch. Hosted readiness is therefore **unproven**.
