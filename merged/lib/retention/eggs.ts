/* ============================================================================
   EASTER EGGS (#14) — fifty small secrets, each with a REAL trigger.

   A secret is found by doing something the game can actually observe: a gesture on the bench, a pause in a scene, a
   pattern in what you open. Nothing is guessed from a catalogue; a detector either saw it happen or it did not.
   Every egg pays once (store.foundEgg + a keyed award) and plays one tiny engraved vignette (glyph + motion + a
   margin note). Eggs are opt-out (prefs.eggs) and never touch the Engine, recipes or ids.

   The engine below is pure: it is fed bus events, pointer samples, delegated DOM events and a bench probe, and it
   calls `env.fire(id)` — the watcher decides whether the egg may play (preference, arbiter, reduced motion).
   ========================================================================== */
import type { Engine } from '../engine';
import { materialOf } from '../craft/materials';
import { G, type GlyphId } from './glyphs';
import { eraIndex } from './catalog';
import { regionsFor, pointInPoly, toScene, type Region } from '../scenefx/regions';
import { retention } from './store';
import { NPC_BY_ID } from './npc';
import type { RetentionEvent } from './bus';
import type { BenchProbe } from './probe';

export type EggAnim = 'blink' | 'nod' | 'swap' | 'spin' | 'bow' | 'crawl' | 'fade' | 'rise' | 'pulse' | 'stamp' | 'peek' | 'unwind' | 'wobble' | 'pop' | 'twinkle';
export type EggPlace = 'pointer' | 'bench' | 'sky' | 'corner' | 'center';

export interface EggDef {
  id: string; area: string; hint: string; glyph: GlyphId; anim: EggAnim; at: EggPlace; note: string;
}

const E = (id: string, area: string, hint: string, glyph: GlyphId, anim: EggAnim, at: EggPlace, note: string): EggDef => ({ id, area, hint, glyph, anim, at, note });

