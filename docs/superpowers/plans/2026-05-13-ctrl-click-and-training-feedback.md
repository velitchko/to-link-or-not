# Ctrl+Click Multi-Select & Training Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ctrl+click additive node selection with a hint badge, and post-submit visual + text feedback for training sessions.

**Architecture:** All changes live in `NodeLinkDiagram.tsx` and `InteractionStrip.tsx`. A `FeedbackColor` type is added to `types.ts`. On submit when `isTraining` is true, a `feedbackMap` (computed once) drives node fill colors and a text banner. Ctrl+click is handled by passing the click event to `handleNodeClick` and reading `event.ctrlKey || event.metaKey`.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react (jsdom)

---

## File Map

| File | Change |
|------|--------|
| `src/public/to-link-or-not/assets/types.ts` | Add `FeedbackColor` export |
| `src/public/to-link-or-not/assets/InteractionStrip.tsx` | Add "Ctrl + click" hint badge; move `marginLeft: auto` from lasso badge to click badge |
| `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx` | Destructure `isTraining`; update `handleNodeClick`; add `feedbackMap`+`trainingCorrect` state; update `handleSubmit`; update `getNodeFill`; update footer JSX |
| `src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx` | Update "shows the Ctrl hint" test; add badge opacity tests |
| `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx` | Add `makeTrainingParams`; add tests for Ctrl+click, feedbackMap, and training banner |

---

## Task 1: Add `FeedbackColor` type to `types.ts`

**Files:**
- Modify: `src/public/to-link-or-not/assets/types.ts`

- [ ] **Step 1: Add the type**

Open `src/public/to-link-or-not/assets/types.ts`. After the `InteractionMode` line (line 3), add:

```typescript
export type FeedbackColor = 'correct' | 'wrong' | 'missed' | `community-${number}`;
```

The full top of the file should now read:

```typescript
export type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
export type TaskType = 'T1' | 'T2' | 'T3';
export type InteractionMode = 'select' | 'lasso' | 'pan';
export type FeedbackColor = 'correct' | 'wrong' | 'missed' | `community-${number}`;
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
yarn typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/public/to-link-or-not/assets/types.ts
git commit -m "feat: add FeedbackColor type"
```

---

## Task 2: Ctrl+click multi-select

**Files:**
- Modify: `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx`
- Modify: `src/public/to-link-or-not/assets/InteractionStrip.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx`

- [ ] **Step 1: Write failing tests in `InteractionStrip.test.tsx`**

Replace the existing "shows the Ctrl hint" test and add two new tests. The existing test uses `getByText(/ctrl/i)` which will match two elements after we add the second badge — update it to be specific.

```typescript
it('shows both Ctrl hint badges', () => {
  render(<InteractionStrip {...defaultProps} />);
  expect(screen.getByText(/ctrl \+ click/i)).toBeInTheDocument();
  expect(screen.getByText(/ctrl \+ lasso/i)).toBeInTheDocument();
});

it('Ctrl+click badge is fully visible in select mode', () => {
  const { container } = render(<InteractionStrip {...defaultProps} mode="select" />);
  const badge = screen.getByText(/ctrl \+ click/i).closest('div')!;
  expect(badge.style.opacity).toBe('1');
});

it('Ctrl+click badge is dimmed in lasso mode', () => {
  render(<InteractionStrip {...defaultProps} mode="lasso" />);
  const badge = screen.getByText(/ctrl \+ click/i).closest('div')!;
  expect(badge.style.opacity).toBe('0.4');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx
```

Expected: "shows both Ctrl hint badges" FAILS (currently only one badge), the two opacity tests FAIL.

- [ ] **Step 3: Add the Ctrl+click badge to `InteractionStrip.tsx`**

In `InteractionStrip.tsx`, find the existing lasso hint badge `<div>` at the bottom of the returned JSX. It currently has `marginLeft: 'auto'`. Move `marginLeft: 'auto'` to the new click badge (so both badges are pushed right together), and remove it from the lasso badge.

Replace the final `<div>` (the lasso badge) with two badges:

