/** Evidence: the clue that reveals a leg's objective once the class has finished the question window before it. Generated once from the match seed; the answer fields
 *  (`postIdx`, `order`) live only in server state and are never part of any student projection. */
import type { EvidenceRec, Format, MapId } from './domain';
import { buildCourse, hash, legGeo, MAP_INFO, stationName, type Course } from './maps';

export function evidenceFor(seed: string, map: MapId, difficulty: 'easy' | 'normal' | 'challenge', format: Format, stations: readonly number[], leg: number): EvidenceRec {
  const course: Course = buildCourse(map, difficulty); const a = stations[leg]!, b = stations[leg + 1]!; const spurs = course.spurs[b]!;
  const h = hash(`${seed}:${map}:${format}:${leg}`);
  if (format === 'signal_relay') {
    const postIdx = h % 4; const sp = spurs[postIdx]!;
    return { leg, kind: format, text: `Carry the lantern flag past ${stationName(map, b)} to the relay post at the ${sp.name}.`, postIdx, revealedWindow: leg - 1 };
  }
  if (format === 'atlas_circuit') {
    const pool = [0, 1, 2, 3]; const order: number[] = [];
    let x = h; for (let i = 0; i < 3; i++) { const j = x % pool.length; x = Math.imul(x ^ (x >>> 7), 2654435761) >>> 0; order.push(pool.splice(j, 1)[0]!); }
    const names = order.map((i) => spurs[i]!.name);
    return { leg, kind: format, text: `At ${stationName(map, b)}, stamp the ${names[0]}, then the ${names[1]}, then the ${names[2]}.`, order, revealedWindow: leg - 1 };
  }
  const g = legGeo(course, a, b, leg); const short = g.options.find((o) => o.id === 'b')!, main = g.options.find((o) => o.id === 'a')!;
  const pct = Math.max(0, Math.round((1 - short.length / main.length) * 100)); const landmark = g.options.find((o) => o.id === 'c')!.landmark;
  const tips = [`The ${MAP_INFO[map].title} ranger says the Short Cut saves about ${pct}% of the walk${short.gates.length ? ', but watch its timed gate' : ''}.`,
    landmark ? `The Scenic Loop passes the ${landmark}. It is the longest road, and the safest.` : 'The Main Road is steady and signposted.',
    `${stationName(map, b)} is the next checkpoint. Every road reaches it; choose with your team.`];
  return { leg, kind: format, text: tips[h % tips.length]!, revealedWindow: leg - 1 };
}
export const buildEvidence = (seed: string, map: MapId, difficulty: 'easy' | 'normal' | 'challenge', format: Format, stations: readonly number[], legs: number) =>
  Array.from({ length: legs }, (_, k) => evidenceFor(seed, map, difficulty, format, stations, k));
/** Public form of an evidence entry (answer fields stripped). */
export const publicEvidence = (e: EvidenceRec) => ({ leg: e.leg, text: e.text });
