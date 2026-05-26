#!/usr/bin/env python3
"""Convert Lancichinetti LFR benchmark output to the To Link or Not graph JSON shape."""
from __future__ import annotations

import argparse
import json
import math
import random
from collections import defaultdict
from pathlib import Path
from typing import Any

LAYOUT_WIDTH = 800
LAYOUT_HEIGHT = 560
LAYOUT_MARGIN = 44


def parse_network(path: Path) -> list[dict[str, str]]:
    edges: set[tuple[int, int]] = set()
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        u, v = int(parts[0]), int(parts[1])
        if u == v:
            continue
        a, b = sorted((u, v))
        edges.add((a, b))
    return [
        {'source': f'n{u:03d}', 'target': f'n{v:03d}'}
        for u, v in sorted(edges)
    ]


def parse_communities(path: Path) -> tuple[list[dict[str, Any]], list[list[str]], dict[str, list[str]]]:
    nodes: list[dict[str, Any]] = []
    by_community: dict[str, list[str]] = defaultdict(list)
    node_memberships: dict[str, list[str]] = {}

    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        node_num = int(parts[0])
        node_id = f'n{node_num:03d}'
        memberships = [f'c{int(part):03d}' for part in parts[1:]]
        nodes.append({'id': node_id, 'label': str(node_num)})
        node_memberships[node_id] = memberships
        for membership in memberships:
            by_community[membership].append(node_id)

    communities = [sorted(nodes) for _, nodes in sorted(by_community.items())]
    return sorted(nodes, key=lambda node: node['id']), communities, node_memberships



def build_adjacency(nodes: list[dict[str, Any]], edges: list[dict[str, str]]) -> dict[str, set[str]]:
    adjacency: dict[str, set[str]] = {node['id']: set() for node in nodes}
    for edge in edges:
        adjacency.setdefault(edge['source'], set()).add(edge['target'])
        adjacency.setdefault(edge['target'], set()).add(edge['source'])
    return adjacency


def compute_precomputed_layout(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, str]],
    communities: list[list[str]],
    seed: int,
    width: int = LAYOUT_WIDTH,
    height: int = LAYOUT_HEIGHT,
) -> None:
    """Assign deterministic, frontend-ready x/y positions to nodes.

    This intentionally avoids any browser-side force simulation. It uses a simple
    community-aware circular packing: community centers are placed around an
    ellipse, and nodes are placed on smaller rings within their primary
    community. High-degree nodes sit closer to the community center.
    """
    if not nodes:
        return

    rng = random.Random(seed)
    adjacency = build_adjacency(nodes, edges)
    node_by_id = {node['id']: node for node in nodes}
    primary_community: dict[str, int] = {}
    for community_idx, community_nodes in enumerate(communities):
        for node_id in community_nodes:
            primary_community.setdefault(node_id, community_idx)

    if not communities:
        communities = [[node['id'] for node in nodes]]
        primary_community = {node['id']: 0 for node in nodes}

    center_x = width / 2
    center_y = height / 2
    cluster_radius_x = max(1.0, (width - 2 * LAYOUT_MARGIN) * 0.34)
    cluster_radius_y = max(1.0, (height - 2 * LAYOUT_MARGIN) * 0.30)

    community_centers: list[tuple[float, float]] = []
    if len(communities) == 1:
        community_centers.append((center_x, center_y))
    else:
        for idx in range(len(communities)):
            angle = -math.pi / 2 + 2 * math.pi * idx / len(communities)
            community_centers.append((
                center_x + cluster_radius_x * math.cos(angle),
                center_y + cluster_radius_y * math.sin(angle),
            ))

    placed: set[str] = set()
    for community_idx, community_nodes in enumerate(communities):
        cx, cy = community_centers[community_idx]
        unique_nodes = sorted(
            {node_id for node_id in community_nodes if primary_community.get(node_id) == community_idx},
            key=lambda node_id: (-len(adjacency.get(node_id, set())), node_id),
        )
        if not unique_nodes:
            continue
        local_radius = min(86.0, max(34.0, 10.0 + 4.0 * math.sqrt(len(unique_nodes))))
        angle_offset = rng.random() * 2 * math.pi
        for rank, node_id in enumerate(unique_nodes):
            if node_id not in node_by_id:
                continue
            # Spiral-ish placement keeps high-degree nodes central and leaves
            # lower-degree nodes around them, with deterministic tiny jitter.
            if rank == 0:
                radius = min(20.0, local_radius * 0.25)
                angle = angle_offset
            else:
                angle = angle_offset + 2 * math.pi * (rank - 1) / max(1, len(unique_nodes) - 1)
                radius = local_radius * (0.55 + 0.45 * ((rank - 1) % 3) / 2)
            jitter_x = rng.uniform(-6, 6)
            jitter_y = rng.uniform(-6, 6)
            x = cx + radius * math.cos(angle) + jitter_x
            y = cy + radius * math.sin(angle) + jitter_y
            node_by_id[node_id]['x'] = round(min(width - LAYOUT_MARGIN, max(LAYOUT_MARGIN, x)), 2)
            node_by_id[node_id]['y'] = round(min(height - LAYOUT_MARGIN, max(LAYOUT_MARGIN, y)), 2)
            placed.add(node_id)

    # Overlapping or otherwise unplaced nodes go near the barycenter of their communities.
    for node in nodes:
        if node['id'] in placed:
            continue
        memberships = [idx for idx, comm in enumerate(communities) if node['id'] in comm]
        centers = [community_centers[idx] for idx in memberships] or [(center_x, center_y)]
        x = sum(c[0] for c in centers) / len(centers) + rng.uniform(-8, 8)
        y = sum(c[1] for c in centers) / len(centers) + rng.uniform(-8, 8)
        node['x'] = round(min(width - LAYOUT_MARGIN, max(LAYOUT_MARGIN, x)), 2)
        node['y'] = round(min(height - LAYOUT_MARGIN, max(LAYOUT_MARGIN, y)), 2)


