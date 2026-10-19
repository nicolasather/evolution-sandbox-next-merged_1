/** Projections of the authoritative state. The browser only ever receives these — never raw state. */
import type { GameState, Core, ProjectorConfig } from './types';
import type { Vault, VaultG } from './reducers/vault';
import type { EmpireG } from './reducers/empire';

export type View = 'projector' | 'host';
/** Same shape as Core so the UI can share types, but consumed ids / used positions are emptied and evidence is host-only. */
export type PublicCore = Core & { usedCount: number };
export type PublicState = { core: PublicCore; g: unknown };

/** Strip what must stay secret from the shared screen: unopened vault rewards, fogged tiles' contents, and per-answer evidence. */
export function publicView(state: GameState, view: View): PublicState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const core: PublicCore = { ...s.core, usedCount: s.core.usedPositions.length, consumed: [], usedPositions: [], log: s.core.log.slice(-60), evidence: view === 'host' ? s.core.evidence : [] };
  let g: unknown = s.g;
  if (s.core.game === 'treasure_vault') {
    const v = s.g as VaultG;
    v.vaults = v.vaults.map((x: Vault) => (x.opened ? x : { ...x, reward: 0 }));
    if (!v.grand.opened) v.grand = { ...v.grand, reward: 0 };
    g = v;
  } else if (s.core.game === 'empire_race') {
    const e = s.g as EmpireG;
    e.tiles = e.tiles.map((t) => (t.hidden && !t.owner ? { ...t, relic: 0, topic: null, review: false } : t));
    g = e;
  }
  return { core, g };
}
export type ClockView = { serverNow: string; deadlineAt: string | null; paused: boolean; pausedAt: string | null; startedAt: string | null; status: 'waiting' | 'active' | 'ended'; overtime: boolean; untimed: boolean };

export type ProjectorSnapshot = { revision: number; status: 'active' | 'finished'; game: PublicState; clock: ClockView; room: { id: string; code: string; status: 'waiting' | 'active' | 'ended'; paused: boolean; teams: { id: string; name: string; points: number }[] }; config: ProjectorConfig; question: unknown | null };
