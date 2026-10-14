# Live Discovery runbook (operations)

Audience: the owner. Nothing here deploys to production. Flags are environment variables on the **Preview/Staging** environment.

## Turn AI off (any time, no deploy needed for 1–2)
1. **Kill switch**: `curl -X POST $URL/api/admin/creative/kill-switch -H "Authorization: Bearer $OWNER_REVIEW_TOKEN" -H "content-type: application/json" -d '{"on":true}'` (only on preview/local: the admin gate is closed on production).
2. Set `CREATIVE_DAILY_USD_CAP=0` and redeploy (belt and braces).
3. Set `CREATIVE_LLM_ENABLED=false`, `MODE_AI_ENABLED=false`, `ASSET_AI_ENABLED=false`, `NEXT_PUBLIC_*=false`.
The game keeps working: unknown combinations simply behave as before; published content stays.

## Daily routine (when enabled)
1. `GET /api/admin/creative/metrics` — check `spentTodayUsd`, `dedupRatio`, counters (`try.unavailable` high = provider/budget trouble).
2. `GET /api/admin/creative/proposals?status=pending` — read each proposal (ingredients, target, mechanism, evidence class); approve only what you can verify from a source. `decide` needs `expectedVersion` + a reason.
3. Approved ≠ live. `release/export` stages an immutable release → `npm run release:compile -- --in <file>` → commit → deploy → `release/activate`.
4. Mode packets: `mode-packets/list?status=certified` → `review` approve → `review` publish → `export` → paste into `data/mode_packets.json` → commit → deploy.
5. Assets: `assets` list → inspect GLB → `assets/review` approve/publish → `assets/manifest` → commit `data/visuals_assets.json`.

## Roll back a bad release
`POST /api/admin/creative/release/activate` with the previous release id (pointer swap, instant), and `git revert` the commit that changed `data/verified/alt_routes.json`; `npm run release:check` must print OK before deploying.

## Incident drill (do once on staging)
1. Enable with a 0.50 USD cap. 2. Provoke an eligible unknown combination → one proposal appears. 3. Kill switch on → same combination → `unavailable`, `spentTodayUsd` unchanged. 4. Unset `ANTHROPIC_API_KEY` → game still plays. 5. Activate previous release → verify route disappears. Record request ids and ledger rows in `docs/PHASE2_STATUS.md`.

## Limits that protect you
Max 12 candidate targets per call · 12 s timeout · cap and reserve checked in SQL under an advisory lock · identical attempts share one computation · a refusal is cached per release+rules version · nothing a model writes can reach a rule, a score, a date or the Humanity Museum.
