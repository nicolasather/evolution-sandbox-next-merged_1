import { distFor, TAN_HALF, viewAxes, discRadiusPx, type Camera, type Viewport } from './geo';
import { SDF_RANGE_DEG } from './land';

/* ============================================================================
   GL — draws the Earth: one full-screen triangle, one fragment shader.

   The shader intersects each pixel's ray with a unit sphere (the same camera
   maths as lib/world/geo.ts, so the 2D overlay of markers lines up exactly),
   reads the land distance-field texture, and shades a dark, quiet globe:
   ocean with a faint continental shelf, land with a thin lit coastline, a
   soft graticule, a sun-side terminator and a fresnel atmosphere that glows
   past the limb. Stars sit behind and drift a little as the globe turns.

   Plain WebGL (1 or 2). No library; nothing here runs on the server.
   ========================================================================== */

export interface GlobeUniforms {
  cam: Camera;
  vp: Viewport;
  /** 0–1: the whole picture's opacity (the veil). */
  veil: number;
  /** Seconds, for the stars' twinkle. */
  time: number;
  /** 0–1: a warm lift over land and atmosphere (an era finishing). */
  lift: number;
  /** RGB 0–1 for the era's tint. */
  tint: [number, number, number];
  /** 0–1: how much detail to spend (stars, noise, shelf). */
  detail: number;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec2 uRes;
uniform float uDist, uTanHalf, uShift, uVeil, uTime, uLift, uDetail, uPxDeg, uHasLand;
uniform vec3 uRight, uUp, uFwd, uTint;
uniform vec2 uPar;
uniform sampler2D uSdf;

const float PI = 3.14159265359;
const float RANGE = ${SDF_RANGE_DEG.toFixed(1)};

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 space(vec2 ndc, vec2 frag){
  // a very dark blue that lifts slightly toward the middle, then a vignette
  float r = length(ndc * vec2(0.9, 1.0));
  vec3 c = mix(vec3(0.020, 0.030, 0.052), vec3(0.004, 0.006, 0.012), smoothstep(0.0, 1.35, r));
  // stars: sparse hashed points that twinkle a little and slide with the camera
  if (uDetail > 0.3) {
    vec2 g = (frag + uPar) / 2.0;
    vec2 cell = floor(g);
    float h = hash(cell);
    float star = step(0.9965, h);
    float size = step(0.9994, h) * 0.8 + 0.55;
    vec2 f = fract(g) - 0.5;
    float d = length(f);
    float tw = 0.65 + 0.35 * sin(uTime * (1.2 + h * 5.0) + h * 40.0);
    c += vec3(0.75, 0.82, 1.0) * star * smoothstep(0.5, 0.0, d) * size * tw * 0.9;
  }
  return c;
}

void main(){
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(vec3(ndc.x * uTanHalf * aspect, (ndc.y - 2.0 * uShift) * uTanHalf, -1.0));
  vec3 ro = vec3(0.0, 0.0, uDist);
  vec3 sun = normalize(vec3(-0.62, 0.42, 0.66));

  vec3 col = space(ndc, gl_FragCoord.xy);
  float b = dot(ro, rd);
  float c2 = dot(ro, ro) - 1.0;
  float disc = b * b - c2;

  // the closest the ray comes to the centre — for the atmosphere
  float dd = sqrt(max(dot(ro, ro) - b * b, 0.0));
  vec3 cp = ro + rd * (-b);
  float sunSide = smoothstep(-0.35, 0.75, dot(normalize(cp), sun));
  vec3 atmoCol = mix(vec3(0.16, 0.36, 0.78), vec3(0.42, 0.62, 1.0), sunSide);
  atmoCol = mix(atmoCol, uTint * 1.6 + 0.15, uLift * 0.55);

  if (disc > 0.0) {
    float t = -b - sqrt(disc);
    vec3 p = ro + rd * t;               // on the unit sphere, so also its normal
    float facing = clamp(dot(p, -rd), 0.0, 1.0);
    vec3 g = uRight * p.x + uUp * p.y + uFwd * p.z;   // the same point in globe space
    float lat = asin(clamp(g.y, -1.0, 1.0));
    float lon = atan(g.x, g.z);
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);
    float sd = texture2D(uSdf, uv).r;
    float aaw = max(uPxDeg / (2.0 * RANGE) / max(facing, 0.22), 0.0035);
    float land = uHasLand * smoothstep(0.5 - aaw, 0.5 + aaw, sd);
    float latDeg = lat * 180.0 / PI;

    // ocean: deep, with a faint shelf that lifts toward the coast
    float shelf = uHasLand * (1.0 - smoothstep(0.0, 0.16, 0.5 - sd)) * (1.0 - land);
    vec3 ocean = mix(vec3(0.012, 0.030, 0.062), vec3(0.030, 0.090, 0.140), shelf * 0.85);
    ocean += vec3(0.004, 0.010, 0.018) * (1.0 - abs(latDeg) / 90.0);
    // land: darker inland, lighter at the coast, with a little grain
    float inland = smoothstep(0.5, 0.66, sd);
    vec3 landCol = mix(vec3(0.170, 0.190, 0.185), vec3(0.085, 0.100, 0.108), inland);
    float grain = uDetail > 0.3 ? vnoise(uv * vec2(420.0, 210.0)) : 0.5;
    landCol *= 0.86 + 0.28 * grain;
    // broad relief, so a continent is not one flat tone: warmer highs, cooler lows
    float relief = uDetail > 0.3 ? vnoise(uv * vec2(38.0, 19.0)) * 0.6 + vnoise(uv * vec2(110.0, 55.0)) * 0.4 : 0.5;
    landCol = mix(landCol * vec3(0.92, 0.98, 1.04), landCol * vec3(1.16, 1.06, 0.92), smoothstep(0.3, 0.7, relief));
    // ice at the poles
    float ice = smoothstep(62.0, 78.0, abs(latDeg)) * land;
    landCol = mix(landCol, vec3(0.34, 0.38, 0.42), ice * 0.7);
    landCol = mix(landCol, landCol + uTint * 0.22, uLift);

    vec3 base = mix(ocean, landCol, land);

    // light: a soft sun side and a dim night side that never goes black
    float ndl = dot(p, sun);
    float lit = 0.30 + 0.95 * smoothstep(-0.25, 0.85, ndl);
    base *= lit;

    // the coastline: a thin, cool line of light
    float coast = exp(-pow((sd - 0.5) / max(aaw * 2.6, 0.006), 2.0));
    base += vec3(0.30, 0.48, 0.58) * coast * 0.20 * uHasLand * (0.5 + 0.5 * lit);
    base += uTint * coast * uLift * 0.45;

    // graticule
    float gLat = abs(mod(latDeg + 7.5, 15.0) - 7.5);
    float gLon = abs(mod(lon * 180.0 / PI + 7.5, 15.0) - 7.5) * max(cos(lat), 0.05);
    float gl = 1.0 - smoothstep(0.0, max(uPxDeg * 1.1, 0.05), min(gLat, gLon));
    base += vec3(0.12, 0.20, 0.30) * gl * 0.16 * lit;

    // sun glint on open water
    vec3 refl = reflect(-sun, p);
    float spec = pow(max(dot(refl, -rd), 0.0), 110.0);
    base += vec3(0.55, 0.72, 0.95) * spec * (1.0 - land) * 0.14;

    // fresnel rim: the atmosphere seen edge-on
    float rim = pow(1.0 - facing, 3.0);
    base = mix(base, atmoCol, clamp(rim * (0.35 + 0.65 * sunSide), 0.0, 0.85) * 0.75);
    col = base;
  }

