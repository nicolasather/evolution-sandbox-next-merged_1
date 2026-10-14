import type { MaterialDescriptor, Mesh } from './types';

/* Optional, lazy WebGL renderer (OGL). Nothing here runs unless a canvas is given AND WebGL exists;
   otherwise callers use silhouette().svg. Small workbench icons keep the existing hand art. */

export interface RenderHandle { dispose(): void; setSpin(on: boolean): void }

export function webglAvailable(doc: Document | undefined = typeof document !== 'undefined' ? document : undefined): boolean {
  if (!doc || typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const c = doc.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export async function mountMesh(canvas: HTMLCanvasElement, mesh: Mesh, look: MaterialDescriptor, opts: { reducedMotion: boolean }): Promise<RenderHandle | null> {
  if (!webglAvailable()) return null;
  const { Renderer, Camera, Transform, Geometry, Program, Mesh: OMesh } = await import('ogl');
  const renderer = new Renderer({ canvas, alpha: true, antialias: true });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const camera = new Camera(gl, { fov: 35 });
  camera.position.set(0, 0.2, 3.4);
  const scene = new Transform();
  const geometry = new Geometry(gl, {
    position: { size: 3, data: mesh.positions },
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
        gl_FragColor = vec4(base*(0.35+0.65*l*(1.0-0.3*rough)), 1.0); }`,
    uniforms: { c0: { value: hex(look.colors[0]) }, c1: { value: hex(look.colors[1]) }, c2: { value: hex(look.colors[2]) }, rough: { value: look.roughness } },
  });
  const obj = new OMesh(gl, { geometry, program });
  obj.setParent(scene);
  let spin = !opts.reducedMotion, raf = 0, alive = true;
  const frame = (t: number) => {
    if (!alive) return;
    obj.rotation.y = spin ? t * 0.0006 : 0.6;
    obj.rotation.x = 0.25;
    renderer.render({ scene, camera });
    raf = requestAnimationFrame(frame);
  };
  const size = () => { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width || 160, r.height || 160); camera.perspective({ aspect: (r.width || 160) / (r.height || 160) }); };
  size();
  raf = requestAnimationFrame(frame);
  return {
    setSpin(on) { spin = on && !opts.reducedMotion; },
    dispose() { alive = false; cancelAnimationFrame(raf); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
