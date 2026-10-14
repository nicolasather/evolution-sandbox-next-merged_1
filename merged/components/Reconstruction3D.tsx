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

export function Reconstruction3D({ itemId, archetype, family, name }: {
  itemId: string; archetype: string; family: string; name: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState(false);

  const { mesh, spec } = useMemo(() => {
    const sp = planFor({ itemId, archetype, family });
    const k = `${itemId}:${sp.archetype}:${sp.material}`;
    let m = cache.get(k);
    if (!m) { m = meshFor(sp, 0); cache.set(k, m); }
    return { mesh: m, spec: sp };
  }, [itemId, archetype, family]);

  const flat = useMemo(() => silhouette(mesh).svg, [mesh]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !webglAvailable()) return;
    let handle: RenderHandle | null = null;
    let dead = false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    mountMesh(canvas, mesh, MATERIAL_LOOK[spec.material], { reducedMotion: reduced })
      .then(h => { if (dead) h?.dispose(); else { handle = h; setGl(!!h); } })
      .catch(() => setGl(false));
    return () => { dead = true; handle?.dispose(); setGl(false); };
  }, [mesh, spec.material]);

  return (
    <figure className="recon3d" style={{ margin: '0 0 14px', textAlign: 'center' }}>
      <div role="img" aria-label={`${name}: stylised reconstruction, not a measured shape`}
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
