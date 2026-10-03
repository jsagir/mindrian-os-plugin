#!/usr/bin/env node
'use strict';

/**
 * Phase 369-12 (CHG369-06, CM369-01, D-18) -- change log growth measurement,
 * compaction and the measured retention ceiling.
 *
 * Measure first, then choose, then time at the chosen numbers:
 *   growth  - log rows from 2,000 insertNode writes; from one rebuildGraph of a
 *             200-artifact room; total rows after 10 rebuilds
 *   timing  - synthesize a log of RETENTION.maxRows rows, time
 *             compactChangeLog(db, { keepRows: RETENTION.keepRows })
 *   arms a-f - compaction correctness, installChangeLog threshold, the 2000 ms
 *             ceiling, and the retention promise against the recorded JSON
 *
 * The recorded numbers live in tests/fixtures/369/retention-measurement.json
 * (counts and milliseconds only, Phase 343 rule, SEED-074). A normal run
 * compares the live COUNTS to the recorded ones and fails by saying so when
 * they drift (re-measure with --write). `--write` regenerates the file.
 *
 * Canon Part 9: tests/ is allow-listed for raw SQL by the substrate guard; the
 * writes under measurement go through insertNode and rebuildGraph (the real
 * writers), and the bulk synthesis uses a prepared raw UPDATE on a throwaway
 * fixture only. Canon Part 8: no network. Hermetic HOME. No em-dashes or
 * en-dashes (CJS).
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-chg-compact-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const WRITE = process.argv.includes('--write');
const REPO = path.resolve(__dirname, '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', '369', 'retention-measurement.json');
const { DatabaseSync } = require('node:sqlite');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const { openGraph, closeGraph, rebuildGraph } = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const changeLog = require(path.join(REPO, 'lib', 'core', 'navigation', 'room-change-log.cjs'));
const { RETENTION, compactChangeLog, readChangeLogMeta } = changeLog;
const { buildRoom369 } = require('./helpers/fixture-room-369.cjs');

const TIMING_CEILING_MS = 2000;
const NODE_TARGET = 200;

let passed = 0;
let failed = 0;
let roomCounter = 0;

function ok(name, extra) { passed += 1; process.stdout.write('  ok ' + name + (extra ? '  ' + extra : '') + '\n'); }
function bad(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + String(err.stack || err.message || err).split('\n').join('\n    ') + '\n');
}
async function arm(name, fn) {
  try {
    const extra = await fn();
    ok(name, typeof extra === 'string' ? extra : undefined);
  } catch (e) { bad(name, e); }
}

function freshRoom() {
  roomCounter += 1;
  return buildRoom369({
    tmpDir: path.join(HERMETIC, 'rooms', 'r' + roomCounter),
    slug: 'r' + roomCounter,
    variant: 'wide',
    migrate: true,
  });
}
function withDb(room, fn) {
  const db = openRoomDb(room.roomDir);
  try { return fn(db); } finally { closeRoomDb(db); }
}
function logCount(db) { return Number(db.prepare('SELECT COUNT(*) AS c FROM room_change_log').get().c); }
function latestSeq(db) { return readChangeLogMeta(db).latest_seq; }

/**
 * Append n log rows by n prepared UPDATEs of one node (each fires rcl_nodes_au
 * once), inside one transaction. Returns nothing; read the meta afterwards.
 */
function synthesizeRows(db, n) {
  const id = 'claim:synth-369';
  const has = db.prepare('SELECT 1 AS x FROM nodes WHERE id = ?').get(id);
  if (!has) insertNode(db, id, 'claim', JSON.stringify({ text: 'synth' }), { epistemic_type: 'observation' });
  const upd = db.prepare('UPDATE nodes SET last_seen_at = ? WHERE id = ?');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = 0; i < n; i += 1) upd.run(1000 + i, id);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
    throw e;
  }
}

