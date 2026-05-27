import type { Subsystem } from '../types.js';

/** Escape a label for safe use inside a Mermaid node `["..."]`. */
function escapeLabel(label: string): string {
  return label.replace(/"/g, "'");
}

/**
 * Render a subsystem dependency graph as Mermaid `graph LR` source. Nodes are
 * subsystems (labelled with name + file count); edges are `dependsOn` relations.
 * Returns an empty string when there are no subsystems.
 */
export function renderSubsystemMermaid(subsystems: Subsystem[]): string {
  if (subsystems.length === 0) return '';

  const id = new Map<string, string>();
  subsystems.forEach((s, i) => id.set(s.name, `n${i}`));

  const lines: string[] = ['graph LR'];
  for (const s of subsystems) {
    lines.push(`  ${id.get(s.name)}["${escapeLabel(s.name)} (${s.fileCount})"]`);
  }
  for (const s of subsystems) {
    for (const dep of s.dependsOn) {
      const to = id.get(dep);
      if (to) lines.push(`  ${id.get(s.name)} --> ${to}`);
    }
  }
  return lines.join('\n');
}
