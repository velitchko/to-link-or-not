#!/usr/bin/env python3
"""Convert Lancichinetti LFR benchmark output to the To Link or Not graph JSON shape."""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


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


def parse_communities(path: Path) -> tuple[list[dict[str, str]], list[list[str]], dict[str, list[str]]]:
    nodes: list[dict[str, str]] = []
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


def pick_ground_truth(nodes: list[dict[str, str]], edges: list[dict[str, str]], communities: list[list[str]]) -> dict[str, Any]:
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

    graph = {
        'id': args.graph_id,
        'condition': int(args.condition),
        'graphIndex': args.index,
        'generator': 'LFR unweighted_undirected benchmark',
        'generatorSource': 'https://github.com/andrealancichinetti/LFRbenchmarks',
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
