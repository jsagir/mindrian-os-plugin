'use strict';
/*
 * Phase 205-05 -- the two orthogonal decision axes (item 4, D-Q4), role_level
 * auto-detection + dial-default bias (item 5), and the NO-CUTE-IRONY tone
 * filter (item 5).
 *
 * Task 1 asserts: resolveDecisionMode ALWAYS returns a SAFE_MODES member (incl.
 * a fixture engineered to want tell-and-confident, which returns tell_and_hedged),
 * FORBIDDEN_MODE is never a return path (source grep), the 0.70 detent reuses the
 * frozen Shape-F RECOMMENDED_CONFIDENCE_FLOOR, and the confidence axis is always
 * hedged. Task 2 asserts: ROLE_LEVELS + detectRoleLevel exist, detection returns
 * a member on a matching fixture / null on cold start, the ranker default leans
 * vertical for student and horizontal/lateral for professor, the bias enforces NO
 * quota (output length == input length), the ranker stays synchronous, and it is
 * a byte-stable no-op when no role_level resolves. Task 3 asserts: the Test 6 quip
 * is stripped for a professor with the claim intact, a student in a non-sensitive
 * domain is a no-op, the output never contains an em-dash, and no hedge is removed.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const axes = require(path.join(REPO_ROOT, 'lib/core/decision-axes.cjs'));
const persona = require(path.join(REPO_ROOT, 'lib/core/persona-taxonomy.cjs'));
const tone = require(path.join(REPO_ROOT, 'lib/core/tone-filter.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib/workflow/f-selector-ranker.cjs'));
const { RECOMMENDED_CONFIDENCE_FLOOR } = require(path.join(REPO_ROOT, 'lib/core/navigation-engine.cjs'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ===========================================================================
// TASK 1 -- two orthogonal axes; tell-and-confident structurally unreachable.
// ===========================================================================

// The safe set is exactly the two hedged modes; the forbidden mode is not in it.
ok('SAFE_MODES is exactly {ask_and_hedged, tell_and_hedged}',
  JSON.stringify(axes.SAFE_MODES.slice().sort())
    === JSON.stringify(['ask_and_hedged', 'tell_and_hedged']));
ok('FORBIDDEN_MODE is tell_and_confident and NOT a safe mode',
  axes.FORBIDDEN_MODE === 'tell_and_confident'
    && axes.SAFE_MODES.indexOf(axes.FORBIDDEN_MODE) === -1);

// The two axes are two, not one (both frozen closed vocabularies).
ok('confidence axis is {hedged, confident}',
  JSON.stringify(axes.CONFIDENCE_AXIS) === JSON.stringify(['hedged', 'confident']));
ok('initiative axis is {ask_first, act_first}',
  JSON.stringify(axes.INITIATIVE_AXIS) === JSON.stringify(['ask_first', 'act_first']));

// D-Q4: the act/tell detent reuses the frozen Shape-F 0.70 value (not a new literal).
ok('ACT_TELL_DETENT === frozen RECOMMENDED_CONFIDENCE_FLOOR (0.70, D-Q4)',
  axes.ACT_TELL_DETENT === RECOMMENDED_CONFIDENCE_FLOOR && axes.ACT_TELL_DETENT === 0.7);

// The core fixtures.
const r075 = axes.resolveDecisionMode({ confidence: 0.75 });
ok('confidence 0.75 -> tell_and_hedged', r075.mode === 'tell_and_hedged');
const r050 = axes.resolveDecisionMode({ confidence: 0.50 });
ok('confidence 0.50 -> ask_and_hedged', r050.mode === 'ask_and_hedged');
const rJudg = axes.resolveDecisionMode({ confidence: 0.99, requires_judgment: true });
ok('requires_judgment true -> ask_and_hedged regardless of confidence',
  rJudg.mode === 'ask_and_hedged');

// The engineered fixture: high confidence + explicit act-first + a peer persona +
// a stray "confident" intent. In a one-axis model this wants tell-and-confident;
// the two-axis clamp coerces it to tell_and_hedged.
const rForce = axes.resolveDecisionMode({
  confidence: 0.98,
  persona: 'professor',
  requires_judgment: false,
  mode_signals: { user_said_just_tell_me: true, user_explicitly_said_run: true },
  confidence_intent: 'confident', // ignored by construction
});
ok('engineered tell-and-confident fixture -> tell_and_hedged (never FORBIDDEN_MODE)',
  rForce.mode === 'tell_and_hedged' && rForce.mode !== axes.FORBIDDEN_MODE);

// Every fixture (a confidence sweep + judgment + cold start) returns a SAFE mode
// and the confidence axis is ALWAYS hedged.
let allSafe = true;
let allHedged = true;
for (let c = 0; c <= 1.0001; c += 0.05) {
  for (const rj of [true, false]) {
    for (const cs of [true, false]) {
      const res = axes.resolveDecisionMode({
        confidence: c, requires_judgment: rj, mode_signals: { is_cold_start: cs },
        persona: 'professor',
      });
      if (axes.SAFE_MODES.indexOf(res.mode) === -1) allSafe = false;
      if (res.confidence_axis !== 'hedged') allHedged = false;
    }
  }
}
ok('every fixture in the confidence x judgment x cold-start sweep returns a SAFE mode', allSafe);
ok('the confidence axis is ALWAYS hedged (hedging always on, Part 3 / D-Q4)', allHedged);

// Malformed input soft-fails to a safe hedged ask (never throws, never forbidden).
const rBad = axes.resolveDecisionMode(null);
ok('malformed input -> a SAFE hedged mode (soft-fail, no throw)',
  axes.SAFE_MODES.indexOf(rBad.mode) !== -1 && rBad.confidence_axis === 'hedged');

// SOURCE grep: FORBIDDEN_MODE / tell_and_confident is never a return value.
const axesSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/decision-axes.cjs'), 'utf8');
const returnsForbidden = axesSrc.split('\n').some(function (line) {
  const code = line.trim();
  // Only actual return STATEMENTS (ignore prose / comments like "has no return path").
  if (!/^return\b/.test(code)) return false;
  return /tell_and_confident/.test(code) || /\bFORBIDDEN_MODE\b/.test(code);
});
ok('no source line both returns and mentions tell_and_confident (unreachable by construction)',
  returnsForbidden === false);

// ===========================================================================
// TASK 2 -- role_level axis + detection + dial-default elevation bias (no quota).
// ===========================================================================

ok('ROLE_LEVELS is exactly {student, practitioner, researcher, professor}',
  JSON.stringify(persona.ROLE_LEVELS)
    === JSON.stringify(['student', 'practitioner', 'researcher', 'professor']));
ok('detectRoleLevel is a function', typeof persona.detectRoleLevel === 'function');

// role_level is orthogonal to role_blend (a separate axis, not overloaded).
ok('ROLE_LEVELS is not the same set as ROLE_BLEND_AXES (orthogonal axes)',
  JSON.stringify(persona.ROLE_LEVELS) !== JSON.stringify(persona.ROLE_BLEND_AXES));

// Detection on matching opening-turns fixtures.
ok('detectRoleLevel -> professor on a teaching fixture',
  persona.detectRoleLevel(['When I teach my students this, I lecture on it.']) === 'professor');
ok('detectRoleLevel -> researcher on a research fixture',
  persona.detectRoleLevel([{ text: 'My dissertation tests my hypothesis for my PhD.' }]) === 'researcher');
ok('detectRoleLevel -> practitioner on a founder-of-practice fixture',
  persona.detectRoleLevel('My startup ships our product to our customers.') === 'practitioner');
ok('detectRoleLevel -> student on a learner fixture',
  persona.detectRoleLevel(["I'm learning this, can you explain, I'm a student."]) === 'student');
// Cold start -> null.
ok('detectRoleLevel -> null on empty cold-start input', persona.detectRoleLevel([]) === null);
ok('detectRoleLevel -> null on a signal-free fixture',
  persona.detectRoleLevel(['The weather is fine today.']) === null);

// The ranker dial-default LEANS the right way per role_level (bias, not a count).
const studentRanked = ranker.rankForSelector({ role_level: 'student', k: 3 });
ok('ranker returns a synchronous Array (not a Promise) with role_level',
  Array.isArray(studentRanked));
ok('with role_level=student the default leans VERTICAL',
  studentRanked.length > 0 && studentRanked.every(function (it) { return it.elevation_lean === 'vertical'; }));

const profRanked = ranker.rankForSelector({ role_level: 'professor', k: 3 });
ok('with role_level=professor the default leans HORIZONTAL/LATERAL',
  profRanked.length > 0 && profRanked.every(function (it) {
    return it.elevation_lean === 'horizontal' || it.elevation_lean === 'lateral';
  }));

// NO quota: the bias never changes the number of rows (no count/quota gate).
const baseForQuota = ranker.rankForSelector({ k: 3 });
const biasedForQuota = ranker.rankForSelector({ role_level: 'professor', k: 3 });
ok('role_level bias enforces NO quota (row count unchanged by the bias)',
  baseForQuota.length === biasedForQuota.length);
// The bias helper is a pure map (no filter/slice) -> length preserved.
const sample = [{ command: '/a', score: 0.9 }, { command: '/b', score: 0.5 }];
const biasedSample = ranker._applyRoleLevelBias(sample, 'student');
ok('_applyRoleLevelBias preserves length (a map, never a count/quota filter)',
  biasedSample.length === sample.length
    && biasedSample.every(function (it) { return it.elevation_lean === 'vertical'; }));

// Byte-stable no-op when no role_level resolves (205-03 / 205-04 suites pass none).
const noRole = ranker.rankForSelector({ k: 3 });
ok('no role_level -> items carry NO elevation_lean (byte-stable no-op)',
  noRole.every(function (it) { return it.elevation_lean === undefined; }));

// ===========================================================================
// TASK 3 -- NO-CUTE-IRONY tone filter.
// ===========================================================================

// The Test 6 fixture: a hedged substantive claim + the punchline quip.
const T6 = 'These might be the same argument. A paper about AI written by AI would be its own punchline.';
const filtered = tone.applyNoCuteIrony(T6, { role_level: 'professor' });
ok('professor: the punchline quip is stripped',
  filtered.indexOf('punchline') === -1);
ok('professor: the substantive hedged claim is kept intact',
  filtered.indexOf('These might be the same argument') !== -1);

// A researcher is also gated.
const filteredR = tone.applyNoCuteIrony('The irony is delicious here. The data may support Y.',
  { role_level: 'researcher' });
ok('researcher: the ironic aside is stripped, the hedged claim survives',
  filteredR.indexOf('irony') === -1 && filteredR.indexOf('The data may support Y') !== -1);

// A sensitive domain gates regardless of role_level.
const filteredD = tone.applyNoCuteIrony('That would be its own punchline. The threat is real.',
  { role_level: 'student', domain: 'intelligence' });
ok('sensitive domain (intelligence) gates even for a student',
  filteredD.indexOf('punchline') === -1 && filteredD.indexOf('The threat is real') !== -1);

// Student + non-sensitive domain -> no-op (a light aside is permitted).
const aside = 'That would be its own punchline. Anyway, here is the plan.';
const noop = tone.applyNoCuteIrony(aside, { role_level: 'student', domain: 'business' });
ok('student + non-sensitive domain -> no-op (aside permitted, gates on role/domain)',
  noop === aside);

// The output never contains an em-dash (hyphens only).
const withEmDash = 'The irony is rich \u2014 truly. The finding might hold \u2014 tentatively.';
const swept = tone.applyNoCuteIrony(withEmDash, { role_level: 'professor' });
ok('filter output never contains an em-dash (hyphens only)', swept.indexOf('\u2014') === -1);

// Hedged-always: a cute-looking sentence that carries a hedge is NEVER stripped.
const hedgedQuip = 'This might be its own punchline, I suspect. The claim stands.';
const hedgedOut = tone.applyNoCuteIrony(hedgedQuip, { role_level: 'professor' });
ok('a sentence carrying a hedge is kept even if it looks cute (no de-hedge)',
  hedgedOut.indexOf('I suspect') !== -1);

console.log('\nPASS test-205-decision-axes (' + pass + ' assertions)');
console.log('>>> test-205-decision-axes.cjs: PASSED');
