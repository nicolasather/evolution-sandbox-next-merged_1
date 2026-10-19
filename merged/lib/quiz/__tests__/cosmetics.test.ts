/** @jest-environment node */
import { ICONS, THEMES, REACTIONS, BORDERS, NAMEPLATES, BANNERS, ALL_FRAMES, iconSvg, describeCriterion, nameplateText, equipReaction, canReact, isValidReaction, MAX_WHEEL, reactionFallbackSvg } from '../cosmetics/catalog';
import { emptyLedger, applyEvent, refreshUnlocks, owns, equip, visibleIdentity, freeItems, collectionProgress, lockerSearch, type LedgerEvent } from '../cosmetics/ledger';

const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe('catalogue (items 111-113, 121-125)', () => {
  it('has 8 themes x 16 unique icons with names, labels and collections', () => {
    expect(THEMES).toHaveLength(8); expect(ICONS).toHaveLength(128); expect(new Set(ICONS.map((i) => i.id)).size).toBe(128); expect(new Set(ICONS.map((i) => i.name)).size).toBe(128);
    for (const t of THEMES) expect(ICONS.filter((i) => i.theme === t.id)).toHaveLength(16);
    expect(ICONS.every((i) => i.name && i.label && i.collection)).toBe(true);
  });
  it('draws each icon as original vector art: bounded coordinates, no text, no external references', () => {
    for (const i of ICONS) {
      const svg = iconSvg(i.id); expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/); expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/<text|<image|http|<script/);
      expect(svg).toMatch(/role="img"/); expect(svg).toContain(i.label);
    }
    expect(iconSvg(ICONS[40]!.id, { locked: true })).not.toBe(iconSvg(ICONS[40]!.id));
  });
  it('has 48 reactions in 5 groups with text labels and an SVG fallback', () => {
    expect(REACTIONS).toHaveLength(48); expect(new Set(REACTIONS.map((r) => r.id)).size).toBe(48); expect(new Set(REACTIONS.map((r) => r.group)).size).toBe(5);
    expect(REACTIONS.every((r) => r.label && r.glyph)).toBe(true); expect(reactionFallbackSvg(REACTIONS[0]!.id)).toMatch(/<svg/);
  });
  it('has 16 borders, 16 nameplates and 16 banners; nameplate text is always readable', () => {
    expect([BORDERS, NAMEPLATES, BANNERS].map((a) => a.length)).toEqual([16, 16, 16]); expect(new Set(ALL_FRAMES.map((f) => f.id)).size).toBe(48);
    for (const f of NAMEPLATES) expect(contrast(f.colors[0], nameplateText(f))).toBeGreaterThanOrEqual(4.5);
  });
  it('describes every unlock in plain words, with a ladder of many different goals', () => {
    const texts = [...ICONS, ...ALL_FRAMES].filter((x) => !x.free).map((x) => describeCriterion(x.criterion)); expect(texts.every((s) => s.length > 8)).toBe(true); expect(new Set(texts).size).toBeGreaterThan(10);
    expect([...ICONS, ...ALL_FRAMES].filter((x) => !x.free).length).toBeGreaterThanOrEqual(100);
  });
});

describe('reaction wheel (item 127)', () => {
  it('equips up to six valid reactions, throttles sending, and rejects unknown ids', () => {
    let w: string[] = []; for (const r of REACTIONS.slice(0, MAX_WHEEL)) w = equipReaction(w, r.id).wheel;
    expect(w).toHaveLength(MAX_WHEEL); expect(equipReaction(w, REACTIONS[10]!.id).error).toBeTruthy(); expect(isValidReaction('nope')).toBe(false);
    expect(canReact(null, 0).ok).toBe(true); expect(canReact(1000, 2000)).toEqual({ ok: false, waitMs: 2000 }); expect(canReact(1000, 5000).ok).toBe(true);
  });
});

