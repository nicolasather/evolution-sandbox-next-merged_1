import type { ArtifactTemplate } from './types';

/* ============================================================================
   ARTIFACT-TYPE CATALOG — a small, authored vocabulary of real archaeological
   find categories (feature types, ceramic classes, lithic debris/tools,
   organic remains, ornament, ritual deposit), each carrying a real,
   defensible functional-interpretation weight. This is what every
   procedurally generated site (lib/archaeology/generate.ts) draws its finds
   from — never the main Discovery graph, which has no artifactType/
   physicalProperties data populated yet (see lib/types.ts). Kept here
   rather than in data/nodes/*.json so a site's evidence never has to
   pretend a specific fictional dig is a real historical claim.

   `affinity` is the honest core of the hypothesis-board reasoning: how
   much finding one of these argues for each SiteFunction. A hearth alone
   argues weakly for several things; a deliberately buried complete vessel
   with no wear argues strongly for one. Real archaeology reasons this way
   — no single find "proves" a site's function, but a body of evidence can
   make one interpretation far better supported than the alternatives.
   ========================================================================== */

export const CATALOG: ArtifactTemplate[] = [
  {
    id: 'hearth-ash-lens',
    label: 'Ash lens with fire-cracked stone',
    material: 'charcoal and heat-fractured rock',
    category: 'structural',
    commonFunction: 'A hearth or fire pit — cooking or warmth, used for one occupation only.',
    affinity: { 'seasonal-camp': 0.5, 'permanent-settlement': 0.3 },
    rarity: 3,
  },
  {
    id: 'post-hole-cluster',
    label: 'Post-hole cluster',
    material: 'compacted fill in a cut socket',
    category: 'structural',
    commonFunction: 'The footing of a timber-framed structure — built to last beyond one visit.',
    affinity: { 'permanent-settlement': 0.7, 'ceremonial-site': 0.3 },
    rarity: 2,
  },
  {
    id: 'storage-pit',
    label: 'Lined storage pit',
    material: 'clay-lined cut feature',
    category: 'structural',
    commonFunction: 'Below-ground storage — surplus kept for later, implying a return or a stay.',
    affinity: { 'permanent-settlement': 0.8, workshop: 0.2 },
    rarity: 2,
  },
  {
    id: 'coarse-utility-sherd',
    label: 'Coarse cordmarked sherd',
    material: 'low-fired tempered clay',
    category: 'pottery',
    commonFunction: 'Everyday cooking or storage ware — plain, thick-walled, built for use.',
    affinity: { 'seasonal-camp': 0.5, 'permanent-settlement': 0.4 },
    rarity: 4,
  },
  {
    id: 'fine-decorated-sherd',
    label: 'Fine incised sherd',
    material: 'well-levigated fired clay',
    category: 'pottery',
    commonFunction: 'A carefully finished vessel — more investment than pure utility explains alone.',
    affinity: { 'permanent-settlement': 0.4, 'ceremonial-site': 0.5 },
    rarity: 2,
  },
  {
    id: 'knapping-debris',
    label: 'Knapping debris scatter',
    material: 'flint flakes and core fragments',
    category: 'lithic',
    commonFunction: 'Waste from making stone tools on the spot, not from using them.',
    affinity: { workshop: 0.9, 'seasonal-camp': 0.1 },
    rarity: 3,
  },
  {
    id: 'finished-scraper',
    label: 'Finished hide scraper',
    material: 'retouched flint',
    category: 'lithic',
    commonFunction: 'A completed tool, carried and used — not evidence of on-site toolmaking.',
    affinity: { 'seasonal-camp': 0.4, workshop: 0.3, 'permanent-settlement': 0.2 },
    rarity: 3,
  },
  {
    id: 'ground-stone-quern',
    label: 'Ground-stone quern fragment',
    material: 'worn sandstone',
    category: 'lithic',
    commonFunction: 'Grain or pigment processing — heavy, rarely carried far, favours a real stay.',
    affinity: { 'permanent-settlement': 0.6, 'seasonal-camp': 0.2 },
    rarity: 2,
  },
  {
    id: 'worked-bone-awl',
    label: 'Worked bone awl',
    material: 'polished bone',
    category: 'organic',
    commonFunction: 'A hide- or fibre-working tool, at home in almost any occupation.',
    affinity: { 'seasonal-camp': 0.3, 'permanent-settlement': 0.3, workshop: 0.2 },
    rarity: 2,
  },
  {
    id: 'shell-midden-deposit',
    label: 'Shell midden deposit',
    material: 'discarded mollusc shell',
    category: 'organic',
    commonFunction: 'Food refuse, built up over repeated meals in the same place.',
    affinity: { 'seasonal-camp': 0.6, 'permanent-settlement': 0.3 },
    rarity: 3,
  },
  {
    id: 'stone-ornament-bead',
    label: 'Perforated stone bead',
    material: 'polished soft stone',
    category: 'ornament',
    commonFunction: 'Personal adornment or exchange — effort spent beyond subsistence.',
    affinity: { 'ceremonial-site': 0.6, 'permanent-settlement': 0.3 },
    rarity: 1,
  },
  {
    id: 'deliberate-vessel-deposit',
    label: 'Complete vessel, deliberately placed',
    material: 'fired clay, unworn base',
    category: 'ritual',
    commonFunction: 'An intact, unused vessel set down on purpose — not domestic breakage.',
    affinity: { 'ceremonial-site': 0.9 },
    rarity: 1,
  },
];

export function template(id: string): ArtifactTemplate {
  const t = CATALOG.find(c => c.id === id);
  if (!t) throw new Error(`archaeology catalog: unknown template "${id}"`);
  return t;
}
