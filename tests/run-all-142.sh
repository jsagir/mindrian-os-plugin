#!/usr/bin/env bash
# Phase 142 scoped runner -- run before each 142 task commit. Expect RED now
# (Wave-0 loop-fires scaffold: every suite ASSERTS THE LOOP FIRES and fails
# until its Wave-2 implementation plan lands), then GREEN once Plans 02-04 land.
# This is the Nyquist floor: every Phase 142 requirement has exactly one named
# loop-fires acceptance suite registered below. Per-suite ownership:
#   test-cascade-surface-loop-fires.cjs   -> CASC-01 (filed artifact surfaces findings via the side-channel)
#   test-spine-navigates-decide.cjs       -> CASC-02 (decide() reflects the navigated neighborhood; routing_source stays legacy)
#   test-brain-md-tier-rise.cjs           -> NAV-02  (BRAIN.md present -> brain_md_tier_mode rises above tier_0)
#   test-derivation-drain-fires.cjs       -> NAV-03  (enqueued entry is dispatched within drain, not left sitting)
#   test-post-compact-nav04-closure.cjs   -> NAV-04  (post-compact consumer wired + 95.5-VERIFICATION passed)
#   test-fileval-readback-surface.cjs     -> FILEVAL-03 (failed filing surfaces ok:false filing_did_not_land; landed filing surfaces ok:true)
#   test-decide-part8-invariant.cjs       -> Part-8 gate spanning CASC-02 (no new packet/brain egress in the wiring)
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and exits non-zero if any suite failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# Named and structured so the Phase 146 loop-fires gate (ACPT-01..05) can
# compose these suites without rework.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-cascade-surface-loop-fires.cjs
  test-spine-navigates-decide.cjs
  test-brain-md-tier-rise.cjs
  test-derivation-drain-fires.cjs
  test-post-compact-nav04-closure.cjs
  test-fileval-readback-surface.cjs
  test-decide-part8-invariant.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 142 scoped test runner"
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
echo "  Summary (142 scoped)"
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
