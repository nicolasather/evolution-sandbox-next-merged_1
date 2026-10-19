/** @jest-environment node */
import {
  LIMITS, MAX_UPLOAD_BYTES, PROXY_UPLOAD_MAX_BYTES, USER_QUOTA_BYTES, checkUpload, imageSize, isStoragePath, mediaSeconds, mp3Seconds, precheckHead, wavSeconds, webmSeconds,
} from '../media';
import { canReadMedia } from '../media-access';
import { mediaSchema } from '../validation';
import { ApiError } from '../client';
import { withRetry } from '../upload-client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const OWNER = '11111111-1111-1111-1111-111111111111';
const ASSET = '22222222-2222-2222-2222-222222222222';
const REF = (ext: string) => `quiz-media/${OWNER}/${ASSET}.${ext}`;

/* ── tiny hand-made files ─────────────────────────────────────────────────────────────────────────────────────────── */
function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const dv = new DataView(b.buffer); dv.setUint32(16, w); dv.setUint32(20, h); return b;
}
function gif(w: number, h: number): Uint8Array { const b = new Uint8Array(20); b.set(Buffer.from('GIF89a')); const dv = new DataView(b.buffer); dv.setUint16(6, w, true); dv.setUint16(8, h, true); return b; }
function jpeg(w: number, h: number): Uint8Array {
  const b = new Uint8Array(40); b.set([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0]); // SOI + APP0 (length 4 → next marker at +6)
  b.set([0xff, 0xc0, 0, 11, 8], 8); const dv = new DataView(b.buffer); dv.setUint16(13, h); dv.setUint16(15, w); return b;
}
function webpLossy(w: number, h: number): Uint8Array { const b = new Uint8Array(40); b.set(Buffer.from('RIFF')); b.set(Buffer.from('WEBP'), 8); b.set(Buffer.from('VP8 '), 12); const dv = new DataView(b.buffer); dv.setUint16(26, w, true); dv.setUint16(28, h, true); return b; }
function mp4(seconds: number, padBefore = 0, padAfter = 0): Uint8Array {
  const ftyp = Uint8Array.from([0, 0, 0, 24, ...Buffer.from('ftypisom'), 0, 0, 0, 0, ...Buffer.from('isom'), ...Array(4).fill(0)]);
  const mvhd = new Uint8Array(32); mvhd.set(Buffer.from('mvhd')); const dv = new DataView(mvhd.buffer); dv.setUint32(16, 1000); dv.setUint32(20, Math.round(seconds * 1000));
  return Uint8Array.from([...ftyp, ...Array(padBefore).fill(1), ...mvhd, ...Array(padAfter).fill(1)]);
}
function wav(seconds: number): Uint8Array {
  const rate = 8000; const data = rate * seconds; const b = new Uint8Array(44 + data); const dv = new DataView(b.buffer);
  b.set(Buffer.from('RIFF')); b.set(Buffer.from('WAVE'), 8); b.set(Buffer.from('fmt '), 12); dv.setUint32(16, 16, true); dv.setUint32(28, rate, true); b.set(Buffer.from('data'), 36); dv.setUint32(40, data, true);
  return b;
}
function webm(seconds: number): Uint8Array {
  const b = new Uint8Array(64); b.set([0x1a, 0x45, 0xdf, 0xa3]); b.set([0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40], 8); // TimecodeScale = 1,000,000
  b.set([0x44, 0x89, 0x88], 20); new DataView(b.buffer).setFloat64(23, seconds * 1000); return b;
}
function mp3(kbps128Seconds: number): Uint8Array { const size = Math.round((128_000 / 8) * kbps128Seconds); const b = new Uint8Array(size); b.set([0xff, 0xfb, 0x90, 0x00]); return b; }

