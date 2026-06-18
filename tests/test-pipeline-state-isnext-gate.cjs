'use strict';
// Phase 166-01 Task 1 -- pipeline-state.cjs isNext hard-gate + sole-truth test (B1, D-166-02).
//
// B1 reconciliation standardizes chain resume/position on lib/mcp/pipeline-state.cjs
// as the SOLE chain-state source of truth (D-166-02), demotes the commands/pipeline.md
// artifact-frontmatter scan to a SECONDARY index only, and promotes checkPosition.isNext
// (today an advisory boolean) to a HARD gate the executor must honor before running a step.
//
// Four behaviors:
//   Test 1: initChain -> checkPosition('a') authorizes 'a' with gate 'run'; checkPosition('b')
//           withholds 'b' with reason 'not_next' naming the expected-next tool.
//   Test 2: recordStep('a') -> checkPosition('b').isNext true; checkPosition('a').isNext false.
//   Test 3: no active chain -> inPipeline:false and gate withholds with reason 'no_active_chain'.
//   Test 4: the module exports CHAIN_STATE_SOURCE === 'pipeline-state.json' (the sole-truth marker).
//
// Plain node assert harness against a tmp room dir. NO em-dashes. node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ps = require(path.join(REPO_ROOT, 'lib', 'mcp', 'pipeline-state.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-state-gate-'));
}

console.log('test-pipeline-state-isnext-gate');

// (1) After initChain, the first tool is authorized (gate 'run'); a later tool is
//     withheld with reason 'not_next' that names the expected-next tool.
check('initChain: first step gate=run, isNext true; second step withheld with not_next reason', () => {
  const room = freshRoom();
  ps.initChain(room, ['a', 'b', 'c'], 'local');

  const a = ps.checkPosition(room, 'a');
  assert.equal(a.inPipeline, true, 'expected inPipeline true for active chain');
  assert.equal(a.isNext, true, "expected isNext true for the chain's first tool 'a'");
  assert.equal(a.gate, 'run', "expected gate 'run' to authorize 'a'");

  const b = ps.checkPosition(room, 'b');
  assert.equal(b.isNext, false, "expected isNext false for non-next tool 'b'");
  assert.equal(b.gate, 'withhold', "expected gate 'withhold' for 'b'");
  assert.equal(b.reason, 'not_next', "expected withhold reason 'not_next'");
  assert.ok(
    typeof b.expectedNext === 'string' && b.expectedNext === 'a',
    "expected the withhold to name the expected-next tool 'a'"
  );
});

// (2) After recordStep('a'), position advances: 'b' becomes next; 'a' is no longer runnable.
check('recordStep advances: b becomes isNext true; a (already run) isNext false', () => {
  const room = freshRoom();
  ps.initChain(room, ['a', 'b', 'c'], 'local');
  ps.recordStep(room, 'a', 'p/a.md');

  const b = ps.checkPosition(room, 'b');
  assert.equal(b.isNext, true, "expected isNext true for 'b' after recordStep('a')");
  assert.equal(b.gate, 'run', "expected gate 'run' for 'b' after advance");

  const a = ps.checkPosition(room, 'a');
  assert.equal(a.isNext, false, "expected isNext false for already-run 'a'");
  assert.equal(a.gate, 'withhold', "expected gate 'withhold' for already-run 'a'");
});

// (3) With no active chain, the gate withholds (never a silent true).
check('no active chain: inPipeline false, gate withholds with reason no_active_chain', () => {
  const room = freshRoom();
  const r = ps.checkPosition(room, 'a');
  assert.equal(r.inPipeline, false, 'expected inPipeline false with no chain');
  assert.equal(r.isNext, false, 'expected isNext false with no chain');
  assert.equal(r.gate, 'withhold', "expected gate 'withhold' with no chain");
  assert.equal(r.reason, 'no_active_chain', "expected reason 'no_active_chain'");
});

// (4) The sole-truth marker is exported and stable (D-166-02).
check('CHAIN_STATE_SOURCE sole-truth marker exported as pipeline-state.json', () => {
  assert.equal(
    ps.CHAIN_STATE_SOURCE,
    'pipeline-state.json',
    "expected CHAIN_STATE_SOURCE === 'pipeline-state.json' (D-166-02 sole chain-state truth)"
  );
});

console.log(`\n${pass}/4 assertions passed`);
if (pass !== 4) {
  console.error('FAIL: not all assertions passed');
  process.exit(1);
}
