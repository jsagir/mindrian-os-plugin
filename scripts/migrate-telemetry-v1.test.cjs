#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-01 Task 1 -- migration script fixture tests.
 *
 * Verifies scripts/migrate-telemetry-v1.cjs:
 *   1. Empty source dir -> no-op, exits 0, no events-*.jsonl created.
 *   2. Source files with legacy shapes -> normalized to ALLOWED_FIELDS shape
 *      (selector and query-efficiency coerce to command_invocation).
 *   3. mva.jsonl with 3 rows -> events-YYYY-WNN.jsonl in timestamp order;
 *      each row has schema_version: 1 (Number); event field preserved.
 *   4. After successful merge, originals renamed *.pre-v121.bak; originals gone.
 *   5. SECOND run is idempotent: sha256 of first 5 timestamps prevents
 *      double-merge; zero duplicate rows appended.
 *   6. Mixed-week timestamps split across events-2026-W19.jsonl and
 *      events-2026-W20.jsonl.
 *   7. Forbidden-pattern row (email in command field) -> quarantined to
 *      .quarantine-*.jsonl with reason; migration does NOT abort; idempotence
 *      sha256 still covers that timestamp.
 *   8. Migration emits a summary JSON to stdout with the expected keys.
 *
 * Hermetic: each test creates a tmpdir, points HOME at it, runs migrator,
 * asserts file contents, and tears down via fs.rmSync in finally. Mirrors
 * lib/core/telemetry/writer.test.cjs scaffolding shape.
 *
 * No em-dashes per memory rule. Pure CJS, node built-ins only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MIGRATE_PATH = path.join(REPO, 'scripts/migrate-telemetry-v1.cjs');

function mkTmpDir(prefix) {
  const base = path.join(os.tmpdir(), 'mos-121-01-' + prefix + '-' + process.pid + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

function withHome(tmp, fn) {
  const originalHome = process.env.HOME;
  process.env.HOME = tmp;
  // Clear require cache so SOURCES (which uses path.join(homeDir(), ...)) re-resolves.
  try { delete require.cache[require.resolve(MIGRATE_PATH)]; } catch (_) {}
  try { return fn(); } finally { process.env.HOME = originalHome; }
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split('\n').filter(l => l.length > 0).map(l => JSON.parse(l));
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(filePath, text, 'utf8');
}

function sha256hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

let passed = 0;
let failed = 0;
const failures = [];

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS ' + name);
  } catch (err) {
    failed++;
    failures.push({ name: name, err: err });
    console.log('FAIL ' + name + ': ' + (err && err.message ? err.message : String(err)));
  }
}

// ---------- Test 1: Empty source directory -> no-op ----------

runTest('Test 1: empty source dir -> no-op exits 0, no events file', function () {
  const tmp = mkTmpDir('t1');
  try {
    withHome(tmp, function () {
      const mig = require(MIGRATE_PATH);
      const summary = {
        migrated: 0, quarantined: 0, idempotent_skipped: 0,
        sources_renamed: [], per_source: []
      };
      for (const s of mig.SOURCES) {
        const r = mig.migrateOne(s);
        summary.migrated += r.migrated;
        summary.quarantined += r.quarantined;
        summary.idempotent_skipped += r.idempotent_skipped;
        if (r.renamed) summary.sources_renamed.push(s.name);
      }
      assert.equal(summary.migrated, 0, 'no rows migrated on empty input');
      assert.equal(summary.quarantined, 0, 'no quarantines');
      const v113Dir = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
      const files = fs.existsSync(v113Dir) ? fs.readdirSync(v113Dir).filter(f => /^events-/.test(f)) : [];
      assert.equal(files.length, 0, 'no events-*.jsonl created on empty input');
    });
  } finally { rmRf(tmp); }
});

// ---------- Test 2: Selector + query-efficiency legacy rows normalize ----------

