#!/usr/bin/env bash
# Phase 143.2 scoped runner -- the larry-operates-and-pushes prompt-reconciliation
# doctrine gate. Mirrors tests/run-all-143.sh / run-all-1431.sh exactly so the
# whole phase gate runs in ONE command.
#
# This runner is the authority the ROADMAP success criteria collapse to:
# criterion 3 (COMPOSITION HELD) is the spine -- zero new reach-ids, no egress
# regression, no softened Part-8 absolute, no user content in the MULL
# Brain-folder query, no em-dash. Criteria 1, 2, 4 + the CONV + MULL scope
# additions + the WFL-01 resolver integration all ride this gate.
#
# Per-suite ownership:
#   test-143.2-doctrine-presence.cjs   -> the OPS/PUSH(framework-name-anchored)/WFL-01/CONV/MULL
#                                         requirements landed in their target surfaces; the MULL
#                                         Part-8 enum-guard grep; zero em-dashes across 7 surfaces;
#                                         the frozen larry-extended frontmatter byte-unchanged
#   test-reach-ids-drift.cjs           -> no 6th reach-id (the composition spine; exactly-5 set)
#   test-posture-ids-drift.cjs         -> exactly-3 posture-id set held
#   test-sensors-routing-fence.cjs     -> Phase 144 fence held (no routing_source=engine in sensors)
#   test-sensors-part8-sweep.cjs       -> sensor egress paths clean (Part-8 5-tripwire)
#   ../lib/core/mullins-scaffold.test.cjs -> the MULL brain_folders + ackoff traversal + the Part-8
#                                         buildBrainFolderQuery enum-allow-list runtime boundary
#   test-push-frameworks-resolvable.cjs -> WFL-01: every push-family framework name resolves to a
#                                         NON-EMPTY command array via commandsForFramework (fails
#                                         loud on name drift)
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
  test-143.2-doctrine-presence.cjs
  test-reach-ids-drift.cjs
  test-posture-ids-drift.cjs
  test-sensors-routing-fence.cjs
  test-sensors-part8-sweep.cjs
  # The mullins-scaffold fixture test lives under lib/core/, not tests/:
  ../lib/core/mullins-scaffold.test.cjs
  # WFL-01 resolvability: every push-family framework resolves non-empty (commandsForFramework):
  test-push-frameworks-resolvable.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 143.2 scoped test runner"
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
echo "  Summary (143.2 scoped)"
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
