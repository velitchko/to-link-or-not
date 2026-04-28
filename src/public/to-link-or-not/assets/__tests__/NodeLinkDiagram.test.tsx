// src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  describe, it, expect, vi,
} from 'vitest';
import NodeLinkDiagram from '../NodeLinkDiagram';
import { StudyParameters } from '../types';

// Mock useForceLayout to return immediately with preset positions
vi.mock('../hooks/useForceLayout', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useForceLayout: (nodes: any[]) => nodes.map((n: any, i: number) => ({ ...n, x: i * 100 + 50, y: 150 })),
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
});
