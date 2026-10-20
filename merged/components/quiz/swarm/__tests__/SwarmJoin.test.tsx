import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SwarmJoin from '../SwarmJoin';
import { readSeat, forgetMemorySeats, persistSeat, seatKey } from '../seat';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const ORIGIN = 'https://worker.example.com';
const joinOk = { roomId: 'room-1', token: 'tok-abc', participantId: 'p1' };
const fillAndSubmit = async () => {
  fireEvent.change(screen.getByTestId('code'), { target: { value: 'ABC234' } }); fireEvent.change(screen.getByTestId('name'), { target: { value: 'Ann' } });
  fireEvent.click(screen.getByTestId('join'));
};
beforeEach(() => { mockPush.mockClear(); forgetMemorySeats(); localStorage.clear(); process.env.NEXT_PUBLIC_SWARM_URL = ORIGIN; global.fetch = jest.fn(async () => ({ ok: true, json: async () => joinOk }) as Response) as never; });
afterEach(() => { jest.restoreAllMocks(); delete process.env.NEXT_PUBLIC_SWARM_URL; });

describe('SwarmJoin', () => {
  it('SW-F01: posts to the https origin /join and navigates once the seat is saved and readable', async () => {
    render(<SwarmJoin initialCode="" />); await fillAndSubmit();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/quiz/swarm/room-1'));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(`${ORIGIN}/join`);
    expect(readSeat('room-1')).toMatchObject({ token: 'tok-abc', workerUrl: ORIGIN }); expect(readSeat('room-1')?.volatile).toBeUndefined();
  });
  it('SW-F02: a wss:// address never reaches fetch(); the form explains instead', async () => {
    process.env.NEXT_PUBLIC_SWARM_URL = 'wss://worker.example.com'; render(<SwarmJoin initialCode="" />);
    expect(screen.getByTestId('no-server').textContent).toMatch(/not valid/); expect(screen.getByTestId('join')).toBeDisabled();
    fireEvent.change(screen.getByTestId('code'), { target: { value: 'ABC234' } }); fireEvent.change(screen.getByTestId('name'), { target: { value: 'Ann' } }); fireEvent.submit(screen.getByTestId('join').closest('form')!);
    expect(global.fetch).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  });
  it('SW-F08: when localStorage.setItem throws SecurityError the seat is held in this tab and the player is warned (no token-less navigation)', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    render(<SwarmJoin initialCode="" />); await fillAndSubmit();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/quiz/swarm/room-1'));
    const seat = readSeat('room-1'); expect(seat?.token).toBe('tok-abc'); expect(seat?.volatile).toBe(true); // the destination page can authenticate
    expect(localStorage.getItem(seatKey('room-1'))).toBeNull();
  });
  it('a storage that accepts writes but returns nothing is also treated as unsaved', () => {
    const lying = { getItem: () => null, setItem: () => undefined }; expect(persistSeat('r2', { token: 't', workerUrl: ORIGIN, name: 'A', code: 'ABC234' }, lying)).toBe('memory');
    expect(readSeat('r2', lying)?.volatile).toBe(true);
  });
  it('server refusals keep the form and show the server message', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ message: 'This room is full.' }) }) as Response) as never;
    render(<SwarmJoin initialCode="" />); await fillAndSubmit();
    await waitFor(() => expect(screen.getByTestId('join-error').textContent).toBe('This room is full.')); expect(mockPush).not.toHaveBeenCalled();
  });
});
