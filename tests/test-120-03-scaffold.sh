#!/usr/bin/env bash
# Phase 120-03 Wave 2 Task 3 -- scaffold harness for the D-17 voice scaffold +
# D-18 ethics fence + review queue + Larry skill integration.
#
# 9 gates verify the full Plan 120-03 surface:
#   1. voice-scaffold exports the composer + auditor
#   2. ethics-fence exports the classifier
#   3. review-queue exports openReviewQueue
#   4. F.7 renderer carries the voice_line additive slot
#   5. scanner integration references voice-scaffold + ethics-fence
#   6. Larry skill documents the D-17 voice scaffold section
#   7. Zero Brain coupling across all Plan 120-03 source files (Canon Part 8)
#   8. Zero em-dashes across all Plan 120-03 source files (HARD RULE)
#   9. D-17 + D-18 end-to-end tests pass (node --test)
#
# Exit 0 on success with the literal line:
#   OK: 120-03 scaffold complete (voice scaffold + 4-tier ethics fence + review queue + Larry skill + zero Brain coupling + zero em-dashes)

set -u

# Resolve REPO_ROOT from this script's location (tests/ is one level below repo root)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FAILED=0

# count_matches FILE PATTERN -- returns count on stdout, defaults to 0 on missing file
count_matches() {
  local file="$1"
  local pattern="$2"
  if [ ! -f "$file" ]; then
    echo 0
    return
  fi
  local n
  n=$(grep -cE "$pattern" "$file" 2>/dev/null)
  echo "${n:-0}"
}

# count_matches_fixed FILE LITERAL -- fixed-string grep
count_matches_fixed() {
  local file="$1"
  local literal="$2"
  if [ ! -f "$file" ]; then
    echo 0
    return
  fi
  local n
  n=$(grep -cF "$literal" "$file" 2>/dev/null)
  echo "${n:-0}"
}

# Gate 1: voice-scaffold exports
G1=$(count_matches "lib/core/breakthrough/voice-scaffold.cjs" "composeBreakthroughVoiceLine|auditVoiceLine")
if [ "${G1:-0}" -lt 2 ]; then
  echo "FAIL Gate 1: voice-scaffold.cjs must reference composeBreakthroughVoiceLine + auditVoiceLine (got $G1)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 1: voice-scaffold composer + auditor present ($G1 refs)"
fi

# Gate 2: ethics-fence classifier
G2=$(count_matches "lib/core/breakthrough/ethics-fence.cjs" "classifyEthicsBand")
if [ "${G2:-0}" -lt 1 ]; then
  echo "FAIL Gate 2: ethics-fence.cjs must reference classifyEthicsBand (got $G2)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 2: ethics-fence classifier present ($G2 refs)"
fi

# Gate 3: review-queue openReviewQueue
G3=$(count_matches "lib/core/breakthrough/review-queue.cjs" "openReviewQueue")
if [ "${G3:-0}" -lt 1 ]; then
  echo "FAIL Gate 3: review-queue.cjs must reference openReviewQueue (got $G3)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 3: review-queue openReviewQueue present ($G3 refs)"
fi

# Gate 4: F.7 renderer voice_line slot
G4=$(count_matches "lib/hmi/shape-f7-breakthrough-renderer.cjs" "voice_line")
if [ "${G4:-0}" -lt 1 ]; then
  echo "FAIL Gate 4: shape-f7-breakthrough-renderer.cjs must reference voice_line (got $G4)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 4: F.7 renderer voice_line slot present ($G4 refs)"
fi

# Gate 5: scanner integration wires
G5=$(count_matches "lib/core/breakthrough/scanner.cjs" "voice-scaffold|ethics-fence")
if [ "${G5:-0}" -lt 2 ]; then
  echo "FAIL Gate 5: scanner.cjs must reference voice-scaffold + ethics-fence (got $G5)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 5: scanner integration wires present ($G5 refs)"
fi

# Gate 6: Larry skill section
G6=$(count_matches_fixed "skills/larry-personality/SKILL.md" "Breakthrough Voice Scaffold (Phase 120 D-17)")
if [ "${G6:-0}" -lt 1 ]; then
  echo "FAIL Gate 6: skills/larry-personality/SKILL.md must document the D-17 voice scaffold (got $G6)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 6: Larry skill section present ($G6 refs)"
fi

# Gate 7: zero Brain coupling across Plan 120-03 source files (Canon Part 8)
G7_HITS=0
for f in lib/core/breakthrough/voice-scaffold.cjs lib/core/breakthrough/ethics-fence.cjs lib/core/breakthrough/review-queue.cjs; do
  N=$(count_matches "$f" "require.+brain-client|fetch.+brain\.mindrian")
  G7_HITS=$((G7_HITS + ${N:-0}))
done
if [ "${G7_HITS:-0}" -gt 0 ]; then
  echo "FAIL Gate 7: Canon Part 8 -- Brain coupling found in Plan 120-03 sources ($G7_HITS hits)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 7: Canon Part 8 -- zero Brain coupling across Plan 120-03 sources"
fi

# Gate 8: zero em-dashes across Plan 120-03 SOURCE files only (HARD RULE).
# Test files are intentionally excluded -- the em-dash invariant tests must
# literally contain the em-dash character as a search string.
G8_HITS=0
EMDASH=$(printf '\xe2\x80\x94')
for f in lib/core/breakthrough/voice-scaffold.cjs lib/core/breakthrough/ethics-fence.cjs lib/core/breakthrough/review-queue.cjs; do
  N=$(count_matches_fixed "$f" "$EMDASH")
  if [ "${N:-0}" -gt 0 ]; then
    echo "FAIL Gate 8: em-dash found in $f ($N occurrences)" >&2
    G8_HITS=$((G8_HITS + N))
  fi
done
if [ "${G8_HITS:-0}" -gt 0 ]; then
  echo "FAIL Gate 8: HARD RULE -- em-dashes found ($G8_HITS total)" >&2
  FAILED=$((FAILED + 1))
else
  echo "OK gate 8: HARD RULE -- zero em-dashes across Plan 120-03 source files"
fi

# Gate 9: D-17 + D-18 end-to-end tests pass
echo "Running Gate 9: node --test tests/test-breakthrough-d17-voice-audit.cjs tests/test-breakthrough-d18-ethics-fence.cjs"
if node --test tests/test-breakthrough-d17-voice-audit.cjs tests/test-breakthrough-d18-ethics-fence.cjs >/dev/null 2>&1; then
  echo "OK gate 9: D-17 + D-18 end-to-end tests pass"
else
  echo "FAIL Gate 9: D-17 + D-18 end-to-end tests failed" >&2
  FAILED=$((FAILED + 1))
fi

if [ "${FAILED:-0}" -gt 0 ]; then
  echo ""
  echo "SCAFFOLD HARNESS FAILED ($FAILED gates)" >&2
  exit 1
fi

echo ""
echo "OK: 120-03 scaffold complete (voice scaffold + 4-tier ethics fence + review queue + Larry skill + zero Brain coupling + zero em-dashes)"
exit 0
