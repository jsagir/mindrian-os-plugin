#!/usr/bin/env bash
# test-speaker-id.sh -- Validate speaker name extraction from Zoom and Teams transcript formats
# Uses regex patterns from references/meeting/transcript-patterns.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== test-speaker-id ==="

# --- Test 1: Zoom format extracts correct speaker names ---
echo "Test 1: Zoom format speaker extraction"

ZOOM_SPEAKERS=$(grep -oP '^\d{2}:\d{2}:\d{2}\s+\K[^:]+(?=:)' "$FIXTURES_DIR/sample-transcript-zoom.txt" | sort -u)
ZOOM_COUNT=$(echo "$ZOOM_SPEAKERS" | wc -l)

# Expect 4 speakers: Sarah Chen, David Park, Michael Torres, Prof. Lawrence Aronhime
if echo "$ZOOM_SPEAKERS" | grep -q "Sarah Chen"; then
  pass "Zoom: extracted 'Sarah Chen'"
else
  fail "Zoom: missing 'Sarah Chen'"
fi

if echo "$ZOOM_SPEAKERS" | grep -q "David Park"; then
  pass "Zoom: extracted 'David Park'"
else
  fail "Zoom: missing 'David Park'"
fi

if echo "$ZOOM_SPEAKERS" | grep -q "Michael Torres"; then
  pass "Zoom: extracted 'Michael Torres'"
else
  fail "Zoom: missing 'Michael Torres'"
fi

if echo "$ZOOM_SPEAKERS" | grep -q "Prof. Lawrence Aronhime"; then
  pass "Zoom: extracted 'Prof. Lawrence Aronhime'"
else
  fail "Zoom: missing 'Prof. Lawrence Aronhime'"
fi

# --- Test 2: Teams format extracts correct speaker names ---
echo "Test 2: Teams format speaker extraction"

TEAMS_SPEAKERS=$(grep -oP '^\[\d{2}:\d{2}:\d{2}\]\s+\K.+$' "$FIXTURES_DIR/sample-transcript-teams.txt" | sort -u)
TEAMS_COUNT=$(echo "$TEAMS_SPEAKERS" | wc -l)

if echo "$TEAMS_SPEAKERS" | grep -q "Sarah Chen"; then
  pass "Teams: extracted 'Sarah Chen'"
else
  fail "Teams: missing 'Sarah Chen'"
fi

if echo "$TEAMS_SPEAKERS" | grep -q "David Park"; then
  pass "Teams: extracted 'David Park'"
else
  fail "Teams: missing 'David Park'"
fi

if echo "$TEAMS_SPEAKERS" | grep -q "Michael Torres"; then
  pass "Teams: extracted 'Michael Torres'"
else
  fail "Teams: missing 'Michael Torres'"
fi

if echo "$TEAMS_SPEAKERS" | grep -q "Prof. Lawrence Aronhime"; then
  pass "Teams: extracted 'Prof. Lawrence Aronhime'"
else
  fail "Teams: missing 'Prof. Lawrence Aronhime'"
fi

# --- Test 3: Speaker count matches expected ---
echo "Test 3: Speaker count validation"

if [[ "$ZOOM_COUNT" -eq 4 ]]; then
  pass "Zoom: 4 unique speakers detected"
else
  fail "Zoom: expected 4 speakers, got $ZOOM_COUNT"
fi

if [[ "$TEAMS_COUNT" -eq 4 ]]; then
  pass "Teams: 4 unique speakers detected"
else
  fail "Teams: expected 4 speakers, got $TEAMS_COUNT"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
