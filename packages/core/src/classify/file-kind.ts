import type { FileKind } from '../types.js';

const SOURCE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'rs',
  'go',
  'java',
  'rb',
  'php',
  'c',
  'h',
  'cpp',
  'cc',
  'cs',
  'swift',
  'kt',
  'scala',
]);

const DOCS_EXTENSIONS = new Set(['md', 'mdx', 'rst', 'txt', 'adoc']);

const CONFIG_EXTENSIONS = new Set([
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'env',
  'lock',
  'xml',
]);

const ASSET_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'webp',
  'woff',
  'woff2',
  'ttf',
  'mp4',
  'mp3',
  'pdf',
]);

const GENERATED_HINTS = [
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  'out/',
  'coverage/',
  '.min.',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  // Vendored / third-party code: not this repo's own source.
  'vendor/',
  'third_party/',
  'third-party/',
  'vendored/',
];

// Directories holding test/sample data. Their files are support material, not
// the repo's primary source, so we classify them as test to keep them out of
// subsystem/hotspot/reading-path signals.
const TEST_DATA_DIRS = /(^|\/)(fixtures?|__fixtures__|testdata|test-data|__mocks__|mocks|snapshots|__snapshots__)\//;

// Directories holding example / sample / template projects. Their code is real
// (so it stays in the import graph and subsystems), but their manifests must NOT
// drive the repo's own stack/command detection — e.g. an `examples/next-app`
// would otherwise make a non-Next.js repo report "Next.js".
const EXAMPLE_DIRS = /(^|\/)(examples?|samples?|templates?)\//i;

/** True when a path lives under an example/sample/template project directory. */
export function isExamplePath(path: string): boolean {
  return EXAMPLE_DIRS.test(path);
}

/** Extract the lowercased extension (no dot) from a POSIX path. "" if none. */
export function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  // Leading-dot files like ".gitignore" have no extension.
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

/** True when the path looks like a test file by common conventions. */
function looksLikeTest(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(^|\/)(tests?|__tests__|spec)\//.test(lower) ||
    /\.(test|spec)\.[a-z]+$/.test(lower) ||
    /_test\.[a-z]+$/.test(lower)
  );
}

/**
 * Classify a file into a coarse responsibility kind using path and extension
 * heuristics. This is intentionally simple for Milestone 1; Milestone 2 refines
 * it with manifest- and framework-aware rules.
 */
export function classifyFileKind(path: string): FileKind {
  const lower = path.toLowerCase();

  if (GENERATED_HINTS.some((hint) => lower.includes(hint))) {
    return 'generated';
  }

  if (/(^|\/)\.github\/workflows\//.test(lower)) {
    return 'workflow';
  }

  if (looksLikeTest(path) || TEST_DATA_DIRS.test(lower)) {
    return 'test';
  }

  const ext = extensionOf(path);

  if (DOCS_EXTENSIONS.has(ext)) return 'docs';
  if (ASSET_EXTENSIONS.has(ext)) return 'asset';
  if (SOURCE_EXTENSIONS.has(ext)) return 'source';
  if (CONFIG_EXTENSIONS.has(ext)) return 'config';

  // Common extensionless config/dotfiles.
  const base = lower.slice(lower.lastIndexOf('/') + 1);
  if (
    base === 'dockerfile' ||
    base === 'makefile' ||
    base === 'procfile' ||
    base.startsWith('.')
  ) {
    return 'config';
  }

  return 'unknown';
}
