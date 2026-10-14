'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { planFor, meshFor } from '@/lib/visual3d/plan';
import { silhouette } from '@/lib/visual3d/silhouette';
import { MATERIAL_LOOK } from '@/lib/visual3d/materials';
import { MeshCache } from '@/lib/visual3d/cache';
import { webglAvailable, mountMesh, type RenderHandle } from '@/lib/visual3d/renderer';
import type { Mesh } from '@/lib/visual3d/types';

/* A small, labelled, procedural reconstruction for items published by the verified-content pipeline.
   Deterministic from (id, archetype, family). WebGL when available, otherwise a flat silhouette.
   It never replaces the existing exhibit plate; it sits under it, and is always marked as stylised. */

const cache = new MeshCache<Mesh>(64);

/* Browsers cap live WebGL contexts (~16) and each costs GPU memory. At most MAX_LIVE are mounted at once, and
   only while on screen; every other instance shows the flat silhouette and retries when a slot frees, so a page
   with many reconstructions degrades gracefully instead of losing contexts. (Verified in a real browser.) */
export const MAX_LIVE_CONTEXTS = 6;
let liveContexts = 0;
const waiters = new Set<() => void>();
const release = () => { liveContexts--; waiters.forEach(w => w()); };

export function Reconstruction3D({ itemId, archetype, family, name }: {
  itemId: string; archetype: string; family: string; name: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [gl, setGl] = useState(false);
  const [retry, setRetry] = useState(0);
  const [onScreen, setOnScreen] = useState(typeof IntersectionObserver === 'undefined');

  const { mesh, spec } = useMemo(() => {
    const sp = planFor({ itemId, archetype, family });
    const k = `${itemId}:${sp.archetype}:${sp.material}`;
    let m = cache.get(k);
    if (!m) { m = meshFor(sp, 0); cache.set(k, m); }
    return { mesh: m, spec: sp };
  }, [itemId, archetype, family]);

  const flat = useMemo(() => silhouette(mesh).svg, [mesh]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([en]) => setOnScreen(en.isIntersecting), { rootMargin: '80px' });
    io.observe(host);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !webglAvailable() || !onScreen) return;
    if (liveContexts >= MAX_LIVE_CONTEXTS) {
      const w = () => setRetry(n => n + 1);
      waiters.add(w);
      return () => { waiters.delete(w); };
    }
    liveContexts++;
    let handle: RenderHandle | null = null;
    let dead = false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    mountMesh(canvas, mesh, MATERIAL_LOOK[spec.material], { reducedMotion: reduced })
      .then(h => { if (dead) h?.dispose(); else { handle = h; setGl(!!h); } })
      .catch(() => setGl(false));
    return () => { dead = true; release(); handle?.dispose(); setGl(false); };
  }, [mesh, spec.material, onScreen, retry]);

  return (
    <figure className="recon3d" style={{ margin: '0 0 14px', textAlign: 'center' }}>
      <div ref={hostRef} role="img" aria-label={`${name}: stylised reconstruction, not a measured shape`}
        style={{ width: 120, height: 120, margin: '0 auto', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: gl ? 'block' : 'none' }} />
        {!gl && <div style={{ width: '100%', height: '100%', color: 'var(--ochre, #c4642c)' }}
          dangerouslySetInnerHTML={{ __html: flat }} />}
      </div>
      <figcaption className="mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
        Stylised reconstruction · not a measured shape
      </figcaption>
    </figure>
  );
}
