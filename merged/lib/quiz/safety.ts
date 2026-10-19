/** Safety, moderation and privacy rules (items 130-133, 137, 138, 139, 140). Pure; the API routes call these and the database enforces the rest. */
import { normalizeText, stripDiacritics } from './text';

/* ── Nicknames (131) ───────────────────────────────────────────────────────────────────────────────────────────────────── */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
/** A deliberately short, school-oriented list. Hosts can add words per room; this is a floor, not a promise of perfect filtering. */
/** Matched anywhere inside the name (so "fuckyou" is caught). Only words that never occur inside innocent words. */
export const STRONG_BLOCKLIST = ['fuck', 'shit', 'bitch', 'asshole', 'pussy', 'nigger', 'nigga', 'faggot', 'whore', 'hitler', 'ditme', 'ditcon', 'concac', 'conditme'];
/** Matched only as whole words (so "grape", "Essex" and "Dickens" are fine). */
export const WORD_BLOCKLIST = ['dick', 'cunt', 'slut', 'retard', 'rape', 'nazi', 'porn', 'sex', 'dit', 'dm', 'dmm', 'dcm', 'cac', 'lon', 'buoi', 'dongu', 'occho', 'thangcho'];
export const BASE_BLOCKLIST = [...STRONG_BLOCKLIST, ...WORD_BLOCKLIST];
function squash(name: string): string {
  const folded = stripDiacritics(normalizeText(name, { caseSensitive: false })).replace(/[@$!0-9]/g, (c) => LEET[c] ?? c);
  return folded.replace(/[^a-z\s]/g, '');
}
export function sanitizeName(raw: string): string {
  return raw.normalize('NFKC').replace(/[\p{C}​-‍⁠﻿]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}
export type NameVerdict = { ok: true; name: string } | { ok: false; reason: 'empty' | 'profanity' | 'impersonation' | 'link' | 'taken'; message: string };
export function checkNickname(raw: string, opts: { extraBlocked?: string[]; taken?: string[]; reservedForHost?: boolean } = {}): NameVerdict {
  const name = sanitizeName(raw);
  if (!name) return { ok: false, reason: 'empty', message: 'Enter a display name.' };
  if (/https?:|www\.|\.(com|net|org|vn|io)\b|@\w+\.\w+/i.test(name)) return { ok: false, reason: 'link', message: 'Names cannot contain links or email addresses.' };
  const flat = squash(name); const spaced = flat.replace(/\s+/g, '');
  const words = flat.split(/\s+/).filter(Boolean);
  const extra = (opts.extraBlocked ?? []).map((w) => squash(w).replace(/\s+/g, '')).filter(Boolean);
  const hit = STRONG_BLOCKLIST.some((w) => spaced.includes(w)) || extra.some((w) => spaced.includes(w)) || WORD_BLOCKLIST.some((w) => words.includes(w) || words.join('') === w);
  if (hit) return { ok: false, reason: 'profanity', message: 'Please choose a different, school-friendly name.' };
  if (/^(teacher|host|admin|moderator|giáo viên|giao vien)$/i.test(name) && !opts.reservedForHost) return { ok: false, reason: 'impersonation', message: 'That name is reserved.' };
  if ((opts.taken ?? []).some((t) => normalizeText(t, { diacritics: 'ignore' }) === normalizeText(name, { diacritics: 'ignore' }))) return { ok: false, reason: 'taken', message: 'That name is already taken in this room.' };
  return { ok: true, name };
}
const ADJ = ['Brave', 'Calm', 'Clever', 'Eager', 'Gentle', 'Happy', 'Jolly', 'Kind', 'Lucky', 'Merry', 'Noble', 'Proud', 'Quick', 'Swift', 'Witty', 'Zesty'];
const NOUN = ['Otter', 'Falcon', 'Comet', 'Maple', 'Panda', 'Lantern', 'Pebble', 'Rocket', 'Sparrow', 'Tiger', 'Willow', 'Acorn', 'Dolphin', 'Ember', 'Fox', 'Koala'];
/** Teacher-generated aliases: friendly, unique within the list, reproducible from the seed (131). */
export function generateAliases(count: number, seed: number): string[] {
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const pool = ADJ.flatMap((a) => NOUN.map((n) => `${a} ${n}`));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  return pool.slice(0, Math.min(count, pool.length));
}

/* ── Room access (132) ─────────────────────────────────────────────────────────────────────────────────────────────────── */
export type PlayerStatus = 'pending' | 'active' | 'kicked' | 'banned';
export type RoomAccess = { requireApproval?: boolean; lockedAfterStart?: boolean; hideIdentity?: boolean };
export type JoinDecision = { allow: boolean; status?: PlayerStatus; reason?: string };
export function decideJoin(room: { status: 'waiting' | 'active' | 'ended'; access: RoomAccess }, banned: boolean): JoinDecision {
  if (banned) return { allow: false, reason: 'You cannot join this room.' };
  if (room.status === 'ended') return { allow: false, reason: 'This room has ended.' };
  if (room.status === 'active' && room.access.lockedAfterStart) return { allow: false, reason: 'The host locked this room after it started.' };
  return { allow: true, status: room.access.requireApproval ? 'pending' : 'active' };
}
/** What a person who is not the host may see about other players: names and scores only — never tokens or hashes. */
export function publicPlayer<T extends { id: string; display_name: string; points: number } & Record<string, unknown>>(p: T) {
  return { id: p.id, display_name: p.display_name, points: p.points };
}

/* ── Abuse heuristics with privacy (133) ───────────────────────────────────────────────────────────────────────────────── */
/** Short-lived, salted, non-reversible bucket for rate-limiting. The salt rotates daily on the server, so nothing here can track a person across days. */
export function privacyBucket(parts: string[], dayKey: string, salt: string): string {
  const s = `${salt}|${dayKey}|${parts.join('|')}`; let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
/** Bot-burst: many joins inside a short window, or names that differ only by a counter. */
export function detectBurst(joins: { at: number; name: string }[], windowMs = 10_000, threshold = 12): { burst: boolean; reason?: string } {
  const sorted = [...joins].sort((a, b) => a.at - b.at);
  for (let i = 0; i + threshold - 1 < sorted.length; i++) if (sorted[i + threshold - 1]!.at - sorted[i]!.at <= windowMs) return { burst: true, reason: `${threshold} joins within ${Math.round(windowMs / 1000)} seconds` };
  const stems = new Map<string, number>();
  sorted.forEach((j) => { const stem = j.name.toLowerCase().replace(/\d+$/, ''); stems.set(stem, (stems.get(stem) ?? 0) + 1); });
  if ([...stems.values()].some((n) => n >= 8)) return { burst: true, reason: 'many names that differ only by a number' };
  return { burst: false };
}

/* ── Minors and privacy defaults (137) ─────────────────────────────────────────────────────────────────────────────────── */
export const PRIVACY_DEFAULTS = Object.freeze({
  publicProfile: false, publicChat: false, preciseLocation: false, advertisingTargeting: false, analyticsCookies: false,
  showFullNamesToPeers: false, collectEmailForPlayers: false,
});
export type PrivacySettings = { -readonly [K in keyof typeof PRIVACY_DEFAULTS]: boolean };

/* ── Guest data (138) ──────────────────────────────────────────────────────────────────────────────────────────────────── */
export const SHARED_DEVICE_WARNING = 'Drafts saved without an account stay in this browser. On a shared or school computer, export them and clear them before you leave — the next person could open them.';
export const MOVE_TO_ACCOUNT_NOTE = 'Moving a draft to an account copies it online and removes the device copy only after the server confirms.';

/* ── Retention and deletion (110, 139) ─────────────────────────────────────────────────────────────────────────────────── */
export const RETENTION_DAYS = Object.freeze({ waitingRoom: 2, endedRoom: 30, sessionReportDefault: 180, rateLimitRows: 1, unusedUpload: 1, reportCase: 365, deletedQuizGrace: 14 });
export function isExpired(createdAt: string, days: number, now = Date.now()): boolean { return now - Date.parse(createdAt) > days * 86_400_000; }
export type DeletionScope = 'quiz' | 'uploads' | 'sessions' | 'cosmetics' | 'account';
/** What an account deletion removes, in a safe order. The UI lists this before the person confirms. */
export function deletionPlan(scope: DeletionScope): string[] {
  const steps: Record<DeletionScope, string[]> = {
    quiz: ['Remove the quiz and its questions', 'Remove revisions of that quiz', 'Release uploads only that quiz used', 'Keep finished sessions (they use their own question snapshot)'],
    uploads: ['Remove uploaded files nothing references', 'Keep files still used by a quiz or an active room'],
    sessions: ['Remove the room, players, submissions and score events', 'Remove session report exports'],
    cosmetics: ['Remove cosmetic progress and equipped items'],
    account: ['Remove every quiz and revision', 'Remove all uploads', 'Remove sessions you hosted', 'Remove cosmetic progress', 'Remove reports you filed (cases stay anonymised)', 'Remove the sign-in record'],
  };
  return steps[scope];
}
