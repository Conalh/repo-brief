import { describe, expect, it } from 'vitest';
import { renderSubsystemMermaid } from './mermaid.js';
import type { Subsystem } from '../types.js';

describe('renderSubsystemMermaid', () => {
  it('returns an empty string when there are no subsystems', () => {
    expect(renderSubsystemMermaid([])).toBe('');
  });

  it('renders nodes labelled by name and edges from dependsOn', () => {
    const subs: Subsystem[] = [
      { name: 'app', pathPrefix: 'app', fileCount: 2, dependsOn: ['src'], confidence: 'medium' },
      { name: 'src', pathPrefix: 'src', fileCount: 5, dependsOn: [], confidence: 'medium' },
    ];
    const out = renderSubsystemMermaid(subs);
    expect(out).toContain('graph LR');
    expect(out).toContain('n0["app (2)"]');
    expect(out).toContain('n1["src (5)"]');
    expect(out).toContain('n0 --> n1');
  });

  it('does not collapse subsystems that share a display name', () => {
    // apps/api and packages/api both render with the label "api". Keying by
    // pathPrefix must keep them as two distinct nodes with a real edge between.
    const subs: Subsystem[] = [
      {
        name: 'api',
        pathPrefix: 'apps/api',
        fileCount: 3,
        dependsOn: ['packages/api'],
        confidence: 'medium',
      },
      {
        name: 'api',
        pathPrefix: 'packages/api',
        fileCount: 4,
        dependsOn: [],
        confidence: 'medium',
      },
    ];
    const out = renderSubsystemMermaid(subs);
    const nodeLines = out.split('\n').filter((l) => /^\s*n\d+\["api /.test(l));
    expect(nodeLines).toHaveLength(2);
    // Edge connects the two distinct nodes — not a collapsed self-loop.
    expect(out).toContain('n0 --> n1');
    expect(out).not.toContain('n0 --> n0');
  });
});
