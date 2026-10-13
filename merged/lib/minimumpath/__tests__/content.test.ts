import { expect, test } from '@jest/globals';
import { content, validateContent } from '@/lib/minimumpath/content';
test('database validates every mission, reference and optimal score', () => {
  expect(() => validateContent(content)).not.toThrow();
  expect(new Set(content.missions.map(m => m.id)).size).toBe(content.missions.length);
  for (const chapter of content.chapters) expect(content.missions.some(m => m.chapter === chapter.id)).toBe(true);
});
test('reject dangling recipe, duplicate id, false optimum, blocked endpoint', () => {
  expect(() => validateContent({ ...content, items: [...content.items, content.items[0]] })).toThrow();
  expect(() => validateContent({ ...content, items: [{ ...content.items[0], recipes: [['missing']] }, ...content.items.slice(1)] })).toThrow();
  expect(() => validateContent({ ...content, missions: [{ ...content.missions[0], optimal: -1 }] })).toThrow();
  expect(() => validateContent({ ...content, missions: [{ ...content.missions[0], blocked: [content.missions[0].start] }] })).toThrow();
});
