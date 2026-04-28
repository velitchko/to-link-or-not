import React from 'react';
import { EdgeRendererProps } from '../types';

// onHover is managed by NodeLinkDiagram (node circle events); renderer is read-only
export function OnDemandRenderer({ nodes, edges, hoveredNode }: EdgeRendererProps) {
  if (!hoveredNode) return null;

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const visibleEdges = edges.filter(
    (e) => e.source === hoveredNode || e.target === hoveredNode,
  );

  return (
    <g className="edges-on-demand">
      {visibleEdges.map((edge) => {
        const source = nodeMap[edge.source];
        const target = nodeMap[edge.target];
        if (!source || !target) return null;
        return (
          <line
            key={`${edge.source}-${edge.target}`}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke="#4f46e5"
            strokeWidth={2}
          />
        );
      })}
    </g>
  );
}
