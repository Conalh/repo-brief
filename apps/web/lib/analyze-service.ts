import {
  analyzeSnapshot,
  ingestGitHub,
  parseGitHubUrl,
} from '@repobrief/core';
import { getBrief, putBrief, type StoredBrief } from './store';

/** Build a deterministic, URL-safe id from owner/repo/sha so re-runs cache-hit. */
function briefId(owner: string, repo: string, sha: string | undefined): string {
  const slug = `${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return sha ? `${slug}-${sha.slice(0, 12)}` : slug;
}

/**
 * Run (or return a cached) brief for a public GitHub repo. The hosted surface
 * only accepts GitHub references — it never reads the server filesystem from
 * user input. Completed briefs are persisted by owner/repo/SHA.
 */
export async function runGitHubBrief(reference: string): Promise<StoredBrief> {
  const input = parseGitHubUrl(reference);
  const snapshot = await ingestGitHub(input, { token: process.env.GITHUB_TOKEN });

  const id = briefId(input.owner!, input.repo, snapshot.headSha);
  const cached = getBrief(id);
  if (cached) return cached;

  const report = await analyzeSnapshot(snapshot);
  const brief: StoredBrief = {
    id,
    owner: input.owner,
    repo: input.repo,
    source: 'github',
    headSha: snapshot.headSha,
    report,
    isDemo: false,
    createdAt: new Date().toISOString(),
  };
  putBrief(brief);
  return brief;
}
