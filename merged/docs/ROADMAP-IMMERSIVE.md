# Evolution Sandbox — the "living world" visual/interaction brief

Kept in the repo for the same reason `docs/ROADMAP.md` is: this is a large
standing brief and it should survive between sessions instead of living only
in chat. It is a *separate* document from `ROADMAP.md` on purpose — that one
is about game *mechanics* (P0–P9: physical interaction, civilization
branching, the narrator); this one is about the *visual and interaction
layer* (the opening scene, the cursor field, material response, colour
progression, camera direction, attention hierarchy). They overlap only where
a mechanic needs a picture (a major discovery's ceremony, an era transition).

**Do not implement this in one pass.** The brief itself says so, and the
audit below explains why: several of the systems it asks for already exist
in some form, under different names, and the first job of any session
picking this up is to extend those, not duplicate them.

---

## Status audit (27 September 2026)

The brief reads as if the game has a plain DOM landing page and no reactive
layer. That is not the current state. Checked against the actual code before
anything below was written:

| Brief asks for | Current state | Where |
|---|---|---|
| A dormant 3D opening scene, cursor parallax, withheld colour | **Partially built, Canvas 2D not WebGL.** `Landing.tsx` + `lib/intro/fx.ts` (`IntroFx`) already runs one continuous shot: idle dust that leans away from the cursor and brightens near it, a collapse into a ring ("the time hole"), a multi-layer tunnel, deceleration, the first stone falling. Reduced-motion gets a still strip of the same objects. It is tuned (quality-tier particle counts, no per-frame allocation) and accessible already — not a placeholder. | `components/Landing.tsx`, `lib/intro/fx.ts`, `lib/intro/objects.ts`, `app/_time-tunnel.css` |
| Historical objects in a Z-depth corridor, oldest-first chronology | **Built.** The tunnel already flies real discoveries through the camera in chronological order (`Fly` objects in `IntroFx`, sourced from the actual dataset, not a hand-typed list). | `lib/intro/fx.ts`, `lib/intro/objects.ts` |
| A reusable "cursor world interaction field" with influence radii, velocity, ripples | **Built, as a 2D screen-space field, not a 3D raycast.** `ReactiveField.tsx` is a real WebGL point field: a vertex shader takes mouse position, mouse velocity, an "active" flag and up to 8 ripples as uniforms, and does the influence-radius / wake / ripple maths on the GPU already. It already has a documented "quiet" mode used while a discovery is being revealed (`setFieldQuiet`) — an early version of attention suppression. | `components/fx/ReactiveField.tsx` |
| Material-specific click/interaction response (water ripples, grass lifts, dust puffs…) | **Built, and broader than first assessed.** Two systems, not one: `lib/scenefx/engine.ts` runs real canvas-particle physics for three *traced-region* families (water/grass/dry-ground — these need hand-traced polygons per scene, `data/scene-regions.json`); separately, `components/fx/SceneFx.tsx`'s `AMBIENT` table already reacts to six more kinds of picture element by class name alone (`fire`, `smoke`, `gear`, `star`, `light`, `drift` — flame flicker, rising smoke, a spinning wheel, a twinkling star, a blinking lamp, a bobbing boat/bird), via Web Animations on whatever the SVG already tags, no traced polygon needed. Between the two, click response already reaches most of the brief's material list in spirit, if not its exact ten names. **Hover, this session:** `SceneFxEngine.hover()` (new) plays the region-based reaction at `HOVER_STRENGTH` (0.4×: fewer parts, no grit, silent) behind its own coarser repeat guard, and `SceneFxHandle.hover()` exposes it — additive, `click()` unchanged. Not yet wired to an actual `pointermove`: its only caller would be `Workbench.tsx` (81 KB, the flagged high-risk file below), and wiring a new continuous per-frame call into it is exactly the kind of change this document says not to make blind, in a session with no way to run the app. The remaining honest gap toward "ten materials" is genuinely a *content* task, not a code one: new region kinds (stone/wood/bone/fibre/metal/ceramic chips, sparks, shards) need real traced polygons per scene, which means looking at the actual scene artwork per era — not something to fabricate coordinates for blind. | `lib/scenefx/engine.ts`, `lib/scenefx/regions.ts`, `components/fx/SceneFx.tsx` |
| A camera director: queue, skip, interruptible automated moves | **Built, for the world-map globe only, not the whole app.** `lib/world/director.ts` + `choreography.ts` already do exactly what the brief describes — moments are queued, a backlog plays the shorter version, skip freezes and fades without touching game state, nothing here owns a DOM timer (the caller drives it with `performance.now()`). It would need generalising past "major invention found" to cover hover/select/inspect/discovery/era-complete. | `lib/world/director.ts`, `lib/world/choreography.ts` |
| A real WebGL layer to extend, if one exists | **Yes.** `lib/world/gl.ts` draws the invention-map Earth as one full-screen-triangle fragment shader (ray–sphere intersection, a land signed-distance-field texture, a day/night terminator, fresnel atmosphere) — plain WebGL 1/2, no library. **Correction (this session): `ogl` *is* wired up** — `components/fx/ReactiveField.tsx` lazy-imports it (`import('ogl').then(({ Renderer, Geometry, Program, Mesh }) => ...)`) to draw its point field. The earlier claim here that it "wasn't found imported anywhere" was wrong; it just hadn't been read yet when that line was written. **No Three.js / react-three-fiber in the project today.** | `lib/world/gl.ts`, `components/fx/ReactiveField.tsx`, `package.json` |
| Discovery presentation tiers (quick vs. ceremonial) | **Built.** `lib/discoveryTier.ts` already distinguishes minor (quick card) from major (full ceremony) finds; `components/fx/CeremonyStage.tsx` / `DiscoveryCeremony.tsx` run the ceremony. Numeric 1–10 intensity scale the brief asks for is not explicit, but the tier split it wants already exists. | `lib/discoveryTier.ts`, `components/fx/CeremonyStage.tsx` |
| Colour progression tied to civilization era | **Partially built.** `--era-tint` / `--era-glow` CSS custom properties are already mutated by JS as the player advances and read by `#ground`'s gradient (`app/_design-system.css`). The *theme* layer (light/dark + now six accent skins, this session) is a separate, player-chosen axis — orthogonal to era progression, not a replacement for it. The brief wants era progress itself to widen the colour palette over time; that is a `lib/world` / engine change, not a theme change. **Still outstanding — see phase 9 below.** | `app/_design-system.css` (`--era-tint`), `lib/engine.ts` |
| A quality/performance manager | **Built.** `lib/perf.ts` already has HIGH/MEDIUM/LOW tiers, reduced-motion detection, phone detection, and scales tunnel duration and particle counts (`PARTICLE_SCALE`) off it. The brief's ask (device-capability detection, particle/DOF/shadow step-down, frame-time-adaptive) is mostly a matter of feeding more systems off this existing tier rather than building a new one. | `lib/perf.ts` |
| Workspace decluttering, diegetic world-space labels, depth-of-field focus | **Not started.** The Workbench is still panel-based (`components/Workbench.tsx`, 81 KB — by far the largest component, and the one every future change here risks destabilising). | `components/Workbench.tsx` |
| A camera director generalised across moment kinds | **Correction (this session): further along than phase 5 originally assumed.** `lib/world/director.ts`'s `WorldDirector<P>` is already generic over its payload, and `lib/world/choreography.ts` already has a discriminated `PlanInput` (`{kind:'major'}` / `{kind:'era'}`) — proven both by `lib/world/__tests__/director.test.ts` and by the real, single production call site, `components/world/WorldLayer.tsx`, which builds one `WorldDirector<WorldPayload>` and queues *both* `majorMoment` and `eraMoment` moments through it (`lib/world/moments.ts`). So "major invention found" and "era complete" already share the one queue/skip/interruptible system — that part of phase 5 is done, not merely planned. What the Director does **not** cover is two *other*, visually smaller moments that were never meant to share the globe's screen real-estate: `components/fx/CeremonyStage.tsx` (a single discovery's own full-screen ceremony) and `components/fx/EraShift.tsx` (a ~1.5s "era shift" banner, distinct from the Director's "era complete" globe reveal). Both are self-contained, timer-driven state machines with their own skip/keyboard/replay behaviour; forcing them onto the Director's `tick`/`sample` API would be exactly the "restructure a core, working presentation system, blind, with no way to run the app this session" risk this document already flags for `Workbench.tsx` below — so that merge is deliberately **not** done. What *is* done this session (see phase 5/7 below) is the smaller, safe half of the same idea: all three systems now report "I am the visual centre of attention" to one shared place. | `lib/world/director.ts`, `lib/world/choreography.ts`, `lib/world/moments.ts`, `components/world/WorldLayer.tsx` |
| AttentionManager (global visual-priority owner) | **Built, this session** — `lib/attention.ts`. See phase 5/7 below; this replaces the "not started" note that was here. | `lib/attention.ts` |
| Eight themes (was three) | **Done, this session.** See `CHANGELOG.md` 1.13.0 and `app/_theme-variants.css`. | `lib/theme.ts`, `components/ThemeToggle.tsx` |

**Reading this table straight: roughly a third of the brief's infrastructure
already exists, under game-specific names (`IntroFx`, `ReactiveField`,
`SceneFxEngine`, `director`/`choreography`, `discoveryTier`, `perf`), tuned
and accessibility-aware. The brief's own instruction — "if the current site
already has a WebGL layer, extend it; ... integrate with the existing
architecture where possible and do not duplicate the app into a separate
prototype" — points at extending these five systems, not rebuilding the
opening from zero.**

---

## The one decision this needed before building started (resolved)

**Resolved this session: option 1, extend in place.** The person confirmed
this directly. Left below as the record of why.

The brief is explicit that a real WebGL/Three.js scene should be the opening's
primary visual environment, "not only CSS transforms pretending to be 3D." It
also says, in the same breath, to inspect the current code and extend what's
there rather than duplicate it. Those two instructions point in different
directions here, because the current opening (`Landing.tsx` + `IntroFx`) is
real depth-and-parallax work, tuned over several releases — but it is Canvas
2D, not WebGL, so it cannot get true 3D depth of field, real occlusion between
foreground dust and the title, or a camera that actually moves through space
rather than a 2D projection faking it.

Two honest paths, not a false choice dressed up as one:

1. **Extend in place.** Keep `IntroFx` (Canvas 2D) as the base, and add a
   WebGL layer *underneath or alongside* it — reusing the raw-WebGL approach
   `lib/world/gl.ts` already established (no new dependency) — for the
   specific things Canvas 2D genuinely can't do (real depth occlusion, the
   glyph-level text dissolution, true parallax layers). Lower risk, smaller
   diff, keeps every tuned number in `IntroFx` intact, ships in visible
   slices.
