#!/usr/bin/env node
'use strict';
// Phase 400 plan 10 (CY-07): the selection log records the room's cause and effect domain.
//
// Legs L1 to L5:
//   L1 a room.db made with the 399 selection table (built here from the 399 column list) gains the
//      cause_effect_domain column on the next schema call; a second call is a no-op; a lost migration
//      race (another process added the column first) is not an error; a new table has the column.
//   L2 recordSelectionOutcome writes args.causeEffect when it is a closed domain; with no arg it reads
//      problem.cause_effect from the same db; with neither it writes null; a value outside the closed
//      set writes null.
//   L3 cynefin_rating is still written exactly as in 399 for the same inputs (deprecated alias, one release).
//   L4 the CLI closeOffer and MCP gate_answer legs of tests/test-399-selection-log.cjs keep their result.
//   L5 the schema drift guard accepts the new statements, and aliases.yml registers the column (EXTEND).
// Node built-ins only, no network. Hyphens only in this file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
delete process.env.MINDRIAN_SELECTION_LOG;

let DatabaseSync;
let memoryOps;
let navigation;
try {
  ({ DatabaseSync } = require('node:sqlite'));
  memoryOps = require(path.join(ROOT, 'lib', 'core', 'memory-ops.cjs'));
  navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
} catch (e) {
  console.log('SKIP: test-400-selection-domain: node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of Object.keys(vars)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-400-10-sel-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

const COL = 'cause_effect_domain';
const JOB = 'decide-pursue';
const A = '/mos:think-hats';
const B = '/mos:persona';
const TABLE = path.join(TMP, 'table.json');
fs.writeFileSync(TABLE, JSON.stringify({
  schema: 'fixture', table_version: '400-10-fixture', key_order: ['job', 'definition_level', 'last_command'],
  thresholds: { strong: 0.7, possible: 0.5 }, shortlist_k: 3,
  rows: { [JOB + '|*|*']: [{ command: A, calibrated: 0.9 }, { command: B, calibrated: 0.6 }] },
}));
const ON = { MINDRIAN_DECISION_ADVISOR: 'on', MINDRIAN_DECISION_ADVISOR_TABLE: TABLE };

// The 399 column list of selection_observations (plan base c1e496ae8), in order.
const COLS_399 = [
  ['id', 'TEXT PRIMARY KEY'], ['decision_id', 'TEXT NOT NULL'], ['created_at', 'INTEGER'], ['surface', 'TEXT'],
  ['table_version', 'TEXT'], ['key_used', 'TEXT'], ['job_id', 'TEXT'], ['definition_level', 'TEXT'], ['wicked', 'INTEGER'],
  ['cynefin_rating', 'INTEGER'], ['last_command', 'TEXT'], ['shown_command', 'TEXT'], ['shown_rank', 'INTEGER'],
  ['advisor_rank', 'INTEGER'], ['calibrated_p', 'REAL'], ['band', 'TEXT'], ['no_strong_pick', 'INTEGER'],
  ['decision', 'TEXT NOT NULL'], ['chosen_command', 'TEXT'], ['offered_command', 'TEXT'], ['advisor_top', 'TEXT'],
  ['overrule_by', 'TEXT'], ['ground_truth_label', 'INTEGER'], ['calibration_observation_id', 'TEXT'], ['gate_id', 'TEXT'],
];
function db399(file) {
  const db = new DatabaseSync(file || ':memory:');
  db.exec('CREATE TABLE selection_observations (' + COLS_399.map((c) => c[0] + ' ' + c[1]).join(', ') + ')');
  db.prepare('INSERT INTO selection_observations (id, decision_id, decision) VALUES (?, ?, ?)').run('old-row', 'old-decision', 'accept');
  return db;
}
const colNames = (db) => db.prepare('PRAGMA table_info(selection_observations)').all().map((c) => c.name);
function freshDb() {
  const db = new DatabaseSync(':memory:');
  memoryOps.initMemorySchema(db);
  return db;
}
function storeDomain(db, domain) {
  db.exec('BEGIN');
  const w = navigation.writeCauseEffect(db, { domain, gateId: 'g-400-10', decisionNodeId: 'decision:gate:g-400-10' });
  db.exec('COMMIT');
  assert.equal(w.ok, true, 'fixture: domain stored');
}
// A unique dedupe key per call keeps each call outside the replay window dedupe (WR-02).
let callNo = 0;
function record(db, args, env) {
  callNo += 1;
  const r = withEnv(env || ON, () => navigation.recordSelectionOutcome(db, Object.assign({ surface: 'cli', jobId: JOB, decision: 'accept', shown_commands: [A, B], chosen_command: A, dedupe_key: 'l-' + callNo }, args)));
  assert.ok(r && r.ok === true && typeof r.decision_id === 'string', 'the call wrote rows: ' + JSON.stringify(r));
  return r;
}
const domainOf = (db, decisionId) => db.prepare('SELECT ' + COL + ' AS d FROM selection_observations WHERE decision_id = ?').all(decisionId).map((r) => r.d);

check('L1 a 399 selection table gains the column on the next schema call; a second call is a no-op', () => {
  const file = path.join(TMP, 'l1-room.db');
  const db = db399(file);
  assert.equal(colNames(db).indexOf(COL), -1, 'the 399 table has no domain column');
  memoryOps.initSelectionSchema(db);
  const after = colNames(db);
  assert.equal(after[after.length - 1], COL, 'the column is added at the end');
  assert.equal(after.length, COLS_399.length + 1);
  memoryOps.initSelectionSchema(db);
  assert.deepEqual(colNames(db), after, 'a second call changes nothing');
  assert.equal(db.prepare('SELECT ' + COL + ' AS d FROM selection_observations WHERE id = ?').get('old-row').d, null, 'an old row keeps null');
  db.close();
  // The writer path: a 399 room.db, a new handle, the first recordSelectionOutcome migrates it.
  const file2 = path.join(TMP, 'l1-writer.db');
  const db2 = db399(file2);
  memoryOps.initMemorySchema(db2);
  const r = record(db2, { causeEffect: 'complicated' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(domainOf(db2, r.decision_id), ['complicated', 'complicated']);
  db2.close();
});

check('L1b a lost migration race (the column appeared after the check) is not an error; a new table has the column', () => {
  const real = db399();
  real.exec('ALTER TABLE selection_observations ADD COLUMN ' + COL + ' TEXT');
  let pragmaCalls = 0;
  let alterFailed = false;
  const stale = {
    exec(sql) {
      try { return real.exec(sql); } catch (e) { if (/ALTER TABLE/i.test(sql)) alterFailed = true; throw e; }
    },
    prepare(sql) {
      const st = real.prepare(sql);
      if (!/PRAGMA table_info\(selection_observations\)/.test(sql)) return st;
      pragmaCalls += 1;
      if (pragmaCalls > 1) return st;
      // The first look is stale: another process adds the column after it.
      return { all: () => st.all().filter((c) => c.name !== COL) };
    },
  };
  memoryOps.initSelectionSchema(stale);
  assert.equal(alterFailed, true, 'the duplicate column statement failed as in a real race');
  assert.ok(pragmaCalls >= 2, 'the schema looks again after the failure');
  real.close();
  const fresh = new DatabaseSync(':memory:');
  memoryOps.initSelectionSchema(fresh);
  assert.ok(colNames(fresh).indexOf(COL) !== -1, 'a new table has the column');
  assert.equal(colNames(fresh)[colNames(fresh).length - 1], COL, 'new and migrated tables share the column order');
  fresh.close();
});

check('L2 explicit closed domain, else the stored domain, else null; a value outside the closed set writes null', () => {
  const db = freshDb();
  let r = record(db, { causeEffect: 'complex' });
  assert.deepEqual(domainOf(db, r.decision_id), ['complex', 'complex']);
  r = record(db, {});
  assert.deepEqual(domainOf(db, r.decision_id), [null, null], 'neither: null');
  storeDomain(db, 'clear');
  r = record(db, { shown_commands: [B, A], chosen_command: B });
  assert.deepEqual(domainOf(db, r.decision_id), ['clear', 'clear'], 'no arg: the stored domain of the same db');
  r = record(db, { causeEffect: 'chaotic', shown_commands: [A], chosen_command: A });
  assert.deepEqual(domainOf(db, r.decision_id), ['chaotic'], 'the explicit domain wins over the stored one');
  for (const bad of ['Complex', 'wicked', 'clear; DROP', 3, {}, '']) {
    r = record(db, { causeEffect: bad, shown_commands: [B], chosen_command: B, decision: 'accept', surface: 'mcp', gate_id: 'gate-' + JSON.stringify(bad) });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(domainOf(db, r.decision_id), [null], 'outside the closed set: ' + JSON.stringify(bad));
  }
  // Advisor off: the log still writes the domain (the log stays on, WR-06).
  r = record(db, { shown_commands: [A, B], chosen_command: B, decision: 'reject' }, { MINDRIAN_DECISION_ADVISOR: undefined, MINDRIAN_DECISION_ADVISOR_TABLE: undefined });
  assert.deepEqual(domainOf(db, r.decision_id), ['clear', 'clear']);
  db.close();
});

check('L3 cynefin_rating is written exactly as in 399 for the same inputs', () => {
  const rows = (db, id) => db.prepare('SELECT cynefin_rating AS c, wicked AS w, definition_level AS l FROM selection_observations WHERE decision_id = ? ORDER BY rowid').all(id).map((x) => [x.c, x.w, x.l]);
  for (const args of [{ cynefinRating: 2, wicked: true, definitionLevel: 'ill-defined' }, { cynefinRating: 0 }, { cynefinRating: 7 }, {}]) {
    const a = freshDb();
    const b = freshDb();
    storeDomain(b, 'complex');
    const ra = record(a, args);
    const rb = record(b, Object.assign({ causeEffect: 'complex' }, args));
    assert.deepEqual(rows(b, rb.decision_id), rows(a, ra.decision_id), JSON.stringify(args));
    assert.deepEqual(domainOf(b, rb.decision_id), ['complex', 'complex']);
    a.close();
    b.close();
  }
  const a = freshDb();
  const r = record(a, { cynefinRating: 2 });
  assert.deepEqual(a.prepare('SELECT cynefin_rating AS c FROM selection_observations WHERE decision_id = ?').all(r.decision_id).map((x) => x.c), [2, 2]);
  a.close();
});

check('L4 the 399 selection log legs (closeOffer and gate_answer) keep their result', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'test-399-selection-log.cjs')], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  assert.equal(r.status, 0, (r.stdout || '').split('\n').filter((l) => /FAIL/.test(l)).join('\n') + (r.stderr || ''));
  for (const leg of ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7']) {
    assert.ok(new RegExp('^ok: ' + leg + '\\b', 'm').test(r.stdout), 'leg ' + leg + ' ran and passed');
  }
});

check('L5 the schema drift guard accepts the new statements, and aliases.yml registers the column with EXTEND', () => {
  const guard = require(path.join(ROOT, 'scripts', 'check-schema-aliases.cjs'));
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'memory-ops.cjs'), 'utf8');
  const start = src.indexOf('function initSelectionSchema');
  const end = src.indexOf('\n}\n', start);
  assert.ok(start !== -1 && end !== -1, 'initSelectionSchema found');
  const body = src.slice(start, end);
  assert.ok(body.indexOf(COL + ' TEXT') !== -1, 'the table definition names the column');
  assert.deepEqual(guard.checkSqlAgainstAliases(body, 'lib/core/memory-ops.cjs'), []);
  const y = guard.parseAliasesYaml(fs.readFileSync(path.join(ROOT, '.planning', 'phases', '108-graph-memory-schema-reconciliation', 'aliases.yml'), 'utf8'));
  const e = y.node_aliases.find((n) => n && n.codex_term === 'selection_observations_cause_effect_domain');
  assert.ok(e, 'the alias entry exists');
  assert.equal(e.resolution, 'EXTEND');
  assert.equal(e.canonical_name, 'selection_observations');
  assert.equal(String(e.source_phase), '400');
  const staged = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-schema-aliases.cjs')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(staged.status, 0, staged.stderr);
});

console.log('test-400-selection-domain: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
