import type { CSSProperties } from 'react';
import type { Scene } from '@/lib/cinematic/scenes';

/* ============================================================================
   CINEMATIC STAGE — the 2.5D set: a sky, a sun, a perspective floor, drifting
   orbs, tilted rings, six spinning cubes and dust. Pure CSS 3D (no canvas, no
   WebGL): every piece reads its colour from --k0…--k11, so whichever ancestor
   carries a scene palette (see lib/cinematic/scenes.ts paletteVars) recolours
   the whole set. --px / --py (−1…1) on any ancestor drive the parallax.
   Used by both the opening gate and the Minimum Path slides.
   ========================================================================== */

/** Cube placements: [x%, y%, size px, spin s, delay s]. */
const CUBES: [number, number, number, number, number][] = [
  [14, 24, 120, 34, -2], [82, 30, 170, 42, -9], [26, 74, 90, 28, -14],
  [74, 76, 130, 38, -5], [50, 14, 70, 30, -20], [92, 62, 64, 26, -11],
];
/** Orbs: [x%, y%, size px, delay s]. */
const ORBS: [number, number, number, number][] = [
  [20, 42, 340, -3], [78, 58, 420, -8], [52, 84, 300, -13], [58, 18, 260, -5],
];

export function Stage({ shape = 'cube' }: { shape?: Scene['shape'] }) {
  return (
    <div className={`st st-shape-${shape}`} aria-hidden="true">
      <div className="st-sky" />
      <div className="st-sun" />
      <div className="st-world">
        <div className="st-floor"><i /></div>
        <div className="st-orbs">
          {ORBS.map(([x, y, s, d], i) => (
            <b key={i} style={{ '--x': `${x}%`, '--y': `${y}%`, '--s': `${s}px`, '--d': `${d}s`, '--c': `var(--k${3 + (i % 6)})` } as CSSProperties} />
          ))}
        </div>
        <div className="st-rings">
          {[0, 1, 2, 3].map(i => (
            <i key={i} style={{ '--i': i, '--c': `var(--k${3 + ((i * 2) % 6)})` } as CSSProperties} />
          ))}
        </div>
        <div className="st-solids">
          {CUBES.map(([x, y, s, spin, d], i) => (
            <div key={i} className="st-cube"
              style={{ '--x': `${x}%`, '--y': `${y}%`, '--s': `${s}px`, '--spin': `${spin}s`, '--d': `${d}s`, '--o': i } as CSSProperties}>
              {['f', 'b', 'l', 'r', 't', 'u'].map((f, k) => (
                <span key={f} className={`st-face st-${f}`} style={{ '--fc': `var(--k${3 + ((i + k) % 9)})` } as CSSProperties} />
              ))}
            </div>
          ))}
        </div>
        <div className="st-dust">
          {Array.from({ length: 22 }, (_, i) => (
            <u key={i} style={{ '--x': `${(i * 47) % 100}%`, '--y': `${(i * 29) % 100}%`, '--d': `${(i % 7) * -1.7}s`, '--c': `var(--k${3 + (i % 9)})` } as CSSProperties} />
          ))}
        </div>
      </div>
      <div className="st-vignette" />
    </div>
  );
}
