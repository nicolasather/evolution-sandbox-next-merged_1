'use client';

import { useEffect, useRef } from 'react';

/* ============================================================================
   REACTIVE FIELD — a quiet WebGL field of points behind the scene art.

   A grid of soft dots holds still until the pointer comes near: then it
   glows and drifts away from the cursor, a little more when the cursor is
   moving fast (the "wake"), settling back the moment it stops. A click (or a
   press-and-hold, which charges a stronger one) drops a thin ring that
   expands and fades — several of these overlap into a faint, temporary
   constellation that is never saved anywhere and is gone on reload.

   All of the physics lives in the vertex shader so the JS side only ever
   updates a handful of uniforms per frame, however many points there are.
   Disabled outright for reduced motion; point density scales down on small
   / touch screens. Quiets itself (opacity + reduced influence) while a
   discovery is being revealed — see emitFieldPulse / setFieldQuiet below.
   ========================================================================== */

const VERT = /* glsl */ `
  attribute vec2 position;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform vec2 uMouseVel;
  uniform float uMouseActive;
  uniform float uQuiet;
  uniform vec4 uRipple[8];
  varying float vBright;

  void main() {
    vec2 p = position;
    vec2 toMouse = p - uMouse;
    float d = length(toMouse) + 0.0001;
    float influence = smoothstep(190.0, 0.0, d) * uMouseActive * (1.0 - uQuiet * 0.7);
    vec2 dir = toMouse / d;
    p += dir * influence * 16.0;
    float speed = clamp(length(uMouseVel) * 0.5, 0.0, 1.0);
    p += dir * influence * speed * 10.0;
    float bright = influence * 0.7;

    for (int i = 0; i < 8; i++) {
      vec4 r = uRipple[i];
      if (r.w <= 0.0) continue;
      float rd = length(p - r.xy);
      float wave = r.z * 320.0 * (0.6 + r.w * 0.4);
      float ring = 1.0 - smoothstep(0.0, 22.0, abs(rd - wave));
      float fade = (1.0 - r.z) * r.w;
      float amt = ring * fade;
      vec2 rdir = (p - r.xy) / (rd + 0.0001);
      p += rdir * amt * 12.0;
      bright += amt;
    }

    bright = clamp(bright, 0.0, 1.0) * (1.0 - uQuiet * 0.55);
    vBright = bright;

    vec2 clip = (p / uResolution) * 2.0 - 1.0;
    clip.y *= -1.0;
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = 1.4 + bright * 2.6;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying float vBright;
  uniform float uBase;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(0.93, 0.90, 0.85, a * (uBase + vBright * 0.55));
  }
`;

export const FIELD_PULSE_EVENT = 'evo:field-pulse';
export const FIELD_QUIET_EVENT = 'evo:field-quiet';

/** Drop a ripple into the field — a click, or the "world response" a
 *  discovery sends out once it has fully formed. Coordinates are CSS
 *  pixels; omit them for a pulse centred on the viewport. */
export function emitFieldPulse(x?: number, y?: number, strength = 1) {
  window.dispatchEvent(new CustomEvent(FIELD_PULSE_EVENT, { detail: { x, y, strength } }));
}

/** Turn the field's quiet mode on/off — background settles while something
 *  (a new discovery) should be the visual centre of attention. */
export function setFieldQuiet(on: boolean) {
  window.dispatchEvent(new CustomEvent(FIELD_QUIET_EVENT, { detail: on }));
}

const MAX_RIPPLES = 8;
const RIPPLE_LIFE_MS = 2200;

