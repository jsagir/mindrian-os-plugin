#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-02 -- the ratified goal record round trip, its survival across
 * every unattended writer in lib/hmi/jtbd-state.cjs, legacy-file and
 * no-file behavior, version monotonicity, bounded goal_history, and the
 * structural proof that a room's parent question has no outbound path
 * (Canon Part 8).
 *
 * STRAT-01, STRAT-02 (345-ICM-CONSULT R1, 345-RESEARCH Pitfall 4).
 *
 * Fixture discipline (344-05-PLAN.md): every fixture is a fresh
 * os.tmpdir() directory, never a real user room directory. This module
 * never reads MINDRIAN_ROOMS_HOME; a fixture room dir is handed straight
 * to the module under test as roomDir.
 *
 * Plain-node house style: hand-rolled ok(label, cond) helper, a failing
 * assertion prints "FAIL: <label>" and the run exits 1. Zero-dep: node
 * built-ins only. CJS. NO em-dashes.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs');

let checks = 0;
let failed = 0;

function ok(label, cond) {
  checks++;
  if (!cond) {
    failed++;
    console.log('FAIL: ' + label);
  } else {
    console.log('ok: ' + label);
  }
}

function mkFixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-345-goal-record-'));
}

// A fresh require per fixture is unnecessary (the module holds no
// in-process state keyed by roomDir), but we require it once, up front, so
// a MODULE_NOT_FOUND or a throw-on-load surfaces as a single clear failure
// rather than one per leg.
const jtbdState = require(MODULE_PATH);

// ---------------------------------------------------------------------------
// Leg group 1: no-file and legacy-file behavior.
// ---------------------------------------------------------------------------
console.log('--- Leg group 1: no-file and legacy-file behavior ---');

{
  const dir = mkFixture();
  let threw = false;
  let result;
  try {
    result = jtbdState.getGoal(dir);
  } catch (e) {
    threw = true;
  }
  ok('getGoal on a room with no state file does not throw', threw === false);
  ok('getGoal on a room with no state file returns null', result === null);
}

{
  const dir = mkFixture();
  jtbdState.setCurrent(dir, { jtbd: 'explore', trigger: 'user_message' });
  const result = jtbdState.getGoal(dir);
  ok('getGoal on a legacy file (current + history, no goal) returns null', result === null);
}

// ---------------------------------------------------------------------------
// Leg group 2: setGoal / getGoal round trip.
// ---------------------------------------------------------------------------
console.log('--- Leg group 2: setGoal / getGoal round trip ---');

{
  const dir = mkFixture();
  const written = jtbdState.setGoal(dir, {
    jtbd: 'ship the strategy node',
    parent_question: 'what is the future of the venture',
    rung: 'IllDefined',
    set_by: 'gate_answer',
  });
  ok('setGoal returns a non-null object on valid input', written && typeof written === 'object');
  ok('setGoal result carries jtbd', written && written.jtbd === 'ship the strategy node');
  ok('setGoal result carries parent_question', written && written.parent_question === 'what is the future of the venture');
  ok('setGoal result carries rung', written && written.rung === 'IllDefined');
  ok('setGoal result carries set_by', written && written.set_by === 'gate_answer');
  ok('setGoal result goal_version is 1 on first write', written && written.goal_version === 1);
  ok('setGoal result set_at is a parseable ISO string',
    written && typeof written.set_at === 'string' && !Number.isNaN(Date.parse(written.set_at)));

  const read = jtbdState.getGoal(dir);
  ok('getGoal after setGoal deep-equals the setGoal return value',
    JSON.stringify(read) === JSON.stringify(written));
}

// ---------------------------------------------------------------------------
// Leg group 3: setGoal refusals (write nothing, byte-identical file).
// ---------------------------------------------------------------------------
console.log('--- Leg group 3: setGoal refusals ---');

{
  const dir = mkFixture();
  jtbdState.setGoal(dir, { jtbd: 'baseline goal', rung: 'IllDefined' });
  const statePath = path.join(dir, '.mindrian', 'jtbd-state.json');
  const before = fs.readFileSync(statePath, 'utf8');

  const refusedLadderRung = jtbdState.setGoal(dir, { jtbd: 'explore', rung: 'ill-defined' });
  ok('setGoal refuses the WIRE-vocabulary (lowercase ladder) rung form',
    refusedLadderRung === null);
  const afterLadder = fs.readFileSync(statePath, 'utf8');
  ok('file is byte-identical after a refused-rung setGoal call', before === afterLadder);

  const refusedEmptyJtbd = jtbdState.setGoal(dir, { jtbd: '', rung: 'IllDefined' });
  ok('setGoal refuses an empty jtbd', refusedEmptyJtbd === null);
  const afterEmpty = fs.readFileSync(statePath, 'utf8');
  ok('file is byte-identical after a refused-empty-jtbd setGoal call', before === afterEmpty);

  const refusedMissingJtbd = jtbdState.setGoal(dir, { rung: 'IllDefined' });
  ok('setGoal refuses a missing jtbd', refusedMissingJtbd === null);
  const afterMissing = fs.readFileSync(statePath, 'utf8');
  ok('file is byte-identical after a refused-missing-jtbd setGoal call', before === afterMissing);

  const refusedBadOpts = jtbdState.setGoal(dir, null);
  ok('setGoal refuses a non-object opts', refusedBadOpts === null);
}

// ---------------------------------------------------------------------------
// Leg group 4: preservation across all three unattended writers. Whole-object
// JSON.stringify comparisons, not field spot checks: the failure this guards
// against is a WHOLE-OBJECT discard (345-ICM-CONSULT R1).
// ---------------------------------------------------------------------------
console.log('--- Leg group 4: preservation across all three unattended writers ---');

