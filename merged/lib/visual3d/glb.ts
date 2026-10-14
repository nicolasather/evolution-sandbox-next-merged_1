import type { Mesh } from './types';

/* Ticket 091 — a strict, dependency-free GLB (binary glTF 2.0) reader. It is used twice: on the server to decide
   whether a generated file may be stored at all, and in the browser to turn an APPROVED file into the same Mesh the
   procedural renderer draws. It never executes anything and never fetches anything: external URIs, images, textures,
   animations, skins, cameras, extensions, sparse accessors and more than one mesh are all refused. */

export const GLB_LIMITS = { maxBytes: 4 * 1024 * 1024, maxVertices: 60_000, maxTriangles: 40_000, maxNodes: 8, maxJsonBytes: 200_000 } as const;

export type GlbResult =
  | { ok: true; mesh: Mesh; stats: { vertices: number; triangles: number; bytes: number; bbox: [number, number, number, number, number, number] } }
  | { ok: false; reason: string };

const CT = { f32: 5126, u16: 5123, u32: 5125, u8: 5121 } as const;
const bad = (reason: string): GlbResult => ({ ok: false, reason });

interface Json {
  asset?: { version?: string };
  scene?: number; scenes?: { nodes?: number[] }[]; nodes?: { mesh?: number; children?: number[]; matrix?: unknown; translation?: unknown; rotation?: unknown; scale?: unknown }[];
  meshes?: { primitives?: { attributes?: Record<string, number>; indices?: number; mode?: number; material?: number; targets?: unknown }[] }[];
  accessors?: { bufferView?: number; byteOffset?: number; componentType?: number; count?: number; type?: string; min?: number[]; max?: number[]; sparse?: unknown; normalized?: boolean }[];
  bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number; byteStride?: number }[];
  buffers?: { byteLength?: number; uri?: string }[];
  [k: string]: unknown;
}
const FORBIDDEN = ['images', 'textures', 'samplers', 'animations', 'skins', 'cameras', 'extensionsUsed', 'extensionsRequired', 'extensions'] as const;

export function parseGlb(input: ArrayBuffer | Uint8Array): GlbResult {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (u8.byteLength < 28) return bad('too_small');
  if (u8.byteLength > GLB_LIMITS.maxBytes) return bad('too_large');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) return bad('bad_magic');
  if (dv.getUint32(4, true) !== 2) return bad('bad_version');
  if (dv.getUint32(8, true) !== u8.byteLength) return bad('length_mismatch');
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) return bad('first_chunk_not_json');
  if (jsonLen > GLB_LIMITS.maxJsonBytes || 20 + jsonLen + 8 > u8.byteLength) return bad('json_chunk_size');
  let json: Json;
  try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(u8.subarray(20, 20 + jsonLen))); } catch { return bad('json_invalid'); }
  if (!json || typeof json !== 'object' || json.asset?.version !== '2.0') return bad('not_gltf2');
  for (const k of FORBIDDEN) if (k in json) return bad(`forbidden_${k}`);

  const binHead = 20 + jsonLen;
  const binLen = dv.getUint32(binHead, true);
  if (dv.getUint32(binHead + 4, true) !== 0x004e4942) return bad('second_chunk_not_bin');
  if (binHead + 8 + binLen > u8.byteLength) return bad('bin_chunk_size');
  const bin = u8.subarray(binHead + 8, binHead + 8 + binLen);

  const buffers = json.buffers ?? [];
  if (buffers.length !== 1 || buffers[0].uri !== undefined || !Number.isInteger(buffers[0].byteLength) || buffers[0].byteLength! > bin.byteLength) return bad('buffer_not_embedded');
  if ((json.nodes?.length ?? 0) > GLB_LIMITS.maxNodes) return bad('too_many_nodes');
  if ((json.meshes?.length ?? 0) !== 1) return bad('need_exactly_one_mesh');
  const prims = json.meshes![0].primitives ?? [];
  if (prims.length !== 1) return bad('need_exactly_one_primitive');
  const prim = prims[0];
  if ((prim.mode ?? 4) !== 4 || prim.targets) return bad('triangles_only');
  const attrs = prim.attributes ?? {};
  if (Object.keys(attrs).some(k => k !== 'POSITION' && k !== 'NORMAL')) return bad('unsupported_attribute');   // no UVs: no textures anyway
  if (typeof attrs.POSITION !== 'number' || prim.indices === undefined) return bad('missing_position_or_indices');
  for (const n of json.nodes ?? []) if (n.matrix || n.rotation || n.scale || n.translation) { /* transforms are ignored; mesh is normalised below */ }

  const read = (accIdx: number, type: string, ct: number[]): { data: ArrayLike<number>; count: number; acc: NonNullable<Json['accessors']>[number] } | string => {
    const acc = json.accessors?.[accIdx];
    if (!acc || acc.sparse || acc.bufferView === undefined || !Number.isInteger(acc.count) || acc.count! <= 0) return 'accessor_invalid';
    if (acc.type !== type || !ct.includes(acc.componentType ?? -1) || acc.normalized) return 'accessor_type';
    const bv = json.bufferViews?.[acc.bufferView];
    if (!bv || bv.buffer !== 0 || !Number.isInteger(bv.byteLength)) return 'bufferview_invalid';
    if (bv.byteStride !== undefined) return 'strided_not_supported';
    const comps = type === 'VEC3' ? 3 : 1;
    const size = acc.componentType === CT.f32 || acc.componentType === CT.u32 ? 4 : acc.componentType === CT.u16 ? 2 : 1;
    const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const len = acc.count! * comps * size;
    if (start < 0 || start % size !== 0 || start + len > (bv.byteOffset ?? 0) + bv.byteLength! || start + len > bin.byteLength) return 'accessor_out_of_range';
    const ab = bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + len);
    const data = acc.componentType === CT.f32 ? new Float32Array(ab) : acc.componentType === CT.u32 ? new Uint32Array(ab) : acc.componentType === CT.u16 ? new Uint16Array(ab) : new Uint8Array(ab);
    return { data, count: acc.count!, acc };
  };

  const pos = read(attrs.POSITION, 'VEC3', [CT.f32]);
  if (typeof pos === 'string') return bad(pos);
  if (pos.count > GLB_LIMITS.maxVertices) return bad('too_many_vertices');
  const idx = read(prim.indices, 'SCALAR', [CT.u16, CT.u32, CT.u8]);
  if (typeof idx === 'string') return bad(idx);
  if (idx.count % 3 !== 0 || idx.count / 3 > GLB_LIMITS.maxTriangles) return bad('triangle_count');
  if (pos.count > 65535) return bad('too_many_vertices_for_16bit');

  const P = pos.data as Float32Array;
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return bad('non_finite_position');
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  const ext = Math.max(maxx - minx, maxy - miny, maxz - minz);
  if (!(ext > 1e-6) || ext > 1e6) return bad('degenerate_bounds');
  const I = new Uint16Array(idx.count);
  for (let i = 0; i < idx.count; i++) { const v = (idx.data as ArrayLike<number>)[i]; if (v >= pos.count) return bad('index_out_of_range'); I[i] = v; }

  // normalise into the same ±1 box the procedural meshes use
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, cz = (minz + maxz) / 2, s = 2 / ext;
  const positions = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { positions[i] = (P[i] - cx) * s; positions[i + 1] = (P[i + 1] - cy) * s; positions[i + 2] = (P[i + 2] - cz) * s; }
  const normals = faceNormals(positions, I);
  return { ok: true, mesh: { positions, normals, indices: I, tint: new Uint8Array(pos.count) }, stats: { vertices: pos.count, triangles: I.length / 3, bytes: u8.byteLength, bbox: [minx, miny, minz, maxx, maxy, maxz] } };
}

