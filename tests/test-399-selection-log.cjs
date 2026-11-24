#!/usr/bin/env node
'use strict';
// Phase 399-09 (I-09): local, labelled decision rows.
// Legs G1-G8: schema (ground_truth_label migration, selection_observations), the writer, overrule state, Part 8 fences.
// Legs K1-K4: the CLI selector closer (offer-closer closeOffer) writes rows and returns what it returned before.
// Legs K5-K7: the MCP gate_answer writes rows after the answer commits and never changes the response.
// Fixture tables only; the shipped advisor table is not read. Scratch rooms and dbs live under os.tmpdir().
// Node built-ins only, no network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
delete process.env.MINDRIAN_SELECTION_LOG;

const memoryOps = require(path.join(ROOT, 'lib', 'core', 'memory-ops.cjs'));
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
const calLog = require(path.join(ROOT, 'lib', 'core', 'navigation', 'calibration-log.cjs'));
const resolver = require(path.join(ROOT, 'lib', 'workflow', 'command-resolver.cjs'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
async function checkAsync(label, fn) {
  try { await fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  const restore = () => { for (const k of Object.keys(vars)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } };
  let out;
  try { out = fn(); } catch (e) { restore(); throw e; }
  if (out && typeof out.then === 'function') return out.finally(restore);
  restore();
  return out;
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-399-09-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

const JOB = 'decide-pursue';
const CMDS = resolver.commandsForFramework('Six Thinking Hats');
const A = '/mos:think-hats';
const B = '/mos:persona';
const C = '/mos:bono';
function writeTable(name, rows, extra) {
  const file = path.join(TMP, name + '.json');
  fs.writeFileSync(file, JSON.stringify(Object.assign({
    schema: 'fixture', table_version: '399-fixture-' + name, key_order: ['job', 'definition_level', 'last_command'],
    thresholds: { strong: 0.7, possible: 0.5 }, shortlist_k: 3, rows,
  }, extra || {})));
  return file;
}
const E = (command, calibrated) => ({ command, calibrated });
const T_MAIN = writeTable('main', { [JOB + '|*|*']: [E(A, 0.9), E(B, 0.6), E(C, 0.2)] });
const T_TIE = writeTable('tie', { [JOB + '|*|*']: [E(A, 1), E(B, 1), E(C, 0.2)] });
const T_WEAK = writeTable('weak', { [JOB + '|*|*']: [E(A, 0.3), E(B, 0.2), E(C, 0.1)] });
const ON = (table) => ({ MINDRIAN_DECISION_ADVISOR: 'on', MINDRIAN_DECISION_ADVISOR_TABLE: table });
const OFF = { MINDRIAN_DECISION_ADVISOR: undefined, MINDRIAN_DECISION_ADVISOR_TABLE: undefined };

function freshDb() { return new DatabaseSync(':memory:'); }
function rowsOf(db, table, where) {
  try { return db.prepare('SELECT * FROM ' + table + (where ? ' WHERE ' + where : '') + ' ORDER BY rowid').all(); } catch (_e) { return []; }
}
function colNames(db, table) { return db.prepare('PRAGMA table_info(' + table + ')').all().map((c) => c.name); }
function record(db, args, env) {
  return withEnv(env || ON(T_MAIN), () => navigation.recordSelectionOutcome(db, Object.assign({ surface: 'cli', jobId: JOB }, args)));
}

console.log('--- test-399-selection-log ---');

check('fixture: the three commands are registry commands', () => {
  for (const c of [A, B, C]) assert.ok(CMDS.indexOf(c) !== -1, c);
});

// ---------------------------------------------------------------------------
// G1: ground_truth_label migration.
// ---------------------------------------------------------------------------
check('G1 fresh db: ground_truth_label exists and is nullable INTEGER; second init is a no-op', () => {
  const db = freshDb();
  memoryOps.initCalibrationSchema(db);
  const col = db.prepare('PRAGMA table_info(calibration_observations)').all().find((c) => c.name === 'ground_truth_label');
  assert.ok(col, 'column present');
  assert.equal(col.type, 'INTEGER');
  assert.equal(col.notnull, 0);
  memoryOps.initCalibrationSchema(db);
  assert.equal(colNames(db, 'calibration_observations').filter((n) => n === 'ground_truth_label').length, 1);
});

check('G1 old 9-column db gains the column once, keeps its rows', () => {
  const db = freshDb();
  db.exec('CREATE TABLE calibration_observations (id TEXT PRIMARY KEY, turn_id TEXT, turn_count INTEGER, cue_kind TEXT NOT NULL, confidence REAL, cue_disposition TEXT NOT NULL, band TEXT, created_by TEXT DEFAULT \'system\', created_at INTEGER)');
  db.prepare('INSERT INTO calibration_observations (id, cue_kind, cue_disposition) VALUES (?, ?, ?)').run('old:1', 'reframe_cue', 'fired');
  assert.equal(colNames(db, 'calibration_observations').length, 9);
  memoryOps.initCalibrationSchema(db);
  assert.equal(colNames(db, 'calibration_observations').length, 10);
  memoryOps.initCalibrationSchema(db);
  assert.equal(colNames(db, 'calibration_observations').length, 10);
  const row = db.prepare('SELECT * FROM calibration_observations WHERE id = ?').get('old:1');
  assert.equal(row.ground_truth_label, null);
});

check('G1b WR-07 a lost ALTER race does not throw; a real ALTER failure still does', () => {
  // The column is added by "another process" after this process read the table info.
  const db = freshDb();
  db.exec('CREATE TABLE calibration_observations (id TEXT PRIMARY KEY, turn_id TEXT, turn_count INTEGER, cue_kind TEXT NOT NULL, confidence REAL, cue_disposition TEXT NOT NULL, band TEXT, created_by TEXT DEFAULT \'system\', created_at INTEGER)');
  db.exec('ALTER TABLE calibration_observations ADD COLUMN ground_truth_label INTEGER');
  const realPrepare = db.prepare.bind(db);
  let stale = true;
  db.prepare = (sql) => {
    const stmt = realPrepare(sql);
    if (stale && /PRAGMA table_info\(calibration_observations\)/.test(sql)) {
      stale = false;
      return { all: () => stmt.all().filter((c) => c.name !== 'ground_truth_label') };
    }
    return stmt;
  };
  memoryOps.initCalibrationSchema(db);
  assert.equal(colNames(db, 'calibration_observations').filter((n) => n === 'ground_truth_label').length, 1);
  // A failure that leaves the column missing still throws (read-only or locked db).
  const db2 = freshDb();
  db2.exec('CREATE TABLE calibration_observations (id TEXT PRIMARY KEY, turn_id TEXT, turn_count INTEGER, cue_kind TEXT NOT NULL, confidence REAL, cue_disposition TEXT NOT NULL, band TEXT, created_by TEXT DEFAULT \'system\', created_at INTEGER)');
  const realExec = db2.exec.bind(db2);
  db2.exec = (sql) => { if (/ALTER TABLE/.test(sql)) throw new Error('attempt to write a readonly database'); return realExec(sql); };
  assert.throws(() => memoryOps.initCalibrationSchema(db2), /readonly/);
});

// ---------------------------------------------------------------------------
// G2: logCalibrationObservation label handling.
// ---------------------------------------------------------------------------
check('G2 without a label the base 9-column INSERT runs and works on an old-schema table', () => {
  const db = freshDb();
  db.exec('CREATE TABLE calibration_observations (id TEXT PRIMARY KEY, turn_id TEXT, turn_count INTEGER, cue_kind TEXT NOT NULL, confidence REAL, cue_disposition TEXT NOT NULL, band TEXT, created_by TEXT DEFAULT \'system\', created_at INTEGER)');
  const r = calLog.logCalibrationObservation(db, { cue_kind: 'reframe_cue', confidence: 0.7, emit_audit_marker: false });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM calibration_observations').get().c, 1);
});

check('G2 with label 0 or 1 it writes the value; any other value is stored as null', () => {
  const db = freshDb();
  memoryOps.initCalibrationSchema(db);
  const ids = {};
  for (const v of [0, 1, 2, 'x', null, undefined, -1, true]) {
    const r = calLog.logCalibrationObservation(db, { cue_kind: 'advisor_option', confidence: 0.5, ground_truth_label: v, emit_audit_marker: false });
    assert.equal(r.ok, true, JSON.stringify(r));
    ids[String(v)] = r.id;
  }
  const label = (k) => db.prepare('SELECT ground_truth_label AS g FROM calibration_observations WHERE id = ?').get(ids[k]).g;
  assert.equal(label('0'), 0);
  assert.equal(label('1'), 1);
  for (const k of ['2', 'x', 'null', 'undefined', '-1', 'true']) assert.equal(label(k), null, k);
});

check('G2 recordGroundTruth updates by id with 0, 1 or null', () => {
  const db = freshDb();
  memoryOps.initCalibrationSchema(db);
  const r = calLog.logCalibrationObservation(db, { cue_kind: 'advisor_option', confidence: 0.5, emit_audit_marker: false });
  assert.equal(typeof navigation.recordGroundTruth, 'function');
  navigation.recordGroundTruth(db, r.id, 1);
  assert.equal(db.prepare('SELECT ground_truth_label AS g FROM calibration_observations WHERE id = ?').get(r.id).g, 1);
  navigation.recordGroundTruth(db, r.id, 7);
  assert.equal(db.prepare('SELECT ground_truth_label AS g FROM calibration_observations WHERE id = ?').get(r.id).g, null);
  navigation.recordGroundTruth(db, r.id, 0);
  assert.equal(db.prepare('SELECT ground_truth_label AS g FROM calibration_observations WHERE id = ?').get(r.id).g, 0);
});

// ---------------------------------------------------------------------------
// G3: selection_observations schema.
// ---------------------------------------------------------------------------
const SEL_COLS = ['id', 'decision_id', 'created_at', 'surface', 'table_version', 'key_used', 'job_id', 'definition_level', 'wicked',
  'cynefin_rating', 'last_command', 'shown_command', 'shown_rank', 'advisor_rank', 'calibrated_p', 'band', 'no_strong_pick', 'decision',
  'chosen_command', 'offered_command', 'advisor_top', 'overrule_by', 'ground_truth_label', 'calibration_observation_id'];
check('G3 initSelectionSchema creates the table with the named columns, idempotently', () => {
  assert.equal(typeof memoryOps.initSelectionSchema, 'function');
  const db = freshDb();
  memoryOps.initSelectionSchema(db);
  memoryOps.initSelectionSchema(db);
  const cols = colNames(db, 'selection_observations');
  for (const c of SEL_COLS) assert.ok(cols.indexOf(c) !== -1, 'missing column ' + c);
  assert.ok(cols.indexOf('gate_id') !== -1, 'gate_id column (K6)');
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'selection_observations'").all().map((r) => r.name);
  assert.ok(idx.length >= 2, 'indexes: ' + idx.join(','));
});

// ---------------------------------------------------------------------------
// G4: the writer, two shown options, accept.
// ---------------------------------------------------------------------------
check('G4 accept of 2 shown options writes 2 selection rows and 2 calibration rows, no audit marker', () => {
  const db = freshDb();
  memoryOps.initCalibrationSchema(db);
  const markersBefore = rowsOf(db, 'nodes').length;
  const r = record(db, { decision: 'accept', shown_commands: [A, B], chosen_command: A, definitionLevel: 'ill-defined' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.rows, 2);
  assert.equal(typeof r.decision_id, 'string');
  const sel = rowsOf(db, 'selection_observations');
  assert.equal(sel.length, 2);
  assert.equal(sel[0].decision_id, sel[1].decision_id);
  assert.equal(sel[0].decision_id, r.decision_id);
  assert.equal(sel[0].shown_command, A);
  assert.equal(sel[0].calibrated_p, 0.9);
  assert.equal(sel[0].band, 'strong');
  assert.equal(sel[0].ground_truth_label, 1);
  assert.equal(sel[0].shown_rank, 1);
  assert.equal(sel[0].advisor_rank, 1);
  assert.equal(sel[1].shown_command, B);
  assert.equal(sel[1].calibrated_p, 0.6);
  assert.equal(sel[1].band, 'possible');
  assert.equal(sel[1].ground_truth_label, 0);
  assert.equal(sel[1].advisor_rank, 2);
  assert.equal(sel[0].table_version, '399-fixture-main');
  assert.equal(sel[0].job_id, JOB);
  assert.equal(sel[0].definition_level, 'ill-defined');
  assert.equal(sel[0].decision, 'accept');
  assert.equal(sel[0].chosen_command, A);
  assert.equal(sel[0].offered_command, A);
  assert.equal(sel[0].advisor_top, A);
  assert.equal(sel[0].overrule_by, 'none');
  assert.equal(sel[0].surface, 'cli');
  const cal = rowsOf(db, 'calibration_observations');
  assert.equal(cal.length, 2);
  for (const c of cal) { assert.equal(c.cue_kind, 'advisor_option'); assert.equal(c.cue_disposition, 'shown'); }
  assert.equal(cal[0].confidence, 0.9);
  assert.equal(cal[0].ground_truth_label, 1);
  assert.equal(cal[1].confidence, 0.6);
  assert.equal(cal[1].ground_truth_label, 0);
  assert.equal(sel[0].calibration_observation_id, cal[0].id);
  assert.equal(rowsOf(db, 'nodes').length, markersBefore, 'no memory_event audit marker');
});

// ---------------------------------------------------------------------------
// G5: overrule state.
// ---------------------------------------------------------------------------
function overrule(args, env) {
  const db = freshDb();
  const r = record(db, args, env);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.overrule_by;
}
check('G5 overrule_by values', () => {
  assert.equal(overrule({ decision: 'accept', shown_commands: [A, B], chosen_command: A }), 'none');
  assert.equal(overrule({ decision: 'accept', shown_commands: [B, A], chosen_command: B }), 'host');
  assert.equal(overrule({ decision: 'reject', shown_commands: [A, B] }), 'navigator');
  assert.equal(overrule({ decision: 'defer', shown_commands: [A, B] }), 'navigator');
  assert.equal(overrule({ decision: 'accept', shown_commands: [A, B], chosen_command: B }), 'navigator');
  assert.equal(overrule({ decision: 'reject', shown_commands: [B, A] }), 'host_and_navigator');
  assert.equal(overrule({ decision: 'accept', shown_commands: [B, A], chosen_command: A }), 'host_and_navigator');
});
check('G5 none when the shortlist state is not ok (off, tie at the top, no strong pick, no row, no job)', () => {
  assert.equal(overrule({ decision: 'reject', shown_commands: [B, A] }, OFF), 'none');
  assert.equal(overrule({ decision: 'reject', shown_commands: [B, A] }, ON(T_TIE)), 'none');
  assert.equal(overrule({ decision: 'reject', shown_commands: [B, A] }, ON(T_WEAK)), 'none');
  assert.equal(overrule({ decision: 'reject', shown_commands: [B, A], jobId: 'find-problem' }), 'none');
  assert.equal(overrule({ decision: 'reject', shown_commands: [B, A], jobId: null }), 'none');
});
check('G9 WR-06 schema DDL runs once per db handle, not once per call; the log stays on with the advisor off', () => {
  const db = freshDb();
  const realExec = db.exec.bind(db);
  let ddl = 0;
  db.exec = (sql) => { if (/CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)|ALTER\s+TABLE/i.test(sql)) ddl += 1; return realExec(sql); };
  const realPrepare = db.prepare.bind(db);
  let pragma = 0;
  db.prepare = (sql) => { if (/PRAGMA table_info/.test(sql)) pragma += 1; return realPrepare(sql); };
  const first = record(db, { decision: 'accept', shown_commands: [A], chosen_command: A }, OFF);
  assert.equal(first.ok, true, JSON.stringify(first));
  const ddlFirst = ddl;
  const pragmaFirst = pragma;
  assert.ok(ddlFirst >= 2, 'the first call sets the schema up: ' + ddlFirst);
  for (const cmd of [B, C, A]) {
    const r = record(db, { decision: 'defer', shown_commands: [cmd] }, OFF);
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  assert.equal(ddl, ddlFirst, 'no DDL after the first call on this handle');
  assert.equal(pragma, pragmaFirst, 'no PRAGMA table_info after the first call on this handle');
  assert.equal(rowsOf(db, 'selection_observations').length, 4, 'rows are written with the advisor off');
  // a new handle sets the schema up again
  const db2 = freshDb();
  const exec2 = db2.exec.bind(db2);
  let ddl2 = 0;
  db2.exec = (sql) => { if (/CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)/i.test(sql)) ddl2 += 1; return exec2(sql); };
  record(db2, { decision: 'accept', shown_commands: [A], chosen_command: A }, OFF);
  assert.ok(ddl2 >= 2);
});
check('G10 WR-08 an accept with no resolvable chosen option: shown[0] only when one option was shown, else null and unlabelled', () => {
  // several shown, chosen missing or not a registry command: no chosen command, no label on any row
  for (const chosenArg of [undefined, null, '/mos:not-a-command']) {
    const db = freshDb();
    const r = record(db, { decision: 'accept', shown_commands: [A, B], chosen_command: chosenArg });
    assert.equal(r.ok, true, JSON.stringify(r));
    const sel = rowsOf(db, 'selection_observations');
    assert.equal(sel.length, 2);
    assert.deepEqual(sel.map((x) => x.ground_truth_label), [null, null], String(chosenArg));
    assert.deepEqual(sel.map((x) => x.chosen_command), [null, null], String(chosenArg));
    assert.deepEqual(rowsOf(db, 'calibration_observations').map((x) => x.ground_truth_label), [null, null], 'calibration rows unlabelled too');
  }
  // exactly one shown: it is the accepted option
  const one = freshDb();
  record(one, { decision: 'accept', shown_commands: [A] });
  const row = rowsOf(one, 'selection_observations')[0];
  assert.equal(row.ground_truth_label, 1);
  assert.equal(row.chosen_command, A);
  // a resolvable chosen option still labels 1 and 0
  const two = freshDb();
  record(two, { decision: 'accept', shown_commands: [A, B], chosen_command: B });
  assert.deepEqual(rowsOf(two, 'selection_observations').map((x) => x.ground_truth_label), [0, 1]);
});
check('G5 advisor off: rows are still written, probability and band are null', () => {
  const db = freshDb();
  const r = record(db, { decision: 'accept', shown_commands: [A, B], chosen_command: A }, OFF);
  assert.equal(r.ok, true);
  const sel = rowsOf(db, 'selection_observations');
  assert.equal(sel.length, 2);
  for (const s of sel) { assert.equal(s.calibrated_p, null); assert.equal(s.band, null); assert.equal(s.advisor_top, null); assert.equal(s.advisor_rank, null); }
  assert.equal(sel[0].ground_truth_label, 1);
  assert.equal(rowsOf(db, 'calibration_observations').length, 0, 'no calibration row without a probability');
});

// ---------------------------------------------------------------------------
// G6: labels for reject and defer.
// ---------------------------------------------------------------------------
check('G6 reject labels shown[0] 0 and the rest null; defer labels all null', () => {
  const db = freshDb();
  record(db, { decision: 'reject', shown_commands: [A, B] });
  const rej = rowsOf(db, 'selection_observations');
  assert.deepEqual(rej.map((r) => r.ground_truth_label), [0, null]);
  const cal = rowsOf(db, 'calibration_observations');
  assert.deepEqual(cal.map((r) => r.ground_truth_label), [0, null]);
  const db2 = freshDb();
  record(db2, { decision: 'defer', shown_commands: [A, B] });
  assert.deepEqual(rowsOf(db2, 'selection_observations').map((r) => r.ground_truth_label), [null, null]);
});

// ---------------------------------------------------------------------------
// G7: nothing is stored as free text.
// ---------------------------------------------------------------------------
check('G7 non-registry commands are skipped; unknown job is null; unknown decision refuses', () => {
  const db = freshDb();
  const secret = 'my secret venture plan about acme corp';
  const r = record(db, { decision: 'accept', shown_commands: [A, '/mos:not-a-command', secret], chosen_command: A, jobId: 'not-a-job' });
  assert.equal(r.ok, true);
  const sel = rowsOf(db, 'selection_observations');
  assert.equal(sel.length, 1);
  assert.equal(sel[0].shown_command, A);
  assert.equal(sel[0].job_id, null);
  assert.equal(JSON.stringify(sel).indexOf('secret'), -1);
  const bad = record(db, { decision: 'bogus', shown_commands: [A] });
  assert.deepEqual({ ok: bad.ok, reason: bad.reason }, { ok: false, reason: 'invalid_decision' });
  assert.equal(rowsOf(db, 'selection_observations').length, 1, 'refused call wrote nothing');
});
check('G7 no valid shown command writes one decision-only row so an accept is still recorded', () => {
  const db = freshDb();
  const r = record(db, { decision: 'accept', shown_commands: ['/mos:nope', 'free text'], chosen_command: '/mos:nope' });
  assert.equal(r.ok, true);
  const sel = rowsOf(db, 'selection_observations');
  assert.equal(sel.length, 1);
  assert.equal(sel[0].decision, 'accept');
  assert.equal(sel[0].shown_command, null);
  assert.equal(sel[0].chosen_command, null);
  assert.equal(sel[0].calibrated_p, null);
  const empty = freshDb();
  assert.equal(record(empty, { decision: 'accept' }).ok, true);
  assert.equal(rowsOf(empty, 'selection_observations').length, 1);
});

// ---------------------------------------------------------------------------
// G8: Part 8 fences.
// ---------------------------------------------------------------------------
check('G8 no column holds a string longer than 80 characters; behavioural channel stays off; no packet or Brain reader names the table', () => {
  const db = freshDb();
  record(db, { decision: 'accept', shown_commands: [A, B], chosen_command: A, gate_id: 'gate:' + 'x'.repeat(200), surface: 'mcp' });
  for (const table of ['selection_observations', 'calibration_observations']) {
    const rows = rowsOf(db, table);
    assert.ok(rows.length > 0, table);
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (typeof row[k] === 'string') assert.ok(row[k].length <= 80, table + '.' + k + ' length ' + row[k].length);
      }
    }
  }
  assert.equal(rowsOf(db, 'selection_observations')[0].gate_id.indexOf('xxxx'), -1, 'gate id is stored as a hash, not as given');
  const gate = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'navigation', 'calibration-gate.cjs'), 'utf8');
  assert.ok(/BEHAVIORAL_CHANNEL_ARMED = false/.test(gate));
  const packet = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'navigation', 'packet.cjs'), 'utf8');
  assert.equal(packet.indexOf('selection_observations'), -1);
  assert.equal(packet.indexOf('calibration_observations'), -1);
});
check('G8 only memory-ops and the writer name the table under lib/, hooks/ and bin/', () => {
  const hits = [];
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(cjs|js|mjs|ts)$/.test(e.name)) {
        let src = '';
        try { src = fs.readFileSync(full, 'utf8'); } catch (_e) { continue; }
        if (src.indexOf('selection_observations') !== -1) hits.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  }
  for (const d of ['lib', 'hooks', 'bin']) walk(path.join(ROOT, d));
  assert.deepEqual(hits.sort(), ['lib/core/memory-ops.cjs', 'lib/core/navigation/selection-log.cjs']);
});

