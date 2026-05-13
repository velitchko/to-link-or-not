# Ctrl+Click Multi-Select & Training Feedback Design

**Date:** 2026-05-13

---

## Goal

Two additions to `NodeLinkDiagram`:
1. Ctrl+click to additively select nodes in select mode, with a hint badge in the strip.
2. Training feedback: after submit when `isTraining` is true, repaint nodes to show correct/incorrect vs ground truth and display a text banner.

---

## Architecture

Both features live entirely in `NodeLinkDiagram.tsx` and `InteractionStrip.tsx`. No new hooks or components are introduced.

**Ctrl+click:** A modifier check (`event.ctrlKey || event.metaKey`) in `handleNodeClick`. A new hint badge added to `InteractionStrip`.

**Training feedback:** A `feedbackMap: Record<string, FeedbackColor>` state computed once in `handleSubmit` when `isTraining` is true. `getNodeFill` reads it post-submit. A text banner renders in the footer area.

---

## Feature 1: Ctrl+Click Multi-Select

### Behavior

In **select mode**:
- **Click:** Replaces selection with only that node (single select for all tasks).
- **Ctrl+click (or Cmd+click on Mac):** Toggles that node in/out of the existing selection (additive, T2/T3 meaningful; T1 stays effectively single-answer since submit takes `selectedNodes[0]`).
- Anchor nodes (T2 orange nodes) remain unselectable as before.

### `handleNodeClick` changes

```tsx
function handleNodeClick(nodeId: string, event: React.MouseEvent) {
  if (submitted) return;
  if (mode !== 'select') return;
  if (anchorNodes.includes(nodeId)) return;
  const additive = event.ctrlKey || event.metaKey;
  if (additive) {
    setSelectedNodes((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId],
    );
  } else {
    setSelectedNodes([nodeId]);
  }
}
```

The click handler on the `<circle>` passes the event: `onClick={(e) => handleNodeClick(node.id, e)}`.

### InteractionStrip hint badge

A second hint badge sits beside the existing lasso badge. It reads **"Ctrl + click adds to selection"**. Opacity 1 when `mode === 'select'`, 0.4 otherwise. Same yellow styling as the lasso badge.

`InteractionStrip` receives no new props — the lasso badge already uses the `mode` prop for its opacity. The new badge uses the same pattern.

---

## Feature 2: Training Feedback

### Activation

Only when `parameters.isTraining === true`. Non-training sessions are unaffected.

### FeedbackColor type

```ts
type FeedbackColor = 'correct' | 'wrong' | 'missed' | `community-${number}`;
```

Added to `types.ts`.

### feedbackMap computation (in `handleSubmit`)

```ts
const feedbackMap: Record<string, FeedbackColor> = {};

if (isTraining) {
  if (task === 'T1') {
    const correctId = graph.groundTruth.T1.answer;
    if (selectedNodes[0] === correctId) {
      feedbackMap[correctId] = 'correct';
    } else {
      if (selectedNodes[0]) feedbackMap[selectedNodes[0]] = 'wrong';
      feedbackMap[correctId] = 'missed';
    }
  } else if (task === 'T2') {
    const truthSet = new Set(graph.groundTruth.T2.commonNeighbors);
    for (const id of selectedNodes) {
      feedbackMap[id] = truthSet.has(id) ? 'correct' : 'wrong';
    }
    for (const id of graph.groundTruth.T2.commonNeighbors) {
      if (!selectedNodes.includes(id)) feedbackMap[id] = 'missed';
    }
  } else {
    // T3: color by community index
    graph.groundTruth.T3.communities.forEach((community, idx) => {
      for (const id of community) {
        feedbackMap[id] = `community-${idx}`;
      }
    });
  }
}

setFeedbackMap(feedbackMap);
```

`feedbackMap` is stored in `useState<Record<string, FeedbackColor>>({})` and initialized empty.

### getNodeFill changes

```ts
const COMMUNITY_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function getNodeFill(nodeId: string): string {
  if (anchorNodes.includes(nodeId)) return '#f59e0b';

  const fb = feedbackMap[nodeId];
  if (fb) {
    if (fb === 'correct') return '#10b981';  // green
    if (fb === 'wrong')   return '#ef4444';  // red
    if (fb === 'missed')  return '#f59e0b';  // gold
    if (fb.startsWith('community-')) {
      const idx = parseInt(fb.split('-')[1], 10);
      return COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length];
    }
  }

  if (selectedNodes.includes(nodeId)) return '#10b981';
  return '#4f46e5';
}
```

### Text banner

Below the SVG, when `submitted && isTraining`:

- **T1/T2 correct:** Green background — "✓ Correct! [task-specific text]"
- **T1/T2 incorrect:** Amber background — "✗ Not quite. The correct answer is highlighted in gold."
- **T3:** Blue/info background — "ℹ Here's one way to group this network. Colors show suggested communities."

When `submitted && !isTraining`: existing "✓ Answer recorded — click Next to continue." message unchanged.

### T3 training placeholder data

For now, `GroundTruthT3.communities` can be populated with random node groupings in training graph data files. The real training graphs will have proper ground truth.

---

## Files Changed

| File | Change |
|------|--------|
| `assets/types.ts` | Add `FeedbackColor` type |
| `assets/InteractionStrip.tsx` | Add "Ctrl + click adds to selection" hint badge |
| `assets/NodeLinkDiagram.tsx` | Ctrl+click logic in `handleNodeClick`, `feedbackMap` state, updated `getNodeFill`, training banner |
| `assets/__tests__/InteractionStrip.test.tsx` | Test new badge visibility |
| `assets/__tests__/NodeLinkDiagram.test.tsx` | Tests for Ctrl+click, feedbackMap, training banner |

---

## Testing

**Ctrl+click:**
- Regular click replaces selection (all tasks)
- Ctrl+click adds node if not selected
- Ctrl+click removes node if already selected
- Ctrl+click ignored for anchor nodes (T2)
- `mode !== 'select'` ignores both click and Ctrl+click

**Training feedback:**
- T1 correct: only correct node in feedbackMap as `'correct'`
- T1 wrong: selected node = `'wrong'`, correct node = `'missed'`
- T2: true positives = `'correct'`, false positives = `'wrong'`, false negatives = `'missed'`
- T3: each community node gets `community-N` key
- Non-training: `feedbackMap` stays empty, `getNodeFill` unaffected
- Banner text shows correct string per task/result