2. **Rebuild the opening as one WebGL/R3F scene.** Matches the brief's letter
   most closely. Means a new dependency (Three.js, optionally
   `@react-three/fiber` — neither is in `package.json` today), a rewrite of
   `Landing.tsx` and `lib/intro/*` rather than an extension of them, and a
   materially higher chance of regressing the skip/reduced-motion/quality-tier
   behaviour that already works, until it's re-proven in the new stack.

I'd default to (1) — it is what "extend existing systems rather than
rebuilding them" (this repo's own `ROADMAP.md`, line 7) already asks for
everywhere else, and the brief's acceptance criteria (calm-idle,
cursor-wakes-the-world, seamless Begin → Workspace handoff) don't actually
require full 3D to be met, only real depth cues do. But this is exactly the
"delete, replace or substantially restructure a core system" fork the brief
says to stop and ask about rather than assume — so it's a question, not a
decision made here.

---

## Proposed phase order (adapted from the brief's own list to what's already true here)

1. ~~Inspect and map existing architecture~~ — this document.
2. ~~Decide the WebGL question above.~~ **Decided: extend in place (option 1)** —
   confirmed with the person this session.
3. ~~Generalise `ReactiveField`'s existing cursor uniforms (position,
   velocity, active, ripples) into the shared "world cursor" values~~ —
   **done, this session**: `lib/cursorField.ts` is now that one shared
   singleton (ref-counted start/stop, a `pointermove`/`pointerdown`/
   `visibilitychange` listener, an eased position + velocity + "active"
   state, an `onFrame` subscription); `ReactiveField.tsx` reads it instead of
   tracking its own mouse position.
