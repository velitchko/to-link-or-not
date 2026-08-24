# Graph generator assets

This directory contains generator-side assets for producing LFR graphs and task answer-key metadata. It is intentionally separate from the ReVISit study interface/config.

## LFR source

The LFR benchmark code is pulled from Andrea Lancichinetti's repository:

- https://github.com/andrealancichinetti/LFRbenchmarks

The generator script clones/builds that repository under `generator/lfr/.cache/LFRbenchmarks/` when needed. Runtime benchmark outputs are kept under `generator/lfr/.cache/lfr-runs/`.

## Structure

```text
generator/
  README.md
  lfr/
    .cache/                  # ignored vendor/build/run cache
      LFRbenchmarks/         # cloned upstream LFR benchmark repo
      lfr-runs/              # raw network.dat/community.dat/statistics.dat runs
  scripts/
    generate-lfr-graphs.sh   # generates condition_* graph JSON files
    save-task-ground-truth.py # writes per-task answer-key JSON
    lfr/
      lfr_to_revisit_graph.py # converts raw LFR output to this study's graph JSON shape
  data/
    condition_1/
    condition_2/
    condition_3/
    condition_4/
```

## Generate graphs

```bash
bash generator/scripts/generate-lfr-graphs.sh
```

Outputs are written to:

```text
generator/data/condition_<n>/condition_<n>_graph_<nn>.json
```

Each graph JSON includes nodes, edges, deterministic layout coordinates, LFR parameters, memberships, and graph-derived `groundTruth` fields.

## Generate task ground truth

```bash
python3 generator/scripts/save-task-ground-truth.py \
  --graph generator/data/condition_1/condition_1_graph_01.json \
  --condition traditional \
  --task T1
```

T2 can use explicit anchors:

```bash
python3 generator/scripts/save-task-ground-truth.py \
  --graph generator/data/condition_1/condition_1_graph_01.json \
  --condition traditional \
  --task T2 \
  --node-a n001 \
  --node-b n019
```

T3 should specify the target planted community, either by anchor node or by community index:

```bash
python3 generator/scripts/save-task-ground-truth.py \
  --graph generator/data/condition_1/condition_1_graph_01.json \
  --condition traditional \
  --task T3 \
  --anchor-node n001
```

Default answer-key output goes beside the graph data:

```text
generator/data/condition_1/ground-truth/condition_1_graph_01-T3.json
```

## Notes

- LFR provides planted community membership, not task-specific answer keys.
- T1/T2 answer keys are derived locally from the generated graph structure.
- T3 is scoreable only when the target community is made explicit; otherwise it should be treated as exploratory/perceptual rather than binary accuracy.
