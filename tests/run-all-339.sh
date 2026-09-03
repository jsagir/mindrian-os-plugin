#!/usr/bin/env bash
# Phase 339 verification aggregator (Brain-to-Theo cutover release: flip
# lib/core/brain-client.cjs's default origin from
# https://pws-brain-mcp.onrender.com to https://theo-mcp.onrender.com, sweep
# every runtime site so no second origin literal survives, refresh Phase
# 269-05's readiness checklist).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   FLIP-01: no runtime site under lib/, bin/, scripts/ resolves the Brain
#     origin from its own literal, outside the written two-entry allowlist
#     (tests/test-339-origin-single-source.cjs).
#   FLIP-02: BRAIN_PROBLEM_TYPE_ALIASES projects onto the resolved origin's
#     vocabulary, and the two alias tables stay disjoint
#     (tests/test-254-normalize-roundtrip-probe.cjs Arms 4-5).
#   FLIP-03: _maybeCaptureEnrichmentMiss captures BOTH Theo readiness shapes
#     (tests/test-339-enrichment-theo-shapes.cjs).
#   FLIP-04: the unreachable and no_key refusal copy names the two-command
#     update path from one shared constant (tests/test-339-update-path-
#     single-source.cjs, tests/test-250-refusal-shapes.cjs).
#   FLIP-05: the brain_schema memo cannot serve a schema fetched from a
#     different origin (tests/test-339-schema-memo-origin-keyed.cjs).
#   FLIP-06/FLIP-07: Desktop/Cowork connector docs + the cross-repo note
#     (tests/test-339-cross-repo-note.sh; generated-mirror checks below).
#   FLIP-08: the 269-05 checklist reads the three real legs
#     (tests/test-339-269-05-checklist.sh).
#   FLIP-09: the FLIP release cannot be cut without a zero-write human gate
#     (tests/test-339-gate-zero-write.sh).
#   FLIP-10/FLIP-11: the flip line and the doctor's layer 6 verdict (later
#     plans; this runner discovers their tests once those plans land).
#
# WAVE 0 IS RED BY DESIGN. Three arms fail on this plan's own run, and that
# is the CORRECT state, not a defect (mirrors tests/run-all-273.sh's
# documented convention, and tests/run-all-276.sh's "do NOT soften" rule):
#   - tests/test-339-origin-single-source.cjs: RED until plan 339-07 removes
#     the two script-level literals at scripts/probe-brain-contract.cjs:74
#     and scripts/build-brain-census.cjs:61.
#   - tests/test-254-normalize-roundtrip-probe.cjs Arms 4-5: RED until plan
#     339-04 lands the origin-keyed two-table alias selector.
#   - tests/test-250-refusal-shapes.cjs's new update-path pin: RED until
#     plan 339-06 lands the shared update-path constant and its refusal copy.
# tests/test-339-gate-zero-write.sh is the one Wave-1 arm that is GREEN on
# day one: Theo's coverage ruling already exists at Theo commit 81dfac8, so
# the gate's read-only precondition check has something real to read.
# Do NOT "fix" this runner by softening any of the three red arms above; each
# fix belongs to its own later plan, never to this aggregator.
#
# DISCOVERY IS BY GLOB (mirrors tests/run-all-276.sh / tests/run-all-273.sh).
# This harness globs every tests/test-339-* file (both .cjs and .sh) and
# runs it. Adding a tests/test-339-* file requires NO edit to this runner.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_339_PREFIX exists to prove without
# editing this file. A harness reporting green over zero discovery is itself
# the false-success disease this phase's whole design exists to close: this
# phase's disease is a SECOND SOURCE OF TRUTH (one origin, one vocabulary
# switch, one update-path string, one coverage ruling), and a runner that
# lies about discovery is exactly that disease one level up.
#
# ORIGIN-LITERAL SWEEP, SCOPED AS THE OPPOSITE PROPERTY TO run-all-276.sh's
# forbidden-token list: this phase's own production targets legitimately
# contain the strings "brain-client" and "https://" (brain-client.cjs IS the
# single source of truth; https:// is the scheme of the very origin this
# phase moves), so a copied 276-style grep-loop token list would fire on
# every one of them. Instead this runner invokes
# `node tests/test-339-origin-single-source.cjs` as the sweep -- that test
# already carries the correct, narrower shape (an onrender.com host literal
# on a comment-stripped line, outside a two-entry written allowlist). A
# future reader must NOT "restore" the 276 forbidden-token list here; the
# property being checked is deliberately different.
#
# GENERATED-ARTIFACT GATES, wired here because no other gate in this repo
# runs them: `node scripts/build-skill-mirrors.cjs --check` (verify-release
# gate 10b already runs this one, wired again here for phase-local
# convenience) and `node scripts/build-dist-bundles.cjs --check-stale` (the
# named Wave 0 gap: verify-release, release.sh and doctor --acceptance all
# skip it, so if this runner does not call it, nothing in the repo does).
#
# NO-EM-DASH FENCE (ported from tests/run-all-276.sh): sweeps every file this
# phase touches for the forbidden U+2014 glyph via its Unicode codepoint
# escape (grep -P '\x{2014}'), including the grep -P rc>=2 scan-broke arm. A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_339_ALLOW_MISSING=1 is set.
#
# WHAT THIS RUNNER DELIBERATELY DOES NOT PROVE: it does not prove the flip
# works against a live Theo. That is FLIP-12, manual by design (a released
# artifact, a plugin-cache update, and a live Larry turn -- automating it
# would mean publishing a release from a test). See 339-VALIDATION.md's
# Manual-Only Verifications table.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_339_PREFIX=tests/test-339-nonexistent- bash
# tests/run-all-339.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_339_PREFIX:-tests/test-339-}"

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
# DISCOVERY: glob every tests/test-339-* file. Bare `node "$t"`, NOT node's
# own `--test` flag on "$t" -- this repo's aggregators invoke node:test files
# bare and still get a non-zero exit on failure (tests/run-all-273.sh /
# tests/run-all-276.sh precedent).
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
  echo "!!! no Phase 339 test files discovered (TEST_339_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# ORIGIN-LITERAL SWEEP: invoke the FLIP-01 source scan directly rather than
