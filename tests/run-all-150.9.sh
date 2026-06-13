#!/usr/bin/env bash
# Phase 150.9 phase gate -- doctor drift-classes for the Fable audit tracks.
# ONE green command (the phase closeout): the three CJS drift suites plus the
# two acceptance greps the audit mandates.
#
# What this PROVES (by instrumentation, not by promise -- Canon Part 6
# dog-fooding): the plugin self-audits its own drift surface, and the two
# constitutional invariants the new classes ride on cannot silently break.
# Three legs compose the gate:
#
#   (a) the three 150.9 CJS suites (Plans 01 + 02):
#         test-drift-baseline.cjs   (Plan 01) the pure DRIFT.md writer:
#                 schema round-trip, per-folder locality, FIX-13 diff-stability
#                 (noTouch idempotence + last_seen-only delta), closed-with-
#                 history, V12 traversal refusal, the Part 8 floor.
#         test-doctor-class-p.cjs   (Plan 02) Class P (prose-vs-code,
#                 REPORT-ONLY): wraps both shipped checkers, never edits prose
#                 even under --fix, first-touch via subprocess (Pitfall 1),
#                 D-04 opt-in.
#         test-doctor-class-q.cjs   (Plan 02) Class Q (gsd-record drift):
#                 parses W007/I001 from gsd-health, shape-asserts before
#                 reading, exit-0 invariant, deadlock carve-out, D-04 opt-in,
#                 locator-failure skip, clean-health ok.
#
#   (b) the Part 8 zero-egress floor proof (RQ5, mirrors the 95.2 grep):
#         lib/core/drift-baseline.cjs is grepped in FULL for the network token
#         set; scripts/doctor.cjs is grepped PR-diff-scoped (only the lines this
#         milestone ADDED) so the pre-existing class-M brain-smoke matches stay
#         out of scope. Any match fails the gate. When origin/main is
#         unavailable, the doctor grep falls back to the new Class P/Q line
#         range only.
#
#   (c) the marketplace-cache-drift-deadlock carve-out proof (RQ1):
#         doctor --drift --json is run live; it MUST exit 0 even with drift
#         present (the classFlagsActive exit-0 invariant; the cache-drift
#         deadlock carve-out is never tripped by --drift).
#
# Part 8 token set: fetch, http, curl, brain, tavily. Class Q's gsd-health call
# is a LOCAL spawnSync('node', [...]) -- not in the network token set.
#
# This runner MUST run to completion (no crash) even when a leg fails; it prints
# a per-leg PASS/FAIL/MISSING line + a final tally. It exits non-zero if any leg
# failed OR is missing.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# The Part 8 network token set (mirrors the 95.2 proof).
NET_TOKENS="fetch|http|curl|brain|tavily"

# (a) The three 150.9 CJS suites.
CJS_SUITES=(
  test-drift-baseline.cjs
  test-doctor-class-p.cjs
  test-doctor-class-q.cjs
)

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 150.9 phase gate"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The three 150.9 CJS suites.
# ---------------------------------------------------------------------------
echo "--- Group (a): the three 150.9 CJS drift suites ---"
echo ""
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$c"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (b) The Part 8 zero-egress floor proof (RQ5).
# ---------------------------------------------------------------------------
echo "--- Group (b): the Part 8 zero-egress floor proof (RQ5) ---"
echo ""

# (b.1) lib/core/drift-baseline.cjs grepped in FULL.
((TOTAL++))
echo "--- Part 8 floor: lib/core/drift-baseline.cjs (full) ---"
BASELINE_FILE="$REPO_ROOT/lib/core/drift-baseline.cjs"
if [[ ! -f "$BASELINE_FILE" ]]; then
  ((MISSING++)); MISSING_TESTS+=("part8-floor:drift-baseline.cjs")
  echo ">>> part8-floor:drift-baseline.cjs: MISSING"
else
  BL_HITS=$(grep -nE "$NET_TOKENS" "$BASELINE_FILE" || true)
  if [[ -z "$BL_HITS" ]]; then
    ((PASSED++)); echo ">>> part8-floor:drift-baseline.cjs: PASSED (0 network matches)"
  else
    ((FAILED++)); FAILED_TESTS+=("part8-floor:drift-baseline.cjs")
    echo ">>> part8-floor:drift-baseline.cjs: FAILED -- network surface found:"
    echo "$BL_HITS"
  fi
fi
echo ""

