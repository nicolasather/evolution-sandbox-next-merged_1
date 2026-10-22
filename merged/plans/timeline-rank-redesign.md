---
name: timeline-rank-redesign
description: Redesign rank in main timeline (TimelineView) for 60fps; add user/player ranking display.
status: in-progress
branch: edtech-platform
---

DECISION (user + main agent):
- Auto-update ignored.
- Redesign rank in main timeline (components/TimelineView.tsx, lib/retention/timeline.ts).
- FPS >= 60 required for timeline.
- Finish rank among users/players.
- Full access granted; no permission needed.
- Base on edtech-platform (not quiz-studio).
- Forward decisions to plans subagent after each decision.
- After finishing, wait for code-reviewer subagent before next work.

COMPLETED (from earlier):
- DB: supabase/migrations/007_user_rank.sql
- Engine: lib/edtech/rankEngine.ts
- Types: lib/edtech/database.types.ts
- API: app/api/quiz/rank/route.ts
- Homepage buttons: app/quiz/page.tsx (+ Rank Board btn), app/page.tsx (chooser card)
- Page: app/quiz/rank/page.tsx

REQUIRED REDESIGN (timeline):
- TimelineView.tsx uses `animation: tlIn .6s ...` per point — too many for 60fps at scale.
- Fix: reduce animation delay; add `will-change: transform`; limit DOM nodes.
- Add rank display overlay on timeline (user/player position indicator).
- Use `useMemo` efficiently; avoid re-computing full row on every render.
- Ensure 60fps via reduced animation overhead and efficient rendering.

GATE: Wait for code-reviewer subagent (.claude/agents/code-reviewer.md) to complete fixes before next iteration.