def pick_ground_truth(nodes: list[dict[str, Any]], edges: list[dict[str, str]], communities: list[list[str]]) -> dict[str, Any]:
    degree: dict[str, int] = defaultdict(int)
    neighbors: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        source = edge['source']
        target = edge['target']
        degree[source] += 1
        degree[target] += 1
        neighbors[source].add(target)
        neighbors[target].add(source)

    hub = max((node['id'] for node in nodes), key=lambda node_id: (degree[node_id], node_id))

    # Pick a stable cross-community pair with at least one common neighbor if possible.
    node_a = nodes[0]['id'] if nodes else ''
    node_b = nodes[1]['id'] if len(nodes) > 1 else node_a
    common_neighbors: list[str] = []
    if len(communities) >= 2:
        for candidate_a in communities[0]:
            for other_comm in communities[1:]:
                for candidate_b in other_comm:
                    common = sorted(neighbors[candidate_a] & neighbors[candidate_b])
                    if common:
                        node_a, node_b, common_neighbors = candidate_a, candidate_b, common
                        break
                if common_neighbors:
                    break
            if common_neighbors:
                break

    return {
        'T1': {
            'answer': hub,
            'rationale': f'Highest-degree node in the generated graph; degree={degree[hub]}',
        },
        'T2': {
            'nodeA': node_a,
            'nodeB': node_b,
            'commonNeighbors': common_neighbors,
        },
        'T3': {
            'communities': communities,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--graph-id', required=True)
    parser.add_argument('--condition', required=True)
    parser.add_argument('--index', required=True, type=int)
    parser.add_argument('--params-json', required=True)
    parser.add_argument('--network', required=True, type=Path)
    parser.add_argument('--community', required=True, type=Path)
    parser.add_argument('--statistics', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()

    params = json.loads(args.params_json)
    edges = parse_network(args.network)
    nodes, communities, node_memberships = parse_communities(args.community)
    compute_precomputed_layout(nodes, edges, communities, int(params.get('seed', 0)))

    graph = {
        'id': args.graph_id,
        'condition': int(args.condition),
        'graphIndex': args.index,
        'generator': 'LFR unweighted_undirected benchmark',
        'generatorSource': 'https://github.com/andrealancichinetti/LFRbenchmarks',
        'layout': {
            'type': 'precomputed-community-radial',
            'width': LAYOUT_WIDTH,
            'height': LAYOUT_HEIGHT,
            'margin': LAYOUT_MARGIN,
            'seed': params.get('seed'),
        },
        'parameters': params,
        'nodes': nodes,
        'edges': edges,
        'groundTruth': pick_ground_truth(nodes, edges, communities),
        'communities': communities,
        'memberships': node_memberships,
        'statisticsFile': args.statistics.name,
        'stubLengthFraction': 0.25,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(graph, indent=2) + '\n')


if __name__ == '__main__':
    main()
