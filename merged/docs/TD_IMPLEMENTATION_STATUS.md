# Tower Defense and projector repairs: implementation status

This page lists what was built, what was proven and how, and what is still open. It follows the ZIP's rule: a box counts as done only when
there is test output, a screenshot or database evidence behind it. "Not verified" means the code exists but nothing here proves it works
in that environment.

- Base commit: `61ab6006314cf2fdb2986f1914307b329b9d162c`
- Part A (projector repairs): `ae17247f071ba79aa62fc9186151d1fe36f6f1cf`
- Part B engine, API and migration: `1c0a87ab1d3ffa1b6ae432899e44d828b792d04e`
- Part B screens and art: `7950676707180a1e764e91562ca4bc623d459db9`
- Part B tests, docs and fixes: see `git log` after the commits above. The final commit is named in the hand-off message.

## Migrations: four separate statuses

| Migration | Written | Applied to the local test DB (Postgres 16, isolated) | Applied to staging | Applied to production |
|---|---|---|---|---|
| `006_projector_next_five.sql` (+ `_down`) | yes | yes: applied, rolled back and re-applied by `repairs.db.test.ts` | **no**: no staging credentials in this environment | **no**: the owner must apply it |
| `007_tower_defense.sql` (+ `_down`) | yes | yes: applied, re-applied (idempotent), rolled back and re-applied | **no** | **no**: the owner must apply it |

Until 006 and 007 are applied in Supabase, the deployed site has these limits:
- Creating a Tower Defense room fails with a server error.
- The two projector modifiers fail when used.

The offline practice (`/quiz/td/practice`) needs no database and works without the migrations.

## How to run the evidence

```bash
cd merged
npx tsc --noEmit                                   # types
npx jest                                           # unit + component: 199 suites, 2217 tests, 0 skipped
QUIZ_TEST_DATABASE_URL=postgresql://postgres@localhost:54329/quiztest?host=/tmp/pgdata \
  node --experimental-vm-modules node_modules/jest/bin/jest.js -c jest.db.config.js --runInBand   # 15 suites, 184 tests
#   of which lib/quiz (real Postgres, migrations 001–007): 6 suites, 71 tests
npx next dev -p 3100 &
npx playwright test -c tests/e2e/playwright.quiz.config.ts projector-lab --project chromium-desktop
TD_SHOTS_DIR=$PWD/docs/screenshots/td npx playwright test -c tests/e2e/playwright.quiz.config.ts td-practice \
  --project chromium-desktop --project chromium-mobile
```

The DB tests never touch a hosted database. Each test creates its own rooms in a throw-away local Postgres, built from
`supabase/migrations` plus a small bootstrap of the Supabase roles and `auth.users`.

## Part A: projector games (matrix A)

| ID | Status | Evidence |
|---|---|---|
| PJ-01 gallery and routing | verified | `projector-lab.spec.ts` |
| PJ-02 local full play, all 10 games | verified | `projector-lab.spec.ts` plays every game to its summary (22 tests) |
| PJ-03 signed-in host with a real quiz | **not verified in a browser** | Signed-in tests were skipped as agreed. The server path is covered by `repairs.db.test.ts` on real Postgres. |
| PJ-04 projector secrecy | verified in the DB test | Secrecy sentinels: the seed and answer keys never appear in the snapshot. Bug fixed: the snapshot config used to contain the seed. |
| PJ-05 flow variants | verified | engine tests + `repairs.test.ts` |
| PJ-06 durations | verified | `clock.test.ts`, `repairs.test.ts` (kind-aware timing) |
| PJ-07 repeated command | verified | `repairs.db.test.ts` |
| PJ-08 two host tabs | verified | `repairs.db.test.ts` two-tab race and reconciliation |
| PJ-09 screen sizes | partly | screenshots at 1440×900 and 390×844 |
| PJ-10 preflight race | verified | `ProjectorSetup.test.tsx` (stale preview cannot launch) |
| PJ-11 modifier allow-list | verified | `compat-i18n.test.ts`, `repairs.db.test.ts` (Secret Wager and Steal end to end; others refused by the server) |
| PJ-12 accessibility and English | partly | aria-describedby fixes, English-only copy. No full screen-reader audit. |

## Part B: Tower Defense

### What shipped

- **Formats**:
  - Co-op: one squad of 1–5 students.
  - Competitive: 2–4 squads of 1–5, at most 20 students.
  - Mirrored seeds: every squad faces identical waves.
  - Versus ranking: waves cleared, then core health, then accuracy.
