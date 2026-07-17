#!/usr/bin/env bash
# Phase 230 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# MindrianOS skill-fleet-optimization pipeline (WS1 trigger accuracy + WS2 code
# review). Modeled verbatim on tests/run-all-229.sh conventions: the same run/run_if
# counters, the same non-zero-exit-on-FAIL discipline, the same file-guarded SKIP
# doctrine (SKIP is printed with a counter, never silent). No new convention invented.
#
# This script is the AUTOMATED half of the phase gate, deterministic and ZERO-API-SPEND
# by design. The funnel/loop/review LLM layer (the ~800-1,000 sonnet funnel calls and
# the opus adversarial review) runs on demand INSIDE a pipeline run, gated on the smoke
# calibration; it is deliberately NOT wired here and never runs on push (AI-SPEC Section
# 5 "CI/CD Integration": the deterministic code layer only). Every leg below is a
# selftest or a deterministic --suite/--check over on-disk artifacts.
#
# D-dimension coverage (each dimension enforced twice: once inside the pipeline scripts
# in Plans 02-04, once independently over artifacts by skillopt-eval here):
#   D5 no-silent-skip      -> reconciliation identity (funnel selftest + eval --suite)
#   D3 do-no-harm          -> regressed_query_count == 0 gate (triggerloop + eval)
#   D6 write-path          -> assertUnderOut containment (every selftest + eval)
#   D4 evidence-quote      -> verbatim-substring anchor (codereview + eval)
#   D7 smoke agreement     -> smoke-replay (eval --suite, SKIP until a live funnel)
#
# Legs are run or run_if (file-guarded), so a partially-landed phase exits cleanly with
# a SKIP counter rather than RED-failing on absence. bash only. No em-dashes.

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
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# Assert the inventory reports exactly 124 skills (the fleet size Plan 01 froze). A
# drift in the count is a real regression (a SKILL.md added/removed unnoticed).
assert_inventory_124() {
  node scripts/skillopt-inventory.cjs --check | grep -q '124 skills'
}

# 230-01a (D6): the zod contract module selftest -- valid + reject fixture per schema,
# the inlining chokepoint clean, the assertUnderOut guard enforced. The single source
# of truth for every verdict shape in the phase.
run_if "230-01a schemas: zod contracts valid+reject, inlining clean, containment guard" "lib/core/skillopt-schemas.cjs" \
  node lib/core/skillopt-schemas.cjs

# 230-01b: inventory selftest (backing detection, family grouping, D6 containment) plus
# the 124-count assertion (fleet size did not drift).
run_if "230-01b inventory: selftest (backing + family + containment)" "scripts/skillopt-inventory.cjs" \
  node scripts/skillopt-inventory.cjs --selftest
run_if "230-01b inventory: --check reports 124 skills" "scripts/skillopt-inventory.cjs" \
  assert_inventory_124

# 230-02a: per-family eval-query generation selftest (deterministic train/validation
# split, both kinds in both splits, no model-visible split field).
run_if "230-02a genqueries: stratified train/validation split selftest" "scripts/skillopt-genqueries.cjs" \
  node scripts/skillopt-genqueries.cjs --selftest

# 230-02b (D5): the roster-wide funnel selftest -- miss->flag, medium->flag, clean->pass,
# unparseable->not_evaluated, resume skip, the reconciliation gate, concurrency clamp,
# and the induced not-evaluated probe.
run_if "230-02b funnel: flag rule + reconciliation + induced probe selftest" "scripts/skillopt-funnel.cjs" \
  node scripts/skillopt-funnel.cjs --selftest

# 230-03 (D3/D7): the flagged-only real trigger-test loop selftest -- the Skill-fire
# detector (pinned against the LIVE captures), best-by-validation selection, and the
# regressed_query_count == 0 do-no-harm gate. Guarded on the live firing capture
# existing (the detector is pinned against those bytes; the selftest also embeds them
# inline so it is CI-hermetic when present).
run_if "230-03 triggerloop: Skill-fire detector + do-no-harm selftest" "$ROOT/.planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/out/captures/firing-beautiful-question.jsonl" \
  node scripts/skillopt-triggerloop.cjs --selftest

# 230-04 (D4): the WS2 adversarial code-review selftest -- the deterministic
# evidence-quote anchor (proven against the real check-card-fire.cjs bytes), refuted
# exclusion, missing-verdict not_evaluated, chunk offsets, review-only allowlist.
run_if "230-04 codereview: evidence anchor + Refute-or-Promote selftest" "scripts/skillopt-codereview.cjs" \
  node scripts/skillopt-codereview.cjs --selftest

# 230-06a (D5/D6): the merge selftest -- probe excluded from accuracy but listed by
# name, refuted-excluded-but-counted, missing loop NOT RUN, blocked-not-proposed, the
# reconciliation exit gate, and the terminal STOP banner + itemized approval checklist.
run_if "230-06a merge: aggregate + reconcile + STOP-gate selftest" "scripts/skillopt-merge.cjs" \
  node scripts/skillopt-merge.cjs --selftest

# 230-06b (D3/D4/D5/D6/D7): the independent eval layer over on-disk artifacts. Every
# check re-derives its dimension from the artifacts alone; artifact-dependent checks
# SKIP with explicit lines until a live pipeline run lands them.
run_if "230-06b eval: independent D3/D4/D5/D6/D7 re-derivation over artifacts" "scripts/skillopt-eval.cjs" \
  node scripts/skillopt-eval.cjs --suite code

echo "======================================"
echo "Phase 230: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"

# ---------------------------------------------------------------------------
# PHASE GATE PART 2 -- MANDATORY HUMAN LEGS (NOT AUTOMATED)
# ---------------------------------------------------------------------------
# Green above proves the deterministic STRUCTURE only. The paid LLM layer and the
# human judgment calls are REAL validation legs that this script can never assert.
echo ""
echo "PHASE GATE PART 2 (HUMAN + on-demand paid layer, not asserted here):"
echo "  1. Jonathan's smoke pre-labels (Plan 05 checkpoint) -- the D7 measuring stick"
echo "     (smoke-labels.json) is the hand-approved reference the funnel is graded against."
echo "  2. The smoke calibration review (Plan 07 checkpoint) -- run the funnel + review"
echo "     LIVE on the smoke set and confirm funnel-vs-manual agreement clears tolerance"
echo "     BEFORE any full-fleet spend (this costs money and runs on demand, never on push)."
echo "  3. The future full-fleet opt-in stays OUTSIDE this phase -- the 124-skill batch and"
echo "     any real SKILL.md / script edit happen only after an explicit itemized human"
echo "     sign-off at the merge STOP gate (CONTEXT.md Execution mechanism decision, CFM4)."
echo ""

# Non-zero exit on any FAIL (same convention as run-all-229).
[ "$FAIL" -eq 0 ]
