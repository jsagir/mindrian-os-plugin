#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-05 Task 3 -- test-345-producer-fires: pins lockstep place 7, the
 * un-gated ctx producer block in lib/core/navigation-engine.cjs's decide().
 *
 * WHY THIS IS THE HIGHEST-VALUE TEST IN THE PHASE (343-ICM-CONSULT.md's
 * binding correction, 345-RESEARCH Pitfall 1). Places 2 through 6 are all
 * gated by a build check or a test that fails loudly on omission. Place 7 is
 * gated by NOTHING: a sensor missing its producer block loads, registers,
 * ranks, and stamps, and returns null forever, with no error anywhere. A
 * unit test that calls sensorStrategyReach(...) directly (with a hand-built
 * ctx) PASSES with place 7 missing -- that is the exact failure this file
 * exists to catch. Every assertion below therefore calls decide(), never the
 * sensor. This file deliberately does NOT import sensorStrategyReach.
 *
 * ID CORRECTION: the strategy-reach sensor is SENS-20, not SENS-19 (SENS-19
 * was already claimed by Phase 343's sensorGraphIntegrity on this tree; see
 * docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md Section 6).
 *
 * WHAT decide() ACTUALLY RETURNS: trace.decision_trace.context_assembly.facts
 * is the one place a fired sensor reach survives decide()'s return value (Canon
 * Part 8 flattening -- each fact carries only { reach_id, posture, evidence,
 * first_seen, last_updated }, never the sensor's raw `dispatch` string), same
 * precedent as tests/test-343-sensor-registration.cjs's own findContradictionFact
 * helper.
 *
 * A FEW BEHAVIOR-BLOCK CLAIMS ARE NOT OBSERVABLE THROUGH decide()'s BLACK BOX
 * (sensorCtx itself is a function-local object inside decide(), never exposed
 * on the return value or on any module export). Where that is true, this file
 * says so and falls back to a static source-content assertion against
 * lib/core/navigation-engine.cjs -- the same class of check
 * tests/test-343-sensor-registration.cjs already uses (its own detectorSource
 * regex arm) -- rather than silently skipping the claim. Every such fallback
 * is called out inline.
 *
 * Fixture rooms are built fresh per leg with lib/core/room-db.cjs::openRoomDb
 * (the real production schema + migrations) under os.tmpdir(); the user's
 * real rooms directory is never touched. If node:sqlite is unavailable in the
 * execution environment, openRoomDb's own require throws at module load, so
 * the fixture leg below is wrapped and SKIPS with a printed reason -- the
 * no-db leg still runs unconditionally and still pins place 7 (a missing
 * producer block means sensorCtx.reachesSinceLastProposal is never assigned
 * at all, even from the override).
 *
 * Bare node script, no framework, exits non-zero on any assertion failure,
 * self-contained. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ENGINE_PATH = path.join(REPO, 'lib', 'core', 'navigation-engine.cjs');

