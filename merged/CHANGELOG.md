# Changelog

Shared by both editions: `evolution-sandbox/` (single file, canonical data and
tools) and `evolution-sandbox-next/` (Next.js).

## 1.8.0 — 24 September 2026

### A playable museum: the visual and interaction redesign
The game is the same game. Every route, hint, source and save is untouched
(`lib/engine.ts` was not edited); what changed is how it is staged.

- **Opening.** A cinematic landing ("How did we get here?") with dust that reacts to the cursor
  and a museum-label BEGIN. BEGIN collapses the screen into a point, opens a **time tunnel**
  (three depth layers, real plates of Stone, Spear, Fire, Pottery, Writing, Wheel, Telescope,
  Steam engine, Electric light, Telephone, Computer and Smartphone flying past), a flash, a
  moment of silence, then one rotating Stone: "Begin with almost nothing." The Stone falls onto
  the bench and the interface arrives layer by layer. Returning players get CONTINUE TIMELINE and
  Replay time journey; the film is skippable (click, Esc, Space) and short on phones.
- **Workbench.** Pieces are **artifact cards** with catalogue numbers. Carrying one near another
  draws the resting one toward it and makes both tremble; combining orbits the pair, the rest of
  the table dims, dust gathers, and the impact scales with the tier (about 0.5 s known route,
  about 1.1 s new discovery, about 2.4 s major).
- **Discovery ceremony.** The room darkens; the piece is lifted to the centre with "NEW
  DISCOVERY", its catalogue number counting up (`018 / 322`), name, era, date and an evidence
  line — "Verified evidence · N sources" or "Source needed", from the record, never invented.
  Rising dust, longer for rare finds. Hidden discoveries arrive as `?????????` and resolve
  letter by letter. Tap to fast-forward, tap again to close.
- **Era shift.** Reaching a later era is marked once (never on resume or reset) with the era's
  name and blurb. Seven material accent colours follow the era.
- **Exhibit.** Spotlight and pedestal, sections that read in order, **PATH 01/02…** for every
  recipe computed from the real data (walked routes first, "Trace it back" for the chain behind
  them), "Source unavailable" when a cited source cannot be loaded.
- **Graph.** Hover any find to light its ancestors and descendants and dim the rest; the route
  draws itself in.
- **Archive.** Catalogue cards, staggered in; hidden finds stay `?????????` and unnumbered
  until found; "Source needed" flag on found entries without a verified source.
- **Timeline (new view, key T).** One horizontal rail, era after era, real recorded dates only;
  unfound entries are unnamed ticks, hidden finds are absent until found.
- **Hints.** After a pair that makes nothing the game may say "Something is forming." or "This
  material has more uses than you think." (`lib/near.ts`) — never a name, never a count.
- **HUD and sound.** A small progress ring, animated counters (including routes walked), one
  Sound on/off button. All sound goes through `lib/sound.ts`; nothing plays before a gesture.
- **Keys.** W G A T switch view; `/` search; `?` help (now with an Effects quality switch).
- **Performance.** `lib/perf.ts` picks HIGH / MEDIUM / LOW from the device (or the player's
  choice) and scales every decorative particle count; transform/opacity/canvas only;
  `prefers-reduced-motion` skips the film and replaces motion with fades.
- **Voice.** Loading reads "Recovering timeline…"; failures read "The archive could not be
  recovered." and say that progress is safe on the device. Returning players are greeted with
  "The world remembers."
- Fixed: a hydration mismatch in `ViewVeil` under reduced motion.

## 1.7.0 — 24 September 2026

### Discoveries are made with the hands, not by clicking two things together
- The two craft slots are gone. Items now live on a **physical workbench** (`components/Workbench.tsx`):
  drag, throw and drop them and they carry weight, inertia and bounce. Tap an item in the
  inventory (or drag it in) to put it on the bench; tap **Stone** twice and the second one
  walks over to the first.
