#!/usr/bin/env bash
# Phase 348 (the supersession node, graph engineering learning 6: fact
# invalidation) verification aggregator. Modeled structurally on
# tests/run-all-347.sh; the run_red_until tripwire helper is the same
# idiom borrowed from tests/run-all-341.sh.
#
# IMPORTANT: this aggregator is written ONCE, here, in 348-01, and NO LATER
# PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file
# (tests/test-348-*.cjs); the run_if legs below and the em-dash guard's glob
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

SUPERSESSION_GATE="lib/core/temporal/supersession-gate.cjs"

# --- Always-green regression legs -------------------------------------------

run "348: syntax (tests/run-all-348.sh)" bash -n "tests/run-all-348.sh"
run "348: supersession unit (regression)"      node lib/core/temporal/supersession.test.cjs
run "348: point-in-time (regression)"          node lib/core/temporal/point-in-time.test.cjs
run "348: 223 supersedes chain (regression)"   node tests/test-223-supersedes-chain.cjs
run "348: insights stale (regression)"         node lib/core/navigation/insights-stale.test.cjs
run "348: node-insert epistemic (regression)"  node lib/core/node-insert-epistemic.test.cjs
run "348: 198 chokepoint guard (regression)"   node tests/test-198-chokepoint-guard.test.cjs
run "348: connector registry fresh (regression)"    node scripts/build-connector-registry.cjs --check
run "348: canon frozen scalars (regression)"        node tests/test-canon-frozen-scalars-floor.cjs

# --- EXPECTED-RED tripwire (SUPER-17, guard: supersession-gate.cjs) ---------
# Guarded on the gate module landing in plan 348-07. Placed BEFORE the run_if
# legs for the same test file; its name is deliberately removed from the
# run_if list below so it runs exactly once per aggregator invocation.

run_red_until "348: supersession e2e tripwire (SUPER-17)" "$SUPERSESSION_GATE" \
  node tests/test-348-supersession-e2e.cjs

# --- Guarded legs, one run_if per planned test file (SKIP until it lands) ---

run_if "348: contract doc"                  tests/test-348-contract-doc.cjs                  node tests/test-348-contract-doc.cjs
run_if "348: one supersession door"         tests/test-348-one-supersession-door.cjs         node tests/test-348-one-supersession-door.cjs
run_if "348: agent supersede refused"       tests/test-348-agent-supersede-refused.cjs       node tests/test-348-agent-supersede-refused.cjs
run_if "348: audit event"                   tests/test-348-audit-event.cjs                   node tests/test-348-audit-event.cjs
run_if "348: schema variants"               tests/test-348-schema-variants.cjs               node tests/test-348-schema-variants.cjs
run_if "348: contradictions floor"          tests/test-348-contradictions-floor.cjs          node tests/test-348-contradictions-floor.cjs
run_if "348: include superseded"            tests/test-348-include-superseded.cjs            node tests/test-348-include-superseded.cjs
run_if "348: contradiction shape"           tests/test-348-contradiction-shape.cjs           node tests/test-348-contradiction-shape.cjs
run_if "348: caller matrix"                 tests/test-348-caller-matrix.cjs                 node tests/test-348-caller-matrix.cjs
run_if "348: validity window"               tests/test-348-validity-window.cjs               node tests/test-348-validity-window.cjs
run_if "348: proposed not supersedable"     tests/test-348-proposed-not-supersedable.cjs     node tests/test-348-proposed-not-supersedable.cjs
run_if "348: mcp flag"                      tests/test-348-mcp-flag.cjs                      node tests/test-348-mcp-flag.cjs
run_if "348: traceability"                  tests/test-348-traceability.cjs                  node tests/test-348-traceability.cjs
run_if "348: doctrine present"              tests/test-348-doctrine-present.cjs               node tests/test-348-doctrine-present.cjs
run_if "348: canon narrowing floor"         tests/test-canon-entry-41-supersession-narrowing-floor.cjs  node tests/test-canon-entry-41-supersession-narrowing-floor.cjs

# --- Em-dash guard (always) -------------------------------------------------
# The em-dash guard's file list. Every path this phase's own plans touch
# directly (not the generated registries they lift into). Entries that do
# not exist yet are skipped by the loop below; tests/test-348-*.cjs and
# tests/helpers/fixture-room-348.cjs are discovered by glob, not
# hand-enumerated here.

PHASE_348_SURFACES=(
  "docs/SUPERSESSION-CONTRACT.md"
  "lib/core/navigation/transitions.cjs"
  "lib/core/navigation/insights.cjs"
  "lib/core/navigation/typed-claim.cjs"
  "lib/core/navigation/packet.cjs"
  "lib/core/navigation/room-home.cjs"
  "lib/core/navigation.cjs"
  "lib/core/temporal/supersession-gate.cjs"
  "lib/agents/reverse-salient-agent.cjs"
  "lib/mcp/tools/sensors.cjs"
  "skills/larry-personality/SKILL.md"
  "docs/MINDRIAN-CANON.md"
  "tests/run-all-348.sh"
)

echo "--- 348: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_348_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-348-*.cjs' -print0 2>/dev/null)
if [ -f "tests/helpers/fixture-room-348.cjs" ]; then
  EMDASH_FILES+=("tests/helpers/fixture-room-348.cjs")
fi
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 348: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 348: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP EXPECTED-RED=$REDX"
echo "======================================"
if [ "$REDX" -gt 0 ]; then
  echo "EXPECTED-RED legs remain: plan 348-07 (lib/core/temporal/supersession-gate.cjs) greens the tripwire."
fi
exit $(( FAIL > 0 ? 1 : 0 ))
