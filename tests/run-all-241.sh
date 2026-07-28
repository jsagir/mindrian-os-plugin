#!/usr/bin/env bash
# Phase 241 verification aggregator -- the single PASS/FAIL gate for
# "Feynman-MINTO: the self-repair loop actually repairs, and the guardian is
# heard on every surface".
#
# What this phase had to prove, in plain language:
#   1. The guardian is heard on BOTH Stop paths -- the CLI legacy path
#      (scripts/on-stop, fixed in 241-01) AND the shared mindrian-core Stop
#      path Desktop/Cowork/CLI-under-MINDRIAN_MCP_FIRST all route through
#      (lib/mcp/stop-gate-handler.cjs, fixed in this closing plan, 241-05).
#      A CLI-only fix would have left three install targets silently
#      unreported while the default CLI path looked healthy.
#   2. A slow report-write is no longer dropped by a 1-second hard kill
#      (241-01): the guardian gets a soft internal walk deadline, and the
#      outer ceiling is a 3-second last-resort backstop, not a silent
#      truncation point.
#   3. The two stop-path debounce-queue "drains" (241-02) do not vacuum a
#      pending regen intent before the real, already-live consumer
#      (scripts/intent-classifier, the extensionless UserPromptSubmit hook)
#      gets a turn -- they now read-only peek() and report an honest count.
#   4. The severity ladder (241-03) actually reaches the critical-repair
#      enqueue gate on the two breaches navigators actually hit (missing
#      MINTO.md, missing governing_thought), not only two rare crash
#      artifacts.
#   5. Pre-commit (241-04) WARNS instead of hard-blocking by default, with a
#      documented --strict/MINTO_PRECOMMIT_STRICT=1 opt-in restoring the
#      pre-241 hard-fail contract, proven by a REAL git commit in both
#      directions.
#
# This harness GLOB-DISCOVERS every tests/test-241-* file (both .cjs and
# .sh) and runs it, so a later plan adds coverage WITHOUT editing this file.
# It FAILS on zero glob discoveries -- the tests/run-all-234.sh /
# tests/run-all-233.sh lesson: a harness that prints green over an empty
# glob is worse than no harness, because it still LOOKS clean.
#
# Legs that live under lib/memory/ (a tests/test-241-* glob cannot see them)
# are wired BY HAND below, immediately after the glob, so none of them is
# ever silently never-run:
#   - lib/memory/guardian-onstop-reaches-user.test.cjs   (241-01, SC1)
#   - lib/memory/minto-debounce-consumer-census.test.cjs (241-02, F-0)
#   - lib/memory/precommit-real-commit.test.cjs           (241-04, SC3)
#   - lib/memory/feynman-minto-guardian.test.cjs          (core suite)
#   - lib/memory/feynman-minto-invariants.test.cjs        (core suite, F-2)
#   - lib/memory/debouncer-drain-at-prompt.test.cjs       (the real F-0 consumer)
#   - lib/memory/run-feynman-tests.cjs                    (whole-suite roll-up)
#
# TWO EXPECTED-RED CONDITIONS, DOCUMENTED HERE RATHER THAN SILENTLY WORKED
# AROUND (the tests/run-all-234.sh "EXPECTED RED LEG WHILE THE PHASE IS IN
# FLIGHT" precedent -- run with `run`, never `run_may_skip`, so a real FAIL
# is counted, not suppressed):
#
#   (a) lib/memory/run-feynman-tests.cjs (the 396-file mega-suite) hangs
#       indefinitely inside test/84-smart-notebook-copilot.test.cjs, a
#       pre-existing, already-documented SQLite handle defect in
#       lib/core/lazygraph-ops.cjs (241-01-SUMMARY.md, 241-03-SUMMARY.md,
#       241-04-SUMMARY.md each independently reproduced this exact hang; see
#       .planning/phases/241-feynman-minto/deferred-items.md). That file is
#       owned by a separate, concurrent Phase 236 session and is explicitly
#       out of scope for this phase to touch. This leg is wrapped in a
#       bounded `timeout` so THIS harness never hangs forever, and it is
#       expected to time out (exit 124) for that one already-documented,
#       unrelated reason.
#   (b) lib/memory/guardian-onstop-reaches-user.test.cjs's LEG B test carries
#       a tight, load-sensitive timing margin by its own 241-01-SUMMARY.md
#       admission (~2874-2927ms observed against a 3000ms budget, with only
#       ~100-150ms of headroom). On a machine running multiple concurrent
#       Claude Code sessions this can intermittently overrun; see
#       deferred-items.md for the observed evidence that this is unrelated
#       to any file this phase's own plans touch.
#
# The final legs are the PERMANENT tripwire against the four retired
# defects this phase closed, in the run-all-233.sh / run-all-234.sh
# comment-stripped grep-gate idiom: comment lines are stripped BEFORE the
# grep so this harness's own header prose can neither trip the gate nor
# satisfy it.
#
# Every leg is fully hermetic: fixtures live under mkdtemp, nothing is
# written inside the repo tree except this file's own stdout. No em-dashes.

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