  // the glow beyond the limb
  float above = max(dd - 1.0, 0.0);
  float halo = (disc > 0.0 ? 0.0 : 1.0) * exp(-above * 22.0) * (0.30 + 0.70 * sunSide) * 0.85;
  col += atmoCol * halo * (0.75 + uLift * 0.9);

  gl_FragColor = vec4(col * uVeil, uVeil);
}
`;

export class GlobeGL {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer | null;
  private tex: WebGLTexture | null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private hasLand = 0;
  lost = false;

  private constructor(private canvas: HTMLCanvasElement, gl: WebGLRenderingContext, program: WebGLProgram, buffer: WebGLBuffer | null, tex: WebGLTexture | null) {
    this.gl = gl; this.program = program; this.buffer = buffer; this.tex = tex;
    for (const n of ['uRes', 'uDist', 'uTanHalf', 'uShift', 'uVeil', 'uTime', 'uLift', 'uDetail', 'uPxDeg', 'uHasLand', 'uRight', 'uUp', 'uFwd', 'uTint', 'uPar', 'uSdf']) {
      this.loc[n] = gl.getUniformLocation(program, n);
    }
    canvas.addEventListener('webglcontextlost', this.onLost as EventListener);
  }

  private onLost = (e: Event) => { e.preventDefault(); this.lost = true; };

  /** A globe on this canvas, or null when the browser cannot give us WebGL. */
  static create(canvas: HTMLCanvasElement): GlobeGL | null {
    if (typeof WebGLRenderingContext === 'undefined') return null;
    let gl: WebGLRenderingContext | null = null;
    try {
      const attrs: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'default' };
      gl = (canvas.getContext('webgl', attrs) ?? canvas.getContext('experimental-webgl', attrs)) as WebGLRenderingContext | null;
    } catch { gl = null; }
    if (!gl) return null;
    const compile = (type: number, src: string) => {
      const s = gl!.createShader(type);
      if (!s) return null;
      gl!.shaderSource(s, src); gl!.compileShader(s);
      return gl!.getShaderParameter(s, gl!.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle covers the screen
    return new GlobeGL(canvas, gl, prog, buffer, gl.createTexture());
  }

  /** Give the shader the land distance field. */
  setLand(img: HTMLImageElement | null): void {
    const gl = this.gl;
    if (!img || !this.tex) { this.hasLand = 0; return; }
    try {
      // the texture is 4096 wide; a GPU that cannot hold that gets it scaled down (still a power of two)
      let src: TexImageSource = img;
      const max = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
      const w = img.naturalWidth || 4096;
      if (w > max && typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = max; c.height = Math.max(1, Math.round(max / 2));
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        src = c;
      }
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);         // 4096 (or scaled to a smaller power of two): a power of two either way
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.hasLand = 1;
    } catch { this.hasLand = 0; }
  }

  resize(cssW: number, cssH: number, scale: number): void {
    const w = Math.max(1, Math.round(cssW * scale)), h = Math.max(1, Math.round(cssH * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
  }

  draw(u: GlobeUniforms): void {
    if (this.lost) return;
    const gl = this.gl, L = this.loc;
    const { right, up, fwd } = viewAxes(u.cam.lat, u.cam.lon);
    const disc = discRadiusPx(u.cam, u.vp);
    const pxDeg = (180 / Math.PI) / Math.max(1, disc);
    gl.useProgram(this.program);
    const aPos = gl.getAttribLocation(this.program, 'aPos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(L.uSdf, 0);
    gl.uniform2f(L.uRes, u.vp.w, u.vp.h);
    gl.uniform1f(L.uDist, distFor(u.cam.zoom, u.vp));
    gl.uniform1f(L.uTanHalf, TAN_HALF);
    gl.uniform1f(L.uShift, u.cam.shift ?? 0);
    gl.uniform1f(L.uVeil, u.veil);
    gl.uniform1f(L.uTime, u.time);
    gl.uniform1f(L.uLift, u.lift);
    gl.uniform1f(L.uDetail, u.detail);
    gl.uniform1f(L.uPxDeg, pxDeg);
    gl.uniform1f(L.uHasLand, this.hasLand);
    gl.uniform3f(L.uRight, right[0], right[1], right[2]);
    gl.uniform3f(L.uUp, up[0], up[1], up[2]);
    gl.uniform3f(L.uFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(L.uTint, u.tint[0], u.tint[1], u.tint[2]);
    // the stars slide a little as the globe turns
    gl.uniform2f(L.uPar, u.cam.lon * 3.2, -u.cam.lat * 3.2);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);        // premultiplied alpha
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost as EventListener);
    try {
      const gl = this.gl;
      if (this.tex) gl.deleteTexture(this.tex);
      if (this.buffer) gl.deleteBuffer(this.buffer);
      gl.deleteProgram(this.program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* already gone */ }
  }
}