// ---------------------------------------------------------------------------
// K1-K4: the CLI closer.
// ---------------------------------------------------------------------------
const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const closer = require(path.join(ROOT, 'lib', 'workflow', 'offer-closer.cjs'));

function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, '{}', 'p399-09-fixture', 'system', NULL, 'confirmed', ?, ?)").run(id, type, nowMs, nowMs);
}
function norm(v) { return JSON.stringify(v).replace(/[0-9a-f]{8,}/g, '#').replace(/\d{6,}/g, '#'); }
function scratchRoom() {
  const dir = fs.mkdtempSync(path.join(TMP, 'room-'));
  const db = openRoomDb(dir);
  return { dir, db };
}
function selRows(db) { return rowsOf(db, 'selection_observations'); }

check('K1 accept writes a row; the return value equals the value with the log off', () => {
  const a = scratchRoom();
  const b = scratchRoom();
  try {
    const offer = { command: A, framework: 'Six Thinking Hats', confidence: 0.7 };
    const off = withEnv({ MINDRIAN_SELECTION_LOG: 'off' }, () => closer.closeOffer({ pick: 'accept', offer, roomState: { db: a.db, roomDir: a.dir } }));
    const on = closer.closeOffer({ pick: 'accept', offer, roomState: { db: b.db, roomDir: b.dir } });
    assert.deepEqual(on, off);
    assert.equal(selRows(a.db).length, 0, 'log off writes nothing');
    const rows = selRows(b.db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].decision, 'accept');
    assert.equal(rows[0].shown_command, A);
    assert.equal(rows[0].chosen_command, A);
    assert.equal(rows[0].surface, 'cli');
  } finally { closeRoomDb(a.db); closeRoomDb(b.db); }
});

