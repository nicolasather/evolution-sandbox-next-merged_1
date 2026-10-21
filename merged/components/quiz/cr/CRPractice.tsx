'use client';
/** Offline practice and tutorial: pick a format, map and difficulty, then race the real engine as the Solo Pathfinder against scripted rivals with sample questions.
 *  No account, no database, no rewards. */
import MapPoster, { CR_THEME } from '@/components/quiz/art/MapPoster';
import { useState } from 'react';
import Link from 'next/link';
import CRGame from './CRGame';
import { useCRLocal } from './useCR';
import { FormatIcon } from './icons';
import { DIFFICULTY_COPY, FORMAT_COPY } from '@/lib/quiz/cr/balance';
import { FORMATS, MAP_IDS, type Format, type MapId } from '@/lib/quiz/cr/domain';
import { MAP_INFO } from '@/lib/quiz/cr/maps';

type Diff = 'easy' | 'normal' | 'challenge';
function Run({ format, mapId, low, difficulty }: { format: Format; mapId: MapId; low: boolean; difficulty: Diff }) { return <CRGame client={useCRLocal({ format, mapId, lowPressure: low, difficulty })} practiceBack />; }
export default function CRPractice() {
  const [format, setFormat] = useState<Format>('split_route'); const [map, setMap] = useState<MapId>('sunleaf_passage'); const [low, setLow] = useState(false); const [diff, setDiff] = useState<Diff>('easy'); const [go, setGo] = useState(false);
  if (go) return <Run format={format} mapId={map} low={low} difficulty={diff} />;
  return (
    <main className="cr narrow">
      <form className="cr-card" onSubmit={(e) => { e.preventDefault(); setGo(true); }}>
        <h1>Practice as a Solo Pathfinder</h1><p className="cr-note">A short race on the real course: three clue questions, a road or flag or stamp objective, and a route board with perks. Rivals are scripted. Nothing is saved and nothing earns points.</p>
        <fieldset className="cr-pickset"><legend>FORMAT</legend>{FORMATS.map((f) => <label key={f} className="cr-pick"><input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} /><FormatIcon format={f} size={28} /><span><b>{FORMAT_COPY[f].name}</b><small>{FORMAT_COPY[f].blurb}</small></span></label>)}</fieldset>
        <fieldset className="cr-pickset"><legend>MAP</legend>{MAP_IDS.map((m) => <label key={m} className="cr-pick"><input type="radio" name="map" checked={map === m} onChange={() => setMap(m)} /><MapPoster theme={CR_THEME[m] ?? 'orchard'} seed={MAP_IDS.indexOf(m) + 1} className="sm" /><span><b>{MAP_INFO[m].title}</b><small>{MAP_INFO[m].blurb}</small></span></label>)}</fieldset>
        <fieldset className="cr-pickset"><legend>DIFFICULTY</legend>{(['easy', 'normal', 'challenge'] as const).map((d) => <label key={d} className="cr-pick"><input type="radio" name="diff" checked={diff === d} onChange={() => setDiff(d)} /><span><b>{d[0]!.toUpperCase() + d.slice(1)}</b><small>{DIFFICULTY_COPY[d]}</small></span></label>)}</fieldset>
        <label className="cr-switch"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /><span><b>Gentle timing</b><small>More time for every question and every leg.</small></span></label>
        <div className="cr-row"><button className="cr-btn primary big" type="submit" data-testid="cr-practice-go">Start practice</button><Link className="cr-btn" href="/quiz/cr">Back</Link></div>
      </form>
    </main>
  );
}
