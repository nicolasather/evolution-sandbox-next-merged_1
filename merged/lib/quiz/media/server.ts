import 'server-only';
import { randomUUID } from 'node:crypto';
import { serviceDB } from '../supabase';
import { supabaseUrl } from '../config';
import { AppError } from '../errors';
import { isMissingRelation } from '../settings-db';
import { MAX_BYTES, MEDIA_BUCKET, MIME_EXT, MIME_KIND, QUOTA, RESUMABLE_ABOVE, VIEW_URL_TTL_SECONDS, checkFileForUpload, type PrepareRequest } from './contract';
import { declaredMatches, sniff } from './signatures';

const NOT_READY = 'Media storage is not set up on this deployment yet (migration 004 has not been run). Your question is saved without the file.';

function table() { return serviceDB().from('quiz_media'); }
function guardMissing(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (isMissingRelation(error)) throw new AppError(NOT_READY, 503);
  console.error('[quiz] media db', error.code, error.message);
  throw new AppError('Could not process the file', 500);
}

export async function prepareUpload(ownerId: string, req: PrepareRequest) {
  const early = checkFileForUpload(req.mime, req.size);
  if (early) throw new AppError(early, 400);
  const kind = MIME_KIND[req.mime]!;

  const { data: rows, error } = await table().select('bytes,declared_bytes,status,created_at').eq('owner_id', ownerId);
  guardMissing(error);
  const mine = rows ?? [];
  const ready = mine.filter((r) => r.status === 'ready');
  if (ready.length >= QUOTA.perUser) throw new AppError(`You can keep up to ${QUOTA.perUser} files. Delete unused ones first.`, 403);
  const used = ready.reduce((n, r) => n + Number(r.bytes ?? r.declared_bytes), 0);
  if (used + req.size > QUOTA.bytesPerUser) throw new AppError('You have reached your storage allowance for media. Remove files you no longer use.', 403);
  const recent = mine.filter((r) => Date.now() - Date.parse(r.created_at as string) < 3600_000).length;
  if (recent >= QUOTA.perHour) throw new AppError('Too many uploads this hour. Please wait a little.', 429);

  const id = randomUUID();
  const path = `${ownerId}/${id}.${MIME_EXT[req.mime]}`;
  const { error: insErr } = await table().insert({ id, owner_id: ownerId, kind, mime: req.mime, declared_bytes: req.size, path, filename: req.filename.slice(0, 200) });
  guardMissing(insErr);

  const { data: signed, error: sErr } = await serviceDB().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (sErr || !signed) {
    await table().delete().eq('id', id);
    console.error('[quiz] signed upload', sErr?.message);
    throw new AppError('Media storage is not available right now. Check that the quiz-media bucket exists (migration 004).', 503);
  }
  const base = supabaseUrl()!;
  const resumable = req.size > RESUMABLE_ABOVE;
  return {
    id, kind, method: resumable ? ('resumable' as const) : ('single' as const),
    url: signed.signedUrl, token: signed.token, path, bucket: MEDIA_BUCKET,
    resumableEndpoint: `${base}/storage/v1/upload/resumable/sign`,
  };
}

/** Verify what actually arrived: size within limits and the first bytes match the declared type. Anything else is deleted. */
export async function completeUpload(ownerId: string, id: string) {
  const { data: row, error } = await table().select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  guardMissing(error);
  if (!row) throw new AppError('Upload not found', 404);
  if (row.status === 'ready') return publicRow(row);
  const fail = async (msg: string) => {
    await serviceDB().storage.from(MEDIA_BUCKET).remove([row.path as string]);
    await table().update({ status: 'failed' }).eq('id', id);
    throw new AppError(msg, 400);
  };

  const { data: url } = await serviceDB().storage.from(MEDIA_BUCKET).createSignedUrl(row.path as string, 60);
  if (!url) throw new AppError('The file has not finished uploading', 409);
  const head = await fetch(url.signedUrl, { headers: { Range: 'bytes=0-65535' } });
  if (!head.ok) throw new AppError('The file has not finished uploading', 409);
  const total = Number((head.headers.get('content-range') ?? '').split('/')[1] ?? head.headers.get('content-length') ?? 0);
  const buf = new Uint8Array(await head.arrayBuffer());

  const found = sniff(buf);
  if (!found) return fail('That file is not a supported image, GIF or video. It was removed.');
  if (!declaredMatches(row.mime as string, found.mime)) return fail('The file content does not match its type, so it was removed.');
  if (!total || total > MAX_BYTES[found.kind]) return fail('The file is larger than allowed and was removed.');
  if (total > Number(row.declared_bytes) * 1.02 + 1024) return fail('The file is larger than announced and was removed.');
  if (found.kind !== 'video' && found.width && found.height && (found.width > 12000 || found.height > 12000)) return fail('The picture is too large in pixels (limit 12000).');

  const { data: done, error: upErr } = await table()
    .update({ status: 'ready', bytes: total, width: found.width ?? null, height: found.height ?? null, ready_at: new Date().toISOString() })
    .eq('id', id).select('*').single();
  guardMissing(upErr);
  return publicRow(done);
}

