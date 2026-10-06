#!/usr/bin/env bash
# Phase 369.25 (Feyminto and room identity spoken, 369.3a the one authority) verification aggregator.
#
# Modeled on tests/run-all-3692.sh (the run / run_if / run_known shape, the guarded per-planned-test-file
# idiom, the dash guard).
#
# IMPORTANT: this aggregator is written ONCE, here, in 369.25-02 (Wave 0). Later plans add their own test
# files (tests/test-36925-*.cjs); the run_if legs below already name every one of them, so a landed file is
# picked up automatically and a missing planned file reports SKIPPED, never PASSED. Only plan 25 edits this
# file, to drop a healed run_known wrapper.
#
# Counters:
#   PASSED  - the leg exited 0
#   FAILED  - the leg exited non-zero (not 77), or a run_known leg failed with an output that does NOT carry
#             its recorded signature
#   SKIPPED - exit 77 (ENV GAP) or a missing planned file; never PASSED
#   KNOWN   - a run_known leg failed with its recorded pre-existing signature; never PASSED, never FAILED
#
# exit 0  -> FAILED=0
# exit 1  -> FAILED > 0
#
# Excluded on purpose (RESEARCH baseline: pre-existing timeouts, 120 s and 280 s, the l9o list):
#   lib/memory/session-start-triple-injection.test.cjs
#   lib/memory/run-feynman-tests.cjs
#
# Path note: the plan named lib/core/navigation-engine-core.test.cjs; the file on disk is
# lib/memory/navigation-engine-core.test.cjs (measured with find), so that is the leg below.
#
# House rule: hyphens only; the two dash characters are searched for below only as printf byte escapes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

START_EPOCH=$(date +%s)
PASS=0
FAIL=0
SKIP=0
KNOWN=0

PD=".planning/phases/369.25-feyminto-and-room-identity-spoken-369-3a-the-one-authority-p"

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

# run_known <label> <signature> <cmd...>
# A pre-existing red this phase does not own. Exit 0 -> PASSED ("known red healed").
# Non-zero exit whose combined output contains the literal signature -> KNOWN.
# Any other non-zero exit -> FAILED (a new failure mode, investigate).
run_known() {
  local label="$1"; local signature="$2"; shift 2
  echo "--- $label ---"
  local out
  out="$("$@" 2>&1)"
  local status=$?
  printf '%s\n' "$out" | tail -n 15
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED (known red healed - drop the run_known wrapper at phase close)"; PASS=$((PASS+1))
  elif printf '%s' "$out" | grep -qF -- "$signature"; then
    echo ">>> $label: KNOWN (pre-existing red, signature matched)"; KNOWN=$((KNOWN+1))
  else
    echo ">>> $label: FAILED (exit $status, recorded signature NOT found: $signature)"; FAIL=$((FAIL+1))
  fi
  echo ""
}

