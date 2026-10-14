import type { MaterialDescriptor, Mesh } from './types';

/* Optional, lazy WebGL renderer (OGL). Nothing here runs unless a canvas is given AND WebGL exists;
   otherwise callers use silhouette().svg. Small workbench icons keep the existing hand art. */

export interface RenderHandle { dispose(): void; setSpin(on: boolean): void }

/** Browsers allow only ~16 live WebGL contexts and silently kill the oldest. We cap far below that: beyond the
 *  cap mountMesh() returns null and the caller shows the flat silhouette (same shape, no GPU). */
export const MAX_LIVE_CONTEXTS = 6;
let live = 0;
export const liveContexts = () => live;

/** Centre the mesh on the origin and scale it to fit a unit sphere, so every archetype frames the same way
 *  whatever offsets its parts were built with. Returns a copy; the mesh used for silhouettes is untouched. */
export function fitPositions(src: Float32Array): Float32Array {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < src.length; i += 3) {
    x0 = Math.min(x0, src[i]); x1 = Math.max(x1, src[i]);
    y0 = Math.min(y0, src[i + 1]); y1 = Math.max(y1, src[i + 1]);
    z0 = Math.min(z0, src[i + 2]); z1 = Math.max(z1, src[i + 2]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  let r = 0;
  for (let i = 0; i < src.length; i += 3) r = Math.max(r, Math.hypot(src[i] - cx, src[i + 1] - cy, src[i + 2] - cz));
  const k = r > 1e-6 ? 0.92 / r : 1;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) { out[i] = (src[i] - cx) * k; out[i + 1] = (src[i + 1] - cy) * k; out[i + 2] = (src[i + 2] - cz) * k; }
  return out;
}

export function webglAvailable(doc: Document | undefined = typeof document !== 'undefined' ? document : undefined): boolean {
  if (!doc || typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const c = doc.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export async function mountMesh(canvas: HTMLCanvasElement, mesh: Mesh, look: MaterialDescriptor, opts: { reducedMotion: boolean; onLost?: () => void }): Promise<RenderHandle | null> {
  if (!webglAvailable() || live >= MAX_LIVE_CONTEXTS) return null;
  live++;                                   // reserved before the first await, so parallel mounts cannot overshoot the cap
  let released = false;
  const release = () => { if (!released) { released = true; live = Math.max(0, live - 1); } };
  try {
    return await mountInner(canvas, mesh, look, opts, release);
  } catch (e) { release(); throw e; }
}

async function mountInner(canvas: HTMLCanvasElement, mesh: Mesh, look: MaterialDescriptor, opts: { reducedMotion: boolean; onLost?: () => void }, release: () => void): Promise<RenderHandle | null> {
  const { Renderer, Camera, Transform, Geometry, Program, Mesh: OMesh } = await import('ogl');
  // OGL overwrites the canvas's inline CSS size (default 300x150px). Measure first, and put the CSS back after
  // every setSize, or the canvas overflows whatever box it was placed in.
  const r0 = canvas.getBoundingClientRect();
  const cssW = canvas.style.width, cssH = canvas.style.height;
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
  const renderer = new Renderer({ canvas, alpha: true, antialias: true, width: r0.width || 160, height: r0.height || 160, dpr });
  const restoreCss = () => { canvas.style.width = cssW || `${r0.width || 160}px`; canvas.style.height = cssH || `${r0.height || 160}px`; };
  restoreCss();
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const camera = new Camera(gl, { fov: 35 });
  camera.position.set(0, 0.1, 3.9);
  const scene = new Transform();
  const geometry = new Geometry(gl, {
    position: { size: 3, data: fitPositions(mesh.positions) },
    normal: { size: 3, data: mesh.normals },
    tint: { size: 1, data: Float32Array.from(mesh.tint) },
    index: { data: mesh.indices },
  });
  const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const program = new Program(gl, {
    vertex: `attribute vec3 position; attribute vec3 normal; attribute float tint;
      uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat3 normalMatrix;
      varying vec3 vN; varying float vT;
      void main(){ vN = normalize(normalMatrix*normal); vT = tint; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragment: `precision highp float; varying vec3 vN; varying float vT;
      uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform float rough;
      void main(){ vec3 base = vT < 0.5 ? c0 : (vT < 1.5 ? c1 : c2);
        float l = max(dot(normalize(vN), normalize(vec3(0.5,0.8,0.6))), 0.0);
        gl_FragColor = vec4(base*min(0.62+0.5*l*(1.0-0.3*rough), 1.0), 1.0); }`,
    uniforms: { c0: { value: hex(look.colors[0]) }, c1: { value: hex(look.colors[1]) }, c2: { value: hex(look.colors[2]) }, rough: { value: look.roughness } },
  });
  const obj = new OMesh(gl, { geometry, program });
  obj.setParent(scene);
  let spin = !opts.reducedMotion, raf = 0, alive = true;
  const onLost = (e: Event) => { e.preventDefault(); alive = false; cancelAnimationFrame(raf); release(); opts.onLost?.(); };
  canvas.addEventListener('webglcontextlost', onLost);
  const frame = (t: number) => {
    if (!alive) return;
    obj.rotation.y = spin ? t * 0.0006 : 0.6;
    obj.rotation.x = 0.25;
    renderer.render({ scene, camera });
    raf = requestAnimationFrame(frame);
  };
  const size = () => { const r = canvas.getBoundingClientRect(); const w = r.width || 160, h = r.height || 160; renderer.setSize(w, h); restoreCss(); camera.perspective({ aspect: w / h }); };
  size();
  raf = requestAnimationFrame(frame);
  return {
    setSpin(on) { spin = on && !opts.reducedMotion; },
    dispose() {
      alive = false; cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      try { geometry.remove?.(); program.remove?.(); } catch { /* best effort: context loss below frees the rest */ }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      release();
    },
  };
}
