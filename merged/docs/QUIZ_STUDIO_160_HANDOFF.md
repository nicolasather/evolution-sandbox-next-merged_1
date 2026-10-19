# Quiz Studio 160 — handoff

## Deploy order
1. Back up the database.
2. Apply `supabase/migrations/004_quiz_studio_160.sql` (additive). Rollback: `004_quiz_studio_160_down.sql`.
2b. Apply `supabase/migrations/005_media_access_and_limits.sql` (additive, idempotent; down file provided).
3. Create a **private** Storage bucket `quiz-media` with a 26214400-byte file size limit.
4. Set env vars: `QUIZ_PRIVACY_SALT` (random secret, used to bucket player identifiers), `CRON_SECRET` (enables the daily cleanup route), plus existing Supabase vars. No service-role key is exposed to the browser.
5. Deploy. Before step 2 the app keeps working through v1 RPC fallbacks (no partial credit / speed bonus / moderation until applied).
6. Schedule `select cleanup_quiz_studio_data();` daily (retention).

## Rollback
Redeploy previous build; run the `_down.sql` only if the new tables must be removed (data in them is lost).

## Checks after deploy
Create → publish → host → join → answer → reveal → report; confirm `/quiz/collection`, `/quiz/help`, `/quiz/projector/[id]`, `/quiz/report/[id]`; capture screenshots per ledger item.
