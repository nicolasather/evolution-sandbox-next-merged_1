import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Reconstruction3D } from '../Reconstruction3D';
import { RecipeReview } from '../admin/RecipeReview';

describe('Reconstruction3D', () => {
  it('draws a labelled flat silhouette when WebGL is unavailable (jsdom)', () => {
    const { container } = render(<Reconstruction3D itemId="zz_x" archetype="blade" family="stone" name="Blade X" />);
    expect(screen.getByRole('img', { name: /stylised reconstruction/i })).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.textContent).toMatch(/not a measured shape/i);
  });
  it('unknown archetype still renders (abstract fallback), never throws', () => {
    const { container } = render(<Reconstruction3D itemId="zz_y" archetype="nonsense" family="???" name="Y" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('RecipeReview', () => {
  const props = { targets: [{ id: 'a', name: 'A', recipe: ['stone', 'wood', 'bone'] }], names: { stone: 'Stone', wood: 'Wood', bone: 'Bone' } };
  it('shows a Vietnamese error when the endpoint is closed (empty 404)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.reject(new Error('empty')) }) as unknown as typeof fetch;
    render(<RecipeReview {...props} />);
    fireEvent.change(screen.getByLabelText(/Mã chủ sở hữu/), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('button', { name: /Xin đề xuất/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/đang đóng/));
  });
  it('lists a valid proposal with ingredient names and never saves anything', async () => {
    const out = { targetId: 'a', outcome: 'proposals', reasons: [], results: [{ index: 0, status: 'schema_valid', reasons: [], recipeKey: 'k', proposal: { ingredientIds: ['stone', 'bone', 'bone'], explanation: 'x', evidenceClass: 'plausible_reconstruction' } }] };
    const f = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(out) });
    global.fetch = f as unknown as typeof fetch;
    render(<RecipeReview {...props} />);
    fireEvent.change(screen.getByLabelText(/Mã chủ sở hữu/), { target: { value: 't' } });
    fireEvent.click(screen.getByRole('button', { name: /Xin đề xuất/ }));
    await waitFor(() => expect(screen.getByText(/Stone \+ Bone \+ Bone/)).toBeTruthy());
    expect(f).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });
});
