import type { AxisId, AxisValue, LimbCount, SitePurpose, SocialStructure, SpecimenTemplate } from './types';

/* ============================================================================
   SPECIMEN CATALOG — a small, authored vocabulary of real xenoarchaeological
   reasoning types: tool ergonomics imply manipulator count, spatial/social
   layout implies social structure, room and residue type imply purpose.
   Every weight distribution is deliberately imperfect — real specimens
   rarely resolve a question on their own, and some entries here are
   genuinely ambiguous between two answers on purpose. This is the honest
   difference from lib/archaeology/catalog.ts's templates, whose weights a
   thorough dig CAN fully resolve.
   ========================================================================== */

export const LIMB_COUNTS: LimbCount[] = ['2', '3', '4', '6'];
export const SOCIAL_STRUCTURES: SocialStructure[] = ['solitary', 'paired', 'collective'];
export const SITE_PURPOSES: SitePurpose[] = ['habitation', 'gathering', 'processing', 'ritual'];

export const AXIS_LABEL: Record<AxisId, string> = {
  limbCount: 'Manipulator count',
  social: 'Social structure',
  purpose: 'Site purpose',
};

export const VALUE_LABEL: Record<AxisId, Record<string, string>> = {
  limbCount: { '2': 'Two manipulators', '3': 'Three manipulators', '4': 'Four manipulators', '6': 'Six manipulators' },
  social: { solitary: 'Solitary', paired: 'Paired', collective: 'Collective / hive-like' },
  purpose: { habitation: 'Habitation', gathering: 'Communal gathering', processing: 'Material processing', ritual: 'Ritual / symbolic' },
};

export function axisOptions(axis: AxisId): AxisValue[] {
  if (axis === 'limbCount') return LIMB_COUNTS;
  if (axis === 'social') return SOCIAL_STRUCTURES;
  return SITE_PURPOSES;
}

export const CATALOG: SpecimenTemplate[] = [
  {
    id: 'triple-socket-tool',
    description: 'A hand tool with three matched sockets, worn smooth at identical depths, meeting at a shared pivot.',
    evidence: { limbCount: { '3': 0.75, '6': 0.25 } },
  },
  {
    id: 'paired-grip-implement',
    description: 'A long implement with two opposing grip ridges, polished from repeated matched pressure.',
    evidence: { limbCount: { '2': 0.7, '4': 0.3 } },
  },
  {
    id: 'wide-handhold-basin',
    description: 'A shallow basin with one broad worn handhold along its rim — unclear how many grips once rested there.',
    evidence: { limbCount: { '2': 0.4, '4': 0.35, '6': 0.25 } },
  },
  {
    id: 'segmented-exosuit',
    description: 'A fragment of jointed outer covering with six regularly spaced articulation points.',
    evidence: { limbCount: { '6': 0.8, '4': 0.2 } },
  },
  {
    id: 'single-alcove',
    description: 'A recessed sleeping alcove, sized and shaped for exactly one occupant, no others nearby.',
    evidence: { social: { solitary: 0.65, paired: 0.35 }, purpose: { habitation: 0.85 } },
  },
  {
    id: 'communal-trough',
    description: 'A long trough worn at regular intervals along its whole length, as if by many occupants at once.',
    evidence: { social: { collective: 0.7, paired: 0.3 }, purpose: { gathering: 0.8 } },
  },
  {
    id: 'processing-vat',
    description: 'A sealed vat lined with mineral residue, plumbed to what may once have been a drain.',
    evidence: { purpose: { processing: 0.9 } },
  },
  {
    id: 'radiating-panel',
    description: 'A panel of radiating symbols set around a raised central plinth, facing outward on all sides.',
    evidence: { purpose: { ritual: 0.85 } },
  },
  {
    id: 'isolated-perch',
    description: 'An elevated perch, structurally isolated, with no paths or fixtures connecting it to anything nearby.',
    evidence: { social: { solitary: 0.75, paired: 0.25 } },
  },
  {
    id: 'chamber-cluster',
    description: 'A cluster of near-identical small chambers arranged around one shared central hub.',
    evidence: { social: { collective: 0.6, paired: 0.4 }, purpose: { habitation: 0.3 } },
  },
  {
    id: 'twin-workstation',
    description: 'Two adjoining workstations, angled toward each other, worn in a matching, complementary pattern.',
    evidence: { social: { paired: 0.65, collective: 0.35 }, purpose: { processing: 0.55 } },
  },
  {
    id: 'graduated-toolset',
    description: 'A set of tools in four closely graduated sizes, each too similar in form to be a different design.',
    evidence: { limbCount: { '4': 0.65, '2': 0.2, '6': 0.15 } },
  },
];

export function template(id: string): SpecimenTemplate {
  const t = CATALOG.find(c => c.id === id);
  if (!t) throw new Error(`alien archaeology catalog: unknown template "${id}"`);
  return t;
}
