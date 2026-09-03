#!/usr/bin/env bash
# Phase 339 Plan 03, Task 1 (FLIP-07) -- the cross-repo note file-assertion
# arm.
# =============================================================================
# 1. `docs/339-NOTE-theo-desktop-connector-key.md` must exist at exactly that
#    path, because Theo's shipped README (commit `11d6f82`) already cites it
#    by path. A missing file is a 404 inside a document users are told to
#    read -- that is why this arm hard-gates a file's mere existence, which
#    would otherwise be a strange thing to test.
# 2. The note must carry at least 40 lines and five literals: the connector
#    key `mindrian-brain`, the direct-connector URL (WITH the `/mcp` path,
#    unlike `brain-client.cjs:24`'s bare origin), `BRAIN_TOOL_MATCHER`, the
#    egress-guard script name, and Theo's README commit hash `11d6f82` --
#    because the whole point of the note is stating the mechanism: a
#    connector registered under a different key produces tool names that
#    match neither `BRAIN_TOOL_MATCHER` nor the egress guard, and
#    `scripts/part8-egress-guard-hook.cjs` allows UNCONDITIONALLY when
#    `isBrainTool` is false.
# 3. The note carries zero em-dashes (repo-wide house style, CLAUDE.md).
#
# What this arm deliberately does NOT key on: the note's prose wording beyond
# the five required literals, or any line-number inside the note -- only the
# literals' presence.
#
# SKIP CONVENTION (tests/test-254-live-normalize-probe.sh's precedent,
# copied for aggregator-behavior consistency): this arm needs no live Brain
# call and never prints a `SKIP` line, so it always resolves PASS or FAIL
# through the aggregator's `run_may_skip` handling -- the convention is
# copied here only so the `.sh` glob arm's shape stays consistent across
# every Phase 339 `.sh` test, not because this arm ever skips in practice.
#
# Phase 339, 2026-09-03. This file is RED on this run and stays RED until
# plan 339-09 writes the note: `test -f` on a file that does not exist yet is
# the correct wave-1 state, not a defect.
#
# No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NOTE="docs/339-NOTE-theo-desktop-connector-key.md"

fail() {
  echo "FAIL: $1"
  exit 1
}

if [ ! -f "$NOTE" ]; then
  fail "$NOTE does not exist (expected once plan 339-09 lands; correct RED state in wave 1)"
fi

LINE_COUNT="$(wc -l < "$NOTE" | tr -d ' ')"
if [ "$LINE_COUNT" -lt 40 ]; then
  fail "$NOTE has $LINE_COUNT lines, need at least 40"
fi

REQUIRED_LITERALS=(
  'mindrian-brain'
  'https://theo-mcp.onrender.com/mcp'
  'BRAIN_TOOL_MATCHER'
  'part8-egress-guard-hook.cjs'
  '11d6f82'
)

for LIT in "${REQUIRED_LITERALS[@]}"; do
  grep -Fq -- "$LIT" "$NOTE" || fail "$NOTE is missing required literal: $LIT"
done

# Em-dash fence: the grep -P rc>=2 scan-broke arm, same shape as
# tests/run-all-339.sh's own no-em-dash fence.
EMDASH_HITS="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$NOTE" 2>/dev/null)"
EMDASH_RC=$?
if [ "$EMDASH_RC" -ge 2 ]; then
  fail "em-dash scan broke on $NOTE (grep -P unavailable or errored, rc=$EMDASH_RC)"
elif [ -n "$EMDASH_HITS" ]; then
  fail "forbidden em-dash found in $NOTE"
fi

echo "PASS: $NOTE exists, has $LINE_COUNT lines, carries all five required literals, zero em-dashes"
exit 0
