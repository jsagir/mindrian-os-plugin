'use strict';
// Phase 150.8-04 Task 1 (DIKW-07, SEL-01) -- post-filing F.1 selector.
//
// The post-filing flow in commands/file-meeting.md surfaces the F.1 "next move"
// selector with the three DIKW ladder verbs:
//   1. Review ambiguous segments (M)
//   2. Confirm proposed claims (N)
//   3. Build knowledge from this meeting
// routed through lib/hmi/selector-dispatcher.cjs pickShape with payload.verbs.
// The dispatcher appends the AskUserQuestion trailer + Free-Text last, so the
// rendered marker reports verbs=4 (the 3 ladder verbs + the appended Free-Text).
//
// This driver ALSO asserts the FROZEN 148 constants are byte-unchanged
// (DIAL_REACH_K=6, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15, MAX_K=3) so the
// post-filing selector wiring cannot silently move the dial constitution (the
// carried run-all-148.sh stays 18/18; this is a fast in-process tripwire on top).
//
// Pure in-process render -- no node:sqlite, no LLM, no fs writes (emitTelemetry is
// NOT set here so the render is side-effect-free). NO em-dashes (HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-post-filing-selector');

// The exact three ladder verbs the post-filing footer offers (M / N are filled
// from the room.db ambiguous-queue size + proposed-claim count at render time).
const LADDER_VERBS = [
  'Review ambiguous segments (M)',
  'Confirm proposed claims (N)',
  'Build knowledge from this meeting',
];

// (1) pickShape F.1 with the three ladder verbs renders the AskUserQuestion
//     marker reporting verbs=4 (3 ladder verbs + appended Free-Text).
check('F.1 with the 3 ladder verbs renders the AskUserQuestion marker verbs=4', () => {
  const result = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 2,
    roomDir: null,
    payload: {
      verbs: LADDER_VERBS.slice(),
      header: '-- mindrianOS -- meeting filed -- next move --',
    },
  });
  assert.equal(result.shape, 'F.1', 'must resolve to F.1');
  assert.ok(result.rendered, 'a rendered envelope must be present');
  assert.equal(
    result.rendered.askuserquestion_marker,
    '[AskUserQuestion contract: shape=F.1 verbs=4]',
    'the marker must report 4 verbs (3 ladder + Free-Text last)'
  );
});

// (2) The three ladder verbs appear in the contract, with Free-Text appended last.
check('the contract carries the 3 ladder verbs + Free-Text appended last', () => {
  const result = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 2,
    roomDir: null,
    payload: { verbs: LADDER_VERBS.slice() },
  });
  const verbs = result.rendered.contract.verbs;
  assert.equal(verbs.length, 4, 'exactly 4 verbs (3 ladder + Free-Text)');
  for (const v of LADDER_VERBS) {
    assert.ok(verbs.indexOf(v) !== -1, 'ladder verb missing: ' + v);
  }
  assert.equal(verbs[verbs.length - 1], 'Free-Text', 'Free-Text must be last');
});

// (3) The keyboard is the canonical AskUserQuestion primitive.
check('the contract keyboard is the AskUserQuestion primitive', () => {
  const result = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 2,
    roomDir: null,
    payload: { verbs: LADDER_VERBS.slice() },
  });
  assert.equal(result.rendered.contract.keyboard, 'askuserquestion');
});

// (4) FROZEN 148 constants are byte-unchanged (the post-filing wiring never moves
//     the dial constitution).
check('FROZEN 148 constants unchanged: DIAL_REACH_K=6, FLOOR=0.70, MARGIN=0.15, MAX_K=3', () => {
  assert.equal(orchestrator.DIAL_REACH_K, 6, 'DIAL_REACH_K must stay 6');
  assert.equal(orchestrator.RECOMMEND_FLOOR, 0.70, 'RECOMMEND_FLOOR must stay 0.70');
  assert.equal(orchestrator.MARGIN_THRESHOLD, 0.15, 'MARGIN_THRESHOLD must stay 0.15');
  assert.equal(ranker.MAX_K, 3, 'MAX_K must stay 3');
});

console.log(`\nPASS (${pass}/4)`);