runTest('Test 2: legacy selector + query rows normalize to command_invocation', function () {
  const tmp = mkTmpDir('t2');
  try {
    withHome(tmp, function () {
      const telDir = path.join(tmp, '.mindrian', 'telemetry');
      writeJsonl(path.join(telDir, 'selector.jsonl'), [
        { event: 'query.served', ts: '2026-05-10T12:00:00Z', command: '/mos:whitespace', tool: 'Read', tokens_used: 100, tokens_naive_estimate: 5000, ratio: 50, room_slug: 'example-room' }
      ]);
      writeJsonl(path.join(telDir, 'query-efficiency.jsonl'), [
        { event: 'query.served', ts: '2026-05-10T12:00:05Z', command: '/mos:scout', tool: 'Read', tokens_used: 100, tokens_naive_estimate: 5700, ratio: 57, room_slug: 'demo' }
      ]);
      const mig = require(MIGRATE_PATH);
      mig.migrateOne(mig.SOURCES[1]); // selector
      mig.migrateOne(mig.SOURCES[3]); // query-efficiency

      const v113Dir = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
      const files = fs.readdirSync(v113Dir).filter(f => /^events-\d{4}-W\d{2}\.jsonl$/.test(f));
      assert.equal(files.length, 1, 'should produce single events file');
      const rows = readJsonl(path.join(v113Dir, files[0]));
      assert.equal(rows.length, 2, 'two rows merged');
      for (const r of rows) {
        assert.equal(r.event, 'command_invocation');
        assert.equal(r.schema_version, 1);
        assert.ok(typeof r.command === 'string' && r.command.startsWith('/mos:'));
        assert.equal(r.outcome, 'served');
        assert.ok(typeof r.duration_ms === 'number');
        assert.ok(typeof r.context_hash === 'string' && r.context_hash.length === 16);
      }
    });
  } finally { rmRf(tmp); }
});

// ---------- Test 3: mva.jsonl preserves order + adds schema_version ----------

runTest('Test 3: mva 3 rows preserve timestamp order + schema_version=1', function () {
  const tmp = mkTmpDir('t3');
  try {
    withHome(tmp, function () {
      const telDir = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
      const sha256 = 'a'.repeat(64);
      writeJsonl(path.join(telDir, 'mva.jsonl'), [
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:00.000Z', sentence_sha256: sha256 },
        { event: 'mva_brief_rendered', timestamp: '2026-05-10T12:00:05.000Z', sentence_sha256: sha256, total_duration_ms: 5000, agent_count_ok: 3, agent_count_failed: 0 },
        { event: 'mva_option_selected', timestamp: '2026-05-10T12:00:10.000Z', sentence_sha256: sha256, option_id: 1, time_to_click_ms: 1234 }
      ]);
      const mig = require(MIGRATE_PATH);
      mig.migrateOne(mig.SOURCES[0]); // mva

      const files = fs.readdirSync(telDir).filter(f => /^events-\d{4}-W\d{2}\.jsonl$/.test(f));
      assert.equal(files.length, 1, 'one events file');
      const rows = readJsonl(path.join(telDir, files[0]));
      assert.equal(rows.length, 3, 'three rows');
      assert.equal(rows[0].event, 'mva_pipeline_started');
      assert.equal(rows[1].event, 'mva_brief_rendered');
      assert.equal(rows[2].event, 'mva_option_selected');
      for (const r of rows) {
        assert.strictEqual(r.schema_version, 1, 'schema_version is Number 1');
        assert.equal(typeof r.schema_version, 'number');
        assert.match(r.timestamp, /^2026-05-10T/);
      }
    });
  } finally { rmRf(tmp); }
});

// ---------- Test 4: Originals renamed *.pre-v121.bak ----------