check('K2 defer and reject write rows after recordSelectorDecision; return values unchanged', () => {
  for (const pick of ['defer', 'reject']) {
    const a = scratchRoom();
    const b = scratchRoom();
    try {
      const offer = { command: A, framework: 'Six Thinking Hats', confidence: 0.7 };
      for (const r of [a, b]) { seedAnchorNode(r.db, 'cmd:' + A, 'command'); seedAnchorNode(r.db, 'framework:Six Thinking Hats', 'framework'); }
      const args = (r) => ({ pick, offer, reason: 'REJECTED_BECAUSE x', roomState: { db: r.db, roomDir: r.dir } });
      const off = withEnv({ MINDRIAN_SELECTION_LOG: 'off' }, () => closer.closeOffer(args(a)));
      const on = closer.closeOffer(args(b));
      assert.equal(off.ok, true, JSON.stringify(off));
      assert.equal(norm(on), norm(off));
      assert.equal(selRows(a.db).length, 0);
      const rows = selRows(b.db);
      assert.equal(rows.length, 1, pick);
      assert.equal(rows[0].decision, pick);
      assert.equal(rows[0].shown_command, A);
      assert.equal(rows[0].chosen_command, null);
    } finally { closeRoomDb(a.db); closeRoomDb(b.db); }
  }
});

