'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { loadScenes, type Scene as ArtScene } from '../SceneBackdrop';
import type { SceneId } from '@/lib/cinematic/scenes';

/* ============================================================================
   GATE ART — the picture behind every opening (Graph, Archive, Timeline, Modes,
   Museum, Survival, Civilization …). It is the same engraved line-art the
   workspace uses (data/scenes.json, the savanna, the night camp, the harbour…)
   drawn at full strength, with its silhouettes tracing themselves in, a layer
   of glowing ochre line-work over it (dashed rings, ticks, a constellation that
   is different for every opening) and slow embers rising through the light.

   Pure SVG + CSS. The art JSON loads lazily in its own chunk; until it arrives
   the glow layer is already on screen, so the gate never opens on an empty
   black page. Styling: app/_cinematic-art.css. --px / --py (−1…1) set by the
   gate drive the parallax of every <g data-depth> layer.
   ========================================================================== */

/** Which engraving each opening is laid over. */
const ART: Record<SceneId, string> = {
  work: 'savanna',
  graph: 'digital',
  arch: 'ancientcity',
  time: 'fields',
  hub: 'harbor',
  museum: 'observatory',
  minpath: 'rivervillage',
  journal: 'firecamp',
  world: 'observatory',
  trade: 'harbor',
  lab: 'forge',
  survival: 'firecamp',
  civilization: 'industry',
  archaeology: 'fields',
  'escape-room': 'ancientcity',
  decipher: 'observatory',
  'alien-archaeology': 'nightcity',
  'reverse-evolution': 'nightcity',
};

/** Deterministic 0…1 sequence from a string, so every opening gets its own constellation. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return (h % 100000) / 100000;
  };
}

interface Node { x: number; y: number; r: number }

/** Nodes live left and right of the title so the lettering stays clear. */
function constellation(seed: string): { nodes: Node[]; edges: [number, number][] } {
  const r = rng(seed);
  const nodes: Node[] = [];
  for (let i = 0; i < 10; i++) {
    const left = i % 2 === 0;
    const x = left ? 90 + r() * 470 : 1040 + r() * 470;
    const y = 90 + r() * 640;
    nodes.push({ x: Math.round(x), y: Math.round(y), r: 14 + Math.round(r() * 22) });
  }
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .filter(o => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    near.forEach(({ j }) => {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(k)) { seen.add(k); edges.push([i, j]); }
    });
  });
  // one long thread across the whole picture, like the lines in the workbench plates
  edges.push([0, 1], [1, 3]);
  return { nodes, edges };
}

/** Pull a line back by the radius of the circles at its ends so it meets the rings, not the centres. */
function trim(a: Node, b: Node): [number, number, number, number] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  return [
    a.x + (dx / d) * a.r, a.y + (dy / d) * a.r,
    b.x - (dx / d) * b.r, b.y - (dy / d) * b.r,
  ];
}

