/** Context-sensitive, non-spoiler guidance for all ten games. It reads the PUBLIC game state (never an answer key, never hidden values)
 *  and tells the teacher the sensible next step and what to point out to the class. No performance profiling, no invented results. */
import type { Core, GameKey } from './types';
import type { EmpireG } from './reducers/empire';
import type { LadderG } from './reducers/ladder';
import type { VaultG } from './reducers/vault';
import type { AuctionG } from './reducers/auction';
import type { TerritoryG } from './reducers/territory';
import type { FactoryG } from './reducers/factory';
import type { PirateG } from './reducers/pirate';
import type { ShowdownG } from './reducers/showdown';
import { legalTargets } from './reducers/territory';
import { breakdownVictim, MACHINE_KINDS } from './reducers/factory';
import { isTrailing } from './reducers/showdown';

export type CoachNote = { heading: string; message: string; action: string };
const HINTS: Record<GameKey, { play: string; action: string; question: string }> = {
  empire_race: { play: 'Click a zone next to your land. Legal zones glow and each button shows its energy cost.', action: 'Claim, fortify, scout, bridge or challenge. Spend where a rival is touching you.', question: 'Let the team discuss, then mark the spoken answer.' },
  boss_battle: { play: 'Read the boss warning and each team’s role before anyone picks an action.', action: 'Strike, shield, repair or scan. Aim at the weak-point topic for bonus damage.', question: 'The verified mark decides how strong the action is.' },
  escape_room: { play: 'Click outlined objects and check the notebook for items you already hold.', action: 'Inspect a puzzle, use items on a lock, or spend a hint token if the class is stuck.', question: 'A verified answer opens a clue, a lock or a door. It never gives points.' },
  treasure_vault: { play: 'Compare your key shapes with each door’s lock before you commit.', action: 'Open an affordable door, or bank treasure to keep it safe from the checkpoint.', question: 'Each topic earns its own key shape after a verified mark.' },
  risk_ladder: { play: 'Compare the possible gain with what a fall would cost before choosing.', action: 'Climb, bank or review. Banked points can never be lost.', question: 'Higher steps ask harder questions.' },
  auction_house: { play: 'Appraisal ranges are guides, not prices. Bids stay sealed until the gavel.', action: 'Raise a paddle on one lot, pass, or end the turn. Losing bids come back.', question: 'A correct answer adds bidding points; a harder challenge question adds more.' },
  territory_war: { play: 'Objective squares are worth 4, but only while they stay connected to a headquarters.', action: 'Click a square to see its cost and result, then confirm.', question: 'Correct answers become war points for the map.' },
  lucky_factory: { play: 'The next three shift events are public. Plan around them.', action: 'Build, upgrade, repair or run a safety check, then end the turn to ship goods.', question: 'Correct answers become parts.' },
  pirate_voyage: { play: 'Dotted lines are routes. Storm clouds cost more now; dashed clouds are next round’s storms.', action: 'Preview a sail, chart a chest, post a guard or raid a ship on your island.', question: 'Correct answers become sailing points.' },
  final_showdown: { play: 'Pick a stance first. Nobody is eliminated, so a bold double is a real option.', action: 'Steady is free, Double costs 7, Shield costs 5 and cancels one setback.', question: 'The base score depends on the stage.' },
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function stateNote(core: Core, g: unknown, team: string): CoachNote | null {
  const phase = core.phase; const planning = phase === 'planning';
  switch (core.game) {
    case 'empire_race': { const e = g as EmpireG; const en = e.energy?.[team] ?? 0; if (planning && en < 2) return { heading: 'Low energy', message: `This team has ${plural(en, 'energy point')}. Claims cost more than that.`, action: 'End the turn to keep energy, or fortify if it is cheaper.' }; return null; }
    case 'risk_ladder': { const l = g as LadderG; const t = l.teams?.[team]; if (t && t.unbanked >= 6 && phase === 'choose') return { heading: 'Big unbanked pile', message: `${t.unbanked} points could be lost in a fall.`, action: 'Ask the class: bank now, or risk the next step?' }; return null; }
    case 'treasure_vault': { const v = (g as VaultG).teams?.[team]; if (v && v.held >= 10 && phase === 'choose') return { heading: 'Treasure in hand', message: `${v.held} held treasure is not yet safe.`, action: 'Consider banking before the next door.' }; return null; }
    case 'auction_house': {
      const a = g as AuctionG; const t = a.teams[team]; if (!t) return null;
      if (core.phase === 'choose') return { heading: `Round ${a.round}: ${a.lineup.length} lots`, message: 'Earn points now, then raise a sealed paddle. The gavel falls when every team has had its turn.', action: t.points < 3 ? 'Low on points: a challenge question pays more.' : 'Ask a standard or challenge question.' };
      if (planning) { const bid = a.bids[team]; if (bid) return { heading: 'Paddle is up', message: `${bid.amount > 0 ? bid.amount : 'A sealed amount'} is reserved on lot ${bid.lot}. It comes back if the bid loses.`, action: 'End the turn, or lower the paddle to change the bid.' }; return { heading: 'Choose a lot', message: `${t.points} points available. Appraisals are ranges, so bidding at the top of a range can overpay.`, action: 'Raise a paddle on a lot, or pass to save points.' }; }
      return null;
    }
    case 'territory_war': {
      const w = g as TerritoryG; const t = w.teams[team]; if (!t) return null;
      if (planning) { const legal = legalTargets(w, team); const n = Object.keys(legal).length; return { heading: n ? `${plural(n, 'legal move')}` : 'No legal move', message: n ? `${t.points} points to spend. Outlined squares can be acted on right now.` : 'Nothing is in reach with the points this team has.', action: n ? 'Click an outlined square to see the cost and result.' : 'End the turn to keep your points.' }; }
      return null;
    }
    case 'lucky_factory': {
      const f = g as FactoryG; const t = f.teams[team]; if (!t) return null; const ti = core.teams.findIndex((x) => x.id === team);
      if (planning) {
        const ev = f.events[0]; const victim = ev === 'breakdown' && !t.inspected ? breakdownVictim(t, ti, f.shift) : null; const kinds = new Set(t.machines.filter((m) => !m.broken).map((m) => m.kind)).size;
        if (victim !== null) return { heading: 'Breakdown due', message: `Machine ${victim + 1} will fail this shift unless a safety check is bought.`, action: 'A safety check costs 2 parts. Repairs later cost 3.' };
        if (t.machines.some((m) => m.broken)) return { heading: 'Broken machine', message: 'A broken machine ships nothing.', action: 'Repair it for 3 parts.' };
        if (kinds < MACHINE_KINDS.length && t.machines.length < f.slots) return { heading: 'Line bonus available', message: `Working kinds: ${kinds} of ${MACHINE_KINDS.length}. Three kinds give +10%, four give +25%.`, action: 'Build a kind you do not have yet.' };
        return { heading: ev === 'bonus' ? 'Bonus shift' : ev === 'shortage' ? 'Shortage shift' : 'Ready to ship', message: 'Goods ship only when the turn ends.', action: 'End the turn when the line is ready.' };
      }
      return null;
    }
    case 'pirate_voyage': {
      const p = g as PirateG; const t = p.teams[team]; if (!t) return null;
      if (planning) { if (t.cargo >= 8 && t.position !== 0) return { heading: 'Heavy cargo', message: `${t.cargo} cargo can be raided until it is banked at the home harbour.`, action: 'Post a guard, or sail home to bank it.' }; return { heading: 'Plan the route', message: `${t.points} points. Click an island to preview its cost and chest.`, action: 'Sail, chart a chest, post a guard, or end the turn.' }; }
      return null;
    }
    case 'final_showdown': {
      const s = g as ShowdownG; const t = s.teams[team]; if (!t) return null;
      if (core.phase === 'choose') { const trailing = isTrailing(s, team); return { heading: `${s.stage[0]!.toUpperCase()}${s.stage.slice(1)} stage`, message: trailing && s.stage === 'comeback' ? 'This team is trailing, so a correct answer earns a comeback bonus.' : `${t.points} points · ${plural(t.shields, 'shield')}.`, action: 'Choose Steady, Double or Shield before asking.' }; }
      return null;
    }
    default: return null;
  }
}

export function coaching(core: Core, g?: unknown): CoachNote {
  const spec = HINTS[core.game]; const phase = core.phase; const team = core.teams[core.actor % core.teams.length]!.id;
  if (phase === 'asking') return { heading: 'Answer in progress', message: spec.question, action: 'Teacher: mark each team’s spoken answer.' };
  if (phase === 'review' || phase === 'resolution') return { heading: 'Round review', message: 'Point out what changed on the screen and why, then continue.', action: 'Continue to the next turn.' };
  if (phase === 'finished') return { heading: 'Match results', message: 'Review the scoreboard and the topics the class should revisit.', action: 'Open the class report.' };
  const live = g ? stateNote(core, g, team) : null; if (live) return live;
  if (phase === 'planning') return { heading: 'Action phase', message: spec.action, action: 'Choose an action or end the turn.' };
  return { heading: 'Next step', message: spec.play, action: 'Ask the next question.' };
}
