# Swarm Survival: deployment, migration, rollback, runbook

## Status (honest)
Nothing here has been deployed. Verified locally only: worker + site + Chromium on one machine; SQL on PGlite and local Postgres 16. The hosted Supabase
project has **not** received migration 008, and no worker host exists. Until both are done, production shows the Swarm card and **Practice mode** (the same
runtime inside the browser, no server); online rooms cannot be created.

## Prerequisites (owner actions)
1. Apply `supabase/migrations/008_swarm_survival.sql` to Supabase (SQL editor or `psql`). Needs 001–007 already applied.
2. Host the worker somewhere that keeps a process alive and speaks WebSocket over TLS (Fly.io, Railway, Render, a VM). Use `swarm-server/Dockerfile`.
   Set `SWARM_SECRET`, `DATABASE_URL` (direct, not the pooler in transaction mode), `SWARM_ALLOWED_ORIGINS=https://evolution-sandbox-next-merged-1-g1s.vercel.app`.
3. In Vercel set `SWARM_SECRET` (identical, **≥ 32 characters**, generated with e.g. `openssl rand -base64 48`), `SWARM_URL=https://<worker>` and `NEXT_PUBLIC_SWARM_URL=https://<worker>`, then redeploy.
   **Both are the worker's https ORIGIN** (no path, query, credentials or `wss://`). The browser calls `POST https://<worker>/join` and derives `wss://<worker>/ws` itself; a `wss://` value is rejected with a setup error (SW-01).
4. Smoke: teacher creates a Swarm room, two phones join, one question, results. Run `npm run swarm:e2e` against the preview with the worker URL set.

## Security configuration (SW-01..SW-04, SW-09)
- **Secret**: one production minimum of 32 characters on both the Next app and the worker (`lib/swarm/config.ts`). A 16–31 character secret is refused by both. Only `SWARM_DEV=1` / non-production runs accept ≥16, and `VERCEL_ENV=production` ignores that allowance. Rotating the secret invalidates every live token: rotate between matches, never mid-match; set it on the worker and on Vercel together, then redeploy both.
- **Database TLS**: a remote `DATABASE_URL` is always verified (`rejectUnauthorized: true`). If the provider uses a private CA, put its PEM in `SWARM_PG_CA_PEM` (a `\n`-escaped one-liner is accepted). `sslmode=disable|allow|prefer|no-verify` in the URL is refused at startup. Loopback databases (local dev/CI) may run without TLS. There is no switch that disables verification. Test against the real provider before release (SW-F07).
- **Metrics**: `GET /metrics` is a 404 in production unless `SWARM_METRICS_TOKEN` is set, in which case it needs `Authorization: Bearer <token>` (scrape it from a private collector, not a browser). `/healthz` returns counts only.
- **Teacher preflight**: the setup page and room creation now probe `<worker>/healthz` (2.5 s, cached 5 s) and migration 008; an offline worker, protocol mismatch or missing schema blocks *creating* a room with a specific message, while Practice mode is unaffected.
- **Seat storage**: a student's seat token is kept in `localStorage`; if the browser refuses storage the seat lives in that tab only and the player screen warns that a reload would lose it. Tokens are never put in URLs or logs.

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
