import { NextResponse } from 'next/server';
import { seedDemoBriefs } from '@/lib/demos';
import { assessSeedAuth } from '@/lib/server-config';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/demo/seed -> analyze the demo repos and store them as demo briefs.
 * Default-closed in production: requires a matching `x-seed-token` header when
 * SEED_TOKEN is set, and is disabled entirely in production when it isn't.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = assessSeedAuth(process.env, request.headers.get('x-seed-token'));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const result = await seedDemoBriefs();
  return NextResponse.json(result);
}
