/** Sample questions for the local practice lab (no account, no database). Original, deterministic, English. Real games use the teacher's own quiz. */
import { rngFrom } from './rng';
import type { PoolQuestion } from './types';
import type { QuestionKind } from '../types';

export type LabQuestion = { id: string; position: number; kind: QuestionKind; topic: string; difficulty: 1 | 2 | 3; prompt: { en: string }; options?: { id: string; text: { en: string } }[]; correct: string; explanation: { en: string } };

const T = { frac: { en: 'Fractions' }, geo: { en: 'Geometry' }, alg: { en: 'Algebra' }, earth: { en: 'Earth science' } };
export const LAB_TOPICS = { en: [T.frac.en, T.geo.en, T.alg.en, T.earth.en] };

type Opt = string | { en: string };
const o2 = (o: Opt) => (typeof o === 'string' ? { en: o } : o);
function mc(id: string, position: number, topic: number, difficulty: 1 | 2 | 3, prompt: { en: string }, right: Opt, wrong: Opt[], why: { en: string }): LabQuestion {
  const options = [right, ...wrong].map((text, i) => ({ id: String.fromCharCode(97 + i), text: o2(text) }));
  return { id, position, kind: 'multiple_choice', topic: [T.frac, T.geo, T.alg, T.earth][topic]!.en, difficulty, prompt, options, correct: 'a', explanation: why };
}
export function labQuestions(n = 60, seed = 'lab'): LabQuestion[] {
  const rng = rngFrom(seed); const out: LabQuestion[] = [];
  for (let i = 0; i < n; i++) {
    const topic = i % 4; const d = (((i / 4) | 0) % 3 + 1) as 1 | 2 | 3; const id = `lab-${i}`;
    if (topic === 0) { const den = 4 + rng.int(5) * 2; const a = 1 + rng.int(den / 2 - 1), b = 1 + rng.int(den / 2 - 1); const s = a + b; out.push(mc(id, i, 0, d, { en: `What is ${a}/${den} + ${b}/${den}?` }, `${s}/${den}`, [`${s}/${den * 2}`, `${a * b}/${den}`, `${s + 1}/${den}`], { en: 'Same denominator: add the numerators and keep the denominator.' })); }
    else if (topic === 1) { const w = 3 + rng.int(8), h = 2 + rng.int(7); out.push(mc(id, i, 1, d, { en: `A rectangle is ${w} cm by ${h} cm. What is its area?` }, `${w * h} cm²`, [`${2 * (w + h)} cm²`, `${w + h} cm²`, `${w * h + w} cm²`], { en: 'Area of a rectangle is width times height.' })); }
    else if (topic === 2) { const x = 2 + rng.int(12), a = 3 + rng.int(9); out.push(mc(id, i, 2, d, { en: `Solve for x: x + ${a} = ${x + a}` }, `${x}`, [`${x + a}`, `${x + 2}`, `${Math.max(1, x - 1)}`], { en: 'Subtract the same number from both sides.' })); }
    else { const facts: [string, Opt, Opt[], string][] = [
      ['Which layer of the Earth do we live on?', { en: 'The crust' }, [{ en: 'The core' }, { en: 'The mantle' }, { en: 'The ocean floor' }], 'The crust is the thin outer layer.'],
      ['What causes day and night?', { en: 'Earth spinning on its axis' }, [{ en: 'The Moon moving' }, { en: 'Earth orbiting the Sun in a day' }, { en: 'Clouds blocking the Sun' }], 'One full spin takes about 24 hours.'],
      ['Which gas do plants take in?', { en: 'Carbon dioxide' }, [{ en: 'Helium' }, { en: 'Methane' }, { en: 'Neon' }], 'Plants use carbon dioxide in photosynthesis.'],
      ['What is it called when water turns into vapour?', { en: 'Evaporation' }, [{ en: 'Condensation' }, { en: 'Freezing' }, { en: 'Erosion' }], 'Heat turns liquid water into vapour.'],
    ]; const f = facts[((i / 4) | 0) % facts.length]!; out.push(mc(id, i, 3, d, { en: f[0] }, f[1], f[2], { en: f[3] })); }
  }
  return out;
}
export const labPool = (qs: LabQuestion[]): PoolQuestion[] => qs.map((q) => ({ position: q.position, id: q.id, kind: q.kind, topic: q.topic, difficulty: q.difficulty, difficultySource: 'author', hasExplanation: true, repeatOf: null }));
