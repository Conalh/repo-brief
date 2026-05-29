import { NextResponse } from 'next/server';
import { parseGitHubUrl, RepoUrlParseError, type BriefMode } from '@repobrief/core';
import { enqueueBrief, JobQueueFullError } from '@/lib/jobs';
import { briefsRateLimiter, clientIp } from '@/lib/rate-limit';

const MODES: BriefMode[] = ['fast', 'balanced', 'deep'];

export const runtime = 'nodejs';
// Analysis runs asynchronously in a background job; POST returns immediately.
// On a long-running host the job is unbounded; on serverless it is bounded by
// this duration, so keep it generous.
export const maxDuration = 120;

function tooManyRequests(message: string, retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}

/**
 * POST /api/briefs { url, mode? } -> 202 { jobId, status }.
 * Enqueues an async analysis job; clients poll GET /api/briefs/jobs/:jobId.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { url?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  if (typeof body.url !== 'string' || body.url.trim() === '') {
    return NextResponse.json({ error: 'A repository "url" is required.' }, { status: 400 });
  }

  const mode: BriefMode =
    typeof body.mode === 'string' && MODES.includes(body.mode as BriefMode)
      ? (body.mode as BriefMode)
      : 'balanced';

  // Validate the reference synchronously so obviously bad input fails fast with
  // a 400 instead of being accepted as a job that is doomed to fail.
  try {
    parseGitHubUrl(body.url);
  } catch (err) {
    if (err instanceof RepoUrlParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Per-IP rate limit guards against request floods; the job runner's
  // concurrency cap (and queue limit) bound how much work runs at once.
  const decision = briefsRateLimiter.take(clientIp(request.headers));
  if (!decision.ok) {
    return tooManyRequests('Too many requests. Please slow down.', decision.retryAfterSec);
  }

  try {
    const job = await enqueueBrief(body.url, mode);
    return NextResponse.json(
      { jobId: job.id, status: job.status },
      { status: 202, headers: { Location: `/api/briefs/jobs/${job.id}` } },
    );
  } catch (err) {
    if (err instanceof JobQueueFullError) {
      return tooManyRequests('Server is busy. Please try again shortly.', 30);
    }
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
