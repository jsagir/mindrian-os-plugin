#!/usr/bin/env bash
# Phase 242 verification aggregator -- the single PASS/FAIL gate for "The Moat"
# (MOAT-01 and MOAT-02).
#
# MOAT-01 (Plan 01) wraps the HSI-to-graph edge rewrite in one transaction so a
# crash or a concurrent reader can never observe a zeroed scoring layer. The
# scoring layer IS the moat, so before that fix the moat was erasable by a badly
# timed Ctrl-C. MOAT-02 (Plan 02) replaces the dead "Does this work without
# KuzuDB edges?" prose checkbox with a machine-checked reintroduction gate.
#
# This harness GLOB-DISCOVERS every tests/test-242-* file (both .cjs and .sh) and
# runs it, so downstream plans add coverage WITHOUT editing this file. That is
# the whole point of the glob contract: Plan 02's
# tests/test-242-kuzu-reintroduction-gate.cjs is picked up with zero edits here.
# Discovering ZERO files is a FAIL, never a silent pass -- an aggregator that
# quietly finds nothing looks exactly like an aggregator whose suites all passed.
#
# The final leg is a PERMANENT Part 8 egress tripwire (the run-all-233.sh
# grep-gate idiom): a comment-stripped sweep over this plan's own production
# surface. Comment lines are stripped BEFORE the grep so header prose can neither
# trip the gate nor satisfy it. The sweep is preceded by a NEGATIVE SELF-TEST
# that plants every forbidden token on an executable line of a synthetic file and
# requires the pattern to catch each one, plus a comment line it must ignore. A
# grep gate that quietly stopped matching looks exactly like a clean codebase,
# which is the same false-success shape this phase exists to close, so the gate
# proves itself before it is trusted over real files.
#
# Every leg is hermetic and makes ZERO network reach: the MOAT-01 suite builds
# every room under mkdtemp, hand-writes its .hsi-results.json fixture rather than
# invoking compute-hsi.py, and writes nothing inside the repo. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# Strip whole-line comments (// or block-comment body lines, and # for sh/python)
# so header prose never trips a grep OR satisfies one.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*|#)' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Glob discovery. No hardcoded per-test filename lives in this block, so a later
# plan adds tests/test-242-<whatever> and this harness picks it up untouched.
# ---------------------------------------------------------------------------
shopt -s nullglob
found=0
for t in tests/test-242-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-242-*.sh; do
  found=1
  run "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-242-* files discovered"
  FAIL=$((FAIL+1))
fi

# ---------------------------------------------------------------------------
# Part 8 sweep: no egress in the production surface this plan touched.
# Plan 01 owns exactly one production file. Plan 02 asserts its OWN surface
# inside tests/test-242-kuzu-reintroduction-gate.cjs, which is what keeps the
# two plans independently green while they land in the same wave.
# A MISSING target FAILS the leg rather than skipping silently.
# ---------------------------------------------------------------------------
PART8_TARGETS=(
  "scripts/hsi-to-graph.cjs"
)
PART8_RE="https?://|fetch\(|axios|WebFetch|mindrian-brain\.onrender\.com|api\.anthropic\.com"

echo "--- Part 8 self-test: the tripwire actually bites ---"
SELFTEST_OK=1
PART8_TMP="$(mktemp -d)"
trap 'rm -rf "$PART8_TMP"' EXIT

must_catch() {
  local label="$1" line="$2"
  printf '%s\n' "$line" > "$PART8_TMP/probe"
  if strip_comments "$PART8_TMP/probe" | grep -qE "$PART8_RE"; then
    echo "    caught: $label"
  else
    echo "    MISS (the gate is blind to this): $label -> $line"; SELFTEST_OK=0
  fi
}

must_not_catch() {
  local label="$1" line="$2"
  printf '%s\n' "$line" > "$PART8_TMP/probe"
  if strip_comments "$PART8_TMP/probe" | grep -qE "$PART8_RE"; then
    echo "    FALSE POSITIVE: $label -> $line"; SELFTEST_OK=0
  else
    echo "    correctly ignored: $label"
  fi
}

must_catch "https:// literal" "  const u = 'https://example.com/api';"
must_catch "http:// literal" "  const u = 'http://example.com/api';"
must_catch "fetch(" "  const r = await fetch(url);"
must_catch "axios" "  const axios = require('axios');"
must_catch "WebFetch" "  const tool = 'WebFetch';"
must_catch "brain host" "  const host = 'mindrian-brain.onrender.com';"
must_catch "anthropic api host" "  const h = 'api.anthropic.com';"
must_not_catch "a comment line naming egress" "// never fetch( from https://mindrian-brain.onrender.com via axios"
must_not_catch "ordinary local code" "  conn.prepare('BEGIN').run();"

if [ "$SELFTEST_OK" -eq 1 ]; then
  echo ">>> Part 8 self-test: PASSED"; PASS=$((PASS+1))
else
  echo ">>> Part 8 self-test: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- Part 8 sweep: zero egress in every phase-242 surface ---"
PART8_OK=1
for tgt in "${PART8_TARGETS[@]}"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; PART8_OK=0
    continue
  fi
  HITS="$(strip_comments "$tgt" | grep -nE "$PART8_RE")"
  if [ -n "$HITS" ]; then
    echo "    FORBIDDEN egress token on an executable line in: $tgt"
    printf '      %s\n' "$HITS"
    PART8_OK=0
  fi
done
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> Part 8 sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> Part 8 sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 242: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
