#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-review-cr01-cr02-live-path.cjs -- red-first proof for the
 * 347 code review's two BLOCKER-tier findings (347-REVIEW.md CR-01, CR-02).
 *
 * Both findings share one root cause: every 347 test that touches the
 * predecessor-read / chain_state-write seam drives chain-executor.cjs's
 * runChain or chain-step-dispatcher.cjs's dispatchStep DIRECTLY. None drives
 * lib/mcp/tools/chain.cjs's chainRun end to end -- the ONLY production MCP
 * entry point for chain_run. This file does, over a real fixture room
 * (tests/helpers/fixture-room-347.cjs) and the REAL makeChainStepDispatcher
 * default (never an injected onStep), so both fixes are proven on the exact
 * path a live chain_run call takes.
 *
 * CR-01: step 2 of a two-step autonomous_safe chain must carry step 1's
 * chain_output on chain_output.shared_state (SHARED-04) -- pre-fix, chain.cjs
 * never threaded a run_id into makeChainStepDispatcher's closure, so
 * ctx.runId was always undefined and shared_state was always null.
 *
 * CR-02: a chain that halts at a material step, then resumes via gate_answer
 * approve, must leave ONE run_id with CONTIGUOUS step_index values across the
 * halt boundary, including a record for the approved gate step itself (which
 * executes OUTSIDE either runChain loop and so never hit the loop's own
 * write call site before this fix).
 *
 * Fixture steps use synthetic command names (never real /mos:* commands) so
 * this test never depends on data/command-registry.json staying stable --
 * chain-step-dispatcher.cjs's resolveExecutable degrades any unregistered
 * command to TIER_HOST_DISPATCH (tier 2), which is all this test needs: the
 * shared_state read and the chain_state write are both additive on tier 2
 * exactly as they are on tier 1 (chain-step-dispatcher.cjs:503-516).
 *
 * Plain node:assert CJS script, matching tests/test-347-dispatcher-reads-
 * projection.cjs's own check()/failures idiom. Hyphens only, no em-dashes
 * (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');

const chainTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'chain.cjs'));
const chainState = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'chain-state.cjs'));
const { buildChainFixtureRoom, closeChainFixtureRoom } =
  require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-347.cjs'));

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Raw-query helper: every chain_state node's parsed properties, read over a
// FRESH handle opened after chainRun's own internal handles (the executor's
// and every per-step dispatcher call's) have all been closed -- never a
// second live handle held concurrently with the operation under test.
function chainStateProps(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    const rows = db.prepare('SELECT properties FROM nodes WHERE type = ?').all(chainState.CHAIN_STATE_NODE_TYPE);
    return rows.map((r) => {
      try {
        return JSON.parse(r.properties || '{}');
      } catch (_e) {
        return {};
      }
    });
  } finally {
    db.close();
  }
}

