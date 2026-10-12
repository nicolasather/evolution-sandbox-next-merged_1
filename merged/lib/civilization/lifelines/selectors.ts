import {
  diffReports, forecast, forecastWithProgramme, queueBlockReason, queueEtas, repairProgrammeCost, tryCommand,
  type ReportDiff,
} from './engine';
import { districtName, shortestLinkPath } from './network';
import {
  ALTERNATE_FROM_CHAPTER, ESSENTIAL_ORDER, REPAIR_FROM_CHAPTER, REPAIR_LINK_COST, ROUTING_FROM_CHAPTER, SERVICE_LABEL,
  districtAllows, durationSeasons, quantitiesToMilli, SECTOR_TERRAIN, TERRAIN_LABEL,
} from './rules';
import {
  RESOURCE_IDS, type Command, type ContentIndex, type District, type LifelinesState, type Link, type LinkType,
  type MilliQuantities, type PolicyChoice, type Project, type ResourceId, type SeasonReport, type Warning,
} from './schema';

/* ============================================================================
   LIFELINES SELECTORS — narrow view models derived from state + content.
   Components receive these, never the mutable database. Hints, remedies and
   previews are RECOMPUTED here from the current state: a hint can never tell
   the player to build something already completed.
   ========================================================================== */

export const LINK_LABEL: Record<LinkType, string> = {
  path: 'Path', channel: 'Water channel', power: 'Power line', knowledge: 'Knowledge link',
};
/** Early tiers render the specialised networks as footpaths and shared gathering. */
export function linkLabel(type: LinkType, era: number): string {
  if (era >= 3) return LINK_LABEL[type];
  return type === 'path' ? 'Footpath' : LINK_LABEL[type];
}

const REASON_TEXT: Record<string, string> = {
  'unknown-project': 'This programme is not part of the content.',
  'run-archived': 'This attempt is archived. Start or continue another.',
  'resolve-event-first': 'Respond to the pending situation first.',
  'already-established': 'Already established.',
  'already-queued': 'Already planned in a district.',
  'era-locked': 'Belongs to a later gameplay tier than this chapter.',
  'missing-prerequisite': 'A prerequisite programme is not established yet.',
  'no-actions': 'No programme actions left this season. Advance the season.',
  'insufficient-stock': 'Not enough in the shared reserve to commit its cost.',
  'unknown-district': 'Choose a district.',
  'terrain-unsuitable': 'This district does not suit it.',
  'district-queue-full': 'This district\'s queue is full.',
  'emergency-already-used': 'Emergency shared work was already used this season.',
  'duplicate-connection': 'Those districts are already joined by that kind of link.',
  'link-in-good-condition': 'That link is already in good condition.',
  'programme-in-good-condition': 'That programme is already in good condition.',
  'not-available-yet': 'This is introduced in a later chapter.',
  'revision-conflict': 'The settlement changed; try again.',
  'read-only': 'This tab is read-only. Take over editing to make changes.',
  'conflict-unresolved': 'Choose which copy of this settlement to keep first.',
  'busy': 'One moment…',
  'no-run': 'There is no settlement to act on.',
  'no-event': 'There is nothing to decide right now.',
  'unknown-choice': 'That option is not available.',
  'unknown-queue-item': 'That plan no longer exists.',
  'policy-conflict': 'Only one policy per service group.',
  'invalid-policy-selection': 'At most three policies, one per service group.',
};
export function blockReasonText(code: string): string { return REASON_TEXT[code] ?? code; }

export interface ProgrammeOption {
  project: Project;
  /** Block reason ignoring district choice, or null when at least one district is legal now. */
  reason: string | null;
  reasonText: string | null;
  seasons: number;
  districts: { id: string; name: string; reason: string | null; reasonText: string | null }[];
  /** Resources the player lacks, with exact precision (never rounded away). */
  shortfall: MilliQuantities;
  /** Established prerequisites still missing (ids) — each links to its own drawer entry. */
  missingPrerequisites: string[];
}

export function shortfallOf(s: LifelinesState, cost: MilliQuantities): MilliQuantities {
  const out: MilliQuantities = {};
  for (const [r, n] of Object.entries(cost) as [ResourceId, number][]) if (s.stocks[r] < n) out[r] = n - s.stocks[r];
  return out;
}

