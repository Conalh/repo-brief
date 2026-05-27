import type { FileNode, ImportEdge, Subsystem } from '../types.js';

const MONOREPO_ROOTS = new Set([
  'packages',
  'apps',
  'libs',
  'services',
  'crates', // Rust workspaces
  'modules',
]);

/**
 * Compute the subsystem key that owns a file, using folder conventions:
 *   - monorepo packages/apps -> "packages/<name>"
 *   - a src/ layout          -> "src/<dir>" (or "src" for files directly in src)
 *   - otherwise              -> the top-level directory ("(root)" for root files)
 */
export function subsystemKeyFor(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) return '(root)';

  const [first, second] = parts;
  // `second` is only a real sub-directory when the path nests deeper than it.
  const nested = parts.length >= 3;
  if (MONOREPO_ROOTS.has(first!) && second) return `${first}/${second}`;
  if (first === 'src') return nested ? `src/${second}` : 'src';
  return first!;
}

/** Human-friendly name for a subsystem key (its last path segment). */
function displayName(key: string): string {
  const seg = key.slice(key.lastIndexOf('/') + 1);
  return seg || key;
}

/**
 * Group files into subsystems by folder convention, then refine each with the
 * import graph: a subsystem depends on another when a file in the first imports
 * a file in the second.
 */
export function buildSubsystems(files: FileNode[], edges: ImportEdge[]): Subsystem[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.kind !== 'source') continue;
    const key = subsystemKeyFor(file.path);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const dependsOn = new Map<string, Set<string>>();
  for (const edge of edges) {
    const from = subsystemKeyFor(edge.from);
    const to = subsystemKeyFor(edge.to);
    if (from === to) continue;
    // Only relate subsystems that actually hold source files.
    if (!counts.has(from) || !counts.has(to)) continue;
    if (!dependsOn.has(from)) dependsOn.set(from, new Set());
    dependsOn.get(from)!.add(to);
  }

  return [...counts.entries()]
    .map(([key, fileCount]) => ({
      name: displayName(key),
      pathPrefix: key,
      fileCount,
      dependsOn: [...(dependsOn.get(key) ?? [])].map(displayName).sort(),
      confidence: 'medium' as const,
    }))
    .sort((a, b) => b.fileCount - a.fileCount || a.pathPrefix.localeCompare(b.pathPrefix));
}
