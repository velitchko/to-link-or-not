#!/usr/bin/env python3
# /// script
# dependencies = ["networkx>=3.0"]
# ///
"""Generate ReVISit graph-task ground truth metadata.

Run from repo root:
  uv run scripts/revisit/generate_task_metadata.py
  uv run scripts/revisit/generate_task_metadata.py --check
"""
from __future__ import annotations

import argparse
import csv
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import networkx as nx

ROOT = Path(__file__).resolve().parents[2]
STUDY_PUBLIC_ROOT = ROOT / "public" / "to-link-or-not"
GRAPHS_ROOT = STUDY_PUBLIC_ROOT / "graphs"
CONFIG_PATH = STUDY_PUBLIC_ROOT / "config.json"
OUT_CSV = ROOT / "public" / "to-link-or-not" / "metadata" / "task-ground-truth.csv"
CONDITION_TO_STRATEGY = {
    "condition_1": "traditional",
    "condition_2": "no-link",
    "condition_3": "on-demand",
    "condition_4": "stubs",
}
TASKS = ("T1", "T2", "T3")
RESPONSE_ID = "task-answer"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate generated metadata without writing graph JSON or CSV files",
    )
    return parser.parse_args()


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
        # Fallback only for non-LFR/non-training graphs. LFR study semantics use embedded communities.
        connected = [sorted_nodes(component) for component in nx.connected_components(graph)]
        communities = connected
    normalized = [sorted_nodes(community) for community in communities]
    # Largest cluster = largest embedded LFR community; tie-break by highest sorted member list
    # to match the existing NodeLinkDiagram fallback semantics.
    best_index, best_nodes = max(
        enumerate(normalized),
        key=lambda item: (len(item[1]), " ".join(item[1])),
    )
    # Placeholder/seed shown for metadata review: most connected node within the target cluster.
    placeholder = max(best_nodes, key=lambda node: (graph.degree[node], node))
    return best_index, best_nodes, placeholder


def revisit_answer(task_answer: str | list[str]) -> list[dict[str, Any]]:
    # NodeLinkDiagram stores T2/T3 task-answer values as JSON strings, so the
    # component-level ReVISit correctAnswer must match that exact runtime value.
    answer = task_answer if isinstance(task_answer, str) else json.dumps(sorted_nodes(task_answer))
    return [{"id": RESPONSE_ID, "answer": answer}]


def validate_graph_shape(data: dict, graph: nx.Graph, dataset: str) -> None:
    node_ids = {node["id"] for node in data["nodes"]}
    if len(node_ids) != len(data["nodes"]):
        raise ValueError(f"{dataset}: duplicate node ids")
    for edge in data["edges"]:
        if edge["source"] not in node_ids or edge["target"] not in node_ids:
            raise ValueError(f"{dataset}: edge references unknown node {edge}")
    if graph.number_of_nodes() == 0:
        raise ValueError(f"{dataset}: graph has no nodes")


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


def used_graph_paths() -> list[Path]:
    config = json.loads(CONFIG_PATH.read_text())
    paths: set[Path] = set()

    for component in config.get("components", {}).values():
        parameters = component.get("parameters") if isinstance(component, dict) else None
        if not isinstance(parameters, dict):
            continue
        graph_path = parameters.get("graphPath")
        if isinstance(graph_path, str):
            paths.add(ROOT / "public" / graph_path)
            continue

        graph = parameters.get("graph")
        graph_id = graph.get("id") if isinstance(graph, dict) else None
        if isinstance(graph_id, str):
            matches = sorted(GRAPHS_ROOT.glob(f"**/{graph_id}.json"))
            if matches:
                paths.add(matches[0])

    return sorted(paths)


def enrich_graph_data(data: dict) -> dict[str, Any]:
    graph = build_graph(data)
    dataset = data.get("id", "unknown")
    validate_graph_shape(data, graph, dataset)
    verify_existing_ground_truth(data, graph, dataset)

    t1_answer = choose_t1_answer(graph)
    t2 = data["groundTruth"]["T2"]
    t2_common = sorted_nodes(nx.common_neighbors(graph, t2["nodeA"], t2["nodeB"]))
    t3_index, t3_nodes, t3_placeholder = choose_t3_largest_community(data, graph)

    data.setdefault("groundTruth", {}).setdefault("T1", {})["answer"] = t1_answer
    data["groundTruth"]["T1"]["correctAnswer"] = revisit_answer(t1_answer)
    data.setdefault("groundTruth", {}).setdefault("T2", {})["commonNeighbors"] = t2_common
    data["groundTruth"]["T2"]["correctAnswer"] = revisit_answer(t2_common)
    data.setdefault("groundTruth", {}).setdefault("T3", {})["targetCommunityIndex"] = t3_index
    data["groundTruth"]["T3"]["targetCommunity"] = t3_nodes
    data["groundTruth"]["T3"]["placeholderNode"] = t3_placeholder
    data["groundTruth"]["T3"]["correctAnswer"] = revisit_answer(t3_nodes)

    return {
        "t1_answer": t1_answer,
        "t2_common": t2_common,
        "t3_index": t3_index,
        "t3_nodes": t3_nodes,
        "t3_placeholder": t3_placeholder,
    }


