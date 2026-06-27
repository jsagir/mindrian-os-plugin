#!/usr/bin/env bash
# Phase 183 verification aggregator -- the single PASS/FAIL gate for METER:
# Gate-Exposure + Transfer Meter (METER-01 + METER-02). Mirrors tests/run-all-180.sh.
#
# Plan 183-01 delivers the gate_reached additive EVENT_TYPES member, the single
# engine-arm emit, and the Gauge-1 invocation-density reader. Plan 01 turns the
# gate-reach / density / event-types-floor pins GREEN; the transfer + two-gauge-weld
# pins stay RED until Plan 02. The Part 8 grep-sweep over lib/core/meter/ + the
# gate_reached emit seam proves zero network surface (fetch / http / curl /
# brain.mindrian / tavily / brain-client). The reach-ids (frozen 6) + posture-ids
# (frozen 3) drift fences prove METER mints no reach / posture / frozen-set member.
#
# bash only. No emoji. No em-dashes.

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

# (a) the five METER pins. Plan 01 turns gate-reach / density / event-types-floor
#     GREEN; transfer + two-gauge-weld stay RED until Plan 02.
run "183 meter-gate-reach"        node tests/test-meter-gate-reach.cjs
run "183 meter-density"           node tests/test-meter-density.cjs
run "183 meter-event-types-floor" node tests/test-meter-event-types-floor.cjs
run "183 meter-transfer"          node tests/test-meter-transfer.cjs
run "183 meter-two-gauge-weld"    node tests/test-meter-two-gauge-weld.cjs

# (b) Part 8 LOCAL-only grep-sweep over the new meter modules + the gate_reached emit
#     seam. Asserts ZERO network tokens. Full-line // comments are stripped first
#     (the grep-gate-hygiene rule) so a header that NAMES the forbidden tokens in
#     prose cannot self-invalidate the fence. The token list is spelled out here so
#     the aggregator self-documents the Part 8 boundary it enforces:
#     fetch http curl brain.mindrian tavily brain-client.
echo "--- 183 part-8 local-only grep-sweep ---"
SWEEP_FAIL=0
NET_RE='fetch|http|curl|brain\.mindrian|tavily|brain-client'
if [ -d lib/core/meter ]; then
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    hits=$(grep -vE '^[[:space:]]*//' "$f" | grep -cE "$NET_RE" || true)
    if [ "$hits" -ne 0 ]; then
      echo "Part 8 violation: $f carries $hits network token(s)"; SWEEP_FAIL=1
    fi
  done <<EOF
$(find lib/core/meter -name '*.cjs' -type f)
EOF
fi
# the intent-classifier gate_reached emit seam (a BOUNDED window, never the whole
# file -- the full file legitimately carries network tokens elsewhere).
ICL="scripts/intent-classifier.cjs"
if [ -f "$ICL" ]; then
  seam_line=$(grep -nF "logMemoryEvent(roomDb, 'gate_reached'" "$ICL" | head -1 | cut -d: -f1 || true)
  if [ -n "${seam_line:-}" ]; then
    lo=$((seam_line - 25)); [ "$lo" -lt 1 ] && lo=1
    hi=$((seam_line + 25))
    hits=$(sed -n "${lo},${hi}p" "$ICL" | grep -vE '^[[:space:]]*//' | grep -cE "$NET_RE" || true)
    if [ "$hits" -ne 0 ]; then
      echo "Part 8 violation: gate_reached emit seam carries $hits network token(s)"; SWEEP_FAIL=1
    fi
  fi
fi
if [ "$SWEEP_FAIL" -eq 0 ]; then
  echo ">>> 183 part-8 local-only grep-sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 183 part-8 local-only grep-sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# (c) carried frozen-set drift fences -- METER mints NO reach (frozen 6), NO posture
#     (frozen 3); these stay GREEN to prove the frozen sets are untouched.
[ -f tests/test-reach-ids-drift.cjs ]   && run "reach-ids-drift (frozen 6)"   node tests/test-reach-ids-drift.cjs
[ -f tests/test-posture-ids-drift.cjs ] && run "posture-ids-drift (frozen 3)" node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (183 verification)"
echo "  Passed: $PASS   Failed: $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
