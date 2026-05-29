import { analyzeSnapshot, ingestGitHub, parseGitHubUrl } from '@repobrief/core';
import { briefId } from './brief-id';
import { hostedIngestLimits } from './server-config';
import { putBrief } from './store';

/** Repos seeded as landing-page demo briefs. */
const DEMO_REPOS = [
  'https://github.com/sindresorhus/slugify',
  'https://github.com/pallets/flask',
];

/**
 * Analyze each demo repo and store it as a demo brief. Idempotent (re-running
 * refreshes by repo+SHA). Used by POST /api/demo/seed so seeding goes through
 * the configured store — local SQLite or remote Turso alike.
 */
export async function seedDemoBriefs(): Promise<{ seeded: string[]; failed: string[] }> {
  const seeded: string[] = [];
  const failed: string[] = [];

  for (const reference of DEMO_REPOS) {
    try {
      const input = parseGitHubUrl(reference);
      const snapshot = await ingestGitHub(input, {
        token: process.env.GITHUB_TOKEN,
        limits: hostedIngestLimits(),
      });
      const report = await analyzeSnapshot(snapshot);
      const id = briefId(input.owner!, input.repo, snapshot.headSha, 'balanced');
      await putBrief({
        id,
        owner: input.owner,
        repo: input.repo,
        source: 'github',
        headSha: snapshot.headSha,
        report,
        isDemo: true,
        createdAt: new Date().toISOString(),
      });
      seeded.push(id);
    } catch {
      failed.push(reference);
    }
  }

  return { seeded, failed };
}
