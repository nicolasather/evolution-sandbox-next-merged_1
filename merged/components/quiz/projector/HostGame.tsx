'use client';
import GameStage, { usePrefs } from './GameStage';
import RewardPanel from './RewardPanel';
import { useRemoteGame } from './useGame';

/** Teacher console for a projector-game room: scene + controls + marking. */
export function HostGame({ roomId }: { roomId: string }) {
  const [prefs, setPrefs] = usePrefs('en');
  const api = useRemoteGame(roomId, 'host', prefs.locale);
  const done = api.snap?.game.core.phase === 'finished';
  return (<>
    <GameStage api={api} view="host" prefs={prefs} setPrefs={setPrefs} projectorHref={`/quiz/projector/${roomId}`} backHref={`/quiz/report/${roomId}`} />
    {done && <div className="pj" style={{ marginTop: 0 }}><RewardPanel roomId={roomId} locale={prefs.locale} /></div>}
  </>);
}
/** Read-only classroom screen: no controls, no answer key. */
export function ProjectorGame({ roomId }: { roomId: string }) {
  const [prefs, setPrefs] = usePrefs('en');
  const api = useRemoteGame(roomId, 'projector', prefs.locale);
  return <GameStage api={api} view="projector" prefs={prefs} setPrefs={setPrefs} />;
}
