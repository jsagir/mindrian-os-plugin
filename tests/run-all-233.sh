#!/usr/bin/env bash
# Phase 233 verification aggregator -- the single PASS/FAIL gate for the
# graph-derive drain residual (SEED-037 / RCA items 4c + 4d).
#
# Plan 01 lands the graph-derive-health doctor class (detectRoomHealth + the
# --heal-room re-enqueue) and the cadence:once graph-derive-heal-retrofit that
# repairs already-damaged rooms on update. Plan 02 gates runDerivation's dead
# hosted-API default and pins drain/backfill producer parity. Plan 03 closes RCA
# Section 9 Defects #4/#5: compute-hsi.py single-sources its corpus exclude-list,
# gains --scope-to-nodes, and scripts/graph-heal-pipeline.cjs wires the four
# stages in the RCA-mandated order.
#
# This harness GLOB-DISCOVERS every tests/test-233-* file (both .cjs and .sh) and
# runs it, so downstream plans add coverage WITHOUT editing this file. It ALSO
# runs the two EXISTING generic doctor gates unmodified, because the two new
# registry entries must satisfy the same contract every other doctor class
# already does: the declaration-completeness gate (check/fix export parity,
# explicit fix_supported, non-empty detail) and the doc-vs-code parity gate
# (every parsed flag documented, every documented flag parsed). Those two are
# what stop a new class from shipping with a doc promise it cannot keep -- the
# exact rot that produced this phase's own trigger bug.
#
# The final legs are the PERMANENT Part 8 tripwire (the run-all-158.sh /
# run-all-224.sh grep-gate idiom): a comment-stripped egress sweep over every
# executable surface this phase touched across all three plans. Comment lines are
# stripped BEFORE the grep so header prose can neither trip the gate nor satisfy
# it. The sweep is preceded by a NEGATIVE SELF-TEST that plants every forbidden
# token on an executable line of a synthetic file and requires the pattern to
# catch each one, plus an allow-listed line and a comment line it must ignore. A
# grep gate that quietly stopped matching looks exactly like a clean codebase,
# which is the same false-success shape the phase exists to close, so the gate
# proves itself before it is trusted over real files.
#
# ONE documented allowance, with its reason written down rather than silently
# regexed away (the run-all-217.sh written-reason idiom): scripts/compute-hsi.py
# carries `index.fetch(ids=artifact_ids)` on its OPT-IN Tier 2 path, reachable
# only when PINECONE_API_KEY and PINECONE_INDEX are both set. It is pre-existing,
# predates this phase, and is not a Brain call. It is allow-listed by EXACT LINE,
# so any OTHER egress token appearing in that file still fails the gate.
#
# Every leg is fully hermetic and makes ZERO network reach: each doctor spawn
# sets MINDRIAN_ROOMS_HOME and HOME to scratch dirs, every room.db is created
# under mkdtemp, the SessionStart contributor is driven through an injected
# report stub rather than a real subprocess, and the HSI legs run with
# HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE set. No em-dashes.

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

# A leg that may legitimately self-SKIP on environment (the HSI shell suites skip
# when numpy / scikit-learn / the local embedding cache are absent). Exit 0 plus a
# SKIP line is tallied as SKIP, not as a pass it did not earn.
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

# Strip whole-line comments (// or block-comment body lines, and # for python/sh)
# so header prose never trips a grep OR satisfies one.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*|#)' "$1" 2>/dev/null
}

shopt -s nullglob
found=0
for t in tests/test-233-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-233-*.sh; do
  found=1
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-233-* files discovered"
  exit 1
fi

# The two EXISTING generic doctor gates, run unmodified against the new entries.
run "test-doctor-module-contract-parity.cjs" node tests/test-doctor-module-contract-parity.cjs
run "test-doctor-doc-parity.cjs" node tests/test-doctor-doc-parity.cjs

