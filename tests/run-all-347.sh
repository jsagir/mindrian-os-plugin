#!/usr/bin/env bash
# Phase 347 (the shared-state contract for chains, graph-engineering learn 5:
# typed room-graph state on every chain edge, scoped context per node, explicit
# readable routing, reviewer never the worker) verification aggregator.
# Modeled on tests/run-all-344.sh; the run_red_until tripwire helper is
# borrowed from tests/run-all-341.sh. bash only.
#
# IMPORTANT: this aggregator is written ONCE, here, in 347-01, and NO LATER
# PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file
# (tests/test-347-*.cjs); the run_if legs below and the em-dash guard's glob
# both pick up a landed file automatically. If a later plan believes it needs
# a new leg, that is a signal to re-open this file deliberately, not to
# silently patch around it.
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
    if "$@"; then
      echo ">>> $label: FAILED (tripwire passed while $guard is still absent - the tripwire is not testing what it claims)"
      FAIL=$((FAIL+1))
    else
      echo ">>> $label: EXPECTED-RED (artifact $guard not landed yet)"
      REDX=$((REDX+1))
    fi
  fi
  echo ""
}

CHAIN_STATE_WRITER="lib/core/navigation/chain-state.cjs"

# The em-dash guard's file list. Every path this phase's own plans touch
# directly (not the generated registries they lift into). Entries that do
# not exist yet are skipped by the loop below; tests/test-347-*.cjs and
# tests/helpers/fixture-room-347.cjs are discovered by glob, not
# hand-enumerated here.
PHASE_347_SURFACES=(
  "docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md"
  "lib/core/navigation/chain-state.cjs"
  "lib/core/navigation.cjs"
  "lib/core/chain-executor.cjs"
  "lib/core/chain-step-dispatcher.cjs"
  "lib/core/navigation/room-context.cjs"
  "lib/mcp/tools/context.cjs"
  "lib/mcp/tools/chain.cjs"
  "lib/mcp/pipeline-state.cjs"
  "lib/mcp/tool-router.cjs"
  "lib/core/visual-ops.cjs"
  "lib/workflow/command-resolver.cjs"
  "agents/chain-step-reviewer.md"
  "commands/file-meeting.md"
  "tests/run-all-347.sh"
)

# --- Always-green regression legs -------------------------------------------

run "347: syntax (tests/run-all-347.sh)" bash -n "tests/run-all-347.sh"
run "347: chain-executor loop (regression)"        node tests/test-chain-executor-loop.cjs
run "347: chain-executor gate (regression)"        node tests/test-chain-executor-gate.cjs
run "347: chain-executor verdict (regression)"     node tests/test-chain-executor-verdict.cjs
run "347: chain-executor fable-mode (regression)"  node tests/test-chain-executor-fable-mode.cjs
run "347: chain graceful partial (regression)"     node tests/test-chain-graceful-partial.cjs
run "347: chain retry backoff (regression)"        node tests/test-chain-retry-backoff.cjs
run "347: chain-executor part8 leak (regression)"  node tests/test-chain-executor-part8-leak.cjs
run "347: 237 dispatcher tiers (regression)"        node tests/test-237-dispatcher-tiers.cjs
run "347: 238 one ledger (regression)"              node tests/test-238-one-ledger.cjs
run "347: 198 chain-run halt (regression)"          node tests/test-198-chain-run-halt.test.cjs
run "347: act on runChain (regression)"             node tests/test-act-on-runchain.cjs
run "347: pipeline on runChain (regression)"        node tests/test-pipeline-on-runchain.cjs
run "347: 254 one chain source (regression)"        node tests/test-254-one-chain-source.cjs

# --- EXPECTED-RED tripwires (SHARED-01/SHARED-02, guard: chain-state.cjs) ---
# Both guarded on the writer module landing in plan 347-03. Placed BEFORE the
# run_if legs for the same two files; those two names are deliberately
# removed from the run_if list below so each test file runs exactly once
# per aggregator invocation.

run_red_until "347: chain-state writer tripwire (SHARED-01)" "$CHAIN_STATE_WRITER" \
  node tests/test-347-chain-state-writer.cjs
run_red_until "347: reconstructibility tripwire (SHARED-02)" "$CHAIN_STATE_WRITER" \
  node tests/test-347-reconstructible.cjs

# --- Guarded legs, one run_if per planned test file (SKIP until it lands) ---

run_if "347: layer graph declaration"       tests/test-347-layer-graph-declaration.cjs       node tests/test-347-layer-graph-declaration.cjs
run_if "347: chokepoint fence"              tests/test-347-chokepoint-fence.cjs              node tests/test-347-chokepoint-fence.cjs
run_if "347: chain state kinds"             tests/test-347-chain-state-kinds.cjs             node tests/test-347-chain-state-kinds.cjs
run_if "347: record per step"               tests/test-347-record-per-step.cjs               node tests/test-347-record-per-step.cjs
run_if "347: projection precedence"         tests/test-347-projection-precedence.cjs         node tests/test-347-projection-precedence.cjs
run_if "347: dispatcher reads projection"   tests/test-347-dispatcher-reads-projection.cjs   node tests/test-347-dispatcher-reads-projection.cjs
run_if "347: context focus"                 tests/test-347-context-focus.cjs                 node tests/test-347-context-focus.cjs
run_if "347: ranked set exclusion"          tests/test-347-ranked-set-exclusion.cjs          node tests/test-347-ranked-set-exclusion.cjs
run_if "347: routing floor"                 tests/test-347-routing-floor.cjs                 node tests/test-347-routing-floor.cjs
run_if "347: routing shapes"                tests/test-347-routing-shapes.cjs                node tests/test-347-routing-shapes.cjs
run_if "347: fanout delegation"             tests/test-347-fanout-delegation.cjs             node tests/test-347-fanout-delegation.cjs
run_if "347: backedge bound"                tests/test-347-backedge-bound.cjs                node tests/test-347-backedge-bound.cjs
run_if "347: resume nonlinear"              tests/test-347-resume-nonlinear.cjs              node tests/test-347-resume-nonlinear.cjs
run_if "347: visualize real chain"          tests/test-347-visualize-real-chain.cjs          node tests/test-347-visualize-real-chain.cjs
run_if "347: reviewer not worker"           tests/test-347-reviewer-not-worker.cjs           node tests/test-347-reviewer-not-worker.cjs
run_if "347: reviewer honesty"              tests/test-347-reviewer-honesty.cjs              node tests/test-347-reviewer-honesty.cjs
run_if "347: meeting fanout records"        tests/test-347-meeting-fanout-records.cjs        node tests/test-347-meeting-fanout-records.cjs

# --- Em-dash guard (always) -------------------------------------------------

echo "--- 347: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_347_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-347-*.cjs' -print0 2>/dev/null)
if [ -f "tests/helpers/fixture-room-347.cjs" ]; then
  EMDASH_FILES+=("tests/helpers/fixture-room-347.cjs")
fi
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 347: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 347: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP EXPECTED-RED=$REDX"
echo "======================================"
if [ "$REDX" -gt 0 ]; then
  echo "EXPECTED-RED legs remain: plan 347-03 (lib/core/navigation/chain-state.cjs) greens the tripwires."
fi
exit $(( FAIL > 0 ? 1 : 0 ))
