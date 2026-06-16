export type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
export type TaskType = 'T1' | 'T2' | 'T3';
export type InteractionMode = 'select' | 'lasso' | 'pan';
export type FeedbackColor = 'correct' | 'wrong' | 'missed' | `community-${number}`;

export interface GraphNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
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
  targetCommunityIndex?: number; // largest embedded LFR community for exact T3 scoring
  targetCommunity?: string[];
  placeholderNode?: string;
}

export interface T1AnswerMetrics {
  expectedNode: string;
  selectedNode: string;
  exactMatch: boolean;
}

export interface T2AnswerMetrics {
  expectedNodes: string[];
  anchorPair: [string, string];
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  exactMatch: boolean;
}

export interface T3CommunityOverlap {
  communityIndex: number;
  expectedNodes: string[];
  intersectionSize: number;
  selectedSize: number;
  communitySize: number;
  jaccard: number;
}

export interface T3AnswerMetrics {
  expectedNodes: string[];
  targetCommunityIndex?: number;
  placeholderNode?: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  communityOverlaps: T3CommunityOverlap[];
  bestCommunityIndex?: number;
  bestCommunityJaccard?: number;
  exactMatch: boolean;
}

export type TaskAnswerMetrics = T1AnswerMetrics | T2AnswerMetrics | T3AnswerMetrics;

export interface StudyTaskAnswer {
  taskAnswer: string | string[];
  isCorrect: boolean;
  responseTimeMs: number;
  condition: Condition;
  task: TaskType;
  graphId: string;
  selectedNodes: string[];
  selectedNodeCount: number;
  groundTruthSnapshot: GroundTruthT1 | GroundTruthT2 | GroundTruthT3;
  metrics: TaskAnswerMetrics;
  interactionsUsed: Partial<Record<InteractionMode | 'resetZoom' | 'resetSelection' | 'modeChange', number>>;
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
  layout?: {
    type: string;
    width?: number;
    height?: number;
    margin?: number;
    seed?: number;
  };
}

export interface StudyParameters {
  condition: Condition;
  graph: GraphData;
  graphPath?: string;
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
