'use client';
import { memo, type ReactElement } from 'react';
import type { CharacterId } from '@/lib/characters/types';

/* Three coloured line-drawn creatures: bold light edges over saturated fills, so they glow against the game's dark chalk scenery.
   Every rig exposes the same named joints (`data-joint`) so one clip retargets to each: root (the wrapper), body, head, eye (inside the head),
   armL, armR, legs, tail, prop and fx (small effect marks switched on by a clip).
   Kip   — amber stone-shelled, many-limbed creature: faceted carapace, jointed limbs, a cyan sensing ring instead of a face.
   Vex   — a tall coral wire figure on springing gold legs with one lime slit eye, a pink whip-cable tail and an antenna.
   Orra  — a floating teal lantern-bell with violet filaments, a golden orbiting ring and three apertures. */

const INK = 'var(--ink-0, #0e0d0b)';
const RED = '#ff6b6b', BLUE = '#7cc7ff';
const K_SHELL = '#b5651f', K_LIGHT = '#e8a24a', K_DARK = '#6b3410', K_RIM = '#ffe0a0', K_LIMB = '#ffc468', K_GLYPH = '#fff1c4', K_EYE = '#4de3d0';
const V_BODY = '#c63b55', V_HEAD = '#ea5a63', V_DARK = '#7d1f38', V_RIM = '#ffc7c0', V_GOLD = '#ffd24a', V_LIME = '#b8ff5e', V_PINK = '#ff7ac0';
const O_BELL = '#237f93', O_LIGHT = '#6fe7d8', O_DARK = '#0f4a5a', O_RIM = '#9ff5ea', O_VIOLET = '#b794ff', O_GOLD = '#ffd24a';

/** the tiny effect marks, all hand-drawn strokes; a clip switches them on with data-fx on the rig root */
function Fx({ x, y, accent }: { x: number; y: number; accent: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g data-joint="fx" style={{ stroke: accent }} strokeWidth="2">
        <g className="fx fx-stars">{[[-13, -12], [13, -14], [0, -21]].map(([a, b]) => <path key={a} transform={`translate(${a} ${b})`} d="M0 -3.4 L1 -1 L3.4 0 L1 1 L0 3.4 L-1 1 L-3.4 0 L-1 -1 Z" />)}</g>
        <g className="fx fx-tears" style={{ stroke: BLUE }}><path d="M-9 3 q-2.6 4 0 6 q2.6 -2 0 -6 Z" /><path d="M9 3 q-2.6 4 0 6 q2.6 -2 0 -6 Z" /><path d="M-9 12 v4 M9 12 v4" /></g>
        <g className="fx fx-zzz"><path d="M9 -10 h6 l-6 6.5 h6" /><path d="M17 -19 h4 l-4 4.5 h4" /></g>
        <g className="fx fx-bubble"><circle cx="9" cy="-9" r="1.4" /><circle cx="13" cy="-14" r="2.1" /><path d="M16 -22 q-4 -1 -3 -5 q1 -4 5 -3 q3 -4 8 -1 q5 1 3 6 q1 4 -4 4 q-3 2 -6 0 q-3 1 -3 -1 Z" /></g>
        <g className="fx fx-sweat" style={{ stroke: BLUE }}><path d="M14 -6 q-3 4 0 6 q3 -2 0 -6 Z" /></g>
        <g className="fx fx-anger" style={{ stroke: RED }}><path d="M8 -14 q3.5 0 3.5 3.5 M8 -9 q3.5 0 3.5 -3.5 M15 -14 q-3.5 0 -3.5 3.5 M15 -9 q-3.5 0 -3.5 -3.5" /></g>
        <g className="fx fx-hearts" style={{ stroke: RED }}><path d="M12 -10 c-6 -5 -3 -9 0 -6 c3 -3 6 1 0 6 Z" /><path d="M-12 -14 c-4 -3 -2 -6 0 -4 c2 -2 4 1 0 4 Z" /></g>
        <g className="fx fx-question"><path d="M9 -18 q0 -5 4 -5 q4 0 4 4 q0 3 -4 4 v2.5 M13 -8 v.4" /></g>
        <g className="fx fx-exclaim"><path d="M13 -24 v9 M13 -11 v.6" /></g>
        <g className="fx fx-sparkle"><path d="M13 -18 v7 M9.5 -14.5 h7" /><path d="M-13 -12 v4.5 M-15.3 -9.8 h4.6" /></g>
        <g className="fx fx-swirl"><path d="M-9 -17 q4.5 -7 9 0 q4.5 7 9 0" /><path d="M-6 -23 q3 -5 6 0 q3 5 6 0" /></g>
        <g className="fx fx-note"><path d="M10 -9 v-10 l7 -2 v10 M10 -9 a2.4 1.8 0 1 1 -.01 0 M17 -11 a2.4 1.8 0 1 1 -.01 0" /></g>
        <g className="fx fx-blush" style={{ stroke: RED }}><path d="M-12 5 l2.4 -3.4 M-8.5 5 l2.4 -3.4 M8.5 5 l2.4 -3.4 M12 5 l2.4 -3.4" /></g>
        <g className="fx fx-dust"><path d="M-14 14 q-4 -3 0 -6 q3 -4 7 -1 M12 14 q4 -3 0 -6 q-3 -4 -7 -1 M0 16 q3 -4 6 0" /></g>
        <g className="fx fx-smile"><path d="M-5 7 Q0 11.5 5 7" /></g>
        <g className="fx fx-laugh"><path d="M-6 6 Q0 14 6 6 Z" /></g>
        <g className="fx fx-frown"><path d="M-5 10 Q0 5.5 5 10" /></g>
      </g>
    </g>
  );
}

