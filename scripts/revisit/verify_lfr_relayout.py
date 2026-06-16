#!/usr/bin/env python3
"""Verify active LFR graph JSONs changed only in layout coordinates/metadata."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

GRAPH_ROOT = Path('public/to-link-or-not/graphs/lfr')
ALLOWED_LAYOUT_KEYS = {'type', 'algorithm', 'communitySpacing'}


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


def min_nearest_distance(nodes: list[dict[str, Any]]) -> float:
    best = float('inf')
    for i, a in enumerate(nodes):
        for b in nodes[i + 1:]:
            dx = float(a['x']) - float(b['x'])
            dy = float(a['y']) - float(b['y'])
            best = min(best, (dx * dx + dy * dy) ** 0.5)
    return best


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-ref', default='origin/main')
    parser.add_argument('--root', type=Path, default=GRAPH_ROOT)
    args = parser.parse_args()

    paths = sorted(args.root.glob('condition_[1-4]/condition_*_graph_*.json'))
    if len(paths) != 60:
        raise SystemExit(f'Expected 60 active LFR JSONs, found {len(paths)}')

    coordinate_changed = 0
    min_spacing = float('inf')
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
        min_spacing = min(min_spacing, min_nearest_distance(after.get('nodes', [])))

    print(f'Verified {len(paths)} active LFR graph JSONs')
    print(f'Coordinate sets changed: {coordinate_changed}/{len(paths)}')
    print('Non-coordinate graph data preserved, except layout algorithm metadata keys')
    print(f'Min nearest-node spacing after relayout: {min_spacing:.2f}px')


if __name__ == '__main__':
    main()
