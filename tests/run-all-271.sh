#!/usr/bin/env bash
# Phase 271 verification aggregator (bare reference-path resolution: anchor every
# plugin-relative `references/...` citation so a slash command reads from the
# plugin install dir instead of the user's cwd).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   271-01: the bare-plugin-path class is machine-detectable with file:line
#     precision, and its own test is fixture-driven rather than pinned to live
#     tree counts that plans 03 and 04 are about to change.
#   271-02: /mos:radar's dev-repo-cwd citations are a declared, reasoned
#     exception decided by a human, not a silent gap in the sweep.
#   271-03: every command citation resolves against the plugin install dir, and
#     the generated skill mirrors are regenerated from the fixed commands.
#   271-04: hand-authored skills, agents and pipeline stage files are anchored
#     too, since none of them is covered by the mirror generator.
#   271-05: the gate runs at release time, so the class cannot silently reappear
#     in the 46th command authored next month.
#
# THE --check ARM IS EXPECTED TO FAIL UNTIL PLAN 271-04 LANDS. That red is the
# intended RED BASELINE of this phase, not a broken test: the tree genuinely
# carries unanchored citations until the sweep runs, and a gate that reported
# green against them would be the actual defect. Plan 271-01 measured the
# baseline at 139 violations across 4 surfaces. Do NOT "fix" this runner by
# softening the arm; fix it by landing 271-03 and 271-04.
#
# The last arm is a DO-NOT-REGRESS arm, not a Phase 271 deliverable:
# commands/file-meeting.md is the one file already fixed (commit 242e32db, RCA
# .planning/debug/resolved/file-meeting-missing-reference-files.md). Its gate
# tripwire suite runs here so this phase's sweep cannot quietly re-break the
# file that motivated the phase.
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

# 1. The gate's own fixture suite. Synthetic markdown only, never the live tree,
#    so this arm stays green while 271-03 and 271-04 drive the live counts to 0.
run "271 fixture suite" node tests/test-271-plugin-path-anchoring.cjs

# 2. The gate itself against the live tree. RED until 271-04 lands (see header).
run "271 anchoring gate (--check)" node scripts/check-plugin-path-anchoring.cjs --check

# 3. The skill mirrors must stay byte-consistent with their commands after the
#    271-03 sweep edits commands/*.md.
run "skill mirrors (--check)" node scripts/build-skill-mirrors.cjs --check

# 4. DO-NOT-REGRESS: the already-fixed file-meeting gates.
run "265 file-meeting gate tripwire" node tests/test-265-file-meeting-gates.cjs

echo "======================================"
echo "Phase 271: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
