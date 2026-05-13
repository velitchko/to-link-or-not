# Network Diagram Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add zoom/pan, single-click select, multi-click select, and lasso selection to `NodeLinkDiagram`, with a control strip for mode switching.

**Architecture:** A `useZoomPan` hook attaches D3 zoom to the SVG and applies transforms to a content `<g>` imperatively; a `useLasso` hook listens to raw mouse events on the SVG and runs polygon hit-testing; an `InteractionStrip` component renders the mode toggle, reset buttons, and Ctrl hint between the task prompt and the SVG.

**Tech Stack:** React 18, D3 v7 (already installed), TypeScript, Vitest + @testing-library/react (jsdom)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/public/to-link-or-not/assets/types.ts` | Modify | Add `InteractionMode` type |
| `src/public/to-link-or-not/assets/hooks/useZoomPan.ts` | Create | D3 zoom/pan behavior, returns `contentRef`, `transformRef`, `resetZoom` |
| `src/public/to-link-or-not/assets/hooks/useLasso.ts` | Create | Mouse event lasso drawing + `getNodesInPolygon` pure function |
| `src/public/to-link-or-not/assets/InteractionStrip.tsx` | Create | Mode buttons, Reset Zoom, Reset Selection, Ctrl hint |
| `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx` | Modify | Compose hooks + strip, add mode state, lasso polygon overlay |
| `src/public/to-link-or-not/assets/__tests__/useLasso.test.ts` | Create | Unit tests for `getNodesInPolygon` + hook mode-gating |
| `src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx` | Create | Render + interaction tests for the control strip |
| `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx` | Modify | Add tests for mode switching, reset buttons, lasso selection |

---

## Task 1: Add `InteractionMode` type

**Files:**
- Modify: `src/public/to-link-or-not/assets/types.ts`

- [ ] **Step 1: Add the type**

  Open `src/public/to-link-or-not/assets/types.ts` and add this line after the `Condition` type on line 1:

  ```typescript
  export type InteractionMode = 'select' | 'lasso' | 'pan';
  ```

  The file top should now read:
  ```typescript
  export type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
  export type TaskType = 'T1' | 'T2' | 'T3';
  export type InteractionMode = 'select' | 'lasso' | 'pan';
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `yarn tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add src/public/to-link-or-not/assets/types.ts
  git commit -m "feat: add InteractionMode type"
  ```

---

## Task 2: `InteractionStrip` component (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/InteractionStrip.tsx`
- Create: `src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx`

