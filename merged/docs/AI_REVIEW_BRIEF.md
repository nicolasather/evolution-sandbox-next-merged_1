# AI review brief — Evolution Sandbox (beta)

Paste this file, or point the AI at it, together with the repository for the site being reviewed:
- Sandbox website: `nicolasather/evosandbox`
- Quiz website: `nicolasather/quiz`
- Combined copy: `nicolasather/evolution-sandbox-next-merged_1`, branch `main`

## Reading order

1. `AGENTS.md` and `CLAUDE.md` — project rules.
2. `README.md`, `PRODUCT.md` — what the app is supposed to do.
3. `docs/BETA.md` — the developer beta and its switches.
4. `lib/dev/overrides.ts` — beta overrides (unlock everything, skip intros, speed, seed).
5. `lib/world/progress.ts` — the era lock that the beta bypasses.
6. `lib/engine.ts` — discovery and recipe engine.

## Routes to cover (from `app/**/page.tsx`)

- Public: `/`, `/sandbox`, `/method`, `/faq`, `/privacy`, `/terms`
- Admin: `/admin/recipes`, `/admin/visual-lab`, `/admin/visual3d`
- Quiz hub and library: `/quiz`, `/quiz/new`, `/quiz/my`, `/quiz/library`, `/quiz/library/[id]`, `/quiz/collection`, `/quiz/edit/[id]`, `/quiz/settings`, `/quiz/help`, `/quiz/keep`, `/quiz/lab`, `/quiz/login`, `/quiz/welcome`, `/quiz/rewards`, `/quiz/modes`, `/quiz/report/[id]`
- Quiz setup and play: `/quiz/setup/[id]` (+ `/arena`, `/cr`, `/game`, `/os`, `/swarm`, `/td`), `/quiz/play/[id]`, `/quiz/host/[id]`, `/quiz/projector/[id]`
- Quiz game modes, each with `join`, `practice`, a room (`[roomId]`), and `host` / `screen` sub-pages:
  - `/quiz/arena` (arena) and `/quiz/arena/[roomId]`
  - `/quiz/cr` (clue racing)
  - `/quiz/os` (obstacle survival)
  - `/quiz/swarm` (swarm survival)
  - `/quiz/td` (tower defense)

## What to report

1. Routes that are unreachable, crash, or show errors in the beta.
2. Features that the README or PRODUCT.md describe but the code does not deliver.
3. UI, copy and accessibility problems (mobile width first).
4. Anything that would be visible to production players while the beta switches are on.

For every finding, give the file and line. Do not change any files.
