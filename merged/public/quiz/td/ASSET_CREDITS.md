# Tower Defense art: origin and licence

Every image in this folder is an original vector drawing made for Quiz Studio. Each one is built from simple geometric shapes in code
(`lib/quiz/td/art.ts`) and written to disk by `tools/td-art/build.ts`. Run `npx tsx tools/td-art/build.ts` to regenerate the set and
the contact sheet (`index.html`).

- No traced screenshots, no third-party sprites, no web photos, no brand artwork, no AI-generated images.
- No faces or portraits. Enemies are shapes with markings (stripes, plates, rings); roles are tool emblems.
- No gradients. The look is flat fills with a 3 px ink outline (`#19283A`).
- The renderer draws the same SVG strings at runtime (`components/quiz/td/sprites.ts`, data URIs). The game loads nothing from a CDN.
- The ZIP's reference images (`07_ORIGINAL_VISUAL_REFERENCES`) were used only as direction. No file from them is shipped.

| Set | Files | Count |
|---|---|---|
| Towers: 6 families × 3 levels × idle/firing | `tower_<kind>_l<1-3>[_fire].svg` | 36 |
| Enemies: 8 kinds × idle/move/hit | `enemy_<kind>_<pose>.svg` | 24 |
| Bosses: 3 × normal/final phase | `boss_<id>[_final].svg` | 6 |
| Roles | `role_<role>.svg` | 5 |
| Question formats | `kind_<kind>.svg` | 5 |
| Maps (full boards) | `map_<id>_board.svg` | 3 |
| Core and gate | `core.svg`, `spawn.svg` | 2 |

Licence: same as the repository. Authored in October 2026 for this project.

## October 2026 redesign addendum

Towers, enemies, bosses, props (bridges, shrubs, lanterns, fence posts, signboards, rocks, banners, gears, crystals) and the three full-board maps were redrawn
for the storybook/toybox direction. Still original vector code (`lib/quiz/td/art.ts`, `lib/quiz/td/boardart.ts`), no external or generated imagery, no faces.