function Kip() {
  return (
    <>
      <g data-joint="legs" style={{ stroke: K_LIMB }} strokeWidth="3">
        {['M37 76 L28 85 L32 95 m-4 0 h8', 'M50 78 L50 88 L47 96 m-4 0 h8', 'M63 76 L72 85 L68 95 m-4 0 h8'].map(d => <path key={d} d={d} />)}
        <circle cx="28" cy="85" r="2.2" fill={K_SHELL} stroke={K_RIM} strokeWidth="1.4" /><circle cx="72" cy="85" r="2.2" fill={K_SHELL} stroke={K_RIM} strokeWidth="1.4" /><circle cx="50" cy="88" r="2.2" fill={K_SHELL} stroke={K_RIM} strokeWidth="1.4" />
      </g>
      <g data-joint="body" style={{ stroke: K_RIM }}>
        <path d="M50 38 L73 48 L80 66 L67 80 L33 80 L20 66 L27 48 Z" fill={K_SHELL} strokeWidth="2.2" />
        <path d="M50 38 L73 48 L67 58 L50 52 L33 58 L27 48 Z" fill={K_LIGHT} stroke="none" opacity=".9" />
        <path d="M50 38 L50 52 M27 48 L33 58 M73 48 L67 58 M20 66 L34 64 M80 66 L66 64 M33 80 L42 70 M67 80 L58 70 M33 58 L34 64 M67 58 L66 64" stroke={K_DARK} strokeWidth="1.5" />
        <path d="M42 66 l4 -3.2 l4 3.2 l4 -3.2 l4 3.2" stroke={K_GLYPH} strokeWidth="2" />
        <circle cx="30" cy="72" r="1.4" fill={K_GLYPH} stroke="none" /><circle cx="70" cy="72" r="1.4" fill={K_GLYPH} stroke="none" />
      </g>
      <g data-joint="armL" style={{ stroke: K_LIMB }} strokeWidth="3"><path d="M28 56 L14 56 L7 69 L11 80 M11 80 l-4 2 M11 80 l1 -5" /><circle cx="14" cy="56" r="2.4" fill={K_SHELL} stroke={K_RIM} strokeWidth="1.4" /></g>
      <g data-joint="armR" style={{ stroke: K_LIMB }} strokeWidth="3"><path d="M72 56 L86 56 L93 69 L89 80 M89 80 l4 2 M89 80 l-1 -5" /><circle cx="86" cy="56" r="2.4" fill={K_SHELL} stroke={K_RIM} strokeWidth="1.4" /></g>
      <g data-joint="head" style={{ stroke: K_RIM }}>
        <path d="M36 47 Q50 24 64 47 Z" fill={K_LIGHT} strokeWidth="2.2" />
        <path d="M42 42 Q50 33 58 42" stroke={K_DARK} strokeWidth="1.4" />
        <g data-joint="eye"><circle cx="50" cy="39" r="5.4" stroke={K_EYE} strokeWidth="2.2" fill="#0b2a2e" /><circle cx="50.8" cy="39.2" r="2.2" fill={K_EYE} stroke="none" /></g>
      </g>
      <g data-joint="tail" style={{ stroke: K_EYE }} strokeWidth="2.2"><path d="M37 27 Q50 11 63 27" /><path d="M43 22 Q50 14 57 22" opacity=".8" /><path d="M33 33 Q26 23 30 15 M67 33 Q74 23 70 15" opacity=".75" /><circle cx="30" cy="15" r="1.8" fill={K_EYE} stroke="none" /><circle cx="70" cy="15" r="1.8" fill={K_EYE} stroke="none" /></g>
      <g data-joint="prop" style={{ stroke: K_RIM }}><path d="M62 52 l5 -4 l8 2 l3 6 l-4 5 l-9 0 Z" fill={K_LIGHT} strokeWidth="1.8" /><path d="M66 53 l4 2 M70 50 l1 5" stroke={K_DARK} /></g>
      <Fx x={50} y={38} accent={K_EYE} />
    </>
  );
}

