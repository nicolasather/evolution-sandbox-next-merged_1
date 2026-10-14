import { createHash } from 'node:crypto';
import type { CreativeCatalog } from '../catalog';
import type { CreativeConfig } from '../config';
import type { Db } from '../db/sql';
import { markUnknown, recordProviderFailure, recordProviderSuccess, releaseReservation, reserve, settle } from '../db/budget';
import { audit } from '../db/proposals';
import { ProviderError } from '../types';
import { buildCertificate, CONTRACTS, poolFor, poolHash } from './contracts';
import { stableStringify } from '@/lib/modes/stableJson';
import { MODE_PROMPT_VERSION } from './provider';
import { MAX_PACKET_ITEMS, MODE_PACKET_MODES, type ModePacket, type ModeProvider, type PacketModeId } from './types';
import { validateModeOutput } from './validate';

/* Ticket 093 — ONE pipeline for every mode: propose -> validate -> certify -> store -> (human) approve -> publish.
   Order of gates (cheapest first, all before any paid call): mode supported -> seed valid -> cache hit -> flags/provider ->
   budget. A rejected (mode, seed) is stored and never retried automatically. */

export interface ModeDeps { db: Db; cat: CreativeCatalog; cfg: CreativeConfig; provider: ModeProvider | null; releaseHash: string; now: () => Date; autoServeFlavor?: boolean }

export type GenerateResult =
  | { ok: true; source: 'cache' | 'generated'; packetId: number; status: string; packetHash: string }
  | { ok: false; code: 'unsupported_mode' | 'bad_seed' | 'unavailable' | 'rejected' | 'cached_rejection' | 'no_pool'; detail?: string };

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const isPacketMode = (m: unknown): m is PacketModeId => typeof m === 'string' && (MODE_PACKET_MODES as readonly string[]).includes(m);
export const canonicalPacket = (p: ModePacket) => stableStringify(p);

export async function generateModePacket(d: ModeDeps, a: { modeId: unknown; seed: unknown }): Promise<GenerateResult> {
  if (!isPacketMode(a.modeId)) return { ok: false, code: 'unsupported_mode' };       // before ANY database or model work
  const modeId = a.modeId;
  if (!Number.isInteger(a.seed) || (a.seed as number) < 0 || (a.seed as number) > 2_147_483_647) return { ok: false, code: 'bad_seed' };
  const seed = a.seed as number;
  const c = CONTRACTS[modeId];

  const pool = poolFor(d.cat, modeId, seed);
  if (c.usesItems && pool.length === 0) return { ok: false, code: 'no_pool' };
  const ph = poolHash(pool);

  const cached = await d.db.query<{ id: number; status: string; packet_hash: string | null }>(
    `SELECT id::int, status, packet_hash FROM creative.mode_packet WHERE mode_id=$1 AND mode_contract_version=$2 AND content_release_hash=$3 AND pool_hash=$4 AND seed=$5 AND prompt_version=$6`,
    [modeId, c.contractVersion, d.releaseHash, ph, seed, MODE_PROMPT_VERSION]);
  if (cached.rows[0]) {
    const r = cached.rows[0];
    return r.status === 'rejected' ? { ok: false, code: 'cached_rejection' } : { ok: true, source: 'cache', packetId: r.id, status: r.status, packetHash: r.packet_hash ?? '' };
  }

  if (!d.cfg.modeAiEnabled || !d.provider) return { ok: false, code: 'unavailable' };
  const now = d.now();
  const rsv = await reserve(d.db, { computeId: null, provider: d.provider.name, reserveUsd: d.cfg.reservePerCallUsd, cfg: { dailyGlobalUsd: d.cfg.dailyGlobalUsd }, now });
  if (!rsv.ok) return { ok: false, code: 'unavailable', detail: rsv.reason };

  const names = new Map(d.cat.db.nodes.map(n => [n.id, n]));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), d.cfg.providerTimeoutMs);
  let out;
  try {
    out = await d.provider.compose({
      modeId, contractVersion: c.contractVersion, flavorFields: c.flavor, maxItems: MAX_PACKET_ITEMS, seed, signal: ac.signal,
      pool: pool.map(id => ({ id, name: names.get(id)!.n, era: names.get(id)!.era })),
    });
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError('unexpected', false, true);
    if (pe.billableUnknown || ac.signal.aborted) await markUnknown(d.db, rsv.ledgerId); else await releaseReservation(d.db, rsv.ledgerId);
    await recordProviderFailure(d.db, d.provider.name, d.now());
    return { ok: false, code: 'unavailable', detail: pe.message };                  // NOT cached: an outage is not a verdict
  } finally { clearTimeout(timer); }

  await recordProviderSuccess(d.db, d.provider.name);
  const usd = out.meta.costUsd >= 0 ? out.meta.costUsd : d.cfg.reservePerCallUsd;
  try { await settle(d.db, rsv.ledgerId, { settledUsd: usd, inputTokens: out.meta.inputTokens, outputTokens: out.meta.outputTokens, externalRequestId: out.meta.requestId }); }
  catch { await settle(d.db, rsv.ledgerId, { settledUsd: usd, inputTokens: out.meta.inputTokens, outputTokens: out.meta.outputTokens, externalRequestId: null }); }

  const reject = async (reason: string): Promise<GenerateResult> => {
    await d.db.query(
      `INSERT INTO creative.mode_packet(mode_id, mode_contract_version, content_release_hash, pool_hash, seed, prompt_version, status, packet, model_id, reject_reason)
       VALUES ($1,$2,$3,$4,$5,$6,'rejected','{}'::jsonb,$7,$8) ON CONFLICT DO NOTHING`,
      [modeId, c.contractVersion, d.releaseHash, ph, seed, MODE_PROMPT_VERSION, out!.meta.modelId, reason.slice(0, 120)]);
    return { ok: false, code: 'rejected', detail: reason };
  };

  const v = validateModeOutput(c, d.cat, pool, out.output);
  if (!v.ok) return reject(`validation:${v.reason}`);

  const scenario = c.scenario(d.cat, seed, v.output.approvedItemIds);
  if (!scenario) return reject('scenario:none');
  const base = String(scenario.baseSeed ?? `mode-packet|${modeId}|${seed}`);
  const cert = c.certify(base, scenario, d.cat);
  if (!cert.ok) return reject(`solver:${cert.failures[0] ?? 'failed'}`);

  const packet: ModePacket = {
    schemaVersion: 1, modeId, contractVersion: c.contractVersion, releaseHash: d.releaseHash, seed,
    approvedItemIds: modeId === 'reverse-evolution' ? [String(scenario.targetId)] : modeId === 'minimum-path' ? [String(scenario.start), String(scenario.target)] : v.output.approvedItemIds,
    flavor: v.output.flavor, scenario, disclosure: c.disclosure,
    verification: { status: 'certified', certificate: buildCertificate(c, base, cert) },
  };
  const packetHash = sha(canonicalPacket(packet));
  const auto = !!d.autoServeFlavor && c.lowRiskFlavorOnly;
  const ins = await d.db.query<{ id: number }>(
    `INSERT INTO creative.mode_packet(mode_id, mode_contract_version, content_release_hash, pool_hash, seed, prompt_version, status, packet, solver_certificate, model_id, packet_hash, reviewed_by)
     VALUES ($1,$2,$3,$4,$5,$6,'certified',$7::jsonb,$8::jsonb,$9,$10,NULL) ON CONFLICT DO NOTHING RETURNING id::int`,
    [modeId, c.contractVersion, d.releaseHash, ph, seed, MODE_PROMPT_VERSION, JSON.stringify(packet), JSON.stringify(packet.verification.certificate), out.meta.modelId, packetHash]);
  if (!ins.rows[0]) {   // lost a race with an identical request: return the winner's row
    const w = await d.db.query<{ id: number; status: string; packet_hash: string }>(`SELECT id::int, status, packet_hash FROM creative.mode_packet WHERE mode_id=$1 AND mode_contract_version=$2 AND content_release_hash=$3 AND pool_hash=$4 AND seed=$5 AND prompt_version=$6`, [modeId, c.contractVersion, d.releaseHash, ph, seed, MODE_PROMPT_VERSION]);
    return { ok: true, source: 'cache', packetId: w.rows[0].id, status: w.rows[0].status, packetHash: w.rows[0].packet_hash };
  }
  let status = 'certified';
  if (auto) {
    await d.db.query(`UPDATE creative.mode_packet SET status='approved', reviewed_by='auto-flavor-allowlist' WHERE id=$1`, [ins.rows[0].id]);
    status = 'approved';
  }
  await audit(d.db, { actorRole: 'system', kind: auto ? 'mode_packet_auto_approved' : 'mode_packet_certified', objectType: 'mode_packet', objectId: ins.rows[0].id, details: { mode: modeId, seed, hash: packetHash } });
  return { ok: true, source: 'generated', packetId: ins.rows[0].id, status, packetHash };
}

