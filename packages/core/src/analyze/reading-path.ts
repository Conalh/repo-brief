import { computeDegrees } from '../graph/index.js';
import type {
  Entrypoint,
  FileNode,
  ImportEdge,
  Manifest,
  ReadingPath,
  ReadingStep,
} from '../types.js';

const MAX_STEPS = 8;
const MAX_CORE_MODULES = 3;
const MAX_SKIP = 12;

export interface ReadingPathInput {
  files: FileNode[];
  entrypoints: Entrypoint[];
  manifests: Manifest[];
  edges: ImportEdge[];
}

function depth(path: string): number {
  return path.split('/').length;
}

/** Find the repo's top-level README, if any. */
function findReadme(files: FileNode[]): string | undefined {
  return files
    .filter((f) => /^readme(\.|$)/i.test(f.path.slice(f.path.lastIndexOf('/') + 1)))
    .sort((a, b) => depth(a.path) - depth(b.path))[0]?.path;
}

/**
 * Build an ordered "read these first" path: orient with the README and manifest,
 * then entrypoints, then the most-depended-on core modules, then a test for
 * concrete behavior. Generated/asset files are surfaced as a skip list.
 */
export function buildReadingPath(input: ReadingPathInput): ReadingPath {
  const { files, entrypoints, manifests, edges } = input;
  const steps: ReadingStep[] = [];
  const used = new Set<string>();

  const add = (path: string | undefined, reason: string): void => {
    if (!path || used.has(path) || steps.length >= MAX_STEPS) return;
    used.add(path);
    steps.push({ path, reason });
  };

  add(findReadme(files), 'Project overview — what this is and how to run it.');
  add(manifests[0]?.path, 'Manifest — scripts, dependencies, and entry config.');

  for (const ep of entrypoints) {
    add(ep.path, `Entry point (${ep.kind}) — where execution begins.`);
  }

  // Core modules: most-imported source files not already listed.
  const degrees = computeDegrees(edges);
  const sourcePaths = new Set(
    files.filter((f) => f.kind === 'source').map((f) => f.path),
  );
  const core = [...degrees.entries()]
    .filter(([path, d]) => d.fanIn >= 2 && sourcePaths.has(path))
    .sort((a, b) => b[1].fanIn - a[1].fanIn)
    .slice(0, MAX_CORE_MODULES);
  for (const [path, d] of core) {
    add(path, `Core module — ${d.fanIn} files depend on it.`);
  }

  // One representative test for concrete usage. Prefer a real test file outside
  // test-data/fixtures (both are kind 'test'), since a fixture isn't instructive.
  const tests = files.filter((f) => f.kind === 'test');
  const isTestData = (p: string) =>
    /(^|\/)(fixtures?|__fixtures__|testdata|test-data|__mocks__|mocks|snapshots|__snapshots__)\//i.test(
      p,
    );
  const isRealTest = (p: string) => /\.(test|spec)\.[a-z]+$/i.test(p);
  const test =
    tests.find((f) => isRealTest(f.path) && !isTestData(f.path)) ??
    tests.find((f) => isRealTest(f.path)) ??
    tests[0];
  add(test?.path, 'A test — concrete usage and expected behavior.');

  const skip = files
    .filter((f) => f.kind === 'generated' || f.kind === 'asset')
    .map((f) => f.path)
    .sort()
    .slice(0, MAX_SKIP);

  return { steps, skip };
}
