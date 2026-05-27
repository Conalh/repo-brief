import { NextResponse } from 'next/server';
import { seedDemoBriefs } from '@/lib/demos';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/demo/seed -> analyze the demo repos and store them as demo briefs.
 * If SEED_TOKEN is set, the request must send a matching `x-seed-token` header.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const required = process.env.SEED_TOKEN;
  if (required && request.headers.get('x-seed-token') !== required) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const result = await seedDemoBriefs();
  return NextResponse.json(result);
}
