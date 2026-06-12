#!/usr/bin/env bash
# Phase 150.8 phase gate -- meeting micro-knowledge DIKW filing v1.
# ONE green command (the gate Plans 02/03/04 extend).
#
# What this PROVES (by instrumentation, not by promise -- Canon Part 6
# dog-fooding): the DIKW ladder can NEVER go green through a file-level-only
# claim path. The Wave-0 drivers assert the net-new typed-claim substrate the
# whole ladder stands on:
#
#   test-typed-claim-writer.cjs        (Plan 01 / DIKW-01) writeClaimNode mints
#           type='claim' review_status='proposed' (NEVER confirmed, Part 9
#           role 5); the frozen 6-member KNOWLEDGE_TYPES enum gate rejects
#           off-enum types; idempotent no-downgrade UPSERT; re-export identity.
#   test-temporal-validity.cjs         (Plan 01 / DIKW-03) conditions /
#           counter_conditions / valid_from / valid_until + provenance + the
#           AMB-01 disambiguation marker round-trip as ADDITIVE JSON props with
#           ZERO DDL change (review_status stays the only CHECK-constrained col).
#   test-segment-aware-filing-guard.cjs (Plan 01 / DIKW-02) the GATE-0
#           consequence honored: extraction is the segmentation authority, so a
#           K-segment transcript mints K claim nodes -- claim count tracks
#           SEGMENT count, never collapses to the FILE count (the GATE-0
#           warning sign is the FAILING condition).
#
# Frozen surfaces this gate defends (carried, unchanged this phase): MAX_K=3,
# DIAL_REACH_K=6, the 0.70/0.15 recommend gate, the 6-reach bank, the 3
# postures, zero Brain egress delta -- proven green by the carried run-all-150.sh.
#
# This runner MUST run to completion (no crash) even when a suite fails; it
# prints a per-suite PASS/FAIL/MISSING line + a final tally. It exits non-zero
# if any suite failed OR is missing. SKIP (exit 77) is tolerated as PASS.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

# The Wave-0 DIKW substrate drivers (Plan 01). Plans 02/03/04 append here.
CJS_SUITES=(
  test-typed-claim-writer.cjs
  test-temporal-validity.cjs
  test-segment-aware-filing-guard.cjs
  test-edges-refines-rootcauses-instantiates-floor.cjs
  test-ambiguous-queue.cjs
  test-check-pending-ambiguous.cjs
)

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 150.8 phase gate"
echo "========================================"
echo ""

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$c"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  node "$p"
  rc=$?
  if [[ $rc -eq 0 || $rc -eq 77 ]]; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (150.8 phase gate)"
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
echo "  Exit 0: the Phase 150.8 gate is green (the typed-claim substrate holds + temporal validity round-trips + the segment-authority seam honors the GATE-0 verdict)."
exit 0
