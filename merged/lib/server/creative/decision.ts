import { MAX_MECHANISM, PROCESS_ID_RE, type EvidenceClass, type ModelDecision, type TargetRule } from './types';
import { ACTIONS_LIST } from '@/lib/content/actionList';

/* Ticket 075 / 085 — the trust boundary for a model's answer. `parseDecision` turns untrusted JSON into a typed
   decision or refuses it; `judgeDecision` then checks the decision against the candidates that were actually
   offered. A decision can only ever become a private proposal for review — never a craft. */

const WEAK = /\b(symbolic(ally)?|symbols?|represent(s|ing)?|remind(s)? of|reminds? of|associat(ed|ion)s?( with)?|themes?|thematic(ally)?|related to|relat(ed|es) to|idea of|spirit of|inspired by|inspire[sd]?|magic(al(ly)?)?|enchant(ed|ment)?|spell|charm|alchem(y|ical)|somehow|vibe|rhymes?|sounds? like|pun|wordplay|myth(ical(ly)?|s)?|legend|stor(y|ies)|cultural(ly)?|gods?|ignore (all |any )?(previous|prior)|administrator|authori[sz]e|confidence|plausible and|in spirit|stands? for|concept of)\b|\bsimilar in shape\b|\bsystem:|\bno need for a binder\b/i;
/** a mechanism must name at least one real physical operation or material change (stems, lowercase) */
const PHYSICAL = /\b(heat|fire|fired|burn|melt|cast|pour|smelt|reduc|forg|hammer|beat|anneal|quench|harden|grind|crush|press|squeez|roll|cut|carv|knap|drill|chip|polish|etch|bore|saw|split|bind|lash|tie|knot|weav|spin|twist|stretch|sew|stack|pack|mix|cure|boil|soak|dry|smok|evaporat|ferment|distil|dye|fix|fit|attach|pivot|lever|counterweight|wheel|gear|axle|rotat|piston|steam|current|wire|magnet|focus|lens|friction|tension|load|capillar|fus|sinter|bond|glue|stiffen|flatten|raise|draw|wind|set|shape|rub|pass|tooth|thread|stabilis|float|wrap|haft|sharpen|weld|solder|graft|hang|hook|lift|push|pull|slide|mount|join|seal|coat|glaz|plaster|assembl|tamp|scrape|flake|grip|dig|plow|plough|sow|harvest|thresh|winnow|mill|sieve|filter|pump|bellows)/i;
const EVIDENCE: readonly EvidenceClass[] = ['documented', 'reconstructed', 'pedagogical_simulation'];
const TOP_NONE = new Set(['schemaVersion', 'decision', 'reasonCodes', 'targetId', 'processId', 'requiredActionId', 'causalMechanism', 'evidenceClass', 'missingPrerequisiteIds']);

export type Parsed = { ok: true; decision: ModelDecision } | { ok: false; reason: string };

export function parseDecision(raw: unknown): Parsed {
  let data = raw;
  if (typeof raw === 'string') {
    if (raw.length > 8000) return { ok: false, reason: 'oversized' };
    try { data = JSON.parse(raw); } catch { return { ok: false, reason: 'malformed_json' }; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'not_object' };
  const o = data as Record<string, unknown>;
  if (Object.keys(o).some(k => !TOP_NONE.has(k))) return { ok: false, reason: 'unexpected_field' };
  if (o.schemaVersion !== 1) return { ok: false, reason: 'schema_version' };
  const codes = Array.isArray(o.reasonCodes) && o.reasonCodes.every(c => typeof c === 'string' && /^[A-Z][A-Z0-9_]{1,39}$/.test(c)) ? (o.reasonCodes as string[]).slice(0, 8) : null;
  if (!codes) return { ok: false, reason: 'reason_codes' };
  if (o.decision === 'none') return { ok: true, decision: { schemaVersion: 1, decision: 'none', reasonCodes: codes } };
  if (o.decision !== 'propose') return { ok: false, reason: 'bad_decision' };
  if (typeof o.targetId !== 'string' || typeof o.processId !== 'string' || !PROCESS_ID_RE.test(o.processId)) return { ok: false, reason: 'bad_target_or_process' };
  if (o.requiredActionId !== null && typeof o.requiredActionId !== 'string') return { ok: false, reason: 'bad_action' };
  if (typeof o.causalMechanism !== 'string' || !o.causalMechanism.trim()) return { ok: false, reason: 'missing_mechanism' };
  if (!EVIDENCE.includes(o.evidenceClass as EvidenceClass)) return { ok: false, reason: 'bad_evidence_class' };
  return {
    ok: true,
    decision: {
      schemaVersion: 1, decision: 'propose', targetId: o.targetId, processId: o.processId, requiredActionId: o.requiredActionId as string | null,
      causalMechanism: o.causalMechanism, evidenceClass: o.evidenceClass as EvidenceClass, reasonCodes: codes,
    },
  };
}

export type Judgement =
  | { kind: 'no_result'; reason: string }
  | { kind: 'pending_review'; targetId: string; processId: string; mechanism: string; evidenceClass: EvidenceClass };

export function judgeDecision(d: ModelDecision, eligible: readonly TargetRule[], actionId: string | null): Judgement {
  if (d.decision === 'none') return { kind: 'no_result', reason: 'model_abstained' };
  const rule = eligible.find(x => x.targetId === d.targetId && x.processId === d.processId);
  if (!rule) return { kind: 'no_result', reason: 'unapproved_candidate' };         // invented id, or not offered
  if (actionId !== d.requiredActionId || actionId !== rule.actionId) return { kind: 'no_result', reason: 'action_mismatch' };
  if (d.requiredActionId !== null && !ACTIONS_LIST.includes(d.requiredActionId)) return { kind: 'no_result', reason: 'bad_action' };
  const m = d.causalMechanism.trim();
  if (m.length < 40) return { kind: 'no_result', reason: 'mechanism_too_short' };
  if (m.length > MAX_MECHANISM) return { kind: 'no_result', reason: 'mechanism_too_long' };
  if (WEAK.test(m)) return { kind: 'no_result', reason: 'weak_association' };
  if (!PHYSICAL.test(m)) return { kind: 'no_result', reason: 'no_physical_process' };
  // the model's own "documented" is a claim, not proof: it is carried as-is and a human decides
  return { kind: 'pending_review', targetId: d.targetId, processId: d.processId, mechanism: m, evidenceClass: d.evidenceClass };
}
