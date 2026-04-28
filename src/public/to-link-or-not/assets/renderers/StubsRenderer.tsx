import React from 'react';
import { EdgeRendererProps } from '../types';

// onHover is managed by NodeLinkDiagram (node circle events); renderer is read-only
export function StubsRenderer({ nodes, edges, stubLengthFraction = 0.25 }: EdgeRendererProps) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <g className="edges-stubs">
      {edges.flatMap((edge, i) => {
        const source = nodeMap[edge.source];
        const target = nodeMap[edge.target];
        if (!source || !target) return [];

        const dx = target.x - source.x;
        const dy = target.y - source.y;

        return [
          <line
            key={`${i}-${edge.source}-${edge.target}-s`}
            x1={source.x}
            y1={source.y}
            x2={source.x + dx * stubLengthFraction}
            y2={source.y + dy * stubLengthFraction}
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeLinecap="round"
          />,
          <line
            key={`${i}-${edge.source}-${edge.target}-t`}
            x1={target.x}
            y1={target.y}
            x2={target.x - dx * stubLengthFraction}
            y2={target.y - dy * stubLengthFraction}
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeLinecap="round"
          />,
        ];
      })}
    </g>
  );
}
