#!/usr/bin/env bash
# Phase 226 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# eureka-reasoning-mode-fallback cluster (SEED-058): the encoder-free /mos:eureka
# fallback that reads raw room markdown, Jaccard-pre-filters candidate pairs, runs
# the SAME Grounding Guard two-pass rubric at full rigor, and writes a short,
# honestly-labeled ranked report that structurally CANNOT carry a fabricated
# encoder number. Modeled verbatim on tests/run-all-212.sh (same run/run_if
# counters, the same NODE_OPTIONS preload export, the same non-zero-exit-on-FAIL
# convention - no new counter/exit convention invented).
#
# THE PHASE GATE has two parts and this script is the AUTOMATED half:
#   (1) run-all-226 green (this script) -- every D1-D8 leg plus the embedded
#       field-contract regression legs, AND
#   (2) the mandatory HUMAN calibration checkpoint (AI-SPEC Section 5, the Phase
#       212 plan-05 precedent): real-judge accuracy and caveat-wording honesty are
#       a human-verify leg, NEVER an automated assertion. This script asserts
#       STRUCTURE only (null legs, banked-false, cap, byte-parity, mode-label); it
#       does not and cannot claim the caveat prevents over-trust.
#
# D-dimension legs (each mapped to its dimension + REQ id). test-226-null-legs is
# listed FIRST and is the phase's HARDEST GATE: the D1 deterministic assertion that
# differential_score / semantic_similarity are structurally null on every reasoning
# result (REQ-1, the whole reason the phase exists; any firing is a Critical bug,
# T-226-01's permanent tripwire, never noise).
#
#   test-226-null-legs        -- D1 / G-1 (REQ-1): fabricated-number prohibition (FIRST, hardest)
#   test-226-rubric-parity    -- D3 / G-2 (REQ-2): the analogy bar not relaxed encoder-free
#   test-226-field-contract   -- D4 / G-5 (REQ-3): four-key byte-parity output shape
#   test-226-degrade-cause    -- D7        (REQ-6/8): honest cause named, no speculative trigger
#   test-226-mode-disclosure  -- D6 / G-4 (REQ-5): the mode label across md + json + html
#   test-226-posture          -- D5 / G-3 (REQ-4): banked-false, zero opportunity nodes, upgrade delta, field-parity
#   test-226-pair-cap         -- D8 / G-6 (REQ-7): end-to-end cap on a synthetic 200-entry room
#   test-226-rejection-replay -- D3        (REQ-2): the 212 junk classes stay rejected encoder-free
#
# SEED req 7 regression legs: the reasoning path must not have disturbed the
# EMBEDDED output contract. We run the field-contract LEGS of the embedded suites
# directly (test-215-field-contract.cjs, test-216-field-contract.cjs) rather than
# nesting whole run-all-215/216 suites: the whole suites pull the embedding spine
# and add tens of seconds, while the field-contract legs are the exact byte-parity
# oracle this phase's D4 mirrors, so they are the targeted regression fence at a
# fraction of the runtime.
#
# Each leg is run_if, GUARDED ON A FILE that must exist, so a partially-landed
# phase (a leg from a not-yet-merged wave) exits cleanly with a SKIP counter rather
# than RED-failing on absence (T-226-12: SKIP is printed with a counter, never
# silent). bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from run-all-212.sh): eureka-offline-preload flips
# transformers.js env.allowRemoteModels=false in every spawned leg (and its
# children), so a networked machine cannot silently download a model and break the
# offline contract. No-op when the dep is absent.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# D1 / G-1 (REQ-1): the fabricated-number prohibition. FIRST, and the phase's
# hardest gate - the one invariant that can never regress.
run_if "226-01 (D1/G-1) null-legs: fabricated-number prohibition [HARDEST GATE]" "tests/test-226-null-legs.cjs" \
  node tests/test-226-null-legs.cjs

# D3 / G-2 (REQ-2): the analogy bar held at parity encoder-free (unit).
run_if "226-01 (D3/G-2) rubric-parity: critic bar not relaxed" "tests/test-226-rubric-parity.cjs" \
  node tests/test-226-rubric-parity.cjs

# D4 / G-5 (REQ-3): the four-key { provenance, ranked, tail, statements } byte-parity.
run_if "226-02 (D4/G-5) field-contract: output-shape byte-parity" "tests/test-226-field-contract.cjs" \
  node tests/test-226-field-contract.cjs

# D7 (REQ-6/REQ-8): the honest degrade cause (encoder_unavailable / below_floor),
# never the bare not-enough-entries symptom; no speculative reasoning trigger.
run_if "226-02 (D7) degrade-cause: honest cause, no speculative trigger" "tests/test-226-degrade-cause.cjs" \
  node tests/test-226-degrade-cause.cjs

# D6 / G-4 (REQ-5): the mode label present in md AND json AND html for one run.
run_if "226-03 (D6/G-4) mode-disclosure: label across three surfaces" "tests/test-226-mode-disclosure.cjs" \
  node tests/test-226-mode-disclosure.cjs

# D5 / G-3 (REQ-4): banked-false, zero opportunity nodes in room.db, upgrade delta,
# short-list rule, and the field-parity live diff.
run_if "226-04 (D5/G-3) posture: banked-false + zero-bank + upgrade + field-parity" "tests/test-226-posture.cjs" \
  node tests/test-226-posture.cjs

# D8 / G-6 (REQ-7): the end-to-end cap on a synthetic 200-entry room.
run_if "226-04 (D8/G-6) pair-cap: bounded fan-out end to end" "tests/test-226-pair-cap.cjs" \
  node tests/test-226-pair-cap.cjs

# D3 (REQ-2, negative half): the Phase 212 junk classes stay rejected encoder-free.
run_if "226-04 (D3) rejection-replay: 212 negative corpus stays rejected" "tests/test-226-rejection-replay.cjs" \
  node tests/test-226-rejection-replay.cjs

# SEED req 7 regression: the embedded output contract is undisturbed. The
# field-contract LEGS of the embedded suites, run directly (not the whole suites,
# which pull the embedding spine and cost tens of seconds - see the header note).
run_if "SEED-req-7 embedded regression: 215 field-contract" "tests/test-215-field-contract.cjs" \
  node tests/test-215-field-contract.cjs
run_if "SEED-req-7 embedded regression: 216 field-contract" "tests/test-216-field-contract.cjs" \
  node tests/test-216-field-contract.cjs

echo "======================================"
echo "Phase 226: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
