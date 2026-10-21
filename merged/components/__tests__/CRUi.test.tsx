import { fireEvent, render, screen } from '@testing-library/react';
import { RolePicker, ConnBadge, fmt } from '../quiz/cr/ui';
import { RoleIcon, TeamBadge } from '../quiz/cr/icons';
import { ROLE_INFO, ROLE_SETS } from '../quiz/cr/art';
import { ROLES } from '@/lib/quiz/cr/domain';

describe('Clue Racing RolePicker (roles by team size)', () => {
  it('a team of one has no choice: only the Solo Pathfinder, explained', () => {
    const pick = jest.fn(); render(<RolePicker value="solo_pathfinder" onPick={pick} busy={false} teamSize={1} taken={[]} />);
    expect(screen.getByText(/a team of one plays the Solo Pathfinder/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /scout/i })).toBeNull();
    expect(pick).not.toHaveBeenCalled();
  });
  it('a team of two offers the five team roles (never the solo role) and reports the pick', () => {
    const pick = jest.fn(); render(<RolePicker value={null} onPick={pick} busy={false} teamSize={2} taken={[]} />);
    const buttons = screen.getAllByRole('button'); expect(buttons).toHaveLength(5);
    expect(screen.queryByText('Solo Pathfinder')).toBeNull();
    fireEvent.click(buttons[0]!); expect(pick).toHaveBeenCalledTimes(1);
  });
  it('a role a teammate already holds is disabled and says so', () => {
    const pick = jest.fn(); render(<RolePicker value="scout" onPick={pick} busy={false} teamSize={3} taken={['cartographer']} />);
    const carto = screen.getByRole('button', { name: /cartographer/i }) as HTMLButtonElement; expect(carto.disabled).toBe(true); expect(carto.textContent).toMatch(/teammate has this role/i);
    expect((screen.getByRole('button', { name: /scout/i }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('the suggested set matches the team size', () => {
    for (let n = 1; n <= 5; n++) expect(ROLE_SETS[n]).toHaveLength(n);
    expect(new Set(ROLE_SETS[5]).size).toBe(5);
  });
});
describe('Clue Racing small UI pieces', () => {
  it('every role has a name, an ability and a distinct accessory', () => {
    const acc = new Set(ROLES.map((r) => ROLE_INFO[r].accessory)); expect(acc.size).toBe(ROLES.length);
    for (const r of ROLES) { expect(ROLE_INFO[r].name.length).toBeGreaterThan(2); expect(ROLE_INFO[r].ability.length).toBeGreaterThan(2); }
  });
  it('icons are decorative (aria-hidden) so the visible label carries the meaning', () => {
    const { container } = render(<><RoleIcon role="scout" /><TeamBadge index={2} /></>); container.querySelectorAll('svg').forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });
  it('team badges differ by shape as well as colour (colour is never the only cue)', () => {
    const shapes = [0, 1, 2, 3].map((i) => render(<TeamBadge index={i} />).container.innerHTML.replace(/fill="#[0-9A-F]+"|stroke="#[0-9A-F]+"/gi, '')); expect(new Set(shapes).size).toBe(4);
  });
  it('the connection badge is silent when connected and explains every degraded state', () => {
    const { container, rerender } = render(<ConnBadge conn="connected" />); expect(container.textContent).toBe('');
    for (const c of ['connecting', 'degraded', 'reconnecting', 'restored']) { rerender(<ConnBadge conn={c} />); expect(container.textContent!.length).toBeGreaterThan(5); }
  });
  it('formats the countdown as m:ss', () => { expect(fmt(65_000)).toBe('1:05'); expect(fmt(0)).toBe('0:00'); });
});
