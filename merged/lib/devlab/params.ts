/* Parameter descriptors. The SAME table drives (a) validation/clamping, (b) the prompt sent to the model,
   (c) the generated schema document — so the three can never disagree. */

import type { Elem, Pt } from './geom';

export type ParamDef =
  | { t: 'num'; min: number; max: number; def?: number; int?: boolean; req?: boolean; doc?: string }
  | { t: 'bool'; def?: boolean; doc?: string }
  | { t: 'enum'; values: readonly string[]; def?: string; doc?: string }
  /** list of [x, y] pairs, each coordinate within ±range */
  | { t: 'pts'; min: number; max: number; range: number; req?: boolean; doc?: string }
  /** list of plain numbers */
  | { t: 'nums'; min: number; max: number; lo: number; hi: number; def?: number[]; doc?: string };

export type ParamDefs = Record<string, ParamDef>;

/** Draw functions receive a fully validated, default-filled parameter bag. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrawFn = (p: any, rnd: () => number) => Elem[];

export interface ComponentDef {
  id: string;
  /** one line shown to the model */
  doc: string;
  group: ComponentGroup;
  params: ParamDefs;
  draw: DrawFn;
  /** true = the compiler re-centres the part on its own bounding box, so x,y places its visual middle */
  center?: boolean;
}

export const COMPONENT_GROUPS = ['basic', 'solid', 'textile', 'mechanical', 'structure', 'instrument', 'electronic', 'organic'] as const;
export type ComponentGroup = (typeof COMPONENT_GROUPS)[number];

/** Typed constructor: keeps each component's own parameter interface while erasing it for the registry. */
export function defineComponent<P>(def: {
  id: string; doc: string; group: ComponentGroup; params: ParamDefs; draw: (p: P, rnd: () => number) => Elem[]; center?: boolean;
}): ComponentDef {
  return def as unknown as ComponentDef;
}

export const num = (min: number, max: number, def?: number, extra: { int?: boolean; req?: boolean; doc?: string } = {}): ParamDef =>
  ({ t: 'num', min, max, def, ...extra });
export const int = (min: number, max: number, def?: number, extra: { req?: boolean; doc?: string } = {}): ParamDef =>
  ({ t: 'num', min, max, def, int: true, ...extra });
export const req = (min: number, max: number, doc?: string): ParamDef => ({ t: 'num', min, max, req: true, doc });
export const bool = (def = false, doc?: string): ParamDef => ({ t: 'bool', def, doc });
export const oneOf = (values: readonly string[], def?: string, doc?: string): ParamDef => ({ t: 'enum', values, def: def ?? values[0], doc });
export const pts = (min: number, max: number, range: number, doc?: string): ParamDef => ({ t: 'pts', min, max, range, req: true, doc });
export const nums = (min: number, max: number, lo: number, hi: number, def: number[] = [], doc?: string): ParamDef =>
  ({ t: 'nums', min, max, lo, hi, def, doc });

export type { Pt };
