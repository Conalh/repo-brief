import { describe, expect, it } from 'vitest';
import { buildSubsystems, subsystemKeyFor } from './subsystems.js';
import type { FileNode, ImportEdge } from '../types.js';

describe('subsystemKeyFor', () => {
  it.each([
    ['index.ts', '(root)'],
    ['src/index.ts', 'src'],
    ['src/ingest/github.ts', 'src/ingest'],
    ['packages/core/src/x.ts', 'packages/core'],
    ['apps/web/page.tsx', 'apps/web'],
    ['lib/util.ts', 'lib'],
  ])('maps %s -> %s', (path, key) => {
    expect(subsystemKeyFor(path)).toBe(key);
  });
});

describe('buildSubsystems', () => {
  const files: FileNode[] = [
    { path: 'src/ingest/github.ts', extension: 'ts', kind: 'source' },
    { path: 'src/ingest/local.ts', extension: 'ts', kind: 'source' },
    { path: 'src/report/brief.ts', extension: 'ts', kind: 'source' },
    { path: 'README.md', extension: 'md', kind: 'docs' },
  ];
  const edges: ImportEdge[] = [
    { from: 'src/report/brief.ts', to: 'src/ingest/github.ts', kind: 'static', confidence: 'high' },
  ];

  it('groups by folder and counts only source files', () => {
    const subs = buildSubsystems(files, edges);
    const ingest = subs.find((s) => s.pathPrefix === 'src/ingest');
    expect(ingest?.fileCount).toBe(2);
    expect(subs.some((s) => s.name === 'README.md')).toBe(false);
  });

  it('derives dependsOn from import edges', () => {
    const subs = buildSubsystems(files, edges);
    const report = subs.find((s) => s.pathPrefix === 'src/report');
    expect(report?.dependsOn).toEqual(['ingest']);
  });
});
