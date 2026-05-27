import { parse as parseToml } from 'smol-toml';
import type { Manifest } from '../../types.js';

/** Strip a PEP 508 / requirements line down to its package name. */
function depName(spec: string): string | null {
  const cleaned = spec.split('#')[0]!.trim();
  if (!cleaned || cleaned.startsWith('-')) return null; // skip flags like -r, -e
  // Name ends at the first version/extras/marker delimiter.
  const match = /^[A-Za-z0-9._-]+/.exec(cleaned);
  return match ? match[0].toLowerCase() : null;
}

/** Parse a requirements.txt into a Manifest of dependency names. */
export function parseRequirementsTxt(path: string, content: string): Manifest {
  const dependencies: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const name = depName(line);
    if (name) dependencies.push(name);
  }
  return { path, manager: 'python', scripts: {}, dependencies };
}

interface PyProject {
  project?: {
    dependencies?: string[];
    'requires-python'?: string;
    scripts?: Record<string, string>;
  };
  tool?: {
    poetry?: {
      dependencies?: Record<string, unknown>;
      scripts?: Record<string, string>;
    };
  };
}

/**
 * Parse a pyproject.toml into a Manifest. Handles both PEP 621 (`[project]`)
 * and Poetry (`[tool.poetry]`) dependency tables. Returns null on invalid TOML.
 */
export function parsePyproject(path: string, content: string): Manifest | null {
  let doc: PyProject;
  try {
    doc = parseToml(content) as PyProject;
  } catch {
    return null;
  }

  const dependencies = new Set<string>();
  for (const spec of doc.project?.dependencies ?? []) {
    const name = depName(spec);
    if (name) dependencies.add(name);
  }
  for (const name of Object.keys(doc.tool?.poetry?.dependencies ?? {})) {
    if (name.toLowerCase() !== 'python') dependencies.add(name.toLowerCase());
  }

  const scripts = {
    ...(doc.project?.scripts ?? {}),
    ...(doc.tool?.poetry?.scripts ?? {}),
  };

  const requiresPython = doc.project?.['requires-python'];

  return {
    path,
    manager: 'python',
    scripts,
    dependencies: [...dependencies],
    runtime: requiresPython ? `python ${requiresPython}` : undefined,
  };
}
