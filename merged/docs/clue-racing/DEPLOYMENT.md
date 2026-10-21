# Deployment notes (not performed)
1. Review `supabase/migrations/010_*` and `011_clue_racing.sql`; apply to a staging project first. Down script: `011_clue_racing_down.sql`.
2. Deploy branch `claude/clue-racing` to a Vercel preview; run the Playwright spec against it (`PLAYWRIGHT_BASE_URL`).
3. Verify CSP/origins for Realtime, then promote.
The agent did NOT apply migrations or deploy.
