/** Wire protocol `ss/1`. Everything a client may send is validated here (strict, bounded). Clients never send scores, correctness, positions or team data:
 *  they send an input vector, an ability press, an answer payload, a vote or a role choice. The server decides everything else. */
import { z } from 'zod';
import { ROLES, UPGRADES, PROTOCOL } from '../domain';

const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_.:-]+$/);
const unit = z.number().min(-1.0001).max(1.0001);
export const clientPacket = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), proto: z.literal(PROTOCOL), token: z.string().max(600), focus: z.string().max(8).optional(), view: z.enum(['play', 'screen']).optional() }).strict(),
  z.object({ t: z.literal('ping'), c: z.number().int().min(0).max(2 ** 31) }).strict(),
  z.object({ t: z.literal('move'), seq: z.number().int().min(1).max(2 ** 31), x: unit, y: unit }).strict(),
  z.object({ t: z.literal('ability'), id }).strict(),
  z.object({ t: z.literal('answer'), w: z.string().min(1).max(20), id, r: z.unknown() }).strict(),
  z.object({ t: z.literal('vote'), d: z.string().min(1).max(20), u: z.enum(UPGRADES), id }).strict(),
  z.object({ t: z.literal('role'), role: z.enum(ROLES) }).strict(),
  z.object({ t: z.literal('ready'), v: z.boolean() }).strict(),
  z.object({ t: z.literal('focus'), team: z.string().min(1).max(8) }).strict(),
  z.object({ t: z.literal('hint'), w: z.string().min(1).max(20) }).strict(),
  z.object({ t: z.literal('leave') }).strict(),
  z.object({ t: z.literal('host'), id, rev: z.number().int().min(0).optional(), cmd: z.discriminatedUnion('cmd', [
    z.object({ cmd: z.literal('start') }), z.object({ cmd: z.literal('begin') }), z.object({ cmd: z.literal('pause'), reason: z.string().max(80).optional() }), z.object({ cmd: z.literal('resume') }),
    z.object({ cmd: z.literal('extend'), seconds: z.number().int().min(5).max(120) }), z.object({ cmd: z.literal('skip'), reason: z.string().trim().max(200) }),
    z.object({ cmd: z.literal('end_request') }), z.object({ cmd: z.literal('end_confirm'), nonce: z.string().max(40) }), z.object({ cmd: z.literal('kick'), pid: z.string().max(40) }),
    z.object({ cmd: z.literal('lock'), value: z.boolean() }), z.object({ cmd: z.literal('late_join'), value: z.boolean() }),
    z.object({ cmd: z.literal('assign'), pid: z.string().max(40), teamId: z.string().max(8).optional(), role: z.enum(ROLES).optional() }), z.object({ cmd: z.literal('ask_now') }),
  ]) }).strict(),
]);
export type ClientPacket = z.infer<typeof clientPacket>;
export const MAX_PACKET_BYTES = 8192;

/** Rate limits per socket (token buckets): `move` is allowed at input rate, everything else is human-speed. */
export const RATE = { move: { perSec: 30, burst: 40 }, ability: { perSec: 6, burst: 8 }, answer: { perSec: 3, burst: 5 }, other: { perSec: 6, burst: 12 }, host: { perSec: 10, burst: 20 }, strikesToClose: 25 } as const;

export type ErrCode = 'bad_packet' | 'bad_token' | 'wrong_room' | 'rate' | 'stale_revision' | 'closed' | 'server_busy' | 'not_host' | 'not_hello' | 'duplicate_socket' | 'unsupported' | 'game' | 'ended';
export type ServerPacket =
  | { t: 'welcome'; proto: typeof PROTOCOL; you: { id: string; kind: 'player' | 'host' | 'screen'; teamId: string | null }; serverMs: number; tickHz: number; snapHz: number; roomCode: string; resumed: boolean }
  | { t: 'snap'; full: boolean; ack: number; sm: number; seq: number; v: unknown }
  | { t: 'ev'; events: unknown[] }
  | { t: 'ans'; w: string; id: string; ok: boolean; duplicate?: boolean; code?: string; message?: string }
  | { t: 'ack'; id: string; ok: boolean; code?: string; message?: string; nonce?: string }
  | { t: 'hint'; w: string; hint: string | null }
  | { t: 'pong'; c: number; sm: number }
  | { t: 'err'; code: ErrCode; message: string; fatal?: boolean }
  | { t: 'bye'; reason: string };