function readChainStateFresh(dbPath, runId) {
  const db = new DatabaseSync(dbPath);
  try {
    return chainState.readChainState(db, runId);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// CR-01: a two-step autonomous_safe chain over the REAL dispatcher default.
// Step 2's chain_output.shared_state must carry step 1's chain_output.
// ---------------------------------------------------------------------------
async function testCr01SharedStateThreadedOnLivePath() {
  const tmp = mkTmp('t347-cr01-');
  const fixture = buildChainFixtureRoom(tmp, 'wide');
  const roomDir = fixture.roomDir;
  const dbPath = fixture.dbPath;
  const subjectNodeId = fixture.subjectNodeId;
  fixture.db.close(); // never a second live handle held during chainRun below.

  const steps = [
    { step: 1, command: '/mos:cr01-step-a', subject_node_id: subjectNodeId },
    { step: 2, command: '/mos:cr01-step-b', subject_node_id: subjectNodeId },
  ];

  // Both synthetic commands are unregistered in data/command-registry.json,
  // so the REAL posture authority (recipe-maps.cjs, withhold-default,
  // T-166-02) would classify them non-autonomous_safe and halt at step 1
  // before ever reaching step 2. This override is the ONLY seam replaced --
  // the gate decision, never the dispatch. onStep stays the real
  // makeChainStepDispatcher default (CR-01's own seam is left untouched).
  function bothStepsSafePostureFn(command) {
    return { command: command, autonomous_safe: true, posture: 'run' };
  }

  // No onStep override: chain.cjs must build its own makeChainStepDispatcher
  // closure here -- the exact seam CR-01 fixes.
  const result = await chainTool.chainRun(steps, {
    roomDir: roomDir,
    sessionId: 'sess-347-review-cr01',
    postureFn: bothStepsSafePostureFn,
  });

  check(result.completed === true, 'CR-01 1a: the two-step autonomous_safe chain completes (neither step is material)');
  check(result.halted === false, 'CR-01 1b: the chain never halts');
  check(Array.isArray(result.trace) && result.trace.length === 2, 'CR-01 1c: the trace carries exactly 2 entries');

  const step1Output = result.trace[0] && result.trace[0].chain_output;
  const step2Output = result.trace[1] && result.trace[1].chain_output;
  check(!!step1Output && step1Output.command === '/mos:cr01-step-a', 'CR-01 1d: step 1 dispatched for real (tier-2 honest refusal, command echoed)');
  check(!!step2Output, 'CR-01 1e: step 2 produced a chain_output');

  const shared = step2Output && step2Output.shared_state;
  check(!!shared, 'CR-01 1f (the headline proof): step 2 chain_output.shared_state is NON-NULL on the live chain.cjs path');
  check(shared && shared.content_is_data === true, 'CR-01 1g: shared_state.content_is_data === true');
  check(
    shared && shared.body && shared.body.command === '/mos:cr01-step-a',
    'CR-01 1h: shared_state.body is step 1\'s own persisted chain_output (command field round-trips)'
  );
  check(shared && shared.step_index === 0, 'CR-01 1i: shared_state.step_index === 0 (step 1\'s record)');

  // Independent proof from the room.db itself: both steps landed under the
  // SAME run_id (the write side and the dispatcher's read side agree).
  const props = chainStateProps(dbPath);
  check(props.length === 2, 'CR-01 1j: exactly 2 chain_state records exist in room.db');
  const runIds = Array.from(new Set(props.map((p) => p.run_id)));
  check(runIds.length === 1 && typeof runIds[0] === 'string' && runIds[0].length > 0,
    'CR-01 1k: both records share ONE non-empty run_id (the dispatcher-read and executor-write sides agree)');

  closeChainFixtureRoom({ roomDir: roomDir });
}

// ---------------------------------------------------------------------------
// CR-02: a 3-step chain halting at step 2 (forced material via a test
// postureFn override -- the dispatcher default is still used, so the
// approved step's dispatch and its predecessor read are both real), resumed
// via gate_answer approve. One run_id, contiguous step_index 0/1/2, and the
// approved gate step (index 1) gets its own anchored record.
// ---------------------------------------------------------------------------
async function testCr02HaltResumeSingleRunContiguous() {
  const tmp = mkTmp('t347-cr02-');
  const fixture = buildChainFixtureRoom(tmp, 'wide');
  const roomDir = fixture.roomDir;
  const dbPath = fixture.dbPath;
  const subjectNodeId = fixture.subjectNodeId;
  fixture.db.close();

  const MATERIAL_COMMAND = '/mos:cr02-gate-step';
  function testPostureFn(command) {
    if (command === MATERIAL_COMMAND) return { command: command, autonomous_safe: false, posture: 'halt' };
    return { command: command, autonomous_safe: true, posture: 'run' };
  }

  const steps = [
    { step: 1, command: '/mos:cr02-step-a', subject_node_id: subjectNodeId },
    { step: 2, command: MATERIAL_COMMAND, subject_node_id: subjectNodeId },
    { step: 3, command: '/mos:cr02-step-c', subject_node_id: subjectNodeId },
  ];

  const halted = await chainTool.chainRun(steps, {
    roomDir: roomDir,
    sessionId: 'sess-347-review-cr02',
    postureFn: testPostureFn,
  });

  check(halted.halted === true, 'CR-02 2a: the chain halts at the material step (step 2)');
  check(!!halted.gate && typeof halted.gate.gate_id === 'string', 'CR-02 2b: a gate_id was minted');
  check(halted.trace.length === 1, 'CR-02 2c: only step 1 ran before the halt');

  // Exactly ONE record exists so far (step 1), anchored under its own run_id.
  const preResumeProps = chainStateProps(dbPath);
  check(preResumeProps.length === 1, 'CR-02 2d: exactly 1 chain_state record exists before resume (step 1 only)');
  check(preResumeProps[0] && preResumeProps[0].step_index === 0, 'CR-02 2e: that record is step_index 0');

  const resumed = await chainTool.chainRun(null, {
    gateAnswer: { gate_id: halted.gate.gate_id, chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-347-review-cr02',
  });

  check(resumed.ok === true, 'CR-02 2f: the resume call succeeds');
  check(resumed.executed === true, 'CR-02 2g: the approved material step executed');
  check(resumed.completed === true, 'CR-02 2h: the chain completes after the remainder runs out');

  // The headline proof: ONE run_id, THREE records, CONTIGUOUS step_index.
  const postResumeProps = chainStateProps(dbPath);
  check(postResumeProps.length === 3,
    'CR-02 2i (the headline proof): exactly 3 chain_state records exist after resume -- '
    + 'the approved gate step (step 2) now has its own record, not just steps 1 and 3');

  const runIds = Array.from(new Set(postResumeProps.map((p) => p.run_id)));
  check(runIds.length === 1 && typeof runIds[0] === 'string' && runIds[0].length > 0,
    'CR-02 2j (the headline proof): all 3 records share ONE run_id -- the halt-then-resume never '
    + 'fragments the chain across an unrelated new run');

  const stepIndices = postResumeProps.map((p) => p.step_index).slice().sort((a, b) => a - b);
  check(JSON.stringify(stepIndices) === JSON.stringify([0, 1, 2]),
    'CR-02 2k: step_index values are 0, 1, 2 -- CONTIGUOUS, never restarting at 0 after the halt');

  // readChainState's own FEEDS_INTO walk resolves the full, ordered chain --
  // proving reconstructibility (SHARED-02) across the halt boundary, not just
  // raw row existence.
  const sharedRunId = runIds[0];
  const walked = readChainStateFresh(dbPath, sharedRunId);
  check(walked.length === 3, 'CR-02 2l: readChainState\'s FEEDS_INTO walk resolves all 3 records for the shared run_id');
  check(
    JSON.stringify(walked.map((r) => r.step_index)) === JSON.stringify([0, 1, 2]),
    'CR-02 2m: the FEEDS_INTO walk visits step_index 0, 1, 2 in order -- one unbroken chain, not two fragments'
  );
  check(walked[1] && walked[1].command === MATERIAL_COMMAND,
    'CR-02 2n: the middle record (step_index 1) is the approved material step itself, anchored in the walk');

  closeChainFixtureRoom({ roomDir: roomDir });
}

async function main() {
  await testCr01SharedStateThreadedOnLivePath();
  await testCr02HaltResumeSingleRunContiguous();

  console.log('');
  if (failures > 0) {
    console.error('test-347-review-cr01-cr02-live-path: ' + failures + ' FAILURE(S)');
    process.exit(1);
  } else {
    console.log('test-347-review-cr01-cr02-live-path: all checks passed');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
