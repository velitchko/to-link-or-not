#!/usr/bin/env python3
"""Create a per-graph/per-condition task ground-truth JSON file.

Examples:
  python3 generator/scripts/save-task-ground-truth.py \
    --graph generator/data/condition_1/condition_1_graph_01.json \
    --condition traditional --task T1

  python3 generator/scripts/save-task-ground-truth.py \
    --graph generator/data/condition_1/condition_1_graph_01.json \
    --condition traditional --task T2 --node-a n001 --node-b n057

  python3 generator/scripts/save-task-ground-truth.py \
    --graph generator/data/condition_1/condition_1_graph_01.json \
    --condition traditional --task T3 --anchor-node n042

  python3 generator/scripts/save-task-ground-truth.py \
    --graph generator/data/condition_1/condition_1_graph_01.json \
    --condition traditional --task T3 --community-index 2
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

VALID_TASKS = {'T1', 'T2', 'T3'}
VALID_CONDITIONS = {'traditional', 'no-link', 'on-demand', 'stubs'}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def normalize_nodes(nodes: list[str]) -> list[str]:
    return sorted(dict.fromkeys(nodes))


def build_neighbors(edges: list[dict[str, str]]) -> dict[str, set[str]]:
    neighbors: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        source = edge['source']
        target = edge['target']
        neighbors[source].add(target)
        neighbors[target].add(source)
    return neighbors


def node_ids(graph: dict[str, Any]) -> set[str]:
    return {node['id'] for node in graph.get('nodes', [])}


def communities(graph: dict[str, Any]) -> list[list[str]]:
    gt_communities = graph.get('groundTruth', {}).get('T3', {}).get('communities')
    return gt_communities or graph.get('communities') or []


def community_for_anchor(graph: dict[str, Any], anchor_node: str) -> tuple[int, list[str]]:
    matches = [
        (idx, normalize_nodes(community))
        for idx, community in enumerate(communities(graph))
        if anchor_node in community
    ]
    if not matches:
        raise SystemExit(f'Anchor node {anchor_node!r} is not present in any community.')
    # For overlapping community graphs, choose the smallest matching community for a tighter target.
    return min(matches, key=lambda item: (len(item[1]), item[0]))


def community_by_index(graph: dict[str, Any], community_index: int) -> tuple[int, list[str]]:
    all_communities = communities(graph)
    if community_index < 0 or community_index >= len(all_communities):
        raise SystemExit(
            f'community-index {community_index} out of range; graph has {len(all_communities)} communities.'
        )
    return community_index, normalize_nodes(all_communities[community_index])


def derive_t1(graph: dict[str, Any]) -> dict[str, Any]:
    nodes = node_ids(graph)
    neighbors = build_neighbors(graph.get('edges', []))
    if not nodes:
        raise SystemExit('Graph contains no nodes.')
    answer = max(nodes, key=lambda node_id: (len(neighbors[node_id]), node_id))
    return {
        'answerType': 'single-node',
        'answer': answer,
        'expectedNodes': [answer],
        'scoring': ['exact'],
        'rationale': f'Highest-degree node; degree={len(neighbors[answer])}',
    }


def derive_t2(graph: dict[str, Any], node_a: str | None, node_b: str | None) -> dict[str, Any]:
    nodes = node_ids(graph)
    graph_gt = graph.get('groundTruth', {}).get('T2', {})
    anchor_a = node_a or graph_gt.get('nodeA')
    anchor_b = node_b or graph_gt.get('nodeB')
    if not anchor_a or not anchor_b:
        raise SystemExit('T2 requires --node-a/--node-b or existing graph.groundTruth.T2 anchors.')
    missing = [node for node in [anchor_a, anchor_b] if node not in nodes]
    if missing:
        raise SystemExit(f'T2 anchor node(s) not in graph: {missing}')
    neighbors = build_neighbors(graph.get('edges', []))
    common = normalize_nodes(list(neighbors[anchor_a] & neighbors[anchor_b]))
    return {
        'answerType': 'node-set',
        'anchors': {'nodeA': anchor_a, 'nodeB': anchor_b},
        'expectedNodes': common,
        'scoring': ['exact', 'precision', 'recall', 'f1', 'jaccard'],
        'rationale': 'Common neighbors of the two anchor nodes in the generated graph.',
    }


def derive_t3(graph: dict[str, Any], anchor_node: str | None, community_index: int | None) -> dict[str, Any]:
    if anchor_node is None and community_index is None:
        raise SystemExit('T3 requires --anchor-node or --community-index so the target community is explicit.')
    if anchor_node is not None and anchor_node not in node_ids(graph):
        raise SystemExit(f'T3 anchor node {anchor_node!r} is not in the graph.')
    if community_index is not None:
        selected_index, expected = community_by_index(graph, community_index)
    else:
        selected_index, expected = community_for_anchor(graph, anchor_node or '')
    return {
        'answerType': 'node-set',
        'anchorNode': anchor_node,
        'communityIndex': selected_index,
        'expectedNodes': expected,
        'scoring': ['exact', 'precision', 'recall', 'f1', 'jaccard'],
        'rationale': 'Nodes in the selected LFR planted community.',
    }


def default_out_path(graph: dict[str, Any], condition: str, task: str) -> Path:
    graph_id = graph.get('id')
    if not graph_id:
        raise SystemExit('Graph JSON has no id.')
    graph_path = Path(graph.get('_graphFile', ''))
    if 'generator' in graph_path.parts and 'data' in graph_path.parts:
        data_idx = graph_path.parts.index('data')
        if len(graph_path.parts) > data_idx + 1:
            condition_dir = graph_path.parts[data_idx + 1]
            return Path('generator/data') / condition_dir / 'ground-truth' / f'{graph_id}-{task}.json'
    return Path('generator/data') / condition / 'ground-truth' / f'{graph_id}-{task}.json'


def main() -> None:
    parser = argparse.ArgumentParser(description='Save task ground truth for one graph/condition/task.')
    parser.add_argument('--graph', required=True, type=Path, help='Path to graph JSON.')
    parser.add_argument('--condition', required=True, choices=sorted(VALID_CONDITIONS))
    parser.add_argument('--task', required=True, choices=sorted(VALID_TASKS))
    parser.add_argument('--node-a', help='T2 first anchor node id.')
    parser.add_argument('--node-b', help='T2 second anchor node id.')
    parser.add_argument('--anchor-node', help='T3 node whose planted community is the target.')
    parser.add_argument('--community-index', type=int, help='T3 zero-based planted community index.')
    parser.add_argument('--out', type=Path, help='Output JSON path. Defaults under public/to-link-or-not/ground-truth/.')
    args = parser.parse_args()

    graph = load_json(args.graph)
    graph['_graphFile'] = str(args.graph)
    graph_id = graph.get('id')
    if not graph_id:
        raise SystemExit('Graph JSON has no id.')

    if args.task == 'T1':
        answer_key = derive_t1(graph)
    elif args.task == 'T2':
        answer_key = derive_t2(graph, args.node_a, args.node_b)
    else:
        answer_key = derive_t3(graph, args.anchor_node, args.community_index)

    payload = {
        'schemaVersion': 1,
        'graphId': graph_id,
        'graphFile': str(args.graph),
        'condition': args.condition,
        'task': args.task,
        'answerKey': answer_key,
        'generator': graph.get('generator'),
        'parameters': graph.get('parameters'),
    }

    out_path = args.out or default_out_path(graph, args.condition, args.task)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + '\n')
    print(f'Written: {out_path}')


if __name__ == '__main__':
    main()
