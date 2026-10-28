/**
 * Catalyst Hints + Discovery Inspector for the Sandbox <-> Quiz loop.
 *   POST { unlocked: string[], revealed?: {a,b}[] } -> one uncombined recipe pair the player can already make (result NOT named)
 *   GET  ?inspect=<id>                              -> public facts for the "Inspect Discovery" deep link
 * XP is a device-local currency (see lib/sandboxQuizBridge); this route only picks the hint and never touches the score.
 */
import { NextResponse } from 'next/server';
import db from '@/data/db.json';
import { findCatalystHint, type DbNode } from '@/lib/sandboxQuizBridge';
import { clientKey, gradeLimiter } from '@/lib/quizSecurity';

export const dynamic = 'force-dynamic';
const nodes = (db as unknown as { nodes: DbNode[] }).nodes;
const byId = new Map(nodes.map((n) => [n.id, n] as const));
const H = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  if (!gradeLimiter.hit(clientKey(req))) return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: H });
  const b = (await req.json().catch(() => null)) as { unlocked?: unknown; revealed?: unknown } | null;
  const unlocked = Array.isArray(b?.unlocked) ? b.unlocked.filter((x): x is string => typeof x === 'string').slice(0, 4000) : [];
  const revealed = Array.isArray(b?.revealed) ? b.revealed.filter((h): h is { a: string; b: string } => !!h && typeof (h as { a?: unknown }).a === 'string' && typeof (h as { b?: unknown }).b === 'string').slice(0, 500) : [];
  const hint = findCatalystHint(nodes, unlocked, revealed);
  if (!hint) return NextResponse.json({ success: false, error: 'No new recipe pair to reveal right now. Unlock more discoveries first.' }, { status: 404, headers: H });
  const name = (id: string) => byId.get(id)?.n ?? id;
  return NextResponse.json({ success: true, a: hint.a, b: hint.b, aName: name(hint.a), bName: name(hint.b) }, { headers: H });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('inspect') ?? '';
  const n = byId.get(id);
  if (!n || n.hidden) return NextResponse.json({ success: false, error: 'Unknown discovery' }, { status: 404, headers: H });
  return NextResponse.json({ success: true, id: n.id, name: n.n, era: n.era, category: n.cat, evidence: n.ev, summary: n.l1 ?? '', recipe: (n.rec ?? []).map(([a, b]) => [byId.get(a)?.n ?? a, byId.get(b)?.n ?? b]) }, { headers: H });
}
