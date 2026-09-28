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

---

## 28 September 2026 — a third, much larger brief ("Full Cinematic Experience Overhaul")

A 90-point P0 brief arrived asking to rebuild the entire presentation layer
around six principles — the brief's own words were "SLOW, CINEMATIC,
MINIMAL, DEEP, COLORFUL, ALIVE." **Corrected directly by the person before
any of it was built: "the design is not minimal, it's maximal."** That
single correction changes how P0.5 (Minimal UI Philosophy), P0.6
(Typography) and P0.65 (Text Reduction Audit) should be read throughout —
not as "strip the interface down," but as "let the world be rich, layered
and colourful; keep noise (permanent counters, redundant labels, paragraphs
no one asked for) low without making the *picture* itself sparse." Every
phase below, and every future one, should be read against the corrected
word, not the brief's original one.

Asked the person how to proceed given the scale (their own estimate,
matching this document's existing "do not implement this in one pass" rule,
was "months of work," which the person confirmed and then said to proceed
directly rather than stopping at a roadmap-only pass). Also asked how the
narrator's voice should be built, since no TTS/audio library exists in
`package.json` today (no Howler, no ElevenLabs, no Web Speech wrapper) —
answered: **captions only for now, no synthesized or recorded voice yet.**
That decision is recorded here so a future session does not have to
re-derive it: the narrator stays a text system (already true — see
`lib/narrator/`, `components/Narrator.tsx`) until a voice provider is
separately chosen.

**Operational constraint this session:** the local shell on the person's
computer (`device_bash`) was unavailable for the whole session — reported
"Workspace unavailable" on every retry. Every file below was authored
against a *staged copy* of the relevant source (read with full context, not
guessed at), and `lib/motion.ts` was type-checked in isolation against the
real `lib/perf.ts` (`tsc --noEmit --strict`, clean). What was **not**
possible: running `npm run dev`, `npm test`, `npm run typecheck` or
`npm run lint` against the *whole* project, or looking at the running app.
Per this document's own standing rule ("nothing else in this brief should
touch [`Workbench.tsx`] before this is designed deliberately... should open
with a question to the person, not an assumption"), that file — and every
P0 item that requires it (physical drag/pickup/collision, per-action
animations, technique-unlock cinematics, multi-merge crafting) — was left
untouched this session rather than edited blind with no way to verify it.
**Before deploying, run `npm run typecheck`, `npm run lint` and `npm test`
locally, and look at the app — this session could not.**

### What actually shipped this session

