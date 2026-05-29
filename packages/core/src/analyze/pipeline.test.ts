import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestLocal } from '../ingest/local.js';
import { analyzeSnapshot } from './pipeline.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', '..', 'fixtures', 'mini-repo');

describe('analyzeSnapshot (end-to-end over the fixture)', () => {
  it('detects the Next.js + TypeScript stack, commands and entrypoint', async () => {
    const snapshot = await ingestLocal(fixture);
    const brief = await analyzeSnapshot(snapshot);

    expect(brief.techStack.primaryLanguage).toBe('TypeScript');
    const next = brief.techStack.frameworks.find((f) => f.name === 'Next.js');
    expect(next?.confidence).toBe('high'); // dep + next.config.js

    expect(brief.commands.dev).toBe('npm run dev');
    expect(brief.commands.build).toBe('npm run build');
    expect(brief.commands.test).toBe('npm test');

    expect(brief.entrypoints.some((e) => e.path === 'app/page.tsx')).toBe(true);
    expect(brief.manifests.some((m) => m.manager === 'npm')).toBe(true);
  });

  it('builds subsystems with an import-graph dependency edge', async () => {
    const snapshot = await ingestLocal(fixture);
    const brief = await analyzeSnapshot(snapshot);

    const app = brief.subsystems.find((s) => s.name === 'app');
    expect(app).toBeDefined();
    // app/page.tsx imports ../src/index -> app depends on src.
    expect(app?.dependsOn).toContain('src');
    expect(brief.architectureMermaid).toContain('graph LR');
  });

  it('produces a reading path starting at the README', async () => {
    const snapshot = await ingestLocal(fixture);
    const brief = await analyzeSnapshot(snapshot);
    expect(brief.readingPath.steps[0]?.path).toBe('README.md');
    expect(brief.readingPath.steps.some((s) => s.path === 'app/page.tsx')).toBe(true);
  });

  it('deep mode degrades to no churn when the churn provider throws', async () => {
    const snapshot = await ingestLocal(fixture);
    const failing = {
      ...snapshot,
      churn: {
        recentChanges: async () => {
          throw new Error('rate limited');
        },
      },
    };
    // Must produce a brief rather than letting the churn failure escape.
    const brief = await analyzeSnapshot(failing, { mode: 'deep' });
    expect(brief.mode).toBe('deep');
    expect(Array.isArray(brief.hotspots)).toBe(true);
  });

  it('fast mode skips the import graph (no subsystem dependencies)', async () => {
    const snapshot = await ingestLocal(fixture);
    const brief = await analyzeSnapshot(snapshot, { mode: 'fast' });
    expect(brief.mode).toBe('fast');
    // Subsystems still group by folder, but with no edges there are no deps.
    expect(brief.subsystems.every((s) => s.dependsOn.length === 0)).toBe(true);
    expect(brief.architectureMermaid).not.toContain('-->');
  });
});
