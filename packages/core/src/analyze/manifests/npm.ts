import type { Manifest } from '../../types.js';

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

/**
 * Parse a package.json into a normalized Manifest. Returns null when the content
 * is not valid JSON (e.g. a truncated or non-manifest file).
 */
export function parseNpmManifest(path: string, content: string): Manifest | null {
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
  if (pkg === null || typeof pkg !== 'object') return null;

  const dependencies = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];

  const node = pkg.engines?.node;

  return {
    path,
    manager: 'npm',
    scripts: { ...(pkg.scripts ?? {}) },
    dependencies,
    runtime: node ? `node ${node}` : undefined,
  };
}