# Strips comment lines BEFORE the grep so this harness's own explanatory
# header prose (or any other file's comments) can neither trip the gate nor
# satisfy it. `grep -v '^[[:space:]]*#'` handles bash/python-style comments;
# the second stage handles JS `//` / `*` / `/*` block-comment bodies.
strip_comments() {
  grep -v '^[[:space:]]*#' "$1" 2>/dev/null | grep -vE '^[[:space:]]*(//|\*|/\*)' 2>/dev/null
}

echo "======================================"
echo "Phase 241: Feynman-MINTO verification"
echo "======================================"
echo ""

# ---------------------------------------------------------------------------
# GLOB-discover tests/test-241-* (both .cjs and .sh). FAILS the run if zero
# files are discovered -- see header.
# ---------------------------------------------------------------------------
shopt -s nullglob
found=0
for t in tests/test-241-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-241-*.sh; do
  found=1
  run "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-241-* files discovered"
  exit 1
fi

# ---------------------------------------------------------------------------
# Explicit legs (live under lib/memory/, outside the tests/test-241-* glob).
# ---------------------------------------------------------------------------
run "guardian-onstop-reaches-user.test.cjs (241-01, SC1)" node lib/memory/guardian-onstop-reaches-user.test.cjs
run "minto-debounce-consumer-census.test.cjs (241-02, F-0)" node lib/memory/minto-debounce-consumer-census.test.cjs
run "precommit-real-commit.test.cjs (241-04, SC3)" node lib/memory/precommit-real-commit.test.cjs
run "feynman-minto-guardian.test.cjs (core suite)" node lib/memory/feynman-minto-guardian.test.cjs
run "feynman-minto-invariants.test.cjs (core suite, F-2)" node lib/memory/feynman-minto-invariants.test.cjs
run "debouncer-drain-at-prompt.test.cjs (the real F-0 consumer)" node lib/memory/debouncer-drain-at-prompt.test.cjs

# Whole-suite roll-up. Bounded timeout so a pre-existing, out-of-scope hang
# (see header, condition (a)) cannot hang THIS harness forever. Still run
# with `run`, not `run_may_skip` -- a real FAIL is counted, not suppressed.
run "run-feynman-tests.cjs (whole-suite roll-up, 396 files)" timeout 240 node lib/memory/run-feynman-tests.cjs

# ---------------------------------------------------------------------------
# Permanent tripwire: the four retired defects must never come back.
# ---------------------------------------------------------------------------
echo "--- regression tripwire: the four retired defects stay retired ---"
TRIPWIRE_TARGETS=(
  "scripts/on-stop"
  "lib/mcp/stop-gate-handler.cjs"
  "scripts/minto-debouncer.cjs"
  "scripts/intent-classifier"
  "scripts/feynman-minto-guardian.cjs"
)
TRIPWIRE_OK=1

for tgt in "${TRIPWIRE_TARGETS[@]}"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; TRIPWIRE_OK=0
    continue
  fi
  # F-0 (241-02): the unconditional zero-age-floor vacuum must not return at
  # either production stop-path drain site.
  VACUUM_HITS="$(strip_comments "$tgt" | grep -nE "olderThanMs:[[:space:]]*0\\b|--older-than=0")"
  if [ -n "$VACUUM_HITS" ]; then
    echo "    FORBIDDEN: zero-age-floor vacuum reintroduced in: $tgt"
    printf '      %s\n' "$VACUUM_HITS"
    TRIPWIRE_OK=0
  fi
done

# F-1 (241-01/241-05): scripts/on-stop must not carry the old 1-second hard
# kill or the >/dev/null discard on the guardian invocation.
TIMEOUT1_HITS="$(strip_comments "scripts/on-stop" | grep -n 'timeout 1 node')"
if [ -n "$TIMEOUT1_HITS" ]; then
  echo "    FORBIDDEN: the old 1-second hard kill reintroduced in scripts/on-stop"
  printf '      %s\n' "$TIMEOUT1_HITS"
  TRIPWIRE_OK=0
fi
DISCARD_HITS="$(strip_comments "scripts/on-stop" | grep -nF 'on-stop "${ROOM_DIR}" >/dev/null 2>&1')"
if [ -n "$DISCARD_HITS" ]; then
  echo "    FORBIDDEN: the >/dev/null discard reintroduced on the guardian invocation in scripts/on-stop"
  printf '      %s\n' "$DISCARD_HITS"
  TRIPWIRE_OK=0
fi

if [ "$TRIPWIRE_OK" -eq 1 ]; then
  echo "    clean: no forbidden token found on any executable line in any sweep target"
  echo ">>> regression tripwire: PASSED"; PASS=$((PASS+1))
else
  echo ">>> regression tripwire: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 241: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
