import { CLIPS, CLIP_IDS, getClip } from '../clips';
import { LINE_BY_TONE, DIALOGUE, MAX_WORDS, getLine, wordCount } from '../dialogue';
import { EVENTS, EVENT_IDS, EVENTS_OF_MODE } from '../events';
import { INTERACTIONS, responseFor } from '../interactions';
import { ACTION_ALLOWLIST, CHARACTER_IDS, CHARACTER_MODES, JOINTS } from '../types';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('clip registry', () => {
  it('has at least 240 unique, non-placeholder clips', () => {
    expect(CLIPS.length).toBeGreaterThanOrEqual(240);
    expect(new Set(CLIP_IDS).size).toBe(CLIPS.length);
    for (const c of CLIPS) expect(c.description).not.toMatch(/todo|placeholder/i);
  });
  it('every clip has a duration, characters, exit pose, reduced-motion fallback and real keyframes', () => {
    for (const c of CLIPS) {
      expect(c.durationMs).toBeGreaterThan(300);
      expect(c.characters.length).toBe(3);
      expect(c.exitPose).toBe('idle');
      expect(c.reducedMotionFallback.durationMs).toBeGreaterThan(0);
      expect(Object.keys(c.reducedMotionFallback.pose).length).toBeGreaterThan(0);
      expect(c.keyframes[0].at).toBe(0);
      expect(c.keyframes[c.keyframes.length - 1].at).toBe(1);
      for (const kf of c.keyframes) for (const j of Object.keys(kf.pose)) expect(JOINTS).toContain(j);
    }
  });
  it('is not 240 copies of one animation: distinct keyframe signatures', () => {
    const sigs = new Set(CLIPS.map(c => JSON.stringify([c.keyframes, c.durationMs])));
    expect(sigs.size).toBeGreaterThanOrEqual(230);
  });
  it('meets the choreography quotas', () => {
    expect(CLIPS.filter(c => c.beats >= 5).length).toBeGreaterThanOrEqual(30);
    expect(CLIPS.filter(c => c.prop).length).toBeGreaterThanOrEqual(20);
    expect(CLIPS.filter(c => c.cast > 1 && c.roles && c.roles.length === c.cast - 1).length).toBeGreaterThanOrEqual(15);
    expect(getClip('trio-see-saw')!.cast).toBe(3);
  });
  it('has the 12 categories of the brief', () => {
    expect(new Set(CLIPS.map(c => c.category)).size).toBe(12);
  });
});

describe('interaction catalogue', () => {
  it('has at least 130 unique events and 390 mappings', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(130);
    expect(new Set(EVENT_IDS).size).toBe(EVENTS.length);
    expect(INTERACTIONS.length).toBeGreaterThanOrEqual(390);
  });
  it('every character responds to every event with a real clip, allowlisted action and short line', () => {
    for (const e of EVENTS) {
      for (const c of CHARACTER_IDS) {
        const r = responseFor(e.id, c)!;
        expect(r).toBeDefined();
        expect(getClip(r.clipId)).toBeDefined();
        if (r.actionId) expect(ACTION_ALLOWLIST).toContain(r.actionId);
        for (const k of ['priority', 'weight', 'cooldownMs', 'maySpeak'] as const) expect(r[k]).not.toBeUndefined();
        if (r.dialogueLineId) { const l = getLine(r.dialogueLineId)!; expect(l).toBeDefined(); expect(l.speakerId).toBe(c); }
      }
    }
  });
  it('characters answer the same event differently', () => {
    let differ = 0;
    for (const e of EVENTS) { const set = new Set(CHARACTER_IDS.map(c => responseFor(e.id, c)!.clipId)); if (set.size === 3) differ++; }
    expect(differ).toBeGreaterThan(90);
  });
  it('dialogue obeys the short-line policy and carries a future voice cue', () => {
    for (const d of DIALOGUE) { expect(wordCount(d.text)).toBeLessThanOrEqual(MAX_WORDS); expect(d.voiceCueId).toMatch(/^vc\./); }
    for (const c of CHARACTER_IDS) for (const id of Object.values(LINE_BY_TONE[c])) expect(getLine(id!)).toBeDefined();
  });
  it('the question event is only ever produced with a real result', () => {
    expect(EVENTS.find(e => e.id === 'question-answer-correct-or-wrong')!.needsResult).toBe(true);
  });
});

describe('nine-mode coverage', () => {
  const root = join(__dirname, '..', '..', '..');
  const read = (f: string) => readFileSync(join(root, f), 'utf8');
  const FILES: Record<string, string[]> = {
    'main-evolution': ['components/Workbench.tsx', 'components/InventoryRail.tsx', 'components/QuestionCard.tsx', 'lib/useSandbox.ts', 'components/ArchiveView.tsx', 'components/Sandbox.tsx', 'lib/characters/bridge.ts', 'components/characters/BenchCrewLink.tsx'],
    survival: ['components/survival/SurvivalMode.tsx', 'lib/characters/facts.ts'],
    civilization: ['components/civilization/CivilizationMode.tsx', 'components/civilization/lifelines/Play.tsx', 'components/civilization/lifelines/ChapterSelect.tsx'],
    archaeology: ['components/archaeology/ArchaeologyMode.tsx'],
    'escape-room': ['components/escaperoom/EscapeRoomMode.tsx'],
    decipher: ['components/decipher/DecipherMode.tsx'],
    'alien-archaeology': ['components/alienarchaeology/AlienArchaeologyMode.tsx'],
    'reverse-evolution': ['components/reverseevolution/ReverseEvolutionMode.tsx'],
    'minimum-path': ['components/minimumpath/MinimumPathMode.tsx'],
  };
  it('lists all nine modes', () => { expect(Object.keys(FILES).sort()).toEqual([...CHARACTER_MODES].sort()); });
  for (const mode of CHARACTER_MODES) {
    it(`${mode} has producers for at least 10 catalogued events`, () => {
      const text = FILES[mode].map(read).join('\n');
      const own = EVENTS_OF_MODE(mode);
      const hit = own.filter(e => text.includes(`'${e.id}'`));
      expect(hit.length).toBeGreaterThanOrEqual(10);
    });
  }
  it('mounts the stage exactly once, at AppRoot, and the old Companion is gone from RetentionLayer', () => {
    expect(read('components/AppRoot.tsx').match(/<CharacterStage/g)!.length).toBe(1);
    expect(read('components/retention/RetentionLayer.tsx')).not.toMatch(/<Companion/);
    for (const f of Object.values(FILES).flat()) expect(read(f)).not.toMatch(/<CharacterStage/);
  });
});
