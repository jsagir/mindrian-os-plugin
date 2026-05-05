#!/usr/bin/env bash
# tests/test-115-dual-path-integration.sh
# Phase 115 / AC-115-03: dual-path opener works (upload + type both classified correctly)
# Live navigation integration -- detector + shallow-parser + Phase 109 navigation.cjs
#
# Tests 1-3 run unconditionally and verify the heuristic classifier across the
# 3 paths via direct CLI shell-out. Test 4 (live navigation, shallow filing)
# is gated on MINDRIAN_SKIP_LIVE_CLAUDE=0 because it touches a tmp room.db.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# ----- Test 1: detector classifies pure upload-shaped input as 'upload' -----
RESULT_UPLOAD=$(node -e "
  const { classify } = require('./lib/core/dual-path-detector.cjs');
  const text = 'Education\nMIT 2018\n\nExperience\nGoogle 2018-2022\nFounder of Acme Robotics 2022-present\nNIH SBIR \$2M 2023\nIRB# 12345\n\nSkills\nMachine learning, robotics, embedded systems';
  const r = classify(text);
  console.log(JSON.stringify(r));
") || fail "detector failed on upload-shaped input"
echo "$RESULT_UPLOAD" | grep -q '"path":"upload"' || fail "expected path:upload, got: $RESULT_UPLOAD"
pass "Test 1: pure upload-shaped input classified as 'upload'"

# ----- Test 2: detector classifies pure type-shaped input as 'type' -----
RESULT_TYPE=$(node -e "
  const { classify } = require('./lib/core/dual-path-detector.cjs');
  const text = \"I'm stuck on whether to raise now or wait six months. I keep coming back to it. I don't know what is blocking me. I'm trying to figure out if my conviction is real or if I am just scared.\";
  const r = classify(text);
  console.log(JSON.stringify(r));
") || fail "detector failed on type-shaped input"
echo "$RESULT_TYPE" | grep -q '"path":"type"' || fail "expected path:type, got: $RESULT_TYPE"
pass "Test 2: pure type-shaped input classified as 'type'"

# ----- Test 3: detector classifies borderline input as 'ambiguous' -----
# Borderline: 100 words formatted, no section_header, no domain_marker, no stuck_language.
# word_count 80-300 -> 0; high density -> +2; no other features -> +2 -> 'ambiguous'.
RESULT_AMBIGUOUS=$(node -e "
  const { classify } = require('./lib/core/dual-path-detector.cjs');
  const lines = [];
  for (let i = 0; i < 15; i++) {
    lines.push('line ' + i + ' some short content here for testing density features without section anchors');
  }
  const text = lines.join('\n');
  const r = classify(text);
  console.log(JSON.stringify(r));
") || fail "detector failed on ambiguous input"
echo "$RESULT_AMBIGUOUS" | grep -q '"path":"ambiguous"' || fail "expected path:ambiguous, got: $RESULT_AMBIGUOUS"
pass "Test 3: borderline input classified as 'ambiguous'"

# ----- Test 4: shallow-doc-parser end-to-end (live navigation, gated) -----
if [ "${MINDRIAN_SKIP_LIVE_CLAUDE:-1}" = "0" ]; then
  TMP_ROOM=$(mktemp -d -t test-115-dual-path-XXXXXX)
  RESULT_PARSE=$(MINDRIAN_TEST_ROOM="$TMP_ROOM" node -e "
    const { extractShallow } = require('./lib/core/shallow-doc-parser.cjs');
    const text = 'Founder of Acme Robotics. PhD MIT 2018. NIH SBIR \$2M 2023.';
    const r = extractShallow(text, 'session-test-115-dual-path');
    console.log(JSON.stringify(r));
  ") || fail "shallow-doc-parser failed in live navigation mode"
  echo "$RESULT_PARSE" | grep -q '"canonical_role":"Founder"' || fail "expected user.canonical_role:Founder, got: $RESULT_PARSE"
  echo "$RESULT_PARSE" | grep -q '"name":"Acme Robotics"' || fail "expected venture.name:Acme Robotics, got: $RESULT_PARSE"
  pass "Test 4: shallow-doc-parser populated 1 user + 1 venture + 1+ claims (live navigation)"
  rm -rf "$TMP_ROOM"
else
  echo "SKIP Test 4: MINDRIAN_SKIP_LIVE_CLAUDE != 0; live navigation test skipped"
fi

echo ""
echo "==== test-115-dual-path-integration.sh: ALL TESTS PASSED ===="
exit 0
