#!/usr/bin/env bash
# tests/test-115-persona-variants.sh
# Phase 115 / AC-115-04: persona_variants frontmatter has 9 hirer keys + 1 default
#                        + 3 unique non-default + 6 aliased + role_blend lookup
#                        documentation present in agent body

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# ----- Test 1: gray-matter parse + 10-entry persona_variants map -----
KEYS_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  const v = p.data.persona_variants;
  if (!v || typeof v !== 'object') { console.log('FAIL: persona_variants missing'); process.exit(1); }
  const expected = ['default','founder','researcher','researcher_ind','founder_grant','investor','operator','mentor','domain_expert','student'].sort();
  const actual = Object.keys(v).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.log('FAIL: keys actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected));
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "Test 1: persona_variants 10-entry map invalid: $KEYS_OK"
pass "Test 1: persona_variants has 10 keys (1 default + 9 Canon Appendix C hirer types)"

# ----- Test 2: persona_variants.default byte-exact equals initialPrompt + lib/copy constant -----
DEFAULT_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const SPEC = require('./lib/copy/115-spec-strings.cjs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  if (p.data.persona_variants.default !== p.data.initialPrompt) {
    console.log('FAIL: persona_variants.default !== initialPrompt');
    console.log('  default: ' + JSON.stringify(p.data.persona_variants.default));
    console.log('  initialPrompt: ' + JSON.stringify(p.data.initialPrompt));
    process.exit(1);
  }
  if (p.data.initialPrompt !== SPEC.INITIAL_PROMPT_DEFAULT) {
    console.log('FAIL: initialPrompt !== lib/copy/115-spec-strings.cjs INITIAL_PROMPT_DEFAULT');
    console.log('  initialPrompt: ' + JSON.stringify(p.data.initialPrompt));
    console.log('  spec: ' + JSON.stringify(SPEC.INITIAL_PROMPT_DEFAULT));
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "Test 2: default-initialPrompt-spec triple mismatch: $DEFAULT_OK"
pass "Test 2: persona_variants.default == initialPrompt == lib/copy/115-spec-strings.cjs INITIAL_PROMPT_DEFAULT (byte-exact)"

# ----- Test 3: 3 unique non-default variants (AC-115-04 minimum) -----
UNIQUE_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  const v = p.data.persona_variants;
  const uniques = [v.founder, v.researcher, v.investor];
  const set = new Set(uniques);
  if (set.size !== 3) { console.log('FAIL: founder/researcher/investor not 3 unique strings'); process.exit(1); }
  if (uniques.includes(v.default)) { console.log('FAIL: one of founder/researcher/investor equals default'); process.exit(1); }
  console.log('OK');
" 2>&1) || fail "Test 3: 3-unique non-default check failed: $UNIQUE_OK"
pass "Test 3: founder + researcher + investor are 3 unique non-default strings (AC-115-04 minimum 3 satisfied)"

# ----- Test 4: 6 keys aliased to default (Pitfall 7 known limitation) -----
ALIAS_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  const v = p.data.persona_variants;
  const aliasedKeys = ['researcher_ind','founder_grant','operator','mentor','domain_expert','student'];
  for (const k of aliasedKeys) {
    if (v[k] !== v.default) {
      console.log('FAIL: ' + k + ' not aliased to default');
      console.log('  ' + k + ': ' + JSON.stringify(v[k]));
      console.log('  default: ' + JSON.stringify(v.default));
      process.exit(1);
    }
  }
  console.log('OK');
" 2>&1) || fail "Test 4: 6-key aliasing check failed: $ALIAS_OK"
pass "Test 4: 6 keys (researcher_ind, founder_grant, operator, mentor, domain_expert, student) aliased to default"

# ----- Test 5: agent body has Persona-Aware Turn 1 section + role_blend lookup doc -----
grep -qF "## Persona-Aware Turn 1 (Phase 115)" agents/larry-extended.md \
  || fail "Test 5: Persona-Aware Turn 1 section missing"
grep -qF "role_blend" agents/larry-extended.md \
  || fail "Test 5: role_blend reading instruction missing"
grep -qF "Cold-start branch" agents/larry-extended.md \
  || fail "Test 5: cold-start branch instruction missing (Pitfall 2)"
grep -qF "lib/core/dual-path-detector.cjs" agents/larry-extended.md \
  || fail "Test 5: dual-path-detector reference missing in agent body"
grep -qF "lib/core/shallow-doc-parser.cjs" agents/larry-extended.md \
  || fail "Test 5: shallow-doc-parser reference missing in agent body"
pass "Test 5: agent body documents role_blend lookup + cold-start fallback + 115-02 artifact references"

# ----- Test 6: Phase 114 baseline preserved (skills, model, color) -----
BASELINE_OK=$(node -e "
  const m = require('gray-matter');
  const fs = require('fs');
  const p = m(fs.readFileSync('agents/larry-extended.md','utf8'));
  if (p.data.name !== 'larry-extended') { console.log('FAIL: name drifted: ' + p.data.name); process.exit(1); }
  if (p.data.model !== 'inherit') { console.log('FAIL: model drifted: ' + p.data.model); process.exit(1); }
  if (p.data.color !== 'purple') { console.log('FAIL: color drifted: ' + p.data.color); process.exit(1); }
  const skills = p.data.skills || [];
  const expected = ['larry-personality','context-engine','room-passive','room-proactive'];
  if (skills.length !== 4 || skills.join(',') !== expected.join(',')) {
    console.log('FAIL: skills drifted: ' + JSON.stringify(skills));
    process.exit(1);
  }
  console.log('OK');
" 2>&1) || fail "Test 6: Phase 114 baseline regression: $BASELINE_OK"
pass "Test 6: Phase 114 baseline preserved (name, model, color, skills array)"

# ----- Test 7: no em-dashes in agents/larry-extended.md (CLAUDE.md hard rule) -----
if grep -nE "—|—" agents/larry-extended.md; then
  fail "Test 7: em-dash found in agents/larry-extended.md (CLAUDE.md hard rule violated)"
fi
pass "Test 7: no em-dashes in agents/larry-extended.md"

echo ""
echo "==== test-115-persona-variants.sh: 7/7 PASSED ===="
exit 0
