import { detectTechStack } from '../classify/framework.js';
import { buildImportGraph, type ImportGraphOptions } from '../graph/index.js';
import { assembleBrief } from '../report/brief.js';
import { renderSubsystemMermaid } from '../report/mermaid.js';
import type { BriefReport, RepoSnapshot } from '../types.js';
import { detectCommands, detectEntrypoints } from './entrypoints.js';
import { collectManifests } from './manifests/index.js';
import { buildSubsystems } from './subsystems.js';

export interface AnalyzeOptions {
  /** Skip the import graph (faster; no subsystem edges). */
  skipGraph?: boolean;
  graph?: ImportGraphOptions;
}

/**
 * Run the full analysis over a snapshot and assemble a brief. This is the single
 * entry point both surfaces (CLI, web) call. Later milestones extend it with
 * hotspots and the reading path.
 */
export async function analyzeSnapshot(
  snapshot: RepoSnapshot,
  options: AnalyzeOptions = {},
): Promise<BriefReport> {
  const manifests = await collectManifests(snapshot);
  const techStack = detectTechStack(snapshot, manifests);
  const commands = detectCommands(manifests);
  const entrypoints = detectEntrypoints(snapshot);

  const edges = options.skipGraph
    ? []
    : await buildImportGraph(snapshot, options.graph);
  const subsystems = buildSubsystems(snapshot.files, edges);
  const architectureMermaid = renderSubsystemMermaid(subsystems);

  return assembleBrief(snapshot, {
    manifests,
    techStack,
    commands,
    entrypoints,
    subsystems,
    architectureMermaid,
  });
}
