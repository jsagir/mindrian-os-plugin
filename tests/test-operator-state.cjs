#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-01 -- conversation operator state machine validation suite
 * ===================================================================
 * 12 scenarios covering the dimensions called out in 99-RESEARCH.md
 * "Validation Architecture":
 *
 *   1.  Cold-start default (D-04)
 *   2.  Resume from disk (D-05, D-06)
 *   3.  Schema versioning (D-06) -- schema_version is FIRST top-level key
 *   4.  Valid transitions (D-08)
 *   5.  Invalid transitions rejected without partial write (D-09)
 *   6.  DECISION_GATE -> previous (D-08)
 *   7.  History bounded at 50 with drop-oldest (D-26)
 *   8.  Atomic write rollback (D-07)
 *   9.  Frame budget (D-23, D-24)
 *  10.  Canon Part 8 grep audit (D-22)
 *  11.  Graph edge graceful skip when DB absent
 *  12.  Graph edge written when graph exists (OPERATOR_TRANSITION + properties)
 *
 * Self-contained: every test copies fixtures to os.tmpdir() so the
 * committed fixtures are never mutated. Cleanup runs in finally.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const FIXTURES = path.join(REPO, 'test', 'fixtures', 'conversation-operator');
const OPERATOR_SRC = path.join(REPO, 'lib', 'conversation', 'operator.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ✓ Scenario ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL Scenario ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function makeTmpRoom(label) {
  const base = path.join(os.tmpdir(), 'phase-99-01-' + label + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Recursively copy a fixture seed-room into a tmp directory.
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

// Phase 129-03: the OPERATOR_TRANSITION edge now writes through navigation.cjs
// into the CANONICAL .mindrian/room.db (not the retired .room-graph/room.db
// bypass target). Seed the canonical room.db via the openRoomDb chokepoint so
// the Phase-109 provenance schema is present for the edge FK.
function setupCanonicalGraph(roomDir) {
  const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
}

function freshRequireOperator() {
  // Drop module cache so that each test gets a clean require() result.
  delete require.cache[require.resolve(OPERATOR_SRC)];
  return require(OPERATOR_SRC);
}

// ------------------------------------------------------------------
// Scenario 1: Cold-start default
// ------------------------------------------------------------------
(function s1() {
  const label = '1: cold-start default (JUST_TALK, no file write)';
  const tmp = makeTmpRoom('cs');
  try {
    copyDir(path.join(FIXTURES, 'seed-room'), tmp);
    const op = freshRequireOperator();
    const state = op.getCurrent(tmp);
    assert.equal(state.current, 'JUST_TALK', 'cold-start current must be JUST_TALK');
    assert.equal(state.previous, null, 'cold-start previous must be null');
    assert.equal(state.history.length, 0, 'cold-start history must be empty');
    assert.equal(state.schema_version, '1.0.0', 'cold-start schema_version must be 1.0.0');
    const filePath = path.join(tmp, '.mindrian', 'conversation-operator.json');
    assert.equal(fs.existsSync(filePath), false, 'cold-start MUST NOT auto-write the state file');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 2: Resume from disk
// ------------------------------------------------------------------
(function s2() {
  const label = '2: resume from disk (BUILD_ROOM, 3 history entries)';
  const tmp = makeTmpRoom('resume');
  try {
    copyDir(path.join(FIXTURES, 'seed-room-resume'), tmp);
    const op = freshRequireOperator();
    const state = op.getCurrent(tmp);
    assert.equal(state.current, 'BUILD_ROOM', 'resume current must be BUILD_ROOM');
    assert.equal(state.previous, 'EXPLORE_CAPTURE', 'resume previous must be EXPLORE_CAPTURE');
    assert.equal(state.history.length, 3, 'resume history must have 3 entries');
    assert.equal(state.context.active_section, 'research', 'resume context.active_section must be research');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 3: Schema versioning -- schema_version is FIRST key on disk
// ------------------------------------------------------------------
(function s3() {
  const label = '3: schema_version is first top-level key on every write';
  const tmp = makeTmpRoom('schema');
  try {
    copyDir(path.join(FIXTURES, 'seed-room-resume'), tmp);
    const op = freshRequireOperator();
    // Force a transition (BUILD_ROOM -> METHODOLOGY).
    const r = op.transition(tmp, 'METHODOLOGY', 'mos_command', { methodology_in_flight: 'mos:explore-domains' });
    assert.equal(r.success, true, 'transition must succeed');
    const filePath = path.join(tmp, '.mindrian', 'conversation-operator.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    // First top-level key after the leading `{` must be schema_version.
    // We allow whitespace + newline between `{` and `"schema_version"`.
    const m = raw.match(/^\s*\{\s*"([^"]+)"/);
    assert.ok(m, 'top-level JSON object must start with a quoted key');
    assert.equal(m[1], 'schema_version', 'first top-level key must be schema_version (D-06), got ' + m[1]);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.schema_version, '1.0.0', 'schema_version value must be 1.0.0');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 4: Valid transition (BUILD_ROOM -> METHODOLOGY)
// ------------------------------------------------------------------
(function s4() {
  const label = '4: valid transition BUILD_ROOM -> METHODOLOGY (D-08)';
  const tmp = makeTmpRoom('valid');
  try {
    copyDir(path.join(FIXTURES, 'seed-room-resume'), tmp);
    const op = freshRequireOperator();
    const r = op.transition(tmp, 'METHODOLOGY', 'mos_command', { methodology_in_flight: 'mos:explore-domains' });
    assert.equal(r.success, true, 'valid transition must succeed');
    assert.equal(r.current, 'METHODOLOGY', 'next current must be METHODOLOGY');
    assert.equal(r.previous, 'BUILD_ROOM', 'next previous must be BUILD_ROOM');
    const reread = op.getCurrent(tmp);
    assert.equal(reread.current, 'METHODOLOGY', 'on-disk current must be METHODOLOGY after transition');
    assert.equal(reread.history.length, 4, 'history must grow to 4 entries');
    assert.equal(reread.context.methodology_in_flight, 'mos:explore-domains', 'contextDelta must be merged into context');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 5: Invalid transition rejected; file unchanged byte-for-byte
// ------------------------------------------------------------------
(function s5() {
  const label = '5: invalid transition rejected; no partial write (D-09)';
  const tmp = makeTmpRoom('invalid');
  try {
    // Write a JUST_TALK base state to disk first.
    const op = freshRequireOperator();
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    const baseline = {
      schema_version: '1.0.0',
      current: 'JUST_TALK',
      previous: null,
      entered_at: '2026-05-01T10:30:00.000Z',
      context: { active_room: path.basename(tmp), active_section: null, methodology_in_flight: null, decision_gate_pending: null },
      history: [{ op: 'JUST_TALK', from: null, to: 'JUST_TALK', trigger: 'session_start', ts: '2026-05-01T10:30:00.000Z' }],
    };
    const filePath = path.join(tmp, '.mindrian', 'conversation-operator.json');
    fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2), 'utf8');
    const before = fs.readFileSync(filePath);

    // Attempt JUST_TALK -> METHODOLOGY (no rule matches via user_message)
    const r = op.transition(tmp, 'METHODOLOGY', 'user_message', {});
    assert.equal(r.success, false, 'invalid transition must fail');
    assert.ok(Array.isArray(r.violations) && r.violations.length >= 1, 'violations must be a non-empty array');
    assert.equal(r.violations[0].category, 'transition', 'violation.category must be transition');

    // File MUST be unchanged byte-for-byte.
    const after = fs.readFileSync(filePath);
    assert.ok(before.equals(after), 'state file must be byte-identical after rejected transition');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 6: DECISION_GATE -> previous (D-08)
// ------------------------------------------------------------------
(function s6() {
  const label = '6: DECISION_GATE -> previous restores prior operator';
  const tmp = makeTmpRoom('dgprev');
  try {
    const op = freshRequireOperator();
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    const baseline = {
      schema_version: '1.0.0',
      current: 'DECISION_GATE',
      previous: 'BUILD_ROOM',
      entered_at: '2026-05-01T10:42:00.000Z',
      context: { active_room: path.basename(tmp), active_section: 'research', methodology_in_flight: null, decision_gate_pending: 'F.1' },
      history: [{ op: 'DECISION_GATE', from: 'BUILD_ROOM', to: 'DECISION_GATE', trigger: 'mos_command', ts: '2026-05-01T10:42:00.000Z' }],
    };
    fs.writeFileSync(path.join(tmp, '.mindrian', 'conversation-operator.json'), JSON.stringify(baseline, null, 2));

    const r = op.transition(tmp, 'previous', 'user_message');
    assert.equal(r.success, true, 'DECISION_GATE -> previous must succeed');
    assert.equal(r.current, 'BUILD_ROOM', 'resolved current must be BUILD_ROOM (== previous)');
    assert.equal(r.previous, 'DECISION_GATE', 'previous must roll forward to DECISION_GATE');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 7: History bounded at 50 with drop-oldest (D-26)
// ------------------------------------------------------------------
(function s7() {
  const label = '7: history bounded at 50 with drop-oldest';
  const tmp = makeTmpRoom('hist');
  try {
    const op = freshRequireOperator();
    // Generate 60 valid transitions by alternating BUILD_ROOM <-> METHODOLOGY
    // starting from a known BUILD_ROOM baseline.
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    const baseline = {
      schema_version: '1.0.0',
      current: 'BUILD_ROOM',
      previous: 'EXPLORE_CAPTURE',
      entered_at: '2026-05-01T10:42:00.000Z',
      context: { active_room: path.basename(tmp), active_section: null, methodology_in_flight: null, decision_gate_pending: null },
      history: [],
    };
    fs.writeFileSync(path.join(tmp, '.mindrian', 'conversation-operator.json'), JSON.stringify(baseline, null, 2));

    // Transition 1: BUILD_ROOM -> METHODOLOGY
    // Transition 2: METHODOLOGY -> BUILD_ROOM
    // ...repeat to 60.
    for (let i = 0; i < 60; i += 1) {
      const target = (i % 2 === 0) ? 'METHODOLOGY' : 'BUILD_ROOM';
      const r = op.transition(tmp, target, 'mos_command', { iter: i });
      assert.equal(r.success, true, 'transition ' + i + ' must succeed');
    }
    const final = op.getCurrent(tmp);
    assert.equal(final.history.length, 50, 'history must be bounded at 50, got ' + final.history.length);
    // Oldest 10 entries dropped -> first remaining entry should be iter=10
    // (the 11th transition; 0-indexed iter from above).
    const firstEntry = final.history[0];
    // The transitions write history entries; entry contains trigger ts but
    // NOT iter (contextDelta merges into context, not into history). We verify
    // drop-oldest by checking the count and that history[0] is the
    // 11th-emitted transition's payload (iter 10 -> from BUILD_ROOM to METHODOLOGY).
    // Iter pattern: even i goes to METHODOLOGY, odd i goes to BUILD_ROOM.
    // iter 10 (even) -> from BUILD_ROOM to METHODOLOGY
    assert.equal(firstEntry.to, 'METHODOLOGY', 'history[0].to should match the 11th transition (iter 10 even -> METHODOLOGY)');
    assert.equal(firstEntry.from, 'BUILD_ROOM', 'history[0].from should be BUILD_ROOM');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 8: Atomic write rollback when rename throws
// ------------------------------------------------------------------
(function s8() {
  const label = '8: atomic write rollback (rename throws -> file unchanged)';
  const tmp = makeTmpRoom('atomic');
  try {
    const op = freshRequireOperator();
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    const baseline = {
      schema_version: '1.0.0',
      current: 'BUILD_ROOM',
      previous: 'EXPLORE_CAPTURE',
      entered_at: '2026-05-01T10:42:00.000Z',
      context: { active_room: path.basename(tmp), active_section: null, methodology_in_flight: null, decision_gate_pending: null },
      history: [],
    };
    const filePath = path.join(tmp, '.mindrian', 'conversation-operator.json');
    fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2));
    const before = fs.readFileSync(filePath);

    // Monkey-patch fs.renameSync to throw on the next call (the operator
    // uses fs.renameSync via its own fs require -- but require returns the
    // same fs singleton, so the patch applies).
    const orig = fs.renameSync;
    let threw = false;
    fs.renameSync = function () {
      threw = true;
      throw new Error('synthetic rename failure');
    };
    let r;
    try {
      r = op.transition(tmp, 'METHODOLOGY', 'mos_command', {});
    } finally {
      fs.renameSync = orig;
    }
    assert.equal(threw, true, 'monkey-patched rename must have thrown');
    assert.equal(r.success, false, 'transition must report failure when rename throws');
    assert.equal(r.violations[0].category, 'io', 'violation category must be "io"');

    // File MUST be byte-identical to before the call.
    const after = fs.readFileSync(filePath);
    assert.ok(before.equals(after), 'state file must be byte-identical after failed atomic write');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 9: Frame budget (getCurrent < 2ms mean; transition < 10ms mean)
// ------------------------------------------------------------------
(function s9() {
  const label = '9: frame budget (getCurrent < 2ms; transition < 10ms)';
  const tmp = makeTmpRoom('frame');
  try {
    copyDir(path.join(FIXTURES, 'seed-room-resume'), tmp);
    const op = freshRequireOperator();

    // Warm read
    op.getCurrent(tmp);

    const READS = 1000;
    let t0 = process.hrtime.bigint();
    for (let i = 0; i < READS; i += 1) op.getCurrent(tmp);
    let elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const meanRead = elapsedMs / READS;
    assert.ok(meanRead < 2, 'getCurrent mean must be < 2ms (got ' + meanRead.toFixed(4) + 'ms)');

    // Transitions: alternate BUILD_ROOM <-> METHODOLOGY x 100
    const TRANS = 100;
    t0 = process.hrtime.bigint();
    for (let i = 0; i < TRANS; i += 1) {
      const target = (i % 2 === 0) ? 'METHODOLOGY' : 'BUILD_ROOM';
      op.transition(tmp, target, 'mos_command', {});
    }
    elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const meanTrans = elapsedMs / TRANS;
    assert.ok(meanTrans < 10, 'transition mean must be < 10ms (got ' + meanTrans.toFixed(4) + 'ms)');
    ok(label + ' [reads ' + meanRead.toFixed(4) + 'ms, trans ' + meanTrans.toFixed(4) + 'ms]');
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 10: Canon Part 8 grep audit on operator.cjs source
// ------------------------------------------------------------------
(function s10() {
  const label = '10: Canon Part 8 grep audit (zero Brain references)';
  try {
    const src = fs.readFileSync(OPERATOR_SRC, 'utf8');
    const forbidden = /brain\.mindrian\.ai|brainQuery|pinecone|embedQuery|require\(['"](\.\.\/)*lib\/core\/brain-client/;
    assert.equal(forbidden.test(src), false, 'Canon Part 8 boundary violation in operator.cjs');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ------------------------------------------------------------------
// Scenario 11: Graph edge graceful skip when graph absent
// ------------------------------------------------------------------
(function s11() {
  const label = '11: graph edge graceful skip when DB absent';
  const tmp = makeTmpRoom('nograph');
  try {
    copyDir(path.join(FIXTURES, 'seed-room-resume'), tmp);
    const op = freshRequireOperator();

    // No .room-graph/ at all.
    let r = op.transition(tmp, 'METHODOLOGY', 'mos_command', {});
    assert.equal(r.success, true, 'transition must succeed even without graph dir');

    // Empty .room-graph/ with no room.db.
    fs.mkdirSync(path.join(tmp, '.room-graph'), { recursive: true });
    r = op.transition(tmp, 'BUILD_ROOM', 'mos_command', {});
    assert.equal(r.success, true, 'transition must succeed with empty .room-graph dir');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Scenario 12: Graph edge written when graph exists
// ------------------------------------------------------------------
(function s12() {
  // Phase 129-03: the bypass is retired. The edge now writes through
  // navigation.cjs into .mindrian/room.db with operator-namespaced node ids
  // and ENUM-ONLY properties (Canon Part 8). The old .room-graph target +
  // freeform timestamp/methodology props are GONE.
  const label = '12: OPERATOR_TRANSITION edge written via chokepoint (.mindrian/room.db)';
  const tmp = makeTmpRoom('graph');
  try {
    copyDir(path.join(FIXTURES, 'seed-room-resume'), tmp);
    setupCanonicalGraph(tmp);
    const op = freshRequireOperator();

    // Transition BUILD_ROOM -> METHODOLOGY
    const r = op.transition(tmp, 'METHODOLOGY', 'mos_command', { methodology_in_flight: 'mos:test' });
    assert.equal(r.success, true, 'transition must succeed');

    // Inspect the canonical room.db via the openRoomDb chokepoint.
    const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
    const db = openRoomDb(tmp);
    try {
      const countRow = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type='OPERATOR_TRANSITION'").get();
      assert.equal(Number(countRow.n), 1, 'exactly 1 OPERATOR_TRANSITION edge expected, got ' + countRow.n);
      const edgeRow = db.prepare("SELECT source, target, properties FROM edges WHERE type='OPERATOR_TRANSITION' LIMIT 1").get();
      assert.equal(edgeRow.source, 'operator:BUILD_ROOM', 'edge source must be operator:BUILD_ROOM');
      assert.equal(edgeRow.target, 'operator:METHODOLOGY', 'edge target must be operator:METHODOLOGY');
      const props = JSON.parse(edgeRow.properties);
      assert.equal(props.trigger, 'mos_command', 'properties.trigger must reflect the transition trigger');
      // Canon Part 8: enum-only props -- no freeform timestamp / methodology fields.
      assert.equal(props.timestamp, undefined, 'no freeform timestamp on the chokepoint edge');
      assert.equal(props.methodology, undefined, 'no freeform methodology on the chokepoint edge');
      // The operator_transitioned memory_event also lands via the same call.
      const evRow = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='operator_transitioned'").get();
      assert.equal(Number(evRow.n), 1, 'exactly 1 operator_transitioned memory_event expected, got ' + evRow.n);
    } finally {
      closeRoomDb(db);
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(tmp);
  }
})();

// ------------------------------------------------------------------
// Final report
// ------------------------------------------------------------------
const total = passed + failed;
process.stdout.write('\n');
process.stdout.write('Phase 99-01 operator state: ' + passed + '/' + total + ' GREEN\n');
if (failed > 0) {
  process.stdout.write('Phase 99-01 operator state: ' + failed + ' FAILED\n');
}
process.exit(failed === 0 ? 0 : 1);
