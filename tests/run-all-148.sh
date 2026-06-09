#!/usr/bin/env bash
# Phase 148 verification aggregator -- the single PASS/FAIL gate proving the
# LarryReach selector re-wire (intelligence engines + toggleable components +
# the always-open standing trio) is correct and that the frozen constitution
# (the reach bank, now 6; the posture bank, still 3) survived the re-wire.
#
# Mirrors tests/run-all-1433.sh: a bash PASS/FAIL loop that runs each
# constituent to completion and exits non-zero if any failed. It composes:
#
#   (a) the connector-registry --check CI tripwire (direct invocation);
#   (b) the CJS_SUITES -- the IRW-01..08 falsifiable suites. These land across
#       plans 01/03/04/05; the aggregator lists ALL of them so the phase gate is
#       one command. A suite a later plan has NOT created yet gates to a FAIL
#       line (never a crash) so the phase gate flags incompleteness;
#   (c) the CARRIED drift fences NOW EXPECTING 6 (the reach bank moved 5 -> 6 in
#       Plan 01), plus the posture fence (still 3);
#   (d) a standalone Part-8 grep sweep over the NEW Phase 148 artifacts
#       (reach-component-map.json + the new lib edits) for forbidden
#       user-content-to-Brain tokens and free-text body channels, mirroring
#       run-all-1433.sh step d.
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and a final tally; it exits 1 if any failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/).
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# (b) The IRW-01..08 falsifiable suites. Suites a later plan ships are listed
# here so the phase gate is one command; a missing file gates to a FAIL line.
CJS_SUITES=(
  test-148-engine-reaches.cjs        # IRW-01 (Plan 04)
  test-148-hats-sixth-reach.cjs      # IRW-02 (Plan 01)
  test-148-standing-options.cjs      # IRW-03 (Plan 03)
  test-148-component-map.cjs         # IRW-04 (Plan 03)
  test-148-unified-host.cjs          # IRW-05 (Plan 05)
  test-148-real-invocation.cjs       # IRW-06 (Plan 04)
  test-148-frozen-contracts.cjs      # IRW-07 (Plan 04)
  test-148-brain-review-egress.cjs   # IRW-08 (Plan 05)
)

# (c) The CARRIED drift fences. The reach-bank fences now expect 6 (Plan 01
# moved 5 -> 6); the posture fence stays 3.
DRIFT_FENCES=(
  test-reach-ids-drift.cjs                 # frozen 6 reach_ids (no 7th)
  test-dial-label-bank-drift.cjs           # label bank expects 6
  test-dial-graph-relationship-layer.cjs   # graph relationship layer expects 6
  test-sensor-spine-dispatch.cjs           # sensor spine dispatch expects 6
  test-orchestrator-doctrine-presence.cjs  # orchestrator doctrine presence (6)
  test-dial-reach-orchestrator.cjs         # DIAL_REACH_K === 6; MAX_K stays 3
  test-dial-end-to-end-states.cjs          # two-K separation: DIAL_REACH_K=6 vs MAX_K=3
  test-posture-ids-drift.cjs               # frozen 3 postures (no 4th) -- STAYS 3
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 148 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The CI tripwire -- direct invocation (the registry must not be stale and
#     every connector must pass the four CONN-03 validations).
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector-registry --check (CI tripwire) ---"
if node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check; then
  ((PASSED++)); echo ">>> connector-registry --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector-registry --check"); echo ">>> connector-registry --check: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (b) The IRW-01..08 falsifiable suites. A suite not yet created (Plans 04/05)
#     gates to a FAIL line (NOT a crash) so the phase gate flags incompleteness.
# ---------------------------------------------------------------------------
echo "--- IRW-01..08 falsifiable suites ---"
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing -- pending its owning plan)"); echo ">>> $c: MISSING (FAIL)"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (c) The carried drift fences (reach bank expects 6; posture bank stays 3).
# ---------------------------------------------------------------------------
echo "--- Carried drift fences (reach bank 6, posture bank 3) ---"
for c in "${DRIFT_FENCES[@]}"; do
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
# (d) Standalone Part-8 grep sweep over the NEW Phase 148 artifacts. The
#     reach-component-map.json holds ONLY reach_id/sub_mode -> archetype enum
#     scalars; the new lib edits must carry no egress-projection token and the
#     component map must carry no free-text body channel that could head toward
#     a Brain packet. Mirrors run-all-1433.sh step d.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (new 148 artifacts) ---"
PART8_OK=1
SWEEP_TARGETS=(
  "lib/hmi/reach-component-map.json"
  "lib/hmi/brain-review-packet.cjs"
  "lib/hmi/hats-persona-cache.cjs"
)
# Forbidden egress-projection / hashing tokens (mirrors run-all-1433.sh step d).
FORBIDDEN_TOKENS='projectText|safeNodeProjection|safeContradictionProjection|safeUnsupportedProjection'
for t in "${SWEEP_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
  fi
  if grep -nE "$FORBIDDEN_TOKENS" "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN projection/hash token in: $t"; PART8_OK=0
  fi
done
# The component map must NOT carry a free-text body channel heading to Brain.
if grep -nE '"(summary|content|body|text|note|description)"[[:space:]]*:' "$REPO_ROOT/lib/hmi/reach-component-map.json" >/dev/null 2>&1; then
  echo "    FORBIDDEN free-text body field in: lib/hmi/reach-component-map.json"; PART8_OK=0
fi
# check-brain-boundary scan over the NEW Brain-review path (T-148-05-01). The
# Brain-review packet MUST gate its outbound handle through auditQueryString
# (the default-deny egress chokepoint) and MUST pass any Brain response through
# brain-response-sanitize. Their absence is a Part-8 regression on the single
# highest-risk path in the phase.
BRP="$REPO_ROOT/lib/hmi/brain-review-packet.cjs"
if [[ -f "$BRP" ]]; then
  if ! grep -q "auditQueryString" "$BRP"; then
    echo "    MISSING auditQueryString gate in: lib/hmi/brain-review-packet.cjs"; PART8_OK=0
  fi
  if ! grep -qE "brain-response-sanitize|sanitize" "$BRP"; then
    echo "    MISSING brain-response-sanitize in: lib/hmi/brain-review-packet.cjs"; PART8_OK=0
  fi
  # The Brain-review path must not open a raw network egress that bypasses the
  # gate (no bare fetch/http to a Brain endpoint in this module).
  if grep -nE "fetch\(|https?://|mcp__brain_" "$BRP" >/dev/null 2>&1; then
    echo "    FORBIDDEN raw network egress in: lib/hmi/brain-review-packet.cjs"; PART8_OK=0
  fi
fi
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (148 verification)"
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