export const EGGS: readonly EggDef[] = [
  E('e01', 'bench', 'Tap the old knot in the bench, lower left of the middle, three times.', 'eye', 'blink', 'pointer', 'The grain blinks back.'),
  E('e02', 'bench', 'Leave a stone beside a piece of wood for a while without crafting.', 'owl', 'swap', 'bench', 'Two shadows trade places.'),
  E('e03', 'bench', 'Turn one piece slowly through a full circle.', 'spiral', 'unwind', 'pointer', 'A small spiral is cut into the air.'),
  E('e04', 'bench', 'Send three pieces home to the inventory in quick succession.', 'crown', 'bow', 'bench', 'The bench gives a tiny bow.'),
  E('e05', 'bench', 'Hold a wooden piece perfectly still for a few seconds.', 'beetle', 'crawl', 'pointer', 'A beetle scuttles out from under it.'),
  E('e06', 'bench', 'Lay three pieces down so they sit at the corners of a triangle.', 'star', 'fade', 'bench', 'The triangle glows, then fades.'),
  E('e07', 'bench', 'Drag a piece to the far left edge, then bring it back.', 'paw', 'peek', 'pointer', 'A small echo of it peeks out.'),
  E('e08', 'bench', 'Open the exhibits of three different stone pieces in one visit.', 'filings', 'twinkle', 'center', 'A shimmer crosses the grain.'),
  E('e09', 'bench', 'Tap one idle piece four times in an even rhythm.', 'note', 'pulse', 'pointer', 'The bench taps a reply.'),
  E('e10', 'bench', 'Set a vessel down somewhere quiet and leave it for a while.', 'bubble', 'rise', 'pointer', 'One musical bubble rises.'),
  E('e11', 'scenery', 'Tap the sky twice, in the same spot.', 'blot', 'wobble', 'sky', 'A far cloud makes a curious shape.'),
  E('e12', 'scenery', 'Watch a scene with water in it, still, for a long breath.', 'fish', 'crawl', 'center', 'A fish shadow passes beneath.'),
  E('e13', 'scenery', 'Tap the largest patch of grass twice.', 'moth', 'rise', 'pointer', 'A moth lifts out of the grass.'),
  E('e14', 'scenery', 'Tap the grass, then the water, within a few seconds.', 'star', 'twinkle', 'pointer', 'A third light joins the other two.'),
  E('e15', 'scenery', 'Sit quietly at the fire camp.', 'frost', 'unwind', 'center', 'A tiny frost spiral forms.'),
  E('e16', 'scenery', 'Move the pointer slowly in a wide loop, like tracing a sunbeam.', 'tumbleweed', 'fade', 'pointer', 'Dust motes follow the loop.'),
  E('e17', 'scenery', 'On a real night (local time), tap the very top of the screen once.', 'moon', 'twinkle', 'sky', 'A constellation glimmers.'),
  E('e18', 'scenery', 'Rest the pointer on the water for several seconds.', 'rainbow', 'pop', 'pointer', 'A rainbow glints off the water.'),
  E('e19', 'scenery', 'Once cities have risen, tap the far-left cliff edge three times.', 'hand', 'unwind', 'pointer', 'An old painted hand appears on the rock.'),
  E('e20', 'scenery', 'Rest the pointer in the bottom-right corner of the screen.', 'owl', 'peek', 'corner', 'Something small peeks out.'),
  E('e21', 'museum', 'Open the exhibits of three different tools or machines.', 'tools', 'stamp', 'center', 'A maker’s mark is revealed.'),
  E('e22', 'museum', 'Open and close the same exhibit twice.', 'hat', 'nod', 'center', 'The curator nods.'),
  E('e23', 'museum', 'Open three exhibits in a row from the same field.', 'wheel', 'fade', 'center', 'A constellation of connections draws itself.'),
  E('e24', 'museum', 'Rest the pointer on an exhibit’s date line.', 'clock', 'pulse', 'pointer', 'A tiny clock pulses.'),
  E('e25', 'museum', 'Stay with the evidence of three different discoveries in one visit.', 'book', 'bow', 'center', 'The archivist nods.'),
  E('e26', 'archive', 'Try three different filters in the Archive.', 'leaf', 'rise', 'pointer', 'A tiny leaf unfolds.'),
  E('e27', 'archive', 'Press T, A, G, W in that order, quickly: tour the views backwards.', 'scroll', 'unwind', 'center', 'The route line winds backwards.'),
  E('e28', 'archive', 'Open the exhibit of something from a much earlier age than yours.', 'hourglass', 'pulse', 'center', 'Old and new shimmer together.'),
  E('e29', 'archive', 'Reach a long unbroken line of discoveries behind you (forty steps).', 'needle', 'unwind', 'center', 'The thread spool unwinds.'),
  E('e30', 'archive', 'Search by a word that is only a tag of something you hold.', 'book', 'blink', 'pointer', 'A little book flips its pages.'),
  E('e31', 'narrator', 'Click the narrator’s portrait three times, slowly.', 'eye', 'blink', 'pointer', 'The portrait winks.'),
  E('e32', 'narrator', 'Double-click the narrator’s portrait.', 'hat', 'bow', 'pointer', 'A respectful salute.'),
  E('e33', 'narrator', 'Make a new discovery after a long quiet spell (three minutes).', 'bird', 'pop', 'center', 'The companion applauds, silently.'),
  E('e34', 'narrator', 'Come back to a saved game and reach a new era.', 'key', 'wobble', 'center', 'A brief welcome gesture.'),
  E('e35', 'narrator', 'Ask for a hint after several failed attempts.', 'lens', 'peek', 'center', 'The companion peers through a lens.'),
  E('e36', 'npc', 'Meet the same visitor a second time.', 'tablet', 'nod', 'center', 'They remember you.'),
  E('e37', 'npc', 'Finish the task of a historical figure.', 'scroll', 'pop', 'center', 'They approve.'),
  E('e38', 'npc', 'Finish a visitor’s task with a tool or machine.', 'tools', 'swap', 'center', 'A tiny trade flourish.'),
  E('e39', 'npc', 'Tap a visitor’s portrait three times without opening the dialogue.', 'kettle', 'peek', 'pointer', 'A prop reveals a decorative detail.'),
  E('e40', 'npc', 'Finish your first visitor task.', 'plane', 'bow', 'center', 'A unique short farewell.'),
  E('e41', 'physics', 'Spin an earthen piece twice, then let it stop.', 'pot', 'spin', 'pointer', 'A swirl in the clay slip.'),
  E('e42', 'physics', 'Toss a stone and let it land.', 'clay', 'wobble', 'pointer', 'A small wobble-circle.'),
  E('e43', 'physics', 'Brush one piece three times in short strokes.', 'filings', 'twinkle', 'pointer', 'A subtle sparkle from the grain.'),
  E('e44', 'physics', 'Hold a glass piece near a flame or an energy source.', 'lens', 'fade', 'pointer', 'A prismatic dot appears.'),
  E('e45', 'physics', 'Bring a wooden piece close to a liquid without touching.', 'duck', 'wobble', 'pointer', 'Its reflection bends.'),
  E('e46', 'menu', 'Open the Collection drawer and close it without choosing anything.', 'pin', 'blink', 'corner', 'The icon winks.'),
  E('e47', 'menu', 'Preview several themes, then go back to the default.', 'sprout', 'nod', 'corner', 'A tiny thank-you nod.'),
  E('e48', 'timeline', 'Move slowly across three era markers in the Timeline.', 'star', 'twinkle', 'pointer', 'A timeline star appears.'),
  E('e49', 'sharing', 'Preview the share card for your very first discovery.', 'key', 'stamp', 'center', 'A stamp lands on the card.'),
  E('e50', 'cross', 'In one day, solve a Minimum Path and make a new discovery.', 'gearwheel', 'pulse', 'center', 'The same symbol appears in both journals.'),
];
export const EGG_BY_ID: Readonly<Record<string, EggDef>> = Object.fromEntries(EGGS.map(e => [e.id, e]));
export const eggPath = (g: GlyphId) => G[g];

