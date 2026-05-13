import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import { StimulusParams } from '../../../store/types';
import {
  StudyParameters, Condition, EdgeRendererProps, InteractionMode,
} from './types';
import { useForceLayout } from './hooks/useForceLayout';
import { useZoomPan } from './hooks/useZoomPan';
import { useLasso } from './hooks/useLasso';
import { InteractionStrip } from './InteractionStrip';
import { TraditionalRenderer } from './renderers/TraditionalRenderer';
import { NoLinkRenderer } from './renderers/NoLinkRenderer';
import { OnDemandRenderer } from './renderers/OnDemandRenderer';
import { StubsRenderer } from './renderers/StubsRenderer';

const WIDTH = 800;
const HEIGHT = 560;
const NODE_RADIUS = 12;

const EDGE_RENDERERS: Record<Condition, React.FC<EdgeRendererProps>> = {
  traditional: TraditionalRenderer,
  'no-link': NoLinkRenderer,
  'on-demand': OnDemandRenderer,
  stubs: StubsRenderer,
};

const TASK_INSTRUCTIONS: Record<StudyParameters['task'], string> = {
  T1: 'Click the node you think is most important (most connected) in this network.',
  T2: 'Click all nodes that are common neighbors of the two highlighted nodes (shown in orange).',
  T3: 'Click all nodes that form a distinct group or cluster. Submit when done.',
};

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

export default function NodeLinkDiagram({
  parameters,
  setAnswer,
}: StimulusParams<StudyParameters>) {
  const {
    condition, graph, task, taskPrompt,
  } = parameters;

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('select');
  const startTimeRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const positionedNodes = useForceLayout(graph.nodes, graph.edges, WIDTH, HEIGHT);

  const { contentRef, transformRef, resetZoom } = useZoomPan(svgRef as React.RefObject<SVGSVGElement>, mode === 'pan');

  const anchorNodes = useMemo(
    () => (task === 'T2' ? [graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB] : []),
    [task, graph.groundTruth.T2.nodeA, graph.groundTruth.T2.nodeB],
  );

  const handleLassoComplete = useCallback((nodeIds: string[], additive: boolean) => {
    if (submitted) return;
    setSelectedNodes((prev) => {
      const selectable = nodeIds.filter((id) => !anchorNodes.includes(id));
      return additive ? [...new Set([...prev, ...selectable])] : selectable;
    });
  }, [submitted, anchorNodes]);

  const { lassoPolygon, isLassoing } = useLasso(
    svgRef as React.RefObject<SVGSVGElement>,
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

  function getNodeFill(nodeId: string): string {
    if (anchorNodes.includes(nodeId)) return '#f59e0b';
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
        onModeChange={setMode}
        onResetZoom={resetZoom}
        onResetSelection={() => setSelectedNodes([])}
      />

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
                      stroke={hoveredNode === node.id ? '#fbbf24' : 'white'}
                      strokeWidth={hoveredNode === node.id ? 3 : 2}
                      style={{
                        cursor: getNodeCursor(node.id, anchorNodes, mode, submitted),
                        transition: 'fill 0.1s',
                      }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => handleNodeClick(node.id)}
                    />
                    {node.label && (
                      <text
                        x={node.x}
                        y={node.y + NODE_RADIUS + 14}
                        textAnchor="middle"
                        fontSize={11}
                        fill="#374151"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {node.label}
                      </text>
                    )}
                  </g>
                ))}
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
            </>
          )}
        </g>
      </svg>

      <div style={{
        padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem',
      }}
      >
        {submitted ? (
          <p style={{
            margin: 0, color: '#059669', fontSize: '0.875rem', fontWeight: 500,
          }}
          >
            ✓ Answer recorded — click Next to continue.
          </p>
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
