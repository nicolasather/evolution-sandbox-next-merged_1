import { createHash } from 'node:crypto';

/* Safe provenance for anything a model produced (package 042). Records WHAT was asked and answered by
   hash, never the secrets or player data. A suggestion is traceable and re-reviewable, and the record
   states plainly that model output is not a cited source. */

export interface AuditInput {
  provider: string;
  model: string;
  promptVersion: string;
  /** exact prompt template text (hashed, not stored) */
  template: string;
  /** the input dataset sent (hashed, not stored) */
  input: unknown;
  /** the raw response text (hashed, not stored) */
  response: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  at?: string;
}

export interface AuditRecord {
  schemaVersion: 1;
  provider: string;
  model: string;
  promptVersion: string;
  templateHash: string;
  inputHash: string;
  responseHash: string;
  usage: { inputTokens: number; outputTokens: number };
  at: string;
  /** always true: a generated suggestion is never evidence */
  notASource: true;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** canonical JSON: sorted keys, so equal data hashes equally */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

const SECRET = /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|api[_-]?key["':= ]+[A-Za-z0-9._-]{8,}|[\w.+-]+@[\w-]+\.[\w.-]+)/gi;
/** strips tokens, keys and e-mail addresses from free text (error messages, labels) before they are logged */
export const redact = (s: string): string => s.replace(SECRET, '[redacted]');

export function auditRecord(i: AuditInput): AuditRecord {
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  return {
    schemaVersion: 1,
    provider: redact(i.provider).slice(0, 40),
    model: redact(i.model).slice(0, 80),
    promptVersion: redact(i.promptVersion).slice(0, 40),
    templateHash: sha(i.template),
    inputHash: sha(canonical(i.input)),
    responseHash: sha(i.response),
    usage: { inputTokens: n(i.usage?.inputTokens), outputTokens: n(i.usage?.outputTokens) },
    at: i.at ?? new Date().toISOString(),
    notASource: true,
  };
}
