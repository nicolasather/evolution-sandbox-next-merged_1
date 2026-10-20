# Game 3 animation choreography & every-screen storyboard

## Implementation rules

Current source `components/quiz/os/World.tsx` renders Canvas with requestAnimationFrame and `render.ts` draws hazard shapes by `tick`. Rather than dropping extra CSS wobbles everywhere, implement a motion system that has **state, anticipation, action, settle**, and events originating in the true game simulation. A frame sheet or layered authored SVG/Canvas bone system is acceptable; still shots with occasional opacity changes are not.

| Event | Anticipation | Action | Settle | Informative cue |
|---|---|---|---|---|
| walk | immediate 0–40ms lean | 6–8-step gait 6–12fps | 90ms planted stop | direction and speed |
| hop | 100ms bend | 160–260ms arc | 120ms land dust | invulnerability/hop exactly from server tick |
| dash | 100–140ms windup | quick squash/stretch and trail | 180ms elastic recovery | cooldown icon |
| shield | 90ms shield twist | ring expansion 160ms | slow ring hold then vanish | active duration, radius |
| bridge | 140ms folded plank lift | fan-open 190ms | flex and settle | walkable socket actually granted |
| survey | 100ms compass spin | drawn route reveals safe path | fade but leave essential navigation | route genuinely safe |
| medic | 100ms pouch open | heal/recover ripples | icon settle | teammates' status visibly changed |
| stun/damage | hazard telegraph ≥ actual warning | 110ms jerk + flash | 150ms recovery | textual plus shape/icon feedback |
| checkpoint | gate winds open 120ms | 280ms banner unfold | 350ms confetti-lite, no unreadable clutter | progress and points balance |
| question freeze | 150ms camera ease-out | world freeze + small clean dim | question focus immediately | no active hazard animations during freeze |
| question reveal | 180ms card turn | clear correctness/explanation | points travel to wallet | fraction scoring accurately shown |
| shop | hover tilt (desktop only) | snap plaque / plank icon | budget count tick | duplicate click disabled during commit |
| match end | scene beat 150ms | 450–800ms chapter illustration reveal | quiet results; replay accessible | no fake ranks |

**Never lengthen server collision windows merely for a prettier animation** without a gameplay-approved retune and fairness tests. Physics owns the truth; render uses the authoritative ticks and event stamps.

## Important state synchronisation

Animations must handle transitions after reconnect/refresh: if a wave/hazard has already happened, do not play its hit burst again; reconstruct any persistent visual state from authoritative snapshot, and display an accurate still frame. Deduplicate animations by event ID and phase ID.

Never let `tick` jitter generate several completion pops. For remote spectators, interpolate sample positions while preserving visibility of sudden server-validated impacts. Camera smoothing must not hide knockback or hazard warning. No arbitrary scene timers that advance while the lesson barrier or teacher pause freezes the simulation. Decorative environmental loops can optionally run only when not frozen.

## Screen-by-screen change checklist

1. `/quiz/os` — premium world illustration, 2–3 real gameplay feature pictograms, obvious practice and host/join options.
2. `/quiz/setup/[id]/os` — original pictorial map tiles with preview; format and team-size choices; accurate preflight timing and purchase approval controls.
3. `/quiz/os/join` — large accessible code input, minimal friction, themed illustrated arrival gate, accurate error states.
4. `/quiz/os/practice` — solo-ready loadout; clear map select; no five competing role buttons.
5. `/quiz/os/[roomId]` lobby — lively role tokens, team roster, compact ready action and permission states.
6. Main traverse screen — map occupies 80%+ of horizontal attention at desktop; small HUD overlay and one menu, not multi-row navigation bars.
7. Question barrier — full attention, no world motion, grade-proof submitted state, timers match teacher settings.
8. Reveal — visual progress and learning explanation, no pressure to answer faster.
9. Checkpoint purchase — coin/points feedback, approval flow actually works, consequences clear, team-shared wallet.
10. Host — pause/extend/end isolated as teacher commands, attendance/approval/coach panel, alive map preview, no secrets leaked.
11. Projector — 16:9 map focus and 5–7m readability; no restricted student data when hideNames toggled.
12. Results/review — artwork-driven chapter summary and accuracy trends, per-player private explanations.
13. Reconnect / removed / errors — attractive fallback views, precise guidance, no fake reconnect-success.
14. Accessibility — visible menu with low-motion, contrast, large type, volume controls in every relevant state.

## Quality gate for Claude

Create a visual QA board (HTML or screenshots, stored in repo) containing **before** and **after** for each of the four maps and at least 8 screens. Log three animation examples as short MP4/GIF clips or Playwright trace capturing animated elements over time. If animation cannot be conveyed in screenshots, add explicit frame sampling and automated video capture. Student devices should easily recognize every role and hazard without a text legend.
