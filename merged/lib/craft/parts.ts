/* ============================================================================
   PARTS — plain hardware drawn in the same single-stroke language as the
   plates: pegs, rods, planks, a wheel, a gear. Used where a process needs a
   piece that is not itself a discovery (the rungs of a ladder, the wheels of
   a cart) and must never spoil one the player has not found yet.
   Each is 100×100, stroke = currentColor.
   ========================================================================== */

const P: Record<string, string> = {
  rod: '<path d="M10 50H90"/><circle cx="10" cy="50" r="3"/><circle cx="90" cy="50" r="3"/>',
  plank: '<rect x="8" y="38" width="84" height="24"/><path d="M16 46h30M50 54h34M22 58h18" opacity=".6"/>',
  log: '<path d="M18 34h62v32H18"/><ellipse cx="18" cy="50" rx="7" ry="16"/><path d="M14 50a3 8 0 0 1 8 0" opacity=".6"/>',
  peg: '<path d="M50 10l9 14v50l-9 16-9-16V24z"/><path d="M44 30h12" opacity=".6"/>',
  stake: '<path d="M50 8l8 16v68H42V24z"/>',
  pole: '<path d="M50 6v88"/><path d="M46 6h8M46 94h8" opacity=".6"/>',
  rung: '<path d="M18 50h64"/><circle cx="18" cy="50" r="3"/><circle cx="82" cy="50" r="3"/>',
  wheel: '<circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="7"/><path d="M50 12v31M50 57v31M12 50h31M57 50h31"/>',
  axle: '<path d="M6 50h88" stroke-width="5"/><circle cx="6" cy="50" r="4"/><circle cx="94" cy="50" r="4"/>',
  frame: '<rect x="8" y="30" width="84" height="40"/><path d="M8 50h84M30 30v40M70 30v40" opacity=".6"/>',
  gear: '<circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="8"/><path d="M50 14v10M50 76v10M14 50h10M76 50h10M24 24l7 7M69 69l7 7M76 24l-7 7M31 69l-7 7"/>',
  cord: '<path d="M12 60c14-34 26 34 40 0s26 34 38 0"/>',
  cover: '<path d="M10 74C22 30 78 30 90 74z"/><path d="M50 34v40" opacity=".6"/>',
  hull: '<path d="M8 42h84c-6 24-20 36-42 36S14 66 8 42z"/><path d="M18 42v-10M82 42v-10" opacity=".6"/>',
  pipe: '<rect x="8" y="40" width="84" height="20"/><path d="M28 40v20M72 40v20" opacity=".6"/>',
  chip: '<rect x="26" y="26" width="48" height="48"/><path d="M36 26v-10M50 26v-10M64 26v-10M36 74v10M50 74v10M64 74v10M26 36h-10M26 50h-10M26 64h-10M74 36h10M74 50h10M74 64h10"/>',
  hearthstone: '<path d="M20 60l8-20 24-6 22 12 4 22-24 12z"/>',
};

export const PART_IDS = Object.keys(P);
export const isPart = (id: string) => id in P;

export function partSvg(id: string): string {
  const inner = P[id] ?? P.rod;
  return `<svg class="g" viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
