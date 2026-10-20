# Game 3 — Premium visual redesign (Obstacle Survival), full design bible

## Goal and quality reference

Previous Game 1 (Tower Defense) is the user’s best so far, but still below standard; Game 2's design and animations are worse. Game 3 must be noticeably **above both**, not merely match their current quality. The user selected the aesthetic blend **detailed Storybook Fantasy scenery + bright, colorful, cute Toybox Arcade game characters**. Draw all assets originally; never copy Kingdom Rush, Bloons, Survivor.io, or proprietary sprites. No faces or AI-looking portraits; personality from expressive silhouette, capes/tools, squash/stretch, proportions and accessories. UI text English only. No slogan headlines, quotation-style copy, emoji decorations, stock photos, gradients-as-background-identity, generic SaaS cards.

The original Game 3 pack is NOT the final art bar. Its 20 SVG concepts are compositional references only. The current dynamic canvas draws flat backgrounds and simple bodies: replace with an authored **layered world** while keeping all gameplay and hitboxes honest.

## Creative concept: an illustrated obstacle atlas with handmade toys

Four chapters/biomes must feel like distinct locations with topology and local prop families. Avoid repeating a few tinted squares to create a 'new map'.

| Map | Palette story | Unique layered environmental set | Dynamic set dressing (non-colliding) | Character color readability |
|---|---|---|---|---|
| Chalkyard Circuit | honey limestone, grassy mint, coral pennants, charcoal ink | worn chalk trails, crooked fences, pavilions, tiny mill, bridge, flower patches, stone markers | chalk dust on sprint, animated stream, fabric pennants, leaves passing | distinct from path; no body same cream as lane |
| Paperfold Canyon | lilac rock, apricot sand, sea-green plants | 3-depth paper cliffs, folding bridges, windmills, carved stairway, canyon banners | drifting paper slips, wind direction lines, raised flap shadows | saturated role colors with dark outer stroke |
| Lantern Harbor | turquoise pier, coral buoys, gold lanterns | harbor boardwalk, rope details, reeds, lantern posts, sail silhouettes, tiny watercraft | water ripples, rope sway, reflected points, seagull shapes (no animal faces) | high-contrast with ocean |
| Clockwork Commons | amber sandstone, blue machinery, mint moss | brass gears, carved clock plaza, arcade arches, rails, mechanical doors, hazard machine silhouette | rotating non-colliding clock hands, piston idles, gear-edge sheen | bright against warm metal |

Art layers ordered from back to front:
1. **Far decorative world**, large organic tonal land masses and distant architecture.
2. **Mid world**, 2–3 levels of vegetation, terrain edges, patterns, landmarks and bridge art.
3. **Gameplay lane geometry**, always accurate to walkable cells and safe route; player collision stays engine-owned.
4. **Hazards**, 12 unique animated families with precise warning and active alignment.
5. **Player sprites and squad cues**, each role immediately recognizable at mobile sizes.
6. **Near decorative props and weather**, strictly decorative and never hiding telegraphing.
7. **HUD, objective, minimap/navigation, quiz layer**, DOM with keyboard and screen-reader behavior.

### Terrain detail budget
- Each map: **at least 3 unique hero landmarks**, **at least 7 distinct prop silhouettes**, and 2–3 subtle environment loops (water, pennant, clock or leaves).
- Vary geometry at 3 scales (big backdrop, mid props, small ground marks); no tiling identical outlines along an entire map edge.
- Decorative density outside traverse corridor is high; **inside** it, hazards and safe lanes stay visually dominant.
- Every map scene should look distinctive even when desaturated and zoomed out.
- Add seeded prop placement based on map ID/seed/tile index; no Math.random inside render, no visual pop on reconnect or screenshot.

## Game piece character art (five roles)

These are original animated game pieces, **not a human face generator**.

| Role | Silhouette/personality | Tool | Distinct movement | Ability effect |
|---|---|---|---|---|
| Trailblazer | jaunty triangular kite body, asymmetrical scarf | small compass crest | leaning stride, scarf lag, speed streak | dash with ribbon trails and stretch, not teleport |
| Shieldbearer | rounded shield-bodied piece, sturdy boots | shield badge | deliberate squash/plant, small shield wobble | guard forms a layered expanding ring |
| Bridgewright | boxy paper carpenter and spring-loaded pack | folding bridge/plank | light clanks, pack jiggle, two-foot hop | plank unfurls across exact permitted cells |
| Pathfinder | diamond scout with little flag | compass/flag | darting step, animated cape pennant | survey ink route painted forward from verified data |
| Medic | pill-shaped pouch sprite with heart-cross motif, no face | first-aid satchel | soft bounce and follow-through | heal/recover pulse with visible area and status |

