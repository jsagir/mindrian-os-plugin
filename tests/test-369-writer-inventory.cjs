#!/usr/bin/env node
'use strict';

/**
 * Phase 369-11 (CHG369-04, D-18) -- writer-inventory coverage matrix.
 *
 * D-18 says coverage of the change log is proven against a writer INVENTORY
 * (tests/fixtures/369/writer-inventory.json), never against a list of chokepoint
 * functions. Capture is structural (six triggers on nodes and edges), but
 * "structural" is a claim until each row of the inventory has been watched
 * writing a log row. This test drives every in-process row (N1-N5, U1-U8,
 * E1-E4, D1-D4) through its REAL function on a fixture room and asserts at
 * least one room_change_log row of the expected entity_type and operation whose
 * entity_id is the entity the function wrote.
 *
 * Arms per row, where they apply:
 *   - drive:    the real function on a migrated fixture room
 *   - rollback: the same function inside an outer BEGIN IMMEDIATE that rolls
 *               back; rows exist inside the transaction, zero after. Rows whose
 *               function opens its own handle, or owns an unconditional BEGIN,
 *               are marked n/a with the reason (never skipped silently).
 *   - second:   INSERT OR IGNORE rows (N4, N5, E2) driven twice; the ignored
 *               statement logs zero rows the second time
 *   - exclusion: a write to a non-graph table (facts) logs nothing
 *   - scan:     a live wide-regex scan of lib, scripts, bin and hooks; per-file
 *               counts must equal the fixture's per_file_statement_counts, so a
 *               writer added later fails here instead of escaping the feed
 *
 * The cross-process rows (U9, E5, E6, P1, R1) are plan 12's
 * tests/test-369-change-log-cross-process.cjs; M1 is also asserted here (a
 * write-door open of a legacy room reinstalls the triggers after the table
 * rebuild) and in test-369-change-log-ddl.cjs scenario 7.
 *
 * Canon Part 9: this test reads through raw handles on throwaway fixtures only
 * (tests/ is allow-listed by the substrate guard); every WRITE goes through the
 * product's own functions. Canon Part 8: no network, no Brain. Hermetic HOME.
 * No literal em-dashes or en-dashes (escapes only). CJS.
 */

