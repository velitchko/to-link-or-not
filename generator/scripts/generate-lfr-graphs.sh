#!/usr/bin/env bash
set -euo pipefail

# Generate LFR benchmark graphs for the "To Link or Not" study.
#
# Output filenames:
#   generator/data/condition_1/condition_1_graph_01.json
#   ...
#   generator/data/condition_4/condition_4_graph_15.json
#
# This script uses Andrea Lancichinetti's maintained LFR benchmark code:
#   https://github.com/andrealancichinetti/LFRbenchmarks
#
# Dependencies: git, make, g++, python3

GENERATOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="${GENERATOR_DIR}/lfr/.cache/LFRbenchmarks"
BENCH_DIR="${VENDOR_DIR}/unweighted_undirected"
OUT_DIR="${GENERATOR_DIR}/data"
WORK_DIR="${GENERATOR_DIR}/lfr/.cache/lfr-runs"
GRAPHS_PER_CONDITION=15

# Tiny parameter differences by condition. Tune these here.
# Format: "N k maxk mu minc maxc t1 t2 on om"
# - N: nodes
# - k: average degree
# - maxk: maximum degree
# - mu: mixing parameter; higher => fuzzier communities
# - minc/maxc: community size range
# - t1/t2: degree/community-size power-law exponents
# - on/om: overlapping nodes / memberships per overlapping node
CONDITION_1=(120 8 24 0.22 18 36 2.0 1.2 0 0)
CONDITION_2=(120 8 24 0.26 18 36 2.0 1.2 0 0)
CONDITION_3=(120 9 26 0.22 16 34 2.1 1.2 0 0)
CONDITION_4=(120 9 26 0.26 16 34 2.1 1.2 0 0)

ensure_lfr() {
  if [[ ! -d "${VENDOR_DIR}/.git" ]]; then
    mkdir -p "$(dirname "${VENDOR_DIR}")"
    git clone --depth 1 https://github.com/andrealancichinetti/LFRbenchmarks.git "${VENDOR_DIR}"
  fi

  if [[ ! -x "${BENCH_DIR}/benchmark" ]]; then
    make -C "${BENCH_DIR}"
  fi
}

params_for_condition() {
  local condition="$1"
  local var="CONDITION_${condition}[*]"
  # shellcheck disable=SC1083,SC2086
  echo ${!var}
}

convert_to_json() {
  local graph_id="$1"
  local condition="$2"
  local index="$3"
  local params_json="$4"
  local run_dir="$5"
  local out_file="$6"

  python3 "${GENERATOR_DIR}/scripts/lfr/lfr_to_revisit_graph.py" \
    --graph-id "${graph_id}" \
    --condition "${condition}" \
    --index "${index}" \
    --params-json "${params_json}" \
    --network "${run_dir}/network.dat" \
    --community "${run_dir}/community.dat" \
    --statistics "${run_dir}/statistics.dat" \
    --out "${out_file}"
}

main() {
  ensure_lfr
  rm -rf "${OUT_DIR}" "${WORK_DIR}"
  mkdir -p "${OUT_DIR}" "${WORK_DIR}"

  for condition in 1 2 3 4; do
    read -r N K MAXK MU MINC MAXC T1 T2 ON OM <<< "$(params_for_condition "${condition}")"
    condition_dir="${OUT_DIR}/condition_${condition}"
    mkdir -p "${condition_dir}"

    for idx in $(seq 1 "${GRAPHS_PER_CONDITION}"); do
      graph_num="$(printf '%02d' "${idx}")"
      graph_id="condition_${condition}_graph_${graph_num}"
      run_dir="${WORK_DIR}/${graph_id}"
      mkdir -p "${run_dir}"

      # The original LFR code reads/increments time_seed.dat in the working dir.
      # Keep this deterministic while still varying every graph.
      seed=$((100000 + condition * 1000 + idx))
      printf '%s\n' "${seed}" > "${run_dir}/time_seed.dat"

      (
        cd "${run_dir}"
        "${BENCH_DIR}/benchmark" \
          -N "${N}" \
          -k "${K}" \
          -maxk "${MAXK}" \
          -mu "${MU}" \
          -minc "${MINC}" \
          -maxc "${MAXC}" \
          -t1 "${T1}" \
          -t2 "${T2}" \
          -on "${ON}" \
          -om "${OM}" \
          > "benchmark.log" 2>&1
      )

      params_json="{\"N\":${N},\"k\":${K},\"maxk\":${MAXK},\"mu\":${MU},\"minc\":${MINC},\"maxc\":${MAXC},\"t1\":${T1},\"t2\":${T2},\"on\":${ON},\"om\":${OM},\"seed\":${seed}}"
      convert_to_json "${graph_id}" "${condition}" "${idx}" "${params_json}" "${run_dir}" "${condition_dir}/${graph_id}.json"
      echo "Written: ${condition_dir#${GENERATOR_DIR}/}/${graph_id}.json"
    done
  done

  echo "Done. Generated $((4 * GRAPHS_PER_CONDITION)) LFR graphs in ${OUT_DIR#${GENERATOR_DIR}/}."
}

main "$@"
