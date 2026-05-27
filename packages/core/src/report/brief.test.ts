import { describe, expect, it } from 'vitest';
import { assembleBrief, renderBriefMarkdown, type BriefAnalysis } from './brief.js';
import type { RepoSnapshot } from '../types.js';

const snapshot: RepoSnapshot = {
  input: { sourceType: 'github_url', owner: 'octo', repo: 'demo' },
  headSha: 'abc',
  truncated: false,
  reader: { read: async () => null },
  files: [
    { path: 'README.md', extension: 'md', kind: 'docs' },
    { path: 'src/index.ts', extension: 'ts', kind: 'source' },
    { path: 'src/index.test.ts', extension: 'ts', kind: 'test' },
  ],
};

const analysis: BriefAnalysis = {
  mode: 'balanced',
  manifests: [{ path: 'package.json', manager: 'npm', scripts: {}, dependencies: [] }],
  techStack: {
    primaryLanguage: 'TypeScript',
    languages: ['TypeScript'],
    frameworks: [{ name: 'Next.js', confidence: 'high', evidence: ['dependency "next"'] }],
    packageManagers: ['npm'],
  },
  commands: { dev: 'npm run dev', build: 'npm run build', test: 'npm test' },
  entrypoints: [{ kind: 'app', path: 'app/page.tsx', evidence: 'Next.js app router page' }],
  subsystems: [
    { name: 'app', pathPrefix: 'app', fileCount: 1, dependsOn: ['src'], confidence: 'medium' },
    { name: 'src', pathPrefix: 'src', fileCount: 1, dependsOn: [], confidence: 'medium' },
  ],
  architectureMermaid: 'graph LR\n  n0["app (1)"]\n  n1["src (1)"]\n  n0 --> n1',
  cycles: [],
  hotspots: [
    {
      path: 'src/index.ts',
      score: 4,
      reasons: ['high fan-in (5 importers)', 'no nearby tests'],
      recommendation: 'Core module — many files depend on it; change with care.',
    },
  ],
  readingPath: {
    steps: [
      { path: 'README.md', reason: 'Project overview.' },
      { path: 'app/page.tsx', reason: 'Entry point (app).' },
    ],
    skip: ['dist/bundle.js'],
  },
};

describe('assembleBrief', () => {
  it('summarizes identity and kind breakdown without analysis', () => {
    const brief = assembleBrief(snapshot);
    expect(brief.fileCount).toBe(3);
    expect(brief.identity).toContain('octo/demo');
    expect(brief.kindBreakdown.source).toBe(1);
    expect(brief.partial).toBe(false);
  });

  it('folds tech stack into the identity line', () => {
    const brief = assembleBrief(snapshot, analysis);
    expect(brief.identity).toContain('TypeScript + Next.js');
  });

  it('flags partial snapshots', () => {
    const brief = assembleBrief({ ...snapshot, truncated: true });
    expect(brief.partial).toBe(true);
    expect(renderBriefMarkdown(brief)).toContain('partial');
  });

  it('renders tech stack, commands and entrypoints in markdown', () => {
    const md = renderBriefMarkdown(assembleBrief(snapshot, analysis));
    expect(md).toContain('## Tech stack');
    expect(md).toContain('Next.js');
    expect(md).toContain('npm run dev');
    expect(md).toContain('app/page.tsx');
    expect(md).toContain('## Architecture');
    expect(md).toContain('```mermaid');
    expect(md).toContain('## Where to start');
    expect(md).toContain('## Hotspots');
    expect(md).toContain('| source | 1 |');
  });
});