/* ── the detector ─────────────────────────────────────────────────────── */

export interface EggEnv {
  now(): number;
  engine(): Engine | null;
  eraIdx(): number;
  sceneId(): string | null;
  view(): string;
  reduced(): boolean;
  vw(): number; vh(): number;
  fire(id: string, at?: { x: number; y: number }): void;
}
interface Pt { t: number; x: number; y: number }
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const within = (arr: number[], now: number, ms: number) => arr.filter(t => now - t <= ms);
const TAU = Math.PI * 2;
const dayKey = () => new Date().toISOString().slice(0, 10);

export class EggEngine {
  private taps: Pt[] = [];
  private trail: Pt[] = [];
  private restSince = 0; private restAt: Pt | null = null;
  private lastAct = 0;
  private inspects: string[] = [];
  private inspectLog: { id: string; cat: string; t: number }[] = [];
  private closes: number[] = [];
  private studied = new Set<string>();
  private lastDiscoveryAt = 0; private discoveriesSeen = 0;
  private fails: number[] = [];
  private startEra = -1;
  private homeTimes: number[] = [];
  private tactileLog: { g: string; item: string; mat: string; t: number }[] = [];
  private calm = new Map<number, number>();
  private angleAcc = new Map<number, { last: number; sum: number }>();
  private heldSince = new Map<number, { t: number; x: number; y: number }>();
  private leftFlag = new Map<number, number>();
  private pairSince = new Map<string, number>();
  private chips = new Map<string, number>();
  private eraHover = new Map<string, number>();
  private keyLog: { k: string; t: number }[] = [];
  private portraitClicks: number[] = [];
  private dateHoverTimer = 0;
  private hubPreviews = 0;

  constructor(private env: EggEnv) {}

  /* bus events ─────────────────────────────────────────────────────────── */
  onBus(e: RetentionEvent) {
    const env = this.env, now = env.now();
    const eng = env.engine();
    if (this.startEra < 0) this.startEra = env.eraIdx();
    switch (e.t) {
      case 'discovery': {
        this.lastAct = now;
        if (e.status === 'new') {
          if (this.discoveriesSeen > 0 && now - this.lastDiscoveryAt >= 180_000) env.fire('e33');
          if (eng?.resumed && eraIndex(e.era) > this.startEra) env.fire('e34');
          if (eng && eng.path().length >= 40) env.fire('e29');
          const d = dayKey();
          retention.bump(`x50:disc:${d}`, 0 || 1);
          this.checkE50();
        }
        this.discoveriesSeen++; this.lastDiscoveryAt = now;
        break;
      }
      case 'attempt-fail': this.lastAct = now; this.fails.push(now); this.fails = within(this.fails, now, 300_000); break;
      case 'minpath': if (e.solved) { retention.bump(`x50:mp:${dayKey()}`, 1); this.checkE50(); } break;
      case 'inspect': {
        const n = eng?.get(e.id);
        if (!n || !e.owned) break;
        this.inspectLog = [...this.inspectLog, { id: e.id, cat: n.cat, t: now }].slice(-12);
        this.inspects.push(e.id);
        const ids = this.inspectLog;
        const stones = new Set(ids.filter(x => { const m = eng!.get(x.id); return m && materialOf(m) === 'stone'; }).map(x => x.id));
        if (stones.size >= 3) env.fire('e08');
        const tools = new Set(ids.filter(x => x.cat === 'technology' || x.cat === 'engineering').map(x => x.id));
        if (tools.size >= 3) env.fire('e21');
        const last3 = ids.slice(-3);
        if (last3.length === 3 && new Set(last3.map(x => x.id)).size === 3 && last3.every(x => x.cat === last3[0].cat)) env.fire('e23');
        if (eraIndex(n.era) >= 0 && eraIndex(n.era) <= env.eraIdx() - 6) env.fire('e28');
        break;
      }
      case 'study': {
        this.studied.add(e.id);
        if (this.studied.size >= 3) env.fire('e25');
        break;
      }
      case 'tactile': {
        this.tactileLog = [...this.tactileLog, { g: e.gesture, item: e.itemId, mat: e.material, t: now }].filter(x => now - x.t < 10_000);
        this.tactileChecks(e.gesture, e.itemId, e.material, now);
        break;
      }
      case 'npc': this.npcChecks(e); break;
      case 'signal': this.signal(e.name, e.id, now); break;
      default: break;
    }
  }

