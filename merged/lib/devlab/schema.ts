/* ============================================================================
   VISUAL LAB — plate-spec schema & validator (development only).

   The model never produces code or markup. It produces this JSON:

     { "title": "...", "layers": [ { "z": 0, "parts": [
         { "c": "lathe", "x": 50, "y": 50, "rot": 0, "s": 1, "flip": false, "w": "main", "o": 1, "p": { ...params } }
     ] } ] }

   `c` must name a component in the closed catalogue; `p` is validated against that
   component's ParamDef table. Out-of-range numbers are CLAMPED (with a warning);
   missing required numbers, unknown components, wrong types and oversize specs are ERRORS.
   ========================================================================== */

import { COMPONENT_MAP, COMPONENTS } from './components';
import { COMPONENT_GROUPS, type ParamDef } from './params';

export const LIMITS = {
  maxLayers: 6,
  maxPartsPerLayer: 20,
  maxParts: 40,
  maxTitle: 80,
  maxPts: 40,
  coord: 160,
  z: 14,
} as const;

export const WEIGHTS = ['bold', 'main', 'fine', 'hair'] as const;
export type WeightName = (typeof WEIGHTS)[number];

export interface PartSpec {
  c: string;
  x: number;
  y: number;
  rot: number;
  s: number;
  flip: boolean;
  w?: WeightName;
  o?: number;
  p: Record<string, unknown>;
}
export interface LayerSpec { z: number; parts: PartSpec[] }
export interface PlateSpec { title: string; layers: LayerSpec[] }

export type ValidationResult =
  | { ok: true; spec: PlateSpec; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Models sometimes quote numbers. Accept only clean numeric strings. */
function toNum(v: unknown): number | undefined {
  if (isNum(v)) return v;
  if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return undefined;
}

function clampNote(path: string, v: number, lo: number, hi: number, warn: string[]): number {
  if (v < lo || v > hi) {
    const c = Math.min(hi, Math.max(lo, v));
    warn.push(`${path}: ${v} outside ${lo}..${hi}, clamped to ${c}`);
    return c;
  }
  return v;
}

function checkParam(path: string, def: ParamDef, raw: unknown, err: string[], warn: string[]): unknown {
  switch (def.t) {
    case 'num': {
      if (raw === undefined || raw === null) {
        if (def.req) { err.push(`${path}: required number missing`); return undefined; }
        return def.def;
      }
      const n = toNum(raw);
      if (n === undefined) { err.push(`${path}: expected a number, got ${JSON.stringify(raw)}`); return undefined; }
      let v = clampNote(path, n, def.min, def.max, warn);
      if (def.int) v = Math.round(v);
      return v;
    }
    case 'bool':
      if (raw === undefined || raw === null) return def.def ?? false;
      if (typeof raw === 'boolean') return raw;
      err.push(`${path}: expected true/false`);
      return undefined;
    case 'enum':
      if (raw === undefined || raw === null) return def.def;
      if (typeof raw === 'string' && def.values.includes(raw)) return raw;
      err.push(`${path}: "${String(raw)}" is not one of ${def.values.join(' | ')}`);
      return undefined;
    case 'pts': {
      if (!Array.isArray(raw)) { err.push(`${path}: expected a list of [x,y] pairs`); return undefined; }
      if (raw.length < def.min) { err.push(`${path}: needs at least ${def.min} points`); return undefined; }
      const list = raw.length > def.max ? (warn.push(`${path}: ${raw.length} points truncated to ${def.max}`), raw.slice(0, def.max)) : raw;
      const out: [number, number][] = [];
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        const x = Array.isArray(q) ? toNum(q[0]) : undefined;
        const y = Array.isArray(q) ? toNum(q[1]) : undefined;
        if (x === undefined || y === undefined) { err.push(`${path}[${i}]: expected [x,y] numbers`); return undefined; }
        out.push([clampNote(`${path}[${i}].x`, x, -def.range, def.range, warn), clampNote(`${path}[${i}].y`, y, -def.range, def.range, warn)]);
      }
      return out;
    }
    case 'nums': {
      if (raw === undefined || raw === null) return def.def ?? [];
      if (!Array.isArray(raw)) { err.push(`${path}: expected a list of numbers`); return undefined; }
      const list = raw.slice(0, def.max);
      const out: number[] = [];
      for (let i = 0; i < list.length; i++) {
        const n = toNum(list[i]);
        if (n === undefined) { err.push(`${path}[${i}]: expected a number`); return undefined; }
        out.push(clampNote(`${path}[${i}]`, n, def.lo, def.hi, warn));
      }
      if (out.length < def.min) { err.push(`${path}: needs at least ${def.min} values`); return undefined; }
      return out;
    }
  }
}

