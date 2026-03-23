#!/usr/bin/env bash
# test-meeting-frontmatter.sh -- Validate YAML frontmatter fields in meeting artifact fixture
# Checks all required fields from references/meeting/artifact-template.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
PASS=0
FAIL=0
MISSING_FIELDS=()

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== test-meeting-frontmatter ==="

ARTIFACT="$FIXTURES_DIR/meeting-artifact.md"

if [[ ! -f "$ARTIFACT" ]]; then
  echo "FAIL: meeting-artifact.md fixture not found"
  exit 1
fi

# Extract frontmatter (between first and second ---)
FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$ARTIFACT")

# --- Required Core Fields ---
echo "Test 1: Required core fields"

REQUIRED_FIELDS=(
  methodology
  created
  source
  speaker
  speaker_role
  segment_type
  confidence
  meeting_date
  meeting_name
  room_section
)

for field in "${REQUIRED_FIELDS[@]}"; do
  if echo "$FRONTMATTER" | grep -q "^${field}:"; then
    pass "Field present: $field"
  else
    fail "Field missing: $field"
    MISSING_FIELDS+=("$field")
  fi
done

# --- Required Wicked Problem Fields ---
echo "Test 2: Wicked problem fields"

WICKED_FIELDS=(
  assumptions
  perspective
  cascade_sections
)

for field in "${WICKED_FIELDS[@]}"; do
  if echo "$FRONTMATTER" | grep -q "^${field}:"; then
    pass "Field present: $field"
  else
    # Check for nested format (assumptions may be a list starting on next line)
    if echo "$FRONTMATTER" | grep -q "${field}"; then
      pass "Field present: $field"
    else
      fail "Field missing: $field"
      MISSING_FIELDS+=("$field")
    fi
  fi
done

# --- Field Value Validation ---
echo "Test 3: Field value validation"

# methodology should be file-meeting
if echo "$FRONTMATTER" | grep -q "methodology: file-meeting"; then
  pass "methodology value is 'file-meeting'"
else
  fail "methodology should be 'file-meeting'"
fi

# source should be transcript or velma
if echo "$FRONTMATTER" | grep -qE "source: (transcript|velma)"; then
  pass "source value is valid (transcript or velma)"
else
  fail "source should be 'transcript' or 'velma'"
fi

# confidence should be a float between 0 and 1
if echo "$FRONTMATTER" | grep -qP "confidence: 0\.\d+"; then
  pass "confidence is a valid float"
else
  fail "confidence should be a float (0.0-1.0)"
fi

# segment_type should be one of the 6 types
if echo "$FRONTMATTER" | grep -qE "segment_type: (decision|action-item|insight|advice|question|noise)"; then
  pass "segment_type is a valid type"
else
  fail "segment_type should be one of: decision, action-item, insight, advice, question, noise"
fi

# room_section should be one of the 8 sections
if echo "$FRONTMATTER" | grep -qE "room_section: (problem-definition|market-analysis|solution-design|business-model|competitive-analysis|team-execution|legal-ip|financial-model)"; then
  pass "room_section is a valid section"
else
  fail "room_section should be one of the 8 room sections"
fi

# --- Assumptions Structure ---
echo "Test 4: Assumptions structure"

if echo "$FRONTMATTER" | grep -q "claim:"; then
  pass "Assumptions contain 'claim' field"
else
  if echo "$FRONTMATTER" | grep -q "assumptions: none_detected"; then
    pass "Assumptions use 'none_detected' fallback"
  else
    fail "Assumptions missing 'claim' field or 'none_detected' fallback"
  fi
fi

if echo "$FRONTMATTER" | grep -q "status:"; then
  pass "Assumptions contain 'status' field"
else
  fail "Assumptions missing 'status' field"
fi

if echo "$FRONTMATTER" | grep -q "impacts:"; then
  pass "Assumptions contain 'impacts' field"
else
  fail "Assumptions missing 'impacts' field"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ ${#MISSING_FIELDS[@]} -gt 0 ]]; then
  echo "Missing fields: ${MISSING_FIELDS[*]}"
fi

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
