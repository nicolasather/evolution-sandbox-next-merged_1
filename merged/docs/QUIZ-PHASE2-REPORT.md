# Quiz Studio Phase 2 — report

- Date: 2026-10-19 · Base commit: `01a2d04` (GitHub `main`) · Work done in an isolated cloud checkout; **nothing was pushed or deployed.**
- Environments used: Node 22 / Next 16 dev server; Chromium 1194 (Playwright 1.56) desktop 1440×900 + Pixel 7; local PostgreSQL 16.15 with a Supabase-style shim; network mocked with `page.route` where noted. **No Supabase project, no Vercel access.**

## Changes (what was found and fixed)
1. **Guests could not see uploaded media of published quizzes** — GET required a Supabase session; and `media_assets.quiz_id` was never filled in, so nobody but the owner could ever read an upload. Now optional auth + authorisation by actual reference (published quiz, or the room's snapshot for token players/host). All denials return the same 404.
2. **Browsers blocked all uploaded media and embeds** — the site CSP lacked `media-src`, `frame-src` and the Supabase origin. Fixed in `next.config.ts` (exact project origin only).
3. **Uploads larger than ~4.5 MB could never work on Vercel** (and 25 MiB advertised vs 20,000,000 enforced). New signed direct-to-storage upload + server-side verification; one cap (26,214,400 B) in UI, client, route and DB (migration 005).
4. **Server never trusted the browser**: type by magic bytes, image dimensions and audio/video length read from the stored bytes, quota, extension must match content; failed files are removed and recorded.
5. **Media in published quizzes was scheduled for deletion after 7 days**; clean-up now keeps anything referenced by a quiz, revision or room, sweeps abandoned uploads, and the cron job actually calls it and removes the files.
6. **Forged media references** (external URLs, someone else's path) are refused by schema and on save/publish.
7. **Reload on `/quiz/new` lost sight of the draft**; the address now points to the device draft.
8. **2 flaky `ModeHub*` tests** fixed (timeout); **lint** 162 → 0 in quiz scope (see caveat in the audit).
9. Added: migration `005_media_access_and_limits(.down).sql`; Playwright (`tests/e2e`), `quiz:audit`, `quiz:test:e2e`, `quiz:test:db` scripts; 4 new unit/route/DB test files.

## Test evidence
| Check | Result |
|---|---|
| `tsc --noEmit` | PASS |
| `npx jest` (whole repo) | PASS — 188 suites, 1,824 tests |
| New: media-hardening (54), media route HTTP-mock (26), media-refs (6) | PASS |
| DB on PG16: existing 38 + new 8 | PASS |
| Playwright Chromium desktop+mobile, no backend (UI/creator) | PASS (all); API-security specs **skipped = BLOCKED** (no Supabase) |
| Playwright media UI with mocked network, server started with a fake Supabase URL | PASS 5/5 (and FAILS with the original CSP — negative control) |
| `next build --webpack` with font stand-in | PASS |
| eslint quiz scope | PASS |
| Firefox / WebKit, Supabase staging, multiplayer, load, collectibles in browser, live site | NOT RUN / BLOCKED |

## Remaining defects / work (ordered)
- **P0 (owner action)** Apply `004` then `005` to staging, then production, with a backup; create private bucket `quiz-media` (file size limit 26214400); set `QUIZ_PRIVACY_SALT`, `CRON_SECRET`; confirm the deployed commit. Until 005 is applied the media endpoints answer 503 "needs migration 005" (explicit, not open).
- **P1** Run `scripts/quiz-e2e.mjs`, the host+2-player and classroom journeys, modifiers/concurrency and 30/100-player load on a **disposable** Supabase (not possible here).
- **P1** Direct upload + finalize against real Supabase Storage (supabase-js `uploadToSignedUrl`, `list` metadata, `download`) — verified only against mocks.
- **P1** Vietnamese i18n wiring, moderation-appeal UI, stranger-safe host identity, one-device speaker rotation UI (documented as partial in the ledger; not built in this pass).
- **P2** Firefox/WebKit runs; screen-reader and 200 % zoom review; replace `Loose` with per-kind types.

## GAME MODE READINESS: **NO-GO (blocked)**
Core media/security defects are fixed and tested at unit, SQL and mocked-browser level, but GO needs staging evidence (migrations 004/005, real Storage, two-browser multiplayer, load) and the P1 UI gaps above.