export function validateSpec(raw: unknown): ValidationResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['spec must be a JSON object'], warnings };
  const title = typeof raw.title === 'string' ? raw.title.slice(0, LIMITS.maxTitle) : '';
  if (!Array.isArray(raw.layers) || raw.layers.length === 0) return { ok: false, errors: ['"layers" must be a non-empty array'], warnings };
  if (raw.layers.length > LIMITS.maxLayers) warnings.push(`layers truncated from ${raw.layers.length} to ${LIMITS.maxLayers}`);

  const layers: LayerSpec[] = [];
  let total = 0;
  raw.layers.slice(0, LIMITS.maxLayers).forEach((lr: unknown, li: number) => {
    const lp = `layers[${li}]`;
    if (!isObj(lr) || !Array.isArray(lr.parts)) { errors.push(`${lp}: needs a "parts" array`); return; }
    const zr = lr.z === undefined ? 0 : toNum(lr.z);
    if (zr === undefined) { errors.push(`${lp}.z: expected a number`); return; }
    const z = clampNote(`${lp}.z`, zr, -LIMITS.z, LIMITS.z, warnings);
    if (lr.parts.length > LIMITS.maxPartsPerLayer) warnings.push(`${lp}: parts truncated to ${LIMITS.maxPartsPerLayer}`);
    const parts: PartSpec[] = [];
    lr.parts.slice(0, LIMITS.maxPartsPerLayer).forEach((pr: unknown, pi: number) => {
      const pp = `${lp}.parts[${pi}]`;
      if (total >= LIMITS.maxParts) { if (total === LIMITS.maxParts) warnings.push(`more than ${LIMITS.maxParts} parts: extras dropped`); total++; return; }
      if (!isObj(pr)) { errors.push(`${pp}: must be an object`); return; }
      const id = typeof pr.c === 'string' ? pr.c : '';
      const def = COMPONENT_MAP.get(id);
      if (!def) { errors.push(`${pp}.c: unknown component "${String(pr.c)}"`); return; }
      const loc = (key: string, d: number, lo: number, hi: number): number => {
        const v = pr[key] === undefined ? d : toNum(pr[key]);
        if (v === undefined) { errors.push(`${pp}.${key}: expected a number`); return d; }
        return clampNote(`${pp}.${key}`, v, lo, hi, warnings);
      };
      const x = loc('x', 50, -LIMITS.coord, LIMITS.coord), y = loc('y', 50, -LIMITS.coord, LIMITS.coord);
      const rot = loc('rot', 0, -720, 720), s = loc('s', 1, 0.1, 6);
      const flip = pr.flip === true;
      let w: WeightName | undefined;
      if (pr.w !== undefined) {
        if (typeof pr.w === 'string' && (WEIGHTS as readonly string[]).includes(pr.w)) w = pr.w as WeightName;
        else warnings.push(`${pp}.w: "${String(pr.w)}" ignored (use ${WEIGHTS.join('|')})`);
      }
      const o = pr.o === undefined ? undefined : loc('o', 1, 0.15, 1);
      const rawP = isObj(pr.p) ? pr.p : pr.p === undefined ? {} : (errors.push(`${pp}.p: must be an object`), {});
      for (const k of Object.keys(rawP)) if (!(k in def.params)) warnings.push(`${pp}.p.${k}: not a parameter of ${id}, ignored`);
      const p: Record<string, unknown> = {};
      for (const [k, pd] of Object.entries(def.params)) {
        const v = checkParam(`${pp}.p.${k}`, pd, rawP[k], errors, warnings);
        if (v !== undefined) p[k] = v;
      }
      total++;
      parts.push({ c: id, x, y, rot, s, flip, w, o, p });
    });
    layers.push({ z, parts });
  });

  if (errors.length) return { ok: false, errors, warnings };
  if (total === 0) return { ok: false, errors: ['spec contains no parts'], warnings };
  return { ok: true, spec: { title, layers }, warnings };
}

/* ── prompt / documentation generated from the SAME tables ─────────────── */

function describeParam(name: string, d: ParamDef): string {
  switch (d.t) {
    case 'num': return `${name}:${d.int ? 'int' : 'num'}[${d.min}..${d.max}]${d.req ? '!' : d.def !== undefined ? `=${d.def}` : ''}`;
    case 'bool': return `${name}:bool=${d.def ?? false}`;
    case 'enum': return `${name}:${d.values.join('|')}`;
    case 'pts': return `${name}:[[x,y],…]${d.min}-${d.max} pts ±${d.range}!`;
    case 'nums': return `${name}:[num,…]≤${d.max}`;
  }
}

/** Compact catalogue for the model: one line per component. `!` marks required parameters. */
export function catalogueText(): string {
  const lines: string[] = [];
  for (const g of COMPONENT_GROUPS) {
    const list = COMPONENTS.filter(c => c.group === g);
    if (!list.length) continue;
    lines.push(`# ${g}`);
    for (const c of list) {
      lines.push(`- ${c.id}${c.center ? ' (auto-centred)' : ''}: ${c.doc}`);
      lines.push(`    ${Object.entries(c.params).map(([k, d]) => describeParam(k, d)).join('  ')}`);
    }
  }
  return lines.join('\n');
}

/** Markdown schema reference written to docs by the report tool. */
export function schemaMarkdown(): string {
  const out = ['| component | group | parameters | description |', '|---|---|---|---|'];
  for (const c of COMPONENTS) {
    out.push(`| \`${c.id}\` | ${c.group} | ${Object.entries(c.params).map(([k, d]) => `\`${describeParam(k, d)}\``).join(' ')} | ${c.doc.replace(/\|/g, '/')} |`);
  }
  return out.join('\n');
}
