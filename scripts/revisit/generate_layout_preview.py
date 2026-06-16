#!/usr/bin/env python3
"""Generate a static before/after HTML preview for active LFR graph coordinates."""
from __future__ import annotations

import argparse
import html
import json
import subprocess
from pathlib import Path
from typing import Any

DEFAULT_GRAPHS = [
    'condition_1/condition_1_graph_01.json',
    'condition_2/condition_2_graph_01.json',
    'condition_3/condition_3_graph_01.json',
    'condition_4/condition_4_graph_01.json',
]
GRAPH_ROOT = Path('public/to-link-or-not/graphs/lfr')
OUT = Path('public/to-link-or-not/layout-preview.html')
COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7']


def load_ref(path: Path, ref: str) -> dict[str, Any]:
    return json.loads(subprocess.check_output(['git', 'show', f'{ref}:{path.as_posix()}']))


def community_lookup(graph: dict[str, Any]) -> dict[str, int]:
    lookup: dict[str, int] = {}
    for idx, community in enumerate(graph.get('communities', [])):
        for node_id in community:
            lookup.setdefault(node_id, idx)
    return lookup


def svg(graph: dict[str, Any], title: str) -> str:
    lookup = community_lookup(graph)
    nodes = {node['id']: node for node in graph.get('nodes', [])}
    edge_parts = []
    for edge in graph.get('edges', []):
        s = nodes.get(edge['source'])
        t = nodes.get(edge['target'])
        if not s or not t:
            continue
        edge_parts.append(f'<line x1="{s["x"]}" y1="{s["y"]}" x2="{t["x"]}" y2="{t["y"]}" />')
    node_parts = []
    for node in graph.get('nodes', []):
        color = COLORS[lookup.get(node['id'], 0) % len(COLORS)]
        node_parts.append(f'<circle cx="{node["x"]}" cy="{node["y"]}" r="3.8" fill="{color}"><title>{html.escape(node["id"])} / {html.escape(str(node.get("label", "")))}</title></circle>')
    return f'''
      <figure>
        <figcaption>{html.escape(title)}</figcaption>
        <svg viewBox="0 0 {graph.get('layout', {}).get('width', 800)} {graph.get('layout', {}).get('height', 560)}" role="img">
          <g class="edges">{''.join(edge_parts)}</g>
          <g class="nodes">{''.join(node_parts)}</g>
        </svg>
      </figure>'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-ref', default='origin/main')
    parser.add_argument('--root', type=Path, default=GRAPH_ROOT)
    parser.add_argument('--out', type=Path, default=OUT)
    parser.add_argument('--graphs', nargs='*', default=DEFAULT_GRAPHS)
    args = parser.parse_args()

    sections = []
    for rel in args.graphs:
        path = args.root / rel
        before = load_ref(path, args.base_ref)
        after = json.loads(path.read_text())
        sections.append(f'''
    <section>
      <h2>{html.escape(rel)}</h2>
      <div class="pair">
        {svg(before, 'Before: origin/main coordinates')}
        {svg(after, 'After: balanced-v2 precomputed coordinates')}
      </div>
    </section>''')

    doc = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>To Link or Not — LFR layout preview</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 24px; color: #1f2933; background: #f8fafc; }}
    h1 {{ margin-bottom: 0.25rem; }}
    .note {{ max-width: 960px; color: #52606d; }}
    section {{ margin-top: 28px; }}
    .pair {{ display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr)); gap: 18px; }}
    figure {{ margin: 0; padding: 12px; background: white; border: 1px solid #d9e2ec; border-radius: 10px; box-shadow: 0 1px 2px rgb(16 24 40 / 0.06); }}
    figcaption {{ font-weight: 650; margin-bottom: 8px; }}
    svg {{ width: 100%; height: auto; background: #fff; border: 1px solid #edf2f7; }}
    .edges line {{ stroke: #a7b6c2; stroke-opacity: 0.36; stroke-width: 1; }}
    .nodes circle {{ stroke: white; stroke-width: 1; }}
    @media (max-width: 900px) {{ .pair {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <h1>LFR precomputed layout preview</h1>
  <p class="note">Static before/after preview generated from JSON coordinates only. This is intentionally not a runtime rendering-style change.</p>
  {''.join(sections)}
</body>
</html>
'''
    args.out.write_text(doc)
    print(f'Wrote {args.out}')


if __name__ == '__main__':
    main()
