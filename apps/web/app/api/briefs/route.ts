import { NextResponse } from 'next/server';
import {
  GitHubIngestError,
  RepoUrlParseError,
  type BriefMode,
} from '@repobrief/core';
import { runGitHubBrief } from '@/lib/analyze-service';
import { briefsRateLimiter, clientIp } from '@/lib/rate-limit';

const MODES: BriefMode[] = ['fast', 'balanced', 'deep'];

export const runtime = 'nodejs';
// Briefs can take up to ~90s; allow a long synchronous request on platforms
// that honor this (e.g. Vercel). Async job mode is a later enhancement.
export const maxDuration = 120;

function tooManyRequests(message: string, retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}

/** POST /api/briefs { url } -> { id } — runs (or cache-hits) a GitHub brief. */
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

  // Per-IP rate limit guards against request floods; the concurrency cap bounds
  // how many expensive analyses run at once on this instance.
  const decision = briefsRateLimiter.take(clientIp(request.headers));
  if (!decision.ok) {
    return tooManyRequests('Too many requests. Please slow down.', decision.retryAfterSec);
  }
  if (!briefsRateLimiter.acquire()) {
    return tooManyRequests('Server is busy analyzing other repositories. Try again shortly.', 30);
  }

  try {
    const brief = await runGitHubBrief(body.url, mode);
    return NextResponse.json({ id: brief.id }, { status: 201 });
  } catch (err) {
    if (err instanceof RepoUrlParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof GitHubIngestError) {
      const status = err.status === 404 ? 404 : err.status === 403 ? 429 : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    briefsRateLimiter.release();
  }
}
