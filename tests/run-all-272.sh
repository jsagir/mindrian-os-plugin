#!/usr/bin/env bash
# Phase 272 verification aggregator (Phase 134 Real Remediation: eliminate the
# Python/PyTorch runtime requirement by porting rs_math.py / rs-engine.py /
# compute-hsi.py's Tier 1 surface to pure CJS, behind an env-flag dispatch
# chokepoint, with the Pinecone /embed inference call preserved as the one
# deliberate, audited egress point).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   PYPORT-01: rs_math.py's TF-IDF/SVD/topic-keyword/abs-diff/direction port
#     matches sklearn's ACTUAL algorithm (verified live against installed
#     sklearn source), not an assumed one.
#   PYPORT-02: rs-engine.cjs Mode A emits a schema-matching .rs-engine-results.json.
#   PYPORT-03: compute-hsi's Convention-B LSA and Markov spectral surface is
#     preserved as its own module, NOT unified with rs-math's Convention A.
#   PYPORT-04: one dispatch chokepoint decides CJS-vs-Python; both rule-6
#     copies (reverse-salient-agent.cjs, find-bottlenecks.md) are amended in
#     the same commit as the dispatch wiring.
#   PYPORT-05: rank agreement plus zero confident sign flips against an
#     ARPACK-regenerated baseline, gated above a measured noise floor, never
#     against full pair ordering (compute-hsi.py's SVD is unseeded).
#   PYPORT-06: the model cache resolves outside the versioned plugin dir;
#     cache-probe uses ModelRegistry.is_pipeline_cached, not fs.existsSync.
#   PYPORT-07: the Pinecone /embed module preserves the Part 8
#     audit-before-fetch ordering.
#
# WAVE 0 IS RED BY DESIGN. This plan (272-01) creates six fixed-input unit
# tests that assert the target CJS behavior before the target CJS modules
# exist. Every one of them fails today, citing the missing require() target,
# until:
#   272-04 (cache-probe, cache-location, pinecone-inference)
#   272-05 / 272-06 (svd-sign, tfidf-parity, absdiff-topk, direction-convention)
#   272-07 (spectral, hsi-lsa-algorithm)
#   272-08 (rs-engine-contract, rank-agreement)
#   272-10 (dispatch-chokepoint, rule6-amended)
# turn each corresponding test green. A green run of the six 272-01 tests
# before those plans land is a DEFECT (a test not actually asserting the
# behavior it names), reproducing the "SUMMARY exists but nothing was
# verified" failure class this whole phase exists to remediate (per
# .planning/debug/phase-134-python-elimination-false-complete.md).
#
# DISCOVERY IS BY GLOB. tests/272-* is THIS phase's naming convention
# (VALIDATION.md, PATTERNS.md) -- unlike Phase 270/273's tests/test-<N>-*
# convention. This harness globs every tests/272-* file (both .cjs and .sh)
# and runs it. Adding a tests/272-* file requires NO edit to this runner.
# Data files (tests/272-corpus.json, tests/fixtures/272/*) are naturally
# excluded because the glob is suffix-scoped to *.cjs / *.sh only.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_272_PREFIX exists to prove without
# editing this file.
#
# PART 8 SOURCE SWEEP: this phase's own new production files are swept for
# Brain/network egress tokens (RESEARCH.md section 2.4, the three Part 8
# enforcement layers). A target that does not yet exist is SKIPPED and
# counted into PART8_MISSING WITHOUT failing the leg -- these files
# legitimately do not exist until their implementation wave lands. This is a
# deliberately looser rule than the em-dash fence below; do not conflate the
# two.
#
# PART 8 EXEMPTION: lib/core/pinecone-inference.cjs legitimately contains
# fetch( and https://api.pinecone.io -- it is the D-01 /embed module, the one
# deliberate, audited external-egress module this phase creates (Pinecone
# hosted inference, gated by auditQueryString/auditQueryObject in
# rs-egress-prompts.cjs). It is exempted BY NAME from the PART8_FORBIDDEN
# grep below, but stays tracked in PART8_TARGETS and in the em-dash fence --
# exempting it from the grep is not the same as dropping it from tracking.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_272_ALLOW_MISSING=1 is set, exactly as tests/run-all-270.sh does.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_272_PREFIX=tests/272-nonexistent- bash
# tests/run-all-272.sh must exit non-zero. Production runs never set it.
# NOTE: unlike Phase 270/273, Phase 272's own test files are named
# tests/272-*, NOT tests/test-272-*.
PREFIX="${TEST_272_PREFIX:-tests/272-}"

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
# DISCOVERY: glob every tests/272-* file. Bare `node "$t"` invocation only
# (no node:test runner flag) -- this repo's aggregators invoke node:test-style
# files bare and still get a non-zero exit on failure (tests/run-all-264.sh:98).
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
  echo "!!! no Phase 272 test files discovered (TEST_272_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP: this phase's own new production files, comment-stripped
# then grepped for Brain/network egress tokens. A target that does not exist
# yet is SKIPPED (counted into PART8_MISSING) and does NOT fail this leg --
# these files legitimately do not exist until their implementation wave
# lands. This asymmetry vs. the em-dash fence below is deliberate.
# ---------------------------------------------------------------------------
echo "--- 272 Part 8 source sweep ---"
PART8_OK=1
PART8_MISSING=0
PART8_TARGETS=(
  "lib/core/rs-backend-dispatch.cjs"
  "lib/core/rs-math.cjs"
  "lib/core/numeric/tfidf.cjs"
  "lib/core/numeric/svd.cjs"
  "lib/core/rs-engine.cjs"
  "lib/core/hsi-lsa.cjs"
  "lib/core/hsi-spectral.cjs"
  "lib/core/hsi-engine.cjs"
  "lib/core/pinecone-inference.cjs"
)
PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  # pinecone-inference.cjs is the ONE deliberate, audited external-egress
  # module this phase creates (D-01's /embed call, gated by
  # auditQueryString/auditQueryObject) -- exempt it BY NAME from the
  # forbidden-token grep, but keep it in PART8_TARGETS so its existence is
  # still tracked here and in the em-dash fence below.
  if [ "$t" = "lib/core/pinecone-inference.cjs" ]; then
    if [ -f "$f" ]; then
      echo "    EXEMPT from Part 8 grep (documented, audited /embed egress, D-01): $t"
    else
      echo "    SKIPPED (not yet created, does not fail this leg): $t"
      PART8_MISSING=$((PART8_MISSING+1))
    fi
    continue
  fi
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
echo "    $PART8_MISSING target(s) not yet created (expected pre-wave-2+)"
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 272 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 272 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (ported from tests/run-all-270.sh): every new file this
# phase touches (including the exempted pinecone-inference.cjs -- exemption
# is from the Part 8 grep only, not from this fence), plus this runner
# itself and every discovered tests/272- file. Here a MISSING target DOES
# count into EMDASH_MISSING and FAILS the fence unless TEST_272_ALLOW_MISSING=1
# is set.
# ---------------------------------------------------------------------------
echo "--- 272 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "${PART8_TARGETS[@]}"
  "tests/run-all-272.sh"
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
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_272_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_272_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 272 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 272 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 272: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
