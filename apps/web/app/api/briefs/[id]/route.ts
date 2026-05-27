import { NextResponse } from 'next/server';
import { getBrief } from '@/lib/store';

export const runtime = 'nodejs';

/** GET /api/briefs/:id -> the stored brief, or 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const brief = getBrief(id);
  if (!brief) {
    return NextResponse.json({ error: 'Brief not found.' }, { status: 404 });
  }
  return NextResponse.json(brief);
}
