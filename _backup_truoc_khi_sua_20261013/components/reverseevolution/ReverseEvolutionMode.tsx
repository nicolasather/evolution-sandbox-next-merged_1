'use client';

import { useState } from 'react';
import { TARGETS } from '@/lib/reverseevolution/catalog';
import { generateRun } from '@/lib/reverseevolution/generate';
import { reverseExhibit, summarizeRun } from '@/lib/reverseevolution/memory';
import { playDb } from '@/lib/processing';
import { profile } from '@/lib/profile/store';
import { applyAction, isBudgetCapped } from '@/lib/reverseevolution/simulate';
import { reverseEvolutionStore } from '@/lib/reverseevolution/store';
import type { ReverseRunState } from '@/lib/reverseevolution/types';

/* ============================================================================
   REVERSE EVOLUTION — "From Smartphone to Stone". A seventh genuinely
   different interaction language: not crafting, not a single shortest
   path, but a multiple-choice tree-decomposition quiz over Main
   Evolution's own real 322-node database — the first mode to read that
   database directly rather than an authored/procedural catalog of its
   own. See docs/ROADMAP-UNIVERSE.md's Reverse Evolution section.
   ========================================================================== */

function nameOf(id: string): string { return playDb.nodes.find(n => n.id === id)?.n ?? id; }

function QuestionPanel({ optionIds, onSubmit, onReveal }: {
  optionIds: string[]; onSubmit: (ids: string[]) => void; onReveal: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return (
    <div className="rev-question">
      <div className="rev-options">
        {optionIds.map(id => (
          <button
            key={id}
            className={'chip' + (selected.includes(id) ? ' rev-chosen' : '')}
            onClick={() => toggle(id)}
          >{nameOf(id)}</button>
        ))}
      </div>
      <div className="rev-question-actions">
        <button className="chip rev-submit" disabled={selected.length === 0} onClick={() => onSubmit(selected)}>Submit</button>
        <button className="chip rev-reveal" onClick={onReveal}>Just show me</button>
      </div>
    </div>
  );
}

function TreeNodeView({ state, nodeKey, onSubmit, onReveal }: {
  state: ReverseRunState; nodeKey: string; onSubmit: (ids: string[]) => void; onReveal: () => void;
}) {
  const node = state.nodes[nodeKey];
  const isCurrent = state.pendingQueue[0] === nodeKey;
  return (
    <div className="rev-node">
      <div className={'rev-node-head rev-' + node.status}>
        <span className="rev-node-name">{nameOf(node.discoveryId)}</span>
        {node.status === 'correct' && <span className="rev-badge">recalled correctly</span>}
        {node.status === 'revealed' && <span className="rev-badge rev-badge-muted">revealed</span>}
        {node.status === 'primitive' && <span className="rev-badge rev-badge-muted">raw material</span>}
      </div>
      {isCurrent && <QuestionPanel optionIds={node.optionIds!} onSubmit={onSubmit} onReveal={onReveal} />}
      {node.childKeys.length > 0 && (
        <div className="rev-children">
          {node.childKeys.map(k => <TreeNodeView key={k} state={state} nodeKey={k} onSubmit={onSubmit} onReveal={onReveal} />)}
        </div>
      )}
    </div>
  );
}

export function ReverseEvolutionMode({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState<ReverseRunState | null>(() => {
    reverseEvolutionStore.load();
    return reverseEvolutionStore.get().active;
  });

  // Takes the timestamp as a parameter, computed by the caller's own
  // inline arrow (`onClick={() => start(t.id, Date.now())}`) rather than
  // calling Date.now() itself — keeps the one impure call directly
  // inside the event-handler arrow, not nested through a named function.
  const start = (targetId: string, now: number) => {
    const run = generateRun(playDb, `rev-${now}`, targetId);
    setState(run);
    reverseEvolutionStore.setActive(run);
    profile.recordModeVisit('reverse-evolution');
  };

  const submit = (selectedIds: string[]) => {
    if (!state) return;
    const { state: next } = applyAction(playDb, state, { kind: 'submit', selectedIds });
    setState(next);
    reverseEvolutionStore.setActive(next);
  };

  const reveal = () => {
    if (!state) return;
    const { state: next } = applyAction(playDb, state, { kind: 'reveal' });
    setState(next);
    reverseEvolutionStore.setActive(next);
  };

  // Each directly referenced as its own onClick (never wrapped in an
  // extra inline arrow) so the impure Date.now() call inside stays
  // reachable from exactly one real event.
  const finishAndStartNew = () => {
    if (!state) return;
    const memory = summarizeRun(playDb, state);
    reverseEvolutionStore.archiveActive(memory);
    const exhibit = reverseExhibit(memory, nameOf(state.targetId));
    profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'reverse-evolution', unlockedAt: Date.now() });
    setState(null);
  };

  const finishAndExit = () => {
    if (!state) return;
    const memory = summarizeRun(playDb, state);
    reverseEvolutionStore.archiveActive(memory);
    const exhibit = reverseExhibit(memory, nameOf(state.targetId));
    profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'reverse-evolution', unlockedAt: Date.now() });
    setState(null);
    onExit();
  };

  if (!state) {
    return (
      <div id="reverseevolution-mode">
        <header className="rev-top">
          <button className="chip rev-exit" onClick={onExit}>← Hub</button>
          <p className="mono rev-eyebrow">Reverse Evolution — From Smartphone to Stone</p>
        </header>
        <div className="rev-body">
          <p className="rev-intro">Pick a real, complex discovery. Trace what it was actually made from, step by step, back toward raw materials — every question and every answer is real Main Evolution data, not invented for this mode.</p>
          <div className="rev-targets">
            {TARGETS.map(t => (
              <button key={t.id} className="rev-target-card" onClick={() => start(t.id, Date.now())}>
                <span className="rev-target-name">{nameOf(t.id)}</span>
                <span className="rev-target-blurb">{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.ending === 'complete') {
    const capped = isBudgetCapped(state);
    return (
      <div id="reverseevolution-mode" className="rev-ending">
        <div className="rev-ending-box">
          <p className="mono rev-eyebrow">Reverse Evolution — From Smartphone to Stone</p>
          <h1 className="rev-ending-title">{capped ? 'Traced as far as this session goes.' : 'Traced all the way to raw materials.'}</h1>
          <p className="rev-ending-line">
            {state.correctCount} recalled correctly, {state.revealedCount} newly learned, tracing {nameOf(state.targetId)} back through {state.correctCount + state.revealedCount} real steps.
            {capped && ' The real chain goes deeper than this session followed it — every step shown is still real, verified data.'}
          </p>
          <div className="rev-ending-tree">
            <TreeNodeView state={state} nodeKey="n0" onSubmit={submit} onReveal={reveal} />
          </div>
          <div className="rev-ending-actions">
            <button className="chip" onClick={finishAndStartNew}>Trace another discovery</button>
            <button className="chip" onClick={finishAndExit}>Return to the Hub</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="reverseevolution-mode">
      <header className="rev-top">
        <button className="chip rev-exit" onClick={onExit}>← Hub</button>
        <p className="mono rev-eyebrow">Reverse Evolution — From Smartphone to Stone</p>
        <p className="rev-progress mono">{state.correctCount + state.revealedCount} of {state.nodesUsed - 1} steps answered</p>
      </header>
      <div className="rev-body">
        <TreeNodeView state={state} nodeKey="n0" onSubmit={submit} onReveal={reveal} />
      </div>
    </div>
  );
}
