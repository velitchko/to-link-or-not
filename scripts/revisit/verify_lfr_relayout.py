#!/usr/bin/env python3
"""Verify active LFR graph JSONs changed only in layout coordinates/metadata."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

GRAPH_ROOT = Path('public/to-link-or-not/graphs/lfr')
ALLOWED_LAYOUT_KEYS = {'type', 'algorithm', 'communitySpacing', 'margin'}


def load_head(path: Path, ref: str) -> dict[str, Any]:
    data = subprocess.check_output(['git', 'show', f'{ref}:{path.as_posix()}'])
    return json.loads(data)


def strip_allowed(graph: dict[str, Any]) -> dict[str, Any]:
    clone = json.loads(json.dumps(graph))
    for node in clone.get('nodes', []):
        node.pop('x', None)
        node.pop('y', None)
    layout = clone.get('layout')
    if isinstance(layout, dict):
        for key in ALLOWED_LAYOUT_KEYS:
            layout.pop(key, None)
    return clone


def nearest_distances(nodes: list[dict[str, Any]]) -> list[float]:
    distances: list[float] = []
    for i, a in enumerate(nodes):
        best = float('inf')
        for j, b in enumerate(nodes):
            if i == j:
                continue
            dx = float(a['x']) - float(b['x'])
            dy = float(a['y']) - float(b['y'])
            best = min(best, (dx * dx + dy * dy) ** 0.5)
        distances.append(best)
    return distances


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * pct)))
    return ordered[idx]


def community_centroids(graph: dict[str, Any]) -> list[tuple[float, float, float]]:
    nodes = {node['id']: node for node in graph.get('nodes', [])}
    centroids: list[tuple[float, float, float]] = []
    for community in graph.get('communities', []):
        xs = [float(nodes[node_id]['x']) for node_id in community if node_id in nodes]
        ys = [float(nodes[node_id]['y']) for node_id in community if node_id in nodes]
        if not xs:
            continue
        cx = mean(xs)
        cy = mean(ys)
        radius = mean([((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 for x, y in zip(xs, ys)])
        centroids.append((cx, cy, radius))
    return centroids


def centroid_metrics(graph: dict[str, Any]) -> tuple[float, float]:
    centroids = community_centroids(graph)
    min_separation = float('inf')
    min_gap_ratio = float('inf')
    for i, (ax, ay, ar) in enumerate(centroids):
        for bx, by, br in centroids[i + 1:]:
            distance = ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5
            min_separation = min(min_separation, distance)
            min_gap_ratio = min(min_gap_ratio, distance / max(1.0, ar + br))
    return (0.0 if min_separation == float('inf') else min_separation,
            0.0 if min_gap_ratio == float('inf') else min_gap_ratio)


def collision_count(nodes: list[dict[str, Any]], threshold: float = 18.0) -> int:
    count = 0
    for i, a in enumerate(nodes):
        for b in nodes[i + 1:]:
            dx = float(a['x']) - float(b['x'])
            dy = float(a['y']) - float(b['y'])
            if (dx * dx + dy * dy) ** 0.5 < threshold:
                count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-ref', default='origin/main')
    parser.add_argument('--root', type=Path, default=GRAPH_ROOT)
    args = parser.parse_args()

    paths = sorted(args.root.glob('condition_[1-4]/condition_*_graph_*.json'))
    if len(paths) != 60:
        raise SystemExit(f'Expected 60 active LFR JSONs, found {len(paths)}')

    coordinate_changed = 0
    all_nearest: list[float] = []
    min_centroid_separation = float('inf')
    min_centroid_gap_ratio = float('inf')
    total_collisions = 0
    for path in paths:
        before = load_head(path, args.base_ref)
        after = json.loads(path.read_text())
        if strip_allowed(before) != strip_allowed(after):
            raise SystemExit(f'Non-coordinate data changed in {path}')

        before_xy = [(node.get('x'), node.get('y')) for node in before.get('nodes', [])]
        after_xy = [(node.get('x'), node.get('y')) for node in after.get('nodes', [])]
        coordinate_changed += int(before_xy != after_xy)

        for node in after.get('nodes', []):
            x, y = node.get('x'), node.get('y')
            if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                raise SystemExit(f'Missing coordinate in {path}: {node.get("id")}')
            layout = after.get('layout', {})
            margin = layout.get('margin', 44)
            width = layout.get('width', 800)
            height = layout.get('height', 560)
            if not (margin <= x <= width - margin and margin <= y <= height - margin):
                raise SystemExit(f'Out-of-bounds coordinate in {path}: {node.get("id")} ({x}, {y})')
        nodes = after.get('nodes', [])
        all_nearest.extend(nearest_distances(nodes))
        centroid_separation, centroid_gap_ratio = centroid_metrics(after)
        min_centroid_separation = min(min_centroid_separation, centroid_separation)
        min_centroid_gap_ratio = min(min_centroid_gap_ratio, centroid_gap_ratio)
        total_collisions += collision_count(nodes)

    print(f'Verified {len(paths)} active LFR graph JSONs')
    print(f'Coordinate sets changed: {coordinate_changed}/{len(paths)}')
    print('Non-coordinate graph data preserved, except layout algorithm metadata keys')
    print(f'Nearest-neighbor spacing: min={min(all_nearest):.2f}px, p10={percentile(all_nearest, 0.10):.2f}px, mean={mean(all_nearest):.2f}px')
    print(f'Community centroid separation: min={min_centroid_separation:.2f}px, min centroid-gap ratio={min_centroid_gap_ratio:.2f}')
    print(f'Node collision proxy: pairs closer than 18px across all graphs={total_collisions}')


if __name__ == '__main__':
    main()
