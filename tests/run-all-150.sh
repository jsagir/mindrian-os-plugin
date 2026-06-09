#!/usr/bin/env bash
# Phase 150 FINALIZED aggregator -- the phase gate is ONE command (MEM-09 / D-09).
#
# Created skeletal by 150-01 (RED-by-design while downstream plans were in
# flight); FINALIZED by 150-08 now that every 150 surface has landed. As the
# final plan of the phase this gate MUST be fully green: 0 failed, 0 missing.
#
# What this PROVES (by instrumentation, not by promise -- Canon Part 6
# dog-fooding): the full memory-cortex-as-graph-members bridge is delivered and
# the frozen 148 constitution survived it. Four groups compose the gate:
#
#   (a) every 150 CJS suite (the Wave-1/2/3 deliverables under test):
#         memory-nodes / lineage-edges / decision-projection  (Plan 01, MEM-01/07)
#         reconcile                                            (Plan 03)
#         brain-egress                                         (Plan 02, MEM-04)
#         cortex-local-query / orphans                         (Plan 04, MEM-03/07)
#         spine-connector                                      (Plan 05)
#         selector-graph-driven / render-unlock                (Plan 06, MEM-06/D-08)
#         feynman-readback                                     (Plan 07)
#
#   (b) the claim harness (tests/claim-harness/run-all-claims.sh) as a SHELL
#       group -- the C1..C7 falsifiable public-site-claim drivers + the gates
#       (Plan 08, MEM-09 / D-09).
#
#   (c) the CARRIED 148 frozen-contracts + reach-ids drift fences (run-all-148.sh)
#       re-run to assert MAX_K=3 / DIAL_REACH_K=6 byte-unchanged -- 150 must not
#       move the frozen constitution.
#
#   (d) a standalone Part-8 grep sweep over ALL the new 150 artifacts (the cortex
#       packet path + the new lib edits + the connector + the seed-writer) for
#       forbidden user-content-to-Brain tokens.
#
# This runner MUST run to completion (no crash) even when a suite fails; it
# prints a per-suite PASS/FAIL/MISSING line + a final tally. It exits non-zero if
# any suite failed OR is missing. A suite not yet created gates to a MISSING line
# (not a crash) so the phase gate flags incompleteness rather than hiding it.
#
# CJS_SUITES entries are resolved relative to this directory (tests/).
# SHELL_SUITES entries are sibling shell aggregators run as shell suites.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# (a) Every 150 CJS suite (the real, landed filenames).
CJS_SUITES=(
  test-150-memory-nodes.cjs
  test-150-lineage-edges.cjs
  test-150-decision-projection.cjs
  test-150-reconcile.cjs
  test-150-brain-egress.cjs
  test-150-cortex-local-query.cjs
  test-150-orphans.cjs
  test-150-spine-connector.cjs
  test-150-selector-graph-driven.cjs
  test-150-render-unlock.cjs
  test-150-feynman-readback.cjs
)

# (b) the claim harness + (c) the carried 148 frozen-contracts drift fences.
SHELL_SUITES=(
  claim-harness/run-all-claims.sh
  run-all-148.sh
)

# (d) the standalone Part-8 sweep targets: the new 150 lib edits + connector +
# seed-writer + the cortex packet path. Each is grepped for forbidden egress.
PART8_FILES=(
  "$REPO_ROOT/lib/core/navigation/memory-cortex-packet.cjs"
  "$REPO_ROOT/lib/core/memory/reconcile-memory-runner.cjs"
  "$REPO_ROOT/lib/core/navigation/memory-artifacts.cjs"
  "$REPO_ROOT/lib/core/feynman/feynman-seed-writer.cjs"
  "$REPO_ROOT/scripts/memory-artifact-graph-hook.cjs"
)
# Forbidden user-content-to-Brain tokens: a network require, a brain-client
# require, or a fetch / http(s).request / http(s).get call in a memory-cortex
# substrate file (these files must read/write ONLY via navigation.cjs).
PART8_FORBIDDEN='require\(['"'"'"](node:)?https?['"'"'"]\)|require\(['"'"'"][^'"'"'"]*brain-client[^'"'"'"]*['"'"'"]\)|\bfetch\(|\bhttps?\.(request|get)\('

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 150 FINALIZED phase gate"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) Every 150 CJS suite.
# ---------------------------------------------------------------------------
echo "--- Group (a): the 150 CJS suites ---"
echo ""
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$c"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (b) the claim harness + (c) the carried 148 fences.
# ---------------------------------------------------------------------------
echo "--- Group (b)+(c): the claim harness + the carried 148 frozen-contracts fences ---"
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

# ---------------------------------------------------------------------------
# (d) the standalone Part-8 grep sweep over the new 150 artifacts.
# ---------------------------------------------------------------------------
echo "--- Group (d): the Part-8 cortex egress sweep (new 150 artifacts) ---"
echo ""
((TOTAL++))
echo "--- Running: part-8 sweep over the new 150 artifacts ---"
PART8_HIT=0
PART8_MISSING=0
for f in "${PART8_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    PART8_MISSING=1
    echo "    MISSING artifact: $f"
    continue
  fi
  if grep -nE "$PART8_FORBIDDEN" "$f" >/dev/null 2>&1; then
    PART8_HIT=1
    echo "    FORBIDDEN egress token in: $f"
    grep -nE "$PART8_FORBIDDEN" "$f" | sed 's/^/      /'
  fi
done
if [[ $PART8_HIT -eq 0 && $PART8_MISSING -eq 0 ]]; then
  ((PASSED++)); echo ">>> part-8 sweep: PASSED (zero forbidden egress tokens across the new 150 artifacts)"
elif [[ $PART8_MISSING -eq 1 ]]; then
  ((MISSING++)); MISSING_TESTS+=("part-8 sweep (a swept artifact is missing)")
  echo ">>> part-8 sweep: MISSING (a swept 150 artifact is absent)"
else
  ((FAILED++)); FAILED_TESTS+=("part-8 sweep (forbidden egress token)")
  echo ">>> part-8 sweep: FAILED (a forbidden user-content-to-Brain token was found)"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (150 FINALIZED phase gate)"
echo "========================================"
echo "  Total:   $TOTAL"
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Missing: $MISSING"
echo "  Time:    ${ELAPSED}s"

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "  Missing:"
  for t in "${MISSING_TESTS[@]}"; do
    echo "    - $t"
  done
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
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
echo "  Exit 0: the Phase 150 gate is green (the cortex bridge is delivered + the 148 constitution held)."
exit 0
