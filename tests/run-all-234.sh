#!/usr/bin/env bash
# Phase 234 verification aggregator -- the single PASS/FAIL gate for
# "MindrianOS as infrastructure: skills + MCP everywhere, open core".
#
# What this phase has to prove is portability WITHOUT leakage. The 125 skills and
# 112 commands are the adoption engine and must load on ~45 foreign hosts; the
# Brain stays the paid layer and the methodology never crosses that line. Plan 01
# lands the measuring instruments this whole phase reports through:
# scripts/check-skill-spec.cjs (Agent Skills spec conformance, the Zed 50KB
# catalog budget, the ${CLAUDE_PLUGIN_ROOT} census) plus two locked invariants --
# D-03 (the MCP initialize result never carries an `instructions` string, which
# is the single highest-leverage methodology-leak surface a host would prepend to
# its system prompt) and D-10 (no methodology skill or command gates on a paid
# check).
#
# This harness GLOB-DISCOVERS every tests/test-234-* file (both .cjs and .sh) and
# runs it, so downstream plans add coverage WITHOUT editing this file.
#
# ONE explicit extra leg sits outside that glob by design:
# lib/mcp/no-instructions.test.cjs. 234-VALIDATION.md names it at that path, and
# the tests/test-234-* glob cannot see it, so it is wired by hand rather than
# left to silently never run. A test that is never discovered is worse than no
# test, because the harness still prints a green summary.
#
# EXPECTED RED LEG WHILE THE PHASE IS IN FLIGHT: the
# `check-skill-spec.cjs --check` leg FAILS today. That is the honest baseline
# reading, not a bug. The current catalog carries 9 required-field breaches (7
# skills with no `name`, MOSDeckEngine's charset, value-proposition's recorded
# name-vs-directory mismatch) and 105 skills using the experimental
# `allowed-tools` array form. Plans 234-03 and 234-04 close those out; this leg
# turning green is how the phase knows they landed. It is deliberately run with
# `run`, not `run_may_skip`, so the FAIL is counted rather than suppressed.
#
# The final legs are the PERMANENT Part 8 tripwire (the run-all-158.sh /
# run-all-233.sh grep-gate idiom): a comment-stripped egress sweep over the
# surfaces this phase touches or relies on. Comment lines are stripped BEFORE the
# grep so header prose can neither trip the gate nor satisfy it. The sweep is
# preceded by a NEGATIVE SELF-TEST that plants every forbidden token on an
# executable line and requires the pattern to catch each one, plus the
# allow-listed line and a comment line it must ignore. A grep gate that quietly
# stopped matching looks exactly like a clean codebase, which is the same
# false-success shape this phase exists to close, so the gate proves itself
# before it is trusted over real files.
#
# ONE documented allowance, with its reason written down rather than silently
# regexed away (the run-all-217.sh / run-all-233.sh written-reason idiom):
# scripts/check-skill-spec.cjs carries the literal
# 'https://agentskills.io/specification' inside the stderr recovery message it
# prints when a skill fails the spec. It is a citation shown to a human, not a
# call: that file makes zero network reach and holds no HTTP client. It is
# allow-listed by EXACT LINE, so any OTHER egress token appearing in that same
# file still fails the gate.
#
# Measured, not assumed: lib/core/resolve-brain-key.cjs produces ZERO hits under
# this pattern on executable lines, because the case-sensitive lowercase `brain`
# token does not match its `resolveBrainKey` / `MINDRIAN_BRAIN_KEY` identifiers.
# It therefore needs no allowance. The `brain identifier` self-test case is kept
# anyway so the gate still proves it bites on that shape.
#
# Every leg is fully hermetic and makes ZERO network reach: the MCP spawn runs
# under a scratch HOME with MINDRIAN_BRAIN_KEY unset, and every scratch dir is
# created under mkdtemp. No em-dashes.

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

# A leg that may legitimately self-SKIP on environment. Exit 0 plus a SKIP line
# is tallied as SKIP, not as a pass it did not earn.
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
for t in tests/test-234-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-234-*.sh; do
  found=1
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-234-* files discovered"
  exit 1
fi

# EXPLICIT extra leg: lives outside the tests/test-234-* glob on purpose (see the
# header). Wired by hand so it cannot silently never run.
run "no-instructions.test.cjs" node lib/mcp/no-instructions.test.cjs

# The phase's own spec gate. RED until 234-03 / 234-04 land; see the header.
run "check-skill-spec --check" node scripts/check-skill-spec.cjs --check

# The Zed catalog budget. Green today with 3.9x headroom; this leg is what stops
# a later plan's description rewrite from silently overflowing it.
run "check-skill-spec --catalog-budget" node scripts/check-skill-spec.cjs --catalog-budget

# ---------------------------------------------------------------------------
# Part 8 sweep: no egress in any surface this phase touches or relies on.
# A MISSING target FAILS the leg rather than skipping silently.
# ---------------------------------------------------------------------------
PART8_TARGETS=(
  # Plan 01 (new this phase)
  "scripts/check-skill-spec.cjs"
  # Pre-existing chokepoints this phase's later plans touch or rely on. Sweeping
  # them now against the SAME pattern gives 234-05 a clean baseline to extend
  # rather than re-deriving it.
  "lib/core/navigation.cjs"
  "lib/core/resolve-brain-key.cjs"
  "lib/mcp/tools/graph.cjs"
  "lib/mcp/tools/chain.cjs"
  "lib/mcp/tools/views.cjs"
  # Plan 05 (D-05 two-axis capability floor). Both are pure process.env-only
  # chokepoints by their own file headers and hold zero network client, so they
  # belong under the same permanent tripwire as the surfaces they now gate.
  "lib/mcp/surface-detect.cjs"
  "lib/mcp/mcp-first-flag.cjs"
)
# Same pattern the phase-233 gate was certified with. `brain` stays
# CASE-SENSITIVE and lowercase: that is deliberate, not an oversight. It catches
# the code shapes (require, identifiers, hostnames, env keys) while letting prose
# like "no Brain" in a module docstring through. Docstring bodies are not comment
# lines, so strip_comments cannot remove them, and a gate that fails on correct
# committed code gets disabled by the next person who trips it.
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b|axios|onrender|api\.anthropic|brain"
# EXACT-LINE allow-list (see the header for the written reason).
PART8_ALLOW="'https://agentskills\.io/specification'"

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
must_not_catch "the written-reason allow-list line" "        'https://agentskills.io/specification'"
must_not_catch "a comment line naming egress" "// never call fetch( or curl the brain at https://x.onrender.com"
must_not_catch "ordinary local code" "  const db = openRoomDbReadOnlyForCaller(roomDir);"

if [ "$SELFTEST_OK" -eq 1 ]; then
  echo ">>> Part 8 self-test: PASSED"; PASS=$((PASS+1))
else
  echo ">>> Part 8 self-test: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "--- Part 8 sweep: zero egress in every phase-234 surface ---"
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
echo "Phase 234: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