  private checkE50() {
    const d = dayKey();
    if (retention.counter(`x50:mp:${d}`) > 0 && retention.counter(`x50:disc:${d}`) > 0) this.env.fire('e50');
  }

  private tactileChecks(g: string, item: string, mat: string, now: number) {
    const env = this.env, log = this.tactileLog;
    if (g === 'tap') {
      const t = log.filter(x => x.g === 'tap' && x.item === item && now - x.t <= 5000).map(x => x.t);
      if (t.length >= 4) {
        const last = t.slice(-4), gaps = [last[1] - last[0], last[2] - last[1], last[3] - last[2]];
        const mean = gaps.reduce((a, b) => a + b, 0) / 3;
        if (mean > 150 && gaps.every(x => x > mean * 0.65 && x < mean * 1.35)) env.fire('e09');
      }
    }
    if (g === 'spin' && mat === 'earth' && log.filter(x => x.g === 'spin' && x.item === item && now - x.t <= 8000).length >= 2) env.fire('e41');
    if (g === 'land' && mat === 'stone' && log.some(x => x.g === 'throw' && x.item === item && now - x.t <= 2500)) env.fire('e42');
    if (g === 'rub' && log.filter(x => x.g === 'rub' && x.item === item && now - x.t <= 4000).length >= 3) env.fire('e43');
  }

  private npcChecks(e: Extract<RetentionEvent, { t: 'npc' }>) {
    const env = this.env;
    const def = NPC_BY_ID[e.id];
    if (e.stage === 'met') {
      if ((retention.get().npcs[e.id]?.visits ?? 0) >= 2) env.fire('e36');
    }
    if (e.stage === 'quest-done') {
      env.fire('e40');
      if (def?.kind === 'historical') env.fire('e37');
      const t = retention.get().npcs[e.id]?.target;
      const n = t ? env.engine()?.get(t) : null;
      if (n && (n.cat === 'technology' || n.cat === 'engineering')) env.fire('e38');
    }
  }

  private signal(name: string, id: string | undefined, now: number) {
    const env = this.env;
    switch (name) {
      case 'home': {
        this.homeTimes = within([...this.homeTimes, now], now, 8000);
        if (this.homeTimes.length >= 3) env.fire('e04');
        break;
      }
      case 'panel-close': {
        this.closes = within([...this.closes, now], now, 30_000);
        const s = this.inspects.slice(-2);
        if (s.length === 2 && s[0] === s[1] && this.closes.length >= 2) env.fire('e22');
        break;
      }
      case 'hint': if (this.fails.length >= 4) env.fire('e35'); break;
      case 'npc-prop': env.fire('e39'); break;
      case 'hub-close': if (id === 'idle') env.fire('e46'); break;
      case 'hub-preview': this.hubPreviews++; break;
      case 'theme-default': if (this.hubPreviews >= 3) env.fire('e47'); this.hubPreviews = 0; break;
      case 'share-preview': {
        const eng = env.engine(); const first = eng?.order.find(x => { const n = eng.get(x); return n && !n.state && !eng.db.primitives.includes(x); });
        if (first && id === first) env.fire('e49');
        break;
      }
      default: break;
    }
  }

