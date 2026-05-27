import { NextResponse } from 'next/server';
import { listDemoBriefs } from '@/lib/store';

export const runtime = 'nodejs';

/** GET /api/demo/briefs -> list of seeded demo briefs for the landing page. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(listDemoBriefs());
}
