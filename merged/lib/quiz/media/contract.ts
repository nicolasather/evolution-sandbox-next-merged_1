/** Shared by the browser (for friendly early errors only) and the server (which enforces everything). */
export const MEDIA_BUCKET = 'quiz-media';
export const MB = 1024 * 1024;

export type MediaKind = 'image' | 'gif' | 'video';
export const MIME_KIND: Record<string, MediaKind> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/avif': 'image',
  'image/gif': 'gif',
  'video/mp4': 'video', 'video/webm': 'video',
};
export const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm',
};
export const ALLOWED_MIME = Object.keys(MIME_KIND);
/** Defaults are product targets. The bucket (migration 004) and the Supabase global limit must allow them; the server enforces them. */
export const MAX_BYTES: Record<MediaKind, number> = { image: 8 * MB, gif: 15 * MB, video: 50 * MB };
/** Above this, upload with the resumable protocol instead of a single request (Supabase's documented threshold). */
export const RESUMABLE_ABOVE = 6 * MB;
export const QUOTA = {
  /** items one quiz may reference */ perQuiz: 40,
  /** ready assets one account may hold */ perUser: 200,
  /** bytes one account may hold */ bytesPerUser: 500 * MB,
  /** uploads started per hour */ perHour: 60,
};
export const UPLOAD_TTL_MINUTES = 120;
export const VIEW_URL_TTL_SECONDS = 3600;

export const kindLabel: Record<MediaKind, string> = { image: 'Image', gif: 'GIF', video: 'Video' };
export const ACCEPT_ATTR = ALLOWED_MIME.join(',');

export type MediaRole = 'question' | 'option' | 'cover' | 'poster';
export type PrepareRequest = { filename: string; mime: string; size: number; role: MediaRole };

export function describeLimits(): string {
  return `Images (JPEG, PNG, WebP, AVIF) up to ${MAX_BYTES.image / MB} MB · GIF up to ${MAX_BYTES.gif / MB} MB · Video (MP4, WebM) up to ${MAX_BYTES.video / MB} MB`;
}

/** Early, friendly check. Returns a sentence, or null when the file may proceed to the server. */
export function checkFileForUpload(mime: string, size: number, allow: MediaKind[] = ['image', 'gif', 'video']): string | null {
  if (mime === 'image/svg+xml') return 'SVG files are not accepted because they can contain scripts. Export the picture as PNG or JPEG.';
  const kind = MIME_KIND[mime];
  if (!kind) return `That file type isn’t supported. ${describeLimits()}.`;
  if (!allow.includes(kind)) return `${kindLabel[kind]} files can’t be used here. Allowed: ${allow.map((k) => kindLabel[k]).join(', ')}.`;
  if (size <= 0) return 'That file is empty.';
  if (size > MAX_BYTES[kind]) return `${kindLabel[kind]} files can be up to ${MAX_BYTES[kind] / MB} MB. This one is ${(size / MB).toFixed(1)} MB.`;
  return null;
}
