#!/usr/bin/env bash
# test-meeting-summary.sh -- Validate meeting summary structure
# Creates a minimal meeting summary following summary-template.md format and validates required sections

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== test-meeting-summary ==="

# Create a temporary minimal summary following the template
TMPDIR=$(mktemp -d)
SUMMARY="$TMPDIR/summary.md"
trap "rm -rf $TMPDIR" EXIT

cat > "$SUMMARY" << 'SUMMARY_EOF'
---
methodology: file-meeting
type: meeting-summary
meeting_date: 2026-03-15
meeting_name: Board Strategy Session Q1
source: transcript
format_detected: zoom
speakers:
  - name: Sarah Chen
    role: founder
    segments: 8
  - name: David Park
    role: team-member
    segments: 5
  - name: Michael Torres
    role: investor
    segments: 3
  - name: Prof. Lawrence Aronhime
    role: mentor
    segments: 3
total_segments: 19
filed_segments: 14
skipped_segments: 3
flagged_noise: 1
rejected_segments: 0
created: 2026-03-15
---

# Meeting: Board Strategy Session Q1

The team made a pivotal decision to pivot from SMB to enterprise, backed by Gartner data showing 34% enterprise growth. Investor Michael Torres flagged competitive threats from Acme Corp and pressed on churn metrics. Professor Aronhime challenged the team to reframe the problem rather than just the segment.

## Key Decisions

1. **Focus exclusively on enterprise segment starting next quarter** -- Sarah Chen (founder)
   Filed to: [[room/solution-design/enterprise-pivot-decision.md]]

2. **Accelerate timeline: enterprise beta by end of Q2 instead of Q3** -- Sarah Chen (founder)
   Filed to: [[room/team-execution/timeline-acceleration.md]]

## Insights Filed

4 insights filed to 3 sections:

- **market-analysis**: 2 insights
  - Enterprise segment grew 34% last quarter -- David Park (team-member)
  - Enterprise churn at 8% vs SMB at 35% -- Sarah Chen (founder)
- **competitive-analysis**: 1 insight
  - Competitive advantage is integration depth, not features -- Prof. Lawrence Aronhime (mentor)
- **solution-design**: 1 insight
  - Acme Corp building similar product -- Michael Torres (investor)

## Contradictions Detected

No contradictions detected.

## Gaps Identified

- **Enterprise churn rate validation needed** -- raised by Michael Torres (investor)
  Filed to: [[room/financial-model/gaps/enterprise-churn-data.md]]
- **TAM of $190M not independently validated** -- raised by Prof. Lawrence Aronhime (mentor)
  Filed to: [[room/market-analysis/gaps/tam-validation.md]]

## Action Items

| Owner | Task | Deadline | Context |
|-------|------|----------|---------|
| David Park | Prepare revised enterprise pricing deck | Next Friday (2026-03-22) | Needed before investor meeting on the 25th |
| David Park | Pull competitive analysis for enterprise players | not specified | Supports enterprise pivot strategy |

## Rejections

No segments were rejected.

## Speakers

4 speakers identified:

| Speaker | Role | Segments | Key Contributions |
|---------|------|----------|-------------------|
| Sarah Chen | founder | 8 | Led the enterprise pivot decision and timeline acceleration |
| David Park | team-member | 5 | Provided market data and took on pricing deck action item |
| Michael Torres | investor | 3 | Flagged churn rate gap and Acme Corp competitive threat |
| Prof. Lawrence Aronhime | mentor | 3 | Challenged problem framing and identified unvalidated assumptions |

---

*Filed by MindrianOS `file-meeting` on 2026-03-15.*
*Source: transcript | Format: zoom*
SUMMARY_EOF

# --- Test 1: Required sections exist ---
echo "Test 1: Required summary sections"

REQUIRED_SECTIONS=(
  "## Key Decisions"
  "## Insights Filed"
  "## Contradictions Detected"
  "## Gaps Identified"
  "## Action Items"
  "## Rejections"
  "## Speakers"
)

for section in "${REQUIRED_SECTIONS[@]}"; do
  if grep -q "$section" "$SUMMARY"; then
    pass "Section present: $section"
  else
    fail "Section missing: $section"
  fi
done

# --- Test 2: Frontmatter fields ---
echo "Test 2: Summary frontmatter"

FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$SUMMARY")

REQUIRED_FM_FIELDS=(
  methodology
  type
  meeting_date
  meeting_name
  source
  format_detected
  speakers
  total_segments
  filed_segments
  created
)

for field in "${REQUIRED_FM_FIELDS[@]}"; do
  if echo "$FRONTMATTER" | grep -q "${field}"; then
    pass "Frontmatter field: $field"
  else
    fail "Frontmatter missing: $field"
  fi
done

# --- Test 3: Summary template reference matches ---
echo "Test 3: Template reference file consistency"

TEMPLATE_REF="$ROOT_DIR/references/meeting/summary-template.md"
if [[ -f "$TEMPLATE_REF" ]]; then
  # Check that the template references the same required sections
  for section in "Key Decisions" "Insights Filed" "Action Items"; do
    if grep -q "$section" "$TEMPLATE_REF"; then
      pass "Template references section: $section"
    else
      fail "Template missing reference to: $section"
    fi
  done
else
  fail "summary-template.md not found"
fi

# --- Test 4: Action items table has expected columns ---
echo "Test 4: Action items table structure"

if grep -q "| Owner | Task | Deadline | Context |" "$SUMMARY"; then
  pass "Action items table has correct headers"
else
  fail "Action items table headers incorrect"
fi

# --- Test 5: Narrative lead paragraph exists ---
echo "Test 5: Narrative lead paragraph"

# Check for text between the title and the first section heading
NARRATIVE=$(sed -n '/^# Meeting:/,/^## /{/^#/!p}' "$SUMMARY" | grep -v '^$' | head -1)
if [[ -n "$NARRATIVE" ]]; then
  pass "Narrative lead paragraph present"
else
  fail "No narrative lead paragraph found"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
