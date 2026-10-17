import 'server-only';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './errors';
import { serviceDB } from './supabase';
import { explainIssue } from './explain';

const NO_STORE = { 'Cache-Control': 'no-store' };
export function success(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

type DbError = { code?: string; message?: string } | null | undefined;

/** Messages raised on purpose by our SQL functions (SQLSTATE P0001) are safe and meant for the user. */
export function fromDbError(error: NonNullable<DbError>): AppError {
  const msg = error.message ?? 'Database error';
  if (error.code === 'P0001') {
    if (/only the room host|sign in required/i.test(msg)) return new AppError(msg, /sign in/i.test(msg) ? 401 : 403);
    if (/not found|absent|unavailable/i.test(msg)) return new AppError(msg, 404);
    return new AppError(msg, 400);
  }
  if (error.code === '23505') return new AppError('That already exists', 409);
  if (error.code === '23503') return new AppError('A related record no longer exists', 409);
  console.error('[quiz] database error', error.code, msg);
  return new AppError('Unexpected server error', 500);
}

export function failure(error: unknown) {
  let status = 500;
  let message = 'Unexpected server error';
  let stage: number | undefined;
  if (error instanceof AppError) { status = error.status; message = error.message; stage = error.stage; }
  else if (error instanceof ZodError) {
    status = 400;
    const issue = error.issues[0];
    message = issue ? explainIssue({ path: issue.path as (string | number)[], message: issue.message, code: issue.code }) : 'Invalid request';
  } else if (error instanceof SyntaxError) { status = 400; message = 'Invalid JSON body'; }
  else if (error instanceof Error && /^(Unknown|Wrong response|Answer does not|Each item|Unexpected table)/.test(error.message)) { status = 400; message = error.message; }
  else console.error('[quiz] unhandled error', error);
  return NextResponse.json(stage ? { error: message, stage } : { error: message }, { status, headers: NO_STORE });
}

/** Call a SQL function as service_role and translate failures. */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDB().rpc(name, args);
  if (error) throw fromDbError(error);
  return data as T;
}

/** CSRF defence for cookie-authenticated writes: a browser always sends Origin on cross-site POSTs. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser clients (curl, server-to-server) carry no ambient cookies to abuse
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { /* fallthrough */ }
  if (!host || originHost !== host) throw new AppError('Cross-site request blocked', 403);
}

export function clientIp(req: Request) {
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

/** Fixed-window limiter backed by Postgres so it holds across serverless instances. Fails open if the limiter itself is unavailable. */
export async function rateLimit(req: Request, scope: string, max: number, windowSeconds: number, extra = '') {
  const key = `${scope}:${createHash('sha256').update(clientIp(req) + extra).digest('hex').slice(0, 24)}`;
  try {
    const { data, error } = await serviceDB().rpc('hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    if (error) { console.error('[quiz] rate limiter unavailable', error.code); return; }
    if (data === false) throw new AppError('Too many requests — please wait a moment and try again.', 429);
  } catch (e) {
    if (e instanceof AppError && e.status === 429) throw e;
    if (e instanceof AppError) throw e;
    console.error('[quiz] rate limiter error', e);
  }
}

export async function jsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 400_000) throw new AppError('Request body too large', 413);
  return JSON.parse(text || '{}');
}
