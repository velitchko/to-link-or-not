#!/usr/bin/env python3
"""Regenerate only precomputed x/y coordinates for active LFR ReVISit graph JSONs."""
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lfr'))
from lfr_to_revisit_graph import LAYOUT_HEIGHT, LAYOUT_MARGIN, LAYOUT_WIDTH, compute_precomputed_layout  # noqa: E402

GRAPH_ROOT = Path('public/to-link-or-not/graphs/lfr')
LAYOUT_METADATA = {
    'type': 'precomputed-force-organic-community-v4',
    'width': LAYOUT_WIDTH,
    'height': LAYOUT_HEIGHT,
    'margin': LAYOUT_MARGIN,
    'algorithm': 'static force-organic with moderate community separation and collision spacing',
    'communitySpacing': 'community-v4-expanded-readable-organic',
}


def strip_coordinates(graph: dict[str, Any]) -> dict[str, Any]:
    clone = deepcopy(graph)
    for node in clone.get('nodes', []):
        node.pop('x', None)
        node.pop('y', None)
    layout = clone.get('layout')
    if isinstance(layout, dict):
        for key in ('type', 'algorithm', 'communitySpacing', 'margin'):
            layout.pop(key, None)
    return clone


def relayout_graph(path: Path, *, check_only: bool) -> tuple[bool, str]:
    before = json.loads(path.read_text())
    graph = deepcopy(before)
    seed = int(graph.get('layout', {}).get('seed') or graph.get('parameters', {}).get('seed') or 0)

    nodes = graph['nodes']
    edges = graph['edges']
    communities = graph.get('communities') or graph.get('groundTruth', {}).get('T3', {}).get('communities') or []
    compute_precomputed_layout(nodes, edges, communities, seed)
    graph['layout'] = {**graph.get('layout', {}), **LAYOUT_METADATA, 'seed': graph.get('layout', {}).get('seed') or graph.get('parameters', {}).get('seed')}

    if strip_coordinates(before) != strip_coordinates(graph):
        return False, f'{path}: non-coordinate data changed'

    missing = [node.get('id', '<unknown>') for node in graph.get('nodes', []) if not isinstance(node.get('x'), (int, float)) or not isinstance(node.get('y'), (int, float))]
    if missing:
        return False, f'{path}: missing coordinates for {len(missing)} nodes'

    changed = before != graph
    if changed and not check_only:
        path.write_text(json.dumps(graph, indent=2) + '\n')
    return changed, f'{path}: {"would update" if check_only and changed else "updated" if changed else "unchanged"}'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=GRAPH_ROOT)
    parser.add_argument('--check', action='store_true', help='verify deterministic output without writing')
    args = parser.parse_args()

    paths = sorted(args.root.glob('condition_[1-4]/condition_*_graph_*.json'))
    if len(paths) != 60:
        raise SystemExit(f'Expected 60 active LFR JSONs, found {len(paths)} under {args.root}')

    changed_count = 0
    for path in paths:
        changed, message = relayout_graph(path, check_only=args.check)
        if message.endswith('data changed') or 'missing coordinates' in message:
            raise SystemExit(message)
        changed_count += int(changed)

    mode = 'would update' if args.check else 'updated'
    print(f'{mode} {changed_count} of {len(paths)} active LFR graphs; non-coordinate data preserved')


if __name__ == '__main__':
    main()
