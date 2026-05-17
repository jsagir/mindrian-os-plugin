#!/usr/bin/env bash
# Phase 120-02 Wave 2 scaffold harness. Verifies the scanner orchestrator +
# session-start hook + D-20 end-to-end integration test land together. Mirrors
# the Phase 120-00 + Phase 120-01 scaffold harness shape verbatim.
#
# Exit code conventions:
#   0  -> all gates pass
#   1+ -> the failing gate number (or 1 for the catch-all)
#
# Canon Part 7 reuse pattern: source-grep + node --test gates layered.
# Em-dash HARD RULE: zero U+2014 across new Phase 120-02 source files.

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

fail() {
  echo "FAIL (gate ${1}): ${2}" >&2
  exit "${1}"
}

# Gate 1: scanner.cjs declares scanForBreakthroughs at least twice (decl + export).
count_scan=$(grep -c "scanForBreakthroughs" lib/core/breakthrough/scanner.cjs || true)
if [ "${count_scan}" -lt 2 ]; then
  fail 1 "scanForBreakthroughs must appear at least twice in scanner.cjs (got ${count_scan})"
fi

# Gate 2: scanner.cjs declares surfaceBreakthrough at least twice.
count_surface=$(grep -c "surfaceBreakthrough" lib/core/breakthrough/scanner.cjs || true)
if [ "${count_surface}" -lt 2 ]; then
  fail 2 "surfaceBreakthrough must appear at least twice in scanner.cjs (got ${count_surface})"
fi

# Gate 3: scanner.cjs wires the D-13..D-15 resurfacing filter via isEligibleForSurfacing.
count_resurfacing=$(grep -c "isEligibleForSurfacing" lib/core/breakthrough/scanner.cjs || true)
if [ "${count_resurfacing}" -lt 1 ]; then
  fail 3 "scanner.cjs must wire isEligibleForSurfacing (D-13..D-15 filter; got ${count_resurfacing})"
fi

# Gate 4: scanner.cjs wires the D-19 canary throttle filter.
count_canary=$(grep -cE "computeDismissalRate|isThrottled" lib/core/breakthrough/scanner.cjs || true)
if [ "${count_canary}" -lt 1 ]; then
  fail 4 "scanner.cjs must wire the D-19 canary throttle filter (got ${count_canary})"
fi

# Gate 5: hooks/hooks.json registers the new check-pending-breakthrough hook.
count_hook=$(grep -c "check-pending-breakthrough" hooks/hooks.json || true)
if [ "${count_hook}" -lt 1 ]; then
  fail 5 "hooks/hooks.json must register check-pending-breakthrough (got ${count_hook})"
fi

# Gate 6: Canon Part 8 -- zero Brain coupling across new files.
brain_hits=$(grep -rE "require.+brain-client|fetch.+brain\.mindrian" \
  lib/core/breakthrough/scanner.cjs \
  scripts/check-pending-breakthrough.cjs \
  tests/test-breakthrough-d20-end-to-end.cjs 2>/dev/null | wc -l || true)
if [ "${brain_hits}" -ne 0 ]; then
  fail 6 "Canon Part 8 violation: ${brain_hits} Brain-coupling references in new files"
fi

# Gate 7: em-dash HARD RULE across all new files (zero U+2014).
emdash_hits=$(grep -lP "\x{2014}" \
  lib/core/breakthrough/scanner.cjs \
  scripts/check-pending-breakthrough.cjs \
  tests/test-breakthrough-d20-end-to-end.cjs \
  tests/test-120-02-scaffold.sh 2>/dev/null | wc -l || true)
if [ "${emdash_hits}" -ne 0 ]; then
  fail 7 "em-dash HARD RULE violation: ${emdash_hits} files contain U+2014"
fi

# Gate 8: D-20 end-to-end LOAD-BEARING test passes.
if ! node --test tests/test-breakthrough-d20-end-to-end.cjs > /tmp/p120-02-d20-out.log 2>&1; then
  cat /tmp/p120-02-d20-out.log >&2
  fail 8 "D-20 LOAD-BEARING end-to-end test failed"
fi

echo "OK: 120-02 scaffold complete (scanner + hook + D-20 end-to-end + zero Brain coupling + zero em-dashes)"
exit 0
