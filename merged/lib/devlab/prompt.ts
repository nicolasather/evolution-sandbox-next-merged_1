/* Prompt builder for the plate-spec generator (development only). Built from the live component tables. */

import { catalogueText, LIMITS } from './schema';
import type { ResourceEntry } from './types';

export const SPEC_EXAMPLE = {
  title: 'Three-legged stool (format example only)',
  layers: [
    { z: -6, parts: [{ c: 'stick', x: 38, y: 76, p: { x1: 0, y1: 0, x2: -8, y2: 14, t: 3 }, w: 'fine' }] },
    {
      z: 0,
      parts: [
        { c: 'ellipse', x: 50, y: 40, p: { rx: 26, ry: 7 }, w: 'main' },
        { c: 'ellipse', x: 50, y: 46, p: { rx: 26, ry: 7, a0: 0, a1: 180 }, w: 'fine' },
        { c: 'stick', x: 30, y: 46, p: { x1: 0, y1: 0, x2: -6, y2: 36, t: 4 } },
        { c: 'stick', x: 70, y: 46, p: { x1: 0, y1: 0, x2: 6, y2: 36, t: 4 } },
        { c: 'dots', x: 50, y: 40, p: { n: 5, spread: 14, seed: 3 }, o: 0.6 },
      ],
    },
  ],
};

export function systemPrompt(): string {
  return `You design wireframe line-art "plates" for an archaeology / history game. Each plate is a thin glowing line drawing of ONE object on a dark background, in the style of an engraved technical illustration: confident silhouette, intricate secondary curves, fine detail lines, a few tiny glowing dots.

You never write code and never write SVG. You answer with ONE JSON object only (no prose, no markdown) built from the component catalogue below.

JSON SHAPE
{ "title": string, "layers": [ { "z": number, "parts": [ { "c": <component id>, "x": number, "y": number, "rot": number, "s": number, "flip": boolean, "w": "bold"|"main"|"fine"|"hair", "o": number, "p": { <component parameters> } } ] } ] }

COORDINATES
- The plate is a 100 x 100 box, origin top-left, x to the right, y DOWN. Centre = (50,50).
- "x","y" place the part's local origin in the box (for components marked auto-centred, x,y is the middle of the part).
- "rot" degrees clockwise, "s" uniform scale (default 1), "flip" mirrors left-right. "w" overrides line weight, "o" is opacity 0.15-1.
- Component parameters use the component's own local units (about the same size as plate units). Parameters with "!" are required.
- Everything is clamped; keep the whole object inside roughly 10..90 in both directions and centred.

HOW TO DRAW WELL
- Pick the components that give the object's true silhouette first (heavy "main" outline), then add fine and hair detail (grain lines, ribs, rivets, hatching, facets, dots).
- Use 2-4 layers with different z (for example -6, 0, 6; larger z = nearer the viewer) so the 3D wireframe has depth: back parts at negative z, the main body at 0, front details at positive z.
- Use between ${LIMITS.maxParts > 24 ? 8 : 6} and ${LIMITS.maxParts} parts in total. More parts for complex objects. At most ${LIMITS.maxLayers} layers and ${LIMITS.maxPartsPerLayer} parts per layer.
- Combine components: e.g. an arch + courses + stick supports, a lathe body + stick handle + ring_set rim. Show the object from its most recognisable side view (or a slight three-quarter view where the component supports it).
- No text, letters or numerals. Do not invent component ids or parameter names.

COMPONENT CATALOGUE (id: description, then parameters name:type[min..max]=default, "!" = required)
${catalogueText()}

FORMAT EXAMPLE (shape only, not a drawing to copy)
${JSON.stringify(SPEC_EXAMPLE)}`;
}

export function userPrompt(r: ResourceEntry): string {
  return `Design the plate for this object.

Name: ${r.name}
What it is: ${r.description}
Period: ${r.period}
Materials: ${r.materials.join(', ')}
Shape family: ${r.shapeFamily}
Recognisable visual features to include: ${r.features.join('; ')}
Complexity target: ${r.complexity} of 5 (${r.complexity >= 4 ? '22-40 parts, rich detail' : r.complexity === 3 ? '14-28 parts' : '8-20 parts'})

Reply with the JSON object only.`;
}

export function feedbackPrompt(errors: string[]): string {
  const list = errors.slice(0, 14).map(e => `- ${e}`).join('\n');
  return `That JSON was rejected by the validator:\n${list}\n\nFix every problem and reply with the complete corrected JSON object only.`;
}