  /* delegated DOM events ─────────────────────────────────────────────── */
  key(k: string) {
    const now = this.env.now();
    this.keyLog = [...this.keyLog, { k: k.toLowerCase(), t: now }].filter(x => now - x.t < 8000).slice(-6);
    const seq = this.keyLog.map(x => x.k).join('');
    if (seq.endsWith('tagw')) this.env.fire('e27');
  }
  search(v: string) {
    const eng = this.env.engine(); const q = v.trim().toLowerCase();
    if (!eng || q.length < 3) return;
    for (const id of eng.order) {
      const n = eng.get(id);
      if (n && n.tags?.includes(q) && !n.n.toLowerCase().includes(q)) { this.env.fire('e30'); return; }
    }
  }
  click(el: Element | null) {
    const now = this.env.now();
    const chip = el?.closest('button.chip[data-af]');
    if (chip) {
      this.chips.set(chip.getAttribute('data-af') ?? '', now);
      const recent = [...this.chips.values()].filter(t => now - t < 20_000).length;
      if (recent >= 3) this.env.fire('e26');
    }
    if (el?.closest('.nar-portrait')) {
      this.portraitClicks = within([...this.portraitClicks, now], now, 9000);
      const p = this.portraitClicks;
      if (p.length >= 3 && p.slice(-3).every((t, i, a) => i === 0 || (t - a[i - 1] >= 450 && t - a[i - 1] <= 2800))) this.env.fire('e31');
    }
    if (el?.closest('[data-npc-portrait]')) {
      this.npcTaps = within([...this.npcTaps, now], now, 5000);
      if (this.npcTaps.length >= 3) { this.signal('npc-prop', undefined, now); this.npcTaps = []; }
    }
  }
  private npcTaps: number[] = [];
  dblclick(el: Element | null) { if (el?.closest('.nar-portrait')) this.env.fire('e32'); }
  hover(el: Element | null) {
    const now = this.env.now();
    window.clearTimeout(this.dateHoverTimer);
    const meta = el?.closest('.exh-meta');
    if (meta) this.dateHoverTimer = window.setTimeout(() => this.env.fire('e24'), 700);
    const era = el?.closest('.tl-era[data-era]');
    if (era) {
      this.eraHover.set(era.getAttribute('data-era') ?? '', now);
      if ([...this.eraHover.values()].filter(t => now - t < 7000).length >= 3) this.env.fire('e48');
    }
  }

  /* pointer ─────────────────────────────────────────────────────────── */
  /** `plain`: the press was on open scenery, not a button, panel or piece. */
  pointer(kind: 'down' | 'move', x: number, y: number, plain: boolean, probe: BenchProbe | null) {
    const env = this.env, now = env.now();
    const pt = { t: now, x, y };
    if (kind === 'move') {
      this.trail = [...this.trail, pt].filter(p => now - p.t < 6500).slice(-400);
      if (!this.restAt || dist(this.restAt, pt) > 8) { this.restAt = pt; this.restSince = now }
      if (plain) this.sunbeam(now);
      return;
    }
    this.lastAct = now;
    this.restAt = pt; this.restSince = now;
    if (!plain || env.view() !== 'work') return;
    this.taps = [...this.taps, pt].filter(p => now - p.t < 3200).slice(-8);
    const vw = env.vw(), vh = env.vh();
    // e01 — the knot sits low on the left of the bench
    if (probe) {
      const k = this.knot(probe);
      if (this.taps.filter(p => dist(p, k) < 30).length >= 3) env.fire('e01', k);
    }
    // e11 — sky: two taps, same spot, high on the screen
    const sky = this.taps.filter(p => p.y > vh * 0.1 && p.y < vh * 0.3 && now - p.t < 1300);
    if (sky.length >= 2 && dist(sky[sky.length - 1], sky[sky.length - 2]) < 46) env.fire('e11');
    // e17 — a real night
    const h = new Date().getHours();
    if ((h >= 20 || h < 5) && y < vh * 0.09 && this.taps.length >= 1) env.fire('e17');
    // e19 — far-left cliff once cities have risen
    if (env.eraIdx() >= eraIndex('civilization') && this.taps.filter(p => p.x < vw * 0.03 && p.y > vh * 0.3 && p.y < vh * 0.85 && now - p.t < 3000).length >= 3) env.fire('e19');
    // scene regions
    const sid = env.sceneId();
    if (sid) {
      const kinds = this.regionKinds(sid, x, y, vw, vh);
      if (kinds) {
        const big = this.largest(regionsFor(sid), 'grass');
        const gTaps = this.taps.filter(p => now - p.t < 1500 && big && this.inRegion(big, p, vw, vh));
        if (big && gTaps.length >= 2) env.fire('e13');
        const seq = this.taps.slice(-2);
        if (seq.length === 2 && seq[1].t - seq[0].t < 3000) {
          const a = this.regionKinds(sid, seq[0].x, seq[0].y, vw, vh), b = this.regionKinds(sid, seq[1].x, seq[1].y, vw, vh);
          if (a === 'grass' && b === 'water') env.fire('e14');
        }
      }
    }
  }
  knot(probe: BenchProbe) { return { x: probe.left + probe.w * 0.3, y: probe.top + probe.h * 0.7 }; }

