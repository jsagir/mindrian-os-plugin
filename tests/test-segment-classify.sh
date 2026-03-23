#!/usr/bin/env bash
# test-segment-classify.sh -- Validate segment classification keywords and classify-insight script
# Tests keyword patterns from references/meeting/segment-classification.md against fixture transcript lines

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== test-segment-classify ==="

# --- Test 1: classify-insight script exists and runs ---
echo "Test 1: classify-insight script"

if [[ -f "$ROOT_DIR/scripts/classify-insight" ]]; then
  pass "classify-insight script exists"
else
  fail "classify-insight script not found at scripts/classify-insight"
fi

if [[ -x "$ROOT_DIR/scripts/classify-insight" ]]; then
  pass "classify-insight is executable"
else
  fail "classify-insight is not executable"
fi

# --- Test 2: classify-insight runs against fixture without error ---
echo "Test 2: classify-insight execution"

if bash "$ROOT_DIR/scripts/classify-insight" "$FIXTURES_DIR/meeting-artifact.md" > /dev/null 2>&1; then
  pass "classify-insight runs without error on fixture"
else
  fail "classify-insight failed on meeting-artifact.md fixture"
fi

# --- Test 3: Decision keywords found in Zoom transcript ---
echo "Test 3: Decision keyword detection"

ZOOM_FILE="$FIXTURES_DIR/sample-transcript-zoom.txt"

if grep -qi "decided\|we've decided\|that's final\|we're going to" "$ZOOM_FILE"; then
  pass "Decision keywords found in Zoom transcript"
else
  fail "No decision keywords found in Zoom transcript"
fi

# --- Test 4: Action-item keywords found ---
echo "Test 4: Action-item keyword detection"

if grep -qi "can you prepare\|I'll have it ready\|by next Friday\|I'll also pull" "$ZOOM_FILE"; then
  pass "Action-item keywords found in Zoom transcript"
else
  fail "No action-item keywords found in Zoom transcript"
fi

# --- Test 5: Insight keywords found ---
echo "Test 5: Insight keyword detection"

if grep -qi "grew 34%\|data backs\|according to Gartner\|shrinking" "$ZOOM_FILE"; then
  pass "Insight keywords found in Zoom transcript"
else
  fail "No insight keywords found in Zoom transcript"
fi

# --- Test 6: Advice keywords found ---
echo "Test 6: Advice keyword detection"

if grep -qi "I'd recommend\|you should\|have you considered" "$ZOOM_FILE"; then
  pass "Advice keywords found in Zoom transcript"
else
  fail "No advice keywords found in Zoom transcript"
fi

# --- Test 7: Question keywords found ---
echo "Test 7: Question keyword detection"

if grep -qi "what's your\|where does that number\|how does that compare" "$ZOOM_FILE"; then
  pass "Question keywords found in Zoom transcript"
else
  fail "No question keywords found in Zoom transcript"
fi

# --- Test 8: Noise with competitor name (flag potential noise rule) ---
echo "Test 8: Flag potential noise rule"

if grep -qi "Acme Corp" "$ZOOM_FILE"; then
  pass "Competitor name 'Acme Corp' found (flag potential noise candidate)"
else
  fail "Expected competitor name 'Acme Corp' not found"
fi

# --- Test 9: All 6 segment types referenced in classification doc ---
echo "Test 9: Segment classification reference completeness"

CLASSIFY_REF="$ROOT_DIR/references/meeting/segment-classification.md"
if [[ -f "$CLASSIFY_REF" ]]; then
  TYPES_FOUND=$(grep -c "decision\|action-item\|insight\|advice\|question\|noise" "$CLASSIFY_REF")
  if [[ "$TYPES_FOUND" -ge 6 ]]; then
    pass "All 6 segment types referenced in classification doc ($TYPES_FOUND mentions)"
  else
    fail "Expected >= 6 segment type mentions, got $TYPES_FOUND"
  fi
else
  fail "segment-classification.md not found"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
