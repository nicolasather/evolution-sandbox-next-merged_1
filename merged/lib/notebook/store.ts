/* ============================================================================
   RESEARCH NOTEBOOK — persisted, versioned (`evo.notebook.v1`), independent
   of every other store. Organised by Investigation, not by timestamp, per
   the brief: each Investigation groups the Evidence/Observations/Hypotheses
   that belong to one line of inquiry. This pass's only writer is the Heat
   Treatment Experiment Workspace (components/experiments/), which only ever
   logs Evidence; Observation/Hypothesis methods exist, are tested, and are
   ready for the modes (Archaeologist, Decipher) whose hypothesis boards will
   need them.
   ========================================================================== */
import { runMigrations } from '../save/migrate';
import type { Migration, Migratable } from '../save/types';
import type { Evidence, EvidenceKind, Hypothesis, Investigation, Observation } from './types';

const KEY = 'evo.notebook.v1';
const CURRENT_VERSION = 1;
const isBrowser = () => typeof window !== 'undefined';
let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

interface NotebookSave extends Migratable {
  v: 1;
  investigations: Record<string, Investigation>;
  evidence: Record<string, Evidence>;
  observations: Record<string, Observation>;
  hypotheses: Record<string, Hypothesis>;
}

const migrations: Migration[] = [];

function isValid(d: unknown): d is NotebookSave {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === CURRENT_VERSION && typeof o.investigations === 'object' && o.investigations !== null
    && typeof o.evidence === 'object' && o.evidence !== null
    && typeof o.observations === 'object' && o.observations !== null
    && typeof o.hypotheses === 'object' && o.hypotheses !== null;
}

function blank(): NotebookSave {
  return { v: CURRENT_VERSION, investigations: {}, evidence: {}, observations: {}, hypotheses: {} };
}

class Notebook {
  private data: NotebookSave = blank();
  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getVersion = (): number => this.version;
  private notify(): void { this.version++; this.listeners.forEach(cb => cb()); }

  load(): void {
    if (!isBrowser()) return;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const out = runMigrations<NotebookSave>(JSON.parse(raw), { currentVersion: CURRENT_VERSION, migrations, isValid });
      if (out.data) { this.data = out.data; this.notify(); }
    } catch { /* storage blocked or corrupt — start blank, never crash */ }
  }

  private persist(): void {
    if (!isBrowser()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best-effort */ }
  }

  investigations(): Investigation[] { return Object.values(this.data.investigations); }
  investigation(id: string): Investigation | undefined { return this.data.investigations[id]; }
  evidenceFor(investigationId: string): Evidence[] {
    const inv = this.data.investigations[investigationId];
    if (!inv) return [];
    return inv.evidenceIds.map(id => this.data.evidence[id]).filter((e): e is Evidence => !!e);
  }

  /** Creates the investigation if this is the first time it's referenced —
   *  callers never have to pre-create one. */
  ensureInvestigation(id: string, title: string, sourceMode: string): Investigation {
    const existing = this.data.investigations[id];
    if (existing) return existing;
    const inv: Investigation = { id, title, sourceMode, createdAt: Date.now(), evidenceIds: [], observationIds: [], hypothesisIds: [] };
    this.data = { ...this.data, investigations: { ...this.data.investigations, [id]: inv } };
    this.persist();
    this.notify();
    return inv;
  }

  logEvidence(investigationId: string, kind: EvidenceKind, summary: string, sourceMode: string, data?: Record<string, unknown>): Evidence {
    const inv = this.data.investigations[investigationId];
    if (!inv) throw new Error(`logEvidence: unknown investigation "${investigationId}" — call ensureInvestigation first`);
    const ev: Evidence = { id: nextId('ev'), kind, summary, data, recordedAt: Date.now(), sourceMode };
    this.data = {
      ...this.data,
      evidence: { ...this.data.evidence, [ev.id]: ev },
      investigations: { ...this.data.investigations, [investigationId]: { ...inv, evidenceIds: [...inv.evidenceIds, ev.id] } },
    };
    this.persist();
    this.notify();
    return ev;
  }

  logObservation(investigationId: string, summary: string, evidenceIds: string[]): Observation {
    const inv = this.data.investigations[investigationId];
    if (!inv) throw new Error(`logObservation: unknown investigation "${investigationId}"`);
    const obs: Observation = { id: nextId('obs'), investigationId, summary, evidenceIds, recordedAt: Date.now() };
    this.data = {
      ...this.data,
      observations: { ...this.data.observations, [obs.id]: obs },
      investigations: { ...this.data.investigations, [investigationId]: { ...inv, observationIds: [...inv.observationIds, obs.id] } },
    };
    this.persist();
    this.notify();
    return obs;
  }

  addHypothesis(investigationId: string, claim: string, confidence: number): Hypothesis {
    const inv = this.data.investigations[investigationId];
    if (!inv) throw new Error(`addHypothesis: unknown investigation "${investigationId}"`);
    const hyp: Hypothesis = {
      id: nextId('hyp'), investigationId, claim, confidence: Math.max(0, Math.min(1, confidence)),
      supportingEvidenceIds: [], contradictingEvidenceIds: [], createdAt: Date.now(),
    };
    this.data = {
      ...this.data,
      hypotheses: { ...this.data.hypotheses, [hyp.id]: hyp },
      investigations: { ...this.data.investigations, [investigationId]: { ...inv, hypothesisIds: [...inv.hypothesisIds, hyp.id] } },
    };
    this.persist();
    this.notify();
    return hyp;
  }

  reset(): void {
    this.data = blank();
    if (isBrowser()) { try { window.localStorage.removeItem(KEY); } catch { /* best-effort */ } }
    this.notify();
  }
}

export const notebook = new Notebook();
