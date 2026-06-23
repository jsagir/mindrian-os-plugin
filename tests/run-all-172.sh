#!/usr/bin/env bash
# Phase 172 verification aggregator -- the single PASS/FAIL gate proving the
# CIRS R1/R9 gate substrate: the EXCLUDE state + the wired-XOR-excluded coverage
# ledger + the warn-only gap report.
#
# Mirrors tests/run-all-1433.sh: a bash PASS/FAIL loop that runs each constituent
# to completion and exits non-zero if any failed.
#
# It composes:
#   (a) the CI tripwire as a direct invocation (registry not stale + ledger not
#       stale + the four CONN-03 validations + the warn-only gap report):
#         node scripts/build-connector-registry.cjs --check
#   (b) the CJS suites:
#         test-connector-coverage-ledger.cjs  -> Phase 172-01 ledger XOR + EXCLUDE
#         test-connector-tripwire.cjs          -> the carried four-validation tripwire
#   (c) the CARRIED frozen-bank drift fences (172 is ADDITIVE -- no frozen-set move):
#         test-reach-ids-drift.cjs             -> frozen 6 reach_ids (no 7th)
#         test-posture-ids-drift.cjs           -> frozen 3 postures (no 4th)
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
  test-connector-coverage-ledger.cjs
  test-connector-tripwire.cjs
  test-reach-ids-drift.cjs
  test-posture-ids-drift.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 172 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The CI tripwire -- direct invocation (registry + ledger must not be stale;
#     every connector must pass the four CONN-03 validations; gaps WARN only).
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector-registry --check (CI tripwire) ---"
if node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check; then
  ((PASSED++)); echo ">>> connector-registry --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector-registry --check"); echo ">>> connector-registry --check: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (b) + (c) The CJS suites + the carried frozen-bank drift fences.
# ---------------------------------------------------------------------------
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
echo "  Summary (172 verification)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
