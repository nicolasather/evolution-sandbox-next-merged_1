---
name: fan-out-subagent-redesign
description: Fan out the timeline rank redesign into parallel subagents.
status: in_progress
branch: edtech-platform
---

DECISION (user): fan out subagents — launch parallel subagents for independent tasks instead of waiting sequentially.

BRANCH: edtech-platform (NOT quiz-studio). Full access granted. Ignore auto-update. Redesign rank in main timeline for >= 60fps. Finish user/player ranking. Wait for code-reviewer gate before next iteration.

FILE STATE (current, must respect on disk):
- merged/components/TimelineView.tsx (needs redesign)
- merged/app/_museum.css + app/_world.css tl rules (references)
- merged/lib/edtech/rankEngine.ts (existing)
- merged/supabase/migrations/007_user_rank.sql (existing)
- merged/app/quiz/rank/page.tsx (new)
- merged/app/api/quiz/rank/route.ts (new)

REWORK CHECKLIST (delegate in parallel to subagents):
A) TimelineView 60fps — reduce animations, add will-change, limit node count, add rank indicator overlay pointing to players list badge.
B) Rank page content flow — app/quiz/rank/page.tsx uses link to route.ts; ensure dynamic loading path calls getLeaderboard with metric param.
C) E2E / API integration — ensure POST handler exists in route.ts for recalculateAllRanks call if needed; verify server code.
D) CSS optimization for tl animations (media queries, reduced-motion friendly).

SUBAGENTS: launch 3 general-purpose agents A/B/C in parallel. Each reviews its scope only, then reports summary. No direct duplicate writes to shared files beyond what each owns.

GATE (after all report): forward results to plans subagent af41b6cfac8fb82c6, then confirm completion to user.