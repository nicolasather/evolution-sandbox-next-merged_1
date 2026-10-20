# Edge cases, abuse and recovery

- Two devices with same token: explicit replaced-device policy, no duplicated moves.
- Leave during banner carry: deterministic drop, timer reset; returning player restores valid seat, not item held after leave.
- Teacher pauses exactly while capture completes: freeze accepted-before-pause state only, idempotent revision ordering.
- Quiz begins inside objective zone: no progress until quiz closes, and no queued movement inputs leak across freeze.
- Invalid position, teleport, speed hack, missing cooldown: server clamps and logs as nonfatal.
- Unsupported visual devices and reduced motion: large distinct objective glyphs and textual progress.
- Server restart during results: immutable final standings.
- Full room and duplicate nicknames: human errors, safe cleanup.
- No quiz answer available: teacher-hosted session refuses start with accurate explanation.
- Quiz time expired while tab hidden: preserve fairness, no automated answer.
- Network flapping: 3-step connection banner and exact resync state; pending commands retry with one stable ID.
- Away/idle player: freeze idle influence on objective, not quiz class score for teammates.
