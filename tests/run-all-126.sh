#!/usr/bin/env bash
# Phase 126 scoped runner -- run before each 126 task commit. Expect GREEN
# once all plans land (each plan adds its own test suite here):
#   test-doctor-fix-renderer.cjs                  -> Plan 126-01 (--fix renderer contract test + fix)
#   test-marketplace-cache-prerelease-pick.cjs    -> Plan 126-02 (semver prerelease ordering)
#   test-doctor-acceptance-self-coverage.cjs      -> Plan 126-03 (acceptance-gate self-coverage)
#   test-release-bump-tag-and-publish-gates.cjs   -> Plan 126-04 (tag-push + install-minisite HARD + npx-publish self-test)
#   test-doctor-acceptance-preflight-checks.cjs   -> Plan 126-05 (5 release-flight preflight checks)
#   test-cache-prune-extended.cjs                 -> Plan 126-06 (stale-backup prune window)
#   test-install-state-migration.cjs              -> Plan 126-07 (v1->v2 migration)
#
# Plan 126-04 landed its CJS_SUITES entry in Wave 3.
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
  test-doctor-fix-renderer.cjs
  test-marketplace-cache-prerelease-pick.cjs
  test-doctor-acceptance-self-coverage.cjs
  test-release-bump-tag-and-publish-gates.cjs
  test-doctor-acceptance-preflight-checks.cjs
  test-cache-prune-extended.cjs
  test-install-state-migration.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 126 scoped test runner"
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
echo "  Summary (126 scoped)"
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
