#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-02 test -- across-session-memory.cjs (HMI-103-01).
 *
 * 12 assertion classes covering D-06 promotion gate, D-07 park, D-08
 * complete, D-16/17 opt-out, D-18 audit FIFO, archive rotation, multi-
 * process race smoke, and the D-01 invariant (Phase 100's within-session
 * file is never modified by this module).
 *
 * Test isolation: every assertion gets a fresh tmp root copied from
 * test/fixtures/memory-continuity/ via fs.cpSync (Node 16.7+). The
 * MINDRIAN_ROOMS_HOME env override points the module at that tmp root,
 * so no real ~/MindrianRooms/ data is touched.
 *
 * IIFE harness pattern, mirrors tests/test-cascade-side-channel.cjs and
 * tests/test-jtbd-state-io.cjs. Final summary: [N/M passed]. Exit 0 on
 * all pass, 1 on any fail.
 *
 * Usage:
 *   node tests/test-across-session-memory.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { fork } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_SRC = path.join(REPO_ROOT, 'test', 'fixtures', 'memory-continuity');
const RACE_HELPER = path.join(REPO_ROOT, 'tests', 'helpers', 'across-session-race-writer.cjs');
const MEM_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'across-session-memory.cjs');

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  process.stdout.write('  PASS  ' + label + '\n');
}

