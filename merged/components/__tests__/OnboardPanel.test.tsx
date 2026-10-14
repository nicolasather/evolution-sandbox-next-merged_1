import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardPanel } from '../admin/OnboardPanel';

describe('OnboardPanel', () => {
  it('lists new items and runs a batch, in Vietnamese, with the token only in the Authorization header', async () => {
    const f = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ items: [{ itemId: 'hand_adze', name: 'Hand adze', needsAsset: true, needsRoutes: true }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ pending: 0, processed: [{ itemId: 'hand_adze', asset: 'queued', routes: 'proposals', proposalsCreated: 1, rejected: 0 }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ items: [] }) });
    global.fetch = f as unknown as typeof fetch;
    render(<OnboardPanel />);
    fireEvent.change(screen.getByLabelText(/Mã chủ sở hữu/), { target: { value: 'tok' } });
    fireEvent.click(screen.getByRole('button', { name: /Xem vật phẩm mới/ }));
    await waitFor(() => expect(screen.getByText(/Hand adze \(hand_adze\)/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Xử lý tối đa 3/ }));
    await waitFor(() => expect(screen.getByText(/1 đề xuất mới/)).toBeTruthy());
    expect(screen.getByText(/chờ anh duyệt/, { selector: 'li' })).toBeTruthy();
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(String(f.mock.calls[0][0])).not.toContain('tok');
  });
  it('explains a closed endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.reject(new Error('empty')) }) as unknown as typeof fetch;
    render(<OnboardPanel />);
    fireEvent.change(screen.getByLabelText(/Mã chủ sở hữu/), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('button', { name: /Xem vật phẩm mới/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/đang đóng/));
  });
});
