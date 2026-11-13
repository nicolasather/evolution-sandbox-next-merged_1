/* ============================================================================
   MODE STAGE ART — one hand-drawn line object per extra mode. Each is a 100×100
   SVG fragment (trusted constants only, never user input). The 3D stage extrudes
   these lines into a floating wireframe with the same engine the merge plates use
   (components/Plate3D.tsx, `svg` prop), so every mode gets real depth without WebGL.
   ========================================================================== */

export type StageMode = 'minimum-path' | 'escape-room' | 'decipher' | 'reverse-evolution' | 'archaeology' | 'alien-archaeology';

export const STAGE_ART: Record<StageMode, string> = {
  /* A small network with one route drawn through it. */
  'minimum-path':
    '<circle cx="14" cy="72" r="7"/><circle cx="40" cy="30" r="7"/><circle cx="68" cy="62" r="7"/><circle cx="86" cy="20" r="7"/>' +
    '<path d="M21 68 L34 36"/><path d="M47 33 L62 58"/><path d="M74 57 L81 26"/>' +
    '<path d="M20 84 L62 92 L88 74"/><path d="M14 65 L14 60"/>',
  /* A padlock with a keyhole and a shackle that is one step from opening. */
  'escape-room':
    '<rect x="24" y="46" width="52" height="40"/><path d="M34 46 V32 a16 16 0 0 1 32 0 V46"/>' +
    '<circle cx="50" cy="62" r="5"/><path d="M50 66 V77"/><path d="M30 54 H70"/><path d="M30 78 H70"/>',
  /* A carved tablet with three glyph marks and a ruled border of strata lines. */
  'decipher':
    '<rect x="22" y="12" width="56" height="76" rx="4"/><path d="M34 28 L48 28 L41 42 Z"/><path d="M60 28 V42 M60 35 H68"/>' +
    '<path d="M34 56 H66"/><path d="M34 66 L44 74 L56 66 L66 74"/><path d="M30 80 H70"/>',
  /* A dependency tree: one complex object at the top, three branches, three raw materials below. */
  'reverse-evolution':
    '<rect x="36" y="8" width="28" height="14"/><path d="M50 22 V36 M18 36 H82"/>' +
    '<path d="M18 36 V48 M50 36 V48 M82 36 V48"/>' +
    '<rect x="8" y="48" width="20" height="14"/><rect x="40" y="48" width="20" height="14"/><rect x="72" y="48" width="20" height="14"/>' +
    '<path d="M18 62 V76 M50 62 V76 M82 62 V76"/><circle cx="18" cy="86" r="6"/><circle cx="50" cy="86" r="6"/><circle cx="82" cy="86" r="6"/>',
  /* A dig cut into the ground: a surface line, layered strata and a buried shard. */
  'archaeology':
    '<path d="M8 34 H92"/><path d="M14 34 L24 70 H76 L86 34"/>' +
    '<path d="M12 46 H88"/><path d="M18 58 H82"/><path d="M24 70 H76"/>' +
    '<circle cx="40" cy="54" r="4"/><path d="M58 52 L68 44 L72 56 Z"/>',
  /* A monolith with an orbital ring and three glyph bars carved into its face. */
  'alien-archaeology':
    '<path d="M38 92 V24 L50 8 L62 24 V92 Z"/><ellipse cx="50" cy="60" rx="42" ry="11"/>' +
    '<path d="M45 38 H55"/><path d="M45 50 H55"/><path d="M45 62 H55"/>' +
    '<circle cx="84" cy="30" r="4"/>',
};

/* ----------------------------------------------------------------------------
   BACKDROP — a wide, quiet strip of each mode's own world, drawn behind the
   object as two depth planes: a far plane (thin, faint) and a near plane (a
   touch heavier and brighter). Viewbox 400×140. Trusted constants only.
   ---------------------------------------------------------------------------- */

export interface BackdropPlanes { far: string; near: string }

export const BACKDROP_ART: Record<StageMode, BackdropPlanes> = {
  /* Route network: nodes joined by long, crossing edges, one route traced through. */
  'minimum-path': {
    far: '<path d="M10 120 L90 40 L170 100 L250 20 L330 90 L390 30"/><path d="M40 20 L140 70 L240 60 L360 120"/>',
    near: '<circle cx="90" cy="40" r="5"/><circle cx="250" cy="20" r="5"/><circle cx="330" cy="90" r="5"/><path d="M90 40 L250 20 L330 90" stroke-dasharray="4 5"/>',
  },
  /* Mechanism: a gear train, teeth as short ticks, and the linkage that connects them. */
  'escape-room': {
    far: '<circle cx="110" cy="70" r="46"/><circle cx="300" cy="70" r="30"/><path d="M160 70 H270"/>',
    near: '<circle cx="110" cy="70" r="14"/><circle cx="300" cy="70" r="8"/><path d="M96 24 V16 M124 24 V16 M96 116 V124 M124 116 V124 M16 70 H4 M204 70 H216"/>',
  },
  /* A tablet: ruled lines of text, glyph strokes at the baseline, a fracture line. */
  'decipher': {
    far: '<path d="M20 30 H380 M20 46 H380 M20 62 H380 M20 78 H380 M20 94 H380 M20 110 H380"/>',
    near: '<path d="M40 30 H150 M170 46 H300 M40 62 H120 M150 78 H260 M40 94 H200"/><path d="M280 14 L292 40 L276 60"/>',
  },
  /* A dependency tree: branches splitting down into raw materials. */
  'reverse-evolution': {
    far: '<path d="M200 10 V40 M80 40 H320 M80 40 V70 M200 40 V70 M320 40 V70 M80 70 V110 M200 70 V110 M320 70 V110"/>',
    near: '<circle cx="200" cy="10" r="4"/><circle cx="80" cy="110" r="4"/><circle cx="200" cy="110" r="4"/><circle cx="320" cy="110" r="4"/>',
  },
  /* A dig: stacked strata curves and a cut edge, the layers that get excavated in order. */
  'archaeology': {
    far: '<path d="M0 40 Q100 30 200 42 T400 40"/><path d="M0 70 Q100 60 200 72 T400 70"/><path d="M0 100 Q100 90 200 102 T400 100"/>',
    near: '<path d="M0 124 Q100 116 200 126 T400 124"/><path d="M60 40 V70 M300 42 V72" stroke-dasharray="2 4"/>',
  },
  /* An orbit: a horizon, concentric rings around the monolith, and a few satellites. */
  'alien-archaeology': {
    far: '<path d="M0 118 H400"/><ellipse cx="200" cy="90" rx="180" ry="40"/><ellipse cx="200" cy="90" rx="120" ry="24"/>',
    near: '<ellipse cx="200" cy="90" rx="60" ry="10"/><circle cx="90" cy="60" r="3"/><circle cx="320" cy="40" r="3"/>',
  },
};