```tsx
      <div
        style={{
          background: '#fefce8',
          border: '1px solid #fde68a',
          borderRadius: '4px',
          color: '#92400e',
          fontSize: '11px',
          marginLeft: 'auto',
          opacity: mode === 'select' ? 1 : 0.4,
          padding: '3px 8px',
        }}
      >
        <strong>Ctrl + click</strong>
        {' adds to selection'}
      </div>
      <div
        style={{
          background: '#fefce8',
          border: '1px solid #fde68a',
          borderRadius: '4px',
          color: '#92400e',
          fontSize: '11px',
          opacity: mode === 'lasso' ? 1 : 0.4,
          padding: '3px 8px',
        }}
      >
        <strong>Ctrl + lasso</strong>
        {' adds to selection'}
      </div>
```

- [ ] **Step 4: Run InteractionStrip tests to verify they pass**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 5: Write failing tests for Ctrl+click in `NodeLinkDiagram.test.tsx`**

Add these three tests inside the `describe('NodeLinkDiagram', ...)` block:

```typescript
it('plain click in select mode replaces selection (T3)', () => {
  const { container } = render(
    <NodeLinkDiagram parameters={makeParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
  );
  const circles = container.querySelectorAll('circle.node-circle');
  const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
  const n2 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n2')!;
  fireEvent.click(n1);            // select n1
  expect(n1.getAttribute('fill')).toBe('#10b981');
  fireEvent.click(n2);            // plain click n2 — replaces selection, n1 deselected
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
  fireEvent.click(n1);                           // plain click: select only n1
  expect(n1.getAttribute('fill')).toBe('#10b981');
  expect(n2.getAttribute('fill')).toBe('#4f46e5');
  fireEvent.click(n2, { ctrlKey: true });         // Ctrl+click: add n2
  expect(n1.getAttribute('fill')).toBe('#10b981');
  expect(n2.getAttribute('fill')).toBe('#10b981');
});

it('Ctrl+click removes an already-selected node', () => {
  const { container } = render(
    <NodeLinkDiagram parameters={makeParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
  );
  const circles = container.querySelectorAll('circle.node-circle');
  const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
  fireEvent.click(n1);                           // select n1
  expect(n1.getAttribute('fill')).toBe('#10b981');
  fireEvent.click(n1, { ctrlKey: true });         // Ctrl+click: deselect n1
  expect(n1.getAttribute('fill')).toBe('#4f46e5');
});
```

- [ ] **Step 6: Run to verify they fail**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
```

Expected: the two new Ctrl+click tests FAIL (Ctrl+click currently has no effect). The "plain click replaces" test may pass already.

- [ ] **Step 7: Update `handleNodeClick` in `NodeLinkDiagram.tsx`**

Find the existing `handleNodeClick` function (around line 94):

```typescript
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
```

Replace it with:

```typescript
function handleNodeClick(nodeId: string, event: React.MouseEvent) {
  if (submitted) return;
  if (mode !== 'select') return;
  if (anchorNodes.includes(nodeId)) return;
  const additive = event.ctrlKey || event.metaKey;
  if (additive) {
    setSelectedNodes((prev) => (prev.includes(nodeId)
      ? prev.filter((id) => id !== nodeId)
      : [...prev, nodeId]));
  } else {
    setSelectedNodes([nodeId]);
  }
}
```

- [ ] **Step 8: Update the circle `onClick` to pass the event**

Find the `onClick` on the `<circle>` element (around line 193):

```tsx
onClick={() => handleNodeClick(node.id)}
```

Replace with:

```tsx
onClick={(e) => handleNodeClick(node.id, e)}
```

- [ ] **Step 9: Run all NodeLinkDiagram tests**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
```

Expected: all tests pass including the three new Ctrl+click tests.

- [ ] **Step 10: Typecheck**

```bash
yarn typecheck
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/public/to-link-or-not/assets/InteractionStrip.tsx \
        src/public/to-link-or-not/assets/NodeLinkDiagram.tsx \
        src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx \
        src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
git commit -m "feat: ctrl+click multi-select and Ctrl+click hint badge"
```

---

## Task 3: Training feedback — node colors

**Files:**
- Modify: `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx`