- Bringing two things together no longer resolves them. The pair starts a short **process**
  chosen by their materials and by how important the result is: hold, rub and grind, shake,
  stretch or separate, align and rotate into place, wrap, pour, trace a line, link matching
  ends, guide a piece along a channel, keep it inside a ring, hit the beat, strike, stack,
  and assemble a multi-part build with gentle snapping (the cart takes wheels, axle and frame).
- **Hidden difficulty tiers.** Quick finds take about a second, mid-game finds two to four
  steps, and the important milestones ask for five to fifteen seconds of work. A pacing
  governor (`govern()` in `lib/craft/specs.ts`) trims or pads any recipe to fit its tier.
- **Stations.** Fire and metalwork recipes are worked at a hearth, an anvil or a basin that
  lights up on the bench.
- **Never stuck.** Every step has a keyboard route (Space, E, R, mouse wheel, hold), failures
  quietly widen the windows for the next try, and a **Do it for me** button appears after
  22 seconds. An **Instant** switch on the bench restores the old one-touch combine.
- Restrained feedback: squash on impact, dust, sparks, a soft ring on success and a few
  synthesised sounds (mute with the Sound button). Reduced motion is respected.

### What did not change
- `lib/engine.ts` is untouched and still the only authority: the craft layer decides *how* the
  player reaches an answer, `Engine.combine` decides *what* it is. Discoveries, routes, tiers,
  hints and saved progress work exactly as before.
- `app/_design-system.css` is byte-identical to the single-file build; new styles are in
  `app/_craft.css`.

### Tests
- `lib/craft/__tests__`: every one of the 664 recipe pairs is completed by a keyboard-only bot
  and by an ideal-hands pointer bot with no failures, and the pointer bot's times are asserted
  against the tier targets.

## 1.6.0 — 23 September 2026

### Full screen, with the chrome out of the way
- On a desktop the game opens in **full screen** when you press Begin, and a new button in
  the top bar enters and leaves it.
- The **top bar tucks away**: it slides down when the pointer reaches the top edge of the
  screen (or keyboard focus enters it, e.g. with `/`) and hides again when you move away.
  A small handle at the top centre hints that it is there. Phones keep the fixed bar.

### Eleven scene backdrops behind the craft screen
- Engraved line-art landscapes in the same style as the plates (`data/scenes.json`):
  Open Savanna, Night Camp, River Village, First Fields, Ancient City, Trading Harbour,
  Forge Valley, Observatory Hill, Industrial Age, Electric City, Digital Frontier.
- The scene follows the furthest era reached, or pick one with the ‹ › control on the
  bench. Layers drift with the mouse (parallax); clouds drift, grass sways, fires flicker,
  smoke rises, water flows, lights blink. Faded under the centre and the side columns so
  text stays readable; loaded lazily in its own chunk (`components/SceneBackdrop.tsx`).

### Round, animated craft slots
- The two square slots are now **circles**: a tick ring, a counter-rotating dashed orbit, a
  sweeping accent arc and a breathing inner ring. They speed up and light up under a
  dragged item, the placed item floats, a flowing link joins the circles and the + turns as
  they fill. On a combine the circles pull into each other and the + flashes.

### Hover and press animation
- Inventory resources: a light sweep, the icon springs and tilts, the name nudges; pressing
  one sends a ghost of its icon flying in an arc to the circle it lands in.
- Buttons, chips, tabs and the path lift on hover and press in on click; every press
  answers with a ring-and-sparks burst (`lib/fx.ts`). All of it respects reduced motion.

## 1.5.0 — 23 September 2026

### Every discovery has its own drawing
- **322 hand-drawn plates** (`data/art.json`) replace the abstract glyph grammar. Each
  entry is a line illustration of the real thing — a hand axe is a knapped biface, a
  steam engine has boiler, cylinder and flywheel, abstract ideas become a recognisable
  emblem (Law → balance over a tablet, Language → two speakers). No two are alike; a
  test (`lib/__tests__/art.test.ts`) checks coverage, uniqueness and the stroke-only
  grammar. The old primitive grammar in `lib/glyphs.ts` stays only as a fallback.

