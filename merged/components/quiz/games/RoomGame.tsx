'use client';
import { useMemo } from 'react';
import { isActionMode, progress, replay, summary, type ActionMode, type Result } from '@/lib/quiz/games/engine';
import { defaultGameOptions } from '@/lib/quiz/settings';
import GameStage from './GameStage';

type RoomLike = { config: { gameMode?: string; gameOptions?: { lives: number; pace: 'relaxed' | 'normal' | 'fast'; trackLength: number }; seed?: string }; gameLogs?: Record<string, Result[]> | null; questionCount: number };

export const roomActionMode = (s: RoomLike): ActionMode | null => (s.config.gameMode && isActionMode(s.config.gameMode as never) ? (s.config.gameMode as ActionMode) : null);

/** One runner's scene, rebuilt from the graded results the server stored. The server stays the only grader; this only draws. */
export function RoomStage({ room, actorId, title }: { room: RoomLike; actorId: string | null; title?: string }) {
  const mode = roomActionMode(room);
  const log = actorId ? room.gameLogs?.[actorId] : undefined;
  const state = useMemo(() => (mode ? replay({ mode, options: { ...defaultGameOptions(), ...room.config.gameOptions }, seed: `${room.config.seed ?? 'seed'}:${actorId ?? ''}`, totalQuestions: room.questionCount }, log ?? []) : null), [mode, room.config.gameOptions, room.config.seed, room.questionCount, actorId, log]);
  if (!state) return null;
  return <GameStage state={state} totalQuestions={room.questionCount} title={title} />;
}

/** Host race board: every player or team side by side with live progress. */
export function RaceBoard({ room, actors }: { room: RoomLike; actors: { id: string; name: string }[] }) {
  const mode = roomActionMode(room);
  const rows = useMemo(() => (mode ? actors.map((a) => {
    const st = replay({ mode, options: { ...defaultGameOptions(), ...room.config.gameOptions }, seed: `${room.config.seed ?? 'seed'}:${a.id}`, totalQuestions: room.questionCount }, room.gameLogs?.[a.id] ?? []);
    const done = room.gameLogs?.[a.id]?.length ?? 0;
    return { ...a, rank: progress(st), pct: Math.min(100, Math.round((done / Math.max(1, room.questionCount)) * 100)), text: summary(st), outcome: st.outcome };
  }).sort((x, y) => y.rank - x.rank) : []), [mode, actors, room.config.gameOptions, room.config.seed, room.questionCount, room.gameLogs]);
  if (!mode || !rows.length) return null;
  return (
    <section className="panel stack" aria-label="Race board">
      <h3 style={{ margin: 0 }}>Live board</h3>
      <ol className="cr-race">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="row spread"><strong>{r.name}</strong><span className="note">{r.text}{r.outcome !== 'playing' ? ` · ${r.outcome === 'won' ? 'finished' : 'out'}` : ''}</span></div>
            <div className="cr-bar" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} progress`}><span style={{ width: `${r.pct}%` }} /></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
