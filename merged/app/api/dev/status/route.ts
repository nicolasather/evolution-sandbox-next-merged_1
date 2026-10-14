import { NextResponse } from 'next/server';
import { buildInfo, serverDevToolsEnabled } from '@/lib/dev/env';

/* Developer-only. In any deployment where the server-side gate is closed (the
   default, and always on production) this route behaves as if it did not exist:
   a plain 404 with no hint that a developer surface lives here. The console
   calls it once on load; every client-side override stays inert until it
   answers { enabled: true }. */

export const dynamic = 'force-dynamic';

export function GET() {
  if (!serverDevToolsEnabled()) {
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(
    { enabled: true, ...buildInfo() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
