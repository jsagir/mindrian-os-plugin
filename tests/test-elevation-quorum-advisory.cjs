'use strict';
// Phase 210-01 (Wave 0, item 210-D) -- the suggest-not-force test stub for
// lib/core/fusion-router.cjs::sessionEndQuorum (the D-Q1 session-end quorum,
// the item-D target per the CONTEXT.md open-questions addendum decision 3).
//
// Directions encoded:
//   Leg 1 (SOFTENED direction, EXPECTED RED until plan 210-04): with 2+ open
//     frames and no horizontal move fired, the quorum SUGGESTS a cross-frame
//     hypothesis (suggested:true) instead of FORCING one (forced:false). The
//     force-pick becomes a suggestion/default, not a hard requirement.
//   Leg 2 (PRESERVE FLOOR, green now and after): the hypothesis itself keeps the
//     T-205-07-E floor -- offered:true, committed:false, hedged:true. It is
//     NEVER auto-committed as a decision; no edge is written.
//   Leg 3 (PRESERVE FLOOR, green now and after): the Test-12 zero-force case --
//     when a horizontal move already fired this session, the quorum returns no
//     force AND no suggestion pressure beyond the existing reason field.
//
// The 2-open-frames fixture mirrors tests/test-205-fusion-router.cjs Test 11.
// No db is needed: assembleOpenFrames consumes the caller frame descriptors
// directly (the live-node join is db-gated).
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const fusion = require(path.join(REPO, 'lib', 'core', 'fusion-router.cjs'));

console.log('test-elevation-quorum-advisory (Phase 210 Wave 0)');

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

// The Test-11 fixture shape (tests/test-205-fusion-router.cjs): two open frames,
// nothing fired this session.
function twoFramesCtx() {
  return {
    sessionId: 's210',
    frames: [
      { frameKey: 'frame-alpha', job: '', structure: 'pipeline', surface: 'x' },
      { frameKey: 'frame-beta', job: '', structure: 'pipeline', surface: 'y' },
    ],
    horizontalFiredThisSession: false,
  };
}

// ---------------------------------------------------------------------------
// Leg 1 -- SOFTENED direction (EXPECTED RED until plan 210-04): suggest, not force.
// ---------------------------------------------------------------------------
leg('leg 1 SOFTENED: the quorum SUGGESTS instead of FORCING (suggested:true, forced:false) (RED until plan 210-04)', function () {
  const q = fusion.sessionEndQuorum(twoFramesCtx());
  assert.equal(q.suggested, true,
    'SOFTENED direction: the quorum offers its hypothesis as a suggestion/default');
  assert.equal(q.forced, false,
    'SOFTENED direction: the quorum no longer FORCES the pick (judgment restored)');
});

// ---------------------------------------------------------------------------
// Leg 2 -- PRESERVE FLOOR: the hypothesis keeps the T-205-07-E floor.
// ---------------------------------------------------------------------------
leg('leg 2 PRESERVE FLOOR: the hypothesis stays offered:true, committed:false, hedged:true (T-205-07-E)', function () {
  const q = fusion.sessionEndQuorum(twoFramesCtx());
  assert.notEqual(q.hypothesis, undefined, 'a cross-frame hypothesis is still produced');
  assert.equal(q.hypothesis.offered, true, 'the hypothesis is OFFERED');
  assert.equal(q.hypothesis.committed, false, 'NEVER auto-committed as a decision (T-205-07-E)');
  assert.equal(q.hypothesis.hedged, true, 'the hypothesis stays hedged (offer-as-question)');
  assert.equal(q.hypothesis.asserted, false, 'the hypothesis is never asserted');
});

// ---------------------------------------------------------------------------
// Leg 3 -- PRESERVE FLOOR: the Test-12 zero-force case stays zero-pressure.
// ---------------------------------------------------------------------------
leg('leg 3 PRESERVE FLOOR: horizontal-already-fired returns no force and no suggestion pressure', function () {
  const q = fusion.sessionEndQuorum({
    sessionId: 's210',
    frames: [
      { frameKey: 'frame-alpha', job: 'j', structure: 's', surface: 'x' },
      { frameKey: 'frame-beta', job: 'j', structure: 's', surface: 'y' },
    ],
    horizontalFiredThisSession: true,
  });
  assert.equal(q.forced, false, 'no forced hypothesis when a horizontal move already fired');
  assert.equal(q.reason, 'horizontal_move_already_fired', 'the reason names the already-fired case');
  assert.notEqual(q.suggested, true, 'no suggestion pressure either (the connection was already made)');
  assert.equal(q.hypothesis, undefined, 'no hypothesis is minted in the zero-force case');
});

console.log('\ntest-elevation-quorum-advisory: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-04 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
