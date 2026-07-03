'use strict';
// Phase 210-01 (Wave 0, item 210-E-2) -- the trailer relevance/softening test for
// lib/hmi/selector-dispatcher.cjs::appendAskUserQuestionTrailer (called directly
// via its module export, the SEED-020 single construction door).
//
// Directions encoded:
//   (a) PRESERVE FLOOR (green now, stays green): a genuine-fork envelope still
//       carries a firing trailer naming the AskUserQuestion tool and the SEED-021
//       no-reproduce clause. The trailer never disappears; only its bindingness
//       softens.
//   (b) PRESERVE FLOOR (green now, stays green): the frozen
//       '[AskUserQuestion contract:' marker (the "do NOT alter shape" contract)
//       stays byte-identical in ALL cases.
//   (c) SOFTENED direction (EXPECTED RED until plan 210-05): the trailer
//       imperative is conditional, not unconditional-BINDING. It must NOT open
//       with the old unconditional bracket-BINDING prefix (spelled via string
//       concatenation below so the repo-wide zero-consumers grep stays empty)
//       and must instead open with the new stable prefix '[FIRE-IF-FORK:'.
//
// Reverse-regression floor note for this stub: the floor for item E is the
// classifyCardFire VERDICT behavior (legs b/c/d of tests/test-209-incident-replay.cjs),
// NOT the old bracket-BINDING literal string. Plan 210-05 re-points the wording-only
// leg (a) of test-209-incident-replay.cjs plus its three wording siblings
// (test-209-engine-arm-contract.cjs, test-209-room-pick-sensor.cjs,
// test-gate-native-fire-w1.cjs) from the old bracket-BINDING prefix to
// '[FIRE-IF-FORK:' in the SAME commit that lands the softening. That is the ONE
// intentional re-point of this phase, not a floor violation.
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const dispatcher = require(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const appendAskUserQuestionTrailer = dispatcher.appendAskUserQuestionTrailer;

console.log('test-210-trailer-relevance (Phase 210 Wave 0)');

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

function genuineForkEnvelope() {
  return appendAskUserQuestionTrailer({
    contract: { shape: 'F.1', verbs: ['resume', 'start-new', 'just-talk'] },
    zones: { footer: '' },
  }, 'F.1');
}

// ---------------------------------------------------------------------------
// (a) PRESERVE FLOOR: a genuine-fork envelope still carries a firing trailer that
// names the AskUserQuestion tool and the SEED-021 no-reproduce clause.
// ---------------------------------------------------------------------------
leg('a PRESERVE FLOOR: a genuine-fork envelope still carries a firing trailer (AskUserQuestion + SEED-021)', function () {
  const rendered = genuineForkEnvelope();
  assert.equal(typeof rendered.zones.footer, 'string',
    'the trailer rides the rendered footer');
  assert.equal(rendered.zones.footer.indexOf('AskUserQuestion') !== -1, true,
    'the trailer must name the AskUserQuestion tool (the capability survives the softening)');
  assert.equal(rendered.zones.footer.indexOf('SEED-021') !== -1, true,
    'the trailer must keep the SEED-021 no-reproduce clause (never draw the block as text)');
  assert.equal(typeof rendered.askuserquestion_binding, 'string',
    'the scalar imperative surface still exists');
});

// ---------------------------------------------------------------------------
// (b) PRESERVE FLOOR: the frozen '[AskUserQuestion contract:' marker stays
// byte-identical in all cases ("do NOT alter shape").
// ---------------------------------------------------------------------------
leg('b PRESERVE FLOOR: the frozen [AskUserQuestion contract: marker stays byte-identical (contract shape)', function () {
  const rendered = genuineForkEnvelope();
  assert.equal(rendered.askuserquestion_marker,
    '[AskUserQuestion contract: shape=F.1 verbs=3]',
    'the marker is byte-frozen for the contract-shape case');
});

leg('b PRESERVE FLOOR: the frozen marker stays byte-identical on the subShape-fallback / empty-verbs case', function () {
  const rendered = appendAskUserQuestionTrailer({ contract: {}, zones: { footer: null } }, 'F.4');
  assert.equal(rendered.askuserquestion_marker,
    '[AskUserQuestion contract: shape=F.4 verbs=0]',
    'the marker is byte-frozen when shape falls back to subShape and verbs are absent');
});

// ---------------------------------------------------------------------------
// (c) SOFTENED direction (EXPECTED RED until plan 210-05): the imperative is
// conditional-on-genuine-fork, not unconditional-BINDING.
// ---------------------------------------------------------------------------
leg('c SOFTENED: the trailer imperative is conditional, not unconditional-BINDING (RED until plan 210-05)', function () {
  const rendered = genuineForkEnvelope();
  const binding = rendered.askuserquestion_binding;
  assert.equal(binding.indexOf('[' + 'BINDING:') === 0, false,
    'SOFTENED direction: the imperative must NOT open with the unconditional bracket-BINDING prefix');
  assert.equal(binding.indexOf('[FIRE-IF-FORK:') === 0, true,
    'SOFTENED direction: the imperative opens with the new stable [FIRE-IF-FORK: prefix (conditional on a genuine fork)');
});

console.log('\ntest-210-trailer-relevance: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-05 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
