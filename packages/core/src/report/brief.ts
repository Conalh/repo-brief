import type { BriefReport, FileKind, RepoSnapshot } from '../types.js';

const ALL_KINDS: FileKind[] = [
  'source',
  'test',
  'docs',
  'config',
  'workflow',
  'asset',
  'generated',
  'unknown',
];

/**
 * Assemble the Milestone-1 brief from a snapshot: a one-line identity plus a
 * file-kind breakdown. Later milestones layer subsystems, hotspots, entrypoints,
 * and the reading path on top of this same shape.
 */
export function assembleBrief(snapshot: RepoSnapshot): BriefReport {
  const kindBreakdown = Object.fromEntries(
    ALL_KINDS.map((kind) => [kind, 0]),
  ) as Record<FileKind, number>;

  for (const file of snapshot.files) {
    kindBreakdown[file.kind] += 1;
  }

  const name =
    snapshot.input.sourceType === 'github_url' && snapshot.input.owner
      ? `${snapshot.input.owner}/${snapshot.input.repo}`
      : snapshot.input.repo;

  const identity = `${name}: ${snapshot.files.length} files, ${kindBreakdown.source} source / ${kindBreakdown.test} test / ${kindBreakdown.docs} docs.`;

  return {
    identity,
    fileCount: snapshot.files.length,
    kindBreakdown,
    partial: snapshot.truncated,
    generatedAt: new Date().toISOString(),
  };
}

/** Render a brief as plain Markdown for CLI output and export. */
export function renderBriefMarkdown(brief: BriefReport): string {
  const lines: string[] = [];
  lines.push(`# RepoBrief`);
  lines.push('');
  lines.push(brief.identity);
  if (brief.partial) {
    lines.push('');
    lines.push('> ⚠️ This brief is **partial** — the source tree was truncated.');
  }
  lines.push('');
  lines.push('## File breakdown');
  lines.push('');
  lines.push('| Kind | Count |');
  lines.push('| --- | ---: |');
  for (const [kind, count] of Object.entries(brief.kindBreakdown)) {
    if (count > 0) lines.push(`| ${kind} | ${count} |`);
  }
  lines.push('');
  lines.push(`_Generated ${brief.generatedAt}._`);
  return lines.join('\n');
}