// Hermetic environment BEFORE anything else loads.
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-writer-inv-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { DatabaseSync } = require('node:sqlite');
const REPO = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const changeLog = require(path.join(REPO, 'lib', 'core', 'navigation', 'room-change-log.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const graphOps = require(path.join(REPO, 'lib', 'core', 'graph-ops.cjs'));
const roomBirth = require(path.join(REPO, 'lib', 'core', 'navigation', 'room-birth.cjs'));
const ingestion = require(path.join(REPO, 'lib', 'core', 'navigation', 'ingestion.cjs'));
const typedEntity = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-entity.cjs'));
const transitions = require(path.join(REPO, 'lib', 'core', 'navigation', 'transitions.cjs'));
const grantRubric = require(path.join(REPO, 'lib', 'core', 'navigation', 'grant-rubric.cjs'));
const abstractionClaim = require(path.join(REPO, 'lib', 'core', 'navigation', 'abstraction-claim.cjs'));
const typedFrame = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-frame.cjs'));
const typedDomain = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-domain.cjs'));
const breakthroughSchema = require(path.join(REPO, 'lib', 'core', 'breakthrough', 'schema.cjs'));
const verbDispatch = require(path.join(REPO, 'lib', 'core', 'breakthrough', 'verb-dispatch.cjs'));
const scanner = require(path.join(REPO, 'lib', 'core', 'breakthrough', 'scanner.cjs'));
const rsEngine = require(path.join(REPO, 'lib', 'core', 'rs-engine.cjs'));
const rsMirror = require(path.join(REPO, 'lib', 'core', 'rs-sqlite-mirror.cjs'));
const memoryOps = require(path.join(REPO, 'lib', 'core', 'memory-ops.cjs'));
const { buildRoom369 } = require('./helpers/fixture-room-369.cjs');

const INVENTORY_PATH = path.join(__dirname, 'fixtures', '369', 'writer-inventory.json');
const INVENTORY = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
const SEP = String.fromCharCode(31);
const SELF = 'test-369-writer-inventory.cjs';

let roomCounter = 0;
let passed = 0;
let failed = 0;
const report = new Map(); // row id -> { fn, rows, rollback, second, result }
const driven = new Set(); // row ids this run actually drove

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
async function scenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

function note(id, patch) {
  const cur = report.get(id) || { fn: '', rows: 0, rollback: '-', second: '-', result: '' };
  report.set(id, Object.assign(cur, patch));
  driven.add(id);
}

function freshRoom(variant, migrate) {
  roomCounter += 1;
  const tmpDir = path.join(HERMETIC, 'rooms', 'r' + roomCounter);
  return buildRoom369({
    tmpDir,
    slug: 'r' + roomCounter,
    variant: variant || 'wide',
    migrate: migrate !== false,
  });
}

async function withDb(room, fn) {
  const db = openRoomDb(room.roomDir);
  try { return await fn(db); } finally { closeRoomDb(db); }
}

// A second, read-only handle used when the function under test opens its own.
function observe(room, fn) {
  const obs = new DatabaseSync(room.dbPath, { readOnly: true });
  try { return fn(obs); } finally { obs.close(); }
}

function maxSeq(db) { return changeLog.readChangeLogMeta(db).latest_seq; }

function rowsSince(db, seq) {
  return db.prepare(
    'SELECT change_seq, entity_type, entity_id, operation, transaction_id ' +
    'FROM room_change_log WHERE change_seq > ? ORDER BY change_seq'
  ).all(seq);
}

// logDelta(db, fn): new log rows written while fn ran (fn may be async). The
// handle is the one the writer used (or a read-only observer).
async function logDelta(db, fn) {
  const before = maxSeq(db);
  const result = await fn();
  return { rows: rowsSince(db, before), result, before };
}

// For writers that open their own handle: observe on a fresh read-only handle.
async function logDeltaOwn(room, fn) {
  const before = observe(room, maxSeq);
  const result = await fn();
  const rows = observe(room, (obs) => rowsSince(obs, before));
  return { rows, result, before };
}

const edgeKey = (s, t, type) => [s, type, t].join(SEP);
const nodeRows = (rows, id) => rows.filter((r) => r.entity_type === 'node' && r.entity_id === id);
const edgeRows = (rows, s, t, type) => rows.filter((r) => r.entity_type === 'edge' && r.entity_id === edgeKey(s, t, type));

function expectUpsert(rows, kind, id, min, label) {
  const hit = rows.filter((r) => r.entity_type === kind && r.entity_id === id && r.operation === 'upsert');
  assert.ok(hit.length >= (min || 1), (label || kind + ' ' + id) + ': expected at least ' + (min || 1) +
    ' upsert row(s), got ' + hit.length + ' of ' + rows.length + ' new rows: ' + JSON.stringify(rows.map((r) => r.entity_type + ':' + r.entity_id + ':' + r.operation)));
  return hit;
}
function expectDelete(rows, kind, id, label) {
  const hit = rows.filter((r) => r.entity_type === kind && r.entity_id === id && r.operation === 'delete');
  assert.ok(hit.length >= 1, (label || kind + ' ' + id) + ': expected a delete row, got new rows: ' +
    JSON.stringify(rows.map((r) => r.entity_type + ':' + r.entity_id + ':' + r.operation)));
  return hit;
}

// rollbackArm(db, fn): fn runs inside an outer BEGIN IMMEDIATE. Rows must exist
// inside the transaction (so the arm is meaningful) and be gone after ROLLBACK.
async function rollbackArm(db, fn) {
  const before = maxSeq(db);
  db.exec('BEGIN IMMEDIATE');
  let inside = 0;
  try {
    await fn();
    inside = rowsSince(db, before).length;
  } finally {
    try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
  }
  assert.ok(inside > 0, 'rollback arm is vacuous: the writer logged no rows inside the outer transaction');
  assert.equal(rowsSince(db, before).length, 0, 'rolled back writer left log rows behind');
  assert.equal(maxSeq(db), before, 'rolled back writer moved the sequence high-water mark');
  return inside;
}

// Seed n proposed claim nodes through the navigation writer; returns node ids.
function seedClaims(db, n, tag) {
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    const res = navigation.writeClaimNode(db, {
      knowledge_type: 'fact',
      text: 'inventory claim ' + (tag || 'x') + ' ' + i + ' ' + roomCounter,
      sessionId: 'inv-369-' + (tag || 'x') + '-' + i,
    });
    assert.ok(res && res.ok === true, 'claim seed failed: ' + JSON.stringify(res));
    ids.push(res.node_id);
  }
  return ids;
}

function writeArtifact(roomDir, section, name, body) {
  const dir = path.join(roomDir, section);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.md');
  fs.writeFileSync(file, '# ' + name + '\n\n' + (body || 'Synthetic inventory artifact for ' + name + '.') + '\n');
  return file;
}

// A room whose nodes/edges schema is NOT migrated (mid and legacy variants),
// with the change log installed on a raw handle so insertNode's 3-column branch
// and writeEdge's 4-column branch can be watched.
function rawInstalled(variant) {
  const room = freshRoom(variant, false);
  const db = new DatabaseSync(room.dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS identity (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
  changeLog.installChangeLog(db);
  return { room, db };
}

const PROPS = JSON.stringify({ from: 'writer-inventory' });

// ---------------------------------------------------------------------------
// N rows
// ---------------------------------------------------------------------------

async function nodeRowsMatrix() {
  await scenario('N1 insertNode: wide through the write door, upsert logged, rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const { rows } = await logDelta(db, () => insertNode(db, 'n1:wide', 'Artifact', PROPS, { epistemic_type: 'observation' }));
      expectUpsert(rows, 'node', 'n1:wide');
      const again = await logDelta(db, () => insertNode(db, 'n1:wide', 'Artifact', PROPS, { epistemic_type: 'observation' }));
      expectUpsert(again.rows, 'node', 'n1:wide');
      const nothing = await logDelta(db, () => insertNode(db, 'n1:wide', 'Artifact', PROPS, { epistemic_type: 'observation', on_conflict: 'nothing' }));
      assert.equal(nothing.rows.length, 0, 'ON CONFLICT DO NOTHING must log zero rows');
      const inside = await rollbackArm(db, () => insertNode(db, 'n1:wide:rb', 'Artifact', PROPS, { epistemic_type: 'observation' }));
      assert.ok(inside >= 1);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id = 'n1:wide:rb'").get().n, 0);
      note('N1', { fn: 'insertNode (wide)', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  for (const variant of ['mid', 'legacy']) {
    await scenario('N1 insertNode: ' + variant + ' schema, 3-column branch (raw handle, installer run) logs an upsert', async () => {
      const { db } = rawInstalled(variant);
      try {
        const { rows } = await logDelta(db, () => insertNode(db, 'n1:' + variant, 'Artifact', PROPS, { epistemic_type: 'observation' }));
        expectUpsert(rows, 'node', 'n1:' + variant, 1, variant + ' insert');
        const again = await logDelta(db, () => insertNode(db, 'n1:' + variant, 'Artifact', '{"v":2}', { epistemic_type: 'observation' }));
        expectUpsert(again.rows, 'node', 'n1:' + variant, 1, variant + ' conflict update');
        const inside = await rollbackArm(db, () => insertNode(db, 'n1:' + variant + ':rb', 'Artifact', PROPS, { epistemic_type: 'observation' }));
        assert.ok(inside >= 1);
        note('N1', { fn: 'insertNode (wide, mid, legacy)', rows: rows.length });
      } finally { db.close(); }
    });
    await scenario('N1 insertNode: ' + variant + ' schema through the write door (migrated) logs an upsert', async () => {
      const room = freshRoom(variant);
      await withDb(room, async (db) => {
        const { rows } = await logDelta(db, () => insertNode(db, 'n1:m:' + variant, 'Artifact', PROPS, { epistemic_type: 'observation' }));
        expectUpsert(rows, 'node', 'n1:m:' + variant);
      });
    });
  }

  await scenario('N2 logEvent via navigation.logMemoryEvent: the memory_event node IS logged; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const { rows, result } = await logDelta(db, () => navigation.logMemoryEvent(db, 'birth_gate_answered', { gate_id: 'g-n2' }));
      assert.equal(result.ok, true);
      expectUpsert(rows, 'node', result.eventId);
      const inside = await rollbackArm(db, () => navigation.logMemoryEvent(db, 'birth_gate_answered', { gate_id: 'g-n2-rb' }));
      note('N2', { fn: 'logEvent', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  await scenario('N3 rs-sqlite-mirror writeDiscovery (bulk exclusion): every node it writes is logged', async () => {
    const room = freshRoom('wide');
    const pair = {
      query_concept: 'delivery vehicle',
      doc_concept: 'targeting surface',
      diff: 0.4,
      lsa: 0.5,
      bert: 0.1,
      passes: true,
      classification: 'structural_transfer',
      bridge_concept: 'shared structure',
      breakthrough: { score: 5.9, breakdown: { feasibility: 2, market: 1.5, magnitude: 1, advantage: 1.4, impact: 0 }, dominant_dimension: 'feasibility' },
      thesis: 'Transferring the delivery structure to the targeting surface gives a feasible novel transfer through the shared structure.',
    };
    const ids = rsMirror._test.buildDeterministicIds(pair);
    const { rows, result } = await logDeltaOwn(room, () => rsMirror.writeDiscovery(pair, { roomDir: room.roomDir }));
    assert.ok(result.wrote_node_count >= 2, 'writeDiscovery wrote at least two nodes');
    const upsertedNodes = rows.filter((r) => r.entity_type === 'node' && r.operation === 'upsert').map((r) => r.entity_id);
    for (const id of [ids.discovery_id, ids.rs_id, ids.innovation_id]) {
      assert.ok(upsertedNodes.includes(id), 'node ' + id + ' written by writeDiscovery has no log row');
    }
    assert.ok(rows.some((r) => r.entity_type === 'edge' && r.operation === 'upsert'), 'its edges are logged too');
    note('N3', { fn: 'writeDiscovery', rows: rows.length, rollback: 'n/a: opens its own handle', result: 'ok' });
  });

  await scenario('N4 spine _emitWithOperatorEdge: INSERT OR IGNORE operator nodes log on insert, nothing when ignored', async () => {
    const room = freshRoom('wide');
    const payload = { from: 'inv-from', to: 'inv-to', write_transition_edge: true, trigger: 'writer-inventory' };
    const first = await logDeltaOwn(room, () => navigation.logOperatorTransition(room.roomDir, payload));
    assert.equal(first.result.ok, true, 'spine emit ok: ' + JSON.stringify(first.result));
    expectUpsert(first.rows, 'node', 'operator:inv-from');
    expectUpsert(first.rows, 'node', 'operator:inv-to');
    expectUpsert(first.rows, 'edge', edgeKey('operator:inv-from', 'operator:inv-to', 'OPERATOR_TRANSITION'));
    const second = await logDeltaOwn(room, () => navigation.logOperatorTransition(room.roomDir, payload));
    const ignored = second.rows.filter((r) => r.entity_type === 'node' && r.entity_id.startsWith('operator:'));
    assert.equal(ignored.length, 0, 'ignored INSERT OR IGNORE must log zero rows, got ' + JSON.stringify(ignored));
    note('N4', {
      fn: '_emitWithOperatorEdge',
      rows: first.rows.length,
      rollback: 'n/a: opens its own handle',
      second: 'second drive: 0 rows (operator nodes ignored)',
      result: 'ok',
    });
  });

  await scenario('N5 room-birth drainBirthGateAnswers: INSERT OR IGNORE anchors log on insert, nothing when ignored; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const [venture] = seedClaims(db, 1, 'n5');
      const answers = [{ gate_id: 'gn5', canonical_verb: 'Approve', option_key: 'a' }];
      const anchor = 'birth_gate:gn5:a';
      const first = await logDelta(db, () => roomBirth.drainBirthGateAnswers(db, room.roomDir, answers, venture));
      assert.equal(first.result.drained, 1);
      expectUpsert(first.rows, 'node', anchor);
      expectUpsert(first.rows, 'edge', edgeKey(venture, anchor, 'FILED_AS_DECISION'));
      const second = await logDelta(db, () => roomBirth.drainBirthGateAnswers(db, room.roomDir, answers, venture));
      assert.equal(nodeRows(second.rows, anchor).length, 0, 'ignored anchor insert must log zero rows');
      // The no-ventureNodeId path writes a stub source node with its own INSERT OR IGNORE.
      const stubFirst = await logDelta(db, () => roomBirth.drainBirthGateAnswers(db, room.roomDir, answers, null));
      expectUpsert(stubFirst.rows, 'node', 'birth_claim:nosession', 1, 'stub source node');
      const stubSecond = await logDelta(db, () => roomBirth.drainBirthGateAnswers(db, room.roomDir, answers, null));
      assert.equal(nodeRows(stubSecond.rows, 'birth_claim:nosession').length, 0, 'ignored stub insert must log zero rows');
      const inside = await rollbackArm(db, () => roomBirth.drainBirthGateAnswers(db, room.roomDir,
        [{ gate_id: 'gn5rb', canonical_verb: 'Defer', option_key: 'b' }], venture));
      note('N5', {
        fn: 'drainBirthGateAnswers',
        rows: first.rows.length,
        rollback: 'rows inside tx: ' + inside + ', after: 0',
        second: 'second drive: 0 rows (anchor and stub ignored)',
        result: 'ok',
      });
    });
  });
}

// ---------------------------------------------------------------------------
// U rows
// ---------------------------------------------------------------------------

async function updateRowsMatrix() {
  await scenario('U1 promoteNodeStatus: direct, via confirmNode (the gate_answer path), under withRoomTx, and composed in a rolled back tx', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const [a, b, c, d] = seedClaims(db, 4, 'u1');
      const direct = await logDelta(db, () => transitions.promoteNodeStatus(db, a, 'proposed', 'needs_evidence', 'navigator', 'inventory'));
      assert.equal(direct.result.ok, true, JSON.stringify(direct.result));
      expectUpsert(direct.rows, 'node', a);
      expectUpsert(direct.rows, 'node', direct.result.eventId);

      const viaConfirm = await logDelta(db, () => navigation.confirmNode(db, b, 'navigator', 'gate_answer path'));
      assert.equal(viaConfirm.result.ok, true, JSON.stringify(viaConfirm.result));
      expectUpsert(viaConfirm.rows, 'node', b);
      assert.equal(db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(b).review_status, 'confirmed');

      const shared = await logDelta(db, () => changeLog.withRoomTx(db, () => navigation.confirmNode(db, c, 'navigator', 'under withRoomTx')));
      assert.ok(shared.rows.length >= 2);
      const txIds = new Set(shared.rows.map((r) => r.transaction_id));
      assert.equal(txIds.size, 1, 'one transaction id for the whole composed write');
      assert.ok([...txIds][0], 'the transaction id is not NULL');

      const inside = await rollbackArm(db, () => {
        const res = navigation.confirmNode(db, d, 'navigator', 'rolled back');
        assert.equal(res.ok, true);
      });
      assert.equal(db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(d).review_status, 'proposed', 'status UPDATE rolled back');
      note('U1', {
        fn: 'promoteNodeStatus',
        rows: direct.rows.length,
        rollback: 'rows inside tx: ' + inside + ', after: 0',
        result: 'ok (direct, confirmNode, withRoomTx)',
      });
    });
  });

  await scenario('U2 writeDomainNode: the taxonomy UPDATE logs a second upsert; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const spec = { domainType: 'domain', name: 'inventory domain', sessionId: 'inv-u2', taxonomy: true };
      const { rows, result } = await logDelta(db, () => typedDomain.writeDomainNode(db, spec));
      assert.equal(result.ok, true, JSON.stringify(result));
      expectUpsert(rows, 'node', result.node_id, 2, 'insert plus confirm UPDATE');
      const again = await logDelta(db, () => typedDomain.writeDomainNode(db, spec));
      expectUpsert(again.rows, 'node', result.node_id, 2, 'second drive, UPDATE branch');
      const inside = await rollbackArm(db, () => typedDomain.writeDomainNode(db, Object.assign({}, spec, { name: 'rb domain' })));
      note('U2', { fn: 'writeDomainNode', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  await scenario('U3 writeFrameNode: the taxonomy UPDATE logs a second upsert; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const spec = { frameKey: 'inventory-frame', sessionId: 'inv-u3', members: [], taxonomy: true };
      const { rows, result } = await logDelta(db, () => typedFrame.writeFrameNode(db, spec));
      assert.equal(result.ok, true, JSON.stringify(result));
      expectUpsert(rows, 'node', result.node_id, 2, 'insert plus confirm UPDATE');
      const again = await logDelta(db, () => typedFrame.writeFrameNode(db, spec));
      expectUpsert(again.rows, 'node', result.node_id, 2, 'second drive, UPDATE branch');
      const inside = await rollbackArm(db, () => typedFrame.writeFrameNode(db, Object.assign({}, spec, { frameKey: 'rb-frame' })));
      note('U3', { fn: 'writeFrameNode', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  await scenario('U4 persistAbstractionLevel: the properties UPDATE logs exactly one upsert; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const [claim, claim2] = seedClaims(db, 2, 'u4');
      const { rows, result } = await logDelta(db, () => abstractionClaim.persistAbstractionLevel(db, { nodeId: claim, abstraction_level: 'structure' }));
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(rows.length, 1);
      expectUpsert(rows, 'node', claim);
      const inside = await rollbackArm(db, () => abstractionClaim.persistAbstractionLevel(db, { nodeId: claim2, abstraction_level: 'instances' }));
      note('U4', { fn: 'persistAbstractionLevel', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  await scenario('U5 writeGrantRubricGraph: criterion node insert plus confirm UPDATE both log; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const section = roomBirth.SECTION_NAMES[0];
      const rubric = { id: 'inv-program', criteria: [{ id: 'c1', category: 'impact', room_section: section }] };
      const { rows, result } = await logDelta(db, () => grantRubric.writeGrantRubricGraph(db, rubric));
      assert.equal(result.ok, true, JSON.stringify(result));
      const crit = 'grant_criterion:inv-program:c1';
      expectUpsert(rows, 'node', crit, 2, 'insert plus confirm UPDATE');
      expectUpsert(rows, 'edge', edgeKey(crit, section, 'MAPS_TO_SECTION'));
      const again = await logDelta(db, () => grantRubric.writeGrantRubricGraph(db, rubric));
      expectUpsert(again.rows, 'node', crit, 2, 'second drive, UPDATE branch');
      const inside = await rollbackArm(db, () => grantRubric.writeGrantRubricGraph(db,
        { id: 'inv-program-rb', criteria: [{ id: 'c9', category: 'impact', room_section: section }] }));
      note('U5', { fn: 'writeGrantRubricGraph', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  await scenario('U6 room-birth writeSectionNodes: insert plus review_status UPDATE both log; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const slug = roomBirth.SECTION_NAMES[1];
      const { rows, result } = await logDelta(db, () => roomBirth.writeSectionNodes(db, [slug]));
      assert.equal(result, 1);
      expectUpsert(rows, 'node', slug, 2, 'insert plus confirm UPDATE');
      const again = await logDelta(db, () => roomBirth.writeSectionNodes(db, [slug]));
      expectUpsert(again.rows, 'node', slug, 2, 'second drive, UPDATE branch');
      const inside = await rollbackArm(db, () => roomBirth.writeSectionNodes(db, [roomBirth.SECTION_NAMES[2]]));
      note('U6', { fn: 'writeSectionNodes', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  await scenario('U7 verb-dispatch dispatchVerb: the handled-at UPDATE on the breakthrough node logs; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const arts = seedClaims(db, 3, 'u7');
      const mk = (id, art) => breakthroughSchema.writeBreakthrough(db, { id, kind: 'convergence', confidence: 0.8, theme: 'inventory', artifact_ids: [art] });
      const w1 = mk('bk:u7:a', arts[0]);
      const w2 = mk('bk:u7:b', arts[1]);
      assert.equal(w1.ok, true, JSON.stringify(w1));
      assert.equal(w2.ok, true, JSON.stringify(w2));
      const { rows, result } = await logDelta(db, () => verbDispatch.dispatchVerb('Confirm', 'bk:u7:a', { db }));
      assert.equal(result.ok, true, JSON.stringify(result));
      expectUpsert(rows, 'node', 'bk:u7:a', 1, 'breakthrough node UPDATE');
      expectUpsert(rows, 'node', result.eventId, 1, 'confirm memory_event');
      const filed = await logDelta(db, () => verbDispatch.dispatchVerb('File as decision', 'bk:u7:b', { db }));
      assert.equal(filed.result.ok, true, JSON.stringify(filed.result));
      expectUpsert(filed.rows, 'node', 'bk:u7:b');
      const inside = await rollbackArm(db, () => verbDispatch.dispatchVerb('Dismiss', 'bk:u7:a', { db }));
      note('U7', { fn: 'dispatchVerb', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok (Confirm, File as decision)' });
    });
  });

  await scenario('U8 scanner surfaceBreakthrough: the surfaced UPDATE on the breakthrough node logs; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const arts = seedClaims(db, 2, 'u8');
      const bk = { id: 'bk:u8:a', kind: 'convergence', confidence: 0.8, theme: 'inventory theme', artifact_ids: [arts[0]] };
      const bk2 = { id: 'bk:u8:b', kind: 'convergence', confidence: 0.8, theme: 'inventory theme two', artifact_ids: [arts[1]] };
      assert.equal(breakthroughSchema.writeBreakthrough(db, bk).ok, true);
      assert.equal(breakthroughSchema.writeBreakthrough(db, bk2).ok, true);
      const { rows, result } = await logDelta(db, () => scanner.surfaceBreakthrough(bk, { db, roomDir: room.roomDir }));
      assert.equal(result.ok, true, JSON.stringify(result));
      expectUpsert(rows, 'node', 'bk:u8:a', 1, 'surfaced UPDATE');
      const inside = await rollbackArm(db, () => scanner.surfaceBreakthrough(bk2, { db, roomDir: room.roomDir }));
      note('U8', { fn: 'surfaceBreakthrough', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });
}

// ---------------------------------------------------------------------------
// E rows
// ---------------------------------------------------------------------------

async function edgeRowsMatrix() {
  await scenario('E1 writeEdge: wide (review_status column) and base-edges (4-column) variants both log; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const [a, b, c] = seedClaims(db, 3, 'e1');
      const { rows, result } = await logDelta(db, () => navigation.writeEdge(db, {
        source_id: a, target_id: b, edge_type: 'INFORMS', properties: { origin: 'inventory' },
      }));
      assert.equal(result.ok, true, JSON.stringify(result));
      expectUpsert(rows, 'edge', edgeKey(a, b, 'INFORMS'));
      const again = await logDelta(db, () => navigation.writeEdge(db, { source_id: a, target_id: b, edge_type: 'INFORMS', properties: { origin: 'again' } }));
      expectUpsert(again.rows, 'edge', edgeKey(a, b, 'INFORMS'), 1, 'DO UPDATE branch');
      const inside = await rollbackArm(db, () => navigation.writeEdge(db, { source_id: b, target_id: c, edge_type: 'INFORMS', properties: {} }));
      note('E1', { fn: 'writeEdge', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok (wide)' });
    });
    const { db } = rawInstalled('legacy');
    try {
      const hasReviewStatus = db.prepare('PRAGMA table_info(edges)').all().some((c) => c.name === 'review_status');
      assert.equal(hasReviewStatus, false, 'the legacy raw room carries the base 4-column edges table');
      const { rows, result } = await logDelta(db, () => navigation.writeEdge(db, { source_id: 'x:a', target_id: 'x:b', edge_type: 'INFORMS', properties: {} }));
      assert.equal(result.ok, true, JSON.stringify(result));
      expectUpsert(rows, 'edge', edgeKey('x:a', 'x:b', 'INFORMS'), 1, 'base-edges variant');
      note('E1', { fn: 'writeEdge (wide, base-edges)', result: 'ok (wide and base-edges)' });
    } finally { db.close(); }
  });

  await scenario('E2 ingestion storeBrainSuggestions: INSERT OR IGNORE edge logs on insert, nothing when ignored; composes badly by design', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const [target] = seedClaims(db, 1, 'e2');
      const insight = 'brain_insight:job-e2:0';
      const packet = {
        job_id: 'job-e2',
        suggestions: [{
          suggestion_index: 0, summary: 'inventory', confidence: 0.4,
          graph_updates_proposed: [{ source: insight, target, type: 'INFORMS', confidence: 0.4 }],
        }],
      };
      const first = await logDelta(db, () => ingestion.storeBrainSuggestions(db, packet, 'inv-session'));
      assert.equal(first.result.ok, true, JSON.stringify(first.result));
      expectUpsert(first.rows, 'node', insight);
      expectUpsert(first.rows, 'edge', edgeKey(insight, target, 'INFORMS'));
      const second = await logDelta(db, () => ingestion.storeBrainSuggestions(db, packet, 'inv-session'));
      assert.equal(second.result.ok, true, JSON.stringify(second.result));
      assert.equal(edgeRows(second.rows, insight, target, 'INFORMS').length, 0, 'ignored INSERT OR IGNORE edge must log zero rows');
      // It owns an unconditional BEGIN, so it cannot compose: inside an outer
      // transaction it fails closed and leaves nothing behind.
      const before = maxSeq(db);
      db.exec('BEGIN IMMEDIATE');
      let refused = false;
      try { ingestion.storeBrainSuggestions(db, { job_id: 'job-e2-rb', suggestions: [{ suggestion_index: 0, summary: 'x' }] }, 's'); } catch (_e) { refused = true; }
      db.exec('ROLLBACK');
      assert.equal(refused, true, 'storeBrainSuggestions inside an outer transaction fails closed');
      assert.equal(maxSeq(db), before);
      note('E2', {
        fn: 'storeBrainSuggestions',
        rows: first.rows.length,
        rollback: 'n/a: owns an unconditional BEGIN (fails closed in an outer tx)',
        second: 'second drive: 0 rows (edge ignored)',
        result: 'ok',
      });
    });
  });

  await scenario('E3 graph-ops persistDecisionEdge and indexOpportunity (open-use-close): edges and the opportunity node log', async () => {
    const room = freshRoom('wide');
    const [a, b] = await withDb(room, async (db) => seedClaims(db, 2, 'e3'));
    const file = writeArtifact(room.roomDir, 'problem-definition', 'e3-artifact');
    await withDb(room, (db) => lazygraph.indexArtifact(db, room.roomDir, file));
    const dec = await logDeltaOwn(room, () => graphOps.persistDecisionEdge(room.roomDir, a, b, 'CONFIRMS', { reason: 'inventory' }));
    assert.equal(dec.result.success, true);
    expectUpsert(dec.rows, 'edge', edgeKey(a, b, 'CONFIRMS'));
    const opp = { problem_hash: 'opp:e3', domain: 'problem-definition' };
    const idx = await logDeltaOwn(room, () => graphOps.indexOpportunity(room.roomDir, opp));
    assert.equal(idx.result.success, true);
    expectUpsert(idx.rows, 'node', 'opp:e3');
    expectUpsert(idx.rows, 'edge', edgeKey('opp:e3', 'problem-definition', 'IN_DOMAIN'));
    expectUpsert(idx.rows, 'edge', edgeKey('opp:e3', 'problem-definition/e3-artifact', 'ADDRESSES'));
    note('E3', {
      fn: 'persistDecisionEdge, indexOpportunity',
      rows: dec.rows.length + idx.rows.length,
      rollback: 'n/a: open-use-close own handle',
      result: 'ok',
    });
  });

  await scenario('E4 lazygraph-ops: indexArtifact and each of the ten edge creators log an edge upsert; one rollback arm over all', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const [c0, c1, c2, c3] = seedClaims(db, 4, 'e4');
      const file = writeArtifact(room.roomDir, 'problem-definition', 'e4-artifact');

      const idx = await logDelta(db, () => lazygraph.indexArtifact(db, room.roomDir, file));
      expectUpsert(idx.rows, 'node', 'problem-definition/e4-artifact');
      expectUpsert(idx.rows, 'edge', edgeKey('problem-definition/e4-artifact', 'problem-definition', 'BELONGS_TO'));

      // triz: find any improving/worsening pair with principles.
      const matrix = JSON.parse(fs.readFileSync(path.join(REPO, 'references', 'methodology', 'triz-matrix.json'), 'utf8'));
      let triz = null;
      for (const imp of Object.keys(matrix)) {
        if (imp === '_meta' || typeof matrix[imp] !== 'object') continue;
        for (const wor of Object.keys(matrix[imp])) {
          if (Array.isArray(matrix[imp][wor]) && matrix[imp][wor].length > 0) { triz = [imp, wor]; break; }
        }
        if (triz) break;
      }
      assert.ok(triz, 'the TRIZ matrix carries at least one principle pair');

      const creators = [
        ['createAnalogyEdge', 'ANALOGOUS_TO', c0, c1, () => lazygraph.createAnalogyEdge(db, c0, c1, { analogy_distance: 'far' })],
        ['createIsomorphismEdge', 'STRUCTURALLY_ISOMORPHIC', c0, c2, () => lazygraph.createIsomorphismEdge(db, c0, c2, { isomorphism_score: 0.5 })],
        ['createResolutionEdge', 'RESOLVES_VIA', c1, c2, () => lazygraph.createResolutionEdge(db, c1, c2, { resolution_type: 'direct' })],
        ['createExtractedFromEdge', 'EXTRACTED_FROM', c2, c3, () => lazygraph.createExtractedFromEdge(db, c2, c3)],
        ['createCascadesToEdge', 'CASCADES_TO', c3, c0, () => lazygraph.createCascadesToEdge(db, c3, c0, { severity: 'low' })],
        ['enrichContradictionWithTRIZ', 'RESOLVES_VIA', c3, c1, () => lazygraph.enrichContradictionWithTRIZ(db, c3, c1, triz[0], triz[1])],
        ['linkWhitespaceToArtifact', 'WHITESPACE_DETECTED', c0, c3, () => lazygraph.linkWhitespaceToArtifact(db, c0, c3, 0.2)],
        ['linkWhitespaceToSection', 'WHITESPACE_NEAR', c1, c3, () => lazygraph.linkWhitespaceToSection(db, c1, c3, 0.3)],
        ['linkDiscoveryCycleSource', 'DISCOVERY_CYCLE_SOURCE', c2, c0, () => lazygraph.linkDiscoveryCycleSource(db, c2, c0, 'hsi', '2026-10-03T00:00:00.000Z')],
        ['upsertEdge', 'INFORMS', c3, c2, () => lazygraph.upsertEdge(db, { type: 'INFORMS', source: c3, target: c2, properties: { origin: 'inventory' } })],
      ];
      assert.equal(creators.length, 10, 'RESEARCH row E4 names ten edge creators besides _indexArtifactBody');
      let total = idx.rows.length;
      for (const [name, type, s, t, call] of creators) {
        const { rows, result } = await logDelta(db, call);
        const okResult = result === true || (result && (result.ok === true || result.success === true));
        assert.ok(okResult, name + ' returned ' + JSON.stringify(result));
        expectUpsert(rows, 'edge', edgeKey(s, t, type), 1, name);
        total += rows.length;
      }

      // One rollback arm over _indexArtifactBody and every creator.
      const file2 = writeArtifact(room.roomDir, 'problem-definition', 'e4-rollback');
      const inside = await rollbackArm(db, async () => {
        await lazygraph.indexArtifact(db, room.roomDir, file2);
        for (const [, , , , call] of creators) await call();
      });
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id = 'problem-definition/e4-rollback'").get().n, 0);
      note('E4', { fn: 'indexArtifact + 10 edge creators', rows: total, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok (11 statements)' });
    });
  });
}

// ---------------------------------------------------------------------------
// D rows
// ---------------------------------------------------------------------------

async function deleteRowsMatrix() {
  await scenario('D1 rebuildGraph (clearIndexerOwnedRows): deletes logged then re-created rows upserted; rollback logs nothing', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const fileA = writeArtifact(room.roomDir, 'problem-definition', 'd1-a');
      const fileB = writeArtifact(room.roomDir, 'problem-definition', 'd1-b');
      await lazygraph.indexArtifact(db, room.roomDir, fileA);
      await lazygraph.indexArtifact(db, room.roomDir, fileB);
      const idA = 'problem-definition/d1-a';
      const idB = 'problem-definition/d1-b';

      // Rollback arm first (the rebuild rolled back leaves both artifacts and no log rows).
      const inside = await rollbackArm(db, () => lazygraph.rebuildGraph(db, room.roomDir));
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE id IN (?, ?)').get(idA, idB).n, 2, 'rolled back rebuild kept both artifacts');

      fs.rmSync(fileB); // B vanished from disk: the rebuild must delete it and not recreate it
      const { rows, result } = await logDelta(db, () => lazygraph.rebuildGraph(db, room.roomDir));
      assert.equal(result.success, true, JSON.stringify(result));
      expectDelete(rows, 'node', idA);
      expectDelete(rows, 'node', idB);
      expectDelete(rows, 'node', 'problem-definition', 'section node');
      expectDelete(rows, 'edge', edgeKey(idA, 'problem-definition', 'BELONGS_TO'));
      expectDelete(rows, 'edge', edgeKey(idB, 'problem-definition', 'BELONGS_TO'));
      const lastSeq = (list) => Math.max(...list.map((r) => r.change_seq));
      const firstSeq = (list) => Math.min(...list.map((r) => r.change_seq));
      const aDeletes = rows.filter((r) => r.entity_id === idA && r.operation === 'delete');
      const aUpserts = rows.filter((r) => r.entity_id === idA && r.operation === 'upsert');
      assert.ok(aUpserts.length >= 1, 'A is re-created after the wipe');
      assert.ok(lastSeq(aDeletes) < firstSeq(aUpserts), 'A: delete rows come before its upsert rows');
      assert.equal(rows.filter((r) => r.entity_id === idB && r.operation === 'upsert').length, 0, 'B is gone: no re-create');
      note('D1', { fn: 'rebuildGraph', rows: rows.length, rollback: 'rows inside tx: ' + inside + ', after: 0', result: 'ok' });
    });
  });

  await scenario('D2 typed-entity purgeLegacySelfReferentialEntities: node and edge deletes logged; owns its BEGIN', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      const scaffold = 'inv-scaffold-kind';
      insertNode(db, 'memory_artifact:d2', 'memory_artifact', JSON.stringify({ kind: scaffold }), { epistemic_type: 'observation' });
      insertNode(db, 'entity:d2', 'company', '{}', { source_path: 'entity:d2', created_by: 'system', epistemic_type: 'observation' });
      const w = navigation.writeEdge(db, { source_id: 'entity:d2', target_id: 'memory_artifact:d2', edge_type: 'DESCRIBES', properties: {} });
      assert.equal(w.ok, true, JSON.stringify(w));
      const { rows, result } = await logDelta(db, () => typedEntity.purgeLegacySelfReferentialEntities(db, { scaffoldKinds: [scaffold] }));
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.purgedNodes, 1);
      expectDelete(rows, 'node', 'entity:d2');
      expectDelete(rows, 'edge', edgeKey('entity:d2', 'memory_artifact:d2', 'DESCRIBES'));

      // It owns an unconditional BEGIN: inside an outer transaction it fails closed (ok:false), nothing leaks.
      insertNode(db, 'entity:d2b', 'company', '{}', { source_path: 'entity:d2b', created_by: 'system', epistemic_type: 'observation' });
      navigation.writeEdge(db, { source_id: 'entity:d2b', target_id: 'memory_artifact:d2', edge_type: 'DESCRIBES', properties: {} });
      const before = maxSeq(db);
      db.exec('BEGIN IMMEDIATE');
      const refused = typedEntity.purgeLegacySelfReferentialEntities(db, { scaffoldKinds: [scaffold] });
      // Its own catch issues ROLLBACK, which ends the caller's outer transaction too
      // (open item for the SUMMARY: this site does not use the owns idiom).
      if (db.isTransaction) db.exec('ROLLBACK');
      assert.equal(refused.ok, false, 'composed purge fails closed');
      assert.equal(maxSeq(db), before);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id = 'entity:d2b'").get().n, 1, 'nothing deleted');
      note('D2', { fn: 'purgeLegacySelfReferentialEntities', rows: rows.length, rollback: 'n/a: owns an unconditional BEGIN (fails closed in an outer tx)', result: 'ok' });
    });
  });

  await scenario('D3 rs-engine writeReverseSalientEdges: the second run deletes the prior REVERSE_SALIENT edge (logged) then re-upserts', async () => {
    const room = freshRoom('wide');
    const pairs = [{
      source_artifact_id: 'rs/a', target_artifact_id: 'rs/b',
      source_title: 'A', target_title: 'B', source_section: 'problem-definition', target_section: 'market-analysis',
      lsa_score: 0.3, semantic_score: 0.6, signed_diff: 0.3, abs_diff: 0.3, direction: 'forward',
    }];
    const first = await logDeltaOwn(room, () => rsEngine.writeReverseSalientEdges(room.roomDir, pairs));
    assert.equal(first.result, 1);
    expectUpsert(first.rows, 'edge', edgeKey('rs/a', 'rs/b', 'REVERSE_SALIENT'));
    expectUpsert(first.rows, 'node', 'rs/a');
    const second = await logDeltaOwn(room, () => rsEngine.writeReverseSalientEdges(room.roomDir, pairs));
    const del = expectDelete(second.rows, 'edge', edgeKey('rs/a', 'rs/b', 'REVERSE_SALIENT'));
    const up = expectUpsert(second.rows, 'edge', edgeKey('rs/a', 'rs/b', 'REVERSE_SALIENT'));
    assert.ok(del[0].change_seq < up[up.length - 1].change_seq, 'delete precedes the re-upsert');
    note('D3', { fn: 'writeReverseSalientEdges', rows: second.rows.length, rollback: 'n/a: opens its own handle', result: 'ok' });
  });

  await scenario('D4 rs-sqlite-mirror buildRollbackSql: the returned rollback SQL deletes edges then nodes, all logged', async () => {
    const room = freshRoom('wide');
    const pair = {
      query_concept: 'rollback query', doc_concept: 'rollback doc', diff: 0.4, lsa: 0.5, bert: 0.1, passes: true,
      classification: 'structural_transfer', bridge_concept: 'shared structure',
      breakthrough: { score: 5.9, breakdown: { feasibility: 2, market: 1.5, magnitude: 1, advantage: 1.4, impact: 0 }, dominant_dimension: 'feasibility' },
      thesis: 'Rollback inventory thesis through the shared structure bridge.',
    };
    const ids = rsMirror._test.buildDeterministicIds(pair);
    const written = await rsMirror.writeDiscovery(pair, { roomDir: room.roomDir });
    assert.ok(typeof written.rollback_cypher === 'string' && written.rollback_cypher.length > 0);
    assert.equal(written.rollback_cypher, rsMirror._test.buildRollbackSql(ids));
    // No in-tree caller runs this SQL on room.db (it is named rollback_cypher and only
    // the Neo4j writer's twin is dispatched), so execute the returned statements on a
    // write-door handle, which is exactly what a dispatch caller would do.
    await withDb(room, async (db) => {
      const edgesBefore = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
      assert.ok(edgesBefore > 0);
      const { rows } = await logDelta(db, () => db.exec(written.rollback_cypher));
      for (const id of [ids.discovery_id, ids.rs_id, ids.innovation_id]) expectDelete(rows, 'node', id);
      assert.ok(rows.some((r) => r.entity_type === 'edge' && r.operation === 'delete'), 'edge deletes are logged');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE id IN (?, ?, ?)').get(ids.discovery_id, ids.rs_id, ids.innovation_id).n, 0);
      note('D4', { fn: 'buildRollbackSql (via writeDiscovery)', rows: rows.length, rollback: 'n/a: returned SQL, run on the test handle', result: 'ok' });
    });
  });
}

// ---------------------------------------------------------------------------
// exclusion, migration, scan, coverage
// ---------------------------------------------------------------------------

async function exclusionArm() {
  await scenario('exclusion: writes to excluded non-graph tables (facts, assumptions) log nothing; triggers target only nodes and edges', async () => {
    const room = freshRoom('wide');
    await withDb(room, async (db) => {
      for (const t of INVENTORY.excluded_tables.tables) {
        assert.ok(t !== 'nodes' && t !== 'edges', 'excluded table list must not name a graph table: ' + t);
      }
      const { rows, result } = await logDelta(db, () => memoryOps.addFact(db, { subject: 'inventory', predicate: 'is', object: 'excluded' }));
      assert.ok((await result).id >= 1, 'the facts row really landed');
      assert.equal(rows.length, 0, 'a facts write must yield zero log rows');
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM facts WHERE subject = 'inventory'").get().n, 1);
      const triggers = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'rcl_%'").all();
      assert.equal(triggers.length, 6);
      for (const t of triggers) assert.ok(t.tbl_name === 'nodes' || t.tbl_name === 'edges', 'change log trigger on ' + t.tbl_name);
    });
  });
}

async function migrationArm() {
  await scenario('M1 phase-109 rebuild: a write-door open of a legacy room reinstalls all six triggers and keeps the feed working', async () => {
    const room = freshRoom('legacy', false);
    const rawBefore = new DatabaseSync(room.dbPath, { readOnly: true });
    const colsBefore = rawBefore.prepare('PRAGMA table_info(nodes)').all().length;
    rawBefore.close();
    assert.equal(colsBefore, 3, 'the legacy fixture starts as the bare 3-column table');
    await withDb(room, async (db) => {
      const cols = db.prepare('PRAGMA table_info(nodes)').all().length;
      assert.ok(cols > 3, 'the write door rebuilt nodes (phase-109)');
      const trg = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'rcl_%'").all().map((r) => r.name).sort();
      assert.deepEqual(trg, [...changeLog.CHANGE_LOG_TRIGGERS].sort());
      const meta = changeLog.readChangeLogMeta(db);
      assert.ok(meta.present && meta.epoch, 'epoch minted');
      const { rows } = await logDelta(db, () => insertNode(db, 'm1:after', 'Artifact', PROPS, { epistemic_type: 'observation' }));
      expectUpsert(rows, 'node', 'm1:after');
      note('M1', { fn: 'runPhase109NodesProvenance rebuild', rows: rows.length, rollback: '-', result: 'ok (triggers reinstalled)' });
    });
  });
}

// ---- live wide-regex scan ----------------------------------------------------

function scanTree() {
  const re = new RegExp(INVENTORY.scan_regex, 'gi');
  const exts = new Set(INVENTORY.scan_extensions);
  const recordedNonWrite = INVENTORY.non_write_hits || [];
  const raw = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(nodes|edges|memory_event)\b/i; // check-substrate RE_RAW_WRITE
  const files = [];
  const walk = (dirRel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(REPO, dirRel), { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      const rel = dirRel + '/' + e.name;
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'tests') continue;
        if (rel === 'lib/core/migrations') continue;
        walk(rel);
      } else if (exts.has(path.extname(e.name))) {
        if (/\.test\.(cjs|js|mjs|ts)$/.test(e.name) || /^test-/.test(e.name)) continue;
        files.push(rel);
      }
    }
  };
  for (const root of INVENTORY.scan_roots) walk(root);
  const hits = {};
  let missedBySubstrateGuard = 0;
  let total = 0;
  for (const rel of files) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    const lines = src.split('\n');
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const ln = src.slice(0, m.index).split('\n').length;
      const text = lines[ln - 1];
      if (/^\s*(\/\/|\*|\/\*|#)/.test(text)) continue;
      if (recordedNonWrite.some((n) => n.file === rel && text.indexOf(n.needle) !== -1)) continue;
      (hits[rel] = hits[rel] || []).push(ln);
      total += 1;
      if (/\.(cjs|js|mjs|ts)$/.test(rel) && !raw.test(text)) missedBySubstrateGuard += 1;
    }
  }
  return { hits, total, missedBySubstrateGuard, fileCount: files.length };
}

async function scanArm() {
  await scenario('scan: live wide-regex scan of lib, scripts, bin and hooks matches the inventory per file; 0 unlisted mutation sites', async () => {
    const live = scanTree();
    const recorded = INVENTORY.per_file_statement_counts;
    const problems = [];
    let unlisted = 0;
    for (const f of Object.keys(live.hits)) {
      const n = live.hits[f].length;
      if (!(f in recorded)) {
        unlisted += n;
        problems.push(f + ': ' + n + ' unlisted mutation site(s) at line(s) ' + live.hits[f].join(', '));
      } else if (recorded[f] !== n) {
        problems.push(f + ': inventory says ' + recorded[f] + ', live scan found ' + n + ' at line(s) ' + live.hits[f].join(', '));
      }
    }
    for (const f of Object.keys(recorded)) {
      if (!(f in live.hits)) problems.push(f + ': inventory says ' + recorded[f] + ', live scan found 0 (writer removed?)');
    }
    // Every counted file must be covered by an inventory row (its path appears in a row's file field).
    const rowFiles = new Set(INVENTORY.rows.map((r) => r.file));
    for (const f of Object.keys(recorded)) {
      if (!rowFiles.has(f)) problems.push(f + ': counted but covered by no inventory row');
    }
    process.stdout.write('    scan: ' + live.fileCount + ' files, ' + live.total + ' mutation statements, ' + unlisted + ' unlisted mutation sites\n');
    process.stdout.write('    scan: scripts/check-substrate.cjs RE_RAW_WRITE would miss ' + live.missedBySubstrateGuard +
      ' of the ' + live.total + ' code hits (INSERT OR IGNORE, REPLACE INTO, quoted names; Pitfall 8, advisory)\n');
    if (problems.length > 0) {
      process.stdout.write('    a writer was added or removed: update tests/fixtures/369/writer-inventory.json and drive the new row here\n');
    }
    assert.deepEqual(problems, [], 'writer inventory drift:\n      ' + problems.join('\n      '));
    assert.equal(unlisted, 0);
  });
}

async function coverageArm() {
  await scenario('coverage: every inventory row has a covered_by, and every in-process claim names a scenario this run drove', async () => {
    const problems = [];
    for (const row of INVENTORY.rows) {
      const cb = row.covered_by;
      if (typeof cb !== 'string' || cb.length === 0) { problems.push(row.id + ': no covered_by'); continue; }
      if (cb.startsWith(SELF + '#')) {
        const id = cb.slice(SELF.length + 1).split(/[ ,]/)[0];
        if (!driven.has(id)) problems.push(row.id + ': covered_by names ' + id + ' but this run did not drive it');
        if (id !== row.id) problems.push(row.id + ': covered_by scenario ' + id + ' is not the row itself');
      } else {
        const m = cb.match(/^(test-369-[a-z-]+\.cjs)#/);
        if (m) {
          if (!fs.existsSync(path.join(__dirname, m[1]))) problems.push(row.id + ': covered_by names a missing file ' + m[1]);
        } else if (!/^(unreachable-in-process:|external writer)/.test(cb)) {
          problems.push(row.id + ': covered_by is not a scenario reference: ' + cb);
        }
      }
    }
    const inProcess = INVENTORY.rows.filter((r) => r.exercise === 'call').map((r) => r.id);
    for (const id of inProcess) {
      if (!driven.has(id)) problems.push(id + ': an in-process row was never driven');
    }
    assert.deepEqual(problems, [], 'coverage gaps:\n      ' + problems.join('\n      '));
  });
}

function printTable() {
  const order = INVENTORY.rows.map((r) => r.id);
  const lines = ['', 'row | function | log rows | rollback | result'];
  for (const id of order) {
    const r = report.get(id);
    if (!r) continue;
    const second = r.second && r.second !== '-' ? ' | ' + r.second : '';
    lines.push([id, r.fn, String(r.rows), r.rollback, r.result].join(' | ') + second);
  }
  const unfilled = order.filter((id) => !report.has(id));
  lines.push('(not driven in-process here: ' + (unfilled.length ? unfilled.join(', ') : 'none') + ')');
  process.stdout.write(lines.join('\n') + '\n');
}

(async function main() {
  process.stdout.write('test-369-writer-inventory (CHG369-04, D-18)\n');
  await nodeRowsMatrix();
  await updateRowsMatrix();
  await edgeRowsMatrix();
  await deleteRowsMatrix();
  await exclusionArm();
  await migrationArm();
  await scanArm();
  await coverageArm();
  printTable();
  process.stdout.write('\nPASS=' + passed + ' FAIL=' + failed + '\n');
  try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  process.stdout.write('FATAL ' + (e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