# --- 1. Guarded legs, one run_if per planned test file (the label names the plan that lands it) -
run_if "36925: phase0-fixtures (369.25-01)"                 tests/test-36925-phase0-fixtures.cjs         node tests/test-36925-phase0-fixtures.cjs
run_if "36925: rid-repair (369.25-03)"                      tests/test-36925-rid-repair.cjs              node tests/test-36925-rid-repair.cjs
run_if "36925: an01 (369.25-04)"                            tests/test-36925-an01.cjs                    node tests/test-36925-an01.cjs
run_if "36925: theo-ask (369.25-05)"                        tests/test-36925-theo-ask.cjs                node tests/test-36925-theo-ask.cjs
run_if "36925: capability (369.25-06)"                      tests/test-36925-capability.cjs              node tests/test-36925-capability.cjs
run_if "36925: rid-birth (369.25-07)"                       tests/test-36925-rid-birth.cjs               node tests/test-36925-rid-birth.cjs
run_if "36925: rft-birth (369.25-07)"                       tests/test-36925-rft-birth.cjs               node tests/test-36925-rft-birth.cjs
run_if "36925: theo-face (369.25-08)"                       tests/test-36925-theo-face.cjs               node tests/test-36925-theo-face.cjs
run_if "36925: never-ready (369.25-09)"                     tests/test-36925-never-ready.cjs             node tests/test-36925-never-ready.cjs
run_if "36925: rft-binding (369.25-10)"                     tests/test-36925-rft-binding.cjs             node tests/test-36925-rft-binding.cjs
run_if "36925: rid-binding (369.25-11)"                     tests/test-36925-rid-binding.cjs             node tests/test-36925-rid-binding.cjs
run_if "36925: feyminto-identity (369.25-12)"               tests/test-36925-feyminto-identity.cjs       node tests/test-36925-feyminto-identity.cjs
run_if "36925: readiness-gate (369.25-13)"                  tests/test-36925-readiness-gate.cjs          node tests/test-36925-readiness-gate.cjs
run_if "36925: working-sequence (369.25-14)"                tests/test-36925-working-sequence.cjs        node tests/test-36925-working-sequence.cjs
run_if "36925: rid-reader (369.25-14)"                      tests/test-36925-rid-reader.cjs              node tests/test-36925-rid-reader.cjs
run_if "36925: feyminto-faces (369.25-15)"                  tests/test-36925-feyminto-faces.cjs          node tests/test-36925-feyminto-faces.cjs
run_if "36925: feyminto-contract (369.25-16)"               tests/test-36925-feyminto-contract.cjs       node tests/test-36925-feyminto-contract.cjs
run_if "36925: theo-wiring (369.25-17)"                     tests/test-36925-theo-wiring.cjs             node tests/test-36925-theo-wiring.cjs
run_if "36925: brief (369.25-18)"                           tests/test-36925-brief.cjs                   node tests/test-36925-brief.cjs
run_if "36925: brief-wiring (369.25-19)"                    tests/test-36925-brief-wiring.cjs            node tests/test-36925-brief-wiring.cjs
run_if "36925: injection (369.25-20)"                       tests/test-36925-injection.cjs               node tests/test-36925-injection.cjs
run_if "36925: next-move (369.25-21)"                       tests/test-36925-next-move.cjs               node tests/test-36925-next-move.cjs
run_if "36925: naming (369.25-22)"                          tests/test-36925-naming.cjs                  node tests/test-36925-naming.cjs
run_if "36925: room-read (369.25-23)"                       tests/test-36925-room-read.cjs               node tests/test-36925-room-read.cjs
run_if "36925: negative-leg (369.25-23)"                    tests/test-36925-negative-leg.cjs            node tests/test-36925-negative-leg.cjs
run_if "36925: practical (369.25-24)"                       tests/test-36925-practical.cjs               node tests/test-36925-practical.cjs

