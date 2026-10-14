'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { planFor, meshFor } from '@/lib/visual3d/plan';
import { silhouette } from '@/lib/visual3d/silhouette';
import { MATERIAL_LOOK } from '@/lib/visual3d/materials';
import { MeshCache } from '@/lib/visual3d/cache';
import { webglAvailable, mountMesh, type RenderHandle } from '@/lib/visual3d/renderer';
import { chooseQuality, detectEnv } from '@/lib/visual3d/lods';
import type { Mesh } from '@/lib/visual3d/types';
import { loadApprovedMesh } from '@/lib/visuals/approvedMesh';

/* A small, labelled, procedural reconstruction for items published by the verified-content pipeline.
   Deterministic from (id, archetype, family). WebGL when available, otherwise a flat silhouette.
   It never replaces the existing exhibit plate; it sits under it, and is always marked as stylised. */

const cache = new MeshCache<Mesh>(64);

export function Reconstruction3D({ itemId, archetype, family, name }: {
  itemId: string; archetype: string; family: string; name: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState(false);

  /* Quality tier is decided once per mount from the real device (reduced motion, data saver, low memory,
     no WebGL all mean: flat SVG and the 3D code is never loaded). */
  const quality = useMemo(() => chooseQuality(detectEnv(webglAvailable())), []);

  const { mesh, spec } = useMemo(() => {
    const sp = planFor({ itemId, archetype, family });
    const k = `${itemId}:${sp.archetype}:${sp.material}:${quality.lod}`;
    let m = cache.get(k);
    if (!m) { m = meshFor(sp, quality.lod); cache.set(k, m); }
    return { mesh: m, spec: sp };
  }, [itemId, archetype, family, quality.lod]);

  /* An owner-approved generated model replaces the procedural mesh only after it has been downloaded, hash-checked and
     parsed; until then, and on any failure, the procedural mesh above is what is drawn. */
  const [approved, setApproved] = useState<Mesh | null>(null);
  useEffect(() => { let live = true; loadApprovedMesh(itemId).then(m => { if (live) setApproved(m); }); return () => { live = false; }; }, [itemId]);
  const shown = approved ?? mesh;

  const flat = useMemo(() => silhouette(shown).svg, [shown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || quality.render !== 'webgl') return;
    let handle: RenderHandle | null = null;
    let dead = false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    mountMesh(canvas, shown, MATERIAL_LOOK[spec.material], { reducedMotion: reduced })
      .then(h => { if (dead) h?.dispose(); else { handle = h; setGl(!!h); } })
      .catch(() => setGl(false));
    return () => { dead = true; handle?.dispose(); setGl(false); };
  }, [shown, spec.material, quality.render]);

  return (
    <figure className="recon3d" style={{ margin: '0 0 14px', textAlign: 'center' }}>
      <div role="img" aria-label={`${name}: stylised reconstruction, not a measured shape`}
        style={{ width: 120, height: 120, margin: '0 auto', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: gl ? 'block' : 'none' }} />
        {!gl && <div style={{ width: '100%', height: '100%', color: 'var(--ochre, #c4642c)' }}
          dangerouslySetInnerHTML={{ __html: flat }} />}
      </div>
      <figcaption className="mono" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
        {approved ? 'Generated model · reviewed by a human · not a measured shape' : 'Stylised reconstruction · not a measured shape'}
      </figcaption>
    </figure>
  );
}
