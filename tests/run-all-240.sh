#!/usr/bin/env bash
# Phase 240 verification aggregator: the single PASS/FAIL gate for
# "memory: JTBD Layer 2 promotion, memory-cortex survival, test hermeticity".
#
# (1) DISCOVERY IS BY GLOB, NOT BY LIST. This harness globs every
# tests/test-240-* file (both .cjs and .sh) and runs it. Adding a Phase 240
# test requires NO edit to this runner. There is deliberately no
# hand-maintained execution list anywhere below: a list is a second place to
# forget something.
#
# (2) THE FOUR MANDATORY TEST FILENAMES, enumerated by name so a missing one
# is visible by READING this header even though the glob does the actual
# discovery. Each is tagged with the requirement it proves and the plan that
# lands it:
#
#   test-240-memory-store-hermetic-fence.sh       MEM-03   plan 240-02
#   test-240-jtbd-manual-override-roundtrip.cjs    MEM-01   plan 240-03
#   test-240-jtbd-continuous-promotion.cjs         MEM-01   plan 240-04
#   test-240-jtbd-event-survives-rebuild.cjs       MEM-02   plan 240-05
#
# A test named above that is missing from disk is NOT reported by this runner
# as a failure, because a file that does not exist cannot be globbed. That is
# the honest limitation of glob discovery and the reason the names are
# written out here: the header is the checklist, the glob is the executor.
# What the runner DOES catch, loudly, is the case where NOTHING at all is
# discovered.
#
# (3) THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A
# harness that discovers nothing must FAIL, not print green. A clean summary
# over an empty discovery is the same false-success shape this milestone
# exists to close. Until the first tests/test-240-* file lands, this harness
# legitimately exits 1 -- that is the guard working exactly as designed
# (Resolution R-02), not a defect in this file.
#
# (4) THIS FILE IS NOT YET COMPLETE AT THE END OF PLAN 240-01. Plan 240-04
# appends two further source-tripwire legs (reachability + counter-persistence)
# after it lands the MEM-01 fix they guard. A tripwire that is red for two
# waves would make wave-merge verification unreadable, so those legs are
# deliberately deferred rather than added here. The leg list below is
# therefore not final until Wave 3.
#
# run_may_skip is REQUIRED for Phase 240 (unlike Phase 236, which had no .sh
# leg): tests/test-240-memory-store-hermetic-fence.sh is a bash fence and may
# legitimately self-SKIP on environment. An environment self-skip is tallied
# as SKIP, never as a pass it did not earn.
#
# TRI-POLAR DAEMON-PARITY GATE (added by plan 240-01 Task 2, closing
# 240-RESEARCH.md Assumption A7 / Open Question Q4 as CLOSED-CLEAN per
# Resolution R-01). lib/mcp/ is the MINDRIAN_MCP_FIRST daemon path; a JTBD
# trigger fix landing only in the hook path while the daemon path carries a
# divergent copy would repeat the Phase 241-05 shape (the shared
# mindrian-core Stop path was blind on all three surfaces). Measured at
# planning time: grep -rln 'jtbd' lib/mcp/ returns ZERO hits, so there is no
# divergent trigger copy today. This gate turns that dated observation into a
# standing, self-proving check rather than a grep buried in a doc.
#
# Every leg in this file is fully hermetic and makes ZERO network reach. No
# emoji. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# A leg that may legitimately self-SKIP on environment. Exit 0 plus a SKIP
# line is tallied as SKIP, not as a pass it did not earn.
run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

# Strip whole-line comments (// or block-comment body lines, and # for
# python/sh) so header prose can neither trip a grep nor satisfy one.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*|#)' "$1" 2>/dev/null
}

shopt -s nullglob
found=0
for t in tests/test-240-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-240-*.sh; do
  found=1
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no tests/test-240-* files discovered"
  exit 1
fi

echo "======================================"
echo "Phase 240: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
