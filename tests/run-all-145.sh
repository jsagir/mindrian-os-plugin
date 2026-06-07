#!/usr/bin/env bash
# Phase 145 scoped runner -- the Scheduled Sensor Activation acceptance
# aggregator. Mirrors tests/run-all-144.sh exactly so the Phase 146 loop-fires
# gate (ACPT-01) can compose these suites without rework.
#
# What this aggregator PROVES (the three Phase 145 Success Criteria, by
# instrumentation -- not by promise):
#   SC1 cadence-fires:  the scout suite fires on a cadence WITHOUT manual
#                       invocation (SCHED-01) and the SCHED-02 four (whitespace,
#                       reverse-salient, opportunity-bank, competitor) fire on
#                       the same run; the throttle blocks an every-session
#                       runaway.
#   SC2 hardening-holds: under auto-fire the Phase-140 hardening holds -- the
#                       runner captures (never swallows) the health-check exit
#                       (HARD-01), and the guard DETECTS a synthesized NULL
#                       source_path (HARD-02) and a synthesized .heal-backup/
#                       pollution (HARD-03) -- adversarial fixtures, not happy
#                       path only.
#   SC3 part-8 + part-4: the scheduled path carries zero Brain/web egress
#                       (Canon Part 8; competitor-watch is a SIGNAL query plan,
#                       not a fetch) and scheduled findings become graph data
#                       (Canon Part 4; findings_to_graph populated).
#
# Per-suite plan ownership:
#   test-scout-cadence-fires.cjs            -> Plan 03 Task 1 (SCHED-01 + SCHED-02
#                                              cadence-fires + throttle + no-room
#                                              soft-fail; drives the REAL runner)
#   test-scout-cadence-part8-hardening.cjs  -> Plan 03 Task 2 (HARD-01/02/03
#                                              adversarial-fixture detection +
#                                              Part-8 zero-egress sweep +
#                                              Part-4 findings-to-graph)
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and exits non-zero if any suite failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-scout-cadence-fires.cjs
  test-scout-cadence-part8-hardening.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 145 scoped test runner"
echo "========================================"
echo ""

for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  ((TOTAL++))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$s (missing)"); echo ">>> $s: MISSING"; echo ""; continue
  fi
  if bash "$p"; then
    ((PASSED++)); echo ">>> $s: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$s"); echo ">>> $s: FAILED"
  fi
  echo ""
done

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (145 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (see header for plan ownership):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