function fail(label, err) {
  failed += 1;
  process.stdout.write('  FAIL  ' + label + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function assert(cond, label, err) {
  if (cond) ok(label);
  else fail(label, err);
}

function freshTmpRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-test-'));
  if (fs.existsSync(FIXTURE_SRC)) {
    fs.cpSync(FIXTURE_SRC, tmp, { recursive: true });
  } else {
    // Defensive: if 103-00 fixture missing in this checkout, build a minimal one.
    fs.mkdirSync(path.join(tmp, '.memory'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'room-a', '.mindrian'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'room-b', '.mindrian'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, '.rooms', 'registry.json'),
      JSON.stringify({
        version: 1,
        rooms: [
          { slug: 'room-a', path: 'room-a' },
          { slug: 'room-b', path: 'room-b' },
        ],
      })
    );
    fs.writeFileSync(
      path.join(tmp, 'room-a', '.mindrian', 'jtbd-state.json'),
      JSON.stringify({ version: 1, current: null, history: [] })
    );
    fs.writeFileSync(
      path.join(tmp, 'room-b', '.mindrian', 'jtbd-state.json'),
      JSON.stringify({ version: 1, current: null, history: [] })
    );
  }
  return tmp;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function loadFreshModule() {
  // Bust require cache so MINDRIAN_ROOMS_HOME env override applies on
  // every fresh load (the module captures via runtime call, but we keep
  // this guarded for safety against any module-init caching).
  delete require.cache[MEM_MODULE_PATH];
  return require(MEM_MODULE_PATH);
}

function withTmpRoot(fn) {
  const tmp = freshTmpRoot();
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = tmp;
  try {
    return fn(tmp);
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    rmrf(tmp);
  }
}

function readMem(tmp) {
  const p = path.join(tmp, '.memory', 'jtbd-history.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

(function main() {
  process.stdout.write('[test-across-session-memory] running 12 assertion classes\n');

  // ----------------------------------------------------------------------
  // Class 1: module loads + 9 expected exports
  // ----------------------------------------------------------------------
  (function class1_exports() {
    let mem;
    try {
      mem = loadFreshModule();
    } catch (err) {
      fail('class 1: module loads', err);
      return;
    }
    const expected = [
      'promoteIfEligible',
      'parkJtbd',
      'completeJtbd',
      'getRoomMemory',
      'listInFlight',
      'getJtbdAcrossRooms',
      'isGlobalOptOut',
      'isRoomOptOut',
      'appendAudit',
    ];
    let allPresent = true;
    for (const fn of expected) {
      if (typeof mem[fn] !== 'function') {
        allPresent = false;
        fail('class 1: export ' + fn + ' is function', new Error('typeof = ' + typeof mem[fn]));
      }
    }
    if (allPresent) ok('class 1: all 9 expected exports present');
  })();

  // ----------------------------------------------------------------------
  // Class 2: promoteIfEligible writes when turn_count >= 3 AND jtbd set
  // ----------------------------------------------------------------------
  withTmpRoot(function class2_promotePositive(tmp) {
    try {
      const mem = loadFreshModule();
      const result = mem.promoteIfEligible('room-a', {
        current: {
          jtbd: 'prepare-pitch',
          confidence: 0.8,
          turn_count: 5,
          manual_set: false,
          evidence: ['tokens:investor'],
        },
        history: [],
      });
      const onDisk = readMem(tmp);
      const inflight = onDisk && onDisk.rooms && onDisk.rooms['room-a'] && onDisk.rooms['room-a'].in_flight;
      const hasEntry = Array.isArray(inflight) && inflight.some(r => r.jtbd === 'prepare-pitch');
      assert(result && result.action === 'promoted', 'class 2: promote result.action === promoted');
      assert(hasEntry, 'class 2: in_flight has prepare-pitch entry on disk');
    } catch (err) {
      fail('class 2: promoteIfEligible positive path', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 3: NO-OP when turn_count < 3 AND !manual_set
  // ----------------------------------------------------------------------
  withTmpRoot(function class3_noiseFloor(tmp) {
    try {
      const mem = loadFreshModule();
      const result = mem.promoteIfEligible('room-a', {
        current: {
          jtbd: 'prepare-pitch',
          confidence: 0.8,
          turn_count: 1,
          manual_set: false,
          evidence: [],
        },
        history: [],
      });
      const onDisk = readMem(tmp);
      const hasRoom = onDisk && onDisk.rooms && onDisk.rooms['room-a'];
      assert(result === null, 'class 3: noise-floor returns null');
      assert(!hasRoom || (hasRoom.in_flight || []).length === 0, 'class 3: nothing written under noise floor');
    } catch (err) {
      fail('class 3: noise-floor gate', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 4: manual_set === true bypasses turn gate
  // ----------------------------------------------------------------------
  withTmpRoot(function class4_manualOverride(tmp) {
    try {
      const mem = loadFreshModule();
      const result = mem.promoteIfEligible('room-a', {
        current: {
          jtbd: 'prepare-pitch',
          confidence: 0.4, // below 0.6 noise floor
          turn_count: 1,    // below 3-turn gate
          manual_set: true, // but manual override
          evidence: [],
        },
        history: [],
      });
      const onDisk = readMem(tmp);
      const inflight = onDisk && onDisk.rooms && onDisk.rooms['room-a'] && onDisk.rooms['room-a'].in_flight;
      assert(result && result.action === 'promoted', 'class 4: manual override returns promoted');
      assert(Array.isArray(inflight) && inflight.length >= 1, 'class 4: manual override wrote in_flight');
    } catch (err) {
      fail('class 4: manual override', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 5: parkJtbd moves entry from in_flight to parked + reason field
  // ----------------------------------------------------------------------
  withTmpRoot(function class5_park(tmp) {
    try {
      const mem = loadFreshModule();
      mem.promoteIfEligible('room-a', {
        current: { jtbd: 'prepare-pitch', confidence: 0.8, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
      const result = mem.parkJtbd('room-a', 'prepare-pitch', 'replaced by find-bottleneck');
      const onDisk = readMem(tmp);
      const r = onDisk && onDisk.rooms && onDisk.rooms['room-a'];
      const stillInflight = r && (r.in_flight || []).some(x => x.jtbd === 'prepare-pitch');
      const parkedRow = r && (r.parked || []).find(x => x.jtbd === 'prepare-pitch');
      assert(result && result.action === 'parked', 'class 5: park result.action === parked');
      assert(!stillInflight, 'class 5: entry removed from in_flight');
      assert(parkedRow && parkedRow.reason === 'replaced by find-bottleneck', 'class 5: parked row has reason field');
    } catch (err) {
      fail('class 5: parkJtbd', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 6: completeJtbd moves entry to completed + completion_shape +
  // completion_evidence (D-08)
  // ----------------------------------------------------------------------
  withTmpRoot(function class6_complete(tmp) {
    try {
      const mem = loadFreshModule();
      mem.promoteIfEligible('room-a', {
        current: { jtbd: 'prepare-pitch', confidence: 0.8, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
      const shape = { artifact_glob: 'presentation/*.html', cascade_edge: 'PRODUCES' };
      const result = mem.completeJtbd('room-a', 'prepare-pitch', shape, 'presentation/index.html');
      const onDisk = readMem(tmp);
      const r = onDisk && onDisk.rooms && onDisk.rooms['room-a'];
      const completedRow = r && (r.completed || []).find(x => x.jtbd === 'prepare-pitch');
      const stillInflight = r && (r.in_flight || []).some(x => x.jtbd === 'prepare-pitch');
      assert(result && result.action === 'completed', 'class 6: complete result.action === completed');
      assert(!stillInflight, 'class 6: entry removed from in_flight');
      assert(!!completedRow, 'class 6: completed row exists');
      assert(completedRow && completedRow.completion_evidence === 'presentation/index.html',
        'class 6: completion_evidence carries evidence path');
      assert(
        completedRow && completedRow.completion_shape && completedRow.completion_shape.artifact_glob === 'presentation/*.html',
        'class 6: completion_shape preserved'
      );
    } catch (err) {
      fail('class 6: completeJtbd', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 7: global opt-out (.opt-out sentinel) NO-OPs all writes (D-16)
  // ----------------------------------------------------------------------
  withTmpRoot(function class7_globalOptOut(tmp) {
    try {
      // Touch the sentinel BEFORE first ensureDir runs; create dir if missing
      fs.mkdirSync(path.join(tmp, '.memory'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.memory', '.opt-out'), '');
      const mem = loadFreshModule();
      assert(mem.isGlobalOptOut() === true, 'class 7: isGlobalOptOut detects sentinel');
      const result = mem.promoteIfEligible('room-a', {
        current: { jtbd: 'prepare-pitch', confidence: 0.8, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
      // Capture state of jtbd-history.json BEFORE checking — writes must not have happened
      const onDisk = readMem(tmp);
      const inflight = onDisk && onDisk.rooms && onDisk.rooms['room-a'] && onDisk.rooms['room-a'].in_flight;
      assert(result === null, 'class 7: promoteIfEligible returns null under opt-out');
      assert(!inflight || inflight.length === 0, 'class 7: no entries written under opt-out');
    } catch (err) {
      fail('class 7: global opt-out', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 8: per-room opt-out (.memory-opt-out sentinel) (D-17)
  // ----------------------------------------------------------------------
  withTmpRoot(function class8_perRoomOptOut(tmp) {
    try {
      // Touch room-a's per-room opt-out sentinel
      fs.mkdirSync(path.join(tmp, 'room-a', '.mindrian'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'room-a', '.mindrian', '.memory-opt-out'), '');
      const mem = loadFreshModule();
      assert(mem.isRoomOptOut('room-a') === true, 'class 8: isRoomOptOut detects per-room sentinel');
      assert(mem.isRoomOptOut('room-b') === false, 'class 8: room-b not opted out');
      const resultA = mem.promoteIfEligible('room-a', {
        current: { jtbd: 'prepare-pitch', confidence: 0.8, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
      const resultB = mem.promoteIfEligible('room-b', {
        current: { jtbd: 'find-bottleneck', confidence: 0.8, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
      const onDisk = readMem(tmp);
      const aInflight = onDisk && onDisk.rooms && onDisk.rooms['room-a'] && onDisk.rooms['room-a'].in_flight;
      const bInflight = onDisk && onDisk.rooms && onDisk.rooms['room-b'] && onDisk.rooms['room-b'].in_flight;
      assert(resultA === null, 'class 8: room-a promote no-op under per-room opt-out');
      assert(resultB && resultB.action === 'promoted', 'class 8: room-b still writes (per-room scope only)');
      assert(!aInflight || aInflight.length === 0, 'class 8: room-a wrote nothing');
      assert(Array.isArray(bInflight) && bInflight.length >= 1, 'class 8: room-b wrote in_flight');
    } catch (err) {
      fail('class 8: per-room opt-out', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 9: audit log FIFO truncation (D-18, RESEARCH §7)
  // ----------------------------------------------------------------------
  withTmpRoot(function class9_auditFifo(tmp) {
    try {
      const mem = loadFreshModule();
      // Seed the audit log with > 10000 lines to force truncation eligibility.
      fs.mkdirSync(path.join(tmp, '.memory'), { recursive: true });
      const auditPath = path.join(tmp, '.memory', 'audit.log');
      const seedLines = [];
      for (let i = 0; i < 10001; i++) {
        seedLines.push('2026-04-30T00:00:00.000Z | seed-room | promote | seed-jtbd-' + i);
      }
      fs.writeFileSync(auditPath, seedLines.join('\n') + '\n');
      // Force-trigger the truncate path. The module exposes truncate via random
      // sample-rate inside appendAudit; we exercise it directly if exposed,
      // otherwise drive it by calling appendAudit many times. Either way, after
      // many calls the file MUST trim under the floor.
      const internal = mem._internal && mem._internal.truncateAuditIfNeeded;
      if (typeof internal === 'function') {
        internal();
      } else {
        // Drive via repeated appendAudit calls; eventually the 1% sample fires.
        for (let i = 0; i < 2000; i++) {
          mem.appendAudit('room-a', 'promote', 'jtbd-' + i);
        }
      }
      const lines = fs.readFileSync(auditPath, 'utf8').split('\n').filter(Boolean);
      // After truncation, line count should be at or below 9000 (FLOOR), allowing
      // for the appendAudit calls that came AFTER truncation in the loop branch.
      const ceiling = 9000 + 2000; // floor + max possible later appends
      assert(lines.length <= ceiling, 'class 9: audit log trimmed below ceiling (' + lines.length + ' <= ' + ceiling + ')');
      // Truncation MUST have happened at some point: line count cannot still be 10001+.
      assert(lines.length < 10001, 'class 9: audit log no longer at original 10001-line seed');
    } catch (err) {
      fail('class 9: audit FIFO truncation', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 10: per-room array bounded at 100 + archive rotation
  // ----------------------------------------------------------------------
  withTmpRoot(function class10_archiveRotation(tmp) {
    try {
      const mem = loadFreshModule();
      // Seed jtbd-history.json with 100 in_flight entries for room-a
      const seeded = { version: 1, rooms: { 'room-a': { in_flight: [], parked: [], completed: [] } }, last_updated: null };
      const baseTs = Date.parse('2026-01-01T00:00:00.000Z');
      for (let i = 0; i < 100; i++) {
        seeded.rooms['room-a'].in_flight.push({
          jtbd: 'seed-jtbd-' + i,
          first_seen: new Date(baseTs + i * 1000).toISOString(),
          last_seen:  new Date(baseTs + i * 1000).toISOString(),
          confidence_avg: 0.8,
          turn_count: 5,
          manual_set: false,
          evidence_summary: [],
        });
      }
      fs.mkdirSync(path.join(tmp, '.memory'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.memory', 'jtbd-history.json'), JSON.stringify(seeded, null, 2));
      // Now promote one MORE jtbd; that takes the array to 101 -> trim to 100, archive 1.
      const result = mem.promoteIfEligible('room-a', {
        current: { jtbd: 'overflow-jtbd', confidence: 0.8, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
      const onDisk = readMem(tmp);
      const inflight = onDisk && onDisk.rooms && onDisk.rooms['room-a'] && onDisk.rooms['room-a'].in_flight;
      assert(result && result.action === 'promoted', 'class 10: promote succeeded');
      assert(Array.isArray(inflight) && inflight.length === 100, 'class 10: in_flight bounded at 100');
      // Archive should have at least 1 entry.
      const archivePath = path.join(tmp, '.memory', 'jtbd-history.archive.json');
      const archiveExists = fs.existsSync(archivePath);
      assert(archiveExists, 'class 10: archive file created');
      if (archiveExists) {
        const arc = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
        const arcCount = arc && arc.rooms && arc.rooms['room-a'] && (arc.rooms['room-a'].in_flight || []).length;
        assert(arcCount >= 1, 'class 10: archive has overflow entry (count=' + arcCount + ')');
      }
    } catch (err) {
      fail('class 10: archive rotation', err);
    }
  });

  // ----------------------------------------------------------------------
  // Class 11: multi-process race smoke -- two concurrent forks
  // ----------------------------------------------------------------------
  (function class11_multiProcessRace() {
    const tmp = freshTmpRoot();
    try {
      const childA = fork(
        RACE_HELPER,
        ['room-a', 'prepare-pitch', '5'],
        { env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: tmp }), silent: true }
      );
      const childB = fork(
        RACE_HELPER,
        ['room-b', 'find-bottleneck', '5'],
        { env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: tmp }), silent: true }
      );
      const waitFor = (child) => new Promise((resolve) => {
        let done = false;
        const finish = (code) => { if (!done) { done = true; resolve(code); } };
        child.on('exit', finish);
        child.on('error', () => finish(99));
        // Hard timeout 4s
        setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} finish(124); }, 4000);
      });
      Promise.all([waitFor(childA), waitFor(childB)]).then(([codeA, codeB]) => {
        try {
          const onDisk = readMem(tmp);
          const aOk = onDisk && onDisk.rooms && onDisk.rooms['room-a'] &&
            (onDisk.rooms['room-a'].in_flight || []).some(x => x.jtbd === 'prepare-pitch');
          const bOk = onDisk && onDisk.rooms && onDisk.rooms['room-b'] &&
            (onDisk.rooms['room-b'].in_flight || []).some(x => x.jtbd === 'find-bottleneck');
          assert(codeA === 0 && codeB === 0, 'class 11: both child processes exited 0 (codes=' + codeA + ',' + codeB + ')');
          assert(aOk, 'class 11: room-a in_flight has prepare-pitch (no lost write)');
          assert(bOk, 'class 11: room-b in_flight has find-bottleneck (no lost write)');
          // Verify NO orphan lockfile remains
          const lockExists = fs.existsSync(path.join(tmp, '.memory', 'jtbd-history.json.lock'));
          assert(!lockExists, 'class 11: no orphan lockfile after race');
        } finally {
          rmrf(tmp);
          // Print summary AFTER async race completes.
          process.stdout.write('\n[' + passed + '/' + (passed + failed) + ' passed]\n');
          process.exit(failed === 0 ? 0 : 1);
        }
      });
    } catch (err) {
      fail('class 11: multi-process race orchestration', err);
      rmrf(tmp);
      process.stdout.write('\n[' + passed + '/' + (passed + failed) + ' passed]\n');
      process.exit(1);
    }
  })();

  // ----------------------------------------------------------------------
  // Class 12: D-01 invariant -- module NEVER writes to <roomDir>/.mindrian/
  //                              jtbd-state.json (Phase 100's file)
  // ----------------------------------------------------------------------
  withTmpRoot(function class12_d01Invariant(tmp) {
    try {
      const mem = loadFreshModule();
      const phase100File = path.join(tmp, 'room-a', '.mindrian', 'jtbd-state.json');
      // Ensure the file exists with a known mtime; bump mtime back one hour to
      // give a clear before/after delta.
      if (!fs.existsSync(phase100File)) {
        fs.mkdirSync(path.dirname(phase100File), { recursive: true });
        fs.writeFileSync(phase100File, JSON.stringify({ version: 1, current: null, history: [] }));
      }
      const before = fs.statSync(phase100File);
      const beforeMtimeMs = before.mtimeMs;
      const beforeContent = fs.readFileSync(phase100File, 'utf8');

      // Wait briefly so any accidental write would produce a measurable delta.
      const wait = Date.now() + 25;
      while (Date.now() < wait) { /* spin */ }

      // Call all 4 write-ish functions
      mem.promoteIfEligible('room-a', {
        current: { jtbd: 'prepare-pitch', confidence: 0.8, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
      mem.parkJtbd('room-a', 'prepare-pitch', 'invariant-test');
      mem.completeJtbd('room-a', 'prepare-pitch', { artifact_glob: '*.md' }, 'doc.md');
      mem.appendAudit('room-a', 'promote', 'prepare-pitch');

      const after = fs.statSync(phase100File);
      const afterContent = fs.readFileSync(phase100File, 'utf8');
      assert(after.mtimeMs === beforeMtimeMs, 'class 12: jtbd-state.json mtime unchanged (D-01)');
      assert(beforeContent === afterContent, 'class 12: jtbd-state.json content unchanged (D-01)');
    } catch (err) {
      fail('class 12: D-01 invariant', err);
    }
  });

  // Note: classes 1-10 + 12 finish synchronously, but class 11 is async and
  // owns the final summary print + process.exit. If class 11 path crashes
  // before the async resolution, the catch in class 11 prints summary and
  // exits.
})();
