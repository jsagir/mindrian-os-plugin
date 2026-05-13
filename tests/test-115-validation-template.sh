#!/usr/bin/env bash
# tests/test-115-validation-template.sh
# Phase 115 / AC-115-01: 5-tester validation infrastructure ready for dispatch
# Verifies: email template + rubric exist + 5 tester slugs correct + verbatim probe question

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# Test 1: email template exists
test -f tests/fixtures/115-validation-email-template.md || fail "validation email template missing"
pass "Test 1: tests/fixtures/115-validation-email-template.md exists"

# Test 2: rubric template exists
test -f tests/fixtures/115-tester-rubric.md || fail "tester rubric template missing"
pass "Test 2: tests/fixtures/115-tester-rubric.md exists"

# Test 3: rollback procedure exists (Pitfall 5 -- pre-commit before validation week)
test -f tests/manual/115-rollback-procedure.md || fail "rollback procedure missing"
pass "Test 3: tests/manual/115-rollback-procedure.md exists (Pitfall 5 pre-commit)"

# Test 4: empathy-audit checklist exists
test -f tests/manual/115-acceptance.md || fail "empathy-audit checklist missing"
pass "Test 4: tests/manual/115-acceptance.md exists"

# Test 5: 5 tester slugs present in email template frontmatter
SLUGS_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('tests/fixtures/115-validation-email-template.md','utf8'));
  const slugs = p.data.tester_slugs || [];
  const expected = ['lawrence-aronhime','justin-stitzlein','aryeh-holtzberg','adam-peters','shmuel-schuman'].sort();
  const actual = slugs.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.log('FAIL: tester_slugs actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected));
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "Test 5: tester_slugs check failed: $SLUGS_OK"
pass "Test 5: 5 tester slugs present (lawrence/justin/aryeh/adam/shmuel) in email template frontmatter"

# Test 6: verbatim vivid-memory probe question present in template body
grep -qF "Think about the last time you felt stuck on a decision about your venture" tests/fixtures/115-validation-email-template.md \
  || fail "Test 6: verbatim probe question missing from email template"
grep -qF "couldn't even name what was blocking you" tests/fixtures/115-validation-email-template.md \
  || fail "Test 6: probe question fragment missing"
pass "Test 6: verbatim vivid-memory probe question present in email template body"

# Test 7: rubric has 5 tester rows + D-20 hard threshold
grep -qF "Lawrence Aronhime" tests/fixtures/115-tester-rubric.md || fail "Test 7: Lawrence row missing"
grep -qF "a tester" tests/fixtures/115-tester-rubric.md || fail "Test 7: Justin row missing"
grep -qF "Aryeh Holtzberg" tests/fixtures/115-tester-rubric.md || fail "Test 7: Aryeh row missing"
grep -qF "Adam Peters" tests/fixtures/115-tester-rubric.md || fail "Test 7: Adam row missing"
grep -qF "a tester" tests/fixtures/115-tester-rubric.md || fail "Test 7: Shmuel row missing"
grep -qF "Q1 YES count >= 4" tests/fixtures/115-tester-rubric.md || fail "Test 7: D-20 hard threshold (4-of-5) missing from rubric"
pass "Test 7: rubric has 5 tester rows + D-20 4-of-5 hard threshold"

# Test 8: rollback procedure has fallback emotion #1 + mechanism-vs-copy split
grep -qF "I have a pile of insights and I can't see the shape of them" tests/manual/115-rollback-procedure.md \
  || fail "Test 8: fallback emotion #1 missing from rollback procedure"
grep -qF "DO NOT REVERT" tests/manual/115-rollback-procedure.md \
  || fail "Test 8: mechanism-vs-copy split missing from rollback procedure"
pass "Test 8: rollback procedure has fallback emotion #1 + mechanism-vs-copy split"

echo ""
echo "==== test-115-validation-template.sh: 8/8 PASSED ===="
exit 0
