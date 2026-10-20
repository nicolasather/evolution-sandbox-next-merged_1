# Swarm Survival worker

One persistent Node process (`ws`), **not** serverless. It owns the 20 Hz authoritative simulation, join/token issue, grading, persistence and per-viewer snapshots
for every active Swarm room. The Next app only creates rooms and mints host tokens (same `SWARM_SECRET`); students talk to this worker over WebSocket (`ss/1`).

## Run

```bash
npm run swarm:dev                     # in-memory store, dev routes, port 8787, no database
npm run swarm:build                   # bundles swarm-server/dist/server.mjs (esbuild)
docker build -f swarm-server/Dockerfile -t swarm-worker .
docker compose -f swarm-server/docker-compose.yml up --build   # worker + throw-away Postgres
```

## Environment

| Variable | Required | Meaning |
|---|---|---|
| `SWARM_SECRET` | yes (≥32 chars; ≥16 only with `SWARM_DEV=1`) | HMAC secret shared with the Next app. Refused at startup if shorter. |
| `SWARM_PG_CA_PEM` | no | the database provider's CA certificate (PEM). The certificate of a remote database is always verified. |
| `SWARM_METRICS_TOKEN` | no | enables `GET /metrics` with `Authorization: Bearer <token>`; without it `/metrics` is a 404 outside dev |
| `DATABASE_URL` | yes (prod) | Postgres direct connection; refused together with `SWARM_DEV=1` |
| `SWARM_ALLOWED_ORIGINS` | yes (prod) | comma list of site origins allowed to join/open sockets |
| `PORT`, `HOST` | no | default `8787`, `0.0.0.0` |
| `SWARM_MAX_ROOMS`, `SWARM_MAX_SOCKETS`, `SWARM_PG_POOL`, `SWARM_TRUST_PROXY`, `SWARM_WORKER_ID` | no | capacity / proxy / identity |
| `SWARM_DEV`, `SWARM_FILE` | dev only | in-memory or file store |

Next app: `SWARM_SECRET` (same value, ≥32 chars), `SWARM_URL` (server side) and `NEXT_PUBLIC_SWARM_URL` (**inlined at build time**, so rebuild after changing it). Both URLs are the worker's **https origin** (plain `http://localhost:…` only for a local worker); never `wss://`, a path, a query or credentials. The client derives `wss://<host>/ws` for the socket.

## Health and shutdown
`GET /healthz`. `SIGTERM` checkpoints rooms, sends `bye: restart`; clients reconnect to the replacement and the new worker takes the lease (fenced, migration 008).

## Local test helpers
`E2E_BYPASS_CSP=1` lets Playwright run against `next dev` (dev needs eval). `PW_CHROMIUM=<path>` selects a browser binary.
Where Google Fonts are unreachable, build with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<module> next build --webpack`.
