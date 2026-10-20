# Arena Clash visual bible — Storybook Fantasy + Toybox Arcade

**Illustrative world, joyful readable pieces**: detailed scenic maps (large shaded tree clusters, bridges, fountains, banners, gears, crystals, walkways) balanced with bright simple characters/tactical glyphs. Original 2D vectors, hand-designed silhouettes, thick tapered/deliberate outlines. Cute characters have no visible faces; character via hats, capes, gait, silhouette and tools. No copied game characters or licensed textures; examples are conceptual style labels only.

Design grammar: terrain 3 levels (background soft scenery, traversable texture, interactive high-contrast borders); character silhouette readability at 24px; zone/flag/orb readable at <36px; UI frames feel like engraved game signs, not a stack of generic SaaS cards. Map art detail must NEVER obscure collision or objective circles. Height maps no false top-down geometry. Responsive world camera and clear mini-map.

Palettes:
Meadow `#96d881 #f7cd61 #75c8ef #e96f6e`, Clockwork `#f9c967 #ef8b57 #64cbba #8e83dc`, Crystal `#76d9d2 #b89ae9 #ffd36a #f58091`.
Ink `#203241`, paper `#fff3d9`, UI `#2b4b5b`, bright lime `#d8f577`.

Animations: anticipation/windup 100-160ms, move 5–8fps secondary pose, idle breathing <=3% scale, objective capture ring 4s with 4 distinct segment changes, banner pickup 180ms pop, deposit sparkle 450ms, zone rotation 800ms with 2s warning, question freeze camera settles <300ms. Lower-motion must suppress parallax and particle effects while retaining information.

Typography: friendly display 28-44px, question 22-32px, labels >=14px desktop/16px mobile; avoid illegible embossed lettering. No slogans/marketing quotes, no face art or photoreal AI gloss, no rainbow gradients, no 3D balloon creatures.


## Added requirement from latest review
Arena Clash must exceed the final visible quality of the currently implemented Tower Defense and Swarm Survival. It should not inherit their current weaknesses: under-detailed maps, weak animation, oversized persistent HUD chrome, or low spectacle objective feedback.

## Post-Game3 upgrade
Game 3 has a required premium visual overhaul; see `06_GAME3_PREMIUM_STORYBOOK_TOYBOX.md` and `07_GAME3_MOTION_AND_SCREEN_STORYBOARDS.md`. Use the result as Arena Clash's MINIMUM dynamic artwork standard, not the old plain obstacle Canvas. Game 4 must deliver distinct rich maps, fully animated pieces/objectives, minimal live-match UI, excellent mobile accessibility.