4. ~~Withheld-colour reveal on the opening's Stone/Wood/Bone/Fibre, using
   that same field.~~ — **done, this session**: `Landing.tsx` computes a
   per-element `--reveal` (0–1, by distance from the cursor) on the title,
   the materials line and the falling stone; `app/_museum.css` mixes it into
   `--ochre` via `color-mix()`, so those elements sit muted until the cursor
   is near, and settle back on pointer-leave.
5. Generalise `lib/world/director.ts` + `choreography.ts` from "major
   invention found" into the shared Camera Director the brief wants —
   **partially done, this session; see the corrected audit row above.** The
   Director already generalises across the globe's own two moment kinds
   (major invention, era complete). Unifying it further with
   `CeremonyStage`/`EraShift` — different, smaller, already-working
   full-screen/banner state machines — is deliberately deferred rather than
   forced blind; see phase 7, which delivers the safe part of that idea
   (shared attention signalling) without touching either component's own
   timers or skip logic.
6. ~~Extend `lib/scenefx/engine.ts` from three material families
   (water/grass/dry-ground) toward the full ten, and from click-only to
   hover.~~ — **the hover half done, this session; see the corrected audit
   row above.** `SceneFxEngine.hover()` / `SceneFxHandle.hover()` are ready
   to call; wiring an actual `pointermove` into them means touching
   `Workbench.tsx`, so that last step is left to phase 8, where that file is
   already on the table. The "ten materials" half is a content-authoring
   task (tracing new region polygons per scene against the real artwork),
   not a code task, and is **not attempted here** rather than guessed at.