check('K2 the Free-Text route writes no selection row', () => {
  const r = scratchRoom();
  try {
    const out = closer.closeOffer({ pick: 'Free-Text', offer: { command: A }, user_intent: 'do something else', roomState: { db: r.db, roomDir: r.dir } });
    assert.equal(out.ok, true);
    assert.equal(selRows(r.db).length, 0);
  } finally { closeRoomDb(r.db); }
});

check('K3 shown_commands come from args, else offer.command, else roomState.offer.command, else a decision-only row', () => {
  const r = scratchRoom();
  try {
    closer.closeOffer({ pick: 'accept', offer: { command: A }, shown_commands: [B, C], roomState: { db: r.db, roomDir: r.dir } });
    assert.deepEqual(selRows(r.db).map((x) => x.shown_command), [B, C]);
    assert.equal(selRows(r.db)[0].chosen_command, B);
  } finally { closeRoomDb(r.db); }
  const r2 = scratchRoom();
  try {
    closer.closeOffer({ pick: 'accept', offer: { command: 'mos:explore-domains' }, roomState: { db: r2.db, roomDir: r2.dir, offer: { command: C } } });
    assert.deepEqual(selRows(r2.db).map((x) => x.shown_command), [C]);
  } finally { closeRoomDb(r2.db); }
  const r3 = scratchRoom();
  try {
    closer.closeOffer({ pick: 'accept', offer: { command: 'mos:explore-domains' }, roomState: { db: r3.db, roomDir: r3.dir } });
    const rows = selRows(r3.db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].shown_command, null);
    assert.equal(rows[0].decision, 'accept');
  } finally { closeRoomDb(r3.db); }
});

