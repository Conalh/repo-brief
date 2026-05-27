import { describe, expect, it } from 'vitest';
import { findCycles } from './cycles.js';
import type { ImportEdge } from '../types.js';

function edge(from: string, to: string): ImportEdge {
  return { from, to, kind: 'static', confidence: 'high' };
}

describe('findCycles', () => {
  it('finds no cycles in a DAG', () => {
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('a', 'c')];
    expect(findCycles(edges)).toEqual([]);
  });

  it('detects a simple two-node cycle', () => {
    const cycles = findCycles([edge('a', 'b'), edge('b', 'a')]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(['a', 'b']);
  });

  it('detects a longer cycle and ignores acyclic tails', () => {
    const edges = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'), // a->b->c->a cycle
      edge('c', 'd'), // d is a non-cyclic tail
    ];
    const cycles = findCycles(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(['a', 'b', 'c']);
  });

  it('returns multiple independent cycles largest-first', () => {
    const edges = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'), // size-3 cycle
      edge('x', 'y'),
      edge('y', 'x'), // size-2 cycle
    ];
    const cycles = findCycles(edges);
    expect(cycles.map((c) => c.length)).toEqual([3, 2]);
  });
});