# ---------------------------------------------------------------------------
# Part 8 sweep: no egress in any surface this phase touched (all three plans).
# A MISSING target fails the leg rather than skipping silently.
# ---------------------------------------------------------------------------
PART8_TARGETS=(
  # Plan 01
  "lib/core/doctor/graph-derive-health-module.cjs"
  "lib/core/doctor/graph-derive-heal-retrofit-module.cjs"
  "scripts/preflight-doctor.cjs"
  # Plan 02
  "lib/core/graph-derivation.cjs"
  "scripts/gsd-graph-derive-drain.cjs"
  # Plan 03
  "lib/core/rs_corpus_exclude.py"
  "scripts/compute-hsi.py"
  "scripts/graph-heal-pipeline.cjs"
  "lib/core/graph-backfill.cjs"
)
# WR-04: this pattern is the one the phase was ACTUALLY certified with. The
# committed gate used to carry only the first four tokens, while 233-01's and
# 233-02's SUMMARY.md both report verifying by hand with axios / onrender /
# api.anthropic / brain as well. A bare `require('axios')` with no literal URL, or
# a bare reference to onrender / anthropic / brain not preceded by a scheme, would
# have passed the committed gate silently. A permanent tripwire that is weaker
# than the check used to certify the phase is not a tripwire for those tokens, so
# the two are now the same pattern.
#
# `brain` stays CASE-SENSITIVE and lowercase, exactly as the SUMMARY greps ran it.
# That is deliberate, not an oversight: it catches the code shapes (require,
# identifiers, hostnames, env keys) while letting prose like "no Brain" in a
# module docstring through. Docstring bodies are not comment lines, so
# strip_comments cannot remove them, and a gate that fails on correct committed
# code gets disabled by the next person who trips it.
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b|axios|onrender|api\.anthropic|brain"
# EXACT-LINE allow-list (see the header for the written reason).
PART8_ALLOW="index\.fetch\(ids=artifact_ids\)"

# NEGATIVE SELF-TEST FIRST. A grep gate that silently stopped matching is
# indistinguishable from a codebase that is clean, which is the same
# false-success shape this phase exists to close. So before the gate is trusted
# over real files, it is run over a synthetic file that plants every forbidden
# token on an executable line and must be caught, plus the allow-listed line and
# a comment line that must NOT be. This is what earns the word "permanent".
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
  if strip_comments "$PART8_TMP/probe" | grep -nE "$PART8_RE" | grep -vE "$PART8_ALLOW" | grep -q .; then
    echo "    FALSE POSITIVE: $label -> $line"; SELFTEST_OK=0
  else
    echo "    correctly ignored: $label"
  fi
}

must_catch "fetch(" "  const r = await fetch(url);"
must_catch "https:// literal" "  const u = 'https://mindrian-brain.onrender.com/mcp';"
must_catch "node:https require" "  const https = require('node:https');"
must_catch "curl" "  spawnSync('curl', ['-s', target]);"
must_catch "wget" "  spawnSync('wget', [target]);"
must_catch "axios (no URL literal)" "  const axios = require('axios');"
must_catch "onrender host (no scheme)" "  const host = 'mindrian-brain.onrender.com';"
must_catch "api.anthropic (no scheme)" "  const h = 'api.anthropic.com';"
must_catch "brain identifier" "  const brainKey = process.env.MINDRIAN_BRAIN_KEY;"
must_not_catch "the written-reason allow-list line" "        results = index.fetch(ids=artifact_ids)"
must_not_catch "a comment line naming egress" "// never call fetch( or curl the brain at https://x.onrender.com"
must_not_catch "ordinary local code" "  const db = openRoomDbReadOnlyForCaller(roomDir);"

if [ "$SELFTEST_OK" -eq 1 ]; then
  echo ">>> Part 8 self-test: PASSED"; PASS=$((PASS+1))
else
  echo ">>> Part 8 self-test: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- Part 8 sweep: zero egress in every phase-233 surface ---"
PART8_OK=1
for tgt in "${PART8_TARGETS[@]}"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; PART8_OK=0
    continue
  fi
  HITS="$(strip_comments "$tgt" | grep -nE "$PART8_RE" | grep -vE "$PART8_ALLOW")"
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
echo "Phase 233: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