check('K4 no db, the kill switch or a writer error leaves closeOffer as at base and never throws', () => {
  const offer = { command: A, framework: 'Six Thinking Hats' };
  const noDbOff = withEnv({ MINDRIAN_SELECTION_LOG: 'off' }, () => closer.closeOffer({ pick: 'accept', offer, roomState: {} }));
  const noDb = closer.closeOffer({ pick: 'accept', offer, roomState: {} });
  assert.deepEqual(noDb, noDbOff);
  const noDbDefer = closer.closeOffer({ pick: 'defer', offer, roomState: {} });
  assert.equal(noDbDefer.ok, false);
  assert.equal(noDbDefer.reason, 'invalid_db');
  const r = scratchRoom();
  const original = navigation.recordSelectionOutcome;
  try {
    const base = withEnv({ MINDRIAN_SELECTION_LOG: 'off' }, () => closer.closeOffer({ pick: 'accept', offer, roomState: { db: r.db, roomDir: r.dir } }));
    navigation.recordSelectionOutcome = () => { throw new Error('forced writer failure'); };
    const out = closer.closeOffer({ pick: 'accept', offer, roomState: { db: r.db, roomDir: r.dir } });
    assert.deepEqual(out, base);
    assert.equal(selRows(r.db).length, 0);
  } finally { navigation.recordSelectionOutcome = original; closeRoomDb(r.db); }
});

