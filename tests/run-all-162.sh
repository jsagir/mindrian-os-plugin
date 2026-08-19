#!/usr/bin/env bash
# Phase 162 verification aggregator -- the ONE-COMMAND PASS/FAIL phase gate for
# SEED-026 (graph-spine single-authority viz). It proves the W1 + W2 + W3 build
# together: getGraphExport is the single whole-graph read door, Section nodes are
# born + migrated, the dashboard feed reads through the spine, the published
# payload is adversarially Part-8-clean, the golden room keeps unmapped_types
# empty with stable counts, and the node-type-map completeness gate fails loud on
# any unmapped type. Mirrors tests/run-all-158.sh structure.
#
# Two parts, run to completion even when any fails, with a per-suite PASS/FAIL
# line and a final tally; exits 1 if ANYTHING failed:
#
#   (a) the CJS_SUITES -- the W1 + W2 green suites plus the two new W3 suites.
#       A missing file gates to a FAIL line (never a crash).
#   (b) the node-type-map completeness gate over the committed golden-room fixture
#       (node scripts/check-graph-export-typemap.cjs tests/fixtures/graph-export-golden-room)
#       so a NEW schema phase that adds an un-classified node type fails THIS gate.
#
# CWD is PINNED to the repo root before running anything (DI-162-02-05): an
# unpinned build-graph-style run defaults output to a CWD-relative
# ./dashboard/graph.json. As of 2026-08-19 (Quick Task 260819-dmm) that file
# is generated and gitignored (untracked as of 2026-08-19), so there is no
# committed snapshot left to clobber. None of the suites below invoke
# build-graph (they call getGraphExport directly, which does not write that
# file), but the pin is belt-and-suspenders for the carried W1/W2 integration
# tests.
#
# bash only. No emoji. No em-dashes (CLAUDE.md HARD RULE). Hyphens only.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
START_TIME=$(date +%s)

# (a) The phase-162 suites: W1 + W2 (already green) plus the two new W3 suites.
CJS_SUITES=(
  test-graph-export.cjs                          # W1 regression fence (no-orphan + Part 8 whitelist)
  test-section-nodes-birth-and-migration.cjs     # W2 (D-B Section nodes at birth + migration)
  test-dashboard-graph-feed.cjs                  # W2 (dashboard reads through the spine)
  test-graph-export-part8-leak.cjs               # W3 Task 1 (adversarial Part 8 boundary-scan)
  test-graph-export-golden-room.cjs              # W3 Task 2 (golden-room snapshot + gate verify)
)

GOLDEN_ROOM="tests/fixtures/graph-export-golden-room"
TYPEMAP_GATE="scripts/check-graph-export-typemap.cjs"

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 162 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) Every phase-162 .cjs suite. A missing file gates to a FAIL line (NOT a
#     crash) so the phase gate flags incompleteness.
# ---------------------------------------------------------------------------
echo "--- phase-162 .cjs suites ---"
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING (FAIL)"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (b) The node-type-map completeness gate over the committed golden-room fixture.
#     Fails loud (exit non-zero) if the fixture ever carries a node type that is
#     in neither NODE_TYPE_RENDER nor EXCLUDE_TYPES.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: node-type-map completeness gate (golden-room fixture) ---"
if node "$REPO_ROOT/$TYPEMAP_GATE" "$REPO_ROOT/$GOLDEN_ROOM"; then
  ((PASSED++)); echo ">>> type-map completeness gate: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("type-map completeness gate"); echo ">>> type-map completeness gate: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (162 verification)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