describe('one canonical size policy (M08/M09)', () => {
  it('derives every limit from LIMITS, in exact bytes', () => {
    expect(LIMITS.image.maxBytes).toBe(5_242_880); expect(LIMITS.video.maxBytes).toBe(26_214_400); expect(LIMITS.audio.maxBytes).toBe(10_485_760);
    expect(MAX_UPLOAD_BYTES).toBe(26_214_400);   // == migration 005: bytes between 1 and 26214400
    expect(PROXY_UPLOAD_MAX_BYTES).toBeLessThan(4_500_000); // Vercel rejects bigger request bodies before our code runs
  });
  it('accepts exactly the cap and rejects one byte more, for every kind', () => {
    const v = mp4(10); const a = wav(5); const i = png(10, 10);
    expect(precheckHead(v, LIMITS.video.maxBytes)).toMatchObject({ ok: true, kind: 'video' });
    expect(precheckHead(v, LIMITS.video.maxBytes + 1)).toMatchObject({ ok: false, code: 'too_large' });
    expect(precheckHead(i, LIMITS.image.maxBytes)).toMatchObject({ ok: true, kind: 'image' });
    expect(precheckHead(i, LIMITS.image.maxBytes + 1)).toMatchObject({ ok: false, code: 'too_large' });
    expect(precheckHead(a, LIMITS.audio.maxBytes)).toMatchObject({ ok: true, kind: 'audio' });
    expect(precheckHead(a, LIMITS.audio.maxBytes + 1)).toMatchObject({ ok: false, code: 'too_large' });
    expect(precheckHead(v, MAX_UPLOAD_BYTES + 1)).toMatchObject({ ok: false, code: 'too_large' });
    expect(precheckHead(v, 0)).toMatchObject({ ok: false, code: 'empty' });
  });
  it('the error text states the real limit', () => {
    const r = precheckHead(png(1, 1), LIMITS.image.maxBytes + 1); expect(!r.ok && r.message).toMatch(/limit is 5 MB/);
  });
});

describe('storage path validation (M10/M18)', () => {
  it.each(['png', 'jpg', 'gif', 'webp', 'avif', 'mp4', 'webm', 'mp3', 'm4a', 'wav'])('accepts a well-formed .%s path', (e) => expect(isStoragePath(REF(e))).toBe(true));
  it.each([
    'https://evil.example/x.png', 'http://169.254.169.254/latest/meta-data', `quiz-media/${OWNER}/../${ASSET}.png`, `quiz-media/${OWNER}/${ASSET}.svg`, `quiz-media/${OWNER}/${ASSET}.html`,
    `other/${OWNER}/${ASSET}.png`, `quiz-media/${OWNER}/${ASSET}.png?x=1`, `quiz-media/${OWNER}/${ASSET}.png/extra`, `quiz-media/x/${ASSET}.png`, '', 'javascript:alert(1)', 'data:image/png;base64,AAAA',
  ])('rejects %s', (r) => expect(isStoragePath(r)).toBe(false));
});