  private regionKinds(sid: string, x: number, y: number, vw: number, vh: number): string | null {
    const { u, v } = toScene(x, y, vw, vh, { x: 0, y: 0 }, 0);
    for (const r of regionsFor(sid)) if (pointInPoly(u, v, r.poly)) return r.kind;
    return null;
  }
  private largest(regs: Region[], kind: string): Region | null {
    const area = (p: [number, number][]) => Math.abs(p.reduce((s, c, i) => { const n = p[(i + 1) % p.length]; return s + c[0] * n[1] - n[0] * c[1]; }, 0)) / 2;
    return regs.filter(r => r.kind === kind).sort((a, b) => area(b.poly) - area(a.poly))[0] ?? null;
  }
  private inRegion(r: Region, p: { x: number; y: number }, vw: number, vh: number) {
    const { u, v } = toScene(p.x, p.y, vw, vh, { x: 0, y: 0 }, 0);
    return pointInPoly(u, v, r.poly);
  }

  /** e16 — a slow, wide loop traced with the pointer. */
  private sunbeam(now: number) {
    const t = this.trail;
    if (t.length < 40 || now - t[0].t < 2200) return;
    const cx = t.reduce((s, p) => s + p.x, 0) / t.length, cy = t.reduce((s, p) => s + p.y, 0) / t.length;
    let sum = 0, len = 0;
    for (let i = 1; i < t.length; i++) {
      let d = Math.atan2(t[i].y - cy, t[i].x - cx) - Math.atan2(t[i - 1].y - cy, t[i - 1].x - cx);
      if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      sum += d; len += dist(t[i], t[i - 1]);
    }
    const span = (t[t.length - 1].t - t[0].t) / 1000;
    const speed = len / Math.max(0.1, span);
    const r = t.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / t.length;
    if (Math.abs(sum) >= TAU * 0.95 && speed > 20 && speed < 260 && r > 36 && r < 260) { this.trail = []; this.env.fire('e16', { x: cx, y: cy }); }
  }

