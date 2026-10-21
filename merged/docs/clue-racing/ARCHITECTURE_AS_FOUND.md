# Architecture as found

- Next.js (non-standard build; see `AGENTS.md`), TypeScript strict, Supabase RPC + RLS, Zod, Canvas 2D.
- Arena Clash is the reference mode: pure reducer, lazy server catch-up, revision-CAS commit, per-view projections, `useArena` client hook. Clue Racing mirrors this pattern (`lib/quiz/cr`, `components/quiz/cr/useCR.ts`).
- Shared pieces reused: quiz grader (`gradeDetailed`), `publicPayload`, join/seat-cookie guards, `components/quiz/art/props.ts` prop painter.
- Production deploy is the old main branch; hosted DB is at a migration level below 010/011.
