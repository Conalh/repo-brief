#!/usr/bin/env node
import { existsSync } from 'node:fs';
import {
  analyzeSnapshot,
  ingestGitHub,
  ingestLocal,
  parseGitHubUrl,
  renderBriefMarkdown,
  type BriefReport,
  type RepoSnapshot,
} from '@repobrief/core';

/** Ingest a target (local path wins if it exists on disk, else a GitHub ref). */
async function ingest(target: string): Promise<RepoSnapshot> {
  if (target === '.' || target.startsWith('./') || existsSync(target)) {
    return ingestLocal(target);
  }
  const input = parseGitHubUrl(target);
  return ingestGitHub(input, { token: process.env.GITHUB_TOKEN });
}

async function brief(target: string): Promise<BriefReport> {
  return analyzeSnapshot(await ingest(target));
}

/** `repobrief inspect <target>` — print the full brief as Markdown. */
async function inspect(target: string): Promise<number> {
  process.stdout.write(renderBriefMarkdown(await brief(target)) + '\n');
  return 0;
}

/** `repobrief graph <target>` — print just the Mermaid architecture graph. */
async function graph(target: string): Promise<number> {
  const report = await brief(target);
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
      '  repobrief inspect <github-url | owner/repo | local-path>',
      '  repobrief graph   <target>   # Mermaid architecture graph only',
      '',
      'Examples:',
      '  repobrief inspect https://github.com/vercel/next.js',
      '  repobrief inspect .',
      '  repobrief graph .',
      '',
    ].join('\n'),
  );
}

const COMMANDS: Record<string, (target: string) => Promise<number>> = {
  inspect,
  graph,
};

async function main(): Promise<void> {
  const [command, target] = process.argv.slice(2);

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

  if (!target) {
    process.stderr.write(`${command} requires a target (URL or path).\n`);
    process.exitCode = 1;
    return;
  }

  try {
    // Set the code but let the event loop drain naturally so in-flight
    // network sockets close cleanly (avoids a libuv assertion on Windows).
    process.exitCode = await handler(target);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
