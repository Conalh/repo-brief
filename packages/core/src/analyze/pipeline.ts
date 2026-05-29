import { detectTechStack } from '../classify/framework.js';
import { buildImportGraph, type ImportGraphOptions } from '../graph/index.js';
import { findCycles } from '../graph/cycles.js';
import { assembleBrief } from '../report/brief.js';
import { renderSubsystemMermaid } from '../report/mermaid.js';
import type { BriefMode, BriefReport, ImportEdge, RepoSnapshot } from '../types.js';
import { detectCommands, detectEntrypoints } from './entrypoints.js';
import { detectHotspots } from './hotspots.js';
import { collectManifests } from './manifests/index.js';
import { buildReadingPath } from './reading-path.js';
import { RouteCollector, mergeRoutes } from './routes/index.js';
import { buildSubsystems } from './subsystems.js';

export interface AnalyzeOptions {
  /** Analysis depth. Defaults to "balanced". */
  mode?: BriefMode;
  /** Override the per-mode import-graph options. */
  graph?: ImportGraphOptions;
}

/** Per-mode import-graph defaults. fast skips the graph entirely. */
function graphOptionsForMode(mode: BriefMode): ImportGraphOptions | null {
  switch (mode) {
    case 'fast':
      return null;
    case 'balanced':
      return { maxFiles: 1500 };
    case 'deep':
      return { maxFiles: 5000 };
  }
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
  const mode = options.mode ?? 'balanced';
  const manifests = await collectManifests(snapshot);
  const techStack = detectTechStack(snapshot, manifests);
  const commands = detectCommands(manifests);
  const entrypoints = detectEntrypoints(snapshot);

  let edges: ImportEdge[] = [];
  let lineCounts = new Map<string, number>();
  // Route extraction piggybacks on the graph's single content-read pass.
  const routeCollector = new RouteCollector();
  const graphOptions = options.graph ?? graphOptionsForMode(mode);
  if (graphOptions) {
    ({ edges, lineCounts } = await buildImportGraph(snapshot, {
      ...graphOptions,
      onSource: routeCollector.visit,
    }));
  }
  const routes = mergeRoutes(snapshot.files, routeCollector.routes);

  // Deep mode adds commit-history churn to hotspot scoring when available.
  // Churn is a best-effort signal: a failing provider must degrade the report
  // to "no churn", never fail the whole analysis. (The GitHub provider already
  // guards itself; this also covers arbitrary ChurnProvider implementations.)
  let churn = new Map<string, number>();
  if (mode === 'deep' && snapshot.churn) {
    try {
      churn = await snapshot.churn.recentChanges(50);
    } catch {
      churn = new Map();
    }
  }

  const subsystems = buildSubsystems(snapshot.files, edges);
  const architectureMermaid = renderSubsystemMermaid(subsystems);
  const cycles = findCycles(edges);
  const cycleMembers = new Set(cycles.flat());
  const hotspots = detectHotspots(snapshot.files, edges, lineCounts, churn, cycleMembers);
  const readingPath = buildReadingPath({
    files: snapshot.files,
    entrypoints,
    manifests,
    edges,
  });

  return assembleBrief(snapshot, {
    mode,
    manifests,
    techStack,
    commands,
    entrypoints,
    subsystems,
    architectureMermaid,
    cycles,
    routes,
    hotspots,
    readingPath,
  });
}
