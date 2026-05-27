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

    This intentionally avoids browser-side force simulation. It uses the
    approved static "force-organic" layout: deterministic soft community-cloud
    initialization, edge springs, node repulsion, and weak community gravity.
    The community target radius is set slightly wider than the accepted
    candidate-B preview so clusters get a tad more breathing room without
    returning to visibly separated community-radial blobs.
    """
    if not nodes:
        return

    rng = random.Random(seed)
    adjacency = build_adjacency(nodes, edges)
    node_by_id = {node['id']: node for node in nodes}
    node_ids = [node['id'] for node in nodes]

    primary_community: dict[str, int] = {}
    for community_idx, community_nodes in enumerate(communities):
        for node_id in community_nodes:
            primary_community.setdefault(node_id, community_idx)

    if not communities:
        communities = [[node['id'] for node in nodes]]
        primary_community = {node['id']: 0 for node in nodes}

    center_x = width / 2
    center_y = height / 2
    drawable_width = width - 2 * LAYOUT_MARGIN
    drawable_height = height - 2 * LAYOUT_MARGIN
    community_count = max(1, len(communities))

    def community_targets(radius_x: float, radius_y: float) -> list[tuple[float, float]]:
        if community_count == 1:
            return [(center_x, center_y)]
        targets: list[tuple[float, float]] = []
        for idx in range(community_count):
            angle = -math.pi / 2 + 2 * math.pi * idx / community_count
            targets.append((
                center_x + radius_x * math.cos(angle),
                center_y + radius_y * math.sin(angle),
            ))
        return targets

    # Candidate-B used 0.16/0.14 here; 0.19/0.17 is the approved "tad more
    # spacing" between community regions while preserving an organic layout.
    community_centers = community_targets(drawable_width * 0.19, drawable_height * 0.17)

    positions: dict[str, list[float]] = {}
    velocities: dict[str, list[float]] = {node_id: [0.0, 0.0] for node_id in node_ids}

    # Deterministic sunflower-cloud initialization keeps related nodes near one
    # another before the force settling step, but avoids the old tight rings.
    placed: set[str] = set()
    for community_idx, community_nodes in enumerate(communities):
        cx, cy = community_centers[community_idx]
        unique_nodes = sorted(
            {node_id for node_id in community_nodes if primary_community.get(node_id) == community_idx},
            key=lambda node_id: (-len(adjacency.get(node_id, set())), node_id),
        )
        local_radius = max(82.0, min(128.0, 42.0 + 7.0 * math.sqrt(len(unique_nodes))))
        angle_offset = rng.random() * 2 * math.pi
        for rank, node_id in enumerate(unique_nodes):
            angle = angle_offset + rank * 2.399963229728653  # golden angle
            radius = local_radius * math.sqrt((rank + 0.5) / max(1, len(unique_nodes)))
            x = cx + radius * math.cos(angle) + rng.uniform(-10, 10)
            y = cy + radius * math.sin(angle) + rng.uniform(-10, 10)
            positions[node_id] = [
                min(width - LAYOUT_MARGIN, max(LAYOUT_MARGIN, x)),
                min(height - LAYOUT_MARGIN, max(LAYOUT_MARGIN, y)),
            ]
            placed.add(node_id)

    for node_id in node_ids:
        if node_id in placed:
            continue
        community_idx = primary_community.get(node_id, 0) % community_count
        cx, cy = community_centers[community_idx]
        positions[node_id] = [cx + rng.uniform(-24, 24), cy + rng.uniform(-24, 24)]

    edge_pairs = [(edge['source'], edge['target']) for edge in edges]

    for step in range(460):
        forces: dict[str, list[float]] = {node_id: [0.0, 0.0] for node_id in node_ids}

        # O(n^2) is acceptable for the fixed 120-node study graphs.
        for a_idx, node_a in enumerate(node_ids):
            ax, ay = positions[node_a]
            for node_b in node_ids[a_idx + 1:]:
                bx, by = positions[node_b]
                dx = ax - bx
                dy = ay - by
                distance_sq = max(25.0, dx * dx + dy * dy)
                distance = math.sqrt(distance_sq)
                force = 1250.0 / distance_sq
                fx = force * dx / distance
                fy = force * dy / distance
                forces[node_a][0] += fx
                forces[node_a][1] += fy
                forces[node_b][0] -= fx
                forces[node_b][1] -= fy

        for source, target in edge_pairs:
            sx, sy = positions[source]
            tx, ty = positions[target]
            dx = tx - sx
            dy = ty - sy
            distance = max(1.0, math.hypot(dx, dy))
            same_community = primary_community.get(source) == primary_community.get(target)
            desired = 44.0 if same_community else 80.0
            force = 0.020 * (distance - desired)
            fx = force * dx / distance
            fy = force * dy / distance
            forces[source][0] += fx
            forces[source][1] += fy
            forces[target][0] -= fx
            forces[target][1] -= fy

        for node_id in node_ids:
            x, y = positions[node_id]
            community_idx = primary_community.get(node_id, 0) % community_count
            tx, ty = community_centers[community_idx]
            # Weak community gravity plus canvas centering; this is what keeps
            # the layout organic rather than separated into radial islands.
            forces[node_id][0] += 0.010 * (tx - x) + 0.006 * (center_x - x)
            forces[node_id][1] += 0.010 * (ty - y) + 0.006 * (center_y - y)

        temperature = max(0.15, 1.0 - step / 460)
        for node_id in node_ids:
            velocities[node_id][0] = (velocities[node_id][0] + forces[node_id][0]) * 0.78
            velocities[node_id][1] = (velocities[node_id][1] + forces[node_id][1]) * 0.78
            positions[node_id][0] = min(
                width - LAYOUT_MARGIN,
                max(LAYOUT_MARGIN, positions[node_id][0] + velocities[node_id][0] * temperature),
            )
            positions[node_id][1] = min(
                height - LAYOUT_MARGIN,
                max(LAYOUT_MARGIN, positions[node_id][1] + velocities[node_id][1] * temperature),
            )

    for node_id, (x, y) in positions.items():
        node_by_id[node_id]['x'] = round(x, 2)
        node_by_id[node_id]['y'] = round(y, 2)

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
            'type': 'precomputed-force-organic-weak-community',
            'width': LAYOUT_WIDTH,
            'height': LAYOUT_HEIGHT,
            'margin': LAYOUT_MARGIN,
            'seed': params.get('seed'),
            'algorithm': 'static force-organic with weak community gravity',
            'communitySpacing': 'candidate-b-plus-approx-18-percent',
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
