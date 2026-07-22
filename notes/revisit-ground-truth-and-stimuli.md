# ReVISit LFR task metadata and stimuli review

Generated on 2026-06-16 for the active LFR graph pools under `public/to-link-or-not/graphs/lfr/condition_1..condition_4`.

## Outputs

- Task metadata CSV: `public/to-link-or-not/metadata/task-ground-truth.csv`
- Static stimuli review sheet: `public/to-link-or-not/stimuli-review.html`
- Metadata generator: `scripts/revisit/generate_task_metadata.py`
- Stimuli review generator: `scripts/revisit/generate_stimuli_review.py`

## ReVISit correct-answer metadata

ReVISit's config schema expects component-level correct answers under:

```json
"correctAnswer": [{ "id": "task-answer", "answer": "..." }]
```

The `id` must match a response id. For this study that is the reactive response
`task-answer`. Because `NodeLinkDiagram` stores T1 as a node-id string and T2/T3
as JSON-stringified node arrays, the generated `answer` values use those exact
runtime values.

Each graph JSON stores the same ReVISit-shaped array under
`groundTruth.T1.correctAnswer`, `groundTruth.T2.correctAnswer`, and
`groundTruth.T3.correctAnswer`. `scripts/generate-config.ts` copies the relevant
task array onto every generated trial component and all four training components.
ReVISit itself reads the component-level `correctAnswer`; the graph-level copy is
the reproducible source for regeneration.

## Task semantics

- T1 correct answer is computed with NetworkX as the node with maximum degree. Ties are broken by highest node id to match the existing embedded generator output.
- T2 correct answer is computed with `networkx.common_neighbors(nodeA, nodeB)` using the embedded orange anchor nodes.
- T3 “largest cluster” uses the embedded LFR communities, not connected components. These graphs are intended as community-structured LFR stimuli, and connected components are generally the full graph, so connected components would not match the study semantics.
- For T3, the selected target is the largest embedded LFR community. Ties are deterministic. The graph JSON now persists `groundTruth.T3.targetCommunityIndex`, `targetCommunity`, and `placeholderNode`, and the React component scores exact match against that target.

## Placeholder nodes

- T1: the correct highest-degree node.
- T2: the two existing highlighted anchor nodes (`placeholder_node_a`, `placeholder_node_b`).
- T3: the highest-degree node inside the target/largest community, saved as `placeholder_node`.

## How to regenerate

```bash
uv run scripts/revisit/generate_task_metadata.py
uv run scripts/revisit/generate_task_metadata.py --check
python scripts/revisit/generate_stimuli_review.py
npx tsx scripts/generate-config.ts
```

Open `public/to-link-or-not/stimuli-review.html` in a browser to review all 240 cards. The static sheet mirrors the participant node/edge styling; on-demand links are rendered faintly so the graph can be audited without interactive hover screenshots.