export type PacketReview = { ok: true; status: string } | { ok: false; code: 'not_found' | 'illegal_transition' };

export async function reviewModePacket(db: Db, a: { packetId: number; action: 'approve' | 'publish' | 'reject'; reviewer: string; reason?: string }): Promise<PacketReview> {
  return db.transaction(async tx => {
    const row = (await tx.query<{ status: string; mode_id: string }>(`SELECT status, mode_id FROM creative.mode_packet WHERE id=$1 FOR UPDATE`, [a.packetId])).rows[0];
    if (!row) return { ok: false, code: 'not_found' } as const;
    const next = a.action === 'approve' ? 'approved' : a.action === 'publish' ? 'published' : 'rejected';
    const legal = (row.status === 'certified' && (next === 'approved' || next === 'rejected')) || (row.status === 'approved' && (next === 'published' || next === 'rejected'));
    if (!legal) return { ok: false, code: 'illegal_transition' } as const;
    await tx.query(`UPDATE creative.mode_packet SET status=$2, reviewed_by=$3, reject_reason=COALESCE($4, reject_reason) WHERE id=$1`, [a.packetId, next, a.reviewer, a.reason ?? null]);
    await audit(tx, { actorRole: 'owner', actorHash: a.reviewer, kind: `mode_packet_${next}`, objectType: 'mode_packet', objectId: a.packetId, details: { mode: row.mode_id } });
    return { ok: true, status: next } as const;
  });
}

/** Published packets only, in the shape the next build ships (data/mode_packets.json). */
export async function exportModePackets(db: Db): Promise<{ schemaVersion: 1; packets: { hash: string; packet: ModePacket }[] }> {
  const r = await db.query<{ packet: ModePacket; packet_hash: string }>(`SELECT packet, packet_hash FROM creative.mode_packet WHERE status='published' ORDER BY mode_id, seed`);
  return { schemaVersion: 1, packets: r.rows.map(x => ({ hash: x.packet_hash, packet: x.packet })) };
}
