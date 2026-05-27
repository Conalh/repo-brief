import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestLocal } from './local.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', '..', 'fixtures', 'mini-repo');

describe('ingestLocal', () => {
  it('walks the fixture into normalized file nodes', async () => {
    const snapshot = await ingestLocal(fixture);
    const paths = snapshot.files.map((f) => f.path).sort();

    expect(snapshot.input.sourceType).toBe('local_path');
    expect(snapshot.input.repo).toBe('mini-repo');
    expect(paths).toContain('README.md');
    expect(paths).toContain('src/index.ts');
    expect(snapshot.truncated).toBe(false);
  });

  it('marks the snapshot truncated when the file cap is hit', async () => {
    const snapshot = await ingestLocal(fixture, { maxFiles: 1 });
    expect(snapshot.truncated).toBe(true);
    expect(snapshot.files).toHaveLength(1);
  });

  it('exposes a churn provider that reads local git history', async () => {
    // The monorepo root is a git repo with commits.
    const repoRoot = join(here, '..', '..', '..', '..');
    const snapshot = await ingestLocal(repoRoot);
    const churn = await snapshot.churn!.recentChanges(30);
    expect(churn.size).toBeGreaterThan(0);
    for (const count of churn.values()) expect(count).toBeGreaterThanOrEqual(1);
  });
});
