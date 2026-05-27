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
  manifests: [{ path: 'package.json', manager: 'npm', scripts: {}, dependencies: [] }],
  techStack: {
    primaryLanguage: 'TypeScript',
    languages: ['TypeScript'],
    frameworks: [{ name: 'Next.js', confidence: 'high', evidence: ['dependency "next"'] }],
    packageManagers: ['npm'],
  },
  commands: { dev: 'npm run dev', build: 'npm run build', test: 'npm test' },
  entrypoints: [{ kind: 'app', path: 'app/page.tsx', evidence: 'Next.js app router page' }],
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
    expect(md).toContain('| source | 1 |');
  });
});
