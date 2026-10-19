/** Sample questions for the local practice lab (no account, no database). Original, deterministic, EN + VI. Real games use the teacher's own quiz. */
import { rngFrom } from './rng';
import type { PoolQuestion } from './types';
import type { QuestionKind } from '../types';

export type LabQuestion = { id: string; position: number; kind: QuestionKind; topic: string; difficulty: 1 | 2 | 3; prompt: { en: string; vi: string }; options?: { id: string; text: { en: string; vi: string } }[]; correct: string; explanation: { en: string; vi: string } };

const T = { frac: { en: 'Fractions', vi: 'Phân số' }, geo: { en: 'Geometry', vi: 'Hình học' }, alg: { en: 'Algebra', vi: 'Đại số' }, earth: { en: 'Earth science', vi: 'Khoa học Trái Đất' } };
export const LAB_TOPICS = { en: [T.frac.en, T.geo.en, T.alg.en, T.earth.en], vi: [T.frac.vi, T.geo.vi, T.alg.vi, T.earth.vi] };

type Opt = string | { en: string; vi: string };
const o2 = (o: Opt) => (typeof o === 'string' ? { en: o, vi: o } : o);
function mc(id: string, position: number, topic: number, difficulty: 1 | 2 | 3, prompt: { en: string; vi: string }, right: Opt, wrong: Opt[], why: { en: string; vi: string }): LabQuestion {
  const options = [right, ...wrong].map((text, i) => ({ id: String.fromCharCode(97 + i), text: o2(text) }));
  return { id, position, kind: 'multiple_choice', topic: [T.frac, T.geo, T.alg, T.earth][topic]!.en, difficulty, prompt, options, correct: 'a', explanation: why };
}
export function labQuestions(n = 60, seed = 'lab'): LabQuestion[] {
  const rng = rngFrom(seed); const out: LabQuestion[] = [];
  for (let i = 0; i < n; i++) {
    const topic = i % 4; const d = (((i / 4) | 0) % 3 + 1) as 1 | 2 | 3; const id = `lab-${i}`;
    if (topic === 0) { const den = 4 + rng.int(5) * 2; const a = 1 + rng.int(den / 2 - 1), b = 1 + rng.int(den / 2 - 1); const s = a + b; out.push(mc(id, i, 0, d, { en: `What is ${a}/${den} + ${b}/${den}?`, vi: `${a}/${den} + ${b}/${den} bằng bao nhiêu?` }, `${s}/${den}`, [`${s}/${den * 2}`, `${a * b}/${den}`, `${s + 1}/${den}`], { en: 'Same denominator: add the numerators and keep the denominator.', vi: 'Cùng mẫu số: cộng tử số và giữ nguyên mẫu số.' })); }
    else if (topic === 1) { const w = 3 + rng.int(8), h = 2 + rng.int(7); out.push(mc(id, i, 1, d, { en: `A rectangle is ${w} cm by ${h} cm. What is its area?`, vi: `Hình chữ nhật ${w} cm × ${h} cm. Diện tích là bao nhiêu?` }, `${w * h} cm²`, [`${2 * (w + h)} cm²`, `${w + h} cm²`, `${w * h + w} cm²`], { en: 'Area of a rectangle is width times height.', vi: 'Diện tích hình chữ nhật bằng chiều rộng nhân chiều cao.' })); }
    else if (topic === 2) { const x = 2 + rng.int(12), a = 3 + rng.int(9); out.push(mc(id, i, 2, d, { en: `Solve for x: x + ${a} = ${x + a}`, vi: `Tìm x: x + ${a} = ${x + a}` }, `${x}`, [`${x + a}`, `${x + 2}`, `${Math.max(1, x - 1)}`], { en: 'Subtract the same number from both sides.', vi: 'Trừ cả hai vế cho cùng một số.' })); }
    else { const facts: [string, string, Opt, Opt[], string, string][] = [
      ['Which layer of the Earth do we live on?', 'Chúng ta sống trên lớp nào của Trái Đất?', { en: 'The crust', vi: 'Vỏ Trái Đất' }, [{ en: 'The core', vi: 'Nhân' }, { en: 'The mantle', vi: 'Lớp manti' }, { en: 'The ocean floor', vi: 'Đáy đại dương' }], 'The crust is the thin outer layer.', 'Vỏ Trái Đất là lớp ngoài mỏng nhất.'],
      ['What causes day and night?', 'Điều gì tạo ra ngày và đêm?', { en: 'Earth spinning on its axis', vi: 'Trái Đất tự quay quanh trục' }, [{ en: 'The Moon moving', vi: 'Mặt Trăng chuyển động' }, { en: 'Earth orbiting the Sun in a day', vi: 'Trái Đất quay quanh Mặt Trời trong một ngày' }, { en: 'Clouds blocking the Sun', vi: 'Mây che Mặt Trời' }], 'One full spin takes about 24 hours.', 'Một vòng quay đầy đủ mất khoảng 24 giờ.'],
      ['Which gas do plants take in?', 'Cây hấp thụ khí nào?', { en: 'Carbon dioxide', vi: 'Khí cacbonic' }, [{ en: 'Helium', vi: 'Heli' }, { en: 'Methane', vi: 'Metan' }, { en: 'Neon', vi: 'Neon' }], 'Plants use carbon dioxide in photosynthesis.', 'Cây dùng khí cacbonic để quang hợp.'],
      ['What is it called when water turns into vapour?', 'Nước chuyển thành hơi gọi là gì?', { en: 'Evaporation', vi: 'Bay hơi' }, [{ en: 'Condensation', vi: 'Ngưng tụ' }, { en: 'Freezing', vi: 'Đông đặc' }, { en: 'Erosion', vi: 'Xói mòn' }], 'Heat turns liquid water into vapour.', 'Nhiệt biến nước lỏng thành hơi.'],
    ]; const f = facts[((i / 4) | 0) % facts.length]!; out.push(mc(id, i, 3, d, { en: f[0], vi: f[1] }, f[2], f[3], { en: f[4], vi: f[5] })); }
  }
  return out;
}
export const labPool = (qs: LabQuestion[]): PoolQuestion[] => qs.map((q) => ({ position: q.position, id: q.id, kind: q.kind, topic: q.topic, difficulty: q.difficulty, difficultySource: 'author', hasExplanation: true, repeatOf: null }));
