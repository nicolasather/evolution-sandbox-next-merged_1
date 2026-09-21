import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'cache_healthy', timestamp: new Date().toISOString() });
}
