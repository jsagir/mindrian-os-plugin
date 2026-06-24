#!/usr/bin/env bash
# Phase 178 verification aggregator -- the single PASS/FAIL gate for the
# Born-Wired Render-Coverage Gate. Mirrors tests/run-all-177.sh.
#
# SCAFFOLD STATE (Wave 1): Plan 178-01's suites are GREEN (the render-coverage
# registry + the exhaustiveness FLOOR). The later-wave suites (178-02 the
# deterministic predicate + the FLOOR/hard-fail test; 178-03 the wiring
# assertions + the F.7-dial gap=0 confirmation; 178-04 the R15 FLOOR + the R-1
# spike) are tolerated as not-yet-present (RED-by-design until their waves land,
# mirroring run-all-177.sh's shadow-before-trust note): each is guarded by a
# file-existence test so a missing later-wave suite is a SKIP, not a FAILURE,
# until it lands.
#
# Composes:
#   (a) Plan 178-01 (Wave 1, render-coverage registry + exhaustiveness floor):
#         test-render-registry-build.cjs       -> the registry is minted, 15
#                                                  entry points, two-state, the
#                                                  F.7-dial entry card-emission,
#                                                  --check byte-stable
#         test-render-registry-exhaustive.cjs  -> the EXHAUSTIVENESS FLOOR: a
#                                                  code-present-but-registry-absent
#                                                  pickShape call site FAILS the
#                                                  build (R-3 dissolved)
#   (b) Plan 178-02 (deterministic predicate + FLOOR/hard-fail) [later wave]:
#         test-check-render-coverage*.cjs       -> guarded; SKIP until it lands
#   (c) Plan 178-03 (wiring + F.7-dial gap=0 confirmation) [later wave]:
#         test-render-coverage-wiring*.cjs      -> guarded; SKIP until it lands
#   (d) Plan 178-04 (R15 FLOOR + R-1 spike) [later wave]:
#         test-render-coverage-r15*.cjs         -> guarded; SKIP until it lands
#   (e) the CARRIED frozen-set drift fences (178 mints NO reach, NO posture):
#         test-reach-ids-drift.cjs     -> frozen 6 reach_ids (no 7th)
#         test-posture-ids-drift.cjs   -> frozen 3 postures (no 4th)
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

# (a) Plan 178-01 Wave 1 -- the render-coverage registry + the exhaustiveness floor.
run "178-01 render-registry-build (W1)"       node tests/test-render-registry-build.cjs
run "178-01 render-registry-exhaustive (W1)"  node tests/test-render-registry-exhaustive.cjs

# (b)(c)(d) later-wave suites -- tolerated as not-yet-present.
run_if "178-02 check-render-coverage (W2)" tests/test-check-render-coverage.cjs node tests/test-check-render-coverage.cjs
run_if "178-03 render-coverage-wiring (W3)" tests/test-render-coverage-wiring.cjs node tests/test-render-coverage-wiring.cjs
run_if "178-04 render-coverage-r15 (W4)"    tests/test-render-coverage-r15.cjs   node tests/test-render-coverage-r15.cjs

# (e) carried frozen-set drift fences (additive phase -- these stay GREEN; 178
#     mints NO reach and NO posture).
[ -f tests/test-reach-ids-drift.cjs ]   && run "reach-ids-drift (frozen 6)"   node tests/test-reach-ids-drift.cjs
[ -f tests/test-posture-ids-drift.cjs ] && run "posture-ids-drift (frozen 3)" node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (178 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "  NOTE: 178-02/03/04 suites are RED-by-design (SKIPPED) until their waves land."
echo "========================================"
[ "$FAIL" -eq 0 ]
