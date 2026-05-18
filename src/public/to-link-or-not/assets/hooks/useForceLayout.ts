import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge, PositionedNode } from '../types';

export function useForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): PositionedNode[] {
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);

  useEffect(() => {
    if (!nodes.length) {
      setPositioned([]);
      return () => {};
    }

    const hasPrecomputedLayout = nodes.every((n) => (
      typeof n.x === 'number'
      && typeof n.y === 'number'
      && Number.isFinite(n.x)
      && Number.isFinite(n.y)
    ));

    if (hasPrecomputedLayout) {
      setPositioned(nodes.map((n) => ({
        id: n.id, label: n.label, x: n.x as number, y: n.y as number,
      })));
      return () => {};
    }

    type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };
    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
    }));

    // Copy edges — d3.forceLink mutates source/target from string ids to object refs
    const simEdges = edges.map((e) => ({ ...e }));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3.forceLink<SimNode, typeof simEdges[number]>(simEdges)
          .id((d) => d.id)
          .distance(80),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>(20))
      .stop(); // stop the async timer; we tick synchronously below

    // Run to completion synchronously (works in jsdom where rAF is unavailable)
    const numTicks = Math.ceil(
      Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
    );
    for (let i = 0; i < numTicks; i += 1) {
      simulation.tick();
    }

    setPositioned(
      simNodes.map((n) => ({
        id: n.id, label: n.label, x: n.x, y: n.y,
      })),
    );

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height]);

  return positioned;
}
