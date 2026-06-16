import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import { StimulusParams } from '../../../store/types';
import { useStoreSelector } from '../../../store/store';
import {
  StudyParameters,
  Condition,
  EdgeRendererProps,
  InteractionMode,
  FeedbackColor,
  TaskAnswerMetrics,
  StudyTaskAnswer,
} from './types';
import { useForceLayout } from './hooks/useForceLayout';
import { useZoomPan } from './hooks/useZoomPan';
import { useLasso } from './hooks/useLasso';
import { InteractionStrip } from './InteractionStrip';
import { TraditionalRenderer } from './renderers/TraditionalRenderer';
import { NoLinkRenderer } from './renderers/NoLinkRenderer';
import { OnDemandRenderer } from './renderers/OnDemandRenderer';
import { StubsRenderer } from './renderers/StubsRenderer';
import { getJsonAssetByPath } from '../../../utils/getStaticAsset';

const WIDTH = 800;
const HEIGHT = 560;
const NODE_RADIUS = 10;
const LABEL_FONT_SIZE = 12;
const LABEL_OFFSET_X = NODE_RADIUS + 4;
const LABEL_OFFSET_Y = -(NODE_RADIUS + 4);
const DEBUG_ADJACENCY_COLOR = '#dc2626';
const LABEL_TOOLTIP_FONT_SIZE = 20;
const LABEL_TOOLTIP_PADDING_X = 10;
const LABEL_TOOLTIP_PADDING_Y = 6;
const LABEL_TOOLTIP_HEIGHT = LABEL_TOOLTIP_FONT_SIZE + LABEL_TOOLTIP_PADDING_Y * 2;

const EDGE_RENDERERS: Record<Condition, React.FC<EdgeRendererProps>> = {
  traditional: TraditionalRenderer,
  'no-link': NoLinkRenderer,
  'on-demand': OnDemandRenderer,
  stubs: StubsRenderer,
};

const TASK_INSTRUCTIONS: Record<StudyParameters['task'], string> = {
  T1: 'Click the node you think is most important (most connected) in this network.',
  T2: 'Click all nodes that are common neighbors of the two highlighted nodes (shown in orange).',
  T3: 'Identify and select the largest cluster you see. Submit when done.',
};

const COMMUNITY_COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'];

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function countIntersection(a: string[], b: string[]): number {
  const bSet = new Set(b);
  return a.filter((value) => bSet.has(value)).length;
}