describe('progress ledger (items 112-120, 126, 130)', () => {
  const session = (n: number, o: any = {}): LedgerEvent => ({ id: `ev${n}`, kind: 'session', at: new Date(Date.UTC(2026, 0, n + 1)).toISOString(), accuracy: 0.8, fact: { sessionId: `s${n}`, quizId: o.quizId ?? `quiz${n}`, verified: true, answered: 10, distinctQuestions: 10, durationSeconds: 200, at: new Date(Date.UTC(2026, 0, n + 1)).toISOString(), ...o.fact } });
  it('starts everyone with free items only', () => { const l = emptyLedger(); expect(freeItems().length).toBeGreaterThan(0); expect(freeItems().every((id) => owns(l, id))).toBe(true); expect(owns(l, ICONS.find((i) => !i.free)!.id)).toBe(false); });
  it('applying the same event twice changes nothing (idempotent)', () => {
    const e = session(1); const r1 = applyEvent(emptyLedger(), e); const r2 = applyEvent(r1.ledger, e);
    expect(r1.counted).toBe(true); expect(r2.counted).toBe(false); expect(r2.ledger).toEqual(r1.ledger);
  });
  it('counts only server-verified, substantial sessions and flags suspicious ones without punishing', () => {
    expect(applyEvent(emptyLedger(), session(1, { fact: { verified: false } })).counted).toBe(false);
    expect(applyEvent(emptyLedger(), session(2, { fact: { durationSeconds: 3 } })).counted).toBe(false);
  });
  it('caps repeats of the same quiz', () => {
    let l = emptyLedger(); const results: boolean[] = [];
    for (let i = 1; i <= 5; i++) { const r = applyEvent(l, session(i, { quizId: 'same', fact: { at: new Date(Date.UTC(2026, 0, i * 2)).toISOString() } })); l = r.ledger; results.push(r.counted); }
    expect(results.filter(Boolean).length).toBeLessThanOrEqual(3);
  });
  it('opted-out sessions record nothing', () => { const r = applyEvent(emptyLedger(), session(1), true); expect(r.counted).toBe(false); expect(r.ledger).toEqual(emptyLedger()); });
  it('unlocks are earned from progress and never removed', () => {
    let l = emptyLedger(); for (let i = 1; i <= 12; i++) l = applyEvent(l, session(i)).ledger; l = refreshUnlocks(l, '2026-02-01T00:00:00Z');
    const n = Object.keys(l.unlocked).length; expect(n).toBeGreaterThan(0); expect(refreshUnlocks(l, '2026-03-01T00:00:00Z').unlocked).toEqual(l.unlocked);
    const id = Object.keys(l.unlocked)[0]!; expect(owns(l, id)).toBe(true);
  });
  it('equipping needs ownership; hosts can hide identity or switch cosmetics off', () => {
    const l = emptyLedger(); const locked = ICONS.find((i) => !i.free)!.id; const free = ICONS.find((i) => i.free)!.id;
    expect(equip({}, l, locked).error).toBeTruthy(); expect(equip({}, l, free).eq.icon).toBe(free);
    const eq = { icon: free, border: ALL_FRAMES.find((f) => f.free)!.id };
    expect(visibleIdentity(eq, { showIdentity: false, cosmeticsEnabled: true }, l)).toEqual({}); expect(visibleIdentity(eq, { showIdentity: true, cosmeticsEnabled: false }, l)).toEqual({}); expect(visibleIdentity(eq, { showIdentity: true, cosmeticsEnabled: true }, l).icon).toBe(free);
  });
  it('shows collection progress and a searchable locker', () => {
    const l = emptyLedger(); const c = ICONS[0]!.collection; const p = collectionProgress(l, c); expect(p.total).toBeGreaterThan(0); expect(p.owned).toBeLessThanOrEqual(p.total);
    const found = lockerSearch({ query: ICONS[5]!.name.slice(0, 5) }, l); expect(JSON.stringify(found)).toContain(ICONS[5]!.id);
  });
});
