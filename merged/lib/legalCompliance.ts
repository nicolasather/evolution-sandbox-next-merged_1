/**
 * Legal-by-design controls: zero-PII nicknames, a PII/profanity firewall, 24 h classroom TTL purge and the
 * statutory metadata shown in the Legal & Privacy modal. Pure and isomorphic (no node-only imports).
 *
 * This is engineering support for compliance, not legal advice: have counsel review the citations for your deployment.
 */
import { STRONG_BLOCKLIST, WORD_BLOCKLIST, sanitizeName } from './quiz/safety';
import { stripDiacritics } from './quiz/text';

/* ── Zero-PII nickname generator ──────────────────────────────────────────────────────────────────────────────────── */
export const NICK_ADJECTIVES = ['Solar', 'Cambrian', 'Lunar', 'Amber', 'Coral', 'Tidal', 'Mossy', 'Ancient', 'Rapid', 'Quiet', 'Glacial', 'Verdant', 'Cosmic', 'Humble', 'Ember', 'Misty'] as const;
export const NICK_TERMS = ['Trilobite', 'Nautilus', 'Ammonite', 'Archaeopteryx', 'Tardigrade', 'Coelacanth', 'Stromatolite', 'Mammoth', 'Fern', 'Plankton', 'Raptor', 'Cycad', 'Dunkleosteus', 'Lucy', 'Mitochondria', 'Axolotl'] as const;

/** `[Adjective][EvolutionTerm][2Digits]`, e.g. SolarTrilobite42. `rnd` is injectable for tests. */
export function generateSafeNickname(rnd: () => number = Math.random): string {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length) % a.length]!;
  const n = String(Math.floor(rnd() * 100) % 100).padStart(2, '0');
  return `${pick(NICK_ADJECTIVES)}${pick(NICK_TERMS)}${n}`;
}
export const NICKNAME_PATTERN = /^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/;