- [ ] **Step 1: Write the failing tests**

  Create `src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx`:

  ```tsx
  import React from 'react';
  import { render, screen, fireEvent } from '@testing-library/react';
  import { describe, it, expect, vi } from 'vitest';
  import { InteractionStrip } from '../InteractionStrip';

  const defaultProps = {
    mode: 'select' as const,
    onModeChange: vi.fn(),
    onResetZoom: vi.fn(),
    onResetSelection: vi.fn(),
  };

  describe('InteractionStrip', () => {
    it('renders all three mode buttons', () => {
      render(<InteractionStrip {...defaultProps} />);
      expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /lasso/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pan/i })).toBeInTheDocument();
    });

    it('marks the active mode button as pressed', () => {
      render(<InteractionStrip {...defaultProps} mode="lasso" />);
      expect(screen.getByRole('button', { name: /lasso/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /select/i })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onModeChange with the clicked mode', () => {
      const onModeChange = vi.fn();
      render(<InteractionStrip {...defaultProps} onModeChange={onModeChange} />);
      fireEvent.click(screen.getByRole('button', { name: /lasso/i }));
      expect(onModeChange).toHaveBeenCalledWith('lasso');
    });

    it('calls onResetZoom when Reset Zoom is clicked', () => {
      const onResetZoom = vi.fn();
      render(<InteractionStrip {...defaultProps} onResetZoom={onResetZoom} />);
      fireEvent.click(screen.getByRole('button', { name: /reset zoom/i }));
      expect(onResetZoom).toHaveBeenCalledOnce();
    });

    it('calls onResetSelection when Reset Selection is clicked', () => {
      const onResetSelection = vi.fn();
      render(<InteractionStrip {...defaultProps} onResetSelection={onResetSelection} />);
      fireEvent.click(screen.getByRole('button', { name: /reset selection/i }));
      expect(onResetSelection).toHaveBeenCalledOnce();
    });

    it('shows the Ctrl hint', () => {
      render(<InteractionStrip {...defaultProps} />);
      expect(screen.getByText(/ctrl/i)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  Run: `yarn test --reporter=verbose src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx`
  Expected: FAIL — `InteractionStrip` module not found

- [ ] **Step 3: Implement the component**

  Create `src/public/to-link-or-not/assets/InteractionStrip.tsx`:

  ```tsx
  import React from 'react';
  import { InteractionMode } from './types';

  const MODE_CONFIG: Record<InteractionMode, { icon: string; label: string }> = {
    select: { icon: '↖', label: 'Select' },
    lasso: { icon: '⬚', label: 'Lasso' },
    pan: { icon: '✥', label: 'Pan' },
  };

  interface InteractionStripProps {
    mode: InteractionMode;
    onModeChange: (mode: InteractionMode) => void;
    onResetZoom: () => void;
    onResetSelection: () => void;
  }

  export function InteractionStrip({
    mode,
    onModeChange,
    onResetZoom,
    onResetSelection,
  }: InteractionStripProps) {
    const btnBase: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '5px',
      fontSize: '12px', cursor: 'pointer',
    };

    return (
      <div
        style={{
          padding: '6px 14px',
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '3px' }}>
          {(['select', 'lasso', 'pan'] as const).map((m) => {
            const { icon, label } = MODE_CONFIG[m];
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => onModeChange(m)}
                style={{
                  ...btnBase,
                  background: active ? '#ede9fe' : 'white',
                  border: `1px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
                  color: active ? '#4f46e5' : '#6b7280',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

        <button
          type="button"
          onClick={onResetZoom}
          style={{ ...btnBase, background: 'white', border: '1px solid #e2e8f0', color: '#6b7280' }}
        >
          ⊙ Reset Zoom
        </button>

        <button
          type="button"
          onClick={onResetSelection}
          style={{ ...btnBase, background: 'white', border: '1px solid #e2e8f0', color: '#6b7280' }}
        >
          ✕ Reset Selection
        </button>

        <div
          style={{
            marginLeft: 'auto',
            padding: '3px 8px',
            background: '#fefce8',
            border: '1px solid #fde68a',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#92400e',
            opacity: mode === 'lasso' ? 1 : 0.4,
          }}
        >
          <strong>Ctrl + lasso</strong> adds to selection
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  Run: `yarn test --reporter=verbose src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx`
  Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/public/to-link-or-not/assets/InteractionStrip.tsx \
          src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx
  git commit -m "feat: add InteractionStrip component"
  ```

---

## Task 3: `useZoomPan` hook

**Files:**
- Create: `src/public/to-link-or-not/assets/hooks/useZoomPan.ts`

No dedicated unit test file — D3 zoom requires real SVG layout that jsdom cannot provide. Behavior is covered by the `NodeLinkDiagram` integration tests in Task 5.

- [ ] **Step 1: Implement the hook**

  Create `src/public/to-link-or-not/assets/hooks/useZoomPan.ts`:

  ```typescript
  import React, { useEffect, useRef, useCallback } from 'react';
  import * as d3 from 'd3';

  export interface ZoomPanResult {
    contentRef: React.RefObject<SVGGElement>;
    transformRef: React.MutableRefObject<d3.ZoomTransform>;
    resetZoom: () => void;
  }

  export function useZoomPan(
    svgRef: React.RefObject<SVGSVGElement>,
    panEnabled: boolean,
  ): ZoomPanResult {
    const contentRef = useRef<SVGGElement>(null);
    const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    // Use a ref so the filter closure always reads the latest value without re-attaching zoom
    const panEnabledRef = useRef(panEnabled);

    useEffect(() => {
      panEnabledRef.current = panEnabled;
    }, [panEnabled]);

    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return () => {};

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 4])
        .filter((event: Event) => {
          // Scroll wheel always zooms regardless of mode
          if (event.type === 'wheel') return true;
          // Drag only pans when pan mode is active
          return panEnabledRef.current && (event as MouseEvent).button === 0;
        })
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          transformRef.current = event.transform;
          if (contentRef.current) {
            d3.select(contentRef.current).attr('transform', event.transform.toString());
          }
        });

      zoomRef.current = zoom;
      d3.select(svg).call(zoom);

      return () => {
        d3.select(svg).on('.zoom', null);
      };
    }, [svgRef]);

    const resetZoom = useCallback(() => {
      const svg = svgRef.current;
      const zoom = zoomRef.current;
      if (!svg || !zoom) return;
      d3.select(svg).call(zoom.transform, d3.zoomIdentity);
    }, [svgRef]);

    return { contentRef, transformRef, resetZoom };
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `yarn tsc --noEmit`
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add src/public/to-link-or-not/assets/hooks/useZoomPan.ts
  git commit -m "feat: add useZoomPan hook"
  ```

---

## Task 4: `useLasso` hook with `getNodesInPolygon` (TDD)

**Files:**
- Create: `src/public/to-link-or-not/assets/hooks/useLasso.ts`
- Create: `src/public/to-link-or-not/assets/__tests__/useLasso.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `src/public/to-link-or-not/assets/__tests__/useLasso.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import * as d3 from 'd3';
  import { getNodesInPolygon } from '../hooks/useLasso';
  import { PositionedNode } from '../types';

  const nodes: PositionedNode[] = [
    { id: 'n1', x: 50, y: 150 },   // inside a box from (0,100) to (200,200)
    { id: 'n2', x: 150, y: 150 },  // inside
    { id: 'n3', x: 250, y: 150 },  // outside
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
      // Translate by (100, 0): node n1 visually at (150,150), n3 visually at (350,150)
      // A polygon around (100,100)-(250,200) would now capture n1 and n2 (visual x=150,250)
      // but NOT n3 (visual x=350)
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
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  Run: `yarn test --reporter=verbose src/public/to-link-or-not/assets/__tests__/useLasso.test.ts`
  Expected: FAIL — `getNodesInPolygon` not found

- [ ] **Step 3: Implement the hook**

  Create `src/public/to-link-or-not/assets/hooks/useLasso.ts`:

  ```typescript
  import React, { useEffect, useRef, useState } from 'react';
  import * as d3 from 'd3';
  import { PositionedNode, InteractionMode } from '../types';

  export function getNodesInPolygon(
    polygon: [number, number][],
    nodes: PositionedNode[],
    transform: d3.ZoomTransform,
  ): string[] {
    if (polygon.length < 3) return [];
    return nodes
      .filter((node) => {
        const [sx, sy] = transform.apply([node.x, node.y]);
        return d3.polygonContains(polygon, [sx, sy]);
      })
      .map((node) => node.id);
  }

  export interface LassoResult {
    lassoPolygon: [number, number][] | null;
    isLassoing: boolean;
  }

  export function useLasso(
    svgRef: React.RefObject<SVGSVGElement>,
    transformRef: React.MutableRefObject<d3.ZoomTransform>,
    nodes: PositionedNode[],
    mode: InteractionMode,
    onLassoComplete: (nodeIds: string[], additive: boolean) => void,
  ): LassoResult {
    const [lassoPolygon, setLassoPolygon] = useState<[number, number][] | null>(null);
    const [isLassoing, setIsLassoing] = useState(false);
    const polygonRef = useRef<[number, number][]>([]);
    const activeRef = useRef(false);
    // Refs so event handlers always see the latest values without re-subscribing
    const modeRef = useRef(mode);
    const nodesRef = useRef(nodes);
    const onCompleteRef = useRef(onLassoComplete);

    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { onCompleteRef.current = onLassoComplete; }, [onLassoComplete]);

    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return () => {};

      function onMouseDown(event: MouseEvent) {
        if (modeRef.current !== 'lasso') return;
        event.preventDefault();
        const [x, y] = d3.pointer(event, svg as SVGSVGElement);
        activeRef.current = true;
        polygonRef.current = [[x, y]];
        setIsLassoing(true);
        setLassoPolygon([[x, y]]);
      }

      function onMouseMove(event: MouseEvent) {
        if (!activeRef.current) return;
        const [x, y] = d3.pointer(event, svg as SVGSVGElement);
        polygonRef.current = [...polygonRef.current, [x, y]];
        setLassoPolygon([...polygonRef.current]);
      }

      function onMouseUp(event: MouseEvent) {
        if (!activeRef.current) return;
        activeRef.current = false;
        setIsLassoing(false);
        setLassoPolygon(null);
        const matched = getNodesInPolygon(
          polygonRef.current,
          nodesRef.current,
          transformRef.current,
        );
        const additive = event.ctrlKey || event.metaKey;
        onCompleteRef.current(matched, additive);
        polygonRef.current = [];
      }

      svg.addEventListener('mousedown', onMouseDown);
      svg.addEventListener('mousemove', onMouseMove);
      svg.addEventListener('mouseup', onMouseUp);

      return () => {
        svg.removeEventListener('mousedown', onMouseDown);
        svg.removeEventListener('mousemove', onMouseMove);
        svg.removeEventListener('mouseup', onMouseUp);
      };
    }, [svgRef, transformRef]);

    return { lassoPolygon, isLassoing };
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  Run: `yarn test --reporter=verbose src/public/to-link-or-not/assets/__tests__/useLasso.test.ts`
  Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/public/to-link-or-not/assets/hooks/useLasso.ts \
          src/public/to-link-or-not/assets/__tests__/useLasso.test.ts
  git commit -m "feat: add useLasso hook with getNodesInPolygon"
  ```

---

## Task 5: Wire up `NodeLinkDiagram` and update tests (TDD)

**Files:**
- Modify: `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx`

- [ ] **Step 1: Add new tests to the existing test file**

  Open `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx` and add the following mock declarations at the top, immediately after the existing `vi.mock('../hooks/useForceLayout', ...)` call:

  ```typescript
  // Capture the lasso completion callback so tests can trigger it directly
  let capturedLassoComplete: ((ids: string[], additive: boolean) => void) | null = null;

  vi.mock('../hooks/useZoomPan', () => ({
    useZoomPan: () => ({
      contentRef: { current: null },
      transformRef: { current: { apply: (p: [number, number]) => p, k: 1, x: 0, y: 0 } },
      resetZoom: vi.fn(),
    }),
  }));

  vi.mock('../hooks/useLasso', () => ({
    useLasso: (
      _svgRef: unknown,
      _transformRef: unknown,
      _nodes: unknown,
      _mode: unknown,
      onLassoComplete: (ids: string[], additive: boolean) => void,
    ) => {
      capturedLassoComplete = onLassoComplete;
      return { lassoPolygon: null, isLassoing: false };
    },
  }));
  ```

  Then add a `beforeEach` inside the existing `describe('NodeLinkDiagram', ...)` block to reset the captured callback:

  ```typescript
  beforeEach(() => {
    capturedLassoComplete = null;
  });
  ```

  Add the following new test cases inside the existing `describe('NodeLinkDiagram', ...)` block:

  ```typescript
  it('renders the InteractionStrip with mode buttons', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lasso/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pan/i })).toBeInTheDocument();
  });

  it('Select mode button is active by default', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    expect(screen.getByRole('button', { name: /select/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching to Lasso mode marks Lasso as active', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /lasso/i }));
    expect(screen.getByRole('button', { name: /lasso/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /select/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Reset Selection button clears selected nodes', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T2', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    // Select n2 by clicking it
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n2);
    // n2 should now be green (selected)
    expect(n2.getAttribute('fill')).toBe('#10b981');
    // Reset selection
    fireEvent.click(screen.getByRole('button', { name: /reset selection/i }));
    expect(n2.getAttribute('fill')).toBe('#4f46e5');
  });

  it('lasso completion (non-additive) replaces selection', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T2', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    // First select n2 by clicking
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n2);
    expect(n2.getAttribute('fill')).toBe('#10b981');

    // Trigger lasso completion with only n3 (no Ctrl — replaces)
    act(() => { capturedLassoComplete!(['n3'], false); });

    expect(n2.getAttribute('fill')).toBe('#4f46e5'); // deselected
    const n3 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n3')!;
    expect(n3.getAttribute('fill')).toBe('#10b981'); // selected
  });

  it('lasso completion with Ctrl adds to existing selection', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    // Click n1 to start a selection
    const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n1')!;
    fireEvent.click(n1);
    expect(n1.getAttribute('fill')).toBe('#10b981');

    // Ctrl+lasso adds n2 without removing n1
    act(() => { capturedLassoComplete!(['n2'], true); });

    expect(n1.getAttribute('fill')).toBe('#10b981'); // still selected
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    expect(n2.getAttribute('fill')).toBe('#10b981'); // also selected
  });

  it('node click is ignored when mode is not select', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    // Switch to Pan mode
    fireEvent.click(screen.getByRole('button', { name: /pan/i }));
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n2);
    // Should remain unselected (default indigo)
    expect(n2.getAttribute('fill')).toBe('#4f46e5');
  });

  it('lasso skips anchor nodes (T2)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T2', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    // T2 anchors are n1 and n3; lasso completing over all three should only select n2
    act(() => { capturedLassoComplete!(['n1', 'n2', 'n3'], false); });

    const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n1')!;
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    const n3 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n3')!;

    expect(n1.getAttribute('fill')).toBe('#f59e0b'); // anchor color unchanged
    expect(n2.getAttribute('fill')).toBe('#10b981'); // selected
    expect(n3.getAttribute('fill')).toBe('#f59e0b'); // anchor color unchanged
  });
  ```

  Also add `act` to the import at the top of the file:
  ```typescript
  import { render, screen, fireEvent, act } from '@testing-library/react';
  ```

- [ ] **Step 2: Run new tests to confirm they fail**

  Run: `yarn test --reporter=verbose src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx`
  Expected: existing 5 tests PASS, new 8 tests FAIL (InteractionStrip not rendered yet)

- [ ] **Step 3: Rewrite `NodeLinkDiagram.tsx`**

  Replace the entire contents of `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx`:

  ```tsx
  import React, {
    useEffect, useRef, useState, useCallback, useMemo,
  } from 'react';
  import { StimulusParams } from '../../../store/types';
  import {
    StudyParameters, Condition, EdgeRendererProps, InteractionMode,
  } from './types';
  import { useForceLayout } from './hooks/useForceLayout';
  import { useZoomPan } from './hooks/useZoomPan';
  import { useLasso } from './hooks/useLasso';
  import { InteractionStrip } from './InteractionStrip';
  import { TraditionalRenderer } from './renderers/TraditionalRenderer';
  import { NoLinkRenderer } from './renderers/NoLinkRenderer';
  import { OnDemandRenderer } from './renderers/OnDemandRenderer';
  import { StubsRenderer } from './renderers/StubsRenderer';

  const WIDTH = 800;
  const HEIGHT = 560;
  const NODE_RADIUS = 12;

  const EDGE_RENDERERS: Record<Condition, React.FC<EdgeRendererProps>> = {
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

  function getNodeCursor(
    nodeId: string,
    anchorNodes: string[],
    mode: InteractionMode,
    submitted: boolean,
  ): string {
    if (submitted || anchorNodes.includes(nodeId)) return 'default';
    if (mode === 'select') return 'pointer';
    if (mode === 'lasso') return 'crosshair';
    return 'grab';
  }

  export default function NodeLinkDiagram({
    parameters,
    setAnswer,
  }: StimulusParams<StudyParameters>) {
    const {
      condition, graph, task, taskPrompt,
    } = parameters;

    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [mode, setMode] = useState<InteractionMode>('select');
    const startTimeRef = useRef<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const positionedNodes = useForceLayout(graph.nodes, graph.edges, WIDTH, HEIGHT);

    const { contentRef, transformRef, resetZoom } = useZoomPan(svgRef, mode === 'pan');

    const anchorNodes = useMemo(
      () => (task === 'T2' ? [graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB] : []),
      [task, graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB],
    );

    const handleLassoComplete = useCallback((nodeIds: string[], additive: boolean) => {
      if (submitted) return;
      setSelectedNodes((prev) => {
        const selectable = nodeIds.filter((id) => !anchorNodes.includes(id));
        return additive ? [...new Set([...prev, ...selectable])] : selectable;
      });
    }, [submitted, anchorNodes]);

    const { lassoPolygon, isLassoing } = useLasso(
      svgRef, transformRef, positionedNodes, mode, handleLassoComplete,
    );

    useEffect(() => {
      if (positionedNodes.length > 0 && startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
    }, [positionedNodes.length]);

    const EdgeRenderer = EDGE_RENDERERS[condition];

    function handleNodeClick(nodeId: string) {
      if (submitted) return;
      if (mode !== 'select') return;
      if (anchorNodes.includes(nodeId)) return;
      setSelectedNodes((prev) => (task === 'T1'
        ? [nodeId]
        : prev.includes(nodeId)
          ? prev.filter((id) => id !== nodeId)
          : [...prev, nodeId]));
    }

    function handleSubmit() {
      const responseTimeMs = startTimeRef.current !== null ? Date.now() - startTimeRef.current : 0;
      const answerValue: string | string[] = task === 'T1' ? selectedNodes[0] : selectedNodes;
      let isCorrect = false;

      if (task === 'T1') {
        isCorrect = selectedNodes[0] === graph.groundTruth.T1.answer;
      } else if (task === 'T2') {
        const expected = [...graph.groundTruth.T2.commonNeighbors].sort();
        const actual = [...selectedNodes].sort();
        isCorrect = JSON.stringify(actual) === JSON.stringify(expected);
      } else {
        isCorrect = true;
      }

      setSubmitted(true);
      setAnswer({
        status: true,
        answers: {
          'task-answer': typeof answerValue === 'string' ? answerValue : JSON.stringify(answerValue),
          isCorrect,
          responseTimeMs,
          condition,
          task,
          graphId: graph.id,
        },
      });
    }

    function getNodeFill(nodeId: string): string {
      if (anchorNodes.includes(nodeId)) return '#f59e0b';
      if (selectedNodes.includes(nodeId)) return '#10b981';
      return '#4f46e5';
    }

    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: `${WIDTH}px`, margin: '0 auto' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>{taskPrompt}</p>
        </div>

        <InteractionStrip
          mode={mode}
          onModeChange={setMode}
          onResetZoom={resetZoom}
          onResetSelection={() => setSelectedNodes([])}
        />

        <svg
          ref={svgRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ display: 'block', background: 'white', border: '1px solid #e2e8f0' }}
        >
          <g ref={contentRef}>
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
                  {positionedNodes.map((node) => (
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
                          cursor: getNodeCursor(node.id, anchorNodes, mode, submitted),
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
                {isLassoing && lassoPolygon && lassoPolygon.length >= 2 && (
                  <polygon
                    points={lassoPolygon.map(([x, y]) => `${x},${y}`).join(' ')}
                    fill="rgba(79,70,229,0.08)"
                    stroke="#4f46e5"
                    strokeWidth={1.5}
                    strokeDasharray="5,3"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </>
            )}
          </g>
        </svg>

        <div style={{
          padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
        }}
        >
          {submitted ? (
            <p style={{
              margin: 0, color: '#059669', fontSize: '0.875rem', fontWeight: 500,
            }}
            >
              ✓ Answer recorded — click Next to continue.
            </p>
          ) : (
            <>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                {TASK_INSTRUCTIONS[task]}
              </p>
              <button
                type="button"
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
            </>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run all tests**

  Run: `yarn test --reporter=verbose src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx`
  Expected: all 13 tests PASS (5 original + 8 new)

- [ ] **Step 5: Run the full test suite to check for regressions**

  Run: `yarn test`
  Expected: all tests PASS — no regressions in renderer or force-layout tests

- [ ] **Step 6: Commit**

  ```bash
  git add src/public/to-link-or-not/assets/NodeLinkDiagram.tsx \
          src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
  git commit -m "feat: add zoom/pan and lasso interactions to NodeLinkDiagram"
  ```
