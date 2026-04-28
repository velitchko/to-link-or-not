import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TraditionalRenderer } from '../renderers/TraditionalRenderer';
import { NoLinkRenderer } from '../renderers/NoLinkRenderer';
import { OnDemandRenderer } from '../renderers/OnDemandRenderer';
import { StubsRenderer } from '../renderers/StubsRenderer';
import { PositionedNode, GraphEdge } from '../types';

const nodes: PositionedNode[] = [
  {
    id: 'a',
    label: 'A',
    x: 100,
    y: 100,
  },
  {
    id: 'b',
    label: 'B',
    x: 200,
    y: 200,
  },
  {
    id: 'c',
    label: 'C',
    x: 300,
    y: 100,
  },
];
const edges: GraphEdge[] = [
  {
    source: 'a',
    target: 'b',
  },
  {
    source: 'b',
    target: 'c',
  },
];
const baseProps = {
  nodes,
  edges,
  hoveredNode: null,
  onHover: () => {},
};

describe('TraditionalRenderer', () => {
  it('renders a line for each edge', () => {
    const { container } = render(
      <svg>
        <TraditionalRenderer {...baseProps} />
      </svg>,
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(2);
  });

  it('uses source and target coordinates', () => {
    const { container } = render(
      <svg>
        <TraditionalRenderer {...baseProps} />
      </svg>,
    );
    const firstLine = container.querySelector('line')!;
    expect(firstLine.getAttribute('x1')).toBe('100');
    expect(firstLine.getAttribute('y1')).toBe('100');
    expect(firstLine.getAttribute('x2')).toBe('200');
    expect(firstLine.getAttribute('y2')).toBe('200');
  });

  it('renders nothing for edges with unknown node ids', () => {
    const badEdges: GraphEdge[] = [
      {
        source: 'z',
        target: 'a',
      },
    ];
    const { container } = render(
      <svg>
        <TraditionalRenderer {...baseProps} edges={badEdges} />
      </svg>,
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(0);
  });
});

describe('NoLinkRenderer', () => {
  it('renders nothing', () => {
    const { container } = render(
      <svg><NoLinkRenderer {...baseProps} /></svg>,
    );
    expect(container.querySelector('line')).toBeNull();
    expect(container.querySelector('path')).toBeNull();
  });
});

describe('OnDemandRenderer', () => {
  it('renders no edges when no node is hovered', () => {
    const { container } = render(
      <svg><OnDemandRenderer {...baseProps} hoveredNode={null} /></svg>,
    );
    expect(container.querySelectorAll('line')).toHaveLength(0);
  });

  it('renders only edges incident to the hovered node', () => {
    // Node 'b' is connected to both 'a' and 'c'
    const { container } = render(
      <svg><OnDemandRenderer {...baseProps} hoveredNode="b" /></svg>,
    );
    expect(container.querySelectorAll('line')).toHaveLength(2);
  });

  it('renders one edge when a leaf node is hovered', () => {
    // Node 'a' is connected only to 'b'
    const { container } = render(
      <svg><OnDemandRenderer {...baseProps} hoveredNode="a" /></svg>,
    );
    expect(container.querySelectorAll('line')).toHaveLength(1);
  });

  it('renders no edges when hoveredNode matches no graph node', () => {
    const { container } = render(
      <svg><OnDemandRenderer {...baseProps} hoveredNode="z" /></svg>,
    );
    expect(container.querySelectorAll('line')).toHaveLength(0);
  });
});

describe('StubsRenderer', () => {
  it('renders two stub lines per edge (one from each endpoint)', () => {
    const { container } = render(
      <svg><StubsRenderer {...baseProps} stubLengthFraction={0.25} /></svg>,
    );
    // 2 edges × 2 stubs = 4 lines
    expect(container.querySelectorAll('line')).toHaveLength(4);
  });

  it('stub from source points toward target at the given fraction', () => {
    const singleEdge: GraphEdge[] = [{ source: 'a', target: 'b' }];
    // a=(100,100), b=(200,200), fraction=0.25
    // stub from a: x2 = 100 + (200-100)*0.25 = 125, y2 = 125
    const { container } = render(
      <svg>
        <StubsRenderer
          nodes={nodes}
          edges={singleEdge}
          hoveredNode={null}
          onHover={() => {}}
          stubLengthFraction={0.25}
        />
      </svg>,
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(2);
    const sourceStub = lines[0];
    expect(sourceStub.getAttribute('x1')).toBe('100');
    expect(sourceStub.getAttribute('y1')).toBe('100');
    expect(sourceStub.getAttribute('x2')).toBe('125');
    expect(sourceStub.getAttribute('y2')).toBe('125');
  });

  it('stub from target points toward source at the given fraction', () => {
    const singleEdge: GraphEdge[] = [{ source: 'a', target: 'b' }];
    // a=(100,100), b=(200,200), fraction=0.25
    // stub from b: x2 = 200 - (200-100)*0.25 = 175, y2 = 175
    const { container } = render(
      <svg>
        <StubsRenderer
          nodes={nodes}
          edges={singleEdge}
          hoveredNode={null}
          onHover={() => {}}
          stubLengthFraction={0.25}
        />
      </svg>,
    );
    const lines = container.querySelectorAll('line');
    const targetStub = lines[1];
    expect(targetStub.getAttribute('x1')).toBe('200');
    expect(targetStub.getAttribute('y1')).toBe('200');
    expect(targetStub.getAttribute('x2')).toBe('175');
    expect(targetStub.getAttribute('y2')).toBe('175');
  });

  it('uses 0.25 as default stub fraction', () => {
    const { container } = render(
      <svg><StubsRenderer {...baseProps} /></svg>,
    );
    expect(container.querySelectorAll('line')).toHaveLength(4);
  });
});