- **`lib/motion.ts` (new)** — the P0.1 "one consistent animation language,"
  built as pure numbers with no DOM/React/timers, the same shape as
  `lib/perf.ts` and `lib/discoveryTier.ts` next to it. Five tiers exactly as
  specified (`micro` 100–250 ms, `interfaceReveal` 600–1400 ms,
  `importantReveal` 2–4 s, `majorEvent` 5–12 s, `eraTransition` 12–25 s),
  five cinematic cubic-bezier easings (`reveal`, `materialize`,
  `cinematicIn`, `cinematicOut`, `breathe`), and `tierMs`/`motionTransition`/
  `motionCss` helpers that scale by device quality tier (reusing
  `lib/perf.ts`'s existing `getQuality`) and floor (not merely shrink) under
  `prefers-reduced-motion`, matching the reduced-motion convention
  `CeremonyStage.tsx`'s own `k` multiplier already uses. **Nothing reads
  from it yet** — it is the foundation the brief's P0.1 asks for, ready for
  the next session to wire into `CeremonyStage`, `EraShift`, `DiscoveryReveal`
  and the rest one at a time, each a small, verifiable diff rather than one
  blind rewrite of every timer in the game.
- **`app/_cinematic-motion.css` (new)** — the CSS half of the same tokens
  (kept in sync by hand, the same trade-off `EraShift.tsx`'s `ERA_GROUP` /
  its CSS counterpart already makes), plus opt-in `.cin-materialize`,
  `.cin-rise`, `.cin-dissolve-out`, `.cin-breathe`, `.cin-micro` utility
  classes implementing the brief's "emerging from darkness / rising through
  fog / dissolving into particles" language as real blur+transform
  keyframes rather than a bare opacity fade (P0.1's explicit ask: "never use
  a basic opacity fade when a richer transition is appropriate"). Additive
  only — no existing selector touched, nothing applied by default,
  `prefers-reduced-motion` respected. Imported into `app/globals.css` right
  after `_design-system.css`.
- **`app/_era-palette.css` (new)** — the colour half of the maximal
  correction (P0.8). A second ambient layer on `#ground::before` (confirmed
  unused by grep before adding — `#ground` only had `::after`, already
  spoken for by `_era-glow.css`'s progress glow), painting a multi-colour
  wash per era GROUP rather than one tint: the seven palettes from the brief
  (stone/earth/metal/iron/paper/circuit/glow) roughly matching its own
  colour lists (charcoal/forest green/deep blue/clay orange/ember/gold/
  violet for stone; copper/oxidised green/gold/stone grey for metal; steel
  blue/tungsten orange/brass/rust/chemical green for iron; restrained
  electric blue/cyan/violet/amber for circuit and glow, deliberately staying
  short of the brief's own "avoid an oversaturated cyberpunk look"
  instruction for those two). Keyed entirely off the `data-era-group`
  attribute `components/fx/EraShift.tsx` **already sets** on every era
  change — zero JS changes required, zero risk to that file's own tested
  timing. Low opacity (0.55 dark theme / 0.32 light), `z-index:0`, behind
  every panel — widens the atmosphere without touching foreground contrast
  anywhere.
- **`app/_narrator.css` (edited)** — the P0.4 caption-language upgrade,
  restricted to CSS only (`lib/narrator/`'s store logic and
  `components/Narrator.tsx`'s structure are untouched, so
  `lib/narrator/__tests__/narrator.test.ts` is unaffected). Position was
  **deliberately not moved** to a bottom-centre lower-third — the brief's
  literal request — because this corner was originally chosen specifically
  to stay clear of Workbench chrome along the bottom of the bench, and this
  session has no way to check what is actually there without running the
  app; moving it blind risked covering bench controls. What did change:
  the flat 86%-opacity card became a soft gradient wash (fading to
  transparent, no hard block), the entrance now uses
  `--dur-interface-reveal` / `--ease-materialize` from the new motion tokens
  (a slower blur+rise instead of a quick translateY-only fade), and the line
  itself is one size up (17px → 19px) with a two-line clamp, closer to the
  brief's "large readable type, maximum two lines" ask. A true lower-third
  placement is still open — flagged below.
- **`app/globals.css` (edited)** — two new `@import` lines for the files
  above, each with the same one-line rationale comment the existing imports
  already carry.
- **This section.**

### Deliberately not attempted this session, and why

- **Everything that requires `Workbench.tsx`** (P0.10 resource spawn, P0.11
  dragging/pickup/collision physics, P0.16 crafting tension/merge, P0.19–20
  technique unlock and per-action animation, P0.47 multi-merge, P0.48
  knockback, P0.56 cursor). This document has flagged that file
  (81 KB → now the largest in the repo) as the one piece of the whole
  original "living world" brief that needs a deliberate design pass with the
  app actually running, not a blind edit — still true, more true with no
  shell this session than with one.
- **The 30-second Timehole intro (P0.3).** The existing `lib/perf.ts`
  `tunnelDuration`/`filmLength` targets ≈4.4–5.5 s total by design ("the
  whole film... runs 4 to 6 seconds"), already tuned across several
  releases per the earlier audit in this document. Stretching it to 30 s is
  a content-authoring task (new narration copy per beat, more objects timed
  against a much longer curve, a genuinely new act structure) on top of a
  code change, not a number to bump — attempting it blind risked breaking a
  sequence `components/Landing.tsx` + `lib/intro/fx.ts` already gets right.
- **Real narrator audio (P0.4/P0.44/P0.81 voice specifically).** Blocked on
  the still-open voice-provider decision above; captions-only was
  confirmed. `lib/sound.ts` is the small discrete-cue trigger it was
  described as here (`sound.sfx('era')` and similar one-shots).
  ~~sound design as a whole (layered ambience, material-specific SFX,
  spatial stereo positioning) is unstarted~~ — **wrong, corrected in the
  round-2 entry below rather than silently edited out.** `lib/craft/
  audio.ts` was never opened during round 1 and already contains a
  complete generative ambience system (no assets — pure synthesis) with a
  full per-era bed, already wired into the three cinematics that claim
  attention. See the round-2 section for what that file actually has and
  what was added to it.
- **3D Earth major-resource events beyond what already exists (P0.23/P0.24).**
  `lib/world/gl.ts` + `components/world/GlobeSequence.tsx` already draw and
  fly the globe for major inventions — extending that toward the fuller
  ceremony the brief describes (region illumination, route-connection
  reveal on world completion) is real work but is an extension of a working
  system, not a new one; left to the next phase rather than started blind
  alongside everything else above.
- **The camera system proper (P0.2)** — a simulated position/zoom/focus/
  depth-of-field camera across the whole app, not just the globe (which
  already has its own, via `lib/world/director.ts`). Large, cross-cutting,
  and exactly the kind of thing that needs the motion tokens above to exist
  first (done, this session) before it has a vocabulary to move in.
- **A true bottom-centre lower-third for the narrator** — see above.
- Every other P0 item not named in "what shipped" above (era transition
  length, technique-unlock cinematics, quiz presentation, museum
  cinematics, mode-entry animations, and the rest) — unstarted.

### Proposed next phases (adapted to what now exists)

1. **Wire `lib/motion.ts` into the two lowest-risk existing cinematics**
   (`CeremonyStage.tsx`, `EraShift.tsx`) so their hand-tuned timer constants
   read off the shared tiers instead of their own numbers — a small,
   reviewable diff per file, with the app actually running to confirm
   nothing regresses (this session could not).
2. **Decide the narrator voice provider** (Web Speech API vs. an external
   TTS service vs. staying captions-only long-term) — a product decision,
   not a code one; `lib/narrator/voices.ts` already has the per-era voice
   registry a real audio layer would key off.
3. **Design, then build, the Workbench decluttering + physical-action
   animation pass (P0.10, P0.11, P0.16, P0.19, P0.20)** — the highest-risk,
   highest-value remaining item, and still the one that most needs a
   session with the app running end to end.
4. **Extend the 30-second intro** as a content pass (new narration beats,
   a redesigned timing curve in `lib/perf.ts`'s `tunnelDuration`) once (1)
   above has proven the motion tokens hold up in practice.
5. **Sound design**, once a voice provider is chosen and real ambience/SFX
   assets exist to build against.
6. Everything else in the 90-point brief, roughly in the order the brief's
   own P0 numbering implies, each phase ending with this section updated —
   per this document's own long-standing rule, do not let it go stale.

## 28 September 2026 (continued) — round 2: "Trừ phần giọng nói ra, làm hết đi"

Same session, same no-`device_bash` constraint as above (still true the
whole way through — every change below went stage → edit → scoped `tsc`
check in the cloud sandbox → commit, never a real build or a running app).
The owner's instruction after reading round 1's report: implement the rest
of the 90-point brief as directly as possible, everything except real
voice/TTS (captions stay the plan). This entry covers what that pass
actually did, staying inside the same risk discipline round 1 set —
`Workbench.tsx`'s core interaction loop is still untouched.

### What shipped this round

- **`SceneFxEngine.hover()` finally wired up (part of P0.56/general
  liveliness).** `hover()` and its handle were already fully implemented in
  `lib/scenefx/engine.ts` — built, exported, never called. Added one optional
  prop, `onSceneryHover`, threaded `Workbench.tsx` → `Bench.tsx`, firing from
  the existing bare-pointer-move branch of `onMove` (throttled to one call
  per 120 ms so it costs nothing extra). No change to Workbench's state
  machine, drag logic, or any hand — this only taps an event that already
  fires.
- **`lib/camera.ts` + `<WorldCamera/>` + `app/_camera.css` (new) — P0.2, a
  real but intentionally modest simulated camera.** A ref-counted singleton
  piggybacking on the existing `lib/cursorField.ts` frame loop: a slow
  breathe (9 s sine, 1.6 px), a small cursor-lean (5 px), and a focus scale
  (1.006×) driven by `lib/attention.ts`'s existing claim/release signal —
  so it automatically leans in a hair whenever a ceremony, era shift, or the
  globe claims the screen, with zero new wiring in any of those three.
  Mounted only on Main Evolution's `<Sandbox/>`, applied to `#ground`/
  `#strata` via `translate`/`scale` as their own CSS properties rather than
  the `transform` shorthand — deliberately, since `--cam-x`/`--cam-y` are
  rewritten every frame and a CSS transition on top would chase a moving
  target; only `--cam-scale` (which changes rarely) gets one. Full
  depth-of-field / zoom-to-object from the brief is not this — this is the
  "the world breathes, and leans toward what matters" slice of it, sized to
  what could be built and reasoned about without a running app.
- **Ambience ducking on attention claim — P0.45 (`lib/craft/audio.ts`,
  edited).** The corrected finding above: this file already had a complete
  generative per-era ambience bed. What it did not have was any awareness
  of the app's own three "something important is happening" cinematics.
  Added `subscribeAttention` from `lib/attention.ts` and a `DUCK_LEVEL`
  (0.32×) applied to the bed's target gain whenever attention is claimed,
  restored on release, both with their own `setTargetAtTime` time constant
  so it fades rather than steps. `CeremonyStage`, `EraShift`, and the globe
  layer all duck the ambience for free now — none of the three needed to
  change.
- **`.tech-reveal` (technique-unlock chip, `app/_rail.css`) and `.qc`/
  `.qc-fold` (quiz card, `app/_learn.css`) both moved onto the shared
  motion tokens — P0.19/P0.21 quick wins.** Both previously used their own
  ad hoc easings/durations (`.5s cubic-bezier(.2,.9,.3,1.1)`,
  `.5s cubic-bezier(.2,.7,.2,1)`); both now use `--dur-interface-reveal` /
  `--ease-materialize`, and both keyframes gained a `blur()` step so the
  entrance reads as materialising rather than sliding in flat — the same
  treatment, deliberately, so the two cues start to feel like the same
  visual language instead of two unrelated ones. `.qc-fold`'s own fold-to-
  a-"?" demotion kept a snappier `--dur-micro` timing on purpose — that one
  is a minor UI state change, not a reveal.
- **Era-shift ceremony stretched — P0 era-transition ceremonies
  (`app/_museum.css`'s ERA SHIFT block + `components/fx/EraShift.tsx`).**
  Was 1.7 s (1.2 s reduced motion); now 7 s (2.4 s reduced motion) — the
  `--dur-major-event` tier, not the full 12–25 s `--dur-era-transition`
  tier the brief literally asks for. That was a deliberate half-measure,
  not caution for its own sake: `.era-shift` is `pointer-events:none` and
  never blocks the workbench, but the full tier would hold a near-opaque
  full-viewport radial wash for roughly 8 of every 16 seconds, and this
  fires up to fourteen times a playthrough with no new content added to
  fill the extra time — at the full length, with the same three lines of
  text, it risked reading as the screen sticking rather than a ceremony.
  7 s already reads as a real occasion. All three keyframes (`esWash`,
  `esUp`, `esRule`) are percentage-based, so the fade-in/hold/fade-out
  shape stretched for free — only the total duration needed to change, in
  both the CSS and the matching `setTimeout` in `EraShift.tsx`, kept in
  step by hand (flagged in both files' comments since nothing enforces
  that pairing automatically).
- **This section, and the sound-design correction above.**

### Still deliberately not attempted, and why (updated)

Everything round 1 deferred is still deferred, for the same reasons — most
of all `Workbench.tsx`'s core loop (P0.10/11/16/19–20 physical drag/pickup/
collision/crafting-tension/multi-merge/knockback animation) and the true
30-second Timehole intro (P0.3, still a content-authoring task, not a
number to bump — `lib/perf.ts`'s `tunnelDuration` is untouched). Additions
from this round:

- **The full `--dur-era-transition` (12–25 s) tier for era shifts** —
  landed at the shorter `--dur-major-event` tier instead; see above for
  why. Revisiting this properly means designing more content for the
  banner to hold (a second beat, a richer wash, something that earns the
  extra seconds), not just raising the number again.
- **`QuestionCard.tsx`'s quiz *content* choreography (P0.21) beyond the
  materialize-reveal swap above** — the brief's fuller ask (a more dramatic
  presentation, per-answer feedback animation) would touch
  `lib/learn/tutor.ts`'s phase machine, which this pass did not open.
- **Museum / Mode Hub cinematics, achievement/progress cinematic language,
  3D Earth event expansion beyond what already exists** — not opened this
  round either; still exactly where round 1 left them.

### Verification note (repeat of round 1's, still true)

No full-project typecheck, lint, test run, or app load was possible this
session — no working `device_bash` the entire time, round 1 or round 2.
Every file above was checked individually (scoped `tsc --noEmit` against
real staged dependencies where the change was TypeScript; brace-balance
and hand-review for the CSS-only changes) before being written back, but
that is not the same guarantee as `npm run typecheck && npm run lint &&
npm test` plus actually opening the app — both still need to happen before
this ships, especially for the era-shift timing change, which is the one
most worth eyeballing live.
