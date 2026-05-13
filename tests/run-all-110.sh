#!/usr/bin/env bash
# Phase 110 scoped runner -- run before each 110 task commit. Expect RED on the
# suites whose owning plan has not landed yet (see 110-VALIDATION.md):
#   GREEN once their owning plan lands (all 4 RED today; full GREEN once 110-05):
#     test-brain-packet-schema-check.cjs              -> 110-01 (PACKET-110-01 + -02)
#     test-brain-packet-validation-per-job.cjs        -> 110-05 (PACKET-110-03 + -04 + -07 + -08)
#     test-brain-packet-part8-invariant-per-job.cjs   -> 110-05 (PACKET-110-06 round-trip + D-11(d) adversarial sweep)
#     test-brain-packet-precommit-hook.cjs            -> 110-04 (PACKET-110-05 D-08 layer-2 hook)
#
# All 4 suites are RED-by-design until their owning plan lands. This runner
# MUST run to completion (no crash) even when RED suites fail; it prints a
# per-suite PASS/FAIL line. It exits non-zero if any suite failed -- which is
# EXPECTED while the downstream plans are still in flight.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-brain-packet-schema-check.cjs
  test-brain-packet-validation-per-job.cjs
  test-brain-packet-part8-invariant-per-job.cjs
  test-brain-packet-precommit-hook.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 110 scoped test runner"
echo "========================================"
echo ""

for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  ((TOTAL++))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$s (missing)"); echo ">>> $s: MISSING"; echo ""; continue
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
echo "  Summary (110 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (RED-by-design until the owning plan lands -- see header):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
