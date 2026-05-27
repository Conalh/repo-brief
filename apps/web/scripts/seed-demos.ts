/**
 * Seed demo briefs into the SQLite store so the landing page has content and
 * works offline / under GitHub rate limits. Run with:
 *   GITHUB_TOKEN=... node --experimental-strip-types scripts/seed-demos.ts
 *
 * Demos are marked is_demo=1 and keyed like any other brief, so they double as
 * normal shareable links.
 */
import { analyzeSnapshot, ingestGitHub, parseGitHubUrl } from '@repobrief/core';
import { putBrief } from '../lib/store.ts';

const DEMO_REPOS = [
  'https://github.com/sindresorhus/slugify',
  'https://github.com/pallets/flask',
];

async function seed(reference: string): Promise<void> {
  const input = parseGitHubUrl(reference);
  const snapshot = await ingestGitHub(input, { token: process.env.GITHUB_TOKEN });
  const report = await analyzeSnapshot(snapshot);
  const slug = `${input.owner}-${input.repo}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const id = snapshot.headSha ? `${slug}-${snapshot.headSha.slice(0, 12)}` : slug;

  putBrief({
    id,
    owner: input.owner,
    repo: input.repo,
    source: 'github',
    headSha: snapshot.headSha,
    report,
    isDemo: true,
    createdAt: new Date().toISOString(),
  });
  console.log(`seeded demo: ${id}`);
}

for (const repo of DEMO_REPOS) {
  try {
    await seed(repo);
  } catch (err) {
    console.error(`failed to seed ${repo}:`, err instanceof Error ? err.message : err);
  }
}
