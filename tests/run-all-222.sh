#!/usr/bin/env bash
# Phase 222 verification aggregator -- the ONE-COMMAND PASS/FAIL/SKIP gate for
# the reach-ranking unification (three disagreeing pickers -> one scored pick +
# a room-local Hedge weight layer). Mirrors tests/run-all-209.sh's run/run_if
# aggregator shape and tests/run-all-158.sh's comment-stripped grep-sweep legs.
#
# The two-part contract this gate proves (all legs green = the phase gate):
#   (1) Every per-plan node proof (Reqs 1-3, 5-7 + the Wave 1 weight-state
#       substrate) passes as a run_if-guarded leg, partial-landing safe.
#   (2) The phase's constitutional constraints are PERMANENT tripwires, not
#       one-time reviews:
#         - Part 8 (no prose/egress in the new ranking surfaces): a comment-
#           stripped fetch/http/.reason sweep over the two new modules.
#         - Part 9 (chokepoint-only db access): a comment-stripped
#           node:sqlite/DatabaseSync/fs sweep over the ranker PLUS a mandatory
#           navigation.cjs require assertion (reads ONLY via the chokepoint).
#         - Req 4 (zero new dependencies): the test-222-zero-deps.cjs require-
#           allowlist AND a git-diff leg on package.json / package-lock.json.
#
# Comment lines are stripped BEFORE every grep so header prose mentioning
# reason/sqlite/fetch never trips OR masks a gate (the run-all-158.sh:72-76
# grep-gate-hygiene idiom).
#
# bash only. No network. No model downloads. No emoji. No em-dashes
# (CLAUDE.md HARD RULE). Hyphens only.

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

# Strip whole-line comments (// or block-comment body lines starting with
# optional whitespace then // or * or /*) so header prose never trips a grep.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Node proof legs (Reqs 1-3, 5-7 + the Wave 1 weight-state substrate). Each is
# run_if-guarded on its file so a partially-landed phase exits cleanly with
# SKIPs rather than a crash.
# ---------------------------------------------------------------------------
run_if "222-01 weight-state (Req 3/7 substrate)" "tests/test-222-weight-state.cjs" \
  node tests/test-222-weight-state.cjs
run_if "222-02 rank-fired (Req 1)" "tests/test-222-rank-fired.cjs" \
  node tests/test-222-rank-fired.cjs
run_if "222-03 reach-wired (Req 2+6)" "tests/test-222-reach-wired.cjs" \
  node tests/test-222-reach-wired.cjs
run_if "222-04 hedge-update (Req 3)" "tests/test-222-hedge-update.cjs" \
  node tests/test-222-hedge-update.cjs
run_if "222-05 frozen-scalars (Req 5)" "tests/test-222-frozen-scalars.cjs" \
  node tests/test-222-frozen-scalars.cjs
run_if "222-06 degrade (Req 7)" "tests/test-222-degrade.cjs" \
  node tests/test-222-degrade.cjs
run_if "222-07 zero-deps (Req 4)" "tests/test-222-zero-deps.cjs" \
  node tests/test-222-zero-deps.cjs
# Quick 260728-7kc: the opt-in read-only ranking mode plus the runtime no-write
# proof for the two declared-read MCP pull tools. Lives on the 222 gate because
# it owns the ranker seam it exercises.
run_if "222-08 read-only rank + no-write MCP pulls (quick 260728-7kc)" "tests/test-222-readonly-rank.cjs" \
  node tests/test-222-readonly-rank.cjs
# Quick 260728-8av: the explicit navigator-triggered production trigger for the
# Hedge outcome-learning fold (RCA hedge-fold-has-no-production-trigger). Lives
# on the 222 gate because it owns the fold this leg proves is now reachable.
run_if "222-09 fold-wired (explicit refit entry point, RCA hedge-fold-has-no-production-trigger)" "tests/test-222-fold-wired.cjs" \
  node tests/test-222-fold-wired.cjs

# ---------------------------------------------------------------------------
# (a) Part 8 sweep -- the new ranking surfaces must never egress or read/write a
#     freeform reason string. Comment lines stripped first so a header comment
#     mentioning fetch/reason never self-invalidates the gate.
# ---------------------------------------------------------------------------
RANKER="lib/workflow/reach-hedge-ranker.cjs"
WEIGHTS="lib/core/navigation/ranker-weights.cjs"
REFIT="scripts/hedge-refit-pipeline.cjs"
PART8_RE="fetch\(|https?://|require\(['\"]node:http|\.reason\b"
echo "--- Part 8 sweep: no egress/prose in the new ranking surfaces ---"
PART8_OK=1
for tgt in "$RANKER" "$WEIGHTS" "$REFIT"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; PART8_OK=0
  elif strip_comments "$tgt" | grep -nE "$PART8_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN egress/prose token on an executable line in: $tgt"; PART8_OK=0
  fi