  /* a steady tick: idle scenery and the bench probe ──────────────────── */
  tick(probe: BenchProbe | null) {
    const env = this.env, now = env.now();
    const sid = env.sceneId();
    if (env.view() === 'work') {
      const idle = now - Math.max(this.restSince, this.lastAct);
      if (sid === 'firecamp' && idle > 20_000) env.fire('e15');
      if (sid && regionsFor(sid).some(r => r.kind === 'water') && idle > 22_000) env.fire('e12');
      // e18 — pointer resting on water, motion allowed
      if (sid && !env.reduced() && this.restAt && now - this.restSince > 6000 && this.regionKinds(sid, this.restAt.x, this.restAt.y, env.vw(), env.vh()) === 'water') env.fire('e18', this.restAt);
      // e20 — bottom-right corner
      if (this.restAt && now - this.restSince > 3000 && this.restAt.x > env.vw() - 28 && this.restAt.y > env.vh() - 28) env.fire('e20');
    }
    if (!probe || probe.busy || env.view() !== 'work') { this.calm.clear(); this.pairSince.clear(); return; }
    const bs = probe.bodies.filter(b => !b.temp);
    const live = new Set(bs.map(b => b.uid));
    for (const k of [...this.calm.keys()]) if (!live.has(k)) this.calm.delete(k);
    for (const k of [...this.angleAcc.keys()]) if (!live.has(k)) this.angleAcc.delete(k);
    for (const k of [...this.heldSince.keys()]) if (!live.has(k)) this.heldSince.delete(k);
    const eng = env.engine();
    for (const b of bs) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed < 6 && !b.held) { if (!this.calm.has(b.uid)) this.calm.set(b.uid, now); } else this.calm.delete(b.uid);
      // e03 — a gentle full turn
      const acc = this.angleAcc.get(b.uid) ?? { last: b.angle, sum: 0 };
      let d = b.angle - acc.last; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      acc.sum = Math.abs(b.av) < 4 && Math.abs(d) < 0.5 ? acc.sum + Math.abs(d) : 0; acc.last = b.angle;
      this.angleAcc.set(b.uid, acc);
      if (acc.sum >= TAU) { acc.sum = 0; env.fire('e03', { x: b.x, y: b.y }); }
      // e05 — a wooden piece held perfectly still
      if (b.held) {
        const h = this.heldSince.get(b.uid);
        if (!h || dist(h, b) > 10) this.heldSince.set(b.uid, { t: now, x: b.x, y: b.y });
        else if (now - h.t > 4000 && b.material === 'wood') { this.heldSince.delete(b.uid); env.fire('e05', { x: b.x, y: b.y }); }
        // e07 — to the far left and back
        if (b.x < probe.left + probe.w * 0.07) this.leftFlag.set(b.uid, now);
        const lf = this.leftFlag.get(b.uid);
        if (lf && now - lf < 10_000 && b.x > probe.left + probe.w * 0.3) { this.leftFlag.delete(b.uid); env.fire('e07', { x: b.x, y: b.y }); }
      } else this.heldSince.delete(b.uid);
      // e10 — a vessel left alone
      const since = this.calm.get(b.uid);
      const node = eng?.get(b.itemId);
      if (since && node && node.artifactType === 'container' && now - since > 20_000 && now - this.lastAct > 8000) env.fire('e10', { x: b.x, y: b.y });
    }
    const pairOK = (key: string, ok: boolean, ms: number, id: string, at?: { x: number; y: number }) => {
      if (!ok) { this.pairSince.delete(key); return; }
      const s = this.pairSince.get(key) ?? now;
      this.pairSince.set(key, s);
      if (now - s > ms) { this.pairSince.delete(key); env.fire(id, at); }
    };
    const calmFor = (b: { uid: number }, ms: number) => { const s = this.calm.get(b.uid); return !!s && now - s >= ms; };
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], c = bs[j], d = dist(a, c), gap = d - (a.r + c.r);
      const mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
      const pair = (m1: string, m2: string) => (a.material === m1 && c.material === m2) || (a.material === m2 && c.material === m1);
      const key = (p: string) => `${p}:${Math.min(a.uid, c.uid)}:${Math.max(a.uid, c.uid)}`;
      pairOK(key('sw'), pair('stone', 'wood') && d < (a.r + c.r) * 2.4 + 30 && calmFor(a, 1000) && calmFor(c, 1000) && now - this.lastAct > 6000, 6000, 'e02', mid);
      const glassNear = (a.material === 'glass' && (c.material === 'fire' || c.material === 'energy')) || (c.material === 'glass' && (a.material === 'fire' || a.material === 'energy'));
      pairOK(key('gl'), glassNear && d < 170 && !a.held && !c.held, 3000, 'e44', mid);
      pairOK(key('wl'), pair('wood', 'liquid') && d < 140 && gap > 6 && !a.held && !c.held, 4000, 'e45', mid);
    }
    // e06 — three resting pieces at the corners of a triangle
    const rest = bs.filter(b => calmFor(b, 1200));
    if (rest.length >= 3) {
      let ok = false, at = { x: 0, y: 0 };
      for (let i = 0; i < rest.length && !ok; i++) for (let j = i + 1; j < rest.length && !ok; j++) for (let k = j + 1; k < rest.length && !ok; k++) {
        const s = [dist(rest[i], rest[j]), dist(rest[j], rest[k]), dist(rest[i], rest[k])], m = (s[0] + s[1] + s[2]) / 3;
        if (m > 90 && m < 340 && s.every(v => Math.abs(v - m) < m * 0.22)) { ok = true; at = { x: (rest[i].x + rest[j].x + rest[k].x) / 3, y: (rest[i].y + rest[j].y + rest[k].y) / 3 }; }
      }
      pairOK('tri', ok, 1500, 'e06', at);
    } else this.pairSince.delete('tri');
  }
}
