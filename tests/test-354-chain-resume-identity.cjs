#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-chain-resume-identity.cjs -- Phase 354-03 (SYS-09).
 *
 * Pins the P1 chain-resume seam named in 354-CONTEXT.md (CTX-RESUME):
 * lib/core/chain-executor.cjs's _runChainResilient resume skip identifies an
 * "already done" step by `journal.chain.indexOf(step.command)` -- a command
 * NAME, not a step POSITION. A repeated command (research, validate,
 * research) collapses onto one identity, so a resume after the FIRST
 * research step wrongly treats the THIRD (identical-command) step as also
 * already done, and the first resumed step is dispatched with
 * previousOutput = null even though the journal holds the real predecessor
 * output_path.
 *
 * The two layers that disagree, named per the plan's objective: the
 * executor's notion of "already done" (a command name) versus the journal's
 * (lib/mcp/pipeline-state.cjs chain_position, the SOLE chain-state truth per
 * D-166-02, docs/reviews/phase-354-probes/persistence.cjs's resume() probe
 * is the seed for cases A and B below).
 *
 * RED-PROOF (against the pre-fix executor): case A's `calls` array comes
 * back `[3]` (not `[2, 3]`) -- the repeated-command collision skips step 2
 * as well as step 1 -- and case B's `inputs[0]` (the previousOutput onStep
 * receives for the first resumed step) is `null`, not the restored
 * `{ output_path: 'a.md', ... }` reference. Cases C, D and E exercise the
 * mismatch halt and completion-agreement checks this plan ADDS (they do not
 * exist pre-fix, so they are asserted as new behavior, not regression pins
 * on old behavior).
 *
 * Plain-Node harness (tests/test-347-resume-nonlinear.cjs shape): assert, a
 * local ok(desc) counter, a leading log of the test name, a trailing PASS
 * line, process.exitCode = 1 on any failure. No framework. Hyphens only, no
 * em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const ps = require(path.join(REPO, 'lib', 'mcp', 'pipeline-state.cjs'));
const chainExecutor = require(path.join(REPO, 'lib', 'core', 'chain-executor.cjs'));

console.log('test-354-chain-resume-identity');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}

function makeOnStep(calls, inputs) {
  return function onStep(step, previous) {
    calls.push(step.step);
    inputs.push(previous);
    return { chain_output: { value: step.step }, quality: 'high' };
  };
}

const fs = require('node:fs');

