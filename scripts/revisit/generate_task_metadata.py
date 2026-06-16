#!/usr/bin/env python3
# /// script
# dependencies = ["networkx>=3.0"]
# ///
"""Generate ReVISit graph-task placeholder nodes and NetworkX ground truth CSV.

Run from repo root:
  uv run scripts/revisit/generate_task_metadata.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import networkx as nx

ROOT = Path(__file__).resolve().parents[2]
GRAPHS_ROOT = ROOT / "public" / "to-link-or-not" / "graphs" / "lfr"
OUT_CSV = ROOT / "public" / "to-link-or-not" / "metadata" / "task-ground-truth.csv"
CONDITION_TO_STRATEGY = {
    "condition_1": "traditional",
    "condition_2": "no-link",
    "condition_3": "on-demand",
    "condition_4": "stubs",
}
TASKS = ("T1", "T2", "T3")


def sorted_nodes(nodes):
    return sorted(str(node) for node in nodes)


def build_graph(data: dict) -> nx.Graph:
    graph = nx.Graph()
    graph.add_nodes_from(node["id"] for node in data["nodes"])
    graph.add_edges_from((edge["source"], edge["target"]) for edge in data["edges"])
    return graph


def node_label_by_id(data: dict) -> dict[str, str]:
    return {node["id"]: str(node.get("label", node["id"])) for node in data["nodes"]}


def choose_t1_answer(graph: nx.Graph) -> str:
    # Deterministic tie-break by node id; current generated graphs already use this semantics.
    return max(graph.nodes, key=lambda node: (graph.degree[node], node))


def choose_t3_largest_community(data: dict, graph: nx.Graph) -> tuple[int, list[str], str]:
    communities = data.get("communities") or data.get("groundTruth", {}).get("T3", {}).get("communities")
    if not communities:
        # Fallback only for non-LFR graphs. LFR study semantics use embedded communities.
        connected = [sorted_nodes(component) for component in nx.connected_components(graph)]
        communities = connected
    normalized = [sorted_nodes(community) for community in communities]
    # Largest cluster = largest embedded LFR community; tie-break by lowest member id for reproducibility.
    best_index, best_nodes = max(
        enumerate(normalized),
        key=lambda item: (len(item[1]), tuple(reversed([node for node in item[1]]))),
    )
    # Placeholder/seed shown for metadata review: most connected node within the target cluster.
    placeholder = max(best_nodes, key=lambda node: (graph.degree[node], node))
    return best_index, best_nodes, placeholder


def verify_existing_ground_truth(data: dict, graph: nx.Graph, dataset: str) -> None:
    ground_truth = data.get("groundTruth", {})
    if ground_truth.get("T1", {}).get("answer") != choose_t1_answer(graph):
        raise ValueError(f"{dataset}: embedded T1 answer differs from NetworkX degree computation")

    t2 = ground_truth.get("T2", {})
    node_a = t2.get("nodeA")
    node_b = t2.get("nodeB")
    if node_a and node_b:
        expected = sorted_nodes(nx.common_neighbors(graph, node_a, node_b))
        embedded = sorted_nodes(t2.get("commonNeighbors", []))
        if embedded != expected:
            raise ValueError(f"{dataset}: embedded T2 common neighbors differ from NetworkX computation")


def rows_for_graph(path: Path) -> list[dict[str, str]]:
    data = json.loads(path.read_text())
    graph = build_graph(data)
    labels = node_label_by_id(data)
    dataset = data.get("id", path.stem)
    condition_dir = path.parent.name
    strategy = CONDITION_TO_STRATEGY.get(condition_dir, condition_dir)
    rel_path = path.relative_to(ROOT / "public").as_posix()

    verify_existing_ground_truth(data, graph, dataset)

    t1_answer = choose_t1_answer(graph)
    t2 = data["groundTruth"]["T2"]
    t2_common = sorted_nodes(nx.common_neighbors(graph, t2["nodeA"], t2["nodeB"]))
    t3_index, t3_nodes, t3_placeholder = choose_t3_largest_community(data, graph)
    # Persist exact T3 target semantics into the graph JSON so runtime scoring,
    # exported answers, and the metadata CSV all agree.
    data.setdefault("groundTruth", {}).setdefault("T3", {})["targetCommunityIndex"] = t3_index
    data["groundTruth"]["T3"]["targetCommunity"] = t3_nodes
    data["groundTruth"]["T3"]["placeholderNode"] = t3_placeholder
    path.write_text(json.dumps(data, indent=2) + "\n")

    base = {
        "dataset": dataset,
        "condition_dir": condition_dir,
        "strategy": strategy,
        "graph_path": rel_path,
    }
    return [
        {
            **base,
            "task": "T1",
            "correct_answer": t1_answer,
            "correct_answer_label": labels[t1_answer],
            "placeholder_node": t1_answer,
            "placeholder_node_label": labels[t1_answer],
            "placeholder_node_a": "",
            "placeholder_node_b": "",
            "target_community_index": "",
            "correct_answer_count": "1",
            "computation": "NetworkX degree; max degree with highest node-id tie break",
        },
        {
            **base,
            "task": "T2",
            "correct_answer": ";".join(t2_common),
            "correct_answer_label": ";".join(labels[node] for node in t2_common),
            "placeholder_node": "",
            "placeholder_node_label": "",
            "placeholder_node_a": t2["nodeA"],
            "placeholder_node_b": t2["nodeB"],
            "target_community_index": "",
            "correct_answer_count": str(len(t2_common)),
            "computation": "NetworkX common_neighbors(anchor A, anchor B)",
        },
        {
            **base,
            "task": "T3",
            "correct_answer": ";".join(t3_nodes),
            "correct_answer_label": ";".join(labels[node] for node in t3_nodes),
            "placeholder_node": t3_placeholder,
            "placeholder_node_label": labels[t3_placeholder],
            "placeholder_node_a": "",
            "placeholder_node_b": "",
            "target_community_index": str(t3_index),
            "correct_answer_count": str(len(t3_nodes)),
            "computation": "largest embedded LFR community; placeholder is max-degree node inside it with highest node-id tie break",
        },
    ]


def main() -> None:
    graph_files = sorted(GRAPHS_ROOT.glob("condition_*/*.json"))
    if len(graph_files) != 60:
        raise SystemExit(f"Expected 60 LFR graph JSON files, found {len(graph_files)}")
    rows = []
    for graph_file in graph_files:
        rows.extend(rows_for_graph(graph_file))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "dataset", "condition_dir", "strategy", "graph_path", "task", "correct_answer",
        "correct_answer_label", "placeholder_node", "placeholder_node_label", "placeholder_node_a",
        "placeholder_node_b", "target_community_index", "correct_answer_count", "computation",
    ]
    with OUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUT_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
