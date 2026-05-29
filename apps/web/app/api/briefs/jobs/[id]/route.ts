import { NextResponse } from 'next/server';
import { getJob } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/briefs/jobs/:id -> the job's current status.
 * Clients poll this after POST /api/briefs until status is succeeded or failed.
 * On success `briefId` points at the finished brief; on failure `error` explains.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    briefId: job.briefId,
    error: job.error,
  });
}
