# Acceptance evidence (maps to 04_QA/ACCEPTANCE_MATRIX.md, 107 criteria)

Legend: **P** proven by an automated test run here · **L** proven locally only (real browsers + real worker on this machine, in-memory or local Postgres) · **U** unit/static only · **O** open (needs deployment, hosted DB, devices or owner action).
Nothing is production-verified: no worker is deployed and migration 008 is not applied to the hosted project.

| Group | Result | Evidence |
|---|---|---|
| BASELINE-01..06 | L | Production-build run of `td-practice.spec` (hub/modes/library) and `swarm-survival.spec`; Swarm is not in the projector `GAME_KEYS`; gallery card and `/quiz/swarm` have their own URL. Projector-lab spec not re-run after the Swarm commits (O). Evolution Sandbox routes untouched (no diff). |
| HOSTING-01..12 | HOSTING-01 (real quiz) L via `PgSource` DB tests; 02 (insufficient questions) P `routes` tests; 03–05 P `configSchema` tests; 06–09, 11 L (teacher-console E2E: lock, remove, pause, resume, end with confirmation); 10 P `core.test`; 12 P (expiry in `ws.test`) | `lib/swarm/__tests__/core.test.ts`, `server/__tests__/*`, E2E |
| ROLES-01..12 | P (01 distinct silhouettes: L visual) | `core.test`, `roles.test` (rebalance regression), `client.test` (input normalisation), E2E phone layout (stick, ability) |
| GAMEPLAY-01..12 | P | `core.test` (73), `BALANCE_REPORT.md`, `ROLE_REPORT.md` |
| QUESTION-01..15 | P; 01 L in browser for all five kinds | `net.test` (no key in any viewer), `ws.test`, E2E question freeze (state unchanged, key not in DOM) |
| NETWORK-01..15 | P in worker/DB suites; 02 L via `LOAD_REPORT.md` (3 rooms × 20 sockets); 11 U (packet loss simulated at the protocol layer, not on a lossy link); 10 policy in `DEPLOYMENT.md` | `ws.test`, `store.db.test` (fencing, exactly-once, immutability), `client.test`, load tool |
| ART-01..13 | L: `prod-*` screenshots at 375×667, 390×844, 768×1024, 1280×720, 1920×1080, 640×360 (lobby, wave, question; draft and results are in the E2E run, not re-shot per device) in `docs/swarm-survival/screens`; 03/04 by construction (original canvas drawing, no faces); 09 and 10 P unit; 11 L; 12 (200% zoom, 640×360 emulation) L: question panel fits width, no horizontal scroll, page scrolls to it; site header/footer share the screen | `render` library, `prefs.ts`, E2E |
| SAFETY-01..10 | 01, 03, 05, 07 P; 02 P (join/answer rate limits in worker); 04 by design (no chat, no location); 06 and 08 U; **09 O** (consent/documentation is an owner decision); 10 P (no secrets in diff; dev secret only under `SWARM_DEV`) | `ws.test`, routes tests |
| RELEASE-01 typecheck | P | `tsc --noEmit` clean |
| RELEASE-02 lint | P for everything touched (0 errors); 6 pre-existing errors elsewhere (devlab Gallery, EscapeRoomMode, a `.backup_phase1_gap` copy) | `npm run lint` |
| RELEASE-03 | P | `npm run test:swarm`; full `jest`: 2329 tests pass (one museum suite timed out once under load, passes alone) |
| RELEASE-04 | P local Postgres 16 and PGlite | `npm run test:db`: 16 suites / 189 tests |
| RELEASE-05, 06 | L | `npm run swarm:e2e` (desktop + Pixel 7), also against `next build --webpack` + `next start` |
| RELEASE-07 | P | `ws.test` crash/restart replay |
| RELEASE-08 | O | CI/Vercel build not observed from here; local production build succeeds |
| RELEASE-09 | P | `DEPLOYMENT.md`, `008_swarm_survival_down.sql` |
| RELEASE-10 | L | two real browsers against the real worker |
| RELEASE-11 | P | this document |
| RELEASE-12 | P | final report |

## How to reproduce
```
npm run test:swarm
QUIZ_TEST_DATABASE_URL=… npm run test:db          # disposable DB only
npm run swarm:build
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<mock> NEXT_PUBLIC_SWARM_URL=http://localhost:8799 npx next build --webpack   # only where Google Fonts is unreachable
E2E_BYPASS_CSP=1 PW_CHROMIUM=<chrome> npm run swarm:e2e
```
`E2E_BYPASS_CSP` is needed only for `next dev` (dev needs eval). The production CSP (`next.config.ts`) adds the origin of `NEXT_PUBLIC_SWARM_URL` (http/https and ws/wss) to `connect-src`, nothing else.
