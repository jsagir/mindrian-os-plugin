#!/usr/bin/env bash
# Phase 358 (Rome B1 checking record and B2 frame provenance, user-visible)
# verification aggregator.
#
# Modeled on tests/run-all-354.sh (the run/run_if/counter shape, the guarded
# per-planned-test-file idiom, the targeted em-dash guard).
#
# IMPORTANT: this aggregator is written ONCE, here, in 358-02. NO LATER B1
# PLAN in this phase edits it. A later plan adds its own test file
# (tests/test-358-b1-*.cjs); the run_if legs below pick up a landed file
# automatically because each leg already names its guard file. The B2 plan
# set (later in this same phase) adds its own legs deliberately, by re-
# opening this file on purpose, not by silently patching around it.
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

# --- Guarded legs, one run_if per planned B1 test file, wave order ----------
# Every B1 test file this phase's plans create is named here up front, even
# the ones not yet landed at 358-02 time. A missing guard file skips its leg;
# it never fails the run and it is never reported as PASSED.
run_if "358: core contract (B1-01/B1-04)"          tests/test-358-b1-core.cjs         node tests/test-358-b1-core.cjs
run_if "358: portrait (B1-05)"                     tests/test-358-b1-portrait.cjs     node tests/test-358-b1-portrait.cjs
run_if "358: separation (B1-06)"                   tests/test-358-b1-separation.cjs   node tests/test-358-b1-separation.cjs
run_if "358: re-file keeps record (B1-03)"         tests/test-358-b1-refile.cjs       node tests/test-358-b1-refile.cjs
run_if "358: CLI surface (B1-02/B1-04/B1-05)"      tests/test-358-b1-cli.cjs          node tests/test-358-b1-cli.cjs
run_if "358: MCP surfaces (B1-02/B1-04/B1-05/B1-06)" tests/test-358-b1-surfaces.cjs   node tests/test-358-b1-surfaces.cjs
run_if "358: new-session persistence (B1-03)"      tests/test-358-b1-persistence.cjs  node tests/test-358-b1-persistence.cjs

# --- Existing tests that must stay or turn green (run) ----------------------
run "358: pre-existing verification unit (run only, never edited by later 358 plans)" node tests/test-b1-verification.cjs
run "358: host tier (run only, never edited by 358)"                                   node tests/test-234-host-tier.cjs
run "358: tool description floor (run only, never edited by 358)"                      node tests/test-234-tool-description-floor.cjs
run "358: tool schema budget (run only, never edited by 358)"                           node tests/test-270-tool-schema-budget.cjs
run "358: connector coverage (run only, never edited by 358)"                           node tests/test-270-connector-coverage.cjs
run "358: tool honesty findings closed (run only, never edited by 358)"                 node tests/test-276-tool-honesty-findings-closed.cjs
run "358: claim-write primitive (run only, never edited by 358)"                        node tests/test-276-claim-write-primitive.cjs
run "358: meeting gate wiring (run only, never edited by 358)"                          node tests/test-276-meeting-gate-wiring.cjs
run "358: validity window (run only, never edited by 358)"                              node tests/test-348-validity-window.cjs
run "358: filing gate (run only, never edited by 358)"                                  node tests/test-353-filing-gate.cjs

# --- Gates (run) -------------------------------------------------------------
run "358: connector registry --check"          node scripts/build-connector-registry.cjs --check
run "358: orchestration projection --check"    node scripts/build-orchestration-projection.cjs --check
run "358: render coverage --check"             node scripts/check-render-coverage.cjs --check
run "358: build render coverage --check"       node scripts/build-render-coverage.cjs --check
run "358: skill mirrors --check"               node scripts/build-skill-mirrors.cjs --check
run "358: shape declaration --check"           node scripts/check-shape-declaration.cjs --check
run "358: help coverage"                       node scripts/check-help-coverage.cjs
run "358: tool honesty --check"                node scripts/check-tool-honesty.cjs --check

# --- CIRS leg: only the 358 plan files that actually exist on disk ----------
echo "--- 358: CIRS declaration (existing 358-0N-PLAN.md files) ---"
CIRS_PLANS=()
while IFS= read -r -d '' f; do
  CIRS_PLANS+=("$f")
done < <(find .planning/phases/358-*/ -maxdepth 1 -name '358-0[1-6]-PLAN.md' -print0 2>/dev/null)
if [ "${#CIRS_PLANS[@]}" -eq 0 ]; then
  echo ">>> 358: CIRS declaration: SKIPPED (no 358-0N-PLAN.md found)"; SKIP=$((SKIP+1))
else
  node scripts/check-cirs-declaration.cjs --check "${CIRS_PLANS[@]}"
  CIRS_STATUS=$?
  if [ "$CIRS_STATUS" -eq 0 ]; then
    echo ">>> 358: CIRS declaration: PASSED"; PASS=$((PASS+1))
  elif [ "$CIRS_STATUS" -eq 77 ]; then
    echo ">>> 358: CIRS declaration: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> 358: CIRS declaration: FAILED"; FAIL=$((FAIL+1))
  fi
fi
echo ""

# --- Em-dash guard (always) --------------------------------------------------
# The non-test files Phase 358 plans modify directly, named explicitly; a
# missing file is skipped, never an error. Plus a targeted glob of landed
# tests/test-358-b1-*.cjs, and this aggregator itself.

echo "--- 358: em-dash guard ---"
EMDASH_HIT=0
PHASE_358_SURFACES=(
  "lib/core/navigation/verification.cjs"
  "lib/core/navigation/typed-claim.cjs"
  "lib/core/navigation.cjs"
  "lib/mcp/tools/claim-verify.cjs"
  "lib/mcp/surface-detect.cjs"
  "scripts/claim-checks.cjs"
  "commands/room.md"
  "skills/room/SKILL.md"
  "docs/2026-10-06-ROME-B1-GO-NO-GO.md"
  "tests/run-all-358.sh"
  "tests/helpers/b1-358-child.cjs"
  "tests/test-234-host-tier.cjs"
  "tests/test-270-tool-schema-budget.cjs"
  "tests/fixtures/tool-honesty/276-dispositions.json"
  "tests/test-b1-verification.cjs"
)
EMDASH_FILES=("${PHASE_358_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-358-b1-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 358: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 358: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP"
if [ "$FAIL" -gt 0 ]; then
  exit 1
elif [ "$SKIP" -gt 0 ]; then
  exit 77
else
  exit 0
fi
