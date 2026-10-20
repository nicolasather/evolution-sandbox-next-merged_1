# Production architecture

Next.js app at `merged/` and Vercel is control plane only; persistent realtime worker runs on supported process host. The Swarm worker (`merged/swarm-server/`, `merged/lib/swarm/`) already exists at last inspected SHA and should be assessed for **generic reuse**, not blindly cloned. Arena can use namespaced `arena/1` worker or separate worker, but schemas and lease fencing must prevent cross-mode room injection. 20Hz game world, 10Hz authoritative snapshots; render at display FPS via interpolation. Geographic latency measurements matter before a rollout. Never use React component state as canonical world state, Supabase Realtime as high-frequency gameplay authority or setInterval in Vercel route handlers.

System diagram:
Teacher auth → Next room creation/preflight → Supabase snapshot + session row → signed host capability → persistent worker → WebSocket player tokens → per-viewer redacted states. DB records idempotent answers, wallet grants, purchases, match finalization. Worker snapshots checkpoint regularly with single-owner lease.

Deploy worker separately with healthz, no secret in `NEXT_PUBLIC_*`, fixed allowed origins, strict TLS. Verify prod worker/migration actually exists; no inferred deployment from commits.
