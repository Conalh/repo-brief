import { describe, expect, it } from 'vitest';
import { buildReadingPath } from './reading-path.js';
import type { Entrypoint, FileNode, ImportEdge, Manifest } from '../types.js';

const files: FileNode[] = [
  { path: 'README.md', extension: 'md', kind: 'docs' },
  { path: 'package.json', extension: 'json', kind: 'config' },
  { path: 'src/index.ts', extension: 'ts', kind: 'source' },
  { path: 'src/core.ts', extension: 'ts', kind: 'source' },
  { path: 'src/core.test.ts', extension: 'ts', kind: 'test' },
  { path: 'dist/bundle.js', extension: 'js', kind: 'generated' },
  { path: 'logo.png', extension: 'png', kind: 'asset' },
];

const entrypoints: Entrypoint[] = [
  { kind: 'app', path: 'src/index.ts', evidence: 'JS/TS app entry' },
];
const manifests: Manifest[] = [
  { path: 'package.json', manager: 'npm', scripts: {}, dependencies: [] },
];
// Two files import core.ts -> core is a "core module".
const edges: ImportEdge[] = [
  { from: 'src/index.ts', to: 'src/core.ts', kind: 'static', confidence: 'high' },
  { from: 'src/core.test.ts', to: 'src/core.ts', kind: 'static', confidence: 'high' },
];

describe('buildReadingPath', () => {
  it('orders README, manifest, entrypoint, core module, then a test', () => {
    const { steps } = buildReadingPath({ files, entrypoints, manifests, edges });
    const paths = steps.map((s) => s.path);
    expect(paths[0]).toBe('README.md');
    expect(paths[1]).toBe('package.json');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('src/core.ts');
    expect(paths).toContain('src/core.test.ts');
  });

  it('does not list the same file twice', () => {
    const { steps } = buildReadingPath({ files, entrypoints, manifests, edges });
    const paths = steps.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('collects generated and asset files into the skip list', () => {
    const { skip } = buildReadingPath({ files, entrypoints, manifests, edges });
    expect(skip).toEqual(expect.arrayContaining(['dist/bundle.js', 'logo.png']));
  });
});
