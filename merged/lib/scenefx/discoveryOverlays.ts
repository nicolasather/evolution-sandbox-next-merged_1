import { regionsFor } from './regions';

/* ============================================================================
   DISCOVERY OVERLAYS — the first slice of "discoveries reshape the world"
   (brief P2.1) rather than only "era swaps the background."

   The backdrop is still one picture per era (SceneBackdrop, data/scenes.json)
   — that system is untouched. This adds small, extra marks layered on top of
   whichever scene is showing, gated on something the player actually found,
   not on era. Because the gate is the discovery and not the era, a mark keeps
   appearing in every later scene too, which is also brief P2.5 ("the world
   should remember") for free: reach the Ancient City and the campfire you lit
   in the Stone Age is still there.

   Placement reuses the same ground polygons the click-response system already
   traces per scene (lib/scenefx/regions.ts, data/scene-regions.json) — a
   scene with nowhere dry to stand (its 'dust' region) gets no mark, rather
   than guessing a position that might land in water or sky. Same stroke-only
   language as the scenes themselves: every path here starts from an absolute
   M anchor and moves with relative commands after it, so shiftPath only ever
   has to edit that one anchor to relocate a whole shape.
   ========================================================================== */

const round = (n: number) => Math.round(n);

/** Move a template path drawn at its own origin to (dx, dy) further along. Only the
 *  absolute M that starts each subpath needs to change — everything after it in this
 *  codebase's paths is relative (l/q/h/v), so the shape itself is untouched. */
export function shiftPath(d: string, dx: number, dy: number): string {
  return d.replace(/M(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g,
    (_, x: string, y: string) => `M${round(Number(x) + dx)} ${round(Number(y) + dy)}`);
}

function centroid(poly: readonly (readonly [number, number])[]): [number, number] {
  let x = 0, y = 0;
  for (const [px, py] of poly) { x += px; y += py; }
  return [round(x / poly.length), round(y / poly.length)];
}

/** A loose ring of stones, drawn in ground perspective (flattened ellipse). */
function stoneRing(cx: number, cy: number, rx = 26, ry = 10, n = 8): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
    const tx = -Math.sin(a) * 5, ty = Math.cos(a) * ry * 0.2;
    d += `M${round(x - tx)} ${round(y - ty)}l${round(tx * 2)} ${round(ty * 2)}`;
  }
  return d;
}

function crossedLogs(cx: number, cy: number): string {
  return `M${round(cx - 18)} ${round(cy - 2)}l30-16M${round(cx - 14)} ${round(cy - 14)}l28 18`;
}

// the forge scene's own hearth flame, reused rather than a second flame shape invented
// from scratch — only its anchor moves; the strokes after it are unchanged.
const FLAME_TEMPLATE = 'M242 695l-7-2M243 692l-6-4M245 690l-5-5M247 688l-2-6M250 688l0-7M253 688l2-6' +
  'M255 690l5-5M257 692l6-4M258 695l7-2M240 700q6-16 10-8M250 692q6-12 10 8';
const FLAME_ANCHOR = { x: 250, y: 692 };

function smokeWisps(cx: number, cy: number): string {
  const pts: [number, number][] = [[-10, -16], [6, -30], [-4, -46], [10, -58], [-8, -70]];
  let d = '';
  for (const [dx, dy] of pts) d += `M${round(cx + dx)} ${round(cy + dy)}l1-3`;
  return d;
}

export const CAMPFIRE_DISCOVERY_ID = 'controlled_fire';

function campfireMarkup(cx: number, cy: number, depth: number): string {
  const flame = shiftPath(FLAME_TEMPLATE, cx - FLAME_ANCHOR.x, cy - 18 - FLAME_ANCHOR.y);
  return `<g data-depth="${depth}">` +
    `<path d="${stoneRing(cx, cy)}" stroke-width="1.3" opacity="0.75"/>` +
    `<path d="${crossedLogs(cx, cy - 4)}" stroke-width="1.4" opacity="0.85"/>` +
    `<g class="flicker"><path d="${flame}" stroke-width="1.2"/></g>` +
    `<g class="rise"><path d="${smokeWisps(cx, cy - 18)}" stroke-width="1.6" opacity="0.55"/></g>` +
    `</g>`;
}

interface DiscoveryOverlay {
  /** The exact discovery that reveals this mark, permanently, once found. */
  discoveryId: string;
  build(cx: number, cy: number, depth: number): string;
}

/** Add to this list to layer in another discovery's mark — each one only needs a
 *  discovery id and a small shape; placement, gating and reuse across scenes and
 *  eras all come for free from overlaysFor below. */
const OVERLAYS: DiscoveryOverlay[] = [
  { discoveryId: CAMPFIRE_DISCOVERY_ID, build: campfireMarkup },
];

/** Extra stroke-only markup (may be empty) to append to a scene's own SVG: one mark
 *  per discovery the player has actually made, that this scene has dry ground for. */
export function overlaysFor(sceneId: string, discovered: ReadonlySet<string>): string {
  const dust = regionsFor(sceneId).find(r => r.kind === 'dust');
  if (!dust) return '';
  const [baseX, baseY] = centroid(dust.poly);
  let out = '', i = 0;
  for (const o of OVERLAYS) {
    if (!discovered.has(o.discoveryId)) continue;
    out += o.build(baseX + i * 90, baseY, dust.depth);
    i++;
  }
  return out;
}
