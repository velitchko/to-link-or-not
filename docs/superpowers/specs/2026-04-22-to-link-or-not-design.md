# To Link or Not: Study Design Spec

**Date:** 2026-04-22
**Platform:** revisit.dev
**Working directory:** `/home/velitchko/Projects/to-link-or-not`

---

## Research Questions

**RQ:** How does the cognitive map of participants differ according to the representation of links in node-link diagrams?

**Tasks:**
- **T1** — How does participants' cognitive map change under varying link visibility conditions when identifying important (well-connected) nodes?
- **T2** — How does participants' cognitive map change under varying link visibility conditions when identifying common neighbors?
- **T3** — How are group structures perceived and interpreted under different link representation conditions?

---

## Study Design

| Property | Value |
|---|---|
| Design | Within-subjects |
| Conditions | 4 (Traditional, No-Link, On-Demand, Stubs) |
| Counterbalancing | Latin square across condition blocks |
| Participants | Expert / qualitative focus, small N |
| Trials per participant | 36 (4 conditions × 3 tasks × 3 graphs) |
| Primary measures | Think-aloud utterances, free-text comments, qualitative coding (grounded theory) |
| Secondary measures | Task accuracy, response time |
| Recording | Audio (think-aloud) + screen recording per trial via revisit |

---

## The Four Conditions

All conditions share the same node positions (D3 force layout). Only edge rendering changes.

| Condition | Description |
|---|---|
| **Traditional** | All edges rendered as lines. Full structural information visible. |
| **No-Link** | Nodes only. No edges rendered. Spatial clusters remain as implicit positional cue from force layout. |
| **On-Demand** | Edges hidden by default. Hover a node to reveal its immediate neighbors and connecting edges. Non-neighbors dim on hover. |
| **Stubs** | Short edge stubs extend from each node toward its neighbors (~25% of edge length, configurable). Degree visible; edge destinations ambiguous. |

> **Note on No-Link:** Force layout positions nodes by connectivity, so spatial proximity is not fully information-free. This should be acknowledged in the study materials and paper.

> **Stub length** is a configurable parameter (`stubLengthFraction` in graph JSON), to be tuned during piloting.

---

## Participant Flow

```
1. Consent
2. Demographics (age, gender, education, visualization / graph-reading experience)
3. Study overview (introduce the 4 conditions conceptually)
4. Training block
   └── 4 mini-trainings (fixed order: Traditional → No-Link → On-Demand → Stubs)
       └── each: example graph → sample task → participant answers → correct answer revealed immediately
5. Main study — 4 condition blocks (Latin square order across participants)
   └── each block:
       ├── Condition reminder screen
       ├── 9 trials (3 task types × 3 graphs, randomized order within block)
       │   └── each trial:
       │       ├── Graph + task prompt  [audio + screen recording active]
       │       ├── Answer submission
       │       └── Free-text comment ("Describe your reasoning or mental image")
       └── Post-condition NASA-TLX + open comment field
6. Debrief
   ├── Condition preference ranking (rank all 4)
   └── Open reflection field
```

---

## Graph Data

### Pool Structure

- **4 non-overlapping graph pools**, one per condition (Pool A = Traditional, Pool B = No-Link, Pool C = On-Demand, Pool D = Stubs)
- Each pool contains **15+ synthetic graphs**
- revisit randomly samples **3 graphs per condition** per participant (`numSamples: 3, order: "random"`)
- Guarantees: same graph never appears in two conditions for the same participant, since pools are non-overlapping and fixed per condition

### Graph JSON Schema

```json
{
  "id": "g01",
  "nodes": [
    { "id": "n1", "label": "A" }
  ],
  "edges": [
    { "source": "n1", "target": "n2" }
  ],
  "groundTruth": {
    "T1": {
      "answer": "n1",
      "rationale": "degree 5, highest in graph"
    },
    "T2": {
      "nodeA": "n2",
      "nodeB": "n4",
      "commonNeighbors": ["n1", "n3"]
    },
    "T3": {
      "communities": [["n1","n2","n3"], ["n4","n5","n6"]]
    }
  },
  "stubLengthFraction": 0.25
}
```

---

## Component Architecture

### Project Structure