{
  const dir = mkFixture();
  const ratified = jtbdState.setGoal(dir, {
    jtbd: 'climb the ladder',
    parent_question: 'what should we build next',
    rung: 'WellDefined',
    set_by: 'gate_answer',
  });
  const before = JSON.stringify(ratified);

  jtbdState.setCurrent(dir, { jtbd: 'other-topic', trigger: 'user_message' });
  ok('preserved across setCurrent', JSON.stringify(jtbdState.getGoal(dir)) === before);

  jtbdState.bumpTurnCount(dir, 'other-topic');
  ok('preserved across bumpTurnCount', JSON.stringify(jtbdState.getGoal(dir)) === before);

  jtbdState.clear(dir);
  ok('preserved across clear', JSON.stringify(jtbdState.getGoal(dir)) === before);
  ok('getCurrent is null after clear', jtbdState.getCurrent(dir) === null);
}

// ---------------------------------------------------------------------------
// Leg group 5: SCHEMA_VERSION and on-disk key order.
// ---------------------------------------------------------------------------
console.log('--- Leg group 5: SCHEMA_VERSION and on-disk key order ---');

{
  const dir = mkFixture();
  ok('SCHEMA_VERSION is 1 before any goal write', jtbdState.SCHEMA_VERSION === 1);
  jtbdState.setGoal(dir, { jtbd: 'a goal', rung: 'Wicked' });
  jtbdState.setCurrent(dir, { jtbd: 'a-topic', trigger: 'user_message' });
  jtbdState.bumpTurnCount(dir, 'a-topic');
  jtbdState.clear(dir);
  ok('SCHEMA_VERSION is still 1 after every writer has run', jtbdState.SCHEMA_VERSION === 1);

  const statePath = path.join(dir, '.mindrian', 'jtbd-state.json');
  const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const keys = Object.keys(raw);
  ok('on-disk key order',
    JSON.stringify(keys) === JSON.stringify(['version', 'current', 'history', 'goal', 'goal_history']));
}

// ---------------------------------------------------------------------------
// Leg group 6: corrupt / malformed fixtures.
// ---------------------------------------------------------------------------
console.log('--- Leg group 6: corrupt and malformed fixtures ---');

{
  const dir = mkFixture();
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.mindrian', 'jtbd-state.json'), '{not json', 'utf8');
  let threw = false;
  let result;
  try {
    result = jtbdState.getGoal(dir);
  } catch (e) {
    threw = true;
  }
  ok('getGoal on corrupt JSON does not throw', threw === false);
  ok('getGoal on corrupt JSON returns null', result === null);
}

{
  const dir = mkFixture();
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.mindrian', 'jtbd-state.json'),
    JSON.stringify({ version: 1, current: null, history: [], goal: 'not-an-object' }),
    'utf8'
  );
  const result = jtbdState.getGoal(dir);
  ok('getGoal on a goal key that is a string (not an object) returns null', result === null);
}

// ---------------------------------------------------------------------------
// Leg group 7: version monotonicity and goal_history rows.
// ---------------------------------------------------------------------------
console.log('--- Leg group 7: version monotonicity and goal_history ---');

{
  const dir = mkFixture();
  const first = jtbdState.setGoal(dir, { jtbd: 'first goal', rung: 'UnDefined' });
  const second = jtbdState.setGoal(dir, { jtbd: 'second goal', rung: 'WellDefined' });
  ok('first setGoal call yields goal_version 1', first && first.goal_version === 1);
  ok('second setGoal call yields goal_version 2', second && second.goal_version === 2);

  const gh = jtbdState.goalHistory(dir);
  ok('goalHistory has length 2 after two setGoal calls', gh.length === 2);
  ok('second history row from equals first row to', gh[1] && gh[0] && gh[1].from === gh[0].to);
}

// ---------------------------------------------------------------------------
// Leg group 8: GOAL_HISTORY_MAX bound.
// ---------------------------------------------------------------------------
console.log('--- Leg group 8: GOAL_HISTORY_MAX bound ---');

{
  const dir = mkFixture();
  for (let i = 0; i < 51; i++) {
    jtbdState.setGoal(dir, { jtbd: 'goal-' + i, rung: 'IllDefined' });
  }
  const gh = jtbdState.goalHistory(dir, 100);
  ok('GOAL_HISTORY_MAX is 50', jtbdState.GOAL_HISTORY_MAX === 50);
  ok('51 consecutive setGoal calls leave goalHistory at exactly GOAL_HISTORY_MAX rows, oldest dropped',
    gh.length === jtbdState.GOAL_HISTORY_MAX);
  ok('the oldest surviving row is not goal-0 (it was dropped)',
    gh[0] && gh[0].to !== 'goal-0');
  ok('the newest row is the last goal written', gh[gh.length - 1] && gh[gh.length - 1].to === 'goal-50');
}

// ---------------------------------------------------------------------------
// Leg group 9: room-prose has no outbound path (structural grep).
// ---------------------------------------------------------------------------
console.log('--- Leg group 9: no outbound path for parent_question ---');

{
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  ok('module does not reference logMemoryEvent', src.indexOf('logMemoryEvent') === -1);
  ok('module does not reference callTool', src.indexOf('callTool') === -1);
  ok('module does not reference makeReach', src.indexOf('makeReach') === -1);
  ok('module does not require better-sqlite3', src.indexOf("require('better-sqlite3')") === -1);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log('======================================');
console.log('Checks: ' + checks + '  Failed: ' + failed);
console.log('======================================');

if (failed > 0) {
  process.exit(1);
}
