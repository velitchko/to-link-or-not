import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type MutableRefObject,
} from 'react';
import * as d3 from 'd3';
import { PositionedNode, InteractionMode } from '../types';

export function getNodesInPolygon(
  polygon: [number, number][],
  nodes: PositionedNode[],
  transform: d3.ZoomTransform,
): string[] {
  if (polygon.length < 3) return [];
  return nodes
    .filter((node) => {
      const [sx, sy] = transform.apply([node.x, node.y]);
      return d3.polygonContains(polygon, [sx, sy]);
    })
    .map((node) => node.id);
}

export interface LassoResult {
  lassoPolygon: [number, number][] | null;
  isLassoing: boolean;
}

export function useLasso(
  svgRef: RefObject<SVGSVGElement | null>,
  transformRef: MutableRefObject<d3.ZoomTransform>,
  nodes: PositionedNode[],
  mode: InteractionMode,
  onLassoComplete: (nodeIds: string[], additive: boolean) => void,
): LassoResult {
  const [lassoPolygon, setLassoPolygon] = useState<[number, number][] | null>(null);
  const [isLassoing, setIsLassoing] = useState(false);
  const polygonRef = useRef<[number, number][]>([]);
  const activeRef = useRef(false);
  // Refs so event handlers always see the latest values without re-subscribing
  const modeRef = useRef(mode);
  const nodesRef = useRef(nodes);
  const onCompleteRef = useRef(onLassoComplete);

  modeRef.current = mode;
  nodesRef.current = nodes;
  onCompleteRef.current = onLassoComplete;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return () => {};

    function onMouseDown(event: MouseEvent) {
      if (modeRef.current !== 'lasso') return;
      event.preventDefault();
      const [x, y] = d3.pointer(event, svg as SVGSVGElement);
      activeRef.current = true;
      polygonRef.current = [[x, y]];
      setIsLassoing(true);
      setLassoPolygon([[x, y]]);
    }

    function onMouseMove(event: MouseEvent) {
      if (!activeRef.current) return;
      const [x, y] = d3.pointer(event, svg as SVGSVGElement);
      polygonRef.current.push([x, y]);
      setLassoPolygon([...polygonRef.current]);
    }

    function onMouseUp(event: MouseEvent) {
      if (!activeRef.current) return;
      activeRef.current = false;
      setIsLassoing(false);
      setLassoPolygon(null);
      const matched = getNodesInPolygon(
        polygonRef.current,
        nodesRef.current,
        transformRef.current,
      );
      const additive = event.ctrlKey || event.metaKey;
      onCompleteRef.current(matched, additive);
      polygonRef.current = [];
    }

    svg.addEventListener('mousedown', onMouseDown);
    svg.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      svg.removeEventListener('mousedown', onMouseDown);
      svg.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [svgRef, transformRef]);

  return { lassoPolygon, isLassoing };
}
