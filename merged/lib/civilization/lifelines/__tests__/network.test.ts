import { maxFlow } from '../network';

const arc = (linkId: string, from: string, to: string, cap: number, directed = false) => ({ linkId, from, to, cap, directed });
const m = (o: Record<string, number>) => new Map(Object.entries(o));

describe('deterministic max flow', () => {
  it('limits delivery to the narrowest shared link', () => {
    const r = maxFlow(['a', 'b', 'c'], [arc('l1', 'a', 'b', 10), arc('l2', 'b', 'c', 4)], m({ a: 20 }), m({ c: 20 }));
    expect(r.total).toBe(4);
    expect(r.absorbed.get('c')).toBe(4);
  });
  it('a disconnected district receives nothing', () => {
    const r = maxFlow(['a', 'b', 'c'], [arc('l1', 'a', 'b', 10)], m({ a: 20 }), m({ c: 5 }));
    expect(r.total).toBe(0);
  });
  it('a second route adds capacity', () => {
    const one = maxFlow(['a', 'b', 'c'], [arc('l1', 'a', 'c', 5)], m({ a: 20 }), m({ c: 20 }));
    const two = maxFlow(['a', 'b', 'c'], [arc('l1', 'a', 'c', 5), arc('l2', 'a', 'b', 5), arc('l3', 'b', 'c', 5)], m({ a: 20 }), m({ c: 20 }));
    expect(two.total).toBe(one.total + 5);
  });
  it('respects direction', () => {
    expect(maxFlow(['a', 'b'], [arc('l', 'a', 'b', 9, true)], m({ b: 9 }), m({ a: 9 })).total).toBe(0);
    expect(maxFlow(['a', 'b'], [arc('l', 'a', 'b', 9, true)], m({ a: 9 }), m({ b: 9 })).total).toBe(9);
  });
  it('is stable regardless of input order', () => {
    const arcs = [arc('l1', 'a', 'b', 3), arc('l2', 'a', 'c', 3), arc('l3', 'b', 'd', 2), arc('l4', 'c', 'd', 2)];
    const x = maxFlow(['a', 'b', 'c', 'd'], arcs, m({ a: 10 }), m({ d: 10 }));
    const y = maxFlow(['d', 'c', 'b', 'a'], [...arcs].reverse(), m({ a: 10 }), m({ d: 10 }));
    expect([...x.net]).toEqual([...y.net]);
    expect(x.total).toBe(4);
  });
  it('splits scarce capacity between equal sinks deterministically', () => {
    const r1 = maxFlow(['s', 'x', 'y'], [arc('l1', 's', 'x', 3), arc('l2', 's', 'y', 3)], m({ s: 4 }), m({ x: 4, y: 4 }));
    const r2 = maxFlow(['s', 'x', 'y'], [arc('l2', 's', 'y', 3), arc('l1', 's', 'x', 3)], m({ s: 4 }), m({ y: 4, x: 4 }));
    expect([...r1.absorbed]).toEqual([...r2.absorbed]);
    expect(r1.total).toBe(4);
  });
});
