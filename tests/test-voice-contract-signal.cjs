'use strict';
// Phase 210-01 (Wave 0, item 210-C) -- the score-not-veto test stub for the
// Phase 202 voice-contract disqualifier in lab/apo/apo-loop.cjs.
//
// Directions encoded:
//   Leg 1 (SOFTENED direction, EXPECTED RED until plan 210-04): a voice-contract
//     VIOLATING candidate with decisively higher quality is NOT filtered out of
//     selection -- the veto power goes; content quality decides. Today the
//     .filter((c) => !c.disqualified) veto excludes it, so this leg is RED.
//   Leg 2 (PRESERVE FLOOR, green now and after): voice violations still appear on
//     the candidate record as a VISIBLE signal (voiceViolations plus a flag --
//     the current `disqualified` field or plan 210-04's renamed `voiceFlagged`).
//     The human running the loop always SEES the signal.
//   Leg 3 (PRESERVE FLOOR, green now and after): the detector itself
//     (lab/apo/voice-contract-gate.cjs::checkVoiceContract) is untouched -- an
//     em-dash output still returns pass:false with its violation named.
//
// The em-dash in the violating fixture is constructed via String.fromCharCode
// (0x2014) so this file itself contains no literal em-dash (house rule).
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const apoLoop = require(path.join(REPO, 'lab', 'apo', 'apo-loop.cjs'));
const { checkVoiceContract } = require(path.join(REPO, 'lab', 'apo', 'voice-contract-gate.cjs'));
const ACT_MD = path.join(REPO, 'commands', 'act.md');

console.log('test-voice-contract-signal (Phase 210 Wave 0)');

let pass = 0;
let fail = 0;
function leg(desc, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok   (' + desc + ')');
  } catch (e) {
    fail += 1;
    if (e && (e.code === 'ERR_ASSERTION' || e.name === 'AssertionError')) {
      console.error('  RED  (' + desc + '): ' + e.message);
    } else {
      console.error('  ERROR(' + desc + '): harness error, NOT an assertion failure: ' + (e && e.stack ? e.stack : e));
    }
  }
}

const EM_DASH = String.fromCharCode(0x2014);
// A compliant Larry output: single leading De Stijl mark, short, question, no dash.
const COMPLIANT_OUTPUT = '[BLUE] Good structure. What would falsify the biggest assumption here?';
// A violating output: identical teaching shape but carries an em-dash (U+2014).
const VIOLATING_OUTPUT = '[RED] The plan hides a scaling assumption ' + EM_DASH
  + ' name it. What breaks first under 10x load?';

// Candidate set: the VIOLATING candidate has decisively higher quality.
function proposeFn() {
  return [
    { id: 'compliant-low', quality: 0.4, body: '# variant compliant\n', output: COMPLIANT_OUTPUT },
    { id: 'violating-high', quality: 0.9, body: '# variant violating\n', output: VIOLATING_OUTPUT },
  ];
}
const qualityScoreFn = function (candidate) { return candidate.quality; };

function runLoop() {
  const runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-210-apo-runs-'));
  try {
    return apoLoop.runApo(ACT_MD, { proposeFn: proposeFn, qualityScoreFn: qualityScoreFn, runsDir: runsDir });
  } finally {
    fs.rmSync(runsDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Leg 1 -- SOFTENED direction (EXPECTED RED until plan 210-04): the violating
// candidate with decisively higher quality is SELECTABLE -- no veto.
// ---------------------------------------------------------------------------
leg('leg 1 SOFTENED: a higher-quality voice-violating candidate is NOT vetoed out of selection (RED until plan 210-04)', function () {
  const result = runLoop();
  assert.notEqual(result.best, null, 'the loop selects a best candidate');
  assert.equal(result.best.id, 'violating-high',
    'SOFTENED direction: the decisively-higher-quality candidate wins even with a voice violation (signal, not gate)');
});

// ---------------------------------------------------------------------------
// Leg 2 -- PRESERVE FLOOR: the violation stays VISIBLE on the candidate record
// (voiceViolations array plus a flag: today `disqualified`, after plan 210-04
// the renamed `voiceFlagged`). Either name satisfies the floor, so this leg is
// green now AND green after the rename without rewriting the assertion.
// ---------------------------------------------------------------------------
leg('leg 2 PRESERVE FLOOR: voice violations stay visible on the candidate record (voiceFlagged/voiceViolations)', function () {
  const result = runLoop();
  const violating = result.candidates.find(function (c) { return c.id === 'violating-high'; });
  assert.notEqual(violating, undefined, 'the violating candidate is on the record');
  assert.equal(Array.isArray(violating.voiceViolations), true, 'voiceViolations is recorded');
  assert.equal(violating.voiceViolations.indexOf('em_dash_present') !== -1, true,
    'the specific violation is named on the record');
  assert.equal(violating.voiceFlagged === true || violating.disqualified === true, true,
    'a visible flag marks the candidate (disqualified today; voiceFlagged after plan 210-04)');
  const compliant = result.candidates.find(function (c) { return c.id === 'compliant-low'; });
  assert.notEqual(compliant, undefined, 'the compliant candidate is on the record');
  assert.equal(compliant.voiceViolations.length, 0, 'the compliant candidate carries zero violations');
});

// ---------------------------------------------------------------------------
// Leg 3 -- PRESERVE FLOOR: the detector itself is untouched. An em-dash output
// still fails the voice contract with its violation named.
// ---------------------------------------------------------------------------
leg('leg 3 PRESERVE FLOOR: checkVoiceContract still fails an em-dash output (detector untouched)', function () {
  const violating = checkVoiceContract(VIOLATING_OUTPUT, {});
  assert.equal(violating.pass, false, 'an em-dash output fails the voice contract');
  assert.equal(violating.violations.indexOf('em_dash_present') !== -1, true,
    'the em-dash violation is named');
  const compliant = checkVoiceContract(COMPLIANT_OUTPUT, {});
  assert.equal(compliant.pass, true, 'a compliant output still passes the detector');
});

console.log('\ntest-voice-contract-signal: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-04 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
