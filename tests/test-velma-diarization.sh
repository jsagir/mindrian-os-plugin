#!/usr/bin/env bash
# test-velma-diarization.sh — Validate Velma response parsing logic
# Uses mock fixture (no live API required)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$SCRIPT_DIR/fixtures/sample-velma-response.json"
PASS=0
FAIL=0

# Arithmetic increment helper (avoids set -e trap on ((x++)) when x=0)
inc_pass() { PASS=$((PASS + 1)); }
inc_fail() { FAIL=$((FAIL + 1)); }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $label (got: $actual)"
    inc_pass
  else
    echo "  FAIL: $label (expected: $expected, got: $actual)"
    inc_fail
  fi
}

assert_true() {
  local label="$1" result="$2"
  if [[ "$result" == "true" || "$result" == "1" ]]; then
    echo "  PASS: $label"
    inc_pass
  else
    echo "  FAIL: $label (result: $result)"
    inc_fail
  fi
}

echo "=== Velma Diarization Parser Tests ==="
echo ""

# --- Test 1: Fixture file exists ---
echo "Test 1: Fixture file exists"
if [[ -f "$FIXTURE" ]]; then
  echo "  PASS: Fixture found at $FIXTURE"
  inc_pass
else
  echo "  FAIL: Fixture not found at $FIXTURE"
  exit 1
fi

# --- Test 2: Speaker count ---
echo "Test 2: Speaker count matches expected (3 speakers)"
SPEAKER_COUNT=$(jq '[.segments[].speaker_id] | unique | length' "$FIXTURE")
assert_eq "unique speaker count" "3" "$SPEAKER_COUNT"

# --- Test 3: Segment count ---
echo "Test 3: Segment count"
SEGMENT_COUNT=$(jq '.segments | length' "$FIXTURE")
assert_eq "segment count" "10" "$SEGMENT_COUNT"

# --- Test 4: Timestamps are present and ordered ---
echo "Test 4: Timestamps present and ordered"
ORDERED=$(jq '[.segments[].start_time] | . == sort' "$FIXTURE")
assert_true "start_time values are in ascending order" "$ORDERED"

# --- Test 5: All segments have required fields ---
echo "Test 5: Required fields present (speaker_id, text, start_time, end_time, emotions)"
VALID_SEGMENTS=$(jq '[.segments[] | select(.speaker_id and .text and (.start_time != null) and (.end_time != null) and .emotions)] | length' "$FIXTURE")
assert_eq "segments with all required fields" "$SEGMENT_COUNT" "$VALID_SEGMENTS"

# --- Test 6: Emotion signals above 0.7 are extractable ---
echo "Test 6: Strong emotion signals (score > 0.7)"
STRONG_EMOTIONS=$(jq '[.segments[].emotions[] | select(.score > 0.7)] | length' "$FIXTURE")
# We expect at least 3 strong signals (confident 0.82, skeptical 0.78, enthusiastic 0.91, frustrated 0.73, confident 0.72, enthusiastic 0.85)
if [[ "$STRONG_EMOTIONS" -ge 3 ]]; then
  echo "  PASS: Found $STRONG_EMOTIONS strong emotion signals (>= 3 expected)"
  inc_pass
else
  echo "  FAIL: Only $STRONG_EMOTIONS strong emotion signals (expected >= 3)"
  inc_fail
fi

# --- Test 7: Output format matches [MM:SS-MM:SS] Speaker_N: text ---
echo "Test 7: Output format validation"
# Replicate the jq parsing from transcribe-audio
FORMAT_OUTPUT=$(jq -r '.segments[] | "\(.start_time)|\(.end_time)|\(.speaker_id)|\(.text)"' "$FIXTURE" | \
while IFS='|' read -r start end speaker text; do
  start_mins=$(echo "$start" | awk '{printf "%02d", $1 / 60}')
  start_secs=$(echo "$start $start_mins" | awk '{printf "%02d", $1 - ($2 * 60)}')
  end_mins=$(echo "$end" | awk '{printf "%02d", $1 / 60}')
  end_secs=$(echo "$end $end_mins" | awk '{printf "%02d", $1 - ($2 * 60)}')
  speaker_label=$(echo "$speaker" | sed 's/speaker_/Speaker_/')
  echo "[$start_mins:$start_secs-$end_mins:$end_secs] $speaker_label: $text"
done)

FIRST_LINE=$(echo "$FORMAT_OUTPUT" | head -1)
if [[ "$FIRST_LINE" =~ ^\[[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}\]\ Speaker_[0-9]+:\ .+ ]]; then
  echo "  PASS: First line matches format: $FIRST_LINE"
  inc_pass
else
  echo "  FAIL: First line does not match [MM:SS-MM:SS] Speaker_N: text format: $FIRST_LINE"
  inc_fail
fi

LINE_COUNT=$(echo "$FORMAT_OUTPUT" | wc -l)
assert_eq "formatted output line count matches segments" "$SEGMENT_COUNT" "$LINE_COUNT"

# --- Test 8: Specific emotion extraction ---
echo "Test 8: Known strong emotions extractable"
ENTHUSIASTIC=$(jq '[.segments[].emotions[] | select(.label == "enthusiastic" and .score > 0.7)] | length' "$FIXTURE")
SKEPTICAL=$(jq '[.segments[].emotions[] | select(.label == "skeptical" and .score > 0.7)] | length' "$FIXTURE")
assert_true "enthusiastic signals found (score > 0.7)" "$( [[ "$ENTHUSIASTIC" -ge 1 ]] && echo true || echo false )"
assert_true "skeptical signals found (score > 0.7)" "$( [[ "$SKEPTICAL" -ge 1 ]] && echo true || echo false )"

# --- Summary ---
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
