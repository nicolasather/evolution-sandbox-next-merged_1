/* The one director. Turns factual events into performances for the unlocked crew, owns every cooldown and the single
   scheduler (autonomous bench turns, rare pranks, ambient life). Seeded randomness; never decides a game result. */
import { actionRegistry } from './actions';
import { IDLE_CONTEXT, readCrewContext, type CrewContext } from './bus';
import { getClip } from './clips';
import { getLine, MAX_WORDS, wordCount } from './dialogue';
import { getEvent } from './events';
import { clipAllowedIn } from './exclusive';
import { MODE_ACT, poolFor, responseFor } from './interactions';
import { modeOwnClips, payloadClip } from './modeEvents';
import { SpeechArbiter } from './speech';
import { DEFAULT_SETTINGS } from './store';
import {
  CHARACTER_IDS, PRIORITY_RANK, type CharacterActionId, type CharacterEvent, type CharacterId, type CharacterMode,
  type CharacterResponse, type CrewSettings, type EventSource, type Priority, type SpeechRequest,
} from './types';

export interface Performance {
  uid: number;
  eventId: string;
  characterId: CharacterId;
  /** For pair / trio clips: the cast in role order (lead first). Otherwise just the lead. */
  cast: CharacterId[];
  clipId: string;
  priority: Priority;
  delayMs: number;
  source: EventSource;
  mode: CharacterMode;
  actionId?: CharacterActionId;
  speech?: SpeechRequest;
  /** a second clip that follows (disappear → return) */
  followUp?: { clipId: string; delayMs: number };
  /** shown as a visible PRANK cue, never a real answer */
  prank?: boolean;
  /** where a travelling clip should head */
  hint?: 'toward-cursor' | 'away-cursor';
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PRANK_CLIPS = new Set(['prank-decoy-answer', 'prank-wrong-point']);
const SKITS: { event: string; clip: string; cast: CharacterId[] }[] = [
  { event: 'crew-compete', clip: 'fight-face-off', cast: ['kip', 'vex'] },
  { event: 'crew-disagree', clip: 'trio-pass-the-blame', cast: ['vex', 'kip', 'orra'] },
  { event: 'crew-steal-prop', clip: 'duet-both-grab-item', cast: ['vex', 'kip'] },
  { event: 'crew-help-fallen-peer', clip: 'duet-help-up', cast: ['vex', 'orra'] },
  { event: 'crew-copy-move', clip: 'duet-copycat', cast: ['kip', 'orra'] },
  { event: 'crew-accidental-collision', clip: 'fight-stumble-stack', cast: ['kip', 'vex'] },
  { event: 'crew-tug-of-war', clip: 'duet-tug-and-release', cast: ['kip', 'vex'] },
  { event: 'crew-group-celebrate', clip: 'fight-peacemaker-separate', cast: ['orra', 'kip', 'vex'] },
  { event: 'crew-arrive-together', clip: 'trio-group-dance', cast: ['kip', 'vex', 'orra'] },
  { event: 'crew-group-celebrate', clip: 'trio-sync-jump', cast: ['kip', 'vex', 'orra'] },
  { event: 'crew-group-celebrate', clip: 'trio-all-fall', cast: ['vex', 'kip', 'orra'] },
  { event: 'crew-disagree', clip: 'trio-see-saw', cast: ['kip', 'vex', 'orra'] },
  { event: 'crew-compete', clip: 'pal-chase', cast: ['kip', 'vex'] },
  { event: 'crew-compete', clip: 'pal-play-punch', cast: ['kip', 'vex'] },
  { event: 'crew-compete', clip: 'pal-brawl', cast: ['vex', 'kip'] },
  { event: 'crew-steal-prop', clip: 'pal-steal', cast: ['vex', 'kip'] },
  { event: 'crew-steal-prop', clip: 'pal-run-away', cast: ['vex', 'kip'] },
  { event: 'crew-help-fallen-peer', clip: 'pal-fall-after-hit', cast: ['kip', 'vex'] },
  { event: 'crew-help-fallen-peer', clip: 'pal-carry', cast: ['kip', 'vex'] },
  { event: 'crew-tug-of-war', clip: 'pal-throw', cast: ['kip', 'vex'] },
  { event: 'crew-copy-move', clip: 'pal-wave-at', cast: ['kip', 'orra'] },
  { event: 'crew-copy-move', clip: 'pal-greet', cast: ['orra', 'kip'] },
  { event: 'crew-accidental-collision', clip: 'pal-laugh-at', cast: ['vex', 'kip'] },
  { event: 'crew-copy-move', clip: 'pal-point-fingers', cast: ['vex', 'orra'] },
  { event: 'crew-group-celebrate', clip: 'cheer-high-five', cast: ['kip', 'vex'] },
  { event: 'crew-group-celebrate', clip: 'cheer-hug', cast: ['kip', 'orra'] },
  { event: 'crew-copy-move', clip: 'duet-mirror-moves', cast: ['kip', 'vex'] },
  { event: 'crew-copy-move', clip: 'duet-spin-partner', cast: ['vex', 'kip'] },
  { event: 'crew-accidental-collision', clip: 'pal-hide-behind', cast: ['vex', 'orra'] },
  { event: 'crew-copy-move', clip: 'pal-sneak-around', cast: ['vex', 'kip'] },
  { event: 'crew-copy-move', clip: 'pal-sleep-beside', cast: ['kip', 'orra'] },
];
/** What each creature does for fun when nobody is asking anything of it: a wide pool so they are constantly doing something different. */
export const PLAY: Record<CharacterId, string[]> = {
  kip: ['move-skip', 'move-hop', 'emote-dance-happy', 'emote-bounce-excited', 'silly-front-flip', 'jump-spin', 'silly-roll-across', 'silly-dizzy', 'item-toss-up', 'item-kick',
    'emote-laugh', 'silly-funny-faces', 'emote-thumbs-up', 'guide-wave-over', 'move-float', 'idle-curious-cock', 'silly-freeze-statue', 'emote-scratch-head', 'screen-wave-player',
    'adv-wobble', 'adv-elastic-bounce', 'silly-hit-head', 'move-sprint', 'silly-bounce-off-ground', 'object-spot', 'screen-follow-cursor', 'emote-smile', 'cheer-spin-burst',
    'idle-foot-tap', 'adv-squash-stretch', 'item-hug', 'move-slide', 'walk-waddle', 'emote-wake-up', 'silly-walk-into-wall', 'idle-look-left', 'idle-look-right'],
  vex: ['silly-dance-terribly', 'move-sprint', 'silly-backflip-fail', 'jump-backflip-comic', 'prank-fake-out', 'emote-roll-eyes', 'silly-funny-faces', 'adv-stagger', 'move-slide',
    'item-hide-behind-back', 'silly-fake-faint', 'adv-fake-death', 'silly-celebrate-early', 'emote-pout', 'walk-sneak', 'silly-spin-out-of-control', 'silly-stuck-upside-down',
    'silly-slip-fall', 'jump-sideflip', 'prank-innocent-whistle', 'screen-flee-cursor', 'screen-fall-off', 'silly-hit-head', 'emote-angry', 'jump-pogo', 'silly-front-flip',
    'item-kick', 'silly-shake-head', 'screen-follow-cursor', 'emote-laugh', 'adv-shake-uncontrollably', 'walk-zigzag', 'silly-roll-across', 'prank-trip-on-own-feet'],
  orra: ['move-float', 'adv-float-sleep', 'act-write', 'act-draw-diagram', 'act-inspect-map', 'act-read-clue', 'emote-smile', 'idle-tail-sway', 'silly-see-stars', 'adv-slowmo-celebrate',
    'act-examine-artifact', 'emote-thumbs-up', 'guide-think-pose', 'adv-dream-bubbles', 'silly-freeze-statue', 'adv-smooth-turn', 'emote-fall-asleep', 'idle-look-down', 'emote-scratch-head',
    'mode-record-discovery', 'item-toss-up', 'screen-wave-player', 'emote-blush', 'silly-dizzy', 'idle-listen', 'adv-wobble', 'item-present', 'object-polish', 'emote-roll-eyes'],
};

export interface DirectorOpts {
  now?: () => number;
  random?: () => number;
  seed?: number;
  speech?: SpeechArbiter;
  context?: () => CrewContext;
  hasAction?: (mode: CharacterMode, id: CharacterActionId) => boolean;
  /** OS prefers-reduced-motion or the player override: ambient life stops entirely. */
  reducedMotion?: () => boolean;
}

export class CrewDirector {
  readonly speech: SpeechArbiter;
  private now: () => number;
  private random: () => number;
  private ctx: () => CrewContext;
  private hasAction: (mode: CharacterMode, id: CharacterActionId) => boolean;
  private reduced: () => boolean;

