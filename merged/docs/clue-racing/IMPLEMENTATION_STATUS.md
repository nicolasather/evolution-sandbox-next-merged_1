# Clue Racing (cr/1) — implementation status

Branch `claude/clue-racing`. Status is local only. Nothing was deployed and no migration was applied to any hosted database.

## Built
- Engine `lib/quiz/cr/*`: pure deterministic reducer, 28-station serpentine course, 4 handcrafted maps (Sunleaf Passage, Tideglass Harbor, Copperwind Borough, Starpetal Heights), 3 formats (Split-Route Sprint, Signal Relay, Atlas Circuit), roles by team size (solo_pathfinder for 1; scout / signal_keeper / cartographer / trail_maker / archivist for 2–5), synchronized quiz freezes using the shared grader (5 question kinds), score 60% mastery / 25% route / 15% teamwork, wallet cap 600, perks, bots.
- Server `lib/quiz/cr/server.ts` + routes `app/api/quiz/clue/**`: lazy catch-up, revision CAS, idempotent commands, intent-only input, per-view projections, HttpOnly seat cookie, hashed spectator token.
- Migration `supabase/migrations/011_clue_racing.sql` (+ `_down.sql`).
- UI `components/quiz/cr/*`, pages `app/quiz/cr/**`, `app/quiz/setup/[id]/cr`: hub, 5-stage setup wizard, join/lobby, student play (full-viewport canvas, one Menu button, ≤2 action buttons ≥56 px), host console, projector, results/report, practice (no DB, no login), keyboard + touch, reduced motion, settings.
- Arena Clash audit fixes AC-01/02/03 with tests.

## Tests run locally
- `npx tsc --noEmit`: clean. `eslint` on new code: clean.
- Jest engine (37) + UI (9); PGlite DB tests (6).
- Playwright `tests/e2e/clue-racing.spec.ts` on Chromium desktop + mobile (see RELEASE_EVIDENCE.md for final numbers).

## Known gaps (honest)
- No 8-direction actor poses (CR-134) and role actions lack full windup/use/recovery states (CR-136).
- Audio is a minimal WebAudio beep, off by default.
- No hosted E2E, no multi-student E2E against a real database, no latency/packet-loss run.
- DB tests use PGlite, not hosted Supabase. Migrations 010/011 are not applied anywhere.
- Production site is still the old main; Arena not deployed.
- Arena snapshot still exposes `seed` (outside Clue Racing).
- Firefox / WebKit projects not run.

Per-criterion status: `acceptance.json` (CR-001…CR-174).

## Final local check results
- `next build`: NOT green in this sandbox — it fails only on `next/font` fetching Google Fonts (network allowlist blocks it). No code/type error was reported; `tsc` is clean. Re-run on a networked machine or Vercel preview.
- Full jest: 3 failures, all in Swarm Survival (`lib/swarm`, tests stale against the earlier "solo = one role" change from the Arena base branch); not touched by this work. All Clue Racing/Arena/quiz tests pass (999/999 in `lib/quiz` + `components/__tests__`).
- Playwright Chromium desktop + mobile pass for `clue-racing.spec.ts`.
