#!/usr/bin/env node
/*
 * Phase 155-04 -- test-mva-from-brief.cjs
 *
 * Hermetic HOME fixture test proving option 2 of mva-option-router reads a
 * sha8 brief side-file and returns the ignite_from_brief action.
 *
 * Tests:
 *   1. sha8 brief read: option 2 returns action 'ignite_from_brief'
 *   2. invoke_command is '/mos:ignite --from-brief <sha8>'
 *   3. brief_content contains the venture_summary from the side-file
 *   4. STUB_MESSAGE_119 narrative does NOT appear in result
 *   5. most-recent-brief auto-discovery (no sha8 given): returns most recent brief
 *   6. empty/missing briefs dir: returns action 'no_brief_available'
 *   7. reward-before-investment flag: brief_reward_pending appears when no reward yet
 *   8. static grep: 'express' in commands/new-project.md returns >= 1
 *   9. static grep: STUB_MESSAGE_119 as primary response returns 0 in router
 *   10. venture-shape-nudge.cjs doc comment repointed to /mos:ignite
 *   11. room-auto-create-nudge.cjs verb repointed to /mos:ignite
 *   12. T-155-04-01: sha8 path-traversal is rejected (slash/dot/space in sha8)
 *   13. T-155-04-03: malformed JSON brief returns action 'brief_parse_error'
 *
 * Pattern: check/pass counter (mirrors test-mva-dror-harness.cjs / test-room-birth.cjs).
 * No em-dashes. No async (router internals are synchronous helpers called directly).
 *
 * Pure CJS, node built-ins only. No test framework.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// -------- helpers --------

let checks = 0;
let passes = 0;

function check(label, ok) {
  checks++;
  if (ok) {
    passes++;
    console.log('  PASS: ' + label);
  } else {
    console.log('  FAIL: ' + label);
  }
}

function summary() {
  const all = checks === passes;
  console.log('');
  console.log('[test-mva-from-brief] ' + passes + '/' + checks + (all ? ' PASS' : ' FAIL'));
  return all;
}

// -------- hermetic HOME setup --------

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-from-brief-'));
const briefsDir = path.join(tmpHome, '.mindrian', 'mva', 'briefs');
const stateDir = path.join(tmpHome, '.mindrian', 'mva');

fs.mkdirSync(briefsDir, { recursive: true });

// -------- fixture briefs --------

const FIXTURE_SHA8 = 'abc12345';
const FIXTURE_BRIEF = {
  venture_summary: 'Test venture for Phase 155-04',
  domains: ['biotech'],
  jtbd: 'When I explore biotech I need MindrianOS to guide me',
  sha8: FIXTURE_SHA8,
  sha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  rendered_at_ms: Date.now() - 5000,
};

fs.writeFileSync(
  path.join(briefsDir, FIXTURE_SHA8 + '.json'),
  JSON.stringify(FIXTURE_BRIEF),
  'utf8'
);

// A second brief (for auto-discovery ordering)
const SECOND_SHA8 = 'def67890';
const SECOND_BRIEF = {
  venture_summary: 'Second venture',
  domains: ['edtech'],
  jtbd: 'When I build edtech tools I need structure',
  sha8: SECOND_SHA8,
  sha256: 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
  rendered_at_ms: Date.now() - 1000,
};

// Write second brief slightly later (mtime matters for auto-discovery)
setTimeout(() => {
  fs.writeFileSync(
    path.join(briefsDir, SECOND_SHA8 + '.json'),
    JSON.stringify(SECOND_BRIEF),
    'utf8'
  );
}, 10);

// Write state.json pointing to the second (most recent) brief
const stateJson = {
  current_sha8: SECOND_SHA8,
  rendered_at_ms: Date.now() - 1000,
};
fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(stateJson), 'utf8');

// -------- swap HOME --------

const origHome = process.env.HOME;
process.env.HOME = tmpHome;

// -------- load the router AFTER swapping HOME --------

const REPO_ROOT = path.join(__dirname, '..');
const router = require(path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.cjs'));

// -------- tests --------

console.log('[test-mva-from-brief] Phase 155-04 -- option 2 ignite_from_brief');
console.log('');
console.log('Section 1: resolveOption2Result helper');

// The routeOption function validates sha8 via a side-file read, then telemetry --
// we test the exported OPTION_BEHAVIOR and the internal helpers via a direct
// call to the resolution path.
//
// For the hermetic test, the simplest and most robust approach is to call
// resolveOption2 (the new exported helper added by this plan). If the plan
// chose to inline the logic inside routeOption only, we test via the
// exported resolveOption2 or resolveFromBrief helper.
//
// If no such export exists yet (RED phase), these tests will fail with
// 'resolveOption2 is not a function', which is the expected RED state.

const resolveOption2 = router.resolveOption2;
const resolveCurrentSha8 = router.resolveCurrentSha8;

console.log('Section 2: sha8 brief read returns ignite_from_brief');

// Test 1: sha8 given -> returns ignite_from_brief
{
  const result = typeof resolveOption2 === 'function'
    ? resolveOption2(FIXTURE_SHA8)
    : { action: '__resolveOption2_not_exported__' };
  check('resolveOption2 is exported as a function', typeof resolveOption2 === 'function');
  check('result.action === ignite_from_brief', result.action === 'ignite_from_brief');
}

// Test 2: invoke_command
{
  const result = typeof resolveOption2 === 'function'
    ? resolveOption2(FIXTURE_SHA8)
    : {};
  check(
    'invoke_command === /mos:ignite --from-brief ' + FIXTURE_SHA8,
    result.invoke_command === '/mos:ignite --from-brief ' + FIXTURE_SHA8
  );
}

// Test 3: brief_content contains venture_summary
{
  const result = typeof resolveOption2 === 'function'
    ? resolveOption2(FIXTURE_SHA8)
    : {};
  check(
    'brief_content.venture_summary matches fixture',
    result.brief_content &&
      result.brief_content.venture_summary === FIXTURE_BRIEF.venture_summary
  );
}

// Test 4: STUB_MESSAGE_119 narrative does NOT appear in result
{
  const result = typeof resolveOption2 === 'function'
    ? resolveOption2(FIXTURE_SHA8)
    : {};
  const resultStr = JSON.stringify(result || {});
  const stubText = 'Building a room around this is the next layer';
  check('STUB_MESSAGE_119 narrative absent from result', !resultStr.includes(stubText));
}

// Test 5: most-recent-brief auto-discovery (no sha8 given)
{
  const result = typeof resolveOption2 === 'function'
    ? resolveOption2(null)
    : {};
  // The most-recent-brief discovery reads state.json current_sha8 = SECOND_SHA8
  check(
    'auto-discovery returns ignite_from_brief (no sha8 given)',
    result.action === 'ignite_from_brief'
  );
  check(
    'auto-discovery sha8 matches state.json current_sha8',
    result.sha8 === SECOND_SHA8
  );
}

console.log('');
console.log('Section 3: fallback -- empty or missing briefs dir');

// Test 6: no briefs at all -> no_brief_available
{
  const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-empty-'));
  const savedHome = process.env.HOME;
  process.env.HOME = emptyHome;

  // Clear module cache so _home() returns the new HOME
  const routerPath = require.resolve(path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.cjs'));
  delete require.cache[routerPath];
  const routerEmpty = require(routerPath);
  const resolveEmpty = routerEmpty.resolveOption2;

  const result = typeof resolveEmpty === 'function'
    ? resolveEmpty(null)
    : { action: '__resolveOption2_not_exported__' };

  check('empty HOME returns action no_brief_available', result.action === 'no_brief_available');
  check('no_brief_available includes message field', typeof result.message === 'string' && result.message.length > 0);

  // Restore
  process.env.HOME = savedHome;
  delete require.cache[routerPath];
  require(routerPath);
}

console.log('');
console.log('Section 4: reward-before-investment flag');

// Test 7: brief_reward_pending flag
{
  process.env.HOME = tmpHome;
  const routerPath = require.resolve(path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.cjs'));
  delete require.cache[routerPath];
  const routerFresh = require(routerPath);
  const resolveFresh = routerFresh.resolveOption2;

  const result = typeof resolveFresh === 'function'
    ? resolveFresh(FIXTURE_SHA8)
    : {};
  // brief_reward_pending should be present (no mva_brief_rendered event in telemetry dir)
  // The rule: if no reward has been delivered, brief_reward_pending: true
  check(
    'brief_reward_pending field present in result',
    typeof result.brief_reward_pending === 'boolean'
  );
}

console.log('');
console.log('Section 5: threat model mitigations');

// Test 12: T-155-04-01 sha8 path-traversal rejected
{
  process.env.HOME = tmpHome;
  const routerPath = require.resolve(path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.cjs'));
  delete require.cache[routerPath];
  const routerT = require(routerPath);
  const resolveT = routerT.resolveOption2;

  const badSha8s = ['../etc/passwd', 'abc/1234', 'abc.1234', 'abc 1234', 'abcdefghij'];

  for (const bad of badSha8s) {
    const result = typeof resolveT === 'function'
      ? resolveT(bad)
      : { action: 'ignite_from_brief' }; // would be a false pass if not caught
    const isBlocked = result.action !== 'ignite_from_brief' || result.error === 'invalid_sha8';
    check('T-155-04-01: sha8 "' + bad + '" is rejected', isBlocked);
  }
}

// Test 13: T-155-04-03 malformed JSON -> brief_parse_error
{
  process.env.HOME = tmpHome;
  const malformedSha8 = 'ffff0000';
  fs.writeFileSync(path.join(briefsDir, malformedSha8 + '.json'), '{NOT VALID JSON}', 'utf8');

  const routerPath = require.resolve(path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.cjs'));
  delete require.cache[routerPath];
  const routerM = require(routerPath);
  const resolveM = routerM.resolveOption2;

  const result = typeof resolveM === 'function'
    ? resolveM(malformedSha8)
    : { action: 'ignite_from_brief' };
  check('T-155-04-03: malformed JSON returns brief_parse_error', result.action === 'brief_parse_error');
  check('T-155-04-03: brief_parse_error includes message', typeof result.message === 'string');
}

console.log('');
console.log('Section 6: static checks');

// Test 8: grep 'express' in commands/new-project.md
{
  const newProjectPath = path.join(REPO_ROOT, 'commands', 'new-project.md');
  const content = fs.existsSync(newProjectPath)
    ? fs.readFileSync(newProjectPath, 'utf8')
    : '';
  const expressCount = (content.match(/express/g) || []).length;
  check('commands/new-project.md contains "express" (>= 1)', expressCount >= 1);
}

// Test 9: STUB_MESSAGE_119 is NOT the primary option 2 response
{
  const routerPath = path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.cjs');
  const routerContent = fs.existsSync(routerPath)
    ? fs.readFileSync(routerPath, 'utf8')
    : '';
  // The narrative for option 2 must NOT be STUB_MESSAGE_119
  // We check OPTION_BEHAVIOR[2].narrative !== STUB_MESSAGE_119 text
  const stubText = 'Building a room around this is the next layer';
  // Check if the narrative property for option 2 points to the stub message.
  // In the replaced implementation, narrative may still exist but as a comment, not the returned action.
  // The key check: the exported OPTION_BEHAVIOR[2].action is 'phase_119_stub' BEFORE the fix.
  // After fix: OPTION_BEHAVIOR[2].action should be 'ignite_from_brief' or the behavior
  // object itself should be replaced.
  // Since we export OPTION_BEHAVIOR, we check it directly:
  const routerPath2 = require.resolve(path.join(REPO_ROOT, 'lib', 'core', 'mva-option-router.cjs'));
  delete require.cache[routerPath2];
  const routerStub = require(routerPath2);
  const behavior2 = routerStub.OPTION_BEHAVIOR && routerStub.OPTION_BEHAVIOR[2];
  check(
    'OPTION_BEHAVIOR[2].action is not phase_119_stub',
    !behavior2 || behavior2.action !== 'phase_119_stub'
  );
}

// Test 10: venture-shape-nudge.cjs comment repointed to /mos:ignite
{
  const nudgePath = path.join(REPO_ROOT, 'lib', 'core', 'venture-shape-nudge.cjs');
  const nudgeContent = fs.existsSync(nudgePath)
    ? fs.readFileSync(nudgePath, 'utf8')
    : '';
  check(
    'venture-shape-nudge.cjs comment contains /mos:ignite',
    nudgeContent.includes('/mos:ignite')
  );
}

// Test 11: room-auto-create-nudge.cjs verb repointed to /mos:ignite
{
  const nudgeScriptPath = path.join(REPO_ROOT, 'scripts', 'room-auto-create-nudge.cjs');
  const nudgeScriptContent = fs.existsSync(nudgeScriptPath)
    ? fs.readFileSync(nudgeScriptPath, 'utf8')
    : '';
  check(
    'room-auto-create-nudge.cjs verb is /mos:ignite (not /mos:new-project)',
    nudgeScriptContent.includes('/mos:ignite') && !nudgeScriptContent.includes("'/mos:new-project'")
  );
}

// -------- restore HOME --------

process.env.HOME = origHome;

// -------- final summary --------

console.log('');
const ok = summary();
process.exit(ok ? 0 : 1);