  settings: CrewSettings = { ...DEFAULT_SETTINGS, perCharacter: { ...DEFAULT_SETTINGS.perCharacter } };
  disclosureSeen = false;
  unlocked = new Set<CharacterId>(['kip']);
  mode: CharacterMode = 'main-evolution';

  private uid = 0;
  private lastEvent = new Map<string, number>();
  private lastPlayed = new Map<string, number>();
  private history = new Map<CharacterId, string[]>();
  private playingUntil: Partial<Record<CharacterId, number>> = {};
  private lastPerformAt = -Infinity;
  private lastInputAt: number;
  private lastMajorAt = -Infinity;
  private queue: Performance[] = [];

  private nextMergeAt: number;
  private nextPrankAt: number;
  private nextAmbientAt: number;
  private nextSkitAt: number;
  private nextVanishAt: number;
  private mergeNeedIdle: number;
  mergeAttempts = 0;
  static readonly MAX_MERGES_PER_SESSION = 4;

  constructor(o: DirectorOpts = {}) {
    this.now = o.now ?? (() => Date.now());
    this.random = o.random ?? (o.seed !== undefined ? mulberry32(o.seed) : Math.random);
    this.ctx = o.context ?? readCrewContext;
    this.hasAction = o.hasAction ?? ((m, id) => actionRegistry.has(m, id));
    this.reduced = o.reducedMotion ?? (() => false);
    this.speech = o.speech ?? new SpeechArbiter(this.now, this.random);
    const t = this.now();
    this.lastInputAt = t;
    this.nextMergeAt = t + this.mergeInterval();
    this.nextPrankAt = t + this.between(90_000, 150_000);
    this.nextAmbientAt = t + this.between(2_500, 6_000);
    this.nextSkitAt = t + this.between(10_000, 22_000);
    this.nextVanishAt = t + this.between(50_000, 100_000);
    this.mergeNeedIdle = this.between(8000, 12_000);
  }

