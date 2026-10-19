/** Media rules for Quiz Studio (items 031-040, 135). Pure and dependency-free so the same checks run in the browser (before upload),
 *  in the upload route (authoritative) and in tests. Type is decided by magic bytes, never by file extension or the browser's claim. */

export type MediaKind = 'image' | 'video' | 'audio';
export type Sniffed = { kind: MediaKind; mime: string; ext: string } | null;

export const LIMITS = {
  image: { maxBytes: 5 * 1024 * 1024, maxWidth: 4096, maxHeight: 4096, label: 'PNG, JPEG, WebP, AVIF or GIF up to 5 MB and 4096 × 4096 px' },
  video: { maxBytes: 25 * 1024 * 1024, maxSeconds: 60, label: 'MP4 (H.264) or WebM up to 25 MB and 60 seconds' },
  audio: { maxBytes: 10 * 1024 * 1024, maxSeconds: 300, label: 'MP3, M4A or WAV up to 10 MB and 5 minutes' },
} as const;
/** Per-user storage quota across all of a user's assets (item 039). */
export const USER_QUOTA_BYTES = 200 * 1024 * 1024;

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.slice(start, start + len));
const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Identify an upload from its first bytes. Returns null for anything that is not an allowed image, video or audio file —
 *  including SVG, HTML, scripts and executables, which are never accepted. */
export function sniff(bytes: Uint8Array): Sniffed {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return { kind: 'image', mime: 'image/gif', ext: 'gif' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return { kind: 'audio', mime: 'audio/wav', ext: 'wav' };
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return { kind: 'image', mime: 'image/avif', ext: 'avif' };
    if (brand === 'M4A ' || brand === 'M4B ') return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a' };
    if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'dash'].includes(brand)) return { kind: 'video', mime: 'video/mp4', ext: 'mp4' };
    return null; // e.g. "qt  " (QuickTime .mov), HEIC: a codec/container we do not play reliably
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'video', mime: 'video/webm', ext: 'webm' };
  if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}

/** Content that must never be stored even if it were renamed: scripts, markup, SVG and executables. */
export function looksDangerous(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 2048)).trimStart().toLowerCase();
  if (head.startsWith('<') || head.startsWith('#!') || head.includes('<script') || head.includes('<svg') || head.includes('javascript:')) return true;
  if (startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) || startsWith(bytes, [0xca, 0xfe, 0xba, 0xbe])) return true; // PE, ELF, Mach-O/Java
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return true; // zip/jar/office containers
  return false;
}

export type UploadVerdict =
  | { ok: true; kind: MediaKind; mime: string; ext: string }
  | { ok: false; code: 'empty' | 'too_large' | 'unsupported' | 'dangerous' | 'quota' | 'too_long' | 'dimensions'; message: string };

export function checkUpload(bytes: Uint8Array, opts: { usedBytes?: number; quotaBytes?: number; width?: number; height?: number; seconds?: number } = {}): UploadVerdict {
  if (bytes.length === 0) return { ok: false, code: 'empty', message: 'The file is empty.' };
  if (looksDangerous(bytes)) return { ok: false, code: 'dangerous', message: 'This file looks like a web page, script, SVG or program. Only plain images, short videos and audio are allowed.' };
  const t = sniff(bytes);
  if (!t) return { ok: false, code: 'unsupported', message: `We could not recognise this file. Allowed: images (${LIMITS.image.label}); video (${LIMITS.video.label}); audio (${LIMITS.audio.label}). iPhone .mov and HEIC files need converting to MP4 or JPEG first.` };
  const lim = LIMITS[t.kind];
  if (bytes.length > lim.maxBytes) return { ok: false, code: 'too_large', message: `This ${t.kind} is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is ${(lim.maxBytes / 1048576).toFixed(0)} MB.` };
  if (t.kind === 'image' && opts.width && opts.height && (opts.width > LIMITS.image.maxWidth || opts.height > LIMITS.image.maxHeight)) {
    return { ok: false, code: 'dimensions', message: `This image is ${opts.width} × ${opts.height} px; the maximum is ${LIMITS.image.maxWidth} × ${LIMITS.image.maxHeight}.` };
  }
  const seconds = opts.seconds ?? (t.mime === 'video/mp4' ? mp4Seconds(bytes) ?? undefined : undefined);
  if ((t.kind === 'video' || t.kind === 'audio') && seconds && seconds > LIMITS[t.kind].maxSeconds) {
    return { ok: false, code: 'too_long', message: `This ${t.kind} is ${Math.round(seconds)} seconds; the limit is ${LIMITS[t.kind].maxSeconds}.` };
  }
  if ((opts.usedBytes ?? 0) + bytes.length > (opts.quotaBytes ?? USER_QUOTA_BYTES)) return { ok: false, code: 'quota', message: 'This upload would go over your storage allowance. Delete media you no longer use and try again.' };
  return { ok: true, kind: t.kind, mime: t.mime, ext: t.ext };
}

