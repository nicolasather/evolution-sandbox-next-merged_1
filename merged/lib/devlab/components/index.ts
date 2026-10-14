import type { ComponentDef } from '../params';
import { BASIC } from './basic';
import { ELECTRONIC } from './electronic';
import { INSTRUMENT } from './instrument';
import { MECHANICAL } from './mechanical';
import { SOLIDS } from './solids';
import { STRUCTURE } from './structure';
import { TEXTILE } from './textile';

/** The CLOSED catalogue of components a model may name. Anything else is rejected by the validator. */
export const COMPONENTS: ComponentDef[] = [...BASIC, ...SOLIDS, ...TEXTILE, ...MECHANICAL, ...STRUCTURE, ...INSTRUMENT, ...ELECTRONIC];

export const COMPONENT_MAP: ReadonlyMap<string, ComponentDef> = new Map(COMPONENTS.map(c => [c.id, c]));
