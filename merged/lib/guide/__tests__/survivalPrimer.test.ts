import { readFileSync } from 'fs';
import { join } from 'path';
import { SURVIVAL_PRIMER_STEPS } from '../survivalPrimer';
import { poseFor, personSvg, skyFor, skySvg, type Pose } from '../../survival/plateArt';
import type { Period, TaskKind } from '../../survival/types';

const ROOT = join(__dirname, '..', '..', '..');
const SOURCE = ['components/survival/SurvivalMode.tsx', 'components/survival/CampArt.tsx']
  .map(p => readFileSync(join(ROOT, p), 'utf8'))
  .join('\n');

describe('survival primer tour', () => {
  it('has unique step ids', () => {
    const ids = SURVIVAL_PRIMER_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every step points at a control the mode really renders', () => {
    // Some keys are set by an expression (`data-primer={idx === 0 ? 'member' : undefined}`), so accept either form.
    for (const step of SURVIVAL_PRIMER_STEPS) {
      const literal = SOURCE.includes(`data-primer="${step.target}"`);
      const quoted = SOURCE.includes(`'${step.target}'`);
      expect(literal || quoted).toBe(true);
    }
  });

  it('keeps each instruction short enough to read on a phone', () => {
    for (const step of SURVIVAL_PRIMER_STEPS) {
      expect(step.body.length).toBeLessThan(260);
      expect(step.title.length).toBeLessThan(40);
    }
  });
});

describe('survival drawings', () => {
  const tasks: (TaskKind | undefined)[] = [undefined, 'idle', 'fetch-water', 'gather-food', 'tend-fire', 'gather-wood', 'build-shelter', 'rest'];

  it('poses every task, and injured people lie down to rest', () => {
    const expected: Record<string, Pose> = {
      'undefined': 'stand', idle: 'stand', 'fetch-water': 'carry', 'gather-food': 'work',
      'tend-fire': 'work', 'gather-wood': 'raise', 'build-shelter': 'raise', rest: 'rest',
    };
    for (const t of tasks) expect(poseFor(t)).toBe(expected[String(t)]);
    expect(poseFor('gather-wood', true)).toBe('rest');
  });

  it('draws each pose with depth-tagged limbs and a ground line', () => {
    for (const pose of ['stand', 'carry', 'work', 'raise', 'rest'] as Pose[]) {
      const art = personSvg(pose);
      expect(art).toContain('data-z=');
      expect(art).toContain('<circle');
    }
  });

  it('gives each part of the day its own sky, and night is the moon', () => {
    const periods: Period[] = ['morning', 'day', 'evening', 'night'];
    const arts = periods.map(p => skyFor(p).art);
    expect(new Set(arts).size).toBe(periods.length);
    expect(skyFor('night').art).toBe('moon');
    for (const a of arts) expect(skySvg(a).length).toBeGreaterThan(20);
  });
});