/** Duration from the MP4 'mvhd' box; null when it cannot be read. */
export function mp4Seconds(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idx = (() => { for (let i = 0; i < Math.min(bytes.length - 8, 4_000_000); i++) if (bytes[i] === 0x6d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x68 && bytes[i + 3] === 0x64) return i; return -1; })();
  if (idx < 0) return null;
  const version = view.getUint8(idx + 4);
  try {
    if (version === 0) { const scale = view.getUint32(idx + 16); const dur = view.getUint32(idx + 20); return scale ? dur / scale : null; }
    const scale = view.getUint32(idx + 24); const dur = Number(view.getBigUint64(idx + 28)); return scale ? dur / scale : null;
  } catch { return null; }
}

/* ── Embeds (item 033): a strict allow-list, canonical URLs only, never raw iframe HTML ─────────────────────────────────── */
export type Embed = { provider: 'youtube' | 'vimeo'; id: string; src: string; watchUrl: string };
const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);
const VM_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

export function parseEmbed(input: string): Embed | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase();
  if (YT_HOSTS.has(host)) {
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? '';
    else if (u.pathname === '/watch') id = u.searchParams.get('v') ?? '';
    else { const m = /^\/(?:embed|shorts|live)\/([^/?]+)/.exec(u.pathname); id = m?.[1] ?? ''; }
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { provider: 'youtube', id, src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`, watchUrl: `https://www.youtube.com/watch?v=${id}` };
  }
  if (VM_HOSTS.has(host)) {
    const m = host === 'player.vimeo.com' ? /^\/video\/(\d{4,12})/.exec(u.pathname) : /^\/(?:channels\/[^/]+\/)?(\d{4,12})(?:\/|$)/.exec(u.pathname);
    if (!m) return null;
    return { provider: 'vimeo', id: m[1]!, src: `https://player.vimeo.com/video/${m[1]}?dnt=1`, watchUrl: `https://vimeo.com/${m[1]}` };
  }
  return null;
}
/** Attributes every embed iframe must carry. */
export const EMBED_IFRAME_ATTRS = {
  sandbox: 'allow-scripts allow-same-origin allow-presentation',
  referrerPolicy: 'strict-origin-when-cross-origin',
  allow: 'fullscreen; picture-in-picture',
  loading: 'lazy',
} as const;
/** Only canonical embed `src` values produced by parseEmbed() may ever be rendered. */
export function isCanonicalEmbedSrc(src: string): boolean {
  return /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?rel=0&modestbranding=1$/.test(src) || /^https:\/\/player\.vimeo\.com\/video\/\d{4,12}\?dnt=1$/.test(src);
}

/* ── Paths, ownership, references and garbage collection (items 039, 040, 018) ───────────────────────────────────────── */
export const BUCKET = 'quiz-media';
export function mediaPath(ownerId: string, assetId: string, ext: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !/^[0-9a-f-]{36}$/i.test(assetId) || !/^[a-z0-9]{2,5}$/.test(ext)) throw new Error('Invalid media path parts');
  return `${BUCKET}/${ownerId}/${assetId}.${ext}`;
}
export function ownsPath(ownerId: string, path: string): boolean {
  return path.startsWith(`${BUCKET}/${ownerId}/`) && !path.includes('..') && path.split('/').length === 3;
}
type WithMedia = { payload: Record<string, unknown> };
/** Every storage path a question points to (prompt media, option images, tiles, statements, cells). */
export function questionMediaRefs(q: WithMedia): string[] {
  const out = new Set<string>();
  const visit = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(visit); return; }
    const o = v as Record<string, unknown>;
    if ((o.type === 'image' || o.type === 'video' || o.type === 'audio') && typeof o.ref === 'string' && o.ref.startsWith(`${BUCKET}/`)) out.add(o.ref);
    if (typeof o.poster === 'string' && o.poster.startsWith(`${BUCKET}/`)) out.add(o.poster);
    Object.values(o).forEach(visit);
  };
  visit(q.payload);
  return [...out];
}
export function quizMediaRefs(questions: WithMedia[]): string[] { return [...new Set(questions.flatMap(questionMediaRefs))]; }

