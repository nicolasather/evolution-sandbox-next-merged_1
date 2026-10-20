# Swarm Survival: deployment, migration, rollback, runbook

## Status (honest)
Nothing here has been deployed. Verified locally only: worker + site + Chromium on one machine; SQL on PGlite and local Postgres 16. The hosted Supabase
project has **not** received migration 008, and no worker host exists. Until both are done, production shows the Swarm card and **Practice mode** (the same
runtime inside the browser, no server); online rooms cannot be created.

## Prerequisites (owner actions)
1. Apply `supabase/migrations/008_swarm_survival.sql` to Supabase (SQL editor or `psql`). Needs 001–007 already applied.
2. Host the worker somewhere that keeps a process alive and speaks WebSocket over TLS (Fly.io, Railway, Render, a VM). Use `swarm-server/Dockerfile`.
   Set `SWARM_SECRET`, `DATABASE_URL` (direct, not the pooler in transaction mode), `SWARM_ALLOWED_ORIGINS=https://evolution-sandbox-next-merged-1-g1s.vercel.app`.
3. In Vercel set `SWARM_SECRET` (identical), `SWARM_URL=https://<worker>`, `NEXT_PUBLIC_SWARM_URL=wss://<worker>` (or https; the client derives ws), then redeploy.
4. Smoke: teacher creates a Swarm room, two phones join, one question, results. Run `npm run swarm:e2e` against the preview with the worker URL set.

## Migration 008
Adds `swarm_sessions, swarm_participants, swarm_answers, swarm_credits, swarm_purchases, swarm_audit, swarm_results` and three functions
(`swarm_create_session`, `swarm_acquire_lease`, `swarm_save_checkpoint`). RLS on, no anon/authenticated grants; `swarm_results` is immutable (trigger). Additive only.
Rollback: `008_swarm_survival_down.sql` drops only those objects; rooms, players and quizzes are untouched. It deletes every Swarm checkpoint and result, so run it only with owner approval.

## Runbook
- **Worker restarts**: clients show "Reconnecting", then resume the same avatar. Checkpoints are written every few seconds and at every phase change.
- **Two workers by mistake**: the second fails to take the lease; the stale one is fenced on its next save and stops.
- **Room stuck**: teacher "End match" (double confirm). An empty room expires on its own.
- **Teacher offline**: the world pauses after a grace period; students see a pause overlay; no simulation runs.
- **Suspicion of a leaked key**: grep a snapshot dump for the answer text; tests `net.test.ts` and `ws.test.ts` assert none is ever sent.
