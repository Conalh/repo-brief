import type { Manifest, RepoSnapshot } from '../../types.js';
import { parseGithubWorkflow } from './github-actions.js';
import { parseNpmManifest } from './npm.js';
import { parsePyproject, parseRequirementsTxt } from './python.js';
import { parseCargoToml } from './rust.js';

export { parseNpmManifest } from './npm.js';
export { parsePyproject, parseRequirementsTxt } from './python.js';
export { parseCargoToml } from './rust.js';
export { parseGithubWorkflow } from './github-actions.js';

/** Returns the basename of a POSIX path. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Pick the parser for a given file path, or null if it is not a manifest. */
function parserFor(
  path: string,
): ((path: string, content: string) => Manifest | null) | null {
  const base = baseName(path).toLowerCase();
  if (base === 'package.json') return parseNpmManifest;
  if (base === 'pyproject.toml') return parsePyproject;
  if (base === 'requirements.txt') return parseRequirementsTxt;
  if (base === 'cargo.toml') return parseCargoToml;
  if (/(^|\/)\.github\/workflows\/.+\.ya?ml$/.test(path.toLowerCase())) {
    return parseGithubWorkflow;
  }
  return null;
}

/**
 * Find every supported manifest in the snapshot, read its content via the
 * snapshot reader, and parse it. Files that fail to parse are skipped. The
 * returned manifests are ordered shallowest-path-first so root manifests win.
 */
export async function collectManifests(snapshot: RepoSnapshot): Promise<Manifest[]> {
  const candidates = snapshot.files
    .filter((file) => parserFor(file.path) !== null)
    .sort((a, b) => depth(a.path) - depth(b.path));

  const manifests: Manifest[] = [];
  for (const file of candidates) {
    const parse = parserFor(file.path)!;
    const content = await snapshot.reader.read(file.path);
    if (content === null) continue;
    const manifest = parse(file.path, content);
    if (manifest) manifests.push(manifest);
  }
  return manifests;
}

function depth(path: string): number {
  return path.split('/').length;
}