const publicRow = (r: Record<string, unknown>) => ({ id: r.id as string, kind: r.kind as string, mime: r.mime as string, bytes: Number(r.bytes ?? 0), width: (r.width as number | null) ?? undefined, height: (r.height as number | null) ?? undefined });

/** Owner always; everyone else only through a quiz they are allowed to see (published and not private, or with a room still running). */
export async function signedViewUrl(viewerId: string | null, id: string) {
  const { data: row, error } = await table().select('id,owner_id,path,status,mime,kind').eq('id', id).maybeSingle();
  guardMissing(error);
  if (!row || row.status !== 'ready') throw new AppError('Not found', 404);
  let allowed = !!viewerId && viewerId === row.owner_id;
  if (!allowed) {
    const { data: refs } = await serviceDB().from('quiz_media_refs').select('quiz_id').eq('media_id', id).limit(50);
    const quizIds = (refs ?? []).map((r) => r.quiz_id as string);
    if (quizIds.length) {
      const { data: quizzes } = await serviceDB().from('quizzes').select('id,status').in('id', quizIds);
      const published = (quizzes ?? []).filter((q) => q.status === 'published').map((q) => q.id as string);
      if (published.length) {
        const { data: sets } = await serviceDB().from('quiz_settings').select('quiz_id,visibility').in('quiz_id', published);
        const priv = new Set((sets ?? []).filter((s) => s.visibility === 'private').map((s) => s.quiz_id as string));
        allowed = published.some((q) => !priv.has(q));
        if (!allowed) {
          const { count } = await serviceDB().from('rooms').select('id', { count: 'exact', head: true }).in('quiz_id', published).neq('status', 'ended');
          allowed = (count ?? 0) > 0;
        }
      }
    }
  }
  if (!allowed) throw new AppError('Not found', 404);
  const { data, error: sErr } = await serviceDB().storage.from(MEDIA_BUCKET).createSignedUrl(row.path as string, VIEW_URL_TTL_SECONDS);
  if (sErr || !data) throw new AppError('Could not open the file', 500);
  return { url: data.signedUrl, expiresIn: VIEW_URL_TTL_SECONDS, kind: row.kind as string, mime: row.mime as string };
}

export async function deleteMedia(ownerId: string, id: string) {
  const { data: row, error } = await table().select('id,path').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  guardMissing(error);
  if (!row) throw new AppError('Not found', 404);
  const { count } = await serviceDB().from('quiz_media_refs').select('quiz_id', { count: 'exact', head: true }).eq('media_id', id);
  if ((count ?? 0) > 0) throw new AppError('This file is used by a saved quiz. Remove it from the quiz first.', 409);
  await serviceDB().storage.from(MEDIA_BUCKET).remove([row.path as string]);
  await table().delete().eq('id', id);
}

/** Make quiz_media_refs mirror the quiz. Refuses ids the owner does not own or that are not ready. Returns the ids that were dropped. */
export async function syncQuizMedia(quizId: string, ownerId: string, wanted: string[]): Promise<{ missing: string[] }> {
  const db = serviceDB();
  let usable: string[] = [];
  if (wanted.length) {
    const { data, error } = await db.from('quiz_media').select('id').eq('owner_id', ownerId).eq('status', 'ready').in('id', wanted);
    if (error) { if (isMissingRelation(error)) return { missing: [] }; throw new AppError('Could not link media', 500); }
    usable = (data ?? []).map((r) => r.id as string);
  }
  await db.from('quiz_media_refs').delete().eq('quiz_id', quizId);
  if (usable.length) {
    const { error } = await db.from('quiz_media_refs').insert(usable.map((media_id) => ({ quiz_id: quizId, media_id })));
    if (error) throw new AppError('Could not link media', 500);
  }
  return { missing: wanted.filter((w) => !usable.includes(w)) };
}

export async function cleanupMedia(): Promise<number> {
  const { data, error } = await serviceDB().rpc('cleanup_quiz_media');
  if (error) { if (!isMissingRelation(error)) console.error('[quiz] media cleanup', error.code); return 0; }
  const paths = ((data ?? []) as { path: string }[]).map((r) => r.path);
  if (paths.length) await serviceDB().storage.from(MEDIA_BUCKET).remove(paths);
  return paths.length;
}
