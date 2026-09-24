#!/usr/bin/env bash
# Phase 267 (MCP stateless protocol migration, SDK v1 -> v2) verification
# aggregator.
#
# Modeled on tests/run-all-357.sh (run/run_if/counter shape, exit 77 =
# SKIPPED ENV GAP, the em-dash guard loop, final exit).
#
# WRITTEN ONCE, HERE, IN 267-01. NO LATER 267 PLAN EDITS THIS FILE'S LEG LIST.
# Every Phase 267 leg is pre-declared below, guarded on its own test file, so
# a leg SKIPs until the owning plan lands it -- expected mid-phase, not a
# failure. The "REGRESSION LEGS" section is filled by 267-01 Task 2 with
# run_if legs for individual regression test files that PASSED on the
# unchanged tree (267-BASELINE.md is the source of truth for suites with
# pre-existing reds, which are NOT aggregator legs).
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

# --- 267 legs, pre-declared once (locked_stage W0 truth: "the aggregator
# only ADDS test files, never edits this leg list") -------------------------
run_if "267: sdk era (MCPV2-01)" tests/test-267-mcpv2-sdk-era.cjs node tests/test-267-mcpv2-sdk-era.cjs
run_if "267: lockstep (MCPV2-19)" tests/test-267-mcpv2-lockstep.cjs node tests/test-267-mcpv2-lockstep.cjs
run_if "267: CIRS gates (MCPV2-08)" tests/test-267-mcpv2-cirs-gates.cjs node tests/test-267-mcpv2-cirs-gates.cjs
run_if "267: zod4 contract (MCPV2-03)" tests/test-267-mcpv2-zod4-contract.cjs node tests/test-267-mcpv2-zod4-contract.cjs
run_if "267: tee helper (MCPV2-13)" tests/test-267-mcpv2-tee.cjs node tests/test-267-mcpv2-tee.cjs
run_if "267: CLI live wire probe, opt-in (MCPV2-13)" tests/test-267-mcpv2-cli-probe.cjs node tests/test-267-mcpv2-cli-probe.cjs
run_if "267: brain shim canary (MCPV2-11)" tests/test-267-mcpv2-brain-shim.cjs node tests/test-267-mcpv2-brain-shim.cjs
run_if "267: registration API and titles (MCPV2-02, MCPV2-08)" tests/test-267-mcpv2-registration-api.cjs node tests/test-267-mcpv2-registration-api.cjs
run_if "267: gate elicitation premise (MCPV2-07)" tests/test-267-mcpv2-gate-premise.cjs node tests/test-267-mcpv2-gate-premise.cjs
run_if "267: runtime-loop prompts (MCPV2-16)" tests/test-267-mcpv2-prompts.cjs node tests/test-267-mcpv2-prompts.cjs
run_if "267: MCP Apps schemas and containment (MCPV2-04)" tests/test-267-mcpv2-app-views.cjs node tests/test-267-mcpv2-app-views.cjs
run_if "267: local server dual era (MCPV2-02)" tests/test-267-mcpv2-dual-era.cjs node tests/test-267-mcpv2-dual-era.cjs
run_if "267: HTTP flag-OFF multi-request and rebinding (MCPV2-05, MCPV2-17)" tests/test-267-mcpv2-http-flag-off.cjs node tests/test-267-mcpv2-http-flag-off.cjs
run_if "267: process lifecycle (MCPV2-14)" tests/test-267-mcpv2-lifecycle.cjs node tests/test-267-mcpv2-lifecycle.cjs
run_if "267: flag-ON routing (MCPV2-06, MCPV2-17)" tests/test-267-mcpv2-flag-on.cjs node tests/test-267-mcpv2-flag-on.cjs
run_if "267: in-repo clients (MCPV2-06)" tests/test-267-mcpv2-clients.cjs node tests/test-267-mcpv2-clients.cjs

# --- REGRESSION LEGS (filled by 267-01 Task 2) ------------------------------
# Individual test files that PASSED on the unchanged tree (267-BASELINE.md,
# step 5). Suites with pre-existing reds (run-all-198 and any other named in
# the baseline) are NOT aggregator legs; every plan compares them against
# 267-BASELINE.md by hand instead.

# --- Em-dash guard (always; covers every Phase 267 test file and helper) ---
echo "--- 267: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("tests/run-all-267.sh")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-267-mcpv2-*.cjs' -print0 2>/dev/null)
for f in tests/helpers/mcp-wire-267.cjs tests/helpers/mcp-stdio-tee.cjs; do
  [ -f "$f" ] && EMDASH_FILES+=("$f")
done
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 267: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 267: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi

echo "======================================"
echo "Phase 267: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
