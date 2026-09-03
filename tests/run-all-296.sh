#!/usr/bin/env bash
# Phase 296 verification aggregator (SEED-030: RS Pipeline Spine-Wiring +
# Expert-Graph Reconciliation).
#
# WHAT THIS PHASE HAS TO PROVE, one sentence per requirement, each naming the
# plan that owns it:
#   RSFENCE-01: the connector-spine wiring (all four rs-* surfaces present in
#     data/connector-registry.json) is already done (F-9) and is locked here
#     as a regression fence, not re-derived - owned by 296-01/296-02.
#   RSLOCAL-01: RS internal mode reads local vectors, never Pinecone - this
#     was ALREADY TRUE before this phase (F-3, both scripts/rs-engine.py's
#     MiniLM path and Phase 272's lib/core/rs-engine.cjs) - owned by 296-01.
#   RSLOCAL-02: RS cross-room mode reads local vectors, never Pinecone - also
#     ALREADY TRUE (F-3) - owned by 296-01.
#   RSLOCAL-03: the CJS-side vector export/bridge step (never a direct Python
#     SELECT against eureka_vec, per F-2) both backends round-trip through it
#     correctly - owned by 296-03.
#   RSLOCAL-04: RS external and hybrid modes retire lib/core/rs_cache.py's
#     Pinecone SDK path and serve from a local embed-and-cache path instead,
#     with the 384-dim/1024-dim non-mixing invariant intact - owned by 296-04
#     (repoint) and enforced by tests/296-dim-invariant.sh (owned by 296-01,
#     SKIP-tolerant until 296-04 lands).
#   RSEXP-01: rs-experts routes its degrade path through
#     lib/core/refusal-messaging.cjs instead of a hand-rolled conflated
#     string, so "Brain unreachable" / "no transport" / "genuinely zero
#     experts" render as three distinguishable outputs - owned by 296-02.
#   RSEXP-02: rs-experts loads zero brainClient / mcp__mindrian-brain__ calls
#     (Part 8 regression fence; this was ALREADY TRUE, F-6/F-7) - owned by
#     296-02/296-07.
#
# THIS PHASE'S OWN SCOPE is the rs_cache.py external/hybrid signal-corpus
# cache and the rs-experts degrade message. Internal and cross-room modes
# were ALREADY Pinecone-free before this phase (296-RESEARCH.md F-3) and are
# locked here as regression fences, not re-implemented.
#
# EXPLICITLY OUT OF SCOPE, must NOT be swept for removal by anything in this
# phase: lib/core/pinecone-inference.cjs (Phase 272's deliberate, audited
# Pinecone /embed inference module), scripts/compute-hsi.py Tier 2 (its own
# independent PINECONE_API_KEY consumer), and PINECONE_API_KEY itself (still
# load-bearing for both of the above after this phase lands, per
# 296-RESEARCH.md's Runtime State Inventory / D-06). A future task that
# removes either is a scope violation, not a cleanup.
#
# DISCOVERY IS BY GLOB, node-arm suffix-scoped to *.test.cjs (NOT a bare
# *.cjs glob): this phase's shared fixtures live under tests/fixtures/296/,
# and a bare *.cjs glob would try to execute a helper module as a test.
# tests/296-*.sh is the bash arm. Adding a tests/296-*.test.cjs or
# tests/296-*.sh file requires NO edit to this runner.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_296_PREFIX exists to prove without
# editing this file. A harness printing green over zero discovery is the
# false-success class this repo has already paid for
# (.planning/debug/phase-134-python-elimination-false-complete.md).
#
# PART 8 SOURCE SWEEP: this phase's own Part-8-relevant surfaces, swept for
# Brain/network egress tokens. A target that does not exist yet (waves 2/3)
# is SKIPPED and counted into PART8_MISSING WITHOUT failing the leg, matching
# tests/run-all-272.sh's deliberate asymmetry.
#
# PART 8 EXEMPTION: lib/core/rs_cache.py is the RETIREMENT TARGET itself
# (296-RESEARCH.md F-4) - until plan 296-04 lands the repoint it legitimately
# still imports the pinecone SDK, both in prose (its own header docstring
# names the architecture) and in code (`from pinecone import Pinecone`). It
# is exempted BY NAME from the PART8_FORBIDDEN grep below, mirroring the
# identical precedent tests/run-all-272.sh set for lib/core/pinecone-
# inference.cjs, but it stays tracked in PART8_TARGETS and in the em-dash
# fence. The real enforcement gate for RSLOCAL-04 is tests/296-dim-
# invariant.sh, which SKIPs honestly for this exact same reason today and
# turns red-until-fixed once 296-04 lands. Exempting it from THIS sweep is
# not a loophole against that gate; it avoids two gates disagreeing about the
# same known, named, in-progress fact.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_296_ALLOW_MISSING=1 is set, exactly as tests/run-all-272.sh does.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_296_PREFIX=tests/296-nonexistent- bash
# tests/run-all-296.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_296_PREFIX:-tests/296-}"

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
# DISCOVERY: glob every tests/296-*.test.cjs (node arm, suffix-scoped so a
# tests/fixtures/296/ helper is never picked up) and every tests/296-*.sh
# (bash arm, skipping this runner itself by basename).
# ---------------------------------------------------------------------------
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.test.cjs; do
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 296 test files discovered (TEST_296_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP
# ---------------------------------------------------------------------------
echo "--- 296 Part 8 source sweep ---"
PART8_OK=1
PART8_MISSING=0
PART8_TARGETS=(
  "scripts/rs-vector-bridge.cjs"
  "lib/core/rs_cache.py"
  "scripts/rs-experts-command.cjs"
)
PART8_FORBIDDEN='brain-client|brainClient|brain_query|pws-brain|api\.pinecone\.io|import pinecone|from pinecone'
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  # rs_cache.py is the retirement target itself (F-4) - exempt BY NAME from
  # the forbidden-token grep until 296-04 lands the repoint (see header
  # comment above), but keep it tracked in PART8_TARGETS and the em-dash
  # fence.
  if [ "$t" = "lib/core/rs_cache.py" ]; then
    if [ -f "$f" ]; then
      echo "    EXEMPT from Part 8 grep (documented retirement target, RSLOCAL-04, 296-04): $t"
    else
      echo "    SKIPPED (not yet created, does not fail this leg): $t"
      PART8_MISSING=$((PART8_MISSING+1))
    fi
    continue
  fi
  if [ -f "$f" ]; then
    hits="$(grep -v '^[[:space:]]*\(//\|\*\|/\*\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)"
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
echo "    $PART8_MISSING target(s) not yet created (expected pre-wave-2+)"
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 296 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 296 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE: PART8_TARGETS plus this runner plus every discovered
# tests/296- file. A missing target counts into EMDASH_MISSING and FAILS the
# fence unless TEST_296_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 296 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "${PART8_TARGETS[@]}"
  "tests/run-all-296.sh"
)
for t in "${DISCOVERED_TEST_FILES[@]}"; do
  EMDASH_TARGETS+=("$t")
done
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
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_296_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_296_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 296 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 296 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 296: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
