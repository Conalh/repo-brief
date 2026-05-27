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
});