# re-implementing a grep loop here. See the header comment above for why the
# 276-style forbidden-token list is the WRONG shape for this phase.
# ---------------------------------------------------------------------------
run "339 origin-literal sweep (tests/test-339-origin-single-source.cjs)" node tests/test-339-origin-single-source.cjs

# ---------------------------------------------------------------------------
# RELATED SUITES THIS PHASE MUST NOT REGRESS, run as named arms.
# ---------------------------------------------------------------------------
run "254 normalize round-trip probe (must not regress)" node tests/test-254-normalize-roundtrip-probe.cjs
run "250 refusal shapes (must not regress)" node tests/test-250-refusal-shapes.cjs

# ---------------------------------------------------------------------------
# GENERATED-ARTIFACT GATES: no other gate in this repo runs --check-stale.
# ---------------------------------------------------------------------------
run "skill mirrors drift (build-skill-mirrors.cjs --check)" node scripts/build-skill-mirrors.cjs --check
run "dist bundle staleness (build-dist-bundles.cjs --check-stale)" node scripts/build-dist-bundles.cjs --check-stale

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (ported from tests/run-all-276.sh): every production
# target this phase touches or will touch, plus this runner itself and every
# discovered test-339- file. A MISSING target counts into EMDASH_MISSING and
# FAILS the fence unless TEST_339_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 339 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "lib/core/brain-client.cjs"
  "lib/core/enrichment-queue.cjs"
  "lib/mcp/brain-router.cjs"
  "lib/core/refusal-messaging.cjs"
  "lib/core/update-path.cjs"
  "lib/core/doctor/class-m-brain-smoke.cjs"
  "lib/core/doctor/class-m-brain-smoke.test.cjs"
  "lib/core/mcp-profiles.cjs"
  "bin/mindrian-brain-mcp-client.cjs"
  "scripts/probe-brain-contract.cjs"
  "scripts/build-brain-census.cjs"
  "scripts/rs-experts-command.cjs"
  "scripts/rs-thesis-command.cjs"
  "scripts/sessionstart-post-update-preflight.cjs"
  "scripts/session-start"
  "docs/brain-setup.md"
  "docs/install/BRAIN-SETUP.md"
  "docs/THE-BRAIN.md"
  "commands/setup.md"
  "commands/pws-brain.md"
  "skills/pws-brain/SKILL.md"
  "docs/339-NOTE-theo-desktop-connector-key.md"
  "tests/run-all-339.sh"
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
    else
      echo "    clean: $t"
    fi
  else
    echo "    MISSING (not yet created): $t"
    EMDASH_MISSING=$((EMDASH_MISSING+1))
  fi
done
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_339_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_339_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 339 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 339 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 339: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
