'use client';
/** Offline practice and tutorial: pick a format and map, then play the real engine with scripted classmates and sample questions. No account, no database, no rewards. */
import { useState } from 'react';
import Link from 'next/link';
import ArenaGame from './ArenaGame';
import { useArenaLocal } from './useArena';
import { FormatIcon } from './icons';
import { FORMAT_COPY } from '@/lib/quiz/arena/balance';
import { FORMATS, MAP_IDS, type Format, type MapId } from '@/lib/quiz/arena/domain';
import { MAP_INFO } from '@/lib/quiz/arena/maps';

function Run({ format, mapId, low }: { format: Format; mapId: MapId; low: boolean }) { return <ArenaGame client={useArenaLocal({ format, mapId, role: 'runner', lowPressure: low })} practiceBack />; }
export default function ArenaPractice() {
  const [format, setFormat] = useState<Format>('control'); const [map, setMap] = useState<MapId>('meadow_mosaic'); const [low, setLow] = useState(false); const [go, setGo] = useState(false);
  if (go) return <Run format={format} mapId={map} low={low} />;
  return (
    <main className="ar narrow">
      <form className="ar-card" onSubmit={(e) => { e.preventDefault(); setGo(true); }}>
        <h1>Practice with bots</h1><p className="ar-note">Three short rounds against scripted classmates, with sample questions. You learn the controls, the quiz break and the planning board. Nothing is saved and nothing earns points.</p>
        <fieldset className="ar-pickset"><legend>FORMAT</legend>{FORMATS.map((f) => <label key={f} className="ar-pick"><input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} /><FormatIcon format={f} size={28} /><span><b>{FORMAT_COPY[f].name}</b><small>{FORMAT_COPY[f].blurb}</small></span></label>)}</fieldset>
        <fieldset className="ar-pickset"><legend>MAP</legend>{MAP_IDS.map((m) => <label key={m} className="ar-pick"><input type="radio" name="map" checked={map === m} onChange={() => setMap(m)} /><i className="ar-swatch" style={{ background: MAP_INFO[m].palette.ground, borderColor: MAP_INFO[m].palette.accent }} aria-hidden="true" /><span><b>{MAP_INFO[m].title}</b><small>{MAP_INFO[m].blurb}</small></span></label>)}</fieldset>
        <label className="ar-switch"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /><span><b>Gentle timing</b><small>More time for every question.</small></span></label>
        <div className="ar-row"><button className="ar-btn primary big" type="submit" data-testid="ar-practice-go">Start practice</button><Link className="ar-btn" href="/quiz/arena">Back</Link></div>
      </form>
    </main>
  );
}
