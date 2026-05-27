import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BriefReport } from '@repobrief/core';

// Point the store at a throwaway DB before it is first opened (getDb reads the
// env lazily on first call, so setting it here is enough).
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'repobrief-test-'));
  process.env.REPOBRIEF_DB_PATH = join(dir, 'test.sqlite');
});

function fakeReport(identity: string): BriefReport {
  return {
    identity,
    mode: 'balanced',
    fileCount: 1,
    kindBreakdown: {
      source: 1,
      test: 0,
      docs: 0,
      config: 0,
      workflow: 0,
      asset: 0,
      generated: 0,
      unknown: 0,
    },
    techStack: { languages: ['TypeScript'], frameworks: [], packageManagers: [] },
    commands: {},
    entrypoints: [],
    manifests: [],
    subsystems: [],
    architectureMermaid: '',
    cycles: [],
    routes: [],
    hotspots: [],
    readingPath: { steps: [], skip: [] },
    partial: false,
    generatedAt: new Date().toISOString(),
  };
}

describe('store', () => {
  it('round-trips a brief by id', async () => {
    const { getBrief, putBrief } = await import('./store');
    await putBrief({
      id: 'octo-demo-abc',
      owner: 'octo',
      repo: 'demo',
      source: 'github',
      headSha: 'abc',
      report: fakeReport('octo/demo'),
      isDemo: false,
      createdAt: new Date().toISOString(),
    });

    const loaded = await getBrief('octo-demo-abc');
    expect(loaded?.repo).toBe('demo');
    expect(loaded?.report.identity).toBe('octo/demo');
    expect(loaded?.isDemo).toBe(false);
  });

  it('returns null for an unknown id', async () => {
    const { getBrief } = await import('./store');
    expect(await getBrief('does-not-exist')).toBeNull();
  });

  it('lists only demo briefs', async () => {
    const { putBrief, listDemoBriefs } = await import('./store');
    await putBrief({
      id: 'demo-one',
      repo: 'one',
      source: 'github',
      report: fakeReport('one'),
      isDemo: true,
      createdAt: new Date().toISOString(),
    });

    const demos = await listDemoBriefs();
    expect(demos.some((d) => d.id === 'demo-one')).toBe(true);
    expect(demos.every((d) => d.isDemo)).toBe(true);
  });

  it('replaces an existing brief on re-put (cache refresh)', async () => {
    const { getBrief, putBrief } = await import('./store');
    const base = {
      id: 'replace-me',
      repo: 'r',
      source: 'github',
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
    await putBrief({ ...base, report: fakeReport('first') });
    await putBrief({ ...base, report: fakeReport('second') });
    expect((await getBrief('replace-me'))?.report.identity).toBe('second');
  });
});
