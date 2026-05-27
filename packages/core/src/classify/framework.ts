import type {
  Framework,
  Manifest,
  PackageManager,
  RepoSnapshot,
  TechStack,
} from '../types.js';
import { isExamplePath } from './file-kind.js';
import { detectLanguages } from './language.js';

/** A framework rule: a dependency to look for plus optional file evidence. */
interface FrameworkRule {
  name: string;
  /** Dependency name (lowercased) that signals this framework. */
  dependency?: string;
  /** Regex over a repo-relative path that signals this framework. */
  filePattern?: RegExp;
}

const RULES: FrameworkRule[] = [
  // JS/TS meta-frameworks first (more specific than the UI libs they build on).
  { name: 'Next.js', dependency: 'next', filePattern: /(^|\/)next\.config\.[a-z]+$/ },
  { name: 'Nuxt', dependency: 'nuxt', filePattern: /(^|\/)nuxt\.config\.[a-z]+$/ },
  { name: 'SvelteKit', dependency: '@sveltejs/kit', filePattern: /(^|\/)svelte\.config\.[a-z]+$/ },
  { name: 'Remix', dependency: '@remix-run/react' },
  { name: 'Astro', dependency: 'astro', filePattern: /(^|\/)astro\.config\.[a-z]+$/ },
  // UI libraries.
  { name: 'React', dependency: 'react' },
  { name: 'Vue', dependency: 'vue' },
  { name: 'Svelte', dependency: 'svelte' },
  { name: 'SolidJS', dependency: 'solid-js' },
  { name: 'Angular', dependency: '@angular/core' },
  // Node servers.
  { name: 'Express', dependency: 'express' },
  { name: 'Fastify', dependency: 'fastify' },
  { name: 'Koa', dependency: 'koa' },
  { name: 'NestJS', dependency: '@nestjs/core' },
  // Python.
  { name: 'FastAPI', dependency: 'fastapi' },
  { name: 'Flask', dependency: 'flask' },
  { name: 'Django', dependency: 'django' },
  // Rust.
  { name: 'Axum', dependency: 'axum' },
  { name: 'Actix', dependency: 'actix-web' },
  { name: 'Rocket', dependency: 'rocket' },
  // Other.
  { name: '.NET', filePattern: /\.(csproj|sln)$/ },
];

/**
 * Detect frameworks from parsed manifests and the file tree. Confidence is
 * `high` when both a dependency and a conventional file confirm it, otherwise
 * `medium` for a single strong signal.
 */
export function detectFrameworks(
  files: { path: string }[],
  manifests: Manifest[],
): Framework[] {
  const deps = new Set<string>();
  for (const manifest of manifests) {
    for (const dep of manifest.dependencies) deps.add(dep.toLowerCase());
  }
  const paths = files.map((f) => f.path);

  const frameworks: Framework[] = [];
  for (const rule of RULES) {
    const evidence: string[] = [];

    if (rule.dependency && deps.has(rule.dependency)) {
      evidence.push(`dependency "${rule.dependency}"`);
    }
    if (rule.filePattern) {
      const match = paths.find((p) => rule.filePattern!.test(p));
      if (match) evidence.push(`file ${match}`);
    }

    if (evidence.length === 0) continue;
    // Two corroborating signals -> high; a single signal -> medium.
    const corroborated = rule.dependency !== undefined && rule.filePattern !== undefined;
    const confidence = corroborated && evidence.length === 2 ? 'high' : 'medium';
    frameworks.push({ name: rule.name, confidence, evidence });
  }
  return frameworks;
}

/** Build the full tech-stack summary from a snapshot and its manifests. */
export function detectTechStack(
  snapshot: RepoSnapshot,
  manifests: Manifest[],
): TechStack {
  const { primaryLanguage, languages } = detectLanguages(snapshot.files);
  // Exclude fixture/test-data, vendored files, and example/sample/template
  // projects so a sample's config (e.g. a fixture's next.config.js) doesn't get
  // reported as the repo's own stack.
  const ownFiles = snapshot.files.filter(
    (f) => f.kind !== 'test' && f.kind !== 'generated' && !isExamplePath(f.path),
  );
  const frameworks = detectFrameworks(ownFiles, manifests);

  const packageManagers = [
    ...new Set(manifests.map((m) => m.manager)),
  ] as PackageManager[];

  return { primaryLanguage, languages, frameworks, packageManagers };
}
