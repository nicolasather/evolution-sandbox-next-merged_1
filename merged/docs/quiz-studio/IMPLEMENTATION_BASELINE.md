# Quiz Studio — implementation baseline and change log (21 Oct 2026)

Base: `main` @ b2d24f4. Verified locally (cloud checkout) with tsc, eslint, jest and a Playwright pass over the offline Practice routes. `next build` could not run in the sandbox (Google Fonts unreachable); Vercel builds on push.

## Game identity (verified vs unknown)
- Verified on `main`: Tower Defense (`/quiz/td`), Swarm Survival (`/quiz/swarm`), Obstacle Survival (`/quiz/os`), Arena Clash (`/quiz/arena`), Clue Racing (`/quiz/cr`), plus 10 projector keys in `lib/quiz/projector/modes.ts`.
- **Numbering is NOT resolved.** Repo docs call both Arena Clash (`docs/arena-clash/.../GAME3_*`) and Obstacle Survival (`docs/obstacle-survival/README.md`) "Game 3". All three newer modes were audited and fixed, so the work does not depend on the mapping. Owner to confirm which is Game 3/4/5.
- The "15 games" claim is not verified: 10 projector keys + 5 online/solo modes = 15 *entries*, not 15 independently audited modes.

## Changes
**Mechanics fixes (regression-tested)**
- Arena Clash: teammates could share a role (no `ROLE_TAKEN`, modulo-based auto-assignment collided after a kick). Now: distinct roles, first free role on join, lobby reconcile on kick/move, solo = Runner, mid-match roles never revoked. `lib/quiz/arena/engine.ts`.
- Obstacle Survival: every joiner was a Trailblazer and the solo restriction was UI-only. Now server-enforced: solo kit locked, distinct roles, reconcile on kick/move (`SOLO_ROLE`, `ROLE_TAKEN`). Approval requests stamped with the trusted server clock (`requestedMs` was always 0). `lib/quiz/os/engine.ts`, `server.ts`.
- Clue Racing: audited; existing policy was correct and is now pinned by tests. `extend`, hidden-clue projection and host-end standings paths inspected: no defect found.
- Role pickers (Arena/OS) disable and label roles taken by a teammate.
- Tests added: `arena-role-unique-within-team`, `os-role-eligibility`, `os-pending-approval-timestamp`, `cr-role-transition`.

**Onboarding and discovery**
- `lib/quiz/taxonomy.ts` (stable ids: 16 subjects, exact Grades 1–12 with UK Year equivalents, curricula, languages, contexts), `lib/quiz/onboarding/profile.ts` (sparse subject↔grade map, defensive parsing, safe storage, explainable recommendations).
- `/quiz/welcome` 7-step teacher wizard (skippable, resumable, editable) + short student flow; first-visit prompt on `/quiz`.
- Quiz metadata gains `subjectIds`, `gradeIds`, `curriculumIds` (editor chips, schema, library filters, "Suggested for you" built only from real quizzes). Nothing is auto-classified.

**Rewards platform (pure rules, no persistence)**
- `lib/quiz/rewards/`: idempotent coin ledger with caps/refunds, forgiving streak, daily learning reward, qualifying teaching sessions, referral checks, weekly missions, quiet notification queue (24 tests). `/quiz/rewards` explains the rules and states plainly that storage is gated.

**Game polish (Games 3–5, shared layer)** — `app/quiz/game-polish.css`: focus mode (compact nav, hidden footer/notices in play), tactile role cards, stage vignette, entry/idle/ready motion, result shimmer; all motion respects reduced-motion.

## Not done / needs decisions
- Persistent coins, referrals, leaderboards: need a reviewed Supabase migration and approval (none applied).
- The 34 brainstormed ideas: not confirmed one by one; not implemented.
- Per-game bespoke art/animation (new sprites, props, parallax) for Games 3–5 is NOT done; only the shared layer above. Before/after screenshots were taken locally for the three Practice flows but are not committed.
- Teacher dashboard, Avatar Workshop UI, shop purchase flow, class presets, five-step verification (meaning not found in repo): not built.
- Beta URL requires a Vercel login; could not be tested.
