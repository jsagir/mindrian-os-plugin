#!/usr/bin/env bash
# Phase 238 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# Decision Gates cluster. Modelled on tests/run-all-209.sh's run_if pattern.
#
# Phase 238 closes GATE-01 (a chain's halt gate resolves through the SAME
# ledger that minted it, and gate_answer/chain resume reject a chosen value
# not among the card's actual options), GATE-03 (gate minting and consumption
# are session-scoped, and the retry-counter file survives N parallel writers
# with no torn write or lost update), and GATE-04 (the card-fire backstop
# stops firing on ordinary citation/footnote prose while a genuine unrendered
# card fixture still fires red).
#
# All nine legs are pre-declared here by plan 01 (this file) so no later-wave
# plan ever edits this runner (decision D-01, tests/run-all-209.sh header
# lines 16-19 is the in-repo precedent). Each leg is run_if, guarded on a
# file that must exist, so legs SKIP until their files land -- expected
# mid-phase, not a failure. Leg 7 (the GATE-04 card-fire corpus) is expected
# to FAIL between 238-07 (which creates the corpus and its test, authored to
# be observed RED before the fix, matching the Phase 236-01 precedent) and
# 238-08 (which lands the classifier fix that turns it green). bash only. No
# em-dashes.

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

run_if "238-02 session-scoped ledger (GATE-03 A)" "tests/test-238-session-scoped-ledger.cjs" \
  node tests/test-238-session-scoped-ledger.cjs
run_if "238-03 gate_answer chosen validation (GATE-01 G-2)" "tests/test-238-chosen-validation.cjs" \
  node tests/test-238-chosen-validation.cjs
run_if "238-04 chain resume chosen validation (GATE-01 G-2)" "tests/test-238-chain-chosen-validation.cjs" \
  node tests/test-238-chain-chosen-validation.cjs
run_if "238-05 retry counter fence (GATE-03 B)" "tests/test-238-retry-counter-fence.cjs" \
  node tests/test-238-retry-counter-fence.cjs
run_if "238-06 one ledger end to end (GATE-01 G-1)" "tests/test-238-one-ledger.cjs" \
  node tests/test-238-one-ledger.cjs
run_if "238-06 mint-ratifier seam liveness (GATE-01 G-1)" "tests/test-238-mint-ratifier-seam.cjs" \
  node tests/test-238-mint-ratifier-seam.cjs
run_if "238-07/08 card-fire corpus (GATE-04)" "tests/test-238-card-fire-corpus.cjs" \
  node tests/test-238-card-fire-corpus.cjs
run_if "regression: 209 backstop tuning (ASCII_BOX_GLYPH_RE stability)" "tests/test-209-backstop-tuning.cjs" \
  node tests/test-209-backstop-tuning.cjs
run_if "regression: 198 chain run halt" "tests/test-198-chain-run-halt.test.cjs" \
  node tests/test-198-chain-run-halt.test.cjs

echo "======================================"
echo "Phase 238: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
