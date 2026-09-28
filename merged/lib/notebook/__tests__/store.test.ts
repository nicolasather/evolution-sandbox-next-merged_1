import { notebook } from '@/lib/notebook/store';

describe('research notebook store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    notebook.reset();
  });

  it('starts with no investigations', () => {
    expect(notebook.investigations()).toEqual([]);
  });

  it('ensureInvestigation creates once and is idempotent thereafter', () => {
    const a = notebook.ensureInvestigation('heat-treatment', 'Heat Treatment experiments', 'main-evolution');
    const b = notebook.ensureInvestigation('heat-treatment', 'Heat Treatment experiments', 'main-evolution');
    expect(a).toEqual(b);
    expect(notebook.investigations()).toHaveLength(1);
  });

  it('logEvidence appends to the investigation and is retrievable in order', () => {
    notebook.ensureInvestigation('heat-treatment', 'Heat Treatment experiments', 'main-evolution');
    notebook.logEvidence('heat-treatment', 'experiment', 'Underfired at low heat', 'main-evolution', { intensity: 10, duration: 80 });
    notebook.logEvidence('heat-treatment', 'experiment', 'Success at moderate heat', 'main-evolution', { intensity: 55, duration: 55 });
    const ev = notebook.evidenceFor('heat-treatment');
    expect(ev).toHaveLength(2);
    expect(ev[0].summary).toBe('Underfired at low heat');
    expect(ev[1].summary).toBe('Success at moderate heat');
  });

  it('logEvidence throws for an investigation that was never created', () => {
    expect(() => notebook.logEvidence('nope', 'experiment', 'x', 'main-evolution')).toThrow();
  });

  it('logObservation and addHypothesis attach to the investigation', () => {
    notebook.ensureInvestigation('inv1', 'Test', 'main-evolution');
    const e = notebook.logEvidence('inv1', 'experiment', 'e1', 'main-evolution');
    notebook.logObservation('inv1', 'Higher heat repeatedly changes the result', [e.id]);
    notebook.addHypothesis('inv1', 'Heat threshold exists', 0.7);
    const inv = notebook.investigation('inv1')!;
    expect(inv.observationIds).toHaveLength(1);
    expect(inv.hypothesisIds).toHaveLength(1);
  });

  it('addHypothesis clamps confidence to [0, 1]', () => {
    notebook.ensureInvestigation('inv1', 'Test', 'main-evolution');
    const h = notebook.addHypothesis('inv1', 'x', 5);
    expect(h.confidence).toBe(1);
    const h2 = notebook.addHypothesis('inv1', 'y', -5);
    expect(h2.confidence).toBe(0);
  });

  it('persists and reloads across a simulated reload', () => {
    notebook.ensureInvestigation('heat-treatment', 'Heat Treatment experiments', 'main-evolution');
    notebook.logEvidence('heat-treatment', 'experiment', 'e1', 'main-evolution');
    const raw = window.localStorage.getItem('evo.notebook.v1');
    expect(raw).not.toBeNull();
    notebook.load(); // re-load the same persisted state
    expect(notebook.evidenceFor('heat-treatment')).toHaveLength(1);
  });

  it('reset clears memory and storage', () => {
    notebook.ensureInvestigation('inv1', 'Test', 'main-evolution');
    notebook.reset();
    expect(notebook.investigations()).toEqual([]);
    expect(window.localStorage.getItem('evo.notebook.v1')).toBeNull();
  });
});