  private between(a: number, b: number) { return a + this.random() * (b - a); }
  /** 24–42 s, mean 33 s. */
  mergeInterval() { return this.between(24_000, 42_000); }

  /* ── configuration ─────────────────────────────────────────────── */
  setSettings(s: CrewSettings) { this.settings = s; }
  setRoster(ids: Iterable<CharacterId>) { this.unlocked = new Set(ids); }
  setMode(m: CharacterMode) { this.mode = m; this.queue = []; this.speech.clear(); this.nextMergeAt = Math.max(this.nextMergeAt, this.now() + 8000); }
  noteInput() { this.lastInputAt = this.now(); }
  idleFor() { return this.now() - this.lastInputAt; }

  active(): CharacterId[] {
    if (!this.settings.enabled) return [];
    return CHARACTER_IDS.filter(c => this.unlocked.has(c) && this.settings.perCharacter[c]);
  }

  /** Free to move about and play. A mode's guide being up does NOT stop the crew playing (they sit out of the way and say nothing then). */
  safe(c: CrewContext = this.ctx()): boolean {
    return !(c.hidden || c.dragging || c.typing || c.modalOpen || c.gateOpen || c.busy);
  }

  /** Calm enough to do something that touches the game or asks for attention: a bench turn, a prank, a note. Never while a guide is teaching. */
  calm(c: CrewContext = this.ctx()): boolean {
    return this.safe(c) && !c.guideActive;
  }

  /** A creature currently mid-performance (ambient / normal events leave it alone). */
  isBusy(id: CharacterId) { return (this.playingUntil[id] ?? 0) > this.now(); }
  markPlaying(id: CharacterId, ms: number) { this.playingUntil[id] = this.now() + ms; }
  clearPlaying(id?: CharacterId) { if (id) delete this.playingUntil[id]; else this.playingUntil = {}; }

  /* ── event → performances ──────────────────────────────────────── */

