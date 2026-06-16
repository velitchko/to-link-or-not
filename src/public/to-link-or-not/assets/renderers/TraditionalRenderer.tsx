import React from 'react';
import { EdgeRendererProps } from '../types';

export function TraditionalRenderer({ nodes, edges }: EdgeRendererProps) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <g className="edges-traditional">
      {edges.map((edge) => {
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
            stroke="#64748b"
            strokeWidth={1.2}
            opacity={0.34}
          />
        );
      })}
    </g>
  );
}
