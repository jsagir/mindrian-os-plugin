#!/usr/bin/env bash
# Phase 191 scoped runner -- the single PASS/FAIL phase gate (D-05) for the
# Brain Orchestration Advisor (LOCAL consumption wire).
#
# Per-suite ownership:
#   orchestration-candidate-lift.test.cjs -> Wave 2 (191-02): the pure lift
#                                             module (liftFiringCandidate),
#                                             D-01/D-02/D-03 gate provenance.
#   decide-lift-wire-191.test.cjs         -> Wave 3a (191-03): decide() wires
#                                             the lift into fire_skill +
#                                             trace.projection_offer, B2 key
#                                             sets, both return paths.
#   dial-command-recommendation-191.test.cjs -> Wave 3b (191-04): the
#                                             command-recommendation folded
#                                             into and rendered on the F.7
#                                             dial (D-03 no-new-reach).
#   routing-source-flip-191.test.cjs      -> Wave 4 (191-05, D-06): the
#                                             legacy -> engine routing_source
#                                             flip proven at the router,
#                                             router byte-unchanged.
#   part8-leak-sweep-191.test.cjs         -> Wave 4 (191-05): Part-8 no-
#                                             network/no-Brain sweep, frozen
#                                             scalars, B2 shape, no-new-reach,
#                                             em-dash sweep.
#
# Runs to completion even when a suite fails; prints per-suite PASS/FAIL;
# exits non-zero if any suite failed.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
  orchestration-candidate-lift.test.cjs
  decide-lift-wire-191.test.cjs
  dial-command-recommendation-191.test.cjs
  routing-source-flip-191.test.cjs
  part8-leak-sweep-191.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 191 scoped test runner (BRAIN ORCHESTRATION ADVISOR)"
echo "========================================"
echo ""

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING"; echo ""; continue
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
echo "  Summary (191 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (see header for wave ownership):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
