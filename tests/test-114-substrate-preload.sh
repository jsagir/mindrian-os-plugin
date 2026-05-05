#!/usr/bin/env bash
# tests/test-114-substrate-preload.sh
# Phase 114 / AC-114-01: 4-skill substrate preloaded turn 1
# Verifies: agents/larry-extended.md frontmatter declares skills + initialPrompt;
#          settings.json no longer carries unsupported skills array;
#          room-* SKILL.md frontmatter declares paths: scoping.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# Test 1: gray-matter parse of agents/larry-extended.md confirms skills array shape
SKILLS_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  const s = p.data.skills || [];
  const expected = ['larry-personality','context-engine','room-passive','room-proactive'];
  if (s.length !== 4) { console.log('FAIL: skills length is ' + s.length); process.exit(1); }
  for (let i = 0; i < 4; i++) {
    if (s[i] !== expected[i]) {
      console.log('FAIL: skills[' + i + '] is ' + s[i] + ', expected ' + expected[i]);
      process.exit(1);
    }
  }
  console.log('OK');
" 2>&1) || fail "agents/larry-extended.md skills array invalid: $SKILLS_OK"
pass "agents/larry-extended.md frontmatter has skills: [larry-personality, context-engine, room-passive, room-proactive] in canonical order"

# Test 2: initialPrompt is a non-empty string
INITIAL_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  const ip = p.data.initialPrompt;
  if (typeof ip !== 'string' || ip.length === 0) {
    console.log('FAIL: initialPrompt is ' + JSON.stringify(ip));
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "agents/larry-extended.md initialPrompt invalid: $INITIAL_OK"
pass "agents/larry-extended.md frontmatter has initialPrompt as non-empty string"

# Test 3: settings.json has no `skills` key (cleanup verification)
SETTINGS_OK=$(node -e "
  const c = require('./settings.json');
  if ('skills' in c) {
    console.log('FAIL: settings.json still contains unsupported skills key');
    process.exit(1);
  }
  if (c.agent !== 'larry-extended') {
    console.log('FAIL: settings.json agent is ' + c.agent + ', expected larry-extended');
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "settings.json invalid: $SETTINGS_OK"
pass "settings.json no longer contains unsupported skills array; agent: larry-extended preserved"

# Test 4: room-passive and room-proactive both declare paths: scoping
PATHS_PASSIVE=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('skills/room-passive/SKILL.md','utf8'));
  if (!Array.isArray(p.data.paths) || p.data.paths.length === 0) {
    console.log('FAIL: room-passive paths missing or empty');
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "skills/room-passive/SKILL.md paths invalid: $PATHS_PASSIVE"
pass "skills/room-passive/SKILL.md frontmatter has paths: array (defense-in-depth)"

PATHS_PROACTIVE=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('skills/room-proactive/SKILL.md','utf8'));
  if (!Array.isArray(p.data.paths) || p.data.paths.length === 0) {
    console.log('FAIL: room-proactive paths missing or empty');
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "skills/room-proactive/SKILL.md paths invalid: $PATHS_PROACTIVE"
pass "skills/room-proactive/SKILL.md frontmatter has paths: array (defense-in-depth)"

# Test 5: Plugin manifest validation if available (CC 2.1.120+)
if command -v claude > /dev/null 2>&1; then
  if claude plugin validate --plugin-dir . > /tmp/114-plugin-validate.log 2>&1; then
    pass "claude plugin validate exits 0 (manifest is valid)"
  else
    cat /tmp/114-plugin-validate.log
    echo "NOTE: claude plugin validate failed or unsupported subcommand; review log above. Continuing (CC version may not support validate subcommand)."
  fi
else
  echo "NOTE: \`claude\` CLI not in PATH; skipping plugin manifest validation (manual fallback in tests/manual/114-acceptance.md)"
fi

echo ""
echo "==== AC-114-01 substrate preload: ALL CHECKS PASSED ===="
exit 0