- [ ] **Step 1: Write failing tests in `NodeLinkDiagram.test.tsx`**

Add a `makeTrainingParams` helper after `makeParams`:

```typescript
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
```

Then add these tests:

```typescript
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
    expect(n2.getAttribute('fill')).toBe('#10b981'); // still selected green (not training feedback green, same color coincidentally)
    // key check: n1 should NOT be gold (feedbackMap empty)
    const n1 = Array.from(circles).find((c) => c.getAttribute('data-node-id') === 'n1')!;
    expect(n1.getAttribute('fill')).toBe('#4f46e5'); // default indigo, not feedback color
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
```

Expected: the `training feedback — node colors` tests FAIL (feedbackMap not yet implemented).

- [ ] **Step 3: Add imports and state to `NodeLinkDiagram.tsx`**

Add `FeedbackColor` to the types import (line 7):

```typescript
import {
  StudyParameters, Condition, EdgeRendererProps, InteractionMode, FeedbackColor,
} from './types';
```

Destructure `isTraining` from parameters (around line 51):

```typescript
const {
  condition, graph, task, taskPrompt, isTraining,
} = parameters;
```

Add two new state declarations after the existing state declarations (after `const [mode, setMode]`):

```typescript
const [feedbackMap, setFeedbackMap] = useState<Partial<Record<string, FeedbackColor>>>({});
const [trainingCorrect, setTrainingCorrect] = useState<boolean | null>(null);
```

- [ ] **Step 4: Add a `COMMUNITY_COLORS` constant**

Add this constant after the `TASK_INSTRUCTIONS` constant (around line 32):

```typescript
const COMMUNITY_COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'];
```

- [ ] **Step 5: Update `handleSubmit` to compute feedbackMap**

Find `handleSubmit`. After computing `isCorrect` and before `setSubmitted(true)`, add:

```typescript
if (isTraining) {
  const newFeedbackMap: Partial<Record<string, FeedbackColor>> = {};
  if (task === 'T1') {
    const correctId = graph.groundTruth.T1.answer;
    if (selectedNodes[0] === correctId) {
      newFeedbackMap[correctId] = 'correct';
    } else {
      if (selectedNodes[0]) newFeedbackMap[selectedNodes[0]] = 'wrong';
      newFeedbackMap[correctId] = 'missed';
    }
  } else if (task === 'T2') {
    const truthSet = new Set(graph.groundTruth.T2.commonNeighbors);
    for (const id of selectedNodes) {
      newFeedbackMap[id] = truthSet.has(id) ? 'correct' : 'wrong';
    }
    for (const id of graph.groundTruth.T2.commonNeighbors) {
      if (!selectedNodes.includes(id)) newFeedbackMap[id] = 'missed';
    }
  } else {
    graph.groundTruth.T3.communities.forEach((community, idx) => {
      for (const id of community) {
        newFeedbackMap[id] = `community-${idx}`;
      }
    });
  }
  setFeedbackMap(newFeedbackMap);
  setTrainingCorrect(isCorrect);
}
```

The full `handleSubmit` now reads:

```typescript
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

  if (isTraining) {
    const newFeedbackMap: Partial<Record<string, FeedbackColor>> = {};
    if (task === 'T1') {
      const correctId = graph.groundTruth.T1.answer;
      if (selectedNodes[0] === correctId) {
        newFeedbackMap[correctId] = 'correct';
      } else {
        if (selectedNodes[0]) newFeedbackMap[selectedNodes[0]] = 'wrong';
        newFeedbackMap[correctId] = 'missed';
      }
    } else if (task === 'T2') {
      const truthSet = new Set(graph.groundTruth.T2.commonNeighbors);
      for (const id of selectedNodes) {
        newFeedbackMap[id] = truthSet.has(id) ? 'correct' : 'wrong';
      }
      for (const id of graph.groundTruth.T2.commonNeighbors) {
        if (!selectedNodes.includes(id)) newFeedbackMap[id] = 'missed';
      }
    } else {
      graph.groundTruth.T3.communities.forEach((community, idx) => {
        for (const id of community) {
          newFeedbackMap[id] = `community-${idx}`;
        }
      });
    }
    setFeedbackMap(newFeedbackMap);
    setTrainingCorrect(isCorrect);
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
```

