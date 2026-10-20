'use client';
/** Offline practice: the real engine and real question formats, run in this tab with sample questions. Pick a map, a length and a role,
 *  then play the whole loop alone. Nothing is saved and nothing is rewarded. */
import { useState } from 'react';
import TDGame from './TDGame';
import { useTDLocal, type PracticeOpts } from './useTD';
import { MAPS } from '@/lib/quiz/td/maps';
import { TD_MAPS } from '@/lib/quiz/td/domain';
import { RolePicker } from './parts';

export default function TDPractice() {
  const [opts, setOpts] = useState<PracticeOpts | null>(null);
  const [draft, setDraft] = useState<PracticeOpts>({ mapId: 'meadow_circuit', minutes: 10, role: null, lowPressure: false });
  if (opts) return <Practice opts={opts} />;
  return (
    <main className="td narrow td-practicesetup">
      <section className="td-panel">
        <h1>Tower Defense practice</h1>
        <p className="td-note">Play the whole loop alone with 12 sample questions: answer, earn points, build towers, hold the core. Nothing is saved.</p>
        <fieldset className="td-maps"><legend>Map</legend>
          {TD_MAPS.map((m) => <button key={m} type="button" role="radio" aria-checked={draft.mapId === m} onClick={() => setDraft({ ...draft, mapId: m })} style={{ ['--map' as string]: MAPS[m].palette.ground, ['--lane' as string]: MAPS[m].palette.lane }}><span className="swatch" aria-hidden="true" /><b>{MAPS[m].title}</b><span>{MAPS[m].materials.replace(/ · /g, ', ')}</span></button>)}
        </fieldset>
        <label className="td-field">Length<select value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={20}>20 minutes</option></select></label>
        <RolePicker value={draft.role} busy={false} onPick={(r) => setDraft({ ...draft, role: r })} />
        <label className="td-check"><input type="checkbox" checked={draft.lowPressure} onChange={(e) => setDraft({ ...draft, lowPressure: e.target.checked })} />Low pressure: longer timers, the core cannot fall</label>
        <button type="button" className="td-btn primary big" data-testid="td-practice-go" onClick={() => setOpts(draft)}>Open the practice board</button>
      </section>
    </main>
  );
}
function Practice({ opts }: { opts: PracticeOpts }) {
  const client = useTDLocal(opts);
  return <TDGame client={client} practice />;
}