check('K4b WR-01 a decision that failed to persist writes no selection or calibration row', () => {
  const r = scratchRoom();
  try {
    // offer without a command: recordSelectorDecision refuses with invalid_command
    const out = closer.closeOffer({ pick: 'reject', offer: {}, shown_commands: [A, B], roomState: { db: r.db, roomDir: r.dir } });
    assert.equal(out.ok, false, JSON.stringify(out));
    assert.equal(selRows(r.db).length, 0, 'no selection row for a failed decision');
    assert.equal(rowsOf(r.db, 'calibration_observations').length, 0, 'no calibration row for a failed decision');
  } finally { closeRoomDb(r.db); }
});

check('K4c WR-02 a replayed CLI close writes no second set of rows (explicit key, and the replay window)', () => {
  const r = scratchRoom();
  try {
    const offer = { command: A, framework: 'Six Thinking Hats', confidence: 0.7 };
    // no key: the same decision twice in a row is one decision
    closer.closeOffer({ pick: 'accept', offer, roomState: { db: r.db, roomDir: r.dir } });
    closer.closeOffer({ pick: 'accept', offer, roomState: { db: r.db, roomDir: r.dir } });
    assert.equal(selRows(r.db).length, 1, 'identical close inside the window writes once');
    // a different decision on the same offer is a new decision
    seedAnchorNode(r.db, 'cmd:' + A, 'command'); seedAnchorNode(r.db, 'framework:Six Thinking Hats', 'framework');
    closer.closeOffer({ pick: 'reject', offer, reason: 'REJECTED_BECAUSE x', roomState: { db: r.db, roomDir: r.dir } });
    assert.equal(selRows(r.db).length, 2);
    // explicit key: exact dedupe, even for a different shown command set
    const k = (cmds) => closer.closeOffer({ pick: 'accept', offer, shown_commands: cmds, dedupe_key: 'offer-1', roomState: { db: r.db, roomDir: r.dir } });
    k([B, C]);
    k([B, C]);
    assert.equal(selRows(r.db).length, 4, 'one keyed decision of 2 shown options adds 2 rows');
    assert.ok(selRows(r.db).filter((x) => x.gate_id).length === 2);
  } finally { closeRoomDb(r.db); }
  // outside the window the same decision is a new decision
  const r2 = scratchRoom();
  try {
    const offer = { command: A, framework: 'Six Thinking Hats', confidence: 0.7 };
    closer.closeOffer({ pick: 'accept', offer, roomState: { db: r2.db, roomDir: r2.dir } });
    r2.db.exec('UPDATE selection_observations SET created_at = created_at - 60000');
    closer.closeOffer({ pick: 'accept', offer, roomState: { db: r2.db, roomDir: r2.dir } });
    assert.equal(selRows(r2.db).length, 2);
  } finally { closeRoomDb(r2.db); }
});

