import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    status: 'live',
    service: 'lpu-events-admin',
    timestamp: new Date().toISOString(),
  });
}
