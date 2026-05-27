import type {
  BriefMode,
  BriefReport,
  Commands,
  Entrypoint,
  FileKind,
  Hotspot,
  Manifest,
  ReadingPath,
  RepoSnapshot,
  Route,
  Subsystem,
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
  mode: BriefMode;
  manifests: Manifest[];
  techStack: TechStack;
  commands: Commands;
  entrypoints: Entrypoint[];
  subsystems: Subsystem[];
  architectureMermaid: string;
  cycles: string[][];
  routes: Route[];
  hotspots: Hotspot[];
  readingPath: ReadingPath;
}

const EMPTY_ANALYSIS: BriefAnalysis = {
  mode: 'balanced',
  manifests: [],
  techStack: { languages: [], frameworks: [], packageManagers: [] },
  commands: {},
  entrypoints: [],
  subsystems: [],
  architectureMermaid: '',
  cycles: [],
  routes: [],
  hotspots: [],
  readingPath: { steps: [], skip: [] },
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
    mode: analysis.mode,
    fileCount: snapshot.files.length,
    kindBreakdown,
    techStack,
    commands: analysis.commands,
    entrypoints: analysis.entrypoints,
    manifests: analysis.manifests,
    subsystems: analysis.subsystems,
    architectureMermaid: analysis.architectureMermaid,
    cycles: analysis.cycles,
    routes: analysis.routes,
    hotspots: analysis.hotspots,
    readingPath: analysis.readingPath,
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

  if (brief.subsystems.length > 0) {
    lines.push('');
    lines.push('## Architecture');
    lines.push('');
    for (const s of brief.subsystems) {
      const deps =
        s.dependsOn.length > 0 ? ` → ${s.dependsOn.join(', ')}` : '';
      lines.push(`- **${s.name}** (${s.fileCount} files)${deps}`);
    }
    if (brief.architectureMermaid) {
      lines.push('');
      lines.push('```mermaid');
      lines.push(brief.architectureMermaid);
      lines.push('```');
    }
  }

  if (brief.routes.length > 0) {
    lines.push('');
    lines.push('## Routes');
    lines.push('');
    for (const r of brief.routes.slice(0, 40)) {
      const method = r.method ? `\`${r.method}\` ` : '';
      lines.push(`- ${method}\`${r.path}\` — ${r.handlerPath}`);
    }
    if (brief.routes.length > 40) {
      lines.push(`- _…and ${brief.routes.length - 40} more._`);
    }
  }

  if (brief.cycles.length > 0) {
    lines.push('');
    lines.push('## Circular dependencies');
    lines.push('');
    lines.push(
      `${brief.cycles.length} import cycle${brief.cycles.length > 1 ? 's' : ''} detected:`,
    );
    for (const cycle of brief.cycles.slice(0, 10)) {
      lines.push(`- ${cycle.join(' → ')} → …`);
    }
  }

  if (brief.readingPath.steps.length > 0) {
    lines.push('');
    lines.push('## Where to start');
    lines.push('');
    brief.readingPath.steps.forEach((step, i) => {
      lines.push(`${i + 1}. \`${step.path}\` — ${step.reason}`);
    });
    if (brief.readingPath.skip.length > 0) {
      lines.push('');
      lines.push(`_Safe to skip: ${brief.readingPath.skip.length} generated/asset files._`);
    }
  }

  if (brief.hotspots.length > 0) {
    lines.push('');
    lines.push('## Hotspots');
    lines.push('');
    for (const h of brief.hotspots) {
      lines.push(`- \`${h.path}\` _(score ${h.score})_ — ${h.reasons.join(', ')}. ${h.recommendation}`);
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
  lines.push(`_Generated ${brief.generatedAt} · ${brief.mode} mode._`);
  return lines.join('\n');
}