describe('a forged media reference cannot be saved', () => {
  const ok = { type: 'image' as const, ref: REF('png'), alt: 'a picture' };
  it('accepts a real upload reference and an allow-listed embed', () => {
    expect(mediaSchema.safeParse(ok).success).toBe(true);
    expect(mediaSchema.safeParse({ type: 'embed', ref: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', alt: 'x' }).success).toBe(true);
  });
  it.each([
    { ...ok, ref: 'https://tracker.example/pixel.png' }, { ...ok, ref: '//evil.example/a.png' }, { ...ok, ref: `quiz-media/${OWNER}/${ASSET}.svg` },
    { type: 'embed', ref: 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', alt: 'x' }, { type: 'embed', ref: REF('png'), alt: 'x' },
    { type: 'video', ref: REF('mp4'), transcript: 'hello', poster: 'https://evil.example/p.png' },
  ])('rejects %j', (m) => expect(mediaSchema.safeParse(m).success).toBe(false));
});

describe('the server reads size and length from the file itself (M12)', () => {
  it('reads pixel size from PNG, GIF, JPEG and WebP headers', () => {
    expect(imageSize(png(640, 480), 'image/png')).toEqual({ width: 640, height: 480 });
    expect(imageSize(gif(320, 200), 'image/gif')).toEqual({ width: 320, height: 200 });
    expect(imageSize(jpeg(1024, 768), 'image/jpeg')).toEqual({ width: 1024, height: 768 });
    expect(imageSize(webpLossy(800, 600), 'image/webp')).toEqual({ width: 800, height: 600 });
  });
  it('an over-sized image is refused even if the browser claims it is small', () => {
    expect(checkUpload(png(9000, 100), { strict: true })).toMatchObject({ ok: false, code: 'dimensions' });
    expect(checkUpload(png(9000, 100), { strict: true, width: 10, height: 10 })).toMatchObject({ ok: false, code: 'dimensions' }); // forged dimensions ignored
    expect(checkUpload(png(4096, 4096), { strict: true })).toMatchObject({ ok: true });
    expect(checkUpload(png(4097, 1), { strict: true })).toMatchObject({ ok: false, code: 'dimensions' });
  });
  it('an unreadable image header is refused in strict mode', () => {
    const junk = new Uint8Array(40); junk.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // valid signature, truncated header → size 0×0 is read, not undefined
    expect(checkUpload(junk.slice(0, 20), { strict: true })).toMatchObject({ ok: false, code: 'unreadable' });
  });
  it('video and audio length: MP4 (even with moov at the END of a big file), WebM, WAV, MP3', () => {
    expect(mediaSeconds('video/mp4', mp4(42))).toBe(42);
    expect(mediaSeconds('video/mp4', mp4(42, 200, 5_000_000))).toBe(42);
    expect(webmSeconds(webm(30))).toBeCloseTo(30, 3);
    expect(wavSeconds(wav(12))).toBe(12);
    expect(mp3Seconds(mp3(60))).toBeGreaterThan(59); expect(mp3Seconds(mp3(60))).toBeLessThan(61);
  });
  it('a 90 s video is refused even when the browser says it lasts 5 s', () => {
    expect(checkUpload(mp4(90), { strict: true, seconds: 5 })).toMatchObject({ ok: false, code: 'too_long' });
    expect(checkUpload(mp4(60), { strict: true })).toMatchObject({ ok: true, kind: 'video' });
    expect(checkUpload(webm(61), { strict: true })).toMatchObject({ ok: false, code: 'too_long' });
    expect(checkUpload(wav(301), { strict: true })).toMatchObject({ ok: false, code: 'too_long' });
    expect(checkUpload(mp3(301), { strict: true })).toMatchObject({ ok: false, code: 'too_long' });
  });
  it('a WAV header that lies about its length cannot shorten the clip', () => {
    const real = wav(400); new DataView(real.buffer).setUint32(40, 8000, true); // header says 1 s, file holds 400 s
    expect(checkUpload(real, { strict: true })).toMatchObject({ ok: false, code: 'too_long' });
  });
  it('a video whose length cannot be established is refused (not trusted)', () => {
    const noLen = Uint8Array.from([0, 0, 0, 24, ...Buffer.from('ftypisom'), 0, 0, 0, 0, ...Buffer.from('isom'), ...Array(40).fill(7)]);
    expect(checkUpload(noLen, { strict: true })).toMatchObject({ ok: false, code: 'unreadable' });
  });
  it('quota is enforced against bytes already stored', () => {
    expect(checkUpload(png(10, 10), { strict: true, usedBytes: USER_QUOTA_BYTES })).toMatchObject({ ok: false, code: 'quota' });
  });
  it('renamed SVG / HTML / executables are refused regardless of name or declared type', () => {
    const pad = ' '.repeat(40);
    for (const evil of ['<svg xmlns="http://www.w3.org/2000/svg"/>', '<!doctype html><script>1</script>', 'MZ\u0090\u0000\u0003', '#!/bin/sh\nid']) {
      expect(checkUpload(Buffer.from(evil + pad), { strict: true })).toMatchObject({ ok: false });
      expect(precheckHead(Buffer.from(evil + pad), 100)).toMatchObject({ ok: false });
    }
  });
});

describe('who may read a file (M01–M06, M13)', () => {
  const ready = { owner_id: 'owner', status: 'ready' };
  const no = async () => false; const yes = async () => true;
  it('M01 owner reads own private file', async () => expect(await canReadMedia({ asset: ready, userId: 'owner', inPublishedQuiz: no })).toBe(true));
  it('M02 a visitor with no session reads media of a published quiz', async () => expect(await canReadMedia({ asset: ready, userId: null, inPublishedQuiz: yes })).toBe(true));
  it('M03 a visitor cannot read a draft / unreferenced file', async () => expect(await canReadMedia({ asset: ready, userId: null, inPublishedQuiz: no })).toBe(false));
  it('M04 another signed-in user cannot read it either', async () => expect(await canReadMedia({ asset: ready, userId: 'other', inPublishedQuiz: no })).toBe(false));
  it('M05 a room member reads media in the room snapshot', async () => expect(await canReadMedia({ asset: ready, userId: null, inPublishedQuiz: no, room: { member: yes, inSnapshot: yes } })).toBe(true));
  it('M06 a wrong/expired token (not a member) is denied, and so is a member asking for media outside the snapshot', async () => {
    expect(await canReadMedia({ asset: ready, userId: null, inPublishedQuiz: no, room: { member: no, inSnapshot: yes } })).toBe(false);
    expect(await canReadMedia({ asset: ready, userId: null, inPublishedQuiz: no, room: { member: yes, inSnapshot: no } })).toBe(false);
  });
  it('never serves a missing, pending, quarantined or deleted asset, even to its owner', async () => {
    for (const status of ['pending', 'quarantined', 'deleted']) expect(await canReadMedia({ asset: { owner_id: 'owner', status }, userId: 'owner', inPublishedQuiz: yes })).toBe(false);
    expect(await canReadMedia({ asset: null, userId: 'owner', inPublishedQuiz: yes })).toBe(false);
  });
  it('does not even run the room lookups when an earlier rule already decided', async () => {
    const member = jest.fn(yes);
    await canReadMedia({ asset: ready, userId: 'owner', inPublishedQuiz: no, room: { member, inSnapshot: yes } });
    expect(member).not.toHaveBeenCalled();
  });
});

describe('browser upload retries only transient failures', () => {
  const fast = (fn: () => Promise<string>, n = 3) => withRetry(fn, n, 1);
  it('retries a dropped connection and a 503, then succeeds', async () => {
    let calls = 0;
    await expect(fast(async () => { calls++; if (calls === 1) throw new TypeError('network'); if (calls === 2) throw new ApiError('busy', 503); return 'ok'; })).resolves.toBe('ok');
    expect(calls).toBe(3);
  });
  it('never retries a definite refusal (400/403/413)', async () => {
    for (const status of [400, 403, 404, 413]) { let calls = 0; await expect(fast(async () => { calls++; throw new ApiError('no', status); })).rejects.toThrow('no'); expect(calls).toBe(1); }
  });
  it('gives up after the bounded number of attempts', async () => {
    let calls = 0; await expect(fast(async () => { calls++; throw new ApiError('down', 500); }, 4)).rejects.toThrow('down'); expect(calls).toBe(4);
  });
});

describe('Content-Security-Policy lets private media and embeds load (regression for blocked uploads)', () => {
  const cfg = readFileSync(join(__dirname, '../../../next.config.ts'), 'utf8');
  it('declares media-src, frame-src for YouTube/Vimeo, and the Supabase origin for img/connect', () => {
    expect(cfg).toMatch(/media-src 'self' \$\{SB\}/);
    expect(cfg).toMatch(/frame-src 'self' https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/);
    expect(cfg).toMatch(/img-src [^`]*\$\{SB\}/); expect(cfg).toMatch(/connect-src 'self' \$\{SB\}/);
  });
  it('does not open scripts or frames to anything else', () => {
    expect(cfg).not.toMatch(/frame-src[^"]*\*/); expect(cfg).toMatch(/frame-ancestors 'none'/);
  });
});