/* ── PII & profanity firewall ─────────────────────────────────────────────────────────────────────────────────────── */
export const EMAIL_RE = /\S+@\S+\.\S+/;
export const PHONE_RE = /\b\d{9,11}\b/;
/** Extra Vietnamese / English terms beyond the school blocklist in quiz/safety. Matched on accent-folded text. */
const EXTRA_BAD = ['dit me', 'du ma', 'dumá', 'đụ', 'lồn', 'cặc', 'chó đẻ', 'con điếm', 'motherfucker', 'cocksucker', 'kys', 'kill yourself'];
function fold(s: string) { return stripDiacritics(s.toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

export type FirewallVerdict = { ok: true; value: string } | { ok: false; reason: 'empty' | 'email' | 'phone' | 'profanity'; message: string };
/** Blocks emails, phone numbers (also when spaced/dotted) and English/Vietnamese profanity in any user-visible text. */
export function checkUserText(raw: string): FirewallVerdict {
  const value = sanitizeName(raw);
  if (!value) return { ok: false, reason: 'empty', message: 'Enter some text.' };
  if (EMAIL_RE.test(value)) return { ok: false, reason: 'email', message: 'Please do not include an email address.' };
  const digitsOnly = value.replace(/[\s().+-]/g, '');
  if (PHONE_RE.test(value) || /\b\d{9,11}\b/.test(digitsOnly) && /^\+?\d{9,12}$/.test(digitsOnly)) return { ok: false, reason: 'phone', message: 'Please do not include a phone number.' };
  const f = fold(value); const squashed = f.replace(/\s/g, '');
  const words = f.split(' ');
  const bad = STRONG_BLOCKLIST.some((w) => squashed.includes(w)) || WORD_BLOCKLIST.some((w) => words.includes(w)) ||
    EXTRA_BAD.map(fold).some((w) => (w.includes(' ') ? f.includes(w) : words.includes(w) || squashed.includes(w) && w.length > 4));
  if (bad) return { ok: false, reason: 'profanity', message: 'Please keep it school-friendly.' };
  return { ok: true, value };
}

/** A nickname is accepted only if it is safe; otherwise callers fall back to a generated one. */
export function resolveNickname(raw: string | null | undefined, rnd: () => number = Math.random): { name: string; generated: boolean } {
  if (raw) {
    const v = checkUserText(raw);
    if (v.ok && v.value.length <= 24) return { name: v.value, generated: false };
  }
  return { name: generateSafeNickname(rnd), generated: true };
}

/* ── 24-hour classroom TTL ────────────────────────────────────────────────────────────────────────────────────────── */
export const CLASSROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** Returns the entries still inside their TTL. Pure so it can run in a cron, a request or a test. */
export function purgeExpired<T extends { createdAt: number }>(items: readonly T[], now = Date.now(), ttl = CLASSROOM_TTL_MS): T[] {
  return items.filter((i) => now - i.createdAt < ttl);
}
export function purgeExpiredMap<T extends { createdAt: number }>(m: Map<string, T>, now = Date.now(), ttl = CLASSROOM_TTL_MS): number {
  let n = 0;
  for (const [k, v] of m) if (now - v.createdAt >= ttl) { m.delete(k); n++; }
  return n;
}

/* ── Statutory metadata shown to users ────────────────────────────────────────────────────────────────────────────── */
export type LegalFramework = { id: string; region: 'VN' | 'US' | 'EU'; law: string; cite: string; articles: string; duty: string; control: string };
export const LEGAL_FRAMEWORKS: readonly LegalFramework[] = [
  { id: 'vn-13-2023', region: 'VN', law: 'Decree 13/2023/NĐ-CP on Personal Data Protection', cite: 'Decree 13/2023/NĐ-CP', articles: 'Art. 2(3), 11, 20 (20(3) deletion on request)', duty: 'No publishing real student identities on a public leaderboard without informed consent; guardian consent for under-16s; delete on request.', control: 'Generated handles by default, consent-gated custom names, “Clear My Data” button.' },
  { id: 'vn-cyber-2018', region: 'VN', law: 'Law on Cybersecurity 2018', cite: 'Law No. 24/2018/QH14', articles: 'Art. 26, 29', duty: 'Child protection in cyberspace; filter defamatory or harmful user content.', control: 'Profanity/PII firewall on names and custom quiz text; “Report Quiz” takedown.' },
  { id: 'vn-children', region: 'VN', law: 'Law on Children 2016 and Decree 56/2017/NĐ-CP', cite: 'Law No. 102/2016/QH13; Decree 56/2017/NĐ-CP', articles: 'Law Art. 21; Decree Art. 33, 34', duty: 'Protect privacy of children’s academic records and identity.', control: 'Names can be hidden on the projector; gradebook export stays on the teacher’s device.' },
  { id: 'us-coppa', region: 'US', law: 'Children’s Online Privacy Protection Act', cite: '15 U.S.C. §§ 6501–6506; 16 CFR Part 312', articles: '16 CFR § 312.2, § 312.5 (incl. 312.5(c))', duty: 'No personal information from under-13s without verifiable parental consent.', control: 'Anonymous guest nicknames; no email, phone or real name is collected.' },
  { id: 'us-ferpa', region: 'US', law: 'Family Educational Rights and Privacy Act', cite: '20 U.S.C. § 1232g; 34 CFR Part 99', articles: '34 CFR § 99.3, § 99.30', duty: 'Identifiable student grades are not publicly disclosed.', control: 'Projector name masking; leaderboard shows only generated handles.' },
  { id: 'us-dmca-230', region: 'US', law: 'DMCA safe harbor and CDA Section 230', cite: '17 U.S.C. § 512(c); 47 U.S.C. § 230', articles: '§ 512(c)', duty: 'A clear notice-and-takedown mechanism for user-generated content.', control: '“Report Quiz” hides a flagged community quiz from public listing immediately.' },
  { id: 'eu-gdpr', region: 'EU', law: 'General Data Protection Regulation', cite: 'Regulation (EU) 2016/679', articles: 'Art. 5(1)(c), 17, 25', duty: 'Data minimisation, right to erasure, privacy by design and by default.', control: 'Only handle + aggregate stats stored; “Clear My Data”; 24 h purge of classroom rooms.' },
];
