import { NextResponse } from 'next/server';

export async function GET() {
  // In a real app, this would check DB connections, caching layers, etc.
  // For Evolution Sandbox, the app is static-data driven and always ready when it boots.
  return NextResponse.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
}
