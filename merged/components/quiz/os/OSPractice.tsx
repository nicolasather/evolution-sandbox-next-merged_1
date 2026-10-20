'use client';
/** Offline practice: pick a map and role, then run the same physics with sample questions. No account, no database, no rewards. */
import { useState } from 'react';
import Link from 'next/link';
import OSGame from './OSGame';
import { RolePicker, SOLO_ROLE } from './parts';
import { useOSLocal } from './useOS';
import { BASE_COURSES, MAP_INFO } from '@/lib/quiz/os/course';
import type { MapId, Role } from '@/lib/quiz/os/domain';

function Run({ mapId, role, low }: { mapId: MapId; role: Role; low: boolean }) { return <OSGame client={useOSLocal({ mapId, role, lowPressure: low })} practiceBack />; }
export default function OSPractice() {
  const [map, setMap] = useState<MapId>('chalkyard_circuit'); const role: Role = SOLO_ROLE; const [low, setLow] = useState(false); const [go, setGo] = useState(false);
  if (go) return <Run mapId={map} role={role} low={low} />;
  return (
    <main className="os narrow">
      <form className="os-card" onSubmit={(e) => { e.preventDefault(); setGo(true); }}>
        <h1>Practice alone</h1><p className="os-note">Run the real course with the real controls. Questions appear at each checkpoint. Nothing is saved and nothing earns points.</p>
        <fieldset className="os-mapset"><legend>MAP</legend>{MAP_INFO.map((m) => <label key={m.id} className="os-mapopt"><input type="radio" name="map" checked={map === m.id} onChange={() => setMap(m.id)} /><span><b>{m.name}</b><small>{BASE_COURSES[m.id].hazards.length} hazards · {BASE_COURSES[m.id].checkpoints.length} checkpoints</small></span></label>)}</fieldset>
        <RolePicker squadSize={1} value={role} onPick={() => undefined} busy={false} />
        <label className="os-switch"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /><span><b>Gentle timing</b><small>Longer warnings before hazards.</small></span></label>
        <div className="os-row"><button className="os-btn primary big" type="submit">Start practice</button><Link className="os-btn" href="/quiz/os">Back</Link></div>
      </form>
    </main>
  );
}
