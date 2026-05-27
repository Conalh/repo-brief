import { parse as parseYaml } from 'yaml';
import type { Manifest } from '../../types.js';

interface WorkflowDoc {
  name?: string;
  jobs?: Record<string, { 'runs-on'?: string }>;
}

/**
 * Parse a GitHub Actions workflow YAML into a Manifest where `scripts` maps each
 * job id to its runner. Returns null on invalid YAML or a non-workflow document.
 */
export function parseGithubWorkflow(path: string, content: string): Manifest | null {
  let doc: WorkflowDoc;
  try {
    doc = parseYaml(content) as WorkflowDoc;
  } catch {
    return null;
  }
  if (doc === null || typeof doc !== 'object' || !doc.jobs) return null;

  const scripts: Record<string, string> = {};
  for (const [jobId, job] of Object.entries(doc.jobs)) {
    scripts[jobId] = job?.['runs-on'] ?? 'unknown-runner';
  }

  return { path, manager: 'github_actions', scripts, dependencies: [] };
}
