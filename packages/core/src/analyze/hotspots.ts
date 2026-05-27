import type { Degree } from '../graph/index.js';
import type { FileNode, Hotspot, ImportEdge } from '../types.js';
import { computeDegrees } from '../graph/index.js';

/** Scoring thresholds. Deliberately simple/absolute for V1; documented here. */
const HIGH_LINES = 300;
const HIGH_FAN_IN = 5;
const HIGH_FAN_OUT = 10;
/** A file is "high churn" if it changed in at least this many recent commits. */
const HIGH_CHURN = 3;
const MAX_HOTSPOTS = 15;

/** Filenames that hint at grab-bag responsibility (PLAN heuristic). */
const BROAD_NAMES = new Set(['utils', 'util', 'helpers', 'helper', 'manager', 'controller', 'common']);

/** basename without directory. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Stem of a file: basename minus extension and any .test/.spec suffix. */
function stem(path: string): string {
  let base = baseName(path).toLowerCase();
  base = base.replace(/\.[a-z0-9]+$/, ''); // extension
  base = base.replace(/\.(test|spec)$/, ''); // test marker
  return base;
}

/** Directory portion of a path ("" for a root file). */
function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

interface TestCoverage {
  /** Stems that have a same-named test file (e.g. core.ts <- core.test.ts). */
  stems: Set<string>;
  /** Directories that contain at least one test file. */
  dirs: Set<string>;
}

function testCoverage(files: FileNode[]): TestCoverage {
  const stems = new Set<string>();
  const dirs = new Set<string>();
  for (const file of files) {
    if (file.kind !== 'test') continue;
    stems.add(stem(file.path));
    dirs.add(dirOf(file.path));
  }
  return { stems, dirs };
}

/**
 * A source file counts as having nearby tests when a test shares its stem OR a
 * test lives in the same directory. The directory rule keeps well-tested
 * modules from being flagged just because tests are grouped per folder.
 */
function hasNearbyTests(path: string, coverage: TestCoverage): boolean {
  return coverage.stems.has(stem(path)) || coverage.dirs.has(dirOf(path));
}

/**
 * Score source files for "worth a look" attention using line count, import
 * centrality, a test gap, and broad-name heuristics. Churn (PLAN's +2) is
 * deferred to deep mode once commit history is available. Returns the top
 * hotspots, highest score first.
 */
export function detectHotspots(
  files: FileNode[],
  edges: ImportEdge[],
  lineCounts: Map<string, number>,
  churn: Map<string, number> = new Map(),
): Hotspot[] {
  const degrees = computeDegrees(edges);
  const coverage = testCoverage(files);
  const hotspots: Hotspot[] = [];

  for (const file of files) {
    if (file.kind !== 'source') continue;

    const reasons: string[] = [];
    let score = 0;
    const degree: Degree = degrees.get(file.path) ?? { fanIn: 0, fanOut: 0 };
    const lines = lineCounts.get(file.path) ?? file.lineCount ?? 0;

    if (lines >= HIGH_LINES) {
      score += 2;
      reasons.push(`large file (${lines} lines)`);
    }
    if (degree.fanIn >= HIGH_FAN_IN) {
      score += 2;
      reasons.push(`high fan-in (${degree.fanIn} importers)`);
    }
    if (degree.fanOut >= HIGH_FAN_OUT) {
      score += 1;
      reasons.push(`high fan-out (${degree.fanOut} imports)`);
    }
    const changes = churn.get(file.path) ?? 0;
    if (changes >= HIGH_CHURN) {
      score += 2;
      reasons.push(`frequently changed (${changes} recent commits)`);
    }
    if (!hasNearbyTests(file.path, coverage)) {
      score += 2;
      reasons.push('no nearby tests');
    }
    if (BROAD_NAMES.has(stem(file.path))) {
      score += 1;
      reasons.push('broad-responsibility name');
    }

    if (score > 0) {
      hotspots.push({ path: file.path, score, reasons, recommendation: recommend(reasons) });
    }
  }

  return hotspots
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, MAX_HOTSPOTS);
}

/** Pick a recommendation from the strongest signal present. */
function recommend(reasons: string[]): string {
  if (reasons.some((r) => r.startsWith('high fan-in'))) {
    return 'Core module — many files depend on it; change with care.';
  }
  if (reasons.some((r) => r.startsWith('frequently changed'))) {
    return 'Actively churning — recent, frequent edits; expect it to keep moving.';
  }
  if (reasons.some((r) => r.startsWith('large file'))) {
    return 'Large file — consider reading in sections or splitting.';
  }
  if (reasons.includes('no nearby tests')) {
    return 'No tests found — verify behavior before changing.';
  }
  if (reasons.includes('broad-responsibility name')) {
    return 'Grab-bag name — likely mixes concerns.';
  }
  return 'Worth a look.';
}