function Vex() {
  return (
    <>
      <g data-joint="legs" style={{ stroke: V_GOLD }} strokeWidth="3">
        <path d="M45 67 L36 76 L46 81 L36 90 L41 97 m-4 0 h9" /><path d="M55 67 L64 76 L54 81 L64 90 L59 97 m-4 0 h9" />
        <circle cx="36" cy="76" r="2.2" fill={V_BODY} stroke={V_GOLD} strokeWidth="1.4" /><circle cx="64" cy="76" r="2.2" fill={V_BODY} stroke={V_GOLD} strokeWidth="1.4" />
      </g>
      <g data-joint="body" style={{ stroke: V_RIM }}>
        <rect x="41" y="42" width="18" height="27" rx="5" fill={V_BODY} strokeWidth="2.2" />
        <path d="M41 51 h18 M41 60 h18" stroke={V_DARK} strokeWidth="1.5" />
        <path d="M45 45 v3 M55 45 v3 M45 54 v3 M55 54 v3 M45 63 v3 M55 63 v3" stroke={V_GOLD} strokeWidth="2" />
      </g>
      <g data-joint="armL" style={{ stroke: V_GOLD }} strokeWidth="3"><path d="M41 47 L28 53 L23 66 M23 66 l-3 3 M23 66 l4.4 2" /><circle cx="28" cy="53" r="2.2" fill={V_BODY} stroke={V_GOLD} strokeWidth="1.4" /></g>
      <g data-joint="armR" style={{ stroke: V_GOLD }} strokeWidth="3"><path d="M59 47 L72 53 L77 66 M77 66 l3 3 M77 66 l-4.4 2" /><circle cx="72" cy="53" r="2.2" fill={V_BODY} stroke={V_GOLD} strokeWidth="1.4" /></g>
      <g data-joint="head" style={{ stroke: V_RIM }}>
        <path d="M41 41 L59 41 L56 22 L44 22 Z" fill={V_HEAD} strokeWidth="2.2" />
        <path d="M56 22 L64 7" stroke={V_GOLD} strokeWidth="2.2" /><circle cx="64.6" cy="5.8" r="2.8" fill={V_LIME} stroke={V_GOLD} strokeWidth="1.4" />
        <g data-joint="eye"><circle cx="50" cy="31.5" r="6.2" stroke={V_LIME} strokeWidth="2.2" fill="#10240a" /><path d="M50 26 v11" stroke={V_LIME} strokeWidth="1.8" /></g>
      </g>
      <g data-joint="tail" style={{ stroke: V_PINK }} strokeWidth="2.6"><path d="M50 69 Q75 77 80 60 Q84 45 73 41" /><circle cx="72.4" cy="40.6" r="3" fill={V_BODY} stroke={V_PINK} /></g>
      <g data-joint="prop" style={{ stroke: V_GOLD }}><path d="M66 50 l6 -3 l7 3 v8 l-7 3 l-6 -3 Z" fill={V_HEAD} strokeWidth="1.8" /><path d="M66 50 l6 3 l7 -3 M72 53 v8" stroke={V_DARK} /></g>
      <Fx x={50} y={31} accent={V_GOLD} />
    </>
  );
}

