# Network Diagram Interactions Design

**Date:** 2026-05-13
**Status:** Approved

## Overview

Add zoom/pan, single-click select, multi-click select, and lasso selection to `NodeLinkDiagram`. All interaction modes are available to participants on all tasks (T1, T2, T3). Participants choose how they interact via a control strip.

## UI Layout

A control strip is inserted between the task prompt bar and the SVG graph area. It contains:

- **Mode buttons** (segmented toggle): Select | Lasso | Pan
- **Divider**
- **Reset Zoom** button — restores the D3 zoom transform to identity
- **Reset Selection** button — clears `selectedNodes`
- **Ctrl hint** (right-aligned, amber badge): `Ctrl + lasso adds to selection` — visible at all times, dimmed when not in Lasso mode

Scroll-to-zoom is active in all modes. No mode switch is required to zoom.

The SVG dimensions remain 800×560. No layout changes to the task prompt bar or the bottom submit bar.

## Architecture

### New hooks

**`useZoomPan(svgRef: RefObject<SVGSVGElement>)`**
- Attaches `d3.zoom` to the SVG element on mount; detaches on unmount.
- Wraps all SVG content in a `<g ref={contentRef}>` and applies the zoom transform to it.
- Exposes:
  - `transform: d3.ZoomTransform` — current zoom/pan state (used by `useLasso` for coordinate conversion)
  - `resetZoom(): void` — calls `zoom.transform(svg, d3.zoomIdentity)`
- Zoom extent: scale [0.5, 4]; translate extent unconstrained.
- Pan is only active when active mode is `'pan'`; zoom (scroll) is always active. The hook accepts a `panEnabled: boolean` prop and sets the drag filter accordingly (`event.button === 0 && panEnabled`).

**`useLasso(svgRef, transform, positionedNodes, mode, ctrlRef)`**
- Listens to `mousedown` / `mousemove` / `mouseup` on the SVG element.
- Active only when `mode === 'lasso'`; no-ops otherwise.
- On `mousedown`: begins accumulating pointer positions (in screen space) into a polygon.
- On `mousemove`: updates the live polygon path (rendered as an SVG `<polygon>` overlay inside the content `<g>`).
- On `mouseup`: runs hit-test — for each `PositionedNode`, applies `transform.invert([px, py])` to convert screen-space polygon points to graph space, then tests with `d3.polygonContains`. Returns the matched node ids.
- Exposes:
  - `lassoPolygon: [number, number][] | null` — live polygon points during drag (null when not lassoing)
  - `isLassoing: boolean`
  - `onLassoComplete: (nodeIds: string[], additive: boolean) => void` — callback invoked on `mouseup`; `additive` is `true` if Ctrl was held.
- Polygon visual: `fill="rgba(79,70,229,0.08)"`, `stroke="#4f46e5"`, `strokeWidth=1.5`, `strokeDasharray="5,3"`.

### New component

**`InteractionStrip`**
Props: `mode`, `onModeChange`, `onResetZoom`, `onResetSelection`

Renders the control strip. Mode buttons use an indigo active style (`background:#ede9fe`, `border:#4f46e5`, `color:#4f46e5`); inactive buttons are white with a light border. The Ctrl hint badge is `opacity:1` when `mode === 'lasso'`, `opacity:0.4` otherwise.

### Modified component

**`NodeLinkDiagram`**
- Adds `mode` state: `'select' | 'lasso' | 'pan'`, defaulting to `'select'`.
- Adds `svgRef` and passes it to both `useZoomPan` and `useLasso`.
- Wraps all existing SVG content (`<EdgeRenderer>` + node `<g>`) in the content `<g>` managed by `useZoomPan`.
- Renders the `<InteractionStrip>` between the prompt bar and the SVG.
- On lasso complete: if `additive`, merges new ids into `selectedNodes`; otherwise replaces.
- `handleNodeClick` is only active when `mode === 'select'`.
- Node `cursor` style: `pointer` in Select mode, `crosshair` in Lasso mode, `grab`/`grabbing` in Pan mode.
- Existing answer recording, `handleSubmit`, and all `EdgeRenderer` components are unchanged.

## Data Flow

```
useZoomPan  →  transform (ZoomTransform)  →  useLasso (coordinate inversion)
                                           →  NodeLinkDiagram (applied to content <g>)

useLasso  →  lassoPolygon  →  SVG polygon overlay (live feedback)
          →  onLassoComplete(ids, additive)  →  NodeLinkDiagram updates selectedNodes

InteractionStrip  →  mode, onResetZoom, onResetSelection  →  NodeLinkDiagram
```

## Interaction Rules by Mode

| Action | Select | Lasso | Pan |
|---|---|---|---|
| Click node | Select / deselect | No-op | No-op |
| Click background | No-op | No-op | No-op |
| Drag background | No-op | Draw lasso | Pan view |
| Drag node | No-op | Draw lasso (layout fixed) | Pan view |
| Scroll wheel | Zoom | Zoom | Zoom |
| Ctrl + drag | — | Add to selection | — |

## Coordinate Space

Node positions from `useForceLayout` are in graph space (0–800, 0–560). After zoom/pan, screen positions differ. `useLasso` accumulates polygon points in screen space. For hit-testing, it converts each node's graph-space position to screen space via `transform.apply([node.x, node.y])`, then tests against the screen-space polygon with `d3.polygonContains`. This avoids inverting the polygon (cheaper and equivalent).

## Files Changed

| File | Change |
|---|---|
| `src/public/to-link-or-not/assets/NodeLinkDiagram.tsx` | Add mode state, svgRef, compose new hooks and strip |
| `src/public/to-link-or-not/assets/hooks/useZoomPan.ts` | New |
| `src/public/to-link-or-not/assets/hooks/useLasso.ts` | New |
| `src/public/to-link-or-not/assets/InteractionStrip.tsx` | New |
| `src/public/to-link-or-not/assets/__tests__/NodeLinkDiagram.test.tsx` | Update for new controls |

## Out of Scope

- Node repositioning / draggable nodes
- Undo/redo of selection
- Keyboard shortcuts beyond Ctrl+lasso
- Touch / mobile support