  handle(ev: CharacterEvent): Performance[] {
    const spec = getEvent(ev.id);
    if (!spec) return [];
    const roster = this.active();
    if (!roster.length) return [];
    const t = this.now();
    const key = ev.id;
    if (t - (this.lastEvent.get(key) ?? -Infinity) < 350) return [];
    this.lastEvent.set(key, t);
    const ctx = this.ctx();
    const rank = PRIORITY_RANK[spec.priority];
    const explicit = ev.id.startsWith('character-');

    const handsOn = spec.tone === 'pickup' || spec.tone === 'work' || spec.tone === 'hover';
    const blocked = ctx.hidden || ctx.modalOpen || ctx.gateOpen || ctx.busy;
    if (rank === 0 && !explicit) {
      // ambient: only when nothing is going on (a hand on an item may be watched), only sometimes, and never in a burst
      if (blocked || this.reduced() || ((ctx.dragging || ctx.typing) && !(handsOn && !ctx.typing))) return [];
      if (t - this.lastPerformAt < 2500 || this.random() < 0.42) return [];
    }
    if (rank <= 1 && !explicit && (ctx.typing || (ctx.dragging && !handsOn))) return [];

    const cands: CharacterResponse[] = [];
    const only = explicit && typeof ev.payload?.characterId === 'string' ? ev.payload.characterId : null;
    for (const c of roster) {
      if (only && c !== only) continue;
      const r = responseFor(ev.id, c);
      if (!r) continue;
      if (rank < 2 && this.isBusy(c)) continue;
      if (t - (this.lastPlayed.get(`${ev.id}|${c}`) ?? -Infinity) < (explicit ? 600 : r.cooldownMs)) continue;
      cands.push(r);
    }
    if (!cands.length) return [];

    const lead = this.pick(cands);
    const picks: CharacterResponse[] = [lead];
    if (rank >= 2) {
      const others = shuffle(cands.filter(c => c !== lead), this.random);
      const extra = spec.priority === 'critical' ? 0 : this.random() < 0.8 ? others.length : 1;
      picks.push(...others.slice(0, extra));
    }

    const out: Performance[] = [];
    picks.forEach((r, i) => {
      const p = this.build(r, ev, roster, i, i === 0);
      if (p) out.push(p);
    });
    if (out.length) {
      this.lastPerformAt = t;
      if (rank >= 2) this.lastMajorAt = t;
      for (const p of out) {
        this.lastPlayed.set(`${ev.id}|${p.characterId}`, t);
        this.remember(p.characterId, p.clipId);
      }
    }
    return out;
  }

  private pick(cands: CharacterResponse[]): CharacterResponse {
    const scored = cands.map(c => ({ c, w: Math.max(0.05, c.weight * (this.recentPenalty(c.characterId))) }));
    let r = this.random() * scored.reduce((s, x) => s + x.w, 0);
    for (const x of scored) { r -= x.w; if (r <= 0) return x.c; }
    return scored[scored.length - 1].c;
  }
  private recentPenalty(id: CharacterId) { const h = this.history.get(id); return h && h.length > 4 ? 0.7 : 1; }
  private remember(id: CharacterId, clip: string) {
    const h = this.history.get(id) ?? [];
    h.push(clip); while (h.length > 6) h.shift(); this.history.set(id, h);
  }

