import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useForceLayout } from '../hooks/useForceLayout';
import { GraphNode, GraphEdge } from '../types';

const nodes: GraphNode[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
];
const edges: GraphEdge[] = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
];

describe('useForceLayout', () => {
  it('returns positioned nodes with numeric x and y', async () => {
    const { result } = renderHook(() => useForceLayout(nodes, edges, 800, 600));

    await waitFor(() => result.current.length > 0, { timeout: 3000 });

    expect(result.current).toHaveLength(3);
    result.current.forEach((n) => {
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    });
  });

  it('preserves node ids', async () => {
    const { result } = renderHook(() => useForceLayout(nodes, edges, 800, 600));

    await waitFor(() => result.current.length > 0, { timeout: 3000 });

    const ids = result.current.map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty input', () => {
    const { result } = renderHook(() => useForceLayout([], [], 800, 600));
    expect(result.current).toEqual([]);
  });
});