# (b.2) scripts/doctor.cjs grepped PR-diff-scoped (the lines this milestone
#       ADDED). Falls back to the new Class P/Q line range if origin/main is
#       unavailable so pre-existing class-M brain-smoke matches stay out of
#       scope either way.
((TOTAL++))
echo "--- Part 8 floor: scripts/doctor.cjs (PR-diff-scoped new lines) ---"
DOCTOR_FILE="$REPO_ROOT/scripts/doctor.cjs"
if [[ ! -f "$DOCTOR_FILE" ]]; then
  ((MISSING++)); MISSING_TESTS+=("part8-floor:doctor.cjs")
  echo ">>> part8-floor:doctor.cjs: MISSING"
else
  # The `brainSmoke` / `brain_smoke` flag IDENTIFIER is a pre-existing Class-M
  # control flag, NOT a network surface (the actual brain-smoke network call
  # lives in Class M, not in the new --drift lines). The classFlagsActive
  # registration line `|| flags.brainSmoke || flags.drift;` was EDITED by this
  # milestone (to add flags.drift), so a PR-diff grep legitimately surfaces the
  # pre-existing `brainSmoke` token on that line. Strip the flag-name match so
  # the floor proof scores ONLY genuine network-egress surface (Plan 02 SUMMARY
  # self-check documented exactly this carve-out).
  BENIGN="flags\.brainSmoke|brain_smoke|brainSmoke"
  DOC_HITS=""
  if git -C "$REPO_ROOT" rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
    echo "    (scope: git diff origin/main -- scripts/doctor.cjs, added lines)"
    DOC_HITS=$(git -C "$REPO_ROOT" diff origin/main -- scripts/doctor.cjs \
      | grep '^+' | grep -v '^+++' \
      | grep -nE "$NET_TOKENS" \
      | grep -vE "$BENIGN" || true)
  else
    # Fallback: grep ONLY the new Class P/Q + heal-arm line range (4430-4710),
    # so the pre-existing class-M brain-smoke matches elsewhere are out of scope.
    echo "    (scope: origin/main unavailable -- new Class P/Q line range 4430-4710)"
    DOC_HITS=$(sed -n '4430,4710p' "$DOCTOR_FILE" \
      | grep -nE "$NET_TOKENS" \
      | grep -vE "$BENIGN" || true)
  fi
  if [[ -z "$DOC_HITS" ]]; then
    ((PASSED++)); echo ">>> part8-floor:doctor.cjs: PASSED (0 network matches in new lines)"
  else
    ((FAILED++)); FAILED_TESTS+=("part8-floor:doctor.cjs")
    echo ">>> part8-floor:doctor.cjs: FAILED -- network surface in new lines:"
    echo "$DOC_HITS"
  fi
fi
echo ""

# ---------------------------------------------------------------------------
# (c) The marketplace-cache-drift-deadlock carve-out proof (RQ1).
# ---------------------------------------------------------------------------
echo "--- Group (c): the deadlock carve-out proof (doctor --drift exits 0) ---"
echo ""
((TOTAL++))
echo "--- deadlock-exit-0: node scripts/doctor.cjs --drift --json ---"
if [[ ! -f "$DOCTOR_FILE" ]]; then
  ((MISSING++)); MISSING_TESTS+=("deadlock-exit-0")
  echo ">>> deadlock-exit-0: MISSING (scripts/doctor.cjs absent)"
else
  node "$DOCTOR_FILE" --drift --json >/dev/null 2>&1
  RC=$?
  if [[ $RC -eq 0 ]]; then
    ((PASSED++)); echo ">>> deadlock-exit-0: PASSED (exit 0 with drift present)"
  else
    ((FAILED++)); FAILED_TESTS+=("deadlock-exit-0")
    echo ">>> deadlock-exit-0: FAILED -- doctor --drift exited $RC (deadlock carve-out broken)"
  fi
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (150.9 phase gate)"
echo "========================================"
echo "  Total:   $TOTAL"
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Missing: $MISSING"
echo "  Time:    ${ELAPSED}s"

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "  Missing:"
  for t in "${MISSING_TESTS[@]}"; do
    echo "    - $t"
  done
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

if [[ $MISSING -gt 0 ]]; then
  echo "========================================"
  exit 1
fi

echo "========================================"
echo "  Exit 0: the Phase 150.9 gate is green (the three drift suites pass + the Part 8 zero-egress floor holds + the deadlock carve-out is preserved)."
exit 0
