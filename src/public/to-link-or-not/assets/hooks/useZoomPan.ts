import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

export interface ZoomPanResult {
  contentRef: React.RefObject<SVGGElement | null>;
  transformRef: React.MutableRefObject<d3.ZoomTransform>;
  resetZoom: () => void;
}

export function useZoomPan(
  svgRef: React.RefObject<SVGSVGElement | null>,
  panEnabled: boolean,
): ZoomPanResult {
  const contentRef = useRef<SVGGElement | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Use a ref so the filter closure always reads the latest value without re-attaching zoom
  const panEnabledRef = useRef(panEnabled);
  panEnabledRef.current = panEnabled;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return () => {};

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .filter((event: Event) => {
        // Scroll wheel and double-click always zoom regardless of mode
        if (event.type === 'wheel' || event.type === 'dblclick') return true;
        // Drag only pans when pan mode is active
        return panEnabledRef.current && (event as MouseEvent).button === 0;
      })
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform;
        if (contentRef.current) {
          d3.select(contentRef.current).attr('transform', event.transform.toString());
        }
      });

    zoomRef.current = zoom;
    d3.select(svg).call(zoom);

    return () => {
      d3.select(svg).on('.zoom', null);
    };
  }, [svgRef]);

  const resetZoom = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    d3.select(svg).call(zoom.transform, d3.zoomIdentity);
  }, [svgRef]);

  return { contentRef, transformRef, resetZoom };
}
