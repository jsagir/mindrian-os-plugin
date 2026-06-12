#!/usr/bin/env node
'use strict';
/*
 * Phase 155-03 -- USER.md convergence + setFocus arity fix
 *
 * Tests:
 *   1. writeUserMdAtomic round-trip: all 7 role_blend keys survive via readUserMd
 *   2. writeUserMdAtomic preserves user-authored body below frontmatter
 *   3. setFocus arity fix: the old 3-arg form 'setFocus(sessionId' no longer
 *      appears in shallow-doc-parser.cjs (static grep)
 *   4. 'user' is in VALID_SET_BY (focus.cjs)
 *   5. 'auto-from-upload' is NOT in VALID_SET_BY
 *   6. new-project.md contains 'writeUserMdAtomic'
 *   7. onboard.md contains 'writeUserMdAtomic'
 *
 * No em-dashes. No external packages. Node built-ins only.
 * Exits 0 on all pass, 1 on any failure.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log('PASS:', label);
    passed++;
  } else {
    console.error('FAIL:', label);
    console.error('  Expected:', JSON.stringify(expected));
    console.error('  Got:     ', JSON.stringify(actual));
    failed++;
  }
}

function checkTrue(label, value) {
  check(label, Boolean(value), true);
}

function checkFalse(label, value) {
  check(label, Boolean(value), false);
}

// ---- Test 1 + 2: writeUserMdAtomic round-trip + body preservation ----

(function testWriteReadRoundTrip() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-test-user-md-'));
  const userMdPath = path.join(tmpDir, 'USER.md');

  const { writeUserMdAtomic, readUserMd } = require(path.join(REPO, 'lib/core/user-md-ops.cjs'));

  const testData = {
    canonical_role: 'navigator',
    role_blend: {
      founder: 0.6,
      researcher: 0.4,
      operator: 0.0,
      investor: 0.0,
      mentor: 0.0,
      domain_expert: 0.0,
      student: 0.0,
    },
    journey_stage: 'Crossing the Threshold',
    first_seen: new Date().toISOString(),
  };

  writeUserMdAtomic(userMdPath, testData);
  const result = readUserMd(userMdPath);

  checkTrue('Test 1a: readUserMd returns non-null after writeUserMdAtomic', result);
  check('Test 1b: canonical_role survives round-trip', result && result.canonical_role, 'navigator');
  check('Test 1c: journey_stage survives round-trip', result && result.journey_stage, 'Crossing the Threshold');
  checkTrue('Test 1d: role_blend is present', result && result.role_blend);
  check('Test 1e: role_blend.founder = 0.6', result && result.role_blend && result.role_blend.founder, 0.6);
  check('Test 1f: role_blend.researcher = 0.4', result && result.role_blend && result.role_blend.researcher, 0.4);
  check('Test 1g: role_blend.operator = 0', result && result.role_blend && result.role_blend.operator, 0);
  check('Test 1h: role_blend.investor = 0', result && result.role_blend && result.role_blend.investor, 0);
  check('Test 1i: role_blend.mentor = 0', result && result.role_blend && result.role_blend.mentor, 0);
  check('Test 1j: role_blend.domain_expert = 0', result && result.role_blend && result.role_blend.domain_expert, 0);
  check('Test 1k: role_blend.student = 0', result && result.role_blend && result.role_blend.student, 0);
  check('Test 1l: parse_failed is false', result && result.parse_failed, false);

  // Test 2: body preservation
  // Write a USER.md with a human-authored body, then overwrite with writeUserMdAtomic
  // and verify the body is preserved.
  const withBody = `---\nschema_version: 1\ncanonical_role: navigator\n---\n\n# My Notes\n\nThis is my handwritten section.\n`;
  fs.writeFileSync(userMdPath, withBody, 'utf8');

  writeUserMdAtomic(userMdPath, testData);
  const afterRewrite = fs.readFileSync(userMdPath, 'utf8');

  checkTrue('Test 2a: user-authored body preserved after writeUserMdAtomic', afterRewrite.includes('My Notes'));
  checkTrue('Test 2b: handwritten content preserved after writeUserMdAtomic', afterRewrite.includes('This is my handwritten section.'));

  // Cleanup
  try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
})();

// ---- Test 3: static grep -- old 3-arg setFocus form must be gone ----

(function testSetFocusArityFix() {
  const parserPath = path.join(REPO, 'lib/core/shallow-doc-parser.cjs');
  const content = fs.readFileSync(parserPath, 'utf8');

  // The old broken pattern was: navigation.setFocus(sessionId, ventureNodeId, 'auto-from-upload')
  // After the fix, 'setFocus(sessionId' should NOT appear.
  const oldPattern = /setFocus\s*\(\s*sessionId/;
  checkFalse('Test 3: old 3-arg setFocus(sessionId, ...) form gone from shallow-doc-parser.cjs', oldPattern.test(content));
})();

// ---- Test 4: 'user' is in VALID_SET_BY ----

(function testValidSetBy() {
  const focusMod = require(path.join(REPO, 'lib/core/navigation/focus.cjs'));
  const { VALID_SET_BY } = focusMod;

  checkTrue('Test 4: VALID_SET_BY exported from focus.cjs', VALID_SET_BY instanceof Set);
  checkTrue('Test 4a: "user" is in VALID_SET_BY', VALID_SET_BY.has('user'));
  checkFalse('Test 4b: "auto-from-upload" is NOT in VALID_SET_BY', VALID_SET_BY.has('auto-from-upload'));
})();

// ---- Test 5: new-project.md contains 'writeUserMdAtomic' ----

(function testNewProjectHasWriteUserMdAtomic() {
  const content = fs.readFileSync(path.join(REPO, 'commands/new-project.md'), 'utf8');
  checkTrue('Test 5: new-project.md contains writeUserMdAtomic', content.includes('writeUserMdAtomic'));
})();

// ---- Test 6: onboard.md contains 'writeUserMdAtomic' ----

(function testOnboardHasWriteUserMdAtomic() {
  const content = fs.readFileSync(path.join(REPO, 'commands/onboard.md'), 'utf8');
  checkTrue('Test 6: onboard.md contains writeUserMdAtomic', content.includes('writeUserMdAtomic'));
})();

// ---- Summary ----

console.log('');
console.log('Results:', passed, 'passed,', failed, 'failed');
process.exit(failed > 0 ? 1 : 0);
