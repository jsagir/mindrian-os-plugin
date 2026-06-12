#!/usr/bin/env bash
# Phase 150.8 phase gate -- meeting micro-knowledge DIKW filing v1.
# ONE green command (the gate Plans 02/03/04 extend).
#
# What this PROVES (by instrumentation, not by promise -- Canon Part 6
# dog-fooding): the DIKW ladder can NEVER go green through a file-level-only
# claim path. The Wave-0 drivers assert the net-new typed-claim substrate the
# whole ladder stands on:
#
#   test-typed-claim-writer.cjs        (Plan 01 / DIKW-01) writeClaimNode mints
#           type='claim' review_status='proposed' (NEVER confirmed, Part 9
#           role 5); the frozen 6-member KNOWLEDGE_TYPES enum gate rejects
#           off-enum types; idempotent no-downgrade UPSERT; re-export identity.
#   test-temporal-validity.cjs         (Plan 01 / DIKW-03) conditions /
#           counter_conditions / valid_from / valid_until + provenance + the
#           AMB-01 disambiguation marker round-trip as ADDITIVE JSON props with
#           ZERO DDL change (review_status stays the only CHECK-constrained col).
#   test-segment-aware-filing-guard.cjs (Plan 01 / DIKW-02) the GATE-0
#           consequence honored: extraction is the segmentation authority, so a
#           K-segment transcript mints K claim nodes -- claim count tracks
#           SEGMENT count, never collapses to the FILE count (the GATE-0
#           warning sign is the FAILING condition).
#
# Frozen surfaces this gate defends (carried, unchanged this phase): MAX_K=3,
# DIAL_REACH_K=6, the 0.70/0.15 recommend gate, the 6-reach bank, the 3
# postures, zero Brain egress delta -- proven green by the carried run-all-150.sh.
#
# This runner MUST run to completion (no crash) even when a suite fails; it
# prints a per-suite PASS/FAIL/MISSING line + a final tally. It exits non-zero
# if any suite failed OR is missing. SKIP (exit 77) is tolerated as PASS.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

# The Wave-0 DIKW substrate drivers (Plan 01). Plans 02/03/04 append here.
CJS_SUITES=(
  test-typed-claim-writer.cjs
  test-temporal-validity.cjs
  test-segment-aware-filing-guard.cjs
  test-edges-refines-rootcauses-instantiates-floor.cjs
  test-ambiguous-queue.cjs
  test-check-pending-ambiguous.cjs
  test-trigger-invariant.cjs
  test-post-filing-selector.cjs
  test-confirm-claim-flow.cjs
  test-cortex-reach-claim-branch.cjs
  test-build-knowledge-dikw-render.cjs
  test-part8-poison-transcript.cjs
)

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 150.8 phase gate"
echo "========================================"
echo ""

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$c"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  node "$p"
  rc=$?
  if [[ $rc -eq 0 || $rc -eq 77 ]]; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# Carried regression fences (Plan 04 -- the phase-final plan). This aggregator
# is the SINGLE phase-gate command, so it invokes the carried fences directly:
# the frozen 148 constitution (must be 18/18), the Phase 150 cortex bridge, the
# Phase 150.5 sensor-turn contract, and the public-site claim harness. Each is a
# bash sub-aggregator that exits non-zero on any failure.
# ---------------------------------------------------------------------------
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FENCES=(
  "run-all-148.sh"
  "run-all-150.sh"
  "run-all-150.5.sh"
)
echo "--- Carried regression fences ---"
echo ""
for f in "${FENCES[@]}"; do
  fp="$SCRIPT_DIR/$f"
  ((TOTAL++))
  echo "--- Running fence: $f ---"
  if [[ ! -f "$fp" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$f"); echo ">>> $f: MISSING"; echo ""; continue
  fi
  bash "$fp" >/dev/null 2>&1
  rc=$?
  if [[ $rc -eq 0 ]]; then
    ((PASSED++)); echo ">>> fence $f: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("fence $f"); echo ">>> fence $f: FAILED"
  fi
  echo ""
done

# The claim harness (public-site claim acceptance gate, 9 drivers).
((TOTAL++))
echo "--- Running fence: claim-harness/run-all-claims.sh ---"
if [[ ! -f "$SCRIPT_DIR/claim-harness/run-all-claims.sh" ]]; then
  ((MISSING++)); MISSING_TESTS+=("claim-harness/run-all-claims.sh"); echo ">>> claim-harness: MISSING"; echo ""
else
  bash "$SCRIPT_DIR/claim-harness/run-all-claims.sh" >/dev/null 2>&1
  rc=$?
  if [[ $rc -eq 0 ]]; then
    ((PASSED++)); echo ">>> fence claim-harness/run-all-claims.sh: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("fence claim-harness/run-all-claims.sh"); echo ">>> fence claim-harness/run-all-claims.sh: FAILED"
  fi
  echo ""
fi

# ---------------------------------------------------------------------------
# Final Part 8 forbidden-substring sweep over the new packet-bound artifacts.
# The poison-transcript test proves no claim prose reaches a Brain packet at
# RUNTIME; this static sweep proves the new claim/packet-adjacent source files
# carry no forbidden egress token (a fetch / brain-client require / raw https
# call) that could let prose out. Teeth: any match FAILS the gate loudly.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part 8 static egress sweep over new claim/packet artifacts ---"
SWEEP_FILES=(
  "$REPO_ROOT/lib/core/navigation/typed-claim.cjs"
  "$REPO_ROOT/lib/hmi/cortex-reach-adapter.cjs"
  "$REPO_ROOT/lib/core/navigation/room-context.cjs"
)
SWEEP_FAIL=0
for sf in "${SWEEP_FILES[@]}"; do
  [[ -f "$sf" ]] || continue
  if grep -nE "require\(['\"](node:)?https?['\"]\)|require\(['\"][^'\"]*brain-client[^'\"]*['\"]\)|\bfetch\(|\bhttps?\.(request|get)\(" "$sf" >/dev/null 2>&1; then
    SWEEP_FAIL=1
    echo "    forbidden egress token in: $sf"
  fi
done
if [[ $SWEEP_FAIL -eq 0 ]]; then
  ((PASSED++)); echo ">>> Part 8 static egress sweep: PASSED (zero forbidden egress tokens)"
else
  ((FAILED++)); FAILED_TESTS+=("Part 8 static egress sweep"); echo ">>> Part 8 static egress sweep: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (150.8 phase gate)"
echo "========================================"
echo "  Total:   $TOTAL"
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Missing: $MISSING"
echo "  Time:    ${ELAPSED}s"

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "  Missing:"
  for t in "${MISSING_TESTS[@]}"; do
    echo "    - $t"
  done
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

if [[ $MISSING -gt 0 ]]; then
  echo "========================================"
  exit 1
fi

echo "========================================"
echo "  Exit 0: the Phase 150.8 gate is green -- the complete phase gate (the typed-claim DIKW substrate + the post-filing F.1 selector + confirm-claim dispatch + the cortex-reach claim branch + the build-knowledge graph reader + the Part 8 poison-transcript leg) AND every carried regression fence (148 18/18, 150, 150.5, claim-harness) green."
exit 0
