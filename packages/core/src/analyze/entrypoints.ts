import type {
  Commands,
  Entrypoint,
  EntrypointKind,
  Manifest,
  RepoSnapshot,
} from '../types.js';

/**
 * Resolve dev/build/test commands from manifests. npm scripts take priority
 * (shallowest manifest wins), then Cargo's fixed lifecycle, then Python test
 * runners. Manifests are assumed shallowest-first (see collectManifests).
 */
export function detectCommands(manifests: Manifest[]): Commands {
  const commands: Commands = {};

  const npm = manifests.find((m) => m.manager === 'npm');
  if (npm) {
    if (npm.scripts.dev) commands.dev = 'npm run dev';
    else if (npm.scripts.start) commands.dev = 'npm start';
    if (npm.scripts.build) commands.build = 'npm run build';
    if (npm.scripts.test) commands.test = 'npm test';
  }

  const rust = manifests.find((m) => m.manager === 'rust');
  if (rust) {
    commands.dev ??= 'cargo run';
    commands.build ??= 'cargo build';
    commands.test ??= 'cargo test';
  }

  const python = manifests.find((m) => m.manager === 'python');
  if (python && !commands.test && python.dependencies.includes('pytest')) {
    commands.test = 'pytest';
  }

  return commands;
}

/** Conventional entry-file patterns, checked in order; first match per kind wins. */
const ENTRY_RULES: { kind: EntrypointKind; pattern: RegExp; evidence: string }[] = [
  { kind: 'app', pattern: /(^|\/)app\/page\.(tsx|jsx|ts|js)$/, evidence: 'Next.js app router page' },
  { kind: 'app', pattern: /(^|\/)pages\/index\.(tsx|jsx|ts|js)$/, evidence: 'Next.js pages router index' },
  { kind: 'app', pattern: /(^|\/)src\/(main|index)\.(tsx|ts|jsx|js)$/, evidence: 'JS/TS app entry' },
  { kind: 'app', pattern: /(^|\/)src\/main\.rs$/, evidence: 'Rust binary entry' },
  { kind: 'app', pattern: /(^|\/)main\.go$/, evidence: 'Go program entry' },
  { kind: 'api', pattern: /(^|\/)(main|app|asgi|wsgi)\.py$/, evidence: 'Python web/app entry' },
  { kind: 'api', pattern: /(^|\/)manage\.py$/, evidence: 'Django management entry' },
  { kind: 'cli', pattern: /(^|\/)(cli|bin)\.(ts|js)$/, evidence: 'CLI entry' },
  { kind: 'build', pattern: /(^|\/)Dockerfile$/, evidence: 'Container build' },
];

/**
 * Detect notable entry files by convention. At most one entrypoint per kind is
 * returned (the first/shallowest match), keeping the brief focused.
 */
export function detectEntrypoints(snapshot: RepoSnapshot): Entrypoint[] {
  const paths = snapshot.files
    .map((f) => f.path)
    .sort((a, b) => a.split('/').length - b.split('/').length);

  const byKind = new Map<EntrypointKind, Entrypoint>();
  for (const rule of ENTRY_RULES) {
    if (byKind.has(rule.kind)) continue;
    const match = paths.find((p) => rule.pattern.test(p));
    if (match) {
      byKind.set(rule.kind, { kind: rule.kind, path: match, evidence: rule.evidence });
    }
  }
  return [...byKind.values()];
}
