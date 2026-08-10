#!/usr/bin/env bash
# Phase 249 verification aggregator (ENRICH-01, the enrichment queue).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. A resolved orchestrationReadiness of 0-2/4, or a discoverStructure
#      grounded:false, with roomDir known, lands a typed entry in
#      <roomDir>/.mindrian/enrichment-queue.json without throwing into or
#      blocking the caller.
#   2. The queue file carries ONLY generic handles: the Part-8
#      forbidden-substring audit test proves no user prose passes the entry
#      validator.
#   3. No readiness probe was added to decide(), any sensor, or any per-turn
#      hook path (1200ms NAV budget untouched).
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-246.sh). This
# harness globs every tests/test-249-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-249-* file requires NO edit to this runner -- including
# 249-02's floor-gate suite, which lands in the same tests/test-249-* prefix.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   249-01  tests/test-249-enrichment-queue.cjs
#   249-01  tests/test-249-capture-seam.cjs
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'), so this
# runner itself carries no literal em-dash that would trip its own sweep.
# Missing paths are skipped, not failed (249-02/249-03 files may not exist
# yet when 249-01 runs first).
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_249_PREFIX=tests/test-249-nonexistent- bash
# tests/run-all-249.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_249_PREFIX:-tests/test-249-}"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  # Never re-run this runner against itself if it happens to match its own prefix.
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
echo "discovered $found test file(s) under ${PREFIX}*"
echo ""

# ---------------------------------------------------------------------------
# No-em-dash fence: every file this phase touches, swept for U+2014.
# ---------------------------------------------------------------------------
echo "--- 249 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/enrichment-queue.cjs"
  "lib/core/brain-client.cjs"
  "lib/brain/framework-chain-slice.cjs"
  "lib/core/navigation/packet.cjs"
  "lib/core/navigation/memory-events.cjs"
  "scripts/enrichment-queue-append.cjs"
  "skills/brain-connector/SKILL.md"
  "tests/test-249-enrichment-queue.cjs"
  "tests/test-249-capture-seam.cjs"
  "tests/run-all-249.sh"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      EMDASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  else
    echo "    (skipped, not yet created): $t"
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 249 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 249 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# Hot-path fence (Pitfall 6): no brain-client / enrichment-queue require in
# lib/core/sensors/ or the decide() path. Belt-and-suspenders alongside
# test-249-capture-seam.cjs's own Test 14 -- this fence runs even if that
# specific test file is ever renamed or reorganized.
# ---------------------------------------------------------------------------
echo "--- 249 hot-path fence (no brain-client/enrichment-queue require in sensors/ or decide()) ---"
HOTPATH_OK=1
if [ -d "$ROOT/lib/core/sensors" ]; then
  if LC_ALL=C.UTF-8 grep -RlP "require\(\s*['\"][^'\"]*(brain-client|enrichment-queue)\.cjs['\"]\s*\)" "$ROOT/lib/core/sensors" --include='*.cjs' 2>/dev/null | grep -v '\.test\.cjs$' | grep -q .; then
    echo "    FORBIDDEN require found under lib/core/sensors/"
    HOTPATH_OK=0
  fi
fi
if [ -f "$ROOT/lib/core/navigation-engine.cjs" ]; then
  if LC_ALL=C.UTF-8 grep -qP "require\(\s*['\"][^'\"]*(brain-client|enrichment-queue)\.cjs['\"]\s*\)" "$ROOT/lib/core/navigation-engine.cjs" 2>/dev/null; then
    echo "    FORBIDDEN require found in lib/core/navigation-engine.cjs"
    HOTPATH_OK=0
  fi
fi
if [ "$HOTPATH_OK" -eq 1 ]; then
  echo ">>> 249 hot-path fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 249 hot-path fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 249: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
