#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-00 -- unified writer acceptance tests.
 *
 * Verifies lib/core/telemetry/writer.cjs is THE single chokepoint (Canon
 * Part 9 navigation.cjs precedent) for trajectory-telemetry emits. Every
 * downstream capture point in 121-02 and 121-03 routes through emit() here.
 *
 * Test map (10 cases, one-to-one with the PLAN <behavior> block for Task 2):
 *   1.  Writer exports surface: emit, telemetryDir, telemetryFile,
 *       isoWeekFilename, EVENT_TYPES, ALLOWED_FIELDS.
 *   2.  telemetryDir() resolves under $HOME/.mindrian/telemetry/v1.13.
 *   3.  isoWeekFilename() zero-pads week and gates 2026-01-01 -> W01,
 *       2026-01-05 -> W02, 2026-05-19 -> W21.
 *   4.  telemetryFile(date) composes telemetryDir() + isoWeekFilename(date).
 *   5.  emit() writes JSONL with schema_version: 1 (Number), valid
 *       ISO-8601 timestamp, session_id from env or 'default', all payload
 *       keys present with correct values.
 *   6.  emit() throws Error.code='TELEMETRY_VALIDATION' on unknown event.
 *   7.  emit() throws on Canon Part 8 forbidden pattern (Cypher in
 *       allowed field).
 *   8.  emit() creates the v1.13 dir if missing (recursive mkdir); does
 *       NOT throw if fs.appendFileSync fails (best-effort -- pipeline
 *       must not crash on telemetry disk failure).
 *   9.  Two emit() calls 5ms apart land in the SAME ISO-week file.
 *  10.  Every line is JSON.parseable (no BOM, single newline terminator).
 *
 * Hermetic: each test creates a tmpdir, points HOME at it, writes, asserts,
 * and tears down via fs.rmSync in finally. Mirrors
 * lib/memory/query-efficiency-telemetry.test.cjs.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..', '..', '..');
const WRITER_PATH = path.join(REPO, 'lib/core/telemetry/writer.cjs');

try { delete require.cache[require.resolve(WRITER_PATH)]; } catch (_) {}
const writer = require(WRITER_PATH);

// ---------- Fixture scaffolding ----------

