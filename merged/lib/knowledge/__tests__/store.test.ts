import { knowledgeStore } from '@/lib/knowledge/store';

describe('knowledge store (dormancy — not wired to gameplay yet)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    knowledgeStore.reset();
  });

  it('starts with nothing dormant', () => {
    expect(knowledgeStore.get().dormant).toEqual([]);
    expect(knowledgeStore.isDormant('sharp_stone')).toBe(false);
  });

  it('markDormant records a cause and is idempotent', () => {
    knowledgeStore.markDormant('sharp_stone', 'single-region', true);
    knowledgeStore.markDormant('sharp_stone', 'single-region', true);
    expect(knowledgeStore.get().dormant).toHaveLength(1);
    expect(knowledgeStore.isDormant('sharp_stone')).toBe(true);
  });

  it('relearn clears a dormant record', () => {
    knowledgeStore.markDormant('sharp_stone', 'undocumented', false);
    knowledgeStore.relearn('sharp_stone');
    expect(knowledgeStore.isDormant('sharp_stone')).toBe(false);
  });

  it('persists and reloads across a simulated reload', () => {
    knowledgeStore.markDormant('sharp_stone', 'low-redundancy', true);
    window.localStorage.setItem('evo.knowledge.v1', window.localStorage.getItem('evo.knowledge.v1')!);
    knowledgeStore.load();
    expect(knowledgeStore.isDormant('sharp_stone')).toBe(true);
  });

  it('reset clears memory and storage', () => {
    knowledgeStore.markDormant('sharp_stone', 'single-region', true);
    knowledgeStore.reset();
    expect(knowledgeStore.get().dormant).toEqual([]);
    expect(window.localStorage.getItem('evo.knowledge.v1')).toBeNull();
  });
});
