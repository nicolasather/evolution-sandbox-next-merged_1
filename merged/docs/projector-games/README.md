# Projector Games for Quiz Studio

Five classroom-projector game modes built on the existing Quiz Studio backend (rooms, room_questions, submissions, `commit_answer_v2`, teams). The original Evolution Sandbox and Classic Quiz are unchanged.

| Game | Style | Core loop |
|---|---|---|
| Empire Race | competitive, territory | verified answers give energy to claim / fortify / scout / bridge hex zones |
| Boss Battle | cooperative raid | strike, shield, repair, scan; weak-topic bonus damage; 1-3 phases by lesson length |
| Escape Room | cooperative puzzle | inspect spots, collect clues, combine items, unlock doors (3 campaigns) |
| Treasure Vault | competitive | earn shaped keys by topic, open the matching vault, bank before the grand vault |
| Risk Ladder | competitive push-your-luck | climb, bank or review; harder questions sit higher; review earns a shield |

## Rules every game follows
- Game is chosen first (`/quiz/modes` -> library -> `/quiz/setup/[id]/game`); classic modifiers are shown with the reason they are off (each game has native mechanics).
- 2-8 teams, round robin or synchronized, oral answers marked by the teacher; no student devices or accounts.
- 5-180 minutes or untimed. `plan` scales turns, map size, boss phases, rooms, vaults and ladder tiers so the game reaches a finale.
- Clock: `rooms.expires_at = deadline + 1800s grace`; on overtime the server issues `time_up` (finish the turn, then end). Pause / resume / extend / finish-turn / end-now supported.
- Idempotent commands (`commandId`), `expectedRevision` conflicts (409), event log, host-only full state; the projector view never receives an answer key, unopened vault rewards or fogged tiles.
- Teacher reward: `projector_evaluate_reward` over server-verified evidence only (uniqueness, anti-idle, anti-overlap) with appeals. Student cosmetics stay non-pay-to-win.
- EN + VI, keyboard operable, reduced motion / large print / high contrast, captions for every cue, readable at 720p and 200% zoom.

## Try without an account
`/quiz/lab?game=empire_race|boss_battle|escape_room|treasure_vault|risk_ladder[&teams=4&minutes=30&focus=balanced]` runs the same engine with sample questions.

## Migration and rollback
`supabase/migrations/005_projector_modes.sql` is additive (new tables `projector_sessions`, evidence/reward tables, RPCs; RLS on, no policies; service role only). `005_projector_modes_down.sql` removes them. Verified against a local Postgres 16 only.

## Verified (see report for exact commands)
Unit tests, DB tests on Postgres 16, `tsc`, ESLint on new code, `next build`, Chromium screenshots (`screenshots/`).
## NOT verified
Supabase staging/production, Firefox/WebKit, real classroom projector hardware, the beta Vercel URL (needs sign-in).
