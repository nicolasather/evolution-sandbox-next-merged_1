/** @jest-environment node */
import zlib from 'node:zlib';
import { sniff, checkUpload, looksDangerous, parseEmbed, isCanonicalEmbedSrc, mediaPath, ownsPath, questionMediaRefs, unreferencedAssets, imageStyle, proposeReplacement, confirmReplacement, cancelReplacement, annotationProblems, mp4Seconds, LIMITS, USER_QUOTA_BYTES } from '../media';
import { parseCsv, readXlsx, suggestMapping, previewImport, exportQuizJson, importQuizJson, parseBulkPaste } from '../portability';
import { questionSchema } from '../validation';

const bytes = (...n: number[]) => Uint8Array.from([...n, ...Array(16).fill(0)]);
const ascii = (s: string, pad = 16) => Uint8Array.from([...Buffer.from(s, 'latin1'), ...Array(pad).fill(0)]);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const ftyp = (brand: string) => Uint8Array.from([0, 0, 0, 24, ...Buffer.from('ftyp'), ...Buffer.from(brand), ...Array(16).fill(0)]);

describe('media sniffing and limits (items 031, 032, 034, 135)', () => {
  it('identifies PNG, JPEG, GIF, WebP, AVIF by content, never by extension', () => {
    expect(sniff(PNG)).toMatchObject({ kind: 'image', mime: 'image/png' });
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({ mime: 'image/jpeg' });
    expect(sniff(ascii('GIF89a'))).toMatchObject({ mime: 'image/gif' });
    expect(sniff(ascii('RIFF\0\0\0\0WEBPVP8 '))).toMatchObject({ mime: 'image/webp' });
    expect(sniff(ftyp('avif'))).toMatchObject({ mime: 'image/avif' });
  });
  it('identifies video and audio', () => {
    expect(sniff(ftyp('isom'))).toMatchObject({ kind: 'video', mime: 'video/mp4' });
    expect(sniff(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x01, 0, 0, 0, 0, 0, 0, 0))).toMatchObject({ mime: 'video/webm' });
    expect(sniff(ftyp('M4A '))).toMatchObject({ kind: 'audio', mime: 'audio/mp4' });
    expect(sniff(ascii('RIFF\0\0\0\0WAVEfmt '))).toMatchObject({ mime: 'audio/wav' });
    expect(sniff(ascii('ID3\x03\0\0\0\0\0\0\0\0'))).toMatchObject({ mime: 'audio/mpeg' });
  });
  it('rejects QuickTime/HEIC, SVG, HTML, scripts, executables and zips even when renamed', () => {
    expect(checkUpload(ftyp('qt  '))).toMatchObject({ ok: false, code: 'unsupported' });
    expect(checkUpload(ftyp('heic'))).toMatchObject({ ok: false });
    for (const evil of ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>', '<html><script>alert(1)</script></html>', '#!/bin/sh\nrm -rf /', '<?xml version="1.0"?><svg/>']) {
      const v = checkUpload(Buffer.from(evil + ' '.repeat(20))); expect(v.ok).toBe(false); expect(v).toMatchObject({ code: 'dangerous' });
    }
    expect(looksDangerous(bytes(0x4d, 0x5a))).toBe(true); expect(looksDangerous(bytes(0x7f, 0x45, 0x4c, 0x46))).toBe(true); expect(looksDangerous(bytes(0x50, 0x4b, 0x03, 0x04))).toBe(true);
  });
  it('enforces size, dimension, duration and quota limits with helpful messages', () => {
    const big = new Uint8Array(LIMITS.image.maxBytes + 1); big.set(PNG);
    expect(checkUpload(big)).toMatchObject({ ok: false, code: 'too_large' });
    expect(checkUpload(PNG, { width: 5000, height: 100 })).toMatchObject({ ok: false, code: 'dimensions' });
    expect(checkUpload(PNG, { width: 800, height: 600 })).toMatchObject({ ok: true, kind: 'image' });
    expect(checkUpload(ftyp('isom'), { seconds: 90 })).toMatchObject({ ok: false, code: 'too_long' });
    expect(checkUpload(PNG, { usedBytes: USER_QUOTA_BYTES })).toMatchObject({ ok: false, code: 'quota' });
    expect(checkUpload(new Uint8Array(0))).toMatchObject({ code: 'empty' });
    const msg = checkUpload(ascii('hello world, not media')); expect(!msg.ok && msg.message).toMatch(/Allowed: images/);
  });
  it('reads MP4 duration from the movie header', () => {
    const mvhd = new Uint8Array(40); const dv = new DataView(mvhd.buffer);
    mvhd.set(Buffer.from('mvhd'), 0); dv.setUint32(16, 1000); dv.setUint32(20, 42_000);
    expect(mp4Seconds(mvhd)).toBe(42);
    expect(checkUpload(Uint8Array.from([...ftyp('isom'), ...mvhd]), {})).toMatchObject({ ok: true });
  });
});