export function programmeOption(index: ContentIndex, s: LifelinesState, p: Project): ProgrammeOption {
  const districts = s.layout.districts.map(d => {
    const reason = queueBlockReason(index, s, p.id, d.id);
    return { id: d.id, name: d.name, reason, reasonText: reason ? terrainOrReason(reason, p) : null };
  });
  const legal = districts.find(d => d.reason === null);
  const general = legal ? null : (queueBlockReason(index, s, p.id, null) ?? districts[0]?.reason ?? null);
  const reason = legal ? null : general;
  return {
    project: p, reason, reasonText: reason ? terrainOrReason(reason, p) : null, seasons: durationSeasons(p), districts,
    shortfall: shortfallOf(s, quantitiesToMilli(p.cost)),
    missingPrerequisites: p.requires.filter(id => !s.built.some(b => b.projectId === id)),
  };
}
function terrainOrReason(reason: string, p: Project): string {
  if (reason === 'terrain-unsuitable') {
    const need = SECTOR_TERRAIN[p.sector];
    return need ? `Needs ${need.map(t => TERRAIN_LABEL[t]).join(' or ')}.` : blockReasonText(reason);
  }
  return blockReasonText(reason);
}

/** Programmes to offer in the drawer: this tier and earlier, the chapter's focus first, never alphabetical-as-availability. */
export function visibleProgrammes(index: ContentIndex, s: LifelinesState, allSectors = false): ProgrammeOption[] {
  const chapter = index.chapters.get(s.chapterId);
  const rows = index.db.projects
    .filter(p => p.era <= s.era && (allSectors || p.sector === chapter?.focus || s.built.some(b => index.projects.get(b.projectId)?.sector === p.sector)))
    .map(p => programmeOption(index, s, p));
  const rank = (o: ProgrammeOption) => (o.project.id === chapter?.targetProjectId ? 0 : o.project.sector === chapter?.focus ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || a.project.era - b.project.era || a.project.name.localeCompare(b.project.name));
}

/* ------------------------------ objectives ------------------------------- */

export interface ObjectiveView { id: string; text: string; done: boolean; kind: 'build' | 'stock' | 'turn'; progress: string }
export function objectiveViews(index: ContentIndex, s: LifelinesState): ObjectiveView[] {
  const chapter = index.chapters.get(s.chapterId);
  if (!chapter) return [];
  return chapter.objectiveIds.map(id => {
    const o = index.objectives.get(id);
    if (!o) return { id, text: id, done: false, kind: 'turn' as const, progress: '' };
    const done = s.objectiveIds.includes(id);
    const progress = o.kind === 'stock' ? `${Math.floor(s.stocks[o.resource] / 1000)} / ${o.target}`
      : o.kind === 'turn' ? `${Math.min(s.turn, o.target)} / ${o.target}` : done ? 'Established' : 'Not yet';
    return { id, text: o.text, done, kind: o.kind, progress };
  });
}

/* ------------------------------- pressures -------------------------------- */

export interface PressureView {
  id: string;
  resource: ResourceId;
  cause: Warning['cause'];
  title: string;
  explanation: string;
  districtIds: string[];
  bottleneckLinkId: string | null;
  deficit: number;
}

function pressureExplanation(s: LifelinesState, w: Warning): string {
  const label = SERVICE_LABEL[w.resource];
  const where = w.districts.map(d => districtName(s.layout, d.districtId));
  if (w.cause === 'network') {
    const link = w.bottleneckLinkId ? s.layout.links.find(l => l.id === w.bottleneckLinkId) : null;
    const via = link ? ` The ${linkLabel(link.type, s.era).toLowerCase()} between ${districtName(s.layout, link.a)} and ${districtName(s.layout, link.b)} can carry only part of the demand.` : ' The connection can carry only part of the demand.';
    return `${label} exists elsewhere in the settlement; it is not reaching ${where.join(' and ')}.${via}`;
  }
  return `${label} supply and reserve are below what ${where.join(' and ')} need. Production, a reserve policy, or emergency shared work can change that.`;
}

/** Shortages ranked by essential-service impact; explain the top cause first. Warnings only — nothing here ends a run. */
export function pressures(s: LifelinesState): PressureView[] {
  const warnings = s.report?.warnings ?? [];
  return [...warnings]
    .sort((a, b) => ESSENTIAL_ORDER.indexOf(a.resource) - ESSENTIAL_ORDER.indexOf(b.resource))
    .map(w => ({
      id: `pressure:${w.resource}`, resource: w.resource, cause: w.cause,
      title: `${SERVICE_LABEL[w.resource]} ${w.cause === 'network' ? 'is not reaching everyone' : 'is running short'}`,
      explanation: pressureExplanation(s, w), districtIds: w.districts.map(d => d.districtId),
      bottleneckLinkId: w.bottleneckLinkId, deficit: w.deficit,
    }));
}

