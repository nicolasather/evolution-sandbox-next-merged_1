/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles are deliberately partial */
import { render, screen } from '@testing-library/react';
import { TopBar } from '@/components/TopBar';
import { UnlockNotice } from '@/components/UnlockNotice';
import { FEATURES, unlockedFor } from '@/lib/unlocks/registry';

const engine = {
  stats: () => ({ core: 5, coreTotal: 200, hidden: 2, hiddenTotal: 10, combos: 10, failed: 3, eras: 2, routesFound: 1 }),
  db: { eras: [{ id: 'e1', name: 'Era1' }], nodes: [] },
  erasReached: () => [{ id: 'e1', name: 'Era1' }],
  currentEra: () => ({ name: 'Era1', id: 'e1' }),
  has: () => true,
  eraProgress: () => ({ era: 'e1', index: 0, name: 'Era1', required: 3, requiredDone: 1, optional: 0, optionalDone: 0, hidden: 0, hiddenDone: 0, percent: 33, complete: false, open: true }),
  search: () => ({ hits: [], hiddenMatches: 0 }),
} as any;

const noop = () => {};
const bar = (unlocks?: any) => (
  <TopBar engine={engine} view="work" onView={noop} onOpen={noop} onReset={noop} onShortcuts={noop}
    onJournal={noop} onWorld={noop} onHub={noop} onTrade={noop} onLab={noop} onMuseum={noop} onMinPath={noop}
    unlocks={unlocks} />
);
const locked = (open: string[], fresh: string[] = []) => ({
  has: (id: string) => open.includes(id), fresh: (id: string) => fresh.includes(id), opened: jest.fn(),
});

describe('top bar and unlocks', () => {
  it('a new visitor sees the Workspace and none of the corner buttons', () => {
    const { container } = render(bar(locked([])));
    expect(screen.getByRole('tab', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Graph' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Timeline' })).toBeNull();
    for (const id of ['hub-open', 'museum-open', 'trade-open', 'lab-open', 'journal-open', 'minpath-open', 'slot-search', 'slot-routes', 'slot-hidden']) {
      expect(container.querySelector('#' + id)).toBeNull();
    }
  });

  it('shows exactly what has opened, and glows what is new', () => {
    const { container } = render(bar(locked(['graph', 'hub'], ['hub'])));
    expect(screen.getByRole('tab', { name: 'Graph' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Archive' })).toBeNull();
    const hub = container.querySelector('#hub-open');
    expect(hub).not.toBeNull();
    expect(hub).toHaveClass('unlock-fresh');
    expect(container.querySelector('#museum-open')).toBeNull();
  });

  it('pressing a new corner button ends its glow', () => {
    const u = locked(['hub'], ['hub']);
    const { container } = render(bar(u));
    (container.querySelector('#hub-open') as HTMLElement).click();
    expect(u.opened).toHaveBeenCalledWith('hub');
  });

  it('left to its defaults everything is open (no unlock system involved)', () => {
    const { container } = render(bar());
    expect(container.querySelector('#hub-open')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Graph' })).toBeInTheDocument();
  });
});

describe('unlock notice', () => {
  it('names the feature and where to look, and is silent while hidden', () => {
    const f = FEATURES.find(x => x.id === 'graph')!;
    const { container, rerender } = render(<UnlockNotice feature={f} onDone={noop} hidden={false} />);
    expect(container.textContent).toContain('Graph');
    expect(container.textContent).toContain(f.where);
    rerender(<UnlockNotice feature={f} onDone={noop} hidden />);
    expect(container.textContent).toBe('');
    rerender(<UnlockNotice feature={null} onDone={noop} hidden={false} />);
    expect(container.textContent).toBe('');
  });

  it('every feature has words for the notice', () => {
    const all = unlockedFor({ made: 999, eraIndex: 99 });
    for (const f of FEATURES) {
      expect(all.has(f.id)).toBe(true);
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.line.length).toBeGreaterThan(0);
      expect(f.where.length).toBeGreaterThan(0);
    }
  });
});
