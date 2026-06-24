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
#   (b) Plan 178-02 (deterministic predicate + FLOOR/hard-fail) [LANDED, Wave 2]:
#         test-check-render-coverage.cjs        -> the C-2 deterministic predicate:
#                                                  XOR classify covered/excluded/gap,
#                                                  gap=0 live baseline, --check exit 0,
#                                                  no inference / network in the gate
#         test-render-coverage-gate-hardfail.cjs-> the C-3 FLOOR: a synthesized dark
#                                                  render entry trips the gate RED;
#                                                  excluded-with-reason is conformant;
#                                                  the live repo is GREEN
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

# (b) Plan 178-02 Wave 2 -- the deterministic card-emission predicate + the
#     FLOOR/hard-fail adversarial test (now LANDED; real runs, not guarded SKIPs).
run "178-02 check-render-coverage (W2)"        node tests/test-check-render-coverage.cjs
run "178-02 render-coverage-gate-hardfail (W2)" node tests/test-render-coverage-gate-hardfail.cjs

# (c) Plan 178-03 Wave 3 -- the F.7-dial gap=0 confirmation (Task 1, host-appended
#     via the PRODUCTION engine arm; dial-selector.cjs byte-unchanged) + the
#     four-enforcement-surface wiring proof (Task 2; HARD-FAIL, not WARN). Both
#     land in Wave 3 (real runs once present; guarded SKIP until they land).
run_if "178-03 f7-dial-gap-zero-confirm (W3)" tests/test-f7-dial-gap-zero-confirm.cjs node tests/test-f7-dial-gap-zero-confirm.cjs
run_if "178-03 render-gate-wiring (W3)"       tests/test-render-gate-wiring.cjs       node tests/test-render-gate-wiring.cjs

# (d) Plan 178-04 Wave 4 (final) -- the CIRS R15 (Render Coverage) FLOOR test (the
#     render-plane peer of R2 + R9; canon Part 11 R15 membership + R1-R14 preserved +
#     frozen-set + the byte-stable counting contract + a reachable-undeclared-surface
#     negative, never .size) + the GA-4 R-1 PostToolUse-interceptor spike (the honest
#     FEASIBLE/INFEASIBLE/PARTIAL verdict; R-1 stays a named, accepted debt). Both
#     LANDED in Wave 4 (real runs).
run "178-04 cirs-render-coverage-floor (W4)"      node tests/test-cirs-render-coverage-floor.cjs
run "178-04 r1-posttooluse-interceptor-spike (W4)" node tests/test-r1-posttooluse-interceptor-spike.cjs

# (e) carried frozen-set drift fences (additive phase -- these stay GREEN; 178
#     mints NO reach and NO posture).
[ -f tests/test-reach-ids-drift.cjs ]   && run "reach-ids-drift (frozen 6)"   node tests/test-reach-ids-drift.cjs
[ -f tests/test-posture-ids-drift.cjs ] && run "posture-ids-drift (frozen 3)" node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (178 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "  NOTE: all four waves LANDED (W1 registry+floor, W2 predicate+hardfail, W3 wiring+F.7-dial, W4 R15 floor + R-1 spike)."
echo "========================================"
[ "$FAIL" -eq 0 ]
