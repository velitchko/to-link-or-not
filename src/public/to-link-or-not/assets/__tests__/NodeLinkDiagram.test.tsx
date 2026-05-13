// src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
import React from 'react';
import {
  render, screen, fireEvent, act,
} from '@testing-library/react';
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import NodeLinkDiagram from '../NodeLinkDiagram';
import { StudyParameters } from '../types';

// Mock useForceLayout to return immediately with preset positions
vi.mock('../hooks/useForceLayout', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useForceLayout: (nodes: any[]) => nodes.map((n: any, i: number) => ({ ...n, x: i * 100 + 50, y: 150 })),
}));

// Capture the lasso completion callback so tests can trigger it directly
let capturedLassoComplete: ((ids: string[], additive: boolean) => void) | null = null;

vi.mock('../hooks/useZoomPan', () => ({
  useZoomPan: () => ({
    contentRef: { current: null },
    transformRef: {
      current: {
        apply: (p: [number, number]) => p, k: 1, x: 0, y: 0,
      },
    },
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

const makeTrainingParams = (
  task: StudyParameters['task'],
  condition: StudyParameters['condition'],
): StudyParameters => ({
  condition,
  graph,
  task,
  taskPrompt: 'Test prompt',
  isTraining: true,
});

describe('NodeLinkDiagram', () => {
  beforeEach(() => {
    capturedLassoComplete = null;
  });

  it('renders a circle for each node', () => {
    const setAnswer = vi.fn();
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={setAnswer} answers={{}} />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(3);
  });

  it('shows the task prompt', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    expect(screen.getByText('Test prompt')).toBeInTheDocument();
  });

  it('calls setAnswer with correct T1 answer on submit', () => {
    const setAnswer = vi.fn();
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={setAnswer} answers={{}} />,
    );
    // Click node n2 (correct T1 answer)
    const circles = container.querySelectorAll('circle.node-circle');
    const n2Circle = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2');
    expect(n2Circle).toBeTruthy();
    fireEvent.click(n2Circle!);

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    expect(setAnswer).toHaveBeenCalledOnce();
    const call = setAnswer.mock.calls[0][0];
    expect(call.answers['task-answer']).toBe('n2');
    expect(call.answers.isCorrect).toBe(true);
    expect(typeof call.answers.responseTimeMs).toBe('number');
  });

  it('uses NoLinkRenderer when condition is no-link (no lines in SVG)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'no-link')} setAnswer={vi.fn()} answers={{}} />,
    );
    expect(container.querySelectorAll('line')).toHaveLength(0);
  });

  it('uses TraditionalRenderer when condition is traditional (lines present)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    expect(container.querySelectorAll('line').length).toBeGreaterThan(0);
  });

  it('T2: anchor nodes are not selectable; correct common-neighbor selection is scored as correct', () => {
    const setAnswer = vi.fn();
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T2', 'traditional')} setAnswer={setAnswer} answers={{}} />,
    );
    const circles = container.querySelectorAll('circle.node-circle');
    // n1 and n3 are T2 anchors — clicking them should NOT add them to selectedNodes
    const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
    const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
    const n3 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n3')!;
    fireEvent.click(n1); // anchor — should be ignored
    fireEvent.click(n3); // anchor — should be ignored
    fireEvent.click(n2); // correct common neighbor

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    expect(setAnswer).toHaveBeenCalledOnce();
    const call = setAnswer.mock.calls[0][0];
    // Only n2 should be in the answer (anchors were not selectable)
    expect(JSON.parse(call.answers['task-answer'])).toEqual(['n2']);
    expect(call.answers.isCorrect).toBe(true);
  });

  it('renders the InteractionStrip with mode buttons', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    expect(screen.getByRole('button', { name: /^Select$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lasso/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pan/i })).toBeInTheDocument();
  });

  it('Select mode button is active by default', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    expect(screen.getByRole('button', { name: /^Select$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching to Lasso mode marks Lasso as active', () => {
    render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /lasso/i }));
    expect(screen.getByRole('button', { name: /lasso/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Select$/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Reset Selection button clears selected nodes', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T2', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n2);
    expect(n2.getAttribute('fill')).toBe('#10b981');
    fireEvent.click(screen.getByRole('button', { name: /reset selection/i }));
    expect(n2.getAttribute('fill')).toBe('#4f46e5');
  });

  it('lasso completion (non-additive) replaces selection', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n2);
    expect(n2.getAttribute('fill')).toBe('#10b981');

    act(() => { capturedLassoComplete!(['n3'], false); });

    expect(n2.getAttribute('fill')).toBe('#4f46e5');
    const n3 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n3')!;
    expect(n3.getAttribute('fill')).toBe('#10b981');
  });

  it('lasso completion with Ctrl adds to existing selection', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n1')!;
    fireEvent.click(n1);
    expect(n1.getAttribute('fill')).toBe('#10b981');

    act(() => { capturedLassoComplete!(['n2'], true); });

    expect(n1.getAttribute('fill')).toBe('#10b981');
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    expect(n2.getAttribute('fill')).toBe('#10b981');
  });

  it('node click is ignored when mode is not select', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /pan/i }));
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n2);
    expect(n2.getAttribute('fill')).toBe('#4f46e5');
  });

  it('plain click in select mode replaces selection (T3)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const circles = container.querySelectorAll('circle.node-circle');
    const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
    const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n1); // select n1
    expect(n1.getAttribute('fill')).toBe('#10b981');
    fireEvent.click(n2); // plain click n2 — replaces selection, n1 deselected
    expect(n1.getAttribute('fill')).toBe('#4f46e5');
    expect(n2.getAttribute('fill')).toBe('#10b981');
  });

  it('Ctrl+click adds a second node to selection', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const circles = container.querySelectorAll('circle.node-circle');
    const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
    const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n1); // plain click: select only n1
    expect(n1.getAttribute('fill')).toBe('#10b981');
    expect(n2.getAttribute('fill')).toBe('#4f46e5');
    fireEvent.click(n2, { ctrlKey: true }); // Ctrl+click: add n2
    expect(n1.getAttribute('fill')).toBe('#10b981');
    expect(n2.getAttribute('fill')).toBe('#10b981');
  });

  it('Ctrl+click removes an already-selected node', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const circles = container.querySelectorAll('circle.node-circle');
    const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
    fireEvent.click(n1); // select n1
    expect(n1.getAttribute('fill')).toBe('#10b981');
    fireEvent.click(n1, { ctrlKey: true }); // Ctrl+click: deselect n1
    expect(n1.getAttribute('fill')).toBe('#4f46e5');
  });

  it('Ctrl+click on T1 still single-selects (no multi-select on T1)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const circles = container.querySelectorAll('circle.node-circle');
    const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
    const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.click(n1); // select n1
    fireEvent.click(n2, { ctrlKey: true }); // Ctrl+click n2 — should replace (T1 is single-select)
    expect(n1.getAttribute('fill')).toBe('#4f46e5'); // n1 deselected
    expect(n2.getAttribute('fill')).toBe('#10b981'); // n2 selected
  });

  it('lasso skips anchor nodes (T2)', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T2', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    act(() => { capturedLassoComplete!(['n1', 'n2', 'n3'], false); });

    const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n1')!;
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    const n3 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n3')!;

    expect(n1.getAttribute('fill')).toBe('#f59e0b');
    expect(n2.getAttribute('fill')).toBe('#10b981');
    expect(n3.getAttribute('fill')).toBe('#f59e0b');
  });

  describe('training feedback — node colors', () => {
    it('T1 correct: selected node turns green after submit', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const circles = container.querySelectorAll('circle.node-circle');
      const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
      fireEvent.click(n2);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(n2.getAttribute('fill')).toBe('#10b981'); // correct = green
    });

    it('T1 wrong: selected node turns red, correct node turns gold after submit', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const circles = container.querySelectorAll('circle.node-circle');
      const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
      const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
      fireEvent.click(n1); // wrong answer (correct is n2)
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(n1.getAttribute('fill')).toBe('#ef4444'); // wrong = red
      expect(n2.getAttribute('fill')).toBe('#f59e0b'); // missed = gold
    });

    it('T2 correct: common neighbor turns green after submit', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T2', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const circles = container.querySelectorAll('circle.node-circle');
      const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
      fireEvent.click(n2);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(n2.getAttribute('fill')).toBe('#10b981'); // correct = green
    });

    it('T3: nodes colored by community after submit', () => {
      // graph.groundTruth.T3.communities = [['n1','n2'],['n3']]
      // community-0 (n1,n2) → COMMUNITY_COLORS[0] = '#3b82f6'
      // community-1 (n3)    → COMMUNITY_COLORS[1] = '#f97316'
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const circles = container.querySelectorAll('circle.node-circle');
      const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
      const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
      const n3 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n3')!;
      fireEvent.click(n1); // select something so Submit is enabled
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(n1.getAttribute('fill')).toBe('#3b82f6'); // community-0
      expect(n2.getAttribute('fill')).toBe('#3b82f6'); // community-0
      expect(n3.getAttribute('fill')).toBe('#f97316'); // community-1
    });

    it('non-training: node fills unchanged after submit', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const circles = container.querySelectorAll('circle.node-circle');
      const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
      fireEvent.click(n2);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(n2.getAttribute('fill')).toBe('#10b981'); // still selected green
      // key check: n1 should NOT be gold (feedbackMap empty)
      const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
      expect(n1.getAttribute('fill')).toBe('#4f46e5'); // default indigo, not feedback color
    });
  });
});