- [ ] **Step 6: Update `getNodeFill` to read feedbackMap**

Replace the existing `getNodeFill` function:

```typescript
function getNodeFill(nodeId: string): string {
  if (anchorNodes.includes(nodeId)) return '#f59e0b';

  const fb = feedbackMap[nodeId];
  if (fb !== undefined) {
    if (fb === 'correct') return '#10b981';
    if (fb === 'wrong') return '#ef4444';
    if (fb === 'missed') return '#f59e0b';
    // community-N
    const idx = parseInt(fb.replace('community-', ''), 10);
    return COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length];
  }

  if (selectedNodes.includes(nodeId)) return '#10b981';
  return '#4f46e5';
}
```

- [ ] **Step 7: Run tests**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
```

Expected: all tests pass.

- [ ] **Step 8: Typecheck**

```bash
yarn typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/public/to-link-or-not/assets/NodeLinkDiagram.tsx \
        src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
git commit -m "feat: training feedback node colors via feedbackMap"
```

---

## Task 4: Training feedback — text banner

**Files:**
- Modify: `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx`
- Modify: `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx`

- [ ] **Step 1: Write failing tests in `NodeLinkDiagram.test.tsx`**

Add a new describe block for banner tests:

```typescript
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

  it('T3 training: shows grouping info banner', () => {
    const { container } = render(
      <NodeLinkDiagram parameters={makeTrainingParams('T3', 'traditional')} setAnswer={vi.fn()} answers={{}} />,
    );
    const n1 = Array.from(container.querySelectorAll('circle.node-circle'))
      .find((c) => c.getAttribute('data-node-id') === 'n1')!;
    fireEvent.click(n1);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/one way to group/i)).toBeInTheDocument();
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
```

- [ ] **Step 2: Run to verify they fail**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
```

Expected: all 5 training banner tests FAIL.

- [ ] **Step 3: Update the footer JSX in `NodeLinkDiagram.tsx`**

Find the footer `<div>` at the bottom of the JSX (the one containing the `submitted ? ... : ...` ternary, around line 225). Replace the entire contents of that div with the new conditional:

```tsx
<div style={{
  padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
}}
>
  {submitted ? (
    isTraining ? (
      <>
        {task === 'T3' && (
          <p style={{ margin: 0, color: '#1d4ed8', fontSize: '0.875rem', fontWeight: 500 }}>
            ℹ Here&apos;s one way to group this network. Colors show suggested communities.
          </p>
        )}
        {task !== 'T3' && trainingCorrect && (
          <p style={{ margin: 0, color: '#059669', fontSize: '0.875rem', fontWeight: 500 }}>
            {task === 'T1'
              ? '✓ Correct! This is the most connected node.'
              : '✓ Correct! You found all the common neighbors.'}
          </p>
        )}
        {task !== 'T3' && !trainingCorrect && (
          <p style={{ margin: 0, color: '#b45309', fontSize: '0.875rem', fontWeight: 500 }}>
            {task === 'T1'
              ? '✗ Not quite. The most connected node is highlighted in gold.'
              : '✗ Not quite. Missed nodes are highlighted in gold; incorrect selections are in red.'}
          </p>
        )}
      </>
    ) : (
      <p style={{
        margin: 0, color: '#059669', fontSize: '0.875rem', fontWeight: 500,
      }}
      >
        ✓ Answer recorded — click Next to continue.
      </p>
    )
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
```

- [ ] **Step 4: Run all NodeLinkDiagram tests**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
```

Expected: all tests pass (the 5 new banner tests + all previously passing tests).

- [ ] **Step 5: Run InteractionStrip tests to confirm no regressions**

```bash
yarn vitest run src/public/to-link-or-not/assets/__tests__/InteractionStrip.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 6: Typecheck**

```bash
yarn typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/public/to-link-or-not/assets/NodeLinkDiagram.tsx \
        src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx
git commit -m "feat: training feedback text banner after submit"
```
