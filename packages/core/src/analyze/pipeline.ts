import { detectTechStack } from '../classify/framework.js';
import { assembleBrief } from '../report/brief.js';
import type { BriefReport, RepoSnapshot } from '../types.js';
import { detectCommands, detectEntrypoints } from './entrypoints.js';
import { collectManifests } from './manifests/index.js';

/**
 * Run the full analysis over a snapshot and assemble a brief. This is the single
 * entry point both surfaces (CLI, web) call. Later milestones extend it with the
 * import graph, subsystems, hotspots, and reading path.
 */
export async function analyzeSnapshot(snapshot: RepoSnapshot): Promise<BriefReport> {
  const manifests = await collectManifests(snapshot);
  const techStack = detectTechStack(snapshot, manifests);
  const commands = detectCommands(manifests);
  const entrypoints = detectEntrypoints(snapshot);

  return assembleBrief(snapshot, { manifests, techStack, commands, entrypoints });
}
