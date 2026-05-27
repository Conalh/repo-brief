import { NextResponse } from 'next/server';
import { GitHubIngestError, RepoUrlParseError } from '@repobrief/core';
import { runGitHubBrief } from '@/lib/analyze-service';

export const runtime = 'nodejs';
// Briefs can take up to ~90s; allow a long synchronous request on platforms
// that honor this (e.g. Vercel). Async job mode is a later enhancement.
export const maxDuration = 120;

/** POST /api/briefs { url } -> { id } — runs (or cache-hits) a GitHub brief. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  if (typeof body.url !== 'string' || body.url.trim() === '') {
    return NextResponse.json({ error: 'A repository "url" is required.' }, { status: 400 });
  }

  try {
    const brief = await runGitHubBrief(body.url);
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
  }
}
