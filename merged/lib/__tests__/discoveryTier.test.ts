import { discoveryTier } from '../discoveryTier';

type R = Parameters<typeof discoveryTier>[0];
const mk = (node: Record<string, unknown>, extra: Partial<R> = {}): R =>
  ({ node: { era: 'origins', cat: 'material', depth: 1, ...node }, firstOfEra: false, opened: [], ...extra }) as unknown as R;

describe('discoveryTier', () => {
  it('is major for hidden, rare, first of an era, or an opened gate', () => {
    expect(discoveryTier(mk({ hidden: true }), true)).toBe('major');
    expect(discoveryTier(mk({ rar: 'rare' }), true)).toBe('major');
    expect(discoveryTier(mk({}, { firstOfEra: true }), true)).toBe('major');
    expect(discoveryTier(mk({}, { opened: ['middle'] } as unknown as Partial<R>), true)).toBe('major');
  });
  it('is minor for a humble early find only after the reveal was seen', () => {
    expect(discoveryTier(mk({}), false)).toBe('standard');
    expect(discoveryTier(mk({}), true)).toBe('minor');
  });
  it('is standard for anything deeper or later', () => {
    expect(discoveryTier(mk({ depth: 9 }), true)).toBe('standard');
    expect(discoveryTier(mk({ era: 'fire', cat: 'tool' }), true)).toBe('standard');
  });
});