/** Programmes that have lost condition through explicit unmet upkeep. */
export function degradedProgrammes(index: ContentIndex, s: LifelinesState) {
  return s.built.filter(b => b.condition < 1000).map(b => ({
    built: b,
    name: index.projects.get(b.projectId)?.name ?? b.projectId,
    repairCost: repairProgrammeCost(b.committedMaterials),
    district: districtName(s.layout, b.districtId),
  }));
}

/* ------------------------------- tutorial -------------------------------- */

export type TutorialStep = 'start-programme' | 'advance' | 'read-forecast' | 'handle-event' | 'done';
/** Derived from STATE, never from an exact click sequence: finishing a step another way advances it. */
export function tutorialStep(index: ContentIndex, s: LifelinesState): { step: TutorialStep; text: string; projectId: string | null } {
  const chapter = index.chapters.get(s.chapterId);
  const target = chapter?.targetProjectId ?? null;
  const anyProgramme = s.queue.length > 0 || s.built.length > 0;
  if (chapter && chapter.order === 1) {
    if (!anyProgramme) return { step: 'start-programme', projectId: target, text: 'Start a dependable food programme. Pick the highlighted district, then Gathering rounds.' };
    if (s.built.length === 0 && s.turn === 0) return { step: 'advance', projectId: null, text: 'Programmes reserve their cost once. Advance the season to let the work happen.' };
    if (!s.flags.forecastViewed) return { step: 'read-forecast', projectId: null, text: 'Open the forecast. A positive balance today is not the same as a buffer that survives a disruption.' };
    if (s.pendingEventId) return { step: 'handle-event', projectId: null, text: 'A pressure needs a response. None of the options ends your settlement.' };
  }
  return { step: 'done', projectId: null, text: '' };
}

/* ---------------------------------- hints -------------------------------- */

export interface HintView { level: 1 | 2 | 3; text: string; applicable: boolean; reasons: string[]; projectId: string | null }

/** The next sensible target programme: the chapter target until it is established, else null. */
export function suggestedProject(index: ContentIndex, s: LifelinesState): Project | null {
  const chapter = index.chapters.get(s.chapterId);
  const t = chapter ? index.projects.get(chapter.targetProjectId) : undefined;
  if (!t || s.built.some(b => b.projectId === t.id)) return null;
  const missing = t.requires.map(id => index.projects.get(id)).find(p => p && !s.built.some(b => b.projectId === p.id));
  return missing ?? t;
}

export function hintFor(index: ContentIndex, s: LifelinesState, level: 1 | 2 | 3): HintView {
  const chapter = index.chapters.get(s.chapterId);
  const p = suggestedProject(index, s);
  if (!p) {
    const open = objectiveViews(index, s).filter(o => !o.done);
    const text = open.length === 0
      ? 'Every goal for this chapter is met. Keep tending the settlement, or archive this attempt.'
      : level === 1 ? 'The programme goal is done. Check the remaining goals and the forecast.'
        : `Remaining: ${open.map(o => o.text).join(' ')}`;
    return { level, text, applicable: true, reasons: [], projectId: null };
  }
  const base = index.hintsByProject.get(p.id)?.find(h => h.level === level)?.text ?? '';
  const reasons: string[] = [];
  const queued = s.queue.find(q => q.projectId === p.id);
  if (queued) reasons.push(`${p.name} is already planned in ${districtName(s.layout, queued.districtId)}. Advance the season so the work happens.`);
  else {
    const opt = programmeOption(index, s, p);
    for (const [r, n] of Object.entries(opt.shortfall) as [ResourceId, number][]) reasons.push(`The reserve is short of ${SERVICE_LABEL[r].toLowerCase()} by ${(n / 1000).toFixed(n % 1000 ? 2 : 0)}.`);
    if (opt.missingPrerequisites.length) reasons.push(`First establish ${opt.missingPrerequisites.map(id => index.projects.get(id)?.name ?? id).join(', ')}.`);
    if (s.actionsLeft < 1) reasons.push('No actions are left this season.');
    const legal = opt.districts.filter(d => d.reason === null).map(d => d.name);
    if (legal.length && !reasons.length) reasons.push(`It can be planned in ${legal.join(' or ')}.`);
    if (!legal.length && opt.districts.every(d => d.reason === 'terrain-unsuitable')) reasons.push(opt.reasonText ?? 'No district suits it.');
  }
  void chapter;
  return { level, text: base, applicable: true, reasons, projectId: p.id };
}

/** "Need a direction?" shows after repeated blocked actions or several seasons without progress — never on a wall-clock timer. */
export function needsDirection(s: LifelinesState, blockedActions: number): boolean {
  return s.completion.status === 'active' && (blockedActions >= 3 || s.turn - s.lastProgressTurn >= 4);
}

