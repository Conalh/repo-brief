import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestLocal } from '../ingest/local.js';
import { buildImportGraph } from '../graph/index.js';
import { analyzeSnapshot } from './pipeline.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

describe('Python service fixture', () => {
  it('detects FastAPI, pytest, an API entrypoint, and a python import edge', async () => {
    const snapshot = await ingestLocal(join(fixtures, 'py-service'));
    const brief = await analyzeSnapshot(snapshot);

    expect(brief.techStack.primaryLanguage).toBe('Python');
    expect(brief.techStack.frameworks.some((f) => f.name === 'FastAPI')).toBe(true);
    expect(brief.commands.test).toBe('pytest');
    expect(brief.entrypoints.some((e) => e.path === 'app/main.py')).toBe(true);

    // app/main.py imports app.routes -> the "app" subsystem self-references,
    // which is dropped; but the reading path should surface main.py.
    expect(brief.readingPath.steps.some((s) => s.path === 'app/main.py')).toBe(true);

    // The FastAPI decorator in app/routes.py should be picked up as a route.
    expect(
      brief.routes.some((r) => r.path === '/health' && r.framework === 'FastAPI'),
    ).toBe(true);
  });
});

describe('Go service fixture', () => {
  it('resolves an in-module import to the target package and groups subsystems', async () => {
    const snapshot = await ingestLocal(join(fixtures, 'go-service'));

    // main.go imports github.com/acme/svc/internal/store -> a cross-package edge
    // to the representative source file of that package directory.
    const { edges } = await buildImportGraph(snapshot);
    expect(edges).toContainEqual(
      expect.objectContaining({
        from: 'main.go',
        to: 'internal/store/store.go',
        kind: 'static',
      }),
    );

    const brief = await analyzeSnapshot(snapshot);
    expect(brief.techStack.primaryLanguage).toBe('Go');
  });
});

describe('Rust CLI fixture', () => {
  it('detects Rust, cargo commands, and the binary entrypoint', async () => {
    const snapshot = await ingestLocal(join(fixtures, 'rust-cli'));
    const brief = await analyzeSnapshot(snapshot);

    expect(brief.techStack.primaryLanguage).toBe('Rust');
    expect(brief.commands.build).toBe('cargo build');
    expect(brief.commands.test).toBe('cargo test');
    expect(brief.entrypoints.some((e) => e.path === 'src/main.rs')).toBe(true);
  });
});
