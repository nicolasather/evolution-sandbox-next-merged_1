# Obstacle Survival (Game 3)

Cooperative / relay obstacle course for Quiz Studio. Students steer a runner through four chalk-drawn maps; at each checkpoint the world freezes and the squad answers a quiz question. Points earned from answers are the only currency (cap 600) and buy perks before the next chapter.

Entry points: `/quiz/os` (hub), `/quiz/os/practice` (no server needed), `/quiz/setup/[id]/os` (teacher setup), `/quiz/os/join`, `/quiz/os/[roomId]`, `/quiz/os/[roomId]/host`, `/quiz/os/[roomId]/screen` (read-only projector).

## Architecture
- **Server-authoritative.** All state lives in `os_sessions` (+ `os_seats`, `os_events`, `os_input_batches`, `os_credits`, `os_results`, `os_outbox`). No timers: every request catches the room up lazily from the clock; every write goes through `os_commit` with a revision compare-and-set.
- **Deterministic physics.** Fixed 50 ms tick, integer units (1 tile = 1000). Clients send input *batches* (`os_input`), the server replays them with the same `stepInPlace` the client uses for prediction (`lib/quiz/os/predict.ts`).
- **Idempotency.** Every command carries a `commandId`; the ledger returns the stored result for a repeat. Credits are exactly-once (`os_credits` primary key).
- **Secrecy.** The seed, answer keys, other squads' economy and (for the projector) student names never leave the server; the projector uses a hash in the URL fragment sent as `x-os-screen`.
- **Identity.** HttpOnly room-scoped cookie `qz_os_<id>` holds the seat token; 20 seats per room, 5 per squad.
- **Questions** reuse the existing answer pipeline (5 native question kinds).

## Files
`lib/quiz/os/*` (domain, balance, rng, course, physics, bot, plan, score, engine, public, validation, server, http, predict) · `lib/quiz/os/levels/*.json` (4 maps) · `app/api/quiz/os/**` · `components/quiz/os/**` · `app/quiz/os/**` · `public/quiz/os/art/**` (20 SVG + 20 PNG + 2 GIF) · `supabase/migrations/009_obstacle_survival(.sql|_down.sql)`.

## API summary (all JSON; errors `{error, code}`)
| Route | Method | Notes |
|---|---|---|
| `/api/quiz/os/preflight` | POST | host-only dry check (quiz size, roster) |
| `/api/quiz/os/create` | POST | host auth; creates room + session |
| `/api/quiz/os/join` | POST | sets seat cookie; 409 when full/locked |
| `/api/quiz/os/rooms/[id]/state` | GET | snapshot for the seat (or `x-os-screen`) |
| `.../input` | POST | batch `{commandId, fromTick, samples[≤48]}` |
| `.../action` | POST | role, hop/ability pulses, shop purchase |
| `.../answer` | POST | barrier answer; graded server-side |
| `.../host` | POST | pause/resume/lock/skip/end/kick/role override |
| `.../screen` | POST | host only; new read-only projector link, revokes the previous one |
| `.../results`, `.../replay` | GET | finished rooms only |
Status codes: 400 invalid body, 401 no seat/host, 403 foreign room/kicked/wrong role, 404 unknown room, 409 stale revision / full / wrong phase.

## Deployment
1. Review `supabase/migrations/009_obstacle_survival.sql` (depends on 007; coexists with 008).
2. **Owner approval required**, then apply 009 to staging first, then production, with the Supabase CLI. No worker or paid service is needed.
3. Never run `009_obstacle_survival_down.sql` or `008_swarm_survival_down.sql` on production without explicit approval (they delete data).
4. No new environment variables. Nothing here has been applied to any hosted database by this change.

## Known deviations from the pre-build pack
- Extra hazards were added and warning windows were lengthened so that all 12 hazards are solvable by the slowest role on all four maps (1000-seed sweep).
- Squad shapes: ■ ● ▲ ◆ plus colour, so squads are distinguishable in greyscale.
