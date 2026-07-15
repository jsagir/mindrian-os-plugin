#!/usr/bin/env bash
# Phase 229 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# HUJI pitch-feedback module (PWS_grading recipe): the headless two-stage grading
# spine that extracts quote-anchored evidence from a customer pitch transcript,
# runs the four-command PWS chain (deep-grade -> mullins -> build-thesis[scored]
# -> structure-argument), and emits a Minto feedback artifact that structurally
# CANNOT carry a fabricated critique. Modeled verbatim on tests/run-all-226.sh
# (same run/run_if counters, the same non-zero-exit-on-FAIL convention, the same
# file-guarded SKIP doctrine - no new counter/exit convention invented).
#
# DROPPED vs run-all-226: the eureka-offline NODE_OPTIONS preload. Phase 229 has
# no offline transformers.js dependency - the checks are deterministic code + data
# over transcripts and JSON, no model download to fence.
#
# THE PHASE GATE has TWO PARTS and this script is the AUTOMATED half only:
#   (1) run-all-229 green (this script) -- every D1-D10 structural leg asserts
#       STRUCTURE only (quote-verbatim, inventory recall, schema shape, drift band,
#       similarity ceiling, cost ledger, Part 8 hygiene, kill/resume + cross-bleed),
#       AND
#   (2) the mandatory HUMAN calibration checkpoint -- Amnon Dekel's "better than a
#       TA" verdict on the two demo artifacts (the customer samples end to end).
#       Per the run-all-226 precedent, human calibration is a REAL validation leg,
#       NEVER an automated assertion. This script announces that checkpoint (see the
#       PHASE GATE PART 2 block at the end); it does not and cannot assert it green.
#
# D-dimension legs (each mapped to its dimension + REQ id). The D1 quote-verifier is
# listed FIRST and is the phase's HARDEST GATE: the deterministic assertion that every
# quote in evidence.json / feedback.md exists verbatim in the source transcript
# (domain failure mode #1 - fabricated critique; any firing is a Critical bug, never
# noise).
#
#   229-01 (D1) quote-verifier    -- fabricated-critique prohibition (FIRST, hardest)
#   229-01 (D2) inventory-recall  -- labeled entity/claim inventory 100% recalled
#   229-02 (D5) schema            -- FeedbackResultSchema Minto/MECE structural validity
#   229-02 (D8) similarity        -- pairwise shingle-Jaccard below threshold (no template)
#   229-02 (D9) cost-ledger       -- total_cost_usd per submission <= $3.00
#   229-03 (D4) part8-hygiene     -- zero student-specific strings in Brain query payload
#   229-03 (D3) drift             -- duplicate-anchor probes within 1 band, pinned model_id
#   229-04 (D10) kill/resume      -- .done skip + zero cross-student context bleed grep
#
# Each leg is run_if, GUARDED ON THE FILE it needs, so a partially-landed phase (a
# leg from a not-yet-merged wave) exits cleanly with a SKIP counter rather than
# RED-failing on absence (SKIP is printed with a counter, never silent). Until the
# Wave 1+ harness scripts land, EVERY leg SKIPs and this script exits clean-green;
# each dimension turns RED the moment its harness leg fails. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EVAL="$ROOT/.planning/phases/229-huji-pitch-feedback-module/eval"

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

# D1 (REQ D1): the fabricated-critique prohibition. FIRST, and the phase's hardest
# gate - every quote in evidence.json / feedback.md must exist verbatim in the source
# transcript. The one invariant that can never regress.
run_if "229-01 (D1) quote-verifier: every quote verbatim in source [HARDEST GATE]" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check quote-verifier

# D2 (REQ D2): the labeled entity/claim inventory is 100% recalled into evidence.json
# (intake fidelity vs the fusion engine extraction standard). A labeled item absent
# from evidence.json is a recall FAIL.
run_if "229-01 (D2) inventory-recall: labeled inventory fully recalled" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check inventory-recall

# D5 (REQ D5): FeedbackResultSchema validates - governing thought + 2-3 MECE branches
# + step structure (Minto structural validity).
run_if "229-02 (D5) schema: FeedbackResultSchema Minto/MECE shape" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check schema

# D8 (REQ D8): pairwise shingle-Jaccard similarity below threshold across the cohort
# (no templated/generic feedback); the near-dup swap test passes.
run_if "229-02 (D8) similarity: pairwise Jaccard below template ceiling" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check similarity

# D9 (REQ D9): total_cost_usd per submission <= $3.00 (the per-unit fuse inside the
# quoted $4-5 ceiling).
run_if "229-02 (D9) cost-ledger: per-submission spend under the fuse" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check cost-ledger

# D4 (REQ D4): zero student-specific strings in any Brain query payload (Part 8 query
# hygiene - generic handles only, read-only posture).
run_if "229-03 (D4) part8-hygiene: no student strings in Brain payload" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check part8-hygiene

# D3 (REQ D3): duplicate-anchor probes score within 1 band of each other with an
# identical pinned model_id across the cohort (fairness at N=200).
run_if "229-03 (D3) drift: duplicate-anchor probes within 1 band" "scripts/huji-eval.cjs" \
  node scripts/huji-eval.cjs --check drift

# D6/D7 (REQ D6, D7): the LLM judge calibration protocol. Guarded on the judge prompt.
# ALWAYS self-verifies the pure calibration math (Spearman >= 0.7, Dental post > pre,
# DnATA < Lucid turn RED the moment the gate logic regresses); the LIVE judge only runs
# when ANTHROPIC_API_KEY is set, so a structural run never depends on the model call. An
# uncalibrated judge fails closed and can never gate delivery (threat T-229-06-01).
run_if "229-06 (D6/D7) judge calibration: anchor protocol fails closed under 0.7" "$EVAL/judge-prompt.md" \
  node scripts/huji-eval.cjs --suite anchors --judge

# D10 (REQ D10): kill/resume skips completed .done submissions and there is zero
# cross-student context bleed at N=200. Guarded on the batch orchestrator (a later
# wave); the leg runs the kill/resume + cross-bleed grep that harness exposes.
run_if "229-04 (D10) kill/resume + cross-bleed: .done skip, zero context bleed" "scripts/huji-batch.cjs" \
  node scripts/huji-batch.cjs --selftest-killresume

echo "======================================"
echo "Phase 229: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"

# ---------------------------------------------------------------------------
# PHASE GATE PART 2 -- MANDATORY HUMAN CALIBRATION CHECKPOINT (NOT AUTOMATED)
# ---------------------------------------------------------------------------
# This is a REAL validation leg, but it is human-run and can NEVER be asserted
# green by this script (run-all-226 precedent). Green above proves STRUCTURE only.
echo ""
echo "PHASE GATE PART 2 (HUMAN, not asserted here):"
echo "  Run: node scripts/huji-eval.cjs --suite demo   (both customer samples end to end)"
echo "  Hand the two feedback artifacts to Amnon Dekel and record his verdict verbatim."
echo "  The acceptance criterion is his subjective judgment that the feedback is"
echo "  \"better than a TA\". Structural green above is necessary but NOT sufficient;"
echo "  the sale is the human \"better than a TA\" verdict, never an automated assertion."
echo ""

# Non-zero exit on any FAIL (same convention as run-all-226).
[ "$FAIL" -eq 0 ]