7. ~~Name and unify the two existing "quiet the screen" instances
   (`ReactiveField.setFieldQuiet`, the ceremony's own suppression) into one
   `AttentionManager`~~ — **done, this session.** `lib/attention.ts` is a
   small shared claim registry (`claimAttention(name)` → release function,
   `isAttentionClaimed()`, `subscribeAttention()`). It turned out
   `setFieldQuiet`/`emitFieldPulse` were exported but never actually called
   from anywhere — dormant hooks, not a second live mechanism — so wiring
   them up was purely additive, nothing to reconcile:
   - `ReactiveField.tsx` now quiets on **either** a manual
     `setFieldQuiet(true)` call **or** an attention claim (the two are
     OR'd), so the old event-based API still works unchanged.
   - `components/world/WorldLayer.tsx` claims `'globe'` for exactly the
     span a moment is on screen (its `onStart`/`onEnd` director callbacks),
     which is more precise than the old "busy" bus signal (queued-but-not-
     yet-playing no longer counts).
   - `components/fx/CeremonyStage.tsx` claims `'ceremony'` for its full
     mounted lifetime.
   - `components/fx/EraShift.tsx` claims `'era-shift'` while its own banner
     is shown (new — nothing quieted the field for this before), and its
     own "wait for a ceremony/globe to close" check now reads
     `isAttentionClaimed()` instead of polling
     `document.querySelector('.cer, .wg[data-on="true"]')` on a timer.
8. Only then: Workspace decluttering and diegetic world-space labels — the
   highest-risk item, since `Workbench.tsx` (81 KB) drives the entire primary
   interaction loop and nothing else in this brief should touch it before
   this is designed deliberately, the same caution `ROADMAP.md` already
   states for that file.
9. Era-driven colour progression on top of the existing `--era-tint` /
   `--era-glow` mutation, separately from the (now eight) player-chosen
   themes — the two axes should compose, not collide.
10. Mobile, reduced-motion and performance pass, building on `lib/perf.ts`
    rather than a new tier system.

Progress so far: phases 1–7 above (theming, the WebGL decision, the shared
cursor field, the withheld-colour reveal, the Director audit and
correction, hover support for scene material response, and the
AttentionManager) are done, resolved, or as far as they safely go without
running the app or authoring new art assets. Phases 8–10 remain — 8
(Workbench decluttering) is the highest-risk of all of them and should open
with a question to the person, not an assumption, per the brief's own rule.
Re-check and update this section as each phase lands — do not let it go
stale.