/** Assets nothing references any more. `referencedElsewhere` must include every other quiz, revision snapshot and live room (item 040). */
export function unreferencedAssets(stored: { path: string; createdAt: string }[], referenced: Iterable<string>, graceHours = 24, now = Date.now()): string[] {
  const keep = new Set(referenced);
  return stored.filter((a) => !keep.has(a.path) && now - Date.parse(a.createdAt) > graceHours * 3_600_000).map((a) => a.path);
}
/** When pasting questions into another quiz: media the person does not own cannot be carried over (item 018). */
export function carryOverMedia<Q extends WithMedia>(q: Q, ownerId: string, exists: (path: string) => boolean): { question: Q; dropped: string[] } {
  const dropped: string[] = [];
  const clone = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(clone);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if ((o.type === 'image' || o.type === 'video' || o.type === 'audio') && typeof o.ref === 'string' && o.ref.startsWith(`${BUCKET}/`) && (!ownsPath(ownerId, o.ref) || !exists(o.ref))) { dropped.push(o.ref); return undefined; }
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, clone(x)]).filter(([, x]) => x !== undefined));
    }
    return v;
  };
  return { question: { ...q, payload: clone(q.payload) as Record<string, unknown> }, dropped };
}

/* ── Non-destructive image edits (item 036) and annotations (item 037) ──────────────────────────────────────────────── */
export type ImageEdits = { focal?: { x: number; y: number }; rotate?: 0 | 90 | 180 | 270; crop?: { x: number; y: number; w: number; h: number } };
/** CSS for display; the stored source asset is never modified. */
export function imageStyle(m: ImageEdits): { objectPosition: string; transform?: string; clipPath?: string } {
  const f = m.focal ?? { x: 0.5, y: 0.5 };
  const style: { objectPosition: string; transform?: string; clipPath?: string } = { objectPosition: `${(f.x * 100).toFixed(1)}% ${(f.y * 100).toFixed(1)}%` };
  if (m.rotate) style.transform = `rotate(${m.rotate}deg)`;
  if (m.crop) {
    const { x, y, w, h } = m.crop;
    style.clipPath = `inset(${(y * 100).toFixed(1)}% ${((1 - x - w) * 100).toFixed(1)}% ${((1 - y - h) * 100).toFixed(1)}% ${(x * 100).toFixed(1)}%)`;
  }
  return style;
}
/** A replacement stays pending: the old asset is only released after the creator confirms (reversible). */
export type Replacement = { current: string; pending: string | null };
export const proposeReplacement = (current: string, next: string): Replacement => ({ current, pending: next });
export const confirmReplacement = (r: Replacement): { current: string; releasable: string | null } => ({ current: r.pending ?? r.current, releasable: r.pending ? r.current : null });
export const cancelReplacement = (r: Replacement): Replacement => ({ current: r.current, pending: null });

/** Markers must stay inside the picture and must not sit on the region that holds the answer. */
export function annotationProblems(markers: { x: number; y: number; label: string }[], keepClear: { x: number; y: number; w: number; h: number }[] = []): string[] {
  const problems: string[] = [];
  markers.forEach((m, i) => {
    if (m.x < 0 || m.x > 1 || m.y < 0 || m.y > 1) problems.push(`Marker ${i + 1} is outside the picture.`);
    if (keepClear.some((r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h)) problems.push(`Marker ${i + 1} covers the part of the picture that gives the answer away.`);
  });
  return problems;
}