- **Questions**:
  - Synchronized flow: one question for everyone, the battle frozen, the reveal with the explanation, then build.
  - Independent flow: personal questions while the towers defend, capped per round.
  - All five question formats, graded by the site's grader on the server.
  - Speed earns nothing.
  - An optional, labelled review cycle when the quiz is short (only with the teacher's consent).
- **Economy**:
  - Points are the only currency.
  - The squad award is normalised, so squad size does not multiply income.
  - Each credit is applied exactly once (keyed in `td_credits`).
  - Comeback kit, so a squad can never get stuck.
- **Board content**:
  - 6 towers (Bolt, Frost, Ember, Thorn, Arc, Beacon), each with 3 levels.
  - At level 3, choose one of 2 branches.
  - Targeting policies, move and sell.
  - 8 enemies: Drifter, Zipper, Bulwark, Skimmer (flying), Warden (shield), Splitter, Sapper and Colossus.
  - 3 maps (Meadow Circuit, Coral Quarry, Skyworks), each with its own boss: Copper Colossus, Quarry Crawler and Skywork Leviathan.
  - Every boss effect is announced at least one second ahead.
- **Roles**:
  - Architect, Tactician, Artillerist, Alchemist and Warden.
  - Each has a passive and a once-per-wave ability.
  - Roles are optional, duplicates are allowed, and buffs are capped.
- **Server**:
  - Pure, clock-free engine; the server is authoritative.
  - On each request the state catches up, with a bounded number of steps and no timers, which fits serverless.
  - Writes are revision-locked; each command is idempotent per (room, actor, commandId).
  - Waves are deterministic 20 Hz integer simulations. The server computes the result when the wave starts and applies it when the wave ends; browsers replay the same simulation to draw it.
- **Privacy**:
  - Each viewer gets its own projection.
  - A student sees only their own squad's full state; rivals appear as a summary with no points, towers or names.
  - The projector hides stakes, and hides names on request.
  - The seed is never in the state.
  - Answer keys reach the browser only after the reveal, or for the teacher's private peek.
  - The seat secret is an HttpOnly cookie scoped to the room's API path; only its hash is stored.
  - The projector token travels in the URL fragment, and only its hash is stored. Opening a new link revokes the old one.
- **Screens**:
  - Student: lobby with squad, role and ready.
  - Question: full screen, the board not drawn.
  - Review, build drawer with exact costs and refusal reasons, tower card with branches, abilities, Secret Wager.
  - Wave: canvas with an accessible "wave as a list", wave result, rival strip, results with the learning review.
  - Display: calm mode, large text, high contrast, reduced motion.
  - Teacher: console with seats, move/remove, lock, rename, hide names, start with override, pause/resume, +20 s, next phase, end with confirmation, answer counts per squad, purchase approvals, private answer peek, projector link, results with per-student detail and an event-log download.
  - Projector: join code, open question, every squad's board, final standings.
  - Setup wizard: format → squads → length and pacing (live quiz check) → map → options.
  - Offline practice with 12 original sample questions.
- **Entry points**:
  - `/quiz/modes` has an "Online · personal devices" card.
  - `/quiz/library?mode=online&game=tower_defense` → `/quiz/setup/<id>/td`.
  - `/quiz/td` (hub), `/quiz/td/join`, `/quiz/td/practice`.
- **Art**:
  - 81 original SVGs, documented in `public/quiz/td/ASSET_CREDITS.md`.
  - No faces, no gradients, no copied IP.

### Matrix B: engine

| ID | Status | Evidence |
|---|---|---|
| TD-001 determinism | verified | `td.test.ts`: 5,000 seeded fixtures; browser replay equals the server outcome |
| TD-002 one currency | verified | `td.test.ts` economy tests |
| TD-003 pad legality | verified | map validation, occupied pads refused |
| TD-004 towers and branches | verified | every tower to level 3, exclusive branch |
| TD-005 enemies | verified | sim invariants: flying, shields, splitters, armor |
| TD-006 bosses | verified | each phase entered once, warning ≥ 1 s, all three bosses |
| TD-007 team modes and redaction | verified | engine tests and `server.db.test.ts` (co-op with 5 devices; versus with rival summaries only) |
| TD-008 roles | verified | per-role tests; every role finishes a solo 15-minute match standing |
| TD-009 health | verified | no negative HP; a fallen core finishes once |
| TD-010 accuracy economy | verified | wrong or missing answers earn 0; partial credit is proportional; credited once |
| TD-011 fair seed | verified | mirrored squads → identical outcome and a shared placement |
| TD-012 build race | verified on real Postgres | `server.db.test.ts`: 50 concurrent builds on one pad → one paid build, points never negative |
| TD-013 duplicate commands | verified | the same commandId replays without a second effect (DB test); the client ignores older revisions |
| TD-014 restart | by design + DB test | State lives only in `td_sessions`; there is no in-memory singleton. Every DB test runs against a fresh connection. |
| TD-015 idle catch-up | verified | a stale catch-up after two idle minutes never opens a question in the past; the step count is bounded |
| TD-016 long match | verified | a 45-minute match completes in bounded transitions with bounded state |
| TD-017 clock | verified | pause and resume shift every deadline exactly; the client uses the server clock offset |
| TD-018 wrong phase | verified | no building during a question or after the finish |
| TD-019 spoofing | verified | forged seat or team refused; a forged answer is rejected by the pipeline |
| TD-020 reward evidence | partly | Practice awards nothing and saves nothing. No cosmetic rewards exist for TD, so there is nothing to farm. |

### Matrix C: questions

- **Verified**:
  - All five formats, in practice and on the server (graded by `gradeDetailed`).
  - The practice bank passes the site's question schema, and every key grades as correct (`practice-bank.test.ts`).
  - No answer key before the reveal: covered by projection tests and the DB snapshot test.
  - The independent cap per round.
- **Not verified**:
  - Media (image/video) inside TD questions. TD uses the same `QuestionPlay` component as the rest of the site, but it was not tested with media.

### Matrix D: six-browser multiplayer proof

- **Blocked.** The Next server reaches the database only through Supabase's HTTP API, and this environment has no Supabase project or network route to one.
- **What was done instead**, at the server-library level on real Postgres (`server.db.test.ts`):
  - 5 devices join a co-op squad, pick roles and get ready.
  - Real graded answers are credited once.
  - A 50-way build race, a wave and a finish with immutable results.
  - Versus with mirrored waves and rival summaries.
  - Secret Wager settled once.
- **Still needed after the migrations are applied**: one teacher and five student browsers against staging or production.

### Matrix E: screens and viewports

- **Verified**:
  - `td-practice.spec.ts`: 8/8 pass. Practice was played lobby → results by Playwright at 1440×900 (desktop) and Pixel 7 (mobile), with no page errors.
  - The hub, modes card, lobby, question, build and wave screens were captured at 1920×1080, 1280×720, 768×1024 and 360×640, with no horizontal scroll at any size.
  - The projector games still pass `projector-lab.spec.ts` (22/22).
  - No horizontal scroll on the lobby at phone width.
  - Screenshots in `docs/screenshots/td/`.
- **Not captured**:
  - The teacher console and projector screens with live data. They need a database-backed room.
  - The setup wizard. It needs a configured quiz service.

### Matrix F: performance (measured in this container, Node 22, headless)

| Measure | Result |
|---|---|
| Student snapshot, 4 squads × 5, 45-minute match at the end | 15.8 KB raw / 2.7 KB gzip (target < 60 KB) |
| Host snapshot / projector snapshot, same match | 47.4 KB / 44.1 KB raw (4.7 / 4.4 KB gzip) |
| Stored state, same match | 214 KB raw / 12.5 KB gzip; rounds keep their frozen wave inputs |
| Whole 45-minute 4×5 match, simulated end to end | 4.6 s CPU, 90 transitions |
| One authoritative wave simulation | ~2.5 ms typical; one outlier of 360 ms seen in a full sweep (likely GC) |
| Browser frame rate during a wave (practice, headless Chromium in this container) | 60 fps, worst frame 17 ms, at 1920×1080, 1280×720, 768×1024 and 360×640. Not measured on a low-end physical device. |

## Known gaps

- Realtime broadcast after a commit is a hint only. Polling (1 s while active) always works. The Realtime channel itself is untested, because Supabase is unreachable from here.
- The Vercel build of this commit was not observed from here.
- Signed-in flows (create a room, host console, projector) were not driven in a browser.

## Redesign pass (2026-10-20, Stage A)

Storybook-fantasy × toybox look applied to every TD surface (library card, modes card, hub, setup, join/lobby, student, host, projector, results);
original SVG set rebuilt; full-board map art; range + lane-reach overlay; first-match Coach (7 skippable steps); `ReasonTag` (points / phase / taken pad / branch)
and `RankingRules` (ranking order, team-size fairness, speed earns nothing).

| Item | Evidence |
|---|---|
| Join cleanup (review finding, MEDIUM) | `joinTD` removes the player row created by `join_room_v2` whenever the seat is refused or the room stays busy (`discardUnseated`). DB test `join cleanup…` proves a refused join leaves no player row. The *race* path (seat refused after the RPC) is covered by code only; the test exercises the up-front lock and unknown-code refusals. |
| `laneReach`, `ReasonTag`, `RankingRules`, `Coach` | `components/quiz/td/__tests__/clarity.test.tsx` (7 tests) |
| TD suites | `lib/quiz/td` + `components/quiz/td`: 4 suites, 73 tests green; DB suite 5 tests on local Postgres 16 with migrations 001–007 |
| Reconnect/presence in several real browsers | NOT proven here (needs a database-backed room). Unchanged logic. |
| Screenshots | `docs/screenshots/td/{before,after}` |
