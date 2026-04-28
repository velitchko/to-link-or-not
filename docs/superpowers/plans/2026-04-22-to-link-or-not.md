# To Link or Not — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a revisit.dev study that presents four link-rendering conditions (Traditional, No-Link, On-Demand, Stubs) of node-link diagrams and collects qualitative + quantitative data from expert participants across 36 trials.

**Architecture:** A single React stimulus component (`NodeLinkDiagram.tsx`) receives condition and graph data as revisit parameters, computes D3 force layout once via `useForceLayout`, then delegates edge rendering to one of four swappable `EdgeRenderer` sub-components. A pair of scripts generates 60+ synthetic graph JSON files and assembles `config.json` programmatically to avoid hand-authoring 180 trial definitions.

**Tech Stack:** revisit.dev study template (Vite + React + TypeScript), D3 v7 (force layout + SVG), Vitest + @testing-library/react (tests), Node.js scripts (graph + config generation), Supabase (via revisit built-in integration).

---

## File Map

| File | Responsibility |
|---|---|
| `src/public/to-link-or-not/assets/types.ts` | All shared types: GraphData, PositionedNode, Condition, EdgeRendererProps, StudyParameters |
| `src/public/to-link-or-not/assets/hooks/useForceLayout.ts` | D3 force simulation → positioned nodes |
| `src/public/to-link-or-not/assets/renderers/TraditionalRenderer.tsx` | All edges as `<line>` elements |
| `src/public/to-link-or-not/assets/renderers/NoLinkRenderer.tsx` | Returns null |
| `src/public/to-link-or-not/assets/renderers/OnDemandRenderer.tsx` | Hover-revealed neighbor edges |
| `src/public/to-link-or-not/assets/renderers/StubsRenderer.tsx` | Short stubs from each endpoint |
| `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx` | revisit entry point — layout + node SVG + EdgeRenderer dispatch + setAnswer |
| `src/public/to-link-or-not/assets/__tests__/useForceLayout.test.ts` | Hook unit tests |
| `src/public/to-link-or-not/assets/__tests__/renderers.test.tsx` | Renderer unit tests |
| `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx` | Component integration tests |
| `scripts/generate-graphs.ts` | Generates 60 synthetic graph JSON files into `public/to-link-or-not/graphs/pool-{a,b,c,d}/` |
| `scripts/generate-config.ts` | Reads graph pool, writes `public/to-link-or-not/config.json` |
| `public/to-link-or-not/config.json` | revisit study config (generated — do not edit by hand) |

---

## Task 1: Bootstrap revisit template

**Files:**
- Create: entire project root (from revisit template)
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Pull the revisit study template into the existing repo**

```bash
cd /home/velitchko/Projects/to-link-or-not
npx degit revisit-studies/study#main .
npm install
```

If degit fails because the directory is non-empty (git already init'd), copy manually:
```bash
git clone --depth 1 https://github.com/revisit-studies/study /tmp/revisit-template
cp -r /tmp/revisit-template/. /home/velitchko/Projects/to-link-or-not/
rm -rf /tmp/revisit-template
npm install
```

- [ ] **Step 2: Verify the dev server starts**

```bash
npm run dev
```

Expected: Vite dev server on `http://localhost:5173` with the revisit demo study visible.

- [ ] **Step 3: Install D3 and testing dependencies**

```bash
npm install d3
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Create `vitest.config.ts` in project root**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

- [ ] **Step 5: Create `src/setupTests.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Create study directory structure**

```bash
mkdir -p src/public/to-link-or-not/assets/__tests__
mkdir -p src/public/to-link-or-not/assets/hooks
mkdir -p src/public/to-link-or-not/assets/renderers
mkdir -p public/to-link-or-not/graphs/pool-a
mkdir -p public/to-link-or-not/graphs/pool-b
mkdir -p public/to-link-or-not/graphs/pool-c
mkdir -p public/to-link-or-not/graphs/pool-d
mkdir -p public/to-link-or-not/graphs/training
mkdir -p scripts
```

- [ ] **Step 8: Add `.superpowers/` to `.gitignore`**

Open `.gitignore` and add:
```
.superpowers/
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: bootstrap revisit template with Vitest and study directory structure"
```

---

## Task 2: Type definitions

**Files:**
- Create: `src/public/to-link-or-not/assets/types.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
export type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
export type TaskType = 'T1' | 'T2' | 'T3';

export interface GraphNode {
  id: string;
  label?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

export interface GroundTruthT1 {
  answer: string;       // id of the highest-degree node
  rationale: string;
}

export interface GroundTruthT2 {
  nodeA: string;        // id of first highlighted node
  nodeB: string;        // id of second highlighted node
  commonNeighbors: string[];
}

export interface GroundTruthT3 {
  communities: string[][];  // each inner array is a community
}

export interface GraphData {
  id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  groundTruth: {
    T1: GroundTruthT1;
    T2: GroundTruthT2;
    T3: GroundTruthT3;
  };
  stubLengthFraction?: number;  // default 0.25, tuned per pilot
}

export interface StudyParameters {
  condition: Condition;
  graph: GraphData;
  task: TaskType;
  taskPrompt: string;
}

export interface EdgeRendererProps {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  hoveredNode: string | null;
  onHover: (id: string | null) => void;
  stubLengthFraction?: number;  // only used by StubsRenderer
}
```

- [ ] **Step 2: Commit**

```bash
git add src/public/to-link-or-not/assets/types.ts
git commit -m "feat: add shared type definitions"
```

---

## Task 3: `useForceLayout` hook (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/hooks/useForceLayout.ts`
- Create: `src/public/to-link-or-not/assets/__tests__/useForceLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/public/to-link-or-not/assets/__tests__/useForceLayout.test.ts
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
    const { result } = renderHook(() =>
      useForceLayout(nodes, edges, 800, 600)
    );

    await waitFor(() => result.current.length > 0, { timeout: 3000 });

    expect(result.current).toHaveLength(3);
    result.current.forEach(n => {
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    });
  });

  it('preserves node ids', async () => {
    const { result } = renderHook(() =>
      useForceLayout(nodes, edges, 800, 600)
    );

    await waitFor(() => result.current.length > 0, { timeout: 3000 });

    const ids = result.current.map(n => n.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty input', () => {
    const { result } = renderHook(() =>
      useForceLayout([], [], 800, 600)
    );
    expect(result.current).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- useForceLayout
```

Expected: FAIL — `Cannot find module '../hooks/useForceLayout'`

- [ ] **Step 3: Implement `useForceLayout.ts`**

```typescript
// src/public/to-link-or-not/assets/hooks/useForceLayout.ts
import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge, PositionedNode } from '../types';

export function useForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): PositionedNode[] {
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);

  useEffect(() => {
    if (!nodes.length) return;

    type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };
    const simNodes: SimNode[] = nodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
    }));

    const simEdges = edges.map(e => ({ ...e }));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3.forceLink<SimNode, typeof simEdges[number]>(simEdges)
          .id(d => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>(20));

    simulation.on('end', () => {
      setPositioned(
        simNodes.map(n => ({ id: n.id, label: n.label, x: n.x, y: n.y }))
      );
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height]);

  return positioned;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- useForceLayout
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/public/to-link-or-not/assets/hooks/useForceLayout.ts \
        src/public/to-link-or-not/assets/__tests__/useForceLayout.test.ts
git commit -m "feat: add useForceLayout hook with D3 force simulation"
```

---

## Task 4: `TraditionalRenderer` (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/renderers/TraditionalRenderer.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/renderers.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/public/to-link-or-not/assets/__tests__/renderers.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TraditionalRenderer } from '../renderers/TraditionalRenderer';
import { PositionedNode, GraphEdge } from '../types';

const nodes: PositionedNode[] = [
  { id: 'a', label: 'A', x: 100, y: 100 },
  { id: 'b', label: 'B', x: 200, y: 200 },
  { id: 'c', label: 'C', x: 300, y: 100 },
];
const edges: GraphEdge[] = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
];
const baseProps = { nodes, edges, hoveredNode: null, onHover: () => {} };