describe('embeds use a strict allow-list (item 033)', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'], ['https://youtu.be/dQw4w9WgXcQ?t=3', 'youtube'], ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube'],
    ['https://vimeo.com/76979871', 'vimeo'], ['https://player.vimeo.com/video/76979871', 'vimeo'],
  ])('accepts %s', (url, provider) => { const e = parseEmbed(url)!; expect(e.provider).toBe(provider); expect(isCanonicalEmbedSrc(e.src)).toBe(true); });
  it.each([
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=short',
    'javascript:alert(1)', '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', 'https://user:pw@www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://vimeo.com/abc', 'data:text/html,<script>1</script>',
  ])('rejects %s', (url) => expect(parseEmbed(url)).toBeNull());
  it('only canonical embed sources may be rendered', () => {
    expect(isCanonicalEmbedSrc('https://evil.com/embed/dQw4w9WgXcQ')).toBe(false);
    expect(isCanonicalEmbedSrc('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&autoplay=1')).toBe(false);
  });
});

describe('storage paths, references and clean-up (items 039, 040)', () => {
  const owner = '11111111-1111-1111-1111-111111111111'; const asset = '22222222-2222-2222-2222-222222222222';
  it('builds owner-scoped paths and checks ownership', () => {
    const p = mediaPath(owner, asset, 'png'); expect(ownsPath(owner, p)).toBe(true); expect(ownsPath('33333333-3333-3333-3333-333333333333', p)).toBe(false);
    expect(ownsPath(owner, `quiz-media/${owner}/../x.png`)).toBe(false); expect(() => mediaPath('../etc', asset, 'png')).toThrow();
  });
  it('collects every reference in prompts, options, tiles and cells, and only releases truly unused assets', () => {
    const ref = (n: number) => `quiz-media/${owner}/${asset.slice(0, -1)}${n}.png`;
    const payload = { media: { type: 'image', ref: ref(1), alt: 'a' }, options: [{ id: 'a', text: 'A', image: { type: 'image', ref: ref(2), alt: 'b' } }], rows: [[{ text: '', blank: false, image: { type: 'image', ref: ref(3), alt: 'c' } }]] };
    expect(questionMediaRefs({ payload }).sort()).toEqual([ref(1), ref(2), ref(3)]);
    const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const stored = [1, 2, 3, 4].map((n) => ({ path: ref(n), createdAt: old })).concat([{ path: ref(5), createdAt: new Date().toISOString() }]);
    expect(unreferencedAssets(stored, [ref(1), ref(2)])).toEqual([ref(3), ref(4)]); // ref(5) is inside the grace period
  });
});

describe('image edits are non-destructive and reversible (items 036, 037)', () => {
  it('expresses focal point, rotation and crop as display rules only', () => {
    expect(imageStyle({ focal: { x: 0.25, y: 0.75 }, rotate: 90, crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } })).toEqual({ objectPosition: '25.0% 75.0%', transform: 'rotate(90deg)', clipPath: 'inset(10.0% 40.0% 40.0% 10.0%)' });
  });
  it('keeps the old asset until the replacement is confirmed', () => {
    const r = proposeReplacement('old', 'new'); expect(r.current).toBe('old');
    expect(cancelReplacement(r)).toEqual({ current: 'old', pending: null }); expect(confirmReplacement(r)).toEqual({ current: 'new', releasable: 'old' });
  });
  it('flags annotations that sit on the answer', () => {
    expect(annotationProblems([{ x: 0.5, y: 0.5, label: 'a' }], [{ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }])).toHaveLength(1);
    expect(annotationProblems([{ x: 0.1, y: 0.1, label: 'a' }], [{ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }])).toHaveLength(0);
  });
});