function writeArtifacts(roomDir, count) {
  const perSection = 20;
  const sections = Math.ceil(count / perSection);
  let n = 0;
  for (let s = 1; s <= sections; s += 1) {
    const dir = path.join(roomDir, 's' + String(s).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    for (let a = 1; a <= perSection && n < count; a += 1) {
      n += 1;
      fs.writeFileSync(
        path.join(dir, 'a' + String(a).padStart(2, '0') + '.md'),
        '# Artifact ' + n + '\n\nFixture artifact number ' + n + ' in section ' + s + '. It holds enough plain text to be indexed as an artifact node.\n'
      );
    }
  }
}

async function measureGrowth() {
  // 2,000 ordinary writes through the real writer (insertNode), fresh room.
  const wRoom = freshRoom();
  const rowsPer2000 = withDb(wRoom, (db) => {
    const before = latestSeq(db);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (let i = 0; i < 2000; i += 1) {
        insertNode(db, 'claim:w-' + i, 'claim', JSON.stringify({ text: 'w' + i }), { epistemic_type: 'observation' });
      }
      db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch (_e) { /* ignore */ } throw e; }
    return latestSeq(db) - before;
  });

  // Rebuilds of a 200-artifact room through rebuildGraph.
  const room = freshRoom();
  writeArtifacts(room.roomDir, NODE_TARGET);
  const g = await openGraph(room.roomDir);
  let rowsPerRebuild = 0;
  let rowsAfter10 = 0;
  let nodeCount = 0;
  try {
    const seq = () => latestSeq(g.db);
    const start = seq();
    await rebuildGraph(g.conn, room.roomDir); // rebuild 1, from an empty graph
    const afterFirst = seq();
    await rebuildGraph(g.conn, room.roomDir); // rebuild 2, steady state
    rowsPerRebuild = seq() - afterFirst;
    for (let i = 3; i <= 10; i += 1) await rebuildGraph(g.conn, room.roomDir);
    rowsAfter10 = seq() - start;
    nodeCount = Number(g.db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c);
    const artifacts = Number(g.db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'Artifact'").get().c);
    assert.ok(artifacts >= NODE_TARGET, 'expected at least ' + NODE_TARGET + ' artifact nodes, got ' + artifacts);
  } finally {
    await closeGraph(g.db);
  }
  const required = rowsPerRebuild * 20 + (rowsPer2000 / 2000) * 10000;
  return {
    rows_per_2000_writes: rowsPer2000,
    rows_per_rebuild: rowsPerRebuild,
    rows_after_10_rebuilds: rowsAfter10,
    required_rows: required,
    node_count: nodeCount,
  };
}

function measureTiming() {
  const room = freshRoom();
  return withDb(room, (db) => {
    synthesizeRows(db, RETENTION.maxRows);
    const rows = logCount(db);
    assert.ok(rows >= RETENTION.maxRows, 'synthesis made ' + rows + ' rows');
    const t0 = process.hrtime.bigint();
    const res = compactChangeLog(db, { keepRows: RETENTION.keepRows });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return { ms: Math.round(ms * 10) / 10, removed: res.removed, rowsBefore: rows };
  });
}

function readFixture() {
  try { return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')); } catch (_e) { return null; }
}

async function main() {
  process.stdout.write('369-12 change log compaction and retention' + (WRITE ? ' (--write)' : '') + '\n');

  // --- growth measurement ---
  let growth = null;
  await arm('growth: log rows per 2,000 writes, per rebuild, after 10 rebuilds', async () => {
    growth = await measureGrowth();
    assert.ok(growth.rows_per_2000_writes >= 2000, 'every insertNode must log at least one row');
    assert.ok(growth.rows_per_rebuild > 0, 'a rebuild must log rows');
    return JSON.stringify(growth);
  });

  // --- timing measurement at the shipped ratio ---
  let timing = null;
  await arm('timing: compact ' + RETENTION.maxRows + ' rows down to ' + RETENTION.keepRows, () => {
    timing = measureTiming();
    assert.equal(timing.removed, timing.rowsBefore - RETENTION.keepRows, 'compaction removed an unexpected count');
    return 'compaction_ms_at_retention=' + timing.ms + ' removed=' + timing.removed;
  });

  // --- a. exact removal and floor ---
  await arm('a. keepRows + 1,000 rows compacts by exactly 1,000; floor = new oldest seq', () => {
    const room = freshRoom();
    withDb(room, (db) => {
      synthesizeRows(db, 1500); // 1 insert row + 1,500 updates = 1,501 rows
      const before = logCount(db);
      const keep = before - 1000;
      const res = compactChangeLog(db, { keepRows: keep });
      assert.equal(res.removed, 1000);
      const minSeq = Number(db.prepare('SELECT MIN(change_seq) AS m FROM room_change_log').get().m);
      assert.equal(res.floor, minSeq);
      assert.equal(readChangeLogMeta(db).floor, minSeq);
      assert.equal(logCount(db), keep);
    });
  });

  // --- b. retained rows byte-identical ---
  await arm('b. rows at or above the cutoff are byte-identical before and after', () => {
    const room = freshRoom();
    withDb(room, (db) => {
      synthesizeRows(db, 800);
      const keep = 300;
      const cutoff = latestSeq(db) - keep + 1;
      const snap = () => JSON.stringify(db.prepare('SELECT * FROM room_change_log WHERE change_seq >= ? ORDER BY change_seq').all(cutoff));
      const before = snap();
      const res = compactChangeLog(db, { keepRows: keep });
      assert.ok(res.removed > 0);
      assert.equal(snap(), before);
      assert.equal(Number(db.prepare('SELECT MIN(change_seq) AS m FROM room_change_log').get().m), cutoff);
    });
  });

  // --- c. seq never goes backwards ---
  await arm('c. a write after compaction gets a seq above every earlier seq', () => {
    const room = freshRoom();
    withDb(room, (db) => {
      synthesizeRows(db, 600);
      const top = latestSeq(db);
      compactChangeLog(db, { keepRows: 100 });
      insertNode(db, 'claim:after-compaction', 'claim', JSON.stringify({ text: 'x' }), { epistemic_type: 'observation' });
      const row = db.prepare("SELECT change_seq FROM room_change_log WHERE entity_id = 'claim:after-compaction'").get();
      assert.ok(Number(row.change_seq) > top, 'seq went backwards: ' + row.change_seq + ' <= ' + top);
      assert.equal(latestSeq(db), Number(row.change_seq));
    });
  });

  // --- d. installChangeLog threshold ---
  await arm('d. installChangeLog does not compact at maxRows and does compact above it', () => {
    const room = freshRoom();
    // Exactly maxRows retained: a reopen must leave the log alone.
    withDb(room, (db) => { synthesizeRows(db, RETENTION.maxRows - logCount(db) - 1); });
    withDb(room, (db) => {
      assert.equal(logCount(db), RETENTION.maxRows, 'setup must hold exactly maxRows rows');
      assert.equal(readChangeLogMeta(db).floor, 0, 'a log at maxRows must not be compacted by a reopen');
    });
    withDb(room, (db) => {
      assert.equal(logCount(db), RETENTION.maxRows, 'a second reopen at maxRows must still leave the log alone');
    });
    // Push it over the ceiling on one handle, then reopen: the install compacts.
    withDb(room, (db) => { synthesizeRows(db, 1000); });
    withDb(room, (db) => {
      const meta = readChangeLogMeta(db);
      assert.ok(meta.floor > 0, 'reopen above maxRows must compact (floor still ' + meta.floor + ')');
      assert.equal(logCount(db), RETENTION.keepRows);
    });
  });

  // --- e. compaction time at the shipped ratio ---
  await arm('e. compaction at the shipped ratio finishes inside ' + TIMING_CEILING_MS + ' ms', () => {
    assert.ok(timing, 'timing arm did not run');
    assert.ok(timing.ms <= TIMING_CEILING_MS,
      'compaction took ' + timing.ms + ' ms (> ' + TIMING_CEILING_MS + '); name a smaller batch in the SUMMARY');
    return 'compaction_ms_at_retention=' + timing.ms;
  });

  // --- record or compare the measurement ---
  const record = growth && timing ? {
    rows_per_2000_writes: growth.rows_per_2000_writes,
    rows_per_rebuild: growth.rows_per_rebuild,
    rows_after_10_rebuilds: growth.rows_after_10_rebuilds,
    required_rows: growth.required_rows,
    retention_max_rows: RETENTION.maxRows,
    retention_keep_rows: RETENTION.keepRows,
    compaction_ms_at_retention: timing.ms,
    node_count: growth.node_count,
    measured_at: new Date().toISOString(),
    node: process.version,
  } : null;
  if (WRITE && record) {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(record, null, 2) + '\n');
    process.stdout.write('  wrote ' + path.relative(REPO, FIXTURE) + '\n');
  }

  // --- f. retention promise against the recorded JSON ---
  await arm('f. the retention promise holds against the recorded JSON and the shipped RETENTION', () => {
    const rec = readFixture();
    assert.ok(rec, 'tests/fixtures/369/retention-measurement.json is missing or unreadable (run with --write)');
    for (const k of ['rows_per_2000_writes', 'rows_per_rebuild', 'rows_after_10_rebuilds', 'required_rows',
      'retention_max_rows', 'retention_keep_rows', 'compaction_ms_at_retention', 'node_count']) {
      assert.equal(typeof rec[k], 'number', k + ' must be a number in the recorded JSON');
    }
    const promise = rec.rows_per_rebuild * 20 + (rec.rows_per_2000_writes / 2000) * 10000;
    assert.ok(promise <= RETENTION.maxRows, 'promise ' + promise + ' exceeds RETENTION.maxRows ' + RETENTION.maxRows);
    assert.equal(rec.required_rows, promise, 'required_rows disagrees with its own derivation');
    assert.equal(rec.retention_max_rows, RETENTION.maxRows, 'recorded retention_max_rows differs from the shipped RETENTION');
    assert.equal(rec.retention_keep_rows, RETENTION.keepRows, 'recorded retention_keep_rows differs from the shipped RETENTION');
    assert.ok(RETENTION.maxRows > RETENTION.keepRows);
    assert.ok(Object.isFrozen(RETENTION));
    if (growth) {
      // The counts are deterministic for the fixture; drift means the writers
      // changed and the retention numbers must be re-chosen from a new measurement.
      for (const k of ['rows_per_2000_writes', 'rows_per_rebuild', 'rows_after_10_rebuilds', 'node_count']) {
        assert.equal(growth[k], rec[k], k + ' drifted from the recorded measurement (live ' + growth[k] + ', recorded ' + rec[k] + '); re-measure with --write and re-check RETENTION');
      }
    }
    return 'required_rows=' + promise + ' <= maxRows=' + RETENTION.maxRows;
  });

  try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.stdout.write('\nPASS=' + passed + ' FAIL=' + failed + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

void DatabaseSync;
main().catch((e) => { process.stdout.write('FATAL ' + (e.stack || e) + '\n'); process.exit(1); });
