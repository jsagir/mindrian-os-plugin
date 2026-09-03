#!/usr/bin/env bash
# Phase 339 Plan 03, Task 1 (FLIP-08) -- the 269-05 checklist file-assertion
# arm.
# =============================================================================
# D-14 (339-CONTEXT.md) names the danger this arm exists to catch: Phase
# 269-05's six-item Theo-readiness checklist read PASS from 2026-08-27
# onward while the real content and infrastructure legs went unchecked -- a
# checklist that can read green while its real leg is untested is worse than
# no checklist. This arm scopes EVERY assertion to Task 1's own extracted
# block (never to the whole plan file), then proves:
#   - the three real legs are present, quoted `Leg (a)`, `Leg (b)`, `Leg (c)`
#   - leg (a) names `09-FLIP-RECORD.md` as its source
#   - the `/register` host reads `theo-mcp.onrender.com`
#   - any surviving mention of the retired incumbent host
#     (`pws-brain-mcp.onrender.com`) sits on a line that ALSO carries the
#     word `Retired` -- history is fine, a live check is not
#   - any surviving `Plans: TBD` line ALSO carries `Retired` -- the old
#     items cannot silently come back as live checks
#
# What this arm deliberately does NOT key on: line numbers inside the plan
# file (the extraction is heading/marker-scoped via awk, not line-number
# scoped), or any assertion against the WHOLE file -- only against the
# extracted Task 1 block. What hard-gates here: every assertion below. What
# only reports: nothing -- this arm has no report-only leg.
#
# SKIP CONVENTION (tests/test-254-live-normalize-probe.sh's precedent,
# copied for aggregator-behavior consistency): no live Brain call, never
# prints SKIP, always resolves PASS or FAIL through the aggregator's
# `run_may_skip` handling.
#
# Phase 339, 2026-09-03. RED on this run and stays RED until plan 339-09
# rewrites 269-05-PLAN.md Task 1 to the three-leg shape; today's Task 1 is
# still the pre-339 "confirm Theo Phase 9 has a firm timeline" checklist,
# which carries none of the required markers -- that is the correct wave-1
# state, not a defect.
#
# No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLAN=".planning/phases/269-moat-shift-install-update-entitlement-gate-replaces-per-quer/269-05-PLAN.md"

fail() {
  echo "FAIL: $1"
  exit 1
}

if [ ! -f "$PLAN" ]; then
  fail "$PLAN does not exist"
fi

# Extraction: from the line containing 'Task 1: BLOCKING GATE' (inclusive)
# through the first closing </task> tag (inclusive), then stop. This is a
# marker-scoped extraction (a substring match, not a fixed line number), so
# it survives edits above or below Task 1's own block.
BLOCK="$(awk '
  /Task 1: BLOCKING GATE/ { f = 1 }
  f { print }
  f && /<\/task>/ { exit }
' "$PLAN")"

if [ -z "$BLOCK" ]; then
  fail "could not extract Task 1's block from $PLAN (marker 'Task 1: BLOCKING GATE' not found)"
fi

# Prove the scoping is real: this script itself must contain an awk
# extraction before its first grep (acceptance criterion, verified by a
# structural self-check rather than trusted by convention).
SELF="$0"
AWK_LINE="$(grep -n '^BLOCK=' "$SELF" | head -1 | cut -d: -f1)"
FIRST_GREP_LINE="$(grep -n 'grep -Fq' "$SELF" | head -1 | cut -d: -f1)"
if [ -z "$AWK_LINE" ] || [ -z "$FIRST_GREP_LINE" ] || [ "$AWK_LINE" -ge "$FIRST_GREP_LINE" ]; then
  fail "structural self-check failed: this script must perform the awk extraction before its first grep -Fq"
fi

REQUIRED_LITERALS=(
  'Leg (a)'
  'Leg (b)'
  'Leg (c)'
  '09-FLIP-RECORD.md'
  'theo-mcp.onrender.com'
)

for LIT in "${REQUIRED_LITERALS[@]}"; do
  printf '%s' "$BLOCK" | grep -Fq -- "$LIT" || fail "extracted Task 1 block is missing required literal: $LIT"
done

# Every line naming the retired incumbent host must also carry 'Retired'.
# History is fine (naming the old host as what it used to check); a live
# check on the old host is not.
BAD_HOST_LINES="$(printf '%s\n' "$BLOCK" | grep -F 'pws-brain-mcp.onrender.com' | grep -vF 'Retired' || true)"
if [ -n "$BAD_HOST_LINES" ]; then
  fail "line(s) name pws-brain-mcp.onrender.com without carrying 'Retired': $BAD_HOST_LINES"
fi

# Every surviving 'Plans: TBD' line must also carry 'Retired' -- the old
# items 1-3 (Theo Phase 7/8/9 Plans: TBD) cannot silently come back as live
# checks.
BAD_TBD_LINES="$(printf '%s\n' "$BLOCK" | grep -F 'Plans: TBD' | grep -vF 'Retired' || true)"
if [ -n "$BAD_TBD_LINES" ]; then
  fail "line(s) carry 'Plans: TBD' without carrying 'Retired': $BAD_TBD_LINES"
fi

echo "PASS: 269-05-PLAN.md Task 1 carries all three real legs, names 09-FLIP-RECORD.md and theo-mcp.onrender.com, and every retired-host/retired-TBD line is marked Retired"
exit 0
