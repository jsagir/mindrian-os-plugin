#!/usr/bin/env bash
# Phase 149 scoped runner -- run before each 149 task commit. Cloned from the
# Phase 124 aggregator shape (tests/run-all-124.sh). RED-by-design: each suite
# goes GREEN when its owning plan lands. Suites whose owning plan has not landed
# yet print a MISSING line (the runner tolerates them), exactly like
# run-all-124.sh tolerates an absent suite file.
#
# Owning-plan map (which plan turns each suite GREEN):
#   test-149-artifact-nodes.cjs            -> Plan 01 (GAM-01) -- a planning_artifact node lands via navigation.cjs; grep-audit no room.db open
#   test-149-requirement-nodes.cjs         -> Plan 02 (GAM-02) -- requirement ids as nodes; which-artifacts-touch query
#   test-149-lineage-edges.cjs             -> Plan 01 (GAM-03) -- FEEDS_INTO / VALIDATES / INFORMS lineage; non-taxonomy rejected
#   test-149-idempotent-upsert.cjs         -> Plan 01 (GAM-04) -- second write of node or edge does not duplicate
#   test-149-navigable.cjs                 -> Plan 02/03 (GAM-05) -- /mos:graph-style read returns planning_artifact nodes
#   test-149-brain-egress.cjs              -> Plan 02/03 (GAM-06) -- zero artifact prose reaches any Brain packet
#   test-149-backfill.cjs                  -> Plan 02 (GAM-07) -- backfill idempotence over a fixture .planning tree
#   test-149-navigation-only-invariant.cjs -> Plan 02/03 (Part-9) -- reconcile + writer read/write ONLY via navigation.cjs
#
# This plan (01) OWNS the three suites: artifact-nodes, lineage-edges,
# idempotent-upsert. The other five are created by their owning plans (02/03);
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
  test-149-artifact-nodes.cjs
  test-149-requirement-nodes.cjs
  test-149-lineage-edges.cjs
  test-149-idempotent-upsert.cjs
  test-149-navigable.cjs
  test-149-brain-egress.cjs
  test-149-backfill.cjs
  test-149-navigation-only-invariant.cjs
)

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 149 scoped test runner"
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
echo "  Summary (149 scoped)"
echo "========================================"
echo "  Total:   $TOTAL"
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Missing: $MISSING"
echo "  Time:    ${ELAPSED}s"

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "  Missing (created by their owning plan 02/03 -- see header):"
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
