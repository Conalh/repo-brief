import {
  analyzeSnapshot,
  ingestGitHub,
  parseGitHubUrl,
  type BriefMode,
} from '@repobrief/core';
import { briefId } from './brief-id';
import { getBrief, putBrief, type StoredBrief } from './store';

/**
 * Run (or return a cached) brief for a public GitHub repo. The hosted surface
 * only accepts GitHub references — it never reads the server filesystem from
 * user input. Completed briefs are persisted by owner/repo/SHA/mode.
 */
export async function runGitHubBrief(
  reference: string,
  mode: BriefMode = 'balanced',
): Promise<StoredBrief> {
  const input = parseGitHubUrl(reference);
  const snapshot = await ingestGitHub(input, { token: process.env.GITHUB_TOKEN });

  const id = briefId(input.owner!, input.repo, snapshot.headSha, mode);
  const cached = getBrief(id);
  if (cached) return cached;

  const report = await analyzeSnapshot(snapshot, { mode });
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