// -----------------------------------------------------------------------
// Case A: repeated command. initChain(research, validate, research),
// recordStep(research, a.md) -- journal is at chain_position 0. Resuming
// the same three-step list must dispatch ONLY steps 2 and 3, never
// re-dispatch step 1, and never conflate the two 'research' occurrences.
// -----------------------------------------------------------------------
async function testRepeatedCommandResume() {
  const { room, cleanup } = makeScratchRoom('resume-a');
  try {
    ps.initChain(room, ['research', 'validate', 'research'], 'manual');
    fs.writeFileSync(path.join(room, 'a.md'), 'Synthetic predecessor output.\n');
    ps.recordStep(room, 'research', 'a.md');

    const calls = [];
    const inputs = [];
    const result = await chainExecutor.runChain([
      { step: 1, command: 'research' },
      { step: 2, command: 'validate' },
      { step: 3, command: 'research' },
    ], {
      roomDir: room,
      journal: true,
      resume: true,
      gateFn: function () { return 'run'; },
      onStep: makeOnStep(calls, inputs),
    });

    assert.deepStrictEqual(calls, [2, 3], 'repeated-command resume dispatches steps 2 and 3 only');
    ok('Case A.1: dispatched step numbers are [2, 3]');

    assert.equal(result.completed, true, 'chain reports completed:true');
    ok('Case A.2: result.completed === true');

    const journal = ps.read(room);
    assert.equal(journal.chain_position, 2, 'durable journal ends at chain_position 2');
    ok('Case A.3: journal.chain_position === 2 after resume completes');

    assert.equal(journal.suggested_next, null, 'no further step suggested once the chain completes');
    ok('Case A.4: journal.suggested_next === null');

    return inputs; // handed to case B so it does not re-run the same setup
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case B: predecessor restore. The first RESUMED step (step 2, 'validate')
// must receive the journaled predecessor reference as `previous`, never
// null -- output_path 'a.md', restored_from 'journal', step_index 0 (the
// journal's chain_position at resume time).
// -----------------------------------------------------------------------
async function testPredecessorRestore() {
  const { room, cleanup } = makeScratchRoom('resume-b');
  try {
    ps.initChain(room, ['research', 'validate', 'research'], 'manual');
    fs.writeFileSync(path.join(room, 'a.md'), 'Synthetic predecessor output.\n');
    ps.recordStep(room, 'research', 'a.md');

    const calls = [];
    const inputs = [];
    await chainExecutor.runChain([
      { step: 1, command: 'research' },
      { step: 2, command: 'validate' },
      { step: 3, command: 'research' },
    ], {
      roomDir: room,
      journal: true,
      resume: true,
      gateFn: function () { return 'run'; },
      onStep: makeOnStep(calls, inputs),
    });

    const firstResumedInput = inputs[0];
    assert.ok(firstResumedInput && typeof firstResumedInput === 'object', 'first resumed step receives a predecessor object, not null');
    ok('Case B.1: previous argument for the first resumed step is an object, not null');

    assert.equal(firstResumedInput.output_path, 'a.md', 'restored predecessor output_path is a.md');
    ok('Case B.2: output_path === "a.md"');

    assert.equal(firstResumedInput.restored_from, 'journal', 'predecessor reference is tagged restored_from: journal');
    ok('Case B.3: restored_from === "journal"');

    assert.equal(firstResumedInput.step_index, 0, 'predecessor step_index is the journal chain_position at resume time (0)');
    ok('Case B.4: step_index === 0');
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case C: mismatch. The journal was initialized for a DIFFERENT chain
// (research, validate) than the one being resumed (diagnose, validate).
// The executor must refuse to guess and halt named, dispatching nothing.
// -----------------------------------------------------------------------
async function testMismatchHalt() {
  const { room, cleanup } = makeScratchRoom('resume-c');
  try {
    ps.initChain(room, ['research', 'validate'], 'manual');
    ps.recordStep(room, 'research', 'a.md');

    const calls = [];
    const inputs = [];
    const result = await chainExecutor.runChain([
      { step: 1, command: 'diagnose' },
      { step: 2, command: 'validate' },
    ], {
      roomDir: room,
      journal: true,
      resume: true,
      gateFn: function () { return 'run'; },
      onStep: makeOnStep(calls, inputs),
    });

    assert.deepStrictEqual(calls, [], 'no step dispatched when the journal disagrees with the resumed list');
    ok('Case C.1: zero steps dispatched on a mismatched journal');

    assert.equal(result.completed, false, 'a mismatched journal never reports completed:true');
    ok('Case C.2: result.completed === false');

    assert.ok(result.haltedAt && result.haltedAt.reason === 'resume_journal_mismatch', 'halt reason is resume_journal_mismatch');
    ok('Case C.3: haltedAt.reason === "resume_journal_mismatch"');
  } finally {
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case D: completion agreement. The journal chain agrees with the resumed
// list (so _computeResumePlan's agreement check passes), but the executor's
// own recordStep call is monkeypatched to a no-op for THIS case only, so
// the durable journal's chain_position never reaches the last index even
// though the executor's local loop believes every step ran. The executor
// must not report completed:true when its own journal disagrees.
// -----------------------------------------------------------------------
async function testCompletionAgreement() {
  const { room, cleanup } = makeScratchRoom('resume-d');
  const originalRecordStep = ps.recordStep;
  try {
    ps.initChain(room, ['research', 'validate'], 'manual');

    ps.recordStep = function noopRecordStep() {
      // Intentional no-op: the journal never advances past chain_position -1,
      // so the executor's own completion claim and the durable journal
      // disagree once the loop finishes.
      return ps.read(room);
    };

    const calls = [];
    const inputs = [];
    const result = await chainExecutor.runChain([
      { step: 1, command: 'research' },
      { step: 2, command: 'validate' },
    ], {
      roomDir: room,
      journal: true,
      resume: false,
      gateFn: function () { return 'run'; },
      onStep: makeOnStep(calls, inputs),
    });

    assert.equal(result.completed, false, 'executor refuses to report completed:true when the journal disagrees');
    ok('Case D.1: result.completed === false');

    assert.ok(result.haltedAt && result.haltedAt.reason === 'journal_disagreement', 'halt reason is journal_disagreement');
    ok('Case D.2: haltedAt.reason === "journal_disagreement"');
  } finally {
    ps.recordStep = originalRecordStep;
    cleanup();
  }
}

// -----------------------------------------------------------------------
// Case E: floor. A fresh chain, no journal file at all, resume:true. Every
// step dispatches once and the chain completes -- unchanged behavior for
// the no-journal case.
// -----------------------------------------------------------------------
async function testNoJournalFloor() {
  const { room, cleanup } = makeScratchRoom('resume-e');
  try {
    const calls = [];
    const inputs = [];
    const result = await chainExecutor.runChain([
      { step: 1, command: 'research' },
      { step: 2, command: 'validate' },
    ], {
      roomDir: room,
      journal: true,
      resume: true,
      gateFn: function () { return 'run'; },
      onStep: makeOnStep(calls, inputs),
    });

    assert.deepStrictEqual(calls, [1, 2], 'every step dispatches once when there is no journal to resume from');
    ok('Case E.1: dispatched step numbers are [1, 2] with no journal present');

    assert.equal(result.completed, true, 'chain completes normally with no journal to resume from');
    ok('Case E.2: result.completed === true');
  } finally {
    cleanup();
  }
}

(async () => {
  try {
    await testRepeatedCommandResume();
  } catch (e) { fail('Case A: repeated-command resume', e); }

  try {
    await testPredecessorRestore();
  } catch (e) { fail('Case B: predecessor restore', e); }

  try {
    await testMismatchHalt();
  } catch (e) { fail('Case C: mismatch halt', e); }

  try {
    await testCompletionAgreement();
  } catch (e) { fail('Case D: completion agreement', e); }

  try {
    await testNoJournalFloor();
  } catch (e) { fail('Case E: no-journal floor', e); }

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})();
