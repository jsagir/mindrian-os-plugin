#!/usr/bin/env bash
# Phase 266 verification aggregator (MCPFIX-01: the MCP host-boundary
# instructions truncation fix).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. MCPFIX-01: the served RUNTIME_INSTRUCTIONS string fits under the
#      Claude Code 2.1.84 host cap (2048 bytes) with headroom, and the
#      Canon Part 8 BOUNDARIES paragraph survives byte-identically as the
#      tail of the string (lib/mcp/no-instructions.test.cjs, amended this
#      phase with a host-boundary byte-cap assertion the pre-existing
#      server-boundary identity check could never see).
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-264.sh). This
# harness globs every tests/test-266-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-266-* file requires NO edit to this runner.
#
# THIS PHASE'S TESTS ARE NOT tests/test-266-* GLOB FILES. Task 1 amends the
# pre-existing lib/mcp/no-instructions.test.cjs in place rather than adding a
# new tests/test-266-* file, so the glob legitimately discovers zero files
# under this phase's own prefix. The found-eq-0 guard below is still real and
# still load-bearing: it is proven by TEST_266_PREFIX pointing at a prefix
# that truly has zero matches (tests/test-266-nonexistent-), not by this
# phase's own (empty) glob run.
#
# THE MANDATORY EXPLICIT LEGS, enumerated by filename so a missing one is
# visible by READING this header even though none of them carry a
# tests/test-266- prefix for the glob to find:
#
#   lib/mcp/no-instructions.test.cjs             (this phase's amended gate)
#   tests/test-234-tool-description-floor.cjs    (donor-phase tool floor)
#   lib/core/npm-install-lock.test.cjs           (pre-existing lock contract)
#   lib/core/mcp-dep-heal.test.cjs               (pre-existing heal contract)
#   scripts/build-connector-registry.cjs --check (born-wired registry gate)
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_266_PREFIX exists to prove without
# editing this file.
#
# NO Part 8 egress grep sweep in this runner, and the reason is written down
# rather than assumed (the run-all-217 / run-all-234 written-reason idiom):
# the run-all-234 sweep pattern includes the case-sensitive lowercase token
# `brain`, and all three production files this phase touches legitimately
# carry that token on executable lines (runtime-instructions.cjs states the
# Part 8 rule about `brain_*` calls; tool-router.cjs routes to the Brain
# seam). A gate that fails on correct, committed code gets disabled by the
# next person who trips it. The Part 8 property this phase actually needs is
# that the served instructions still CARRY the boundary sentence in full;
# that is asserted directly by lib/mcp/no-instructions.test.cjs's
# PART8_BOUNDARIES_FROZEN scenario, not by a text-grep sweep here.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_266_ALLOW_MISSING=1 is set (this plan, 266-01, may run with it set;
# plan 266-04, the phase's final gate, runs without it -- that is what
# proves every listed file actually exists).
#
# Deliberately out of scope for Phase 266
#
# .planning/ is gitignored and does not travel between machines, so this
# tracked file is the only place this record survives across a machine
# switch. Each item below points at the research that details it. As of
# 2026-08-27, Phase 265's data/capability-ledger.json does not exist on disk
# yet, so these are recorded here rather than filed as ledger rows; once
# that ledger ships, each of these becomes a row instead of a comment. Full
# detail:
# .planning/phases/265-capability-radar-absorption-routing-re-scoped-supersedes-orp/265-RESEARCH-mcp-layer-audit.md
#
#   1. alwaysLoad eager-load reconsideration, ~7,557 tokens pinned into every
#      session (R-8).
#   2. Missing annotations / outputSchema / title on all 36 tools (R-6).
#   3. The deprecated elicitation enumNames shape (R-5) -- already owned by
#      Phase 265 plan 265-02.
#   4. Hook adoption of type: "mcp_tool" (R-12).
#   5. A doctor tool-count and zero-tool check (R-7).
#   6. requiresUserInteraction and _meta maxResultSizeChars, both unconfirmed
#      transports (R-11).
#   7. Retired-backend names (Pinecone / Neo4j) in the six Brain tool
#      descriptions (R-9, D-7).
#   8. Counted-facts drift: "9 tools" and "under 7000 token budget" and
#      "49 MCP tools" (R-10, D-1, D-2, D-8).
#   9. The total-surface token budget assertion (R-3c), deferred because the
#      stated budget is already breached.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_266_PREFIX=tests/test-266-nonexistent- bash
# tests/run-all-266.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_266_PREFIX:-tests/test-266-}"

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
# DISCOVERY: glob every tests/test-266-* file. Bare `node "$t"`, NOT
# `node --test "$t"` -- every Phase 266 test is a plain script that throws
# or calls process.exit(1), not a node:test file.
# ---------------------------------------------------------------------------
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
# EXPLICIT GATE LINES: pre-existing, always-present files, listed explicitly
# rather than relying on the glob (they carry no test-266- prefix). A test
# that is never discovered is worse than no test, because the harness still
# prints green.
# ---------------------------------------------------------------------------
run "no-instructions.test.cjs (host-boundary byte-cap + Part 8 survival)" node lib/mcp/no-instructions.test.cjs
run "234 tool description floor"                  node tests/test-234-tool-description-floor.cjs
run "npm install lock contract"                   node lib/core/npm-install-lock.test.cjs
run "mcp dep heal contract"                       node lib/core/mcp-dep-heal.test.cjs
run "connector registry born-wired --check"       node scripts/build-connector-registry.cjs --check

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (C-01): clone the donor's fence at run-all-264.sh
# including the rc >= 2 SCAN BROKE arm (a broken grep -P must FAIL, never
# silently pass). A missing target counts into EMDASH_MISSING and FAILS the
# fence when EMDASH_MISSING > 0, UNLESS TEST_266_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 266 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "lib/mcp/runtime-instructions.cjs"
  "lib/mcp/no-instructions.test.cjs"
  "lib/mcp/tool-router.cjs"
  "lib/mcp/larry-context.cjs"
  "lib/core/mcp-dep-heal.cjs"
  "lib/core/npm-install-lock.cjs"
  "tests/test-234-tool-description-floor.cjs"
  "tests/run-all-266.sh"
  # 266-REVIEW.md WR-01: both bin/*.cjs entry points are modified by this
  # phase's MCPFIX-03 work (bin/mindrian-brain-mcp-client.cjs:23 even carries
  # its own in-file "HARD RULE: no em-dashes" comment the fence never
  # machine-checked), plus the two lock/heal test files WR-01 also named.
  "bin/mindrian-mcp-server.cjs"
  "bin/mindrian-brain-mcp-client.cjs"
  "lib/core/npm-install-lock.test.cjs"
  "lib/core/mcp-dep-heal.test.cjs"
)
shopt -s nullglob
for f266 in "$ROOT"/tests/test-266-*; do
  EMDASH_TARGETS+=("${f266#$ROOT/}")
done
shopt -u nullglob
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
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_266_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_266_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 266 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 266 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 266: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
