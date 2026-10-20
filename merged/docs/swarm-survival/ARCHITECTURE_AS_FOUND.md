# Architecture as found (inspected 2026-10-20, `main` @ 9220b1a, after the Tower Defense redesign)

Everything below was read from source, not assumed. "Reuse" says what Swarm Survival really takes from it.

## Runtime and stack
| Fact | Where | Consequence for Swarm |
|---|---|---|
| Next.js 16 / React 19 app in `merged/`, deployed on Vercel (`vercel.json` holds only a cleanup cron) | `package.json`, `vercel.json` | Route handlers are serverless: **no permanent in-memory host, no WebSocket server possible** |
| Supabase (Postgres + RLS + RPC) is the system of record; `serviceDB()` is the service-role client | `lib/quiz/supabase.ts` | Teacher identity, quizzes, room metadata and reports stay here |
| Migrations are forward-only SQL, latest is `007_tower_defense.sql` (+ `_down`) | `supabase/migrations` | Swarm adds `008_swarm_survival.sql` (+ `_down`), additive only |
| DB tests run real SQL in PGlite or a real Postgres (`QUIZ_TEST_DATABASE_URL`) | `jest.db.config.js`, `lib/quiz/projector/pgadapter.ts` | Swarm migration test uses the same harness |
| `ws`, `zod`, `pg`, `tsx` already in `node_modules`; only `zod`/`pg` were declared | `package.json` | `ws` + `@types/ws` are now declared |

## Room identity and authorization (real)
- Host: Supabase session (`currentUser()`); `rooms.host_id` is compared on every host route (`lib/quiz/rooms.ts` `isHost`).
- Students: anonymous. `join_room_v2` stores `sha256(randomSecret())`; the raw secret lives in an HttpOnly cookie (`qz_td_<room>` for TD). `verifyPlayer(room, token)` re-hashes and compares. Removed/banned players are refused in `verifySeat`.
- Nicknames: `checkNickname` (`lib/quiz/safety.ts`, pure) — reused as is by the Swarm worker.
- Rate limits: `rateLimit(req, scope, max, window)` is a DB-backed limiter. A separate worker cannot call it per request, so the worker carries its own bounded in-memory limiter (documented limitation: per-process).

## Question snapshot and grading (real)
- `createRoom` copies a published quiz into `room_questions` (kind, payload, `answer_key`, `base_points`). Five kinds: `multiple_choice`, `answer_forge`, `connection_rush`, `truth_hunt`, `fill_table` (`lib/quiz/types.ts`).
- Player DTO: `publicQuestionView(row,{reveal,seed})` strips `answer_key` until reveal (pure, tested for all five kinds).
- Grader: `assertResponseIds` + `gradeDetailed(question, response) → {correct, fraction, parts}` in `lib/quiz/grading.ts` is **pure** and deterministic (partial credit only when the creator enabled it). The five-stage `submitAnswer` pipeline (`lib/quiz/answer-pipeline.ts`) wraps it with identify / eligibility / validate / grade / commit (`commit_answer_v2` under a row lock).
- Reuse decision: the worker runs the **same pure stages 3–4** (`assertResponseIds`, `gradeDetailed`) against the room's question snapshot, and does its own stage 1–2 (capability + open window + deadline) and stage 5 (unique commit in `swarm_answer_commits`). It does **not** call `submitAnswer` because that function is bound to Next request context, `rooms.current_index` and the classic ledger, none of which a 20 Hz actor owns. The client never sends correctness or points.
- Speed bonus: `computeAward` has a speed bonus; Swarm never uses it (spec: no reading-speed multiplier). Only `fraction` is consumed.

## Tower Defense runtime (the "inherited" game) — audit
- `lib/quiz/td/engine.ts` + `sim.ts` are pure and deterministic; `server.ts` is **serverless by design**: each request loads the match row, advances it with `advance()`, and commits through one revision-locked RPC (`td_commit`). Presence = `td_presence` heartbeat rows. Supabase Realtime carries only a "revision changed" hint; clients poll.
- That model is correct for a turn-based wave simulator replayed from a seed, and is **not** suitable for 20 Hz per-device action. Equivalence assessment: TD has no persistent worker, so there is nothing to reuse for tick, snapshots or sockets. What *is* reused: revision-locked idempotent commits (pattern), seeded determinism, `ReasonTag`/`RankingRules` UI vocabulary, SVG art pipeline conventions, the outbox/credits idea, and the Quiz Studio ink-outline tokens.
- Audit finding fixed on 2026-10-20 (Stage A): `joinTD` left an unseated `players` row behind when a seat was refused (`discardUnseated`). Swarm's worker seats and mints tokens in one step so the same leak cannot occur.
- Projector games (migrations 005/006) are untouched and are **not** reused: that engine is request/response and keyed in `lib/quiz/projector/types.ts`; Swarm registers separately as an *online* game.

## Game registry / gallery
- `app/quiz/modes/page.tsx` has a hand-written section per game (TD at `#tower-defense`); the library card list is `components/quiz/QuizList.tsx`. Swarm adds a sibling section `#swarm-survival` and a library entry; it does not extend the projector key union.

## Telemetry
- `POST /api/quiz/telemetry` accepts only a fixed name list. Swarm's worker exposes `/metrics` (JSON) instead of writing to that table at tick rate.

## Deployment reality
- Provider found: Vercel (site) + Supabase. No Dockerfile, no worker, no `fly.toml`/`render.yaml` existed. Therefore Swarm ships a **separate Node worker** (`swarm-server/`) with Dockerfile + compose and a staging recipe. It needs a host that allows long-lived processes (Fly.io, Render, Railway, a VM). That is a new paid/free-tier provider the owner must choose; see `DEPLOYMENT.md`. No production claim is made.

## What Swarm reuses vs. adapts
Reused unchanged: `checkNickname`, `gradeDetailed`, `assertResponseIds`, `publicQuestionView`/`publicPayload`, `createRoom` (for the quiz snapshot + room code), `serviceDB`, `assertSameOrigin`/`failure`/`success`, ink-outline tokens, Playwright/Jest harnesses.
Adapted: join flow (worker-owned seating), host capability (short-lived signed token instead of a cookie), persistence (new tables, new RPCs, same additive-migration rules).
Not reused: TD tower/path/wave code, projector reducers, TD commit RPC.
