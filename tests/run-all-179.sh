#!/usr/bin/env bash
# Phase 179 verification aggregator -- the single PASS/FAIL gate for the Ignite B1
# Starting-Point Fix. Mirrors tests/run-all-178.sh.
#
# SCAFFOLD STATE (Wave 1): Plan 179-01's suite is GREEN (the GA-4 card-fire
# interceptor -- the R-1 cure). The later-wave suites (Waves 2-7: widen the
# scratchpad whitelist, the 4-door persona-first B1, the hypothesis family +
# truth-claim filing, the abstraction gate, the CV multiSelect + auto-fire Engine 1,
# reconcile the two B1 specs) are tolerated as not-yet-present (RED-by-design until
# their waves land, mirroring run-all-178.sh's scaffold-state note): each is guarded
# by a file-existence test so a missing later-wave suite is a SKIP, not a FAILURE,
# until it lands.
#
# Composes:
#   (a) Plan 179-01 (Wave 1, the GA-4 card-fire interceptor -- the R-1 cure):
#         test-ga4-card-fire-interceptor.cjs -> the deterministic predicate:
#                                               registry-keyed PRIMARY + ASCII-box
#                                               BACKSTOP, reached-no-card intercept,
#                                               non-gate negative, fired-card negative,
#                                               bounded escape (no infinite loop),
#                                               exit-2 envelope, Part 8 LOCAL sweep
#   (b) hooks.json sanity: it parses as valid JSON AND the check-card-fire interceptor
#       is registered in the Stop block (the Wave-1 wiring proof).
#   (c) later-wave suites (Waves 2-7) -> guarded; SKIP until they land.
#   (d) the CARRIED frozen-set drift fences (179 mints NO reach, NO posture, NO edge,
#       NO node): REACH_IDS length 6 unchanged is a later-wave concern; in Wave 1 the
#       aggregator asserts the interceptor suite green + hooks.json parses.
#
# bash only. No emoji. No em-dashes.

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
# run_if: run a suite only when its file exists; otherwise record a SKIP (the
# later-wave suites are RED-by-design until their waves land).
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (not yet landed -- RED-by-design until its wave)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}

# (a) Plan 179-01 Wave 1 -- the GA-4 card-fire interceptor (the R-1 cure).
run "179-01 ga4-card-fire-interceptor (W1)" node tests/test-ga4-card-fire-interceptor.cjs

# (b) hooks.json sanity: valid JSON + the check-card-fire Stop-block registration.
run "179-01 hooks.json valid JSON (W1)" \
  node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))"
run "179-01 check-card-fire registered in Stop block (W1)" \
  node -e "const h=JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8')); const s=h.hooks.Stop; const hit=s.some(b=>b.hooks.some(x=>/check-card-fire/.test(x.command))); process.exit(hit?0:1)"

# (c) later-wave suites (Waves 2-7) -- the scratchpad whitelist, the 4-door B1, the
#     hypothesis family, the abstraction gate, the CV multiSelect + auto-fire Engine 1,
#     the B1-spec reconciliation. Guarded SKIP until each lands.
run_if "179-02 scratchpad-whitelist (W2)"        tests/test-scratchpad-birth-whitelist-179.cjs node tests/test-scratchpad-birth-whitelist-179.cjs
run_if "179-03 persona-first-4-door-b1 (W3)"     tests/test-persona-first-b1-179.cjs           node tests/test-persona-first-b1-179.cjs
run_if "179-04 hypothesis-family-truth-claim (W4)" tests/test-hypothesis-blueprint-family-179.cjs node tests/test-hypothesis-blueprint-family-179.cjs
run_if "179-05 abstraction-gate (W5)"            tests/test-abstraction-gate-179.cjs           node tests/test-abstraction-gate-179.cjs
run_if "179-06 cv-multiselect-engine1 (W6)"      tests/test-cv-multiselect-179.cjs             node tests/test-cv-multiselect-179.cjs
run_if "179-07 reconcile-b1-specs (W7)"          tests/test-reconcile-b1-specs-179.cjs         node tests/test-reconcile-b1-specs-179.cjs

# (d) carried frozen-set drift fences (additive phase -- these stay GREEN; 179 mints
#     NO reach and NO posture).
[ -f tests/test-reach-ids-drift.cjs ]   && run "reach-ids-drift (frozen 6)"   node tests/test-reach-ids-drift.cjs
[ -f tests/test-posture-ids-drift.cjs ] && run "posture-ids-drift (frozen 3)" node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (179 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "  NOTE: Wave 1 (GA-4 card-fire interceptor) LANDED; later waves (2-7) SKIP until they land."
echo "========================================"
[ "$FAIL" -eq 0 ]