runTest('Test 4: originals renamed *.pre-v121.bak after merge', function () {
  const tmp = mkTmpDir('t4');
  try {
    withHome(tmp, function () {
      const telDir = path.join(tmp, '.mindrian', 'telemetry');
      const v113 = path.join(telDir, 'v1.13');
      const sha256 = 'b'.repeat(64);
      writeJsonl(path.join(v113, 'mva.jsonl'), [
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:00.000Z', sentence_sha256: sha256 }
      ]);
      writeJsonl(path.join(telDir, 'selector.jsonl'), [
        { event: 'query.served', ts: '2026-05-10T12:00:00Z', command: '/mos:whitespace', ratio: 50, room_slug: 'r1' }
      ]);
      writeJsonl(path.join(telDir, 'navigation-bypass.jsonl'), [
        { op: 'read', reason: 'legacy_path', caller_hash: 'deadbeef', timestamp: '2026-05-10T12:00:00.000Z' }
      ]);
      writeJsonl(path.join(telDir, 'query-efficiency.jsonl'), [
        { event: 'query.served', ts: '2026-05-10T12:00:00Z', command: '/mos:scout', ratio: 57, room_slug: 'r2' }
      ]);

      const mig = require(MIGRATE_PATH);
      for (const s of mig.SOURCES) mig.migrateOne(s);

      assert.ok(!fs.existsSync(path.join(v113, 'mva.jsonl')), 'mva.jsonl renamed');
      assert.ok(fs.existsSync(path.join(v113, 'mva.jsonl.pre-v121.bak')), 'mva backup exists');
      assert.ok(!fs.existsSync(path.join(telDir, 'selector.jsonl')), 'selector renamed');
      assert.ok(fs.existsSync(path.join(telDir, 'selector.jsonl.pre-v121.bak')), 'selector backup exists');
      assert.ok(!fs.existsSync(path.join(telDir, 'navigation-bypass.jsonl')), 'nav-bypass renamed');
      assert.ok(fs.existsSync(path.join(telDir, 'navigation-bypass.jsonl.pre-v121.bak')), 'nav-bypass backup exists');
      assert.ok(!fs.existsSync(path.join(telDir, 'query-efficiency.jsonl')), 'query-eff renamed');
      assert.ok(fs.existsSync(path.join(telDir, 'query-efficiency.jsonl.pre-v121.bak')), 'query-eff backup exists');
    });
  } finally { rmRf(tmp); }
});

// ---------- Test 5: Idempotence -- second run is a no-op ----------

runTest('Test 5: second run skips via sha256 fingerprint (idempotent)', function () {
  const tmp = mkTmpDir('t5');
  try {
    withHome(tmp, function () {
      const telDir = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
      const sha256 = 'c'.repeat(64);
      writeJsonl(path.join(telDir, 'mva.jsonl'), [
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:00.000Z', sentence_sha256: sha256 },
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:01.000Z', sentence_sha256: sha256 },
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:02.000Z', sentence_sha256: sha256 }
      ]);

      const mig = require(MIGRATE_PATH);
      const r1 = mig.migrateOne(mig.SOURCES[0]);
      assert.equal(r1.migrated, 3, 'first run migrates 3 rows');
      assert.equal(r1.renamed, true, 'first run renames');

      // Simulate a second run: re-create the source file (e.g. a backup
      // restored) and run again. Idempotence detector should skip it.
      writeJsonl(path.join(telDir, 'mva.jsonl'), [
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:00.000Z', sentence_sha256: sha256 },
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:01.000Z', sentence_sha256: sha256 },
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:02.000Z', sentence_sha256: sha256 }
      ]);
      const r2 = mig.migrateOne(mig.SOURCES[0]);
      assert.equal(r2.migrated, 0, 'second run migrates 0 rows');
      assert.equal(r2.idempotent_skipped, 1, 'second run reports idempotent_skipped');

      const files = fs.readdirSync(telDir).filter(f => /^events-\d{4}-W\d{2}\.jsonl$/.test(f));
      assert.equal(files.length, 1, 'still one events file');
      const rows = readJsonl(path.join(telDir, files[0]));
      assert.equal(rows.length, 3, 'no duplicates appended -- still 3 rows total');
    });
  } finally { rmRf(tmp); }
});

// ---------- Test 6: Mixed-week timestamps split across two files ----------

