#!/usr/bin/env bash
# Phase 155 phase gate -- Ignite Flow Wave 1.
#
# ONE green command proving (by instrumentation, not by promise -- Canon Part 6
# dog-fooding) what this gate PROVES (Canon Part 6 / GAP-1):
#
#   "The B2 gate and scratchpad journaling half of the birth contract cannot go
#    green through bare prose or a key-dropping re-read."
#
# Specifically:
#   - The bare-prose Canon Part 3 violation at new-project.md:103 is GONE
#     and replaced by a proper F.0 B2 blueprint gate with nugget routing table
#     and Tri-Polar degradation script.
#   - scratchpad.json accepts a birth_gate_answers key that survives
#     readScratchpad() re-normalization WITHOUT loss (RESEARCH Pitfall 2 closed).
#   - writeScratchpadBirthAnswer() journals typed entries under birth_gate_answers.
#   - drainBirthGateAnswers is exported (Plan 02 fills the body).
#
# This aggregator is extended by later plans (155-02 through 155-06) to cover
# the full Ignite Flow birth contract.
#
# Structure mirrors run-all-150.5.sh: CJS suites, then shell suites, pass/fail tally.
# Exits non-zero if any suite failed OR is missing. SKIP-77 tolerated (treated as PASS).
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

# Wave-1 + Wave-2 + Wave-3 CJS suites
CJS_SUITES=(
  test-new-project-b2-gate.cjs
  test-scratchpad-birth-answers.cjs
  test-memory-events-birth-floor.cjs
  test-room-birth.cjs
  test-mva-from-brief.cjs
)

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 155 phase gate (Wave 1 + Wave 2 + Wave 3)"
echo "========================================"
echo ""

echo "--- Wave-4 static checks ---"
echo ""

STATIC_CHECKS_PASS=true
echo "--- Running: check-room-blueprints.cjs --check ---"
node "$SCRIPT_DIR/../scripts/check-room-blueprints.cjs" --check
if [[ $? -ne 0 ]]; then
  echo ">>> check-room-blueprints.cjs --check: FAILED"
  STATIC_CHECKS_PASS=false
else
  echo ">>> check-room-blueprints.cjs --check: PASSED"
fi
echo ""

echo "--- Wave-1 + Wave-2 + Wave-3 CJS suites ---"
echo ""

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$c"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  # SKIP-77 tolerated: node:sqlite unavailable environments exit 77; treat as pass.
  node "$p"; EXIT_CODE=$?
  if [[ $EXIT_CODE -eq 0 || $EXIT_CODE -eq 77 ]]; then
    if [[ $EXIT_CODE -eq 77 ]]; then
      echo ">>> $c: SKIPPED (SKIP-77)"
    else
      ((PASSED++)); echo ">>> $c: PASSED"
    fi
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED (exit $EXIT_CODE)"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (Phase 155 phase gate Wave 1 + Wave 2 + Wave 3)"
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

if [[ "$STATIC_CHECKS_PASS" == "false" ]]; then
  echo "  Wave-4 static checks: FAILED"
  echo "========================================"
  exit 1
fi

echo "========================================"
echo "  Exit 0: the Phase 155 Wave-1 + Wave-2 + Wave-3 + Wave-4 gate is green (B2 gate + scratchpad + EVENT_TYPES floor + birth transaction + mva option 2 unstubbed + room-blueprints CI check)."
exit 0
