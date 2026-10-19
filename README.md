# Evolution Sandbox + Quiz Studio — Projector Games upgrade

The Next.js app lives in `merged/`. This file documents the Projector Games upgrade (10 classroom projector modes, English only).

## What changed

### Existing five games (Empire Race, Boss Battle, Escape Room, Treasure Vault, Risk Ladder)
- English only: Vietnamese strings, the VI/EN toggle and browser-language detection were removed (`Locale = 'en'`).
- Every action button shows a one-line reason why it is enabled or disabled.
- Empire Race highlights legal Claim/Challenge tiles with their cost and marks threatened borders.
- Action logs are human readable (labels and tile numbers instead of raw ids/keys).
- New How-to-play tutorial with a non-persistent practice turn, coach hints, and a redesigned end-of-game summary (rankings, strong topics, topics worth revisiting for the teacher).
- Not fully redone yet: Boss telegraph previews, Escape notebook, Vault door animation and Ladder tower visuals received only the button reasons, logs and tutorial work.

### Five new games
| Game | Core idea |
|---|---|
| Auction House | Sealed bids on hidden-value lots; answers decide the bidding budget. |
| Territory War | Claim, fortify and attack tiles on a board (frontier / canyon / delta). |
| Lucky Factory | Build machines and lines, forecast breakdowns, bank output. |
| Pirate Voyage | Sail between islands, weather and storms, bank cargo safely. |
| Final Showdown | Staged tournament (qualifiers, pressure, comeback, final) with stances STEADY / DOUBLE / SHIELD. |

Each has a pure reducer in `merged/lib/quiz/projector/reducers/`, an SVG scene and controls (`components/quiz/projector/scenes/ExtraScenes.tsx`, `ExtraGameControls.tsx`), a tutorial (`tutorials.ts`), coach hints (`coach.ts`), cover art (`public/quiz/modes/*.svg`) and projector-safe redaction in `public-view.ts` (lot values, sealed bids and uncharted chests are hidden).

### Integration
- `/quiz` home and `/quiz/modes` group all 10 Projector Games; the footer links to them.
- `/quiz/lab?game=<key>` runs any of the 10 offline with Teams (2–8), Time, Focus and How to play. The practice lab grants no rewards.
- `GAME_KEYS`, `MODES`, `games.ts`, `projectorCreateSchema`, setup options, `GameStage` dispatch, lab and report are in sync.

### Database
`merged/supabase/migrations/006_projector_next_five.sql` widens the `projector_sessions.game` check constraint to the 10 keys (idempotent, no data touched). `006_projector_next_five_down.sql` reverts it (deletes new-game sessions first). **Apply it to the live Supabase project before creating real sessions of the new games** (SQL editor, or `npm run db:migrate` with the project's DB URL). Until then the new modes work in the lab but a real classroom session of them will be rejected by the old constraint.

## Validation
- `tsc --noEmit`: clean. `eslint`: 0 errors (12 pre-existing warnings).
- `jest lib/quiz components/quiz app/api/quiz`: 582 passed (about 150 new tests across all 10 modes, 2/3/8 teams, determinism, redaction, UI text).
- `npm run test:db` (PGlite): 113 passed, 4 suites skipped (need a real external DB).
- Playwright (`tests/e2e/projector-lab.spec.ts`): 12 passed against a local dev server (10 per-game flows, gallery, lab).
- `npm run build` could not complete in the sandbox because Google Fonts is unreachable there; type and lint checks pass and Vercel builds with network access.

## Not done
- Individual-device multiplayer (explicitly out of scope).
- Deeper visual redesign of the old five scenes (see above).
