#!/usr/bin/env bash
# tests/test-115-surfaces-grep.sh
# Phase 115 / AC-115-02: 8 first-touch surfaces all carry verbatim spec strings
# Pitfall 1 mitigation: imports source-of-truth from lib/copy/115-spec-strings.cjs

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# Load spec constants via node so we test the SAME strings the surfaces import from
SPEC_DUMP=$(node -e "console.log(JSON.stringify(require('./lib/copy/115-spec-strings.cjs')))") || fail "spec module unloadable"
SPLASH_COPY=$(echo "$SPEC_DUMP" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d);process.stdout.write(o.SPLASH_COPY)})")
NEW_PROJECT_OPENER=$(echo "$SPEC_DUMP" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d);process.stdout.write(o.NEW_PROJECT_OPENER)})")
MARKETING_LINE=$(echo "$SPEC_DUMP" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d);process.stdout.write(o.MARKETING_LINE)})")
DROR_TEST_CRITERIA=$(echo "$SPEC_DUMP" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d);process.stdout.write(o.DROR_TEST_CRITERIA)})")
INITIAL_PROMPT_DEFAULT=$(echo "$SPEC_DUMP" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d);process.stdout.write(o.INITIAL_PROMPT_DEFAULT)})")
ONBOARD_FRAGMENT="if you're here, you're probably stuck on a decision you can't quite name"
WEBSITE_HERO_TAGLINE=$(echo "$SPEC_DUMP" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d);process.stdout.write(o.WEBSITE_HERO_TAGLINE)})")

# ----- Assertion 1: D-02 SPLASH_COPY in commands/splash.md -----
grep -qF "$SPLASH_COPY" commands/splash.md \
  || fail "Assertion 1: SPLASH_COPY missing from commands/splash.md"
pass "Assertion 1: D-02 SPLASH_COPY verbatim in commands/splash.md"

# ----- Assertion 2: D-03 NEW_PROJECT_OPENER in commands/new-project.md -----
grep -qF "$NEW_PROJECT_OPENER" commands/new-project.md \
  || fail "Assertion 2: NEW_PROJECT_OPENER missing from commands/new-project.md"
# Negative: Phase 114 placeholder gone
if grep -qF "I'm Larry. What are you working on?" commands/new-project.md; then
  if grep -B 2 "Start with:" commands/new-project.md | grep -qF "What are you working on"; then
    fail "Assertion 2: pre-115 opener still present as the Step 3 'Start with' instruction"
  fi
fi
pass "Assertion 2: D-03 NEW_PROJECT_OPENER verbatim in commands/new-project.md (Phase 114 opener removed from Step 3)"

# ----- Assertion 3: D-08 README_HERO_TAGLINE in README.md (bold) -----
grep -qF "**${MARKETING_LINE}**" README.md \
  || fail "Assertion 3: '**${MARKETING_LINE}**' missing from README.md"
# Negative: pre-115 hero gone
if grep -qF "Your project becomes your co-founder" README.md; then
  fail "Assertion 3: pre-115 hero 'Your project becomes your co-founder' still present in README.md"
fi
pass "Assertion 3: D-08 README hero tagline verbatim (bold) in README.md (pre-115 hero removed)"

# ----- Assertion 4: D-07 ONBOARD_OPENING_FRAMING fragment in commands/onboard.md -----
grep -qF "$ONBOARD_FRAGMENT" commands/onboard.md \
  || fail "Assertion 4: ONBOARD opening fragment missing from commands/onboard.md"
grep -qF "That's the feeling MindrianOS is built for" commands/onboard.md \
  || fail "Assertion 4: ONBOARD second-sentence fragment missing"
grep -qF "Let's find the shape of it together" commands/onboard.md \
  || fail "Assertion 4: ONBOARD third-sentence fragment missing"
pass "Assertion 4: D-07 ONBOARD_OPENING_FRAMING three sentence fragments in commands/onboard.md"

# ----- Assertion 5: D-05 DROR_TEST_CRITERIA in docs/testers/REGISTRY.md -----
grep -qF "$DROR_TEST_CRITERIA" docs/testers/REGISTRY.md \
  || fail "Assertion 5: DROR_TEST_CRITERIA missing from docs/testers/REGISTRY.md"
pass "Assertion 5: D-05 DROR_TEST_CRITERIA verbatim in docs/testers/REGISTRY.md"

# ----- Assertion 6: D-06 INITIAL_PROMPT_DEFAULT as initialPrompt frontmatter value -----
INITIAL_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const SPEC = require('./lib/copy/115-spec-strings.cjs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  if (p.data.initialPrompt !== SPEC.INITIAL_PROMPT_DEFAULT) {
    console.log('FAIL: initialPrompt drift');
    console.log('  agents/larry-extended.md initialPrompt: ' + JSON.stringify(p.data.initialPrompt));
    console.log('  lib/copy/115-spec-strings INITIAL_PROMPT_DEFAULT: ' + JSON.stringify(SPEC.INITIAL_PROMPT_DEFAULT));
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "Assertion 6: $INITIAL_OK"
pass "Assertion 6: agents/larry-extended.md initialPrompt == lib/copy/115-spec-strings INITIAL_PROMPT_DEFAULT (byte-exact)"

# ----- Assertion 7: D-09 WEBSITE_HERO_TAGLINE in docs/copy/115-website-hero.md -----
grep -qF "$WEBSITE_HERO_TAGLINE" docs/copy/115-website-hero.md \
  || fail "Assertion 7: WEBSITE_HERO_TAGLINE missing from docs/copy/115-website-hero.md"
pass "Assertion 7: D-09 WEBSITE_HERO_TAGLINE verbatim in docs/copy/115-website-hero.md"

# ----- Assertion 8: persona_variants.default == INITIAL_PROMPT_DEFAULT -----
DEFAULT_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const SPEC = require('./lib/copy/115-spec-strings.cjs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  if (!p.data.persona_variants || p.data.persona_variants.default !== SPEC.INITIAL_PROMPT_DEFAULT) {
    console.log('FAIL: persona_variants.default drift');
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "Assertion 8: $DEFAULT_OK"
pass "Assertion 8: agents/larry-extended.md persona_variants.default == lib/copy/115-spec-strings INITIAL_PROMPT_DEFAULT (byte-exact)"

echo ""
echo "==== test-115-surfaces-grep.sh: 8/8 PASSED ===="
exit 0