done
if [ "$PART8_OK" -eq 1 ]; then echo ">>> Part 8 sweep: PASSED"; PASS=$((PASS+1)); else echo ">>> Part 8 sweep: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# ---------------------------------------------------------------------------
# (b) Part 9 sweep -- the ranker reads room.db ONLY via the navigation.cjs
#     chokepoint: zero direct-db / fs tokens AND at least one navigation.cjs
#     require. Comment lines stripped first.
# ---------------------------------------------------------------------------
echo "--- Part 9 sweep: chokepoint-only db access in the ranker ---"
PART9_OK=1
if [ ! -f "$RANKER" ]; then
  echo "    MISSING sweep target: $RANKER"; PART9_OK=0
else
  # Captured to a variable first, then grepped via a here-string, for exactly the
  # reason block (b2) below already documents: `grep -q` stops reading as soon as
  # it matches, which under `set -o pipefail` can SIGPIPE the upstream
  # strip_comments and make the pipeline report non-zero even though the pattern
  # WAS found. Block (b2) called this out as "a real, reproducible race observed
  # on the pre-existing ranker sweep above" and fixed only its own leg; this leg
  # kept flipping between exit 0 and exit 141 across otherwise-identical runs
  # (observed 2026-07-31 during Phase 245-07: three consecutive PASSED runs
  # bracketed by two FAILED ones, on a byte-identical tree). Same fix, applied to
  # the leg the comment was written about.
  RANKER_STRIPPED="$(strip_comments "$RANKER")"
  if grep -nE "require\(['\"]node:sqlite|better-sqlite3|\bDatabaseSync\b|\bfs\.(read|write)" <<< "$RANKER_STRIPPED" >/dev/null 2>&1; then
    echo "    FORBIDDEN direct-db/fs token on an executable line in: $RANKER"; PART9_OK=0
  fi
  if ! grep -qE "require\(['\"]\.\./core/navigation\.cjs['\"]\)" <<< "$RANKER_STRIPPED"; then
    echo "    MISSING navigation.cjs chokepoint require in: $RANKER"; PART9_OK=0
  fi
fi
if [ "$PART9_OK" -eq 1 ]; then echo ">>> Part 9 sweep: PASSED"; PASS=$((PASS+1)); else echo ">>> Part 9 sweep: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# ---------------------------------------------------------------------------
# (b2) Part 9 sweep, the refit entry point -- its OWN block, kept separate from
#     the ranker's block above rather than loosening that block's exact-path
#     require assertion to accommodate a second file. scripts/hedge-refit-
#     pipeline.cjs (quick 260728-8av) must never require a raw sqlite driver
#     and must reach room.db only through lib/core/navigation.cjs.
# ---------------------------------------------------------------------------
echo "--- Part 9 sweep: chokepoint-only db access in the refit entry point ---"
PART9_REFIT_OK=1
if [ ! -f "$REFIT" ]; then
  echo "    MISSING sweep target: $REFIT"; PART9_REFIT_OK=0
else
  # Captured to a variable first, then grepped via a here-string, rather than
  # piping strip_comments straight into grep -q. grep -q exits as soon as it
  # finds its first match without draining the rest of its input, which under
  # `set -o pipefail` can SIGPIPE the upstream strip_comments process and make
  # the whole pipeline report non-zero even though the pattern WAS found (a
  # real, reproducible race observed on the pre-existing ranker sweep above:
  # confirmed to flip between exit 0 and exit 141 across otherwise-identical
  # runs). Capturing first removes the race entirely for this new leg.
  REFIT_STRIPPED="$(strip_comments "$REFIT")"
  if grep -nE "require\(['\"]node:sqlite|better-sqlite3|room-db\.cjs|\bDatabaseSync\b" <<< "$REFIT_STRIPPED" >/dev/null 2>&1; then
    echo "    FORBIDDEN direct-db token on an executable line in: $REFIT"; PART9_REFIT_OK=0
  fi
  if ! grep -qE "require\(['\"]\.\./lib/core/navigation\.cjs['\"]\)" <<< "$REFIT_STRIPPED"; then
    echo "    MISSING navigation.cjs chokepoint require in: $REFIT"; PART9_REFIT_OK=0
  fi
fi
if [ "$PART9_REFIT_OK" -eq 1 ]; then echo ">>> Part 9 sweep (refit): PASSED"; PASS=$((PASS+1)); else echo ">>> Part 9 sweep (refit): FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# ---------------------------------------------------------------------------
# (c) Req 4 dependency-diff leg -- package.json / package-lock.json must not have
#     drifted. Fails the harness if either file changed (zero new dependencies).
# ---------------------------------------------------------------------------
echo "--- Req 4 dependency-diff: package.json + package-lock.json unchanged ---"
if git diff --quiet package.json package-lock.json; then
  echo ">>> Req 4 dependency-diff: PASSED"; PASS=$((PASS+1))
else
  echo "    package.json or package-lock.json drifted -- Phase 222 ships ZERO new deps"; echo ">>> Req 4 dependency-diff: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 222: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
