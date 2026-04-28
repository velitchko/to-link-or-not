export type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
export type TaskType = 'T1' | 'T2' | 'T3';

export interface GraphNode {
  id: string;
  label?: string;
}

export interface GraphEdge {
  source: string; // always a string id — never pass directly to d3.forceLink (copy first)
  target: string;
}

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

export interface GroundTruthT1 {
  answer: string; // id of the highest-degree node
  rationale: string;
}

export interface GroundTruthT2 {
  nodeA: string; // id of first highlighted node
  nodeB: string; // id of second highlighted node
  commonNeighbors: string[];
}

export interface GroundTruthT3 {
  communities: string[][]; // each inner array is a community
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
  stubLengthFraction?: number; // default 0.25, tuned per pilot
}

export interface StudyParameters {
  condition: Condition;
  graph: GraphData;
  task: TaskType;
  taskPrompt: string;
  isTraining?: boolean;
}

export interface EdgeRendererProps {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  hoveredNode: string | null;
  onHover: (id: string | null) => void;
  stubLengthFraction?: number; // only used by StubsRenderer
}