const engine = require(ENGINE_PATH);
const jtbdState = require(path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs'));
const goalCadence = require(path.join(REPO, 'lib', 'core', 'strategy', 'goal-cadence.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
let skipped = 0;
function skip(label, reason) {
  skipped += 1;
  console.log('  SKIP - ' + label + ' (' + reason + ')');
}

console.log('test-345-producer-fires:');

// ---------------------------------------------------------------------------
// Fixture scaffolding.
// ---------------------------------------------------------------------------
function freshRoomDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function ratifiedGoalRoom(prefix) {
  const roomDir = freshRoomDir(prefix);
  jtbdState.setGoal(roomDir, { jtbd: 'validate-idea', rung: 'IllDefined', set_by: 'gate_answer' });
  return roomDir;
}

function findContradictionFacts(decision) {
  const facts = decision
    && decision.decision_trace
    && decision.decision_trace.context_assembly
    && Array.isArray(decision.decision_trace.context_assembly.facts)
    ? decision.decision_trace.context_assembly.facts
    : [];
  return facts.filter((f) => f && f.reach_id === 'contradiction');
}

function sens20Facts(decision) {
  return findContradictionFacts(decision).filter((f) => f.evidence && f.evidence.sensor_id === 'SENS-20');
}

// ---------------------------------------------------------------------------
// Leg 1: decide() with NO ctx.roomDb and NO roomDir must never throw, and
// must produce no SENS-20-stamped reach (there is nothing to re-aim: no
// roomDir means the sensor's own first refusal branch fires).
// ---------------------------------------------------------------------------
{
  let decision;
  assert.doesNotThrow(() => {
    decision = engine.decide({ text: 'anything' }, {});
  }, 'decide() with no ctx.roomDb and no roomDir must never throw');
  const hits = sens20Facts(decision);
  assert.strictEqual(hits.length, 0, 'no roomDir must never produce a SENS-20 reach');
  ok('NO ROOMDIR, NO DB: decide() never throws and produces no SENS-20 reach');
}

// ---------------------------------------------------------------------------
// Leg 2 (the test seam): decide() with NO ctx.roomDb but a caller-threaded
// ctx.reachesSinceLastProposal above the cadence threshold, against a room
// with a ratified goal, fires the SENS-20-stamped contradiction reach. This
// is the leg that PINS place 7 even when node:sqlite is unavailable for the
// fixture leg below: without the producer block, sensorCtx.
// reachesSinceLastProposal is never assigned from ctx AT ALL (there is no
// code path that copies it), so this leg fails just as hard as the fixture
// leg does when place 7 is missing.
// ---------------------------------------------------------------------------
{
  const roomDir = ratifiedGoalRoom('mos-test-345-producer-nodb-');
  try {
    const decision = engine.decide(
      { text: 'anything' },
      {
        roomDir: roomDir,
        reachesSinceLastProposal: goalCadence.STRATEGY_CADENCE_REACHES,
        claimsSinceLastProposal: 0,
        promotionsSinceLastProposal: 0,
        artifactsSinceLastProposal: 0,
      }
    );
    const hits = sens20Facts(decision);
    assert.strictEqual(hits.length, 1, 'exactly one SENS-20-stamped contradiction reach must fire via the ctx override: ' + JSON.stringify(hits));
    assert.strictEqual(hits[0].reach_id, 'contradiction');
    assert.strictEqual(hits[0].posture, 'pull_back');
    ok('NO DB, CTX OVERRIDE: decide() with a caller-threaded reachesSinceLastProposal fires the SENS-20-stamped reach without reading a database');
  } finally {
    try { fs.rmSync(path.dirname(roomDir), { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

// ---------------------------------------------------------------------------
// Leg 3 (the fixture leg, guarded on node:sqlite): a seeded room.db whose
// reach_presented count crosses STRATEGY_CADENCE_REACHES, threaded as
// ctx.roomDb, fires the SENS-20-stamped reach through the FULL producer ->
// sensor -> dispatch pipeline, no ctx overrides at all.
// ---------------------------------------------------------------------------
let roomDbModule = null;
let navigationModule = null;
try {
  roomDbModule = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  navigationModule = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
} catch (_e) {
  roomDbModule = null;
}

if (!roomDbModule || typeof roomDbModule.openRoomDb !== 'function') {
  skip('ABOVE THRESHOLD (real room.db fixture)', 'node:sqlite (or lib/core/room-db.cjs) unavailable in this environment');
} else {
  const tmp = freshRoomDir('mos-test-345-producer-above-');
  let db = null;
  try {
    const roomDir = path.join(tmp, 'room');
    fs.mkdirSync(roomDir, { recursive: true });
    jtbdState.setGoal(roomDir, { jtbd: 'validate-idea', rung: 'IllDefined', set_by: 'gate_answer' });
    db = roomDbModule.openRoomDb(roomDir);
    for (let i = 0; i < goalCadence.STRATEGY_CADENCE_REACHES; i += 1) {
      const res = navigationModule.logMemoryEvent(db, 'reach_presented', { source_path: 'test:fixture' });
      assert.ok(res && res.ok === true, 'seeding a reach_presented row must succeed: ' + JSON.stringify(res));
    }
    const decision = engine.decide({ text: 'anything' }, { roomDb: db, roomDir: roomDir });
    const hits = sens20Facts(decision);
    assert.strictEqual(hits.length, 1, 'exactly one SENS-20-stamped contradiction reach must fire end to end: ' + JSON.stringify(hits));
    assert.strictEqual(hits[0].reach_id, 'contradiction');
    assert.strictEqual(hits[0].posture, 'pull_back');
    assert.ok(hits[0].evidence.reaches_since >= goalCadence.STRATEGY_CADENCE_REACHES, 'evidence must carry the measured reach count');
    assert.strictEqual(hits[0].evidence.signal, undefined, 'evidence has no "signal" key (signal rides the reach top-level, not evidence)');
    ok('ABOVE THRESHOLD: decide() with a seeded room.db handle fires exactly one SENS-20-stamped contradiction reach, full pipeline, zero ctx overrides');

    // ---- BELOW THRESHOLD, same handle family: no reach. ----
    const tmp2 = freshRoomDir('mos-test-345-producer-below-');
    let db2 = null;
    try {
      const roomDir2 = path.join(tmp2, 'room');
      fs.mkdirSync(roomDir2, { recursive: true });
      jtbdState.setGoal(roomDir2, { jtbd: 'validate-idea', rung: 'IllDefined', set_by: 'gate_answer' });
      db2 = roomDbModule.openRoomDb(roomDir2);
      navigationModule.logMemoryEvent(db2, 'reach_presented', { source_path: 'test:fixture' });
      const decision2 = engine.decide({ text: 'anything' }, { roomDb: db2, roomDir: roomDir2 });
      const hits2 = sens20Facts(decision2);
      assert.strictEqual(hits2.length, 0, 'a below-threshold room must never produce a SENS-20 reach');
      ok('BELOW THRESHOLD: decide() with a seeded room.db handle under the count produces no SENS-20 reach');
    } finally {
      if (db2) { try { roomDbModule.closeRoomDb(db2); } catch (_e) { /* ignore */ } }
      try { fs.rmSync(tmp2, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    }

    // ---- PRODUCER-BLOCK FAULT: a handle whose prepare() throws degrades to
    // no strategy signal; decide() still returns its normal result. ----
    const throwingHandle = { prepare: function () { throw new Error('boom: simulated prepare failure'); } };
    let decision3;
    assert.doesNotThrow(() => {
      decision3 = engine.decide({ text: 'anything' }, { roomDb: throwingHandle, roomDir: roomDir });
    }, 'decide() must never throw when ctx.roomDb.prepare throws');
    assert.ok(decision3 && decision3.decision_trace, 'decide() must still return its normal result shape on a producer-block fault');
    const hits3 = sens20Facts(decision3);
    assert.strictEqual(hits3.length, 0, 'a throwing handle must degrade to no strategy signal (reaches_since falls back to 0, below the floor)');
    ok('PRODUCER-BLOCK FAULT: a handle whose prepare() throws degrades to no strategy signal; decide() still returns its normal result');
  } finally {
    if (db) { try { roomDbModule.closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Static source-content assertions, for the behavior-block claims that are
// NOT observable through decide()'s public return shape (sensorCtx itself is
// never exposed). This mirrors test-343-sensor-registration.cjs's own
// detectorSource regex arm, applied here to the producer block instead of a
// detector file.
// ---------------------------------------------------------------------------
const engineSource = fs.readFileSync(ENGINE_PATH, 'utf8');

assert.match(engineSource, /Phase 345 producer \(SENS-20\)/, 'the producer block must carry a Phase 345 producer (SENS-20) header comment');
ok('the SENS-20 producer block is present, headed and identifiable in navigation-engine.cjs');

assert.match(
  engineSource,
  /The db read runs HERE \(ctx-assembly\), NEVER\s*[\s\S]*?inside the pure sensor \(Part 8\/9\)/,
  'the producer block must restate the ctx-assembly split verbatim'
);
ok('the producer block restates the ctx-assembly split verbatim (Part 8/9)');

const reachesOccurrences = (engineSource.match(/reachesSinceLastProposal/g) || []).length;
assert.ok(reachesOccurrences >= 2, 'grep -c reachesSinceLastProposal must be at least 2, got ' + reachesOccurrences);
ok('reachesSinceLastProposal appears at least twice in navigation-engine.cjs (' + reachesOccurrences + ' occurrences)');

const stallOccurrences = (engineSource.match(/strategyStallCount/g) || []).length;
assert.ok(stallOccurrences >= 2, 'grep -c strategyStallCount must be at least 2, got ' + stallOccurrences);
ok('strategyStallCount appears at least twice in navigation-engine.cjs (' + stallOccurrences + ' occurrences)');

// The null-preservation guard shape: the strategyStallCount assignment must
// read a caller override typeof-guarded to 'number', falling back to a LOCAL
// that defaults to null, never to 0 -- coercing to 0 would assert "measured,
// zero stall" for a quantity nothing computed, exactly the AP-G1 anti-pattern
// 345-ICM-CONSULT names for a different field. This is checked by pattern,
// not by a runtime read, because sensorCtx.strategyStallCount is never
// exposed outside decide()'s own closure.
assert.match(
  engineSource,
  /strategyStallCount\s*=\s*\n?\s*typeof ctx\.strategyStallCount === 'number' \? ctx\.strategyStallCount : \w*[Ss]tall\w*/,
  "the strategyStallCount guard must preserve a non-coerced fallback (typeof-guarded to 'number', never defaulting to 0)"
);
ok('the strategyStallCount guard shape preserves null rather than coercing to 0 on no signal (static source check)');

assert.match(
  engineSource,
  /if \(!Array\.isArray\(sensorCtx\.strategyEvidenceCandidates\)\) sensorCtx\.strategyEvidenceCandidates = \[\];/,
  'sensorCtx.strategyEvidenceCandidates must always be normalized to an array'
);
ok('sensorCtx.strategyEvidenceCandidates is unconditionally normalized to an array (static source check)');

console.log('');
console.log('Checks: ' + checks + '  Skipped: ' + skipped);
console.log('PASS test-345-producer-fires.cjs');
