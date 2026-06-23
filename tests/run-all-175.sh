#!/usr/bin/env bash
# Phase 175 verification aggregator -- the single PASS/FAIL gate proving the
# deck-command consolidation (/mos:deck born WIRED + RANKED, MOSDeckEngine +
# feynman-engine aliased deprecate-not-delete, the make-land lane repointed,
# the WARN-first deck-design ruleset, and the carried 172/173 frozen-bank fences)
# is GREEN end-to-end.
#
# Mirrors tests/run-all-173.sh: a bash PASS/FAIL loop that runs each constituent
# to completion and exits non-zero if any failed.
#
# It composes:
#   (a) BOTH born-wired CI tripwires as direct invocations (registry/ledger not
#       stale + the hard gap gate on BOTH ledgers; /mos:deck WIRED + RANKED):
#         node scripts/build-connector-registry.cjs --check
#         node scripts/build-orchestration-projection.cjs --check
#   (b) the 175 suites:
#         test-deck-design-check.cjs   -> 175-02 WARN-first ruleset --check proof
#         test-deck-consolidation.cjs  -> 175-03 behavior + consolidation proof
#                                         (3 distinct routes, HEART 5 sections,
#                                          Feynman determinism, ruleset WARN-not-FAIL,
#                                          make-land repoint, alias resolution,
#                                          Part 8 boundary doctrine, no em-dashes)
#   (c) the CARRIED frozen-bank drift fences (175 is ADDITIVE -- no frozen-set move):
#         test-reach-ids-drift.cjs     -> frozen 6 reach_ids (no 7th)
#         test-posture-ids-drift.cjs   -> frozen 3 postures (no 4th)
#   (d) the cross-phase regression call-throughs (the SPEC regression bar):
#         bash tests/run-all-172.sh    -> the CIRS gate substrate stays green
#         bash tests/run-all-173.sh    -> the publish/visualize selector stays green
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
  test-deck-design-check.cjs
  test-deck-consolidation.cjs
  test-reach-ids-drift.cjs
  test-posture-ids-drift.cjs
)

CROSS_PHASE_GATES=(
  run-all-172.sh
  run-all-173.sh
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 175 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) BOTH born-wired CI tripwires -- direct invocations. The registry + ledger
#     must not be stale, and the hard gap gate must hold on BOTH ledgers (172-13)
#     with /mos:deck WIRED + RANKED.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector-registry --check (CI tripwire, /mos:deck WIRED) ---"
if node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check; then
  ((PASSED++)); echo ">>> connector-registry --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector-registry --check"); echo ">>> connector-registry --check: FAILED"
fi
echo ""

((TOTAL++))
echo "--- Running: orchestration-projection --check (CI tripwire, /mos:deck RANKED) ---"
if node "$REPO_ROOT/scripts/build-orchestration-projection.cjs" --check; then
  ((PASSED++)); echo ">>> orchestration-projection --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("orchestration-projection --check"); echo ">>> orchestration-projection --check: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (b) + (c) The 175 suites + the carried frozen-bank drift fences.
# ---------------------------------------------------------------------------
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (d) The cross-phase regression call-throughs -- run-all-172 + run-all-173
#     must stay green (the SPEC regression bar).
# ---------------------------------------------------------------------------
for g in "${CROSS_PHASE_GATES[@]}"; do
  gp="$SCRIPT_DIR/$g"
  ((TOTAL++))
  echo "--- Running: bash tests/$g (cross-phase regression) ---"
  if [[ ! -f "$gp" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$g (missing)"); echo ">>> $g: MISSING"; echo ""; continue
  fi
  if bash "$gp"; then
    ((PASSED++)); echo ">>> $g: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$g"); echo ">>> $g: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (175 verification)"
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
