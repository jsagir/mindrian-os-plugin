#!/usr/bin/env bash
# Phase 141 scoped runner -- run before each 141 task commit. Expect RED now
# (Wave-0 scaffold: every suite fails until its implementation plan lands in
# Waves 1-2), then GREEN once all plans land. Per-suite ownership:
#   test-get-room-context.cjs               -> RETR-01 (3-leg fusion shape + raw prose)
#   test-retrieval-seed.cjs                 -> RETR-02 (per-turn LOCAL seed wiring)
#   test-room-context-part8-invariant.cjs   -> RETR-03 (adversarial Part-8 sweep)
#   test-room-context-latency.cjs           -> RETR-04 (1200ms budget on fixture)
#   test-capability-dial-committed.cjs      -> LARRY-01/02 + DRSCH (HEAD + frontmatter + CHANGELOG)
#   test-reach-ids-drift.cjs                -> LARRY-03 (exactly-5 reach-id drift)
#   test-posture-ids-drift.cjs              -> LARRY-04 (exactly-3 posture-id drift)
#   test-fileval-readback.cjs               -> FILEVAL-02 (read-back wrapper + artifact_path)
#   test-build-graph-guard.cjs              -> BUG-01 (build-graph exit-0 no-room-db regression)
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and exits non-zero if any suite failed.
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
  test-get-room-context.cjs
  test-retrieval-seed.cjs
  test-room-context-part8-invariant.cjs
  test-room-context-latency.cjs
  test-capability-dial-committed.cjs
  test-reach-ids-drift.cjs
  test-posture-ids-drift.cjs
  test-fileval-readback.cjs
  test-build-graph-guard.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 141 scoped test runner"
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
echo "  Summary (141 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (see header for plan ownership):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
