# Changelog — branch `claude/arena-clash-and-fixes`

## Game 3 — Obstacle Survival (OS-F01…F07)
- F01 team-size cap enforced in create, join and move. F02 question timers are real windows (not a fixed constant). F03 purchases above the approval threshold wait for the teacher. F04 the reducer no longer calls `Date.now()` (deterministic pruning).
- F05 solo practice has exactly one role. F06 premium storybook renderer (scenery, eased camera, animated props) and a compact in-match menu. F07 QA documents state what was and was not verified.

## Game 1 — Tower Defense
Compact top bar; clickable enemy list with an info card; towers unlock in chronological order; role sets by team size (solo = one role); richer, animated scenery.

## Game 2 — Swarm Survival
Arena 4× larger (1920×1200) with a following camera, minimap and beacon pointer; themed regions and animated landmarks; less HUD clutter; role sets by team size with an explanation; solo = one role.

## Game 4 — Arena Clash (new)
Engine, three formats (control, relay, crystal), three maps, five noncombat roles, quiz freeze, points-only helpers, bots, standings; `arena/1` strict protocol; migration 010 (not applied); API routes; all screens; practice mode; tests; docs. See `IMPLEMENTATION_STATUS.md`.
Guards added to shared routes so Arena rooms cannot be driven through the other games' modifier/adjust/control/join endpoints.
Dependency added: `qrcode` (+ types) for the join QR.
