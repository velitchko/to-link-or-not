#!/usr/bin/env python3
"""Generate a static HTML preview comparing graph label/edge legibility options.

Run from repo root:
  python scripts/revisit/generate_legibility_preview.py
Serve with Vite/static server and open:
  http://localhost:8080/to-link-or-not/legibility-preview.html
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GRAPHS_ROOT = ROOT / "public" / "to-link-or-not" / "graphs" / "lfr"
OUT_HTML = ROOT / "public" / "to-link-or-not" / "legibility-preview.html"

# One representative graph per LFR pool/condition keeps the page compact but covers all generated pools.
REPRESENTATIVE_GRAPHS = [
    "condition_1/condition_1_graph_01.json",
    "condition_2/condition_2_graph_01.json",
    "condition_3/condition_3_graph_01.json",
    "condition_4/condition_4_graph_01.json",
]


def main() -> None:
    missing = [rel for rel in REPRESENTATIVE_GRAPHS if not (GRAPHS_ROOT / rel).exists()]
    if missing:
        raise SystemExit(f"Missing representative graph(s): {missing}")

    OUT_HTML.write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>To Link or Not — Legibility Tuning Preview</title>
  <style>
    body {{ margin: 0; padding: 24px; background: #f1f5f9; color: #111827; font-family: system-ui, sans-serif; }}
    h1 {{ margin: 0 0 8px; font-size: 24px; }}
    p {{ margin: 0; }}
    .summary {{ margin: 0 0 18px; color: #475569; max-width: 1100px; line-height: 1.45; }}
    .legend {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin: 0 0 20px; }}
    .legend section {{ background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; box-shadow: 0 1px 2px rgba(15,23,42,0.05); }}
    .legend h2 {{ margin: 0 0 4px; font-size: 14px; }}
    .legend p {{ color: #475569; font-size: 13px; line-height: 1.35; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 18px; }}
    .card {{ background: white; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,0.06); }}
    header {{ padding: 10px 12px; display: grid; gap: 2px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }}
    header strong {{ font-size: 14px; }}
    header span {{ font-size: 13px; color: #475569; }}
    header code {{ font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    svg {{ display: block; width: 100%; height: auto; background: white; }}
    .label-text {{ pointer-events: none; user-select: none; paint-order: stroke fill; }}
    .error {{ color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; }}
    @media print {{ body {{ background: white; padding: 8px; }} .legend {{ break-after: page; }} .grid {{ grid-template-columns: repeat(2, 1fr); gap: 8px; }} .card {{ break-inside: avoid; box-shadow: none; }} }}
  </style>
</head>
<body>
  <h1>To Link or Not — Legibility Tuning Preview</h1>
  <p class="summary" id="summary">Loading representative LFR graphs… This preview is intentionally non-destructive: it only changes SVG styling in this audit page. It does not regenerate graph JSON or alter topology/ground truth.</p>
  <div class="legend" id="legend"></div>
  <main class="grid" id="grid"></main>
  <script>
    const WIDTH = 800;
    const HEIGHT = 560;
    const GRAPH_PATHS = {json.dumps([f"graphs/lfr/{rel}" for rel in REPRESENTATIVE_GRAPHS], indent=6)};
    const STRATEGIES = ['traditional', 'stubs'];
    const STRATEGY_LABELS = {{ traditional: 'Traditional links', stubs: 'Link stubs' }};
    const OPTIONS = [
      {{
        id: 'baseline', name: 'Baseline/current', nodeRadius: 12, edgeOpacity: 1, stubOpacity: 1, edgeWidth: 1.5,
        labelMode: 'plain-below', fontSize: 11, labelFill: '#374151', labelStroke: 'none', labelStrokeWidth: 0,
        description: 'Current runtime styling: centered labels below 12px nodes, full-opacity edges/stubs.'
      }},
      {{
        id: 'halo-muted-edges', name: 'Option A — halo + muted edges', nodeRadius: 10, edgeOpacity: 0.42, stubOpacity: 0.48, edgeWidth: 1.25,
        labelMode: 'halo-below', fontSize: 12, labelFill: '#111827', labelStroke: 'white', labelStrokeWidth: 4,
        description: 'Small node radius reduction; slightly larger dark labels with white halo; traditional/stub links recede. Lowest-risk runtime patch.'
      }},
      {{
        id: 'offset-halo', name: 'Option B — offset halo labels', nodeRadius: 10, edgeOpacity: 0.34, stubOpacity: 0.42, edgeWidth: 1.2,
        labelMode: 'halo-offset', fontSize: 12, labelFill: '#111827', labelStroke: 'white', labelStrokeWidth: 4,
        description: 'Moves labels to the upper-right of nodes to reduce direct collisions with nodes and bottom-neighbor labels. Good compromise for dense graphs.'
      }},
      {{
        id: 'pill-labels', name: 'Option C — label pills', nodeRadius: 9, edgeOpacity: 0.25, stubOpacity: 0.34, edgeWidth: 1.1,
        labelMode: 'pill-offset', fontSize: 12, labelFill: '#111827', labelStroke: 'none', labelStrokeWidth: 0,
        description: 'White rounded backgrounds behind offset labels. Most legible, but visually busier and potentially changes perceived grouping.'
      }}
    ];

    function svgEl(name, attrs = {{}}) {{
      const el = document.createElementNS('http://www.w3.org/2000/svg', name);
      for (const [key, value] of Object.entries(attrs)) if (value !== undefined && value !== null) el.setAttribute(key, String(value));
      return el;
    }}

    function labelPosition(node, option) {{
      if (option.labelMode === 'plain-below' || option.labelMode === 'halo-below') {{
        return {{ x: node.x, y: node.y + option.nodeRadius + option.fontSize + 3, anchor: 'middle' }};
      }}
      return {{ x: node.x + option.nodeRadius + 4, y: node.y - option.nodeRadius - 4, anchor: 'start' }};
    }}

    function renderEdges(group, graph, strategy, option) {{
      const nodes = Object.fromEntries(graph.nodes.map((node) => [node.id, node]));
      const opacity = strategy === 'stubs' ? option.stubOpacity : option.edgeOpacity;
      const stubFraction = graph.stubLengthFraction ?? 0.25;
      for (const edge of graph.edges) {{
        const source = nodes[edge.source];
        const target = nodes[edge.target];
        if (!source || !target) continue;
        const sx = source.x, sy = source.y, tx = target.x, ty = target.y;
        if (strategy === 'traditional') {{
          group.append(svgEl('line', {{ x1: sx, y1: sy, x2: tx, y2: ty, stroke: '#64748b', 'stroke-width': option.edgeWidth, opacity }}));
        }} else if (strategy === 'stubs') {{
          const dx = tx - sx, dy = ty - sy;
          group.append(svgEl('line', {{ x1: sx, y1: sy, x2: sx + dx * stubFraction, y2: sy + dy * stubFraction, stroke: '#64748b', 'stroke-width': option.edgeWidth, 'stroke-linecap': 'round', opacity }}));
          group.append(svgEl('line', {{ x1: tx, y1: ty, x2: tx - dx * stubFraction, y2: ty - dy * stubFraction, stroke: '#64748b', 'stroke-width': option.edgeWidth, 'stroke-linecap': 'round', opacity }}));
        }}
      }}
    }}

    function renderNodes(group, graph, option) {{
      const nodeGroup = svgEl('g', {{ class: 'nodes' }});
      const labelLayer = svgEl('g', {{ class: 'labels' }});
      for (const node of graph.nodes) {{
        const circle = svgEl('circle', {{ cx: node.x, cy: node.y, r: option.nodeRadius, fill: '#4f46e5', stroke: 'white', 'stroke-width': 2 }});
        nodeGroup.append(circle);
        if (node.label) {{
          const pos = labelPosition(node, option);
          const labelWrap = svgEl('g');
          if (option.labelMode === 'pill-offset') {{
            const estimatedWidth = Math.max(16, node.label.length * option.fontSize * 0.62 + 8);
            labelWrap.append(svgEl('rect', {{
              x: pos.x - 4, y: pos.y - option.fontSize, width: estimatedWidth, height: option.fontSize + 5,
              rx: 4, ry: 4, fill: 'white', opacity: 0.88, stroke: '#e2e8f0', 'stroke-width': 0.5,
            }}));
          }}
          const text = svgEl('text', {{
            class: 'label-text', x: pos.x, y: pos.y, 'text-anchor': pos.anchor, 'font-size': option.fontSize,
            'font-weight': 600, fill: option.labelFill, stroke: option.labelStroke, 'stroke-width': option.labelStrokeWidth,
            'stroke-linejoin': 'round', 'stroke-linecap': 'round', style: 'pointer-events:none;user-select:none',
          }});
          text.textContent = node.label;
          labelWrap.append(text);
          labelLayer.append(labelWrap);
        }}
      }}
      group.append(nodeGroup);
      group.append(labelLayer);
    }}

    function renderCard(graph, graphPath, strategy, option) {{
      const card = document.createElement('section');
      card.className = 'card';
      card.dataset.dataset = graph.id;
      card.dataset.strategy = strategy;
      card.dataset.option = option.id;
      card.innerHTML = `<header><strong></strong><span></span><code></code></header>`;
      card.querySelector('strong').textContent = `${{option.name}} — ${{graph.id}}`;
      card.querySelector('span').textContent = STRATEGY_LABELS[strategy];
      card.querySelector('code').textContent = graphPath;

      const svg = svgEl('svg', {{ viewBox: `0 0 ${{WIDTH}} ${{HEIGHT}}`, width: WIDTH, height: HEIGHT, role: 'img' }});
      svg.append(svgEl('rect', {{ width: WIDTH, height: HEIGHT, fill: 'white' }}));
      const group = svgEl('g');
      renderEdges(group, graph, strategy, option);
      renderNodes(group, graph, option);
      svg.append(group);
      card.append(svg);
      return card;
    }}

    async function main() {{
      const grid = document.getElementById('grid');
      const summary = document.getElementById('summary');
      const legend = document.getElementById('legend');
      OPTIONS.forEach((option) => {{
        const section = document.createElement('section');
        section.innerHTML = `<h2></h2><p></p>`;
        section.querySelector('h2').textContent = option.name;
        section.querySelector('p').textContent = option.description;
        legend.append(section);
      }});
      try {{
        let cards = 0;
        for (const graphPath of GRAPH_PATHS) {{
          const graph = await fetch(graphPath).then((response) => {{
            if (!response.ok) throw new Error(`${{response.status}} ${{graphPath}}`);
            return response.json();
          }});
          for (const strategy of STRATEGIES) {{
            for (const option of OPTIONS) {{
              grid.append(renderCard(graph, graphPath, strategy, option));
              cards += 1;
            }}
          }}
        }}
        summary.textContent = `Generated ${{cards}} preview cards from ${{GRAPH_PATHS.length}} representative LFR graphs × ${{STRATEGIES.length}} dense strategies × ${{OPTIONS.length}} styling options. Graph JSON/topology is fetched read-only.`;
      }} catch (error) {{
        summary.className = 'error';
        summary.textContent = `Could not load preview: ${{error.message}}. Open through Vite/static server, not file://.`;
      }}
    }}
    main();
  </script>
</body>
</html>""")
    print(f"Wrote legibility preview page to {OUT_HTML.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
