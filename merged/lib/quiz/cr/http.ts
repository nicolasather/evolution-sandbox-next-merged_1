import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { AppError } from '../errors';
import { getRoom, isHost } from '../rooms';
import { seatCookie, verifySeat, verifySpectator } from './server';

export const roomIdOf = async (params: Promise<{ id: string }>) => z.string().uuid().parse((await params).id);
/** The student's seat from its HttpOnly cookie (never from the request body). */
export async function seatFrom(roomId: string) {
  const token = (await cookies()).get(seatCookie(roomId))?.value;
  const room = await getRoom(roomId);
  if (!(room.config as { cr?: unknown }).cr) throw new AppError('Clue Racing match not found', 404);
  const { player } = await verifySeat(room, token);
  return { room, seatId: player.id, token: token! };
}
export async function hostOf(roomId: string) {
  const { room, user } = await isHost(roomId);
  if (!(room.config as { cr?: unknown }).cr) throw new AppError('Clue Racing match not found', 404);
  return { room, user };
}
export async function spectatorOf(req: Request, roomId: string) { await verifySpectator(roomId, req.headers.get('x-cr-screen')); }
export const cookieOptions = (roomId: string) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: `/api/quiz/clue/rooms/${roomId}`, maxAge: 6 * 60 * 60 });
/** Reads a JSON body with a hard byte cap so an oversized packet is refused before it is parsed. */
export async function boundedJson(req: Request, max: number): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0); if (len > max) throw new AppError('Packet too large', 413);
  const text = await req.text(); if (text.length > max) throw new AppError('Packet too large', 413);
  try { return JSON.parse(text); } catch { throw new AppError('Invalid JSON', 400); }
}