function computeTaskAnswer({
  task,
  selectedNodes,
  graph,
  responseTimeMs,
  condition,
  interactionCounts,
}: {
  task: StudyParameters['task'];
  selectedNodes: string[];
  graph: StudyParameters['graph'];
  responseTimeMs: number;
  condition: StudyParameters['condition'];
  interactionCounts: Record<InteractionMode | 'resetZoom' | 'resetSelection' | 'modeChange', number>;
}): StudyTaskAnswer {
  const selectedNodesSorted = sortedUnique(selectedNodes);
  const groundTruthSnapshot = graph.groundTruth[task];
  let isCorrect = false;
  let taskAnswer: string | string[] = selectedNodesSorted;
  let metrics: TaskAnswerMetrics;

  if (task === 'T1') {
    const selectedNode = selectedNodes[0] ?? '';
    taskAnswer = selectedNode;
    isCorrect = selectedNode === graph.groundTruth.T1.answer;
    metrics = {
      expectedNode: graph.groundTruth.T1.answer,
      selectedNode,
      exactMatch: isCorrect,
    };
  } else if (task === 'T2') {
    const expected = sortedUnique(graph.groundTruth.T2.commonNeighbors);
    const truePositives = countIntersection(selectedNodesSorted, expected);
    const falsePositives = selectedNodesSorted.length - truePositives;
    const falseNegatives = expected.length - truePositives;
    isCorrect = falsePositives === 0 && falseNegatives === 0;
    metrics = {
      expectedNodes: expected,
      anchorPair: [graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB],
      truePositives,
      falsePositives,
      falseNegatives,
      precision: selectedNodesSorted.length > 0 ? truePositives / selectedNodesSorted.length : 0,
      recall: expected.length > 0 ? truePositives / expected.length : 1,
      exactMatch: isCorrect,
    };
  } else {
    const sortedCommunities = graph.groundTruth.T3.communities.map((community) => sortedUnique(community));
    const targetCommunityIndex = graph.groundTruth.T3.targetCommunityIndex ?? sortedCommunities
      .map((community, index) => ({ community, index }))
      .reduce((best, current) => {
        if (current.community.length !== best.community.length) {
          return current.community.length > best.community.length ? current : best;
        }
        return current.community.join(' ') > best.community.join(' ') ? current : best;
      }).index;
    const expected = sortedUnique(
      graph.groundTruth.T3.targetCommunity ?? sortedCommunities[targetCommunityIndex] ?? [],
    );
    const truePositives = countIntersection(selectedNodesSorted, expected);
    const falsePositives = selectedNodesSorted.length - truePositives;
    const falseNegatives = expected.length - truePositives;
    isCorrect = falsePositives === 0 && falseNegatives === 0;
    const communityOverlaps = sortedCommunities.map((community, index) => {
      const intersectionSize = countIntersection(selectedNodesSorted, community);
      const unionSize = new Set([...selectedNodesSorted, ...community]).size;
      return {
        communityIndex: index,
        expectedNodes: community,
        intersectionSize,
        selectedSize: selectedNodesSorted.length,
        communitySize: community.length,
        jaccard: unionSize > 0 ? intersectionSize / unionSize : 0,
      };
    });
    const bestCommunity = communityOverlaps.reduce<typeof communityOverlaps[number] | null>(
      (best, current) => (!best || current.jaccard > best.jaccard ? current : best),
      null,
    );
    metrics = {
      expectedNodes: expected,
      targetCommunityIndex,
      placeholderNode: graph.groundTruth.T3.placeholderNode,
      truePositives,
      falsePositives,
      falseNegatives,
      precision: selectedNodesSorted.length > 0 ? truePositives / selectedNodesSorted.length : 0,
      recall: expected.length > 0 ? truePositives / expected.length : 1,
      communityOverlaps,
      bestCommunityIndex: bestCommunity?.communityIndex,
      bestCommunityJaccard: bestCommunity?.jaccard,
      exactMatch: isCorrect,
    };
  }

  return {
    taskAnswer,
    isCorrect,
    responseTimeMs,
    condition,
    task,
    graphId: graph.id,
    selectedNodes: selectedNodesSorted,
    selectedNodeCount: selectedNodesSorted.length,
    groundTruthSnapshot,
    metrics,
    interactionsUsed: Object.fromEntries(
      Object.entries(interactionCounts).filter(([, count]) => count > 0),
    ),
  };
}

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

function getAdjacentNodeIds(nodeId: string | null, edges: StudyParameters['graph']['edges']): string[] {
  if (!nodeId) return [];
  return sortedUnique(edges.flatMap((edge) => {
    if (edge.source === nodeId) return [edge.target];
    if (edge.target === nodeId) return [edge.source];
    return [];
  }));
}

function getLabelTooltipWidth(label: string): number {
  return Math.max(48, label.length * 12 + LABEL_TOOLTIP_PADDING_X * 2);
}

