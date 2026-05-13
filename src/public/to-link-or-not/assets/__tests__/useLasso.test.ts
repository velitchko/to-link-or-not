import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { getNodesInPolygon } from '../hooks/useLasso';
import { PositionedNode } from '../types';

const nodes: PositionedNode[] = [
  { id: 'n1', x: 50, y: 150 }, // inside a box from (0,100) to (200,200)
  { id: 'n2', x: 150, y: 150 }, // inside
  { id: 'n3', x: 250, y: 150 }, // outside
];

// Rectangle polygon (counterclockwise winding)
const rectPolygon: [number, number][] = [
  [0, 100], [200, 100], [200, 200], [0, 200],
];

describe('getNodesInPolygon', () => {
  it('returns ids of nodes inside the polygon', () => {
    const result = getNodesInPolygon(rectPolygon, nodes, d3.zoomIdentity);
    expect(result).toContain('n1');
    expect(result).toContain('n2');
    expect(result).not.toContain('n3');
  });

  it('returns empty array when polygon has fewer than 3 points', () => {
    const tiny: [number, number][] = [[0, 0], [100, 0]];
    expect(getNodesInPolygon(tiny, nodes, d3.zoomIdentity)).toEqual([]);
  });

  it('returns empty array when no nodes fall inside the polygon', () => {
    const farPolygon: [number, number][] = [
      [600, 400], [700, 400], [700, 500], [600, 500],
    ];
    expect(getNodesInPolygon(farPolygon, nodes, d3.zoomIdentity)).toEqual([]);
  });

  it('accounts for zoom transform when hit-testing', () => {
    // Translate by (100, 0): node n1 visually at (150,150), n2 visually at (250,150), n3 visually at (350,150)
    const translateTransform = d3.zoomIdentity.translate(100, 0);
    // Polygon around x=100..300, y=100..200 captures visual positions 150 and 250
    const polygon: [number, number][] = [
      [100, 100], [300, 100], [300, 200], [100, 200],
    ];
    const result = getNodesInPolygon(polygon, nodes, translateTransform);
    expect(result).toContain('n1'); // visual x = 50+100=150, inside
    expect(result).toContain('n2'); // visual x = 150+100=250, inside
    expect(result).not.toContain('n3'); // visual x = 250+100=350, outside
  });
});