export function ReactiveField({ active }: { active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanupGL: (() => void) | undefined;

    // ogl only touches the DOM/WebGL — safe to import lazily so it never
    // lands in the very first, most-blocking chunk.
    import('ogl').then(({ Renderer, Geometry, Program, Mesh }) => {
      if (disposed) return;

      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);

      const renderer = new Renderer({ canvas, alpha: true, antialias: false, dpr: Math.min(devicePixelRatio || 1, 1.75) });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const area = window.innerWidth * window.innerHeight;
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const density = coarse ? 1 / 20000 : 1 / 11000;
      const count = Math.max(120, Math.min(1400, Math.round(area * density)));
      const cols = Math.round(Math.sqrt(count * (window.innerWidth / window.innerHeight)));
      const rows = Math.max(1, Math.round(count / cols));

      const positions = new Float32Array(cols * rows * 2);
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jx = (Math.random() - 0.5) * 0.7;
          const jy = (Math.random() - 0.5) * 0.7;
          positions[i++] = ((c + 0.5 + jx) / cols) * window.innerWidth;
          positions[i++] = ((r + 0.5 + jy) / rows) * window.innerHeight;
        }
      }

      const geometry = new Geometry(gl, { position: { size: 2, data: positions } });
      const ripple = new Float32Array(MAX_RIPPLES * 4);
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uResolution: { value: [window.innerWidth, window.innerHeight] },
          uMouse: { value: [window.innerWidth / 2, window.innerHeight / 2] },
          uMouseVel: { value: [0, 0] },
          uMouseActive: { value: 0 },
          uQuiet: { value: 0 },
          uBase: { value: 0.16 },
          uRipple: { value: Array.from({ length: MAX_RIPPLES }, () => [0, 0, 0, 0]) },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });

      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        program.uniforms.uResolution.value = [window.innerWidth, window.innerHeight];
      };
      resize();

      let mx = window.innerWidth / 2, my = window.innerHeight / 2;
      let tmx = mx, tmy = my;
      let mActive = 0, mTarget = 0;
      let quiet = 0, quietTarget = 0;
      let idleTimer = 0;
      const ripples: { x: number; y: number; born: number; strength: number }[] = [];
      let holdStart = 0;

      const onMove = (e: PointerEvent) => {
        tmx = e.clientX; tmy = e.clientY;
        mTarget = 1;
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => { mTarget = 0; }, 900);
      };
      const onDown = (e: PointerEvent) => { holdStart = performance.now(); void e; };
      const onUp = (e: PointerEvent) => {
        const held = Math.min(1, (performance.now() - holdStart) / 900);
        ripples.push({ x: e.clientX, y: e.clientY, born: performance.now(), strength: 0.55 + held * 0.7 });
        if (ripples.length > MAX_RIPPLES) ripples.shift();
      };
      const onPulse = (e: Event) => {
        const d = (e as CustomEvent).detail as { x?: number; y?: number; strength?: number };
        ripples.push({
          x: d.x ?? window.innerWidth / 2, y: d.y ?? window.innerHeight / 2,
          born: performance.now(), strength: d.strength ?? 1,
        });
        if (ripples.length > MAX_RIPPLES) ripples.shift();
      };
      const onQuiet = (e: Event) => { quietTarget = (e as CustomEvent).detail ? 1 : 0; };
      const onVis = () => { if (document.hidden) mTarget = 0; };

      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('resize', resize);
      window.addEventListener(FIELD_PULSE_EVENT, onPulse);
      window.addEventListener(FIELD_QUIET_EVENT, onQuiet);
      document.addEventListener('visibilitychange', onVis);

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (document.hidden) return;
        const vx = (tmx - mx), vy = (tmy - my);
        mx += vx * 0.12; my += vy * 0.12;
        mActive += (mTarget - mActive) * 0.06;
        quiet += (quietTarget - quiet) * 0.08;

        const now = performance.now();
        for (let k = ripples.length - 1; k >= 0; k--) {
          if (now - ripples[k].born > RIPPLE_LIFE_MS) ripples.splice(k, 1);
        }
        for (let k = 0; k < MAX_RIPPLES; k++) {
          const rp = ripples[k];
          const o = k * 4;
          if (rp) {
            const age = (now - rp.born) / RIPPLE_LIFE_MS;
            ripple[o] = rp.x; ripple[o + 1] = rp.y; ripple[o + 2] = age; ripple[o + 3] = rp.strength;
          } else {
            ripple[o + 3] = 0;
          }
        }

        program.uniforms.uMouse.value = [mx, my];
        program.uniforms.uMouseVel.value = [vx, vy];
        program.uniforms.uMouseActive.value = mActive;
        program.uniforms.uQuiet.value = quiet;
        program.uniforms.uRipple.value = Array.from({ length: MAX_RIPPLES }, (_, k) =>
          [ripple[k * 4], ripple[k * 4 + 1], ripple[k * 4 + 2], ripple[k * 4 + 3]]);

        renderer.render({ scene: mesh, frustumCull: false, sort: false });
      };
      raf = requestAnimationFrame(tick);

      cleanupGL = () => {
        cancelAnimationFrame(raf);
        window.clearTimeout(idleTimer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('resize', resize);
        window.removeEventListener(FIELD_PULSE_EVENT, onPulse);
        window.removeEventListener(FIELD_QUIET_EVENT, onQuiet);
        document.removeEventListener('visibilitychange', onVis);
        canvas.remove();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    }).catch(() => { /* WebGL unavailable — the engraved scene art carries the background alone */ });

    return () => { disposed = true; cleanupGL?.(); };
  }, []);

  return <div id="rfield" ref={hostRef} className={active ? 'on' : ''} aria-hidden="true" />;
}