function Glow({ id }: { id: SceneId }) {
  const { nodes, edges } = useMemo(() => constellation(id), [id]);
  const ticks = Array.from({ length: 48 }, (_, i) => i);
  return (
    <svg className="ga-glow" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"
      fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true" focusable="false">
      {/* the orbit rings behind the title — concentric, dashed, counter-rotating */}
      <g className="ga-orbit" transform="translate(800 396)">
        <circle className="ga-r1" r="150" strokeWidth="1.4" />
        <circle className="ga-r2" r="236" strokeWidth="1" strokeDasharray="3 9" />
        <circle className="ga-r3" r="332" strokeWidth="1" strokeDasharray="1 7" />
        <circle className="ga-r4" r="438" strokeWidth=".8" strokeDasharray="14 22" />
        <g className="ga-ticks" strokeWidth="1.2">
          {ticks.map(i => {
            const a = (i / ticks.length) * Math.PI * 2;
            const long = i % 4 === 0;
            const r0 = 340, r1 = long ? 366 : 354;
            return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} />;
          })}
        </g>
        <path className="ga-arc" d="M-236 0A236 236 0 0 1 0 -236" strokeWidth="2.4" />
        <path className="ga-arc ga-arc2" d="M332 0A332 332 0 0 1 0 332" strokeWidth="2" />
      </g>

      {/* the constellation: unique to this opening */}
      <g className="ga-net">
        {edges.map(([a, b], i) => {
          const [x1, y1, x2, y2] = trim(nodes[a], nodes[b]);
          return <line key={i} className="ga-edge" style={{ '--i': i } as CSSProperties} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.6" />;
        })}
        {nodes.map((n, i) => (
          <g key={i} className="ga-node" style={{ '--i': i } as CSSProperties} transform={`translate(${n.x} ${n.y})`}>
            <circle r={n.r} strokeWidth="2.2" />
            <circle r={n.r * 0.55} strokeWidth="1" strokeDasharray="2 5" />
            <circle className="ga-core" r="3.2" fill="currentColor" stroke="none" />
            <path d={`M${-n.r - 8} 0h6M${n.r + 2} 0h6M0 ${-n.r - 8}v6M0 ${n.r + 2}v6`} strokeWidth="1.2" />
          </g>
        ))}
      </g>
    </svg>
  );
}

const EMBERS = Array.from({ length: 30 }, (_, i) => i);

export function GateArt({ id }: { id: SceneId }) {
  const [scenes, setScenes] = useState<ArtScene[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    loadScenes().then(s => { if (alive) setScenes(s); }).catch(() => { /* the art is decoration */ });
    return () => { alive = false; };
  }, []);

  const art = scenes?.find(s => s.id === ART[id]) ?? null;
  const artId = art?.id;

  // depth per layer for the parallax, then the long silhouette strokes trace themselves in
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !artId) return;
    svg.querySelectorAll<SVGGElement>('g[data-depth]').forEach(g => {
      const d = Math.max(0, Math.min(1.5, parseFloat(g.getAttribute('data-depth') || '0') || 0));
      g.style.setProperty('--d', d.toFixed(2));
    });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const long = Array.from(svg.querySelectorAll<SVGPathElement>('path'))
      .filter(p => !p.hasAttribute('stroke-dasharray') && !p.closest('.flow, .spin, .flicker, .rise') && (p.getAttribute('d')?.length ?? 0) > 90)
      .sort((a, b) => (b.getAttribute('d')?.length ?? 0) - (a.getAttribute('d')?.length ?? 0))
      .slice(0, 220);
    const r = rng('draw' + artId);
    long.forEach((p, i) => {
      p.setAttribute('pathLength', '1');
      p.style.strokeDasharray = '1';
      p.style.strokeDashoffset = '1';
      p.style.animation = `gaDraw 2.4s cubic-bezier(.45,0,.2,1) ${(0.15 + (i / long.length) * 2.4 + r() * 0.3).toFixed(2)}s forwards`;
    });
  }, [artId]);

  return (
    <div className="ga" data-art={ART[id]} aria-hidden="true">
      <div className="ga-halo" />
      <div className="ga-horizon" />

      {art && (
        <svg
          key={art.id}
          ref={svgRef}
          className="scene-layer front ga-art"
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMax slice"
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          focusable="false"
          // stroke-only markup from our own data file — no external input
          dangerouslySetInnerHTML={{ __html: art.svg }}
        />
      )}

      <Glow id={id} />

      <div className="ga-embers">
        {EMBERS.map(i => (
          <u key={i} style={{ '--x': `${(i * 37 + 11) % 100}%`, '--d': `${-((i * 1.7) % 11)}s`, '--t': `${7 + (i % 6)}s`, '--s': `${2 + (i % 3)}px` } as CSSProperties} />
        ))}
      </div>

      <div className="ga-veil" />
      <div className="ga-vignette" />
    </div>
  );
}