describe('CSV / XLSX import shows a preview and errors before anything changes (item 041)', () => {
  const csv = 'Question,Answer,Wrong 1,Wrong 2,Points,Explanation\n"What is 2+2?",4,3,5,50,"Basic ""sum"""\nCapital of France?,Paris,,,,\n,Rome,,,,\nBad points,x,y,,abc,';
  it('parses quotes, commas, newlines in quotes, BOM and other delimiters', () => {
    expect(parseCsv('﻿a,b\n"x,1","y\nz"\n')).toEqual([['a', 'b'], ['x,1', 'y\nz']]);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]); expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('suggests a column mapping and previews questions with explicit row errors', () => {
    const rows = parseCsv(csv); const map = suggestMapping(rows[0]!);
    expect(map).toMatchObject({ question: 0, answer: 1, wrong1: 2, wrong2: 3, points: 4, explanation: 5 });
    const p = previewImport(rows, map);
    expect(p.questions).toHaveLength(2); expect(p.questions[0]!.kind).toBe('multiple_choice'); expect(p.questions[1]!.kind).toBe('answer_forge');
    expect((p.questions[0]!.answerKey as any).explanation).toBe('Basic "sum"');
    expect(p.problems.map((x) => x.row)).toEqual([4, 5]); expect(p.problems[0]!.field).toBe('question'); expect(p.problems[1]!.field).toBe('points');
    p.questions.forEach((q) => expect(questionSchema.safeParse(q).success).toBe(true));
  });
  it('requires the question and answer columns to be chosen', () => expect(previewImport([['a', 'b'], ['1', '2']], {}).problems.length).toBeGreaterThan(0));
  it('turns true/false answers into Truth Hunt', () => expect(previewImport([['q', 'a'], ['The sun is a star', 'True']], { question: 0, answer: 1 }).questions[0]!.kind).toBe('truth_hunt'));
  it('reads the first sheet of an .xlsx workbook (stored and deflated entries)', () => {
    const files: Record<string, string> = {
      'xl/sharedStrings.xml': '<sst><si><t>Question</t></si><si><t>Answer</t></si><si><t>Largest planet?</t></si><si><t>Jupiter &amp; co</t></si></sst>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Sum 1+1?</t></is></c><c r="C3"><v>2</v></c></row></sheetData></worksheet>',
    };
    for (const deflate of [false, true]) {
      const parts: Buffer[] = []; const cd: Buffer[] = []; let offset = 0;
      for (const [name, text] of Object.entries(files)) {
        const raw = Buffer.from(text); const data = deflate ? zlib.deflateRawSync(raw) : raw; const nm = Buffer.from(name);
        const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(deflate ? 8 : 0, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
        const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(deflate ? 8 : 0, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(offset, 42);
        parts.push(lh, nm, data); cd.push(ch, nm); offset += 30 + nm.length + data.length;
      }
      const cdBuf = Buffer.concat(cd); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
      const rows = readXlsx(new Uint8Array(Buffer.concat([...parts, cdBuf, end])), (b) => new Uint8Array(zlib.inflateRawSync(b)));
      expect(rows).toEqual([['Question', 'Answer'], ['Largest planet?', 'Jupiter & co'], ['Sum 1+1?', '', '2']]);
    }
    expect(() => readXlsx(new Uint8Array(40), (b) => b)).toThrow(/not a valid/);
  });
});

describe('versioned JSON backup (item 042)', () => {
  const doc = { title: 'T', description: 'D', meta: { subject: 'Math', language: 'en', tags: ['a'] }, questions: [{ kind: 'answer_forge', prompt: 'p', basePoints: 10, payload: { placeholder: 'x', caseSensitive: false }, answerKey: { accepted: ['a'], explanation: 'Because' } }] as any };
  it('round-trips metadata and explanations', () => {
    const r = importQuizJson(exportQuizJson(doc)); expect(r.ok && r.doc).toEqual(doc); expect(r.ok && r.fromVersion).toBe(2);
  });
  it('reads the earlier v1 backup format and reports invalid questions instead of dropping them silently', () => {
    const v1 = JSON.stringify({ app: 'quiz-studio', version: 1, title: 'Old', description: '', questions: [doc.questions[0], { kind: 'multiple_choice', prompt: '', basePoints: 1, payload: {}, answerKey: {} }] });
    const r = importQuizJson(v1); expect(r.ok && r.fromVersion).toBe(1); expect(r.ok && r.doc.questions).toHaveLength(1); expect(r.ok && r.problems).toHaveLength(1);
  });
  it('refuses files from the future, other apps and garbage', () => {
    expect(importQuizJson(JSON.stringify({ schema: 'quiz-studio.quiz', version: 99, questions: [] }))).toMatchObject({ ok: false });
    expect(importQuizJson('{"hello":1}')).toMatchObject({ ok: false }); expect(importQuizJson('nope')).toMatchObject({ ok: false });
  });
});

describe('bulk paste always yields a correction list (item 043)', () => {
  it('parses numbered questions with lettered options and a marked answer', () => {
    const items = parseBulkPaste('1. Largest planet?\nA) Mars\nB) Jupiter *\nC) Venus\n\n2) Capital of Japan?\nA. Osaka\nB. Tokyo\nAnswer: B\n3. Water formula?\nAnswer: H2O | water');
    expect(items).toHaveLength(3);
    const k = (i: number) => (items[i]!.question!.answerKey as any);
    expect((items[0]!.question!.payload as any).options[k(0).correctIds[0] === (items[0]!.question!.payload as any).options[1].id ? 1 : 0].text).toBe('Jupiter');
    expect(items[1]!.warnings).toHaveLength(0); expect(items[2]!.question!.kind).toBe('answer_forge'); expect(k(2).accepted).toEqual(['H2O', 'water']);
  });
  it('parses question | answer lines and warns about lines it cannot use', () => {
    const items = parseBulkPaste('Capital of France? | Paris\nnot a pair'); expect(items[0]!.question!.kind).toBe('answer_forge'); expect(items[1]!.question).toBeNull(); expect(items[1]!.warnings[0]).toMatch(/question \| answer/);
  });
  it('flags a numbered question with no answer', () => expect(parseBulkPaste('1. Mystery?\nA) x\nB) y')[0]!.warnings.join()).toMatch(/Mark the correct option/));
});