/* -------------------------------- districts ------------------------------- */

export interface DistrictView {
  district: District;
  built: { instanceId: string; projectId: string; name: string; condition: number }[];
  queue: { queueId: string; projectId: string; name: string; status: string; percent: number }[];
  needs: { resource: ResourceId; label: string; unmet: number }[];
  links: { link: Link; other: string; otherName: string; label: string; worn: boolean }[];
}
export function districtView(index: ContentIndex, s: LifelinesState, districtId: string, report: SeasonReport | null): DistrictView | null {
  const district = s.layout.districts.find(d => d.id === districtId);
  if (!district) return null;
  const needs = (report?.needs ?? []).filter(n => n.districtId === districtId && n.unmet + n.upkeepUnmet > 0)
    .map(n => ({ resource: n.resource, label: SERVICE_LABEL[n.resource], unmet: n.unmet + n.upkeepUnmet }))
    .sort((a, b) => ESSENTIAL_ORDER.indexOf(a.resource) - ESSENTIAL_ORDER.indexOf(b.resource));
  return {
    district,
    built: s.built.filter(b => b.districtId === districtId).map(b => ({ instanceId: b.instanceId, projectId: b.projectId, name: index.projects.get(b.projectId)?.name ?? b.projectId, condition: b.condition })),
    queue: s.queue.filter(q => q.districtId === districtId).map(q => ({
      queueId: q.queueId, projectId: q.projectId, name: index.projects.get(q.projectId)?.name ?? q.projectId,
      status: q.status, percent: Math.round((q.workDone / q.workRequired) * 100),
    })),
    needs,
    links: s.layout.links.filter(l => l.a === districtId || l.b === districtId).map(l => {
      const other = l.a === districtId ? l.b : l.a;
      return { link: l, other, otherName: districtName(s.layout, other), label: linkLabel(l.type, s.era), worn: l.condition < 1000 };
    }),
  };
}

/* --------------------------------- remedies ------------------------------- */

export interface Remedy {
  id: string;
  kind: 'repair-link' | 'build-link' | 'local-supply';
  label: string;
  description: string;
  command: Command;
  legal: boolean;
  reasonText: string | null;
  cost: MilliQuantities;
  /** Effect on the forecast, computed by the same pipeline. For local supply: once the programme is established. */
  diff: ReportDiff | null;
}

/** Different strategic solutions for a shortage, each previewed through the real resolver. */
export function remediesFor(index: ContentIndex, s: LifelinesState, pressure: PressureView): Remedy[] {
  const base = forecast(index, s);
  const out: Remedy[] = [];
  const chapter = index.chapters.get(s.chapterId);
  const order = chapter?.order ?? 0;
  const taught = (from: number) => s.mode === 'sandbox' || order >= from;
  if (pressure.cause === 'network') {
    const link = s.layout.links.find(l => l.id === pressure.bottleneckLinkId);
    if (link && link.condition < 1000 && taught(REPAIR_FROM_CHAPTER)) {
      const cmd: Command = { type: 'repair-link', linkId: link.id };
      const next = tryCommand(index, s, cmd);
      out.push({
        id: `remedy:repair:${link.id}`, kind: 'repair-link', label: `Repair the ${linkLabel(link.type, s.era).toLowerCase()}`,
        description: `Restores ${districtName(s.layout, link.a)} ↔ ${districtName(s.layout, link.b)} to full capacity.`,
        command: cmd, legal: next !== null, reasonText: next ? null : 'Needs materials in the reserve and an action.',
        cost: REPAIR_LINK_COST, diff: next ? diffReports(base, forecast(index, next)) : null,
      });
    }
    const alt = s.layout.potentialLinks.find(pl => !s.layout.links.some(l => l.id === pl.id));
    if (alt && taught(ALTERNATE_FROM_CHAPTER) && (alt.supports.includes(pressure.resource))) {
      const cmd: Command = { type: 'build-link', potentialLinkId: alt.id };
      const next = tryCommand(index, s, cmd);
      out.push({
        id: `remedy:route:${alt.id}`, kind: 'build-link', label: 'Establish a second route',
        description: `Joins ${districtName(s.layout, alt.a)} and ${districtName(s.layout, alt.b)} with another ${linkLabel(alt.type, s.era).toLowerCase()}.`,
        command: cmd, legal: next !== null, reasonText: next ? null : 'Needs materials and logistics in the reserve, and an action.',
        cost: alt.cost, diff: next ? diffReports(base, forecast(index, next)) : null,
      });
    }
  }
  // Local supply: a programme of the short service in the district that lacks it.
  const target = pressure.districtIds[0];
  if (target) {
    const candidates = index.db.projects
      .filter(p => p.sector === pressure.resource && p.era <= s.era)
      .map(p => ({ p, reason: queueBlockReason(index, s, p.id, target) }))
      .sort((a, b) => Number(a.reason !== null) - Number(b.reason !== null) || a.p.era - b.p.era || a.p.id.localeCompare(b.p.id));
    const pick = candidates[0];
    if (pick) {
      const cmd: Command = { type: 'queue-programme', projectId: pick.p.id, districtId: target };
      const after = pick.reason ? null : forecastWithProgramme(index, s, pick.p.id, target);
      out.push({
        id: `remedy:local:${pick.p.id}:${target}`, kind: 'local-supply', label: `Supply it locally: ${pick.p.name}`,
        description: `Plans ${pick.p.name} in ${districtName(s.layout, target)}, so that district stops depending on the connection.`,
        command: cmd, legal: pick.reason === null, reasonText: pick.reason ? terrainOrReason(pick.reason, pick.p) : null,
        cost: quantitiesToMilli(pick.p.cost), diff: after ? diffReports(base, after) : null,
      });
    }
  }
  return out;
}