function mkTmpDir(prefix) {
  const base = path.join(os.tmpdir(), 'mos-121-00-' + prefix + '-' + process.pid + '-' + Date.now().toString(36));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

function withHome(tmp, fn) {
  const originalHome = process.env.HOME;
  process.env.HOME = tmp;
  try { return fn(); } finally { process.env.HOME = originalHome; }
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  // No BOM allowed, single newline per line.
  assert.ok(text.charCodeAt(0) !== 0xFEFF, 'JSONL must not start with BOM');
  const lines = text.split('\n').filter(l => l.length > 0);
  return lines.map(l => JSON.parse(l));
}

// ---------- Test 1: writer export surface ----------

(function test1Exports() {
  assert.equal(typeof writer.emit, 'function', 'writer.emit must be a function');
  assert.equal(typeof writer.telemetryDir, 'function', 'writer.telemetryDir must be a function');
  assert.equal(typeof writer.telemetryFile, 'function', 'writer.telemetryFile must be a function');
  assert.equal(typeof writer.isoWeekFilename, 'function', 'writer.isoWeekFilename must be a function');
  assert.ok(Array.isArray(writer.EVENT_TYPES), 'writer must re-export EVENT_TYPES');
  assert.equal(typeof writer.ALLOWED_FIELDS, 'object', 'writer must re-export ALLOWED_FIELDS');
  console.log('PASS test 1: writer exports emit/telemetryDir/telemetryFile/isoWeekFilename/EVENT_TYPES/ALLOWED_FIELDS');
})();

// ---------- Test 2: telemetryDir resolves under HOME ----------

(function test2TelemetryDir() {
  const tmp = mkTmpDir('dir');
  try {
    withHome(tmp, () => {
      const dir = writer.telemetryDir();
      const expected = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
      assert.equal(dir, expected,
        'telemetryDir() must resolve to <HOME>/.mindrian/telemetry/v1.13; got ' + dir);
    });
    console.log('PASS test 2: telemetryDir() resolves under HOME');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 3: isoWeekFilename zero-pads + handles year boundaries ----------

(function test3IsoWeek() {
  // 2026-05-19 is a Tuesday in ISO week 21 of 2026.
  const f1 = writer.isoWeekFilename(new Date('2026-05-19T12:00:00Z'));
  assert.equal(f1, 'events-2026-W21.jsonl',
    'isoWeekFilename(2026-05-19) must be events-2026-W21.jsonl; got ' + f1);

  // 2026-01-05 is a Monday in ISO week 02 of 2026 (W01 is the week of
  // 2025-12-29..2026-01-04 because the first Thursday of 2026 is 2026-01-01).
  const f2 = writer.isoWeekFilename(new Date('2026-01-05T12:00:00Z'));
  assert.equal(f2, 'events-2026-W02.jsonl',
    'isoWeekFilename(2026-01-05) must be events-2026-W02.jsonl (zero-padded); got ' + f2);

  // 2026-01-01 is the Thursday that anchors ISO week 01 of 2026.
  const f3 = writer.isoWeekFilename(new Date('2026-01-01T12:00:00Z'));
  assert.equal(f3, 'events-2026-W01.jsonl',
    'isoWeekFilename(2026-01-01) must be events-2026-W01.jsonl; got ' + f3);

  console.log('PASS test 3: isoWeekFilename zero-pads week (W21, W02, W01)');
})();

// ---------- Test 4: telemetryFile composes ----------

(function test4TelemetryFile() {
  const tmp = mkTmpDir('file');
  try {
    withHome(tmp, () => {
      const f = writer.telemetryFile(new Date('2026-05-19T00:00:00Z'));
      const expected = path.join(tmp, '.mindrian', 'telemetry', 'v1.13', 'events-2026-W21.jsonl');
      assert.equal(f, expected,
        'telemetryFile() must compose dir + isoWeekFilename; got ' + f);
    });
    console.log('PASS test 4: telemetryFile() composes dir + filename');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 5: emit() writes JSONL with schema_version + iso timestamp + session_id + payload ----------

(function test5EmitWritesJsonl() {
  const tmp = mkTmpDir('emit');
  const originalSession = process.env.CLAUDE_SESSION_ID;
  process.env.CLAUDE_SESSION_ID = 'test-session-abc';
  try {
    withHome(tmp, () => {
      writer.emit('selector_pick', {
        sub_shape: 'F.1',
        mode: 'A',
        ranker_confidence: 0.73,
        recommended_rendered: true,
        options_count: 4,
        room_slug_sha256: 'a'.repeat(64),
        verb_chosen: 'Run Methodology',
      });

      const filePath = writer.telemetryFile();
      assert.ok(fs.existsSync(filePath), 'emit() must create the JSONL file at ' + filePath);

      const rows = readJsonl(filePath);
      assert.equal(rows.length, 1, 'emit() must write exactly 1 line; got ' + rows.length);

      const r = rows[0];
      assert.equal(r.event, 'selector_pick', 'event field must be selector_pick');
      assert.equal(r.schema_version, 1, 'schema_version must be Number 1; got ' + r.schema_version + ' (' + typeof r.schema_version + ')');
      assert.equal(typeof r.schema_version, 'number', 'schema_version must be typeof number');
      assert.match(r.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'timestamp must be ISO-8601');
      assert.equal(typeof r.session_id, 'string', 'session_id must be a string');
      assert.ok(r.session_id.length > 0, 'session_id must be non-empty');
      assert.equal(r.session_id, 'test-session-abc', 'session_id must reflect CLAUDE_SESSION_ID env');

      // All 7 payload keys present with correct values.
      assert.equal(r.sub_shape, 'F.1');
      assert.equal(r.mode, 'A');
      assert.equal(r.ranker_confidence, 0.73);
      assert.equal(r.recommended_rendered, true);
      assert.equal(r.options_count, 4);
      assert.equal(r.room_slug_sha256, 'a'.repeat(64));
      assert.equal(r.verb_chosen, 'Run Methodology');
    });
    console.log('PASS test 5: emit() writes JSONL with schema_version=1, ISO timestamp, session_id, all 7 payload keys');
  } finally {
    if (originalSession === undefined) { delete process.env.CLAUDE_SESSION_ID; }
    else { process.env.CLAUDE_SESSION_ID = originalSession; }
    rmRf(tmp);
  }
})();

// ---------- Test 6: emit() throws on unknown event ----------

(function test6UnknownEventThrows() {
  const tmp = mkTmpDir('unknown');
  try {
    withHome(tmp, () => {
      assert.throws(() => writer.emit('definitely_not_a_real_event', {}),
        (err) => err.code === 'TELEMETRY_VALIDATION',
        'emit() on unknown event must throw with code TELEMETRY_VALIDATION');
    });
    console.log('PASS test 6: emit() throws TELEMETRY_VALIDATION on unknown event');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 7: emit() throws on Canon Part 8 forbidden pattern ----------

(function test7ForbiddenPatternThrows() {
  const tmp = mkTmpDir('forbidden');
  try {
    withHome(tmp, () => {
      assert.throws(() => writer.emit('selector_pick', {
        sub_shape: 'F.1',
        verb_chosen: 'MATCH (n:Framework) RETURN n',  // Cypher injection
      }), (err) => err.code === 'TELEMETRY_VALIDATION',
        'emit() must throw on Cypher fragment in allowed field');
    });
    console.log('PASS test 7: emit() throws on Canon Part 8 forbidden pattern (Cypher)');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 8: emit() creates dir + swallows fs errors silently ----------

(function test8DirCreationAndFsErrorSilent() {
  // Step A: emit into a HOME that does NOT yet contain .mindrian/telemetry/v1.13.
  const tmp = mkTmpDir('create');
  try {
    withHome(tmp, () => {
      // Verify the dir does not exist yet.
      const dir = writer.telemetryDir();
      assert.equal(fs.existsSync(dir), false, 'dir must NOT exist pre-emit');
      writer.emit('selector_pick', {
        sub_shape: 'F.1',
        mode: 'A',
        options_count: 1,
      });
      assert.equal(fs.existsSync(dir), true, 'emit() must create the v1.13 dir recursively');
      const filePath = writer.telemetryFile();
      assert.equal(fs.existsSync(filePath), true, 'emit() must create the JSONL file');
    });

    // Step B: emit when fs.appendFileSync is monkeypatched to throw. Pipeline
    // must not crash. Done in a fresh subprocess so we can monkeypatch without
    // breaking the rest of the suite.
    const tmp2 = mkTmpDir('fserr');
    withHome(tmp2, () => {
      const realAppend = fs.appendFileSync;
      fs.appendFileSync = function () { throw new Error('disk full simulated'); };
      try {
        writer.emit('selector_pick', { sub_shape: 'F.1', mode: 'A' });
        // If we reach here, the swallow worked.
      } finally {
        fs.appendFileSync = realAppend;
      }
    });
    rmRf(tmp2);

    console.log('PASS test 8: emit() creates dir recursively + swallows fs errors silently');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 9: two emits 5ms apart land in the same ISO-week file ----------

(function test9SameFileAcrossShortInterval() {
  const tmp = mkTmpDir('sameweek');
  try {
    withHome(tmp, () => {
      writer.emit('selector_pick', { sub_shape: 'F.1', mode: 'A' });
      const sleep5 = Date.now() + 5;
      while (Date.now() < sleep5) {} // busy-wait
      writer.emit('selector_pick', { sub_shape: 'F.2', mode: 'B' });

      const filePath = writer.telemetryFile();
      const rows = readJsonl(filePath);
      assert.equal(rows.length, 2,
        'two emits 5ms apart must land in same file -> 2 lines; got ' + rows.length);
      assert.equal(rows[0].sub_shape, 'F.1');
      assert.equal(rows[1].sub_shape, 'F.2');
    });
    console.log('PASS test 9: two emits 5ms apart in same ISO-week file');
  } finally {
    rmRf(tmp);
  }
})();

// ---------- Test 10: lines are JSON.parseable, no BOM, no trailing whitespace ----------

(function test10ParseableLines() {
  const tmp = mkTmpDir('parse');
  try {
    withHome(tmp, () => {
      writer.emit('selector_pick', { sub_shape: 'F.1', mode: 'A' });
      writer.emit('command_invocation', { command: '/mos:status', outcome: 'success', duration_ms: 42 });
      writer.emit('nav_bypass', { op: 'read', reason: 'legacy_path' });

      const filePath = writer.telemetryFile();
      const text = fs.readFileSync(filePath, 'utf8');

      // BOM check.
      assert.ok(text.charCodeAt(0) !== 0xFEFF, 'no BOM at start');

      // Each line must JSON.parse.
      const lines = text.split('\n');
      // Last element after split('\n') is '' if file ends with \n (which it should).
      assert.equal(lines[lines.length - 1], '', 'file must end with newline (last split chunk is empty string)');

      const dataLines = lines.slice(0, -1);
      assert.equal(dataLines.length, 3, 'must have 3 data lines; got ' + dataLines.length);
      for (const line of dataLines) {
        assert.equal(line[line.length - 1] !== ' ' && line[line.length - 1] !== '\r', true,
          'no trailing whitespace on line: ' + JSON.stringify(line));
        const obj = JSON.parse(line); // throws if malformed
        assert.equal(typeof obj.event, 'string');
        assert.equal(obj.schema_version, 1);
      }
    });
    console.log('PASS test 10: every line is JSON.parseable, no BOM, single newline terminator');
  } finally {
    rmRf(tmp);
  }
})();

console.log('\nwriter.test.cjs: 10/10 tests passed');
