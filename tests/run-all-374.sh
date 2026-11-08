#!/usr/bin/env bash
# Phase 374 verification aggregator: the single PASS/FAIL/SKIPPED gate for the
# "adapter surface completion" phase (the generic Eureka job path hardening and the
# pair-screen flow).
#
# DISCOVERY IS BY GLOB, NOT BY LIST. This runner globs every tests/test-374-*
# file (.cjs and .sh) and runs it. Adding a tests/test-374-* file needs no edit
# here. There is no hand-maintained list of the phase tests anywhere below.
#
# RED TESTS: plan 374-05 wrote four tests before any code. A RED test is expected
# to fail until plan 374-06 makes it green, so this aggregator exits 1 by design
# until then.
#
# A test that exits 77 is an environment gap (for example a tool is not installed).
# It is counted as SKIPPED and printed with its reason. It is never counted as PASS.
#
# THE found-eq-0 GUARD IS LOAD-BEARING. A runner that discovers nothing must FAIL,
# not print green. TEST_374_PREFIX=tests/test-374-nonexistent- bash tests/run-all-374.sh
# must exit non-zero. Production runs never set it.
#
# Optional argument --neighbors: after the glob run, also run the explicit list of
# EXISTING tests that must stay green while Phase 374 changes the Eureka adapter
# files. A file named in that list that does not exist is a FAILED leg (a finding),
# never a silent skip.
#
# Dash fence: every discovered test file and every tests/helpers/*374* file is
# swept for the two forbidden dash characters (em dash and en dash). The pattern
# uses codepoint escapes, so this file holds no literal dash of that kind.
#
# bash only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PREFIX="${TEST_374_PREFIX:-tests/test-374-}"

NEIGHBORS=0
for arg in "$@"; do
  case "$arg" in
    --neighbors) NEIGHBORS=1 ;;
    *) echo "!!! unknown argument: $arg (only --neighbors is accepted)"; exit 2 ;;
  esac
done

PASS=0
FAIL=0
SKIP=0

# Run one leg. Exit 0 is PASS, exit 77 is SKIPPED (ENV GAP), anything else is FAIL.
run_leg() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  elif [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED (exit $rc)"; FAIL=$((FAIL+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

shopt -s nullglob
found=0
FILES=()
for t in "$PREFIX"*.cjs; do
  found=$((found+1)); FILES+=("$t")
  run_leg "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  found=$((found+1)); FILES+=("$t")
  run_leg "$(basename "$t")" bash "$t"
done
for h in tests/helpers/*374*; do FILES+=("$h"); done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
echo "discovered $found test file(s) under ${PREFIX}*"
echo ""

echo "--- 374 dash fence ---"
DASH_OK=1
for f in "${FILES[@]}" "tests/run-all-374.sh"; do
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '[\x{2013}\x{2014}]' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $f"
      DASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN dash character in: $f"
      DASH_OK=0
    fi
  fi
done
if [ "$DASH_OK" -eq 1 ]; then
  echo ">>> 374 dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 374 dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

if [ "$NEIGHBORS" -eq 1 ]; then
  echo "--- 374 neighbors (existing tests that must stay green) ---"
  NEIGHBOR_TESTS=(
    test-eureka-capability-run
    test-eureka-mcp-tools
    test-eureka-graph-algorithm-services
    test-eureka-graph-discovery-signals
    test-eureka-graph-projection
    test-eureka-graph-opportunity-scout
    test-387-eureka-route-needs
    test-387-eureka-egress
    test-387-eureka-engine-states
    test-387-eureka-installed-layout
    test-387-eureka-fake-engine
    test-387-eureka-command-wiring
    test-387-eureka-docs-wording
    test-eureka-373-02-error-scrub
    test-eureka-373-02-offline-env
    test-eureka-373-02-precheck
    test-eureka-373-02-readiness
    test-eureka-373-02-room-refusal
    test-341-eureka-no-brain-reach
    test-289-review-fixes
    test-270-tool-schema-budget
    test-267-mcpv2-dual-era
    test-267-mcpv2-zod4-contract
    test-267-mcpv2-clients
    test-267-mcpv2-registration-api
    test-267-mcpv2-lockstep
  )
  for n in "${NEIGHBOR_TESTS[@]}"; do
    if [ -f "tests/$n.cjs" ]; then
      run_leg "$n" node "tests/$n.cjs"
    else
      echo "--- $n ---"
      echo "!!! neighbor test file missing: tests/$n.cjs"
      echo ">>> $n: FAILED (file missing)"; FAIL=$((FAIL+1))
      echo ""
    fi
  done
  run_leg "test-384-s7-mcp-start parity" node tests/test-384-s7-mcp-start.cjs parity
  run_leg "build-connector-registry --check" node scripts/build-connector-registry.cjs --check
fi

echo "======================================"
echo "Phase 374: PASS=$PASS FAIL=$FAIL SKIPPED=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