export default function NodeLinkDiagram({
  parameters,
  setAnswer,
}: StimulusParams<StudyParameters>) {
  const developmentModeEnabled = useStoreSelector((state) => state.modes.developmentModeEnabled);
  const {
    condition, graph: fallbackGraph, graphPath, task, taskPrompt, isTraining,
  } = parameters;

  const [graph, setGraph] = useState(fallbackGraph);
  const [graphLoadError, setGraphLoadError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('select');
  const [feedbackMap, setFeedbackMap] = useState<Partial<Record<string, FeedbackColor>>>({});
  const [trainingCorrect, setTrainingCorrect] = useState<boolean | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const interactionCountsRef = useRef<Record<InteractionMode | 'resetZoom' | 'resetSelection' | 'modeChange', number>>({
    select: 0,
    lasso: 0,
    pan: 0,
    resetZoom: 0,
    resetSelection: 0,
    modeChange: 0,
  });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      if (!graphPath) {
        setGraph(fallbackGraph);
        setGraphLoadError(null);
        return;
      }

      try {
        const loadedGraph = await getJsonAssetByPath(graphPath);
        if (!cancelled) {
          if (loadedGraph?.nodes?.length && loadedGraph?.edges?.length && loadedGraph?.groundTruth) {
            setGraph(loadedGraph);
            setGraphLoadError(null);
          } else {
            setGraphLoadError(`Could not load graph data from ${graphPath}`);
          }
        }
      } catch {
        if (!cancelled) setGraphLoadError(`Could not load graph data from ${graphPath}`);
      }
    }

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, [fallbackGraph, graphPath]);

  const positionedNodes = useForceLayout(graph.nodes, graph.edges, WIDTH, HEIGHT);

  const { contentRef, transformRef, resetZoom } = useZoomPan(svgRef, mode === 'pan');

  const anchorNodes = useMemo(
    () => (task === 'T2' ? [graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB] : []),
    [task, graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB],
  );

  const debugAdjacentNodeIds = useMemo(
    () => (developmentModeEnabled ? getAdjacentNodeIds(hoveredNode, graph.edges) : []),
    [developmentModeEnabled, hoveredNode, graph.edges],
  );
  const debugAdjacentNodeSet = useMemo(
    () => new Set(debugAdjacentNodeIds),
    [debugAdjacentNodeIds],
  );
  const debugIncidentEdges = useMemo(
    () => (developmentModeEnabled && hoveredNode
      ? graph.edges.filter((edge) => edge.source === hoveredNode || edge.target === hoveredNode)
      : []),
    [developmentModeEnabled, hoveredNode, graph.edges],
  );
  const debugHoveredNode = useMemo(
    () => (hoveredNode ? graph.nodes.find((node) => node.id === hoveredNode) : undefined),
    [hoveredNode, graph.nodes],
  );
  const debugAdjacentNodes = useMemo(
    () => debugAdjacentNodeIds.map((id) => graph.nodes.find((node) => node.id === id) ?? { id }),
    [debugAdjacentNodeIds, graph.nodes],
  );
  const hoveredPositionedNode = useMemo(
    () => (hoveredNode ? positionedNodes.find((node) => node.id === hoveredNode) : undefined),
    [hoveredNode, positionedNodes],
  );
  const hoveredNodeLabel = hoveredPositionedNode?.label ?? hoveredPositionedNode?.id;

  const handleLassoComplete = useCallback((nodeIds: string[], additive: boolean) => {
    if (submitted) return;
    interactionCountsRef.current.lasso += 1;
    setSelectedNodes((prev) => {
      const selectable = nodeIds.filter((id) => !anchorNodes.includes(id));
      return additive ? [...new Set([...prev, ...selectable])] : selectable;
    });
  }, [submitted, anchorNodes]);

  const { lassoPolygon, isLassoing } = useLasso(
    svgRef,
    transformRef,
    positionedNodes,
    mode,
    handleLassoComplete,
  );

  useEffect(() => {
    if (positionedNodes.length > 0 && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  }, [positionedNodes.length]);

  const EdgeRenderer = EDGE_RENDERERS[condition];

  function handleNodeClick(nodeId: string, event: React.MouseEvent) {
    if (submitted) return;
    if (mode !== 'select') return;
    if (anchorNodes.includes(nodeId)) return;
    interactionCountsRef.current.select += 1;
    const additive = (event.ctrlKey || event.metaKey) && task !== 'T1';
    if (additive) {
      setSelectedNodes((prev) => (prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]));
    } else {
      setSelectedNodes([nodeId]);
    }
  }

  function handleSubmit() {
    const responseTimeMs = startTimeRef.current !== null ? Date.now() - startTimeRef.current : 0;
    const answerPayload = computeTaskAnswer({
      task,
      selectedNodes,
      graph,
      responseTimeMs,
      condition,
      interactionCounts: interactionCountsRef.current,
    });
    const { isCorrect } = answerPayload;

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
        'task-answer': typeof answerPayload.taskAnswer === 'string' ? answerPayload.taskAnswer : JSON.stringify(answerPayload.taskAnswer),
        isCorrect: answerPayload.isCorrect,
        responseTimeMs: answerPayload.responseTimeMs,
        condition: answerPayload.condition,
        task: answerPayload.task,
        graphId: answerPayload.graphId,
        selectedNodes: JSON.stringify(answerPayload.selectedNodes),
        selectedNodeCount: answerPayload.selectedNodeCount,
        groundTruthSnapshot: JSON.stringify(answerPayload.groundTruthSnapshot),
        metrics: JSON.stringify(answerPayload.metrics),
        interactionsUsed: JSON.stringify(answerPayload.interactionsUsed),
      },
    });
  }

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
        onModeChange={(nextMode) => {
          if (nextMode !== mode) interactionCountsRef.current.modeChange += 1;
          setMode(nextMode);
        }}
        onResetZoom={() => {
          interactionCountsRef.current.resetZoom += 1;
          resetZoom();
        }}
        onResetSelection={() => {
          interactionCountsRef.current.resetSelection += 1;
          setSelectedNodes([]);
        }}
        ctrlEnabled={task !== 'T1'}
      />

      {graphLoadError && (
        <div style={{ padding: '0.75rem 1rem', color: '#b91c1c', background: '#fef2f2' }}>
          {graphLoadError}
        </div>
      )}

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
              {developmentModeEnabled && debugIncidentEdges.length > 0 && (
                <g className="debug-adjacency-edges" style={{ pointerEvents: 'none' }}>
                  {debugIncidentEdges.map((edge) => {
                    const source = positionedNodes.find((node) => node.id === edge.source);
                    const target = positionedNodes.find((node) => node.id === edge.target);
                    if (!source || !target) return null;
                    return (
                      <line
                        key={`debug-${edge.source}-${edge.target}`}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={DEBUG_ADJACENCY_COLOR}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={0.8}
                      />
                    );
                  })}
                </g>
              )}
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
                      stroke={debugAdjacentNodeSet.has(node.id) ? DEBUG_ADJACENCY_COLOR : hoveredNode === node.id ? '#fbbf24' : 'white'}
                      strokeWidth={debugAdjacentNodeSet.has(node.id) || hoveredNode === node.id ? 3 : 2}
                      style={{
                        cursor: getNodeCursor(node.id, anchorNodes, mode, submitted),
                        transition: 'fill 0.1s',
                      }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={(e) => handleNodeClick(node.id, e)}
                    />
                    {node.label && (
                      <text
                        x={node.x + LABEL_OFFSET_X}
                        y={node.y + LABEL_OFFSET_Y}
                        textAnchor="start"
                        fontSize={LABEL_FONT_SIZE}
                        fontWeight={600}
                        fill="#111827"
                        stroke="white"
                        strokeWidth={4}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        paintOrder="stroke fill"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {node.label}
                      </text>
                    )}
                  </g>
                ))}
              </g>
              {hoveredPositionedNode && hoveredNodeLabel && (() => {
                const tooltipWidth = getLabelTooltipWidth(hoveredNodeLabel);
                const tooltipX = Math.min(
                  Math.max(hoveredPositionedNode.x - tooltipWidth / 2, 4),
                  WIDTH - tooltipWidth - 4,
                );
                const preferredY = hoveredPositionedNode.y - NODE_RADIUS - LABEL_TOOLTIP_HEIGHT - 8;
                const tooltipY = preferredY >= 4
                  ? preferredY
                  : hoveredPositionedNode.y + NODE_RADIUS + 8;

                return (
                  <g
                    className="node-label-tooltip"
                    data-testid="node-label-tooltip"
                    style={{ pointerEvents: 'none' }}
                  >
                    <rect
                      x={tooltipX}
                      y={tooltipY}
                      width={tooltipWidth}
                      height={LABEL_TOOLTIP_HEIGHT}
                      rx={6}
                      fill="#111827"
                      opacity={0.92}
                    />
                    <text
                      x={tooltipX + tooltipWidth / 2}
                      y={tooltipY + LABEL_TOOLTIP_PADDING_Y + LABEL_TOOLTIP_FONT_SIZE - 3}
                      textAnchor="middle"
                      fontSize={LABEL_TOOLTIP_FONT_SIZE}
                      fontWeight={700}
                      fill="white"
                    >
                      {hoveredNodeLabel}
                    </text>
                  </g>
                );
              })()}
            </>
          )}
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
      </svg>

      {developmentModeEnabled && debugHoveredNode && (
        <div
          data-testid="debug-adjacency-panel"
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#7f1d1d',
            fontSize: '0.8rem',
            lineHeight: 1.4,
          }}
        >
          <strong>Debug adjacency:</strong>
          {' '}
          {debugHoveredNode.label ?? debugHoveredNode.id}
          {' '}
          <span style={{ color: '#991b1b' }}>
            (
            {debugHoveredNode.id}
            )
          </span>
          {' → '}
          {debugAdjacentNodes.length > 0
            ? debugAdjacentNodes.map((node) => `${node.label ?? node.id} (${node.id})`).join(', ')
            : 'no adjacent nodes'}
        </div>
      )}

      <div style={{
        padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
      }}
      >
        {submitted ? (
          isTraining ? (
            <>
              {task === 'T3' && (
                <p style={{
                  margin: 0, color: '#1d4ed8', fontSize: '0.875rem', fontWeight: 500,
                }}
                >
                  ℹ The largest cluster is the target. Colors show suggested communities.
                </p>
              )}
              {task !== 'T3' && trainingCorrect && (
                <p style={{
                  margin: 0, color: '#059669', fontSize: '0.875rem', fontWeight: 500,
                }}
                >
                  {task === 'T1'
                    ? '✓ Correct! This is the most connected node.'
                    : '✓ Correct! You found all the common neighbors.'}
                </p>
              )}
              {task !== 'T3' && !trainingCorrect && (
                <p style={{
                  margin: 0, color: '#b45309', fontSize: '0.875rem', fontWeight: 500,
                }}
                >
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
    </div>
  );
}
