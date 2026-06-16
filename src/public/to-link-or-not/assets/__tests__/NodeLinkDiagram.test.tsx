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

let developmentModeEnabled = false;

vi.mock('../../../../store/store', () => ({
  useStoreSelector: (selector: (state: { modes: { developmentModeEnabled: boolean } }) => unknown) => selector({
    modes: { developmentModeEnabled },
  }),
}));

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
    developmentModeEnabled = false;
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
    expect(call.answers.graphId).toBe('test-g01');
    expect(call.answers.condition).toBe('traditional');
    expect(call.answers.task).toBe('T1');
    expect(JSON.parse(call.answers.selectedNodes)).toEqual(['n2']);
    expect(JSON.parse(call.answers.groundTruthSnapshot)).toEqual(graph.groundTruth.T1);
    expect(JSON.parse(call.answers.metrics)).toMatchObject({
      expectedNode: 'n2',
      selectedNode: 'n2',
      exactMatch: true,
    });
    expect(JSON.parse(call.answers.interactionsUsed)).toEqual({ select: 1 });
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
    expect(JSON.parse(call.answers.selectedNodes)).toEqual(['n2']);
    expect(JSON.parse(call.answers.groundTruthSnapshot)).toEqual(graph.groundTruth.T2);
    expect(JSON.parse(call.answers.metrics)).toMatchObject({
      expectedNodes: ['n2'],
      anchorPair: ['n1', 'n3'],
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 1,
      recall: 1,
      exactMatch: true,
    });
  });

  it('does not show debug adjacency in normal participant mode', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n2')!;
    fireEvent.mouseEnter(n2);

    expect(screen.queryByTestId('debug-adjacency-panel')).not.toBeInTheDocument();
    expect(container.querySelectorAll('g.debug-adjacency-edges line')).toHaveLength(0);
    const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n1')!;
    expect(n1.getAttribute('stroke')).toBe('white');
  });

  it('shows adjacent nodes and incident edges in development mode hover', () => {
    developmentModeEnabled = true;
    const { container } = render(
      <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const circles = container.querySelectorAll('circle.node-circle');
    const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
    const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
    const n3 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n3')!;

    fireEvent.mouseEnter(n2);

    expect(screen.getByTestId('debug-adjacency-panel')).toHaveTextContent('B (n2) → A (n1), C (n3)');
    expect(container.querySelectorAll('g.debug-adjacency-edges line')).toHaveLength(2);
    expect(n1.getAttribute('stroke')).toBe('#dc2626');
    expect(n3.getAttribute('stroke')).toBe('#dc2626');
    expect(n2.getAttribute('stroke')).toBe('#fbbf24');

    fireEvent.mouseLeave(n2);
    expect(screen.queryByTestId('debug-adjacency-panel')).not.toBeInTheDocument();
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

  describe('training feedback — banner', () => {
    it('T1 correct training: shows Correct banner', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
        .find((c) => c.getAttribute('data-node-id') === 'n2')!;
      fireEvent.click(n2);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(screen.getByText(/correct/i)).toBeInTheDocument();
      expect(screen.getByText(/most connected node/i)).toBeInTheDocument();
    });

    it('T1 wrong training: shows Not quite banner', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
        .find((c) => c.getAttribute('data-node-id') === 'n1')!;
      fireEvent.click(n1);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(screen.getByText(/not quite/i)).toBeInTheDocument();
      expect(screen.getByText(/most connected node is highlighted/i)).toBeInTheDocument();
    });

    it('T2 correct training: shows Correct banner', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T2', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
        .find((c) => c.getAttribute('data-node-id') === 'n2')!;
      fireEvent.click(n2);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(screen.getByText(/correct/i)).toBeInTheDocument();
      expect(screen.getByText(/common neighbors/i)).toBeInTheDocument();
    });

    it('T2 wrong training: shows Not quite banner', () => {
      const graphWithWrongNode: StudyParameters['graph'] = {
        id: 'test-g02',
        nodes: [
          { id: 'n1', label: 'A' },
          { id: 'n2', label: 'B' },
          { id: 'n3', label: 'C' },
          { id: 'n4', label: 'D' },
        ],
        edges: [
          { source: 'n1', target: 'n3' },
          { source: 'n2', target: 'n3' },
          { source: 'n4', target: 'n1' },
        ],
        groundTruth: {
          T1: { answer: 'n1', rationale: 'highest degree' },
          T2: { nodeA: 'n1', nodeB: 'n2', commonNeighbors: ['n3'] },
          T3: { communities: [['n1', 'n2'], ['n3', 'n4']] },
        },
      };
      const { container } = render(
        <NodeLinkDiagram
          parameters={{
            condition: 'traditional',
            graph: graphWithWrongNode,
            task: 'T2',
            taskPrompt: 'Test',
            isTraining: true,
          }}
          setAnswer={vi.fn()}
          answers={{}}
        />,
      );
      // n1 and n2 are T2 anchors. n3 is correct (common neighbor). n4 is a wrong selectable node.
      const n4 = Array.from(container.querySelectorAll('circle.node-circle'))
        .find((c) => c.getAttribute('data-node-id') === 'n4')!;
      fireEvent.click(n4); // select wrong node
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(screen.getByText(/not quite/i)).toBeInTheDocument();
      expect(screen.getByText(/missed nodes are highlighted/i)).toBeInTheDocument();
    });

    it('T3 training: shows grouping info banner', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeTrainingParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
        .find((c) => c.getAttribute('data-node-id') === 'n1')!;
      fireEvent.click(n1);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(screen.getByText(/largest cluster is the target/i)).toBeInTheDocument();
    });

    it('non-training: shows Answer recorded (no feedback banner)', () => {
      const { container } = render(
        <NodeLinkDiagram parameters={makeParams('T1', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
      );
      const n2 = Array.from(container.querySelectorAll('circle.node-circle'))
        .find((c) => c.getAttribute('data-node-id') === 'n2')!;
      fireEvent.click(n2);
      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      expect(screen.getByText(/answer recorded/i)).toBeInTheDocument();
      expect(screen.queryByText(/correct/i)).toBeNull();
      expect(screen.queryByText(/not quite/i)).toBeNull();
    });
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