  private build(r: CharacterResponse, ev: CharacterEvent, roster: CharacterId[], index: number, speaker: boolean): Performance | null {
    const spec = getEvent(r.eventId)!;
    const t = this.now();
    let clipId = r.clipId;
    let actionId = r.actionId;
    let prank = false;
    const h = this.history.get(r.characterId) ?? [];

    // never repeat a clip played in the last several reactions: reach for a sibling in the same acting pool
    if (h.includes(clipId)) {
      const pool = poolFor(spec.tone, r.characterId);
      const fresh = pool.filter(c => !h.includes(c));
      const other = pool.filter(c => c !== h[h.length - 1]);
      const alt = fresh.length ? fresh : other;
      if (alt.length) clipId = alt[Math.floor(this.random() * alt.length)];
    }

    // a clip that follows what the player actually did (which task, which command, which field)
    const byPayload = payloadClip(ev.id, ev.payload);
    if (byPayload && clipAllowedIn(byPayload, ev.mode)) clipId = byPayload;
    if (!clipAllowedIn(clipId, ev.mode)) {
      const fit = poolFor(spec.tone, r.characterId).filter(c => clipAllowedIn(c, ev.mode) && getClip(c));
      clipId = fit.length ? fit[Math.floor(this.random() * fit.length)] : 'emotion-curious';
    }

    // pranks: gated by their own toggles, cooldown and the player's activity
    if (PRANK_CLIPS.has(clipId)) {
      const ok = this.settings.answerPranks && (ev.id.includes('question') || ev.id.includes('hint'));
      if (!ok) clipId = 'emotion-scheming'; else prank = true;
    }
    if (actionId === 'bench.returnItemHome') {
      if (!this.prankAllowed(ev.mode)) { actionId = undefined; clipId = 'emotion-scheming'; } else this.nextPrankAt = t + this.between(90_000, 150_000);
    }
    if (actionId === 'bench.tryRandomMerge') actionId = undefined; // only the scheduler may start a bench turn
    if (actionId && !this.hasAction(ev.mode, actionId) && actionId !== 'visual.returnOwnedItemProxy') actionId = undefined;

    // pair / trio clips need enough creatures on stage; otherwise fall back to a solo clip of the same tone
    let cast: CharacterId[] = [r.characterId];
    const clip = getClip(clipId);
    if (!clip) return null;
    if (clip.cast > 1) {
      const partners = roster.filter(c => c !== r.characterId).slice(0, clip.cast - 1);
      if (partners.length < clip.cast - 1) {
        const solo = poolFor(spec.tone, r.characterId).filter(c => (getClip(c)?.cast ?? 2) === 1);
        clipId = solo.length ? solo[Math.floor(this.random() * solo.length)] : 'emotion-curious';
      } else cast = [r.characterId, ...partners];
    }

    const uid = ++this.uid;
    let speech: SpeechRequest | undefined;
    if (speaker && r.maySpeak && r.dialogueLineId) speech = this.makeSpeech(r, spec.priority, ev.source) ?? undefined;

    return {
      uid, eventId: ev.id, characterId: r.characterId, cast, clipId, priority: r.priority, delayMs: index * (260 + Math.floor(this.random() * 340)),
      source: ev.source, mode: ev.mode, actionId, speech, prank: prank || undefined,
    };
  }

  private makeSpeech(r: CharacterResponse, prio: Priority, source: EventSource): SpeechRequest | null {
    if (!this.settings.dialogue || this.ctx().guideActive) return null;
    const line = r.dialogueLineId ? getLine(r.dialogueLineId) : undefined;
    if (!line || wordCount(line.text) > MAX_WORDS) return null;
    const chance = prio === 'critical' ? 1 : prio === 'major' ? 0.7 : source === 'ui' ? 0.9 : 0.35;
    if (this.random() > chance) return null;
    return { speakerId: line.speakerId, lineId: line.id, text: line.text, priority: prio, expiresAt: this.now() + (prio === 'ambient' ? 2500 : 5000), voiceCueId: line.voiceCueId };
  }

  prankAllowed(mode: CharacterMode): boolean {
    const t = this.now();
    return this.settings.objectPranks && this.active().includes('vex') && t >= this.nextPrankAt - 1 && this.calm()
      && this.idleFor() >= 6000 && this.hasAction(mode, 'bench.returnItemHome') && !this.isBusy('kip') && !this.isBusy('orra');
  }

  /* ── the single scheduler ──────────────────────────────────────── */