// ---------------------------------------------------------------------------
// K5-K7: the MCP gate answer.
// ---------------------------------------------------------------------------
const gateModule = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));

function makeFakeServer() {
  const registered = [];
  return {
    registerTool(name, config, handler) {
      const cfg = config || {};
      registered.push({ name, description: cfg.description, handler });
    },
    _registered: registered,
    server: { getClientCapabilities() { return {}; } },
  };
}

(async function main() {
  const home = fs.mkdtempSync(path.join(TMP, 'gate-home-'));
  const roomDir = path.join(home, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  const boot = openRoomDb(roomDir);
  closeRoomDb(boot);
  const prevRoom = process.env.CLAUDE_ACTIVE_ROOM;
  const prevSession = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CLAUDE_ACTIVE_ROOM = roomDir;
  delete process.env.CLAUDE_CODE_SESSION_ID;

  const fake = makeFakeServer();
  gateModule.register(fake, { fallbackRoomDir: roomDir, surface: 'cli' });
  const renderEntry = fake._registered.find((r) => r.name === 'gate_render');
  const answerEntry = fake._registered.find((r) => r.name === 'gate_answer');

  async function mint(options) {
    const res = await renderEntry.handler({ options }, {});
    return JSON.parse(res.content[0].text);
  }
  async function answer(gateId, chosen, verdict) {
    const res = await answerEntry.handler({ gate_id: gateId, chosen, verdict }, {});
    const parsed = JSON.parse(res.content[0].text);
    return { parsed, isError: !!res.isError, raw: res.content[0].text };
  }
  function gateRows() {
    const db = navigation.openRoomDbForCaller(roomDir);
    try { return rowsOf(db, 'selection_observations'); } finally { navigation.closeRoomDbForCaller(db); }
  }
  const CMD_OPTIONS = [{ id: A, label: 'Run think-hats' }, { id: B, label: 'Run persona' }];
  const PLAIN_OPTIONS = [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }];
  const normResp = (r, gateId) => norm(r.parsed).split(gateId).join('GATE').replace(/gate:[A-Za-z0-9:_.-]+/g, 'GATE');

  try {
    await checkAsync('K5 approve over a command card writes mcp rows after the answer commits; response equals the log-off response', async () => {
      const cardOff = await mint(CMD_OPTIONS);
      const off = await withEnv({ MINDRIAN_SELECTION_LOG: 'off' }, () => answer(cardOff.gate_id, [A], 'approve'));
      assert.equal(off.parsed.ok, true, off.raw);
      assert.equal(gateRows().length, 0, 'log off writes nothing');
      const cardOn = await mint(CMD_OPTIONS);
      const on = await answer(cardOn.gate_id, [A], 'approve');
      assert.equal(on.parsed.ok, true, on.raw);
      assert.equal(normResp(on, cardOn.gate_id), normResp(off, cardOff.gate_id));
      const rows = gateRows();
      assert.equal(rows.length, 2);
      assert.deepEqual(rows.map((r) => r.shown_command), [A, B]);
      assert.deepEqual(rows.map((r) => r.surface), ['mcp', 'mcp']);
      assert.deepEqual(rows.map((r) => r.decision), ['accept', 'accept']);
      assert.equal(rows[0].chosen_command, A);
      assert.deepEqual(rows.map((r) => r.ground_truth_label), [1, 0]);
    });

    await checkAsync('K5 reject and defer verdicts map to reject and defer; a card with a non-command option writes nothing', async () => {
      const before = gateRows().length;
      const c1 = await mint(CMD_OPTIONS);
      const r1 = await answer(c1.gate_id, [B], 'reject');
      assert.equal(r1.parsed.ok, true, r1.raw);
      const c2 = await mint(CMD_OPTIONS);
      const r2 = await answer(c2.gate_id, [A], 'defer');
      assert.equal(r2.parsed.ok, true, r2.raw);
      const rows = gateRows().slice(before);
      assert.equal(rows.length, 4);
      assert.deepEqual(rows.map((r) => r.decision), ['reject', 'reject', 'defer', 'defer']);
      const mid = gateRows().length;
      const c3 = await mint(PLAIN_OPTIONS);
      const r3 = await answer(c3.gate_id, ['approve'], 'approve');
      assert.equal(r3.parsed.ok, true, r3.raw);
      const c4 = await mint([{ id: A, label: 'Run think-hats' }, { id: 'something-else', label: 'Something else' }]);
      const r4 = await answer(c4.gate_id, [A], 'approve');
      assert.equal(r4.parsed.ok, true, r4.raw);
      assert.equal(gateRows().length, mid);
    });

    await checkAsync('K6 a replayed answer writes no new rows; the writer dedupes on (surface, gate_id)', async () => {
      const c = await mint(CMD_OPTIONS);
      const first = await answer(c.gate_id, [A], 'approve');
      assert.equal(first.parsed.ok, true, first.raw);
      const n1 = gateRows().length;
      const replay = await answer(c.gate_id, [A], 'approve');
      assert.equal(replay.parsed.replayed, true, replay.raw);
      assert.equal(gateRows().length, n1);
      const db = freshDb();
      const one = record(db, { decision: 'accept', shown_commands: [A, B], chosen_command: A, gate_id: 'gate:same', surface: 'mcp' });
      const two = record(db, { decision: 'accept', shown_commands: [A, B], chosen_command: A, gate_id: 'gate:same', surface: 'mcp' });
      assert.equal(one.rows, 2);
      assert.equal(two.ok, true);
      assert.equal(two.rows, 0);
      assert.equal(rowsOf(db, 'selection_observations').length, 2);
      const other = record(db, { decision: 'accept', shown_commands: [A], chosen_command: A, gate_id: 'gate:same', surface: 'cli' });
      assert.equal(other.rows, 1, 'a different surface is a different decision');
      const decisionOnly = record(db, { decision: 'accept', shown_commands: [], gate_id: 'gate:d', surface: 'mcp' });
      const decisionOnly2 = record(db, { decision: 'accept', shown_commands: [], gate_id: 'gate:d', surface: 'mcp' });
      assert.equal(decisionOnly.rows, 1);
      assert.equal(decisionOnly2.rows, 0);
    });

    await checkAsync('K7 a forced writer throw leaves the response, the committed answer and the gate release unchanged', async () => {
      const cardOff = await mint(CMD_OPTIONS);
      const off = await withEnv({ MINDRIAN_SELECTION_LOG: 'off' }, () => answer(cardOff.gate_id, [A], 'approve'));
      const before = gateRows().length;
      const original = navigation.recordSelectionOutcome;
      navigation.recordSelectionOutcome = () => { throw new Error('forced writer failure'); };
      let thrown;
      try {
        thrown = await mint(CMD_OPTIONS);
        const res = await answer(thrown.gate_id, [A], 'approve');
        assert.equal(res.parsed.ok, true, res.raw);
        assert.equal(normResp(res, thrown.gate_id), normResp(off, cardOff.gate_id));
      } finally { navigation.recordSelectionOutcome = original; }
      assert.equal(gateRows().length, before, 'the forced failure wrote nothing');
      const again = await answer(thrown.gate_id, [A], 'approve');
      assert.equal(again.parsed.replayed, true, again.raw);
    });
  } finally {
    if (prevRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = prevRoom;
    if (prevSession !== undefined) process.env.CLAUDE_CODE_SESSION_ID = prevSession;
  }

  console.log('\ntest-399-selection-log: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) { console.log('>>> test-399-selection-log.cjs: FAILED'); process.exit(1); }
  console.log('>>> test-399-selection-log.cjs: PASSED');
  process.exit(0);
})();
