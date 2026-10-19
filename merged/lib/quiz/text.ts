/** Text and number normalisation shared by the grader, duplicate detection, search and import (items 023, 024, 044, 051).
 *  Pure, deterministic and free of any "fuzzy" similarity: two strings are equal after normalisation or they are not. */

export type TextRules = {
  caseSensitive?: boolean;
  /** 'ignore' removes punctuation (but keeps the decimal point inside numbers). */
  punctuation?: 'strict' | 'ignore';
  /** 'ignore' removes combining marks (and maps đ→d) so "cafe" equals "café". */
  diacritics?: 'strict' | 'ignore';
};

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

/** NFKC (so composed Vietnamese letters compare equal however the keyboard produced them), zero-width removal, single spaces. */
export function canonical(value: string): string {
  return value.normalize('NFKC').replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
}

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}+/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFC');
}

export function stripPunctuation(value: string): string {
  const chars = [...value];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (!/\p{P}/u.test(c)) { out += c; continue; }
    // keep "3.14" and "3,14" intact: a separator between two digits is part of the number
    if ((c === '.' || c === ',') && /\d/.test(chars[i - 1] ?? '') && /\d/.test(chars[i + 1] ?? '')) out += c;
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function normalizeText(value: string, rules: TextRules = {}): string {
  let v = canonical(value);
  if (rules.diacritics === 'ignore') v = stripDiacritics(v);
  if (rules.punctuation === 'ignore') v = stripPunctuation(v);
  return rules.caseSensitive ? v : v.toLowerCase();
}

/** Parse "12", "12.5", "12,5", "1,234.5", "1.234,5", "1 234" → number. Returns null when it is not clearly a number. */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[\s ']/g, '');
  if (!/^[+-]?(\d|[.,]\d)[\d.,]*(e[+-]?\d+)?$/i.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // both present: the later one is the decimal mark, the other groups thousands
    const dec = lastDot > lastComma ? '.' : ',';
    const group = dec === '.' ? ',' : '.';
    s = s.split(group).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    // "1,234" or "1,234,567" reads as thousands; a lone comma otherwise is a decimal comma ("3,14")
    s = parts.length > 2 || (parts[1]!.length === 3 && parts[0]!.replace(/^[+-]/, '').length <= 3 && parts[0] !== '0') ? parts.join('') : parts.join('.');
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    if (parts.length > 2) s = parts.join(''); // "1.234.567"
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Split "12.5 cm" into a number and its unit text. A bare number has unit ''. */
export function parseQuantity(raw: string): { value: number; unit: string } | null {
  const text = canonical(raw);
  const m = /^([+-]?(?:\d[\d.,\s']*|[.,]\d+)(?:e[+-]?\d+)?)\s*([^\d\s+-].*)?$/iu.exec(text);
  if (!m) return null;
  const value = parseNumber(m[1]!.trim());
  if (value === null) return null;
  return { value, unit: (m[2] ?? '').trim().toLowerCase() };
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f;
}

/** Locale-aware number formatting for the interface (item 146). */
export function formatNumber(n: number, locale: string): string {
  try { return new Intl.NumberFormat(locale).format(n); } catch { return String(n); }
}