### The exhibit plate is a 3D object
- **`components/Plate3D.tsx`**: the drawing floats as an extruded wireframe (front and
  back contours joined at the corners; `data-z` groups sit at different depths), bobs
  and sways, and sits in a cloud of drifting particles. Drag with the mouse to spin it
  freely (flick for inertia, double-click to spin, arrow keys on the keyboard, sideways
  swipe on touch). Used on the exhibit panel and the "New discovery" card.
- Canvas 2D with its own perspective projection — no WebGL, no new dependency. Pauses
  when off-screen or in a background tab; honours reduced motion; the flat SVG is the
  server render and the fallback.

### Neon blue theme
- The theme button now cycles **System → Light → Dark → Neon blue**. Neon is a deep
  navy ground with an electric-cyan accent and a restrained glow on the accent rules,
  the active tab and the 3D plate. It lives in `app/_theme-neon.css`, so
  `_design-system.css` stays in sync with the single-file build.

## 1.4.0 — 23 September 2026

A gameplay upgrade, built on the existing engine rather than a rewrite.

### Crafting that can be figured out
- **The graph was mostly unreachable.** 34 ingredient pairs were declared for two to
  five different results, and the engine kept only the last, so a player could reach
  50 of 322 entries. Every pair now yields exactly one result, the nine entries with no
  working recipe have one, and 311 entries have two or more routes
  (`tools/rework_recipes.py`). A test plays the whole graph from the four raw materials,
  tier gates included, on every run.
- **Stone Age tiers** open at 25% of the previous stage (was 50%) and are named as
  gameplay stages, not archaeological periods. A right pair tried too early now says so,
  shows the progress needed, and is offered again when its stage opens.
- **Failure feedback nudges without spoiling**: it says which of the two items still has
  something to give, or that both are used up — never what they make. Repeated pairs
  are recognised.
- **Progressive hints**: a direction, then the idea (the entry's own description with its
  name taken out), then one ingredient — never both. Each level opens only after two more
  tries. The bench offers a nudge by itself after four misses in a row. Hints can be aimed
  at any undiscovered entry that is within reach, from the archive or the graph.
- **Routes are collectable**: reaching something you already have by a new pair is a
  "New route", counted per entry and in the archive.

### Feedback, flow and mobile
- Discovery card with a short spring and ring, slot merge / shake, toasts only for rare,
  hidden, new-route, stage-opened and "you figured it out" moments. Feedback stays until
  the next pair — nothing is taken away on a timer.
- Tap-to-combine everywhere; "Use" puts a result straight back on the bench. Items with
  nothing left to make are struck through and can be hidden. A "within reach" count is
  always visible.
- Onboarding is one line on the bench (tap Stone twice), no modal.
- Phones get their own layout: bench on top, a grid of large tiles below, a bottom nav,
  a bottom-sheet exhibit that opens only when asked, 16px inputs, no horizontal overflow.

### Graph, archive, theme
- Graph: eras wrap into sub-columns, pinch-zoom, zoom buttons, animated camera, a pulse
  on new finds, and tracing of an entry's origins and descendants. Undiscovered entries
  are never named.
- Archive: stage progress, per-era counts, "within reach" and "routes left" filters,
  a personal discovery history, and a pressure-free "Today's find".
- Light, dark and system themes across every screen and the graph canvas, chosen before
  first paint and remembered.
- Search covers your own collection; undiscovered matches are counted, not named.

### Trust
- 85 Stone Age entries carried placeholder text, one false date ("~3 million years ago")
  and a non-existent source id. They now have original descriptions, hedged or
  "not yet sourced" dates, `source_required`, and a gameplay caution
  (`tools/rewrite_placeholders.py`). The validator reports 0 errors.
- Exhibits of undiscovered entries no longer show names, text or recipes; found entries
  show only the routes you have used.

### Removed
- Unwired components from an earlier attempt (HintPanel, MultiRoutesPicker,
  DiscoveryReveal, OnboardingModal, the old ThemeToggle, TierProgressBar,
  `theme-system.css`, `mobile-responsive.css`, `lib/hints.ts`, `lib/multiRoutes.ts`,
  `lib/useSandbox-1.ts`). The last commit that added them did not compile.