/** Smooth vertex normals computed locally: we never trust a file's own normals for lighting. */
function faceNormals(p: Float32Array, idx: Uint16Array): Float32Array {
  const n = new Float32Array(p.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/** Test/mock helper: build a minimal valid GLB from raw geometry (no textures, one mesh). */
export function buildGlb(positions: Float32Array, indices: Uint16Array, tweak: (json: Record<string, unknown>) => void = () => {}): Uint8Array {
  const posBytes = positions.byteLength, idxBytes = indices.byteLength, pad = (n: number) => (4 - (n % 4)) % 4;
  const binLen = posBytes + idxBytes + pad(idxBytes);
  const json: Record<string, unknown> = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    accessors: [{ bufferView: 0, componentType: CT.f32, count: positions.length / 3, type: 'VEC3' }, { bufferView: 1, componentType: CT.u16, count: indices.length, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posBytes }, { buffer: 0, byteOffset: posBytes, byteLength: idxBytes }],
    buffers: [{ byteLength: binLen }],
  };
  tweak(json);
  let js = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (js.length % 4)) % 4;
  if (jpad) { const x = new Uint8Array(js.length + jpad); x.set(js); x.fill(0x20, js.length); js = x; }
  const total = 12 + 8 + js.length + 8 + binLen;
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
  const b = 20 + js.length;
  dv.setUint32(b, binLen, true); dv.setUint32(b + 4, 0x004e4942, true);
  out.set(new Uint8Array(positions.buffer, positions.byteOffset, posBytes), b + 8);
  out.set(new Uint8Array(indices.buffer, indices.byteOffset, idxBytes), b + 8 + posBytes);
  return out;
}

/** A deterministic little crystal/prism used by the mock provider and tests. */
export function mockGeometry(seed: number): { positions: Float32Array; indices: Uint16Array } {
  const sides = 5 + (seed % 4), pos: number[] = [0, 1, 0, 0, -1, 0], idx: number[] = [];
  const h = 0.25 + (seed % 5) * 0.05;
  for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2; pos.push(Math.cos(a) * 0.6, h, Math.sin(a) * 0.6); }
  for (let i = 0; i < sides; i++) { const a = 2 + i, b = 2 + ((i + 1) % sides); idx.push(0, b, a, 1, a, b); }
  return { positions: new Float32Array(pos), indices: new Uint16Array(idx) };
}
