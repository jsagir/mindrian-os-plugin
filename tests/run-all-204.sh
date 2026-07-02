#!/usr/bin/env bash
# Phase 204 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# ignite-room-chooser-persona-entry cluster. Models on tests/run-all-188.sh.
#
# Phase 204 gives Ignite its front door: a room-chooser card (resume a prior
# room), a bounded "Just talk (no room)" entry, a persona register, and the
# guarantee that every branch renders through the Phase 188 selector-dispatcher
# door (SEED-020) rather than a bespoke widget.
#
# WAVE 1 / WAVE 2 SPLIT: this runner is authored in Wave 1 alongside the
# room-chooser adapter (Plan 204-01). Wave 1 lands ONE test that MUST be green
# now -- the room-chooser adapter unit test. The three remaining legs are
# run_if (SKIP-safe until the file exists): they are created by LATER waves and
# this plan must NOT assume they exist yet:
#   - tests/test-204-session-register.cjs      (Plan 204-02, persona register)
#   - tests/test-204-ignite-wiring-grep.cjs    (Plan 204-03, ignite.md wiring)
#   - tests/test-204-ignite-branch-gate.cjs    (Plan 204-04, branch gate)
# Missing test files SKIP, they do not FAIL. As the Wave 2 plans land, each SKIP
# flips to a run and the gate tightens. Plan 204-04 has landed: the branch-gate
# leg below is now a HARD run (all four legs run, zero skips).
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
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}

# ---------------------------------------------------------------------------
# WAVE 1 (this plan): the room-chooser adapter + F.1 card builder. This test
# ships in Plan 204-01, so it is a HARD run -- it must be green now.
# ---------------------------------------------------------------------------
run "204 room-chooser (adapter + F.1 card builder)" \
  node tests/test-204-room-chooser.cjs

# ---------------------------------------------------------------------------
# WAVE 2 legs (later plans). run_if -- SKIP-safe until each file lands.
# ---------------------------------------------------------------------------
run_if "204 persona session register (Plan 204-02)" \
  tests/test-204-session-register.cjs \
  node tests/test-204-session-register.cjs

run_if "204 ignite wiring grep (Plan 204-03)" \
  tests/test-204-ignite-wiring-grep.cjs \
  node tests/test-204-ignite-wiring-grep.cjs

run "204 ignite branch gate (Plan 204-04)" \
  node tests/test-204-ignite-branch-gate.cjs

echo "========================================"
echo "  Summary (204 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