## 1.3.0 — 12 September 2026

A pass against a general-purpose 200-point website checklist, keeping only
what applies to a single-page, account-free, static-data game and does not
contradict this project's own stated design or privacy rules.

- **Security headers** (`next.config.ts`): `Content-Security-Policy` (self-only;
  the app never contacts a third-party origin at runtime), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.
  These are headers, not certificates — they take effect once the app is
  deployed behind HTTPS; see "What deployment still has to provide" below.
- **Canonical URLs** on every route (`alternates.canonical` in each page's
  metadata) and two new JSON-LD blocks: `WebSite` in the root layout, `WebApplication`
  on the sandbox itself — in addition to the `FAQPage` schema the 1.1.0 audit
  already added.
- **New `/terms` page**: what the project is, that it carries no warranty, that
  external source links follow their own sites' terms, and the MIT attribution
  for the Vengeance UI components. Linked from the existing method/FAQ/privacy
  footer nav and added to `sitemap.ts`. No business identity, contact address or
  jurisdiction is asserted anywhere — there wasn't one on file to state truthfully.
- **Git**: the delivered tree had no repository. Initialized one so the project
  has version history from here on.

### Deliberately left alone

- **No analytics, tracking pixels, heatmap, or cookie banner.** `/privacy`
  already promises "No analytics, tracking pixels, or advertising identifiers"
  and "No cookies" — adding any of them would make that page false. If
  first-party analytics is wanted later, it should ship alongside a rewrite of
  that page, not as a silent addition to it.
- **The colour tokens in `app/globals.css`.** `--color-bone-4` (`#474441` on
  `#0a0a0b`) sits at roughly 2:1 contrast — well under the 4.5:1 WCAG AA
  minimum for normal text — and it is used for more than decoration: the
  eyebrow label above every page title, and the archive's table headers. It
  reads as a deliberate "quiet secondary label" choice from the audited 1.1.0
  design, not an oversight, so it wasn't changed without design sign-off; it's
  worth a conscious decision either way.
- **Contact / About Us page.** Nothing on file states who or what entity is
  behind this project, and inventing an address or email would violate the
  project's own no-invented-data rule. Add `/about` once there's a real answer
  to "who is publishing this."

### What deployment still has to provide

Not achievable by editing files in this repository — they need a live server,
domain, or third-party account: the SSL certificate itself, a CDN, HTTP/2 or
HTTP/3 (both are the hosting layer's job — Vercel provides all three by
default), actual Gzip/Brotli negotiation, a real TTFB measurement, uptime
monitoring, Google Search Console / Analytics enrollment, and A/B testing
infrastructure. The code changes above (headers, canonical tags, schema) are
already in place and will take effect the moment the site is live; they do
nothing while the project only exists as this source tree.

## 1.2.0 — 12 September 2026

Merged in a second Next.js export (a same-day re-port from the HTML artifact)
that had drifted from this 1.1.0 codebase: it carried four new, properly
sourced discoveries but had regressed the Vengeance UI integration, the FAQ
/ method / privacy pages, the split `data/nodes/*.json` + tooling, and the
CHANGELOG itself. This release keeps the 1.1.0 codebase as the base and
ports across only the genuine data additions, verified against it.

### Data

