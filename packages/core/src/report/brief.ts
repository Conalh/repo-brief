import type {
  BriefReport,
  Commands,
  Entrypoint,
  FileKind,
  Manifest,
  RepoSnapshot,
  TechStack,
} from '../types.js';

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

/** The analysis inputs layered onto the base snapshot summary. */
export interface BriefAnalysis {
  manifests: Manifest[];
  techStack: TechStack;
  commands: Commands;
  entrypoints: Entrypoint[];
}

const EMPTY_ANALYSIS: BriefAnalysis = {
  manifests: [],
  techStack: { languages: [], frameworks: [], packageManagers: [] },
  commands: {},
  entrypoints: [],
};

/**
 * Assemble the brief from a snapshot plus optional analysis. With no analysis
 * this yields the Milestone-1 shallow brief; with analysis it includes the
 * tech stack, commands, and entrypoints (Milestone 2).
 */
export function assembleBrief(
  snapshot: RepoSnapshot,
  analysis: BriefAnalysis = EMPTY_ANALYSIS,
): BriefReport {
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

  const { techStack } = analysis;
  const stackBits = [
    techStack.primaryLanguage,
    ...techStack.frameworks.map((f) => f.name),
  ].filter(Boolean);
  const stackPhrase = stackBits.length > 0 ? ` ${stackBits.join(' + ')}.` : '';

  const identity = `${name}:${stackPhrase} ${snapshot.files.length} files, ${kindBreakdown.source} source / ${kindBreakdown.test} test / ${kindBreakdown.docs} docs.`;

  return {
    identity,
    fileCount: snapshot.files.length,
    kindBreakdown,
    techStack,
    commands: analysis.commands,
    entrypoints: analysis.entrypoints,
    manifests: analysis.manifests,
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

  const { techStack, commands, entrypoints } = brief;

  if (techStack.languages.length > 0 || techStack.frameworks.length > 0) {
    lines.push('');
    lines.push('## Tech stack');
    lines.push('');
    if (techStack.languages.length > 0) {
      lines.push(`- **Languages:** ${techStack.languages.join(', ')}`);
    }
    for (const fw of techStack.frameworks) {
      lines.push(`- **${fw.name}** _(${fw.confidence})_ — ${fw.evidence.join('; ')}`);
    }
  }

  if (commands.dev || commands.build || commands.test) {
    lines.push('');
    lines.push('## How to run');
    lines.push('');
    if (commands.dev) lines.push(`- **Dev:** \`${commands.dev}\``);
    if (commands.build) lines.push(`- **Build:** \`${commands.build}\``);
    if (commands.test) lines.push(`- **Test:** \`${commands.test}\``);
  }

  if (entrypoints.length > 0) {
    lines.push('');
    lines.push('## Entrypoints');
    lines.push('');
    for (const ep of entrypoints) {
      lines.push(`- **${ep.kind}:** \`${ep.path}\` — ${ep.evidence}`);
    }
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
