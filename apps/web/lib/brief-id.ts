import type { BriefMode } from '@repobrief/core';

/**
 * Build a deterministic, URL-safe brief id from owner/repo/sha/mode so re-runs
 * cache-hit. Balanced (the default) gets no suffix to keep links clean; other
 * modes are suffixed so they don't collide in the cache.
 */
export function briefId(
  owner: string,
  repo: string,
  sha: string | undefined,
  mode: BriefMode,
): string {
  const slug = `${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const suffix = mode === 'balanced' ? '' : `-${mode}`;
  return (sha ? `${slug}-${sha.slice(0, 12)}` : slug) + suffix;
}