# --- 2. Regression legs (measured on HEAD in 369.25-02: every one exit 0; the muy leg joined them in 369.25-24) -
run "36925 regression: test-vi3-icm-walk" node tests/test-vi3-icm-walk.cjs
run "36925 regression: test-l9o-rooms-python-floor" node tests/test-l9o-rooms-python-floor.cjs
run "36925 regression: test-353-filing-gate" node tests/test-353-filing-gate.cjs
run "36925 regression: test-room-birth" node tests/test-room-birth.cjs
run "36925 regression: test-195-born-wired-birth" node tests/test-195-born-wired-birth.cjs
run "36925 regression: test-353-subroom-birth" node tests/test-353-subroom-birth.cjs
run "36925 regression: test-section-nodes-birth-and-migration" node tests/test-section-nodes-birth-and-migration.cjs
run "36925 regression: test-resolve-active-room-canonical" node tests/test-resolve-active-room-canonical.cjs
run "36925 regression: test-248-resolver-census" node tests/test-248-resolver-census.cjs
run "36925 regression: test-353-anchor-edge" node tests/test-353-anchor-edge.cjs
run "36925 regression: test-353-ruling-doc" node tests/test-353-ruling-doc.cjs
run "36925 regression: test-desktop-stdio-session-binding" node tests/test-desktop-stdio-session-binding.cjs
run "36925 regression: test-cross-session-room-bleed" node tests/test-cross-session-room-bleed.cjs
run "36925 regression: test-347-chain-state-writer" node tests/test-347-chain-state-writer.cjs
run "36925 regression: test-247-contract-client" node tests/test-247-contract-client.cjs
run "36925 regression: test-344-layer-contract-doc" node tests/test-344-layer-contract-doc.cjs
run "36925 regression: test-353-decide-budget" node tests/test-353-decide-budget.cjs
run "36925 regression: part8-egress-guard.test" node lib/core/part8-egress-guard.test.cjs
run "36925 regression: navigation-engine-core.test" node lib/memory/navigation-engine-core.test.cjs
run "36925 regression: feynman-minto-invariants.test" node lib/memory/feynman-minto-invariants.test.cjs
run "36925 regression: feynman-minto-guardian.test" node lib/memory/feynman-minto-guardian.test.cjs
run "36925 regression: folder-memory.test" node lib/memory/folder-memory.test.cjs
run "36925 regression: folder-memory-quadruple.test" node lib/memory/folder-memory-quadruple.test.cjs
run "36925 regression: triple-context-formatter.test" node lib/memory/triple-context-formatter.test.cjs
run "36925 regression: brain-derivation.test" node lib/memory/brain-derivation.test.cjs
run "36925 regression: minto-debouncer.test" node lib/memory/minto-debouncer.test.cjs
run "36925 regression: on-stop-snapshot.test" node lib/memory/on-stop-snapshot.test.cjs

# --- 2b. The muy real-room rule is a plain run leg (369.25-24) ---------------------------------------
# It was a run_known leg while its G10b pinned a CHANGELOG [Unreleased] line the beta.61 cut moved. Plan 24 re-pinned G10b
# to the whole CHANGELOG (MOVING marker) and added the negative-leg arms G11-G13, so it must pass outright now.
run "36925 regression: muy real-room rule (receipt gate incl. the negative leg)" node tests/test-muy-real-room-rule.cjs

# --- 3. Gates (plain run) -------------------------------------------------------------------------
run "36925: connector-registry generator --check"       node scripts/build-connector-registry.cjs --check
run "36925: orchestration-projection generator --check" node scripts/build-orchestration-projection.cjs --check

# --- 4. Dash guard (always) -----------------------------------------------------------------------
# Both the em-dash and the en-dash are searched for, as printf byte escapes only. A missing path is skipped.

echo "--- 36925: dash guard ---"
DASH_HIT=0
EM="$(printf '\xe2\x80\x94')"
EN="$(printf '\xe2\x80\x93')"
DASH_FILES=(
  "tests/run-all-36925.sh"
  "tests/helpers/isolated-home-36925.cjs"
  "lib/core/navigation/room-identity.cjs"
  "data/section-command-relevance.json"
  "data/claim-state-vocabulary.json"
)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests -maxdepth 1 -name 'test-36925-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find lib/core/feyminto -maxdepth 1 -name '*.cjs' -print0 2>/dev/null)
for f in "${DASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lqF -e "$EM" -e "$EN" "$f" 2>/dev/null; then
    echo "em-dash or en-dash found in $f"
    DASH_HIT=1
  fi
done
if [ "$DASH_HIT" -eq 0 ]; then
  echo ">>> 36925: dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 36925: dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary --------------------------------------------------------------------------------------

END_EPOCH=$(date +%s)
echo "Phase 369.25: PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
echo "Wall time: $(( END_EPOCH - START_EPOCH )) s"
exit $(( FAIL > 0 ? 1 : 0 ))
