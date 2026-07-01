#!/usr/bin/env bash
# Phase 200 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# rs-engine-spine-corpus cluster. Models on tests/run-all-196.sh.
#
# Phase 200 lands: (1) the SEED-018 corpus-quality fix (single-source exclude-list
# + semantic-floor gate + regression), (2) the RS Part-9 chokepoint reconcile
# (edge writes through navigation.writeEdge + a reverse_salient_detected
# memory_event; the migrated-opener node insert), and (3) the corpus-quality eval
# gate (a local deterministic degenerate detector with Plurai-parity CSV; Plurai is
# BUILD/CI only, synthetic data only, never on the runtime path).
#
# Each leg is run_if, GUARDED ON A FILE that must exist, so a partially-landed phase
# exits cleanly with SKIPs rather than RED-failing on absence. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# (1) Corpus-quality fix (SEED-018)
run_if "200-01 corpus exclude-list (drift)" "lib/core/rs_corpus_exclude.py" \
  bash tests/test-200-corpus-exclude.sh
run_if "200-01 corpus quality (semantic gate + regression)" "tests/test-200-corpus-quality.cjs" \
  node tests/test-200-corpus-quality.cjs

# (2) Part-9 chokepoint reconcile
run_if "200-02 RS edge vocab mint" "tests/test-200-02-rs-edge-vocab.cjs" \
  node tests/test-200-02-rs-edge-vocab.cjs
run_if "200-02 graph chokepoint reroute" "lib/core/rs-sqlite-mirror.cjs" \
  node tests/test-200-graph-chokepoint.cjs

# (3) Corpus-quality eval gate
run_if "200-03 corpus-quality gate (Plurai parity)" "lib/core/rs-corpus-quality-gate.cjs" \
  node tests/test-200-corpus-quality-gate.cjs

echo "======================================"
echo "Phase 200: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
