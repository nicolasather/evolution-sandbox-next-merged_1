/** @jest-environment node */
import { tryRecipeOnServer, __resetCreativeClient } from '../client';

const ok = (kind: string, status = 200) => (async () => new Response(JSON.stringify({ kind }), { status })) as unknown as typeof fetch;
beforeEach(() => __resetCreativeClient());

describe('087 client', () => {
  it('is a no-op when the UI flag is off (default): zero network', async () => {
    const f = jest.fn();
    expect(await tryRecipeOnServer(['a_b', 'c_d'], null, { fetchImpl: f as never })).toBe('nothing');
    expect(f).not.toHaveBeenCalled();
  });
  it('maps pending_review; everything else (none, unavailable, 4xx/5xx, bad json, offline, timeout) is "nothing", never a throw', async () => {
    expect(await tryRecipeOnServer(['a_b', 'c_d'], null, { enabled: true, fetchImpl: ok('pending_review') })).toBe('pending_review');
    expect(await tryRecipeOnServer(['a_b', 'c_e'], null, { enabled: true, fetchImpl: ok('no_result') })).toBe('nothing');
    expect(await tryRecipeOnServer(['a_b', 'c_f'], null, { enabled: true, fetchImpl: ok('unavailable', 503) })).toBe('nothing');
    expect(await tryRecipeOnServer(['a_b', 'c_g'], null, { enabled: true, fetchImpl: (async () => new Response('<html>', { status: 200 })) as never })).toBe('nothing');
    expect(await tryRecipeOnServer(['a_b', 'c_h'], null, { enabled: true, fetchImpl: (async () => { throw new TypeError('offline'); }) as never })).toBe('nothing');
    const hang = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))))) as never;
    expect(await tryRecipeOnServer(['a_b', 'c_i'], null, { enabled: true, fetchImpl: hang, timeoutMs: 20 })).toBe('nothing');
  });
  it('sends only ids, action, release hash and an attempt id; each distinct attempt is sent once per session', async () => {
    const f = jest.fn(ok('no_result'));
    await tryRecipeOnServer(['x_a', 'y_b'], 'bind', { enabled: true, fetchImpl: f as never });
    await tryRecipeOnServer(['y_b', 'x_a'], 'bind', { enabled: true, fetchImpl: f as never });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/creative/try-recipe');
    expect(init.credentials).toBe('omit');
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(['actionId', 'attemptId', 'ingredientIds', 'releaseHash', 'schemaVersion']);
    expect(body.attemptId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
