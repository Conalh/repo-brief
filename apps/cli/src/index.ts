#!/usr/bin/env node
import { existsSync } from 'node:fs';
import {
  analyzeSnapshot,
  ingestGitHub,
  ingestLocal,
  parseGitHubUrl,
  renderBriefMarkdown,
  type BriefMode,
  type BriefReport,
  type RepoSnapshot,
} from '@repobrief/core';

const MODES: BriefMode[] = ['fast', 'balanced', 'deep'];

/** Parse `--mode <m>` from args; defaults to balanced. Returns mode + leftovers. */
function parseArgs(args: string[]): { mode: BriefMode; rest: string[] } {
  let mode: BriefMode = 'balanced';
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode') {
      const value = args[++i];
      if (!value || !MODES.includes(value as BriefMode)) {
        throw new Error(`--mode must be one of: ${MODES.join(', ')}`);
      }
      mode = value as BriefMode;
    } else {
      rest.push(args[i]!);
    }
  }
  return { mode, rest };
}

/** Ingest a target (local path wins if it exists on disk, else a GitHub ref). */
async function ingest(target: string): Promise<RepoSnapshot> {
  if (target === '.' || target.startsWith('./') || existsSync(target)) {
    return ingestLocal(target);
  }
  const input = parseGitHubUrl(target);
  return ingestGitHub(input, { token: process.env.GITHUB_TOKEN });
}

async function brief(target: string, mode: BriefMode): Promise<BriefReport> {
  return analyzeSnapshot(await ingest(target), { mode });
}

/** `repobrief inspect <target>` — print the full brief as Markdown. */
async function inspect(target: string, mode: BriefMode): Promise<number> {
  process.stdout.write(renderBriefMarkdown(await brief(target, mode)) + '\n');
  return 0;
}

/** `repobrief graph <target>` — print just the Mermaid architecture graph. */
async function graph(target: string, mode: BriefMode): Promise<number> {
  const report = await brief(target, mode);
  if (!report.architectureMermaid) {
    process.stderr.write('No subsystems detected to graph.\n');
    return 1;
  }
  process.stdout.write(report.architectureMermaid + '\n');
  return 0;
}

function usage(): void {
  process.stdout.write(
    [
      'RepoBrief — orientation for unfamiliar repositories.',
      '',
      'Usage:',
      '  repobrief inspect <github-url | owner/repo | local-path> [--mode <m>]',
      '  repobrief graph   <target> [--mode <m>]   # Mermaid graph only',
      '',
      '  --mode  fast | balanced (default) | deep',
      '',
      'Examples:',
      '  repobrief inspect https://github.com/vercel/next.js',
      '  repobrief inspect . --mode deep',
      '  repobrief graph .',
      '',
    ].join('\n'),
  );
}

const COMMANDS: Record<string, (target: string, mode: BriefMode) => Promise<number>> = {
  inspect,
  graph,
};

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exitCode = command ? 0 : 1;
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    process.stderr.write(`Unknown command: ${command}\n`);
    usage();
    process.exitCode = 1;
    return;
  }

  try {
    const { mode, rest } = parseArgs(args);
    const target = rest[0];
    if (!target) {
      process.stderr.write(`${command} requires a target (URL or path).\n`);
      process.exitCode = 1;
      return;
    }
    // Set the code but let the event loop drain naturally so in-flight
    // network sockets close cleanly (avoids a libuv assertion on Windows).
    process.exitCode = await handler(target, mode);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