/* ------------------------------ council preview ---------------------------- */

export interface CouncilPreview {
  valid: boolean;
  error: string | null;
  diff: ReportDiff | null;
  outgoing: string[];
  incoming: string[];
}
/** Read-only: compare the current policy set with a proposal. Cancelling leaves the state untouched. */
export function councilPreview(index: ContentIndex, s: LifelinesState, proposed: PolicyChoice[]): CouncilPreview {
  const same = JSON.stringify([...proposed].sort((a, b) => (a.id < b.id ? -1 : 1))) === JSON.stringify(s.policies);
  const next = tryCommand(index, s, { type: 'set-policies', policies: proposed });
  if (!next) return { valid: false, error: 'This combination is not allowed: at most three, one per service group.', diff: null, outgoing: [], incoming: [] };
  const name = (id: string) => index.policies.get(id)?.name ?? id;
  const cur = new Set(s.policies.map(p => p.id)), nxt = new Set(proposed.map(p => p.id));
  return {
    valid: true, error: null,
    diff: same ? null : diffReports(forecast(index, s), forecast(index, next)),
    outgoing: [...cur].filter(id => !nxt.has(id)).map(name),
    incoming: [...nxt].filter(id => !cur.has(id)).map(name),
  };
}

/* -------------------------------- queue ----------------------------------- */

export function queueViews(index: ContentIndex, s: LifelinesState) {
  const etas = queueEtas(index, s);
  return s.queue.map(q => ({
    item: q,
    name: index.projects.get(q.projectId)?.name ?? q.projectId,
    district: districtName(s.layout, q.districtId),
    percent: Math.round((q.workDone / q.workRequired) * 100),
    etaSeasons: etas.get(q.queueId) ?? null,
    started: q.workDone > 0,
  }));
}

/* ------------------------------- misc ------------------------------------- */

export function networkTeaching(index: ContentIndex, s: LifelinesState) {
  const order = index.chapters.get(s.chapterId)?.order ?? 0;
  const ok = (from: number) => s.mode === 'sandbox' || order >= from;
  return { repair: ok(REPAIR_FROM_CHAPTER), alternate: ok(ALTERNATE_FROM_CHAPTER), routing: ok(ROUTING_FROM_CHAPTER) };
}

export function pathBetween(s: LifelinesState, service: ResourceId, from: string, to: string): string[] | null {
  return shortestLinkPath(s.layout, service, from, to);
}

export function legalDistricts(index: ContentIndex, s: LifelinesState, projectId: string): District[] {
  const p = index.projects.get(projectId);
  if (!p) return [];
  return s.layout.districts.filter(d => districtAllows(d.terrain, p.sector));
}

/** Stocks as the focus-first list the default view shows: chapter focus, most urgent shortage, shared materials. */
export function headlineResources(index: ContentIndex, s: LifelinesState): ResourceId[] {
  const chapter = index.chapters.get(s.chapterId);
  const urgent = pressures(s)[0]?.resource;
  const set: ResourceId[] = [];
  for (const r of [chapter?.focus, urgent, 'food', 'water', 'materials'] as (ResourceId | undefined)[]) {
    if (r && !set.includes(r) && set.length < 3) set.push(r);
  }
  return set;
}
export const ALL_RESOURCES = RESOURCE_IDS;
export const ROUTING_CHAPTER = ROUTING_FROM_CHAPTER;
