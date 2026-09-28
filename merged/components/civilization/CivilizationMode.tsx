'use client';

import { useEffect, useState } from 'react';
import { generateSettlement } from '@/lib/civilization/generate';
import { dioramaExhibit, summarizeSettlement } from '@/lib/civilization/memory';
import { advanceTurn } from '@/lib/civilization/simulate';
import { civilizationStore } from '@/lib/civilization/store';
import { profile } from '@/lib/profile/store';
import type { Allocation, SettlementState } from '@/lib/civilization/types';

/* ============================================================================
   CIVILIZATION — "Build". A third, genuinely different interaction language:
   the player never controls an individual (Survival) or an object
   (Main Evolution) — only population-wide allocation policy, each turn,
   watching the settlement's own growth generate the next pressure. See
   docs/ROADMAP-UNIVERSE.md's Phase 7 section for what this slice does and
   does not attempt.
   ========================================================================== */

const PROBLEM_TEXT: Record<string, string> = {
  'water-labor': 'Without irrigation, hauling water from the river costs real labor every harvest.',
  'land-shortage': 'The population is close to what the farmed land can support.',
  'storage-shortage': 'Storage cannot hold the full surplus — some of it spoils.',
};

function pct(n: number): string { return `${Math.round(n * 100)}%`; }

export function CivilizationMode({ onExit }: { onExit: () => void }) {
  const [settlement, setSettlement] = useState<SettlementState | null>(() => {
    civilizationStore.load();
    return civilizationStore.get().active ?? generateSettlement(`civ-${Date.now()}`);
  });
  const [sliders, setSliders] = useState<Allocation>({ food: 50, construction: 30, knowledge: 20 });

  useEffect(() => {
    if (!settlement) return;
    if (!civilizationStore.get().active) civilizationStore.setActive(settlement);
    profile.recordModeVisit('civilization');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!settlement) return null;

  const total = sliders.food + sliders.construction + sliders.knowledge || 1;

  const advance = () => {
    const allocation: Allocation = { food: sliders.food / total, construction: sliders.construction / total, knowledge: sliders.knowledge / total };
    const { state } = advanceTurn(settlement, allocation);
    setSettlement(state);
    if (state.ending !== 'ongoing') {
      const memory = summarizeSettlement(state);
      civilizationStore.archiveActive(memory);
      const exhibit = dioramaExhibit(memory);
      profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'civilization', unlockedAt: Date.now() });
    } else {
      civilizationStore.setActive(state);
    }
  };

  const startNew = () => {
    const fresh = generateSettlement(`civ-${Date.now()}`);
    setSettlement(fresh);
    civilizationStore.setActive(fresh);
  };

  if (settlement.ending !== 'ongoing') {
    const memory = summarizeSettlement(settlement);
    return (
      <div id="civilization-mode" className={`cv-ending cv-${memory.ending}`}>
        <div className="cv-ending-box">
          <p className="mono cv-eyebrow">Civilization — Build</p>
          <h1 className="cv-ending-title">{memory.ending === 'resilient' ? 'The settlement held.' : 'The settlement declined.'}</h1>
          <p className="cv-ending-line">{memory.headline}</p>
          <ol className="cv-log">
            {settlement.log.slice(-8).map((e, i) => <li key={i}>Year {e.year} — {e.text}</li>)}
          </ol>
          <div className="cv-ending-actions">
            <button className="chip" onClick={startNew}>Found a new settlement</button>
            <button className="chip" onClick={onExit}>Return to the Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const capacity = settlement.farmland.base + settlement.farmland.irrigated;

  return (
    <div id="civilization-mode">
      <header className="cv-top">
        <button className="chip cv-exit" onClick={onExit}>← Hub</button>
        <p className="mono cv-eyebrow">Civilization — Build</p>
        <p className="cv-yearcount">Year {settlement.year} · Turn {settlement.turn} of {settlement.maxTurns}</p>
      </header>

      <div className="cv-body">
        <section className="cv-headline">
          <div className="cv-pop">
            <span className="mono">Population</span>
            <b>{Math.round(settlement.population)}</b>
          </div>
          <div className="cv-stats">
            <div><span className="mono">Farmland capacity</span><b>{capacity.toFixed(0)}</b></div>
            <div><span className="mono">Food stock</span><b>{settlement.foodStock.toFixed(1)} / {settlement.storageCapacity}</b></div>
            <div><span className="mono">Knowledge</span><b>{settlement.knowledgeStock.toFixed(0)}</b></div>
            {!settlement.milestones.irrigationComplete && (
              <div><span className="mono">Irrigation</span><b>{pct(settlement.irrigationProgress)}</b></div>
            )}
          </div>
        </section>

        {settlement.problems.length > 0 && (
          <section className="cv-problems">
            <p className="mono cv-h">What the settlement is telling you</p>
            <ul>
              {settlement.problems.map(p => <li key={p.kind}>{PROBLEM_TEXT[p.kind]}</li>)}
            </ul>
          </section>
        )}

        <section className="cv-log-section">
          <p className="mono cv-h">Recent years</p>
          <ol className="cv-log">
            {settlement.log.slice(-4).map((e, i) => <li key={i}>{e.text}</li>)}
          </ol>
        </section>
      </div>

      <section className="cv-allocation">
        <p className="mono cv-h">Allocate the settlement&rsquo;s effort — normalised to {pct(1)} when you advance</p>
        {(['food', 'construction', 'knowledge'] as const).map(key => (
          <label key={key} className="cv-slider">
            <span className="mono">{key === 'food' ? 'Food' : key === 'construction' ? 'Construction' : 'Knowledge'} — {pct(sliders[key] / total)}</span>
            <input
              type="range" min={0} max={100} value={sliders[key]}
              onChange={e => setSliders(s => ({ ...s, [key]: Number(e.target.value) }))}
            />
          </label>
        ))}
        <div className="cv-advance-row">
          <button className="chip cv-advance" onClick={advance}>Advance 5 years</button>
        </div>
      </section>
    </div>
  );
}