Required player animations per role: idle 4–6 drawings, move 6–8, hop 5–7, ability windup 3–5, stun 3–5, recovery 3–4, success 5–7; procedural skeletal/vector interpolation can replace full individual bitmaps only if it achieves equivalent visual fidelity and responsive control. Use art that preserves top-down readability at a 24–40 CSS pixel avatar. Encode role by silhouette and trim, team by color *plus* outline pattern/marker.

## 12 hazards: visible before dangerous, easy to understand

Every hazard has **idle → anticipate → warning → active → aftermath** states. Unlike current 0/1/2-only geometric transitions, every family gets a unique motion script and meaningful sound option. Physics active windows remain server-authoritative and must match visuals EXACTLY; never make danger look safe, or vice versa. No added physics without a separate design approval. Example actions:

- swipe bar: pivot winds up, sweeps with directional blur line, springs to rest.
- falling block: shadow increases in size, block drops with squash, dust puff and rebound.
- rolling drum: windup rotation, directional travel, bouncing emboss, stop wobble.
- spikes: dotted ground tremor, spikes grow, hold, retract.
- conveyor: moving ink arrows and gear teeth, direction label high contrast.
- slime: glossy but FLAT segmented splash and ripple (not gradient).
- pulse gate: charging rings and shutter door.
- laser grid: warning broken red crosshairs, solid beams only while active.
- crumble tile: hairline cracks, separation with floor fallback indicated.
- wind fan: visible current line path and animated turbine.
- bounce pad: spring coil flexes before impact.
- mud chute: drag ripples and slowly sagging material.

Reduced-motion: preserve *static* 'warning' vs 'active' borders and directional indicators; freeze extraneous decor, do not erase safety cues.

## Camera/viewport

Current `World.tsx` follows the body's exact coordinate each frame. Upgrade to a **critically damped/spring camera** with a tiny directional lookahead and clamped bounds; camera should not hop on every 50ms physics step. Separate visual camera from physics state. Offer compact course overview/minimap that visibly indicates player, teammate(s), next checkpoint, gate and direction. Use CSS/pixel ratio scaling without distortion.

Mobile: play area should own most of the viewport; joystick and Hop/Ability buttons should not obscure the lane or hide the question. Keep immersive layout; quality must not collapse into a small map beneath bulky menus. Landscape support incl. 640x360, 390x844, 375x667; no clipped labels/menus or horizontal scrolling.

## HUD and screen integration: eliminate the website wrapper

**The entire Game 3 mode**, not just the canvas, needs the new art language:
- Game mode poster/library card: authored illustrated scene that actually resembles real dynamic gameplay.
- Hub: playable-feeling preview map and short direct choices, not blocks of marketing text.
- Setup: illustrated map options with real landmarks; intuitive format/quiz length/team sizes; no dead premium approval switch.
- Join: scenic card, big code input, avatar preview, guest-friendly.
- Lobby: players arranged as living squad tokens near starting gate; single ready call to action.
- Active play: remove the full-width header and unnecessary permanent button row, retain **small essential chips** (chapter, points, next gate/phase). One small `Menu` button opens controls/help/accessibility/exit. Avoid game-filling overlays during traversal.
- Question: arrest all motion *correctly* and visually dim the course; present large readable question with consistent focus trap, timer based on server deadline, answer type media support.
- Reveal/perk shop: rewards should feel tactile. Card reveals, snap animations and coin-flow (only points currency) with no gambling pressure; purchases show exactly what will change.
- Teacher: vivid map and team meters with uncluttered operational controls; number of answers and readiness visible without leaking answers on projector.
- Projector: landscape overview, legible from 5–7 meters, no student personal details when names hidden.
- Results: visual chapter recap showing movement mastery and learning accuracy, not a generic scoreboard table.
- Practice: **one solo balanced loadout**, one-click, map selection and gentle mode.

## Performance and accessibility budgets

- Target browser render 60fps on mainstream desktop, stable 30fps on representative budget Android; this is an **objective to measure**, not a claim.
- Avoid full redraw of thousands of offscreen props: view frustum culling + cached biome chunks/offscreen canvas, stable seeded landmarks; profile allocation per frame, FPS and dropped frames.
- Keep core meaningful animations independent of low-FX decorative loops.
- Animation scaling must respect `prefers-reduced-motion`, audio off initially, visible keyboard focus and clear feedback in all contrast modes.
- DOM overlays remain proper semantic controls, avoid canvas-only buttons.

## No-release-until visual comparison

Deliver before/after captures on EACH of the four maps, and genuine motion evidence of: walk/hop, 4 representative hazards, role ability, freeze/reveal, checkpoint/shop, boss/finale if present. Include at least 8 **dynamic** screenshots from actual game rendering across hub/setup/join/lobby/game/question/teacher/projector/results, and a brief annotated art change report. Static imported hero JPG alone does not count.