describe('TraditionalRenderer', () => {
  it('renders a line for each edge', () => {
    const { container } = render(
      <svg><TraditionalRenderer {...baseProps} /></svg>
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(2);
  });

  it('uses source and target coordinates', () => {
    const { container } = render(
      <svg><TraditionalRenderer {...baseProps} /></svg>
    );
    const firstLine = container.querySelector('line')!;
    expect(firstLine.getAttribute('x1')).toBe('100');
    expect(firstLine.getAttribute('y1')).toBe('100');
    expect(firstLine.getAttribute('x2')).toBe('200');
    expect(firstLine.getAttribute('y2')).toBe('200');
  });

  it('renders nothing for edges with unknown node ids', () => {
    const badEdges: GraphEdge[] = [{ source: 'z', target: 'a' }];
    const { container } = render(
      <svg><TraditionalRenderer {...baseProps} edges={badEdges} /></svg>
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- renderers
```

Expected: FAIL — `Cannot find module '../renderers/TraditionalRenderer'`

- [ ] **Step 3: Implement `TraditionalRenderer.tsx`**

```tsx
// src/public/to-link-or-not/assets/renderers/TraditionalRenderer.tsx
import React from 'react';
import { EdgeRendererProps } from '../types';

export function TraditionalRenderer({ nodes, edges }: EdgeRendererProps) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <g className="edges-traditional">
      {edges.map((edge, i) => {
        const source = nodeMap[edge.source];
        const target = nodeMap[edge.target];
        if (!source || !target) return null;
        return (
          <line
            key={i}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
        );
      })}
    </g>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- renderers
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/public/to-link-or-not/assets/renderers/TraditionalRenderer.tsx \
        src/public/to-link-or-not/assets/__tests__/renderers.test.tsx
git commit -m "feat: add TraditionalRenderer with full edge rendering"
```

---

## Task 5: `NoLinkRenderer` (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/renderers/NoLinkRenderer.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/renderers.test.tsx`

- [ ] **Step 1: Add test to `renderers.test.tsx`**

Append inside the file, after the TraditionalRenderer describe block:

```tsx
import { NoLinkRenderer } from '../renderers/NoLinkRenderer';

describe('NoLinkRenderer', () => {
  it('renders nothing', () => {
    const { container } = render(
      <svg><NoLinkRenderer {...baseProps} /></svg>
    );
    expect(container.querySelector('line')).toBeNull();
    expect(container.querySelector('path')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- renderers
```

Expected: FAIL — `Cannot find module '../renderers/NoLinkRenderer'`

- [ ] **Step 3: Implement `NoLinkRenderer.tsx`**

```tsx
// src/public/to-link-or-not/assets/renderers/NoLinkRenderer.tsx
import { EdgeRendererProps } from '../types';

export function NoLinkRenderer(_props: EdgeRendererProps) {
  return null;
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm test -- renderers
```

Expected: PASS — all renderer tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/public/to-link-or-not/assets/renderers/NoLinkRenderer.tsx \
        src/public/to-link-or-not/assets/__tests__/renderers.test.tsx
git commit -m "feat: add NoLinkRenderer"
```

---

## Task 6: `OnDemandRenderer` (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/renderers/OnDemandRenderer.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/renderers.test.tsx`

- [ ] **Step 1: Add tests to `renderers.test.tsx`**

Append after the NoLinkRenderer describe block:

```tsx
import { OnDemandRenderer } from '../renderers/OnDemandRenderer';

describe('OnDemandRenderer', () => {
  it('renders no edges when no node is hovered', () => {
    const { container } = render(
      <svg><OnDemandRenderer {...baseProps} hoveredNode={null} /></svg>
    );
    expect(container.querySelectorAll('line')).toHaveLength(0);
  });

  it('renders only edges incident to the hovered node', () => {
    // Node 'b' is connected to both 'a' and 'c'
    const { container } = render(
      <svg><OnDemandRenderer {...baseProps} hoveredNode="b" /></svg>
    );
    expect(container.querySelectorAll('line')).toHaveLength(2);
  });

  it('renders one edge when a leaf node is hovered', () => {
    // Node 'a' is connected only to 'b'
    const { container } = render(
      <svg><OnDemandRenderer {...baseProps} hoveredNode="a" /></svg>
    );
    expect(container.querySelectorAll('line')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- renderers
```

Expected: FAIL — `Cannot find module '../renderers/OnDemandRenderer'`

- [ ] **Step 3: Implement `OnDemandRenderer.tsx`**

```tsx
// src/public/to-link-or-not/assets/renderers/OnDemandRenderer.tsx
import React from 'react';
import { EdgeRendererProps } from '../types';

export function OnDemandRenderer({ nodes, edges, hoveredNode }: EdgeRendererProps) {
  if (!hoveredNode) return null;

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const visibleEdges = edges.filter(
    e => e.source === hoveredNode || e.target === hoveredNode
  );

  return (
    <g className="edges-on-demand">
      {visibleEdges.map((edge, i) => {
        const source = nodeMap[edge.source];
        const target = nodeMap[edge.target];
        if (!source || !target) return null;
        return (
          <line
            key={i}
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
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm test -- renderers
```

Expected: PASS — all renderer tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/public/to-link-or-not/assets/renderers/OnDemandRenderer.tsx \
        src/public/to-link-or-not/assets/__tests__/renderers.test.tsx
git commit -m "feat: add OnDemandRenderer with hover-revealed neighbor edges"
```

---

## Task 7: `StubsRenderer` (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/renderers/StubsRenderer.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/renderers.test.tsx`

- [ ] **Step 1: Add tests to `renderers.test.tsx`**

Append after the OnDemandRenderer describe block:

```tsx
import { StubsRenderer } from '../renderers/StubsRenderer';

describe('StubsRenderer', () => {
  it('renders two stub lines per edge (one from each endpoint)', () => {
    const { container } = render(
      <svg><StubsRenderer {...baseProps} stubLengthFraction={0.25} /></svg>
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
      </svg>
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(2);
    const sourceStub = lines[0];
    expect(sourceStub.getAttribute('x1')).toBe('100');
    expect(sourceStub.getAttribute('y1')).toBe('100');
    expect(sourceStub.getAttribute('x2')).toBe('125');
    expect(sourceStub.getAttribute('y2')).toBe('125');
  });

  it('uses 0.25 as default stub fraction', () => {
    const { container } = render(
      <svg><StubsRenderer {...baseProps} /></svg>
    );
    expect(container.querySelectorAll('line')).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- renderers
```

Expected: FAIL — `Cannot find module '../renderers/StubsRenderer'`

- [ ] **Step 3: Implement `StubsRenderer.tsx`**

```tsx
// src/public/to-link-or-not/assets/renderers/StubsRenderer.tsx
import React from 'react';
import { EdgeRendererProps } from '../types';

export function StubsRenderer({ nodes, edges, stubLengthFraction = 0.25 }: EdgeRendererProps) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

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
            key={`${i}-s`}
            x1={source.x}
            y1={source.y}
            x2={source.x + dx * stubLengthFraction}
            y2={source.y + dy * stubLengthFraction}
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeLinecap="round"
          />,
          <line
            key={`${i}-t`}
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
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm test -- renderers
```

Expected: PASS — all renderer tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/public/to-link-or-not/assets/renderers/StubsRenderer.tsx \
        src/public/to-link-or-not/assets/__tests__/renderers.test.tsx
git commit -m "feat: add StubsRenderer with configurable stub length fraction"
```

---

## Task 8: `NodeLinkDiagram` main component (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx`
- Create: `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NodeLinkDiagram from '../NodeLinkDiagram';
import { StudyParameters } from '../types';

// Mock useForceLayout to return immediately with preset positions
vi.mock('../hooks/useForceLayout', () => ({
  useForceLayout: (nodes: any[]) =>
    nodes.map((n, i) => ({ ...n, x: i * 100 + 50, y: 150 })),
}));

const graph: StudyParameters['graph'] = {
  id: 'test-g01',
  nodes: [
    { id: 'n1', label: 'A' },
    { id: 'n2', label: 'B' },
    { id: 'n3', label: 'C' },
  ],
  edges: [
    { source: 'n1', target: 'n2' },
    { source: 'n2', target: 'n3' },
  ],
  groundTruth: {
    T1: { answer: 'n2', rationale: 'highest degree' },
    T2: { nodeA: 'n1', nodeB: 'n3', commonNeighbors: ['n2'] },
    T3: { communities: [['n1', 'n2'], ['n3']] },
  },
};

const makeParams = (task: StudyParameters['task'], condition: StudyParameters['condition']): StudyParameters => ({
  condition,
  graph,
  task,
  taskPrompt: 'Test prompt',
});

describe('NodeLinkDiagram', () => {
  it('renders a circle for each node', () => {
    const setAnswer = vi.fn();
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={setAnswer} />
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(3);
  });

  it('shows the task prompt', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} />
    );
    expect(screen.getByText('Test prompt')).toBeInTheDocument();
  });

  it('calls setAnswer with correct T1 answer on submit', () => {
    const setAnswer = vi.fn();
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={setAnswer} />
    );
    // Click node n2 (correct T1 answer)
    const circles = container.querySelectorAll('circle.node-circle');
    const n2Circle = Array.from(circles).find(c => c.getAttribute('data-node-id') === 'n2');
    expect(n2Circle).toBeTruthy();
    fireEvent.click(n2Circle!);

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    expect(setAnswer).toHaveBeenCalledOnce();
    const call = setAnswer.mock.calls[0][0];
    expect(call.answers.answer).toBe('n2');
    expect(call.answers.isCorrect).toBe(true);
    expect(typeof call.answers.responseTimeMs).toBe('number');
  });

  it('uses NoLinkRenderer when condition is no-link (no lines in SVG)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'no-link')} setAnswer={vi.fn()} />
    );
    expect(container.querySelectorAll('line')).toHaveLength(0);
  });

  it('uses TraditionalRenderer when condition is traditional (lines present)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} />
    );
    expect(container.querySelectorAll('line').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- NodeLinkDiagram
```

Expected: FAIL — `Cannot find module '../NodeLinkDiagram'`

- [ ] **Step 3: Implement `NodeLinkDiagram.tsx`**

```tsx
// src/public/to-link-or-not/assets/NodeLinkDiagram.tsx
import React, { useRef, useState } from 'react';
import { StimulusParams } from '../../../store/types';
import { StudyParameters, Condition } from './types';
import { useForceLayout } from './hooks/useForceLayout';
import { TraditionalRenderer } from './renderers/TraditionalRenderer';
import { NoLinkRenderer } from './renderers/NoLinkRenderer';
import { OnDemandRenderer } from './renderers/OnDemandRenderer';
import { StubsRenderer } from './renderers/StubsRenderer';

const WIDTH = 800;
const HEIGHT = 560;
const NODE_RADIUS = 12;

const EDGE_RENDERERS: Record<Condition, React.FC<any>> = {
  traditional: TraditionalRenderer,
  'no-link': NoLinkRenderer,
  'on-demand': OnDemandRenderer,
  stubs: StubsRenderer,
};

const TASK_INSTRUCTIONS: Record<StudyParameters['task'], string> = {
  T1: 'Click the node you think is most important (most connected) in this network.',
  T2: 'Click all nodes that are common neighbors of the two highlighted nodes (shown in orange).',
  T3: 'Click all nodes that form a distinct group or cluster. Submit when done.',
};

export default function NodeLinkDiagram({
  parameters,
  setAnswer,
}: StimulusParams<StudyParameters>) {
  const { condition, graph, task, taskPrompt } = parameters;
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const startTimeRef = useRef(Date.now());

  const positionedNodes = useForceLayout(graph.nodes, graph.edges, WIDTH, HEIGHT);
  const EdgeRenderer = EDGE_RENDERERS[condition];

  // Nodes highlighted as anchors for T2
  const anchorNodes =
    task === 'T2' ? [graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB] : [];

  function handleNodeClick(nodeId: string) {
    if (anchorNodes.includes(nodeId)) return; // anchors are not selectable
    setSelectedNodes(prev =>
      task === 'T1'
        ? [nodeId]
        : prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  }

  function handleSubmit() {
    const responseTimeMs = Date.now() - startTimeRef.current;

    let answer: string | string[] = task === 'T1' ? selectedNodes[0] : selectedNodes;
    let isCorrect = false;

    if (task === 'T1') {
      isCorrect = selectedNodes[0] === graph.groundTruth.T1.answer;
    } else if (task === 'T2') {
      const expected = [...graph.groundTruth.T2.commonNeighbors].sort();
      const actual = [...selectedNodes].sort();
      isCorrect = JSON.stringify(actual) === JSON.stringify(expected);
    } else {
      // T3: qualitative — always record as attempted, coded offline
      isCorrect = true;
    }

    setAnswer({
      answers: {
        answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
        isCorrect,
        responseTimeMs,
        condition,
        task,
        graphId: graph.id,
      },
    });
  }

  function getNodeFill(nodeId: string): string {
    if (anchorNodes.includes(nodeId)) return '#f59e0b'; // T2 anchors: amber
    if (selectedNodes.includes(nodeId)) return '#10b981';  // selected: green
    return '#4f46e5'; // default: indigo
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: `${WIDTH}px`, margin: '0 auto' }}>
      <div
        style={{
          padding: '0.75rem 1rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '0.5rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>{taskPrompt}</p>
      </div>

      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ display: 'block', background: 'white', border: '1px solid #e2e8f0' }}
      >
        {positionedNodes.length > 0 && (
          <>
            <EdgeRenderer
              nodes={positionedNodes}
              edges={graph.edges}
              hoveredNode={hoveredNode}
              onHover={setHoveredNode}
              stubLengthFraction={graph.stubLengthFraction ?? 0.25}
            />
            <g className="nodes">
              {positionedNodes.map(node => (
                <g key={node.id}>
                  <circle
                    className="node-circle"
                    data-node-id={node.id}
                    cx={node.x}
                    cy={node.y}
                    r={NODE_RADIUS}
                    fill={getNodeFill(node.id)}
                    stroke={hoveredNode === node.id ? '#fbbf24' : 'white'}
                    strokeWidth={hoveredNode === node.id ? 3 : 2}
                    style={{
                      cursor: anchorNodes.includes(node.id) ? 'default' : 'pointer',
                      transition: 'fill 0.1s',
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => handleNodeClick(node.id)}
                  />
                  {node.label && (
                    <text
                      x={node.x}
                      y={node.y + NODE_RADIUS + 14}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#374151"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.label}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </>
        )}
      </svg>

      <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          {TASK_INSTRUCTIONS[task]}
        </p>
        <button
          onClick={handleSubmit}
          disabled={selectedNodes.length === 0}
          style={{
            padding: '0.5rem 1.25rem',
            background: selectedNodes.length > 0 ? '#4f46e5' : '#e2e8f0',
            color: selectedNodes.length > 0 ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: '6px',
            cursor: selectedNodes.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '0.95rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Submit Answer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- NodeLinkDiagram
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Verify the component renders in the dev server**

```bash
npm run dev
```

Navigate to the revisit demo, then manually add a route or temporary page to see `NodeLinkDiagram` render with a hardcoded graph prop. Verify all 4 conditions switch correctly by temporarily changing `condition` in the source.

- [ ] **Step 6: Commit**

```bash
git add src/public/to-link-or-not/assets/NodeLinkDiagram.tsx \
        src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
git commit -m "feat: add NodeLinkDiagram main stimulus component with condition dispatch"
```

---

## Task 9: Synthetic graph generation script

**Files:**
- Create: `scripts/generate-graphs.ts`

The script generates 15 synthetic graphs per pool (60 total). Each graph has planted community structure (needed for T3), a clear high-degree hub (T1), and a known common-neighbor pair (T2).

- [ ] **Step 1: Write `scripts/generate-graphs.ts`**

```typescript
// scripts/generate-graphs.ts
// Run with: npx tsx scripts/generate-graphs.ts
import fs from 'fs';
import path from 'path';

interface Node { id: string; label: string; }
interface Edge { source: string; target: string; }
interface GraphData {
  id: string;
  nodes: Node[];
  edges: Edge[];
  groundTruth: {
    T1: { answer: string; rationale: string };
    T2: { nodeA: string; nodeB: string; commonNeighbors: string[] };
    T3: { communities: string[][] };
  };
  stubLengthFraction: number;
}

function generateGraph(id: string, seed: number): GraphData {
  // Deterministic pseudo-random from seed
  let s = seed;
  function rand(): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  }

  // Two communities of 5-7 nodes each, plus a hub
  const comm1Size = 4 + Math.floor(rand() * 3); // 4-6
  const comm2Size = 4 + Math.floor(rand() * 3);

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const comm1: string[] = [];
  const comm2: string[] = [];

  // Hub node (highest degree — connected to many in both communities)
  const hubId = 'hub';
  nodes.push({ id: hubId, label: 'H' });

  for (let i = 0; i < comm1Size; i++) {
    const nid = `a${i}`;
    nodes.push({ id: nid, label: `A${i}` });
    comm1.push(nid);
  }
  for (let i = 0; i < comm2Size; i++) {
    const nid = `b${i}`;
    nodes.push({ id: nid, label: `B${i}` });
    comm2.push(nid);
  }

  // Intra-community edges (dense)
  for (let i = 0; i < comm1.length; i++) {
    for (let j = i + 1; j < comm1.length; j++) {
      if (rand() > 0.3) edges.push({ source: comm1[i], target: comm1[j] });
    }
  }
  for (let i = 0; i < comm2.length; i++) {
    for (let j = i + 1; j < comm2.length; j++) {
      if (rand() > 0.3) edges.push({ source: comm2[i], target: comm2[j] });
    }
  }

  // Hub connects to all nodes in both communities (highest degree)
  [...comm1, ...comm2].forEach(nid => {
    edges.push({ source: hubId, target: nid });
  });

  // Sparse inter-community edges (1-2 bridge edges)
  const bridgeA = comm1[Math.floor(rand() * comm1.length)];
  const bridgeB = comm2[Math.floor(rand() * comm2.length)];
  edges.push({ source: bridgeA, target: bridgeB });

  // T2: pick two nodes in different communities that share hub as common neighbor
  const nodeA = comm1[0];
  const nodeB = comm2[0];
  // Both are connected to hub, so hub is always a common neighbor
  const commonNeighbors = [hubId];
  // If bridgeA is nodeA, bridgeB is also a neighbor of nodeA via bridge
  // Keep it simple: just hub as guaranteed common neighbor

  // T3: communities are comm1 and comm2 (hub excluded — it's the bridge)
  return {
    id,
    nodes,
    edges,
    groundTruth: {
      T1: {
        answer: hubId,
        rationale: `Hub node connected to all ${comm1Size + comm2Size} other nodes`,
      },
      T2: { nodeA, nodeB, commonNeighbors },
      T3: { communities: [comm1, comm2] },
    },
    stubLengthFraction: 0.25,
  };
}

const POOLS = ['pool-a', 'pool-b', 'pool-c', 'pool-d'] as const;
const GRAPHS_PER_POOL = 15;
const BASE_DIR = path.join(process.cwd(), 'public', 'to-link-or-not', 'graphs');

// Also generate one training graph
const trainingGraph = generateGraph('training-g01', 999);
const trainingDir = path.join(BASE_DIR, 'training');
fs.mkdirSync(trainingDir, { recursive: true });
fs.writeFileSync(
  path.join(trainingDir, 'training-g01.json'),
  JSON.stringify(trainingGraph, null, 2)
);
console.log('Written: training/training-g01.json');

POOLS.forEach((pool, poolIdx) => {
  const poolDir = path.join(BASE_DIR, pool);
  fs.mkdirSync(poolDir, { recursive: true });

  for (let i = 0; i < GRAPHS_PER_POOL; i++) {
    const graphId = `${pool}-g${String(i + 1).padStart(2, '0')}`;
    const seed = poolIdx * 1000 + i * 37 + 1;
    const graph = generateGraph(graphId, seed);
    const filePath = path.join(poolDir, `${graphId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
    console.log(`Written: ${pool}/${graphId}.json`);
  }
});

console.log('\nDone. 60 graphs generated across 4 pools.');
```

- [ ] **Step 2: Install tsx for running TypeScript scripts**

```bash
npm install --save-dev tsx
```

- [ ] **Step 3: Run the script**

```bash
npx tsx scripts/generate-graphs.ts
```

Expected output:
```
Written: training/training-g01.json
Written: pool-a/pool-a-g01.json
...
Done. 60 graphs generated across 4 pools.
```

Verify files exist:
```bash
ls public/to-link-or-not/graphs/pool-a/ | wc -l
```
Expected: `15`

- [ ] **Step 4: Spot-check a generated graph**

```bash
cat public/to-link-or-not/graphs/pool-a/pool-a-g01.json | python3 -m json.tool | head -40
```

Verify: `nodes`, `edges`, `groundTruth.T1.answer` = `"hub"`, `groundTruth.T2.commonNeighbors` = `["hub"]`, two communities in `groundTruth.T3.communities`.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-graphs.ts public/to-link-or-not/graphs/
git commit -m "feat: add synthetic graph generation script and 60 generated graphs"
```

---

## Task 10: Config generation script

**Files:**
- Create: `scripts/generate-config.ts`
- Create: `public/to-link-or-not/config.json` (generated)

- [ ] **Step 1: Write `scripts/generate-config.ts`**

```typescript
// scripts/generate-config.ts
// Run with: npx tsx scripts/generate-config.ts
import fs from 'fs';
import path from 'path';

const STUDY_NAME = 'to-link-or-not';
const GRAPHS_DIR = path.join(process.cwd(), 'public', STUDY_NAME, 'graphs');
const CONFIG_OUT = path.join(process.cwd(), 'public', STUDY_NAME, 'config.json');

type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
type TaskType = 'T1' | 'T2' | 'T3';

const POOL_TO_CONDITION: Record<string, Condition> = {
  'pool-a': 'traditional',
  'pool-b': 'no-link',
  'pool-c': 'on-demand',
  'pool-d': 'stubs',
};

const TASK_PROMPTS: Record<TaskType, string> = {
  T1: 'Which node do you think is the most important (well-connected) in this network?',
  T2: 'Select all nodes that are common neighbors of the two highlighted (orange) nodes.',
  T3: 'Click all nodes that you perceive as belonging to the same group or cluster.',
};

const TASKS: TaskType[] = ['T1', 'T2', 'T3'];
const POOLS = ['pool-a', 'pool-b', 'pool-c', 'pool-d'] as const;

// Collect all graph files per pool
function getGraphFiles(pool: string): string[] {
  const dir = path.join(GRAPHS_DIR, pool);
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => `${STUDY_NAME}/graphs/${pool}/${f}`);
}

// Read and embed graph data from disk (so the config is self-contained)
function loadGraph(graphRelPath: string): object {
  const absPath = path.join(process.cwd(), 'public', graphRelPath);
  return JSON.parse(fs.readFileSync(absPath, 'utf-8'));
}

// Build a component definition for one (graph, task, condition) triple
// Graph data is embedded directly so the component receives a GraphData object,
// not a path — avoids async fetching inside the stimulus component.
function trialComponent(graphRelPath: string, task: TaskType, condition: Condition) {
  const graphId = path.basename(graphRelPath, '.json');
  const key = `${condition}-${task}-${graphId}`;
  return {
    key,
    def: {
      baseComponent: 'node-link-trial',
      parameters: {
        condition,
        graph: loadGraph(graphRelPath),  // embed graph data inline
        task,
        taskPrompt: TASK_PROMPTS[task],
      },
    },
  };
}

// Build condition block: returns inline sequence object + component defs for trials
function conditionBlock(pool: string): { componentDefs: Record<string, object>; inlineBlock: object } {
  const condition = POOL_TO_CONDITION[pool];
  const graphFiles = getGraphFiles(pool);
  const componentDefs: Record<string, object> = {};
  const graphGroups: object[] = [];

  for (const graphRelPath of graphFiles) {
    const taskComponentKeys: string[] = [];

    for (const task of TASKS) {
      const { key, def } = trialComponent(graphRelPath, task, condition);
      componentDefs[key] = def;
      taskComponentKeys.push(key);
    }

    // Each graph's 3 tasks are grouped in a random-order sub-sequence
    graphGroups.push({ order: 'random', components: taskComponentKeys });
  }

  // Inline block: randomly sample 3 graph groups from this pool's 15
  const inlineBlock = {
    order: 'fixed',
    components: [
      `intro-${condition}`,
      { order: 'random', numSamples: 3, components: graphGroups },
      `nasa-tlx-${condition}`,
    ],
  };

  return { componentDefs, inlineBlock };
}

// Assemble the full config
const allComponentDefs: Record<string, object> = {};
const conditionInlineBlocks: object[] = [];

for (const pool of POOLS) {
  const { componentDefs, inlineBlock } = conditionBlock(pool);
  Object.assign(allComponentDefs, componentDefs);
  conditionInlineBlocks.push(inlineBlock);
}

const config = {
  $schema: 'https://raw.githubusercontent.com/revisit-studies/study/main/src/parser/StudyConfigSchema.json',
  studyMetadata: {
    title: 'To Link or Not',
    version: '1.0.0',
    authors: ['Author Name'],
    date: '2026-04-22',
    description: 'How does link visibility affect cognitive maps of node-link diagrams?',
    organizations: ['TU Wien'],
  },
  uiConfig: {
    contactEmail: 'velitchkofilipov@gmail.com',
    helpTextPath: `${STUDY_NAME}/help.md`,
    logoPath: `${STUDY_NAME}/logo.png`,
    withProgressBar: true,
    autoDownloadStudy: false,
    sidebar: false,
  },
  baseComponents: {
    'node-link-trial': {
      type: 'react-component',
      path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
      recordAudio: true,
      recordScreen: true, // verify flag name against revisit v2.x typedoc
      nextButtonLocation: 'sidebar',
      instructionLocation: 'sidebar',
      parameters: {
        condition: 'traditional',
        graphPath: '',
        task: 'T1',
        taskPrompt: '',
      },
      response: [
        { id: 'task-answer', type: 'iframe' },
        {
          id: 'comment',
          prompt: 'Describe your reasoning or mental image of the network.',
          type: 'longText',
          placeholder: 'Type your thoughts here...',
          required: false,
        },
      ],
    },
  },
  components: {
    consent: {
      type: 'markdown',
      path: `${STUDY_NAME}/consent.md`,
      nextButtonText: 'I Agree',
      response: [],
    },
    demographics: {
      type: 'questionnaire',
      response: [
        {
          id: 'age',
          prompt: 'What is your age?',
          type: 'numerical',
          min: 18,
          max: 99,
          required: true,
        },
        {
          id: 'gender',
          prompt: 'What is your gender?',
          type: 'dropdown',
          options: ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'],
          required: true,
        },
        {
          id: 'education',
          prompt: 'What is your highest level of education?',
          type: 'dropdown',
          options: ['High school', 'Bachelor\'s degree', 'Master\'s degree', 'PhD or higher', 'Other'],
          required: true,
        },
        {
          id: 'vis-experience',
          prompt: 'How experienced are you with reading network/graph visualizations?',
          type: 'likert',
          numItems: 5,
          leftLabel: 'No experience',
          rightLabel: 'Expert',
          required: true,
        },
      ],
    },
    'study-overview': {
      type: 'markdown',
      path: `${STUDY_NAME}/overview.md`,
      response: [],
    },
    // Training screens — one per condition (fixed order: traditional first)
    'training-traditional': {
      type: 'react-component',
      path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
      recordAudio: false,
      parameters: {
        condition: 'traditional',
        graph: loadGraph(`${STUDY_NAME}/graphs/training/training-g01.json`),
        task: 'T1',
        taskPrompt: '[TRAINING] Traditional view: all connections are shown as lines. Which node looks most connected?',
        isTraining: true,
      },
      response: [{ id: 'task-answer', type: 'iframe' }],
      nextButtonText: 'See correct answer',
    },
    'training-no-link': {
      type: 'react-component',
      path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
      recordAudio: false,
      parameters: {
        condition: 'no-link',
        graph: loadGraph(`${STUDY_NAME}/graphs/training/training-g01.json`),
        task: 'T1',
        taskPrompt: '[TRAINING] No-link view: only nodes are shown, no connections. Which node looks most important?',
        isTraining: true,
      },
      response: [{ id: 'task-answer', type: 'iframe' }],
    },
    'training-on-demand': {
      type: 'react-component',
      path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
      recordAudio: false,
      parameters: {
        condition: 'on-demand',
        graph: loadGraph(`${STUDY_NAME}/graphs/training/training-g01.json`),
        task: 'T1',
        taskPrompt: '[TRAINING] On-demand view: hover over a node to see its connections. Which node looks most connected?',
        isTraining: true,
      },
      response: [{ id: 'task-answer', type: 'iframe' }],
    },
    'training-stubs': {
      type: 'react-component',
      path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
      recordAudio: false,
      parameters: {
        condition: 'stubs',
        graph: loadGraph(`${STUDY_NAME}/graphs/training/training-g01.json`),
        task: 'T1',
        taskPrompt: '[TRAINING] Stub view: short lines indicate connections but do not show where they lead. Which node has most stubs?',
        isTraining: true,
      },
      response: [{ id: 'task-answer', type: 'iframe' }],
    },
    // Condition intro and NASA-TLX screens
    'intro-traditional': {
      type: 'markdown',
      path: `${STUDY_NAME}/intro-traditional.md`,
      response: [],
    },
    'intro-no-link': {
      type: 'markdown',
      path: `${STUDY_NAME}/intro-no-link.md`,
      response: [],
    },
    'intro-on-demand': {
      type: 'markdown',
      path: `${STUDY_NAME}/intro-on-demand.md`,
      response: [],
    },
    'intro-stubs': {
      type: 'markdown',
      path: `${STUDY_NAME}/intro-stubs.md`,
      response: [],
    },
    'nasa-tlx-traditional': {
      type: 'questionnaire',
      response: nasaTlxItems('traditional'),
    },
    'nasa-tlx-no-link': {
      type: 'questionnaire',
      response: nasaTlxItems('no-link'),
    },
    'nasa-tlx-on-demand': {
      type: 'questionnaire',
      response: nasaTlxItems('on-demand'),
    },
    'nasa-tlx-stubs': {
      type: 'questionnaire',
      response: nasaTlxItems('stubs'),
    },
    debrief: {
      type: 'questionnaire',
      response: [
        {
          id: 'preference-1st',
          prompt: 'Which representation did you find most useful overall?',
          type: 'dropdown',
          options: ['Traditional (all links)', 'No-link (nodes only)', 'On-demand (hover)', 'Stubs'],
          required: true,
        },
        {
          id: 'preference-least',
          prompt: 'Which representation did you find least useful overall?',
          type: 'dropdown',
          options: ['Traditional (all links)', 'No-link (nodes only)', 'On-demand (hover)', 'Stubs'],
          required: true,
        },
        {
          id: 'reflection',
          prompt: 'Any final thoughts, observations, or comments about the representations?',
          type: 'longText',
          required: false,
        },
      ],
    },
    ...allComponentDefs,
  },
  sequence: {
    order: 'fixed',
    components: [
      'consent',
      'demographics',
      'study-overview',
      {
        order: 'fixed',
        components: [
          'training-traditional',
          'training-no-link',
          'training-on-demand',
          'training-stubs',
        ],
      },
      {
        order: 'latinSquare',
        components: conditionInlineBlocks,  // inline objects, not string keys
      },
      'debrief',
    ],
  },
};

function nasaTlxItems(condition: string) {
  const dimensions = [
    { id: 'mental-demand', label: 'Mental Demand' },
    { id: 'temporal-demand', label: 'Temporal Demand' },
    { id: 'performance', label: 'Performance' },
    { id: 'effort', label: 'Effort' },
    { id: 'frustration', label: 'Frustration' },
  ];
  return [
    ...dimensions.map(d => ({
      id: `${condition}-${d.id}`,
      prompt: `${d.label}: How much ${d.id.replace('-', ' ')} was required?`,
      type: 'likert',
      numItems: 7,
      leftLabel: 'Very Low',
      rightLabel: 'Very High',
      required: true,
    })),
    {
      id: `${condition}-open-comment`,
      prompt: 'Any thoughts about this representation condition?',
      type: 'longText',
      required: false,
    },
  ];
}

fs.writeFileSync(CONFIG_OUT, JSON.stringify(config, null, 2));
console.log(`Config written to ${CONFIG_OUT}`);
console.log(`Total component definitions: ${Object.keys(config.components).length}`);
```

- [ ] **Step 2: Run the config generator**

```bash
npx tsx scripts/generate-config.ts
```

Expected:
```
Config written to public/to-link-or-not/config.json
Total component definitions: 185+
```

- [ ] **Step 3: Validate the config is valid JSON**

```bash
python3 -m json.tool public/to-link-or-not/config.json > /dev/null && echo "Valid JSON"
```

Expected: `Valid JSON`

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-config.ts public/to-link-or-not/config.json
git commit -m "feat: add config generation script and generated study config"
```

---

## Task 11: Markdown content files + Supabase setup

**Files:**
- Create: `public/to-link-or-not/consent.md`
- Create: `public/to-link-or-not/overview.md`
- Create: `public/to-link-or-not/intro-{traditional,no-link,on-demand,stubs}.md`
- Modify: `public/to-link-or-not/config.json` (add Supabase credentials after setup)

- [ ] **Step 1: Create `public/to-link-or-not/consent.md`**

```markdown
# Consent Form

This study investigates how different network visualizations affect your understanding of graph structure. Your participation involves viewing network diagrams and answering questions about them.

**Duration:** Approximately 60–90 minutes.

**Data collected:** Audio recordings, screen recordings, task responses, and written comments. All data is stored securely and anonymised for analysis.

**Right to withdraw:** You may stop at any time without consequence.

**Contact:** velitchkofilipov@gmail.com

By clicking "I Agree" you confirm you have read this form and consent to participate.
```

- [ ] **Step 2: Create `public/to-link-or-not/overview.md`**

```markdown
# Study Overview

In this study you will see networks (graphs) of nodes connected by links — or variations where links are hidden or partially shown.

You will complete tasks such as:
- Identifying the most important node
- Finding nodes that share common neighbors
- Identifying groups of related nodes

There are **four different representations**. You will experience each one in turn. A short training session introduces each representation before you begin.

Please **think aloud** throughout the study — say what you see, what you are looking for, and how you are reasoning.
```

- [ ] **Step 3: Create the four condition intro files**

`public/to-link-or-not/intro-traditional.md`:
```markdown
# Traditional View

In this block, **all connections between nodes are shown as lines**.

You can see the full structure of the network at once.

Please continue to think aloud as you work through the tasks.
```

`public/to-link-or-not/intro-no-link.md`:
```markdown
# No-Link View

In this block, **no connection lines are shown** — only the nodes themselves.

Use the spatial arrangement of nodes to guide your reasoning.

Please continue to think aloud as you work through the tasks.
```

`public/to-link-or-not/intro-on-demand.md`:
```markdown
# On-Demand View

In this block, connections are **hidden by default**. Hover over any node to reveal its immediate neighbors.

Explore the network by moving your mouse over nodes of interest.

Please continue to think aloud as you work through the tasks.
```

`public/to-link-or-not/intro-stubs.md`:
```markdown
# Stub View

In this block, each node shows **short stubs** indicating where connections begin, but the stubs do not reach the destination node.

The number of stubs indicates how many connections a node has.

Please continue to think aloud as you work through the tasks.
```

- [ ] **Step 4: Set up Supabase following the revisit docs**

Follow the official revisit Supabase setup guide at: https://revisit.dev/docs/data-and-deployment/firebase-setup/
(Note: revisit docs may say "Firebase" in older versions but Supabase is supported in v2+. Check the current docs for the Supabase-specific instructions.)

The steps will ask you to:
1. Create a Supabase project at supabase.com
2. Create the required tables (revisit provides a SQL schema)
3. Add Supabase credentials to your study config or environment

Once credentials are obtained, add to `config.json` (or `.env`) as directed by the revisit docs — do not commit credentials to git.

Add `.env` to `.gitignore`:
```bash
echo ".env" >> .gitignore
```

- [ ] **Step 5: Commit content files**

```bash
git add public/to-link-or-not/consent.md \
        public/to-link-or-not/overview.md \
        public/to-link-or-not/intro-traditional.md \
        public/to-link-or-not/intro-no-link.md \
        public/to-link-or-not/intro-on-demand.md \
        public/to-link-or-not/intro-stubs.md \
        .gitignore
git commit -m "feat: add consent, overview, and condition intro markdown files"
```

---

## Task 12: End-to-end smoke test

**Files:** No new files — verify everything wires up.

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: All tests pass — useForceLayout (3), renderers (9), NodeLinkDiagram (5). No failures.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:5173` with no build errors.

- [ ] **Step 3: Navigate to the study**

Open `http://localhost:5173/to-link-or-not/` in a browser. Verify:

- [ ] Consent screen appears
- [ ] Demographics form renders and accepts input
- [ ] Study overview page appears
- [ ] Training screens render a graph for all 4 conditions (traditional, no-link, on-demand, stubs)
- [ ] In the traditional training: edges are visible as lines
- [ ] In the no-link training: no edges visible, only nodes
- [ ] In the on-demand training: hover over a node reveals neighbor edges
- [ ] In the stubs training: short stubs are visible extending from each node
- [ ] A trial renders with a task prompt and Submit Answer button
- [ ] Clicking a node selects it (color changes to green)
- [ ] Clicking Submit Answer calls setAnswer and advances the trial
- [ ] The free-text comment field appears below the component
- [ ] NASA-TLX questionnaire appears after each condition block
- [ ] Debrief screen with preference ranking appears at the end

- [ ] **Step 4: Verify audio/screen recording (if Supabase is configured)**

If Supabase is set up, check the revisit dashboard to confirm recordings are being captured and trial data is being written.

If Supabase is not yet set up, verify console shows no auth errors (recording will be a no-op in dev mode).

- [ ] **Step 5: Fix any rendering issues found during smoke test, then commit**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```

- [ ] **Step 6: Final check — run full test suite**

```bash
npm test
```

Expected: All tests still pass.
