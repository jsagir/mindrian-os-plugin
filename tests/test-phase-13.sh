#!/usr/bin/env bash
# test-phase-13.sh -- Phase 13: Opportunity Bank + Funding Room tests
# Validates section discovery, module loading, opportunity/funding operations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
SAMPLE_ROOM="$FIXTURES_DIR/sample-room-opp"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== test-phase-13: Opportunity Bank + Funding Room ==="

# --- Test 1: Section discovery ---
echo "Test 1: Section discovery (opportunity-bank + funding in extended list)"

DISCOVERY_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const r = require('./lib/core/section-registry.cjs');
const d = r.discoverSections('$SAMPLE_ROOM');
const json = JSON.stringify({ extended: d.extended, all: d.all });
console.log(json);
")

if echo "$DISCOVERY_RESULT" | grep -q '"opportunity-bank"'; then
  pass "opportunity-bank discovered as extended section"
else
  fail "opportunity-bank NOT found in extended sections"
fi

if echo "$DISCOVERY_RESULT" | grep -q '"funding"'; then
  pass "funding discovered as extended section"
else
  fail "funding NOT found in extended sections"
fi

# --- Test 2: Module load ---
echo "Test 2: opportunity-ops.cjs module loads without error"

if (cd "$PLUGIN_ROOT" && node -e "require('./lib/core/opportunity-ops.cjs')") 2>/dev/null; then
  pass "opportunity-ops.cjs loads successfully"
else
  fail "opportunity-ops.cjs failed to load"
fi

# --- Test 3: listOpportunities ---
echo "Test 3: listOpportunities returns count >= 1"

OPP_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/opportunity-ops.cjs');
const result = ops.listOpportunities('$SAMPLE_ROOM');
console.log(JSON.stringify(result));
")

OPP_COUNT=$(echo "$OPP_RESULT" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf-8'); console.log(JSON.parse(d).count)")

if [[ "$OPP_COUNT" -ge 1 ]]; then
  pass "listOpportunities returns count=$OPP_COUNT (>= 1)"
else
  fail "listOpportunities returned count=$OPP_COUNT (expected >= 1)"
fi

# --- Test 4: listFunding ---
echo "Test 4: listFunding returns count >= 1"

FUND_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/opportunity-ops.cjs');
const result = ops.listFunding('$SAMPLE_ROOM');
console.log(JSON.stringify(result));
")

FUND_COUNT=$(echo "$FUND_RESULT" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf-8'); console.log(JSON.parse(d).count)")

if [[ "$FUND_COUNT" -ge 1 ]]; then
  pass "listFunding returns count=$FUND_COUNT (>= 1)"
else
  fail "listFunding returned count=$FUND_COUNT (expected >= 1)"
fi

# --- Test 5: Frontmatter parsing (opportunity) ---
echo "Test 5: parseOpportunityFrontmatter has required fields"

FM_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const fs = require('fs');
const ops = require('./lib/core/opportunity-ops.cjs');
const content = fs.readFileSync('$SAMPLE_ROOM/opportunity-bank/2026-03-20-nsf-sbir.md', 'utf-8');
const fm = ops.parseOpportunityFrontmatter(content);
console.log(JSON.stringify(fm));
")

if echo "$FM_RESULT" | grep -q '"funder"'; then
  pass "Opportunity frontmatter has 'funder' field"
else
  fail "Opportunity frontmatter missing 'funder' field"
fi

if echo "$FM_RESULT" | grep -q '"relevance_score"'; then
  pass "Opportunity frontmatter has 'relevance_score' field"
else
  fail "Opportunity frontmatter missing 'relevance_score' field"
fi

if echo "$FM_RESULT" | grep -q '"status"'; then
  pass "Opportunity frontmatter has 'status' field"
else
  fail "Opportunity frontmatter missing 'status' field"
fi

# --- Test 6: Funding status parsing ---
echo "Test 6: parseFundingStatus has stage and source_opportunity"

FS_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const fs = require('fs');
const ops = require('./lib/core/opportunity-ops.cjs');
const content = fs.readFileSync('$SAMPLE_ROOM/funding/nsf-sbir-phase1/STATUS.md', 'utf-8');
const st = ops.parseFundingStatus(content);
console.log(JSON.stringify(st));
")

if echo "$FS_RESULT" | grep -q '"stage"'; then
  pass "Funding status has 'stage' field"
else
  fail "Funding status missing 'stage' field"
fi

if echo "$FS_RESULT" | grep -q '"source_opportunity"'; then
  pass "Funding status has 'source_opportunity' field"
else
  fail "Funding status missing 'source_opportunity' field"
fi

# --- Test 7: Wikilink cross-reference ---
echo "Test 7: Wikilink cross-reference in funding STATUS.md"

if grep -q '\[\[opportunity-bank/' "$SAMPLE_ROOM/funding/nsf-sbir-phase1/STATUS.md"; then
  pass "Funding STATUS.md contains [[opportunity-bank/ wikilink"
else
  fail "Funding STATUS.md missing [[opportunity-bank/ wikilink"
fi

# --- Test 8: Empty room graceful handling ---
echo "Test 8: Empty room returns empty results (no throw)"

EMPTY_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/opportunity-ops.cjs');
const opp = ops.listOpportunities('/tmp/nonexistent-room-xyz');
const fund = ops.listFunding('/tmp/nonexistent-room-xyz');
console.log(JSON.stringify({ opp_count: opp.count, fund_count: fund.count }));
")

if echo "$EMPTY_RESULT" | grep -q '"opp_count":0'; then
  pass "listOpportunities returns 0 for missing room"
else
  fail "listOpportunities did not return 0 for missing room"
fi

if echo "$EMPTY_RESULT" | grep -q '"fund_count":0'; then
  pass "listFunding returns 0 for missing room"
else
  fail "listFunding did not return 0 for missing room"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