  /** Call from ONE timer. Returns performances the scheduler decided on (usually none). */
  tick(): Performance[] {
    this.speech.tick();
    const t = this.now();
    const roster = this.active();
    if (!roster.length) return [];
    const ctx = this.ctx();
    if (ctx.hidden) return [];
    const out: Performance[] = [];

    // 1) a real, opt-in autonomous bench turn
    if (t >= this.nextMergeAt) {
      if (this.mergeEligible(ctx)) {
        if (this.idleFor() >= this.mergeNeedIdle) {
          const who = roster.includes('kip') && this.random() < 0.65 ? 'kip' : roster[Math.floor(this.random() * roster.length)];
          const clip = who === 'kip' ? 'object-approach' : who === 'vex' ? 'walk-sneak' : 'walk-heavy';
          out.push(this.sched(who, clip, 'bench-empty-idle', 'normal', 'bench.tryRandomMerge'));
          this.mergeAttempts++;
          this.nextMergeAt = t + this.mergeInterval();
          this.mergeNeedIdle = this.between(8000, 12_000);
          this.lastPerformAt = t;
          return out; // one thing at a time
        }
        this.nextMergeAt = t + 2000; // eligible but the player is still active: look again shortly, silently
      } else this.nextMergeAt = t + this.mergeInterval(); // skipped without any visible nagging
    }

    if (!this.safe(ctx) || this.reduced() || this.queue.length) return out;

    // 2) a rare, reversible prank on the bench
    if (t >= this.nextPrankAt) {
      if (this.prankAllowed(this.mode)) {
        out.push(this.sched('vex', 'prank-return-to-backpack', 'bench-item-hover', 'ambient', 'bench.returnItemHome'));
        this.nextPrankAt = t + this.between(90_000, 150_000);
        this.lastPerformAt = t;
        return out;
      }
      this.nextPrankAt = t + this.between(30_000, 60_000);
    }

    if (!this.settings.ambientSkits || t - this.lastMajorAt < 6_000) return out;

    // 3) a short skit between two or three of them
    if (t >= this.nextSkitAt && roster.length >= 2 && this.idleFor() >= 3_000) {
      const pool = SKITS.filter(s => s.cast.every(c => roster.includes(c)));
      this.nextSkitAt = t + this.between(16_000, 36_000);
      if (pool.length) {
        const s = pool[Math.floor(this.random() * pool.length)];
        const p = this.sched(s.cast[0], s.clip, s.event, 'ambient');
        p.cast = [...s.cast];
        out.push(p); this.lastPerformAt = t;
        return out;
      }
    }

    // 4) a disappearance and a return carrying something already earned
    if (t >= this.nextVanishAt) {
      this.nextVanishAt = t + this.between(60_000, 120_000);
      const who = roster[Math.floor(this.random() * roster.length)];
      const p = this.sched(who, 'prank-portal-dive', 'app-return-focus', 'ambient');
      p.followUp = { clipId: this.random() < 0.5 ? 'prank-return-with-sticker' : 'prank-return-with-owned-item', delayMs: 4000 + Math.floor(this.random() * 3000) };
      out.push(p); this.lastPerformAt = t;
      return out;
    }

    // 5) constant play: somebody is always doing something, a few seconds apart, never the same thing twice in a row
    if (t >= this.nextAmbientAt) {
      this.nextAmbientAt = t + this.between(4_500, 9_500);
      const free = roster.filter(c => !this.isBusy(c));
      if (free.length) {
        const who = free[Math.floor(this.random() * free.length)];
        const recent = this.history.get(who) ?? [];
        const own = modeOwnClips(this.mode);
        // in a mode, most of the play is that mode's own work (digging in a dig, counting glyphs at a tablet)
        const all = [...PLAY[who], ...own, ...own, ...(MODE_ACT[this.mode]?.[who] ?? [])].filter(c => clipAllowedIn(c, this.mode));
        const fresh = all.filter(c => !recent.includes(c));
        const list = fresh.length ? fresh : all;
        const clip = list[Math.floor(this.random() * list.length)];
        const p = this.sched(who, clip, 'bench-empty-idle', 'ambient');
        if (clip === 'screen-follow-cursor') p.hint = 'toward-cursor';
        if (clip === 'screen-flee-cursor') p.hint = 'away-cursor';
        if (clip === 'screen-fall-off') p.followUp = { clipId: 'screen-climb-back', delayMs: 2600 + Math.floor(this.random() * 2800) };
        this.remember(who, clip);
        out.push(p);
        this.lastPerformAt = t;
      }
    }
    return out;
  }

  mergeEligible(ctx: CrewContext = this.ctx()): boolean {
    return this.settings.autonomousTurns && this.disclosureSeen && this.mergeAttempts < CrewDirector.MAX_MERGES_PER_SESSION
      && this.calm(ctx) && !this.reduced() && this.hasAction(this.mode, 'bench.tryRandomMerge');
  }

  private sched(who: CharacterId, clipId: string, eventId: string, priority: Priority, actionId?: CharacterActionId): Performance {
    return { uid: ++this.uid, eventId, characterId: who, cast: [who], clipId, priority, delayMs: 0, source: 'scheduler', mode: this.mode, actionId };
  }
}

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export { IDLE_CONTEXT };