```
to-link-or-not/
├── public/
│   └── to-link-or-not/
│       ├── config.json                         # revisit study config
│       ├── assets/
│       │   ├── NodeLinkDiagram.tsx             # revisit entry point (single path)
│       │   ├── types.ts                        # GraphData, Node, Edge, PositionedNode
│       │   ├── renderers/
│       │   │   ├── TraditionalRenderer.tsx     # all edges as lines
│       │   │   ├── NoLinkRenderer.tsx          # returns null
│       │   │   ├── OnDemandRenderer.tsx        # hover → reveal neighbor edges
│       │   │   └── StubsRenderer.tsx           # short stubs from each endpoint
│       │   └── hooks/
│       │       └── useForceLayout.ts           # D3 force simulation (shared)
│       └── graphs/
│           ├── training.json                   # training graph
│           ├── pool-a/                         # condition slot A graphs
│           ├── pool-b/                         # condition slot B graphs
│           ├── pool-c/                         # condition slot C graphs
│           └── pool-d/                         # condition slot D graphs
```

### Data Flow

```
revisit config parameters
  (condition, graphData, task, taskPrompt)
        ↓
NodeLinkDiagram.tsx
  └── useForceLayout(graphData) → positioned nodes
  └── renders SVG with nodes
  └── renders <EdgeRenderer condition={condition} ... />
        ↓
EdgeRenderer (factory switch on condition)
  ├── TraditionalRenderer
  ├── NoLinkRenderer
  ├── OnDemandRenderer
  └── StubsRenderer
        ↓
setAnswer({ answers: { answer, isCorrect, responseTimeMs } })
```

### Shared EdgeRenderer Interface

```typescript
interface EdgeRendererProps {
  nodes: PositionedNode[];        // x, y computed by force layout
  edges: Edge[];                  // source / target ids
  hoveredNode: string | null;
  onHover: (id: string | null) => void;
  stubLengthFraction?: number;    // used by StubsRenderer only, default 0.25
}
```

### revisit Config Pattern

```json
{
  "baseComponents": {
    "node-link-trial": {
      "type": "react-component",
      "path": "to-link-or-not/assets/NodeLinkDiagram.tsx",
      "recordAudio": true,
      "recordScreen": true,  // flag name TBD — verify against revisit v2.x typedoc
      "parameters": {
        "condition": "traditional",
        "graph": {},
        "task": "T1",
        "taskPrompt": ""
      },
      "response": [
        { "id": "answer", "type": "iframe" },
        {
          "id": "comment",
          "type": "longText",
          "prompt": "Describe your reasoning or mental image of the graph."
        }
      ]
    }
  },
  "components": {
    "T1-traditional-g01": {
      "baseComponent": "node-link-trial",
      "parameters": {
        "condition": "traditional",
        "graph": "pool-a/g01.json",
        "task": "T1",
        "taskPrompt": "Which node do you think is the most important (well-connected) in this network?"
      }
    }
  }
}
```

---

## Data Storage (Supabase)

Revisit's built-in Supabase integration is used. Per-trial record:

| Field | Source |
|---|---|
| `participantId` | revisit session |
| `condition` | parameters |
| `taskType` | parameters (T1 / T2 / T3) |
| `graphId` | parameters |
| `answer` | setAnswer |
| `isCorrect` | computed in component vs groundTruth |
| `responseTimeMs` | component timer → setAnswer |
| `comment` | free-text response field |
| `audioUrl` | revisit recordAudio |
| `screenRecordingUrl` | revisit recordScreen |
| `timestamp` | revisit |

Audio and screen recordings are timestamped and replayable via the revisit dashboard, enabling direct linking to specific session moments in publications.

---

## Task Prompts

| Task | Prompt shown to participant |
|---|---|
| T1 | "Which node do you think is the most important (well-connected) in this network?" |
| T2 | "Select all nodes that are common neighbors of the two highlighted nodes." |
| T3 | "Draw a boundary around what you perceive as distinct groups or clusters in this network." |

> T3 prompt implies a free-draw / lasso interaction — implementation TBD; may be simplified to multi-select if free-draw is complex.

---

## Open Questions for Piloting

1. **Stub length fraction** — 0.25 is the design default; tune empirically during pilot sessions.
2. **Graph characteristics** — node count, edge density, and topology (e.g., planted partition for T3) to be decided when generating synthetic graphs.
3. **T3 interaction modality** — free-draw lasso vs. multi-node selection for community marking.
4. **Training feedback mechanism** — show correct answer overlay, or verbal description only?
5. **Supabase schema** — to be finalized when setting up the database per revisit docs.