- **Four new discoveries**, era `trade` (new — inserted after `civilization`):
  **Standardized Weights & Measures** (#217), **Banking** (#218),
  **Double-Entry Bookkeeping** (#219), **Long-Distance Caravan Trade** (#220).
  Each cites at least one subject-level source (Penn Museum, Encyclopaedia
  Britannica, ICAEW, British Museum) fetched and checked on 12 September 2026;
  none needs `source_required`. Added as `data/nodes/g7.json`; nothing in
  `g1`–`g6` moved.
- **Four new sources** in `data/sources.json`: `penn_weights`, `brit_bank`,
  `icaew_pacioli`, `bm_silkroads`.
- **Three existing recipes gained an alternate path**: `cordage` (+ stone ×
  fibre), `fishing` (+ bone × fibre), `spear` (+ wood × bone) — extra ways to
  reach early tools, not new endpoints.
- Totals: 220 nodes (204 core, 16 hidden, still 67 `source_required`), 71
  sources (59 topic-level, 12 general). Grand Theft Auto VI is unaffected:
  still depth 35, still a 101-craft minimum — the new branch is additive and
  does not sit on its path.
- `tools/validate.py` and `tools/build_db.py` both learned the `trade` era;
  the three new leaf discoveries were added to validate.py's `ENDPOINTS` so
  the dead-end check (`W3`) does not fire on them, matching how the project
  already treats other legitimate terminal nodes (`gps`, `virtual_world`).
  `data/db.json` was regenerated from the tools — `dataHash`, `depth`, `need`
  and `uses` are all freshly derived, never hand-edited.
- All copy that quoted the discovery count (`README.md`, `app/layout.tsx`,
  `app/method`, `app/faq`, `app/not-found.tsx`, `package.json`,
  `lib/types.ts`) updated from 216/200 to 220/204.

### Not carried over from the drifted export

Everything else in that export was either an inferior mechanical re-port of
code this codebase already had in a more finished form (a `@ts-nocheck`
functional `engine.ts`/`glyphs.ts` vs. this codebase's typed, class-based,
`useSyncExternalStore` versions — see 1.1.0 above), or simply missing
(Vengeance UI, the FAQ/method/privacy pages, the Python data tooling, this
changelog). None of it was ported.

### Known follow-up

This merge only had the two Next.js exports to work from — not the sibling
single-file HTML edition (`../evolution-sandbox/`) that `data:sync` /
`data:check` normally keep in step with this one. The four new discoveries
and three new recipes above should be backported into that project's data
by hand (or regenerated there) the next time it's available, or the two
editions will disagree on what's discoverable.

## 1.1.0 — 11 September 2026

An audit of the 9 September build, then fixes for everything it found.

### Data and sources

- **Sources are now graded, and the honesty rule is enforced.** Each source has a
  `scope`: `topic` (a page about the subject or its field) or `general` (a
  homepage, portal, collection search or index). 88 entries had been citing only
  general pages — 91 counting three whose one specific citation was off-topic —
  while the interface said "Every claim carries its evidence and its source",
  and none used the `source_required` flag the project's own rule called for.
- **28 new subject-level sources**, each fetched and checked against the entry's
  claims on 11 September 2026 — among them UNESCO, WHO, NASA, GPS.gov, the Nobel
  Foundation, the Smithsonian's 1903 Wright Flyer record, IEEE milestones, the
  Corning Museum of Glass, the American Chemical Society, and two peer-reviewed
  papers (*Nature* 2009 on the Swabian Jura flutes; *Living Reviews in
  Relativity* 2003 on GPS relativity). They cover the 14 hidden finds that had
  none, and computer, integrated circuit, microprocessor, vacuum tube, radio,
  telegraph, telephone, flight, artificial intelligence and smartphone.
- **67 entries are now marked `source_required`** (91 − 24); the archive has a
  filter for them. Four citations that did not cover their entry were removed
  (cinema ← a computer-graphics timeline; photography ← electric lighting; data
  and virtual city ← urbanisation data).
- All 39 existing URLs re-checked. The Met's Uruk essay moved to its current
  address, same essay.
- **Grand Theft Auto VI** is rated *rare*: it is one of the 200 core entries but
  had the rarity *hidden*, so its exhibit said "Hidden find" while the counters
  treated it as core. Its release date (19 November 2026) was re-verified against
  Take-Two's fiscal Q1 2027 results of 7 August 2026, now cited.
- Three texts aligned with their sources: **music** (the flutes are more than
  35,000 years old; UNESCO places the region's finds at 43,000–33,000 years),
  **glass** (≈ 4,000 years ago, not 3,500), **compass** (navigational use in the
  12th century; the contested Han-dynasty claim dropped).

### Tools

- `validate.py`: new checks — rarity vs hidden flag (E9), general-only sources
  without `source_required` (E10), malformed registry entries (E11), duplicate
  flags (E12), flag alongside a real source (W4), uncited sources (W5). UTF-8
  output so the report prints on a Windows console.
- `build_db.py`: adds `dataHash` (fingerprint of the authored data),
  `sourcesChecked` and `counts.sourceRequired`; escapes `</` in `db.js` so data
  text can never close the inline script.
- `build_artifact.py`: the check for a stray `</script>` or `</style>` in the
  injected files was dead code; it now fails the build, and a missing
  `build/db.js` gives a clear message.
- `patch_recipes.py`: safe to re-run — already-applied patches are skipped.
- `test_artifact.js`: no hard-coded browser path; 12 scenarios instead of 9,
  covering every fix below.

### Single-file edition

- **Exhibits opened from the graph or the archive were invisible** — the panel
  lived inside the hidden workspace view. It is now a column beside the bench,
  a drawer over the graph and the archive (with a close button and focus
  handling), and a full-width sheet on a phone.
- **"Start over" works in sandboxed frames.** `window.confirm()` is silently
  blocked there (the Artifact host is one), which left the button dead; it now
  asks in the page, keyboard-accessible.
- **Search results are clickable in every view.** The top bar now sits above
  the views; its dropdown had been painted under the graph canvas.
- The graph repaints only when something changes, instead of 60 times a second.
- The phone menu button is hidden on desktop by the stylesheet rather than an
  inline style, and the sheet's grab handle is hidden on desktop too.
- The search box shows its `/` shortcut; the archive footnote shows the date the
  sources were last checked.

### Next.js edition

- **Hydration no longer fails for returning players.** Saved progress was read
  during the first render, so the browser's markup never matched the server's.
  The engine is now an external store read with `useSyncExternalStore`, and
  progress loads after hydration.
- **Vengeance UI is actually used**: `AnimatedNumber` (top-bar counter),
  `StatsCounter` (archive), `Kbd` (search hint), `LineHoverLink` (page links),
  `FaqAccordion` (FAQ) — copied from the registry under MIT, restyled onto the
  project's tokens, each change listed in its header. framer-motion, previously
  an unused dependency, now drives two of them, pinned to the major version
  upstream uses (12.x).
- **Tailwind carries this app's own pages**; the shared design system moved into
  Tailwind's `components` layer, where its `button { padding: 0 }`-style resets
  no longer override utilities.
- **FAQ structured data fixed** — every JSON-LD answer was the question repeated.
  The FAQ's lens/telescope sentence now matches the graph.
- **Linting works again**: Next.js 16 removed `next lint`; ESLint 9 with
  `eslint-config-next` in a flat config.
- **No placeholder domain.** The site URL comes from `NEXT_PUBLIC_SITE_URL`
  (see `.env.example`), then Vercel's production domain, then localhost.
- Fonts via `next/font`, self-hosted: visitors' browsers no longer contact Google.
- Parity with the single-file edition: the same exhibit drawer, in-page reset
  confirmation, `/` shortcut, desktop-hidden menu button, idle graph and
  non-passive wheel zoom; "See the whole path" filters and frames the graph;
  clearing the first slot slides the second across instead of duplicating it.
- `npm run data:sync` / `data:check` keep data, tools and stylesheet identical
  to the canonical project; the Python tools run through `tools/py.mjs`, and
  `data:build` no longer shells out to `cp`, so all scripts work on Windows.

### Not verified here

The Next.js app could not be installed or built in the environment where these
fixes were made (the package registry was unreachable). Its components were
exercised instead through a harness: server-rendered and hydrated by React 19 in
Chromium, with `next/link` and framer-motion replaced by minimal stand-ins and
Tailwind compiled by a local Tailwind 3 — 13 scenarios, including the
returning-player hydration case that fails on the 1.0 code. Run
`npm install && npm run typecheck && npm run lint && npm run build` once on a
machine with network access to confirm.
