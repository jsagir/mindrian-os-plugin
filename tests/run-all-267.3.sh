#!/usr/bin/env bash
# Phase 267.3 verification aggregator (reward-before-investment guard
# jurisdiction: give a surface with no frontmatter a way to declare, and give
# the vocabulary an honest term for the classes that had none).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   267.3-01: the jurisdiction is MEASURED (46/67/0 over 113 commands, four
#     independent proofs of the guard's scope) and the three design questions
#     are ruled by a human, not assumed.
#   267.3-02: a surface with no frontmatter can declare through
#     data/first-reward-surfaces.json, the linter validates it through the SAME
#     enum and the SAME renderer as frontmatter, every fail-closed case fails
#     closed, and the pre-existing commands/*.md path is provably unchanged.
#   267.3-03 onward: the registry is populated, the 67 commands are declared,
#     and the whole-tree audit is promoted to a fail-closed release gate.
#
# THE COMMANDS-TREE FULL AUDIT IS DELIBERATELY NOT AN ARM HERE YET. It reads 67
# missing today and it is SUPPOSED to: plan 267.3-02 builds a mechanism and
# declares nothing. Plan 267.3-08 promotes it once plans 04, 06 and 07 have
# landed the declarations and it genuinely reads zero. Do not "fix" this runner
# by adding the audit early and softening it; that is the bypass habit the
# ruling (D-C, part 3) exists to prevent.
#
# The last two arms are DO-NOT-REGRESS arms, not Phase 267.3 deliverables: the
# linter's own suite and the Phase 245-02 staged-gate suite both own behavior
# this phase edits, so a regression to either surfaces in this phase's own
# runner rather than in someone else's.
#
# bash only. No emoji. No em-dashes (hyphens only).

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

# 1. The phase's own suites, discovered by glob rather than hand-listed, so a
#    later plan's test file is picked up without editing this runner.
#
#    A runner that finds nothing and prints green is worse than no runner: it
#    reports a passing phase while proving nothing. So zero discovered files is
#    a LOUD failure, not a quiet PASS=0.
shopt -s nullglob
PHASE_TESTS=(tests/test-267.3-*.cjs)
shopt -u nullglob

if [ "${#PHASE_TESTS[@]}" -eq 0 ]; then
  echo "======================================"
  echo "FATAL: the glob tests/test-267.3-*.cjs discovered ZERO test files."
  echo "This runner proves nothing in that state, so it fails rather than"
  echo "printing green. Either a test file was deleted or renamed, or you are"
  echo "running from the wrong directory (ROOT resolved to: $ROOT)."
  echo "======================================"
  exit 1
fi

for t in "${PHASE_TESTS[@]}"; do
  run "$t" node "$t"
done

# 2. DO-NOT-REGRESS: the linter's own suite. It owns REWARD_TYPES, the
#    frontmatter path, the pre-commit wire, and (as of 267.3-02) the
#    three-way vocabulary parity between the Set, the rule doc and the registry.
run "linter suite (do-not-regress)" node lib/core/mva-rule-linter.test.cjs

# 3. DO-NOT-REGRESS: the Phase 245-02 staged-gate suite. The commit gate is
#    explicitly NOT changed by this phase (ruling D-C, part 1); this arm is how
#    that claim is checked rather than asserted.
run "245-02 staged gate (do-not-regress)" node tests/test-245-reward-guard-staged.cjs

# 4. The registry gate itself against the live tree. Green from the day the
#    registry is minted, because the registry is authored complete.
run "267.3 registry gate (--surfaces)" node scripts/check-reward-before-investment.cjs --surfaces .

echo "======================================"
echo "Phase 267.3: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
