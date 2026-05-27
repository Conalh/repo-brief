import { describe, expect, it } from 'vitest';
import { detectHotspots } from './hotspots.js';
import type { FileNode, ImportEdge } from '../types.js';

const files: FileNode[] = [
  // In its own directory with no test -> exercises the test-gap signal.
  { path: 'src/lib/utils.ts', extension: 'ts', kind: 'source' },
  { path: 'src/core.ts', extension: 'ts', kind: 'source' },
  { path: 'src/core.test.ts', extension: 'ts', kind: 'test' },
  { path: 'src/small.ts', extension: 'ts', kind: 'source' },
  { path: 'src/small.test.ts', extension: 'ts', kind: 'test' },
];

// Five files import core.ts -> high fan-in.
const edges: ImportEdge[] = ['a', 'b', 'c', 'd', 'e'].map((n) => ({
  from: `src/${n}.ts`,
  to: 'src/core.ts',
  kind: 'static',
  confidence: 'high',
}));

const lineCounts = new Map([
  ['src/lib/utils.ts', 50],
  ['src/core.ts', 400],
  ['src/small.ts', 20],
]);

describe('detectHotspots', () => {
  it('ranks the large, central, untested file highest', () => {
    const hotspots = detectHotspots(files, edges, lineCounts);
    expect(hotspots[0]?.path).toBe('src/core.ts');
    // large(+2) + fan-in(+2) ... core has a test so no test-gap point.
    expect(hotspots[0]?.reasons).toEqual(
      expect.arrayContaining(['large file (400 lines)', 'high fan-in (5 importers)']),
    );
    expect(hotspots[0]?.recommendation).toMatch(/core module/i);
  });

  it('flags an untested broad-named file', () => {
    const hotspots = detectHotspots(files, edges, lineCounts);
    const utils = hotspots.find((h) => h.path === 'src/lib/utils.ts');
    expect(utils?.reasons).toEqual(
      expect.arrayContaining(['no nearby tests', 'broad-responsibility name']),
    );
  });

  it('does not flag a small, tested, peripheral file', () => {
    const hotspots = detectHotspots(files, edges, lineCounts);
    expect(hotspots.some((h) => h.path === 'src/small.ts')).toBe(false);
  });

  it('adds a high-churn signal when commit history is supplied', () => {
    // small.ts is otherwise unflagged; heavy recent churn should surface it.
    const churn = new Map([['src/small.ts', 9]]);
    const hotspots = detectHotspots(files, edges, lineCounts, churn);
    const small = hotspots.find((h) => h.path === 'src/small.ts');
    expect(small?.reasons).toContain('frequently changed (9 recent commits)');
  });

  it('ignores churn below the threshold', () => {
    const churn = new Map([['src/small.ts', 1]]);
    const hotspots = detectHotspots(files, edges, lineCounts, churn);
    expect(hotspots.some((h) => h.path === 'src/small.ts')).toBe(false);
  });
});