function Orra() {
  return (
    <>
      <g data-joint="legs" style={{ stroke: O_VIOLET }} strokeWidth="2.6">
        <path d="M38 66 q-3 7 1 13 q3 6 -1 12" /><path d="M44 67 q-2 8 1 14 q2 6 0 12" /><path d="M50 68 q-1 8 1 15 q1 6 -1 11" /><path d="M56 67 q2 8 -1 14 q-2 6 0 12" /><path d="M62 66 q3 7 -1 13 q-3 6 1 12" />
        <circle cx="39" cy="91" r="1.8" fill={O_GOLD} stroke="none" /><circle cx="50" cy="94" r="1.8" fill={O_GOLD} stroke="none" /><circle cx="61" cy="91" r="1.8" fill={O_GOLD} stroke="none" />
      </g>
      <g data-joint="body" style={{ stroke: O_RIM }}>
        <path d="M28 56 Q33 67 39 58 Q45 68 50 58 Q55 68 61 58 Q67 67 72 56 Z" fill={O_BELL} strokeWidth="2.2" />
        <path d="M34 58 q16 6 32 0" stroke={O_DARK} strokeWidth="1.5" /><circle cx="41" cy="62" r="1.5" fill={O_GOLD} stroke="none" /><circle cx="59" cy="62" r="1.5" fill={O_GOLD} stroke="none" />
      </g>
      <g data-joint="armL" style={{ stroke: O_VIOLET }} strokeWidth="2.8"><path d="M33 53 L20 59 L14 71" /><path d="M11.6 71 l2.4 -3.4 l2.4 3.4 l-2.4 3.4 Z" fill={O_GOLD} stroke={O_GOLD} strokeWidth="1" /></g>
      <g data-joint="armR" style={{ stroke: O_VIOLET }} strokeWidth="2.8"><path d="M67 53 L80 59 L86 71" /><path d="M83.6 71 l2.4 -3.4 l2.4 3.4 l-2.4 3.4 Z" fill={O_GOLD} stroke={O_GOLD} strokeWidth="1" /></g>
      <g data-joint="head" style={{ stroke: O_RIM }}>
        <path d="M28 56 Q28 31 50 29 Q72 31 72 56 Z" fill={O_BELL} strokeWidth="2.2" />
        <path d="M35 53 Q35 38 50 36 Q65 38 65 53" fill={O_LIGHT} stroke="none" opacity=".55" />
        <path d="M41 32 L44 21 L50 30 L56 21 L59 32" stroke={O_GOLD} strokeWidth="2.2" />
        <circle cx="40.5" cy="46" r="2.6" fill="#071c1f" stroke={O_VIOLET} strokeWidth="1.6" /><circle cx="59.5" cy="46" r="2.6" fill="#071c1f" stroke={O_VIOLET} strokeWidth="1.6" />
        <g data-joint="eye"><circle cx="50" cy="42" r="4.6" stroke={O_GOLD} strokeWidth="2.2" fill="#071c1f" /><circle cx="50.6" cy="41.5" r="1.8" fill={O_GOLD} stroke="none" /></g>
      </g>
      <g data-joint="tail" style={{ stroke: O_GOLD }} strokeWidth="2"><ellipse cx="50" cy="48" rx="32" ry="7.5" strokeDasharray="7 3.5" opacity=".95" /><circle cx="82" cy="48" r="2.4" fill={O_VIOLET} stroke="none" /></g>
      <g data-joint="prop" style={{ stroke: O_RIM }}><rect x="64" y="52" width="14" height="10" rx="1.5" fill={O_LIGHT} strokeWidth="1.8" /><path d="M67 56 h8 M67 59 h5" stroke={O_DARK} /></g>
      <Fx x={50} y={42} accent={O_GOLD} />
    </>
  );
}

const RIGS: Record<CharacterId, () => ReactElement> = { kip: Kip, vex: Vex, orra: Orra };

/** The drawn creature. `data-joint="root"` is the wrapper the animator moves; decorative, so hidden from assistive tech. */
export const CharacterRig = memo(function CharacterRig({ id, size = 96 }: { id: CharacterId; size?: number }) {
  const Art = RIGS[id];
  return (
    <div className="crew-rig" data-char={id} data-joint="root" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size} focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Art /></svg>
    </div>
  );
});

/** A faint outline for the locked rows in the settings panel (non-interactive). */
export function CharacterSilhouette({ id, size = 40 }: { id: CharacterId; size?: number }) {
  const Art = RIGS[id];
  return (
    <div className="crew-sil" data-char={id} style={{ width: size, height: size, opacity: 0.45 }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size} focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Art /></svg>
    </div>
  );
}

// INK is kept for any shape that wants the page's own near-black
void INK;
