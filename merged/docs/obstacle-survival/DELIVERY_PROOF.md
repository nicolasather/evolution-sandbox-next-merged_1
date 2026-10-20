# Delivery proof (template: 00_START/DELIVERY_PROOF_TEMPLATE.md)

- **HEAD before / after:** `c9e35f29d89f0ebfbd9a3a4e6895375b377e1813` / unchanged — changes are in the working tree, **not committed** (no commit was requested).
- **Implemented flows:** hub, teacher setup + preflight, create, join (seat cookie), lobby/role pick, preview, countdown, traversal (keyboard + touch), barrier question, reveal, perk shop, pause/resume/lock/skip/end/kick, read-only projector, results/replay, practice (local only). Source: `components/quiz/os`, `app/quiz/os`, `app/api/quiz/os`, `lib/quiz/os`. Screenshots: `docs/obstacle-survival/screenshots/` (fixtures built by the real engine, not a live room).
- **Migrations:** 009 (+ down) **committed: no, applied: no** — written and tested on PGlite only (up → down → up; 007/008 coexist). 008 is also unapplied. Hosted application needs owner approval.
- **Protocol / hosting:** HTTP batches + polling (+ Realtime hint) on the existing Next/Supabase stack; no worker, no paid service, no new secret.
- **P0 commands and results (local, this workspace):**
  - `npx tsc --noEmit` → no errors
  - `npx jest --maxWorkers=2` → 214 suites, 2475 tests passed (before the 4-case relay-fairness test.each was added; `jest lib/quiz/os/__tests__/engine.test.ts` → 32 passed afterwards)
  - `npm run test:db` → 11 suites passed, 129 tests passed, 6 suites / 72 tests skipped by the suite itself; one earlier full run had a single swarm WebSocket timeout under CPU load, which passed on re-run (`--runInBand --forceExit --no-bail`).
  - `npx eslint .` → 0 errors in new code; 7 errors remain in untouched files (`.backup_phase1_gap`, `components/devlab/Gallery.tsx`, `components/escaperoom/EscapeRoomMode.tsx`), all pre-existing.
  - `playwright test os-ui.spec.ts --project=chromium-desktop` against `next dev` → 11/11 passed. The `chromium-mobile` project was not run.
  - `next build` → **fails in this sandbox** only because next/font cannot reach Google Fonts (no network). Not a code error; unverified here — run it on Vercel/CI.
- **Two/four-browser connection tests:** not run (no Supabase available in this workspace). The two-device race is covered at DB level only.
- **Accessibility / screenshots:** 360/390/768/1280/1440/1920 screenshots exist for 8 student phases; host and projector at 1440 and 360. No automated WCAG audit.
- **Profiling:** none beyond the 2000-tick stress test and 1000-seed solver sweep.
- **Known issues:** see QA_EVIDENCE.md (rows marked P/N/B). Notably: no 20-student/15-min run, no latency/packet-loss simulation, no real-room browser E2E, no separate "loss" screen, host-reward not implemented, bottom-nav/touch-bar overlap fix and host select colours fixed after the last screenshot run and not re-captured.
- **Projector/TD regressions:** full jest suite (incl. existing projector, TD, Swarm tests) passes; no browser regression run.
- **Deployment state:** nothing deployed, no migration applied, no secrets touched. Hosted gates (migration 009 on staging/production, hosted smoke, OS-131) are **blocked pending owner approval**.
- **Follow-up commit IDs:** none.
