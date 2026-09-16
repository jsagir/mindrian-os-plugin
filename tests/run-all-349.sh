#!/usr/bin/env bash
# Phase 349 (release-to-Theo leading edge, graph engineering learning sync)
# verification aggregator. Modeled structurally on tests/run-all-348.sh; the
# run_red_until tripwire helper is the same idiom borrowed from
# tests/run-all-341.sh.
#
# IMPORTANT: this aggregator is written ONCE, here, in 349-01, and NO LATER
# PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file
# (tests/test-349-*.cjs); the run_if legs below and the em-dash guard's glob
# both pick up a landed file automatically. If a later plan believes it
# needs a new leg, that is a signal to re-open this file deliberately, not
# to silently patch around it.
#
# House rule: hyphens only, no em-dashes, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
REDX=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# Semantics (label, artifact-guard, cmd...):
#   guard EXISTS            -> behaves exactly like `run` (a failure is a FAIL).
#   guard ABSENT, cmd FAILS -> EXPECTED-RED, REDX++, not a FAIL. This is the
#                              honest state of a tripwire pinning a change that
#                              has not landed yet.
#   guard ABSENT, cmd PASSES -> FAILED, FAIL++. A tripwire that stops tripping
#                              while its artifact is still absent is a defect
#                              in the tripwire, not a pass.
run_red_until() {
  local label="$1"; local guard="$2"; shift 2
  echo "--- $label ---"
  if [ -f "$guard" ]; then
    if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  else
    if "$@" >/dev/null 2>&1; then
      echo ">>> $label: FAILED (tripwire passed while $guard is still absent - the tripwire is not testing what it claims)"
      FAIL=$((FAIL+1))
    else
      echo ">>> $label: EXPECTED-RED (artifact $guard not landed yet)"
      REDX=$((REDX+1))
    fi
  fi
  echo ""
}

NOTIFY_GATE="scripts/release-lib/theo-notify-gate.sh"

# --- EXPECTED-RED tripwires (NOTIFY-07, NOTIFY-08; guard: theo-notify-gate.sh) --
# Both are the phase's two load-bearing proofs, authored RED in 349-02 against
# a library that does not exist until 349-03. Their names are deliberately NOT
# repeated in the run_if list below, so each runs exactly once per aggregator
# invocation. Both tripwires will themselves error out (file not found) until
# 349-02 lands the test files; run_red_until correctly counts that as
# EXPECTED-RED rather than FAIL, which is the honest state on day one.

run_red_until "349: notify gate tripwire (NOTIFY-07)" "$NOTIFY_GATE" \
  node tests/test-349-theo-notify-gate.cjs

run_red_until "349: payload boundary tripwire (NOTIFY-08)" "$NOTIFY_GATE" \
  node tests/test-349-payload-boundary.cjs

# --- Guarded legs, one run_if per planned test file (SKIP until it lands) ---
# In wave order so a partial phase reads as a progress bar.

run_if "349: contract doc"             tests/test-349-contract-doc.cjs             node tests/test-349-contract-doc.cjs
run_if "349: release wiring"           tests/test-349-release-wiring.cjs           node tests/test-349-release-wiring.cjs
run_if "349: dry-run never sends"      tests/test-349-dry-run-never-sends.cjs      node tests/test-349-dry-run-never-sends.cjs
run_if "349: docs lockstep"            tests/test-349-docs-lockstep.cjs            node tests/test-349-docs-lockstep.cjs

# --- Unguarded regression legs (always run, must stay green all phase) -----
# This phase edits the single highest-blast-radius script in the repo, so
# these seven legs guard release infrastructure from day one, before this
# phase's own new gate exists.

run "349: syntax (tests/run-all-349.sh)"          bash -n tests/run-all-349.sh
run "349: release.sh syntax (regression)"         bash -n scripts/release.sh
run "349: theo-stamp-gate syntax (regression)"    bash -n scripts/release-lib/theo-stamp-gate.sh
run "349: 343 theo stamp gate (regression)"       node tests/test-343-theo-stamp-gate.cjs
run "349: 235 release shape gate (regression)"    node tests/test-235-release-shape-gate.cjs
run "349: doctor acceptance self-coverage (regression)" node tests/test-doctor-acceptance-self-coverage.cjs
run "349: connector registry fresh (regression)"  node scripts/build-connector-registry.cjs --check

# --- Em-dash guard (always) -------------------------------------------------
# The em-dash guard's file list. Every path this phase's own plans touch
# directly (not the generated registries they lift into). Entries that do
# not exist yet are skipped by the loop below; tests/test-349-*.cjs is
# discovered by glob, not hand-enumerated here.

PHASE_349_SURFACES=(
  "docs/THEO-NOTIFY-CONTRACT.md"
  "scripts/release-lib/theo-notify-gate.sh"
  "scripts/release.sh"
  "scripts/doctor.cjs"
  "docs/RELEASE-CEREMONY-RULING-SYSTEM.md"
  ".claude/includes/release-process.md"
  "docs/OPEN-HANDOFFS.md"
  "tests/run-all-349.sh"
)

echo "--- 349: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_349_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-349-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 349: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 349: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP EXPECTED-RED=$REDX"
echo "======================================"
if [ "$REDX" -gt 0 ]; then
  echo "EXPECTED-RED legs remain: plan 349-03 (scripts/release-lib/theo-notify-gate.sh) greens both tripwires."
fi
exit $(( FAIL > 0 ? 1 : 0 ))
