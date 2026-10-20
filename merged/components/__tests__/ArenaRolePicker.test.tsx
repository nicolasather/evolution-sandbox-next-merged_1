import { fireEvent, render, screen } from '@testing-library/react';
import { RolePicker } from '../quiz/arena/ui';

describe('Arena RolePicker (role sets by team size)', () => {
  it('a team of one has no choice: only the Runner, explained', () => {
    const pick = jest.fn(); render(<RolePicker value="runner" onPick={pick} busy={false} teamSize={1} />);
    expect(screen.getByText(/a team of one plays the Runner/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /sentinel/i })).toBeNull();
    expect(pick).not.toHaveBeenCalled();
  });
  it('a team of three offers three roles and reports the pick', () => {
    const pick = jest.fn(); render(<RolePicker value={null} onPick={pick} busy={false} teamSize={3} />);
    const buttons = screen.getAllByRole('button'); expect(buttons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(buttons[0]!); expect(pick).toHaveBeenCalledTimes(1);
  });
});
