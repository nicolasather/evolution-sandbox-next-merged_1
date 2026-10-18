/** @jest-environment node */
import { checkFileForUpload, MAX_BYTES, MB } from '../media/contract';
import { collectMediaIds, rewriteMediaIds, stripMedia } from '../media/refs';
import { declaredMatches, sniff } from '../media/signatures';
import { blank } from '../editor-model';
import { questionSchema } from '../validation';
import { readFileSync, existsSync } from 'node:fs';

const bytes = (...a: number[]) => { const u = new Uint8Array(64); u.set(a); return u; };
const ascii = (s: string, at = 0) => { const u = new Uint8Array(64); for (let i = 0; i < s.length; i++) u[at + i] = s.charCodeAt(i); return u; };

describe('file signatures', () => {
  it('recognises the allowed types by content', () => {
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe('image/jpeg');
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0, 0, 0, 0, 128);
    expect(sniff(png)).toEqual({ mime: 'image/png', kind: 'image', width: 256, height: 128 });
    expect(sniff(ascii('GIF89a'))?.kind).toBe('gif');
    const webp = ascii('RIFF'); webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniff(webp)?.mime).toBe('image/webp');
    const mp4 = new Uint8Array(64); mp4.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(sniff(mp4)).toEqual({ mime: 'video/mp4', kind: 'video' });
    expect(sniff(bytes(0x1a, 0x45, 0xdf, 0xa3))?.mime).toBe('video/webm');
    const avif = new Uint8Array(64); avif.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
    expect(sniff(avif)?.mime).toBe('image/avif');
  });
  it('rejects SVG, HTML, scripts, executables and HEIC', () => {
    expect(sniff(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniff(ascii('<!DOCTYPE html><script>alert(1)</script>'))).toBeNull();
    expect(sniff(ascii('MZ\x90\x00 executable'))).toBeNull();
    const heic = new Uint8Array(64); heic.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(sniff(heic)).toBeNull();
    expect(sniff(new Uint8Array(4))).toBeNull();
  });
  it('catches a mislabelled file (a PNG declared as a video)', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(declaredMatches('video/mp4', sniff(png)!.mime)).toBe(false);
    expect(declaredMatches('image/png', sniff(png)!.mime)).toBe(true);
  });
  const fixtures = '/tmp/claude-0/-home-claude/6fd4b75b-8650-5bef-96c3-9d66cdd51115/scratchpad/pack/Quiz_Studio_Claude_Pack/tests';
  (existsSync(fixtures) ? it : it.skip)('identifies the package test fixtures', () => {
    expect(sniff(new Uint8Array(readFileSync(`${fixtures}/test-image.png`)))?.mime).toBe('image/png');
    expect(sniff(new Uint8Array(readFileSync(`${fixtures}/test-animated.gif`)))?.kind).toBe('gif');
    expect(sniff(new Uint8Array(readFileSync(`${fixtures}/test-video.mp4`)))?.mime).toBe('video/mp4');
  });
});

describe('upload limits', () => {
  it('rejects svg, unknown types, empty and oversized files with a reason', () => {
    expect(checkFileForUpload('image/svg+xml', 10)).toMatch(/SVG/);
    expect(checkFileForUpload('application/pdf', 10)).toMatch(/isn’t supported/);
    expect(checkFileForUpload('image/png', 0)).toMatch(/empty/);
    expect(checkFileForUpload('image/png', MAX_BYTES.image + 1)).toMatch(/8 MB/);
    expect(checkFileForUpload('image/gif', 16 * MB)).toMatch(/15 MB/);
    expect(checkFileForUpload('video/mp4', 51 * MB)).toMatch(/50 MB/);
  });
  it('accepts files within limits and enforces per-role kinds', () => {
    expect(checkFileForUpload('image/jpeg', 2 * MB)).toBeNull();
    expect(checkFileForUpload('video/mp4', 20 * MB)).toBeNull();
    expect(checkFileForUpload('video/mp4', 1 * MB, ['image', 'gif'])).toMatch(/can’t be used here/);
  });
});

const ID1 = '11111111-1111-4111-8111-111111111111', ID2 = '22222222-2222-4222-8222-222222222222', ID3 = '33333333-3333-4333-8333-333333333333';
describe('media references in questions', () => {
  const mk = (): any => {
    const q: any = blank('multiple_choice'); q.prompt = 'Q'; q.payload.media = { id: ID1, kind: 'image', alt: 'A diagram of a plant' };
    q.payload.options[0].media = { id: ID2, kind: 'gif', alt: 'Spinning wheel' }; q.payload.options[1].text = 'B'; q.payload.options[2].text = 'C'; q.payload.options[3].text = 'D';
    return q;
  };
  it('a picture-only option and question media pass the strict schema', () => {
    const q = mk(); q.payload.options[0].text = '';
    expect(questionSchema.safeParse(q).success).toBe(true);
  });
  it('an option with neither text nor picture, or media without alt text, fails', () => {
    const q = mk(); q.payload.options[0].media = undefined; q.payload.options[0].text = ' ';
    expect(questionSchema.safeParse(q).success).toBe(false);
    const r = mk(); r.payload.media.alt = ' ';
    expect(questionSchema.safeParse(r).success).toBe(false);
  });
  it('alt text that gives the answer away is rejected', () => {
    const q = mk(); q.payload.options[0].text = 'Saturn'; q.payload.media.alt = 'A photo of the planet Saturn and its rings';
    expect(questionSchema.safeParse(q).success).toBe(false);
  });
  it('collects, rewrites and strips media ids', () => {
    const q = mk(); q.payload.media.posterId = ID3;
    expect(collectMediaIds([q], { coverMediaId: 'c0' }).sort()).toEqual([ID1, ID2, ID3, 'c0'].sort());
    const re = rewriteMediaIds([q], { [ID1]: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect((re[0]!.payload as any).media.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); expect(q.payload.media.id).toBe(ID1);
    const s = stripMedia([q], (id) => id === ID2);
    expect(s.removed).toBe(1); expect((s.questions[0]!.payload as any).media).toBeUndefined(); expect((s.questions[0]!.payload as any).options[0].media.id).toBe(ID2);
  });
});
