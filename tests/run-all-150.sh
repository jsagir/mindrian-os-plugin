#!/usr/bin/env bash
# Phase 150 scoped runner -- run before each 150 task commit. Cloned from the
# Phase 149 aggregator shape (tests/run-all-149.sh). RED-by-design: each suite
# goes GREEN when its owning plan lands. Suites whose owning plan has not landed
# yet print a MISSING line (the runner tolerates them), exactly like
# run-all-149.sh tolerates an absent suite file.
#
# Owning-plan map (which plan turns each suite GREEN):
#   test-150-memory-nodes.cjs              -> Plan 01 (MEM-01) -- 6 memory_artifact + governing_thought + persona nodes land via navigation; grep-audit no room.db open
#   test-150-lineage-edges.cjs             -> Plan 01 (MEM-01) -- STATES / SUPPORTS / INFORMS / DESCRIBES lineage; non-taxonomy rejected; idempotent
#   test-150-decision-projection.cjs       -> Plan 01 (MEM-07) -- decision lands at 'proposed' (never auto-confirmed); type='decision' read stops being empty; idempotent
#   test-150-brain-egress.cjs              -> Plan 02 -- zero memory prose reaches any Brain packet
#   test-150-reconcile.cjs                 -> Plan 03 -- memory MD files project to nodes; reconcile idempotence
#   test-150-trigger.cjs                   -> Plan 03 -- the writer hook trigger fires projection
#   test-150-cortex-context.cjs            -> Plan 04 -- local consumption of cortex nodes
#   test-150-orphans.cjs                   -> Plan 04 -- orphan detection over the cortex graph
#   test-150-spine-connector.cjs           -> Plan 05 -- the spine connector wiring
#   test-150-selector-graph-driven.cjs     -> Plan 06 -- selector reads the cortex graph
#   test-150-feynman-readback.cjs          -> Plan 07 -- FEYNMAN.md cortex readback
#   test-150-claim-harness.cjs             -> Plan 08 -- the claim-harness driver suite
#   test-150-navigation-only-invariant.cjs -> Plan 08 -- cortex read/write ONLY via navigation.cjs (finalizes this runner)
#
# This plan (01) OWNS the three suites: memory-nodes, lineage-edges,
# decision-projection. The other nine are created by their owning plans (02-08);
# until then this runner prints MISSING for them and still runs to completion.
#
# This runner MUST run to completion (no crash) even when RED suites fail; it
# prints a per-suite PASS/FAIL/MISSING line. It exits non-zero if any suite
# failed OR is missing -- which is EXPECTED while downstream plans are in flight.
#
# CJS_SUITES entries are resolved relative to this directory (tests/).
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-150-memory-nodes.cjs
  test-150-lineage-edges.cjs
  test-150-decision-projection.cjs
  test-150-reconcile.cjs
  test-150-trigger.cjs
  test-150-cortex-context.cjs
  test-150-orphans.cjs
  test-150-spine-connector.cjs
  test-150-selector-graph-driven.cjs
  test-150-feynman-readback.cjs
  test-150-brain-egress.cjs
  test-150-navigation-only-invariant.cjs
  test-150-claim-harness.cjs
)

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 150 scoped test runner"
echo "========================================"
echo ""

for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  ((TOTAL++))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$s"); echo ">>> $s: MISSING"; echo ""; continue
  fi
  if bash "$p"; then
    ((PASSED++)); echo ">>> $s: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$s"); echo ">>> $s: FAILED"
  fi
  echo ""
done

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$c"); echo ">>> $c: MISSING (created by its owning plan)"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (150 scoped)"
echo "========================================"
echo "  Total:   $TOTAL"
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Missing: $MISSING"
echo "  Time:    ${ELAPSED}s"

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "  Missing (created by their owning plan 02-08 -- see header):"
  for t in "${MISSING_TESTS[@]}"; do
    echo "    - $t"
  done
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (RED-by-design until the owning plan lands -- see header):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

if [[ $MISSING -gt 0 ]]; then
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
