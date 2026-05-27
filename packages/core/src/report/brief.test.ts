import { describe, expect, it } from 'vitest';
import { assembleBrief, renderBriefMarkdown } from './brief.js';
import type { RepoSnapshot } from '../types.js';

const snapshot: RepoSnapshot = {
  input: { sourceType: 'github_url', owner: 'octo', repo: 'demo' },
  headSha: 'abc',
  truncated: false,
  files: [
    { path: 'README.md', extension: 'md', kind: 'docs' },
    { path: 'src/index.ts', extension: 'ts', kind: 'source' },
    { path: 'src/index.test.ts', extension: 'ts', kind: 'test' },
  ],
};

describe('assembleBrief', () => {
  it('summarizes identity and kind breakdown', () => {
    const brief = assembleBrief(snapshot);
    expect(brief.fileCount).toBe(3);
    expect(brief.identity).toContain('octo/demo');
    expect(brief.kindBreakdown.source).toBe(1);
    expect(brief.kindBreakdown.test).toBe(1);
    expect(brief.partial).toBe(false);
  });

  it('flags partial snapshots', () => {
    const brief = assembleBrief({ ...snapshot, truncated: true });
    expect(brief.partial).toBe(true);
    expect(renderBriefMarkdown(brief)).toContain('partial');
  });

  it('renders markdown with a breakdown table', () => {
    const md = renderBriefMarkdown(assembleBrief(snapshot));
    expect(md).toContain('# RepoBrief');
    expect(md).toContain('| source | 1 |');
  });
});
