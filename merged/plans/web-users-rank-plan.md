---
name: web-users-rank-plan
description: Corrected rank design for edtech-platform after agent review.
status: corrected (plan agent file never written; reconstructed from agent reports + exploration)
---

CORRECTIONS TO ORIGINAL PLAN (agent a5087c8ac2e5c167e):
- lib/discoveryTier.ts is for sandbox evolution (discover nodes/eras), NOT edtech learning. Discovery score source is missing; must be built or deferred.
- lib/edtech/types.ts EdTechUser / LeaderboardEntry are UNUSED declarations (zero imports). Cannot feed rank from them until persistence is added.
- auth.users has NO link to user profile/progress/xp/streak/level (exploration a258770fd1 confirmed: no user_id in players, no profile table in migrations).
- score_events (001_init.sql:65) is ROOM-scoped (room_id), not user-scoped; player points (secret_hash only) cannot be attributed to auth users.

ACTUAL DATA SOURCES FOR RANK (in order of feasibility):
1. Room score_events aggregated per auth user (requires linking auth.users to players or creating user_profile table first).
2. New user_profile / user_xp / user_rank DB tables (supabase/migrations/007_user_rank.sql).
3. Discovery / mastery data — deferred until discovery event DB exists (currently only cosmetic/ledger events).

REQUIRED BEFORE BUILDING RANK:
- Decide identity link: auth.users.id -> profile/user_rank (new table) or anonymous-only via secret_hash.
- Add migration 007 for user_profile + user_rank.
- Implement lib/edtech/rankEngine.ts computing composite from persistence, NOT from types file.
- Build APIs in app/api/quiz/rank/* following lib/quiz/api conventions (success/failure/assertSameOrigin/rateLimit/rpc).

NEXT VERSION NOTES (Next 16.3.6 installed, docs available):
- Route handler params is a Promise<{id}> (v15+ change per docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md).
- AGENTS.md requires reading node_modules/next/dist/docs before writing — now satisfied (installed).
- 0bb25d5 added COEP: require-corp; verify media compatibility before shipping.
