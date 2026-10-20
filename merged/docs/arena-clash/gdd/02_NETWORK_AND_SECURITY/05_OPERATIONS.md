# Deployment and observability

Dev: disposable local SQL, worker in dev mode, two browsers and fake classmates labeled as simulated; do not load production credentials into test worker. Prod: hosting approval, migration applied, worker's `/healthz` reachable over TLS, secrets set privately in hosting and Vercel, frontend rebuilt with public URL, reconnect + 2 phone smoke. Track tick lag, snapshot bytes, active rooms, 95th-percentile RTT, disconnects, failed joins, answer submissions, server crashes, rate limits. No per-student behavioral surveillance. Document host cost and projected room capacity.

Quality budgets: p99 tick <25ms, avg packet <=4KB, p95 <=6KB, 60 active sockets minimum staged load, resize at phone 375×667, 60fps target/30fps acceptable lower-end, memory cap measured per worker. Never claim these are achieved before test evidence. Worker readiness must separately test DB + lease, not merely respond with an always-OK healthz.