runTest('Test 6: mixed-week timestamps split across two events files', function () {
  const tmp = mkTmpDir('t6');
  try {
    withHome(tmp, function () {
      const telDir = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
      const sha256 = 'd'.repeat(64);
      // 2026-05-10 is in W19; 2026-05-12 is also in W20 (Monday starts W20).
      writeJsonl(path.join(telDir, 'mva.jsonl'), [
        { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:00.000Z', sentence_sha256: sha256 }, // W19
        { event: 'mva_pipeline_started', timestamp: '2026-05-12T12:00:00.000Z', sentence_sha256: sha256 }  // W20
      ]);

      const mig = require(MIGRATE_PATH);
      mig.migrateOne(mig.SOURCES[0]);

      const files = fs.readdirSync(telDir).filter(f => /^events-\d{4}-W\d{2}\.jsonl$/.test(f)).sort();
      assert.equal(files.length, 2, 'two events files (one per ISO week)');
      assert.ok(files[0].includes('W19'), 'first file is W19');
      assert.ok(files[1].includes('W20'), 'second file is W20');
    });
  } finally { rmRf(tmp); }
});

// ---------- Test 7: Forbidden-pattern row quarantined (does not abort) ----------

runTest('Test 7: forbidden-pattern row quarantined, migration continues', function () {
  const tmp = mkTmpDir('t7');
  try {
    withHome(tmp, function () {
      const telDir = path.join(tmp, '.mindrian', 'telemetry');
      // Row 1: clean. Row 2: forbidden pattern (email in command field).
      // After normalization, the command field carries the email so the
      // Canon Part 8 validator rejects it.
      writeJsonl(path.join(telDir, 'selector.jsonl'), [
        { event: 'query.served', ts: '2026-05-10T12:00:00Z', command: '/mos:whitespace', ratio: 50, room_slug: 'clean-row' },
        { event: 'query.served', ts: '2026-05-10T12:00:01Z', command: 'user@example.com', ratio: 50, room_slug: 'dirty-row' }
      ]);

      const mig = require(MIGRATE_PATH);
      const r = mig.migrateOne(mig.SOURCES[1]);

      assert.equal(r.migrated, 1, 'clean row migrated');
      assert.equal(r.quarantined, 1, 'dirty row quarantined');
      assert.equal(r.renamed, true, 'source renamed despite one bad row');

      const v113 = path.join(telDir, 'v1.13');
      const qPath = path.join(v113, '.quarantine-selector.jsonl');
      assert.ok(fs.existsSync(qPath), 'quarantine file exists');
      const qRows = readJsonl(qPath);
      assert.equal(qRows.length, 1, 'one quarantine entry');
      assert.equal(qRows[0].source, 'selector');
      assert.ok(typeof qRows[0].reason === 'string' && qRows[0].reason.length > 0);
    });
  } finally { rmRf(tmp); }
});

// ---------- Test 8: Summary JSON to stdout via main() ----------

runTest('Test 8: main() emits summary JSON to stdout with expected keys', function () {
  const tmp = mkTmpDir('t8');
  try {
    const telDir = path.join(tmp, '.mindrian', 'telemetry', 'v1.13');
    const sha256 = 'e'.repeat(64);
    writeJsonl(path.join(telDir, 'mva.jsonl'), [
      { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:00.000Z', sentence_sha256: sha256 }
    ]);

    // Run as subprocess with HOME set to tmp.
    const out = execFileSync(process.execPath, [MIGRATE_PATH], {
      env: Object.assign({}, process.env, { HOME: tmp, USERPROFILE: tmp }),
      encoding: 'utf8'
    });
    const summary = JSON.parse(out);
    assert.ok(typeof summary.migrated === 'number', 'summary has migrated count');
    assert.ok(typeof summary.quarantined === 'number', 'summary has quarantined count');
    assert.ok(typeof summary.idempotent_skipped === 'number', 'summary has idempotent_skipped count');
    assert.ok(Array.isArray(summary.sources_renamed), 'summary has sources_renamed array');
    assert.ok(Array.isArray(summary.per_source), 'summary has per_source array');
    assert.ok(summary.sources_renamed.includes('mva'), 'mva listed in sources_renamed');
    assert.equal(summary.migrated, 1, 'migrated count is 1');
  } finally { rmRf(tmp); }
});

// ---------- Summary ----------

const total = passed + failed;
console.log('');
console.log(passed + '/' + total + ' tests passed');
if (failed > 0) {
  for (const f of failures) {
    console.log('  -- ' + f.name);
  }
  process.exit(1);
}
process.exit(0);