def rows_for_graph(path: Path, *, check: bool) -> list[dict[str, str]]:
    data = json.loads(path.read_text())
    original = deepcopy(data)
    graph = build_graph(data)
    labels = node_label_by_id(data)
    dataset = data.get("id", path.stem)
    condition_dir = path.parent.name
    strategy = CONDITION_TO_STRATEGY.get(condition_dir, condition_dir)
    rel_path = path.relative_to(ROOT / "public").as_posix()

    computed = enrich_graph_data(data)
    if check and data != original:
        raise ValueError(f"{rel_path}: graph JSON ground-truth metadata is stale")
    if not check:
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
            "correct_answer": computed["t1_answer"],
            "correct_answer_label": labels[computed["t1_answer"]],
            "revisit_correct_answer": json.dumps(data["groundTruth"]["T1"]["correctAnswer"]),
            "placeholder_node": computed["t1_answer"],
            "placeholder_node_label": labels[computed["t1_answer"]],
            "placeholder_node_a": "",
            "placeholder_node_b": "",
            "target_community_index": "",
            "correct_answer_count": "1",
            "computation": "NetworkX degree; max degree with highest node-id tie break",
        },
        {
            **base,
            "task": "T2",
            "correct_answer": ";".join(computed["t2_common"]),
            "correct_answer_label": ";".join(labels[node] for node in computed["t2_common"]),
            "revisit_correct_answer": json.dumps(data["groundTruth"]["T2"]["correctAnswer"]),
            "placeholder_node": "",
            "placeholder_node_label": "",
            "placeholder_node_a": data["groundTruth"]["T2"]["nodeA"],
            "placeholder_node_b": data["groundTruth"]["T2"]["nodeB"],
            "target_community_index": "",
            "correct_answer_count": str(len(computed["t2_common"])),
            "computation": "NetworkX common_neighbors(anchor A, anchor B)",
        },
        {
            **base,
            "task": "T3",
            "correct_answer": ";".join(computed["t3_nodes"]),
            "correct_answer_label": ";".join(labels[node] for node in computed["t3_nodes"]),
            "revisit_correct_answer": json.dumps(data["groundTruth"]["T3"]["correctAnswer"]),
            "placeholder_node": computed["t3_placeholder"],
            "placeholder_node_label": labels[computed["t3_placeholder"]],
            "placeholder_node_a": "",
            "placeholder_node_b": "",
            "target_community_index": str(computed["t3_index"]),
            "correct_answer_count": str(len(computed["t3_nodes"])),
            "computation": "largest embedded LFR community; placeholder is max-degree node inside it with highest node-id tie break",
        },
    ]


def main() -> None:
    args = parse_args()
    graph_files = used_graph_paths()
    if len(graph_files) != 61:
        raise SystemExit(f"Expected 61 study graph JSON files (60 LFR + 1 training), found {len(graph_files)}")
    rows = []
    for graph_file in graph_files:
        rows.extend(rows_for_graph(graph_file, check=args.check))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "dataset", "condition_dir", "strategy", "graph_path", "task", "correct_answer",
        "correct_answer_label", "revisit_correct_answer", "placeholder_node", "placeholder_node_label",
        "placeholder_node_a", "placeholder_node_b", "target_community_index", "correct_answer_count",
        "computation",
    ]
    if args.check:
        if not OUT_CSV.exists():
            raise ValueError(f"{OUT_CSV.relative_to(ROOT)} is missing")
        expected = []
        from_csv = []
        with OUT_CSV.open(newline="") as f:
            from_csv = list(csv.DictReader(f))
        expected = [{name: row[name] for name in fieldnames} for row in rows]
        if from_csv != expected:
            raise ValueError(f"{OUT_CSV.relative_to(ROOT)} is stale")
        print(f"Validated {len(graph_files)} graph files and {len(rows)} metadata rows")
    else:
        with OUT_CSV.open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        print(f"Wrote {len(rows)} rows for {len(graph_files)} graph files to {OUT_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
