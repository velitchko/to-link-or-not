#!/usr/bin/env python3
"""Generate an HTML review sheet for all 60 LFR datasets x 4 rendering strategies.

Run from repo root:
  python scripts/revisit/generate_stimuli_review.py
Open via a local/static server so the page can fetch graph JSON, e.g.:
  npx vite --host=0.0.0.0 --port=8080
  http://localhost:8080/to-link-or-not/stimuli-review.html
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GRAPHS_ROOT = ROOT / "public" / "to-link-or-not" / "graphs" / "lfr"
OUT_HTML = ROOT / "public" / "to-link-or-not" / "stimuli-review.html"


def main() -> None:
    graph_paths = sorted(GRAPHS_ROOT.glob("condition_*/*.json"))
    if len(graph_paths) != 60:
        raise SystemExit(f"Expected 60 graphs, found {len(graph_paths)}")
    rel_paths = [path.relative_to(ROOT / "public" / "to-link-or-not").as_posix() for path in graph_paths]

    OUT_HTML.write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>To Link or Not — Stimuli Review</title>
  <style>
    body {{ margin: 0; padding: 24px; background: #f1f5f9; color: #111827; font-family: system-ui, sans-serif; }}
    h1 {{ margin: 0 0 8px; font-size: 24px; }}
    .summary {{ margin: 0 0 20px; color: #475569; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap: 18px; }}
    .card {{ background: white; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }}
    header {{ padding: 10px 12px; display: grid; gap: 2px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }}
    header strong {{ font-size: 14px; }}
    header span {{ font-size: 13px; color: #475569; }}
    header code {{ font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .prompt {{ padding: 10px 12px; font-size: 14px; font-weight: 500; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }}
    svg {{ display: block; width: 100%; height: auto; background: white; }}
    .error {{ color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; }}
    @media print {{ body {{ background: white; padding: 8px; }} .grid {{ grid-template-columns: repeat(2, 1fr); gap: 8px; }} .card {{ break-inside: avoid; box-shadow: none; }} }}
  </style>
</head>
<body>
  <h1>To Link or Not — Stimuli Review</h1>
  <p class="summary" id="summary">Loading 60 LFR datasets × 4 rendering strategies…</p>
  <main class="grid" id="grid"></main>
  <script>
    const WIDTH = 800;
    const HEIGHT = 560;
    const NODE_RADIUS = 12;
    const GRAPH_PATHS = {json.dumps(rel_paths, indent=6)};
    const STRATEGIES = ['traditional', 'no-link', 'on-demand', 'stubs'];
    const STRATEGY_LABELS = {{
      traditional: 'Traditional links',
      'no-link': 'No links',
      'on-demand': 'On-demand links',
      stubs: 'Link stubs',
    }};

    function svgEl(name, attrs = {{}}) {{
      const el = document.createElementNS('http://www.w3.org/2000/svg', name);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
      return el;
    }}

    function renderEdges(group, graph, strategy) {{
      if (strategy === 'no-link') return;
      const nodes = Object.fromEntries(graph.nodes.map((node) => [node.id, node]));
      const stubFraction = graph.stubLengthFraction ?? 0.25;
      for (const edge of graph.edges) {{
        const source = nodes[edge.source];
        const target = nodes[edge.target];
        if (!source || !target) continue;
        const sx = source.x;
        const sy = source.y;
        const tx = target.x;
        const ty = target.y;
        if (strategy === 'traditional' || strategy === 'on-demand') {{
          group.append(svgEl('line', {{
            x1: sx, y1: sy, x2: tx, y2: ty, stroke: '#94a3b8', 'stroke-width': 1.5,
            opacity: strategy === 'on-demand' ? 0.18 : 1,
          }}));
        }} else if (strategy === 'stubs') {{
          const dx = tx - sx;
          const dy = ty - sy;
          group.append(svgEl('line', {{ x1: sx, y1: sy, x2: sx + dx * stubFraction, y2: sy + dy * stubFraction, stroke: '#94a3b8', 'stroke-width': 1.5, 'stroke-linecap': 'round' }}));
          group.append(svgEl('line', {{ x1: tx, y1: ty, x2: tx - dx * stubFraction, y2: ty - dy * stubFraction, stroke: '#94a3b8', 'stroke-width': 1.5, 'stroke-linecap': 'round' }}));
        }}
      }}
    }}

    function renderNodes(group, graph) {{
      const nodeGroup = svgEl('g', {{ class: 'nodes' }});
      for (const node of graph.nodes) {{
        const wrapper = svgEl('g');
        wrapper.append(svgEl('circle', {{
          class: 'node-circle', 'data-node-id': node.id, cx: node.x, cy: node.y, r: NODE_RADIUS,
          fill: '#4f46e5', stroke: 'white', 'stroke-width': 2,
        }}));
        if (node.label) {{
          const label = svgEl('text', {{
            x: node.x, y: node.y + NODE_RADIUS + 14, 'text-anchor': 'middle', 'font-size': 11,
            fill: '#374151', style: 'pointer-events:none;user-select:none',
          }});
          label.textContent = node.label;
          wrapper.append(label);
        }}
        nodeGroup.append(wrapper);
      }}
      group.append(nodeGroup);
    }}

    function renderCard(graph, graphPath, strategy) {{
      const card = document.createElement('section');
      card.className = 'card';
      card.dataset.dataset = graph.id;
      card.dataset.strategy = strategy;
      card.innerHTML = `<header><strong></strong><span></span><code></code></header><div class="prompt">Identify and select the largest cluster you see</div>`;
      card.querySelector('strong').textContent = graph.id;
      card.querySelector('span').textContent = STRATEGY_LABELS[strategy];
      card.querySelector('code').textContent = graphPath;

      const svg = svgEl('svg', {{ viewBox: `0 0 ${{WIDTH}} ${{HEIGHT}}`, width: WIDTH, height: HEIGHT, role: 'img', 'aria-label': `${{graph.id}} ${{strategy}}` }});
      svg.append(svgEl('rect', {{ width: WIDTH, height: HEIGHT, fill: 'white' }}));
      const group = svgEl('g');
      renderEdges(group, graph, strategy);
      renderNodes(group, graph);
      svg.append(group);
      card.append(svg);
      return card;
    }}

    async function main() {{
      const grid = document.getElementById('grid');
      const summary = document.getElementById('summary');
      try {{
        let cards = 0;
        for (const graphPath of GRAPH_PATHS) {{
          const graph = await fetch(graphPath).then((response) => {{
            if (!response.ok) throw new Error(`${{response.status}} ${{graphPath}}`);
            return response.json();
          }});
          for (const strategy of STRATEGIES) {{
            grid.append(renderCard(graph, graphPath, strategy));
            cards += 1;
          }}
        }}
        summary.textContent = `Generated ${{cards}} cards: 60 LFR datasets × 4 rendering strategies. Node/edge styling mirrors the ReVISit NodeLinkDiagram component; on-demand links are shown faintly for static audit.`;
      }} catch (error) {{
        summary.className = 'error';
        summary.textContent = `Could not load stimuli: ${{error.message}}. Open this file via a local/static server, not file://.`;
      }}
    }}

    main();
  </script>
</body>
</html>""")
    print(f"Wrote dynamic stimuli review page for {len(rel_paths)} graphs to {OUT_HTML.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
