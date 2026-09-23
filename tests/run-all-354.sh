#!/usr/bin/env bash
# Phase 354 (System Integrity and Theo Integration) verification aggregator.
#
# Modeled on tests/run-all-353.sh (the run/run_if/counter shape, the guarded
# per-planned-test-file idiom, the targeted em-dash guard).
#
# IMPORTANT: this aggregator is written ONCE, here, in 354-01. NO LATER PLAN
# in this phase edits it. A later plan adds its own test file
# (tests/test-354-*.cjs); the run_if legs below pick up a landed file
# automatically because each leg already names its guard file. If a later
# plan believes it needs a new leg not already listed below, that is a
# signal to re-open this file deliberately, not to silently patch around it.
#
# exit 0  -> PASSED
# exit 77 -> SKIPPED (ENV GAP), never reported as PASSED
# anything else -> FAILED
#
# House rule: hyphens only, no em-dashes, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  fi
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

# --- Guarded legs, one run_if per planned test file, wave order --------------
# (SYS-08) gate subject promotion
run_if "354: gate subject promotion (SYS-08)"        tests/test-354-gate-subject-promotion.cjs   node tests/test-354-gate-subject-promotion.cjs
# (SYS-09) chain resume identity
run_if "354: chain resume identity (SYS-09)"          tests/test-354-chain-resume-identity.cjs    node tests/test-354-chain-resume-identity.cjs
# (SYS-02) write-lock ownership
run_if "354: write-lock ownership (SYS-02)"           tests/test-354-write-lock-ownership.cjs     node tests/test-354-write-lock-ownership.cjs
# (SYS-01) room symlink containment
run_if "354: room symlink containment (SYS-01)"       tests/test-354-room-symlink-containment.cjs node tests/test-354-room-symlink-containment.cjs
# (THEO-03) egress typed question
run_if "354: egress typed question (THEO-03)"         tests/test-354-egress-typed-question.cjs    node tests/test-354-egress-typed-question.cjs
# (SYS-03) chat inert render
run_if "354: chat inert render (SYS-03)"              tests/test-354-chat-inert-render.cjs        node tests/test-354-chat-inert-render.cjs
# (SYS-06) POC save origin
run_if "354: POC save origin (SYS-06)"                tests/test-354-poc-save-origin.cjs          node tests/test-354-poc-save-origin.cjs
# (SYS-06 adjacent) dashboard Host read
run_if "354: dashboard Host read (SYS-06 adjacent)"   tests/test-354-dashboard-host-read.cjs      node tests/test-354-dashboard-host-read.cjs
# (THEO-01) Theo router contract
run_if "354: Theo router contract (THEO-01)"          tests/test-354-theo-router-contract.cjs     node tests/test-354-theo-router-contract.cjs
# (THEO-01) framework command ledger (Jev recall extension)
run_if "354: framework command ledger (THEO-01)"      tests/test-354-framework-command-ledger.cjs node tests/test-354-framework-command-ledger.cjs
# (THEO-01) taxonomy ladder casing
run_if "354: taxonomy ladder casing (THEO-01)"        tests/test-354-taxonomy-ladder-casing.cjs   node tests/test-354-taxonomy-ladder-casing.cjs
# (SYS-06) POC room journey
run_if "354: POC room journey (SYS-06)"               tests/test-354-poc-room-journey.cjs         node tests/test-354-poc-room-journey.cjs
# (THEO-03) Theo journey
run_if "354: Theo journey (THEO-03)"                  tests/test-354-theo-journey.cjs             node tests/test-354-theo-journey.cjs
# (THEO-01/THEO-03 live) Theo live contract -- SKIPs without MINDRIAN_354_LIVE=1
run_if "354: Theo live contract (THEO-01/THEO-03 live)" tests/test-354-theo-live-contract.cjs     node tests/test-354-theo-live-contract.cjs
# (SYS-07) acceptance diagnostics
run_if "354: acceptance diagnostics (SYS-07)"         tests/test-354-acceptance-diagnostics.cjs   node tests/test-354-acceptance-diagnostics.cjs
# (SYS-04) registration diagnostics
run_if "354: registration diagnostics (SYS-04)"       tests/test-354-registration-diagnostics.cjs node tests/test-354-registration-diagnostics.cjs
# (SYS-05) extract_shallow contract
run_if "354: extract_shallow contract (SYS-05)"       tests/test-354-extract-shallow-contract.cjs node tests/test-354-extract-shallow-contract.cjs
# (acceptance close-out) concurrency surfaces
run_if "354: concurrency surfaces (close-out)"        tests/test-354-concurrency-surfaces.cjs     node tests/test-354-concurrency-surfaces.cjs

# --- Em-dash guard (always) --------------------------------------------------
# The non-test files Phase 354 plans modify directly, named explicitly; a
# missing file is skipped, never an error. Plus a targeted glob of landed
# tests/test-354-*.cjs, the two shared helpers, and this aggregator itself.

echo "--- 354: em-dash guard ---"
EMDASH_HIT=0
PHASE_354_SURFACES=(
  "lib/mcp/tools/gate.cjs"
  "lib/core/chain-executor.cjs"
  "lib/core/write-lock.cjs"
  "lib/mcp/tool-router.cjs"
  "lib/mcp/tools/views.cjs"
  "lib/mcp/resources.cjs"
  "lib/mcp/brain-router.cjs"
  "lib/core/brain-client.cjs"
  "lib/core/part8-egress-guard.cjs"
  "lib/core/strategy/rung-vocabulary.cjs"
  "lib/core/strategy/taxonomy-climb.cjs"
  "lib/chat/chat-panel.js"
  "docs/reviews/localhost-poc/app.js"
  "docs/reviews/localhost-poc/server.cjs"
  "lib/mcp/register-core-tools.cjs"
  "lib/mcp/tools/dual-path.cjs"
  "agents/larry-extended.md"
  "scripts/doctor.cjs"
  "CLAUDE.md"
)
EMDASH_FILES=("${PHASE_354_SURFACES[@]}" "tests/run-all-354.sh" "tests/helpers/fixture-room-354.cjs" "tests/helpers/playwright-354.cjs")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-354-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 354: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 354: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP"
exit $(( FAIL > 0 ? 1 : 0 ))
