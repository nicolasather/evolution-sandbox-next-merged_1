import { render, screen, fireEvent } from '@testing-library/react';
import { ReasonTag, RankingRules } from '../parts';
import Coach, { STEPS } from '../Coach';
import { laneReach, MAPS, padOf } from '@/lib/quiz/td/maps';
import { TD_MAPS } from '@/lib/quiz/td/domain';
import { TOWERS } from '@/lib/quiz/td/balance';

describe('ReasonTag: each blocked action reads differently', () => {
  it('distinguishes points, phase, taken pad and branch', () => {
    const codes = { INSUFFICIENT_POINTS: 'Not enough points', WRONG_PHASE: 'Wrong phase', PAD_OCCUPIED: 'Pad taken', BRANCH_REQUIRED: 'Pick a branch' } as const;
    const classes = new Set<string>();
    for (const [code, label] of Object.entries(codes)) {
      const { container, unmount } = render(<ReasonTag code={code as keyof typeof codes} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      classes.add(container.firstElementChild!.className); unmount();
    }
    expect(classes.size).toBe(4);
  });
  it('renders nothing for unknown or missing codes', () => {
    const { container } = render(<ReasonTag />); expect(container).toBeEmptyDOMElement();
  });
});

describe('RankingRules: scoring is explained', () => {
  it('competitive view states ranking order and team-size fairness; speed earns nothing', () => {
    render(<RankingRules squads />);
    fireEvent.click(screen.getByText('How is this scored?'));
    expect(screen.getByText(/waves cleared first/i)).toBeInTheDocument();
    expect(screen.getByText(/does not earn five times/i)).toBeInTheDocument();
    expect(screen.getByText(/answering faster earns nothing/i)).toBeInTheDocument();
  });
  it('co-op view omits the ranking line', () => {
    render(<RankingRules squads={false} />); expect(screen.queryByText(/waves cleared first/i)).toBeNull();
  });
});

describe('Coach: skippable first-match tour', () => {
  it('covers path, points, question, build, upgrade, wave, result and can be skipped', () => {
    expect(STEPS).toHaveLength(7);
    expect(STEPS.map((s) => s.title.toLowerCase()).join(' ')).toMatch(/lane.*points.*question.*build.*upgrade.*wave.*result/);
    const onClose = jest.fn(); render(<Coach onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i })); expect(onClose).toHaveBeenCalled();
  });
});

describe('laneReach: the number on a card is the stretch drawn on the map', () => {
  it('is 0..100, grows with range, and is 0 for unknown pads', () => {
    for (const m of TD_MAPS) {
      expect(laneReach(m, 'nope', 5000)).toBe(0);
      const pad = MAPS[m].pads[0]!.id; expect(padOf(m, pad)).toBeTruthy();
      const small = laneReach(m, pad, 1500), big = laneReach(m, pad, 6000);
      expect(small).toBeGreaterThanOrEqual(0); expect(big).toBeLessThanOrEqual(100); expect(big).toBeGreaterThanOrEqual(small);
    }
  });
  it('every damaging tower reaches some lane from at least one pad on every map', () => {
    for (const m of TD_MAPS) for (const t of Object.values(TOWERS).filter((x) => x.damage > 0)) {
      expect(Math.max(...MAPS[m].pads.map((p) => laneReach(m, p.id, t.range)))).toBeGreaterThan(0);
    }
  });
});
