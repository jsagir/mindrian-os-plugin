#!/usr/bin/env bash
# Phase 274 verification aggregator (bare `scripts/` invocation anchoring --
# the adjacent class Phase 271 deliberately left for this sibling phase).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   274-01: the script tier is scoped by RESOLUTION MECHANISM (every unanchored
#     plugin-relative scripts/ invocation, whatever verb precedes it) and
#     classifies anchored/allowlisted/target with a gateable --check-scripts
#     exit code, matching the citation tier's own rigor.
#   274-02: every command-surface invocation site is anchored with the quoted
#     short form, and the generated skill mirrors are regenerated.
#   274-03: the hand-authored skill sites are anchored with the fail-closed
#     long form.
#   274-04: the agent site is anchored, and the deliberate ./scripts/
#     cwd-relative fallback lines (help.md, eureka.md) get a reasoned
#     SCRIPT_ALLOWLIST entry rather than being silently swept.
#   274-05: --check-scripts goes green against the live tree.
#   274-06: gate 10f is wired into scripts/verify-release, fail-closed,
#     zero-tolerance, wired LAST so it never blocks a release for work this
#     phase has not finished yet (271-05's own sequencing lesson).
#
# THE --check-scripts ARM TURNED GREEN IN 274-05 (2026-09-01). Through Wave 0
# and Wave 1 (274-01..04) it was the phase's own documented RED BASELINE, not
# a broken test: the tree genuinely carried unanchored scripts/ invocations
# until the mirror-regeneration + full-sweep reconciliation pass in 274-05
# closed Pitfall 1 (the mirror gap the scanner structurally cannot see) and
# re-verified the live tree at zero violations. Plan 274-01 widened the
# predicate and re-measured the baseline above 34 (the pre-widening count)
# once the python3 and ./scripts/ sites are included. If this arm ever goes
# red again, that is a real regression -- do NOT "fix" this runner by
# softening the arm; find and fix the newly-unanchored site.
#
# The last arm is a DO-NOT-REGRESS arm, not a Phase 274 deliverable: it
# re-runs the CITATION gate (--check) unchanged, so this phase's own script-
# tier edits to check-plugin-path-anchoring.cjs can never quietly re-break
# gate 10c (Phase 271-05).
#
# D-02's stated Desktop/Cowork gap: the CLI smoke test below is the only
# automated runtime proof this phase has. Desktop and Cowork get the same
# static --check-scripts coverage (surface-independent path-correctness
# logic) but no automated runtime execution test -- a deliberate, stated call
# per the Tri-Polar Design Rule, not a silent omission.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# 1. The gate's own fixture suite (274-01). Synthetic markdown only, never the
#    live tree, so this arm stays green while 274-02..04 drive the live
#    script-tier violation count to 0.
run "274 fixture suite" node tests/test-274-script-invocation-anchoring.cjs

# 2. The CLI runtime smoke test (274-01, ANCHOR-08). Does not depend on the
#    markdown sweep -- the scripts it drives already ship, so this passes
#    today.
run "274 CLI invocation smoke test" bash tests/smoke-274-cli-invocation.sh

# 3. The script-tier gate against the live tree. Turned GREEN in 274-05 (see
#    header); RED through 274-01..04 was the phase's documented baseline.
run "274 script-tier anchoring gate (--check-scripts)" node scripts/check-plugin-path-anchoring.cjs --check-scripts

# 4. DO-NOT-REGRESS: the citation tier (gate 10c, Phase 271-05) re-run
#    unchanged, so this phase's own edits to the shared instrument cannot
#    quietly re-break it.
run "271 citation-tier gate (--check), DO-NOT-REGRESS" node scripts/check-plugin-path-anchoring.cjs --check

echo "======================================"
echo "Phase 274: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
