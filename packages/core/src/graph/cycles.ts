import type { ImportEdge } from '../types.js';

/**
 * Find circular import groups via Tarjan's strongly-connected-components
 * algorithm. Each returned group is a set of files that (transitively) import
 * each other — a real circular dependency. Singletons are not cycles unless a
 * file imports itself, which the graph builder already drops, so only SCCs of
 * size >= 2 are returned. Groups are sorted largest-first.
 */
export function findCycles(edges: ImportEdge[]): string[][] {
  // Build adjacency from the directed edges.
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge.to);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
  }

  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  // Iterative Tarjan to avoid stack overflow on large graphs.
  for (const start of adj.keys()) {
    if (indices.has(start)) continue;
    const work: { node: string; i: number }[] = [{ node: start, i: 0 }];

    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const { node } = frame;

      if (frame.i === 0) {
        indices.set(node, index);
        lowlink.set(node, index);
        index++;
        stack.push(node);
        onStack.add(node);
      }

      const neighbors = adj.get(node)!;
      if (frame.i < neighbors.length) {
        const next = neighbors[frame.i]!;
        frame.i++;
        if (!indices.has(next)) {
          work.push({ node: next, i: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(node, Math.min(lowlink.get(node)!, indices.get(next)!));
        }
      } else {
        // Done with this node; if it's a root, pop its SCC.
        if (lowlink.get(node) === indices.get(node)) {
          const group: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            group.push(w);
          } while (w !== node);
          if (group.length >= 2) sccs.push(group.sort());
        }
        work.pop();
        // Propagate lowlink to the parent frame.
        if (work.length > 0) {
          const parent = work[work.length - 1]!.node;
          lowlink.set(parent, Math.min(lowlink.get(parent)!, lowlink.get(node)!));
        }
      }
    }
  }

  return sccs.sort((a, b) => b.length - a.length);
}
