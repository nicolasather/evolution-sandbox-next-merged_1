# Arena Clash (Game 4) — implementation status

Protocol `arena/1`. This document says what exists, what was run, and what was **not** verified. Nothing here claims hosted readiness.

## Architecture as built (and why)
The repository's other real-time games run on Vercel serverless functions with Supabase. There is no persistent process, so Arena Clash follows the same pattern as Obstacle Survival:

- **Pure engine** (`lib/quiz/arena/engine.ts`, `sim.ts`, `plan.ts`, `maps.ts`): a deterministic, server-authoritative 20 Hz world (`TICK_MS = 50`). No timers, no `Date.now()` in the reducer — the clock is an argument.
- **Catch-up per request** (`server.ts → step`): each request advances the room with the pure `advance` to "now" and commits through revision-locked SQL functions (`arena_commit`, `arena_tick`, `arena_input`). Commands carry a `commandId`; `(room, actor, command)` is idempotent.
- **Students send intent only** (`{seq, x, y}` in [-1,1]). Position, cooldowns, points and grades are never accepted from a client. Unknown keys are rejected (`validation.ts`, strict Zod).
- **Seat token** is an httpOnly cookie scoped to `/api/quiz/arena/rooms/<id>`; the projector uses a separate private link (hash in the URL fragment, sent as a header).
- **Quiz break** freezes the world; all five question kinds go through the shared five-stage answer pipeline (`answer-pipeline.ts`, `allowArena`). The answer key never reaches a student snapshot (checked in the DB test).
- **Economy is points only** (`balance.ts`): helpers cost points earned by correct answers; no real money, no random loot.
- **Optional persistent worker**: lease/checkpoint RPCs exist (`arena_acquire_lease`, `arena_save_checkpoint`) and the packet union `clientPacketSchema` is WebSocket-ready, but **no worker is shipped or deployed**.

### Honest consequences of the serverless choice
- The world is committed at roughly 10 Hz (when ≥2 ticks behind), simulated at 20 Hz; the client predicts its own token and reconciles. A persistent worker would be smoother.
- Zone travel timing can differ by up to ~1 s between clients; slot rotation keeps it fair over a match.

## Where it lives
| Area | Path |
|---|---|
| Engine, maps, bots, validation | `lib/quiz/arena/` |
| Persistence | `supabase/migrations/010_arena_clash.sql` (+ `_down.sql`) — **not applied to any hosted database** |
| API | `app/api/quiz/arena/**` |
| UI | `components/quiz/arena/`, `app/quiz/arena/`, `app/quiz/setup/[id]/arena/` |
| Hub wiring | `QuizList`, `app/quiz/library`, `app/quiz/modes` |
| GDD / art direction (from the brief) | `docs/arena-clash/gdd/` |

Answers are stored in the existing `submissions` table; audit uses the existing `audit_log`. The migration adds only `arena_*` tables, all with RLS enabled and no policies (service role only).

## Screens
Library card, hub, setup, join + QR, lobby, role picker (solo = Runner only; roles unlock 1→5 with team size), live arena (desktop keyboard + mobile joystick), quiz break, reveal, planning board, episode result, results/learning report, teacher console, projector, reconnect/connection badge, accessibility settings (contrast, large text, calm motion), practice with bots, coach tutorial, error states.

## Evidence that was actually produced
| Check | Result |
|---|---|
| Engine, protocol, role and 20-seat load tests (`npx jest lib/quiz/arena`) | pass |
| `RolePicker` component test | pass |
| DB test on **PGlite** (real Postgres in WASM) with migrations 001–010: up / down / up, RLS, anon denied, cross-room seat, idempotent command, no answer-key leak | pass |
| Playwright `arena-clash.spec.ts`, desktop + mobile profile, against the local dev server: hub, join form, projector guard, a full practice round (lobby → quiz → reveal → planning → live) | pass |
| Manual screenshots of practice at 1280×720 and 375×667 | taken |

## NOT verified (do not assume)
- **No hosted Supabase database was touched.** Migration 010 has not been applied anywhere real; applying it (and its down script) needs the owner's explicit authorization.
- **No Vercel deployment of this branch was made or tested.** The two supplied sites were only fetched read-only; they do not contain this work.
- Remote play (join → play → results), the teacher console and the projector have been exercised only through the pure engine, PGlite and mocks — not with real browsers against a real backend with many phones.
- No real-classroom or real-network load test (the 20-seat test is CPU-only).
- Chrome extension was never connected in this session; the Windows path `D:\Users\Admin\…` was not reachable from the cloud workspace, so work was done in a git checkout and delivered by branch.
- Sound is not implemented beyond the visual cues.
