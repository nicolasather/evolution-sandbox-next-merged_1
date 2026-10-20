/** A mini-poster of the mode: one real map (the same picture the match uses), two towers standing on real pads, and a few enemies walking the real lane.
 *  Used on the quiz library card, the modes page, the hub and the join page. Pure markup (no client code), animated only by CSS and only when motion is allowed. */
import { lanePoint, MAPS, padCenter } from '@/lib/quiz/td/maps';
import type { TDEnemyKind, TDMapId, TDTowerKind } from '@/lib/quiz/td/domain';

const CAST: Record<TDMapId, { towers: [string, TDTowerKind, 1 | 2 | 3][]; enemies: [number, TDEnemyKind][] }> = {
  meadow_circuit: { towers: [['m06', 'bolt', 2], ['m11', 'thorn', 1], ['m14', 'frost', 3]], enemies: [[0.1, 'drifter'], [0.26, 'zipper'], [0.52, 'bulwark']] },
  coral_quarry: { towers: [['q06', 'ember', 2], ['q09', 'arc', 1], ['q12', 'beacon', 2]], enemies: [[0.12, 'splitter'], [0.3, 'drifter'], [0.58, 'sapper']] },
  skyworks: { towers: [['s04', 'frost', 2], ['s09', 'bolt', 1], ['s13', 'arc', 3]], enemies: [[0.14, 'skimmer'], [0.32, 'warden'], [0.6, 'zipper']] },
};

export default function Poster({ mapId = 'meadow_circuit', ribbon, alt }: { mapId?: TDMapId; ribbon?: string; alt?: string }) {
  const map = MAPS[mapId]; const cast = CAST[mapId];
  const pct = (x: number, y: number) => ({ left: `${(x / 1000 / 20) * 100}%`, top: `${(y / 1000 / 12) * 100}%` });
  return (
    <div className="td-poster">
      {/* eslint-disable-next-line @next/next/no-img-element -- static original SVG */}
      <img className="board" src={`/quiz/td/map_${mapId}_board.svg`} alt={alt ?? `${map.title}: a lane winds from a gate to a fort, with square pads beside it for towers`} width={1280} height={768} />
      {cast.towers.map(([pad, kind, lv], i) => { const p = map.pads.find((x) => x.id === pad); if (!p) return null; const [x, y] = padCenter(p);
        // eslint-disable-next-line @next/next/no-img-element -- static original SVG
        return <img key={pad} className="cast bob" aria-hidden="true" alt="" src={`/quiz/td/tower_${kind}_l${lv}${i === 0 ? '_fire' : ''}.svg`} style={{ ...pct(x, y - 380), width: '7%', transform: 'translate(-50%, -50%)', animationDelay: `${i * 0.5}s` }} />; })}
      {cast.enemies.map(([f, kind], i) => { const [x, y] = lanePoint(mapId, f);
        // eslint-disable-next-line @next/next/no-img-element -- static original SVG
        return <img key={kind} className="cast walk" aria-hidden="true" alt="" src={`/quiz/td/enemy_${kind}_${i === 1 ? 'move' : 'idle'}.svg`} style={{ ...pct(x, y - 250), width: '4.6%', marginLeft: '-2.3%', animationDelay: `${i * 0.7}s` }} />; })}
      {ribbon && <span className="ribbon">{ribbon}</span>}
    </div>
  );
}
