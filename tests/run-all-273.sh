#!/usr/bin/env bash
# Phase 273 verification aggregator (SQLite Graph Chokepoint Hardening:
# writeEdge silent-discard + base-schema-throw fixes, Wave 0 = the failing
# harness that pins both defects before any production code moves).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   CHOKE-01: glob discovery of every Phase 273 test, and loud failure on
#     zero discovery (a runner that discovers nothing and prints green IS
#     the false-success class this phase exists to kill).
#   CHOKE-02: a write suppressed by the confirmed-edge guard reports
#     written: false, not silent success.
#   CHOKE-04: writeEdge works against an openGraph base-schema handle
#     (currently throws "table edges has no column named review_status").
#   CHOKE-08: out-of-allowlist Brain edge types never land in the graph.
#   CHOKE-11: the cross-room comments describe the actual structural
#     mechanism, not an unchecked invariant.
#   CHOKE-12: the documented substrate baseline equals the measured one.
#
# WAVE 0 IS RED BY DESIGN. tests/test-273-writeedge-changes-aware.cjs and
# tests/test-273-writeedge-base-schema.cjs (created by THIS plan, 273-01)
# MUST fail until plan 273-03 lands. tests/test-273-ingestion-allowlist.cjs
# (273-02), tests/test-273-cross-room-comment.cjs (273-02),
# tests/test-273-substrate-baseline-honest.cjs (273-02 / 273-06) fail until
# their own implementation plans land. A red run at the end of Wave 0 is the
# CORRECT state, not a defect -- mirrors tests/run-all-270.sh:30-32's
# documented convention.
#
# DISCOVERY IS BY GLOB (mirrors tests/run-all-270.sh). This harness globs
# every tests/test-273-* file (both .cjs and .sh) and runs it. Adding a
# tests/test-273-* file requires NO edit to this runner.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_273_PREFIX exists to prove without
# editing this file.
#
# PART 8 SOURCE SWEEP: this phase's two production targets (both already
# exist on main; unlike Phase 270 a missing target here is a real defect,
# not an expected pre-wave gap) plus every discovered test file, swept for
# Brain/network egress tokens. NOTE: ingestion.cjs's own local provenance
# strings 'brain_insight' / created_by='brain' do NOT match this regex --
# the sweep asserts this phase introduces no Brain CLIENT call into the
# chokepoint (Canon Part 8), it is not banning the word "brain".
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_273_ALLOW_MISSING=1 is set, exactly as tests/run-all-270.sh does.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_273_PREFIX=tests/test-273-nonexistent- bash
# tests/run-all-273.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_273_PREFIX:-tests/test-273-}"

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

# ---------------------------------------------------------------------------
# DISCOVERY: glob every tests/test-273-* file. Bare `node "$t"`, NOT
# node's own `--test` flag on "$t" -- this repo's aggregators invoke node:test
# files bare and still get a non-zero exit on failure (tests/run-all-270.sh:96).
# ---------------------------------------------------------------------------
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  # Never re-run this runner against itself if it happens to match its own prefix.
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 273 test files discovered (TEST_273_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP: this phase's two production targets, comment-stripped
# then grepped for Brain/network egress tokens, plus every discovered test
# file. Both production targets already exist on main -- unlike Phase 270 a
# missing target here is a real defect, so the SKIPPED branch is kept only
# for parity and PART8_MISSING is expected to stay 0.
# ---------------------------------------------------------------------------
echo "--- 273 Part 8 source sweep ---"
PART8_OK=1
PART8_MISSING=0
PART8_TARGETS=(
  "lib/core/navigation/edges.cjs"
  "lib/core/navigation/ingestion.cjs"
)
for t in "${DISCOVERED_TEST_FILES[@]}"; do
  PART8_TARGETS+=("$t")
done
PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(grep -v '^\s*\(//\|\*\|/\*\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)"
    if [ "$hits" -gt 0 ]; then
      echo "    FORBIDDEN egress token(s) in: $t ($hits match(es))"
      PART8_OK=0
    else
      echo "    clean: $t"
    fi
  else
    echo "    SKIPPED (not yet created, does not fail this leg): $t"
    PART8_MISSING=$((PART8_MISSING+1))
  fi
done
echo "    $PART8_MISSING target(s) not yet created"
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 273 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 273 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (ported from tests/run-all-270.sh): every new file this
# phase touches, plus this runner itself and every discovered test-273- file.
# Here a MISSING target DOES count into EMDASH_MISSING and FAILS the fence
# unless TEST_273_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 273 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "${PART8_TARGETS[@]}"
  "tests/run-all-273.sh"
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
    echo "    MISSING (not yet created): $t"
    EMDASH_MISSING=$((EMDASH_MISSING+1))
  fi
done
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_273_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_273_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 273 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 273 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 273: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
