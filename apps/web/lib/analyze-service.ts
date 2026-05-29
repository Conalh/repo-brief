import {
  analyzeSnapshot,
  ingestGitHub,
  parseGitHubUrl,
  type BriefMode,
} from '@repobrief/core';
import { briefId } from './brief-id';
import { hostedIngestLimits } from './server-config';
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
  const snapshot = await ingestGitHub(input, {
    token: process.env.GITHUB_TOKEN,
    limits: hostedIngestLimits(),
  });

  const id = briefId(input.owner!, input.repo, snapshot.headSha, mode);
  const cached = await getBrief(id);
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
  await putBrief(brief);
  return brief;
}
